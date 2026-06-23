import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Building2, Eye, EyeOff, GripVertical, Image as ImageIcon, Percent, RotateCcw, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { EMPRESA, IMPUESTO } from "../lib/format";
import { Brandmark, Boton, campoCN as campo, etiquetaCN as etiqueta } from "../components/ui";
import ImageUpload from "../components/ImageUpload";

const MENU_SECCIONES = [
  { id: "pos", label: "Punto de venta", fijo: false },
  { id: "caja", label: "Caja", fijo: false },
  { id: "ventas", label: "Ventas", fijo: false },
  { id: "rep-vendedor", label: "Vendedores", fijo: false },
  { id: "informes", label: "Informes", fijo: false },
  { id: "reservas", label: "Reservas", fijo: false },
  { id: "clientes", label: "Clientes", fijo: false },
  { id: "locales", label: "Locales", fijo: false },
  { id: "usuarios", label: "Usuarios", fijo: false },
  { id: "auditoria", label: "Auditoria", fijo: false },
  { id: "config", label: "Configuracion", fijo: true },
  { id: "inv", label: "Inventario", fijo: false },
  { id: "compras", label: "Compras", fijo: false },
  { id: "nomina", label: "Nomina", fijo: false },
  { id: "dash", label: "Dashboard", fijo: false },
];

const configBase = () => ({
  nombre: EMPRESA.nombre,
  nit: EMPRESA.nit,
  direccion: EMPRESA.direccion,
  telefono: EMPRESA.telefono,
  correo: EMPRESA.correo,
  resolucionDian: EMPRESA.resolucionDian,
  logoUrl: EMPRESA.logoUrl || "",
  prefijoFactura: EMPRESA.prefijoFactura || "FAC",
  impuestoPct: Math.round((Number(IMPUESTO) || 0) * 10000) / 100,
  menuOrden: MENU_SECCIONES.map((s) => s.id),
  menuOculto: [],
});

export default function Configuracion() {
  const { configuracionNegocio, guardarConfiguracionNegocio } = useStore();
  const [f, setF] = useState(configBase);
  const [guardando, setGuardando] = useState(false);
  const [arrastrandoId, setArrastrandoId] = useState(null);
  const [sobreId, setSobreId] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!configuracionNegocio) return;
    setF({
      nombre: configuracionNegocio.nombre || "",
      nit: configuracionNegocio.nit || "",
      direccion: configuracionNegocio.direccion || "",
      telefono: configuracionNegocio.telefono || "",
      correo: configuracionNegocio.correo || "",
      resolucionDian: configuracionNegocio.resolucionDian || "",
      logoUrl: configuracionNegocio.logoUrl || "",
      prefijoFactura: configuracionNegocio.prefijoFactura || "FAC",
      impuestoPct: Math.round((Number(configuracionNegocio.impuestoRate) || 0) * 10000) / 100,
      menuOrden: ordenarMenu(configuracionNegocio.menuOrden),
      menuOculto: configuracionNegocio.menuOculto || [],
    });
  }, [configuracionNegocio]);

  function ordenarMenu(orden = []) {
    const base = MENU_SECCIONES.map((s) => s.id);
    return [...orden.filter((id) => base.includes(id)), ...base.filter((id) => !orden.includes(id))];
  }

  const moverMenu = (id, delta) => {
    setF((s) => {
      const orden = ordenarMenu(s.menuOrden);
      const i = orden.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= orden.length) return s;
      const nuevo = [...orden];
      [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
      return { ...s, menuOrden: nuevo };
    });
    toast("Orden actualizado. Guarda los cambios para aplicarlo.", { icon: "i" });
  };

  const soltarMenu = (destinoId) => {
    if (!arrastrandoId || arrastrandoId === destinoId) {
      setArrastrandoId(null);
      setSobreId(null);
      return;
    }
    setF((s) => {
      const orden = ordenarMenu(s.menuOrden);
      const origen = orden.indexOf(arrastrandoId);
      const destino = orden.indexOf(destinoId);
      if (origen < 0 || destino < 0) return s;
      const nuevo = [...orden];
      const [item] = nuevo.splice(origen, 1);
      nuevo.splice(destino, 0, item);
      return { ...s, menuOrden: nuevo };
    });
    setArrastrandoId(null);
    setSobreId(null);
    toast("Seccion reubicada. Guarda los cambios para aplicarlo.", { icon: "i" });
  };

  const restaurarMenu = () => {
    setF((s) => ({ ...s, menuOrden: MENU_SECCIONES.map((sec) => sec.id), menuOculto: [] }));
    toast("Menu restaurado. Guarda los cambios para aplicarlo.", { icon: "i" });
  };

  const alternarMenu = (id) => {
    const seccion = MENU_SECCIONES.find((s) => s.id === id);
    if (seccion?.fijo) {
      toast.error("Configuracion siempre debe estar visible para no perder acceso.");
      return;
    }
    setF((s) => {
      const ocultos = new Set(s.menuOculto || []);
      const estabaOculto = ocultos.has(id);
      if (estabaOculto) ocultos.delete(id);
      else ocultos.add(id);
      toast(estabaOculto ? `${seccion.label} visible. Guarda los cambios.` : `${seccion.label} oculto. Guarda los cambios.`, { icon: "i" });
      return { ...s, menuOculto: [...ocultos] };
    });
  };

  const guardar = async () => {
    if (!f.nombre.trim()) {
      toast.error("El nombre del negocio es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      await guardarConfiguracionNegocio({
        nombre: f.nombre.trim(),
        nit: f.nit.trim(),
        direccion: f.direccion.trim(),
        telefono: f.telefono.trim(),
        correo: f.correo.trim(),
        resolucionDian: f.resolucionDian.trim(),
        logoUrl: f.logoUrl.trim(),
        prefijoFactura: f.prefijoFactura.trim() || "FAC",
        impuestoRate: (Number(f.impuestoPct) || 0) / 100,
        menuOrden: ordenarMenu(f.menuOrden),
        menuOculto: f.menuOculto || [],
      });
      toast.success("Configuracion guardada");
    } catch (e) {
      toast.error(e.message || "No se pudo guardar la configuracion");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Configuracion del negocio</h1>
          <p className="text-sol-gris text-[13px]">Datos fiscales, resolucion DIAN, logo, prefijo e impuestos usados en ventas y documentos.</p>
        </div>
        <Boton onClick={guardar} disabled={guardando}><Save size={16} /> {guardando ? "Guardando..." : "Guardar cambios"}</Boton>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <h2 className="font-extrabold mb-3 flex items-center gap-2"><Building2 size={18} className="text-sol-azul" /> Datos fiscales</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className={etiqueta}>Nombre / razon social</span>
              <input className={campo} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </label>
            <label>
              <span className={etiqueta}>NIT</span>
              <input className={campo} value={f.nit} onChange={(e) => set("nit", e.target.value)} />
            </label>
            <label>
              <span className={etiqueta}>Correo</span>
              <input type="email" className={campo} value={f.correo} onChange={(e) => set("correo", e.target.value)} />
            </label>
            <label>
              <span className={etiqueta}>Telefono</span>
              <input className={campo} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
            </label>
            <label>
              <span className={etiqueta}>Prefijo factura</span>
              <input className={campo} value={f.prefijoFactura} onChange={(e) => set("prefijoFactura", e.target.value)} />
            </label>
            <label className="col-span-2">
              <span className={etiqueta}>Direccion</span>
              <input className={campo} value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
            </label>
            <label className="col-span-2">
              <span className={etiqueta}>Resolucion / autorizacion DIAN</span>
              <textarea className={campo} rows={3} value={f.resolucionDian} onChange={(e) => set("resolucionDian", e.target.value)} />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-sol-borde p-4">
            <h2 className="font-extrabold mb-3 flex items-center gap-2"><Percent size={18} className="text-sol-azul" /> Impuestos</h2>
            <label>
              <span className={etiqueta}>Impoconsumo / impuesto aplicado (%)</span>
              <input type="number" min="0" step="0.01" className={campo} value={f.impuestoPct} onChange={(e) => set("impuestoPct", e.target.value)} />
            </label>
            <p className="text-xs text-sol-gris mt-2">Este porcentaje se usa para nuevas ventas y para calcular el PDF de factura.</p>
          </div>

          <div className="rounded-2xl bg-white border border-sol-borde p-4">
            <h2 className="font-extrabold mb-3 flex items-center gap-2"><ImageIcon size={18} className="text-sol-azul" /> Logo</h2>
            <ImageUpload value={f.logoUrl} onChange={(url) => set("logoUrl", url)} label="Subir logo del negocio" fit="contain" height="h-40" />
            <label>
              <span className={etiqueta}>URL publica del logo</span>
              <input className={campo} value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." />
            </label>
            <div className="mt-3 rounded-xl border border-sol-borde bg-sol-crema p-4">
              <span className={etiqueta}>Vista en encabezado</span>
              <div className="mt-2 rounded-xl bg-white border border-sol-borde p-3">
                <Brandmark negocio={{ ...f, nombre: f.nombre, logoUrl: f.logoUrl }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white border border-sol-borde p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h2 className="font-extrabold">Orden y visibilidad de secciones</h2>
            <p className="text-xs text-sol-gris mt-0.5">Arrastra cada seccion para reubicarla en el menu lateral. Los cambios se aplican al guardar.</p>
          </div>
          <button type="button" onClick={restaurarMenu} className="inline-flex items-center gap-1.5 rounded-xl border border-sol-borde px-3 py-2 text-xs font-bold text-sol-azul hover:border-sol-azul hover:bg-sol-azul/5">
            <RotateCcw size={14} /> Restaurar
          </button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {ordenarMenu(f.menuOrden).map((id, idx) => {
            const seccion = MENU_SECCIONES.find((s) => s.id === id);
            if (!seccion) return null;
            const oculto = (f.menuOculto || []).includes(id);
            const activoDrop = sobreId === id && arrastrandoId !== id;
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => { setArrastrandoId(id); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); setSobreId(id); }}
                onDragLeave={() => setSobreId(null)}
                onDrop={(e) => { e.preventDefault(); soltarMenu(id); }}
                onDragEnd={() => { setArrastrandoId(null); setSobreId(null); }}
                className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition shadow-sm ${oculto ? "bg-sol-suave/70 opacity-75" : "bg-white"} ${activoDrop ? "border-sol-azul ring-4 ring-sol-azul/10" : "border-sol-borde"} ${arrastrandoId === id ? "opacity-50 scale-[0.99]" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sol-crema border border-sol-borde text-sol-azul cursor-grab active:cursor-grabbing">
                    <GripVertical size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm truncate">{idx + 1}. {seccion.label}</div>
                    <div className="text-[11px] text-sol-gris">{seccion.fijo ? "Siempre visible para no perder acceso" : oculto ? "Oculta del menu" : "Visible en el menu"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moverMenu(id, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-sol-crema disabled:opacity-30" title="Subir"><ArrowUp size={15} className="text-sol-azul" /></button>
                  <button type="button" onClick={() => moverMenu(id, 1)} disabled={idx === ordenarMenu(f.menuOrden).length - 1} className="p-1.5 rounded-lg hover:bg-sol-crema disabled:opacity-30" title="Bajar"><ArrowDown size={15} className="text-sol-azul" /></button>
                  <button type="button" onClick={() => alternarMenu(id)} disabled={seccion.fijo} className="p-1.5 rounded-lg hover:bg-sol-crema disabled:opacity-40" title={oculto ? "Mostrar" : "Ocultar"}>
                    {oculto ? <EyeOff size={15} className="text-sol-rojo" /> : <Eye size={15} className="text-sol-exito" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
