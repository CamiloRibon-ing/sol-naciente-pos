import { useState } from "react";
import { ShoppingCart, Package, LayoutDashboard, Loader2, Info, LogOut, Wallet, Truck, Users, Receipt, UserSquare2, MapPin, Store, CalendarDays, UserCog, Settings, BarChart3, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { useStore } from "./context/StoreContext";
import { useAuth } from "./context/AuthContext";
import { Brandmark } from "./components/ui";
import ErrorBoundary from "./components/ErrorBoundary";
import PuntoVenta from "./pages/PuntoVenta";
import Inventario from "./pages/Inventario";
import Caja from "./pages/Caja";
import Compras from "./pages/Compras";
import Ventas from "./pages/Ventas";
import Clientes from "./pages/Clientes";
import Nomina from "./pages/Nomina";
import Dashboard from "./pages/Dashboard";
import Locales from "./pages/Locales";
import Reservas from "./pages/Reservas";
import Usuarios from "./pages/Usuarios";
import ReportesVendedor from "./pages/ReportesVendedor";
import InformesFinancieros from "./pages/InformesFinancieros";
import Configuracion from "./pages/Configuracion";
import Auditoria from "./pages/Auditoria";

const NAV = [
  { id: "pos", label: "Punto de venta", icon: ShoppingCart, comp: PuntoVenta, roles: ["admin", "supervisor", "cajero"] },
  { id: "caja", label: "Caja", icon: Wallet, comp: Caja, roles: ["admin", "supervisor", "cajero"] },
  { id: "ventas", label: "Ventas", icon: Receipt, comp: Ventas, roles: ["admin", "supervisor"] },
  { id: "rep-vendedor", label: "Vendedores", icon: BarChart3, comp: ReportesVendedor, roles: ["admin", "supervisor"] },
  { id: "informes", label: "Informes", icon: FileSpreadsheet, comp: InformesFinancieros, roles: ["admin", "supervisor"] },
  { id: "reservas", label: "Reservas", icon: CalendarDays, comp: Reservas, roles: ["admin", "supervisor"] },
  { id: "clientes", label: "Clientes", icon: UserSquare2, comp: Clientes, roles: ["admin", "supervisor", "cajero"] },
  { id: "locales", label: "Locales", icon: Store, comp: Locales, roles: ["admin"] },
  { id: "usuarios", label: "Usuarios", icon: UserCog, comp: Usuarios, roles: ["admin"] },
  { id: "auditoria", label: "Auditoria", icon: ShieldCheck, comp: Auditoria, roles: ["admin"] },
  { id: "config", label: "Configuracion", icon: Settings, comp: Configuracion, roles: ["admin"] },
  { id: "inv", label: "Inventario", icon: Package, comp: Inventario, roles: ["admin"] },
  { id: "compras", label: "Compras", icon: Truck, comp: Compras, roles: ["admin"] },
  { id: "nomina", label: "Nómina", icon: Users, comp: Nomina, roles: ["admin"] },
  { id: "dash", label: "Dashboard", icon: LayoutDashboard, comp: Dashboard, roles: ["admin", "supervisor"] },
];

const ROL_LABEL = { admin: "Administrador", supervisor: "Supervisor", cajero: "Cajero" };

export { NAV };

export default function App() {
  const { cargando, error, modoDemo, cajaActual, ingredientes, puntosVenta, puntoVentaId, puntoVentaActual, setPuntoVentaId, configuracionNegocio } = useStore();
  const { usuario, logout } = useAuth();
  const menuOrden = configuracionNegocio?.menuOrden || [];
  const menuOculto = new Set(configuracionNegocio?.menuOculto || []);
  const navVisible = NAV
    .filter((n) => n.roles.includes(usuario?.rol))
    .filter((n) => n.id === "config" || !menuOculto.has(n.id))
    .sort((a, b) => {
      const ia = menuOrden.indexOf(a.id);
      const ib = menuOrden.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  const [vista, setVista] = useState(navVisible[0]?.id || "pos");
  const Pagina = navVisible.find((n) => n.id === vista)?.comp || navVisible[0]?.comp || PuntoVenta;

  const cajaAbierta = cajaActual?.estado === "abierta";
  const puedeVerCaja = navVisible.some((n) => n.id === "caja");
  const criticos = ingredientes.filter((i) => i.stock <= i.stockMin).length;
  const puntosOperativos = puntosVenta.filter((p) => p.activo !== false);

  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sol-crema">
        <Loader2 className="animate-spin text-sol-azul mb-3" size={34} />
        <p className="text-sol-gris font-bold">Cargando Sol Naciente…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-sol-crema text-sol-tinta">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 p-4 flex-col gap-1 hidden md:flex bg-white border-r border-sol-borde no-print">
        <div className="px-1 pb-4 mb-2 border-b border-sol-borde"><Brandmark negocio={configuracionNegocio} /></div>
        {navVisible.map((n) => {
          const Icon = n.icon, act = vista === n.id;
          return (
            <button key={n.id} onClick={() => setVista(n.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${act ? "bg-sol-azul text-white" : "text-sol-tinta hover:bg-sol-suave"}`}>
              <span className="relative">
                <Icon size={18} />
                {n.id === "inv" && criticos > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-sol-rojo text-white text-[10px] font-extrabold flex items-center justify-center">
                    {criticos}
                  </span>
                )}
              </span>
              {n.label}
            </button>
          );
        })}
        <div className="mt-auto rounded-xl p-3 text-xs bg-sol-suave text-sol-azulOsc">
          <div className="font-extrabold mb-0.5 truncate">{usuario?.nombre}</div>
          <div className="flex items-center justify-between gap-2">
            <span>{ROL_LABEL[usuario?.rol] || usuario?.rol}</span>
            <button onClick={logout} title="Cerrar sesión" className="flex items-center gap-1 font-bold text-sol-rojo hover:underline">
              <LogOut size={13} /> Salir
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar móvil */}
        <div className="md:hidden flex items-center justify-between p-3 bg-white border-b border-sol-borde no-print">
          <Brandmark compact negocio={configuracionNegocio} />
          <div className="flex gap-1">
            {navVisible.map((n) => {
              const Icon = n.icon, act = vista === n.id;
              return (
                <button key={n.id} onClick={() => setVista(n.id)}
                  className={`relative p-2 rounded-lg ${act ? "bg-sol-azul text-white" : "bg-sol-suave text-sol-azul"}`}>
                  <Icon size={18} />
                  {n.id === "inv" && criticos > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-sol-rojo text-white text-[10px] font-extrabold flex items-center justify-center">
                      {criticos}
                    </span>
                  )}
                </button>
              );
            })}
            <button onClick={logout} title="Cerrar sesión" className="p-2 rounded-lg bg-sol-suave text-sol-rojo">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Barra de estado: caja y acceso rápido */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white border-b border-sol-borde no-print flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-sol-suave text-sol-azulOsc">
              <MapPin size={13} />
              <select value={puntoVentaId} onChange={(e) => setPuntoVentaId(e.target.value)} disabled={usuario?.rol === "cajero" && !!usuario?.puntoVentaId}
                className="bg-transparent font-bold focus:outline-none">
                {puntosOperativos.map((p) => <option key={p.id} value={p.id}>{p.idPuntoPadre ? `- ${p.nombre}` : p.nombre}</option>)}
              </select>
            </label>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cajaAbierta ? "bg-sol-exito/10 text-sol-exito" : "bg-sol-rojo/10 text-sol-rojo"}`}>
              <Wallet size={13} /> Caja {cajaAbierta ? "abierta" : "cerrada"}{puntoVentaActual?.nombre ? ` · ${puntoVentaActual.nombre}` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-sol-crema border border-sol-borde text-sol-tinta">
              <UserCog size={13} className="text-sol-azul" /> {usuario?.nombre || "Usuario"} - {ROL_LABEL[usuario?.rol] || usuario?.rol}
            </span>
          </div>
          {puedeVerCaja && vista !== "caja" && (
            <button onClick={() => setVista("caja")}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-sol-suave text-sol-azulOsc hover:bg-sol-azul hover:text-white transition">
              <Wallet size={13} /> Ir a caja
            </button>
          )}
        </div>

        {modoDemo && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-sol-amarillo/20 text-sol-azulOsc border-b border-sol-borde no-print">
            <Info size={14} /> Modo demo con datos de ejemplo. Configura Supabase y Cloudinary en <code className="font-bold">.env</code> para conectar tu negocio.
          </div>
        )}
        {error && (
          <div className="px-4 py-2 text-xs font-semibold bg-sol-rojo/10 text-sol-rojo border-b border-sol-borde no-print">
            {error}
          </div>
        )}

        <ErrorBoundary key={vista}>
          <Pagina />
        </ErrorBoundary>
      </main>
    </div>
  );
}
