import { StyleSheet, View, Text, Image } from "@react-pdf/renderer";
import { EMPRESA } from "./format";

// El logo local de assets/logo.png en realidad es un JPEG guardado con extension
// .png: @react-pdf/renderer elige el decodificador por extension, intenta
// descomprimirlo como PNG (zlib) y revienta con "Array buffer allocation failed",
// tumbando la pestana por falta de memoria. Por eso no se usa como respaldo aqui;
// se usa siempre una URL remota valida (la configurada o esta por defecto).
const LOGO_RESPALDO = "https://res.cloudinary.com/dczdtij3q/image/upload/c_auto,h_120,w_120/menusolnaciente/zya1dbvgsydc5vqrqt9a.png";

// Paleta y helpers compartidos por todos los documentos PDF
// (factura/cotización, cuadre de caja, comprobante de nómina).
export const COL = { azul: "#1A4FA0", azulOsc: "#143C7A", rojo: "#E22B23", amarillo: "#FBB814", crema: "#FFF8EE", tinta: "#222A3A", gris: "#6B7280", borde: "#EFE6D6", exito: "#159A5A" };

export const peso = (n) =>
  "$ " + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(n) || 0);

export const fechaCorta = (d) =>
  d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export const fechaHora = (d) => {
  if (!d) return "—";
  const f = new Date(d);
  return `${f.toLocaleDateString("es-CO")} ${f.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
};

// Estilos base reutilizables. Cada PDF los combina con sus estilos propios:
//   const s = StyleSheet.create({ ...BASE_PDF_STYLES, ...estilosPropios });
export const BASE_PDF_STYLES = {
  page: { padding: 36, fontSize: 9, color: COL.tinta, fontFamily: "Helvetica" },
  band: { backgroundColor: COL.azul, borderRadius: 10, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 46, height: 46, objectFit: "contain" },
  empNombre: { color: "#fff", fontSize: 13, fontFamily: "Helvetica-Bold" },
  empSub: { color: "#DCE6F6", fontSize: 7.5, marginTop: 2 },
  badge: { backgroundColor: COL.amarillo, color: COL.azulOsc, fontSize: 9, fontFamily: "Helvetica-Bold", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  badgeAlt: { backgroundColor: "#fff", color: COL.azulOsc, fontSize: 9, fontFamily: "Helvetica-Bold", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  metaBox: { flex: 1 },
  metaLabel: { color: COL.gris, fontSize: 7.5, marginBottom: 2, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  metaVal: { fontSize: 9.5 },
  seccion: { fontSize: 10, fontFamily: "Helvetica-Bold", color: COL.azul, marginTop: 18, marginBottom: 6 },
  tHead: { flexDirection: "row", backgroundColor: COL.crema, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COL.borde, paddingVertical: 6 },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: COL.borde, paddingVertical: 6 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: COL.gris },
  totales: { marginTop: 12, marginLeft: "auto", width: 220 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totLabel: { color: COL.gris },
  granTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderColor: COL.borde },
  granTotalTxt: { fontFamily: "Helvetica-Bold", fontSize: 12, color: COL.azul },
  pie: { position: "absolute", bottom: 30, left: 36, right: 36, textAlign: "center", color: COL.gris, fontSize: 7.5, borderTopWidth: 0.5, borderColor: COL.borde, paddingTop: 8 },
  qr: { width: 54, height: 54, borderWidth: 1, borderColor: COL.borde, borderStyle: "dashed", borderRadius: 4 },
};

// Combina los estilos base con los propios de cada documento.
export function createPdfStyles(extra = {}) {
  return StyleSheet.create({ ...BASE_PDF_STYLES, ...extra });
}

// Solo se usa el logo remoto si la URL tiene una forma valida; evita que una
// URL rota o vacia haga fallar la carga de imagen dentro de @react-pdf/renderer
// y deje el PDF en blanco.
const logoValido = (url) => typeof url === "string" && /^https?:\/\//i.test(url.trim());

// Encabezado de marca (logo + datos de la empresa) + insignia del documento.
export function PdfHeader({ s, badge, badgeStyle }) {
  return (
    <View style={s.band}>
      <View style={s.brandRow}>
        <Image style={s.logo} src={logoValido(EMPRESA.logoUrl) ? EMPRESA.logoUrl : LOGO_RESPALDO} />
        <View>
          <Text style={s.empNombre}>{EMPRESA.nombre}</Text>
          <Text style={s.empSub}>NIT {EMPRESA.nit} · {EMPRESA.telefono}</Text>
          <Text style={s.empSub}>{EMPRESA.direccion}</Text>
        </View>
      </View>
      <Text style={badgeStyle || s.badge}>{badge}</Text>
    </View>
  );
}

// Pie de página estándar.
export function PdfFooter({ s }) {
  return (
    <Text style={s.pie} fixed>
      {EMPRESA.nombre} · {EMPRESA.correo} · {EMPRESA.telefono} — Generado por el sistema POS Sol Naciente
    </Text>
  );
}
