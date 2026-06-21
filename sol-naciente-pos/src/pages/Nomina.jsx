import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Pencil, Trash2, Search, FileText, Lock, CheckCircle2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { fmt, formatoMontoInput, limpiarMonto } from "../lib/format";
import { descargarExcel } from "../lib/excel";
import * as nominaDb from "../lib/nomina";
import { Boton, ConfirmDialog, Modal, ModalHeader, campoCN as campo, etiquetaCN as etiqueta } from "../components/ui";
import EmpleadoForm from "../components/EmpleadoForm";
import NominaPreview from "../components/pdf/NominaPreview";

const TIPOS_PERIODO = ["Quincenal", "Mensual"];
const ESTADO_LABEL = { abierto: "Abierto", liquidado: "Liquidado", pagado: "Pagado" };
const ESTADO_COLOR = { abierto: "#1A4FA0", liquidado: "#FBB814", pagado: "#159A5A" };
const numCN = "w-24 rounded-md px-2 py-1 text-xs border border-sol-borde bg-white text-right focus:outline-none focus:border-sol-azul disabled:opacity-50 disabled:bg-sol-suave";
const checkCN = "h-4 w-4 rounded border-sol-borde text-sol-azul focus:ring-sol-azul";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const diasEntre = (ini, fin) => {
  if (!ini || !fin) return 0;
  const a = new Date(ini), b = new Date(fin);
  return Math.round((b - a) / 86400000) + 1;
};

const salarioBasePeriodo = (empleado, periodo, diasTrabajados) => {
  const diasPeriodo = Math.max(1, diasEntre(periodo?.fechaInicio, periodo?.fechaFin));
  const sueldoMensual = Number(empleado?.salarioBase) || 0;
  const basePeriodo = periodo?.tipo === "Quincenal" ? sueldoMensual / 2 : sueldoMensual;
  const dias = Math.min(Math.max(0, Number(diasTrabajados) || 0), diasPeriodo);
  return Math.round((basePeriodo * dias) / diasPeriodo);
};

function PeriodoForm({ onSave, onClose }) {
  const hoy = new Date();
  const [f, setF] = useState({ nombre: "", fechaInicio: "", fechaFin: "", tipo: "Quincenal", mes: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`, quincena: "1" });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!f.mes) return;
    const [year, month] = f.mes.split("-").map(Number);
    const ultimoDia = new Date(year, month, 0).getDate();
    const mesNombre = MESES[month - 1];
    if (f.tipo === "Mensual") {
      setF((s) => ({ ...s, nombre: `${mesNombre}`, fechaInicio: `${f.mes}-01`, fechaFin: `${f.mes}-${String(ultimoDia).padStart(2, "0")}` }));
      return;
    }
    const inicio = f.quincena === "1" ? "01" : "16";
    const fin = f.quincena === "1" ? "15" : String(ultimoDia).padStart(2, "0");
    setF((s) => ({ ...s, nombre: `${mesNombre}/${f.quincena}`, fechaInicio: `${f.mes}-${inicio}`, fechaFin: `${f.mes}-${fin}` }));
  }, [f.mes, f.tipo, f.quincena]);

  const guardar = async () => {
    if (!f.nombre.trim() || !f.fechaInicio || !f.fechaFin) return;
    setGuardando(true);
    try { await onSave(f); } finally { setGuardando(false); }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Nuevo período de nómina" onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label><span className={etiqueta}>Mes asociado</span>
          <input type="month" className={campo} value={f.mes} onChange={(e) => set("mes", e.target.value)} /></label>
        <label><span className={etiqueta}>Tipo</span>
          <select className={campo} value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS_PERIODO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {f.tipo === "Quincenal" && (
          <label className="col-span-2"><span className={etiqueta}>Quincena</span>
            <select className={campo} value={f.quincena} onChange={(e) => set("quincena", e.target.value)}>
              <option value="1">Primer pago del mes (1 al 15)</option>
              <option value="2">Segundo pago del mes (16 al fin de mes)</option>
            </select>
          </label>
        )}
        <label className="col-span-2"><span className={etiqueta}>Nombre del pago</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: junio/1" /></label>
        <label><span className={etiqueta}>Fecha inicio</span>
          <input type="date" className={campo} value={f.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} /></label>
        <label><span className={etiqueta}>Fecha fin</span>
          <input type="date" className={campo} value={f.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} /></label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim() || !f.fechaInicio || !f.fechaFin}>
          {guardando ? "Creando…" : "Crear período"}
        </Boton>
      </div>
    </Modal>
  );
}

export default function Nomina() {
  const {
    empleados, guardarEmpleado, eliminarEmpleado,
    periodos, crearPeriodo, cambiarEstadoPeriodo,
    liquidaciones, cargarLiquidaciones, guardarLiquidacion,
  } = useStore();

  const [tab, setTab] = useState("empleados");
  const [busqueda, setBusqueda] = useState("");
  const [editEmp, setEditEmp] = useState(undefined);
  const [confirmar, setConfirmar] = useState(null);
  const [nuevoPeriodo, setNuevoPeriodo] = useState(false);
  const [periodoSel, setPeriodoSel] = useState(null);
  const [edits, setEdits] = useState({});
  const [comprobante, setComprobante] = useState(null);

  const cargosSugeridos = useMemo(() => [...new Set(empleados.map((e) => e.cargo).filter(Boolean))], [empleados]);

  const empleadosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return empleados.filter((e) =>
      !q || e.nombre.toLowerCase().includes(q) || (e.documento || "").toLowerCase().includes(q) || (e.cargo || "").toLowerCase().includes(q));
  }, [empleados, busqueda]);

  const onSaveEmp = async (e) => {
    try { await guardarEmpleado(e); toast.success(e.id ? "Empleado actualizado" : "Empleado creado"); setEditEmp(undefined); }
    catch (err) { toast.error(err.message || "No se pudo guardar"); }
  };
  const eliminar = async () => {
    try { await eliminarEmpleado(confirmar.id); toast.success(`"${confirmar.nombre}" eliminado`); }
    catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    finally { setConfirmar(null); }
  };

  const abrirPeriodo = async (p) => {
    setPeriodoSel(p);
    setEdits({});
    await cargarLiquidaciones(p.id);
  };

  // Inicializa los valores editables de cada empleado a partir de su liquidación guardada (o valores por defecto).
  useEffect(() => {
    if (!periodoSel) return;
    const dias = diasEntre(periodoSel.fechaInicio, periodoSel.fechaFin);
    setEdits((prev) => {
      const next = { ...prev };
      for (const l of liquidaciones) {
        if (next[l.empleado.id]) continue;
        const get = (n) => l.conceptos.find((c) => c.nombre === n)?.valor || 0;
        next[l.empleado.id] = {
          diasTrabajados: l.diasTrabajados ?? dias,
          salarioPeriodo: get("Salario") || salarioBasePeriodo(l.empleado, periodoSel, l.diasTrabajados ?? dias),
          horasExtra: get("Horas extra"),
          bonificacion: get("Bonificación"),
          prestamo: get("Préstamo"),
          aplicarSalud: !!get("Salud"),
          aplicarPension: !!get("Pensión"),
          montoPagado: l.montoPagado || 0,
        };
      }
      return next;
    });
  }, [liquidaciones, periodoSel]);

  const crearNuevoPeriodo = async (datos) => {
    try {
      const p = await crearPeriodo(datos);
      toast.success("Período creado");
      setNuevoPeriodo(false);
      await abrirPeriodo(p);
    } catch (e) { toast.error(e.message || "No se pudo crear el período"); }
  };

  const setEdit = (idEmpleado, clave, valor) =>
    setEdits((prev) => ({ ...prev, [idEmpleado]: { ...prev[idEmpleado], [clave]: valor } }));

  const calcular = (empleado, e) => {
    const dias = diasEntre(periodoSel.fechaInicio, periodoSel.fechaFin) || 1;
    const diasTrabajados = Number(e?.diasTrabajados ?? dias);
    const salarioEsperado = salarioBasePeriodo(empleado, periodoSel, diasTrabajados);
    const salarioDigitado = limpiarMonto(e?.salarioPeriodo);
    const salarioProporcional = salarioDigitado || salarioEsperado;
    const salarioExcedePeriodo = salarioProporcional > salarioEsperado;
    const salud = e?.aplicarSalud ? Math.round(salarioProporcional * 0.04) : 0;
    const pension = e?.aplicarPension ? Math.round(salarioProporcional * 0.04) : 0;
    const horasExtra = limpiarMonto(e?.horasExtra);
    const bonificacion = limpiarMonto(e?.bonificacion);
    const prestamo = limpiarMonto(e?.prestamo);
    const totalDevengado = salarioProporcional + horasExtra + bonificacion;
    const totalDeducciones = salud + pension + prestamo;
    const netoPagar = totalDevengado - totalDeducciones;
    const montoPagado = Math.min(Math.max(0, limpiarMonto(e?.montoPagado)), Math.max(0, netoPagar));
    return { diasTrabajados, salarioProporcional, salarioEsperado, salarioExcedePeriodo, salud, pension, horasExtra, bonificacion, prestamo, totalDevengado, totalDeducciones, netoPagar, montoPagado, saldoPendiente: Math.max(0, netoPagar - montoPagado) };
  };

  const guardarFila = async (l) => {
    const calc = calcular(l.empleado, edits[l.empleado.id]);
    if (calc.salarioExcedePeriodo) {
      toast.error(`El sueldo del periodo no puede superar ${fmt(calc.salarioEsperado)} para ${periodoSel.tipo.toLowerCase()}. Usa bonificación si es un pago adicional.`);
      return;
    }
    const conceptos = [
      { nombre: "Salario", tipo: "devengado", valor: calc.salarioProporcional },
      ...(calc.horasExtra > 0 ? [{ nombre: "Horas extra", tipo: "devengado", valor: calc.horasExtra }] : []),
      ...(calc.bonificacion > 0 ? [{ nombre: "Bonificación", tipo: "devengado", valor: calc.bonificacion }] : []),
      ...(calc.salud > 0 ? [{ nombre: "Salud", tipo: "deduccion", valor: calc.salud }] : []),
      ...(calc.pension > 0 ? [{ nombre: "Pensión", tipo: "deduccion", valor: calc.pension }] : []),
      ...(calc.prestamo > 0 ? [{ nombre: "Préstamo", tipo: "deduccion", valor: calc.prestamo }] : []),
    ];
    try {
      await guardarLiquidacion(periodoSel.id, l.empleado.id, { diasTrabajados: calc.diasTrabajados, conceptos, montoPagado: calc.montoPagado });
      toast.success(`Liquidación de ${l.empleado.nombre} guardada`);
    } catch (err) { toast.error(err.message || "No se pudo guardar la liquidación"); }
  };

  const cambiarEstado = async (estado) => {
    try {
      await cambiarEstadoPeriodo(periodoSel.id, estado);
      setPeriodoSel((p) => ({ ...p, estado }));
      toast.success(`Período marcado como "${ESTADO_LABEL[estado]}"`);
      await cargarLiquidaciones(periodoSel.id);
    } catch (e) { toast.error(e.message || "No se pudo actualizar el período"); }
  };

  const totalNomina = liquidaciones.reduce((s, l) => s + (l.netoPagar || 0), 0);
  const totalPagado = liquidaciones.reduce((s, l) => s + (Number(l.montoPagado) || 0), 0);
  const totalPendiente = liquidaciones.reduce((s, l) => s + Math.max(0, Number(l.netoPagar || 0) - Number(l.montoPagado || 0)), 0);
  const bloqueado = periodoSel?.estado === "pagado";
  const estadoPago = (calc) => {
    if (calc.montoPagado <= 0) return { label: "Pendiente", color: "#E22B23" };
    if (calc.saldoPendiente > 0) return { label: "Parcial", color: "#F58220" };
    return { label: "Pagado", color: "#159A5A" };
  };

  const exportarNomina = async () => {
    const t = toast.loading("Preparando Excel de nómina...");
    try {
      const filas = await nominaDb.listReporteNomina();
      const totalNeto = filas.reduce((s, f) => s + Number(f.netoPagar || 0), 0);
      const totalPagadoReporte = filas.reduce((s, f) => s + Number(f.montoPagado || 0), 0);
      const totalPendienteReporte = filas.reduce((s, f) => s + Number(f.saldoPendiente || 0), 0);
      descargarExcel({
        nombreArchivo: `reporte-nomina-${new Date().toISOString().slice(0, 10)}.xls`,
        hojas: [
          {
            nombre: "Resumen",
            filas: [
              ["Concepto", "Valor"],
              ["Liquidaciones", filas.length],
              ["Neto causado", totalNeto],
              ["Pagado", totalPagadoReporte],
              ["Saldo pendiente", totalPendienteReporte],
            ],
          },
          {
            nombre: "Nomina detallada",
            filas: [
              ["Periodo", "Inicio", "Fin", "Empleado", "Documento", "Cargo", "Dias", "Devengado", "Deducciones", "Neto", "Pagado", "Saldo pendiente", "Estado pago", "Fecha pago"],
              ...filas.map((f) => [f.periodo, f.fechaInicio, f.fechaFin, f.empleado, f.documento, f.cargo, f.diasTrabajados || "", f.totalDevengado, f.totalDeducciones, f.netoPagar, f.montoPagado, f.saldoPendiente, f.estadoPago, f.fechaPago || ""]),
            ],
          },
        ],
      });
      toast.success("Excel de nómina descargado", { id: t });
    } catch (e) {
      toast.error(e.message || "No se pudo exportar la nómina", { id: t });
    }
  };

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Nómina</h1>
          <p className="text-sol-gris text-[13px]">Empleados, períodos de pago y liquidación de nómina.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Boton variante="contorno" onClick={exportarNomina}><Download size={16} /> Exportar Excel</Boton>
          {tab === "empleados" && <Boton onClick={() => setEditEmp(null)}><Plus size={16} /> Nuevo empleado</Boton>}
          {tab === "periodos" && !periodoSel && <Boton onClick={() => setNuevoPeriodo(true)}><Plus size={16} /> Nuevo período</Boton>}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ id: "empleados", label: "Empleados" }, { id: "periodos", label: "Períodos" }].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setPeriodoSel(null); }}
            className={`rounded-full px-4 py-2 text-xs font-bold transition border ${tab === t.id ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde hover:border-sol-azul"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "empleados" && (
        <>
          <div className="relative mb-4 max-w-md">
            <Search size={17} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, documento o cargo…"
              className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          </div>

          <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-sol-suave text-sol-gris">
                {["Nombre", "Documento", "Cargo", "Salario base", "Contrato", "Estado", ""].map((h, i) =>
                  <th key={i} className={`px-4 py-2.5 font-bold ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {empleadosFiltrados.map((e) => (
                  <tr key={e.id} className="border-t border-sol-suave">
                    <td className="px-4 py-2.5 font-bold">{e.nombre}</td>
                    <td className="px-4 py-2.5 text-sol-gris">{e.documento || "—"}</td>
                    <td className="px-4 py-2.5 text-sol-gris">{e.cargo}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmt(e.salarioBase)}</td>
                    <td className="px-4 py-2.5 text-sol-gris">{e.tipoContrato || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: (e.activo !== false ? "#159A5A" : "#E22B23") + "1A", color: e.activo !== false ? "#159A5A" : "#E22B23" }}>
                        {e.activo !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setEditEmp(e)} className="p-1.5"><Pencil size={15} className="text-sol-azul" /></button>
                      <button onClick={() => setConfirmar({ id: e.id, nombre: e.nombre })} className="p-1.5"><Trash2 size={15} className="text-sol-rojo" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!empleadosFiltrados.length && <p className="text-sol-gris text-sm p-6 text-center">Aún no has registrado empleados.</p>}
          </div>
        </>
      )}

      {tab === "periodos" && !periodoSel && (
        <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Período", "Fechas", "Tipo", "Estado", ""].map((h, i) =>
                <th key={i} className="px-4 py-2.5 font-bold text-left">{h}</th>)}
            </tr></thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p.id} className="border-t border-sol-suave">
                  <td className="px-4 py-2.5 font-bold">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-sol-gris whitespace-nowrap">{p.fechaInicio} a {p.fechaFin}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{p.tipo || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: ESTADO_COLOR[p.estado] + "1A", color: ESTADO_COLOR[p.estado] }}>
                      {ESTADO_LABEL[p.estado] || p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => abrirPeriodo(p)} className="text-xs font-bold text-sol-azul hover:underline">Ver liquidación</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!periodos.length && <p className="text-sol-gris text-sm p-6 text-center">Aún no has creado períodos de nómina.</p>}
        </div>
      )}

      {tab === "periodos" && periodoSel && (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setPeriodoSel(null)} className="p-2 rounded-lg border border-sol-borde hover:bg-sol-suave"><ArrowLeft size={16} /></button>
              <div>
                <h2 className="font-extrabold">{periodoSel.nombre}</h2>
                <p className="text-sol-gris text-xs">{periodoSel.fechaInicio} a {periodoSel.fechaFin} · {periodoSel.tipo}</p>
              </div>
              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: ESTADO_COLOR[periodoSel.estado] + "1A", color: ESTADO_COLOR[periodoSel.estado] }}>
                {ESTADO_LABEL[periodoSel.estado] || periodoSel.estado}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg px-4 py-2 text-xs font-bold bg-sol-suave text-sol-azulOsc">
                Total nómina: <span className="text-sm">{fmt(totalNomina)}</span>
              </div>
              <div className="rounded-lg px-4 py-2 text-xs font-bold bg-sol-suave text-sol-exito">
                Pagado: <span className="text-sm">{fmt(totalPagado)}</span>
              </div>
              <div className="rounded-lg px-4 py-2 text-xs font-bold bg-sol-suave text-sol-rojo">
                Pendiente: <span className="text-sm">{fmt(totalPendiente)}</span>
              </div>
              {periodoSel.estado === "abierto" && (
                <Boton variante="contorno" onClick={() => cambiarEstado("liquidado")}><CheckCircle2 size={15} /> Marcar liquidado</Boton>
              )}
              {periodoSel.estado === "liquidado" && (
                <Boton onClick={() => cambiarEstado("pagado")}><Lock size={15} /> Marcar pagado</Boton>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
            <table className="w-full text-sm min-w-[1280px]">
              <thead>
                <tr className="bg-sol-suave text-sol-gris">
                  {["Empleado", "Cargo", "Dias", "Sueldo periodo", "Horas extra", "Bonificacion", "Deducciones", "Prestamo", "Neto", "Pagado", "Saldo", "Estado pago", ""].map((h, i) =>
                    <th key={i} className={`px-3 py-2.5 font-bold whitespace-nowrap ${[3, 4, 5, 7, 8, 9, 10].includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr>
                <tr className="hidden">
                {["Empleado", "Cargo", "Días", "Horas extra", "Bonificación", "Préstamo", "Devengado", "Deducciones", "Neto a pagar", ""].map((h, i) =>
                  <th key={i} className={`px-3 py-2.5 font-bold whitespace-nowrap ${i >= 6 ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {liquidaciones.map((l) => {
                  const e = edits[l.empleado.id] || {};
                  const calc = calcular(l.empleado, e);
                  const pago = estadoPago(calc);
                  return (
                    <tr key={l.empleado.id} className="border-t border-sol-suave">
                      <td className="px-3 py-2 font-bold">{l.empleado.nombre}</td>
                      <td className="px-3 py-2 text-sol-gris">{l.empleado.cargo}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" disabled={bloqueado} className={numCN} value={e.diasTrabajados ?? ""}
                          onChange={(ev) => setEdit(l.empleado.id, "diasTrabajados", ev.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" disabled={bloqueado} className={`${numCN} ${calc.salarioExcedePeriodo ? "border-sol-rojo text-sol-rojo" : ""}`} value={formatoMontoInput(e.salarioPeriodo ?? calc.salarioProporcional)}
                          onChange={(ev) => setEdit(l.empleado.id, "salarioPeriodo", formatoMontoInput(ev.target.value))} />
                        {calc.salarioExcedePeriodo && (
                          <div className="mt-1 text-[10px] font-bold text-sol-rojo text-right">Max. {fmt(calc.salarioEsperado)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" disabled={bloqueado} className={numCN} value={formatoMontoInput(e.horasExtra ?? 0)}
                          onChange={(ev) => setEdit(l.empleado.id, "horasExtra", formatoMontoInput(ev.target.value))} />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" disabled={bloqueado} className={numCN} value={formatoMontoInput(e.bonificacion ?? 0)}
                          onChange={(ev) => setEdit(l.empleado.id, "bonificacion", formatoMontoInput(ev.target.value))} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1 text-xs text-sol-gris">
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" disabled={bloqueado} className={checkCN} checked={!!e.aplicarSalud} onChange={(ev) => setEdit(l.empleado.id, "aplicarSalud", ev.target.checked)} />
                            Salud {calc.salud ? fmt(calc.salud) : ""}
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" disabled={bloqueado} className={checkCN} checked={!!e.aplicarPension} onChange={(ev) => setEdit(l.empleado.id, "aplicarPension", ev.target.checked)} />
                            Pension {calc.pension ? fmt(calc.pension) : ""}
                          </label>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" disabled={bloqueado} className={numCN} value={formatoMontoInput(e.prestamo ?? 0)}
                          onChange={(ev) => setEdit(l.empleado.id, "prestamo", formatoMontoInput(ev.target.value))} />
                      </td>
                      <td className="px-3 py-2 text-right font-extrabold">{fmt(calc.netoPagar)}</td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" disabled={bloqueado} className={numCN} value={formatoMontoInput(e.montoPagado ?? 0)}
                          onChange={(ev) => setEdit(l.empleado.id, "montoPagado", formatoMontoInput(ev.target.value))} />
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${calc.saldoPendiente > 0 ? "text-sol-rojo" : "text-sol-exito"}`}>{fmt(calc.saldoPendiente)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${pago.color}1A`, color: pago.color }}>
                          {pago.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {!bloqueado && (
                          <button onClick={() => guardarFila(l)} className="text-xs font-bold text-sol-azul hover:underline mr-2">Guardar</button>
                        )}
                        {l.conceptos.length > 0 && (
                          <button onClick={() => setComprobante({ ...l, ...calc })} title="Ver comprobante" className="p-1.5 inline-flex">
                            <FileText size={15} className="text-sol-gris" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!liquidaciones.length && <p className="text-sol-gris text-sm p-6 text-center">No hay empleados activos para liquidar.</p>}
          </div>
          <p className="text-sol-grisClaro text-xs mt-2">Salud y pensión se calculan automáticamente al 4% del salario proporcional al período. Guarda cada fila para registrar la liquidación.</p>
        </div>
      )}

      {editEmp !== undefined && <EmpleadoForm inicial={editEmp} cargosSugeridos={cargosSugeridos} onSave={onSaveEmp} onClose={() => setEditEmp(undefined)} />}

      {nuevoPeriodo && <PeriodoForm onSave={crearNuevoPeriodo} onClose={() => setNuevoPeriodo(false)} />}

      {comprobante && (
        <NominaPreview
          liquidacion={{ ...comprobante, periodo: periodoSel }}
          onClose={() => setComprobante(null)}
        />
      )}

      {confirmar && (
        <ConfirmDialog
          titulo="Eliminar empleado"
          mensaje={`¿Seguro que deseas eliminar a "${confirmar.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={eliminar}
          onClose={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
