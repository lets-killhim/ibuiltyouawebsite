// Turning Outscraper's Maps rows into leads: the same rules as the Python prospector.
const SOCIAL = ['facebook.com', 'instagram.com', 'linktr.ee', 'yelp.com', 'nextdoor.com', 'business.site'];

export const digits = (phone) => { const d = String(phone || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : d; };
export const siteOf = (row) => String(row.site || row.website || row.web_site || row.domain || '').trim();
export const hasSite = (row) => { const s = siteOf(row).toLowerCase(); return s !== '' && !SOCIAL.some((x) => s.includes(x)); };

export function fmtHours(wh) {
  if (!wh || typeof wh !== 'object') return '';
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const spans = days.filter((d) => d in wh).map((d) => [d.slice(0, 3), wh[d]]);
  const out = []; let run = [];
  for (const [d, h] of [...spans, [null, null]]) {
    if (run.length && h !== run[run.length - 1][1]) { out.push((run.length > 1 ? `${run[0][0]} to ${run[run.length - 1][0]}` : run[0][0]) + ' ' + run[run.length - 1][1]); run = []; }
    if (d) run.push([d, h]);
  }
  return out.join(', ');
}

export function score(row) {
  let s = 0; const reviews = +row.reviews || 0; const rating = +row.rating || 0;
  if (reviews >= 15) s += 30; else if (reviews >= 5) s += 15;
  if (rating >= 4) s += 15;
  if (row.phone) s += 25;
  if ((+row.photos_count || 0) >= 5) s += 10;
  if (row.verified) s += 10;
  if (row.owner_title) s += 5;
  return { score: s, tier: s >= 70 ? 'A' : s >= 45 ? 'B' : 'C' };
}

export function toLead(row, scanId) {
  const { score: sc, tier } = score(row);
  const placeId = row.place_id || row.google_id;
  return {
    place_id: placeId, scan_id: scanId,
    name: row.name, phone: row.phone || null, phone_digits: digits(row.phone),
    address: row.full_address || null, city: row.city || null, state: row.state || null, zip: row.postal_code || null,
    rating: row.rating ?? null, reviews: +row.reviews || 0, category: row.category || row.type || null,
    hours: '', owner: null, site_seen: siteOf(row) || null,
    maps_url: row.location_link || (placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null),
    main_photo: row.photo || null, logo: row.logo || null,
    score: sc, tier, status: 'new',
  };
}

// The shape the pages consume.
export function present(r) {
  return {
    id: r.id, name: r.name, phone: r.phone, email: r.email, reviews: r.reviews, rating: r.rating, category: r.category,
    address: r.address, city: r.city, state: r.state, hours: r.hours || '', owner: r.owner || '', blurb: r.blurb || '',
    links: { google: r.maps_url, facebook: r.facebook_url, instagram: r.instagram_url },
    matches: { facebook: r.fb_match, instagram: r.ig_match },
    logo: r.logo, photos: r.photos || [], best_reviews: r.best_reviews || [],
    score: r.score, tier: r.tier, status: r.status, warmth: r.warmth || 0, meeting: r.meeting, notes: r.notes || '',
    site: r.site || null, live: r.live || [0, 0, 0, 0], plan: r.plan, pay: r.pay, domain: r.domain, form_email: r.form_email,
    enriched_at: r.enriched_at, enrich_error: r.enrich_error || null, main_photo: r.main_photo, created_at: r.created_at,
  };
}
