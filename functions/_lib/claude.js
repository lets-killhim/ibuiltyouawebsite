// One call to the Claude API. Returns { text, input_tokens, output_tokens, model }.
export async function askClaude(key, { model, system, user, max_tokens = 16000 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(data.error && data.error.message) || JSON.stringify(data).slice(0, 200)}`);
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return { text, input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0, model: data.model || model };
}

// Pull a complete HTML document out of a reply, with or without code fences.
export function extractHtml(text) {
  const fence = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  let html = fence ? fence[1] : text;
  const i = html.search(/<!doctype html|<html/i);
  if (i > 0) html = html.slice(i);
  return html.trim();
}
