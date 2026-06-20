import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";

const MOTIVOS = [
  { id: "conteo", label: "Diferencia de conteo físico" },
  { id: "merma", label: "Merma" },
  { id: "dano", label: "Daño / deterioro" },
  { id: "otro", label: "Otro" },
];

// Ajuste manual de stock de un ingrediente: registra entrada/salida con motivo y nota.
export default function AjusteStockForm({ ingrediente, onSave, onClose }) {
  const [tipo, setTipo] = useState("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0].id);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cant = Number(cantidad) || 0;
  const delta = tipo === "entrada" ? cant : -cant;
  const stockResultante = Math.max(0, (ingrediente?.stock || 0) + delta);

  const guardar = async () => {
    if (!cant) return;
    setGuardando(true);
    try {
      await onSave({ id: ingrediente.id, delta, motivo, nota: nota.trim() });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={`Ajuste de stock — ${ingrediente?.nombre}`} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-lg bg-sol-suave px-3 py-2 text-xs text-sol-gris flex justify-between">
          <span>Stock actual</span>
          <span className="font-bold text-sol-tinta">{ingrediente?.stock} {ingrediente?.unidad}</span>
        </div>
        <label><span className={etiqueta}>Tipo de ajuste</span>
          <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="entrada">Aumentar stock</option>
            <option value="salida">Disminuir stock</option>
          </select></label>
        <label><span className={etiqueta}>Cantidad ({ingrediente?.unidad})</span>
          <input type="number" min="0" step="0.01" className={campo} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" /></label>
        <label className="col-span-2"><span className={etiqueta}>Motivo</span>
          <select className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select></label>
        <label className="col-span-2"><span className={etiqueta}>Nota (opcional)</span>
          <input className={campo} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Detalle del ajuste…" /></label>
        <div className="col-span-2 rounded-lg bg-sol-crema px-3 py-2 text-xs flex justify-between">
          <span className="text-sol-gris">Stock resultante</span>
          <span className="font-extrabold text-sol-azul">{stockResultante} {ingrediente?.unidad}</span>
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !cant}>{guardando ? "Guardando…" : "Aplicar ajuste"}</Boton>
      </div>
    </Modal>
  );
}
