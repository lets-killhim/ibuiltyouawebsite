import { db, json, bad } from '../_lib/db.js';
import { present } from '../_lib/leads.js';

const EDITABLE = ['status', 'warmth', 'meeting', 'notes', 'owner', 'live', 'plan', 'pay', 'domain', 'form_email', 'photos', 'email', 'site', 'blurb'];

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const status = (url.searchParams.get('status') || 'new,callback').split(',').map((s) => s.trim()).filter(Boolean);
    const rows = await db(env).select('leads', `status=in.(${status.join(',')})&order=score.desc,reviews.desc&limit=2000`);
    return json(rows.map(present));
  } catch (e) { return bad(e.message, 500); }
}

export async function onRequestPatch({ request, env }) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return bad('id required');
    const body = await request.json();
    const patch = {};
    for (const k of EDITABLE) if (k in body) patch[k] = body[k];
    patch.updated_at = new Date().toISOString();
    const rows = await db(env).update('leads', `id=eq.${id}`, patch);
    if (!rows.length) return bad('not found', 404);
    return json(present(rows[0]));
  } catch (e) { return bad(e.message, 500); }
}
