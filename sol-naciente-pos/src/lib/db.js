import { supabase, supabaseHabilitado } from "./supabaseClient";
import { PRODUCTOS_SEED, INGREDIENTES_SEED, VENTAS_SEED, PUNTOS_VENTA_SEED } from "../data/seed";
import { CATEGORIAS, catNombre, IMPUESTO, EMPRESA, aplicarConfiguracionNegocio, aplicarCategorias, fmt } from "./format";
import { consumoCarrito } from "./stock";

export const modoDemo = !supabaseHabilitado;

/* ============================ MODO DEMO (en memoria) ============================ */
const clon = (x) => JSON.parse(JSON.stringify(x));
let _productos = clon(PRODUCTOS_SEED);
let _categorias = clon(CATEGORIAS).map((c) => ({ ...c, activo: true }));
let _ingredientes = clon(INGREDIENTES_SEED);
let _ventas = clon(VENTAS_SEED);
let _puntosVenta = clon(PUNTOS_VENTA_SEED);
let _proveedores = [];
let _compras = [];
let _clientes = [];
let _reservas = [];
let _roles = [
  { id: "rol-admin", nombre: "admin", descripcion: "Acceso total al sistema" },
  { id: "rol-supervisor", nombre: "supervisor", descripcion: "Supervision de ventas, caja y reportes" },
  { id: "rol-cajero", nombre: "cajero", descripcion: "Vendedor con acceso a POS, caja y clientes" },
];
let _usuarios = [
  {
    id: "demo",
    nombre: "Administrador (demo)",
    correo: "demo@solnaciente.co",
    documento: "",
    telefono: "",
    rol: "admin",
    rolId: "rol-admin",
    puntoVentaId: null,
    puntoVentaNombre: "",
    activo: true,
  },
];
let _auditoria = [];
let _configuracionNegocio = {
  nombre: EMPRESA.nombre,
  nit: EMPRESA.nit,
  direccion: EMPRESA.direccion,
  telefono: EMPRESA.telefono,
  correo: EMPRESA.correo,
  resolucionDian: EMPRESA.resolucionDian,
  logoUrl: EMPRESA.logoUrl,
  prefijoFactura: EMPRESA.prefijoFactura,
  menuOrden: [],
  menuOculto: [],
  impuestoRate: IMPUESTO,
};
let _recursosReserva = [
  { id: "apt-demo", tipo: "apartamento", nombre: "Apartamento familiar", capacidad: 5, precio: 180000, activo: true },
  { id: "cab-demo", tipo: "apartamento", nombre: "Cabana lago", capacidad: 6, precio: 220000, activo: true },
  { id: "salon-demo", tipo: "evento", nombre: "Salon principal", capacidad: 120, precio: 800000, activo: true },
  { id: "kiosko-demo", tipo: "evento", nombre: "Kiosko familiar", capacidad: 30, precio: 120000, activo: true },
];
let _seq = { FACTURA: 11, COTIZACION: 1 };

const wait = (data) => Promise.resolve(clon(data));

/* ============================ Mapeadores Supabase ============================ */
let _catCache = null;
const slugCategoria = (nombre = "") => nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "categoria";
const mapCategoria = (row) => {
  const base = CATEGORIAS.find((c) => c.nombre.toLowerCase() === (row.nombre_categoria || "").toLowerCase());
  return {
    id: base?.id || slugCategoria(row.nombre_categoria),
    uuid: row.id_categoria,
    nombre: row.nombre_categoria,
    descripcion: row.descripcion || "",
    color: row.color || base?.color || "#1A4FA0",
    activo: row.activo !== false,
    orden: Number(row.orden) || 0,
  };
};
async function categoriasSupabase() {
  if (_catCache) return _catCache;
  const { data } = await supabase.from("categorias").select("id_categoria, nombre_categoria, descripcion, color, activo, orden").order("orden").order("nombre_categoria");
  _catCache = data || [];
  return _catCache;
}
function catIdLocal(nombre) {
  const c = [..._categorias, ...CATEGORIAS].find((x) => x.nombre.toLowerCase() === (nombre || "").toLowerCase());
  return c?.id || slugCategoria(nombre || "comidas");
}
async function uuidCategoria(catLocal) {
  const cats = await categoriasSupabase();
  const categoria = [..._categorias, ...CATEGORIAS].find((c) => c.id === catLocal);
  const buscado = (categoria?.nombre || catNombre(catLocal)).toLowerCase();
  return cats.find((c) => c.nombre_categoria?.toLowerCase() === buscado)?.id_categoria || null;
}
const mapProducto = (row) => ({
  id: row.id_producto,
  nombre: row.nombre,
  desc: row.descripcion || "",
  precio: Number(row.precio_venta) || 0,
  costo: Number(row.costo_estimado) || 0,
  imagen: row.imagen_url || "",
  activo: row.activo,
  controlaInventario: row.controla_inventario,
  stock: Number(row.stock_actual) || 0,
  stockMin: Number(row.stock_minimo) || 0,
  catUuid: row.id_categoria || row.categorias?.id_categoria || null,
  cat: catIdLocal(row.categorias?.nombre_categoria),
  receta: (row.recetas || []).map((r) => ({ ingredienteId: r.id_ingrediente, cantidad: Number(r.cantidad) })),
  variantes: (row.producto_variantes || []).map((v) => ({
    id: v.id_variante,
    nombre: v.nombre,
    precio: Number(v.precio_venta) || 0,
    costo: Number(v.costo_estimado) || 0,
    activo: v.activo !== false,
  })),
});
const mapIngrediente = (row) => ({
  id: row.id_ingrediente,
  nombre: row.nombre,
  unidad: row.unidad_medida,
  stock: Number(row.stock_actual) || 0, // se sobrescribe con inventario si existe
  stockMin: Number(row.stock_minimo) || 0,
  costo: Number(row.costo_unitario) || 0,
});

const tieneReceta = (producto) => (producto?.receta || []).length > 0;
const esProductoStockDirecto = (producto) => producto?.controlaInventario && !tieneReceta(producto);
const esTablaVariantesFaltante = (error) =>
  error?.code === "42P01" || /producto_variantes|relation .* does not exist|Could not find a relationship/i.test(error?.message || "");
const esColumnaOrdenCategoriaFaltante = (error) =>
  error?.code === "42703" || /column .*orden.* does not exist|orden/i.test(error?.message || "");
const consumoProductosDirectos = (lineas = []) => lineas.reduce((acc, l) => {
  const prod = _productos.find((p) => p.id === l.productoId);
  if (esProductoStockDirecto(prod)) acc[l.productoId] = (acc[l.productoId] || 0) + Number(l.cantidad || 0);
  return acc;
}, {});

/* ============================ API pública ============================ */
const mapPuntoVenta = (row) => ({
  id: row.id_punto,
  nombre: row.nombre,
  ubicacion: row.ubicacion || "",
  idBodega: row.id_bodega || null,
  bodega: row.bodegas?.nombre || "",
  idPuntoPadre: row.id_punto_padre || null,
  activo: row.activo !== false,
});

export async function listPuntosVenta({ incluirInactivos = false } = {}) {
  if (modoDemo) return wait(_puntosVenta);
  let q = supabase
    .from("puntos_venta")
    .select("id_punto, nombre, ubicacion, id_bodega, id_punto_padre, activo, bodegas(nombre)")
    .order("nombre");
  if (!incluirInactivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data
    .map(mapPuntoVenta)
    .sort((a, b) => {
      if (!a.idPuntoPadre && b.idPuntoPadre) return -1;
      if (a.idPuntoPadre && !b.idPuntoPadre) return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}

export async function listBodegas() {
  if (modoDemo) return wait([{ id: "bodega-demo", nombre: "Bodega principal", activo: true }]);
  const { data, error } = await supabase
    .from("bodegas")
    .select("id_bodega, nombre, activo")
    .order("nombre");
  if (error) throw error;
  return data.map((b) => ({ id: b.id_bodega, nombre: b.nombre, activo: b.activo !== false }));
}

export async function listCategorias({ incluirInactivas = false } = {}) {
  if (modoDemo) {
    const ordenadas = [..._categorias].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || a.nombre.localeCompare(b.nombre, "es"));
    const cats = incluirInactivas ? ordenadas : ordenadas.filter((c) => c.activo !== false);
    aplicarCategorias(cats);
    return wait(cats);
  }
  let { data, error } = await supabase
    .from("categorias")
    .select("id_categoria, nombre_categoria, descripcion, color, activo, orden")
    .order("orden")
    .order("nombre_categoria");
  if (error) {
    if (esColumnaOrdenCategoriaFaltante(error)) {
      const fallback = await supabase
        .from("categorias")
        .select("id_categoria, nombre_categoria, descripcion, color, activo")
        .order("nombre_categoria");
      data = fallback.data;
      error = fallback.error;
    }
  }
  if (error) {
    const { data: dataBase, error: errorBase } = await supabase
      .from("categorias")
      .select("id_categoria, nombre_categoria, descripcion")
      .order("nombre_categoria");
    if (errorBase) throw error;
    const catsBase = dataBase.map(mapCategoria);
    _categorias = catsBase;
    _catCache = dataBase;
    aplicarCategorias(incluirInactivas ? catsBase : catsBase.filter((c) => c.activo !== false));
    return incluirInactivas ? catsBase : catsBase.filter((c) => c.activo !== false);
  }
  const cats = data.map(mapCategoria);
  _categorias = cats;
  _catCache = data;
  aplicarCategorias(incluirInactivas ? cats : cats.filter((c) => c.activo !== false));
  return incluirInactivas ? cats : cats.filter((c) => c.activo !== false);
}

export async function saveCategoria(categoria, idUsuario) {
  const payload = {
    nombre: categoria.nombre?.trim(),
    descripcion: (categoria.descripcion || "").trim(),
    color: categoria.color || "#1A4FA0",
    activo: categoria.activo !== false,
    orden: Number(categoria.orden) || 0,
  };
  if (!payload.nombre) throw new Error("El nombre de la categoria es obligatorio");
  const accion = categoria.uuid ? "EDITAR_CATEGORIA" : "CREAR_CATEGORIA";
  if (modoDemo) {
    if (categoria.id && _categorias.some((c) => c.id === categoria.id)) {
      _categorias = _categorias.map((c) => (c.id === categoria.id ? { ...c, ...payload, id: c.id, uuid: c.uuid } : c));
    } else {
      const orden = _categorias.length ? Math.max(..._categorias.map((c) => Number(c.orden) || 0)) + 1 : 0;
      _categorias = [{ ...payload, orden, id: slugCategoria(payload.nombre), uuid: "cat-" + Date.now() }, ..._categorias];
    }
    aplicarCategorias(_categorias);
    await registrarAuditoria({ idUsuario, accion, tabla: "categorias", registroId: categoria.id || payload.nombre, detalle: payload });
    return wait(payload);
  }
  const row = {
    nombre_categoria: payload.nombre,
    descripcion: payload.descripcion || null,
    color: payload.color,
    activo: payload.activo,
    orden: payload.orden,
  };
  let id = categoria.uuid;
  if (id) {
    let { error } = await supabase.from("categorias").update(row).eq("id_categoria", id);
    if (esColumnaOrdenCategoriaFaltante(error)) {
      const { orden, ...sinOrden } = row;
      const res = await supabase.from("categorias").update(sinOrden).eq("id_categoria", id);
      error = res.error;
    }
    if (error) throw error;
  } else {
    if (!categoria.orden && categoria.orden !== 0) {
      const cats = await listCategorias({ incluirInactivas: true });
      row.orden = cats.length ? Math.max(...cats.map((c) => Number(c.orden) || 0)) + 1 : 0;
    }
    let { data, error } = await supabase.from("categorias").insert(row).select("id_categoria").single();
    if (esColumnaOrdenCategoriaFaltante(error)) {
      const { orden, ...sinOrden } = row;
      const res = await supabase.from("categorias").insert(sinOrden).select("id_categoria").single();
      data = res.data;
      error = res.error;
    }
    if (error) throw error;
    id = data.id_categoria;
  }
  _catCache = null;
  await registrarAuditoria({ idUsuario, accion, tabla: "categorias", registroId: id, detalle: payload });
  return { ...payload, id: slugCategoria(payload.nombre), uuid: id };
}

export async function ordenarCategorias(categoriasOrdenadas, idUsuario) {
  const normalizadas = categoriasOrdenadas.map((c, idx) => ({ ...c, orden: idx }));
  if (modoDemo) {
    _categorias = _categorias.map((c) => {
      const nueva = normalizadas.find((x) => (x.uuid || x.id) === (c.uuid || c.id));
      return nueva ? { ...c, orden: nueva.orden } : c;
    });
    aplicarCategorias(_categorias);
    await registrarAuditoria({ idUsuario, accion: "ORDENAR_CATEGORIAS", tabla: "categorias", registroId: "categorias", detalle: { total: normalizadas.length } });
    return wait(true);
  }
  for (const c of normalizadas) {
    if (!c.uuid) continue;
    const { error } = await supabase.from("categorias").update({ orden: c.orden }).eq("id_categoria", c.uuid);
    if (esColumnaOrdenCategoriaFaltante(error)) {
      throw new Error("Falta crear la columna orden en categorias para guardar el orden personalizado.");
    }
    if (error) throw error;
  }
  _catCache = null;
  await registrarAuditoria({ idUsuario, accion: "ORDENAR_CATEGORIAS", tabla: "categorias", registroId: "categorias", detalle: { total: normalizadas.length } });
  return true;
}

export async function deleteCategoria(categoria, idUsuario) {
  if (!categoria?.uuid && !modoDemo) throw new Error("Categoria no encontrada");
  if (modoDemo) {
    _categorias = _categorias.filter((c) => c.id !== categoria.id);
    aplicarCategorias(_categorias);
    await registrarAuditoria({ idUsuario, accion: "ELIMINAR_CATEGORIA", tabla: "categorias", registroId: categoria.id, detalle: { nombre: categoria.nombre } });
    return wait(true);
  }
  const { error } = await supabase.from("categorias").delete().eq("id_categoria", categoria.uuid);
  if (error) throw error;
  _catCache = null;
  await registrarAuditoria({ idUsuario, accion: "ELIMINAR_CATEGORIA", tabla: "categorias", registroId: categoria.uuid, detalle: { nombre: categoria.nombre } });
  return true;
}

export async function savePuntoVenta(p) {
  if (modoDemo) {
    const payload = {
      ...p,
      idBodega: p.idBodega || null,
      idPuntoPadre: p.idPuntoPadre || null,
      activo: p.activo !== false,
    };
    if (payload.id && _puntosVenta.some((x) => x.id === payload.id)) {
      _puntosVenta = _puntosVenta.map((x) => (x.id === payload.id ? { ...x, ...payload } : x));
    } else {
      _puntosVenta = [..._puntosVenta, { ...payload, id: "pv-" + Date.now() }];
    }
    return wait(payload);
  }
  const payload = {
    nombre: p.nombre,
    ubicacion: p.ubicacion || null,
    id_bodega: p.idBodega || null,
    id_punto_padre: p.idPuntoPadre && p.idPuntoPadre !== p.id ? p.idPuntoPadre : null,
    activo: p.activo !== false,
  };
  if (p.id) {
    const { error } = await supabase.from("puntos_venta").update(payload).eq("id_punto", p.id);
    if (error) throw error;
    return { ...p };
  }
  const { data, error } = await supabase.from("puntos_venta").insert(payload).select("id_punto").single();
  if (error) throw error;
  return { ...p, id: data.id_punto };
}

export async function deletePuntoVenta(id) {
  if (modoDemo) {
    _puntosVenta = _puntosVenta.filter((p) => p.id !== id).map((p) => (p.idPuntoPadre === id ? { ...p, idPuntoPadre: null } : p));
    return wait(true);
  }
  const { error } = await supabase.from("puntos_venta").delete().eq("id_punto", id);
  if (error) throw error;
  return true;
}

export async function listRoles() {
  if (modoDemo) return wait(_roles);
  const { data, error } = await supabase
    .from("roles")
    .select("id_rol, nombre_rol, descripcion")
    .order("nombre_rol");
  if (error) throw error;
  return data.map((r) => ({ id: r.id_rol, nombre: r.nombre_rol, descripcion: r.descripcion || "" }));
}

export async function listUsuarios() {
  if (modoDemo) return wait(_usuarios);
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nombre, correo, documento, telefono, activo, id_rol, id_punto, roles(nombre_rol), puntos_venta(nombre)")
    .order("nombre");
  if (error) throw error;
  return data.map((u) => ({
    id: u.id_usuario,
    nombre: u.nombre,
    correo: u.correo,
    documento: u.documento || "",
    telefono: u.telefono || "",
    rol: u.roles?.nombre_rol || "",
    rolId: u.id_rol || null,
    puntoVentaId: u.id_punto || null,
    puntoVentaNombre: u.puntos_venta?.nombre || "",
    activo: u.activo !== false,
  }));
}

export async function saveUsuarioPerfil(usuario, idUsuarioActor) {
  if (modoDemo) {
    const rol = _roles.find((r) => r.id === usuario.rolId || r.nombre === usuario.rol);
    const punto = _puntosVenta.find((p) => p.id === usuario.puntoVentaId);
    const payload = {
      ...usuario,
      rolId: rol?.id || usuario.rolId || "rol-cajero",
      rol: rol?.nombre || usuario.rol || "cajero",
      puntoVentaNombre: punto?.nombre || "",
      activo: usuario.activo !== false,
    };
    _usuarios = _usuarios.map((u) => (u.id === payload.id ? { ...u, ...payload } : u));
    await registrarAuditoria({ idUsuario: idUsuarioActor, accion: "EDITAR_USUARIO", tabla: "usuarios", registroId: payload.id, detalle: { nombre: payload.nombre, correo: payload.correo, rol: payload.rol, activo: payload.activo } });
    return wait(payload);
  }
  const payload = {
    nombre: usuario.nombre,
    documento: usuario.documento || null,
    telefono: usuario.telefono || null,
    id_rol: usuario.rolId || null,
    id_punto: usuario.puntoVentaId || null,
    activo: usuario.activo !== false,
  };
  const { error } = await supabase.from("usuarios").update(payload).eq("id_usuario", usuario.id);
  if (error) throw error;
  await registrarAuditoria({ idUsuario: idUsuarioActor, accion: "EDITAR_USUARIO", tabla: "usuarios", registroId: usuario.id, detalle: { nombre: usuario.nombre, rolId: usuario.rolId, puntoVentaId: usuario.puntoVentaId, activo: usuario.activo !== false } });
  return usuario;
}

export async function crearUsuarioApp(usuario) {
  if (modoDemo) {
    const rol = _roles.find((r) => r.id === usuario.rolId || r.nombre === usuario.rol);
    const punto = _puntosVenta.find((p) => p.id === usuario.puntoVentaId);
    const nuevo = {
      ...usuario,
      id: "usr-" + Date.now(),
      rolId: rol?.id || usuario.rolId || "rol-cajero",
      rol: rol?.nombre || usuario.rol || "cajero",
      puntoVentaNombre: punto?.nombre || "",
      activo: true,
    };
    _usuarios = [nuevo, ..._usuarios];
    return wait(nuevo);
  }
  const { data, error } = await supabase.functions.invoke("admin-usuarios", {
    body: { action: "create", usuario },
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("Failed to send a request")) {
      throw new Error("No se pudo contactar la Edge Function admin-usuarios. Verifica que este desplegada en Supabase.");
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data?.usuario;
}

export async function actualizarPasswordUsuario(usuarioId, password) {
  if (modoDemo) return wait(true);
  const { data, error } = await supabase.functions.invoke("admin-usuarios", {
    body: { action: "password", usuarioId, password },
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("Failed to send a request")) {
      throw new Error("No se pudo contactar la Edge Function admin-usuarios. Verifica que este desplegada en Supabase.");
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return true;
}

export async function registrarAuditoria({ idUsuario, accion, tabla, registroId, detalle }) {
  const item = {
    id: "aud-" + Date.now() + "-" + Math.random().toString(16).slice(2),
    idUsuario: idUsuario || null,
    usuario: idUsuario === "demo" ? "Administrador (demo)" : "",
    accion,
    tabla,
    registroId: registroId ? String(registroId) : null,
    detalle: detalle || {},
    fecha: new Date().toISOString(),
  };
  if (modoDemo) {
    _auditoria = [item, ..._auditoria].slice(0, 500);
    return wait(item);
  }
  const { error } = await supabase.from("auditoria").insert({
    id_usuario: idUsuario || null,
    accion,
    tabla_afectada: tabla,
    registro_id: registroId ? String(registroId) : null,
    detalle: detalle || {},
  });
  if (error) throw error;
  return item;
}

export async function listAuditoria({ desde, hasta, accion, tabla, idUsuario } = {}) {
  if (modoDemo) {
    return wait(_auditoria.filter((a) => {
      const f = new Date(a.fecha);
      if (desde && f < new Date(desde)) return false;
      if (hasta && f > new Date(hasta)) return false;
      if (accion && accion !== "todos" && a.accion !== accion) return false;
      if (tabla && tabla !== "todos" && a.tabla !== tabla) return false;
      if (idUsuario && idUsuario !== "todos" && a.idUsuario !== idUsuario) return false;
      return true;
    }));
  }
  let q = supabase
    .from("auditoria")
    .select("id_auditoria, id_usuario, accion, tabla_afectada, registro_id, detalle, fecha, usuarios(nombre, correo)")
    .order("fecha", { ascending: false })
    .limit(1000);
  if (desde) q = q.gte("fecha", new Date(desde).toISOString());
  if (hasta) q = q.lte("fecha", new Date(hasta).toISOString());
  if (accion && accion !== "todos") q = q.eq("accion", accion);
  if (tabla && tabla !== "todos") q = q.eq("tabla_afectada", tabla);
  if (idUsuario && idUsuario !== "todos") q = q.eq("id_usuario", idUsuario);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((a) => ({
    id: a.id_auditoria,
    idUsuario: a.id_usuario,
    usuario: a.usuarios?.nombre || "Sistema",
    correo: a.usuarios?.correo || "",
    accion: a.accion,
    tabla: a.tabla_afectada,
    registroId: a.registro_id,
    detalle: a.detalle || {},
    fecha: a.fecha,
  }));
}

export async function getConfiguracionNegocio() {
  if (modoDemo) {
    aplicarConfiguracionNegocio(_configuracionNegocio);
    return wait(_configuracionNegocio);
  }
  const { data, error } = await supabase
    .from("configuracion_negocio")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  const config = data ? {
    nombre: data.nombre,
    nit: data.nit,
    direccion: data.direccion,
    telefono: data.telefono,
    correo: data.correo,
    resolucionDian: data.resolucion_dian,
    logoUrl: data.logo_url || "",
    prefijoFactura: data.prefijo_factura || "FAC",
    menuOrden: Array.isArray(data.menu_orden) ? data.menu_orden : [],
    menuOculto: Array.isArray(data.menu_oculto) ? data.menu_oculto : [],
    impuestoRate: Number(data.impuesto_rate ?? 0.08),
  } : _configuracionNegocio;
  aplicarConfiguracionNegocio(config);
  return config;
}

export async function saveConfiguracionNegocio(config, idUsuario) {
  const payload = {
    nombre: config.nombre,
    nit: config.nit,
    direccion: config.direccion,
    telefono: config.telefono,
    correo: config.correo,
    resolucionDian: config.resolucionDian,
    logoUrl: config.logoUrl || "",
    prefijoFactura: config.prefijoFactura || "FAC",
    menuOrden: Array.isArray(config.menuOrden) ? config.menuOrden : [],
    menuOculto: Array.isArray(config.menuOculto) ? config.menuOculto : [],
    impuestoRate: Number(config.impuestoRate) || 0,
  };
  if (modoDemo) {
    _configuracionNegocio = { ..._configuracionNegocio, ...payload };
    aplicarConfiguracionNegocio(_configuracionNegocio);
    await registrarAuditoria({ idUsuario, accion: "EDITAR_CONFIGURACION", tabla: "configuracion_negocio", registroId: "principal", detalle: payload });
    return wait(_configuracionNegocio);
  }
  const row = {
    id: true,
    nombre: payload.nombre,
    nit: payload.nit,
    direccion: payload.direccion,
    telefono: payload.telefono,
    correo: payload.correo,
    resolucion_dian: payload.resolucionDian,
    logo_url: payload.logoUrl,
    prefijo_factura: payload.prefijoFactura,
    menu_orden: payload.menuOrden,
    menu_oculto: payload.menuOculto,
    impuesto_rate: payload.impuestoRate,
  };
  const { error } = await supabase.from("configuracion_negocio").upsert(row, { onConflict: "id" });
  if (error) throw error;
  aplicarConfiguracionNegocio(payload);
  await registrarAuditoria({ idUsuario, accion: "EDITAR_CONFIGURACION", tabla: "configuracion_negocio", registroId: "principal", detalle: payload });
  return payload;
}

export async function listProductos() {
  if (modoDemo) return wait(_productos);
  let { data, error } = await supabase
    .from("productos")
    .select("*, categorias(nombre_categoria), recetas(id_ingrediente, cantidad), producto_variantes(id_variante, nombre, precio_venta, costo_estimado, activo)")
    .order("nombre");
  if (esTablaVariantesFaltante(error)) {
    const fallback = await supabase
      .from("productos")
      .select("*, categorias(nombre_categoria), recetas(id_ingrediente, cantidad)")
      .order("nombre");
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data.map(mapProducto);
}

export async function listIngredientes() {
  if (modoDemo) return wait(_ingredientes);
  // Stock por bodega vive en `inventario`; aquí tomamos el agregado del primer registro.
  const { data, error } = await supabase
    .from("ingredientes")
    .select("*, inventario(stock_actual, stock_minimo)")
    .order("nombre");
  if (error) throw error;
  return data.map((row) => {
    const inv = row.inventario?.[0];
    const base = mapIngrediente(row);
    return inv ? { ...base, stock: Number(inv.stock_actual), stockMin: Number(inv.stock_minimo) } : base;
  });
}

export async function listVentas() {
  if (modoDemo) return wait(_ventas);
  const { data, error } = await supabase
    .from("ventas")
    .select("id_venta, numero, fecha, estado, total, id_caja, id_punto, puntos_venta(nombre), pagos(monto, metodos_pago(nombre)), detalle_venta(id_producto, descripcion, cantidad, precio_unitario, subtotal, productos(costo_estimado, categorias(nombre_categoria)))")
    .eq("estado", "pagada")
    .order("fecha", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map((v) => ({
    id: v.id_venta,
    fecha: v.fecha,
    tipo: "FACTURA",
    total: Number(v.total),
    id_caja: v.id_caja,
    id_punto: v.id_punto,
    puntoVenta: v.puntos_venta?.nombre || "Sin local",
    pago: (v.pagos || []).map((p) => p.metodos_pago?.nombre).filter(Boolean).join(" + ") || "Efectivo",
    pagos: (v.pagos || []).map((p) => ({ metodo: p.metodos_pago?.nombre || "Efectivo", monto: Number(p.monto) || 0 })),
    lineas: (v.detalle_venta || []).map((d) => ({
      productoId: d.id_producto,
      nombre: d.descripcion,
      cantidad: Number(d.cantidad),
      precio: Number(d.precio_unitario),
      costo: Number(d.productos?.costo_estimado) || 0,
      cat: catIdLocal(d.productos?.categorias?.nombre_categoria),
    })),
  }));
}

export async function saveProducto(p, idUsuario) {
  const accion = p.id ? "EDITAR_PRODUCTO" : "CREAR_PRODUCTO";
  const variantes = (p.variantes || [])
    .map((v) => ({
      id: v.id || null,
      nombre: (v.nombre || "").trim(),
      precio: Number(v.precio) || 0,
      costo: Number(v.costo) || 0,
      activo: v.activo !== false,
    }))
    .filter((v) => v.nombre && v.precio >= 0);
  if (modoDemo) {
    const payloadDemo = { ...p, variantes };
    if (p.id && _productos.some((x) => x.id === p.id)) {
      _productos = _productos.map((x) => (x.id === p.id ? { ...x, ...payloadDemo } : x));
    } else {
      _productos = [..._productos, { ...payloadDemo, id: "p" + Date.now() }];
    }
    await registrarAuditoria({ idUsuario, accion, tabla: "productos", registroId: p.id || p.nombre, detalle: { nombre: p.nombre, precio: p.precio, activo: p.activo !== false } });
    return wait(p);
  }
  const id_categoria = await uuidCategoria(p.cat);
  const payload = {
    nombre: p.nombre,
    descripcion: p.desc,
    precio_venta: p.precio,
    costo_estimado: p.costo,
    imagen_url: p.imagen || null,
    controla_inventario: p.controlaInventario,
    stock_actual: p.controlaInventario && !(p.receta || []).length ? Number(p.stock || 0) : 0,
    stock_minimo: p.controlaInventario && !(p.receta || []).length ? Number(p.stockMin || 0) : 0,
    activo: p.activo !== false,
    id_categoria,
  };
  let prodId = p.id;
  if (prodId) {
    const { error } = await supabase.from("productos").update(payload).eq("id_producto", prodId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("productos").insert(payload).select("id_producto").single();
    if (error) throw error;
    prodId = data.id_producto;
  }
  // Reemplazar receta
  await supabase.from("recetas").delete().eq("id_producto", prodId);
  if ((p.receta || []).length) {
    await supabase.from("recetas").insert(p.receta.map((r) => ({ id_producto: prodId, id_ingrediente: r.ingredienteId, cantidad: r.cantidad })));
  }
  const { error: eDeleteVariantes } = await supabase.from("producto_variantes").delete().eq("id_producto", prodId);
  if (esTablaVariantesFaltante(eDeleteVariantes) && variantes.length) {
    throw new Error("Falta crear la tabla producto_variantes en Supabase para guardar precios por variante.");
  } else if (eDeleteVariantes && !esTablaVariantesFaltante(eDeleteVariantes)) {
    throw eDeleteVariantes;
  }
  if (variantes.length) {
    const { error: eVariantes } = await supabase.from("producto_variantes").insert(variantes.map((v) => ({
      id_producto: prodId,
      nombre: v.nombre,
      precio_venta: v.precio,
      costo_estimado: v.costo,
      activo: v.activo,
    })));
    if (eVariantes) throw eVariantes;
  }
  await registrarAuditoria({ idUsuario, accion, tabla: "productos", registroId: prodId, detalle: { nombre: p.nombre, precio: p.precio, activo: p.activo !== false } });
  return { ...p, id: prodId, variantes };
}

export async function deleteProducto(id) {
  if (modoDemo) { _productos = _productos.filter((x) => x.id !== id); return wait(true); }
  const { error } = await supabase.from("productos").delete().eq("id_producto", id);
  if (error) throw error;
  return true;
}

export async function saveIngrediente(g, idUsuario) {
  const accion = g.id ? "EDITAR_INSUMO" : "CREAR_INSUMO";
  if (modoDemo) {
    if (g.id && _ingredientes.some((x) => x.id === g.id)) {
      _ingredientes = _ingredientes.map((x) => (x.id === g.id ? { ...x, ...g } : x));
    } else {
      _ingredientes = [..._ingredientes, { ...g, id: "i" + Date.now() }];
    }
    await registrarAuditoria({ idUsuario, accion, tabla: "ingredientes", registroId: g.id || g.nombre, detalle: { nombre: g.nombre, stock: g.stock, stockMin: g.stockMin, costo: g.costo } });
    return wait(g);
  }
  const payload = { nombre: g.nombre, unidad_medida: g.unidad, costo_unitario: g.costo };
  let ingId = g.id;
  if (ingId) {
    const { error } = await supabase.from("ingredientes").update(payload).eq("id_ingrediente", ingId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("ingredientes").insert(payload).select("id_ingrediente").single();
    if (error) throw error;
    ingId = data.id_ingrediente;
  }
  // Stock vive en inventario (asume una bodega; toma la primera)
  const { data: bod } = await supabase.from("bodegas").select("id_bodega").limit(1).single();
  if (bod) {
    await supabase.from("inventario").upsert(
      { id_ingrediente: ingId, id_bodega: bod.id_bodega, stock_actual: g.stock, stock_minimo: g.stockMin },
      { onConflict: "id_ingrediente,id_bodega" }
    );
  }
  await registrarAuditoria({ idUsuario, accion, tabla: "ingredientes", registroId: ingId, detalle: { nombre: g.nombre, stock: g.stock, stockMin: g.stockMin, costo: g.costo } });
  return { ...g, id: ingId };
}

export async function deleteIngrediente(id) {
  if (modoDemo) { _ingredientes = _ingredientes.filter((x) => x.id !== id); return wait(true); }
  const { error } = await supabase.from("ingredientes").delete().eq("id_ingrediente", id);
  if (error) throw error;
  return true;
}

// Ajuste manual de stock (diferencia de conteo físico, merma, daño...).
// `delta` puede ser positivo (entrada) o negativo (salida); el stock nunca queda negativo.
export async function ajustarStock({ id, delta, motivo, nota, idUsuario }) {
  if (modoDemo) {
    _ingredientes = _ingredientes.map((i) => (i.id === id ? { ...i, stock: Math.max(0, i.stock + delta) } : i));
    await registrarAuditoria({ idUsuario, accion: "AJUSTAR_STOCK", tabla: "inventario", registroId: id, detalle: { delta, motivo, nota } });
    return wait(true);
  }
  const { data: bod } = await supabase.from("bodegas").select("id_bodega").limit(1).single();
  if (!bod) throw new Error("No hay bodegas configuradas");
  const { data: inv } = await supabase.from("inventario").select("stock_actual").eq("id_ingrediente", id).eq("id_bodega", bod.id_bodega).maybeSingle();
  const nuevoStock = Math.max(0, (Number(inv?.stock_actual) || 0) + delta);
  const { error } = await supabase.from("inventario").upsert(
    { id_ingrediente: id, id_bodega: bod.id_bodega, stock_actual: nuevoStock },
    { onConflict: "id_ingrediente,id_bodega" }
  );
  if (error) throw error;
  await supabase.from("movimientos_inventario").insert({
    id_ingrediente: id, id_bodega: bod.id_bodega, tipo: "ajuste", cantidad: delta,
    referencia: `ajuste manual (${motivo})${nota ? `: ${nota}` : ""}`,
    id_usuario: idUsuario || null,
  });
  await registrarAuditoria({ idUsuario, accion: "AJUSTAR_STOCK", tabla: "inventario", registroId: id, detalle: { delta, motivo, nota, stockAnterior: Number(inv?.stock_actual) || 0, stockNuevo: nuevoStock } });
  return true;
}

export function siguienteNumero(tipo) {
  const pref = tipo === "FACTURA" ? (EMPRESA.prefijoFactura || "FAC") : "COT";
  const n = _seq[tipo] || 1;
  return `${pref}-${String(n).padStart(4, "0")}`;
}

// Persiste una FACTURA y descuenta inventario. (La cotización no se persiste.)
// `pagos`: arreglo opcional [{ metodo, monto }] para pago mixto; si no se da, se usa `pago` por el total.
export async function crearFactura({ numero, cliente, pago, pagos, lineas, subtotal, descuento, impuestos, total, id_caja, id_usuario, id_cliente, id_punto }) {
  const metodosPago = pagos && pagos.length ? pagos : [{ metodo: pago, monto: total }];
  if (modoDemo) {
    _seq.FACTURA += 1;
    const fecha = new Date().toISOString();
    const pagoTxt = metodosPago.length > 1 ? metodosPago.map((p) => p.metodo).join(" + ") : metodosPago[0].metodo;
    const puntoDemo = _puntosVenta.find((p) => p.id === id_punto) || _puntosVenta[0];
    _ventas = [..._ventas, { id: numero, numero, fecha, tipo: "FACTURA", cliente, pago: pagoTxt, descuento: descuento || 0, lineas, total, id_caja, id_cliente: id_cliente || null, id_punto: puntoDemo?.id, puntoVenta: puntoDemo?.nombre || "Punto de venta principal", estado: "pagada" }];
    // Descontar stock según recetas
    const consumo = consumoCarrito(lineas.map((l) => ({ id: l.productoId, cantidad: l.cantidad })), _productos);
    _ingredientes = _ingredientes.map((i) =>
      consumo[i.id] ? { ...i, stock: Math.max(0, i.stock - consumo[i.id]) } : i
    );
    const consumoDirecto = consumoProductosDirectos(lineas);
    _productos = _productos.map((p) =>
      consumoDirecto[p.id] ? { ...p, stock: Math.max(0, Number(p.stock || 0) - consumoDirecto[p.id]) } : p
    );
    await registrarAuditoria({ idUsuario: id_usuario, accion: "CREAR_VENTA", tabla: "ventas", registroId: numero, detalle: { cliente, total, pago: pagoTxt, local: puntoDemo?.nombre } });
    return wait({ id: numero, numero, fecha });
  }
  // Supabase: requiere al menos un punto_venta (con bodega) y un método de pago.
  let punto = id_punto ? { id_punto } : null;
  if (!punto) {
    const { data } = await supabase.from("puntos_venta").select("id_punto").eq("activo", true).order("nombre").limit(1).single();
    punto = data;
  }
  const { data: venta, error } = await supabase
    .from("ventas")
    .insert({ id_punto: punto?.id_punto, id_caja: id_caja || null, id_usuario: id_usuario || null, id_cliente: id_cliente || null, subtotal, descuento: descuento || 0, impuestos, total, estado: "pagada", notas: cliente })
    .select("id_venta, numero, fecha")
    .single();
  if (error) throw error;
  // detalle_venta -> el trigger de la BD descuenta inventario automáticamente
  await supabase.from("detalle_venta").insert(
    lineas.map((l) => ({
      id_venta: venta.id_venta,
      id_producto: l.productoId,
      descripcion: l.nombre,
      cantidad: l.cantidad,
      precio_unitario: l.precio,
      descuento: Math.round(l.precio * l.cantidad * (Number(l.descuento) || 0) / 100),
      subtotal: l.precio * l.cantidad,
    }))
  );
  for (const pg of metodosPago) {
    if (!pg.monto) continue;
    const { data: metodo } = await supabase.from("metodos_pago").select("id_metodo").ilike("nombre", pg.metodo).limit(1).single();
    if (metodo) await supabase.from("pagos").insert({ id_venta: venta.id_venta, id_metodo: metodo.id_metodo, monto: pg.monto });
  }
  const numeroVisible = venta.numero ? `${EMPRESA.prefijoFactura || "FAC"}-${String(venta.numero).padStart(4, "0")}` : numero;
  await registrarAuditoria({ idUsuario: id_usuario, accion: "CREAR_VENTA", tabla: "ventas", registroId: venta.id_venta, detalle: { numero: numeroVisible, cliente, total, pago: metodosPago.map((p) => p.metodo).join(" + "), id_punto: punto?.id_punto } });
  return { id: venta.id_venta, numero: numeroVisible, fecha: venta.fecha };
}

/* ============================ Proveedores ============================ */
const mapProveedor = (row) => ({
  id: row.id_proveedor,
  nombre: row.nombre,
  nit: row.nit || "",
  telefono: row.telefono || "",
  correo: row.correo || "",
  activo: row.activo,
});

export async function listProveedores() {
  if (modoDemo) return wait(_proveedores);
  const { data, error } = await supabase.from("proveedores").select("*").order("nombre");
  if (error) throw error;
  return data.map(mapProveedor);
}

export async function saveProveedor(p) {
  if (modoDemo) {
    if (p.id && _proveedores.some((x) => x.id === p.id)) {
      _proveedores = _proveedores.map((x) => (x.id === p.id ? { ...x, ...p } : x));
    } else {
      _proveedores = [..._proveedores, { ...p, id: "prov" + Date.now(), activo: p.activo !== false }];
    }
    return wait(p);
  }
  const payload = { nombre: p.nombre, nit: p.nit || null, telefono: p.telefono || null, correo: p.correo || null, activo: p.activo !== false };
  let provId = p.id;
  if (provId) {
    const { error } = await supabase.from("proveedores").update(payload).eq("id_proveedor", provId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("proveedores").insert(payload).select("id_proveedor").single();
    if (error) throw error;
    provId = data.id_proveedor;
  }
  return { ...p, id: provId };
}

export async function deleteProveedor(id) {
  if (modoDemo) { _proveedores = _proveedores.filter((x) => x.id !== id); return wait(true); }
  const { error } = await supabase.from("proveedores").delete().eq("id_proveedor", id);
  if (error) throw error;
  return true;
}

/* ============================ Compras ============================ */
export async function listCompras() {
  if (modoDemo) return wait(_compras);
  const { data, error } = await supabase
    .from("compras")
    .select("id_compra, fecha, numero_factura, subtotal, impuestos, total, proveedores(id_proveedor, nombre), detalle_compra(id_ingrediente, id_producto, cantidad, costo_unitario, subtotal, ingredientes(nombre, unidad_medida), productos(nombre))")
    .order("fecha", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data.map((c) => ({
    id: c.id_compra,
    fecha: c.fecha,
    numeroFactura: c.numero_factura || "",
    proveedorId: c.proveedores?.id_proveedor || null,
    proveedor: c.proveedores?.nombre || "Sin proveedor",
    subtotal: Number(c.subtotal),
    impuestos: Number(c.impuestos),
    total: Number(c.total),
    items: (c.detalle_compra || []).map((d) => ({
      tipo: d.id_producto ? "producto" : "ingrediente",
      ingredienteId: d.id_ingrediente,
      productoId: d.id_producto,
      nombre: d.productos?.nombre || d.ingredientes?.nombre || "",
      unidad: d.id_producto ? "und" : (d.ingredientes?.unidad_medida || ""),
      cantidad: Number(d.cantidad),
      costoUnitario: Number(d.costo_unitario),
      subtotal: Number(d.subtotal),
    })),
  }));
}

// Registra una compra de insumos: suma stock y actualiza el costo del ingrediente (último precio de compra).
export async function crearCompra({ idProveedor, numeroFactura, fecha, items, idUsuario }) {
  const productosCompra = items.filter((it) => it.productoId);
  const validarProductoCompraDemo = (producto) => {
    if (!producto) return "Producto no encontrado";
    if (producto.activo === false) return `El producto "${producto.nombre}" esta inactivo`;
    if (!producto.controlaInventario) return `El producto "${producto.nombre}" no controla inventario`;
    if ((producto.receta || []).length) return `El producto "${producto.nombre}" maneja receta; compra sus insumos, no el producto final`;
    return null;
  };
  const subtotal = items.reduce((s, it) => s + it.cantidad * it.costoUnitario, 0);
  const total = subtotal;
  const fechaISO = fecha || new Date().toISOString();

  if (modoDemo) {
    for (const it of productosCompra) {
      const errorProducto = validarProductoCompraDemo(_productos.find((p) => p.id === it.productoId));
      if (errorProducto) throw new Error(errorProducto);
    }
    const proveedor = _proveedores.find((p) => p.id === idProveedor);
    const itemsConDatos = items.map((it) => {
      if (it.productoId) {
        const prod = _productos.find((p) => p.id === it.productoId);
        return { ...it, tipo: "producto", nombre: prod?.nombre || "", unidad: "und", subtotal: it.cantidad * it.costoUnitario };
      }
      const ing = _ingredientes.find((i) => i.id === it.ingredienteId);
      return { ...it, tipo: "ingrediente", nombre: ing?.nombre || "", unidad: ing?.unidad || "", subtotal: it.cantidad * it.costoUnitario };
    });
    const id = "compra" + Date.now();
    _compras = [{ id, fecha: fechaISO, numeroFactura: numeroFactura || "", proveedorId: idProveedor || null, proveedor: proveedor?.nombre || "Sin proveedor", subtotal, impuestos: 0, total, items: itemsConDatos }, ..._compras];
    // Suma de stock y actualización de costo (igual al trigger fn_entrada_inventario)
    _ingredientes = _ingredientes.map((i) => {
      const it = items.find((x) => x.ingredienteId === i.id);
      return it ? { ...i, stock: i.stock + it.cantidad, costo: it.costoUnitario } : i;
    });
    _productos = _productos.map((p) => {
      const it = items.find((x) => x.productoId === p.id);
      return it ? { ...p, stock: Number(p.stock || 0) + it.cantidad, costo: it.costoUnitario } : p;
    });
    await registrarAuditoria({ idUsuario, accion: "CREAR_COMPRA", tabla: "inventario", registroId: id, detalle: { proveedor: proveedor?.nombre || "Sin proveedor", total, items: itemsConDatos.length } });
    return wait({ id, fecha: fechaISO });
  }

  if (productosCompra.length) {
    const idsProductos = [...new Set(productosCompra.map((it) => it.productoId).filter(Boolean))];
    const { data: productosCompraDb, error: errorProductosCompra } = await supabase
      .from("productos")
      .select("id_producto, nombre, activo, controla_inventario, recetas(id_producto)")
      .in("id_producto", idsProductos);
    if (errorProductosCompra) throw errorProductosCompra;
    for (const id of idsProductos) {
      const prod = (productosCompraDb || []).find((p) => p.id_producto === id);
      if (!prod) throw new Error("Uno de los productos seleccionados ya no existe en inventario");
      if (prod.activo === false) throw new Error(`El producto "${prod.nombre}" esta inactivo`);
      if (!prod.controla_inventario) throw new Error(`El producto "${prod.nombre}" no controla inventario`);
      if ((prod.recetas || []).length) throw new Error(`El producto "${prod.nombre}" maneja receta; compra sus insumos, no el producto final`);
    }
  }

  const { data: bod } = await supabase.from("bodegas").select("id_bodega").limit(1).single();
  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      id_proveedor: idProveedor || null,
      id_bodega: bod?.id_bodega,
      id_usuario: idUsuario || null,
      fecha: fechaISO,
      numero_factura: numeroFactura || null,
      subtotal,
      impuestos: 0,
      total,
    })
    .select("id_compra, fecha")
    .single();
  if (error) throw error;
  // detalle_compra -> el trigger de la BD suma stock y actualiza el costo del ingrediente
  const { error: e2 } = await supabase.from("detalle_compra").insert(
    items.map((it) => ({
      id_compra: compra.id_compra,
      id_ingrediente: it.ingredienteId || null,
      id_producto: it.productoId || null,
      cantidad: it.cantidad,
      costo_unitario: it.costoUnitario,
      subtotal: it.cantidad * it.costoUnitario,
    }))
  );
  if (e2) throw e2;
  await registrarAuditoria({ idUsuario, accion: "CREAR_COMPRA", tabla: "inventario", registroId: compra.id_compra, detalle: { proveedor: idProveedor || "Sin proveedor", total, items: items.length } });
  return { id: compra.id_compra, fecha: compra.fecha };
}

/* ============================ Clientes ============================ */
const mapCliente = (row) => ({
  id: row.id_cliente,
  nombre: row.nombre,
  documento: row.documento || "",
  telefono: row.telefono || "",
  correo: row.correo || "",
});

export async function listClientes() {
  if (modoDemo) return wait(_clientes);
  const { data, error } = await supabase.from("clientes").select("*").order("nombre");
  if (error) throw error;
  return data.map(mapCliente);
}

export async function saveCliente(c) {
  if (modoDemo) {
    let guardado;
    if (c.id && _clientes.some((x) => x.id === c.id)) {
      _clientes = _clientes.map((x) => {
        if (x.id !== c.id) return x;
        guardado = { ...x, ...c };
        return guardado;
      });
    } else {
      guardado = { ...c, id: "cli" + Date.now() };
      _clientes = [..._clientes, guardado];
    }
    return wait(guardado);
  }
  const payload = { nombre: c.nombre, documento: c.documento || null, telefono: c.telefono || null, correo: c.correo || null };
  let cliId = c.id;
  if (cliId) {
    const { error } = await supabase.from("clientes").update(payload).eq("id_cliente", cliId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("clientes").insert(payload).select("id_cliente").single();
    if (error) throw error;
    cliId = data.id_cliente;
  }
  return { ...c, id: cliId };
}

export async function deleteCliente(id) {
  if (modoDemo) { _clientes = _clientes.filter((x) => x.id !== id); return wait(true); }
  const { error } = await supabase.from("clientes").delete().eq("id_cliente", id);
  if (error) throw error;
  return true;
}

/* ============================ Historial de ventas ============================ */
const numeroFmt = (n) => (typeof n === "number" ? `${EMPRESA.prefijoFactura || "FAC"}-${String(n).padStart(4, "0")}` : n);

// Lista TODAS las ventas (pagadas y anuladas) con datos para el historial: cliente, cajero y líneas para reimpresión.
export async function listVentasHistorial() {
  if (modoDemo) {
    return clon(_ventas)
      .map((v) => ({
        id: v.id,
        numero: numeroFmt(v.numero || v.id),
        fecha: v.fecha,
        tipo: "FACTURA",
        cliente: v.cliente || "Consumidor final",
        id_cliente: v.id_cliente || null,
        clienteDocumento: v.clienteDocumento || "",
        clienteTelefono: v.clienteTelefono || "",
        clienteCorreo: v.clienteCorreo || "",
        id_punto: v.id_punto || "pv-principal",
        id_caja: v.id_caja || null,
        puntoVenta: v.puntoVenta || "Punto de venta principal",
        pago: v.pago,
        pagos: [{ metodo: v.pago || "Efectivo", monto: Number(v.total) || 0 }],
        pagado: Number(v.total) || 0,
        saldoPendiente: 0,
        cajeroId: v.id_usuario || "demo",
        cajero: "Administrador (demo)",
        estado: v.estado || "pagada",
        total: v.total,
        lineas: v.lineas,
      }))
      .reverse();
  }
  const { data, error } = await supabase
    .from("ventas")
    .select("id_venta, numero, fecha, estado, subtotal, descuento, impuestos, total, notas, id_cliente, id_punto, id_caja, id_usuario, puntos_venta(nombre), pagos(monto, metodos_pago(nombre)), usuarios(nombre), clientes(nombre, documento, telefono, correo), detalle_venta(id_producto, descripcion, cantidad, precio_unitario, subtotal, productos(costo_estimado, categorias(nombre_categoria)))")
    .order("fecha", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map((v) => ({
    id: v.id_venta,
    numero: numeroFmt(v.numero),
    fecha: v.fecha,
    tipo: "FACTURA",
    cliente: v.clientes?.nombre || v.notas || "Consumidor final",
    clienteDocumento: v.clientes?.documento || "",
    clienteTelefono: v.clientes?.telefono || "",
    clienteCorreo: v.clientes?.correo || "",
    id_cliente: v.id_cliente,
    id_punto: v.id_punto,
    id_caja: v.id_caja,
    puntoVenta: v.puntos_venta?.nombre || "Sin local",
    pago: (v.pagos || []).map((p) => p.metodos_pago?.nombre).filter(Boolean).join(" + ") || "Efectivo",
    pagos: (v.pagos || []).map((p) => ({ metodo: p.metodos_pago?.nombre || "Efectivo", monto: Number(p.monto) || 0 })),
    pagado: (v.pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0),
    saldoPendiente: Math.max(0, (Number(v.total) || 0) - (v.pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0)),
    cajeroId: v.id_usuario || null,
    cajero: v.usuarios?.nombre || "—",
    estado: v.estado,
    subtotal: Number(v.subtotal) || 0,
    descuento: Number(v.descuento) || 0,
    impuestos: Number(v.impuestos) || 0,
    total: Number(v.total),
    lineas: (v.detalle_venta || []).map((d) => ({
      productoId: d.id_producto,
      nombre: d.descripcion,
      cantidad: Number(d.cantidad),
      precio: Number(d.precio_unitario),
      costo: Number(d.productos?.costo_estimado) || 0,
      cat: catIdLocal(d.productos?.categorias?.nombre_categoria),
    })),
  }));
}

// Anula una venta: marca su estado y devuelve al inventario los ingredientes que había descontado.
export async function anularVenta(idVenta, idUsuario) {
  if (modoDemo) {
    const venta = _ventas.find((v) => v.id === idVenta);
    if (!venta) throw new Error("Venta no encontrada");
    if (venta.estado === "anulada") return true;
    const consumo = consumoCarrito(venta.lineas.map((l) => ({ id: l.productoId, cantidad: l.cantidad })), _productos);
    _ingredientes = _ingredientes.map((i) => (consumo[i.id] ? { ...i, stock: i.stock + consumo[i.id] } : i));
    const consumoDirecto = consumoProductosDirectos(venta.lineas || []);
    _productos = _productos.map((p) => (consumoDirecto[p.id] ? { ...p, stock: Number(p.stock || 0) + consumoDirecto[p.id] } : p));
    _ventas = _ventas.map((v) => (v.id === idVenta ? { ...v, estado: "anulada" } : v));
    await registrarAuditoria({ idUsuario, accion: "ANULAR_VENTA", tabla: "ventas", registroId: idVenta, detalle: { numero: venta.numero || venta.id, total: venta.total } });
    return true;
  }

  const { data: venta, error: e1 } = await supabase.from("ventas").select("id_venta, numero, id_punto, estado, total").eq("id_venta", idVenta).single();
  if (e1) throw e1;
  if (venta.estado === "anulada") return true;

  const { data: punto } = await supabase.from("puntos_venta").select("id_bodega").eq("id_punto", venta.id_punto).single();
  const { data: detalle } = await supabase.from("detalle_venta").select("id_producto, cantidad").eq("id_venta", idVenta);

  for (const d of detalle || []) {
    if (!d.id_producto) continue;
    const { data: prod } = await supabase.from("productos").select("controla_inventario").eq("id_producto", d.id_producto).single();
    if (!prod?.controla_inventario) continue;
    const { data: receta } = await supabase.from("recetas").select("id_ingrediente, cantidad").eq("id_producto", d.id_producto);
    if (!(receta || []).length) {
      const { data: actual } = await supabase.from("productos").select("stock_actual").eq("id_producto", d.id_producto).single();
      await supabase
        .from("productos")
        .update({ stock_actual: (Number(actual?.stock_actual) || 0) + Number(d.cantidad || 0) })
        .eq("id_producto", d.id_producto);
      continue;
    }
    for (const r of receta || []) {
      const cantidad = Number(r.cantidad) * Number(d.cantidad);
      const { data: inv } = await supabase
        .from("inventario")
        .select("stock_actual")
        .eq("id_ingrediente", r.id_ingrediente)
        .eq("id_bodega", punto.id_bodega)
        .single();
      if (inv) {
        await supabase
          .from("inventario")
          .update({ stock_actual: Number(inv.stock_actual) + cantidad })
          .eq("id_ingrediente", r.id_ingrediente)
          .eq("id_bodega", punto.id_bodega);
      }
      await supabase.from("movimientos_inventario").insert({
        id_ingrediente: r.id_ingrediente,
        id_bodega: punto.id_bodega,
        tipo: "ajuste",
        cantidad,
        referencia: "anulacion:" + idVenta,
      });
    }
  }

  const { error } = await supabase.from("ventas").update({ estado: "anulada" }).eq("id_venta", idVenta);
  if (error) throw error;
  await registrarAuditoria({ idUsuario, accion: "ANULAR_VENTA", tabla: "ventas", registroId: idVenta, detalle: { numero: numeroFmt(venta.numero), total: Number(venta.total) || 0 } });
  return true;
}

/* ============================ Reservas ============================ */
const ESTADOS_BLOQUEAN_RESERVA = ["pendiente", "confirmada", "en_curso"];

const recursoNombre = (r) => r.nombre || (r.tipo === "apartamento" ? "Apartamento" : "Espacio");
const recursoPrecio = (r) => Number(r.precio || r.precio_dia || r.precio_base || 0);
const recursoIdCampo = (tipo) => (tipo === "apartamento" ? "id_apartamento" : "id_espacio");

const hayCruceFechas = (aInicio, aFin, bInicio, bFin) => {
  const ai = new Date(aInicio).getTime();
  const af = new Date(aFin).getTime();
  const bi = new Date(bInicio).getTime();
  const bf = new Date(bFin).getTime();
  return ai < bf && af > bi;
};

const mapReserva = (r) => {
  const tipo = r.tipo;
  const recurso = tipo === "apartamento" ? r.apartamentos : r.espacios_evento;
  const anticipos = r.pagos || [];
  const pagado = anticipos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const montoTotal = Number(r.monto_total) || 0;
  return {
    id: r.id_reserva,
    tipo,
    recursoId: tipo === "apartamento" ? r.id_apartamento : r.id_espacio,
    recursoNombre: recurso?.nombre || "Recurso",
    clienteId: r.id_cliente || null,
    cliente: r.clientes?.nombre || "Consumidor final",
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    personas: Number(r.num_personas) || 0,
    montoTotal,
    anticipo: pagado,
    pagosReserva: anticipos.map((p) => ({
      monto: Number(p.monto) || 0,
      metodo: p.metodos_pago?.nombre || "Metodo no registrado",
      referencia: p.referencia || "",
      fecha: p.fecha || null,
    })),
    saldoPendiente: Math.max(0, montoTotal - pagado),
    estado: r.estado,
    notas: r.notas || "",
    ventaId: r.detalle_venta?.[0]?.id_venta || null,
  };
};

export async function listRecursosReserva() {
  if (modoDemo) return wait(_recursosReserva);
  const [{ data: aptos, error: eAptos }, { data: espacios, error: eEspacios }] = await Promise.all([
    supabase.from("apartamentos").select("id_apartamento, nombre, descripcion, capacidad, precio_dia, precio_fin_semana, activo").order("nombre"),
    supabase.from("espacios_evento").select("id_espacio, nombre, descripcion, capacidad, precio_base, activo").order("nombre"),
  ]);
  if (eAptos) throw eAptos;
  if (eEspacios) throw eEspacios;
  return [
    ...(aptos || []).map((a) => ({
      id: a.id_apartamento,
      tipo: "apartamento",
      nombre: a.nombre,
      descripcion: a.descripcion || "",
      capacidad: Number(a.capacidad) || 0,
      precio: Number(a.precio_dia || a.precio_fin_semana || 0),
      activo: a.activo !== false,
    })),
    ...(espacios || []).map((e) => ({
      id: e.id_espacio,
      tipo: "evento",
      nombre: e.nombre,
      descripcion: e.descripcion || "",
      capacidad: Number(e.capacidad) || 0,
      precio: Number(e.precio_base) || 0,
      activo: e.activo !== false,
    })),
  ];
}

export async function saveRecursoReserva(recurso) {
  if (modoDemo) {
    const payload = {
      ...recurso,
      capacidad: Number(recurso.capacidad) || 0,
      precio: Number(recurso.precio) || 0,
      activo: recurso.activo !== false,
    };
    if (payload.id && _recursosReserva.some((r) => r.id === payload.id)) {
      _recursosReserva = _recursosReserva.map((r) => (r.id === payload.id ? { ...r, ...payload } : r));
    } else {
      _recursosReserva = [{ ...payload, id: "rec-" + Date.now() }, ..._recursosReserva];
    }
    return wait(payload);
  }

  if (recurso.tipo === "apartamento") {
    const payload = {
      nombre: recurso.nombre,
      descripcion: recurso.descripcion || null,
      capacidad: Number(recurso.capacidad) || null,
      precio_dia: Number(recurso.precio) || 0,
      precio_fin_semana: Number(recurso.precioFinSemana || recurso.precio) || 0,
      activo: recurso.activo !== false,
    };
    if (recurso.id) {
      const { error } = await supabase.from("apartamentos").update(payload).eq("id_apartamento", recurso.id);
      if (error) throw error;
      return { ...recurso };
    }
    const { data, error } = await supabase.from("apartamentos").insert(payload).select("id_apartamento").single();
    if (error) throw error;
    return { ...recurso, id: data.id_apartamento };
  }

  const payload = {
    nombre: recurso.nombre,
    descripcion: recurso.descripcion || null,
    capacidad: Number(recurso.capacidad) || null,
    precio_base: Number(recurso.precio) || 0,
    activo: recurso.activo !== false,
  };
  if (recurso.id) {
    const { error } = await supabase.from("espacios_evento").update(payload).eq("id_espacio", recurso.id);
    if (error) throw error;
    return { ...recurso };
  }
  const { data, error } = await supabase.from("espacios_evento").insert(payload).select("id_espacio").single();
  if (error) throw error;
  return { ...recurso, id: data.id_espacio };
}

export async function deleteRecursoReserva(recurso) {
  if (modoDemo) {
    _recursosReserva = _recursosReserva.filter((r) => r.id !== recurso.id);
    return wait(true);
  }
  const tabla = recurso.tipo === "apartamento" ? "apartamentos" : "espacios_evento";
  const campo = recurso.tipo === "apartamento" ? "id_apartamento" : "id_espacio";
  const { error } = await supabase.from(tabla).delete().eq(campo, recurso.id);
  if (error) throw error;
  return true;
}

export async function listReservas() {
  if (modoDemo) {
    const ahora = new Date();
    _reservas = _reservas.map((r) => (r.estado === "en_curso" && new Date(r.fechaFin) < ahora ? { ...r, estado: "finalizada" } : r));
    return wait(_reservas.map((r) => {
      const recurso = _recursosReserva.find((x) => x.id === r.recursoId);
      const cliente = _clientes.find((c) => c.id === r.clienteId);
      return { ...r, recursoNombre: recurso?.nombre || r.recursoNombre, cliente: cliente?.nombre || r.cliente || "Consumidor final" };
    }).sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio)));
  }
  await supabase
    .from("reservas")
    .update({ estado: "finalizada" })
    .eq("estado", "en_curso")
    .lt("fecha_fin", new Date().toISOString());
  const { data, error } = await supabase
    .from("reservas")
    .select("id_reserva, tipo, id_apartamento, id_espacio, id_cliente, fecha_inicio, fecha_fin, num_personas, monto_total, estado, notas, clientes(nombre), apartamentos(nombre), espacios_evento(nombre), pagos(monto, referencia, fecha, metodos_pago(nombre)), detalle_venta(id_venta)")
    .order("fecha_inicio", { ascending: false });
  if (error) throw error;
  return data.map(mapReserva);
}

async function assertDisponibilidadReserva(payload) {
  const reservas = await listReservas();
  const ocupada = reservas.some((r) =>
    r.id !== payload.id &&
    r.tipo === payload.tipo &&
    r.recursoId === payload.recursoId &&
    ESTADOS_BLOQUEAN_RESERVA.includes(r.estado) &&
    hayCruceFechas(payload.fechaInicio, payload.fechaFin, r.fechaInicio, r.fechaFin)
  );
  if (ocupada) throw new Error("El recurso ya tiene una reserva activa en ese rango de fechas");
}

export async function saveReserva(payload) {
  await assertDisponibilidadReserva(payload);
  if (modoDemo) {
    const recurso = _recursosReserva.find((r) => r.id === payload.recursoId);
    const cliente = _clientes.find((c) => c.id === payload.clienteId);
    const reserva = {
      ...payload,
      id: payload.id || "res-" + Date.now(),
      recursoNombre: recurso?.nombre || payload.recursoNombre || "Recurso",
      cliente: cliente?.nombre || payload.cliente || "Consumidor final",
      anticipo: Number(payload.anticipo) || 0,
      estado: payload.estado || "pendiente",
    };
    _reservas = payload.id ? _reservas.map((r) => (r.id === payload.id ? reserva : r)) : [reserva, ..._reservas];
    return wait(reserva);
  }
  let clienteId = payload.clienteId || null;
  if (!clienteId && payload.cliente?.trim()) {
    const { data: cli, error: eCli } = await supabase
      .from("clientes")
      .insert({ nombre: payload.cliente.trim() })
      .select("id_cliente")
      .single();
    if (eCli) throw eCli;
    clienteId = cli.id_cliente;
  }
  const dataReserva = {
    tipo: payload.tipo,
    id_cliente: clienteId,
    id_apartamento: payload.tipo === "apartamento" ? payload.recursoId : null,
    id_espacio: payload.tipo === "evento" ? payload.recursoId : null,
    fecha_inicio: payload.fechaInicio,
    fecha_fin: payload.fechaFin,
    num_personas: Number(payload.personas) || null,
    monto_total: Number(payload.montoTotal) || 0,
    estado: payload.estado || "pendiente",
    notas: payload.notas || null,
  };
  let reservaId = payload.id;
  if (reservaId) {
    const { error } = await supabase.from("reservas").update(dataReserva).eq("id_reserva", reservaId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("reservas").insert(dataReserva).select("id_reserva").single();
    if (error) throw error;
    reservaId = data.id_reserva;
  }

  const anticipo = Number(payload.anticipo) || 0;
  if (anticipo > 0 && !payload.id) {
    const { data: metodo } = await supabase.from("metodos_pago").select("id_metodo").ilike("nombre", payload.metodoAnticipo || "Efectivo").limit(1).single();
    if (metodo) await supabase.from("pagos").insert({ id_reserva: reservaId, id_metodo: metodo.id_metodo, monto: anticipo, referencia: "anticipo reserva" });
  }
  return { ...payload, id: reservaId };
}

export async function registrarPagoReserva({ reservaId, monto, metodo = "Efectivo", referencia = "", idUsuario }) {
  const valor = Number(monto) || 0;
  if (!reservaId) throw new Error("Reserva no encontrada");
  if (valor <= 0) throw new Error("El pago debe ser mayor a cero");

  if (modoDemo) {
    _reservas = _reservas.map((r) => {
      if (r.id !== reservaId) return r;
      const pagosReserva = [...(r.pagosReserva || []), { monto: valor, metodo, referencia, fecha: new Date().toISOString() }];
      const anticipo = Number(r.anticipo || 0) + valor;
      return { ...r, anticipo, pagosReserva, saldoPendiente: Math.max(0, Number(r.montoTotal || 0) - anticipo) };
    });
    await registrarAuditoria({ idUsuario, accion: "REGISTRAR_PAGO_RESERVA", tabla: "pagos", registroId: reservaId, detalle: { monto: valor, metodo, referencia } });
    return wait(true);
  }

  const { data: reserva, error: eReserva } = await supabase
    .from("reservas")
    .select("id_reserva, monto_total, pagos(monto)")
    .eq("id_reserva", reservaId)
    .single();
  if (eReserva) throw eReserva;
  const pagado = (reserva.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0);
  const saldo = Math.max(0, Number(reserva.monto_total || 0) - pagado);
  if (valor > saldo) throw new Error(`El pago supera el saldo pendiente (${fmt(saldo)})`);

  const { data: metodoPago, error: eMetodo } = await supabase
    .from("metodos_pago")
    .select("id_metodo")
    .ilike("nombre", metodo)
    .limit(1)
    .single();
  if (eMetodo) throw eMetodo;

  const { error } = await supabase.from("pagos").insert({
    id_reserva: reservaId,
    id_metodo: metodoPago.id_metodo,
    monto: valor,
    referencia: referencia || "abono reserva",
  });
  if (error) throw error;
  await registrarAuditoria({ idUsuario, accion: "REGISTRAR_PAGO_RESERVA", tabla: "pagos", registroId: reservaId, detalle: { monto: valor, metodo, referencia } });
  return true;
}

export async function cambiarEstadoReserva(id, estado) {
  if (modoDemo) {
    _reservas = _reservas.map((r) => (r.id === id ? { ...r, estado } : r));
    return wait(true);
  }
  const { error } = await supabase.from("reservas").update({ estado }).eq("id_reserva", id);
  if (error) throw error;
  return true;
}

export async function facturarReserva({ reservaId, idPunto, idCaja, idUsuario, pago = "Efectivo" }) {
  const reservas = await listReservas();
  const reserva = reservas.find((r) => r.id === reservaId);
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.ventaId) throw new Error("La reserva ya fue facturada");
  const saldo = Math.max(0, Number(reserva.montoTotal) - Number(reserva.anticipo || 0));
  if (modoDemo) {
    _seq.FACTURA += 1;
    const numero = `${EMPRESA.prefijoFactura || "FAC"}-${String(_seq.FACTURA).padStart(4, "0")}`;
    const fecha = new Date().toISOString();
    _ventas = [..._ventas, {
      id: numero,
      numero,
      fecha,
      tipo: "FACTURA",
      cliente: reserva.cliente,
      pago,
      total: saldo,
      id_caja: idCaja,
      id_punto: idPunto,
      estado: "pagada",
      lineas: [{ nombre: `Reserva ${reserva.recursoNombre}`, cantidad: 1, precio: saldo, costo: 0, cat: reserva.tipo === "apartamento" ? "alojamiento" : "eventos" }],
    }];
    _reservas = _reservas.map((r) => (r.id === reservaId ? { ...r, estado: "en_curso", ventaId: numero } : r));
    return wait({ numero, fecha });
  }
  const punto = idPunto ? { id_punto: idPunto } : (await supabase.from("puntos_venta").select("id_punto").eq("activo", true).order("nombre").limit(1).single()).data;
  const impuestos = Math.round(saldo * IMPUESTO);
  const subtotal = Math.max(0, saldo - impuestos);
  const { data: venta, error } = await supabase
    .from("ventas")
    .insert({
      id_punto: punto?.id_punto,
      id_caja: idCaja || null,
      id_usuario: idUsuario || null,
      id_cliente: reserva.clienteId || null,
      subtotal,
      descuento: 0,
      impuestos,
      total: saldo,
      estado: "pagada",
      notas: `Reserva ${reserva.recursoNombre}`,
    })
    .select("id_venta, numero, fecha")
    .single();
  if (error) throw error;
  const { error: eDetalle } = await supabase.from("detalle_venta").insert({
    id_venta: venta.id_venta,
    id_reserva: reservaId,
    descripcion: `Reserva ${reserva.recursoNombre}`,
    cantidad: 1,
    precio_unitario: saldo,
    descuento: 0,
    subtotal: saldo,
  });
  if (eDetalle) throw eDetalle;
  const { data: metodo } = await supabase.from("metodos_pago").select("id_metodo").ilike("nombre", pago).limit(1).single();
  if (metodo && saldo > 0) await supabase.from("pagos").insert({ id_venta: venta.id_venta, id_metodo: metodo.id_metodo, monto: saldo });
  await cambiarEstadoReserva(reservaId, "en_curso");
  return { numero: venta.numero ? `${EMPRESA.prefijoFactura || "FAC"}-${String(venta.numero).padStart(4, "0")}` : "", fecha: venta.fecha };
}
