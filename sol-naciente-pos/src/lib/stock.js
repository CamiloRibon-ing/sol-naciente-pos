// Calcula, a partir de las recetas, cuántas unidades de cada producto se
// pueden vender según el stock de ingredientes, descontando lo que ya hay
// en el carrito (considerando ingredientes compartidos entre productos).

const stockMap = (ingredientes) =>
  ingredientes.reduce((m, i) => ({ ...m, [i.id]: i.stock }), {});

// Suma cuánto consume el carrito de cada ingrediente.
export function consumoCarrito(cart, productos) {
  const consumo = {};
  for (const item of cart) {
    const p = productos.find((x) => x.id === item.id);
    if (!p?.controlaInventario) continue;
    if (!(p.receta || []).length) continue;
    for (const r of p.receta || []) {
      consumo[r.ingredienteId] = (consumo[r.ingredienteId] || 0) + r.cantidad * item.cantidad;
    }
  }
  return consumo;
}

// Unidades adicionales que aún se pueden agregar de un producto.
// Infinity = no controla inventario (servicios como piscina, alojamiento...).
export function disponibleProducto(producto, ingredientes, cart, productos) {
  if (!producto.controlaInventario) return Infinity;
  if (!(producto.receta || []).length) {
    const enCarrito = (cart || []).filter((item) => item.id === producto.id).reduce((s, item) => s + Number(item.cantidad || 0), 0);
    return Math.max(0, Math.floor(Number(producto.stock || 0) - enCarrito));
  }
  const stock = stockMap(ingredientes);
  const consumo = consumoCarrito(cart, productos);
  let max = Infinity;
  for (const r of producto.receta) {
    const restante = (stock[r.ingredienteId] || 0) - (consumo[r.ingredienteId] || 0);
    max = Math.min(max, Math.floor(restante / r.cantidad));
  }
  return Math.max(0, max);
}

// Devuelve el primer ingrediente que impide vender una unidad más.
export function ingredienteFaltante(producto, ingredientes, cart, productos) {
  if (producto?.controlaInventario && !(producto.receta || []).length) return producto.nombre || "producto";
  const stock = stockMap(ingredientes);
  const consumo = consumoCarrito(cart, productos);
  for (const r of producto.receta || []) {
    const restante = (stock[r.ingredienteId] || 0) - (consumo[r.ingredienteId] || 0);
    if (restante < r.cantidad) {
      return ingredientes.find((i) => i.id === r.ingredienteId)?.nombre || "ingrediente";
    }
  }
  return null;
}
