// Tiny Supabase (PostgREST) client over fetch. Uses the service key, so it only ever runs server side.
export function db(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are not set in Cloudflare');
  const base = env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const run = async (method, path, body, extra = {}) => {
    const res = await fetch(`${base}/${path}`, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw new Error(`db ${method} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    select: (table, query = '') => run('GET', `${table}?${query}`),
    insert: (table, rows) => run('POST', table, rows, { Prefer: 'return=representation' }),
    upsert: (table, rows, onConflict) => run('POST', `${table}?on_conflict=${onConflict}`, rows, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    update: (table, query, patch) => run('PATCH', `${table}?${query}`, patch, { Prefer: 'return=representation' }),
    rpc: (fn, args) => run('POST', `rpc/${fn}`, args),
  };
}

export async function getSettings(env) {
  const rows = await db(env).select('settings', 'id=eq.1&select=data');
  return (rows[0] && rows[0].data) || {};
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const bad = (message, status = 400) => json({ error: message }, status);

export async function logCost(env, what, units, usd) {
  try { await db(env).insert('costs', [{ what, units, usd }]); } catch (e) { /* never block on bookkeeping */ }
}
