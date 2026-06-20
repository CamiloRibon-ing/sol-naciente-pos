import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";

export default function UsuarioForm({ inicial, roles = [], puntosVenta = [], onSave, onPassword, onClose }) {
  const esNuevo = !inicial;
  const rolCajero = roles.find((r) => r.nombre === "cajero") || roles[0];
  const [f, setF] = useState(inicial || {
    nombre: "",
    correo: "",
    documento: "",
    telefono: "",
    rolId: rolCajero?.id || "",
    puntoVentaId: "",
    activo: true,
    password: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [nuevoPassword, setNuevoPassword] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    if (!f.nombre.trim() || !f.correo.trim() || !f.rolId) return;
    if (esNuevo && !f.password) return;
    setGuardando(true);
    try {
      await onSave({
        ...f,
        nombre: f.nombre.trim(),
        correo: f.correo.trim().toLowerCase(),
        documento: (f.documento || "").trim(),
        telefono: (f.telefono || "").trim(),
        puntoVentaId: f.puntoVentaId || null,
        activo: f.activo !== false,
      });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async () => {
    if (!nuevoPassword || nuevoPassword.length < 6) return;
    setGuardando(true);
    try {
      await onPassword(inicial.id, nuevoPassword);
      setNuevoPassword("");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-2xl">
      <ModalHeader title={esNuevo ? "Nuevo usuario" : "Editar usuario"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Nombre completo</span>
          <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </label>
        <label>
          <span className={etiqueta}>Correo de acceso</span>
          <input type="email" className={campo} value={f.correo} onChange={(e) => set("correo", e.target.value)} disabled={!esNuevo} />
        </label>

        <label>
          <span className={etiqueta}>Documento</span>
          <input className={campo} value={f.documento || ""} onChange={(e) => set("documento", e.target.value)} />
        </label>
        <label>
          <span className={etiqueta}>Telefono</span>
          <input className={campo} value={f.telefono || ""} onChange={(e) => set("telefono", e.target.value)} />
        </label>

        <label>
          <span className={etiqueta}>Rol / nivel de acceso</span>
          <select className={campo} value={f.rolId || ""} onChange={(e) => set("rolId", e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Local asignado</span>
          <select className={campo} value={f.puntoVentaId || ""} onChange={(e) => set("puntoVentaId", e.target.value)}>
            <option value="">Todos / sin local fijo</option>
            {puntosVenta.map((p) => <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>)}
          </select>
        </label>

        {esNuevo && (
          <label className="col-span-2">
            <span className={etiqueta}>Contraseña inicial</span>
            <input type="password" className={campo} value={f.password} onChange={(e) => set("password", e.target.value)} minLength={6} />
          </label>
        )}

        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.activo !== false} onChange={(e) => set("activo", e.target.checked)} className="w-4 h-4 accent-sol-azul" />
          <span className="text-sm font-bold">Usuario activo y autorizado para ingresar</span>
        </label>

        {!esNuevo && (
          <div className="col-span-2 rounded-xl border border-sol-borde p-3 bg-sol-crema/60">
            <div className="text-xs font-bold text-sol-gris mb-2">Cambiar contraseña</div>
            <div className="flex gap-2">
              <input type="password" className={campo} value={nuevoPassword} onChange={(e) => setNuevoPassword(e.target.value)} placeholder="Nueva contraseña" minLength={6} />
              <Boton onClick={cambiarPassword} disabled={guardando || nuevoPassword.length < 6}>
                <KeyRound size={15} /> Actualizar
              </Boton>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.nombre.trim() || !f.correo.trim() || !f.rolId || (esNuevo && !f.password)}>
          {guardando ? "Guardando..." : "Guardar usuario"}
        </Boton>
      </div>
    </Modal>
  );
}
