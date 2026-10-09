import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { os } from '../_lib/outscraper.js';
import { present, digits } from '../_lib/leads.js';

const FB = /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/([^?#]+)/i;
const IG = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#].*)?$/i;
const SKIP = new Set(['pages', 'search', 'groups', 'events', 'marketplace', 'public', 'login', 'explore', 'p', 'reel', 'reels', 'stories', 'story', 'hashtag', 'sharer', 'share', 'accounts', 'home', 'home.php', 'me', 'directory', 'places', 'biz', 'business', 'help', 'policies', 'privacy', 'legal', 'terms', 'about', 'ads', 'watch', 'gaming', 'live', 'photo', 'photos', 'photo.php', 'video', 'videos', 'notes', 'friends', 'messages', 'notifications', 'settings', 'bookmarks', 'saved', 'memories', 'dating', 'jobs', 'offers', 'weather', 'fundraisers', 'recommendations', 'community', 'l.php', 'dialog', 'plugins', 'tr', 'developers', 'careers', 'policy', 'security', 'recover', 'checkpoint', 'r.php', 'reg', 'signup', 'ajax', 'intl', 'tag', 'tags', 'topic', 'news', 'media', 'permalink.php', 'posts']);
const STOP = new Set(['the', 'and', 'llc', 'inc', 'co', 'company', 'pool', 'pools', 'spa', 'spas', 'service', 'services', 'construction', 'builders', 'builder', 'contractor', 'contractors', 'remodeling', 'remodel', 'remodelers', 'remodeler', 'home', 'homes', 'design', 'designs', 'custom', 'group', 'solutions', 'pro', 'pros', 'electric', 'electrical', 'electrician', 'plumbing', 'plumber', 'roofing', 'roofer', 'landscaping', 'landscape', 'repair', 'repairs', 'experts', 'expert', 'painting', 'painters', 'tx', 'az', 'co', 'ga', 'fl', 'ca', 'wa', 'austin', 'phoenix', 'atlanta', 'denver', 'dallas', 'houston']);

// A Facebook page url, cleaned to its root. Accepts /people/Name/123 and /pages/Name/123 forms; rejects utility paths.
function fbPage(link) {
  const m = FB.exec(link); if (!m) return null;
  const parts = m[1].split('/').filter(Boolean);
  if (!parts.length || parts.some((p) => p.includes('...'))) return null;
  const first = parts[0].toLowerCase();
  if (first === 'people' || first === 'pages') { if (parts.length >= 3 && /^\d+$/.test(parts[2])) return `https://www.facebook.com/${parts[0]}/${parts[1]}/${parts[2]}/`; return null; }
  if (first === 'profile.php') return /id=\d+/.test(link) ? link.split('&')[0] : null;
  if (SKIP.has(first) || !/^[A-Za-z0-9._-]{3,}$/.test(parts[0])) return null;
  return `https://www.facebook.com/${parts[0]}/`;
}
function igPage(link) {
  const m = IG.exec(link); if (!m) return null;
  const h = m[1].toLowerCase(); if (SKIP.has(h) || h.length < 3) return null;
  return `https://www.instagram.com/${m[1]}/`;
}

// Does a search result's TITLE name this business? Needs every distinctive word of the name (or the whole name) in the title.
function titleNames(title, name) {
  const norm = (x) => x.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const t = norm(title.split(/[(|•·-]/)[0]); const n = norm(name);
  if (!t || !n) return false;
  if (t.includes(n)) return true;
  const words = n.split(' ').filter((w) => w.length > 2); const distinct = words.filter((w) => !STOP.has(w));
  if (!distinct.length) return false;
  const tw = new Set(t.split(' '));
  return distinct.every((w) => tw.has(w)) && words.filter((w) => tw.has(w)).length >= Math.ceil(words.length * 0.6);
}

function firstSocial(pages, kind, phoneDigits, name) {
  const toUrl = kind === 'fb' ? fbPage : igPage;
  let best = [null, null];
  const walk = (x, fn) => { if (Array.isArray(x)) x.forEach((y) => walk(y, fn)); else if (x && typeof x === 'object') fn(x); };
  walk(pages, (page) => {
    for (const r of page.organic_results || []) {
      const url = toUrl(r.link || ''); if (!url) continue;
      const text = `${r.title || ''} ${r.description || ''}`;
      if (kind === 'fb' && phoneDigits && phoneDigits.length === 10 && text.replace(/\D/g, '').includes(phoneDigits) && (titleNames(r.title || '', name) || !best[0])) { best = [url, 'matched by phone']; if (titleNames(r.title || '', name)) return; continue; }
      if (!best[0] && titleNames(r.title || '', name)) best = [url, 'matched by name, check it'];
    }
  });
  return best;
}

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
    const social = async (site, kind, urlKey, matchKey, queries) => {
      try {
        for (const q of queries) {
          const res = await os.search(key, q);
          await logCost(env, 'search', 1, 0.003);
          const [url, how] = firstSocial(res, kind, pd, l.name);
          if (url) { patch[urlKey] = url; patch[matchKey] = how; return; }
        }
        patch[urlKey] = null; patch[matchKey] = null;
      } catch (e) { errs.push(site + ': ' + e.message); }
    };
    const fbQueries = [l.phone ? `"${national}" site:facebook.com` : null, `"${l.name}" ${city} site:facebook.com`].filter(Boolean);
    const igQueries = [`"${l.name}" ${city} site:instagram.com`];
    const jobs = [photosJob];
    if (!l.facebook_url) jobs.push(social('facebook.com', 'fb', 'facebook_url', 'fb_match', fbQueries));
    if (!l.instagram_url) jobs.push(social('instagram.com', 'ig', 'instagram_url', 'ig_match', igQueries));
    await Promise.all(jobs);
    if (errs.length) patch.enrich_error = errs.join('; ');

    const [u] = await d.update('leads', `id=eq.${id}`, patch);
    return json(present(u));
  } catch (e) { return bad(e.message, 500); }
}
