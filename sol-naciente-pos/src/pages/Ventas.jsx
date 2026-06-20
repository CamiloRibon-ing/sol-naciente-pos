import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Ban, Download } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { fmt, fmtFecha, METODOS_PAGO } from "../lib/format";
import { descargarExcel } from "../lib/excel";
import { ConfirmDialog } from "../components/ui";
import DocumentoPreview from "../components/pdf/DocumentoPreview";

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

const diaSemana = (fecha) => new Date(fecha).toLocaleDateString("es-CO", { weekday: "long" });
const fechaArchivo = () => new Date().toISOString().slice(0, 10);
const pagoRows = (v) => (v.pagos?.length ? v.pagos : [{ metodo: v.pago || "Efectivo", monto: Number(v.total) || 0 }]);
const utilidadLinea = (l) => {
  const cantidad = Number(l.cantidad) || 0;
  const precio = Number(l.precio) || 0;
  const costo = Number(l.costo) || 0;
  return {
    subtotal: precio * cantidad,
    costoTotal: costo * cantidad,
    utilidad: (precio - costo) * cantidad,
  };
};

export default function Ventas() {
  const { historialVentas, cargarHistorial, anularVenta, puntosVenta } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [fPago, setFPago] = useState("todos");
  const [fCajero, setFCajero] = useState("todos");
  const [fPunto, setFPunto] = useState("todos");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [doc, setDoc] = useState(null);
  const [anular, setAnular] = useState(null);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const cajeros = useMemo(() => [...new Set(historialVentas.map((v) => v.cajero).filter(Boolean))], [historialVentas]);
  const idsPuntoFiltro = useMemo(() => idsConDescendientes(puntosVenta, fPunto), [puntosVenta, fPunto]);
  const puntoFiltroKey = idsPuntoFiltro?.join("|") || "todos";

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return historialVentas.filter((v) => {
      if (fPago !== "todos" && v.pago !== fPago) return false;
      if (fCajero !== "todos" && v.cajero !== fCajero) return false;
      if (idsPuntoFiltro && !idsPuntoFiltro.includes(v.id_punto)) return false;
      const f = new Date(v.fecha);
      if (fDesde && f < new Date(fDesde)) return false;
      if (fHasta && f > new Date(fHasta + "T23:59:59")) return false;
      if (q && !String(v.numero).toLowerCase().includes(q) && !(v.cliente || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [historialVentas, busqueda, fPago, fCajero, puntoFiltroKey, fDesde, fHasta]);

  const totalPeriodo = filtradas.filter((v) => v.estado !== "anulada").reduce((s, v) => s + v.total, 0);

  const verDoc = (v) => setDoc({
    tipo: "FACTURA",
    idVenta: v.id,
    numero: v.numero,
    fecha: v.fecha,
    cliente: v.cliente,
    pago: v.pago,
    pagos: v.pagos,
    pagado: v.pagado || 0,
    saldoPendiente: v.saldoPendiente || 0,
    puntoVenta: v.puntoVenta,
    clienteDocumento: v.clienteDocumento || "",
    clienteTelefono: v.clienteTelefono || "",
    clienteCorreo: v.clienteCorreo || "",
    descuentoGlobal: 0,
    impuestoRate: v.subtotal ? (Number(v.impuestos || 0) / Math.max(1, Number(v.subtotal || 0) - Number(v.descuento || 0))) : undefined,
    estadoElectronico: v.estadoElectronico || "Pendiente de integracion DIAN",
    lineas: v.lineas,
  });

  const confirmarAnular = async () => {
    try {
      await anularVenta(anular.id);
      toast.success(`Venta ${anular.numero} anulada y stock restaurado`);
    } catch (e) {
      toast.error(e.message || "No se pudo anular la venta");
    } finally {
      setAnular(null);
    }
  };

  const exportarVentas = () => {
    const ventasValidas = filtradas.filter((v) => v.estado !== "anulada");
    const totalVentas = ventasValidas.reduce((s, v) => s + (Number(v.total) || 0), 0);
    const subtotal = ventasValidas.reduce((s, v) => s + (Number(v.subtotal) || 0), 0);
    const descuentos = ventasValidas.reduce((s, v) => s + (Number(v.descuento) || 0), 0);
    const impuestos = ventasValidas.reduce((s, v) => s + (Number(v.impuestos) || 0), 0);
    const saldos = ventasValidas.reduce((s, v) => s + (Number(v.saldoPendiente) || 0), 0);
    const costo = ventasValidas.reduce((s, v) => s + (v.lineas || []).reduce((acc, l) => acc + utilidadLinea(l).costoTotal, 0), 0);
    const utilidad = totalVentas - impuestos - costo;
    const pagosPorMetodo = {};
    ventasValidas.forEach((v) => pagoRows(v).forEach((p) => {
      pagosPorMetodo[p.metodo] = (pagosPorMetodo[p.metodo] || 0) + (Number(p.monto) || 0);
    }));
    const nombrePeriodo = `${fDesde || "inicio"} a ${fHasta || "hoy"}`;

    descargarExcel({
      nombreArchivo: `historial-ventas-${fechaArchivo()}.xls`,
      hojas: [
        {
          nombre: "Resumen",
          filas: [
            ["Informe", "Historial de ventas"],
            ["Periodo", nombrePeriodo],
            ["Local", fPunto === "todos" ? "Todos los locales" : puntosVenta.find((p) => p.id === fPunto)?.nombre || "Local filtrado"],
            ["Metodo de pago", fPago === "todos" ? "Todos" : fPago],
            ["Cajero", fCajero === "todos" ? "Todos" : fCajero],
            ["Facturas pagadas", ventasValidas.length],
            ["Facturas anuladas", filtradas.length - ventasValidas.length],
            ["Subtotal", subtotal],
            ["Descuentos", descuentos],
            ["Impuestos", impuestos],
            ["Total ventas", totalVentas],
            ["Saldo pendiente", saldos],
            ["Costo estimado de productos", costo],
            ["Utilidad estimada antes de gastos", utilidad],
            ["Ticket promedio", ventasValidas.length ? Math.round(totalVentas / ventasValidas.length) : 0],
          ],
        },
        {
          nombre: "Ventas detalladas",
          filas: [
            ["Fecha", "Dia", "Factura", "Local", "Caja", "Cajero", "Cliente", "Documento cliente", "Telefono", "Correo", "Metodo pago", "Subtotal", "Descuento", "Impuestos", "Total", "Pagado", "Saldo pendiente", "Estado", "Notas"],
            ...filtradas.map((v) => [
              fmtFecha(v.fecha),
              diaSemana(v.fecha),
              v.numero,
              v.puntoVenta || "Sin local",
              v.id_caja || "",
              v.cajero || "",
              v.cliente || "Consumidor final",
              v.clienteDocumento || "",
              v.clienteTelefono || "",
              v.clienteCorreo || "",
              v.pago || "",
              Number(v.subtotal) || 0,
              Number(v.descuento) || 0,
              Number(v.impuestos) || 0,
              Number(v.total) || 0,
              Number(v.pagado) || Number(v.total) || 0,
              Number(v.saldoPendiente) || 0,
              v.estado || "",
              v.notas || "",
            ]),
          ],
        },
        {
          nombre: "Productos vendidos",
          filas: [
            ["Fecha", "Factura", "Local", "Cliente", "Producto", "Categoria", "Cantidad", "Precio unitario", "Costo unitario", "Subtotal producto", "Costo total", "Utilidad estimada", "Nota item"],
            ...ventasValidas.flatMap((v) => (v.lineas || []).map((l) => {
              const u = utilidadLinea(l);
              return [
                fmtFecha(v.fecha),
                v.numero,
                v.puntoVenta || "Sin local",
                v.cliente || "Consumidor final",
                l.nombre || "",
                l.cat || "",
                Number(l.cantidad) || 0,
                Number(l.precio) || 0,
                Number(l.costo) || 0,
                u.subtotal,
                u.costoTotal,
                u.utilidad,
                l.nota || "",
              ];
            })),
          ],
        },
        {
          nombre: "Pagos",
          filas: [
            ["Fecha", "Factura", "Local", "Cliente", "Metodo", "Monto", "Estado venta"],
            ...filtradas.flatMap((v) => pagoRows(v).map((p) => [
              fmtFecha(v.fecha),
              v.numero,
              v.puntoVenta || "Sin local",
              v.cliente || "Consumidor final",
              p.metodo || v.pago || "",
              Number(p.monto) || 0,
              v.estado || "",
            ])),
            [],
            ["Resumen por metodo", "", "", "", "", ""],
            ["Metodo", "Total"],
            ...Object.entries(pagosPorMetodo).map(([metodo, monto]) => [metodo, monto]),
          ],
        },
      ],
    });
    toast.success("Informe de ventas descargado");
  };

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Historial de ventas</h1>
          <p className="text-sol-gris text-[13px]">Consulta, reimprime y anula facturas emitidas.</p>
        </div>
        <button onClick={exportarVentas} className="rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 border border-sol-borde text-sol-gris hover:bg-sol-suave">
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative">
          <Search size={15} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nro. o cliente..."
            className="rounded-lg pl-9 pr-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul w-48" />
        </div>
        <select value={fPago} onChange={(e) => setFPago(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
          <option value="todos">Todos los metodos de pago</option>
          {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fCajero} onChange={(e) => setFCajero(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
          <option value="todos">Todos los cajeros</option>
          {cajeros.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fPunto} onChange={(e) => setFPunto(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
          <option value="todos">Todos los locales</option>
          {puntosVenta.map((p) => <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>)}
        </select>
        <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
        <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
        <div className="ml-auto rounded-lg px-4 py-2 text-xs font-bold bg-sol-suave text-sol-azulOsc">
          Total del periodo: <span className="text-sm">{fmt(totalPeriodo)}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
        <table className="w-full text-sm min-w-[980px]">
          <thead><tr className="bg-sol-suave text-sol-gris">
            {["Nro.", "Fecha", "Local", "Cliente", "Cajero", "Pago", "Total", "Saldo", "Estado", ""].map((h, i) =>
              <th key={i} className={`px-4 py-2.5 font-bold ${[6, 7].includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={v.id} className={`border-t border-sol-suave ${v.estado === "anulada" ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5 font-bold">{v.numero}</td>
                <td className="px-4 py-2.5 text-sol-gris whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                <td className="px-4 py-2.5 text-sol-gris">{v.puntoVenta || "Sin local"}</td>
                <td className="px-4 py-2.5">{v.cliente}</td>
                <td className="px-4 py-2.5 text-sol-gris">{v.cajero}</td>
                <td className="px-4 py-2.5 text-sol-gris">{v.pago}</td>
                <td className="px-4 py-2.5 text-right font-bold">{fmt(v.total)}</td>
                <td className={`px-4 py-2.5 text-right font-bold ${Number(v.saldoPendiente || 0) > 0 ? "text-sol-rojo" : "text-sol-exito"}`}>
                  {fmt(v.saldoPendiente || 0)}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: (v.estado === "anulada" ? "#E22B23" : "#159A5A") + "1A", color: v.estado === "anulada" ? "#E22B23" : "#159A5A" }}>
                    {v.estado === "anulada" ? "Anulada" : "Pagada"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => verDoc(v)} className="p-1.5" title="Ver / reimprimir"><Eye size={15} className="text-sol-gris" /></button>
                  {v.estado !== "anulada" && (
                    <button onClick={() => setAnular(v)} className="p-1.5" title="Anular venta"><Ban size={15} className="text-sol-rojo" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length && <p className="text-sol-gris text-sm p-6 text-center">No hay ventas que coincidan con los filtros.</p>}
      </div>

      {doc && <DocumentoPreview doc={doc} onClose={() => setDoc(null)} />}
      {anular && (
        <ConfirmDialog
          titulo="Anular venta"
          mensaje={`Anular la venta ${anular.numero}? El inventario consumido se devolvera a las existencias. Esta accion no se puede deshacer.`}
          confirmar="Anular"
          onConfirm={confirmarAnular}
          onClose={() => setAnular(null)}
        />
      )}
    </section>
  );
}
