import { json } from '../_lib/db.js';
export async function onRequestPost() {
  const res = json({ ok: true });
  res.headers.append('Set-Cookie', 'ibyaw=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return res;
}
