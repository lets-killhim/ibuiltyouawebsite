import { db, json, bad } from '../_lib/db.js';
// Deletes every lead with the given status (default: new), so a town can be rescanned cleanly.
export async function onRequestPost({ request, env }) {
  try {
    const { status = 'new' } = await request.json().catch(() => ({}));
    if (!['new', 'callback', 'trash'].includes(status)) return bad('only new, callback or trash can be cleared');
    const base = env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
    const res = await fetch(`${base}/leads?status=eq.${status}`, { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, Prefer: 'return=minimal' } });
    if (!res.ok) return bad('db: ' + (await res.text()).slice(0, 200), 500);
    return json({ ok: true });
  } catch (e) { return bad(e.message, 500); }
}
