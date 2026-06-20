import { Download, X, CheckCircle2, Printer, Mail, MessageCircle, FileText, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import TicketTermicoPreview from "../TicketTermicoPreview";
import ErrorBoundary from "../ErrorBoundary";
import { EMPRESA, fmt } from "../../lib/format";
import { supabase, supabaseHabilitado } from "../../lib/supabaseClient";

const errorEdgeFunction = async (error) => {
  const respuesta = error?.context;
  if (respuesta && typeof respuesta.json === "function") {
    try {
      const body = await respuesta.clone().json();
      if (body?.error) return body.error;
    } catch {
      // el cuerpo no era JSON, se usa el mensaje generico
    }
  }
  return error?.message || "No se pudo enviar el correo";
};

const limpiarTelefono = (tel = "") => {
  const digitos = String(tel).replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("57")) return digitos;
  if (digitos.length === 10) return `57${digitos}`;
  return digitos;
};

const calcularTotales = (doc) => {
  const lineas = (doc.lineas || []).map((l) => {
    const bruto = Number(l.precio || 0) * Number(l.cantidad || 0);
    const descPct = Number(l.descuento) || 0;
    const descMonto = Math.round(bruto * (descPct / 100));
    return { ...l, bruto, descPct, descMonto, neto: bruto - descMonto };
  });
  const subtotalBruto = lineas.reduce((s, l) => s + l.bruto, 0);
  const descuentoItems = lineas.reduce((s, l) => s + l.descMonto, 0);
  const subtotalNeto = subtotalBruto - descuentoItems;
  const descuentoGlobalPct = Number(doc.descuentoGlobal) || 0;
  const descuentoGlobalMonto = Math.round(subtotalNeto * (descuentoGlobalPct / 100));
  const baseImponible = subtotalNeto - descuentoGlobalMonto;
  const descuentoTotal = descuentoItems + descuentoGlobalMonto;
  const impuestos = Math.round(baseImponible * (Number(doc.impuestoRate) || 0));
  const total = baseImponible + impuestos;
  return { lineas, subtotalBruto, descuentoTotal, baseImponible, impuestos, total };
};

const mensajeFactura = (doc) => {
  const tipo = doc.tipo === "FACTURA" ? "factura" : "cotizacion";
  return `Hola ${doc.cliente || "cliente"}, te compartimos tu ${tipo} ${doc.numero} de ${EMPRESA.nombre} por valor de ${fmt(calcularTotales(doc).total)}. Estado facturacion electronica: ${doc.estadoElectronico || "Pendiente de integracion DIAN"}.`;
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const btnBase = "flex-1 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnCerrar = `${btnBase} border border-sol-borde text-sol-gris bg-white hover:bg-sol-suave`;
const btnCorreo = `${btnBase} border border-[#2563EB]/25 text-[#1D4ED8] bg-[#2563EB]/10 hover:bg-[#2563EB]/15`;
const btnWhatsApp = `${btnBase} border border-[#25D366]/30 text-[#128C3A] bg-[#25D366]/12 hover:bg-[#25D366]/20`;
const btnAbrir = `${btnBase} border border-[#6B7280]/25 text-[#374151] bg-white hover:bg-sol-suave`;
const btnTicket = `${btnBase} border border-[#F58220]/35 text-[#A64B00] bg-[#F58220]/12 hover:bg-[#F58220]/20`;
const btnDescargar = `${btnBase} min-w-[140px] text-white bg-sol-azul hover:bg-sol-azulOsc`;

export default function DocumentoPreview({ doc, onClose }) {
  const [ticket, setTicket] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [pdfCache, setPdfCache] = useState({ blob: null, url: "" });

  const totales = useMemo(() => calcularTotales(doc || {}), [doc]);

  useEffect(() => () => {
    if (pdfCache.url) URL.revokeObjectURL(pdfCache.url);
  }, [pdfCache.url]);

  if (!doc) return null;
  const esFactura = doc.tipo === "FACTURA";
  const archivo = `${doc.tipo}-${doc.numero}.pdf`;
  const fecha = new Date(doc.fecha || Date.now());

  const generarPdf = async () => {
    if (pdfCache.blob && pdfCache.url) return pdfCache;
    const [{ pdf }, { default: DocumentoPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./DocumentoPDF"),
    ]);
    const blob = await pdf(<DocumentoPDF doc={doc} />).toBlob();
    const url = URL.createObjectURL(blob);
    setPdfCache((actual) => {
      if (actual.url) URL.revokeObjectURL(actual.url);
      return { blob, url };
    });
    return { blob, url };
  };

  const enviarCorreo = async () => {
    const correo = doc.clienteCorreo || window.prompt("Correo del cliente");
    if (!correo) return;
    if (!supabaseHabilitado) {
      const subject = encodeURIComponent(`${doc.tipo} ${doc.numero} - ${EMPRESA.nombre}`);
      const body = encodeURIComponent(`${mensajeFactura(doc)}\n\nPuedes descargar el PDF desde el sistema o solicitarlo al vendedor.\n\nGracias por tu compra.`);
      window.location.href = `mailto:${correo}?subject=${subject}&body=${body}`;
      return;
    }
    setEnviando(true);
    const t = toast.loading("Preparando PDF y enviando correo...");
    try {
      const { blob } = await generarPdf();
      const pdfBase64 = await blobToBase64(blob);
      const { error } = await supabase.functions.invoke("enviar-factura-email", {
        body: {
          to: correo,
          doc: { ...doc, fecha: fecha.toLocaleString("es-CO") },
          total: totales.total,
          fileName: archivo,
          pdfBase64,
        },
      });
      if (error) throw error;
      toast.success("Factura enviada por correo", { id: t });
    } catch (e) {
      toast.error(await errorEdgeFunction(e), { id: t });
    } finally {
      setEnviando(false);
    }
  };

  const enviarWhatsApp = () => {
    const telefono = limpiarTelefono(doc.clienteTelefono || window.prompt("WhatsApp del cliente"));
    if (!telefono) return;
    const ventana = window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensajeFactura(doc))}`, "_blank", "noopener,noreferrer");
    if (!ventana) {
      toast.error("El navegador bloqueo la ventana de WhatsApp. Permite las ventanas emergentes para este sitio e intenta de nuevo.");
    }
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

  const abrirPdf = async () => {
    setAbriendo(true);
    const t = toast.loading("Preparando PDF...");
    try {
      const { url } = await generarPdf();
      const ventana = window.open(url, "_blank", "noopener,noreferrer");
      if (!ventana) throw new Error("El navegador bloqueo la apertura del PDF. Permite ventanas emergentes para este sitio.");
      toast.success("PDF abierto", { id: t });
    } catch (e) {
      toast.error(e.message || "No se pudo abrir el PDF", { id: t });
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#141E32]/55" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden border border-sol-borde animar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-sol-borde">
          <div className="flex items-center gap-2">
            {esFactura ? <CheckCircle2 className="text-sol-exito" size={20} /> : <FileText className="text-sol-azul" size={20} />}
            <div>
              <h3 className="font-extrabold text-sol-tinta leading-tight">
                {esFactura ? "Factura generada" : "Vista previa de cotizacion"}
              </h3>
              <p className="text-xs text-sol-gris">{doc.numero} - {doc.cliente || "Consumidor final"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sol-suave"><X size={20} className="text-sol-gris" /></button>
        </div>

        <div className="flex-1 bg-sol-suave overflow-auto p-4">
          <ErrorBoundary>
            <div className="mx-auto max-w-2xl bg-white border border-sol-borde shadow-sm rounded-xl overflow-hidden">
              <div className="bg-sol-azul text-white px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {EMPRESA.logoUrl ? <img src={EMPRESA.logoUrl} alt="" className="w-12 h-12 rounded-lg bg-white object-contain p-1" /> : null}
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{EMPRESA.nombre}</p>
                    <p className="text-xs opacity-80">NIT {EMPRESA.nit}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs opacity-80">{esFactura ? "FACTURA" : "COTIZACION"}</p>
                  <p className="font-extrabold">{doc.numero}</p>
                </div>
              </div>

              <div className="p-5 grid sm:grid-cols-3 gap-3 text-sm border-b border-sol-borde">
                <div>
                  <p className="text-xs font-bold text-sol-gris uppercase">Cliente</p>
                  <p className="font-bold text-sol-tinta">{doc.cliente || "Consumidor final"}</p>
                  {doc.clienteDocumento ? <p className="text-xs text-sol-gris">{doc.clienteDocumento}</p> : null}
                </div>
                <div>
                  <p className="text-xs font-bold text-sol-gris uppercase">Fecha</p>
                  <p className="font-bold text-sol-tinta">{fecha.toLocaleDateString("es-CO")}</p>
                  <p className="text-xs text-sol-gris">{fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-sol-gris uppercase">Local / pago</p>
                  <p className="font-bold text-sol-tinta">{doc.puntoVenta || "Punto de venta"}</p>
                  <p className="text-xs text-sol-gris">{doc.pago || "No aplica"}</p>
                </div>
              </div>

              <div className="p-5">
                <div className="overflow-auto border border-sol-borde rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-sol-suave text-sol-gris">
                      <tr>
                        <th className="text-left p-2">Producto</th>
                        <th className="text-center p-2">Cant.</th>
                        <th className="text-right p-2">Unitario</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totales.lineas.map((l, i) => (
                        <tr key={`${l.nombre}-${i}`} className="border-t border-sol-borde">
                          <td className="p-2">
                            <p className="font-bold text-sol-tinta">{l.nombre}</p>
                            {l.descPct ? <p className="text-xs text-sol-rojo">Descuento {l.descPct}%: -{fmt(l.descMonto)}</p> : null}
                            {l.nota ? <p className="text-xs text-sol-gris">{l.nota}</p> : null}
                          </td>
                          <td className="p-2 text-center">{l.cantidad}</td>
                          <td className="p-2 text-right">{fmt(l.precio)}</td>
                          <td className="p-2 text-right font-bold">{fmt(l.neto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-sol-gris">Subtotal</span><strong>{fmt(totales.subtotalBruto)}</strong></div>
                  <div className="flex justify-between"><span className="text-sol-gris">Descuentos</span><strong>-{fmt(totales.descuentoTotal)}</strong></div>
                  <div className="flex justify-between"><span className="text-sol-gris">Impuestos</span><strong>{fmt(totales.impuestos)}</strong></div>
                  <div className="flex justify-between border-t border-sol-borde pt-2 text-lg"><span className="font-extrabold">Total</span><strong className="text-sol-azul">{fmt(totales.total)}</strong></div>
                </div>

                <div className="mt-5 rounded-lg bg-sol-suave p-3 text-xs text-sol-gris">
                  Estado facturacion electronica: {doc.estadoElectronico || (esFactura ? "Pendiente de integracion DIAN" : "No aplica")}.
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </div>

        <div className="flex gap-2 p-4 border-t border-sol-borde flex-wrap bg-white">
          <button onClick={onClose} className={btnCerrar}>Cerrar</button>
          <button onClick={enviarCorreo} disabled={enviando || descargando || abriendo} className={btnCorreo}>
            <Mail size={16} /> {enviando ? "Enviando..." : "Correo"}
          </button>
          <button onClick={enviarWhatsApp} className={btnWhatsApp}>
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button onClick={abrirPdf} disabled={abriendo || descargando || enviando} className={btnAbrir}>
            <ExternalLink size={16} /> {abriendo ? "Abriendo..." : "Abrir"}
          </button>
          <button onClick={() => setTicket(true)} className={btnTicket}>
            <Printer size={16} /> Ticket termico
          </button>
          <button onClick={descargarPdf} disabled={descargando || abriendo || enviando} className={btnDescargar}>
            <Download size={16} /> {descargando ? "Preparando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
      {ticket && <TicketTermicoPreview doc={doc} onClose={() => setTicket(false)} />}
    </div>
  );
}
