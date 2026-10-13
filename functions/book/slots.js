// Public: open slots for a lead's booking link.
import { db, json, bad, getSettings } from '../_lib/db.js';
import { bookingConfig, slotsFor, tzLabel } from '../_lib/booking.js';

export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!/^[a-z0-9]{8,16}$/.test(token)) return bad('bad link', 404);
    const d = db(env);
    const [l] = await d.select('leads', `site->>book_token=eq.${token}&select=id,name,owner,status`);
    if (!l) return bad('This booking link is not valid', 404);
    const s = await getSettings(env);
    const c = bookingConfig(s);
    const busy = await d.select('leads', `status=neq.trash&meeting=not.is.null&select=id,meeting`);
    const taken = new Set(busy.filter((x) => x.meeting?.date && x.meeting?.time && x.id !== l.id).map((x) => `${x.meeting.date} ${x.meeting.time}`));
    return json({ business: l.name, me: s.me || '', tz: tzLabel(c.book_tz), slot: c.book_slot, days: slotsFor(c, taken) });
  } catch (e) { return bad(e.message, 500); }
}
