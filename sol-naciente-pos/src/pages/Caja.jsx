import { useEffect, useMemo, useState } from "react";
import { Wallet, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, FileText, Clock, AlertCircle, CalendarDays, Store, BarChart3, Eye, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { fmt, formatoMontoInput, limpiarMonto } from "../lib/format";
import { calcularResumen } from "../lib/caja";
import * as cajaDb from "../lib/caja";
import { Boton, StatCard, Modal, ModalHeader, campoCN as campo, etiquetaCN as etiqueta } from "../components/ui";
import MovimientoCajaForm from "../components/MovimientoCajaForm";
import CuadrePreview from "../components/pdf/CuadrePreview";

const TIPO_LABEL = { apertura: "Apertura", venta: "Venta", ingreso: "Ingreso", egreso: "Gasto / Egreso", gasto: "Gasto", retiro: "Retiro de efectivo", cierre: "Cierre" };
const TIPO_COLOR = { apertura: "text-sol-azul", venta: "text-sol-exito", ingreso: "text-sol-exito", egreso: "text-sol-rojo", gasto: "text-sol-rojo", retiro: "text-sol-azulOsc", cierre: "text-sol-gris" };

const fechaHora = (d) => {
  const f = new Date(d);
  return `${f.toLocaleDateString("es-CO")} · ${f.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
};

const idUsuarioActual = (usuario) => (usuario?.id && usuario.id !== "demo" ? usuario.id : undefined);
const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const finDia = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const aInputDate = (d) => d.toISOString().slice(0, 10);
const aFechaLocal = (s) => new Date(`${s}T00:00:00`);

const utilidadVenta = (venta) => (venta.lineas || []).reduce((s, l) => {
  const cantidad = Number(l.cantidad) || 0;
  const precio = Number(l.precio) || 0;
  const costo = Number(l.costo) || 0;
  return s + ((precio - costo) * cantidad);
}, 0);

const resumenProductosVenta = (venta) => {
  const lineas = venta.lineas || [];
  if (!lineas.length) return "Sin detalle";
  const nombres = lineas.slice(0, 3).map((l) => `${Number(l.cantidad) || 0} x ${l.nombre}`).join(", ");
  return lineas.length > 3 ? `${nombres} + ${lineas.length - 3} mas` : nombres;
};

export default function Caja() {
  const {
    cajaActual, movimientosCaja, ventas, historialVentas, cargarHistorial,
    cargarCaja, abrirCaja, registrarMovimientoCaja, cerrarCaja,
    puntoVentaActual, puntosVenta, puntoVentaId,
  } = useStore();
  const { usuario } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [montoInicial, setMontoInicial] = useState("");
  const [movForm, setMovForm] = useState(null);
  const [montoCierre, setMontoCierre] = useState("");
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [previewCuadre, setPreviewCuadre] = useState(null);
  const hoy = new Date();
  const [desdeStr, setDesdeStr] = useState(aInputDate(hoy));
  const [hastaStr, setHastaStr] = useState(aInputDate(hoy));
  const [fPunto, setFPunto] = useState("actual");
  const [historialCajas, setHistorialCajas] = useState([]);
  const [historialMovs, setHistorialMovs] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [paginaVentasDetalle, setPaginaVentasDetalle] = useState(1);
  const ventasPorPagina = 10;

  useEffect(() => {
    cargarCaja().finally(() => setCargando(false));
  }, [cargarCaja]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const resumen = useMemo(
    () => (cajaActual ? calcularResumen(cajaActual, ventas, movimientosCaja) : null),
    [cajaActual, ventas, movimientosCaja]
  );

  const { desdeHist, hastaHist, idsPuntoHist } = useMemo(() => {
    const desde = inicioDia(aFechaLocal(desdeStr));
    const hasta = finDia(aFechaLocal(hastaStr));
    if (fPunto === "todos") return { desdeHist: desde, hastaHist: hasta, idsPuntoHist: null };
    const id = fPunto === "actual" ? puntoVentaId : fPunto;
    return { desdeHist: desde, hastaHist: hasta, idsPuntoHist: id ? [id] : null };
  }, [desdeStr, hastaStr, fPunto, puntoVentaId]);

  useEffect(() => {
    let activo = true;
    setCargandoHistorial(true);
    Promise.all([
      cajaDb.listCajasRango(desdeHist, hastaHist, idsPuntoHist || undefined),
      cajaDb.listMovimientosRango(desdeHist, hastaHist, idsPuntoHist || undefined),
    ])
      .then(([cajas, movs]) => {
        if (!activo) return;
        setHistorialCajas(cajas);
        setHistorialMovs(movs);
      })
      .catch((err) => {
        if (!activo) return;
        setHistorialCajas([]);
        setHistorialMovs([]);
        toast.error(err.message || "No se pudo cargar el historial de caja");
      })
      .finally(() => { if (activo) setCargandoHistorial(false); });
    return () => { activo = false; };
  }, [desdeHist, hastaHist, idsPuntoHist?.join("|")]);

  const historial = useMemo(() => {
    const ventasBase = historialVentas.length ? historialVentas : ventas;
    const detalle = historialCajas.map((caja) => {
      const apertura = new Date(caja.fecha_apertura);
      const cierre = caja.fecha_cierre ? new Date(caja.fecha_cierre) : hastaHist;
      const ventasCaja = ventasBase.filter((v) => {
        if (v.estado === "anulada") return false;
        if (v.id_caja === caja.id_caja) return true;
        if (v.id_caja) return false;
        const fechaVenta = new Date(v.fecha);
        return v.id_punto === caja.id_punto && fechaVenta >= apertura && fechaVenta <= cierre;
      });
      const movimientos = historialMovs.filter((m) => m.id_caja === caja.id_caja);
      const resumenCaja = calcularResumen(caja, ventasCaja, movimientos);
      const local = caja.puntos_venta?.nombre || puntosVenta.find((p) => p.id === caja.id_punto)?.nombre || "Sin local";
      return { caja, local, resumen: resumenCaja, movimientos, ventas: ventasCaja };
    });
    const ventasDetalle = detalle
      .flatMap((item) => item.ventas.map((venta) => ({ ...venta, caja: item.caja, local: item.local })))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const porLocal = {};
    detalle.forEach((item) => {
      const id = item.caja.id_punto || item.local;
      porLocal[id] = porLocal[id] || { id, local: item.local, cajas: 0, ventas: 0, totalVentas: 0, efectivo: 0, ingresos: 0, egresos: 0, retiros: 0, diferencia: 0 };
      porLocal[id].cajas += 1;
      porLocal[id].ventas += item.resumen.ventasCaja.length;
      porLocal[id].totalVentas += item.resumen.totalVentas;
      porLocal[id].efectivo += item.resumen.efectivo;
      porLocal[id].ingresos += item.resumen.ingresos;
      porLocal[id].egresos += item.resumen.egresos;
      porLocal[id].retiros += item.resumen.retiros;
      porLocal[id].diferencia += Number(item.caja.diferencia) || 0;
    });
    const global = Object.values(porLocal).reduce((acc, p) => ({
      cajas: acc.cajas + p.cajas,
      ventas: acc.ventas + p.ventas,
      totalVentas: acc.totalVentas + p.totalVentas,
      efectivo: acc.efectivo + p.efectivo,
      ingresos: acc.ingresos + p.ingresos,
      egresos: acc.egresos + p.egresos,
      retiros: acc.retiros + p.retiros,
      diferencia: acc.diferencia + p.diferencia,
    }), { cajas: 0, ventas: 0, totalVentas: 0, efectivo: 0, ingresos: 0, egresos: 0, retiros: 0, diferencia: 0 });
    const totalUtilidad = ventasDetalle.reduce((s, v) => s + utilidadVenta(v), 0);
    return { detalle, ventasDetalle, totalUtilidad, porLocal: Object.values(porLocal).sort((a, b) => b.totalVentas - a.totalVentas), global };
  }, [historialCajas, historialMovs, historialVentas, ventas, puntosVenta]);

  useEffect(() => {
    setPaginaVentasDetalle(1);
  }, [desdeStr, hastaStr, fPunto, historial.ventasDetalle.length]);

  const totalPaginasVentasDetalle = Math.max(1, Math.ceil(historial.ventasDetalle.length / ventasPorPagina));
  const paginaActualVentasDetalle = Math.min(paginaVentasDetalle, totalPaginasVentasDetalle);
  const inicioVentasDetalle = (paginaActualVentasDetalle - 1) * ventasPorPagina;
  const ventasDetallePagina = historial.ventasDetalle.slice(inicioVentasDetalle, inicioVentasDetalle + ventasPorPagina);
  const finVentasDetalle = Math.min(historial.ventasDetalle.length, inicioVentasDetalle + ventasPorPagina);
  const inicioPaginasVentas = Math.max(1, Math.min(paginaActualVentasDetalle - 2, totalPaginasVentasDetalle - 4));
  const paginasVentasDetalle = Array.from({ length: Math.min(totalPaginasVentasDetalle, 5) }, (_, i) => inicioPaginasVentas + i);
  const cambiarPaginaVentasDetalle = (pagina) => setPaginaVentasDetalle(Math.max(1, Math.min(totalPaginasVentasDetalle, pagina)));

  const abrir = async (e) => {
    e.preventDefault();
    const monto = limpiarMonto(montoInicial);
    if (montoInicial === "" || monto < 0) {
      toast.error("Ingresa un monto inicial válido");
      return;
    }
    try {
      await abrirCaja(monto, idUsuarioActual(usuario));
      toast.success("Caja abierta correctamente");
      setMontoInicial("");
    } catch (err) {
      toast.error(err.message || "No se pudo abrir la caja");
    }
  };

  const guardarMovimiento = async (tipo, descripcion, monto) => {
    try {
      await registrarMovimientoCaja(tipo, descripcion, monto, idUsuarioActual(usuario));
      toast.success("Movimiento registrado");
      setMovForm(null);
    } catch (err) {
      toast.error(err.message || "No se pudo registrar el movimiento");
    }
  };

  const diferenciaCierre = useMemo(() => {
    if (!resumen || montoCierre === "") return null;
    return limpiarMonto(montoCierre) - resumen.saldoEsperado;
  }, [montoCierre, resumen]);

  const confirmarCierre = async () => {
    const monto = limpiarMonto(montoCierre);
    if (montoCierre === "" || monto < 0) {
      toast.error("Ingresa el saldo real contado en caja");
      return;
    }
    try {
      const cerrada = await cerrarCaja(resumen.saldoEsperado, monto, idUsuarioActual(usuario));
      toast.success("Caja cerrada correctamente");
      setMostrarCierre(false);
      setPreviewCuadre({
        caja: cerrada,
        resumen,
        movimientos: [
          ...movimientosCaja,
          { tipo: "cierre", descripcion: "Cierre de caja", monto: cerrada.monto_final_real, fecha: cerrada.fecha_cierre },
        ],
      });
      setMontoCierre("");
    } catch (err) {
      toast.error(err.message || "No se pudo cerrar la caja");
    }
  };

  const historialCaja = (
    <div className="mt-5 space-y-3">
      <div className="rounded-2xl bg-white border border-sol-borde p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-extrabold text-lg flex items-center gap-2"><CalendarDays size={18} className="text-sol-azul" /> Historial de aperturas y cierres</h2>
            <p className="text-sol-gris text-[13px]">Consulta turnos por local o global, con ventas y movimientos reales registrados en Supabase.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={desdeStr} max={hastaStr} onChange={(e) => setDesdeStr(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            <span className="text-sol-gris text-xs">a</span>
            <input type="date" value={hastaStr} min={desdeStr} onChange={(e) => setHastaStr(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            <select value={fPunto} onChange={(e) => setFPunto(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
              <option value="actual">Local activo</option>
              <option value="todos">Todos los locales</option>
              {puntosVenta.filter((p) => p.activo !== false).map((p) => (
                <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <StatCard icon={Store} label="Turnos" value={historial.global.cajas} color="#1A4FA0" />
          <StatCard icon={ArrowUpCircle} label="Ventas del periodo" value={fmt(historial.global.totalVentas)} color="#159A5A" sub={`${historial.global.ventas} factura(s)`} />
          <StatCard icon={Receipt} label="Utilidad estimada" value={fmt(historial.totalUtilidad)} color={historial.totalUtilidad < 0 ? "#E22B23" : "#159A5A"} />
          <StatCard icon={Wallet} label="Efectivo vendido" value={fmt(historial.global.efectivo)} color="#F58220" />
          <StatCard icon={ArrowDownCircle} label="Gastos / retiros" value={fmt(historial.global.egresos + historial.global.retiros)} color="#E22B23" />
          <StatCard icon={BarChart3} label="Diferencia acumulada" value={fmt(historial.global.diferencia)} color={historial.global.diferencia < 0 ? "#E22B23" : "#159A5A"} />
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <h3 className="font-bold text-sm mb-3">Resumen por local</h3>
          {cargandoHistorial && <p className="text-sm text-sol-gris">Cargando historial...</p>}
          {!cargandoHistorial && !historial.porLocal.length && <p className="text-sm text-sol-gris">No hay aperturas o cierres en el rango seleccionado.</p>}
          <div className="space-y-2">
            {historial.porLocal.map((p) => (
              <div key={p.id} className="rounded-xl border border-sol-borde bg-sol-crema px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-sm truncate">{p.local}</div>
                  <div className="text-xs font-bold text-sol-gris">{p.cajas} turno(s)</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div><span className="text-sol-gris">Ventas</span><div className="font-bold text-sol-azul">{fmt(p.totalVentas)}</div></div>
                  <div><span className="text-sol-gris">Facturas</span><div className="font-bold">{p.ventas}</div></div>
                  <div><span className="text-sol-gris">Efectivo</span><div className="font-bold">{fmt(p.efectivo)}</div></div>
                  <div><span className="text-sol-gris">Diferencia</span><div className={`font-bold ${p.diferencia < 0 ? "text-sol-rojo" : "text-sol-exito"}`}>{fmt(p.diferencia)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
          <h3 className="font-bold text-sm p-4 pb-0">Detalle de turnos</h3>
          <table className="w-full text-sm min-w-[760px] mt-2">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Local", "Apertura", "Cierre", "Estado", "Ventas", "Facturas", "Esperado", "Real", "Diferencia", "Detalle"].map((h, i) => (
                <th key={i} className={`px-3 py-2.5 font-bold ${i >= 4 && i !== 9 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {historial.detalle.map(({ caja, local, resumen: r, movimientos }) => (
                <tr key={caja.id_caja} className="border-t border-sol-suave">
                  <td className="px-3 py-2.5 font-bold">{local}</td>
                  <td className="px-3 py-2.5 text-sol-gris whitespace-nowrap">{fechaHora(caja.fecha_apertura)}</td>
                  <td className="px-3 py-2.5 text-sol-gris whitespace-nowrap">{caja.fecha_cierre ? fechaHora(caja.fecha_cierre) : "En curso"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${caja.estado === "abierta" ? "bg-sol-exito/10 text-sol-exito" : "bg-sol-suave text-sol-gris"}`}>
                      {caja.estado === "abierta" ? "Abierta" : "Cerrada"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-sol-azul">{fmt(r.totalVentas)}</td>
                  <td className="px-3 py-2.5 text-right">{r.ventasCaja.length}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(caja.monto_final_esperado ?? r.saldoEsperado)}</td>
                  <td className="px-3 py-2.5 text-right">{caja.estado === "cerrada" ? fmt(caja.monto_final_real) : "-"}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${(Number(caja.diferencia) || 0) < 0 ? "text-sol-rojo" : "text-sol-exito"}`}>{caja.estado === "cerrada" ? fmt(caja.diferencia || 0) : "-"}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setPreviewCuadre({ caja: { ...caja, puntoNombre: local }, resumen: r, movimientos })}
                      className="inline-flex items-center gap-1 rounded-lg border border-sol-borde px-2.5 py-1.5 text-xs font-bold text-sol-azul hover:bg-sol-suave">
                      <Eye size={13} /> Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cargandoHistorial && !historial.detalle.length && <p className="text-sol-gris text-sm p-6 text-center">No hay turnos de caja para los filtros seleccionados.</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-white overflow-hidden border border-sol-borde">
        <div className="p-4 border-b border-sol-borde flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1.5"><Receipt size={15} className="text-sol-azul" /> Ventas detalladas del negocio</h3>
            <p className="text-xs text-sol-gris">Detalle consolidado de lo vendido en el rango seleccionado, asociado a cada turno de caja.</p>
          </div>
          <span className="rounded-full bg-sol-suave px-3 py-1 text-xs font-bold text-sol-azul">
            {historial.ventasDetalle.length
              ? `Mostrando ${inicioVentasDetalle + 1}-${finVentasDetalle} de ${historial.ventasDetalle.length}`
              : "0 venta(s)"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Fecha", "Local", "Turno", "Factura", "Cliente", "Vendedor", "Pago", "Productos", "Total", "Utilidad est."].map((h, i) => (
                <th key={i} className={`px-3 py-2.5 font-bold ${i >= 8 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ventasDetallePagina.map((v) => (
                <tr key={v.id || `${v.numero}-${v.fecha}`} className="border-t border-sol-suave align-top">
                  <td className="px-3 py-2.5 text-sol-gris whitespace-nowrap">{fechaHora(v.fecha)}</td>
                  <td className="px-3 py-2.5 font-bold">{v.local || v.puntoVenta || "Sin local"}</td>
                  <td className="px-3 py-2.5 text-xs text-sol-gris whitespace-nowrap">{fechaHora(v.caja.fecha_apertura)}</td>
                  <td className="px-3 py-2.5 font-bold text-sol-azul">{v.numero || v.id}</td>
                  <td className="px-3 py-2.5">{v.cliente || "Consumidor final"}</td>
                  <td className="px-3 py-2.5">{v.cajero || "Sin usuario"}</td>
                  <td className="px-3 py-2.5 text-sol-gris">{v.pago || "Efectivo"}</td>
                  <td className="px-3 py-2.5 text-sol-gris max-w-[260px]">{resumenProductosVenta(v)}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold">{fmt(v.total)}</td>
                  <td className={`px-3 py-2.5 text-right font-extrabold ${utilidadVenta(v) < 0 ? "text-sol-rojo" : "text-sol-exito"}`}>{fmt(utilidadVenta(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cargandoHistorial && !historial.ventasDetalle.length && (
            <p className="text-sol-gris text-sm p-6 text-center">No hay ventas asociadas a los turnos de caja del rango seleccionado.</p>
          )}
        </div>
        {historial.ventasDetalle.length > ventasPorPagina && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-sol-borde">
            <button
              type="button"
              onClick={() => cambiarPaginaVentasDetalle(paginaActualVentasDetalle - 1)}
              disabled={paginaActualVentasDetalle <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-sol-borde bg-white px-3 py-2 text-xs font-extrabold text-sol-azul disabled:opacity-40 disabled:text-sol-gris">
              <ChevronLeft size={15} /> Anterior
            </button>
            <div className="flex items-center justify-center gap-1">
              {inicioPaginasVentas > 1 && <span className="px-1 text-xs text-sol-gris">...</span>}
              {paginasVentasDetalle.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => cambiarPaginaVentasDetalle(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-extrabold border ${p === paginaActualVentasDetalle ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-gris border-sol-borde"}`}>
                  {p}
                </button>
              ))}
              {inicioPaginasVentas + paginasVentasDetalle.length - 1 < totalPaginasVentasDetalle && <span className="px-1 text-xs text-sol-gris">...</span>}
            </div>
            <button
              type="button"
              onClick={() => cambiarPaginaVentasDetalle(paginaActualVentasDetalle + 1)}
              disabled={paginaActualVentasDetalle >= totalPaginasVentasDetalle}
              className="inline-flex items-center gap-1 rounded-xl border border-sol-borde bg-white px-3 py-2 text-xs font-extrabold text-sol-azul disabled:opacity-40 disabled:text-sol-gris">
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (cargando) {
    return (
      <section className="flex-1 p-4 md:p-6 overflow-auto">
        <p className="text-sol-gris text-sm">Cargando caja…</p>
      </section>
    );
  }

  // ----- Sin caja abierta: pantalla de apertura -----
  if (!cajaActual) {
    return (
      <section className="flex-1 p-4 md:p-6 overflow-auto">
        <h1 className="font-extrabold text-2xl">Caja</h1>
        <div className="inline-flex mt-2 mb-2 rounded-full px-3 py-1 text-xs font-bold bg-sol-suave text-sol-azulOsc">
          Local: {puntoVentaActual?.nombre || "Sin local seleccionado"}
        </div>
        <p className="text-sol-gris text-[13px] mb-4">Abre la caja al iniciar el turno para registrar ventas, ingresos y gastos del día.</p>

        <div className="max-w-sm mx-auto mt-10 rounded-2xl bg-white p-6 border border-sol-borde text-center">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-sol-azul/10 flex items-center justify-center">
            <Unlock className="text-sol-azul" size={26} />
          </div>
          <h2 className="font-extrabold text-lg">Abrir caja</h2>
          <p className="text-sol-gris text-[13px] mt-1 mb-4">Ingresa el monto inicial en efectivo con el que arranca el turno.</p>
          <form onSubmit={abrir} className="space-y-3 text-left">
            <label>
              <span className={etiqueta}>Monto inicial en efectivo</span>
              <input required inputMode="numeric" className={campo} value={montoInicial}
                onChange={(e) => setMontoInicial(formatoMontoInput(e.target.value))} placeholder="0" />
            </label>
            <Boton type="submit" className="w-full"><Unlock size={16} /> Abrir caja</Boton>
          </form>
        </div>
        {historialCaja}
      </section>
    );
  }

  // ----- Caja abierta -----
  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h1 className="font-extrabold text-2xl flex items-center gap-2">
            <Wallet className="text-sol-azul" size={22} /> Caja
          </h1>
          <div className="inline-flex mt-2 rounded-full px-3 py-1 text-xs font-bold bg-sol-suave text-sol-azulOsc">
            Local: {puntoVentaActual?.nombre || "Sin local seleccionado"}
          </div>
          <p className="text-sol-gris text-[13px]">Resumen del turno actual y movimientos de caja.</p>
        </div>
        <div className="flex gap-2">
          <Boton variante="suave" onClick={() => setPreviewCuadre({ caja: cajaActual, resumen, movimientos: movimientosCaja })}>
            <FileText size={15} /> Ver cuadre
          </Boton>
          <Boton variante="rojo" onClick={() => { setMontoCierre(""); setMostrarCierre(true); }}>
            <Lock size={15} /> Cerrar caja
          </Boton>
        </div>
      </div>

      <div className="flex items-center gap-2 my-3 text-xs font-semibold bg-sol-exito/10 text-sol-exito rounded-xl px-3 py-2 w-fit">
        <AlertCircle size={14} /> Caja abierta desde el {fechaHora(cajaActual.fecha_apertura)} con un monto inicial de {fmt(cajaActual.monto_inicial)}.
      </div>

      <div className="grid gap-3 my-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard icon={Wallet} label="Monto inicial" value={fmt(cajaActual.monto_inicial)} color="#1A4FA0" />
        <StatCard icon={ArrowUpCircle} label="Total ventas" value={fmt(resumen.totalVentas)} color="#159A5A" sub={`${resumen.ventasCaja.length} venta(s)`} />
        <StatCard icon={ArrowUpCircle} label="Ingresos adicionales" value={fmt(resumen.ingresos)} color="#159A5A" />
        <StatCard icon={ArrowDownCircle} label="Gastos / retiros" value={fmt(resumen.egresos + resumen.retiros)} color="#E22B23" />
        <StatCard icon={Wallet} label="Saldo esperado en efectivo" value={fmt(resumen.saldoEsperado)} color="#F58220" />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Ventas por método de pago</h3>
          {!Object.keys(resumen.ventasPorMetodo).length && <p className="text-sm text-sol-gris">Aún no hay ventas registradas en este turno.</p>}
          {Object.entries(resumen.ventasPorMetodo).map(([metodo, monto]) => (
            <div key={metodo} className="flex items-center justify-between py-2 border-b border-sol-suave last:border-0">
              <span className="font-semibold text-[13px]">{metodo}</span>
              <span className="font-bold text-sol-azul">{fmt(monto)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Registrar movimiento</h3>
          <p className="text-sol-gris text-[13px] mb-3">Registra entradas o salidas de dinero que no son ventas (anticipos, gastos, retiros).</p>
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => setMovForm("ingreso")}><ArrowUpCircle size={15} /> Ingreso</Boton>
            <Boton variante="rojo" onClick={() => setMovForm("egreso")}><ArrowDownCircle size={15} /> Gasto / egreso</Boton>
            <Boton variante="suave" onClick={() => setMovForm("retiro")}><Wallet size={15} /> Retiro de efectivo</Boton>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
        <h3 className="font-bold text-sm p-4 pb-0 flex items-center gap-1.5"><Clock size={15} /> Historial de movimientos</h3>
        <table className="w-full text-sm min-w-[520px] mt-2">
          <thead><tr className="bg-sol-suave text-sol-gris">
            {["Tipo", "Descripción", "Hora", "Monto"].map((h, i) => (
              <th key={i} className={`px-4 py-2.5 font-bold ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {movimientosCaja.map((m) => (
              <tr key={m.id_movimiento} className="border-t border-sol-suave">
                <td className={`px-4 py-2.5 font-bold ${TIPO_COLOR[m.tipo] || ""}`}>{TIPO_LABEL[m.tipo] || m.tipo}</td>
                <td className="px-4 py-2.5 text-sol-gris">{m.descripcion || "—"}</td>
                <td className="px-4 py-2.5 text-sol-gris whitespace-nowrap">{fechaHora(m.fecha)}</td>
                <td className="px-4 py-2.5 text-right font-bold">{fmt(m.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {historialCaja}

      {movForm && (
        <MovimientoCajaForm tipoInicial={movForm} onSave={guardarMovimiento} onClose={() => setMovForm(null)} />
      )}

      {mostrarCierre && (
        <Modal onClose={() => setMostrarCierre(false)} max="max-w-md">
          <ModalHeader title="Cerrar caja" onClose={() => setMostrarCierre(false)} />
          <div className="p-4 space-y-3">
            <div className="rounded-xl bg-sol-suave p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-sol-gris">Monto inicial</span><span className="font-bold">{fmt(cajaActual.monto_inicial)}</span></div>
              <div className="flex justify-between"><span className="text-sol-gris">Ventas en efectivo</span><span className="font-bold">{fmt(resumen.efectivo)}</span></div>
              <div className="flex justify-between"><span className="text-sol-gris">Ingresos adicionales</span><span className="font-bold">{fmt(resumen.ingresos)}</span></div>
              <div className="flex justify-between"><span className="text-sol-gris">Gastos / egresos</span><span className="font-bold">- {fmt(resumen.egresos)}</span></div>
              <div className="flex justify-between"><span className="text-sol-gris">Retiros</span><span className="font-bold">- {fmt(resumen.retiros)}</span></div>
              <div className="flex justify-between pt-1 border-t border-sol-borde text-sol-azul font-extrabold"><span>Saldo esperado</span><span>{fmt(resumen.saldoEsperado)}</span></div>
            </div>
            <label>
              <span className={etiqueta}>Saldo real contado en caja (efectivo)</span>
              <input required inputMode="numeric" className={campo} value={montoCierre}
                onChange={(e) => setMontoCierre(formatoMontoInput(e.target.value))} placeholder="0" />
            </label>
            {montoCierre !== "" && (
              <div className={`rounded-xl p-3 text-sm font-bold text-center ${diferenciaCierre === 0 ? "bg-sol-exito/10 text-sol-exito" : "bg-sol-rojo/10 text-sol-rojo"}`}>
                {diferenciaCierre === 0 ? "La caja cuadra perfectamente." : diferenciaCierre > 0 ? `Sobran ${fmt(diferenciaCierre)}` : `Faltan ${fmt(Math.abs(diferenciaCierre))}`}
              </div>
            )}
            <Boton variante="rojo" className="w-full" onClick={confirmarCierre}><Lock size={16} /> Confirmar cierre de caja</Boton>
          </div>
        </Modal>
      )}

      {previewCuadre && <CuadrePreview cuadre={previewCuadre} onClose={() => setPreviewCuadre(null)} />}
    </section>
  );
}
