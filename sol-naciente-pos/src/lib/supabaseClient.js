import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no hay credenciales, la app funciona en modo demo (datos en memoria).
export const supabaseHabilitado = Boolean(url && key);

export const supabase = supabaseHabilitado ? createClient(url, key) : null;
