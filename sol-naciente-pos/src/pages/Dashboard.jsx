import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";
import { DollarSign, Receipt, ShoppingCart, TrendingUp, AlertTriangle, FileDown, Users, Ban, CreditCard, UserRound, Percent, CalendarCheck, Clock, Wallet, ArrowDownCircle, ArrowUpCircle, PackageCheck } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { fmt, catNombre, catColor, margenInfo } from "../lib/format";
import { StatCard, Boton } from "../components/ui";
import * as cajaDb from "../lib/caja";
import * as nominaDb from "../lib/nomina";
import DashboardPreview from "../components/pdf/DashboardPreview";

const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const finDia = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const inicioSemana = (d) => { const x = inicioDia(d); const dow = x.getDay(); x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1)); return x; };
const inicioMes = (d) => { const x = inicioDia(d); x.setDate(1); return x; };
const diasDelMes = (anio, mes) => new Date(anio, mes + 1, 0).getDate();
const aInputDate = (d) => d.toISOString().slice(0, 10);
const aFechaLocal = (s) => new Date(`${s}T00:00:00`);

const PERIODOS = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "rango", label: "Rango personalizado" },
];

const SECCIONES = [
  { id: "resumen", label: "Resumen" },
  { id: "ventas", label: "Ventas" },
  { id: "productos", label: "Productos" },
  { id: "inventario", label: "Inventario" },
  { id: "finanzas", label: "Finanzas / Nomina" },
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

export default function Dashboard() {
  const { ventas, historialVentas, cargarHistorial, ingredientes, puntosVenta, reservas } = useStore();
  const [periodoTipo, setPeriodoTipo] = useState("mes");
  const hoy = new Date();
  const [desdeStr, setDesdeStr] = useState(aInputDate(inicioMes(hoy)));
  const [hastaStr, setHastaStr] = useState(aInputDate(hoy));
  const [fPunto, setFPunto] = useState("todos");
  const [gastosPeriodo, setGastosPeriodo] = useState(0);
  const [ingresosManualPeriodo, setIngresosManualPeriodo] = useState(0);
  const [retirosPeriodo, setRetirosPeriodo] = useState(0);
  const [nominaPeriodo, setNominaPeriodo] = useState(0);
  const [verPdf, setVerPdf] = useState(false);
  const [seccion, setSeccion] = useState("resumen");

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const { desde, hasta, label } = useMemo(() => {
    const ahora = new Date();
    if (periodoTipo === "hoy") return { desde: inicioDia(ahora), hasta: finDia(ahora), label: "Hoy" };
    if (periodoTipo === "semana") return { desde: inicioSemana(ahora), hasta: finDia(ahora), label: "Esta semana" };
    if (periodoTipo === "mes") return { desde: inicioMes(ahora), hasta: finDia(ahora), label: "Este mes" };
    const d = desdeStr ? inicioDia(aFechaLocal(desdeStr)) : inicioMes(ahora);
    const h = hastaStr ? finDia(aFechaLocal(hastaStr)) : finDia(ahora);
    return { desde: d, hasta: h, label: `${d.toLocaleDateString("es-CO")} - ${h.toLocaleDateString("es-CO")}` };
  }, [periodoTipo, desdeStr, hastaStr]);

  const idsPuntoFiltro = useMemo(() => idsConDescendientes(puntosVenta, fPunto), [puntosVenta, fPunto]);
  const puntoFiltroKey = idsPuntoFiltro?.join("|") || "todos";

  // Gastos operativos (movimientos de caja) y costo de nómina del período: requieren consulta aparte.
  useEffect(() => {
    let activo = true;
    Promise.all([cajaDb.listMovimientosRango(desde, hasta, idsPuntoFiltro || undefined), nominaDb.costoNominaEnRango(desde, hasta)])
      .then(([movs, costoNomina]) => {
        if (!activo) return;
        const gastos = movs
          .filter((mv) => ["egreso", "gasto"].includes(mv.tipo))
          .reduce((s, mv) => s + (Number(mv.monto) || 0), 0);
        const ingresosManual = movs
          .filter((mv) => mv.tipo === "ingreso")
          .reduce((s, mv) => s + (Number(mv.monto) || 0), 0);
        const retiros = movs
          .filter((mv) => mv.tipo === "retiro")
          .reduce((s, mv) => s + (Number(mv.monto) || 0), 0);
        setGastosPeriodo(gastos);
        setIngresosManualPeriodo(ingresosManual);
        setRetirosPeriodo(retiros);
        setNominaPeriodo(costoNomina);
      })
      .catch(() => { if (activo) { setGastosPeriodo(0); setIngresosManualPeriodo(0); setRetirosPeriodo(0); setNominaPeriodo(0); } });
    return () => { activo = false; };
  }, [desde, hasta, puntoFiltroKey]);

  const facturas = useMemo(() => {
    const base = historialVentas.length ? historialVentas : ventas;
    return base.filter((v) => (v.tipo === "FACTURA" || !v.tipo) && v.estado !== "anulada");
  }, [historialVentas, ventas]);

  const m = useMemo(() => {
    const base = historialVentas.length ? historialVentas : ventas;
    const todasEnRango = base.filter((v) => {
      const f = new Date(v.fecha);
      return (v.tipo === "FACTURA" || !v.tipo) && f >= desde && f <= hasta && (!idsPuntoFiltro || idsPuntoFiltro.includes(v.id_punto));
    });
    const enRango = facturas.filter((v) => {
      const f = new Date(v.fecha);
      return f >= desde && f <= hasta && (!idsPuntoFiltro || idsPuntoFiltro.includes(v.id_punto));
    });

    let unidades = 0;
    const porCat = {}, porProd = {}, porProdUnidades = {}, porPunto = {}, porMetodo = {}, porVendedor = {}, porHora = {};
    enRango.forEach((v) => {
      const id = v.id_punto || "sin-local";
      porPunto[id] = porPunto[id] || { id, nombre: v.puntoVenta || "Sin local", ventas: 0, ingresos: 0 };
      porPunto[id].ventas += 1;
      porPunto[id].ingresos += Number(v.total) || 0;

      const vendedorId = v.cajeroId || v.cajero || "sin-vendedor";
      porVendedor[vendedorId] = porVendedor[vendedorId] || { id: vendedorId, nombre: v.cajero || "Sin vendedor", ventas: 0, anuladas: 0, ingresos: 0 };
      porVendedor[vendedorId].ventas += 1;
      porVendedor[vendedorId].ingresos += Number(v.total) || 0;

      const f = new Date(v.fecha);
      const hora = `${String(f.getHours()).padStart(2, "0")}:00`;
      porHora[hora] = porHora[hora] || { hora, ventas: 0, ingresos: 0 };
      porHora[hora].ventas += 1;
      porHora[hora].ingresos += Number(v.total) || 0;

      const pagos = v.pagos?.length ? v.pagos : [{ metodo: v.pago || "Efectivo", monto: v.total }];
      pagos.forEach((p) => {
        const metodo = p.metodo || "Efectivo";
        porMetodo[metodo] = porMetodo[metodo] || { metodo, ventas: 0, total: 0 };
        porMetodo[metodo].ventas += 1;
        porMetodo[metodo].total += Number(p.monto) || 0;
      });
    });
    enRango.forEach((v) => (v.lineas || []).forEach((l) => {
      const cantidad = Number(l.cantidad) || 0;
      const precio = Number(l.precio) || 0;
      const costo = Number(l.costo) || 0;
      unidades += cantidad;
      const cat = l.cat || "otros";
      porCat[cat] = porCat[cat] || { ingresos: 0, costo: 0 };
      porCat[cat].ingresos += precio * cantidad;
      porCat[cat].costo += costo * cantidad;
      porProd[l.nombre] = (porProd[l.nombre] || 0) + precio * cantidad;
      porProdUnidades[l.nombre] = (porProdUnidades[l.nombre] || 0) + cantidad;
    }));
    todasEnRango.filter((v) => v.estado === "anulada").forEach((v) => {
      const vendedorId = v.cajeroId || v.cajero || "sin-vendedor";
      porVendedor[vendedorId] = porVendedor[vendedorId] || { id: vendedorId, nombre: v.cajero || "Sin vendedor", ventas: 0, anuladas: 0, ingresos: 0 };
      porVendedor[vendedorId].anuladas += 1;
    });

    const ingresos = enRango.reduce((s, v) => s + (Number(v.total) || 0), 0);
    const ingresosCats = Object.values(porCat).reduce((s, c) => s + c.ingresos, 0);
    const costoVentas = Object.values(porCat).reduce((s, c) => s + c.costo, 0);
    const ingresosBase = ingresosCats || ingresos;
    const utilidadBruta = ingresosBase - costoVentas;
    const ticket = enRango.length ? ingresos / enRango.length : 0;
    const anuladas = todasEnRango.filter((v) => v.estado === "anulada").length;
    const tasaAnulacion = todasEnRango.length ? Math.round((anuladas / todasEnRango.length) * 100) : 0;
    const margenBruto = ingresosBase ? Math.round((utilidadBruta / ingresosBase) * 100) : 0;

    const cats = Object.entries(porCat)
      .map(([k, val]) => {
        const utilidad = val.ingresos - val.costo;
        const margen = val.ingresos ? Math.round((utilidad / val.ingresos) * 100) : 0;
        return { id: k, name: catNombre(k), color: catColor(k), ingresos: val.ingresos, costo: val.costo, utilidad, margen };
      })
      .sort((a, b) => b.ingresos - a.ingresos);

    const top = Object.entries(porProd).map(([k, val]) => ({ name: k, total: val })).sort((a, b) => b.total - a.total).slice(0, 5);
    const topUnidades = Object.entries(porProdUnidades).map(([name, cantidad]) => ({ name, cantidad })).sort((a, b) => b.cantidad - a.cantidad)[0] || null;
    const criticos = ingredientes.filter((i) => i.stock <= i.stockMin);

    const puntos = Object.values(porPunto).sort((a, b) => b.ingresos - a.ingresos);
    const metodos = Object.values(porMetodo).sort((a, b) => b.total - a.total);
    const vendedores = Object.values(porVendedor).sort((a, b) => b.ingresos - a.ingresos);
    const horas = Object.values(porHora).sort((a, b) => b.ingresos - a.ingresos);
    return {
      ingresos, ingresosCats: ingresosBase, costoVentas, utilidadBruta, ticket, unidades, cats, top, topUnidades, criticos,
      cantidad: enRango.length, puntos, metodos, vendedores, horaPico: horas[0] || null, anuladas, tasaAnulacion, margenBruto,
    };
  }, [facturas, historialVentas, ventas, desde, hasta, puntoFiltroKey, ingredientes]);

  const resumenReservas = useMemo(() => {
    const enRango = reservas.filter((r) => {
      const f = new Date(r.fechaInicio || r.fecha_inicio || r.fecha);
      return f >= desde && f <= hasta && r.estado !== "cancelada";
    });
    const anticipos = enRango.reduce((s, r) => s + (Number(r.anticipo) || 0), 0);
    const pendiente = enRango.reduce((s, r) => s + Math.max(0, Number(r.montoTotal || 0) - Number(r.anticipo || 0)), 0);
    return {
      cantidad: enRango.length,
      anticipos,
      pendiente,
      confirmadas: enRango.filter((r) => ["confirmada", "en_curso"].includes(r.estado)).length,
    };
  }, [reservas, desde, hasta]);

  const ingresosOperativos = m.ingresos + ingresosManualPeriodo;
  const utilidadNeta = m.utilidadBruta + ingresosManualPeriodo - gastosPeriodo - nominaPeriodo;
  const margenNeto = ingresosOperativos ? Math.round((utilidadNeta / ingresosOperativos) * 100) : 0;
  const gastoOperativoPct = ingresosOperativos ? Math.round((gastosPeriodo / ingresosOperativos) * 100) : 0;
  const nominaPct = ingresosOperativos ? Math.round((nominaPeriodo / ingresosOperativos) * 100) : 0;
  const metodoTop = m.metodos[0];

  const periodoAnterior = useMemo(() => {
    const duracion = Math.max(1, hasta.getTime() - desde.getTime());
    const prevHasta = new Date(desde.getTime() - 1);
    const prevDesde = new Date(prevHasta.getTime() - duracion);
    const base = historialVentas.length ? historialVentas : ventas;
    const ventasPrevias = base.filter((v) => {
      const f = new Date(v.fecha);
      return (v.tipo === "FACTURA" || !v.tipo) && v.estado !== "anulada" && f >= prevDesde && f <= prevHasta && (!idsPuntoFiltro || idsPuntoFiltro.includes(v.id_punto));
    });
    const ingresos = ventasPrevias.reduce((s, v) => s + (Number(v.total) || 0), 0);
    const facturas = ventasPrevias.length;
    const ticket = facturas ? ingresos / facturas : 0;
    return { ingresos, facturas, ticket };
  }, [historialVentas, ventas, desde, hasta, puntoFiltroKey]);

  const variacion = (actual, anterior) => {
    if (!anterior && actual > 0) return 100;
    if (!anterior) return 0;
    return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  };

  // Comparativo: ventas día a día del mes actual vs el mes anterior.
  const comparativo = useMemo(() => {
    const ahora = new Date();
    const anioAct = ahora.getFullYear(), mesAct = ahora.getMonth();
    const mesPrev = mesAct === 0 ? 11 : mesAct - 1;
    const anioPrev = mesAct === 0 ? anioAct - 1 : anioAct;
    const totalDia = (anio, mes, dia) => {
      const objetivo = `${anio}-${mes}-${dia}`;
      return facturas
        .filter((v) => {
          const f = new Date(v.fecha);
          return `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}` === objetivo && (!idsPuntoFiltro || idsPuntoFiltro.includes(v.id_punto));
        })
        .reduce((s, v) => s + v.total, 0);
    };
    const dias = diasDelMes(anioAct, mesAct);
    const diasPrev = diasDelMes(anioPrev, mesPrev);
    return Array.from({ length: dias }).map((_, i) => {
      const dia = i + 1;
      return {
        dia,
        actual: dia <= ahora.getDate() ? totalDia(anioAct, mesAct, dia) : null,
        anterior: dia <= diasPrev ? totalDia(anioPrev, mesPrev, dia) : null,
      };
    });
  }, [facturas, puntoFiltroKey]);

  const flujoPeriodo = useMemo(() => {
    const map = new Map();
    facturas
      .filter((v) => {
        const f = new Date(v.fecha);
        return f >= desde && f <= hasta && (!idsPuntoFiltro || idsPuntoFiltro.includes(v.id_punto));
      })
      .forEach((v) => {
        const f = new Date(v.fecha);
        const key = f.toISOString().slice(0, 10);
        const actual = map.get(key) || { fecha: f.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }), ingresos: 0, facturas: 0 };
        actual.ingresos += Number(v.total) || 0;
        actual.facturas += 1;
        map.set(key, actual);
      });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [facturas, desde, hasta, puntoFiltroKey]);

  const reportePdf = useMemo(() => ({
    label, desde, hasta,
    ingresos: m.ingresosCats, costoVentas: m.costoVentas, utilidadBruta: m.utilidadBruta,
    gastos: gastosPeriodo, nomina: nominaPeriodo, utilidadNeta,
    cats: m.cats, top: m.top,
  }), [label, desde, hasta, m, gastosPeriodo, nominaPeriodo, utilidadNeta]);

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h1 className="font-extrabold text-2xl">Dashboard</h1>
          <p className="text-sol-gris text-[13px]">Resumen contable del negocio. Cada factura aparece aquí en tiempo real.</p>
        </div>
        <Boton onClick={() => setVerPdf(true)}><FileDown size={16} /> Exportar PDF</Boton>
      </div>

      {/* Selector de período */}
      <div className="flex items-center gap-2 flex-wrap mb-4 mt-3">
        {PERIODOS.map((p) => (
          <button key={p.id} onClick={() => setPeriodoTipo(p.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold border ${periodoTipo === p.id ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde"}`}>
            {p.label}
          </button>
        ))}
        {periodoTipo === "rango" && (
          <div className="flex items-center gap-2">
            <input type="date" value={desdeStr} max={hastaStr} onChange={(e) => setDesdeStr(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            <span className="text-sol-gris text-xs">a</span>
            <input type="date" value={hastaStr} min={desdeStr} onChange={(e) => setHastaStr(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          </div>
        )}
        <select value={fPunto} onChange={(e) => setFPunto(e.target.value)}
          className="rounded-xl px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
          <option value="todos">Todos los locales</option>
          {puntosVenta.map((p) => <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>)}
        </select>
      </div>

      <div className="mb-4 overflow-x-auto pb-1">
        <div className="inline-flex rounded-2xl border border-sol-borde bg-white p-1 gap-1 min-w-max">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${seccion === s.id ? "bg-sol-azul text-white shadow-sm" : "text-sol-gris hover:bg-sol-suave"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {["resumen", "ventas"].includes(seccion) && (
          <MetricCard icon={DollarSign} label="Ingresos por ventas" value={fmt(m.ingresos)} color="#1A4FA0" detail={`${m.cantidad} factura${m.cantidad === 1 ? "" : "s"} pagada${m.cantidad === 1 ? "" : "s"}`} delta={variacion(m.ingresos, periodoAnterior.ingresos)} />
        )}
        {["resumen", "finanzas"].includes(seccion) && (
          <MetricCard icon={TrendingUp} label="Utilidad neta" value={fmt(utilidadNeta)} color={utilidadNeta < 0 ? "#E22B23" : "#159A5A"} detail={`${margenNeto}% margen neto`} emphasis />
        )}
        {["resumen", "finanzas", "productos"].includes(seccion) && (
          <MetricCard icon={Percent} label="Margen bruto" value={`${m.margenBruto}%`} color={m.margenBruto < 25 ? "#E22B23" : "#159A5A"} detail={`${fmt(m.utilidadBruta)} antes de gastos`} />
        )}
        {["resumen", "productos", "finanzas"].includes(seccion) && (
          <MetricCard icon={PackageCheck} label="Costo de ventas" value={fmt(m.costoVentas)} color="#F58220" detail="Costo estimado de productos vendidos" inverse />
        )}
        {seccion === "finanzas" && (
          <>
            <MetricCard icon={ArrowDownCircle} label="Gastos operativos" value={fmt(gastosPeriodo)} color="#E22B23" detail={`${gastoOperativoPct}% de ingresos operativos`} inverse />
            <MetricCard icon={Users} label="Costo de nomina" value={fmt(nominaPeriodo)} color="#6D5BD0" detail={`${nominaPct}% de ingresos operativos`} inverse />
            <MetricCard icon={Wallet} label="Ingresos adicionales" value={fmt(ingresosManualPeriodo)} color="#159A5A" detail="Movimientos de caja tipo ingreso" />
          </>
        )}
        {seccion === "ventas" && (
          <>
            <MetricCard icon={Receipt} label="Ticket promedio" value={fmt(m.ticket)} color="#0F766E" detail={`Antes: ${fmt(periodoAnterior.ticket)}`} delta={variacion(m.ticket, periodoAnterior.ticket)} />
            <MetricCard icon={CreditCard} label="Metodo principal" value={metodoTop?.metodo || "Sin pagos"} color="#6D5BD0" detail={metodoTop ? fmt(metodoTop.total) : "Sin ventas"} />
            <MetricCard icon={Ban} label="Anulaciones" value={m.anuladas} color="#E22B23" detail={`${m.tasaAnulacion}% del total`} inverse />
          </>
        )}
        {seccion === "productos" && (
          <MetricCard icon={ShoppingCart} label="Unidades vendidas" value={m.unidades} color="#E22B23" detail={m.topUnidades ? `${m.topUnidades.name}: ${m.topUnidades.cantidad}` : "Sin productos vendidos"} />
        )}
        {seccion === "inventario" && (
          <>
            <MetricCard icon={AlertTriangle} label="Inventario critico" value={m.criticos.length} color={m.criticos.length ? "#E22B23" : "#159A5A"} detail="Insumos por debajo del minimo" inverse />
            <MetricCard icon={PackageCheck} label="Estado general" value={m.criticos.length ? "Revisar" : "OK"} color={m.criticos.length ? "#F58220" : "#159A5A"} detail="Control de existencias" />
          </>
        )}
        {seccion === "resumen" && (
          <>
            <MetricCard icon={CalendarCheck} label="Reservas" value={resumenReservas.cantidad} color="#0F766E" detail={`${fmt(resumenReservas.anticipos)} en anticipos`} />
            <MetricCard icon={AlertTriangle} label="Inventario critico" value={m.criticos.length} color={m.criticos.length ? "#E22B23" : "#159A5A"} detail="Alertas de stock" inverse />
          </>
        )}
      </div>

      {seccion === "resumen" && (
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Panel title={`Flujo de ingresos del periodo - ${label}`} subtitle="Ventas pagadas por fecha segun filtros activos.">
          {flujoPeriodo.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={flujoPeriodo} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="ingresosDashboard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A4FA0" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#1A4FA0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE6D6" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v, name) => (name === "ingresos" ? fmt(v) : v)} />
                <Area type="monotone" dataKey="ingresos" name="ingresos" stroke="#1A4FA0" strokeWidth={2.5} fill="url(#ingresosDashboard)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Sin ventas para graficar en este periodo." />}
        </Panel>

        <Panel title="Lectura ejecutiva" subtitle="Lo mas importante para decidir rapido.">
          <div className="space-y-2 text-sm">
            <Insight label="Resultado" value={utilidadNeta >= 0 ? "Ganancia operativa" : "Perdida operativa"} color={utilidadNeta >= 0 ? "#159A5A" : "#E22B23"} />
            <Insight label="Ventas vs periodo anterior" value={`${variacion(m.ingresos, periodoAnterior.ingresos)}%`} color={variacion(m.ingresos, periodoAnterior.ingresos) >= 0 ? "#159A5A" : "#E22B23"} />
            <Insight label="Retiros de caja" value={fmt(retirosPeriodo)} color="#6B7280" />
            <Insight label="Inventario critico" value={`${m.criticos.length} insumo${m.criticos.length === 1 ? "" : "s"}`} color={m.criticos.length ? "#E22B23" : "#159A5A"} />
            <Insight label="Saldo por cobrar reservas" value={fmt(resumenReservas.pendiente)} color={resumenReservas.pendiente ? "#F58220" : "#159A5A"} />
          </div>
          <p className="text-[11px] text-sol-grisClaro mt-3">
            Los retiros se muestran como flujo de caja, pero no reducen la utilidad neta porque no siempre son gasto operativo.
          </p>
        </Panel>
      </div>
      )}

      <div className="hidden" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard icon={DollarSign} label="Ingresos del período" value={fmt(m.ingresos)} color="#1A4FA0" sub={`${m.cantidad} factura${m.cantidad === 1 ? "" : "s"}`} />
        <StatCard icon={Receipt} label="Ticket promedio" value={fmt(m.ticket)} color="#F58220" />
        <StatCard icon={ShoppingCart} label="Unidades vendidas" value={m.unidades} color="#E22B23" />
        <StatCard icon={Percent} label="Margen bruto" value={`${m.margenBruto}%`} color={m.margenBruto < 25 ? "#E22B23" : "#159A5A"} sub={`${fmt(m.utilidadBruta)} de utilidad`} />
        <StatCard icon={Ban} label="Ventas anuladas" value={m.anuladas} color="#E22B23" sub={`${m.tasaAnulacion}% del total`} />
        <StatCard icon={CreditCard} label="Metodo principal" value={metodoTop?.metodo || "Sin pagos"} color="#6D5BD0" sub={metodoTop ? fmt(metodoTop.total) : "Sin ventas"} />
        <StatCard icon={CalendarCheck} label="Reservas del periodo" value={resumenReservas.cantidad} color="#0F766E" sub={`${fmt(resumenReservas.anticipos)} en anticipos`} />
        <StatCard icon={TrendingUp} label="Utilidad neta" value={fmt(utilidadNeta)} color={utilidadNeta < 0 ? "#E22B23" : "#159A5A"} sub="ingresos - costos - gastos - nómina" />
      </div>

      {seccion === "ventas" && (
      <div className="rounded-2xl bg-white p-4 border border-sol-borde mb-3">
        <h3 className="font-bold text-sm mb-3">Ingresos y ventas por local</h3>
        {!m.puntos.length && <p className="text-sm text-sol-gris">Sin ventas registradas en este periodo.</p>}
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {m.puntos.map((p) => (
            <div key={p.id} className="rounded-xl border border-sol-borde bg-sol-crema px-3 py-2">
              <div className="font-extrabold text-sm truncate">{p.nombre}</div>
              <div className="text-xs text-sol-gris">{p.ventas} venta{p.ventas === 1 ? "" : "s"}</div>
              <div className="text-lg font-extrabold text-sol-azul mt-1">{fmt(p.ingresos)}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Estado de resultados + margen por categoría */}
      {seccion === "ventas" && (
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><CreditCard size={15} className="text-sol-azul" /> Metodos de pago</h3>
          {!m.metodos.length && <p className="text-sm text-sol-gris">Sin pagos registrados en este periodo.</p>}
          <div className="space-y-2">
            {m.metodos.map((p) => (
              <div key={p.metodo}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{p.metodo}</span>
                  <span className="font-bold">{fmt(p.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-sol-suave overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-sol-azul" style={{ width: `${m.ingresos ? Math.min(100, (p.total / m.ingresos) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><UserRound size={15} className="text-sol-azulOsc" /> Desempeno por vendedor</h3>
          {!m.vendedores.length && <p className="text-sm text-sol-gris">Sin ventas registradas por vendedor en este periodo.</p>}
          <div className="space-y-2">
            {m.vendedores.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-sol-suave last:border-0">
                <div>
                  <div className="font-semibold text-sm">{v.nombre}</div>
                  <div className="text-xs text-sol-gris">{v.ventas} venta{v.ventas === 1 ? "" : "s"} - {v.anuladas} anulada{v.anuladas === 1 ? "" : "s"}</div>
                </div>
                <span className="font-extrabold text-sol-azul text-sm">{fmt(v.ingresos)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Clock size={15} className="text-sol-rojo" /> Indicadores operativos</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-sol-crema p-3">
              <div className="text-sol-gris text-xs">Hora pico</div>
              <div className="font-extrabold">{m.horaPico?.hora || "Sin datos"}</div>
              <div className="text-[11px] text-sol-grisClaro">{m.horaPico ? `${fmt(m.horaPico.ingresos)} vendidos` : "0 ventas"}</div>
            </div>
            <div className="rounded-xl bg-sol-crema p-3">
              <div className="text-sol-gris text-xs">Producto mas vendido</div>
              <div className="font-extrabold truncate">{m.topUnidades?.name || "Sin datos"}</div>
              <div className="text-[11px] text-sol-grisClaro">{m.topUnidades ? `${m.topUnidades.cantidad} unidades` : "0 unidades"}</div>
            </div>
            <div className="rounded-xl bg-sol-crema p-3">
              <div className="text-sol-gris text-xs">Gastos / ingresos</div>
              <div className="font-extrabold">{gastoOperativoPct}%</div>
              <div className="text-[11px] text-sol-grisClaro">{fmt(gastosPeriodo)} en gastos</div>
            </div>
            <div className="rounded-xl bg-sol-crema p-3">
              <div className="text-sol-gris text-xs">Nomina / ingresos</div>
              <div className="font-extrabold">{nominaPct}%</div>
              <div className="text-[11px] text-sol-grisClaro">{fmt(nominaPeriodo)} en nomina</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-sol-borde p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-sol-gris">Reservas confirmadas/en curso</span>
              <span className="font-bold">{resumenReservas.confirmadas}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-sol-gris">Saldo por cobrar reservas</span>
              <span className="font-bold">{fmt(resumenReservas.pendiente)}</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {["finanzas", "productos"].includes(seccion) && (
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {seccion === "finanzas" && (
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Estado de resultados — {label}</h3>
          <div className="text-sm divide-y divide-sol-suave">
            {m.cats.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-1.5 text-sol-gris">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} /> {c.name}
                </span>
                <span className="font-semibold">{fmt(c.ingresos)}</span>
              </div>
            ))}
            {!m.cats.length && <div className="py-2 text-sol-gris text-xs">Sin ventas registradas en este período.</div>}
            <div className="flex items-center justify-between py-1.5 font-bold">
              <span>Ingresos por ventas</span><span>{fmt(m.ingresos)}</span>
            </div>
            {ingresosManualPeriodo > 0 && (
              <div className="flex items-center justify-between py-1.5 text-sol-exito">
                <span>Ingresos adicionales</span><span>+ {fmt(ingresosManualPeriodo)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5 font-bold">
              <span>Ingresos operativos</span><span>{fmt(ingresosOperativos)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-sol-rojo">
              <span>Costo de ventas</span><span>- {fmt(m.costoVentas)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 font-bold text-sol-azul">
              <span>Utilidad bruta</span><span>{fmt(m.utilidadBruta)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-sol-rojo">
              <span>Gastos operativos</span><span>- {fmt(gastosPeriodo)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-sol-rojo">
              <span>Costo de nómina</span><span>- {fmt(nominaPeriodo)}</span>
            </div>
            {retirosPeriodo > 0 && (
              <div className="flex items-center justify-between py-1.5 text-sol-gris">
                <span>Retiros de caja (flujo, no gasto)</span><span>{fmt(retirosPeriodo)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 font-extrabold text-base border-t border-sol-borde mt-1" style={{ color: utilidadNeta < 0 ? "#E22B23" : "#159A5A" }}>
              <span>Utilidad neta</span><span>{fmt(utilidadNeta)}</span>
            </div>
          </div>
        </div>
        )}

        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Margen de ganancia por categoría</h3>
          {!m.cats.length && <p className="text-sm text-sol-gris">Sin ventas registradas en este período.</p>}
          <div className="space-y-2">
            {m.cats.map((c) => {
              const info = margenInfo(c.margen);
              return (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} /> {c.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-2 rounded-full bg-sol-suave overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, c.margen))}%`, background: info.color }} />
                    </div>
                    <span className="text-xs font-bold w-16 text-right" style={{ color: info.color }}>{c.margen}% {info.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <h3 className="font-bold text-sm mb-2 mt-5 flex items-center gap-1.5"><Users size={15} className="text-sol-azulOsc" /> Nómina vs ingresos del período</h3>
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-sol-gris">Costo de nómina</span>
            <span className="font-bold">{fmt(nominaPeriodo)}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-sol-gris">Ingresos del período</span>
            <span className="font-bold">{fmt(m.ingresos)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-sol-suave overflow-hidden mt-1">
            <div className="h-full rounded-full bg-sol-azulOsc" style={{ width: `${m.ingresos ? Math.min(100, (nominaPeriodo / m.ingresos) * 100) : 0}%` }} />
          </div>
          <p className="text-[11px] text-sol-grisClaro mt-1">
            La nómina representa {m.ingresos ? Math.round((nominaPeriodo / m.ingresos) * 100) : 0}% de los ingresos del período.
          </p>
        </div>
      </div>
      )}

      {["ventas", "productos"].includes(seccion) && (
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {seccion === "ventas" && (
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Comparativo de ventas: mes actual vs mes anterior</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={comparativo} margin={{ left: -8, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE6D6" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => fmt(v)} labelFormatter={(d) => `Día ${d}`} />
              <Legend formatter={(v) => (v === "actual" ? "Mes actual" : "Mes anterior")} />
              <Line type="monotone" dataKey="actual" name="actual" stroke="#1A4FA0" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="anterior" name="anterior" stroke="#9AA1AD" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
        {seccion === "productos" && (
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Ventas por categoría — {label}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={m.cats} dataKey="ingresos" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
                {m.cats.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {m.cats.map((c, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-sol-gris">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} />{c.name}
              </span>
            ))}
          </div>
        </div>
        )}
      </div>
      )}

      {["productos", "inventario"].includes(seccion) && (
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {seccion === "productos" && (
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3">Top 5 productos — {label}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={m.top} layout="vertical" margin={{ left: 10, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#222A3A" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="total" fill="#F58220" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
        {seccion === "inventario" && (
        <div className="rounded-2xl bg-white p-4 border border-sol-borde">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><AlertTriangle size={15} className="text-sol-rojo" /> Inventario crítico</h3>
          {!m.criticos.length && <p className="text-sm text-sol-gris">Todo el inventario está por encima del mínimo.</p>}
          {m.criticos.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-sol-suave">
              <span className="font-semibold text-[13px]">{g.nombre}</span>
              <span className="text-xs font-bold text-sol-rojo">{g.stock} / {g.stockMin} {g.unidad}</span>
            </div>
          ))}
        </div>
        )}
      </div>
      )}

      {verPdf && <DashboardPreview reporte={reportePdf} onClose={() => setVerPdf(false)} />}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, color, detail, delta, inverse = false, emphasis = false }) {
  const hasDelta = typeof delta === "number";
  const deltaBueno = inverse ? delta <= 0 : delta >= 0;
  return (
    <div className={`rounded-2xl bg-white border p-4 overflow-hidden relative ${emphasis ? "border-sol-azul shadow-sm" : "border-sol-borde"}`}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase text-sol-gris tracking-wide">{label}</div>
          <div className={`font-extrabold text-sol-tinta leading-tight mt-1 ${String(value).length > 12 ? "text-[19px]" : "text-[24px]"}`}>{value}</div>
          {detail && <div className="text-[11px] text-sol-grisClaro mt-1 truncate">{detail}</div>}
        </div>
        <div className="rounded-xl p-2.5 shrink-0" style={{ background: `${color}1A` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      {hasDelta && (
        <div className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${deltaBueno ? "bg-sol-exito/10 text-sol-exito" : "bg-sol-rojo/10 text-sol-rojo"}`}>
          {delta > 0 ? "+" : ""}{delta}% vs periodo anterior
        </div>
      )}
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl bg-white p-4 border border-sol-borde min-w-0">
      <div className="mb-3">
        <h3 className="font-extrabold text-sm text-sol-tinta">{title}</h3>
        {subtitle && <p className="text-[12px] text-sol-gris">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="h-[220px] rounded-xl bg-sol-crema border border-sol-borde flex items-center justify-center text-sm text-sol-gris">
      {text}
    </div>
  );
}

function Insight({ label, value, color }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sol-borde bg-sol-crema px-3 py-2">
      <span className="text-sol-gris">{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}
