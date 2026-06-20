import { supabase, supabaseHabilitado } from "./supabaseClient";

export const modoDemo = !supabaseHabilitado;

const clon = (x) => JSON.parse(JSON.stringify(x));
const wait = (data) => Promise.resolve(clon(data));

/* ============================ MODO DEMO (en memoria) ============================ */
let _cajas = {};
let _cajasCerradas = [];
let _movimientos = [];
let _auditoriaCaja = [];
let _seq = 1;

async function registrarAuditoriaCaja({ idUsuario, accion, tabla, registroId, detalle }) {
  const item = {
    id: "aud-caja-" + Date.now(),
    idUsuario: idUsuario || null,
    accion,
    tabla,
    registroId: registroId ? String(registroId) : null,
    detalle: detalle || {},
    fecha: new Date().toISOString(),
  };
  if (modoDemo) {
    _auditoriaCaja = [item, ..._auditoriaCaja].slice(0, 100);
    return item;
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

/* ============================ Punto de venta ============================ */
let _puntoCache = {};
async function getPuntoVenta(idPunto) {
  if (modoDemo) return { id_punto: idPunto || "pv-principal" };
  if (idPunto) return { id_punto: idPunto };
  if (_puntoCache.default) return _puntoCache.default;
  const { data, error } = await supabase.from("puntos_venta").select("id_punto").eq("activo", true).order("nombre").limit(1).single();
  if (error) throw error;
  _puntoCache.default = data;
  return data;
}

/* ============================ API pública ============================ */
export async function getCajaAbierta(idPunto) {
  if (modoDemo) return wait(_cajas[idPunto || "pv-principal"] || null);
  const { id_punto } = await getPuntoVenta(idPunto);
  const { data, error } = await supabase
    .from("cajas")
    .select("*")
    .eq("id_punto", id_punto)
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCajasAbiertas() {
  if (modoDemo) return wait(Object.values(_cajas));
  const { data, error } = await supabase
    .from("cajas")
    .select("*, puntos_venta(nombre)")
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false });
  if (error) throw error;
  return data;
}

export async function abrirCaja({ montoInicial, idUsuario, idPunto }) {
  if (modoDemo) {
    const punto = idPunto || "pv-principal";
    _cajas[punto] = {
      id_caja: "caja" + _seq++,
      id_punto: punto,
      monto_inicial: montoInicial,
      fecha_apertura: new Date().toISOString(),
      id_usuario_apertura: idUsuario,
      estado: "abierta",
    };
    _movimientos = [..._movimientos, {
      id_movimiento: "m" + Date.now(), id_caja: _cajas[punto].id_caja, tipo: "apertura",
      descripcion: "Apertura de caja", monto: montoInicial, fecha: new Date().toISOString(), id_usuario: idUsuario,
    }];
    return wait(_cajas[punto]);
  }
  const { id_punto } = await getPuntoVenta(idPunto);
  const { data, error } = await supabase
    .from("cajas")
    .insert({ id_punto, monto_inicial: montoInicial, id_usuario_apertura: idUsuario || null })
    .select()
    .single();
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("movimientos_caja")
    .insert({ id_caja: data.id_caja, tipo: "apertura", descripcion: "Apertura de caja", monto: montoInicial, id_usuario: idUsuario || null });
  if (e2) throw e2;
  return data;
}

export async function registrarMovimiento({ idCaja, tipo, descripcion, monto, idUsuario }) {
  if (modoDemo) {
    const m = { id_movimiento: "m" + Date.now(), id_caja: idCaja, tipo, descripcion, monto, fecha: new Date().toISOString(), id_usuario: idUsuario };
    _movimientos = [..._movimientos, m];
    return wait(m);
  }
  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert({ id_caja: idCaja, tipo, descripcion, monto, id_usuario: idUsuario || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listMovimientos(idCaja) {
  if (modoDemo) return wait(_movimientos);
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("id_caja", idCaja)
    .order("fecha");
  if (error) throw error;
  return data;
}

// Movimientos de caja (de cualquier turno) dentro de un rango de fechas, para reportes de gastos.
export async function listMovimientosRango(desde, hasta, idPunto) {
  const idsPunto = Array.isArray(idPunto) ? idPunto : idPunto ? [idPunto] : null;
  if (modoDemo) {
    const todasLasCajas = [...Object.values(_cajas), ..._cajasCerradas];
    const idsCaja = idsPunto ? todasLasCajas.filter((c) => idsPunto.includes(c.id_punto)).map((c) => c.id_caja) : null;
    return wait(_movimientos.filter((m) => {
      const f = new Date(m.fecha);
      return f >= desde && f <= hasta && (!idsCaja || idsCaja.includes(m.id_caja));
    }));
  }
  let q = supabase
    .from("movimientos_caja")
    .select("*, cajas(id_punto)")
    .gte("fecha", desde.toISOString())
    .lte("fecha", hasta.toISOString())
    .order("fecha");
  if (idsPunto) q = q.in("cajas.id_punto", idsPunto);
  const { data, error } = await q;
  if (error) throw error;
  return idsPunto ? data.filter((m) => idsPunto.includes(m.cajas?.id_punto)) : data;
}

export async function listCajasRango(desde, hasta, idPunto) {
  const idsPunto = Array.isArray(idPunto) ? idPunto : idPunto ? [idPunto] : null;
  if (modoDemo) {
    const todas = [...Object.values(_cajas), ..._cajasCerradas];
    return wait(todas.filter((c) => {
      const apertura = new Date(c.fecha_apertura);
      const cierre = c.fecha_cierre ? new Date(c.fecha_cierre) : apertura;
      return cierre >= desde && apertura <= hasta && (!idsPunto || idsPunto.includes(c.id_punto));
    }));
  }
  let q = supabase
    .from("cajas")
    .select("*, puntos_venta(nombre), usuario_apertura:usuarios!cajas_id_usuario_apertura_fkey(nombre), usuario_cierre:usuarios!cajas_id_usuario_cierre_fkey(nombre)")
    .lte("fecha_apertura", hasta.toISOString())
    .order("fecha_apertura", { ascending: false });
  if (idsPunto) q = q.in("id_punto", idsPunto);
  const { data, error } = await q;
  if (error) throw error;
  return data.filter((c) => {
    const cierre = c.fecha_cierre ? new Date(c.fecha_cierre) : new Date(c.fecha_apertura);
    return cierre >= desde;
  });
}

export async function cerrarCaja({ idCaja, montoFinalEsperado, montoFinalReal, idUsuario }) {
  const diferencia = Number(montoFinalReal) - Number(montoFinalEsperado);
  if (modoDemo) {
    const caja = Object.values(_cajas).find((c) => c.id_caja === idCaja);
    const cerrada = {
      ...caja,
      estado: "cerrada",
      fecha_cierre: new Date().toISOString(),
      monto_final_esperado: montoFinalEsperado,
      monto_final_real: montoFinalReal,
      diferencia,
      id_usuario_cierre: idUsuario,
    };
    _movimientos = [..._movimientos, {
      id_movimiento: "m" + Date.now(), id_caja: cerrada.id_caja, tipo: "cierre",
      descripcion: "Cierre de caja", monto: montoFinalReal, fecha: cerrada.fecha_cierre, id_usuario: idUsuario,
    }];
    _cajasCerradas = [..._cajasCerradas, cerrada];
    delete _cajas[cerrada.id_punto];
    await registrarAuditoriaCaja({ idUsuario, accion: "CERRAR_CAJA", tabla: "cajas", registroId: cerrada.id_caja, detalle: { id_punto: cerrada.id_punto, montoFinalEsperado, montoFinalReal, diferencia } });
    return wait(cerrada);
  }
  const { data, error } = await supabase
    .from("cajas")
    .update({
      estado: "cerrada",
      fecha_cierre: new Date().toISOString(),
      monto_final_esperado: montoFinalEsperado,
      monto_final_real: montoFinalReal,
      diferencia,
      id_usuario_cierre: idUsuario || null,
    })
    .eq("id_caja", idCaja)
    .select()
    .single();
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("movimientos_caja")
    .insert({ id_caja: idCaja, tipo: "cierre", descripcion: "Cierre de caja", monto: montoFinalReal, id_usuario: idUsuario || null });
  if (e2) throw e2;
  await registrarAuditoriaCaja({ idUsuario, accion: "CERRAR_CAJA", tabla: "cajas", registroId: idCaja, detalle: { id_punto: data.id_punto, montoFinalEsperado, montoFinalReal, diferencia } });
  return data;
}

// Resumen del día: ventas por método de pago + movimientos -> saldo esperado en efectivo.
export function calcularResumen(caja, ventas, movimientos) {
  const ventasCaja = modoDemo
    ? ventas.filter((v) => (v.id_caja ? v.id_caja === caja.id_caja : v.id_punto === caja.id_punto && new Date(v.fecha) >= new Date(caja.fecha_apertura)))
    : ventas.filter((v) => v.id_caja === caja.id_caja);

  const ventasPorMetodo = {};
  let totalVentas = 0;
  for (const v of ventasCaja) {
    const pagos = v.pagos?.length ? v.pagos : [{ metodo: v.pago || "Efectivo", monto: v.total }];
    pagos.forEach((p) => {
      const metodo = p.metodo || "Efectivo";
      ventasPorMetodo[metodo] = (ventasPorMetodo[metodo] || 0) + (Number(p.monto) || 0);
    });
    totalVentas += v.total;
  }

  let ingresos = 0, egresos = 0, retiros = 0;
  for (const m of movimientos) {
    const monto = Number(m.monto) || 0;
    if (m.tipo === "ingreso") ingresos += monto;
    else if (m.tipo === "egreso" || m.tipo === "gasto") egresos += monto;
    else if (m.tipo === "retiro") retiros += monto;
  }

  const efectivo = ventasPorMetodo["Efectivo"] || 0;
  const saldoEsperado = Number(caja.monto_inicial) + efectivo + ingresos - egresos - retiros;

  return { ventasCaja, ventasPorMetodo, totalVentas, ingresos, egresos, retiros, efectivo, saldoEsperado };
}
