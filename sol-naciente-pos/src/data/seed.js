// Datos de ejemplo para MODO DEMO (sin Supabase).
// Las recetas relacionan cada producto con los ingredientes que consume,
// lo que permite calcular el stock disponible al vender.

export const INGREDIENTES_SEED = [
  { id: "i1", nombre: "Carne de res molida", unidad: "kg", stock: 8, stockMin: 5, costo: 18000 },
  { id: "i2", nombre: "Pollo", unidad: "kg", stock: 3, stockMin: 6, costo: 12000 },
  { id: "i3", nombre: "Papa", unidad: "kg", stock: 20, stockMin: 8, costo: 2500 },
  { id: "i4", nombre: "Cerveza", unidad: "und", stock: 40, stockMin: 24, costo: 2500 },
  { id: "i5", nombre: "Limón", unidad: "und", stock: 15, stockMin: 30, costo: 200 },
  { id: "i6", nombre: "Pan de hamburguesa", unidad: "und", stock: 25, stockMin: 20, costo: 800 },
  { id: "i7", nombre: "Gaseosa PET", unidad: "und", stock: 60, stockMin: 24, costo: 1800 },
  { id: "i8", nombre: "Hielo", unidad: "kg", stock: 12, stockMin: 10, costo: 1500 },
  { id: "i9", nombre: "Mojarra", unidad: "und", stock: 9, stockMin: 6, costo: 9000 },
];

export const PRODUCTOS_SEED = [
  { id: "p1", cat: "comidas", nombre: "Hamburguesa sencilla", desc: "Carne de res, lechuga, tomate y papas a la francesa", precio: 14000, costo: 6000, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i1", cantidad: 0.15 }, { ingredienteId: "i6", cantidad: 1 }, { ingredienteId: "i3", cantidad: 0.12 }] },
  { id: "p2", cat: "comidas", nombre: "Combo pollo broaster", desc: "2 presas apanadas + papas + gaseosa 400 ml", precio: 22000, costo: 9000, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i2", cantidad: 0.3 }, { ingredienteId: "i3", cantidad: 0.12 }, { ingredienteId: "i7", cantidad: 1 }] },
  { id: "p3", cat: "comidas", nombre: "Salchipapa mixta", desc: "Papa a la francesa, salchicha, pollo y salsas de la casa", precio: 16000, costo: 6500, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i3", cantidad: 0.2 }, { ingredienteId: "i2", cantidad: 0.05 }] },
  { id: "p4", cat: "comidas", nombre: "Mojarra frita", desc: "Mojarra entera + patacón + arroz + ensalada", precio: 28000, costo: 13000, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i9", cantidad: 1 }] },
  { id: "b1", cat: "bebidas", nombre: "Michelada clásica", desc: "Cerveza, limón, sal y salsas en el borde", precio: 12000, costo: 4500, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i4", cantidad: 1 }, { ingredienteId: "i5", cantidad: 2 }, { ingredienteId: "i8", cantidad: 0.1 }] },
  { id: "b2", cat: "bebidas", nombre: "Granizado de limón", desc: "Hielo raspado, limón natural y azúcar", precio: 7000, costo: 2500, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i5", cantidad: 1 }, { ingredienteId: "i8", cantidad: 0.2 }] },
  { id: "b3", cat: "bebidas", nombre: "Jugo natural", desc: "En agua o leche: mora, lulo o maracuyá", precio: 6000, costo: 2200, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "b4", cat: "bebidas", nombre: "Gaseosa PET 400 ml", desc: "Bebida fría surtida", precio: 4000, costo: 1800, activo: true, controlaInventario: true, imagen: "", receta: [{ ingredienteId: "i7", cantidad: 1 }] },
  { id: "pi1", cat: "piscina", nombre: "Entrada adulto", desc: "Acceso a piscinas todo el día", precio: 15000, costo: 0, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "pi2", cat: "piscina", nombre: "Entrada niño", desc: "Niños de 4 a 11 años", precio: 10000, costo: 0, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "pi3", cat: "piscina", nombre: "Pasadía completo", desc: "Acceso a piscinas + almuerzo + bienvenida", precio: 35000, costo: 12000, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "a1", cat: "alojamiento", nombre: "Apartamento por día", desc: "Capacidad 5 personas, cocina y baño privado", precio: 180000, costo: 60000, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "a2", cat: "alojamiento", nombre: "Cabaña fin de semana", desc: "2 noches, capacidad 6 personas", precio: 420000, costo: 150000, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "e1", cat: "eventos", nombre: "Salón principal", desc: "Hasta 150 personas, sonido incluido", precio: 800000, costo: 250000, activo: true, controlaInventario: false, imagen: "", receta: [] },
  { id: "e2", cat: "eventos", nombre: "Kiosko familiar", desc: "Asador, mesas y zona verde", precio: 120000, costo: 30000, activo: true, controlaInventario: false, imagen: "", receta: [] },
];

export const PUNTOS_VENTA_SEED = [
  { id: "pv-principal", nombre: "Punto de venta principal", ubicacion: "Centro recreacional" },
  { id: "pv-piscina", nombre: "Kiosco piscina", ubicacion: "Zona de piscinas", id_punto_padre: "pv-principal" },
  { id: "pv-micheladas", nombre: "Kiosco micheladas", ubicacion: "Zona de bebidas", id_punto_padre: "pv-principal" },
];

const offset = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d.toISOString(); };
const linea = (id, cant) => { const p = PRODUCTOS_SEED.find((x) => x.id === id); return { productoId: id, nombre: p.nombre, cat: p.cat, cantidad: cant, precio: p.precio, costo: p.costo }; };
const tot = (ls) => ls.reduce((s, l) => s + l.precio * l.cantidad, 0);
const puntoDeFactura = {
  "FAC-0001": "pv-principal",
  "FAC-0002": "pv-piscina",
  "FAC-0003": "pv-micheladas",
  "FAC-0004": "pv-principal",
  "FAC-0005": "pv-piscina",
  "FAC-0006": "pv-piscina",
  "FAC-0007": "pv-principal",
  "FAC-0008": "pv-micheladas",
  "FAC-0009": "pv-micheladas",
  "FAC-0010": "pv-piscina",
};

export const VENTAS_SEED = [
  { id: "FAC-0001", fecha: offset(6), tipo: "FACTURA", cliente: "Consumidor final", pago: "Efectivo", lineas: [linea("p2", 2), linea("b4", 2)] },
  { id: "FAC-0002", fecha: offset(6), tipo: "FACTURA", cliente: "Consumidor final", pago: "Nequi", lineas: [linea("pi1", 4), linea("pi2", 2)] },
  { id: "FAC-0003", fecha: offset(5), tipo: "FACTURA", cliente: "Familia López", pago: "Tarjeta", lineas: [linea("p4", 1), linea("b1", 2)] },
  { id: "FAC-0004", fecha: offset(5), tipo: "FACTURA", cliente: "Reserva apto", pago: "Transferencia", lineas: [linea("a1", 1)] },
  { id: "FAC-0005", fecha: offset(4), tipo: "FACTURA", cliente: "Consumidor final", pago: "Efectivo", lineas: [linea("p3", 3), linea("b2", 3)] },
  { id: "FAC-0006", fecha: offset(3), tipo: "FACTURA", cliente: "Colegio San José", pago: "Transferencia", lineas: [linea("pi3", 5)] },
  { id: "FAC-0007", fecha: offset(3), tipo: "FACTURA", cliente: "Consumidor final", pago: "Efectivo", lineas: [linea("p1", 4), linea("b4", 4)] },
  { id: "FAC-0008", fecha: offset(2), tipo: "FACTURA", cliente: "Evento Pérez", pago: "Daviplata", lineas: [linea("e2", 1), linea("b1", 6)] },
  { id: "FAC-0009", fecha: offset(1), tipo: "FACTURA", cliente: "Consumidor final", pago: "Tarjeta", lineas: [linea("p2", 5), linea("b3", 5)] },
  { id: "FAC-0010", fecha: offset(1), tipo: "FACTURA", cliente: "Consumidor final", pago: "Efectivo", lineas: [linea("pi1", 8), linea("p3", 4)] },
].map((v) => {
  const punto = PUNTOS_VENTA_SEED.find((p) => p.id === puntoDeFactura[v.id]) || PUNTOS_VENTA_SEED[0];
  return { ...v, id_punto: punto.id, puntoVenta: punto.nombre, total: tot(v.lineas) };
});
