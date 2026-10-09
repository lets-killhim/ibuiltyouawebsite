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
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
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
