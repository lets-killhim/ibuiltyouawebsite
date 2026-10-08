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

export const os = {
  // Start a Maps search as an async task. Returns { id } to poll later.
  startMapsSearch: (key, queries, { limit = 100, language = 'en', region = 'us', fields = '' } = {}) =>
    raw(key, 'POST', '/google-maps-search', { body: { query: queries, organizationsPerQueryLimit: limit, language, region, dropDuplicates: true, async: true, fields } }),

  // Poll an async task. Returns { status: 'Pending' | 'Success' | ..., data }
  request: (key, id) => raw(key, 'GET', `/requests/${id}`),

  // Small synchronous calls. If the API decides to answer async anyway, wait for it (up to ~70s).
  photos: (key, placeId, n = 15) => sync(key, '/maps/photos-v3', { query: placeId, photosLimit: n, limit: 1, async: false }),
  reviews: (key, placeId, n = 6) => sync(key, '/maps/reviews-v3', { query: placeId, reviewsLimit: n, limit: 1, sort: 'highest_rating', ignoreEmpty: true, async: false }),
  search: (key, queries) => sync(key, '/google-search-v3', { query: queries, pagesPerQuery: 1, async: false }),
};

async function sync(key, path, params) {
  const first = await raw(key, 'GET', path, { params });
  if (first && Array.isArray(first.data)) return first.data;
  if (first && first.id) {
    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, Number(globalThis.__FAST || 4000)));
      const r = await raw(key, 'GET', `/requests/${first.id}`);
      if (r.status && r.status !== 'Pending') return r.data || [];
    }
    throw new Error('Outscraper task took too long');
  }
  return [];
}
