// Runs a tiny live sequence against Outscraper and returns the raw shapes, so problems can be seen instead of guessed.
import { json, bad, getSettings } from '../_lib/db.js';

const BASE = 'https://api.app.outscraper.com';
const trim = (v, n = 1800) => { const s = JSON.stringify(v); return s.length > n ? s.slice(0, n) + ' …(truncated)' : s; };

async function call(key, method, path, params, body) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const t0 = Date.now();
  const res = await fetch(url, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ms: Date.now() - t0, data };
}
async function settle(key, r) { // follow an async task for up to ~60s
  if (r.data && r.data.id && r.data.status === 'Pending') {
    for (let i = 0; i < 15; i++) { await new Promise((x) => setTimeout(x, 4000)); const p = await call(key, 'GET', `/requests/${r.data.id}`); if (p.data && p.data.status !== 'Pending') return { ...p, polled: i + 1, async: true }; }
    return { ...r, timedOut: true };
  }
  return r;
}

export async function onRequestPost({ request, env }) {
  try {
    const { niche = 'pool builders', town = 'Scottsdale AZ' } = await request.json().catch(() => ({}));
    const s = await getSettings(env); const key = s.outscraper_key;
    if (!key) return bad('no Outscraper key in settings');
    const out = {};
    const q = `${niche}, ${town}, USA`;
    // 1. maps search, 3 rows, no fields filter
    let a = await settle(key, await call(key, 'POST', '/google-maps-search', {}, { query: [q], organizationsPerQueryLimit: 3, language: 'en', region: 'us', async: false }));
    const rowsA = a.data && a.data.data ? [].concat(...[].concat(a.data.data)) : [];
    out.maps_no_fields = { http: a.status, ms: a.ms, async: !!a.async, rows: rowsA.length, keys: rowsA[0] ? Object.keys(rowsA[0]) : null, rows_summary: rowsA.map((r) => ({ name: r.name, site: r.site, phone: r.phone, photos_count: r.photos_count, place_id: r.place_id, business_status: r.business_status })) };
    // 2. same with the fields filter the app uses
    let b = await settle(key, await call(key, 'POST', '/google-maps-search', {}, { query: [q], organizationsPerQueryLimit: 3, language: 'en', region: 'us', async: false, fields: 'place_id,name,phone,site,website,photos_count,business_status' }));
    const rowsB = b.data && b.data.data ? [].concat(...[].concat(b.data.data)) : [];
    out.maps_with_fields = { http: b.status, ms: b.ms, rows: rowsB.length, keys: rowsB[0] ? Object.keys(rowsB[0]) : null, rows_summary: rowsB.map((r) => ({ name: r.name, site: r.site, website: r.website, phone: r.phone })) , raw_if_odd: rowsB.length ? undefined : trim(b.data) };
    // 3. photos for the first place
    const first = rowsA[0];
    if (first && first.place_id) {
      const c = await settle(key, await call(key, 'GET', '/maps/photos-v3', { query: first.place_id, photosLimit: 5, limit: 1, async: false }));
      out.photos = { http: c.status, ms: c.ms, async: !!c.async, timedOut: !!c.timedOut, raw: trim(c.data) };
      // 4. one phone search
      if (first.phone) {
        const d = await settle(key, await call(key, 'GET', '/google-search-v3', { query: `"${first.phone}" site:facebook.com`, pagesPerQuery: 1, async: false }));
        out.search = { http: d.status, ms: d.ms, async: !!d.async, timedOut: !!d.timedOut, raw: trim(d.data) };
      }
    }
    return json(out);
  } catch (e) { return bad(e.message, 500); }
}
