import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { os } from '../_lib/outscraper.js';
import { toLead, hasSite, digits } from '../_lib/leads.js';

const FIELDS = 'place_id,google_id,name,phone,site,full_address,city,state,postal_code,rating,reviews,category,type,working_hours,owner_title,photos_count,verified,location_link,photo,logo,business_status';
const USD_PER_ROW = 0.003;

export async function onRequestPost({ request, env }) {
  try {
    const { niche, where } = await request.json();
    const towns = String(where || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!niche || !towns.length) return bad('business type and at least one town are required');
    if (towns.length > 12) return bad('12 towns per scan, run it again for more');
    const settings = await getSettings(env);
    if (!settings.outscraper_key) return bad('Add your Outscraper key in settings first');
    const queries = towns.map((t) => `${niche}, ${t}, USA`);
    const task = await os.startMapsSearch(settings.outscraper_key, queries, { limit: 100, fields: FIELDS });
    if (!task || !task.id) throw new Error('Outscraper did not return a task id: ' + JSON.stringify(task).slice(0, 200));
    const d = db(env);
    const [scan] = await d.insert('scans', [{ niche, where_text: where, towns, request_id: task.id, status: 'pending' }]);
    await d.upsert('settings', [{ id: 1, data: { ...settings, last_niche: niche, last_where: where } }], 'id');
    return json({ id: scan.id, status: 'pending', towns: towns.length });
  } catch (e) { return bad(e.message, 500); }
}

export async function onRequestGet({ request, env }) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const d = db(env);
    const [scan] = await d.select('scans', `id=eq.${id}`);
    if (!scan) return bad('scan not found', 404);
    if (scan.status !== 'pending') return json(view(scan));
    const settings = await getSettings(env);
    const r = await os.request(settings.outscraper_key, scan.request_id);
    if (!r.status || r.status === 'Pending') return json(view(scan));
    if (r.status !== 'Success') {
      await d.update('scans', `id=eq.${id}`, { status: 'error', error: r.status + (r.errorMessage ? ': ' + r.errorMessage : ''), finished_at: new Date().toISOString() });
      return json({ ...view(scan), status: 'error', error: r.status });
    }
    const counts = await ingest(d, scan, r.data || []);
    await logCost(env, 'maps rows', counts.rows_returned, counts.rows_returned * USD_PER_ROW);
    const [done] = await d.update('scans', `id=eq.${id}`, { status: 'done', ...counts, est_cost_usd: counts.rows_returned * USD_PER_ROW, finished_at: new Date().toISOString() });
    return json(view(done));
  } catch (e) { return bad(e.message, 500); }
}

const view = (s) => ({ id: s.id, status: s.status, towns: Array.isArray(s.towns) ? s.towns.length : 0, rows_returned: s.rows_returned, no_site: s.no_site, new_leads: s.new_leads, est_cost_usd: s.est_cost_usd, error: s.error });

async function ingest(d, scan, data) {
  const places = [];
  for (const per of data) { if (Array.isArray(per)) places.push(...per); else if (per && typeof per === 'object') places.push(per); }
  const rows_returned = places.length;
  const fresh = []; const seenPlace = new Set(); const seenPhone = new Set();
  for (const p of places) {
    if (hasSite(p)) continue;
    if ((p.business_status || 'OPERATIONAL') !== 'OPERATIONAL') continue;
    if (!p.phone) continue;
    const lead = toLead(p, scan.id);
    if (!lead.place_id || seenPlace.has(lead.place_id)) continue;
    if (lead.phone_digits && seenPhone.has(lead.phone_digits)) continue;
    seenPlace.add(lead.place_id); if (lead.phone_digits) seenPhone.add(lead.phone_digits);
    fresh.push(lead);
  }
  const no_site = fresh.length;
  // skip anything we already have, by place id or by phone
  let new_leads = 0;
  for (let i = 0; i < fresh.length; i += 150) {
    const chunk = fresh.slice(i, i + 150);
    const ids = chunk.map((l) => l.place_id); const phones = chunk.map((l) => l.phone_digits).filter(Boolean);
    const existing = await d.select('leads', `select=place_id,phone_digits&or=(place_id.in.(${ids.map(q).join(',')}),phone_digits.in.(${phones.map(q).join(',')}))`);
    const ep = new Set(existing.map((e) => e.place_id)); const eph = new Set(existing.map((e) => e.phone_digits));
    const toInsert = chunk.filter((l) => !ep.has(l.place_id) && !(l.phone_digits && eph.has(l.phone_digits)));
    if (toInsert.length) { await d.insert('leads', toInsert); new_leads += toInsert.length; }
  }
  return { rows_returned, no_site, new_leads };
}
const q = (s) => `"${String(s).replace(/"/g, '')}"`;
