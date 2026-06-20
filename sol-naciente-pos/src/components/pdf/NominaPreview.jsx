import { useEffect, useMemo, useState } from "react";
import { Download, Mail, MessageCircle, X, Users } from "lucide-react";
import toast from "react-hot-toast";
import ErrorBoundary from "../ErrorBoundary";
import { EMPRESA, fmt } from "../../lib/format";
import { supabase, supabaseHabilitado } from "../../lib/supabaseClient";

const limpiarTelefono = (tel = "") => {
  const digitos = String(tel).replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("57")) return digitos;
  if (digitos.length === 10) return `57${digitos}`;
  return digitos;
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const mensajeNomina = (liquidacion) => {
  const saldo = liquidacion.saldoPendiente ?? Math.max(0, Number(liquidacion.netoPagar || 0) - Number(liquidacion.montoPagado || 0));
  return `Hola ${liquidacion.empleado.nombre}, te compartimos tu comprobante de nomina ${liquidacion.periodo.nombre} de ${EMPRESA.nombre}. Neto: ${fmt(liquidacion.netoPagar)}. Pagado: ${fmt(liquidacion.montoPagado || 0)}. Saldo pendiente: ${fmt(saldo)}.`;
};

const btnBase = "flex-1 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnCerrar = `${btnBase} border border-sol-borde text-sol-gris bg-white hover:bg-sol-suave`;
const btnCorreo = `${btnBase} border border-[#2563EB]/25 text-[#1D4ED8] bg-[#2563EB]/10 hover:bg-[#2563EB]/15`;
const btnWhatsApp = `${btnBase} border border-[#25D366]/30 text-[#128C3A] bg-[#25D366]/12 hover:bg-[#25D366]/20`;
const btnDescargar = `${btnBase} text-white bg-sol-azul hover:bg-sol-azulOsc`;

export default function NominaPreview({ liquidacion, onClose }) {
  const [descargando, setDescargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pdfCache, setPdfCache] = useState({ blob: null, url: "" });
  const { empleado, periodo } = liquidacion;
  const archivo = `comprobante-${empleado.nombre.replace(/\s+/g, "-").toLowerCase()}-${periodo.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  const conceptos = liquidacion.conceptos || [];
  const devengados = useMemo(() => conceptos.filter((c) => c.tipo === "devengado"), [conceptos]);
  const deducciones = useMemo(() => conceptos.filter((c) => c.tipo === "deduccion"), [conceptos]);

  useEffect(() => () => {
    if (pdfCache.url) URL.revokeObjectURL(pdfCache.url);
  }, [pdfCache.url]);

  const generarPdf = async () => {
    if (pdfCache.blob && pdfCache.url) return pdfCache;
    const [{ pdf }, { default: NominaPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./NominaPDF"),
    ]);
    const blob = await pdf(<NominaPDF liquidacion={liquidacion} />).toBlob();
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

  const enviarCorreo = async () => {
    const correo = empleado.correo || window.prompt("Correo del trabajador");
    if (!correo) return;
    if (!supabaseHabilitado) {
      const subject = encodeURIComponent(`Comprobante de nomina ${periodo.nombre} - ${EMPRESA.nombre}`);
      const body = encodeURIComponent(mensajeNomina(liquidacion));
      window.location.href = `mailto:${correo}?subject=${subject}&body=${body}`;
      return;
    }
    setEnviando(true);
    const t = toast.loading("Preparando comprobante y enviando correo...");
    try {
      const { blob } = await generarPdf();
      const pdfBase64 = await blobToBase64(blob);
      const saldo = liquidacion.saldoPendiente ?? Math.max(0, Number(liquidacion.netoPagar || 0) - Number(liquidacion.montoPagado || 0));
      const { error } = await supabase.functions.invoke("enviar-factura-email", {
        body: {
          to: correo,
          doc: {
            tipo: "Comprobante de nomina",
            contexto: "nomina",
            numero: periodo.nombre,
            periodo: `${periodo.nombre} (${periodo.fechaInicio} a ${periodo.fechaFin})`,
            empleado: empleado.nombre,
            cliente: empleado.nombre,
            fecha: new Date().toLocaleString("es-CO"),
            montoPagado: Number(liquidacion.montoPagado || 0),
            saldoPendiente: saldo,
          },
          total: liquidacion.netoPagar,
          fileName: archivo,
          pdfBase64,
        },
      });
      if (error) throw error;
      toast.success("Comprobante enviado por correo", { id: t });
    } catch (e) {
      toast.error(e.message || "No se pudo enviar el comprobante", { id: t });
    } finally {
      setEnviando(false);
    }
  };

  const enviarWhatsApp = () => {
    const telefono = limpiarTelefono(empleado.telefono || window.prompt("WhatsApp del trabajador"));
    if (!telefono) return;
    const ventana = window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensajeNomina(liquidacion))}`, "_blank", "noopener,noreferrer");
    if (!ventana) toast.error("El navegador bloqueo la ventana de WhatsApp. Permite ventanas emergentes e intenta de nuevo.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#141E32]/55" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden border border-sol-borde animar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-sol-borde">
          <div className="flex items-center gap-2">
            <Users className="text-sol-azul" size={20} />
            <div>
              <h3 className="font-extrabold text-sol-tinta leading-tight">Comprobante de pago</h3>
              <p className="text-xs text-sol-gris">{empleado.nombre} - {periodo.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sol-suave"><X size={20} className="text-sol-gris" /></button>
        </div>

        <div className="flex-1 bg-sol-suave overflow-auto p-4">
          <ErrorBoundary>
            <div className="mx-auto max-w-2xl bg-white border border-sol-borde shadow-sm rounded-xl overflow-hidden">
              <div className="bg-sol-azul text-white px-5 py-4">
                <p className="text-xs opacity-80">COMPROBANTE DE PAGO</p>
                <p className="font-extrabold">{empleado.nombre}</p>
              </div>

              <div className="p-5 grid sm:grid-cols-4 gap-3">
                <Metric label="Documento" value={empleado.documento || "-"} />
                <Metric label="Cargo" value={empleado.cargo || "-"} />
                <Metric label="Periodo" value={periodo.nombre} />
                <Metric label="Dias" value={liquidacion.diasTrabajados ?? "-"} />
              </div>

              <div className="px-5 pb-5 grid md:grid-cols-2 gap-4">
                <Conceptos title="Devengados" items={devengados} />
                <Conceptos title="Deducciones" items={deducciones} danger />
              </div>

              <div className="px-5 pb-5">
                <div className="ml-auto max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-sol-gris">Total devengado</span><strong>{fmt(liquidacion.totalDevengado)}</strong></div>
                  <div className="flex justify-between"><span className="text-sol-gris">Deducciones</span><strong className="text-sol-rojo">-{fmt(liquidacion.totalDeducciones)}</strong></div>
                  <div className="flex justify-between border-t border-sol-borde pt-2 text-lg"><span className="font-extrabold">Neto a pagar</span><strong className="text-sol-azul">{fmt(liquidacion.netoPagar)}</strong></div>
                  <div className="flex justify-between"><span className="text-sol-gris">Pagado</span><strong className="text-sol-exito">{fmt(liquidacion.montoPagado || 0)}</strong></div>
                  <div className="flex justify-between"><span className="text-sol-gris">Saldo pendiente</span><strong className="text-sol-rojo">{fmt(liquidacion.saldoPendiente ?? Math.max(0, Number(liquidacion.netoPagar || 0) - Number(liquidacion.montoPagado || 0)))}</strong></div>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </div>

        <div className="flex gap-2 p-4 border-t border-sol-borde flex-wrap bg-white">
          <button onClick={onClose} className={btnCerrar}>Cerrar</button>
          <button onClick={enviarCorreo} disabled={enviando || descargando} className={btnCorreo}>
            <Mail size={16} /> {enviando ? "Enviando..." : "Correo"}
          </button>
          <button onClick={enviarWhatsApp} className={btnWhatsApp}>
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button onClick={descargarPdf} disabled={descargando || enviando} className={btnDescargar}>
            <Download size={16} /> {descargando ? "Preparando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-sol-borde p-3">
      <p className="text-xs font-bold text-sol-gris uppercase">{label}</p>
      <p className="font-extrabold text-sol-tinta truncate">{value}</p>
    </div>
  );
}

function Conceptos({ title, items, danger }) {
  return (
    <section className="border border-sol-borde rounded-lg overflow-hidden">
      <h4 className="text-sm font-extrabold text-sol-tinta p-3 bg-sol-suave">{title}</h4>
      <div className="p-3 space-y-2 text-sm">
        {!items.length && <p className="text-sol-gris">Sin registros.</p>}
        {items.map((c, i) => (
          <div key={`${c.nombre}-${i}`} className="flex justify-between gap-3">
            <span className="text-sol-gris">{c.nombre}</span>
            <strong className={danger ? "text-sol-rojo" : "text-sol-tinta"}>{fmt(c.valor)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
