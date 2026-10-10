// Thin client for the server functions under /api. Every call returns JSON or throws.
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const text = await res.text();
  let data = null;
  // a non-JSON body is an edge error page (worker killed, gateway timeout): say that instead of showing it
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: `the server cut the request off (${res.status}); try again` }; }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || res.statusText);
  return data;
}

export const api = {
  login: (password) => call('POST', '/api/login', { password }),
  logout: () => call('POST', '/api/logout'),
  summary: () => call('GET', '/api/summary'),
  settings: () => call('GET', '/api/settings'),
  saveSettings: (patch) => call('PUT', '/api/settings', patch),
  startScan: (niche, where, mode) => call('POST', '/api/scan', { niche, where, mode }),
  scanStatus: (id) => call('GET', `/api/scan?id=${encodeURIComponent(id)}`),
  leads: (status) => call('GET', `/api/leads${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  patchLead: (id, patch) => call('PATCH', `/api/leads?id=${encodeURIComponent(id)}`, patch),
  enrich: (id) => call('POST', '/api/enrich', { id }),
  // A build streams Claude's reply through to this tab; the tab assembles it and hands it back to be saved.
  // onProgress(chars) fires as text arrives. Resolves with the updated lead.
  build: async (id, preset, onProgress) => {
    const res = await fetch('/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, preset }), credentials: 'same-origin' });
    if (!res.ok || !(res.headers.get('Content-Type') || '').includes('event-stream')) {
      const text = await res.text(); let data = null;
      try { data = JSON.parse(text); } catch { data = { error: `the server cut the request off (${res.status}); try again` }; }
      throw new ApiError(res.status, data.error || res.statusText);
    }
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf = '', text = '', model = null, input_tokens = 0, output_tokens = 0, stop_reason = null;
    try {
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
          if (ev.type === 'message_start') { model = ev.message?.model || null; input_tokens = ev.message?.usage?.input_tokens || 0; }
          else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text += ev.delta.text; if (onProgress) onProgress(text.length); }
          else if (ev.type === 'message_delta') { output_tokens = ev.usage?.output_tokens || output_tokens; stop_reason = ev.delta?.stop_reason || stop_reason; }
          else if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'Claude stream error');
        }
      }
      if (!stop_reason) throw new Error('the connection dropped before the page was finished; build again');
    } catch (e) {
      await call('PUT', '/api/build', { id, error: e.message }).catch(() => {});
      throw e;
    }
    return call('PUT', '/api/build', { id, preset, text, model, input_tokens, output_tokens, stop_reason });
  },
  diag: (niche, town, check) => call('POST', '/api/diag', { niche, town, check }),
  clear: (status) => call('POST', '/api/clear', { status }),
  upload: async (leadId, file) => {
    const res = await fetch(`/api/upload?id=${encodeURIComponent(leadId)}&name=${encodeURIComponent(file.name)}`, {
      method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' }, credentials: 'same-origin',
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.error || res.statusText);
    return data;
  },
};

export const WARM = ['#5C9DD8', '#6DB6C3', '#8AC7AA', '#9ACD86', '#6EB464'];
export const WARM_NAMES = ['cold', 'cool', 'lukewarm', 'warm', 'hot'];

export function fmtMeeting(m) {
  if (!m || !m.date) return '';
  const d = new Date(m.date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (m.time ? ' at ' + m.time : '');
}
