import { pdf, Document, Page, Text } from "@react-pdf/renderer";

let calentado = false;

// La primera vez que se genera un PDF, @react-pdf/renderer compila su motor
// de layout (Yoga, en WebAssembly) y lo deja cacheado para el resto de la
// sesion (ver node_modules/@react-pdf/layout/lib/index.js). Esa compilacion
// es pesada y bloquea el hilo principal; si ocurre cuando el cajero hace clic
// en "Facturar" o "Cotizar", la pagina se congela y el navegador llega a
// avisar "La pagina no responde". Generando un PDF minimo en segundo plano,
// apenas carga la app, ese costo se paga antes de que el usuario lo necesite.
export function calentarMotorPdf() {
  if (calentado) return;
  calentado = true;
  pdf(
    <Document>
      <Page size="A4">
        <Text>.</Text>
      </Page>
    </Document>
  )
    .toBlob()
    .catch(() => {});
}
