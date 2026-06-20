import { useMemo, useState } from "react";
import { METODOS_PAGO, formatoMontoInput, limpiarMonto } from "../lib/format";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";

const ESTADOS = ["pendiente", "confirmada", "en_curso", "finalizada", "cancelada"];
const ESTADO_LABEL = {
  pendiente: "Pendiente por confirmar",
  confirmada: "Confirmada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada / no asistio",
};
const ESTADO_AYUDA = {
  pendiente: "Usalo cuando la solicitud aun no esta aprobada o falta confirmacion del cliente.",
  confirmada: "Usalo cuando la reserva ya esta aprobada y queda esperando la llegada del cliente.",
  en_curso: "Usalo cuando el cliente ya llego y esta usando el recurso.",
  finalizada: "Usalo cuando el servicio ya termino.",
  cancelada: "Usalo cuando el cliente cancelo o no asistio.",
};

const toLocalInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const toIso = (value) => (value ? new Date(value).toISOString() : "");

export default function ReservaForm({ inicial, clientes = [], recursos = [], onSave, onClose }) {
  const recursoInicial = inicial ? recursos.find((r) => r.id === inicial.recursoId) : recursos.find((r) => r.activo !== false);
  const [f, setF] = useState({
    id: inicial?.id,
    tipo: inicial?.tipo || recursoInicial?.tipo || "apartamento",
    recursoId: inicial?.recursoId || recursoInicial?.id || "",
    clienteId: inicial?.clienteId || "",
    cliente: inicial?.cliente || "",
    fechaInicio: toLocalInput(inicial?.fechaInicio) || "",
    fechaFin: toLocalInput(inicial?.fechaFin) || "",
    personas: inicial?.personas || "",
    montoTotal: formatoMontoInput(inicial?.montoTotal || recursoInicial?.precio || ""),
    anticipo: formatoMontoInput(inicial?.anticipo || ""),
    metodoAnticipo: "Efectivo",
    estado: inicial?.estado || "pendiente",
    notas: inicial?.notas || "",
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const recursosTipo = useMemo(
    () => recursos.filter((r) => r.tipo === f.tipo && (r.activo !== false || r.id === f.recursoId)),
    [recursos, f.tipo, f.recursoId]
  );

  const cambiarTipo = (tipo) => {
    const primero = recursos.find((r) => r.tipo === tipo && r.activo !== false);
    setF((s) => ({ ...s, tipo, recursoId: primero?.id || "", montoTotal: formatoMontoInput(primero?.precio || s.montoTotal) }));
  };

  const cambiarRecurso = (id) => {
    const r = recursos.find((x) => x.id === id);
    setF((s) => ({ ...s, recursoId: id, montoTotal: s.montoTotal || formatoMontoInput(r?.precio || "") }));
  };

  const guardar = async () => {
    if (!f.recursoId || !f.fechaInicio || !f.fechaFin) return;
    setGuardando(true);
    try {
      await onSave({
        ...f,
        fechaInicio: toIso(f.fechaInicio),
        fechaFin: toIso(f.fechaFin),
        personas: Number(f.personas) || 0,
        montoTotal: limpiarMonto(f.montoTotal),
        anticipo: limpiarMonto(f.anticipo),
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-2xl">
      <ModalHeader title={inicial ? "Editar reserva" : "Nueva reserva"} onClose={onClose} />
      <div className="p-4 grid grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Cliente registrado</span>
          <select className={campo} value={f.clienteId || ""} onChange={(e) => set("clienteId", e.target.value)}>
            <option value="">Consumidor final / escribir nombre</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Nombre cliente</span>
          <input className={campo} value={f.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nombre si no esta registrado" />
        </label>

        <label>
          <span className={etiqueta}>Tipo</span>
          <select className={campo} value={f.tipo} onChange={(e) => cambiarTipo(e.target.value)}>
            <option value="apartamento">Apartamento / cabana</option>
            <option value="evento">Kiosko / salon / evento</option>
          </select>
        </label>
        <label>
          <span className={etiqueta}>Recurso</span>
          <select className={campo} value={f.recursoId} onChange={(e) => cambiarRecurso(e.target.value)}>
            <option value="">Seleccionar</option>
            {recursosTipo.map((r) => <option key={r.id} value={r.id}>{r.nombre} {r.capacidad ? `(${r.capacidad} pers.)` : ""}</option>)}
          </select>
        </label>

        <label>
          <span className={etiqueta}>Fecha entrada / inicio</span>
          <input type="datetime-local" className={campo} value={f.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} />
        </label>
        <label>
          <span className={etiqueta}>Fecha salida / fin</span>
          <input type="datetime-local" className={campo} value={f.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} />
        </label>

        <label>
          <span className={etiqueta}>Personas</span>
          <input type="number" min="0" className={campo} value={f.personas} onChange={(e) => set("personas", e.target.value)} />
        </label>
        <label>
          <span className={etiqueta}>Estado de la reserva</span>
          <select className={campo} value={f.estado} onChange={(e) => set("estado", e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
          <span className="block text-[11px] text-sol-gris mt-1">{ESTADO_AYUDA[f.estado]}</span>
        </label>

        <label>
          <span className={etiqueta}>Valor total</span>
          <input inputMode="numeric" className={campo} value={f.montoTotal} onChange={(e) => set("montoTotal", formatoMontoInput(e.target.value))} />
        </label>
        <label>
          <span className={etiqueta}>Anticipo</span>
          <input inputMode="numeric" className={campo} value={f.anticipo} onChange={(e) => set("anticipo", formatoMontoInput(e.target.value))} disabled={!!inicial} />
        </label>

        {!inicial && limpiarMonto(f.anticipo) > 0 && (
          <label className="col-span-2">
            <span className={etiqueta}>Metodo anticipo</span>
            <select className={campo} value={f.metodoAnticipo} onChange={(e) => set("metodoAnticipo", e.target.value)}>
              {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}

        <label className="col-span-2">
          <span className={etiqueta}>Comentario de la reserva</span>
          <textarea className={campo} rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Ej: cumpleanos familiar, decoracion solicitada, horario de llegada, montaje, condiciones especiales." />
        </label>
      </div>
      <div className="flex gap-2 p-4 border-t border-sol-borde sticky bottom-0 bg-white">
        <Boton variante="suave" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando || !f.recursoId || !f.fechaInicio || !f.fechaFin}>{guardando ? "Guardando..." : "Guardar reserva"}</Boton>
      </div>
    </Modal>
  );
}
