import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Store, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { fmt } from "../lib/format";
import { Boton, ConfirmDialog } from "../components/ui";
import PuntoVentaForm from "../components/PuntoVentaForm";

const idsConDescendientes = (puntos, id) => {
  const ids = new Set([id]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    puntos.forEach((p) => {
      if (p.idPuntoPadre && ids.has(p.idPuntoPadre) && !ids.has(p.id)) {
        ids.add(p.id);
        cambio = true;
      }
    });
  }
  return [...ids];
};

export default function Locales() {
  const { puntosVenta, bodegas, guardarPuntoVenta, eliminarPuntoVenta, historialVentas, cajasAbiertas, cargarHistorial } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [editar, setEditar] = useState(undefined);
  const [confirmar, setConfirmar] = useState(null);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const nombrePadre = (p) => puntosVenta.find((x) => x.id === p.idPuntoPadre)?.nombre || "Principal";
  const bodegaNombre = (p) => p.bodega || bodegas.find((b) => b.id === p.idBodega)?.nombre || "Sin bodega";

  const metricas = useMemo(() => {
    const base = {};
    puntosVenta.forEach((p) => {
      const ids = idsConDescendientes(puntosVenta, p.id);
      const ventas = historialVentas.filter((v) => ids.includes(v.id_punto) && v.estado !== "anulada");
      base[p.id] = {
        ventas: ventas.length,
        ingresos: ventas.reduce((s, v) => s + (Number(v.total) || 0), 0),
        hijos: puntosVenta.filter((x) => x.idPuntoPadre === p.id).length,
      };
    });
    return base;
  }, [puntosVenta, historialVentas]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return puntosVenta.filter((p) =>
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.ubicacion || "").toLowerCase().includes(q) ||
      nombrePadre(p).toLowerCase().includes(q)
    );
  }, [puntosVenta, busqueda]);

  const onSave = async (p) => {
    try {
      await guardarPuntoVenta(p);
      toast.success(p.id ? "Local actualizado" : "Local creado");
      setEditar(undefined);
    } catch (e) {
      toast.error(e.message || "No se pudo guardar el local");
    }
  };

  const toggleActivo = async (p) => {
    try {
      await guardarPuntoVenta({ ...p, activo: p.activo === false });
      toast.success(p.activo === false ? "Local activado" : "Local desactivado");
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar el estado");
    }
  };

  const eliminar = async () => {
    try {
      await eliminarPuntoVenta(confirmar.id);
      toast.success(`"${confirmar.nombre}" eliminado`);
    } catch (e) {
      toast.error("No se pudo eliminar. Si ya tiene ventas o cajas, desactivalo para conservar el historial.");
    } finally {
      setConfirmar(null);
    }
  };

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Locales y kioscos</h1>
          <p className="text-sol-gris text-[13px]">Administra puntos de venta, jerarquia, estado operativo y datos de supervision.</p>
        </div>
        <Boton onClick={() => setEditar(null)}><Plus size={16} /> Nuevo local</Boton>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={17} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar local, ubicacion o padre..."
          className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
      </div>

      <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
        <table className="w-full text-sm min-w-[920px]">
          <thead><tr className="bg-sol-suave text-sol-gris">
            {["Local", "Pertenece a", "Bodega", "Ventas", "Ingresos", "Estado", "Caja", ""].map((h, i) =>
              <th key={i} className={`px-4 py-2.5 font-bold ${[3, 4].includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtrados.map((p) => {
              const m = metricas[p.id] || { ventas: 0, ingresos: 0, hijos: 0 };
              const cajaAbierta = cajasAbiertas.find((c) => c.id_punto === p.id);
              return (
                <tr key={p.id} className="border-t border-sol-suave">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Store size={15} className={p.idPuntoPadre ? "text-sol-gris" : "text-sol-azul"} />
                      <div>
                        <div className="font-bold">{p.nombre}</div>
                        <div className="text-sol-grisClaro text-[11px]">{p.ubicacion || "Sin ubicacion"} {m.hijos ? `- ${m.hijos} sublocal(es)` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sol-gris">{p.idPuntoPadre ? nombrePadre(p) : "Raiz"}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{bodegaNombre(p)}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{m.ventas}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-sol-azul">{fmt(m.ingresos)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: (p.activo !== false ? "#159A5A" : "#9AA1AD") + "1A", color: p.activo !== false ? "#159A5A" : "#9AA1AD" }}>
                      {p.activo !== false ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: (cajaAbierta ? "#159A5A" : "#9AA1AD") + "1A", color: cajaAbierta ? "#159A5A" : "#9AA1AD" }}>
                      {cajaAbierta ? "Abierta" : "Cerrada"}
                    </span>
                    {cajaAbierta?.fecha_apertura && <div className="text-[11px] text-sol-grisClaro mt-1">{new Date(cajaAbierta.fecha_apertura).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => toggleActivo(p)} className="p-1.5" title={p.activo !== false ? "Desactivar" : "Activar"}>
                      {p.activo !== false ? <ToggleRight size={17} className="text-sol-exito" /> : <ToggleLeft size={17} className="text-sol-gris" />}
                    </button>
                    <button onClick={() => setEditar(p)} className="p-1.5" title="Editar"><Pencil size={15} className="text-sol-azul" /></button>
                    <button onClick={() => setConfirmar(p)} className="p-1.5" title="Eliminar"><Trash2 size={15} className="text-sol-rojo" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtrados.length && <p className="text-sol-gris text-sm p-6 text-center">No hay locales que coincidan con la busqueda.</p>}
      </div>

      {editar !== undefined && (
        <PuntoVentaForm
          inicial={editar}
          puntosVenta={puntosVenta}
          bodegas={bodegas}
          onSave={onSave}
          onClose={() => setEditar(undefined)}
        />
      )}

      {confirmar && (
        <ConfirmDialog
          titulo="Eliminar local"
          mensaje={`Eliminar "${confirmar.nombre}"? Si tiene ventas, cajas o locales hijos, Supabase no permitira borrarlo. En ese caso usa desactivar.`}
          confirmar="Eliminar"
          onConfirm={eliminar}
          onClose={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
