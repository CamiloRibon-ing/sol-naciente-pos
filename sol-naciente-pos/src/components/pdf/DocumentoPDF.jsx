import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EMPRESA, IMPUESTO } from "../../lib/format";
import { COL, peso, createPdfStyles, PdfHeader, PdfFooter } from "../../lib/pdf";

const s = createPdfStyles({
  badgeCot: { backgroundColor: "#fff", color: COL.azulOsc, fontSize: 9, fontFamily: "Helvetica-Bold", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  cDesc: { width: "46%", paddingHorizontal: 4 },
  cCant: { width: "12%", textAlign: "center" },
  cUnit: { width: "21%", textAlign: "right", paddingRight: 4 },
  cTot: { width: "21%", textAlign: "right", paddingRight: 4 },
  cNota: { fontSize: 7, color: COL.gris, marginTop: 1 },
  totales: { marginTop: 12, marginLeft: "auto", width: 220 },
  nota: { marginTop: 24, padding: 10, backgroundColor: COL.crema, borderRadius: 8, color: COL.gris, fontSize: 8 },
  qrBox: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  qrWrap: { marginRight: 8 },
  qrTxt: { fontSize: 7, color: COL.gris, maxWidth: 160 },
  fiscalBox: { marginTop: 12, padding: 10, borderWidth: 0.5, borderColor: COL.borde, borderRadius: 8, backgroundColor: "#fff" },
  fiscalTitle: { fontSize: 8, color: COL.azul, fontFamily: "Helvetica-Bold", marginBottom: 4, textTransform: "uppercase" },
  fiscalText: { fontSize: 7.5, color: COL.gris, marginTop: 2 },
});

export default function DocumentoPDF({ doc }) {
  const esFactura = doc.tipo === "FACTURA";
  const lineas = (doc.lineas || []).map((l) => {
    const bruto = Number(l.precio || 0) * Number(l.cantidad || 0);
    const descPct = Number(l.descuento) || 0;
    const descMonto = Math.round(bruto * (descPct / 100));
    return { ...l, bruto, descPct, descMonto, neto: bruto - descMonto };
  });
  const subtotalBruto = lineas.reduce((a, l) => a + l.bruto, 0);
  const descuentoItems = lineas.reduce((a, l) => a + l.descMonto, 0);
  const subtotalNeto = subtotalBruto - descuentoItems;
  const descuentoGlobalPct = Number(doc.descuentoGlobal) || 0;
  const descuentoGlobalMonto = Math.round(subtotalNeto * (descuentoGlobalPct / 100));
  const baseImponible = subtotalNeto - descuentoGlobalMonto;
  const descuentoTotal = descuentoItems + descuentoGlobalMonto;
  const impuestoRate = Number(doc.impuestoRate ?? IMPUESTO) || 0;
  const imp = Math.round(baseImponible * impuestoRate);
  const total = baseImponible + imp;
  const fecha = new Date(doc.fecha || Date.now());
  const estadoElectronico = doc.estadoElectronico || (esFactura ? "Pendiente de integracion DIAN" : "No aplica");
  const cufe = doc.cufe || "Pendiente";

  return (
    <Document title={`${doc.tipo} ${doc.numero}`} author={EMPRESA.nombre}>
      <Page size="A4" style={s.page}>
        <PdfHeader s={s} badge={esFactura ? "FACTURA DE VENTA" : "COTIZACIÓN"} badgeStyle={esFactura ? s.badge : s.badgeCot} />

        <View style={s.meta}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Cliente</Text>
            <Text style={s.metaVal}>{doc.cliente || "Consumidor final"}</Text>
            {doc.clienteDocumento ? <Text style={s.cNota}>NIT / Documento: {doc.clienteDocumento}</Text> : null}
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Número</Text>
            <Text style={s.metaVal}>{doc.numero}</Text>
            {doc.puntoVenta ? <Text style={s.cNota}>Local: {doc.puntoVenta}</Text> : null}
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Fecha</Text>
            <Text style={s.metaVal}>{fecha.toLocaleDateString("es-CO")} {fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</Text>
          </View>
          {esFactura && (
            <View style={s.metaBox}>
              <Text style={s.metaLabel}>Pago</Text>
              <Text style={s.metaVal}>{doc.pago}</Text>
            </View>
          )}
        </View>

        <View style={s.tHead}>
          <Text style={[s.cDesc, s.th]}>Descripción</Text>
          <Text style={[s.cCant, s.th]}>Cant</Text>
          <Text style={[s.cUnit, s.th]}>V. Unitario</Text>
          <Text style={[s.cTot, s.th]}>Total</Text>
        </View>
        {lineas.map((l, i) => (
          <View style={s.tRow} key={i}>
            <View style={s.cDesc}>
              <Text>{l.nombre}</Text>
              {l.nota ? <Text style={s.cNota}>Obs: {l.nota}</Text> : null}
              {l.descPct > 0 && <Text style={s.cNota}>Descuento {l.descPct}% (- {peso(l.descMonto)})</Text>}
            </View>
            <Text style={s.cCant}>{l.cantidad}</Text>
            <Text style={s.cUnit}>{peso(l.precio)}</Text>
            <Text style={s.cTot}>{peso(l.neto)}</Text>
          </View>
        ))}

        <View style={s.totales}>
          <View style={s.totRow}><Text style={s.totLabel}>Subtotal</Text><Text>{peso(subtotalBruto)}</Text></View>
          {descuentoTotal > 0 && (
            <View style={s.totRow}><Text style={s.totLabel}>Descuentos</Text><Text>- {peso(descuentoTotal)}</Text></View>
          )}
          <View style={s.totRow}><Text style={s.totLabel}>Impoconsumo ({Math.round(impuestoRate * 100)}%)</Text><Text>{peso(imp)}</Text></View>
          <View style={s.granTotal}><Text style={s.granTotalTxt}>TOTAL</Text><Text style={s.granTotalTxt}>{peso(total)}</Text></View>
        </View>

        <View style={s.nota}>
          <Text>
            {esFactura
              ? "Gracias por visitar el Centro Recreacional Sol Naciente. Documento equivalente de venta."
              : "Cotización válida por 8 días a partir de la fecha de emisión. Los precios pueden variar sin previo aviso. Este documento no constituye factura de venta."}
          </Text>
          {esFactura && EMPRESA.resolucionDian ? <Text style={{ marginTop: 4 }}>{EMPRESA.resolucionDian}</Text> : null}
        </View>

        {esFactura && (
          <View style={s.fiscalBox}>
            <Text style={s.fiscalTitle}>Informacion de facturacion electronica</Text>
            <Text style={s.fiscalText}>Estado: {estadoElectronico}</Text>
            <Text style={s.fiscalText}>CUFE/CUDE: {cufe}</Text>
            <Text style={s.fiscalText}>Proveedor DIAN: pendiente de configuracion. Este espacio queda listo para la futura validacion electronica.</Text>
          </View>
        )}

        <View style={s.qrBox}>
          <View style={s.qrWrap}><View style={s.qr} /></View>
          <Text style={s.qrTxt}>Espacio reservado para código QR de verificación del documento (próximamente).</Text>
        </View>

        <PdfFooter s={s} />
      </Page>
    </Document>
  );
}
