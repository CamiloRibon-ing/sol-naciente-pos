import { ChevronLeft, ChevronRight } from "lucide-react";

const ESTADO_COLOR = {
  pendiente: "#FBB814",
  confirmada: "#1A4FA0",
  en_curso: "#159A5A",
  finalizada: "#9AA1AD",
  cancelada: "#E22B23",
};

const inicioMes = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), 1);
const finMes = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
const mismoDia = (a, b) => a.toDateString() === b.toDateString();

export default function Calendario({ fecha, setFecha, reservas = [], onSelect, onDaySelect, selectedDate }) {
  const ini = inicioMes(fecha);
  const fin = finMes(fecha);
  const start = new Date(ini);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const dias = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const mover = (delta) => {
    const d = new Date(fecha);
    d.setMonth(d.getMonth() + delta);
    setFecha(d);
  };

  const reservasDia = (dia) => reservas.filter((r) => {
    const i = new Date(r.fechaInicio);
    const f = new Date(r.fechaFin);
    const d0 = new Date(dia);
    d0.setHours(0, 0, 0, 0);
    const d1 = new Date(dia);
    d1.setHours(23, 59, 59, 999);
    return i <= d1 && f >= d0 && r.estado !== "cancelada";
  });

  return (
    <div className="rounded-2xl bg-white border border-sol-borde overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-sol-borde">
        <button onClick={() => mover(-1)} className="p-2 rounded-lg hover:bg-sol-suave"><ChevronLeft size={17} /></button>
        <div className="font-extrabold capitalize">{fecha.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}</div>
        <button onClick={() => mover(1)} className="p-2 rounded-lg hover:bg-sol-suave"><ChevronRight size={17} /></button>
      </div>
      <div className="grid grid-cols-7 bg-sol-suave text-sol-gris text-[11px] font-bold">
        {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const fuera = d < ini || d > fin;
          const hoy = mismoDia(d, new Date());
          const seleccionado = selectedDate && mismoDia(d, selectedDate);
          const rs = reservasDia(d);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onDaySelect?.(d, rs)}
              className={`min-h-[96px] p-2 border-t border-r border-sol-suave cursor-pointer transition ${fuera ? "bg-sol-crema/60 text-sol-grisClaro" : "bg-white"} ${seleccionado ? "ring-2 ring-sol-azul ring-inset" : "hover:bg-sol-suave/45"}`}
            >
              <div className={`text-xs font-extrabold mb-1 ${hoy ? "text-sol-rojo" : ""}`}>{d.getDate()}</div>
              <div className="space-y-1">
                {rs.slice(0, 3).map((r) => (
                  <button key={r.id} onClick={(e) => { e.stopPropagation(); onSelect?.(r); }}
                    className="block w-full text-left rounded-md px-1.5 py-1 text-[11px] font-bold text-white truncate"
                    style={{ background: ESTADO_COLOR[r.estado] || "#1A4FA0" }}>
                    {r.recursoNombre}
                  </button>
                ))}
                {rs.length > 3 && <div className="text-[10px] text-sol-gris font-bold">+{rs.length - 3} mas</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ESTADO_COLOR };
