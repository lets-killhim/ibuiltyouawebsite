import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { present } from '../_lib/leads.js';
import { askClaude, extractHtml } from '../_lib/claude.js';

const SYSTEM = `You build complete one-page websites for small local businesses that have none.
Output ONLY a single self-contained HTML document: inline CSS in a <style> tag, no external scripts, no frameworks, no comments. Mobile first, large readable type, generous spacing, one accent color that suits the trade.
Use the photos exactly as given, as <img src="..."> with loading="lazy"; never invent image URLs. Put a tap-to-call phone link (href="tel:...") in the header and in a closing call-to-action band.
Sections, in order: a hero with the business name and a short tagline you write from the category; services as short lines you infer from the category and name; a photo gallery; a brief about paragraph; a line with the Google rating and review count; contact with the address and phone.
Never use lorem ipsum, never invent facts: no made-up years in business, team names, prices, awards or testimonials. If something is unknown, leave it out.`;

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
    const presetDef = (s.presets || []).find((p) => p.name === preset) || (s.presets || [])[0] || { name: 'default', prompt: '' };
    const model = s.claude_model || 'claude-fable-5-1';
    await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), status: 'building', preset: presetDef.name, error: null, started_at: new Date().toISOString() } });

    const facts = {
      business: l.name, phone: l.phone, address: l.address, city: l.city, state: l.state,
      category: l.category, google_rating: l.rating, google_reviews: l.reviews,
      facebook: l.facebook_url || null, instagram: l.instagram_url || null,
      photos: (l.photos || []).slice(0, 12).map((p) => p.src), logo: l.logo || null,
    };
    const user = `Preset "${presetDef.name}": ${presetDef.prompt}\n\nThe business, from its Google Maps listing:\n${JSON.stringify(facts, null, 2)}\n\nReturn the HTML document now.`;
    const r = await askClaude(s.anthropic_key, { model, system: SYSTEM, user });
    const html = extractHtml(r.text);
    if (!/<html/i.test(html) || html.length < 500) throw new Error('Claude did not return a page');

    const prev = await d.select('sites', `lead_id=eq.${id}&select=version,token&order=version.desc&limit=1`);
    const version = prev.length ? (prev[0].version || 0) + 1 : 1;
    const token = prev.length && prev[0].token ? prev[0].token : Math.random().toString(36).slice(2, 12);
    await d.insert('sites', [{ lead_id: id, token, preset: presetDef.name, version, html, model: r.model, input_tokens: r.input_tokens, output_tokens: r.output_tokens }]);
    await logCost(env, `claude build (${r.model || model})`, r.input_tokens + r.output_tokens, buildCost(r.model || model, r.input_tokens, r.output_tokens));
    const url = `${new URL(request.url).origin}/s/${token}`;
    const [u] = await d.update('leads', `id=eq.${id}`, { site: { status: 'ready', preset: presetDef.name, token, url, version, built_at: new Date().toISOString(), error: null } });
    return json(present(u));
  } catch (e) {
    if (leadId) { try { const [l] = await d.select('leads', `id=eq.${leadId}`); await d.update('leads', `id=eq.${leadId}`, { site: { ...(l?.site || {}), status: l?.site?.token ? 'ready' : 'error', error: e.message } }); } catch { /* ignore */ } }
    return bad(e.message, 500);
  }
}
