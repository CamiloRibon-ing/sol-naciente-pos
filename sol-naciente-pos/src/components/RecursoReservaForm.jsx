import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";
import { formatoMontoInput, limpiarMonto } from "../lib/format";

export default function RecursoReservaForm({ inicial, onSave, onClose }) {
  const [f, setF] = useState(inicial ? {
    ...inicial,
    precio: formatoMontoInput(inicial.precio),
    precioFinSemana: formatoMontoInput(inicial.precioFinSemana),
  } : {
    tipo: "apartamento",
    nombre: "",
    descripcion: "",
    capacidad: "",
    precio: "",
    precioFinSemana: "",
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
        capacidad: Number(f.capacidad) || 0,
        precio: limpiarMonto(f.precio),
        precioFinSemana: limpiarMonto(f.precioFinSemana || f.precio),
        activo: f.activo !== false,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-lg">
      <ModalHeader title={inicial ? "Editar recurso" : "Nuevo recurso reservable"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Tipo</span>
          <select className={campo} value={f.tipo} onChange={(e) => set("tipo", e.target.value)} disabled={!!inicial}>
            <option value="apartamento">Apartamento / cabana</option>
            <option value="evento">Kiosko / salon / evento</option>
          </select>
        </label>
        <label>
          <span className={etiqueta}>Capacidad</span>
          <input type="number" min="0" className={campo} value={f.capacidad || ""} onChange={(e) => set("capacidad", e.target.value)} />
        </label>

        <label className="col-span-2">
          <span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Cabana 1, Salon principal, Kiosko 2" />
        </label>

        <label className="col-span-2">
          <span className={etiqueta}>Descripcion</span>
          <textarea className={campo} rows={2} value={f.descripcion || ""} onChange={(e) => set("descripcion", e.target.value)} />
        </label>

        <label>
          <span className={etiqueta}>{f.tipo === "apartamento" ? "Precio dia" : "Precio base"}</span>
          <input inputMode="numeric" className={campo} value={f.precio || ""} onChange={(e) => set("precio", formatoMontoInput(e.target.value))} />
        </label>
        {f.tipo === "apartamento" ? (
          <label>
            <span className={etiqueta}>Precio fin de semana</span>
            <input inputMode="numeric" className={campo} value={f.precioFinSemana || ""} onChange={(e) => set("precioFinSemana", formatoMontoInput(e.target.value))} />
          </label>
        ) : (
          <div />
        )}

        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Activo para nuevas reservas</span>
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? "Guardando..." : "Guardar recurso"}</Boton>
      </div>
    </Modal>
  );
}
