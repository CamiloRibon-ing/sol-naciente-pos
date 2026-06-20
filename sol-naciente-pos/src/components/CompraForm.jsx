import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";
import { fmt, formatoMontoInput, limpiarMonto } from "../lib/format";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function CompraForm({ proveedores, ingredientes, productos = [], onSave, onClose }) {
  const productosStockDirecto = useMemo(
    () => productos.filter((p) => p.controlaInventario && !(p.receta || []).length),
    [productos]
  );
  const [f, setF] = useState({ idProveedor: proveedores[0]?.id || "", numeroFactura: "", fecha: hoy(), items: [] });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const itemInicial = () => {
    if (ingredientes.length) {
      return { tipo: "ingrediente", ingredienteId: ingredientes[0].id, productoId: "", cantidad: 1, costoUnitario: formatoMontoInput(ingredientes[0].costo || 0) };
    }
    const prod = productosStockDirecto[0];
    return { tipo: "producto", ingredienteId: "", productoId: prod?.id || "", cantidad: 1, costoUnitario: formatoMontoInput(prod?.costo || 0) };
  };

  const addItem = () => set("items", [...f.items, itemInicial()]);
  const setItem = (i, k, v) => {
    set("items", f.items.map((it, idx) => {
      if (idx !== i) return it;
      if (k === "tipo") {
        if (v === "producto") {
          const prod = productosStockDirecto[0];
          return { ...it, tipo: "producto", ingredienteId: "", productoId: prod?.id || "", costoUnitario: formatoMontoInput(prod?.costo || 0) };
        }
        const ing = ingredientes[0];
        return { ...it, tipo: "ingrediente", ingredienteId: ing?.id || "", productoId: "", costoUnitario: formatoMontoInput(ing?.costo || 0) };
      }
      if (k === "ingredienteId") {
        const ing = ingredientes.find((x) => x.id === v);
        return { ...it, ingredienteId: v, costoUnitario: formatoMontoInput(ing?.costo || it.costoUnitario) };
      }
      if (k === "productoId") {
        const prod = productosStockDirecto.find((x) => x.id === v);
        return { ...it, productoId: v, costoUnitario: formatoMontoInput(prod?.costo || it.costoUnitario) };
      }
      return { ...it, [k]: v };
    }));
  };
  const delItem = (i) => set("items", f.items.filter((_, idx) => idx !== i));

  const total = f.items.reduce((s, it) => s + (+it.cantidad || 0) * limpiarMonto(it.costoUnitario), 0);

  const guardar = async () => {
    const items = f.items
      .map((it) => ({
        tipo: it.tipo || "ingrediente",
        ingredienteId: it.tipo === "producto" ? null : it.ingredienteId,
        productoId: it.tipo === "producto" ? it.productoId : null,
        cantidad: +it.cantidad || 0,
        costoUnitario: limpiarMonto(it.costoUnitario),
      }))
      .filter((it) => it.cantidad > 0 && (it.ingredienteId || it.productoId));

    if (!items.length) return;
    setGuardando(true);
    try {
      await onSave({
        idProveedor: f.idProveedor || null,
        numeroFactura: f.numeroFactura,
        fecha: new Date(f.fecha).toISOString(),
        items,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-3xl">
      <ModalHeader title="Registrar compra" onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label><span className={etiqueta}>Proveedor</span>
          <select className={campo} value={f.idProveedor} onChange={(e) => set("idProveedor", e.target.value)}>
            {!proveedores.length && <option value="">Sin proveedores registrados</option>}
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></label>
        <label><span className={etiqueta}>N. de factura del proveedor</span>
          <input className={campo} value={f.numeroFactura} onChange={(e) => set("numeroFactura", e.target.value)} placeholder="Ej: FV-00123" /></label>
        <label className="col-span-2"><span className={etiqueta}>Fecha de la compra</span>
          <input type="date" className={campo} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></label>

        <div className="col-span-2 rounded-xl border border-sol-borde p-3 bg-sol-crema">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-sol-tinta">Items comprados</span>
            <button type="button" onClick={addItem} className="text-xs font-bold text-sol-azul flex items-center gap-1" disabled={!ingredientes.length && !productosStockDirecto.length}>
              <Plus size={13} /> Agregar
            </button>
          </div>
          {!f.items.length && <p className="text-xs text-sol-grisClaro">Agrega ingredientes o productos con stock directo para registrar la compra.</p>}
          {f.items.map((it, i) => {
            const sub = (+it.cantidad || 0) * limpiarMonto(it.costoUnitario);
            return (
              <div key={i} className="grid gap-2 mb-2" style={{ gridTemplateColumns: "120px minmax(180px, 1fr) 82px 112px 90px 28px" }}>
                <select className={campo} value={it.tipo || "ingrediente"} onChange={(e) => setItem(i, "tipo", e.target.value)}>
                  <option value="ingrediente" disabled={!ingredientes.length}>Insumo</option>
                  <option value="producto" disabled={!productosStockDirecto.length}>Producto</option>
                </select>
                {(it.tipo || "ingrediente") === "producto" ? (
                  <select className={campo} value={it.productoId || ""} onChange={(e) => setItem(i, "productoId", e.target.value)}>
                    {!productosStockDirecto.length && <option value="">Sin productos con stock directo</option>}
                    {productosStockDirecto.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                ) : (
                  <select className={campo} value={it.ingredienteId || ""} onChange={(e) => setItem(i, "ingredienteId", e.target.value)}>
                    {ingredientes.map((g) => <option key={g.id} value={g.id}>{g.nombre} ({g.unidad})</option>)}
                  </select>
                )}
                <input type="number" step="0.01" min="0" className={campo} value={it.cantidad}
                  onChange={(e) => setItem(i, "cantidad", e.target.value)} title="Cantidad" />
                <input inputMode="numeric" className={campo} value={it.costoUnitario}
                  onChange={(e) => setItem(i, "costoUnitario", formatoMontoInput(e.target.value))} title="Costo unitario" />
                <span className="text-xs font-bold text-right self-center">{fmt(sub)}</span>
                <button type="button" onClick={() => delItem(i)} className="self-center"><Trash2 size={16} className="text-sol-rojo" /></button>
              </div>
            );
          })}
          {f.items.length > 0 && (
            <div className="flex justify-between pt-2 mt-2 border-t border-sol-borde text-sm font-extrabold text-sol-azul">
              <span>Total compra</span><span>{fmt(total)}</span>
            </div>
          )}
        </div>
        <p className="col-span-2 text-xs text-sol-gris -mt-1">
          Al guardar, los insumos alimentan el inventario por bodega. Los productos con stock directo aumentan su existencia propia y actualizan su costo unitario.
        </p>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.items.length}>{guardando ? "Guardando..." : "Registrar compra"}</Boton>
      </div>
    </Modal>
  );
}
