import { json, bad } from '../_lib/db.js';
import { sessionToken } from './_middleware.js';

export async function onRequestPost({ request, env }) {
  if (!env.APP_PASSWORD) return bad('APP_PASSWORD is not set in Cloudflare (Pages → Settings → Variables)', 500);
  const { password } = await request.json().catch(() => ({}));
  if (!password || password !== env.APP_PASSWORD) return bad('wrong password', 401);
  const token = await sessionToken(env);
  const res = json({ ok: true });
  res.headers.append('Set-Cookie', `ibyaw=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
  return res;
}
