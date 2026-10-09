import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { os } from '../_lib/outscraper.js';
import { present, digits } from '../_lib/leads.js';

const FB = /^https?:\/\/(?:www\.|m\.)?facebook\.com\/([A-Za-z0-9.\-_]+)\/?/i;
const IG = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9.\-_]+)\/?/i;
const SKIP = new Set(['pages', 'people', 'search', 'groups', 'events', 'marketplace', 'public', 'login', 'explore', 'p', 'reel', 'reels', 'stories', 'hashtag', 'profile.php', 'sharer', 'share', 'accounts']);

const STOP = new Set(['the', 'and', 'llc', 'inc', 'co', 'company', 'pool', 'pools', 'spa', 'spas', 'service', 'services', 'construction', 'builders', 'contractor', 'contractors', 'remodeling', 'remodel', 'home', 'homes', 'design', 'designs', 'custom', 'group', 'solutions', 'pro', 'pros', 'electric', 'electrician', 'plumbing', 'roofing', 'landscaping', 'repair']);
function firstSocial(pages, rx, phoneDigits, name) {
  const words = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
  const distinct = words.filter((t) => !STOP.has(t));            // the words that actually identify this business
  const needle = words.join(' ');
  let best = [null, null];
  const walk = (x, fn) => { if (Array.isArray(x)) x.forEach((y) => walk(y, fn)); else if (x && typeof x === 'object') fn(x); };
  walk(pages, (page) => {
    for (const r of page.organic_results || []) {
      const link = r.link || ''; const m = rx.exec(link);
      if (!m || SKIP.has(m[1].toLowerCase()) || m[1].includes('...')) continue;
      const text = `${r.title || ''} ${r.description || ''}`.toLowerCase();
      if (phoneDigits && phoneDigits.length === 10 && text.replace(/\D/g, '').includes(phoneDigits)) { best = [link, 'matched by phone']; return; }
      if (best[0]) continue;
      const titleHasName = (r.title || '').toLowerCase().includes(needle);
      const distinctHits = distinct.filter((t) => text.includes(t)).length;
      if (titleHasName || (distinct.length && distinctHits >= Math.min(2, distinct.length) && distinctHits >= 1)) best = [link, 'matched by name, check it'];
    }
  });
  return best;
}

// Outscraper wraps the photos response as data[0][0].photos_data; be tolerant of any nesting.
export function extractPhotos(res) {
  let node = res;
  while (Array.isArray(node) && node.length) node = node[0];
  if (!node || typeof node !== 'object') return [];
  if (node.photo_url || node.photo_url_big) return [node];
  for (const v of Object.values(node)) if (Array.isArray(v) && v.length && v.some((p) => p && typeof p === 'object' && (p.photo_url || p.photo_url_big || p.original_photo_url))) return v;
  return [];
}

export async function onRequestPost({ request, env }) {
  try {
    const { id } = await request.json();
    const d = db(env);
    const [l] = await d.select('leads', `id=eq.${id}`);
    if (!l) return bad('not found', 404);
    const s = await getSettings(env);
    const key = s.outscraper_key; if (!key) return bad('Add your Outscraper key in settings first');
    const patch = { enriched_at: new Date().toISOString(), enrich_error: null };
    const pd = digits(l.phone);
    const errs = [];

    const photosJob = os.photos(key, l.place_id, 15).then((res) => {
      const list = extractPhotos(res);
      patch.photos = list.map((p) => ({ src: p.photo_url_big || p.photo_url || p.original_photo_url || p.url, source: 'google', date: p.photo_date || null })).filter((p) => p.src);
      if (!patch.photos.length && l.main_photo) patch.photos = [{ src: l.main_photo, source: 'google' }];
      return logCost(env, 'photos', patch.photos.length, patch.photos.length * 0.002);
    }).catch((e) => { errs.push('photos: ' + e.message); if (l.main_photo) patch.photos = [{ src: l.main_photo, source: 'google' }]; });

    // Facebook: the phone number first (unique), then name + city. Instagram: name + city (phones are rarely in IG text).
    const national = pd.length === 10 ? `${pd.slice(0, 3)}-${pd.slice(3, 6)}-${pd.slice(6)}` : l.phone;
    const city = l.city || '';
    const social = async (site, rx, urlKey, matchKey, queries) => {
      try {
        for (const q of queries) {
          const res = await os.search(key, q);
          await logCost(env, 'search', 1, 0.003);
          const [url, how] = firstSocial(res, rx, pd, l.name);
          if (url) { patch[urlKey] = url; patch[matchKey] = how; return; }
        }
        patch[urlKey] = null; patch[matchKey] = null;
      } catch (e) { errs.push(site + ': ' + e.message); }
    };
    const fbQueries = [l.phone ? `"${national}" site:facebook.com` : null, `"${l.name}" ${city} site:facebook.com`].filter(Boolean);
    const igQueries = [`"${l.name}" ${city} site:instagram.com`];
    const jobs = [photosJob];
    if (!l.facebook_url) jobs.push(social('facebook.com', FB, 'facebook_url', 'fb_match', fbQueries));
    if (!l.instagram_url) jobs.push(social('instagram.com', IG, 'instagram_url', 'ig_match', igQueries));
    await Promise.all(jobs);
    if (errs.length) patch.enrich_error = errs.join('; ');

    const [u] = await d.update('leads', `id=eq.${id}`, patch);
    return json(present(u));
  } catch (e) { return bad(e.message, 500); }
}
