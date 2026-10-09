import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { present } from '../_lib/leads.js';
import { askClaude, extractHtml } from '../_lib/claude.js';
import { mergePresets } from '../_lib/presets.js';

const SYSTEM = `You build complete one-page websites for real local businesses that have none. The page must look like a custom site from a boutique design studio, never like an AI template. Output ONLY one self-contained HTML document: all CSS in one <style> block, no frameworks, no comments, no markdown fences, nothing before <!doctype html>.

THE FACTS
You get a JSON object of facts from the business's Google Maps listing and up to 12 real photo URLs. Everything on the page comes from those facts. Never invent anything: no years in business, team names, prices, hours, licenses, awards, service areas beyond the city given, and no testimonials or review quotes. The only social proof is the star rating and review count, shown as a trust line. Infer four to six plain-English services from the category and the name only. If something is unknown, leave it out rather than guess.

PHOTOS
Use the photo URLs exactly as given, in <img> tags with loading="lazy" and short alt text; never make up an image URL and never use placeholders. The first photos are usually the strongest: put one in the hero as a full-bleed image under a color overlay that keeps the headline readable, and use the rest in a gallery and the about section. Use object-fit: cover with fixed aspect ratios so odd sizes look intentional. If a logo URL is given, use it in the header; otherwise set the name as a text logo.

DESIGN
Before writing any code, silently decide: a palette of four or five hex colors, two typefaces (load at most two Google Fonts with a single <link>), and the one signature element this page will be remembered by. Then build to that plan. The preset in the message gives the palette, typography, signature element and feeling for this trade; follow it.
Mobile first: design for a 375px phone, then adapt up with media queries; nothing may scroll horizontally; tap targets at least 44px. Large, confident display type in the hero, body line-height 1.6, a clear size hierarchy, generous and intentional whitespace with more room around the hero and the final call-to-action than between minor sections. Vary section layouts; if two sections share a layout, change one. Real hover and focus states, accessible contrast, subtle texture is welcome in one section. Motion: one CSS entrance animation on the hero plus the signature element, both inside a prefers-reduced-motion check; nothing else moves. A small inline <script> without libraries is allowed only when the signature element needs scroll or interaction; the page must read fine with scripting off.

HARD BANS, no exceptions
No purple, indigo or blue-violet gradients and no gradient text. No emoji as icons; use one consistent inline-SVG line-icon style or no icons at all. No three-column icon feature grid. No carousels or sliders. No "Welcome to", "Look no further", "We've got you covered", "Your one-stop shop", "trusted partner", "elevate", "seamless", "unlock". No lorem ipsum. No cream-background-with-terracotta-serif default look and no black-with-neon-green look unless the preset asks for it.

COPY
Write like a competent local person, not a marketer: short sentences, specific over clever, at most one exclamation point on the whole page. The headline states what a customer gets, in plain confident words. Every button says what happens: "Call <name>", "Get a free quote", never "Submit" or "Learn more". Mention the city naturally a few times. If an owner name is given, use it once in the about section and on the call button.

STRUCTURE, in order
1. Sticky header: logo or business name, phone as a tap-to-call button, always visible.
2. Hero: headline, one-line sub-headline, the trust line (rating, review count, city), one primary call-to-action, and the signature element from the preset.
3. Services: each with a one-line description of the problem it solves, in a layout that fits the design direction.
4. Gallery: the remaining photos.
5. About: a short paragraph built only from the facts given, with one photo.
6. Quote form: name, phone, short message, and a button that says what happens; <form method="post" action="#">.
7. Final call-to-action band: big, phone first, tap-to-call.
8. Footer: business name, phone, address, city, and links to the Facebook or Instagram pages if given.

TECHNICAL
Every phone number is an <a href="tel:..."> link. <title> is "<business> | <category> in <city>", plus a meta description and the viewport meta. Favicon: an inline SVG data URI with the business's initial in the accent color. Semantic HTML, lang="en", alt text everywhere. No external resources except the photos and the one Google Fonts link.`;

// Dollars per million tokens, input then output, from the Claude pricing page. Matched by family so a
// pinned snapshot name still lands on the right row; unknown names assume the priciest.
const PRICE = [
  [/fable|mythos/, 10, 50],
  [/opus-5-5/, 4, 20],
  [/opus-4-[5-8]|opus-5/, 5, 25],
  [/opus/, 15, 75],
  [/sonnet-5/, 2, 10],
  [/sonnet/, 3, 15],
  [/haiku-5/, 0.1, 0.5],
  [/haiku/, 1, 5],
];
export function buildCost(model, input, output) {
  const [, i, o] = PRICE.find(([re]) => re.test(model || '')) || [null, 10, 50];
  return (input * i + output * o) / 1e6;
}

export async function onRequestPost({ request, env }) {
  const d = db(env);
  let leadId = null;
  try {
    const { id, preset } = await request.json();
    leadId = id;
    const [l] = await d.select('leads', `id=eq.${id}`);
    if (!l) return bad('not found', 404);
    const s = await getSettings(env);
    if (!s.anthropic_key) return bad('Add your Claude API key in settings first');
    const presets = mergePresets(s.presets);
    const presetDef = presets.find((p) => p.name === preset) || presets[0];
    const model = s.claude_model || 'claude-fable-5-1';
    await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), status: 'building', preset: presetDef.name, error: null, started_at: new Date().toISOString() } });

    const facts = {
      business: l.name, owner: l.owner || null, phone: l.phone, address: l.address, city: l.city, state: l.state,
      category: l.category, google_rating: l.rating, google_reviews: l.reviews,
      facebook: l.facebook_url || null, instagram: l.instagram_url || null,
      photos: (l.photos || []).slice(0, 12).map((p) => p.src), logo: l.logo || null,
    };
    const user = `Preset "${presetDef.name}". ${presetDef.prompt}\n\nThe business, from its Google Maps listing:\n${JSON.stringify(facts, null, 2)}\n\nReturn the HTML document now.`;
    const r = await askClaude(s.anthropic_key, { model, system: SYSTEM, user });
    const html = extractHtml(r.text);
    if (!/<html/i.test(html) || html.length < 500) throw new Error('Claude did not return a page');

    const prev = await d.select('sites', `lead_id=eq.${id}&select=version,token&order=version.desc&limit=1`);
    const version = prev.length ? (prev[0].version || 0) + 1 : 1;
    const token = prev.length && prev[0].token ? prev[0].token : Math.random().toString(36).slice(2, 12);
    await d.insert('sites', [{ lead_id: id, token, preset: presetDef.name, version, html, model: r.model, input_tokens: r.input_tokens, output_tokens: r.output_tokens }]);
    await logCost(env, `claude build (${r.model || model})`, r.input_tokens + r.output_tokens, buildCost(r.model || model, r.input_tokens, r.output_tokens));
    const url = `${new URL(request.url).origin}/s/${token}`;
    const [u] = await d.update('leads', `id=eq.${id}`, { site: { status: 'ready', preset: presetDef.name, token, url, version, model: r.model || model, built_at: new Date().toISOString(), error: null } });
    return json(present(u));
  } catch (e) {
    if (leadId) { try { const [l] = await d.select('leads', `id=eq.${leadId}`); await d.update('leads', `id=eq.${leadId}`, { site: { ...(l?.site || {}), status: l?.site?.token ? 'ready' : 'error', error: e.message } }); } catch { /* ignore */ } }
    return bad(e.message, 500);
  }
}
