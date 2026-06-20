import { useState } from "react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";
import { formatoMontoInput, limpiarMonto } from "../lib/format";

const TIPOS_CONTRATO = ["Término fijo", "Término indefinido", "Prestación de servicios", "Obra o labor"];

export default function EmpleadoForm({ inicial, cargosSugeridos = [], onSave, onClose }) {
  const [f, setF] = useState(
    inicial ? { ...inicial, salarioBase: formatoMontoInput(inicial.salarioBase) } : { nombre: "", documento: "", cargo: "", salarioBase: "", tipoContrato: "", fechaIngreso: "", fechaRetiro: "", telefono: "", correo: "", activo: true }
  );
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    if (!f.nombre.trim() || !f.cargo.trim()) return;
    setGuardando(true);
    try {
      await onSave({ ...f, salarioBase: limpiarMonto(f.salarioBase) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={inicial ? "Editar empleado" : "Nuevo empleado"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label className="col-span-2"><span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre completo" /></label>
        <label><span className={etiqueta}>Documento</span>
          <input className={campo} value={f.documento} onChange={(e) => set("documento", e.target.value)} placeholder="N.º de identificación" /></label>
        <label><span className={etiqueta}>Cargo</span>
          <input className={campo} list="cargos-sugeridos" value={f.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Ej: Mesero, Salvavidas" />
          <datalist id="cargos-sugeridos">
            {cargosSugeridos.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label><span className={etiqueta}>Salario base</span>
          <input inputMode="numeric" className={campo} value={f.salarioBase} onChange={(e) => set("salarioBase", formatoMontoInput(e.target.value))} placeholder="0" /></label>
        <label><span className={etiqueta}>Tipo de contrato</span>
          <select className={campo} value={f.tipoContrato} onChange={(e) => set("tipoContrato", e.target.value)}>
            <option value="">Selecciona…</option>
            {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label><span className={etiqueta}>Fecha de ingreso</span>
          <input type="date" className={campo} value={f.fechaIngreso || ""} onChange={(e) => set("fechaIngreso", e.target.value)} /></label>
        <label><span className={etiqueta}>Fecha de retiro</span>
          <input type="date" className={campo} value={f.fechaRetiro || ""} onChange={(e) => set("fechaRetiro", e.target.value)} /></label>
        <label><span className={etiqueta}>Teléfono</span>
          <input className={campo} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="300 000 0000" /></label>
        <label className="col-span-2"><span className={etiqueta}>Correo</span>
          <input type="email" className={campo} value={f.correo} onChange={(e) => set("correo", e.target.value)} placeholder="correo@solnaciente.co" /></label>
        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Empleado activo</span>
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim() || !f.cargo.trim()}>{guardando ? "Guardando…" : "Guardar"}</Boton>
      </div>
    </Modal>
  );
}
