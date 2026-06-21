import { useEffect, useMemo, useRef, useState } from "react";
import { X, AlertTriangle, ChevronDown } from "lucide-react";
import logo from "../assets/logo.png";
import { EMPRESA } from "../lib/format";

// Estilos compartidos para campos de formulario (ProductoForm, IngredienteForm...).
export const campoCN = "w-full rounded-lg px-3 py-2 text-sm border border-sol-borde bg-sol-crema focus:outline-none focus:border-sol-azul";
export const etiquetaCN = "text-xs font-bold text-sol-gris block";

export function Brandmark({ compact = false, negocio }) {
  const cfg = negocio || EMPRESA;
  const nombre = cfg.nombre || EMPRESA.nombre;
  const partes = nombre.split(" ");
  const principal = partes.slice(0, 2).join(" ") || "Sol Naciente";
  const subtitulo = partes.slice(2).join(" ") || "Centro Recreacional";
  return (
    <div className="flex items-center gap-2.5">
      <img src={cfg.logoUrl || logo} alt={nombre} className={compact ? "h-9 w-9 object-contain" : "h-11 w-11 object-contain"} />
      {!compact && (
        <div className="leading-none">
          <div className="font-extrabold text-[17px] tracking-tight">
            <span className="text-sol-azul">{principal}</span>
          </div>
          <div className="text-sol-azul font-bold text-[10px] uppercase">{subtitulo}</div>
        </div>
      )}
    </div>
  );
}

export function Modal({ children, onClose, max = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141E32]/45 no-print" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-full ${max} max-h-[92vh] overflow-auto border border-sol-borde animar`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-sol-borde sticky top-0 bg-white z-10">
      <h3 className="font-extrabold text-sol-tinta">{title}</h3>
      <button onClick={onClose} className="p-1 rounded-lg hover:bg-sol-suave"><X size={20} className="text-sol-gris" /></button>
    </div>
  );
}

export function ConfirmDialog({ titulo, mensaje, confirmar = "Eliminar", onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} max="max-w-sm">
      <div className="p-6 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-sol-rojo/10 flex items-center justify-center">
          <AlertTriangle className="text-sol-rojo" size={24} />
        </div>
        <h3 className="font-extrabold text-sol-tinta text-lg">{titulo}</h3>
        <p className="text-sol-gris text-sm mt-1">{mensaje}</p>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold border border-sol-borde text-sol-gris hover:bg-sol-suave">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-sol-rojo hover:bg-sol-rojoOsc">{confirmar}</button>
        </div>
      </div>
    </Modal>
  );
}

export function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="rounded-2xl bg-white p-4 flex items-start gap-3 border border-sol-borde">
      <div className="rounded-xl p-2.5" style={{ background: color + "1A" }}><Icon size={20} style={{ color }} /></div>
      <div>
        <div className="text-sol-gris text-xs font-bold">{label}</div>
        <div className="text-sol-tinta text-[21px] font-extrabold leading-tight">{value}</div>
        {sub && <div className="text-sol-grisClaro text-[11px]">{sub}</div>}
      </div>
    </div>
  );
}

export function Boton({ children, variante = "primario", className = "", ...props }) {
  const base = "rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed";
  const estilos = {
    primario: "bg-sol-azul text-white hover:bg-sol-azulOsc",
    rojo: "bg-sol-rojo text-white hover:bg-sol-rojoOsc",
    contorno: "border border-sol-azul text-sol-azul hover:bg-sol-azul/5",
    suave: "border border-sol-borde text-sol-gris hover:bg-sol-suave",
  };
  return <button className={`${base} ${estilos[variante]} ${className}`} {...props}>{children}</button>;
}

export function SelectPro({ value, onChange, options = [], className = "", placeholder = "Seleccionar", ariaLabel }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)), [options, value]);

  useEffect(() => {
    const cerrar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  return (
    <div ref={ref} className={`relative min-w-[190px] ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel || placeholder}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`w-full h-10 rounded-xl border px-3 text-sm font-bold bg-white flex items-center justify-between gap-3 transition shadow-sm ${
          abierto ? "border-sol-azul ring-2 ring-sol-azul/10" : "border-sol-borde hover:border-sol-azul"
        }`}>
        <span className={`truncate ${selected ? "text-sol-tinta" : "text-sol-gris"}`}>{selected?.label || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-sol-azul transition ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-sol-borde bg-white shadow-xl overflow-hidden p-1 max-h-72 overflow-y-auto">
          {options.map((o) => {
            const activo = String(o.value) === String(value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setAbierto(false);
                }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activo ? "bg-sol-azul text-white" : "text-sol-tinta hover:bg-sol-suave"
                }`}>
                <span className="block truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
