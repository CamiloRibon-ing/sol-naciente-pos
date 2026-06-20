import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";

export default function PuntoVentaForm({ inicial, puntosVenta = [], bodegas = [], onSave, onClose }) {
  const [f, setF] = useState(inicial || {
    nombre: "",
    ubicacion: "",
    idBodega: bodegas.find((b) => b.activo !== false)?.id || bodegas[0]?.id || "",
    idPuntoPadre: "",
    activo: true,
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const padres = puntosVenta.filter((p) => p.id !== f.id && p.activo !== false);

  const guardar = async () => {
    if (!f.nombre.trim()) return;
    setGuardando(true);
    try {
      await onSave({
        ...f,
        nombre: f.nombre.trim(),
        ubicacion: f.ubicacion.trim(),
        idBodega: f.idBodega || null,
        idPuntoPadre: f.idPuntoPadre || null,
        activo: f.activo !== false,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-lg">
      <ModalHeader title={inicial ? "Editar local" : "Nuevo local"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Kiosco piscina" />
        </label>

        <label className="col-span-2">
          <span className={etiqueta}>Ubicacion</span>
          <input className={campo} value={f.ubicacion || ""} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Ej: Zona de piscinas" />
        </label>

        <label>
          <span className={etiqueta}>Bodega</span>
          <select className={campo} value={f.idBodega || ""} onChange={(e) => set("idBodega", e.target.value)}>
            <option value="">Sin bodega</option>
            {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </label>

        <label>
          <span className={etiqueta}>Pertenece a</span>
          <select className={campo} value={f.idPuntoPadre || ""} onChange={(e) => set("idPuntoPadre", e.target.value)}>
            <option value="">Punto principal / raiz</option>
            {padres.map((p) => <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>)}
          </select>
        </label>

        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Local activo para venta y caja</span>
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? "Guardando..." : "Guardar local"}</Boton>
      </div>
    </Modal>
  );
}
