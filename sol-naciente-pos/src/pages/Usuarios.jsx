import { useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Search, ToggleLeft, ToggleRight, UserCog } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import * as db from "../lib/db";
import { Boton } from "../components/ui";
import UsuarioForm from "../components/UsuarioForm";

const ROL_LABEL = { admin: "Administrador", supervisor: "Supervisor", cajero: "Vendedor / cajero" };

const permisosPorRol = {
  admin: "Acceso total: configuracion, inventario, compras, nomina, reportes, ventas, caja y usuarios.",
  supervisor: "Supervisa ventas, caja, reservas, clientes y reportes. Sin configuracion critica.",
  cajero: "Vende en POS, gestiona caja y clientes del local asignado. Sin datos contables sensibles.",
};

export default function Usuarios() {
  const { puntosVenta } = useStore();
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [rolFiltro, setRolFiltro] = useState("todos");
  const [editar, setEditar] = useState(undefined);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const [u, r] = await Promise.all([db.listUsuarios(), db.listRoles()]);
      setUsuarios(u);
      setRoles(r);
    } catch (e) {
      toast.error(e.message || "No se pudieron cargar los usuarios");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      const rolNombre = (u.rol || "").toLowerCase();
      if (rolFiltro !== "todos" && rolNombre !== rolFiltro) return false;
      if (!q) return true;
      return [u.nombre, u.correo, u.documento, u.telefono, u.puntoVentaNombre, rolNombre].some((x) => (x || "").toLowerCase().includes(q));
    });
  }, [usuarios, busqueda, rolFiltro]);

  const resumen = useMemo(() => ({
    total: usuarios.length,
    activos: usuarios.filter((u) => u.activo !== false).length,
    vendedores: usuarios.filter((u) => (u.rol || "").toLowerCase() === "cajero").length,
  }), [usuarios]);

  const guardar = async (payload) => {
    try {
      if (payload.id) await db.saveUsuarioPerfil(payload, usuarioActual?.id);
      else await db.crearUsuarioApp(payload);
      toast.success(payload.id ? "Usuario actualizado" : "Usuario creado con acceso");
      setEditar(undefined);
      await cargar();
    } catch (e) {
      toast.error(e.message || "No se pudo guardar el usuario");
    }
  };

  const cambiarPassword = async (id, password) => {
    try {
      await db.actualizarPasswordUsuario(id, password);
      toast.success("Contraseña actualizada");
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar la contraseña");
    }
  };

  const alternar = async (u) => {
    try {
      await db.saveUsuarioPerfil({ ...u, activo: u.activo === false }, usuarioActual?.id);
      toast.success(u.activo === false ? "Usuario activado" : "Usuario desactivado");
      await cargar();
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar el estado");
    }
  };

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Usuarios y accesos</h1>
          <p className="text-sol-gris text-[13px]">Administra vendedores, supervisores, locales asignados y niveles de permiso.</p>
        </div>
        <Boton onClick={() => setEditar(null)}><Plus size={16} /> Nuevo usuario</Boton>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Usuarios registrados</div>
          <div className="text-2xl font-extrabold text-sol-azul">{resumen.total}</div>
        </div>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Accesos activos</div>
          <div className="text-2xl font-extrabold text-sol-exito">{resumen.activos}</div>
        </div>
        <div className="rounded-2xl bg-white border border-sol-borde p-4">
          <div className="text-xs text-sol-gris font-bold">Vendedores</div>
          <div className="text-2xl font-extrabold text-sol-rojo">{resumen.vendedores}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-extrabold">Niveles de acceso</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar usuario"
                className="rounded-lg pl-8 pr-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
            </div>
            <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
              <option value="todos">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="cajero">Vendedor / cajero</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {Object.entries(permisosPorRol).map(([rol, texto]) => (
            <div key={rol} className="rounded-xl border border-sol-borde p-3 bg-sol-crema/50">
              <div className="flex items-center gap-2 font-extrabold"><UserCog size={16} className="text-sol-azul" /> {ROL_LABEL[rol]}</div>
              <p className="text-xs text-sol-gris mt-1">{texto}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde p-4">
        <h2 className="font-extrabold mb-3">Personas con acceso al sistema</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr className="bg-sol-suave text-sol-gris">
              {["Usuario", "Contacto", "Rol", "Local", "Estado", ""].map((h, i) =>
                <th key={i} className="px-3 py-2.5 font-bold text-left">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtrados.map((u) => {
                const rol = (u.rol || "").toLowerCase();
                return (
                  <tr key={u.id} className="border-t border-sol-suave">
                    <td className="px-3 py-2.5">
                      <div className="font-bold">{u.nombre}</div>
                      <div className="text-[11px] text-sol-grisClaro">{u.documento || "Sin documento"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-sol-gris">
                      <div>{u.correo}</div>
                      <div className="text-[11px]">{u.telefono || "Sin telefono"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-sol-suave text-sol-azulOsc">{ROL_LABEL[rol] || u.rol || "Sin rol"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-sol-gris">{u.puntoVentaNombre || "Todos / sin local fijo"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.activo === false ? "bg-sol-rojo/10 text-sol-rojo" : "bg-sol-exito/10 text-sol-exito"}`}>
                        {u.activo === false ? "Bloqueado" : "Activo"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => alternar(u)} className="p-1.5" title={u.activo === false ? "Activar acceso" : "Bloquear acceso"}>
                        {u.activo === false ? <ToggleLeft size={16} className="text-sol-gris" /> : <ToggleRight size={16} className="text-sol-exito" />}
                      </button>
                      <button onClick={() => setEditar(u)} className="p-1.5" title="Editar usuario"><Pencil size={15} className="text-sol-azul" /></button>
                      <button onClick={() => setEditar(u)} className="p-1.5" title="Cambiar contraseña"><KeyRound size={15} className="text-sol-azulOsc" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtrados.length && <p className="text-sol-gris text-sm p-6 text-center">{cargando ? "Cargando usuarios..." : "No hay usuarios que coincidan con los filtros."}</p>}
        </div>
      </div>

      {editar !== undefined && (
        <UsuarioForm
          inicial={editar}
          roles={roles}
          puntosVenta={puntosVenta}
          onSave={guardar}
          onPassword={cambiarPassword}
          onClose={() => setEditar(undefined)}
        />
      )}
    </section>
  );
}
