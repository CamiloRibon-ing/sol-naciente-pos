import { supabase, supabaseHabilitado } from "./supabaseClient";

const modoDemo = !supabaseHabilitado;
const clon = (x) => JSON.parse(JSON.stringify(x));
const wait = (data) => Promise.resolve(clon(data));

/* ============================ MODO DEMO (en memoria) ============================ */
let _cargos = [];
let _empleados = [];
let _periodos = [];
let _conceptos = [];
let _nominaDetalle = [];

/* ============================ Cargos ============================ */
async function ensureCargo(nombre, salarioBase) {
  if (modoDemo) {
    let c = _cargos.find((x) => x.nombre.toLowerCase() === (nombre || "").toLowerCase());
    if (!c) { c = { id: "cargo" + Date.now() + Math.random(), nombre, salarioBase }; _cargos.push(c); }
    return c.id;
  }
  const { data } = await supabase.from("cargos").select("id_cargo").ilike("nombre", nombre).maybeSingle();
  if (data) return data.id_cargo;
  const { data: nuevo, error } = await supabase.from("cargos").insert({ nombre, salario_base: salarioBase || null }).select("id_cargo").single();
  if (error) throw error;
  return nuevo.id_cargo;
}

/* ============================ Empleados ============================ */
const mapEmpleado = (row) => ({
  id: row.id_empleado,
  nombre: row.nombre,
  documento: row.documento || "",
  cargo: row.cargos?.nombre || "",
  salarioBase: Number(row.salario_base) || 0,
  tipoContrato: row.tipo_contrato || "",
  fechaIngreso: row.fecha_ingreso || "",
  fechaRetiro: row.fecha_retiro || "",
  telefono: row.telefono || "",
  correo: row.correo || "",
  activo: row.activo,
});

const estadoPago = (neto, pagado) => {
  const saldo = Math.max(0, Number(neto || 0) - Number(pagado || 0));
  if (Number(pagado || 0) <= 0) return "pendiente";
  if (saldo > 0) return "parcial";
  return "pagado";
};

export async function listEmpleados() {
  if (modoDemo) return wait(_empleados);
  const { data, error } = await supabase.from("empleados").select("*, cargos(nombre)").order("nombre");
  if (error) throw error;
  return data.map(mapEmpleado);
}

export async function saveEmpleado(e) {
  if (modoDemo) {
    await ensureCargo(e.cargo, e.salarioBase);
    const payload = { ...e };
    if (e.id && _empleados.some((x) => x.id === e.id)) {
      _empleados = _empleados.map((x) => (x.id === e.id ? { ...x, ...payload } : x));
    } else {
      _empleados = [..._empleados, { ...payload, id: "emp" + Date.now() }];
    }
    return wait(payload);
  }
  const idCargo = await ensureCargo(e.cargo, e.salarioBase);
  const payload = {
    nombre: e.nombre,
    documento: e.documento || null,
    id_cargo: idCargo,
    salario_base: e.salarioBase || 0,
    tipo_contrato: e.tipoContrato || null,
    fecha_ingreso: e.fechaIngreso || null,
    fecha_retiro: e.fechaRetiro || null,
    telefono: e.telefono || null,
    correo: e.correo || null,
    activo: e.activo !== false,
  };
  let id = e.id;
  if (id) {
    const { error } = await supabase.from("empleados").update(payload).eq("id_empleado", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("empleados").insert(payload).select("id_empleado").single();
    if (error) throw error;
    id = data.id_empleado;
  }
  return { ...e, id };
}

export async function deleteEmpleado(id) {
  if (modoDemo) { _empleados = _empleados.filter((x) => x.id !== id); return wait(true); }
  const { error } = await supabase.from("empleados").delete().eq("id_empleado", id);
  if (error) throw error;
  return true;
}

/* ============================ Períodos ============================ */
const mapPeriodo = (row) => ({
  id: row.id_periodo,
  nombre: row.nombre,
  fechaInicio: row.fecha_inicio,
  fechaFin: row.fecha_fin,
  tipo: row.tipo || "",
  estado: row.estado,
});

const esColumnaFaltante = (error) =>
  error?.code === "42703" || /column .* does not exist|monto_pagado/i.test(error?.message || "");

export async function listPeriodos() {
  if (modoDemo) return wait(_periodos);
  const { data, error } = await supabase.from("periodos_nomina").select("*").order("fecha_inicio", { ascending: false });
  if (error) throw error;
  return data.map(mapPeriodo);
}

export async function crearPeriodo({ nombre, fechaInicio, fechaFin, tipo }) {
  if (modoDemo) {
    const p = { id: "per" + Date.now(), nombre, fechaInicio, fechaFin, tipo, estado: "abierto" };
    _periodos = [p, ..._periodos];
    return wait(p);
  }
  const { data, error } = await supabase
    .from("periodos_nomina")
    .insert({ nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo })
    .select("id_periodo")
    .single();
  if (error) throw error;
  return { id: data.id_periodo, nombre, fechaInicio, fechaFin, tipo, estado: "abierto" };
}

export async function cambiarEstadoPeriodo(id, estado) {
  if (modoDemo) {
    _periodos = _periodos.map((p) => (p.id === id ? { ...p, estado } : p));
    if (estado === "pagado") {
      const hoy = new Date().toISOString().slice(0, 10);
      _nominaDetalle = _nominaDetalle.map((d) => (d.idPeriodo === id ? { ...d, montoPagado: d.totalDevengado - d.totalDeducciones, fechaPago: hoy } : d));
    }
    return wait(true);
  }
  const { error } = await supabase.from("periodos_nomina").update({ estado }).eq("id_periodo", id);
  if (error) throw error;
  if (estado === "pagado") {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: detalles } = await supabase.from("nomina_detalle").select("id_nomina_detalle, neto_pagar").eq("id_periodo", id);
    for (const d of detalles || []) {
      const { error: ePago } = await supabase
        .from("nomina_detalle")
        .update({ fecha_pago: hoy, monto_pagado: Number(d.neto_pagar) || 0 })
        .eq("id_nomina_detalle", d.id_nomina_detalle);
      if (esColumnaFaltante(ePago)) {
        await supabase.from("nomina_detalle").update({ fecha_pago: hoy }).eq("id_nomina_detalle", d.id_nomina_detalle);
      } else if (ePago) {
        throw ePago;
      }
    }
  }
  return true;
}

/* ============================ Conceptos ============================ */
async function ensureConcepto(nombre, tipo) {
  if (modoDemo) {
    let c = _conceptos.find((x) => x.nombre === nombre && x.tipo === tipo);
    if (!c) { c = { id: "con" + Date.now() + Math.random(), nombre, tipo }; _conceptos.push(c); }
    return c.id;
  }
  const { data } = await supabase.from("conceptos_nomina").select("id_concepto").eq("nombre", nombre).eq("tipo", tipo).maybeSingle();
  if (data) return data.id_concepto;
  const { data: nuevo, error } = await supabase.from("conceptos_nomina").insert({ nombre, tipo }).select("id_concepto").single();
  if (error) throw error;
  return nuevo.id_concepto;
}

/* ============================ Liquidación ============================ */
// Devuelve la liquidación de cada empleado activo en un período (guardada o, si no existe, vacía).
export async function listNominaDetalle(idPeriodo) {
  const empleados = await listEmpleados();
  const activos = empleados.filter((e) => e.activo !== false);

  if (modoDemo) {
    return activos.map((e) => {
      const d = _nominaDetalle.find((x) => x.idPeriodo === idPeriodo && x.idEmpleado === e.id);
      return d
        ? { empleado: e, diasTrabajados: d.diasTrabajados, conceptos: d.conceptos, totalDevengado: d.totalDevengado, totalDeducciones: d.totalDeducciones, netoPagar: d.totalDevengado - d.totalDeducciones, montoPagado: d.montoPagado || 0, saldoPendiente: Math.max(0, (d.totalDevengado - d.totalDeducciones) - (d.montoPagado || 0)), fechaPago: d.fechaPago || null }
        : { empleado: e, diasTrabajados: null, conceptos: [], totalDevengado: 0, totalDeducciones: 0, netoPagar: 0, montoPagado: 0, saldoPendiente: 0, fechaPago: null };
    });
  }

  let { data, error } = await supabase
    .from("nomina_detalle")
    .select("id_nomina_detalle, id_empleado, dias_trabajados, total_devengado, total_deducciones, neto_pagar, monto_pagado, fecha_pago, nomina_conceptos(valor, conceptos_nomina(nombre, tipo))")
    .eq("id_periodo", idPeriodo);
  if (esColumnaFaltante(error)) {
    const fallback = await supabase
      .from("nomina_detalle")
      .select("id_nomina_detalle, id_empleado, dias_trabajados, total_devengado, total_deducciones, neto_pagar, fecha_pago, nomina_conceptos(valor, conceptos_nomina(nombre, tipo))")
      .eq("id_periodo", idPeriodo);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;

  return activos.map((e) => {
    const d = (data || []).find((x) => x.id_empleado === e.id);
    if (!d) return { empleado: e, diasTrabajados: null, conceptos: [], totalDevengado: 0, totalDeducciones: 0, netoPagar: 0, montoPagado: 0, saldoPendiente: 0, fechaPago: null };
    const netoPagar = Number(d.neto_pagar);
    const montoPagado = Number(d.monto_pagado) || 0;
    return {
      empleado: e,
      diasTrabajados: d.dias_trabajados ? Number(d.dias_trabajados) : null,
      conceptos: (d.nomina_conceptos || []).map((c) => ({ nombre: c.conceptos_nomina?.nombre, tipo: c.conceptos_nomina?.tipo, valor: Number(c.valor) })),
      totalDevengado: Number(d.total_devengado),
      totalDeducciones: Number(d.total_deducciones),
      netoPagar,
      montoPagado,
      saldoPendiente: Math.max(0, netoPagar - montoPagado),
      fechaPago: d.fecha_pago,
    };
  });
}

// Guarda/actualiza la liquidación de un empleado en un período (reemplaza sus conceptos).
export async function guardarLiquidacion(idPeriodo, idEmpleado, { diasTrabajados, conceptos, montoPagado }) {
  const totalDevengado = conceptos.filter((c) => c.tipo === "devengado").reduce((s, c) => s + c.valor, 0);
  const totalDeducciones = conceptos.filter((c) => c.tipo === "deduccion").reduce((s, c) => s + c.valor, 0);
  const netoPagar = totalDevengado - totalDeducciones;
  const pagoRealizado = Math.min(Math.max(0, Number(montoPagado) || 0), Math.max(0, netoPagar));

  if (modoDemo) {
    const existente = _nominaDetalle.find((x) => x.idPeriodo === idPeriodo && x.idEmpleado === idEmpleado);
    const registro = { idPeriodo, idEmpleado, diasTrabajados, conceptos, totalDevengado, totalDeducciones, montoPagado: pagoRealizado, fechaPago: pagoRealizado >= netoPagar && netoPagar > 0 ? new Date().toISOString().slice(0, 10) : existente?.fechaPago || null };
    if (existente) _nominaDetalle = _nominaDetalle.map((x) => (x === existente ? registro : x));
    else _nominaDetalle = [..._nominaDetalle, registro];
    return wait({ totalDevengado, totalDeducciones, netoPagar, montoPagado: pagoRealizado });
  }

  let { data: detalle, error } = await supabase
    .from("nomina_detalle")
    .upsert(
      { id_periodo: idPeriodo, id_empleado: idEmpleado, dias_trabajados: diasTrabajados, total_devengado: totalDevengado, total_deducciones: totalDeducciones, monto_pagado: pagoRealizado, fecha_pago: pagoRealizado >= netoPagar && netoPagar > 0 ? new Date().toISOString().slice(0, 10) : null },
      { onConflict: "id_periodo,id_empleado" }
    )
    .select("id_nomina_detalle")
    .single();
  if (esColumnaFaltante(error)) {
    const fallback = await supabase
      .from("nomina_detalle")
      .upsert(
        { id_periodo: idPeriodo, id_empleado: idEmpleado, dias_trabajados: diasTrabajados, total_devengado: totalDevengado, total_deducciones: totalDeducciones, fecha_pago: pagoRealizado >= netoPagar && netoPagar > 0 ? new Date().toISOString().slice(0, 10) : null },
        { onConflict: "id_periodo,id_empleado" }
      )
      .select("id_nomina_detalle")
      .single();
    detalle = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;

  await supabase.from("nomina_conceptos").delete().eq("id_nomina_detalle", detalle.id_nomina_detalle);
  for (const c of conceptos) {
    const idConcepto = await ensureConcepto(c.nombre, c.tipo);
    await supabase.from("nomina_conceptos").insert({ id_nomina_detalle: detalle.id_nomina_detalle, id_concepto: idConcepto, valor: c.valor });
  }
  return { totalDevengado, totalDeducciones, netoPagar, montoPagado: pagoRealizado };
}

/* ============================ Reportes ============================ */
// Suma el total devengado de los períodos de nómina cuyo rango se solapa con [desde, hasta].
export async function costoNominaEnRango(desde, hasta) {
  const desdeStr = desde.toISOString().slice(0, 10);
  const hastaStr = hasta.toISOString().slice(0, 10);

  if (modoDemo) {
    const ids = _periodos
      .filter((p) => p.fechaInicio <= hastaStr && p.fechaFin >= desdeStr)
      .map((p) => p.id);
    return _nominaDetalle.filter((d) => ids.includes(d.idPeriodo)).reduce((s, d) => s + (Number(d.montoPagado) || 0), 0);
  }

  const { data: periodos, error } = await supabase
    .from("periodos_nomina")
    .select("id_periodo")
    .lte("fecha_inicio", hastaStr)
    .gte("fecha_fin", desdeStr);
  if (error) throw error;
  const ids = (periodos || []).map((p) => p.id_periodo);
  if (!ids.length) return 0;

  let { data, error: e2 } = await supabase.from("nomina_detalle").select("monto_pagado").in("id_periodo", ids);
  if (esColumnaFaltante(e2)) {
    const fallback = await supabase.from("nomina_detalle").select("total_devengado").in("id_periodo", ids);
    data = fallback.data;
    e2 = fallback.error;
    if (e2) throw e2;
    return (data || []).reduce((s, d) => s + Number(d.total_devengado), 0);
  }
  if (e2) throw e2;
  return (data || []).reduce((s, d) => s + Number(d.monto_pagado), 0);
}

export async function listReporteNomina({ desde, hasta } = {}) {
  const desdeStr = desde ? new Date(desde).toISOString().slice(0, 10) : null;
  const hastaStr = hasta ? new Date(hasta).toISOString().slice(0, 10) : null;

  if (modoDemo) {
    return _nominaDetalle.map((d) => {
      const empleado = _empleados.find((e) => e.id === d.idEmpleado) || {};
      const periodo = _periodos.find((p) => p.id === d.idPeriodo) || {};
      const neto = Number(d.totalDevengado || 0) - Number(d.totalDeducciones || 0);
      const pagado = Number(d.montoPagado || 0);
      return {
        periodo: periodo.nombre || "",
        fechaInicio: periodo.fechaInicio || "",
        fechaFin: periodo.fechaFin || "",
        empleado: empleado.nombre || "",
        documento: empleado.documento || "",
        cargo: empleado.cargo || "",
        totalDevengado: Number(d.totalDevengado || 0),
        totalDeducciones: Number(d.totalDeducciones || 0),
        netoPagar: neto,
        montoPagado: pagado,
        saldoPendiente: Math.max(0, neto - pagado),
        estadoPago: estadoPago(neto, pagado),
        fechaPago: d.fechaPago || "",
      };
    });
  }

  let q = supabase
    .from("nomina_detalle")
    .select("dias_trabajados, total_devengado, total_deducciones, neto_pagar, monto_pagado, fecha_pago, empleados(nombre, documento, salario_base, cargos(nombre)), periodos_nomina(nombre, fecha_inicio, fecha_fin, tipo, estado)")
    .order("fecha_pago", { ascending: false, nullsFirst: false });
  if (desdeStr) q = q.gte("periodos_nomina.fecha_fin", desdeStr);
  if (hastaStr) q = q.lte("periodos_nomina.fecha_inicio", hastaStr);
  let { data, error } = await q;
  if (esColumnaFaltante(error)) {
    let fb = supabase
      .from("nomina_detalle")
      .select("dias_trabajados, total_devengado, total_deducciones, neto_pagar, fecha_pago, empleados(nombre, documento, salario_base, cargos(nombre)), periodos_nomina(nombre, fecha_inicio, fecha_fin, tipo, estado)");
    if (desdeStr) fb = fb.gte("periodos_nomina.fecha_fin", desdeStr);
    if (hastaStr) fb = fb.lte("periodos_nomina.fecha_inicio", hastaStr);
    const fallback = await fb;
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return (data || []).map((d) => {
    const neto = Number(d.neto_pagar || 0);
    const pagado = Number(d.monto_pagado || 0);
    return {
      periodo: d.periodos_nomina?.nombre || "",
      fechaInicio: d.periodos_nomina?.fecha_inicio || "",
      fechaFin: d.periodos_nomina?.fecha_fin || "",
      tipo: d.periodos_nomina?.tipo || "",
      empleado: d.empleados?.nombre || "",
      documento: d.empleados?.documento || "",
      cargo: d.empleados?.cargos?.nombre || "",
      diasTrabajados: Number(d.dias_trabajados) || 0,
      totalDevengado: Number(d.total_devengado) || 0,
      totalDeducciones: Number(d.total_deducciones) || 0,
      netoPagar: neto,
      montoPagado: pagado,
      saldoPendiente: Math.max(0, neto - pagado),
      estadoPago: estadoPago(neto, pagado),
      fechaPago: d.fecha_pago || "",
    };
  });
}
