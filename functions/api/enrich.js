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
    const patch = { enriched_at: new Date().toISOString() };
    const pd = digits(l.phone);

    // 1. photos of their work, from the listing itself
    try {
      const res = await os.photos(key, l.place_id, 15);
      const page = res[0] || {}; const list = Array.isArray(page) ? page : page.photos_data || [];
      patch.photos = list.map((p) => ({ src: p.photo_url_big || p.photo_url, source: 'google', date: p.photo_date || null })).filter((p) => p.src);
      await logCost(env, 'photos', patch.photos.length, patch.photos.length * 0.002);
    } catch (e) { patch.enrich_error = 'photos: ' + e.message; }

    // 2. socials: the phone number first, then name + city, on each network
    try {
      const city = l.city || ''; const qs = [];
      for (const site of ['facebook.com', 'instagram.com']) { if (l.phone) qs.push(`"${l.phone}" site:${site}`); qs.push(`"${l.name}" ${city} site:${site}`); }
      const res = await os.search(key, qs);
      const per = qs.map((_, i) => res[i]);
      const fb = firstSocial(per.filter((_, i) => qs[i].includes('facebook')), FB, pd, l.name);
      const ig = firstSocial(per.filter((_, i) => qs[i].includes('instagram')), IG, pd, l.name);
      patch.facebook_url = fb[0]; patch.fb_match = fb[1]; patch.instagram_url = ig[0]; patch.ig_match = ig[1];
      await logCost(env, 'search', qs.length, qs.length * 0.003);
    } catch (e) { patch.enrich_error = (patch.enrich_error ? patch.enrich_error + '; ' : '') + 'socials: ' + e.message; }

    // 3. best reviews for the site copy, and who replies as the owner
    try {
      const res = await os.reviews(key, l.place_id, 6);
      const page = res[0] || {}; const list = page.reviews_data || [];
      patch.best_reviews = list.filter((r) => r.review_text).map((r) => ({ text: String(r.review_text).trim(), by: r.author_title || null, stars: r.review_rating || null, owner_reply: !!r.owner_answer }));
      if (patch.best_reviews.length && !l.blurb) patch.blurb = patch.best_reviews[0].text.slice(0, 140);
      await logCost(env, 'reviews', list.length, list.length * 0.003);
    } catch (e) { patch.enrich_error = (patch.enrich_error ? patch.enrich_error + '; ' : '') + 'reviews: ' + e.message; }

    const [u] = await d.update('leads', `id=eq.${id}`, patch);
    return json(present(u));
  } catch (e) { return bad(e.message, 500); }
}
