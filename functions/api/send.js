// Sends the site link to a lead by email through Resend, from the address in settings. Logs it on the lead.
import { db, json, bad, getSettings } from '../_lib/db.js';
import { present } from '../_lib/leads.js';
import { withDefaults } from './settings.js';

export function fill(tpl, vars) { return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] ?? '' : '')); }

export async function onRequestPost({ request, env }) {
  const d = db(env);
  try {
    const body = await request.json();
    const { id, to: override } = body;
    const [l] = await d.select('leads', `id=eq.${id}`);
    if (!l) return bad('not found', 404);
    const s = withDefaults(await getSettings(env));
    if (!s.resend_key) return bad('Add your Resend key in settings first');
    if (!s.my_email) return bad('Set your sending email in settings first');
    const to = (override || l.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return bad('No email address for this lead');
    const kind = body.kind === 'invoice' ? 'invoice' : 'site';
    const planTitle = body.plan || l.plan || '';
    const plan = (s.plans || []).find((p) => p.title === planTitle) || null;
    if (kind === 'invoice' && !plan) return bad('Pick a plan first; plans are made in settings');
    if (kind === 'invoice' && !s.agreement_file?.url) return bad('Upload the hosting agreement in settings first');
    if (kind === 'site' && !l.site?.url) return bad('Build the site first');
    // every lead gets a booking link the first time one is needed
    let site = l.site || {};
    if (!site.book_token) { site = { ...site, book_token: Math.random().toString(36).slice(2, 14) }; await d.update('leads', `id=eq.${id}`, { site }); l.site = site; }
    const book_link = `${new URL(request.url).origin}/book/${site.book_token}`;
    const vars = { book_link, business: l.name, owner: l.owner || 'there', phone: l.phone || '', link: l.site?.url || '', me: s.me || '', my_phone: s.my_phone || '', my_email: s.my_email, plan: plan ? plan.title : planTitle, pay_link: plan ? plan.link : '', agreement_link: s.agreement_file?.url || s.agreement_link || '', date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) };
    let subject, text;
    if (kind === 'invoice') {
      subject = fill(s.tpl_pay_subject, vars).trim() || `${l.name}: website hosting agreement and payment`;
      text = fill(s.tpl_pay, vars).trim();
      if (!text) return bad('The hosting agreement email in settings is empty');
    } else {
      subject = fill(s.tpl_email_subject, vars).trim() || `Your new ${l.name} website`;
      text = fill(s.tpl_email, vars).trim();
      if (!text) text = `Hi ${vars.owner},\n\nHere's the website I put together for ${l.name}: ${l.site.url}\n\nTell me what you'd like changed.\n\n${vars.me}\n${vars.my_phone}`.trim();
      if (!text.includes(l.site.url)) text += `\n\n${l.site.url}`;
    }
    const from = s.me ? `${s.me} <${s.my_email}>` : s.my_email;
    const attachments = [];
    if (kind === 'invoice') {
      const f = await fetch(s.agreement_file.url);
      if (!f.ok) return bad('Could not read the agreement file from storage', 500);
      const bytes = new Uint8Array(await f.arrayBuffer());
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      attachments.push({ filename: s.agreement_file.name || 'Hosting-Agreement.pdf', content: btoa(bin) });
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.resend_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: s.my_email, subject, text, ...(attachments.length ? { attachments } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return bad(`Resend ${res.status}: ${data.message || data.error?.message || 'could not send'}`, 502);
    const sent = [...(l.site?.sent || []), { kind: kind === 'invoice' ? 'invoice' : 'email', to, at: new Date().toISOString(), id: data.id || null, plan: plan ? plan.title : undefined }].slice(-20);
    const patch = { site: { ...(l.site || {}), sent } };
    if (kind === 'invoice') { patch.pay = 'sent'; patch.plan = plan.title; }
    if (override && override !== l.email) patch.email = to;
    const [u] = await d.update('leads', `id=eq.${id}`, patch);
    return json(present(u));
  } catch (e) { return bad(e.message, 500); }
}
