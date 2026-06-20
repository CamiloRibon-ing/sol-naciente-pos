import { useEffect, useState } from "react";
import { Download, X, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import ErrorBoundary from "../ErrorBoundary";
import { fmt } from "../../lib/format";

const TIPO_LABEL = {
  apertura: "Apertura",
  venta: "Venta",
  ingreso: "Ingreso",
  egreso: "Egreso",
  retiro: "Retiro",
  gasto: "Gasto",
  cierre: "Cierre",
};

const utilidadVenta = (venta) => (venta.lineas || []).reduce((s, l) => {
  const cantidad = Number(l.cantidad) || 0;
  const precio = Number(l.precio) || 0;
  const costo = Number(l.costo) || 0;
  return s + ((precio - costo) * cantidad);
}, 0);

const productosVendidos = (ventas = []) => {
  const map = new Map();
  ventas.forEach((v) => (v.lineas || []).forEach((l) => {
    const key = l.productoId || l.nombre;
    const actual = map.get(key) || { nombre: l.nombre, cantidad: 0, total: 0, costo: 0, utilidad: 0 };
    const cantidad = Number(l.cantidad) || 0;
    const precio = Number(l.precio) || 0;
    const costoUnitario = Number(l.costo) || 0;
    actual.cantidad += cantidad;
    actual.total += precio * cantidad;
    actual.costo += costoUnitario * cantidad;
    actual.utilidad += (precio - costoUnitario) * cantidad;
    map.set(key, actual);
  }));
  return [...map.values()].sort((a, b) => b.total - a.total);
};

export default function CuadrePreview({ cuadre, onClose }) {
  const [descargando, setDescargando] = useState(false);
  const [pdfCache, setPdfCache] = useState({ blob: null, url: "" });
  const { caja, resumen, movimientos = [] } = cuadre;
  const cerrada = caja.estado === "cerrada";
  const fecha = new Date(caja.fecha_apertura);
  const archivo = `cuadre-caja-${fecha.toISOString().slice(0, 10)}.pdf`;
  const ventasCaja = resumen.ventasCaja || [];
  const productos = productosVendidos(ventasCaja);
  const utilidad = ventasCaja.reduce((s, v) => s + utilidadVenta(v), 0);

  useEffect(() => () => {
    if (pdfCache.url) URL.revokeObjectURL(pdfCache.url);
  }, [pdfCache.url]);

  const generarPdf = async () => {
    if (pdfCache.blob && pdfCache.url) return pdfCache;
    const [{ pdf }, { default: CuadrePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./CuadrePDF"),
    ]);
    const blob = await pdf(<CuadrePDF cuadre={cuadre} />).toBlob();
    const url = URL.createObjectURL(blob);
    setPdfCache((actual) => {
      if (actual.url) URL.revokeObjectURL(actual.url);
      return { blob, url };
    });
    return { blob, url };
  };

  const descargarPdf = async () => {
    setDescargando(true);
    const t = toast.loading("Preparando PDF...");
    try {
      const { url } = await generarPdf();
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo;
      a.click();
      toast.success("PDF descargado", { id: t });
    } catch (e) {
      toast.error(e.message || "No se pudo descargar el PDF", { id: t });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#141E32]/55" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden border border-sol-borde animar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-sol-borde">
          <div className="flex items-center gap-2">
            <Wallet className="text-sol-azul" size={20} />
            <div>
              <h3 className="font-extrabold text-sol-tinta leading-tight">{cerrada ? "Cuadre de caja" : "Corte parcial de caja"}</h3>
              <p className="text-xs text-sol-gris">Apertura: {fecha.toLocaleDateString("es-CO")} {fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sol-suave"><X size={20} className="text-sol-gris" /></button>
        </div>

        <div className="flex-1 bg-sol-suave overflow-auto p-4">
          <ErrorBoundary>
            <div className="mx-auto max-w-2xl bg-white border border-sol-borde shadow-sm rounded-xl overflow-hidden">
              <div className="bg-sol-azul text-white px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-80">{cerrada ? "CUADRE DE CAJA" : "CORTE PARCIAL"}</p>
                  <p className="font-extrabold">{caja.puntoNombre || caja.punto_venta || "Caja"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${cerrada ? "bg-white/20" : "bg-sol-amarillo text-sol-tinta"}`}>
                  {cerrada ? "Cerrada" : "Abierta"}
                </span>
              </div>

              <div className="p-5 grid sm:grid-cols-4 gap-3">
                <Metric label="Monto inicial" value={fmt(caja.monto_inicial)} />
                <Metric label="Ventas" value={fmt(resumen.totalVentas)} />
                <Metric label="Saldo esperado" value={fmt(resumen.saldoEsperado)} />
                <Metric label="Diferencia" value={cerrada ? fmt(caja.diferencia) : "En curso"} tone={Number(caja.diferencia || 0) < 0 ? "bad" : "good"} />
                <Metric label="Facturas" value={ventasCaja.length} />
                <Metric label="Utilidad estimada" value={fmt(utilidad)} tone={utilidad < 0 ? "bad" : "good"} />
              </div>

              <div className="px-5 pb-5 grid md:grid-cols-2 gap-4">
                <section className="border border-sol-borde rounded-lg overflow-hidden">
                  <h4 className="text-sm font-extrabold text-sol-tinta p-3 bg-sol-suave">Ventas por metodo</h4>
                  <div className="p-3 space-y-2 text-sm">
                    {!Object.keys(resumen.ventasPorMetodo || {}).length && <p className="text-sol-gris">Sin ventas registradas.</p>}
                    {Object.entries(resumen.ventasPorMetodo || {}).map(([metodo, monto]) => (
                      <div key={metodo} className="flex justify-between gap-3">
                        <span className="text-sol-gris">{metodo}</span>
                        <strong>{fmt(monto)}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border border-sol-borde rounded-lg overflow-hidden">
                  <h4 className="text-sm font-extrabold text-sol-tinta p-3 bg-sol-suave">Resumen efectivo</h4>
                  <div className="p-3 space-y-2 text-sm">
                    <Row label="Efectivo" value={resumen.efectivo} />
                    <Row label="Ingresos" value={resumen.ingresos} />
                    <Row label="Egresos" value={-Number(resumen.egresos || 0)} />
                    <Row label="Retiros" value={-Number(resumen.retiros || 0)} />
                  </div>
                </section>
              </div>

              <div className="px-5 pb-5">
                <h4 className="text-sm font-extrabold text-sol-tinta mb-2">Ventas de esta caja</h4>
                <div className="border border-sol-borde rounded-lg overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-sol-suave text-sol-gris">
                      <tr>
                        <th className="text-left p-2">Factura</th>
                        <th className="text-left p-2">Cliente</th>
                        <th className="text-left p-2">Pago</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">Utilidad est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasCaja.map((v) => (
                        <tr key={v.id || v.numero} className="border-t border-sol-borde">
                          <td className="p-2 font-bold">{v.numero || v.id}</td>
                          <td className="p-2 text-sol-gris">{v.cliente || "Consumidor final"}</td>
                          <td className="p-2 text-sol-gris">{v.pago || "Efectivo"}</td>
                          <td className="p-2 text-right font-bold">{fmt(v.total)}</td>
                          <td className="p-2 text-right font-bold">{fmt(utilidadVenta(v))}</td>
                        </tr>
                      ))}
                      {!ventasCaja.length && (
                        <tr><td colSpan="5" className="p-4 text-center text-sol-gris">Sin ventas registradas en esta caja.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-5 pb-5">
                <h4 className="text-sm font-extrabold text-sol-tinta mb-2">Productos vendidos</h4>
                <div className="border border-sol-borde rounded-lg overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-sol-suave text-sol-gris">
                      <tr>
                        <th className="text-left p-2">Producto</th>
                        <th className="text-right p-2">Cant.</th>
                        <th className="text-right p-2">Vendido</th>
                        <th className="text-right p-2">Costo est.</th>
                        <th className="text-right p-2">Utilidad est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.nombre} className="border-t border-sol-borde">
                          <td className="p-2 font-bold">{p.nombre}</td>
                          <td className="p-2 text-right">{p.cantidad}</td>
                          <td className="p-2 text-right">{fmt(p.total)}</td>
                          <td className="p-2 text-right">{fmt(p.costo)}</td>
                          <td className="p-2 text-right font-bold">{fmt(p.utilidad)}</td>
                        </tr>
                      ))}
                      {!productos.length && (
                        <tr><td colSpan="5" className="p-4 text-center text-sol-gris">Sin productos vendidos en esta caja.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-5 pb-5">
                <h4 className="text-sm font-extrabold text-sol-tinta mb-2">Movimientos recientes</h4>
                <div className="border border-sol-borde rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-sol-suave text-sol-gris">
                      <tr>
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-left p-2">Descripcion</th>
                        <th className="text-right p-2">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.slice(0, 10).map((m, i) => (
                        <tr key={`${m.tipo}-${i}`} className="border-t border-sol-borde">
                          <td className="p-2">{TIPO_LABEL[m.tipo] || m.tipo}</td>
                          <td className="p-2 text-sol-gris">{m.descripcion || "-"}</td>
                          <td className="p-2 text-right font-bold">{fmt(m.monto)}</td>
                        </tr>
                      ))}
                      {!movimientos.length && (
                        <tr><td colSpan="3" className="p-4 text-center text-sol-gris">Sin movimientos registrados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </div>

        <div className="flex gap-2 p-4 border-t border-sol-borde">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold border border-sol-borde text-sol-gris hover:bg-sol-suave">Cerrar</button>
          <button onClick={descargarPdf} disabled={descargando} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white flex items-center justify-center gap-1.5 bg-sol-azul hover:bg-sol-azulOsc disabled:opacity-50">
            <Download size={16} /> {descargando ? "Preparando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const color = tone === "bad" ? "text-sol-rojo" : tone === "good" ? "text-sol-exito" : "text-sol-tinta";
  return (
    <div className="rounded-lg border border-sol-borde p-3">
      <p className="text-xs font-bold text-sol-gris uppercase">{label}</p>
      <p className={`font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  const n = Number(value || 0);
  return (
    <div className="flex justify-between gap-3">
      <span className="text-sol-gris">{label}</span>
      <strong className={n < 0 ? "text-sol-rojo" : "text-sol-tinta"}>{fmt(n)}</strong>
    </div>
  );
}
