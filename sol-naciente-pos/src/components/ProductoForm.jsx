import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";
import ImageUpload from "./ImageUpload";
import ProductCard from "./ProductCard";
import { formatoMontoInput, limpiarMonto } from "../lib/format";

export default function ProductoForm({ inicial, ingredientes, categorias = [], onSave, onClose }) {
  const [f, setF] = useState(
    inicial
      ? { ...inicial, precio: formatoMontoInput(inicial.precio), costo: formatoMontoInput(inicial.costo) }
      : { cat: categorias.find((c) => c.activo !== false)?.id || "comidas", nombre: "", desc: "", precio: "", costo: "", imagen: "", activo: true, controlaInventario: true, stock: "", stockMin: "", receta: [] }
  );
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const addReceta = () => set("receta", [...(f.receta || []), { ingredienteId: ingredientes[0]?.id || "", cantidad: 1 }]);
  const setReceta = (i, k, v) => set("receta", f.receta.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const delReceta = (i) => set("receta", f.receta.filter((_, idx) => idx !== i));

  const guardar = async () => {
    if (!f.nombre.trim()) return;
    setGuardando(true);
    try {
      await onSave({
        ...f,
        precio: limpiarMonto(f.precio),
        costo: limpiarMonto(f.costo),
        stock: +f.stock || 0,
        stockMin: +f.stockMin || 0,
        receta: f.controlaInventario ? (f.receta || []).map((r) => ({ ...r, cantidad: +r.cantidad || 0 })) : [],
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-xl">
      <ModalHeader title={inicial ? "Editar producto" : "Nuevo producto"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <div><ImageUpload value={f.imagen} onChange={(url) => set("imagen", url)} /></div>
        <div>
          <span className={etiqueta}>Vista previa</span>
          <div className="mt-1 max-w-[160px]">
            <ProductCard p={{ ...f, precio: limpiarMonto(f.precio), costo: limpiarMonto(f.costo) }} disponible={Infinity} onAdd={() => {}} />
          </div>
        </div>

        <label className="col-span-2">{<span className={etiqueta}>Nombre</span>}
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Hamburguesa sencilla" /></label>

        <label className="col-span-2"><span className={etiqueta}>Descripción</span>
          <textarea className={campo} rows={2} value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Lo que verá el cliente en el menú" /></label>

        <label><span className={etiqueta}>Categoría</span>
          <select className={campo} value={f.cat} onChange={(e) => set("cat", e.target.value)}>
            {categorias.filter((c) => c.activo !== false || c.id === f.cat).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>

        <label className="flex items-end gap-2 pb-1">
          <input type="checkbox" checked={f.controlaInventario} onChange={(e) => set("controlaInventario", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-xs font-bold text-sol-gris">Controla inventario (descuenta receta)</span>
        </label>

        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Producto activo (visible en el punto de venta)</span>
        </label>

        <label><span className={etiqueta}>Precio de venta</span>
          <input inputMode="numeric" className={campo} value={f.precio} onChange={(e) => set("precio", formatoMontoInput(e.target.value))} /></label>
        <label><span className={etiqueta}>Costo de referencia</span>
          <input inputMode="numeric" className={campo} value={f.costo} onChange={(e) => set("costo", formatoMontoInput(e.target.value))} /></label>

        {f.controlaInventario && !(f.receta || []).length && (
          <>
            <label><span className={etiqueta}>Stock directo</span>
              <input type="number" step="1" min="0" className={campo} value={f.stock || ""} onChange={(e) => set("stock", e.target.value)} placeholder="Cantidad disponible" /></label>
            <label><span className={etiqueta}>Stock minimo</span>
              <input type="number" step="1" min="0" className={campo} value={f.stockMin || ""} onChange={(e) => set("stockMin", e.target.value)} placeholder="Alerta minima" /></label>
          </>
        )}

        {f.controlaInventario && (
          <div className="col-span-2 rounded-xl border border-sol-borde p-3 bg-sol-crema">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-sol-tinta">Receta (ingredientes que consume)</span>
              <button type="button" onClick={addReceta} className="text-xs font-bold text-sol-azul flex items-center gap-1"><Plus size={13} /> Agregar</button>
            </div>
            {!(f.receta || []).length && <p className="text-xs text-sol-grisClaro">Sin ingredientes. La disponibilidad será ilimitada.</p>}
            {(f.receta || []).map((r, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <select className={`${campo} flex-1`} value={r.ingredienteId} onChange={(e) => setReceta(i, "ingredienteId", e.target.value)}>
                  {ingredientes.map((g) => <option key={g.id} value={g.id}>{g.nombre} ({g.unidad})</option>)}
                </select>
                <input type="number" step="0.01" className={`${campo} w-24`} value={r.cantidad} onChange={(e) => setReceta(i, "cantidad", e.target.value)} />
                <button type="button" onClick={() => delReceta(i)}><Trash2 size={16} className="text-sol-rojo" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? "Guardando…" : "Guardar producto"}</Boton>
      </div>
    </Modal>
  );
}
