import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { os, flatten } from '../_lib/outscraper.js';
import { toLead, hasSite } from '../_lib/leads.js';

const FIELDS = 'place_id,google_id,name,phone,website,site,address,full_address,city,state,state_code,postal_code,latitude,longitude,rating,reviews,type,category,subtypes,owner_title,photos_count,verified,location_link,photo,logo,business_status';
const USD_PER_ROW = 0.003;
const RADIUS_KM = 40;          // keep results within ~25 miles of each town's center
const PER_TOWN = 150;          // rows asked for per phrasing per town

export async function onRequestPost({ request, env }) {
  try {
    const { niche, where } = await request.json();
    const phrasings = String(niche || '').split('/').map((t) => t.trim()).filter(Boolean);
    const towns = String(where || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!phrasings.length || !towns.length) return bad('business type and at least one town are required');
    if (towns.length > 10) return bad('10 towns per scan, run it again for more');
    const settings = await getSettings(env);
    if (!settings.outscraper_key) return bad('Add your Outscraper key in settings first');
    const key = settings.outscraper_key;

    // 1. where is each town
    const geo = await os.geocode(key, towns.map((t) => `${t}, USA`));
    const centers = towns.map((t, i) => { const g = geo[i] || {}; return { town: t, lat: g.latitude ?? g.lat ?? null, lng: g.longitude ?? g.lng ?? null }; });
    const missing = centers.filter((c) => c.lat == null).map((c) => c.town);
    if (missing.length) return bad(`couldn't place ${missing.join(', ')} on the map; try "Town ST"`);

    // 2. one background Maps search per town per phrasing, centered there
    const tasks = [];
    for (const c of centers) for (const p of phrasings) {
      const t = await os.startMapsSearchAt(key, p, c.lat, c.lng, { limit: PER_TOWN, fields: FIELDS });
      if (!t || !t.id) throw new Error('Outscraper did not return a task id: ' + JSON.stringify(t).slice(0, 200));
      tasks.push({ town: c.town, lat: c.lat, lng: c.lng, phrasing: p, request_id: t.id, status: 'pending' });
    }
    const d = db(env);
    const [scan] = await d.insert('scans', [{ niche, where_text: where, towns: tasks, request_id: tasks[0].request_id, status: 'pending', rows_returned: 0, no_site: 0, new_leads: 0, est_cost_usd: 0 }]);
    await d.upsert('settings', [{ id: 1, data: { ...settings, last_niche: niche, last_where: where } }], 'id');
    return json({ id: scan.id, status: 'pending', towns: towns.length, done: 0, total: tasks.length });
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
    const key = settings.outscraper_key;
    const tasks = Array.isArray(scan.towns) ? scan.towns : [];
    const totals = { rows_returned: scan.rows_returned || 0, no_site: scan.no_site || 0, new_leads: scan.new_leads || 0 };
    const debug = scan.debug || { with_site: 0, no_phone: 0, closed: 0, far: 0, known: {} };
    let changed = false;

    // ingest at most two finished tasks per poll, so each request stays small
    let budget = 2;
    for (const t of tasks) {
      if (t.status !== 'pending' || budget <= 0) continue;
      const r = await os.check(key, t.request_id).catch((e) => ({ error: e.message }));
      if (r.pending) continue;
      if (r.error) { t.status = 'error'; t.error = r.error; changed = true; budget--; continue; }
      const c = await ingest(d, scan, flatten(r.data), t);
      t.status = 'done'; t.rows = c.rows_returned; t.kept = c.no_site; t.new = c.new_leads;
      totals.rows_returned += c.rows_returned; totals.no_site += c.no_site; totals.new_leads += c.new_leads;
      for (const k of ['with_site', 'no_phone', 'closed', 'far']) debug[k] = (debug[k] || 0) + c.debug[k];
      for (const [k, v] of Object.entries(c.debug.known)) debug.known[k] = (debug.known[k] || 0) + v;
      await logCost(env, 'maps rows', c.rows_returned, c.rows_returned * USD_PER_ROW);
      changed = true; budget--;
    }
    const allDone = tasks.every((t) => t.status !== 'pending');
    const patch = { towns: tasks, ...totals, est_cost_usd: totals.rows_returned * USD_PER_ROW };
    if (allDone) { patch.status = tasks.every((t) => t.status === 'error') ? 'error' : 'done'; patch.finished_at = new Date().toISOString(); patch.error = tasks.filter((t) => t.error).map((t) => `${t.town}: ${t.error}`).join('; ') || null; }
    const [saved] = changed || allDone ? await d.update('scans', `id=eq.${id}`, patch) : [{ ...scan, ...patch }];
    return json({ ...view(saved), debug });
  } catch (e) { return bad(e.message, 500); }
}

const view = (s) => {
  const tasks = Array.isArray(s.towns) ? s.towns : [];
  return { id: s.id, status: s.status, towns: new Set(tasks.map((t) => t.town)).size, done: tasks.filter((t) => t.status !== 'pending').length, total: tasks.length, rows_returned: s.rows_returned, no_site: s.no_site, new_leads: s.new_leads, est_cost_usd: s.est_cost_usd, error: s.error };
};

const km = (a, b, c, d) => { const R = 6371, toR = (x) => (x * Math.PI) / 180; const dLat = toR(c - a), dLng = toR(d - b); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

async function ingest(d, scan, places, task) {
  const rows_returned = places.length;
  const fresh = []; const seenPlace = new Set(); const seenPhone = new Set();
  let with_site = 0, no_phone = 0, closed = 0, far = 0;
  for (const p of places) {
    if (hasSite(p)) { with_site++; continue; }
    if ((p.business_status || 'OPERATIONAL') !== 'OPERATIONAL') { closed++; continue; }
    if (!p.phone) { no_phone++; continue; }
    if (task && task.lat != null && p.latitude != null && km(task.lat, task.lng, +p.latitude, +p.longitude) > RADIUS_KM) { far++; continue; }
    const lead = toLead(p, scan.id);
    if (!lead.place_id || seenPlace.has(lead.place_id)) continue;
    if (lead.phone_digits && seenPhone.has(lead.phone_digits)) continue;
    seenPlace.add(lead.place_id); if (lead.phone_digits) seenPhone.add(lead.phone_digits);
    fresh.push(lead);
  }
  const no_site = fresh.length;
  let new_leads = 0; const known = {};
  for (let i = 0; i < fresh.length; i += 150) {
    const chunk = fresh.slice(i, i + 150);
    const ids = chunk.map((l) => l.place_id); const phones = chunk.map((l) => l.phone_digits).filter(Boolean);
    const existing = await d.select('leads', `select=place_id,phone_digits,status&or=(place_id.in.(${ids.map(q).join(',')}),phone_digits.in.(${phones.length ? phones.map(q).join(',') : '"-"'}))`);
    for (const e of existing) known[e.status] = (known[e.status] || 0) + 1;
    const ep = new Set(existing.map((e) => e.place_id)); const eph = new Set(existing.map((e) => e.phone_digits));
    const toInsert = chunk.filter((l) => !ep.has(l.place_id) && !(l.phone_digits && eph.has(l.phone_digits)));
    if (toInsert.length) { await d.insert('leads', toInsert); new_leads += toInsert.length; }
  }
  return { rows_returned, no_site, new_leads, debug: { with_site, no_phone, closed, far, known } };
}
const q = (s) => `"${String(s).replace(/"/g, '')}"`;
