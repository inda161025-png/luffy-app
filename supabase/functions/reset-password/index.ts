// Edge Function: un admin resetea la contraseña de una cuenta de staff.
// Subir desde Supabase → Edge Functions → Create function (nombre: reset-password) → pegar este código → Deploy.
// La clave de servicio la provee Supabase automaticamente dentro de la funcion (no hay que pegarla).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "sin sesión" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
    if (whoErr || !who?.user) return json({ error: "sesión inválida" }, 401);

    const { data: rol } = await admin.from("luffy_roles").select("role").eq("uid", who.user.id).maybeSingle();
    if (!rol || rol.role !== "admin") return json({ error: "solo el admin puede resetear claves" }, 403);

    const { uid, password } = await req.json();
    if (!uid || typeof password !== "string" || password.length < 4) return json({ error: "datos inválidos" }, 400);

    // La app guarda la clave como "inda-luffy:" + lo que tipea la persona (ver authPass en 02-horarios-auth.js)
    const { error } = await admin.auth.admin.updateUserById(uid, { password: "inda-luffy:" + password });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
