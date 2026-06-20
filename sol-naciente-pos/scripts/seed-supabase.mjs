// Script de un solo uso para poblar los datos base + inventario de ejemplo en Supabase.
// Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (no se guarda en el repo).
//
//   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seed-supabase.mjs
//
// Es idempotente para categorías, bodega, punto de venta y métodos de pago
// (usa upsert). Productos / ingredientes / recetas solo se insertan si las
// tablas están vacías, para no duplicar datos en reejecuciones.

import { createClient } from "@supabase/supabase-js";
import { CATEGORIAS, METODOS_PAGO, catNombre } from "../src/lib/format.js";
import { INGREDIENTES_SEED, PRODUCTOS_SEED, PUNTOS_VENTA_SEED } from "../src/data/seed.js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) {
  console.error("Falta VITE_SUPABASE_URL en el entorno.");
  process.exit(1);
}
if (!key) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const supabase = createClient(url, key);

const TIPO_POR_CAT = { comidas: "comida", bebidas: "bebida", piscina: "acceso", alojamiento: "otro", eventos: "otro" };

async function main() {
  // 1. Categorías
  const { data: cats, error: eCat } = await supabase
    .from("categorias")
    .upsert(CATEGORIAS.map((c) => ({ nombre_categoria: c.nombre })), { onConflict: "nombre_categoria" })
    .select("id_categoria, nombre_categoria");
  if (eCat) throw eCat;
  console.log(`✓ Categorías (${cats.length})`);

  // 2. Bodega principal
  let { data: bodega } = await supabase.from("bodegas").select("id_bodega").limit(1).single();
  if (!bodega) {
    const { data, error } = await supabase.from("bodegas").insert({ nombre: "Bodega principal" }).select("id_bodega").single();
    if (error) throw error;
    bodega = data;
  }
  console.log(`✓ Bodega principal (${bodega.id_bodega})`);

  // 3. Punto de venta principal
  let { data: punto } = await supabase.from("puntos_venta").select("id_punto").limit(1).single();
  if (!punto) {
    const { data, error } = await supabase
      .from("puntos_venta")
      .insert({ nombre: "Punto de venta principal", id_bodega: bodega.id_bodega })
      .select("id_punto")
      .single();
    if (error) throw error;
    punto = data;
  }
  console.log(`✓ Punto de venta (${punto.id_punto})`);

  // 4. Métodos de pago
  const { data: puntosExistentes, error: ePuntosExistentes } = await supabase.from("puntos_venta").select("id_punto, nombre");
  if (ePuntosExistentes) throw ePuntosExistentes;
  const existentes = new Set((puntosExistentes || []).map((p) => p.nombre.toLowerCase()));
  const faltantes = PUNTOS_VENTA_SEED.filter((p) => !existentes.has(p.nombre.toLowerCase()));
  if (faltantes.length) {
    const { error: ePuntosExtra } = await supabase
      .from("puntos_venta")
      .insert(faltantes.map((p) => ({ nombre: p.nombre, ubicacion: p.ubicacion, id_bodega: bodega.id_bodega, activo: true })));
    if (ePuntosExtra) throw ePuntosExtra;
  }
  console.log(`Locales operativos (${(puntosExistentes || []).length + faltantes.length})`);

  const { data: metodos, error: eMet } = await supabase
    .from("metodos_pago")
    .upsert(METODOS_PAGO.map((nombre) => ({ nombre })), { onConflict: "nombre" })
    .select("id_metodo, nombre");
  if (eMet) throw eMet;
  console.log(`✓ Métodos de pago (${metodos.length})`);

  // 5. Ingredientes + inventario (solo si la tabla está vacía)
  const { count: numIng } = await supabase.from("ingredientes").select("id_ingrediente", { count: "exact", head: true });
  const idIngLocal = {};
  if (!numIng) {
    for (const ing of INGREDIENTES_SEED) {
      const { data, error } = await supabase
        .from("ingredientes")
        .insert({ nombre: ing.nombre, unidad_medida: ing.unidad, costo_unitario: ing.costo })
        .select("id_ingrediente")
        .single();
      if (error) throw error;
      idIngLocal[ing.id] = data.id_ingrediente;
      const { error: eInv } = await supabase
        .from("inventario")
        .insert({ id_ingrediente: data.id_ingrediente, id_bodega: bodega.id_bodega, stock_actual: ing.stock, stock_minimo: ing.stockMin });
      if (eInv) throw eInv;
    }
    console.log(`✓ Ingredientes + inventario (${INGREDIENTES_SEED.length})`);
  } else {
    console.log("• Ingredientes ya tiene datos, no se reinsertan");
  }

  // 6. Productos + recetas (solo si la tabla está vacía)
  const { count: numProd } = await supabase.from("productos").select("id_producto", { count: "exact", head: true });
  if (!numProd) {
    const catIdPorNombre = Object.fromEntries(cats.map((c) => [c.nombre_categoria.toLowerCase(), c.id_categoria]));
    for (const p of PRODUCTOS_SEED) {
      const id_categoria = catIdPorNombre[catNombre(p.cat).toLowerCase()] || null;
      const { data, error } = await supabase
        .from("productos")
        .insert({
          nombre: p.nombre,
          descripcion: p.desc,
          id_categoria,
          tipo: TIPO_POR_CAT[p.cat] || "otro",
          precio_venta: p.precio,
          costo_estimado: p.costo,
          imagen_url: p.imagen || null,
          controla_inventario: p.controlaInventario,
          activo: p.activo !== false,
        })
        .select("id_producto")
        .single();
      if (error) throw error;
      if ((p.receta || []).length && Object.keys(idIngLocal).length) {
        const recetas = p.receta
          .filter((r) => idIngLocal[r.ingredienteId])
          .map((r) => ({ id_producto: data.id_producto, id_ingrediente: idIngLocal[r.ingredienteId], cantidad: r.cantidad }));
        if (recetas.length) {
          const { error: eRec } = await supabase.from("recetas").insert(recetas);
          if (eRec) throw eRec;
        }
      }
    }
    console.log(`✓ Productos + recetas (${PRODUCTOS_SEED.length})`);
  } else {
    console.log("• Productos ya tiene datos, no se reinsertan");
  }

  console.log("\nListo. Tu inventario y catálogo están cargados en Supabase.");
}

main().catch((e) => {
  console.error("Error poblando Supabase:", e.message || e);
  process.exit(1);
});
