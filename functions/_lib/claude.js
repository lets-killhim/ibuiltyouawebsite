// One call to the Claude API, streamed so a long page can't be cut off by an idle connection.
// Returns { text, input_tokens, output_tokens, model, stop_reason }.
export async function askClaude(key, { model, system, user, max_tokens = 32000 }) {
  const call = (maxTokens) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }], stream: true }),
  });
  let res = await call(max_tokens);
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    // a model with a smaller output window rejects the limit; try once at half
    if (res.status === 400 && /max_tokens/i.test(msg) && max_tokens > 16000) res = await call(16000);
    if (!res.ok) throw new Error(`Claude ${res.status}: ${msg.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', input_tokens = 0, output_tokens = 0, stop_reason = null, used = model;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.type === 'message_start') { input_tokens = ev.message?.usage?.input_tokens || 0; used = ev.message?.model || model; }
      else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
      else if (ev.type === 'message_delta') { output_tokens = ev.usage?.output_tokens || output_tokens; stop_reason = ev.delta?.stop_reason || stop_reason; }
      else if (ev.type === 'error') throw new Error('Claude: ' + ((ev.error && ev.error.message) || JSON.stringify(ev.error)).slice(0, 300));
    }
  }
  return { text, input_tokens, output_tokens, model: used, stop_reason };
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

// Everything in the reply that is not the page: the design spec, the placeholder list.
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
