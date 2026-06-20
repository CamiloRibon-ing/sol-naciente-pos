import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";

const COLORES = ["#E22B23", "#F58220", "#1A4FA0", "#FBB814", "#B71F18", "#159A5A", "#6B7280", "#8B5CF6"];

export default function CategoriaForm({ inicial, onSave, onClose }) {
  const [f, setF] = useState(inicial || {
    nombre: "",
    descripcion: "",
    color: "#1A4FA0",
    activo: true,
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    if (!f.nombre.trim()) return;
    setGuardando(true);
    try {
      await onSave({
        ...f,
        nombre: f.nombre.trim(),
        descripcion: (f.descripcion || "").trim(),
        color: f.color || "#1A4FA0",
        activo: f.activo !== false,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-lg">
      <ModalHeader title={inicial ? "Editar categoria" : "Nueva categoria"} onClose={onClose} />
      <div className="p-4 space-y-3">
        <label>
          <span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Postres, Snacks, Cocteles" />
        </label>
        <label>
          <span className={etiqueta}>Descripcion</span>
          <textarea className={campo} rows={2} value={f.descripcion || ""} onChange={(e) => set("descripcion", e.target.value)} />
        </label>
        <div>
          <span className={etiqueta}>Color</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {COLORES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set("color", color)}
                className={`w-8 h-8 rounded-lg border-2 ${f.color === color ? "border-sol-tinta" : "border-white"}`}
                style={{ background: color }}
                title={color}
              />
            ))}
            <input className={`${campo} w-28`} value={f.color || ""} onChange={(e) => set("color", e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Activa para nuevos productos y filtros</span>
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? "Guardando..." : "Guardar categoria"}</Boton>
      </div>
    </Modal>
  );
}
