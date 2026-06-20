import { useMemo, useState } from "react";
import { Plus, Pencil, CheckCircle2, XCircle, PlayCircle, FileText, Search, Trash2, ToggleLeft, ToggleRight, CreditCard, AlertTriangle, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { fmt, fmtFecha, METODOS_PAGO, formatoMontoInput, limpiarMonto } from "../lib/format";
import { Boton, ConfirmDialog, Modal, ModalHeader, campoCN as campo, etiquetaCN as etiqueta } from "../components/ui";
import Calendario, { ESTADO_COLOR } from "../components/Calendario";
import ReservaForm from "../components/ReservaForm";
import RecursoReservaForm from "../components/RecursoReservaForm";
import DocumentoPreview from "../components/pdf/DocumentoPreview";

const ESTADOS = ["todos", "pendiente", "confirmada", "en_curso", "finalizada", "cancelada"];
const ESTADO_LABEL = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const ESTADO_DESCRIPCION = {
  pendiente: "Solicitud creada, pendiente por confirmar.",
  confirmada: "Reserva aprobada, esperando llegada del cliente.",
  en_curso: "El cliente ya esta usando el recurso.",
  finalizada: "Servicio terminado y cerrado.",
  cancelada: "Reserva cancelada o cliente no asistio.",
};

const finDelDia = (fecha) => {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
};

const estadoOperativo = (r) => {
  const ahora = new Date();
  const inicio = new Date(r.fechaInicio);
  const fin = new Date(r.fechaFin);
  const saldo = Math.max(0, Number(r.saldoPendiente ?? (Number(r.montoTotal) - Number(r.anticipo || 0))));
  if (["cancelada", "finalizada"].includes(r.estado)) {
    return { label: ESTADO_LABEL[r.estado], color: ESTADO_COLOR[r.estado], alerta: false, mensaje: ESTADO_DESCRIPCION[r.estado] };
  }
  if (r.estado === "en_curso" && fin < ahora) {
    return { label: "Finalizada automaticamente", color: ESTADO_COLOR.finalizada, alerta: false, mensaje: "El periodo ya termino; el sistema la cierra como finalizada al actualizar." };
  }
  if (["pendiente", "confirmada"].includes(r.estado) && fin < ahora) {
    return { label: "Vencida por revisar", color: "#F58220", alerta: true, mensaje: "La fecha de reserva ya paso. Confirma si asistio o cancela como no asistio." };
  }
  if (r.estado === "confirmada" && inicio <= ahora && fin >= ahora) {
    return { label: "Lista para iniciar", color: "#0F766E", alerta: true, mensaje: "La reserva esta en su rango de fecha. Puedes iniciarla cuando el cliente llegue." };
  }
  if (saldo > 0 && r.estado !== "pendiente") {
    return { label: ESTADO_LABEL[r.estado], color: ESTADO_COLOR[r.estado], alerta: false, mensaje: `${ESTADO_DESCRIPCION[r.estado]} Saldo pendiente: ${fmt(saldo)}.` };
  }
  return { label: ESTADO_LABEL[r.estado], color: ESTADO_COLOR[r.estado], alerta: false, mensaje: ESTADO_DESCRIPCION[r.estado] };
};

export default function Reservas() {
  const {
    reservas, recursosReserva, clientes,
    guardarReserva, cambiarEstadoReserva, facturarReserva, registrarPagoReserva,
    guardarRecursoReserva, eliminarRecursoReserva,
  } = useStore();
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  const [mes, setMes] = useState(new Date());
  const [editar, setEditar] = useState(undefined);
  const [editarRecurso, setEditarRecurso] = useState(undefined);
  const [confirmarRecurso, setConfirmarRecurso] = useState(null);
  const [detalleDia, setDetalleDia] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [doc, setDoc] = useState(null);
  const [pagarReserva, setPagarReserva] = useState(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return reservas.filter((r) => {
      if (estado !== "todos" && r.estado !== estado) return false;
      const fi = new Date(r.fechaInicio);
      if (desde && fi < new Date(`${desde}T00:00:00`)) return false;
      if (hasta && fi > new Date(`${hasta}T23:59:59`)) return false;
      if (q && !r.cliente.toLowerCase().includes(q) && !r.recursoNombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reservas, busqueda, estado, desde, hasta]);

  const onSave = async (payload) => {
    try {
      await guardarReserva(payload);
      toast.success(payload.id ? "Reserva actualizada" : "Reserva creada");
      setEditar(undefined);
    } catch (e) {
      toast.error(e.message || "No se pudo guardar la reserva");
    }
  };

  const cambiarEstado = async (r, nuevoEstado) => {
    try {
      await cambiarEstadoReserva(r.id, nuevoEstado);
      toast.success(`Reserva ${ESTADO_LABEL[nuevoEstado]?.toLowerCase() || nuevoEstado}`);
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar el estado");
    }
  };

  const facturar = async (r) => {
    const saldo = Math.max(0, Number(r.saldoPendiente ?? (Number(r.montoTotal) - Number(r.anticipo || 0))));
    if (saldo <= 0) {
      toast("La reserva no tiene saldo pendiente por facturar", { icon: "i" });
      return;
    }
    try {
      const res = await facturarReserva(r.id, "Efectivo");
      setDoc({
        tipo: "FACTURA",
        numero: res.numero,
        fecha: res.fecha || new Date(),
        cliente: r.cliente,
        pago: "Efectivo",
        lineas: [{ nombre: `Reserva ${r.recursoNombre}`, cantidad: 1, precio: saldo, costo: 0, cat: r.tipo === "apartamento" ? "alojamiento" : "eventos" }],
      });
      toast.success("Reserva facturada");
    } catch (e) {
      toast.error(e.message || "No se pudo facturar la reserva");
    }
  };

  const registrarPago = async (payload) => {
    try {
      await registrarPagoReserva(payload);
      toast.success("Pago de reserva registrado");
      setPagarReserva(null);
    } catch (e) {
      toast.error(e.message || "No se pudo registrar el pago");
    }
  };

  const guardarRecurso = async (payload) => {
    try {
      await guardarRecursoReserva(payload);
      toast.success(payload.id ? "Recurso actualizado" : "Recurso creado");
      setEditarRecurso(undefined);
    } catch (e) {
      toast.error(e.message || "No se pudo guardar el recurso");
    }
  };

  const alternarRecurso = async (recurso) => {
    try {
      await guardarRecursoReserva({ ...recurso, activo: recurso.activo === false });
      toast.success(recurso.activo === false ? "Recurso activado" : "Recurso desactivado");
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar el estado del recurso");
    }
  };

  const eliminarRecurso = async () => {
    if (!confirmarRecurso) return;
    try {
      await eliminarRecursoReserva(confirmarRecurso);
      toast.success("Recurso eliminado");
      setConfirmarRecurso(null);
    } catch (e) {
      toast.error(e.message || "No se pudo eliminar. Si ya tiene reservas, desactivalo para conservar el historial.");
    }
  };

  const resumen = useMemo(() => {
    const activas = reservas.filter((r) => !["cancelada", "finalizada"].includes(r.estado));
    const porRevisar = reservas.filter((r) => estadoOperativo(r).alerta);
    return {
      activas: activas.length,
      porRevisar,
      anticipos: reservas.reduce((s, r) => s + (Number(r.anticipo) || 0), 0),
      porFacturar: reservas.filter((r) => !r.ventaId && !["cancelada", "finalizada"].includes(r.estado)).reduce((s, r) => s + Math.max(0, Number(r.saldoPendiente ?? (Number(r.montoTotal) - Number(r.anticipo || 0)))), 0),
    };
  }, [reservas]);

  const resumenRecursos = useMemo(() => {
    const conteo = new Map();
    reservas.forEach((r) => conteo.set(r.recursoId, (conteo.get(r.recursoId) || 0) + 1));
    return recursosReserva.map((r) => ({ ...r, totalReservas: conteo.get(r.id) || 0 }));
  }, [recursosReserva, reservas]);

  const seleccionarDia = (fechaDia, reservasDia) => {
    setDetalleDia({ fecha: fechaDia, reservas: reservasDia });
  };

  const renderEstado = (r) => {
    const op = estadoOperativo(r);
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: op.color || "#1A4FA0" }}>
          {op.alerta && <Clock size={11} />} {op.label}
        </span>
        <div className="max-w-[220px] text-[11px] text-sol-gris">{op.mensaje}</div>
      </div>
    );
  };

  const renderAccionesReserva = (r, saldo, compacto = false) => {
    const vencida = ["pendiente", "confirmada"].includes(r.estado) && new Date(r.fechaFin) < new Date();
    const puedeIniciar = r.estado === "confirmada" && new Date(r.fechaInicio) <= new Date() && new Date(r.fechaFin) >= new Date();
    const cls = compacto
      ? "rounded-lg px-2.5 py-1.5 text-xs font-bold border inline-flex items-center gap-1"
      : "rounded-lg px-3 py-1.5 text-xs font-bold border inline-flex items-center gap-1";
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <button onClick={() => setEditar(r)} className={`${cls} border-sol-borde text-sol-gris bg-white`} title="Abrir detalle de la reserva"><Pencil size={13} /> Editar</button>
        {r.estado === "pendiente" && !vencida && (
          <button onClick={() => cambiarEstado(r, "confirmada")} className={`${cls} border-sol-exito text-sol-exito bg-sol-exito/10`} title="Confirmar reserva"><CheckCircle2 size={13} /> Confirmar</button>
        )}
        {puedeIniciar && (
          <button onClick={() => cambiarEstado(r, "en_curso")} className={`${cls} border-sol-azul text-sol-azul bg-sol-azul/10`} title="Marcar que el cliente llego"><PlayCircle size={13} /> Iniciar</button>
        )}
        {r.estado === "en_curso" && (
          <button onClick={() => cambiarEstado(r, "finalizada")} className={`${cls} border-sol-exito text-sol-exito bg-sol-exito/10`} title="Cerrar reserva finalizada"><CheckCircle2 size={13} /> Finalizar</button>
        )}
        {vencida && (
          <>
            <button onClick={() => cambiarEstado(r, "finalizada")} className={`${cls} border-sol-exito text-sol-exito bg-sol-exito/10`} title="El cliente asistio y el servicio termino"><CheckCircle2 size={13} /> Asistio</button>
            <button onClick={() => cambiarEstado(r, "cancelada")} className={`${cls} border-sol-rojo text-sol-rojo bg-sol-rojo/10`} title="El cliente no asistio"><XCircle size={13} /> No asistio</button>
          </>
        )}
        {["pendiente", "confirmada"].includes(r.estado) && !vencida && (
          <button onClick={() => cambiarEstado(r, "cancelada")} className={`${cls} border-sol-rojo text-sol-rojo bg-sol-rojo/10`} title="Cancelar reserva"><XCircle size={13} /> Cancelar</button>
        )}
        {saldo > 0 && !["cancelada", "finalizada"].includes(r.estado) && (
          <button onClick={() => setPagarReserva(r)} className={`${cls} border-sol-exito text-sol-exito bg-white`} title={`Registrar abono ${fmt(saldo)}`}><CreditCard size={13} /> Abonar</button>
        )}
        {saldo > 0 && !r.ventaId && !["cancelada", "finalizada"].includes(r.estado) && (
          <button onClick={() => facturar(r)} className={`${cls} border-sol-azul text-sol-azul bg-white`} title={`Facturar saldo ${fmt(saldo)}`}><FileText size={13} /> Facturar</button>
        )}
      </div>
    );
  };

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Reservas</h1>
          <p className="text-sol-gris text-[13px]">Calendario, disponibilidad, anticipos y facturacion de apartamentos y eventos.</p>
        </div>
        <Boton onClick={() => setEditar(null)}><Plus size={16} /> Nueva reserva</Boton>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Reservas activas</div>
          <div className="text-2xl font-extrabold text-sol-azul">{resumen.activas}</div>
        </div>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Anticipos recibidos</div>
          <div className="text-2xl font-extrabold text-sol-exito">{fmt(resumen.anticipos)}</div>
        </div>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Saldo por facturar</div>
          <div className="text-2xl font-extrabold text-sol-rojo">{fmt(resumen.porFacturar)}</div>
        </div>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Requieren revision</div>
          <div className="text-2xl font-extrabold text-[#F58220]">{resumen.porRevisar.length}</div>
        </div>
      </div>

      {resumen.porRevisar.length > 0 && (
        <div className="mb-5 rounded-2xl border border-[#F58220]/30 bg-[#F58220]/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-[#F58220] shrink-0 mt-0.5" size={20} />
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-sol-tinta">Reservas por revisar</h2>
              <p className="text-sm text-sol-gris mt-1">
                Hay reservas cuyo rango de fechas ya paso o esta listo para iniciar. El sistema no cancela automaticamente una no asistencia; te muestra la alerta para que el admin confirme que paso.
              </p>
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {resumen.porRevisar.slice(0, 4).map((r) => {
                  const op = estadoOperativo(r);
                  return (
                    <div key={r.id} className="rounded-xl bg-white border border-sol-borde p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold">{r.recursoNombre}</div>
                          <div className="text-xs text-sol-gris">{r.cliente}</div>
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: op.color }}>{op.label}</span>
                      </div>
                      <p className="text-xs text-sol-gris mt-2">{op.mensaje}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {r.estado === "confirmada" && new Date(r.fechaInicio) <= new Date() && (
                          <button onClick={() => cambiarEstado(r, "en_curso")} className="rounded-lg px-3 py-1.5 text-xs font-bold bg-sol-azul text-white">Iniciar reserva</button>
                        )}
                        {["pendiente", "confirmada"].includes(r.estado) && new Date(r.fechaFin) < new Date() && (
                          <>
                            <button onClick={() => cambiarEstado(r, "finalizada")} className="rounded-lg px-3 py-1.5 text-xs font-bold bg-sol-exito text-white">Asistio, finalizar</button>
                            <button onClick={() => cambiarEstado(r, "cancelada")} className="rounded-lg px-3 py-1.5 text-xs font-bold bg-sol-rojo text-white">No asistio</button>
                          </>
                        )}
                        <button onClick={() => setEditar(r)} className="rounded-lg px-3 py-1.5 text-xs font-bold border border-sol-borde text-sol-gris">Ver detalle</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-2xl bg-white border border-sol-borde p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="font-extrabold">Recursos reservables</h2>
            <p className="text-sol-gris text-xs">Apartamentos, cabanas, kioskos, salones y espacios disponibles para reservas.</p>
          </div>
          {esAdmin && <Boton onClick={() => setEditarRecurso(null)}><Plus size={16} /> Nuevo recurso</Boton>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Recurso", "Tipo", "Capacidad", "Precio", "Estado", "Reservas", ""].map((h, i) =>
                <th key={i} className={`px-3 py-2.5 font-bold ${[2, 3, 5].includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {resumenRecursos.map((r) => (
                <tr key={r.id} className="border-t border-sol-suave">
                  <td className="px-3 py-2.5">
                    <div className="font-bold">{r.nombre}</div>
                    <div className="text-[11px] text-sol-grisClaro">{r.descripcion || "Sin descripcion"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-sol-gris">{r.tipo === "apartamento" ? "Apartamento / cabana" : "Kiosko / salon / evento"}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{r.capacidad || 0}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{fmt(r.precio || 0)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.activo === false ? "bg-sol-suave text-sol-gris" : "bg-sol-exito/10 text-sol-exito"}`}>
                      {r.activo === false ? "Inactivo" : "Activo"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">{r.totalReservas}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {esAdmin ? (
                      <>
                        <button onClick={() => alternarRecurso(r)} className="p-1.5" title={r.activo === false ? "Activar" : "Desactivar"}>
                          {r.activo === false ? <ToggleLeft size={16} className="text-sol-gris" /> : <ToggleRight size={16} className="text-sol-exito" />}
                        </button>
                        <button onClick={() => setEditarRecurso(r)} className="p-1.5" title="Editar"><Pencil size={15} className="text-sol-azul" /></button>
                        <button onClick={() => setConfirmarRecurso(r)} className="p-1.5" title="Eliminar"><Trash2 size={15} className="text-sol-rojo" /></button>
                      </>
                    ) : (
                      <span className="text-xs text-sol-grisClaro">Solo lectura</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!resumenRecursos.length && <p className="text-sol-gris text-sm p-6 text-center">Aun no hay recursos reservables creados.</p>}
        </div>
      </div>

      <Calendario
        fecha={mes}
        setFecha={setMes}
        reservas={reservas}
        onSelect={(r) => setEditar(r)}
        onDaySelect={seleccionarDia}
        selectedDate={detalleDia?.fecha}
      />

      {detalleDia && (
        <div className="mt-4 rounded-2xl bg-white border border-sol-borde p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="font-extrabold">Detalle del dia</h2>
              <p className="text-sol-gris text-xs">{fmtFecha(detalleDia.fecha)} · {detalleDia.reservas.length} reserva(s)</p>
            </div>
            <Boton variante="suave" onClick={() => setDetalleDia(null)}>Cerrar detalle</Boton>
          </div>
          {detalleDia.reservas.length ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {detalleDia.reservas.map((r) => {
                const saldo = Math.max(0, Number(r.saldoPendiente ?? (Number(r.montoTotal) - Number(r.anticipo || 0))));
                return (
                  <div key={r.id} className="rounded-xl border border-sol-borde p-3 bg-sol-crema/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold">{r.recursoNombre}</div>
                        <div className="text-xs text-sol-gris">{r.cliente}</div>
                      </div>
                      {renderEstado(r)}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-sol-gris">
                      <div><span className="font-bold text-sol-tinta">Inicio:</span> {fmtFecha(r.fechaInicio)}</div>
                      <div><span className="font-bold text-sol-tinta">Fin:</span> {fmtFecha(r.fechaFin)}</div>
                      <div><span className="font-bold text-sol-tinta">Personas:</span> {r.personas || 0}</div>
                      <div><span className="font-bold text-sol-tinta">Pagado:</span> {fmt(r.anticipo)}</div>
                      <div><span className="font-bold text-sol-tinta">Saldo:</span> {fmt(saldo)}</div>
                    </div>
                    {!!r.pagosReserva?.length && (
                      <div className="mt-3 rounded-lg bg-white border border-sol-borde p-2">
                        <div className="text-[11px] font-bold text-sol-gris uppercase">Pagos registrados</div>
                        <div className="mt-1 space-y-1">
                          {r.pagosReserva.map((p, i) => (
                            <div key={i} className="flex justify-between gap-2 text-xs">
                              <span className="text-sol-gris">{p.metodo}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                              <strong>{fmt(p.monto)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 rounded-lg bg-white border border-sol-borde p-2">
                      <div className="text-[11px] font-bold text-sol-gris uppercase">Nota de la reserva</div>
                      <div className="text-sm text-sol-tinta mt-1 whitespace-pre-wrap">{r.notas || "Sin nota registrada."}</div>
                    </div>
                    <div className="mt-3">
                      {renderAccionesReserva(r, saldo)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sol-gris text-sm p-4 text-center">No hay reservas activas en esta fecha.</p>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white border border-sol-borde p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-extrabold">Historial de reservas</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Cliente o recurso"
                className="rounded-lg pl-8 pr-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            </div>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
              {ESTADOS.map((e) => <option key={e} value={e}>{e === "todos" ? "Todos los estados" : ESTADO_LABEL[e]}</option>)}
            </select>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Recurso", "Cliente", "Fechas", "Personas", "Pagado", "Saldo", "Total", "Estado", "Acciones recomendadas"].map((h, i) =>
                <th key={i} className={`px-3 py-2.5 font-bold ${[3, 4, 5, 6].includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtradas.map((r) => {
                const saldo = Math.max(0, Number(r.saldoPendiente ?? (Number(r.montoTotal) - Number(r.anticipo || 0))));
                return (
                  <tr key={r.id} className="border-t border-sol-suave">
                    <td className="px-3 py-2.5">
                      <div className="font-bold">{r.recursoNombre}</div>
                      <div className="text-[11px] text-sol-grisClaro">{r.tipo === "apartamento" ? "Apartamento / cabana" : "Evento / kiosko"}</div>
                      {r.notas && <div className="text-[11px] text-sol-gris mt-1 max-w-[260px] truncate">Nota: {r.notas}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-sol-gris">{r.cliente}</td>
                    <td className="px-3 py-2.5 text-sol-gris">
                      <div>{fmtFecha(r.fechaInicio)}</div>
                      <div className="text-[11px]">{fmtFecha(r.fechaFin)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold">{r.personas || 0}</td>
                    <td className="px-3 py-2.5 text-right text-sol-exito font-bold">{fmt(r.anticipo)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${saldo > 0 ? "text-sol-rojo" : "text-sol-exito"}`}>{fmt(saldo)}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{fmt(r.montoTotal)}</td>
                    <td className="px-3 py-2.5">{renderEstado(r)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {renderAccionesReserva(r, saldo, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtradas.length && <p className="text-sol-gris text-sm p-6 text-center">No hay reservas que coincidan con los filtros.</p>}
        </div>
      </div>

      {editar !== undefined && (
        <ReservaForm
          inicial={editar}
          clientes={clientes}
          recursos={recursosReserva}
          onSave={onSave}
          onClose={() => setEditar(undefined)}
        />
      )}
      {editarRecurso !== undefined && esAdmin && (
        <RecursoReservaForm
          inicial={editarRecurso}
          onSave={guardarRecurso}
          onClose={() => setEditarRecurso(undefined)}
        />
      )}
      {confirmarRecurso && esAdmin && (
        <ConfirmDialog
          titulo="Eliminar recurso"
          mensaje={`Se eliminara "${confirmarRecurso.nombre}". Si ya tiene reservas registradas, Supabase puede bloquear la eliminacion para proteger el historial.`}
          confirmar="Eliminar"
          onConfirm={eliminarRecurso}
          onClose={() => setConfirmarRecurso(null)}
        />
      )}
      {doc && <DocumentoPreview doc={doc} onClose={() => setDoc(null)} />}
      {pagarReserva && (
        <PagoReservaForm
          reserva={pagarReserva}
          onSave={registrarPago}
          onClose={() => setPagarReserva(null)}
        />
      )}
    </section>
  );
}

function PagoReservaForm({ reserva, onSave, onClose }) {
  const saldo = Math.max(0, Number(reserva.saldoPendiente ?? (Number(reserva.montoTotal) - Number(reserva.anticipo || 0))));
  const [f, setF] = useState({ monto: formatoMontoInput(saldo), metodo: "Efectivo", referencia: "" });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    const monto = limpiarMonto(f.monto);
    if (monto <= 0 || monto > saldo) return;
    setGuardando(true);
    try {
      await onSave({ reservaId: reserva.id, monto, metodo: f.metodo, referencia: f.referencia });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-md">
      <ModalHeader title="Registrar pago de reserva" onClose={onClose} />
      <div className="p-4 space-y-3">
        <div className="rounded-xl bg-sol-suave p-3 text-sm">
          <div className="font-extrabold text-sol-tinta">{reserva.recursoNombre}</div>
          <div className="text-sol-gris">{reserva.cliente}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-sol-gris">Total</span><strong className="block">{fmt(reserva.montoTotal)}</strong></div>
            <div><span className="text-sol-gris">Pagado</span><strong className="block text-sol-exito">{fmt(reserva.anticipo)}</strong></div>
            <div><span className="text-sol-gris">Saldo</span><strong className="block text-sol-rojo">{fmt(saldo)}</strong></div>
          </div>
        </div>
        <label>
          <span className={etiqueta}>Monto a pagar</span>
          <input inputMode="numeric" className={campo} value={f.monto} onChange={(e) => set("monto", formatoMontoInput(e.target.value))} />
        </label>
        <label>
          <span className={etiqueta}>Metodo de pago</span>
          <select className={campo} value={f.metodo} onChange={(e) => set("metodo", e.target.value)}>
            {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Referencia / nota</span>
          <input className={campo} value={f.referencia} onChange={(e) => set("referencia", e.target.value)} placeholder="Ej: comprobante, transferencia, recibo" />
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || limpiarMonto(f.monto) <= 0 || limpiarMonto(f.monto) > saldo}>
          {guardando ? "Guardando..." : "Registrar pago"}
        </Boton>
      </div>
    </Modal>
  );
}
