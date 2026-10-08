import { bad } from '../_lib/db.js';

export async function sessionToken(env) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ibyaw|' + env.APP_PASSWORD));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname === '/api/login') return next();
  if (!env.APP_PASSWORD) return bad('APP_PASSWORD is not set in Cloudflare (Pages → Settings → Variables)', 500);
  const cookies = Object.fromEntries((request.headers.get('Cookie') || '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length === 2));
  if (cookies.ibyaw === await sessionToken(env)) return next();
  return bad('login', 401);
}
