import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { Modal, ModalHeader, Boton, campoCN as campo, etiquetaCN as etiqueta } from "./ui";
import { formatoMontoInput, limpiarMonto } from "../lib/format";

const TIPOS = [
  { id: "ingreso", label: "Ingreso (no venta)", icon: ArrowUpCircle, color: "text-sol-exito" },
  { id: "egreso", label: "Gasto / Egreso", icon: ArrowDownCircle, color: "text-sol-rojo" },
  { id: "retiro", label: "Retiro de efectivo", icon: Wallet, color: "text-sol-azul" },
];

// Modal para registrar un movimiento de caja (ingreso, gasto/egreso o retiro de efectivo).
export default function MovimientoCajaForm({ tipoInicial = "ingreso", onSave, onClose }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const titulo = TIPOS.find((t) => t.id === tipo)?.label || "Movimiento";

  const enviar = async (e) => {
    e.preventDefault();
    const valor = limpiarMonto(monto);
    if (!descripcion.trim() || valor <= 0) return;
    setGuardando(true);
    try {
      await onSave(tipo, descripcion.trim(), valor);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} max="max-w-md">
      <ModalHeader title="Registrar movimiento de caja" onClose={onClose} />
      <form onSubmit={enviar} className="p-4 space-y-3">
        <div>
          <span className={etiqueta}>Tipo de movimiento</span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {TIPOS.map((t) => {
              const Icon = t.icon, act = tipo === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setTipo(t.id)}
                  className={`rounded-xl p-2.5 text-center border transition ${act ? "bg-sol-azul text-white border-sol-azul" : "bg-sol-crema border-sol-borde text-sol-tinta"}`}>
                  <Icon size={18} className={`mx-auto mb-1 ${act ? "text-white" : t.color}`} />
                  <div className="text-[11px] font-bold leading-tight">{t.label}</div>
                </button>
              );
            })}
          </div>
        </div>
        <label>
          <span className={etiqueta}>Descripción</span>
          <input required className={campo} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === "ingreso" ? "Ej. Abono de cliente, anticipo de reserva…" : tipo === "retiro" ? "Ej. Retiro para depósito bancario" : "Ej. Compra de hielo, transporte, mantenimiento…"} />
        </label>
        <label>
          <span className={etiqueta}>Monto</span>
          <input required inputMode="numeric" className={campo} value={monto} onChange={(e) => setMonto(formatoMontoInput(e.target.value))} placeholder="0" />
        </label>
        <p className="text-xs text-sol-gris">{titulo} se reflejará en el cuadre de caja del día.</p>
        <Boton type="submit" className="w-full" disabled={guardando}>
          {guardando ? "Guardando…" : "Registrar movimiento"}
        </Boton>
      </form>
    </Modal>
  );
}
