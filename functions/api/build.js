import { db, json, bad, getSettings, logCost } from '../_lib/db.js';
import { present } from '../_lib/leads.js';
import { startClaudeStream, extractHtml, notesAround, applyEdits } from '../_lib/claude.js';
import { withDefaults } from './settings.js';

// The preset's prompt IS the system prompt. If it carries a CLIENT BRIEF block (a fenced block after a
// "CLIENT BRIEF" heading), the app rewrites that block from the lead; otherwise the brief is appended.
export function briefText(l, s, inputs = {}) {
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
    `menu / hours / specials: ${na}; follow the prompt's rules for missing information`,
    `photos:${photos.length ? '\n' + photos.join('\n') + '\n  no before/after pairs identified' : ' none supplied'}`,
    `existing_brand (logo, colors, fonts): ${l.logo ? 'logo: ' + l.logo : 'none'}`,
    `differentiators (what they actually do differently): ${na}`,
    `phone / email / address: ${l.phone || na} / ${l.email || na} / ${l.address || na}`,
    `social: ${[l.facebook_url && 'Facebook ' + l.facebook_url, l.instagram_url && 'Instagram ' + l.instagram_url].filter(Boolean).join(', ') || 'none'}`,
    `form_endpoint: ${inputs.form_endpoint || 'placeholder'}`,
    `form_access_key: none needed; post plain FormData (or JSON) to form_endpoint with a fetch and Accept: application/json, and keep the no-JS <form method="post" action="form_endpoint"> fallback`,
    `client_email: handled by the endpoint`,
    `direction: auto`,
    `previous_direction: ${l.site?.direction || 'none'}`,
  ];
  if (inputs.palette) lines.push(`color_palette: ${inputs.palette}; build the palette from these materials and colors`);
  if (inputs.color) lines.push(`brand_color: ${inputs.color}; use it as the accent, derive the rest of the palette to suit it`);
  if (inputs.notes) lines.push(`extra_notes_from_the_designer: ${inputs.notes.replace(/\s+/g, ' ').trim()}`);
  return lines.join('\n');
}

// Chosen library components ride along after the prompt, to be reused verbatim where they fit.
export function withComponents(prompt, s, names = []) {
  const lib = (s.components || []).filter((c) => names.includes(c.name));
  if (!lib.length) return prompt;
  const F = '```';
  const block = lib.map((c) => `### ${c.name}${c.kind ? ` (${c.kind})` : ''}${c.notes ? `\n${c.notes}` : ''}\n${F}\n${c.code}\n${F}`).join('\n\n');
  return prompt.trimEnd() + `\n\n## COMPONENT LIBRARY\n\nThe designer supplied these finished components. Use them where they fit the section they are made for, copying the code faithfully and adapting only colors, copy, photos and sizes to this site and its palette. Do not redesign them from scratch.\n\n${block}\n`;
}

// The system prompt in two blocks: a stable prefix (design core + preset + chosen components) that the
// API caches across builds, and the per-lead brief. The preset's own CLIENT BRIEF block is replaced.
export function systemFor(prompt, l, s, inputs) {
  const core = (s.design_core || '').trim();
  const heads = [...prompt.matchAll(/^#+\s*CLIENT BRIEF[^\n]*$/gim)];
  const body = heads.length ? prompt.slice(0, heads[heads.length - 1].index).trimEnd() : prompt.trimEnd();
  // Three blocks: the core (shared by every preset) and the preset + components each cached for an hour,
  // then the per-lead brief. Switching presets keeps the core warm; a cache read on Fable costs 2.5%.
  const presetBlock = withComponents(body, s, inputs?.components || []);
  const brief = '## CLIENT BRIEF\n\n```\n' + briefText(l, s, inputs) + '\n```';
  const blocks = [];
  if (core) blocks.push({ type: 'text', text: core + '\n\n', cache_control: { type: 'ephemeral', ttl: '1h' } });
  blocks.push({ type: 'text', text: presetBlock, cache_control: { type: 'ephemeral', ttl: '1h' } });
  blocks.push({ type: 'text', text: '\n\n' + brief });
  return blocks;
}

const EDIT_SYSTEM = `You are editing an existing one-page website for a small local business. You will be given the complete current HTML and one change request from the designer who built it.
Make exactly the change requested and nothing else. Never invent facts about the business.
Reply ONLY with one or more patch blocks, each in this exact format:
<<<<<<< SEARCH
(a verbatim excerpt of the current file: the smallest run of whole lines that must change, copied character for character, and unique in the file)
=======
(the replacement for that excerpt)
>>>>>>> REPLACE
Rules: copy SEARCH text exactly as it appears, including indentation; keep each SEARCH under 40 lines; to add something, SEARCH for the lines it goes next to and include them unchanged in the replacement; never output the whole file; no commentary between blocks. After the last block, one line starting with "Changed:" summarizing what you did.`;

export const USER = 'Build the site for the CLIENT BRIEF above. Output in this order: the short design spec (name the direction letter), then the complete single-file index.html inside one ```html code block, then the short list titled "Missing from the brief". Nothing else. Write the code exactly once: do the self-critique in your head before the code block and never print a second or revised copy of the page.';


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
export function buildCost(model, input, output, cacheRead = 0, cacheWrite = 0) {
  const [, i, o] = PRICE.find(([re]) => re.test(model || '')) || [null, 10, 50];
  // one-hour cache writes bill at 2x the input price; reads at 2.5% on Fable, 5% on Opus/Sonnet 5.5, 10% otherwise
  const read = /fable|mythos/.test(model || '') ? 0.025 : /opus-5-5|sonnet-5-5/.test(model || '') ? 0.05 : 0.1;
  return (input * i + cacheRead * i * read + cacheWrite * i * 2 + output * o) / 1e6;
}

// Step 1 of a build: open the Claude stream and pass it straight through to the browser. The browser
// assembles the page (parsing tens of thousands of stream events costs more CPU than a Pages Function gets)
// and sends the finished text to the PUT below, which stores it.
export async function onRequestPost({ request, env }) {
  const d = db(env);
  let leadId = null;
  try {
    const body = await request.json();
    const { id, preset, notes = '', palette = '', color = '' } = body;
    leadId = id;
    const [l] = await d.select('leads', `id=eq.${id}`);
    if (!l) return bad('not found', 404);
    const s = withDefaults(await getSettings(env));
    if (!s.anthropic_key) return bad('Add your Claude API key in settings first');
    const inputs = { notes: String(notes).slice(0, 2000), palette: String(palette).slice(0, 200), color: /^#[0-9a-f]{6}$/i.test(color) ? color : '', components: Array.isArray(body.components) ? body.components.map(String).slice(0, 12) : [] };
    // every lead gets a form endpoint on this app, live from the first build
    if (!l.site?.form_token) l.site = { ...(l.site || {}), form_token: Math.random().toString(36).slice(2, 14) };
    inputs.form_endpoint = `${new URL(request.url).origin}/f/${l.site.form_token}`;
    const edit = String(body.edit || '').trim().slice(0, 4000);
    const presets = s.presets;
    const presetDef = presets.find((p) => p.name === preset) || presets[0];
    const model = s.claude_model || 'claude-fable-5-1';
    if (edit) {
      // an edit: feed the current page back with the request, same token, next version
      const prev = await d.select('sites', `lead_id=eq.${id}&select=html&order=version.desc&limit=1`);
      if (!prev.length || !prev[0].html) return bad('Build the site first');
      await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), status: 'building', error: null, started_at: new Date().toISOString(), editing: edit } });
      const user = 'Current page:\n```html\n' + prev[0].html + '\n```\n\nChange requested: ' + edit;
      const upstream = await startClaudeStream(s.anthropic_key, { model, effort: s.claude_edit_effort || 'low', system: EDIT_SYSTEM, user, max_tokens: 16000 });
      return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
    }
    await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), status: 'building', preset: presetDef.name, error: null, started_at: new Date().toISOString(), inputs: { notes: inputs.notes, palette: inputs.palette, color: inputs.color, components: inputs.components }, editing: null } });
    const upstream = await startClaudeStream(s.anthropic_key, { model, effort: s.claude_effort || 'medium', system: systemFor(presetDef.prompt, l, s, inputs), user: USER });
    return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Build-Preset': presetDef.name } });
  } catch (e) {
    await fail(d, leadId, e.message);
    return bad(e.message, 500);
  }
}

// Step 2: the browser hands back what Claude wrote; store it, or record why it failed.
export async function onRequestPut({ request, env }) {
  const d = db(env);
  let leadId = null;
  try {
    const { id, preset, text, model, input_tokens = 0, output_tokens = 0, cache_read = 0, cache_write = 0, stop_reason, error, edit, revert, activate_form } = await request.json();
    leadId = id;
    const [l] = await d.select('leads', `id=eq.${id}`);
    if (!l) return bad('not found', 404);
    if (error) { await fail(d, id, error); const [u] = await d.select('leads', `id=eq.${id}`); return json(present(u)); }
    if (activate_form) {
      // point an older site's form at this app's endpoint, as a new version at the same link
      const rows = await d.select('sites', `lead_id=eq.${id}&select=version,token,html,preset,model&order=version.desc&limit=1`);
      if (!rows.length) return bad('Build the site first');
      const form_token = l.site?.form_token || Math.random().toString(36).slice(2, 14);
      const endpoint = `${new URL(request.url).origin}/f/${form_token}`;
      let html = rows[0].html;
      html = html.replace(/\{\{form_endpoint\}\}|https:\/\/api\.web3forms\.com\/submit|(endpoint|formEndpoint)(\s*:\s*)"(placeholder|)"/g, (m, k, sep) => (k ? `${k}${sep}"${endpoint}"` : endpoint));
      html = html.replace(/action="(#|placeholder|\{\{form_endpoint\}\})"/g, `action="${endpoint}"`);
      const version = (rows[0].version || 0) + 1;
      await d.insert('sites', [{ lead_id: id, token: rows[0].token, preset: rows[0].preset, version, html, model: rows[0].model, input_tokens: 0, output_tokens: 0 }]);
      const [u] = await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), form_token, version, status: 'ready', built_at: new Date().toISOString() } });
      return json(present(u));
    }
    if (revert) {
      // undo the last edit: republish the version before it as a new version
      const rows = await d.select('sites', `lead_id=eq.${id}&select=version,token,html,preset,model&order=version.desc&limit=2`);
      if (rows.length < 2) return bad('Nothing to undo');
      const back = rows[1], version = (rows[0].version || 0) + 1;
      await d.insert('sites', [{ lead_id: id, token: rows[0].token, preset: back.preset, version, html: back.html, model: back.model, input_tokens: 0, output_tokens: 0 }]);
      const edits = [...(l.site?.edits || []), { text: '(undo)', at: new Date().toISOString(), version }].slice(-30);
      const [u] = await d.update('leads', `id=eq.${id}`, { site: { ...(l.site || {}), status: 'ready', version, edits, editing: null, built_at: new Date().toISOString(), error: null } });
      return json(present(u));
    }
    let html, notes;
    if (edit) {
      const cur = await d.select('sites', `lead_id=eq.${id}&select=html&order=version.desc&limit=1`);
      const full = extractHtml(text || '');
      if (/<html/i.test(full) && full.length > 500 && /<\/html>$/i.test(full)) html = full; // it rewrote the page anyway
      else {
        const r = applyEdits(cur[0]?.html || '', text || '');
        if (!r.applied) throw new Error(`could not apply that edit${r.failed.length ? ` (no match for "${r.failed[0]}")` : ''}; try describing the change differently`);
        html = r.html;
        if (r.failed.length) notes = `Changed: partially applied, ${r.failed.length} patch(es) did not match`;
      }
    } else html = extractHtml(text || '');
    const complete = /<html/i.test(html) && html.length > 500 && /<\/html>$/i.test(html);
    if (stop_reason === 'max_tokens' && !complete) {
      // say what was written so a runaway output can be diagnosed from the error itself
      const t = text || '';
      const starts = (t.match(/<!doctype html|<html[\s>]/gi) || []).length, fences = (t.match(/```/g) || []).length;
      throw new Error(`ran past the output limit at ${output_tokens} tokens without finishing: ${Math.round(t.length / 1000)}k chars, ${starts} page start(s), ${fences} fence marks; ends with "…${t.slice(-240).replace(/\s+/g, ' ')}"`);
    }
    if (!complete) throw new Error('Claude did not return a complete page');
    notes = notes || (edit ? ((/^Changed:.*$/im.exec(text || '') || [''])[0]) : notesAround(text, html));
    const direction = (/[Dd]irection[^\n]{0,40}?\b([A-F])\b/.exec(notes) || [])[1] || null;

    const prev = await d.select('sites', `lead_id=eq.${id}&select=version,token&order=version.desc&limit=1`);
    const version = prev.length ? (prev[0].version || 0) + 1 : 1;
    const token = prev.length && prev[0].token ? prev[0].token : Math.random().toString(36).slice(2, 12);
    await d.insert('sites', [{ lead_id: id, token, preset, version, html, model, input_tokens, output_tokens }]);
    await logCost(env, `claude ${edit ? 'edit' : 'build'} (${model})`, input_tokens + cache_read + cache_write + output_tokens, buildCost(model, input_tokens, output_tokens, cache_read, cache_write));
    const url = `${new URL(request.url).origin}/s/${token}`;
    const edits = edit ? [...(l.site?.edits || []), { text: edit, at: new Date().toISOString(), version, summary: (/^Changed:\s*(.+)$/im.exec(notes) || [])[1] || '' }].slice(-30) : (l.site?.edits || []);
    const [u] = await d.update('leads', `id=eq.${id}`, { site: { status: 'ready', preset: edit ? (l.site?.preset || preset) : preset, token, url, version, model, direction: edit ? (l.site?.direction || direction) : direction, inputs: l.site?.inputs || null, sent: l.site?.sent || [], form_token: l.site?.form_token || null, book_token: l.site?.book_token || null, submissions: l.site?.submissions || [], edits, editing: null, built_at: new Date().toISOString(), error: null } });
    return json(present(u));
  } catch (e) {
    await fail(d, leadId, e.message);
    return bad(e.message, 500);
  }
}

async function fail(d, id, message) {
  if (!id) return;
  try { const [l] = await d.select('leads', `id=eq.${id}`); await d.update('leads', `id=eq.${id}`, { site: { ...(l?.site || {}), status: l?.site?.token ? 'ready' : 'error', error: message } }); } catch { /* ignore */ }
}
