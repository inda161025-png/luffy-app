export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://bdwpojszkyugqmuwcrqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3BvanN6a3l1Z3FtdXdjcnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDcwNDQsImV4cCI6MjEwNTA4MzA0NH0.c_Ty8indxncDqkQTYtB_FyYfvsAsKl7z1OrImiiQjUA';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1500;
const MAX_CHARS = 12000;
const MAX_PEDIDOS_HORA = 30;
const ROLES_STAFF = ['admin', 'profesional', 'recepcionista', 'encargado'];

const pedidosPorUsuario = new Map();

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function dentroDelTope(uid) {
  const ahora = Date.now();
  const reg = pedidosPorUsuario.get(uid);
  if (!reg || ahora - reg.inicio > 3600000) {
    pedidosPorUsuario.set(uid, { inicio: ahora, n: 1 });
    return true;
  }
  if (reg.n >= MAX_PEDIDOS_HORA) return false;
  reg.n++;
  return true;
}

async function sesionYRol(token) {
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!u.ok) return null;
  const user = await u.json();
  if (!user || !user.id) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/luffy_roles?uid=eq.${user.id}&select=role`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!r.ok) return null;
  const filas = await r.json();
  const rol = Array.isArray(filas) && filas[0] ? filas[0].role : null;
  return { uid: user.id, rol };
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: { message: 'API key not configured' } });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: { message: 'Sesión requerida' } });

  let sesion = null;
  try { sesion = await sesionYRol(token); } catch (e) { sesion = null; }
  if (!sesion) return json(401, { error: { message: 'Sesión inválida' } });
  if (!ROLES_STAFF.includes(sesion.rol)) return json(403, { error: { message: 'Sin permiso' } });

  if (!dentroDelTope(sesion.uid)) return json(429, { error: { message: 'Demasiados pedidos en una hora' } });

  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: { message: 'Pedido inválido' } }); }

  const prompt = body && Array.isArray(body.messages) && body.messages[0] ? body.messages[0].content : null;
  const system = body && typeof body.system === 'string' ? body.system : '';
  if (typeof prompt !== 'string' || !prompt) return json(400, { error: { message: 'Falta el texto' } });
  if (prompt.length + system.length > MAX_CHARS) return json(413, { error: { message: 'Texto demasiado largo' } });

  const pedido = { model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] };
  if (system) pedido.system = system;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(pedido),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
