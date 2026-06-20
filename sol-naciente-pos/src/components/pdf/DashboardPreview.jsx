import { useEffect, useState } from "react";
import { Download, X, LayoutDashboard } from "lucide-react";
import toast from "react-hot-toast";
import ErrorBoundary from "../ErrorBoundary";
import { fmt } from "../../lib/format";

export default function DashboardPreview({ reporte, onClose }) {
  const [descargando, setDescargando] = useState(false);
  const [pdfCache, setPdfCache] = useState({ blob: null, url: "" });
  const archivo = `reporte-${new Date(reporte.desde).toISOString().slice(0, 10)}_a_${new Date(reporte.hasta).toISOString().slice(0, 10)}.pdf`;

  useEffect(() => () => {
    if (pdfCache.url) URL.revokeObjectURL(pdfCache.url);
  }, [pdfCache.url]);

  const generarPdf = async () => {
    if (pdfCache.blob && pdfCache.url) return pdfCache;
    const [{ pdf }, { default: DashboardPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./DashboardPDF"),
    ]);
    const blob = await pdf(<DashboardPDF reporte={reporte} />).toBlob();
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
            <LayoutDashboard className="text-sol-azul" size={20} />
            <div>
              <h3 className="font-extrabold text-sol-tinta leading-tight">Reporte del periodo</h3>
              <p className="text-xs text-sol-gris">{reporte.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sol-suave"><X size={20} className="text-sol-gris" /></button>
        </div>

        <div className="flex-1 bg-sol-suave overflow-auto p-4">
          <ErrorBoundary>
            <div className="mx-auto max-w-2xl bg-white border border-sol-borde shadow-sm rounded-xl overflow-hidden">
              <div className="bg-sol-azul text-white px-5 py-4">
                <p className="text-xs opacity-80">REPORTE CONTABLE</p>
                <p className="font-extrabold">{reporte.label}</p>
              </div>

              <div className="p-5 grid sm:grid-cols-3 gap-3">
                <Metric label="Ingresos" value={fmt(reporte.ingresos)} />
                <Metric label="Utilidad bruta" value={fmt(reporte.utilidadBruta)} />
                <Metric label="Utilidad neta" value={fmt(reporte.utilidadNeta)} tone={reporte.utilidadNeta < 0 ? "bad" : "good"} />
                <Metric label="Costo ventas" value={fmt(reporte.costoVentas)} />
                <Metric label="Gastos" value={fmt(reporte.gastos)} />
                <Metric label="Nomina" value={fmt(reporte.nomina)} />
              </div>

              <div className="px-5 pb-5">
                <h4 className="text-sm font-extrabold text-sol-tinta mb-2">Ingresos por categoria</h4>
                <div className="border border-sol-borde rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-sol-suave text-sol-gris">
                      <tr>
                        <th className="text-left p-2">Categoria</th>
                        <th className="text-right p-2">Ingresos</th>
                        <th className="text-right p-2">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reporte.cats || []).slice(0, 8).map((c, i) => (
                        <tr key={`${c.name}-${i}`} className="border-t border-sol-borde">
                          <td className="p-2 font-bold text-sol-tinta">{c.name}</td>
                          <td className="p-2 text-right">{fmt(c.ingresos)}</td>
                          <td className="p-2 text-right">{c.margen}%</td>
                        </tr>
                      ))}
                      {!reporte.cats?.length && <tr><td colSpan="3" className="p-4 text-center text-sol-gris">Sin ventas en el periodo.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-5 pb-5">
                <h4 className="text-sm font-extrabold text-sol-tinta mb-2">Top productos</h4>
                <div className="grid gap-2">
                  {(reporte.top || []).slice(0, 6).map((p, i) => (
                    <div key={`${p.name}-${i}`} className="flex justify-between gap-3 rounded-lg border border-sol-borde p-3 text-sm">
                      <span className="font-bold text-sol-tinta">{p.name}</span>
                      <strong>{fmt(p.total)}</strong>
                    </div>
                  ))}
                  {!reporte.top?.length && <p className="text-sm text-sol-gris text-center p-4">Sin productos vendidos.</p>}
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
