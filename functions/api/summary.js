import { db, json, bad } from '../_lib/db.js';
export async function onRequestGet({ env }) {
  try {
    const d = db(env);
    const [leads, costs] = await Promise.all([
      d.select('leads', 'select=status,meeting'),
      d.select('costs', 'select=usd'),
    ]);
    const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const iso = (x) => x.toISOString().slice(0, 10);
    return json({
      to_call: leads.filter((l) => l.status === 'new').length,
      clients: leads.filter((l) => l.status === 'confirmed').length,
      meetings_week: leads.filter((l) => l.meeting && l.meeting.date >= iso(mon) && l.meeting.date <= iso(sun)).length,
      spend_usd: costs.reduce((a, c) => a + (+c.usd || 0), 0),
      by_status: leads.reduce((m, l) => { m[l.status] = (m[l.status] || 0) + 1; return m; }, {}),
    });
  } catch (e) { return bad(e.message, 500); }
}
