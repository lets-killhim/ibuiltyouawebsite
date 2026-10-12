// Sends the site link to a lead by email through Resend, from the address in settings. Logs it on the lead.
import { db, json, bad, getSettings } from '../_lib/db.js';
import { present } from '../_lib/leads.js';

export function fill(tpl, vars) { return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] ?? '' : '')); }

export async function onRequestPost({ request, env }) {
  const d = db(env);
  try {
    const { id, to: override } = await request.json();
    const [l] = await d.select('leads', `id=eq.${id}`);
    if (!l) return bad('not found', 404);
    const s = await getSettings(env);
    if (!s.resend_key) return bad('Add your Resend key in settings first');
    if (!s.my_email) return bad('Set your sending email in settings first');
    const to = (override || l.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return bad('No email address for this lead');
    if (!l.site?.url) return bad('Build the site first');
    const vars = { business: l.name, owner: l.owner || 'there', phone: l.phone || '', link: l.site.url, me: s.me || '', my_phone: s.my_phone || '', plan: l.plan || '', pay_link: '', agreement_link: s.agreement_link || '' };
    const subject = fill(s.tpl_email_subject, vars) || `Your new ${l.name} website`;
    const text = fill(s.tpl_email, vars);
    const from = s.me ? `${s.me} <${s.my_email}>` : s.my_email;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.resend_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: s.my_email, subject, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return bad(`Resend ${res.status}: ${data.message || data.error?.message || 'could not send'}`, 502);
    const sent = [...(l.site.sent || []), { kind: 'email', to, at: new Date().toISOString(), id: data.id || null }].slice(-20);
    const patch = { site: { ...l.site, sent } };
    if (override && override !== l.email) patch.email = to;
    const [u] = await d.update('leads', `id=eq.${id}`, patch);
    return json(present(u));
  } catch (e) { return bad(e.message, 500); }
}
