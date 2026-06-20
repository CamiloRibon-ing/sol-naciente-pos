export let IMPUESTO = 0.08; // Impoconsumo configurable

export const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export const fmtNum = (n) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(n) || 0);

export const limpiarMonto = (valor) => {
  const limpio = String(valor ?? "").replace(/[^\d]/g, "");
  return limpio ? Number(limpio) : 0;
};

export const formatoMontoInput = (valor) => {
  const limpio = String(valor ?? "").replace(/[^\d]/g, "");
  if (!limpio) return "";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(limpio));
};

export const fmtFecha = (d) => {
  const f = new Date(d);
  return (
    f.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) +
    " - " +
    f.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
  );
};

export const CATEGORIAS = [
  { id: "comidas", nombre: "Comidas", color: "#E22B23" },
  { id: "bebidas", nombre: "Bebidas", color: "#F58220" },
  { id: "piscina", nombre: "Acceso piscina", color: "#1A4FA0" },
  { id: "alojamiento", nombre: "Alojamiento", color: "#FBB814" },
  { id: "eventos", nombre: "Eventos", color: "#B71F18" },
];

let CATEGORIAS_RUNTIME = [...CATEGORIAS];

export function aplicarCategorias(categorias = []) {
  const base = categorias.length ? categorias : CATEGORIAS;
  CATEGORIAS_RUNTIME = base.map((c) => ({ ...c, activo: c.activo !== false }));
}

export const categoriasActuales = () => CATEGORIAS_RUNTIME;
export const catNombre = (id) => CATEGORIAS_RUNTIME.find((c) => c.id === id)?.nombre || id;
export const catColor = (id) => CATEGORIAS_RUNTIME.find((c) => c.id === id)?.color || "#1A4FA0";

// Clasifica un margen de ganancia (%) para indicadores visuales (bueno/regular/bajo).
export const margenInfo = (mg) => {
  if (mg >= 50) return { label: "Bueno", color: "#159A5A" };
  if (mg >= 25) return { label: "Regular", color: "#FBB814" };
  return { label: "Bajo", color: "#E22B23" };
};

export const METODOS_PAGO = ["Efectivo", "Tarjeta", "Transferencia", "Nequi", "Daviplata"];

export const EMPRESA = {
  nombre: "Centro Recreacional Sol Naciente",
  nit: "900.000.000-0",
  direccion: "Km 5 via al recreo, Colombia",
  telefono: "(60X) 000 0000",
  correo: "ventas@solnaciente.co",
  resolucionDian: "Resolucion de facturacion DIAN: pendiente de asignacion",
  logoUrl: "https://res.cloudinary.com/dczdtij3q/image/upload/c_auto,h_120,w_120/menusolnaciente/zya1dbvgsydc5vqrqt9a.png",
  prefijoFactura: "FAC",
  menuOrden: [],
  menuOculto: [],
};

export function aplicarConfiguracionNegocio(config = {}) {
  Object.assign(EMPRESA, {
    nombre: config.nombre || EMPRESA.nombre,
    nit: config.nit || EMPRESA.nit,
    direccion: config.direccion || EMPRESA.direccion,
    telefono: config.telefono || EMPRESA.telefono,
    correo: config.correo || EMPRESA.correo,
    resolucionDian: config.resolucionDian || EMPRESA.resolucionDian,
    logoUrl: config.logoUrl || EMPRESA.logoUrl,
    prefijoFactura: config.prefijoFactura || EMPRESA.prefijoFactura || "FAC",
    menuOrden: Array.isArray(config.menuOrden) ? config.menuOrden : EMPRESA.menuOrden,
    menuOculto: Array.isArray(config.menuOculto) ? config.menuOculto : EMPRESA.menuOculto,
  });
  IMPUESTO = Number(config.impuestoRate ?? IMPUESTO) || 0;
}
