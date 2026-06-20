import { Plus, Utensils, GlassWater, Waves, BedDouble, PartyPopper } from "lucide-react";
import { fmt, catColor } from "../lib/format";

const ICONO = { comidas: Utensils, bebidas: GlassWater, piscina: Waves, alojamiento: BedDouble, eventos: PartyPopper };

export default function ProductCard({ p, disponible, onAdd }) {
  const Icon = ICONO[p.cat] || Utensils;
  const color = catColor(p.cat);
  const ilimitado = disponible === Infinity;
  const agotado = !ilimitado && disponible <= 0;

  return (
    <div className={`rounded-2xl overflow-hidden flex flex-col bg-white border border-sol-borde transition hover:-translate-y-0.5 hover:shadow-md ${agotado ? "opacity-60" : ""}`}>
      <div className="h-28 w-full border-b border-sol-borde relative">
        {p.imagen ? (
          <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#FBF3E4,#fff)" }}>
            <Icon size={40} style={{ color, opacity: 0.85 }} />
          </div>
        )}
        {!ilimitado && (
          <span className={`absolute top-2 left-2 text-[10px] font-extrabold rounded-full px-2 py-0.5 ${agotado ? "bg-sol-rojo text-white" : "bg-white/90 text-sol-tinta border border-sol-borde"}`}>
            {agotado ? "Agotado" : `${disponible} disp.`}
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="text-sol-rojo font-extrabold text-[15px]">{fmt(p.precio)}</div>
        <div className="text-sol-tinta font-bold text-[13.5px] leading-tight">{p.nombre}</div>
        <p className="text-sol-gris text-[11.5px] leading-snug flex-1 line-clamp-2">{p.desc}</p>
        <button
          onClick={() => onAdd(p)}
          disabled={agotado}
          className="mt-1 w-full rounded-lg py-2 text-xs font-bold text-white flex items-center justify-center gap-1.5 bg-sol-azul hover:bg-sol-azulOsc transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}
