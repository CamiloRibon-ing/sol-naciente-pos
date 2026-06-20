import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Store, Wallet, ArrowUpCircle, ArrowDownCircle, Percent } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { Boton, StatCard } from "../components/ui";
import { fmt, fmtFecha, catNombre } from "../lib/format";
import { descargarExcel } from "../lib/excel";
import { calcularResumen } from "../lib/caja";
import * as cajaDb from "../lib/caja";
import * as nominaDb from "../lib/nomina";

const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const finDia = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const aInputDate = (d) => d.toISOString().slice(0, 10);
const fechaLocal = (s) => new Date(`${s}T00:00:00`);
const diaSemana = (d) => new Date(d).toLocaleDateString("es-CO", { weekday: "long" });

const PERIODOS = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "quincena", label: "Quincena" },
  { id: "mes", label: "Mes" },
  { id: "semestre", label: "Semestre" },
  { id: "anio", label: "Año" },
  { id: "rango", label: "Rango" },
];

const idsConDescendientes = (puntos, id) => {
  if (!id || id === "todos") return null;
  const ids = new Set([id]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    puntos.forEach((p) => {
      if (p.idPuntoPadre && ids.has(p.idPuntoPadre) && !ids.has(p.id)) {
        ids.add(p.id);
        cambio = true;
      }
    });
  }
  return [...ids];
};

const rangoPreset = (tipo) => {
  const hoy = new Date();
  const desde = inicioDia(hoy);
  const hasta = finDia(hoy);
  if (tipo === "hoy") return { desde, hasta };
  if (tipo === "semana") {
    const d = inicioDia(hoy);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return { desde: d, hasta };
  }
  if (tipo === "quincena") {
    const d = inicioDia(hoy);
    d.setDate(hoy.getDate() <= 15 ? 1 : 16);
    return { desde: d, hasta };
  }
  if (tipo === "mes") {
    const d = inicioDia(hoy);
    d.setDate(1);
    return { desde: d, hasta };
  }
  if (tipo === "semestre") {
    const d = inicioDia(hoy);
    d.setMonth(hoy.getMonth() < 6 ? 0 : 6, 1);
    return { desde: d, hasta };
  }
  if (tipo === "anio") {
    const d = inicioDia(hoy);
    d.setMonth(0, 1);
    return { desde: d, hasta };
  }
  return { desde: inicioDia(hoy), hasta };
};

const pagoRows = (pagos = [], total = 0) => (pagos.length ? pagos : [{ metodo: "Efectivo", monto: total }]);

export default function InformesFinancieros() {
  const { historialVentas, cargarHistorial, puntosVenta } = useStore();
  const hoy = new Date();
  const [periodo, setPeriodo] = useState("mes");
  const [desdeStr, setDesdeStr] = useState(aInputDate(rangoPreset("mes").desde));
  const [hastaStr, setHastaStr] = useState(aInputDate(hoy));
  const [fPunto, setFPunto] = useState("todos");
  const [cajas, setCajas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [nomina, setNomina] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [opciones, setOpciones] = useState({
    productos: true,
    movimientos: true,
    cierres: true,
    metodos: true,
    porLocal: true,
    incluirAnuladas: false,
    hojasPorCierre: false,
    nomina: true,
  });

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const { desde, hasta } = useMemo(() => ({
    desde: inicioDia(fechaLocal(desdeStr)),
    hasta: finDia(fechaLocal(hastaStr)),
  }), [desdeStr, hastaStr]);

  const idsPunto = useMemo(() => idsConDescendientes(puntosVenta, fPunto), [puntosVenta, fPunto]);
  const puntoKey = idsPunto?.join("|") || "todos";

  const cambiarPeriodo = (id) => {
    setPeriodo(id);
    if (id === "rango") return;
    const r = rangoPreset(id);
    setDesdeStr(aInputDate(r.desde));
    setHastaStr(aInputDate(r.hasta));
  };

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([
      cajaDb.listCajasRango(desde, hasta, idsPunto || undefined),
      cajaDb.listMovimientosRango(desde, hasta, idsPunto || undefined),
      nominaDb.costoNominaEnRango(desde, hasta),
    ])
      .then(([cajasData, movsData, nominaData]) => {
        if (!activo) return;
        setCajas(cajasData);
        setMovimientos(movsData);
        setNomina(nominaData);
      })
      .catch((e) => toast.error(e.message || "No se pudo cargar el informe financiero"))
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [desde, hasta, puntoKey]);

  const informe = useMemo(() => {
    const ventas = historialVentas.filter((v) => {
      const f = new Date(v.fecha);
      if (f < desde || f > hasta) return false;
      if (idsPunto && !idsPunto.includes(v.id_punto)) return false;
      if (!opciones.incluirAnuladas && v.estado === "anulada") return false;
      return true;
    });
    const ventasPagadas = ventas.filter((v) => v.estado !== "anulada");
    const productos = [];
    const metodos = {};
    const porLocal = {};
    ventasPagadas.forEach((v) => {
      const localId = v.id_punto || "sin-local";
      const local = v.puntoVenta || "Sin local";
      porLocal[localId] = porLocal[localId] || { local, ventas: 0, facturas: 0, costo: 0, utilidad: 0, egresos: 0, retiros: 0, diferencia: 0 };
      porLocal[localId].ventas += Number(v.total) || 0;
      porLocal[localId].facturas += 1;

      pagoRows(v.pagos, v.total).forEach((p) => {
        metodos[p.metodo] = metodos[p.metodo] || { metodo: p.metodo, pagos: 0, total: 0 };
        metodos[p.metodo].pagos += 1;
        metodos[p.metodo].total += Number(p.monto) || 0;
      });

      (v.lineas || []).forEach((l) => {
        const total = Number(l.precio) * Number(l.cantidad);
        const costo = Number(l.costo || 0) * Number(l.cantidad);
        porLocal[localId].costo += costo;
        productos.push({
          fecha: v.fecha,
          numero: v.numero,
          local,
          producto: l.nombre,
          categoria: catNombre(l.cat),
          cantidad: Number(l.cantidad),
          precio: Number(l.precio),
          costoUnitario: Number(l.costo) || 0,
          total,
          costo,
          margen: total ? Math.round(((total - costo) / total) * 100) : 0,
        });
      });
    });

    const detalleCajas = cajas.map((caja) => {
      const apertura = new Date(caja.fecha_apertura);
      const cierre = caja.fecha_cierre ? new Date(caja.fecha_cierre) : hasta;
      const ventasCaja = ventasPagadas.filter((v) => {
        if (v.id_caja === caja.id_caja) return true;
        if (v.id_caja) return false;
        const f = new Date(v.fecha);
        return v.id_punto === caja.id_punto && f >= apertura && f <= cierre;
      });
      const movs = movimientos.filter((m) => m.id_caja === caja.id_caja);
      const resumen = calcularResumen(caja, ventasCaja, movs);
      const local = caja.puntos_venta?.nombre || puntosVenta.find((p) => p.id === caja.id_punto)?.nombre || "Sin local";
      const localId = caja.id_punto || local;
      porLocal[localId] = porLocal[localId] || { local, ventas: 0, facturas: 0, costo: 0, utilidad: 0, egresos: 0, retiros: 0, diferencia: 0 };
      porLocal[localId].egresos += resumen.egresos;
      porLocal[localId].retiros += resumen.retiros;
      porLocal[localId].diferencia += Number(caja.diferencia) || 0;
      return { caja, local, resumen, movimientos: movs, ventas: ventasCaja };
    });

    Object.values(porLocal).forEach((p) => { p.utilidad = p.ventas - p.costo - p.egresos - p.retiros; });

    const totalVentas = ventasPagadas.reduce((s, v) => s + Number(v.total || 0), 0);
    const descuentos = ventasPagadas.reduce((s, v) => s + Number(v.descuento || 0), 0);
    const impuestos = ventasPagadas.reduce((s, v) => s + Number(v.impuestos || 0), 0);
    const costo = productos.reduce((s, p) => s + p.costo, 0);
    const egresos = movimientos.filter((m) => ["egreso", "gasto"].includes(m.tipo)).reduce((s, m) => s + Number(m.monto || 0), 0);
    const retiros = movimientos.filter((m) => m.tipo === "retiro").reduce((s, m) => s + Number(m.monto || 0), 0);
    const ingresosManual = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto || 0), 0);
    const utilidadBruta = totalVentas - costo;
    const utilidadNeta = utilidadBruta + ingresosManual - egresos - retiros - (opciones.nomina ? nomina : 0);

    return {
      ventas, ventasPagadas, productos,
      metodos: Object.values(metodos).sort((a, b) => b.total - a.total),
      porLocal: Object.values(porLocal).sort((a, b) => b.ventas - a.ventas),
      cajas: detalleCajas,
      resumen: {
        totalVentas, facturas: ventasPagadas.length, anuladas: ventas.filter((v) => v.estado === "anulada").length,
        descuentos, impuestos, costo, utilidadBruta, ingresosManual, egresos, retiros,
        nomina: opciones.nomina ? nomina : 0, utilidadNeta,
        ticket: ventasPagadas.length ? totalVentas / ventasPagadas.length : 0,
        margen: totalVentas ? Math.round((utilidadBruta / totalVentas) * 100) : 0,
      },
    };
  }, [historialVentas, cajas, movimientos, puntosVenta, desde, hasta, idsPunto, opciones.incluirAnuladas, opciones.nomina, nomina]);

  const exportar = async () => {
    const periodoTxt = `${desdeStr} a ${hastaStr}`;
    let nominaDetalle = [];
    if (opciones.nomina) {
      try {
        nominaDetalle = await nominaDb.listReporteNomina({ desde, hasta });
      } catch (e) {
        toast.error(e.message || "No se pudo cargar el detalle de nomina");
      }
    }
    const hojas = [
      {
        nombre: "Resumen general",
        filas: [
          ["Concepto", "Valor"],
          ["Periodo", periodoTxt],
          ["Local", fPunto === "todos" ? "Todos los locales" : puntosVenta.find((p) => p.id === fPunto)?.nombre || "Seleccionado"],
          ["Facturas pagadas", informe.resumen.facturas],
          ["Ventas anuladas", informe.resumen.anuladas],
          ["Ingresos por ventas", informe.resumen.totalVentas],
          ["Descuentos", informe.resumen.descuentos],
          ["Impuestos", informe.resumen.impuestos],
          ["Costo estimado", informe.resumen.costo],
          ["Utilidad bruta", informe.resumen.utilidadBruta],
          ["Ingresos manuales", informe.resumen.ingresosManual],
          ["Egresos/gastos", informe.resumen.egresos],
          ["Retiros", informe.resumen.retiros],
          ["Nomina", informe.resumen.nomina],
          ["Utilidad neta", informe.resumen.utilidadNeta],
          ["Ticket promedio", informe.resumen.ticket],
          ["Margen bruto %", informe.resumen.margen],
        ],
      },
      {
        nombre: "Ventas detalladas",
        filas: [
          ["Fecha", "Dia", "Factura", "Local", "Caja", "Vendedor", "Cliente", "Metodo pago", "Subtotal", "Descuento", "Impuestos", "Total", "Estado"],
          ...informe.ventas.map((v) => [fmtFecha(v.fecha), diaSemana(v.fecha), v.numero, v.puntoVenta, v.id_caja || "", v.cajero, v.cliente, v.pago, v.subtotal || "", v.descuento || 0, v.impuestos || 0, v.total, v.estado]),
        ],
      },
    ];

    if (opciones.productos) hojas.push({
      nombre: "Productos vendidos",
      filas: [
        ["Fecha", "Factura", "Local", "Producto", "Categoria", "Cantidad", "Precio unitario", "Costo unitario", "Total vendido", "Costo", "Margen %"],
        ...informe.productos.map((p) => [fmtFecha(p.fecha), p.numero, p.local, p.producto, p.categoria, p.cantidad, p.precio, p.costoUnitario, p.total, p.costo, p.margen]),
      ],
    });
    if (opciones.cierres) hojas.push({
      nombre: "Cierres de caja",
      filas: [
        ["Local", "Caja", "Apertura", "Cierre", "Estado", "Ventas", "Facturas", "Efectivo", "Ingresos", "Egresos", "Retiros", "Esperado", "Real", "Diferencia"],
        ...informe.cajas.map(({ caja, local, resumen }) => [local, caja.id_caja, fmtFecha(caja.fecha_apertura), caja.fecha_cierre ? fmtFecha(caja.fecha_cierre) : "En curso", caja.estado, resumen.totalVentas, resumen.ventasCaja.length, resumen.efectivo, resumen.ingresos, resumen.egresos, resumen.retiros, caja.monto_final_esperado ?? resumen.saldoEsperado, caja.monto_final_real ?? "", caja.diferencia ?? ""]),
      ],
    });
    if (opciones.movimientos) hojas.push({
      nombre: "Movimientos caja",
      filas: [
        ["Fecha", "Caja", "Tipo", "Descripcion", "Monto"],
        ...movimientos.map((m) => [fmtFecha(m.fecha), m.id_caja, m.tipo, m.descripcion || "", Number(m.monto) || 0]),
      ],
    });
    if (opciones.nomina) hojas.push({
      nombre: "Nomina",
      filas: [
        ["Periodo", "Inicio", "Fin", "Empleado", "Documento", "Cargo", "Dias", "Devengado", "Deducciones", "Neto", "Pagado", "Saldo pendiente", "Estado pago", "Fecha pago"],
        ...nominaDetalle.map((n) => [n.periodo, n.fechaInicio, n.fechaFin, n.empleado, n.documento, n.cargo, n.diasTrabajados || "", n.totalDevengado, n.totalDeducciones, n.netoPagar, n.montoPagado, n.saldoPendiente, n.estadoPago, n.fechaPago || ""]),
      ],
    });
    if (opciones.metodos) hojas.push({
      nombre: "Metodos pago",
      filas: [["Metodo", "Pagos", "Total"], ...informe.metodos.map((m) => [m.metodo, m.pagos, m.total])],
    });
    if (opciones.porLocal) hojas.push({
      nombre: "Resumen por local",
      filas: [
        ["Local", "Facturas", "Ventas", "Costo", "Egresos", "Retiros", "Diferencia caja", "Utilidad aproximada"],
        ...informe.porLocal.map((p) => [p.local, p.facturas, p.ventas, p.costo, p.egresos, p.retiros, p.diferencia, p.utilidad]),
      ],
    });
    if (opciones.hojasPorCierre) {
      informe.cajas.forEach(({ caja, local, ventas }) => {
        hojas.push({
          nombre: `Caja ${local}`.slice(0, 31),
          filas: [
            ["Factura", "Fecha", "Cliente", "Metodo", "Total", "Estado"],
            ...ventas.map((v) => [v.numero, fmtFecha(v.fecha), v.cliente, v.pago, v.total, v.estado]),
          ],
        });
      });
    }

    descargarExcel({ nombreArchivo: `informe-financiero-${desdeStr}-${hastaStr}.xls`, hojas });
  };

  const toggle = (key) => setOpciones((o) => ({ ...o, [key]: !o[key] }));

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl flex items-center gap-2"><FileSpreadsheet className="text-sol-azul" size={24} /> Informes financieros</h1>
          <p className="text-sol-gris text-[13px]">Exporta ventas, caja, productos, egresos y cierres por local o periodo.</p>
        </div>
        <Boton onClick={exportar}><Download size={16} /> Exportar Excel</Boton>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-4 mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODOS.map((p) => (
            <button key={p.id} onClick={() => cambiarPeriodo(p.id)}
              className={`rounded-full px-4 py-2 text-xs font-bold border ${periodo === p.id ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={desdeStr} max={hastaStr} onChange={(e) => { setPeriodo("rango"); setDesdeStr(e.target.value); }}
            className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          <input type="date" value={hastaStr} min={desdeStr} onChange={(e) => { setPeriodo("rango"); setHastaStr(e.target.value); }}
            className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          <select value={fPunto} onChange={(e) => setFPunto(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
            <option value="todos">Todos los locales</option>
            {puntosVenta.map((p) => <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatCard icon={ArrowUpCircle} label="Ingresos ventas" value={fmt(informe.resumen.totalVentas)} color="#159A5A" sub={`${informe.resumen.facturas} factura(s)`} />
        <StatCard icon={Wallet} label="Egresos/retiros" value={fmt(informe.resumen.egresos + informe.resumen.retiros)} color="#E22B23" />
        <StatCard icon={BarChart3} label="Utilidad neta" value={fmt(informe.resumen.utilidadNeta)} color={informe.resumen.utilidadNeta < 0 ? "#E22B23" : "#159A5A"} />
        <StatCard icon={Percent} label="Margen bruto" value={`${informe.resumen.margen}%`} color={informe.resumen.margen < 25 ? "#E22B23" : "#159A5A"} />
        <StatCard icon={Store} label="Cierres/cajas" value={informe.cajas.length} color="#1A4FA0" />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <h2 className="font-extrabold text-sm mb-3">Opciones del Excel</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ["productos", "Productos vendidos"],
              ["movimientos", "Movimientos de caja"],
              ["cierres", "Cierres de caja"],
              ["metodos", "Metodos de pago"],
              ["porLocal", "Resumen por local"],
              ["incluirAnuladas", "Incluir ventas anuladas"],
              ["hojasPorCierre", "Hoja por cada cierre"],
              ["nomina", "Incluir nomina"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={opciones[key]} onChange={() => toggle(key)} className="w-4 h-4 accent-sol-azul" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <h2 className="font-extrabold text-sm mb-3">Resumen por local</h2>
          {cargando && <p className="text-sm text-sol-gris">Cargando informe...</p>}
          {!cargando && !informe.porLocal.length && <p className="text-sm text-sol-gris">Sin datos para el rango seleccionado.</p>}
          <div className="space-y-2">
            {informe.porLocal.slice(0, 6).map((p) => (
              <div key={p.local} className="flex items-center justify-between py-2 border-b border-sol-suave last:border-0">
                <div>
                  <div className="font-bold text-sm">{p.local}</div>
                  <div className="text-xs text-sol-gris">{p.facturas} factura(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sol-azul">{fmt(p.ventas)}</div>
                  <div className={`text-xs font-bold ${p.utilidad < 0 ? "text-sol-rojo" : "text-sol-exito"}`}>{fmt(p.utilidad)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
        <h2 className="font-extrabold text-sm p-4 pb-0">Vista previa de ventas</h2>
        <table className="w-full text-sm min-w-[860px] mt-2">
          <thead><tr className="bg-sol-suave text-sol-gris">
            {["Fecha", "Dia", "Factura", "Local", "Cliente", "Pago", "Total", "Estado"].map((h, i) => (
              <th key={i} className={`px-4 py-2.5 font-bold ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {informe.ventas.slice(0, 15).map((v) => (
              <tr key={v.id} className="border-t border-sol-suave">
                <td className="px-4 py-2.5 text-sol-gris whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                <td className="px-4 py-2.5 capitalize">{diaSemana(v.fecha)}</td>
                <td className="px-4 py-2.5 font-bold">{v.numero}</td>
                <td className="px-4 py-2.5">{v.puntoVenta}</td>
                <td className="px-4 py-2.5 text-sol-gris">{v.cliente}</td>
                <td className="px-4 py-2.5 text-sol-gris">{v.pago}</td>
                <td className="px-4 py-2.5 text-right font-bold">{fmt(v.total)}</td>
                <td className="px-4 py-2.5">{v.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!informe.ventas.length && <p className="text-sol-gris text-sm p-6 text-center">No hay ventas para el rango seleccionado.</p>}
      </div>
    </section>
  );
}
