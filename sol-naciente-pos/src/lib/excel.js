const xml = (v) => String(v ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const sheetName = (name, used) => {
  let base = String(name || "Hoja").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Hoja";
  let finalName = base;
  let i = 2;
  while (used.has(finalName)) {
    const suffix = ` ${i++}`;
    finalName = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(finalName);
  return finalName;
};

const cellType = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return "Number";
  return "String";
};

const rowXml = (row, header = false) => `<Row>${row.map((value) => (
  `<Cell${header ? ' ss:StyleID="header"' : ""}><Data ss:Type="${cellType(value)}">${xml(value)}</Data></Cell>`
)).join("")}</Row>`;

export function descargarExcel({ nombreArchivo, hojas }) {
  const usados = new Set();
  const worksheets = hojas
    .filter((h) => h && h.filas?.length)
    .map((h) => {
      const nombre = sheetName(h.nombre, usados);
      const filas = h.filas.map((fila, i) => rowXml(fila, i === 0 && h.encabezado !== false)).join("");
      return `<Worksheet ss:Name="${xml(nombre)}"><Table>${filas}</Table></Worksheet>`;
    })
    .join("");

  const contenido = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1A4FA0" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheets}
</Workbook>`;

  const blob = new Blob([contenido], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".xls") ? nombreArchivo : `${nombreArchivo}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
