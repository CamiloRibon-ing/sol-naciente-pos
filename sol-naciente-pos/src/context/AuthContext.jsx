import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, supabaseHabilitado } from "../lib/supabaseClient";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const ROLES_VALIDOS = ["admin", "supervisor", "cajero"];

const USUARIO_DEMO = { id: "demo", nombre: "Administrador (demo)", correo: "demo@solnaciente.co", rol: "admin" };

// Maneja la sesión de Supabase Auth y el perfil/rol del usuario (tabla `usuarios`).
// En modo demo (sin Supabase configurado) la app arranca con un usuario admin de prueba.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarPerfil = useCallback(async (authUser) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id_usuario, nombre, correo, activo, id_punto, roles(nombre_rol), puntos_venta(nombre)")
      .eq("id_usuario", authUser.id)
      .maybeSingle();
    if (error || !data || !data.activo) {
      await supabase.auth.signOut();
      setUsuario(null);
      return;
    }
    const rolNombre = (data.roles?.nombre_rol || "").toLowerCase();
    setUsuario({
      id: data.id_usuario,
      nombre: data.nombre,
      correo: data.correo,
      rol: ROLES_VALIDOS.includes(rolNombre) ? rolNombre : "cajero",
      puntoVentaId: data.id_punto || null,
      puntoVentaNombre: data.puntos_venta?.nombre || "",
    });
  }, []);

  useEffect(() => {
    if (!supabaseHabilitado) {
      setUsuario(USUARIO_DEMO);
      setCargando(false);
      return;
    }

    let activo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await cargarPerfil(data.session.user);
      if (activo) setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) await cargarPerfil(session.user);
      else setUsuario(null);
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const login = async (correo, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
  };

  return (
    <AuthCtx.Provider value={{ usuario, cargando, login, logout, modoDemo: !supabaseHabilitado }}>
      {children}
    </AuthCtx.Provider>
  );
}
