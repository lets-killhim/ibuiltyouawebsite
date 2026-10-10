// One call to the Claude API. Returns { text, input_tokens, output_tokens, model, stop_reason }.
//
// Not streamed on purpose: parsing tens of thousands of stream events costs more CPU than a Pages
// Function gets on the free plan, while one JSON reply costs almost none. Anthropic holds a non-streamed
// request open for up to ten minutes, which covers a 20k-token page.
//
// Anthropic also counts max_tokens against the per-minute output limit the moment a request starts, so the
// cap stays modest (several builds can run side by side) and a 429/529 is retried with backoff for a few
// minutes instead of failing the build.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errMessage = (status, raw) => { try { const j = JSON.parse(raw); return `Claude ${status}: ${j.error?.message || raw.slice(0, 200)}`; } catch { return `Claude ${status}: ${raw.slice(0, 200)}`; } };

export async function askClaude(key, { model, system, user, max_tokens = 20000 }) {
  const call = (maxTokens) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  let res = null, waited = 0, maxTokens = max_tokens;
  for (let attempt = 0; attempt < 12; attempt++) {
    res = await call(maxTokens);
    if (res.ok) break;
    const raw = await res.text().catch(() => '');
    if (res.status === 400 && /max_tokens/i.test(raw) && maxTokens > 16000) { maxTokens = 16000; continue; }
    const busy = res.status === 429 || res.status === 529 || res.status === 503;
    if (!busy || waited > 6 * 60 * 1000) throw new Error(errMessage(res.status, raw));
    const hinted = Number(res.headers.get('retry-after')) * 1000;
    const wait = Math.min(90000, Math.max(hinted || 0, 15000 * (attempt + 1)));
    waited += wait;
    await sleep(wait);
  }
  if (!res || !res.ok) throw new Error('Claude is busy, try again in a minute');
  const data = await res.json().catch(() => ({}));
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return { text, input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0, model: data.model || model, stop_reason: data.stop_reason || null };
}

const DOC = /<!doctype html|<html[\s>]/i;

// Pull the complete HTML document out of a reply that may also carry a design spec before it and notes after it.
export function extractHtml(text) {
  const fences = [...text.matchAll(/```[a-z]*[ \t]*\n?([\s\S]*?)```/gi)].map((m) => m[1]);
  let html = fences.find((f) => DOC.test(f)) || text;
  const i = html.search(DOC);
  if (i > 0) html = html.slice(i);
  const j = html.lastIndexOf('</html>');
  if (j > 0) html = html.slice(0, j + 7);
  return html.trim();
}

// Everything in the reply that is not the page: the design spec, the missing-from-the-brief list.
export function notesAround(text, html) {
  if (!html) return text.trim();
  let out = null;
  for (const m of text.matchAll(/```[a-z]*[ \t]*\n?([\s\S]*?)```/gi)) {
    if (DOC.test(m[1])) { out = text.slice(0, m.index) + text.slice(m.index + m[0].length); break; }
  }
  if (out === null) {
    const i = text.search(DOC);
    const j = i >= 0 ? text.indexOf('</html>', i) : -1;
    out = i >= 0 ? text.slice(0, i) + (j > 0 ? text.slice(j + 7) : '') : text;
  }
  return out.replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000);
}
