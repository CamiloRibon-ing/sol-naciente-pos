import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Truck, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { fmt, fmtFecha } from "../lib/format";
import { Boton, ConfirmDialog } from "../components/ui";
import ProveedorForm from "../components/ProveedorForm";
import CompraForm from "../components/CompraForm";

export default function Compras() {
  const { proveedores, compras, ingredientes, productos, guardarProveedor, eliminarProveedor, registrarCompra } = useStore();
  const [tab, setTab] = useState("compras");
  const [editProv, setEditProv] = useState(undefined);
  const [nuevaCompra, setNuevaCompra] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [fProveedor, setFProveedor] = useState("todos");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [compraAbierta, setCompraAbierta] = useState(null);

  const onSaveProv = async (p) => {
    try {
      await guardarProveedor(p);
      toast.success(p.id ? "Proveedor actualizado" : "Proveedor creado");
      setEditProv(undefined);
    } catch (e) {
      toast.error(e.message || "No se pudo guardar");
    }
  };

  const eliminar = async () => {
    try {
      await eliminarProveedor(confirmar.id);
      toast.success(`"${confirmar.nombre}" eliminado`);
    } catch (e) {
      toast.error(e.message || "No se pudo eliminar");
    } finally {
      setConfirmar(null);
    }
  };

  const onSaveCompra = async (payload) => {
    try {
      await registrarCompra(payload);
      toast.success("Compra registrada e inventario actualizado");
      setNuevaCompra(false);
    } catch (e) {
      toast.error(e.message || "No se pudo registrar la compra");
    }
  };

  const comprasFiltradas = useMemo(() => {
    return compras.filter((c) => {
      if (fProveedor !== "todos" && c.proveedorId !== fProveedor) return false;
      const f = new Date(c.fecha);
      if (fDesde && f < new Date(fDesde)) return false;
      if (fHasta && f > new Date(fHasta + "T23:59:59")) return false;
      return true;
    });
  }, [compras, fProveedor, fDesde, fHasta]);

  const totalPeriodo = comprasFiltradas.reduce((s, c) => s + c.total, 0);

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Compras y proveedores</h1>
          <p className="text-sol-gris text-[13px]">Abastecimiento de insumos y productos: registra compras y administra proveedores.</p>
        </div>
        <Boton onClick={() => (tab === "compras" ? setNuevaCompra(true) : setEditProv(null))}>
          <Plus size={16} /> {tab === "compras" ? "Nueva compra" : "Nuevo proveedor"}
        </Boton>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ id: "compras", t: "Compras", icon: Truck }, { id: "proveedores", t: "Proveedores", icon: Package }].map((x) => {
          const Icon = x.icon;
          return (
            <button key={x.id} onClick={() => setTab(x.id)}
              className={`rounded-full px-4 py-2 text-xs font-bold border flex items-center gap-1.5 ${tab === x.id ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde"}`}>
              <Icon size={14} /> {x.t}
            </button>
          );
        })}
      </div>

      {tab === "compras" ? (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <select value={fProveedor} onChange={(e) => setFProveedor(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
              <option value="todos">Todos los proveedores</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            <div className="ml-auto rounded-lg px-4 py-2 text-xs font-bold bg-sol-suave text-sol-azulOsc">
              Total del periodo: <span className="text-sm">{fmt(totalPeriodo)}</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
            <table className="w-full text-sm min-w-[860px]">
              <thead><tr className="bg-sol-suave text-sol-gris">
                {["Fecha", "Proveedor", "N. factura", "Detalle", "Items", "Total", ""].map((h, i) =>
                  <th key={h} className={`px-4 py-2.5 font-bold ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {comprasFiltradas.map((c) => {
                  const abierta = compraAbierta === c.id;
                  const resumen = c.items?.length
                    ? c.items.slice(0, 2).map((it) => `${it.nombre} x ${it.cantidad}`).join(", ") + (c.items.length > 2 ? ` +${c.items.length - 2}` : "")
                    : "Sin items";
                  return (
                    <Fragment key={c.id}>
                      <tr className="border-t border-sol-suave">
                        <td className="px-4 py-2.5 text-sol-gris whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                        <td className="px-4 py-2.5 font-bold">{c.proveedor}</td>
                        <td className="px-4 py-2.5 text-sol-gris">{c.numeroFactura || "-"}</td>
                        <td className="px-4 py-2.5 text-sol-gris max-w-[280px] truncate">{resumen}</td>
                        <td className="px-4 py-2.5 text-sol-gris">{c.items.length}</td>
                        <td className="px-4 py-2.5 text-right font-bold">{fmt(c.total)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setCompraAbierta(abierta ? null : c.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sol-borde px-2 py-1 text-xs font-bold text-sol-azul"
                          >
                            {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            Ver
                          </button>
                        </td>
                      </tr>
                      {abierta && (
                        <tr key={`${c.id}-detalle`} className="border-t border-sol-suave bg-sol-crema/70">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="mb-2 flex flex-wrap gap-3 text-xs text-sol-gris">
                              <span><b className="text-sol-tinta">Factura proveedor:</b> {c.numeroFactura || "Sin numero"}</span>
                              <span><b className="text-sol-tinta">Fecha:</b> {fmtFecha(c.fecha)}</span>
                              <span><b className="text-sol-tinta">Total:</b> {fmt(c.total)}</span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-sol-borde bg-white">
                              <table className="w-full text-xs min-w-[560px]">
                                <thead><tr className="bg-sol-suave text-sol-gris">
                                  {["Tipo", "Item comprado", "Cantidad", "Costo unitario", "Subtotal"].map((h, i) =>
                                    <th key={h} className={`px-3 py-2 font-bold ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                  {(c.items || []).map((it, idx) => (
                                    <tr key={`${c.id}-${it.productoId || it.ingredienteId || idx}`} className="border-t border-sol-suave">
                                      <td className="px-3 py-2 text-sol-gris">{it.tipo === "producto" ? "Producto" : "Insumo"}</td>
                                      <td className="px-3 py-2 font-bold">{it.nombre || "Sin nombre"}</td>
                                      <td className="px-3 py-2 text-right">{it.cantidad} {it.unidad || ""}</td>
                                      <td className="px-3 py-2 text-right">{fmt(it.costoUnitario)}</td>
                                      <td className="px-3 py-2 text-right font-bold">{fmt(it.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!comprasFiltradas.length && <p className="text-sol-gris text-sm p-6 text-center">No hay compras registradas en este periodo.</p>}
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Proveedor", "NIT", "Telefono", "Correo", "Estado", ""].map((h) =>
                <th key={h} className="px-4 py-2.5 font-bold text-left">{h}</th>)}
            </tr></thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id} className="border-t border-sol-suave">
                  <td className="px-4 py-2.5 font-bold">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{p.nit || "-"}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{p.telefono || "-"}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{p.correo || "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: (p.activo ? "#159A5A" : "#9AA1AD") + "1A", color: p.activo ? "#159A5A" : "#9AA1AD" }}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditProv(p)} className="p-1.5"><Pencil size={15} className="text-sol-azul" /></button>
                    <button onClick={() => setConfirmar({ id: p.id, nombre: p.nombre })} className="p-1.5"><Trash2 size={15} className="text-sol-rojo" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!proveedores.length && <p className="text-sol-gris text-sm p-6 text-center">Aun no has registrado proveedores.</p>}
        </div>
      )}

      {editProv !== undefined && <ProveedorForm inicial={editProv} onSave={onSaveProv} onClose={() => setEditProv(undefined)} />}
      {nuevaCompra && <CompraForm proveedores={proveedores} ingredientes={ingredientes} productos={productos} onSave={onSaveCompra} onClose={() => setNuevaCompra(false)} />}
      {confirmar && (
        <ConfirmDialog
          titulo="Eliminar proveedor"
          mensaje={`Seguro que deseas eliminar "${confirmar.nombre}"? Esta accion no se puede deshacer.`}
          onConfirm={eliminar}
          onClose={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
