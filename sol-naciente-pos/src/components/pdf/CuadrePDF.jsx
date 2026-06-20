import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EMPRESA } from "../../lib/format";
import { COL, peso, fechaHora, createPdfStyles, PdfHeader, PdfFooter } from "../../lib/pdf";

const TIPO_LABEL = {
  apertura: "Apertura de caja",
  venta: "Venta",
  ingreso: "Ingreso",
  egreso: "Gasto / Egreso",
  retiro: "Retiro de efectivo",
  gasto: "Gasto",
  cierre: "Cierre de caja",
};

const s = createPdfStyles({
  cDesc: { width: "46%", paddingHorizontal: 4 },
  cTipo: { width: "20%", paddingHorizontal: 4 },
  cFecha: { width: "20%", paddingHorizontal: 4 },
  cMonto: { width: "20%", textAlign: "right", paddingRight: 4 },
  cFactura: { width: "18%", paddingHorizontal: 4 },
  cCliente: { width: "28%", paddingHorizontal: 4 },
  cPago: { width: "18%", paddingHorizontal: 4 },
  cProducto: { width: "36%", paddingHorizontal: 4 },
  cCant: { width: "12%", textAlign: "right", paddingRight: 4 },
  metodoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderColor: COL.borde },
  totales: { marginTop: 4, marginLeft: "auto", width: 240 },
  difPos: { fontFamily: "Helvetica-Bold", fontSize: 12, color: COL.exito },
  difNeg: { fontFamily: "Helvetica-Bold", fontSize: 12, color: COL.rojo },
});

const utilidadVenta = (venta) => (venta.lineas || []).reduce((suma, l) => {
  const cantidad = Number(l.cantidad) || 0;
  const precio = Number(l.precio) || 0;
  const costo = Number(l.costo) || 0;
  return suma + ((precio - costo) * cantidad);
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

export default function CuadrePDF({ cuadre }) {
  const { caja, resumen, movimientos = [] } = cuadre;
  const cerrada = caja.estado === "cerrada";
  const montoFinal = cerrada ? Number(caja.monto_final_real) : null;
  const diferencia = cerrada ? Number(caja.diferencia) : null;
  const ventasCaja = resumen.ventasCaja || [];
  const productos = productosVendidos(ventasCaja);
  const utilidad = ventasCaja.reduce((suma, v) => suma + utilidadVenta(v), 0);

  return (
    <Document title={`Cuadre de caja ${fechaHora(caja.fecha_apertura)}`} author={EMPRESA.nombre}>
      <Page size="A4" style={s.page}>
        <PdfHeader s={s} badge={cerrada ? "CUADRE DE CAJA" : "CORTE PARCIAL"} />

        <View style={s.meta}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Apertura</Text>
            <Text style={s.metaVal}>{fechaHora(caja.fecha_apertura)}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Cierre</Text>
            <Text style={s.metaVal}>{cerrada ? fechaHora(caja.fecha_cierre) : "Caja en curso"}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Estado</Text>
            <Text style={s.metaVal}>{cerrada ? "Cerrada" : "Abierta"}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Monto inicial</Text>
            <Text style={s.metaVal}>{peso(caja.monto_inicial)}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Ventas por metodo de pago</Text>
        {Object.keys(resumen.ventasPorMetodo).length === 0 && <Text style={{ color: COL.gris }}>Sin ventas registradas.</Text>}
        {Object.entries(resumen.ventasPorMetodo).map(([metodo, monto]) => (
          <View style={s.metodoRow} key={metodo}>
            <Text>{metodo}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{peso(monto)}</Text>
          </View>
        ))}
        <View style={[s.metodoRow, { borderBottomWidth: 0, marginTop: 2 }]}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Total ventas</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", color: COL.azul }}>{peso(resumen.totalVentas)}</Text>
        </View>
        <View style={[s.metodoRow, { borderBottomWidth: 0 }]}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Utilidad estimada</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", color: utilidad < 0 ? COL.rojo : COL.exito }}>{peso(utilidad)}</Text>
        </View>

        <Text style={s.seccion}>Ventas de esta caja</Text>
        <View style={s.tHead}>
          <Text style={[s.cFactura, s.th]}>Factura</Text>
          <Text style={[s.cCliente, s.th]}>Cliente</Text>
          <Text style={[s.cPago, s.th]}>Pago</Text>
          <Text style={[s.cMonto, s.th]}>Total</Text>
          <Text style={[s.cMonto, s.th]}>Utilidad</Text>
        </View>
        {ventasCaja.map((v, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cFactura}>{v.numero || v.id}</Text>
            <Text style={s.cCliente}>{v.cliente || "Consumidor final"}</Text>
            <Text style={s.cPago}>{v.pago || "Efectivo"}</Text>
            <Text style={s.cMonto}>{peso(v.total)}</Text>
            <Text style={s.cMonto}>{peso(utilidadVenta(v))}</Text>
          </View>
        ))}
        {!ventasCaja.length && <Text style={{ color: COL.gris }}>Sin ventas registradas en esta caja.</Text>}

        <Text style={s.seccion}>Productos vendidos</Text>
        <View style={s.tHead}>
          <Text style={[s.cProducto, s.th]}>Producto</Text>
          <Text style={[s.cCant, s.th]}>Cant.</Text>
          <Text style={[s.cMonto, s.th]}>Vendido</Text>
          <Text style={[s.cMonto, s.th]}>Costo</Text>
          <Text style={[s.cMonto, s.th]}>Utilidad</Text>
        </View>
        {productos.map((p, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cProducto}>{p.nombre}</Text>
            <Text style={s.cCant}>{p.cantidad}</Text>
            <Text style={s.cMonto}>{peso(p.total)}</Text>
            <Text style={s.cMonto}>{peso(p.costo)}</Text>
            <Text style={s.cMonto}>{peso(p.utilidad)}</Text>
          </View>
        ))}
        {!productos.length && <Text style={{ color: COL.gris }}>Sin productos vendidos en esta caja.</Text>}

        <Text style={s.seccion}>Movimientos del dia</Text>
        <View style={s.tHead}>
          <Text style={[s.cTipo, s.th]}>Tipo</Text>
          <Text style={[s.cDesc, s.th]}>Descripcion</Text>
          <Text style={[s.cFecha, s.th]}>Hora</Text>
          <Text style={[s.cMonto, s.th]}>Monto</Text>
        </View>
        {movimientos.map((m, i) => (
          <View style={s.tRow} key={i}>
            <Text style={s.cTipo}>{TIPO_LABEL[m.tipo] || m.tipo}</Text>
            <Text style={s.cDesc}>{m.descripcion || "-"}</Text>
            <Text style={s.cFecha}>{fechaHora(m.fecha)}</Text>
            <Text style={s.cMonto}>{peso(m.monto)}</Text>
          </View>
        ))}

        <View style={s.totales}>
          <View style={s.totRow}><Text style={s.totLabel}>Monto inicial</Text><Text>{peso(caja.monto_inicial)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Ventas en efectivo</Text><Text>{peso(resumen.efectivo)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Ingresos adicionales</Text><Text>{peso(resumen.ingresos)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Gastos / egresos</Text><Text>- {peso(resumen.egresos)}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>Retiros de efectivo</Text><Text>- {peso(resumen.retiros)}</Text></View>
          <View style={s.granTotal}><Text style={s.granTotalTxt}>SALDO ESPERADO</Text><Text style={s.granTotalTxt}>{peso(resumen.saldoEsperado)}</Text></View>
          {cerrada && (
            <>
              <View style={s.totRow}><Text style={s.totLabel}>Saldo real contado</Text><Text>{peso(montoFinal)}</Text></View>
              <View style={s.granTotal}>
                <Text style={diferencia === 0 ? s.granTotalTxt : diferencia > 0 ? s.difPos : s.difNeg}>DIFERENCIA</Text>
                <Text style={diferencia === 0 ? s.granTotalTxt : diferencia > 0 ? s.difPos : s.difNeg}>{peso(diferencia)}</Text>
              </View>
            </>
          )}
        </View>

        <PdfFooter s={s} />
      </Page>
    </Document>
  );
}
