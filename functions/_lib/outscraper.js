// Outscraper REST, mirroring their official SDK: X-API-KEY header, async tasks polled at /requests/{id}.
const BASE = 'https://api.app.outscraper.com';

async function raw(key, method, path, { params, body } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x)); else url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', client: 'ibuiltyouawebsite' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { errorMessage: text }; }
  if (!res.ok) throw new Error(`Outscraper ${res.status}: ${(data && (data.errorMessage || data.error)) || text.slice(0, 200)}`);
  if (data && data.error) throw new Error('Outscraper: ' + (data.errorMessage || data.error));
  return data;
}

// Wait for a background task. Returns its data, or null while still pending (when wait is 0).
async function waitTask(key, id, maxMs) {
  const t0 = Date.now();
  for (;;) {
    const r = await raw(key, 'GET', `/requests/${id}`);
    if (r.status && r.status !== 'Pending') {
      if (r.status !== 'Success') throw new Error('Outscraper task ' + r.status + (r.errorMessage ? ': ' + r.errorMessage : ''));
      return r.data || [];
    }
    if (Date.now() - t0 > maxMs) throw new Error('Outscraper task took too long');
    await new Promise((res) => setTimeout(res, Number(globalThis.__FAST || 4000)));
  }
}

// Unwrap data to a flat list of place objects regardless of nesting.
export function flatten(data) {
  const out = [];
  const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') out.push(x); };
  walk(data);
  return out;
}

export const os = {
  // Towns -> coordinates, one call.
  geocode: async (key, places) => {
    const r = await raw(key, 'GET', '/geocoding', { params: { query: places, async: false } });
    const data = r && r.id && r.status === 'Pending' ? await waitTask(key, r.id, 60000) : (r && r.data) || [];
    return flatten(data);
  },

  // Start a Maps search centered on coordinates, like a browser with the map on that town. Returns { id }.
  startMapsSearchAt: (key, query, lat, lng, { limit = 120, language = 'en', region = 'us', fields = '' } = {}) =>
    raw(key, 'POST', '/google-maps-search', { body: { query: [query], coordinates: `${lat},${lng}`, organizationsPerQueryLimit: limit, language, region, dropDuplicates: true, async: true, fields } }),

  // Poll a task once. Returns { pending: true } or { data }.
  check: async (key, id) => {
    const r = await raw(key, 'GET', `/requests/${id}`);
    if (!r.status || r.status === 'Pending') return { pending: true };
    if (r.status !== 'Success') throw new Error('Outscraper task ' + r.status + (r.errorMessage ? ': ' + r.errorMessage : ''));
    return { data: r.data || [] };
  },

  // Photos of a place: small and fast, synchronous.
  photos: async (key, placeId, n = 15) => {
    const r = await raw(key, 'GET', '/maps/photos-v3', { params: { query: placeId, photosLimit: n, limit: 1, async: false } });
    if (r && r.id && r.status === 'Pending') return waitTask(key, r.id, 120000);
    return (r && r.data) || [];
  },

  // Google search: always a background task (synchronous ones time out at their edge), waited on for up to 3 minutes.
  search: async (key, query) => {
    const r = await raw(key, 'GET', '/google-search-v3', { params: { query, pagesPerQuery: 1, async: true } });
    if (r && r.data && !r.id) return r.data;
    return waitTask(key, r.id, 180000);
  },
};
