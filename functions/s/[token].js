// Public: serves the latest version of a built site at /s/<token>. No login, this is the link you text people.
import { db } from '../_lib/db.js';
export async function onRequestGet({ params, env }) {
  try {
    const rows = await db(env).select('sites', `token=eq.${encodeURIComponent(params.token)}&select=html&order=version.desc&limit=1`);
    if (!rows.length) return new Response('No site here.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    return new Response(rows[0].html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  } catch (e) { return new Response('Error: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/plain' } }); }
}
