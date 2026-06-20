import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EMPRESA } from "../../lib/format";
import { COL, peso, fechaCorta, createPdfStyles, PdfHeader, PdfFooter } from "../../lib/pdf";

const s = createPdfStyles({
  cCat: { width: "34%", paddingHorizontal: 4 },
  cIng: { width: "22%", textAlign: "right", paddingRight: 4 },
  cCosto: { width: "22%", textAlign: "right", paddingRight: 4 },
  cMargen: { width: "22%", textAlign: "right", paddingRight: 4 },
  cProd: { width: "70%", paddingHorizontal: 4 },
  cTot: { width: "30%", textAlign: "right", paddingRight: 4 },
  totales: { marginTop: 4, marginLeft: "auto", width: 260 },
  utilNeg: { fontFamily: "Helvetica-Bold", fontSize: 12, color: COL.rojo },
});

// Reporte contable del período seleccionado en el Dashboard, con logo y desglose por categoría.
export default function DashboardPDF({ reporte }) {
  const { label, desde, hasta, ingresos, costoVentas, utilidadBruta, gastos, nomina, utilidadNeta, cats, top } = reporte;
  const utilidadNegativa = utilidadNeta < 0;

  return (
    <Document title={`Reporte del período - ${label}`} author={EMPRESA.nombre}>
      <Page size="A4" style={s.page}>
        <PdfHeader s={s} badge="REPORTE DEL PERÍODO" />

        <View style={s.meta}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Período</Text>
            <Text style={s.metaVal}>{label}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Desde</Text>
            <Text style={s.metaVal}>{fechaCorta(desde)}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Hasta</Text>
            <Text style={s.metaVal}>{fechaCorta(hasta)}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Generado</Text>
            <Text style={s.metaVal}>{fechaCorta(new Date())}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Ingresos por categoría</Text>
        <View style={s.tHead}>
          <Text style={[s.cCat, s.th]}>Categoría</Text>
          <Text style={[s.cIng, s.th]}>Ingresos</Text>
          <Text style={[s.cCosto, s.th]}>Costo ventas</Text>
          <Text style={[s.cMargen, s.th]}>Margen</Text>
        </View>
        {!cats.length && <Text style={{ color: COL.gris, marginTop: 4 }}>Sin ventas registradas en el período.</Text>}
        {cats.map((c, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cCat}>{c.name}</Text>
            <Text style={s.cIng}>{peso(c.ingresos)}</Text>
            <Text style={s.cCosto}>{peso(c.costo)}</Text>
            <Text style={s.cMargen}>{c.margen}%</Text>
          </View>
        ))}

        <Text style={s.seccion}>Estado de resultados del período</Text>
        <View style={s.totales}>
          <View style={s.totRow}><Text style={s.totLabel}>Ingresos totales</Text><Text>{peso(ingresos)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Costo de ventas</Text><Text>- {peso(costoVentas)}</Text></View>
          <View style={s.granTotal}><Text style={s.granTotalTxt}>Utilidad bruta</Text><Text style={s.granTotalTxt}>{peso(utilidadBruta)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Gastos operativos</Text><Text>- {peso(gastos)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Costo de nómina</Text><Text>- {peso(nomina)}</Text></View>
          <View style={s.granTotal}>
            <Text style={utilidadNegativa ? s.utilNeg : s.granTotalTxt}>Utilidad neta</Text>
            <Text style={utilidadNegativa ? s.utilNeg : s.granTotalTxt}>{peso(utilidadNeta)}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Top productos del período</Text>
        <View style={s.tHead}>
          <Text style={[s.cProd, s.th]}>Producto</Text>
          <Text style={[s.cTot, s.th]}>Ingresos</Text>
        </View>
        {!top.length && <Text style={{ color: COL.gris, marginTop: 4 }}>Sin ventas registradas en el período.</Text>}
        {top.map((p, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cProd}>{p.name}</Text>
            <Text style={s.cTot}>{peso(p.total)}</Text>
          </View>
        ))}

        <PdfFooter s={s} />
      </Page>
    </Document>
  );
}
