import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EMPRESA } from "../../lib/format";
import { COL, peso, fechaCorta as fecha, createPdfStyles, PdfHeader, PdfFooter } from "../../lib/pdf";

const s = createPdfStyles({
  cDesc: { width: "70%", paddingHorizontal: 4 },
  cMonto: { width: "30%", textAlign: "right", paddingRight: 4 },
  totales: { marginTop: 4, marginLeft: "auto", width: 240 },
});

export default function NominaPDF({ liquidacion }) {
  const { empleado, periodo, diasTrabajados, conceptos, totalDevengado, totalDeducciones, netoPagar, montoPagado = 0, saldoPendiente = Math.max(0, Number(netoPagar || 0) - Number(montoPagado || 0)), fechaPago } = liquidacion;
  const devengados = conceptos.filter((c) => c.tipo === "devengado");
  const deducciones = conceptos.filter((c) => c.tipo === "deduccion");

  return (
    <Document title={`Comprobante de pago - ${empleado.nombre}`} author={EMPRESA.nombre}>
      <Page size="A4" style={s.page}>
        <PdfHeader s={s} badge="COMPROBANTE DE PAGO" />

        <View style={s.meta}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Empleado</Text>
            <Text style={s.metaVal}>{empleado.nombre}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Documento</Text>
            <Text style={s.metaVal}>{empleado.documento || "—"}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Cargo</Text>
            <Text style={s.metaVal}>{empleado.cargo || "—"}</Text>
          </View>
        </View>

        <View style={s.meta}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Período</Text>
            <Text style={s.metaVal}>{periodo.nombre}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Fechas</Text>
            <Text style={s.metaVal}>{fecha(periodo.fechaInicio)} – {fecha(periodo.fechaFin)}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Días trabajados</Text>
            <Text style={s.metaVal}>{diasTrabajados ?? "—"}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Fecha de pago</Text>
            <Text style={s.metaVal}>{fecha(fechaPago)}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Devengados</Text>
        <View style={s.tHead}>
          <Text style={[s.cDesc, s.th]}>Concepto</Text>
          <Text style={[s.cMonto, s.th]}>Valor</Text>
        </View>
        {devengados.map((c, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cDesc}>{c.nombre}</Text>
            <Text style={s.cMonto}>{peso(c.valor)}</Text>
          </View>
        ))}
        {!devengados.length && <Text style={{ color: COL.gris, marginTop: 4 }}>Sin devengados registrados.</Text>}

        <Text style={s.seccion}>Deducciones</Text>
        <View style={s.tHead}>
          <Text style={[s.cDesc, s.th]}>Concepto</Text>
          <Text style={[s.cMonto, s.th]}>Valor</Text>
        </View>
        {deducciones.map((c, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cDesc}>{c.nombre}</Text>
            <Text style={s.cMonto}>{peso(c.valor)}</Text>
          </View>
        ))}
        {!deducciones.length && <Text style={{ color: COL.gris, marginTop: 4 }}>Sin deducciones registradas.</Text>}

        <View style={s.totales}>
          <View style={s.totRow}><Text style={s.totLabel}>Total devengado</Text><Text>{peso(totalDevengado)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Total deducciones</Text><Text>- {peso(totalDeducciones)}</Text></View>
          <View style={s.granTotal}><Text style={s.granTotalTxt}>NETO A PAGAR</Text><Text style={s.granTotalTxt}>{peso(netoPagar)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Pagado</Text><Text>{peso(montoPagado)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Saldo pendiente</Text><Text>{peso(saldoPendiente)}</Text></View>
        </View>

        <PdfFooter s={s} />
      </Page>
    </Document>
  );
}
