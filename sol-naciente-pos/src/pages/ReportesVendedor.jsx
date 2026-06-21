import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, Download, Receipt, Search, UserRound, Wallet } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { fmt, fmtFecha } from "../lib/format";
import { descargarExcel } from "../lib/excel";
import { Boton, SelectPro, StatCard } from "../components/ui";
import * as cajaDb from "../lib/caja";

const inicioDia = (s) => {
  const d = s ? new Date(`${s}T00:00:00`) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const finDia = (s) => {
  const d = s ? new Date(`${s}T23:59:59`) : new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};
const aInputDate = (d) => d.toISOString().slice(0, 10);

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

export default function ReportesVendedor() {
  const { historialVentas, cargarHistorial, puntosVenta } = useStore();
  const hoy = new Date();
  const [desde, setDesde] = useState(aInputDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(aInputDate(hoy));
  const [fPunto, setFPunto] = useState("todos");
  const [fUsuario, setFUsuario] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cajas, setCajas] = useState([]);
  const [paginaVentas, setPaginaVentas] = useState(1);
  const ventasPorPagina = 10;

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const idsPuntoFiltro = useMemo(() => idsConDescendientes(puntosVenta, fPunto), [puntosVenta, fPunto]);
  const puntoFiltroKey = idsPuntoFiltro?.join("|") || "todos";
  const desdeDate = useMemo(() => inicioDia(desde), [desde]);
  const hastaDate = useMemo(() => finDia(hasta), [hasta]);

  useEffect(() => {
    let activo = true;
    cajaDb.listCajasRango(desdeDate, hastaDate, idsPuntoFiltro || undefined)
      .then((data) => { if (activo) setCajas(data); })
      .catch(() => { if (activo) setCajas([]); });
    return () => { activo = false; };
  }, [desdeDate, hastaDate, puntoFiltroKey]);

  const ventasRango = useMemo(() => historialVentas.filter((v) => {
    const f = new Date(v.fecha);
    if (f < desdeDate || f > hastaDate) return false;
    if (idsPuntoFiltro && !idsPuntoFiltro.includes(v.id_punto)) return false;
    if (fUsuario !== "todos" && (v.cajeroId || v.cajero) !== fUsuario) return false;
    const q = busqueda.trim().toLowerCase();
    if (q && ![v.numero, v.cliente, v.cajero, v.puntoVenta].some((x) => String(x || "").toLowerCase().includes(q))) return false;
    return true;
  }), [historialVentas, desdeDate, hastaDate, puntoFiltroKey, fUsuario, busqueda]);

  useEffect(() => {
    setPaginaVentas(1);
  }, [desde, hasta, fPunto, fUsuario, busqueda, ventasRango.length]);

  const totalPaginasVentas = Math.max(1, Math.ceil(ventasRango.length / ventasPorPagina));
  const paginaActualVentas = Math.min(paginaVentas, totalPaginasVentas);
  const inicioVentas = (paginaActualVentas - 1) * ventasPorPagina;
  const ventasPagina = ventasRango.slice(inicioVentas, inicioVentas + ventasPorPagina);
  const finVentas = Math.min(ventasRango.length, inicioVentas + ventasPorPagina);
  const inicioPaginasVentas = Math.max(1, Math.min(paginaActualVentas - 2, totalPaginasVentas - 4));
  const paginasVentas = Array.from({ length: Math.min(totalPaginasVentas, 5) }, (_, i) => inicioPaginasVentas + i);
  const cambiarPaginaVentas = (pagina) => setPaginaVentas(Math.max(1, Math.min(totalPaginasVentas, pagina)));

  const vendedores = useMemo(() => {
    const map = new Map();
    historialVentas.forEach((v) => {
      const key = v.cajeroId || v.cajero || "sin-usuario";
      map.set(key, { id: key, nombre: v.cajero || "Sin usuario" });
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [historialVentas]);

  const resumen = useMemo(() => {
    const pagadas = ventasRango.filter((v) => v.estado !== "anulada");
    const anuladas = ventasRango.filter((v) => v.estado === "anulada");
    const porVendedor = {};
    const porMetodo = {};
    pagadas.forEach((v) => {
      const key = v.cajeroId || v.cajero || "sin-usuario";
      porVendedor[key] = porVendedor[key] || { id: key, nombre: v.cajero || "Sin usuario", ventas: 0, ingresos: 0, anuladas: 0 };
      porVendedor[key].ventas += 1;
      porVendedor[key].ingresos += Number(v.total) || 0;
      const pagos = v.pagos?.length ? v.pagos : [{ metodo: v.pago || "Efectivo", monto: Number(v.total) || 0 }];
      pagos.forEach((p) => {
        porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + (Number(p.monto) || 0);
      });
    });
    anuladas.forEach((v) => {
      const key = v.cajeroId || v.cajero || "sin-usuario";
      porVendedor[key] = porVendedor[key] || { id: key, nombre: v.cajero || "Sin usuario", ventas: 0, ingresos: 0, anuladas: 0 };
      porVendedor[key].anuladas += 1;
    });
    const cierres = cajas.filter((c) => c.estado === "cerrada" && (fUsuario === "todos" || c.id_usuario_cierre === fUsuario || c.id_usuario_apertura === fUsuario));
    return {
      ventas: pagadas.length,
      ingresos: pagadas.reduce((s, v) => s + (Number(v.total) || 0), 0),
      anuladas: anuladas.length,
      totalCierres: cierres.length,
      porMetodo,
      porVendedor: Object.values(porVendedor).sort((a, b) => b.ingresos - a.ingresos),
      cierresDetalle: cierres,
    };
  }, [ventasRango, cajas, fUsuario]);

  const exportarExcel = () => {
    const localSeleccionado = fPunto === "todos"
      ? "Todos los locales"
      : puntosVenta.find((p) => p.id === fPunto)?.nombre || "Local seleccionado";
    const vendedorSeleccionado = fUsuario === "todos"
      ? "Todos los vendedores"
      : vendedores.find((v) => v.id === fUsuario)?.nombre || "Vendedor seleccionado";

    descargarExcel({
      nombreArchivo: `reporte-vendedores-${desde}-${hasta}.xls`,
      hojas: [
        {
          nombre: "Resumen",
          filas: [
            ["Indicador", "Valor"],
            ["Desde", desde],
            ["Hasta", hasta],
            ["Local", localSeleccionado],
            ["Vendedor", vendedorSeleccionado],
            ["Ventas pagadas", resumen.ventas],
            ["Ingresos vendidos", resumen.ingresos],
            ["Anulaciones", resumen.anuladas],
            ["Cierres de caja", resumen.totalCierres],
          ],
        },
        {
          nombre: "Ranking vendedores",
          filas: [
            ["Vendedor", "Ventas pagadas", "Anulaciones", "Ingresos vendidos", "Ticket promedio"],
            ...resumen.porVendedor.map((v) => [
              v.nombre,
              v.ventas,
              v.anuladas,
              v.ingresos,
              v.ventas ? Math.round(v.ingresos / v.ventas) : 0,
            ]),
          ],
        },
        {
          nombre: "Metodos de pago",
          filas: [
            ["Metodo", "Total vendido", "Participacion"],
            ...Object.entries(resumen.porMetodo).map(([metodo, monto]) => [
              metodo,
              monto,
              resumen.ingresos ? `${Math.round((Number(monto) / resumen.ingresos) * 100)}%` : "0%",
            ]),
          ],
        },
        {
          nombre: "Cierres de caja",
          filas: [
            ["Local", "Apertura", "Cierre", "Usuario apertura", "Usuario cierre", "Esperado", "Real", "Diferencia"],
            ...resumen.cierresDetalle.map((c) => [
              c.puntos_venta?.nombre || c.id_punto || "Sin local",
              fmtFecha(c.fecha_apertura),
              fmtFecha(c.fecha_cierre),
              c.usuario_apertura?.nombre || c.id_usuario_apertura || "",
              c.usuario_cierre?.nombre || c.id_usuario_cierre || "",
              Number(c.monto_final_esperado) || 0,
              Number(c.monto_final_real) || 0,
              Number(c.diferencia) || 0,
            ]),
          ],
        },
        {
          nombre: "Detalle ventas",
          filas: [
            ["Numero", "Fecha", "Local", "Vendedor", "Cliente", "Pago", "Estado", "Total"],
            ...ventasRango.map((v) => [
              v.numero,
              fmtFecha(v.fecha),
              v.puntoVenta || "",
              v.cajero || "Sin usuario",
              v.cliente || "Consumidor final",
              v.pago || "",
              v.estado === "anulada" ? "Anulada" : "Pagada",
              Number(v.total) || 0,
            ]),
          ],
        },
      ],
    });
  };

  const opcionesPunto = [
    { value: "todos", label: "Todos los locales" },
    ...puntosVenta.map((p) => ({ value: p.id, label: p.idPuntoPadre ? `- ${p.nombre}` : p.nombre })),
  ];
  const opcionesVendedor = [
    { value: "todos", label: "Todos los vendedores" },
    ...vendedores.map((v) => ({ value: v.id, label: v.nombre })),
  ];

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Reportes por vendedor</h1>
          <p className="text-sol-gris text-[13px]">Ventas, metodos de pago, anulaciones y cierres de caja por usuario.</p>
        </div>
        <Boton onClick={exportarExcel}><Download size={16} /> Exportar Excel</Boton>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-3 mb-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
          className="h-10 rounded-xl px-3 py-2 text-sm font-bold border border-sol-borde bg-white shadow-sm focus:outline-none focus:border-sol-azul focus:ring-2 focus:ring-sol-azul/10" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
          className="h-10 rounded-xl px-3 py-2 text-sm font-bold border border-sol-borde bg-white shadow-sm focus:outline-none focus:border-sol-azul focus:ring-2 focus:ring-sol-azul/10" />
        <SelectPro value={fPunto} onChange={setFPunto} options={opcionesPunto} placeholder="Local" ariaLabel="Filtrar por local" />
        <SelectPro value={fUsuario} onChange={setFUsuario} options={opcionesVendedor} placeholder="Vendedor" ariaLabel="Filtrar por vendedor" />
        <div className="relative">
          <Search size={14} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar venta"
            className="h-10 rounded-xl pl-8 pr-3 py-2 text-sm font-bold border border-sol-borde bg-white shadow-sm focus:outline-none focus:border-sol-azul focus:ring-2 focus:ring-sol-azul/10" />
        </div>
      </div>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatCard icon={Receipt} label="Ventas pagadas" value={resumen.ventas} color="#1A4FA0" />
        <StatCard icon={Wallet} label="Ingresos vendidos" value={fmt(resumen.ingresos)} color="#159A5A" />
        <StatCard icon={Ban} label="Anulaciones" value={resumen.anuladas} color="#E22B23" />
        <StatCard icon={CalendarDays} label="Cierres de caja" value={resumen.totalCierres} color="#F58220" />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <h2 className="font-extrabold mb-3">Ranking por vendedor</h2>
          {!resumen.porVendedor.length && <p className="text-sm text-sol-gris">Sin ventas en el periodo.</p>}
          {resumen.porVendedor.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-2 border-b border-sol-suave last:border-0">
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5"><UserRound size={14} className="text-sol-azul" /> {v.nombre}</div>
                <div className="text-xs text-sol-gris">{v.ventas} venta(s) · {v.anuladas} anulada(s)</div>
              </div>
              <div className="font-extrabold text-sol-azul">{fmt(v.ingresos)}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <h2 className="font-extrabold mb-3">Metodos de pago</h2>
          {!Object.keys(resumen.porMetodo).length && <p className="text-sm text-sol-gris">Sin pagos en el periodo.</p>}
          {Object.entries(resumen.porMetodo).map(([metodo, monto]) => (
            <div key={metodo} className="flex items-center justify-between py-2 border-b border-sol-suave last:border-0">
              <span className="font-bold text-sm">{metodo}</span>
              <span className="font-extrabold text-sol-azul">{fmt(monto)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-4 mb-4">
        <h2 className="font-extrabold mb-3">Cierres de caja por usuario</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Local", "Apertura", "Cierre", "Usuario apertura", "Usuario cierre", "Esperado", "Real", "Diferencia"].map((h, i) =>
                <th key={i} className={`px-3 py-2.5 font-bold ${i >= 5 ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {resumen.cierresDetalle.map((c) => (
                <tr key={c.id_caja} className="border-t border-sol-suave">
                  <td className="px-3 py-2.5">{c.puntos_venta?.nombre || c.id_punto || "Sin local"}</td>
                  <td className="px-3 py-2.5 text-sol-gris">{fmtFecha(c.fecha_apertura)}</td>
                  <td className="px-3 py-2.5 text-sol-gris">{fmtFecha(c.fecha_cierre)}</td>
                  <td className="px-3 py-2.5">{c.usuario_apertura?.nombre || c.id_usuario_apertura || "—"}</td>
                  <td className="px-3 py-2.5">{c.usuario_cierre?.nombre || c.id_usuario_cierre || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{fmt(c.monto_final_esperado)}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{fmt(c.monto_final_real)}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${Number(c.diferencia) === 0 ? "text-sol-exito" : "text-sol-rojo"}`}>{fmt(c.diferencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!resumen.cierresDetalle.length && <p className="text-sol-gris text-sm p-6 text-center">No hay cierres de caja para los filtros seleccionados.</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-extrabold">Detalle de ventas</h2>
          {!!ventasRango.length && (
            <span className="text-xs font-bold text-sol-gris">
              Mostrando {inicioVentas + 1}-{finVentas} de {ventasRango.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Nro.", "Fecha", "Local", "Vendedor", "Cliente", "Pago", "Estado", "Total"].map((h, i) =>
                <th key={i} className={`px-3 py-2.5 font-bold ${i === 7 ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ventasPagina.map((v) => (
                <tr key={v.id} className={`border-t border-sol-suave ${v.estado === "anulada" ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2.5 font-bold">{v.numero}</td>
                  <td className="px-3 py-2.5 text-sol-gris">{fmtFecha(v.fecha)}</td>
                  <td className="px-3 py-2.5">{v.puntoVenta}</td>
                  <td className="px-3 py-2.5">{v.cajero}</td>
                  <td className="px-3 py-2.5">{v.cliente}</td>
                  <td className="px-3 py-2.5 text-sol-gris">{v.pago}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.estado === "anulada" ? "bg-sol-rojo/10 text-sol-rojo" : "bg-sol-exito/10 text-sol-exito"}`}>
                      {v.estado === "anulada" ? "Anulada" : "Pagada"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">{fmt(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ventasRango.length && <p className="text-sol-gris text-sm p-6 text-center">No hay ventas para los filtros seleccionados.</p>}
        </div>
        {ventasRango.length > ventasPorPagina && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-1 pt-4 mt-3 border-t border-sol-borde">
            <button
              onClick={() => cambiarPaginaVentas(paginaActualVentas - 1)}
              disabled={paginaActualVentas === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-sol-borde px-3 py-2 text-xs font-bold text-sol-gris disabled:opacity-40 disabled:cursor-not-allowed hover:border-sol-azul hover:text-sol-azul"
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <div className="flex items-center justify-center gap-1">
              {inicioPaginasVentas > 1 && <span className="px-1 text-xs text-sol-gris">...</span>}
              {paginasVentas.map((p) => (
                <button
                  key={p}
                  onClick={() => cambiarPaginaVentas(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-extrabold ${p === paginaActualVentas ? "bg-sol-azul text-white" : "border border-sol-borde text-sol-gris hover:border-sol-azul hover:text-sol-azul"}`}
                >
                  {p}
                </button>
              ))}
              {inicioPaginasVentas + paginasVentas.length - 1 < totalPaginasVentas && <span className="px-1 text-xs text-sol-gris">...</span>}
            </div>
            <button
              onClick={() => cambiarPaginaVentas(paginaActualVentas + 1)}
              disabled={paginaActualVentas === totalPaginasVentas}
              className="inline-flex items-center gap-1 rounded-lg border border-sol-borde px-3 py-2 text-xs font-bold text-sol-gris disabled:opacity-40 disabled:cursor-not-allowed hover:border-sol-azul hover:text-sol-azul"
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
