import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { present } from '../_lib/leads.js';
import { askClaude, extractHtml, notesAround } from '../_lib/claude.js';
import { presetsOf } from './settings.js';

// The preset's prompt IS the system prompt. If it carries a CLIENT BRIEF block (a fenced block after a
// "CLIENT BRIEF" heading), the app rewrites that block from the lead; otherwise the brief is appended.
export function brief(l, s) {
  const na = 'not provided';
  const photos = (l.photos || []).slice(0, 14).map((p, i) => `  - ${p.src}${i === 0 ? ' (the listing\'s main photo; subject not described)' : ' (subject not described)'}`);
  const where = [l.city, l.state].filter(Boolean).join(', ');
  const lines = [
    `business_name: ${l.name}`,
    `city / service_area: ${where || na} — ${l.city ? l.city + ' and nearby' : na}`,
    `years_in_business: ${na}`,
    `owner_name / team: ${l.owner || na}`,
    `services (ranked by priority/profit): ${na}; the Google category is "${l.category || 'unknown'}". Infer a plausible general set from the category and the name only, nothing specific`,
    `price_tier: ${na}; judge from the name, category and photos`,
    `typical_project_ranges: ${na}`,
    `typical_timelines: ${na}`,
    `license / insurance / certifications: ${na}`,
    `google_rating / review_count: ${l.rating != null ? l.rating : na} / ${l.reviews != null ? l.reviews : na}`,
    `testimonials: none supplied; omit the section`,
    `photos:${photos.length ? '\n' + photos.join('\n') + '\n  no before/after pairs identified' : ' none supplied'}`,
    `existing_brand (logo, colors, fonts): ${l.logo ? 'logo: ' + l.logo : 'none'}`,
    `differentiators (what they actually do differently): ${na}`,
    `primary_cta: book consultation`,
    `phone / email / address: ${l.phone || na} / ${l.email || na} / ${l.address || na}`,
    `social: ${[l.facebook_url && 'Facebook ' + l.facebook_url, l.instagram_url && 'Instagram ' + l.instagram_url].filter(Boolean).join(', ') || 'none'}`,
    `booking_mode: request`,
    `calcom_link: placeholder`,
    `form_endpoint: ${s.form_endpoint || 'placeholder'}`,
    `form_access_key: ${s.form_access_key || 'placeholder'}`,
    `client_email: ${l.email || 'placeholder'}`,
    `closed_days: Sat, Sun`,
    `time_slots: Morning 8–11am, Midday 11am–2pm, Afternoon 2–5pm`,
    `direction: auto`,
    `previous_direction: ${l.site?.direction || 'none'}`,
    `stack: single-file HTML`,
    `pages: single long-scroll homepage`,
  ];
  return lines.join('\n');
}

export function systemFor(prompt, l, s) {
  const filled = '```\n' + brief(l, s) + '\n```';
  // the brief is the fenced block under the last "CLIENT BRIEF" heading; mentions of the brief elsewhere stay
  const heads = [...prompt.matchAll(/^#+\s*CLIENT BRIEF[^\n]*$/gim)];
  if (heads.length) {
    const h = heads[heads.length - 1];
    const open = prompt.indexOf('```', h.index + h[0].length);
    const close = open >= 0 ? prompt.indexOf('```', prompt.indexOf('\n', open) + 1) : -1;
    if (open >= 0 && close >= 0) return prompt.slice(0, open) + filled + prompt.slice(close + 3);
    return prompt.slice(0, h.index + h[0].length) + '\n\n' + filled + '\n';
  }
  return prompt.trimEnd() + '\n\n## CLIENT BRIEF\n\n' + filled + '\n';
}

const USER = 'Build the site for the CLIENT BRIEF above. Output in this order: the short design spec (name the direction letter), then the complete single-file index.html inside one ```html code block, then the list of every [[PLACEHOLDER]] the client needs to fill. Nothing else.';


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
    const presets = presetsOf(s);
    const presetDef = presets.find((p) => p.name === preset) || presets[0];
    const model = s.claude_model || 'claude-fable-5-1';
    await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), status: 'building', preset: presetDef.name, error: null, started_at: new Date().toISOString() } });

    const r = await askClaude(s.anthropic_key, { model, system: systemFor(presetDef.prompt, l, s), user: USER });
    if (r.stop_reason === 'max_tokens') throw new Error(`the page ran past the output limit (${r.output_tokens} tokens) and would be cut off; build again`);
    const html = extractHtml(r.text);
    if (!/<html/i.test(html) || html.length < 500) throw new Error('Claude did not return a page');
    const notes = notesAround(r.text, html);
    const direction = (/[Dd]irection[^\n]{0,40}?\b([A-F])\b/.exec(notes) || [])[1] || null;

    const prev = await d.select('sites', `lead_id=eq.${id}&select=version,token&order=version.desc&limit=1`);
    const version = prev.length ? (prev[0].version || 0) + 1 : 1;
    const token = prev.length && prev[0].token ? prev[0].token : Math.random().toString(36).slice(2, 12);
    await d.insert('sites', [{ lead_id: id, token, preset: presetDef.name, version, html, model: r.model, input_tokens: r.input_tokens, output_tokens: r.output_tokens }]);
    await logCost(env, `claude build (${r.model || model})`, r.input_tokens + r.output_tokens, buildCost(r.model || model, r.input_tokens, r.output_tokens));
    const url = `${new URL(request.url).origin}/s/${token}`;
    const [u] = await d.update('leads', `id=eq.${id}`, { site: { status: 'ready', preset: presetDef.name, token, url, version, model: r.model || model, notes, direction, built_at: new Date().toISOString(), error: null } });
    return json(present(u));
  } catch (e) {
    if (leadId) { try { const [l] = await d.select('leads', `id=eq.${leadId}`); await d.update('leads', `id=eq.${leadId}`, { site: { ...(l?.site || {}), status: l?.site?.token ? 'ready' : 'error', error: e.message } }); } catch { /* ignore */ } }
    return bad(e.message, 500);
  }
}
