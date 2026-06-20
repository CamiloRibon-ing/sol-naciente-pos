import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Filter, Search, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import * as db from "../lib/db";
import { fmt, fmtFecha } from "../lib/format";
import { Boton, StatCard } from "../components/ui";

const ACCIONES = [
  "todos",
  "CREAR_VENTA",
  "ANULAR_VENTA",
  "AJUSTAR_STOCK",
  "CREAR_PRODUCTO",
  "EDITAR_PRODUCTO",
  "CREAR_INSUMO",
  "EDITAR_INSUMO",
  "CERRAR_CAJA",
  "ABRIR_CAJA",
  "CREAR_COMPRA",
  "EDITAR_CONFIGURACION",
  "CREAR_USUARIO",
  "EDITAR_USUARIO",
  "CREAR_CATEGORIA",
  "EDITAR_CATEGORIA",
  "ELIMINAR_CATEGORIA",
];

const TABLAS = ["todos", "ventas", "inventario", "productos", "ingredientes", "categorias", "cajas", "usuarios", "configuracion_negocio"];

const valor = (v, fallback = "sin dato") => {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "boolean") return v ? "Si" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : fallback;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const moneda = (v) => fmt(Number(v) || 0);

const detalleGenerico = (detalle = {}) => {
  const entries = Object.entries(detalle || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "No se registraron datos adicionales para este evento.";
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${valor(v)}`).join(". ");
};

const detalleHumano = (evento) => {
  const d = evento.detalle || {};
  switch (evento.accion) {
    case "CREAR_VENTA":
      return `Venta ${valor(d.numero || evento.registroId)} registrada por ${moneda(d.total)}. Cliente: ${valor(d.cliente, "Consumidor final")}. Pago: ${valor(d.pago)}${d.local ? `. Local: ${d.local}` : ""}.`;
    case "ANULAR_VENTA":
      return `Venta ${valor(d.numero || evento.registroId)} anulada. Total afectado: ${moneda(d.total)}.`;
    case "AJUSTAR_STOCK":
      return `Ajuste de inventario por ${valor(d.motivo, "motivo no especificado")}. Movimiento: ${Number(d.delta || 0)}. Stock anterior: ${valor(d.stockAnterior, "sin registro")}. Stock nuevo: ${valor(d.stockNuevo, "sin registro")}${d.nota ? `. Nota: ${d.nota}` : ""}.`;
    case "CREAR_PRODUCTO":
      return `Producto "${valor(d.nombre)}" creado con precio ${moneda(d.precio)}. Estado: ${d.activo === false ? "inactivo" : "activo"}.`;
    case "EDITAR_PRODUCTO":
      return `Producto "${valor(d.nombre)}" actualizado. Precio actual: ${moneda(d.precio)}. Estado: ${d.activo === false ? "inactivo" : "activo"}.`;
    case "CREAR_INSUMO":
      return `Insumo "${valor(d.nombre)}" creado. Stock inicial: ${valor(d.stock, "0")}. Costo unitario: ${moneda(d.costo)}.`;
    case "EDITAR_INSUMO":
      return `Insumo "${valor(d.nombre)}" actualizado. Stock: ${valor(d.stock, "0")}. Stock minimo: ${valor(d.stockMin, "0")}. Costo unitario: ${moneda(d.costo)}.`;
    case "ABRIR_CAJA":
      return `Caja abierta con base inicial de ${moneda(d.baseInicial || d.montoInicial)}${d.local ? `. Local: ${d.local}` : ""}.`;
    case "CERRAR_CAJA":
      return `Caja cerrada. Esperado: ${moneda(d.esperado)}. Contado: ${moneda(d.contado)}. Diferencia: ${moneda(d.diferencia)}${d.local ? `. Local: ${d.local}` : ""}.`;
    case "CREAR_COMPRA":
      return `Compra registrada por ${moneda(d.total)}. Proveedor: ${valor(d.proveedor)}. Items: ${valor(d.items || d.cantidadItems, "sin detalle")}.`;
    case "EDITAR_CONFIGURACION":
      return `Configuracion del negocio actualizada. Nombre: ${valor(d.nombre)}. NIT: ${valor(d.nit)}. Impuesto: ${d.impuestoRate !== undefined ? `${Number(d.impuestoRate) * 100}%` : "sin cambio"}.`;
    case "CREAR_USUARIO":
      return `Usuario "${valor(d.nombre)}" creado. Rol: ${valor(d.rol)}. Estado: ${d.activo === false ? "inactivo" : "activo"}.`;
    case "EDITAR_USUARIO":
      return `Usuario "${valor(d.nombre)}" actualizado. Rol: ${valor(d.rol)}. Estado: ${d.activo === false ? "inactivo" : "activo"}.`;
    case "CREAR_CATEGORIA":
      return `Categoria "${valor(d.nombre)}" creada. Estado: ${d.activo === false ? "inactiva" : "activa"}.`;
    case "EDITAR_CATEGORIA":
      return `Categoria "${valor(d.nombre)}" actualizada. Estado: ${d.activo === false ? "inactiva" : "activa"}.`;
    case "ELIMINAR_CATEGORIA":
      return `Categoria "${valor(d.nombre || evento.registroId)}" eliminada.`;
    default:
      return detalleGenerico(d);
  }
};

const labelAccion = (a) => ({
  CREAR_VENTA: "Creo venta",
  ANULAR_VENTA: "Anulo venta",
  AJUSTAR_STOCK: "Ajusto stock",
  CREAR_PRODUCTO: "Creo producto",
  EDITAR_PRODUCTO: "Edito producto",
  CREAR_INSUMO: "Creo insumo",
  EDITAR_INSUMO: "Edito insumo",
  CERRAR_CAJA: "Cerro caja",
  ABRIR_CAJA: "Abrio caja",
  CREAR_COMPRA: "Registro compra",
  EDITAR_CONFIGURACION: "Edito configuracion",
  CREAR_USUARIO: "Creo usuario",
  EDITAR_USUARIO: "Edito usuario",
  CREAR_CATEGORIA: "Creo categoria",
  EDITAR_CATEGORIA: "Edito categoria",
  ELIMINAR_CATEGORIA: "Elimino categoria",
}[a] || a);

const inicioMes = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export default function Auditoria() {
  const [eventos, setEventos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [accion, setAccion] = useState("todos");
  const [tabla, setTabla] = useState("todos");
  const [usuario, setUsuario] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(15);

  const cargar = async () => {
    setCargando(true);
    try {
      const desdeIso = desde ? `${desde}T00:00:00` : undefined;
      const hastaIso = hasta ? `${hasta}T23:59:59` : undefined;
      const [logs, users] = await Promise.all([
        db.listAuditoria({ desde: desdeIso, hasta: hastaIso, accion, tabla, idUsuario: usuario }),
        db.listUsuarios(),
      ]);
      setEventos(logs);
      setUsuarios(users);
    } catch (e) {
      toast.error(e.message || "No se pudo cargar la auditoria");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return eventos;
    return eventos.filter((e) => [
      e.usuario,
      e.correo,
      e.accion,
      e.tabla,
      e.registroId,
      detalleHumano(e),
    ].some((x) => String(x || "").toLowerCase().includes(q)));
  }, [eventos, busqueda]);

  useEffect(() => {
    setPagina(1);
  }, [eventos, busqueda, accion, tabla, usuario, desde, hasta, filasPorPagina]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / filasPorPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * filasPorPagina;
  const eventosPagina = filtrados.slice(inicio, inicio + filasPorPagina);
  const fin = Math.min(filtrados.length, inicio + filasPorPagina);
  const inicioPaginas = Math.max(1, Math.min(paginaActual - 2, totalPaginas - 4));
  const paginasVisibles = Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => inicioPaginas + i);
  const cambiarPagina = (nuevaPagina) => setPagina(Math.max(1, Math.min(totalPaginas, nuevaPagina)));

  const resumen = useMemo(() => ({
    total: filtrados.length,
    ventas: filtrados.filter((e) => e.tabla === "ventas").length,
    stock: filtrados.filter((e) => e.tabla === "inventario").length,
    caja: filtrados.filter((e) => e.tabla === "cajas").length,
  }), [filtrados]);

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Auditoria</h1>
          <p className="text-sol-gris text-[13px]">Consulta quien creo, edito, anulo, ajusto stock o cerro caja.</p>
        </div>
        <Boton onClick={cargar} disabled={cargando}><Filter size={16} /> {cargando ? "Cargando..." : "Aplicar filtros"}</Boton>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard icon={ShieldCheck} label="Eventos encontrados" value={resumen.total} color="#1A4FA0" />
        <StatCard icon={Activity} label="Eventos de ventas" value={resumen.ventas} color="#159A5A" />
        <StatCard icon={Activity} label="Ajustes de stock" value={resumen.stock} color="#F58220" />
        <StatCard icon={Activity} label="Cierres de caja" value={resumen.caja} color="#E22B23" />
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          <select value={accion} onChange={(e) => setAccion(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
            {ACCIONES.map((a) => <option key={a} value={a}>{a === "todos" ? "Todas las acciones" : labelAccion(a)}</option>)}
          </select>
          <select value={tabla} onChange={(e) => setTabla(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
            {TABLAS.map((t) => <option key={t} value={t}>{t === "todos" ? "Todas las tablas" : t}</option>)}
          </select>
          <select value={usuario} onChange={(e) => setUsuario(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
            <option value="todos">Todos los usuarios</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          <div className="relative">
            <Search size={14} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en auditoria"
              className="rounded-lg pl-8 pr-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-sol-borde">
          <div>
            <h2 className="font-extrabold text-sm text-sol-tinta">Eventos de auditoria</h2>
            <p className="text-xs text-sol-gris">
              {filtrados.length ? `Mostrando ${inicio + 1}-${fin} de ${filtrados.length}` : "Sin eventos para mostrar"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-sol-gris">
            Filas
            <select value={filasPorPagina} onChange={(e) => setFilasPorPagina(Number(e.target.value))}
              className="rounded-lg px-2 py-1.5 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
              {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead><tr className="bg-sol-suave text-sol-gris">
            {["Fecha", "Usuario", "Accion", "Tabla", "Registro", "Detalle"].map((h) =>
              <th key={h} className="px-3 py-2.5 font-bold text-left">{h}</th>)}
          </tr></thead>
          <tbody>
            {eventosPagina.map((e) => (
              <tr key={e.id} className="border-t border-sol-suave align-top">
                <td className="px-3 py-2.5 text-sol-gris whitespace-nowrap">{fmtFecha(e.fecha)}</td>
                <td className="px-3 py-2.5">
                  <div className="font-bold">{e.usuario || "Sistema"}</div>
                  <div className="text-[11px] text-sol-grisClaro">{e.correo || e.idUsuario || "Sin usuario"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-sol-suave text-sol-azulOsc">{labelAccion(e.accion)}</span>
                </td>
                <td className="px-3 py-2.5 text-sol-gris">{e.tabla}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{e.registroId || "—"}</td>
                <td className="px-3 py-2.5">
                  <p className="text-xs leading-relaxed max-w-[420px] rounded-lg bg-sol-crema p-2 text-sol-gris">
                    {detalleHumano(e)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!filtrados.length && <p className="text-sol-gris text-sm p-6 text-center">No hay eventos de auditoria para los filtros seleccionados.</p>}
        {filtrados.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-sol-borde">
            <button type="button" onClick={() => cambiarPagina(paginaActual - 1)} disabled={paginaActual <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-sol-borde bg-white px-3 py-2 text-xs font-extrabold text-sol-azul disabled:opacity-40 disabled:text-sol-gris">
              <ChevronLeft size={15} /> Anterior
            </button>
            <div className="flex items-center justify-center gap-1">
              {inicioPaginas > 1 && <span className="px-1 text-xs text-sol-gris">...</span>}
              {paginasVisibles.map((p) => (
                <button key={p} type="button" onClick={() => cambiarPagina(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-extrabold border ${p === paginaActual ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-gris border-sol-borde"}`}>
                  {p}
                </button>
              ))}
              {inicioPaginas + paginasVisibles.length - 1 < totalPaginas && <span className="px-1 text-xs text-sol-gris">...</span>}
            </div>
            <button type="button" onClick={() => cambiarPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas}
              className="inline-flex items-center gap-1 rounded-xl border border-sol-borde bg-white px-3 py-2 text-xs font-extrabold text-sol-azul disabled:opacity-40 disabled:text-sol-gris">
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
