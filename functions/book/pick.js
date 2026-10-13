// Public: the prospect picked a slot. Store it as the lead's meeting, confirm the lead, email both sides.
import { db, json, bad, getSettings } from '../_lib/db.js';
import { bookingConfig, slotsFor, tzLabel } from '../_lib/booking.js';

export async function onRequestPost({ request, env }) {
  try {
    const { token, date, time, name, phone, email } = await request.json();
    if (!/^[a-z0-9]{8,16}$/.test(token || '')) return bad('bad link', 404);
    const d = db(env);
    const [l] = await d.select('leads', `site->>book_token=eq.${token}`);
    if (!l) return bad('This booking link is not valid', 404);
    const s = await getSettings(env);
    const c = bookingConfig(s);
    const busy = await d.select('leads', `status=neq.trash&meeting=not.is.null&select=id,meeting`);
    const taken = new Set(busy.filter((x) => x.meeting?.date && x.meeting?.time && x.id !== l.id).map((x) => `${x.meeting.date} ${x.meeting.time}`));
    const day = slotsFor(c, taken).find((x) => x.date === date);
    if (!day || !day.times.includes(time)) return bad('That time just got taken, pick another', 409);
    const who = String(name || '').trim().slice(0, 80);
    const patch = { meeting: { date, time, notes: `booked online${who ? ' by ' + who : ''}${phone ? ', ' + String(phone).slice(0, 30) : ''}` }, status: 'confirmed' };
    if (who && !l.owner) patch.owner = who;
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !l.email) patch.email = String(email).trim();
    const [u] = await d.update('leads', `id=eq.${l.id}`, patch);
    const pretty = `${day.label} at ${time} ${tzLabel(c.book_tz)}`;
    if (s.resend_key && s.my_email) {
      const from = s.me ? `${s.me} <${s.my_email}>` : s.my_email;
      const mail = (to, subject, text) => fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${s.resend_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], reply_to: s.my_email, subject, text }) }).catch(() => {});
      await mail(s.my_email, `Booked: ${l.name}, ${pretty}`, `${who || l.name} picked ${pretty}.\nPhone: ${phone || l.phone || 'not given'}\nEmail: ${patch.email || l.email || 'not given'}\n\nIt's on your calendar.`);
      const to = patch.email || l.email;
      if (to) await mail(to, `Confirmed: ${pretty}`, `Hi ${who || 'there'},\n\nYou're booked for ${pretty}. I'll call you at ${phone || l.phone || 'the number on file'}.\n\nIf anything changes, reply to this email or call me at ${s.my_phone || s.my_email}.\n\n${s.me || ''}`);
    }
    return json({ ok: true, when: pretty, business: u.name });
  } catch (e) { return bad(e.message, 500); }
}
