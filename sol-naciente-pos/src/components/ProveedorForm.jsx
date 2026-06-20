import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";

export default function ProveedorForm({ inicial, onSave, onClose }) {
  const [f, setF] = useState(inicial || { nombre: "", nit: "", telefono: "", correo: "", activo: true });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    if (!f.nombre.trim()) return;
    setGuardando(true);
    try {
      await onSave(f);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={inicial ? "Editar proveedor" : "Nuevo proveedor"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label className="col-span-2"><span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Distribuidora La Cosecha" /></label>
        <label><span className={etiqueta}>NIT</span>
          <input className={campo} value={f.nit} onChange={(e) => set("nit", e.target.value)} placeholder="900.000.000-0" /></label>
        <label><span className={etiqueta}>Teléfono</span>
          <input className={campo} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="300 000 0000" /></label>
        <label className="col-span-2"><span className={etiqueta}>Correo</span>
          <input type="email" className={campo} value={f.correo} onChange={(e) => set("correo", e.target.value)} placeholder="contacto@proveedor.com" /></label>
        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Proveedor activo</span>
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? "Guardando…" : "Guardar"}</Boton>
      </div>
    </Modal>
  );
}
