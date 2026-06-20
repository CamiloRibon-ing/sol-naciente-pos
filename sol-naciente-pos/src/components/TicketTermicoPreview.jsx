import { Printer, X } from "lucide-react";
import { EMPRESA, IMPUESTO, fmt } from "../lib/format";

const calcLineas = (doc) => (doc.lineas || []).map((l) => {
  const bruto = Number(l.precio) * Number(l.cantidad);
  const descPct = Number(l.descuento) || 0;
  const descMonto = Math.round(bruto * (descPct / 100));
  return { ...l, bruto, descPct, descMonto, neto: bruto - descMonto };
});

const calcTotales = (doc) => {
  const lineas = calcLineas(doc);
  const subtotalBruto = lineas.reduce((s, l) => s + l.bruto, 0);
  const descuentoItems = lineas.reduce((s, l) => s + l.descMonto, 0);
  const subtotalNeto = subtotalBruto - descuentoItems;
  const descuentoGlobalMonto = Math.round(subtotalNeto * ((Number(doc.descuentoGlobal) || 0) / 100));
  const base = subtotalNeto - descuentoGlobalMonto;
  const impuestoRate = Number(doc.impuestoRate ?? IMPUESTO) || 0;
  const impuestos = Math.round(base * impuestoRate);
  return { lineas, subtotalBruto, descuentos: descuentoItems + descuentoGlobalMonto, impuestos, total: base + impuestos, impuestoRate };
};

const btnBase = "flex-1 rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-1.5 transition";
const btnCerrar = `${btnBase} border border-sol-borde text-sol-gris bg-white hover:bg-sol-suave`;
const btnImprimir = `${btnBase} text-white bg-[#F58220] hover:bg-[#D96D12]`;

export default function TicketTermicoPreview({ doc, onClose }) {
  const fecha = new Date(doc.fecha || Date.now());
  const { lineas, subtotalBruto, descuentos, impuestos, total, impuestoRate } = calcTotales(doc);
  const pagos = doc.pagos?.length ? doc.pagos : [{ metodo: doc.pago || "Efectivo", monto: total }];
  const esCotizacion = doc.tipo === "COTIZACION";
  const estadoElectronico = doc.estadoElectronico || (esCotizacion ? "No aplica" : "Pendiente de integracion DIAN");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-[#141E32]/55" onClick={onClose}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ticket-termico, #ticket-termico * { visibility: visible !important; }
          #ticket-termico { position: absolute; left: 0; top: 0; width: 80mm; box-shadow: none !important; border: none !important; }
          .ticket-actions { display: none !important; }
          @page { size: 80mm auto; margin: 4mm; }
        }
      `}</style>
      <div className="bg-white rounded-2xl border border-sol-borde w-full max-w-sm overflow-hidden animar" onClick={(e) => e.stopPropagation()}>
        <div className="ticket-actions flex items-center justify-between p-3 border-b border-sol-borde">
          <div>
            <h3 className="font-extrabold text-sm">Ticket termico</h3>
            <p className="text-xs text-sol-gris">{doc.numero} - {doc.puntoVenta || "Local"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sol-suave"><X size={18} className="text-sol-gris" /></button>
        </div>

        <div id="ticket-termico" className="mx-auto bg-white text-black p-4 font-mono text-[11px] leading-tight">
          <div className="text-center">
            <div className="font-black text-[14px] uppercase">{EMPRESA.nombre}</div>
            <div>NIT: {EMPRESA.nit}</div>
            <div>{EMPRESA.direccion}</div>
            <div>Tel: {EMPRESA.telefono}</div>
          </div>

          <div className="border-t border-dashed border-black my-2" />
          <div className="text-center font-black">{esCotizacion ? "COTIZACION" : "TICKET DE VENTA"}</div>
          <div>No: {doc.numero}</div>
          <div>Fecha: {fecha.toLocaleDateString("es-CO")} {fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</div>
          <div>Local: {doc.puntoVenta || "-"}</div>
          <div>Cliente: {doc.cliente || "Consumidor final"}</div>
          {doc.clienteDocumento && <div>Doc/NIT: {doc.clienteDocumento}</div>}

          <div className="border-t border-dashed border-black my-2" />
          {lineas.map((l, i) => (
            <div key={i} className="mb-1">
              <div className="font-bold uppercase break-words">{l.nombre}</div>
              <div className="flex justify-between gap-2">
                <span>{l.cantidad} x {fmt(l.precio)}</span>
                <span>{fmt(l.neto)}</span>
              </div>
              {l.descPct > 0 && <div>Desc {l.descPct}%: -{fmt(l.descMonto)}</div>}
              {l.nota && <div>Obs: {l.nota}</div>}
            </div>
          ))}

          <div className="border-t border-dashed border-black my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotalBruto)}</span></div>
          {descuentos > 0 && <div className="flex justify-between"><span>Descuentos</span><span>-{fmt(descuentos)}</span></div>}
          <div className="flex justify-between"><span>Impoconsumo {Math.round(impuestoRate * 100)}%</span><span>{fmt(impuestos)}</span></div>
          <div className="flex justify-between font-black text-[13px] mt-1"><span>TOTAL</span><span>{fmt(total)}</span></div>

          <div className="border-t border-dashed border-black my-2" />
          {pagos.map((p, i) => <div key={i} className="flex justify-between"><span>{p.metodo}</span><span>{fmt(p.monto)}</span></div>)}

          <div className="border-t border-dashed border-black my-2" />
          <div>Facturacion electronica: {estadoElectronico}</div>
          {!esCotizacion && <div>CUFE/QR: pendiente de proveedor DIAN</div>}
          <div className="text-center mt-2">Gracias por su compra</div>
          <div className="text-center">Conserve este comprobante</div>
        </div>

        <div className="ticket-actions flex gap-2 p-3 border-t border-sol-borde bg-white">
          <button onClick={onClose} className={btnCerrar}>Cerrar</button>
          <button onClick={() => window.print()} className={btnImprimir}>
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
