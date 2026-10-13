// Public: the contact form on a built site posts here. Emails the submission to the lead's form address
// (or the app owner until one is set) and keeps the last few on the lead. CORS-open so the form keeps
// working once the site lives on the client's own domain.
import { db, getSettings } from '../_lib/db.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const HONEY = new Set(['_gotcha', '_honey', 'honeypot', 'botcheck', 'website_url', 'fax', 'company_site']);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestPost({ request, params, env }) {
  const token = String(params.token || '').replace(/[^a-z0-9]/g, '');
  const wantsJson = /json/.test(request.headers.get('Accept') || '') || /json/.test(request.headers.get('Content-Type') || '') || request.headers.get('X-Requested-With') === 'fetch';
  const reply = (ok, msg, status = 200) => wantsJson ? json({ ok, message: msg }, status) : new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto;line-height:1.5"><h1 style="font-size:28px;margin:0 0 8px">${ok ? 'Got it.' : 'Something went wrong.'}</h1><p>${esc(msg)}</p><p><a href="javascript:history.back()">Back</a></p></body>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS } });
  try {
    if (!/^[a-z0-9]{8,16}$/.test(token)) return reply(false, 'This form is not connected.', 404);
    // accept JSON, multipart or urlencoded bodies
    let fields = {};
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) fields = await request.json();
    else { const fd = await request.formData(); for (const [k, v] of fd.entries()) if (typeof v === 'string') fields[k] = v; }
    for (const k of Object.keys(fields)) if (HONEY.has(k.toLowerCase()) && String(fields[k]).trim()) return reply(true, "Thanks, we'll be in touch."); // bot: pretend success
    const clean = Object.entries(fields).filter(([k, v]) => !k.startsWith('_') && String(v).trim()).map(([k, v]) => [k.replace(/[_-]+/g, ' ').trim(), String(v).trim().slice(0, 2000)]);
    if (!clean.length) return reply(false, 'The form was empty.', 400);

    const d = db(env);
    const [l] = await d.select('leads', `site->>form_token=eq.${token}`);
    if (!l) return reply(false, 'This form is not connected.', 404);
    const s = await getSettings(env);
    const to = (l.form_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.form_email)) ? l.form_email : s.my_email;
    const when = new Date().toISOString();
    const entry = { at: when, fields: Object.fromEntries(clean.slice(0, 20)) };
    const submissions = [...(l.site?.submissions || []), entry].slice(-25);
    await d.update('leads', `id=eq.${l.id}`, { site: { ...(l.site || {}), submissions } });

    if (s.resend_key && s.my_email && to) {
      const lines = clean.map(([k, v]) => `${k}: ${v}`).join('\n');
      const from = `${l.name} website <${s.my_email}>`;
      const replyTo = clean.find(([k, v]) => /email/i.test(k) && /@/.test(v))?.[1] || s.my_email;
      const body = `New message from the ${l.name} website:\n\n${lines}\n\nSent ${new Date(when).toLocaleString('en-US', { timeZone: s.book_tz || 'America/Los_Angeles' })}`;
      const recipients = [to]; if (to !== s.my_email) recipients.push(s.my_email);
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${s.resend_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: recipients, reply_to: replyTo, subject: `${l.name}: new website inquiry`, text: body }) }).catch(() => {});
    }
    return reply(true, "Thanks, we'll be in touch shortly.");
  } catch (e) { return reply(false, e.message, 500); }
}
