import { json, bad } from '../_lib/db.js';
export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id'); const name = (url.searchParams.get('name') || 'photo').replace(/[^A-Za-z0-9._-]/g, '_');
    if (!id) return bad('id required');
    const path = `${id}/${Date.now()}-${name}`;
    const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/photos/${path}`, {
      method: 'POST', body: await request.arrayBuffer(),
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': request.headers.get('Content-Type') || 'application/octet-stream', 'x-upsert': 'true' },
    });
    if (!res.ok) return bad('storage: ' + (await res.text()).slice(0, 200), 500);
    return json({ url: `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/photos/${path}` });
  } catch (e) { return bad(e.message, 500); }
}
