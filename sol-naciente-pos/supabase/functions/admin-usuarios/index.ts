import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Faltan variables de entorno de Supabase" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !authData.user) return json({ error: "Sesion invalida" }, 401);

  const { data: perfil, error: perfilError } = await admin
    .from("usuarios")
    .select("id_usuario, activo, roles(nombre_rol)")
    .eq("id_usuario", authData.user.id)
    .maybeSingle();

  if (perfilError || !perfil?.activo || perfil.roles?.nombre_rol?.toLowerCase() !== "admin") {
    return json({ error: "Solo un administrador puede gestionar accesos" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "create") {
    const usuario = body.usuario || {};
    if (!usuario.correo || !usuario.password || !usuario.nombre || !usuario.rolId) {
      return json({ error: "Nombre, correo, rol y contraseña son obligatorios" }, 400);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: String(usuario.correo).toLowerCase(),
      password: String(usuario.password),
      email_confirm: true,
      user_metadata: { nombre: usuario.nombre },
    });
    if (createError) return json({ error: createError.message }, 400);

    const perfilPayload = {
      id_usuario: created.user.id,
      nombre: usuario.nombre,
      correo: String(usuario.correo).toLowerCase(),
      documento: usuario.documento || null,
      telefono: usuario.telefono || null,
      id_rol: usuario.rolId,
      id_punto: usuario.puntoVentaId || null,
      activo: usuario.activo !== false,
    };

    const { error: insertError } = await admin.from("usuarios").insert(perfilPayload);
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: insertError.message }, 400);
    }

    await admin.from("auditoria").insert({
      id_usuario: authData.user.id,
      accion: "CREAR_USUARIO",
      tabla_afectada: "usuarios",
      registro_id: created.user.id,
      detalle: {
        nombre: usuario.nombre,
        correo: String(usuario.correo).toLowerCase(),
        id_rol: usuario.rolId,
        id_punto: usuario.puntoVentaId || null,
      },
    });

    return json({ usuario: { id: created.user.id, ...perfilPayload } });
  }

  if (action === "password") {
    const usuarioId = body.usuarioId;
    const password = body.password;
    if (!usuarioId || !password || String(password).length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: String(password) });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Accion no soportada" }, 400);
});
