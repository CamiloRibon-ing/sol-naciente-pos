import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";
import { formatoMontoInput, limpiarMonto } from "../lib/format";

export default function IngredienteForm({ inicial, onSave, onClose }) {
  const [f, setF] = useState(inicial ? { ...inicial, costo: formatoMontoInput(inicial.costo) } : { nombre: "", unidad: "und", stock: "", stockMin: "", costo: "" });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    if (!f.nombre.trim()) return;
    setGuardando(true);
    try {
      await onSave({ ...f, stock: +f.stock || 0, stockMin: +f.stockMin || 0, costo: limpiarMonto(f.costo) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={inicial ? "Editar ingrediente" : "Nuevo ingrediente"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label className="col-span-2"><span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Pollo" /></label>
        <label><span className={etiqueta}>Unidad</span>
          <select className={campo} value={f.unidad} onChange={(e) => set("unidad", e.target.value)}>
            {["und", "kg", "g", "l", "ml"].map((u) => <option key={u}>{u}</option>)}
          </select></label>
        <label><span className={etiqueta}>Costo unitario</span>
          <input inputMode="numeric" className={campo} value={f.costo} onChange={(e) => set("costo", formatoMontoInput(e.target.value))} /></label>
        <label><span className={etiqueta}>Stock actual</span>
          <input type="number" step="0.01" className={campo} value={f.stock} onChange={(e) => set("stock", e.target.value)} /></label>
        <label><span className={etiqueta}>Stock mínimo</span>
          <input type="number" step="0.01" className={campo} value={f.stockMin} onChange={(e) => set("stockMin", e.target.value)} /></label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? "Guardando…" : "Guardar"}</Boton>
      </div>
    </Modal>
  );
}
