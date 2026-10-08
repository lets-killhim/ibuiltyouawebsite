import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { os } from '../_lib/outscraper.js';
import { present, digits } from '../_lib/leads.js';

const FB = /^https?:\/\/(?:www\.|m\.)?facebook\.com\/([A-Za-z0-9.\-_]+)\/?/i;
const IG = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9.\-_]+)\/?/i;
const SKIP = new Set(['pages', 'people', 'search', 'groups', 'events', 'marketplace', 'public', 'login', 'explore', 'p', 'reel', 'reels', 'stories', 'hashtag', 'profile.php', 'sharer', 'share', 'accounts']);

function firstSocial(pages, rx, phoneDigits, name) {
  const toks = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2).slice(0, 3);
  let best = [null, null];
  for (let page of pages || []) {
    if (Array.isArray(page)) page = page[0];
    for (const r of (page && page.organic_results) || []) {
      const link = r.link || ''; const m = rx.exec(link);
      if (!m || SKIP.has(m[1].toLowerCase())) continue;
      const blob = `${r.title || ''} ${r.description || ''} ${link}`.toLowerCase();
      if (phoneDigits && blob.replace(/\D/g, '').includes(phoneDigits)) return [link, 'matched by phone'];
      if (!best[0] && toks.length && toks.filter((t) => blob.includes(t)).length >= Math.min(2, toks.length)) best = [link, 'matched by name, check it'];
    }
  }
  return best;
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
      const page = res[0] || {}; const list = Array.isArray(page) ? page : page.photos_data || page.photos || (page.photo_url ? res : []);
      patch.photos = list.map((p) => ({ src: p.photo_url_big || p.photo_url || p.url, source: 'google', date: p.photo_date || null })).filter((p) => p.src);
      if (!patch.photos.length && l.main_photo) patch.photos = [{ src: l.main_photo, source: 'google' }];
      return logCost(env, 'photos', patch.photos.length, patch.photos.length * 0.002);
    }).catch((e) => { errs.push('photos: ' + e.message); if (l.main_photo) patch.photos = [{ src: l.main_photo, source: 'google' }]; });

    // one query per network, each a small synchronous call: the phone number is the unique key
    const social = (site, rx, urlKey, matchKey) => {
      if (!l.phone) return Promise.resolve();
      return os.search(key, `"${l.phone}" site:${site}`).then((res) => {
        const [url, how] = firstSocial(res, rx, pd, l.name);
        patch[urlKey] = url; patch[matchKey] = how;
        return logCost(env, 'search', 1, 0.003);
      }).catch((e) => { errs.push(site + ': ' + e.message); });
    };
    await Promise.all([photosJob, social('facebook.com', FB, 'facebook_url', 'fb_match'), social('instagram.com', IG, 'instagram_url', 'ig_match')]);
    if (errs.length) patch.enrich_error = errs.join('; ');

    const [u] = await d.update('leads', `id=eq.${id}`, patch);
    return json(present(u));
  } catch (e) { return bad(e.message, 500); }
}
