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

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("FACTURAS_FROM_EMAIL") ?? "";
  const fromName = Deno.env.get("FACTURAS_FROM_NAME") ?? "Sol Naciente";
  const replyTo = Deno.env.get("FACTURAS_REPLY_TO") ?? "";
  if (!resendKey || !fromEmail) {
    return json({ error: "Faltan RESEND_API_KEY y FACTURAS_FROM_EMAIL en los secretos de la Edge Function" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !jwt) return json({ error: "Sesion invalida" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !authData.user) return json({ error: "Sesion invalida" }, 401);

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || "").trim();
  const doc = body.doc || {};
  const pdfBase64 = String(body.pdfBase64 || "");
  const fileName = String(body.fileName || `factura-${doc.numero || "venta"}.pdf`);
  if (!to || !to.includes("@")) return json({ error: "Correo destino invalido" }, 400);
  if (!pdfBase64) return json({ error: "No se recibio el PDF adjunto" }, 400);

  const total = Number(body.total || 0);
  const contexto = String(doc.contexto || "").toLowerCase();
  const esNomina = contexto === "nomina" || String(doc.tipo || "").toUpperCase().includes("NOMINA");
  const documentoLabel = esNomina ? "Comprobante de nomina" : "Documento de venta";
  const saludoNombre = esNomina ? (doc.empleado || doc.cliente || "colaborador") : (doc.cliente || "cliente");
  const intro = esNomina
    ? `Adjuntamos tu comprobante de nomina <strong>${esc(doc.numero || doc.periodo || "")}</strong> por valor neto de <strong>${esc(money(total))}</strong>.`
    : `Adjuntamos tu ${esc((doc.tipo || "factura").toLowerCase())} <strong>${esc(doc.numero)}</strong> por valor de <strong>${esc(money(total))}</strong>.`;
  const asunto = `${doc.tipo || "Factura"} ${doc.numero || ""} - ${fromName}`.trim();
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f7f2e8;padding:24px;color:#222a3a">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #eadfce;border-radius:12px;overflow:hidden">
        <div style="background:#1A4FA0;color:#fff;padding:20px 24px">
          <h1 style="margin:0;font-size:20px">${esc(fromName)}</h1>
          <p style="margin:6px 0 0;font-size:13px">${esc(documentoLabel)}</p>
        </div>
        <div style="padding:24px">
          <p style="font-size:15px;margin-top:0">Hola ${esc(saludoNombre)},</p>
          <p style="font-size:14px;line-height:1.5">${intro}</p>
          <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px">
            <tr><td style="padding:8px;border-bottom:1px solid #eadfce;color:#6b7280">Fecha</td><td style="padding:8px;border-bottom:1px solid #eadfce;text-align:right">${esc(doc.fecha || "")}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eadfce;color:#6b7280">${esNomina ? "Periodo" : "Local"}</td><td style="padding:8px;border-bottom:1px solid #eadfce;text-align:right">${esc(esNomina ? (doc.periodo || "") : (doc.puntoVenta || ""))}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eadfce;color:#6b7280">${esNomina ? "Pagado" : "Pago"}</td><td style="padding:8px;border-bottom:1px solid #eadfce;text-align:right">${esc(esNomina ? money(Number(doc.montoPagado || 0)) : (doc.pago || ""))}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">${esNomina ? "Saldo pendiente" : "Estado electronico"}</td><td style="padding:8px;text-align:right">${esc(esNomina ? money(Number(doc.saldoPendiente || 0)) : (doc.estadoElectronico || "Pendiente de integracion DIAN"))}</td></tr>
          </table>
          <p style="font-size:13px;color:#6b7280;line-height:1.5">El PDF se encuentra adjunto a este correo.</p>
          <p style="font-size:14px;margin-bottom:0">${esNomina ? "Gracias por tu trabajo." : "Gracias por tu compra."}</p>
        </div>
      </div>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      reply_to: replyTo || undefined,
      subject: asunto,
      html,
      attachments: [{ filename: fileName, content: pdfBase64 }],
    }),
  });

  const result = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) return json({ error: result?.message || "No se pudo enviar el correo" }, 400);

  if (doc.idVenta) {
    await admin.from("ventas").update({ enviado_email: true }).eq("id_venta", doc.idVenta);
    await admin.from("auditoria").insert({
      id_usuario: authData.user.id,
      accion: "ENVIAR_FACTURA_EMAIL",
      tabla_afectada: "ventas",
      registro_id: String(doc.idVenta),
      detalle: { numero: doc.numero, correo: to },
    });
  }

  return json({ ok: true, id: result?.id });
});
