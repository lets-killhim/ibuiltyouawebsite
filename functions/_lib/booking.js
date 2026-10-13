// Availability from settings → bookable slots, minus slots already taken by meetings. Times live in the
// business's time zone (settings.book_tz); meeting.time is stored like "9:30 AM" to match the app.
const DEFAULTS = { book_slot: 30, book_ahead: 30, book_tz: 'America/Los_Angeles', book_buffer_hours: 2 };
// book_week: { '0': null, '1': { start: 9, end: 17 }, ... } keyed by weekday (0 = Sunday); null = not available
const WEEK_DEFAULT = { 0: null, 1: { start: 9, end: 17 }, 2: { start: 9, end: 17 }, 3: { start: 9, end: 17 }, 4: { start: 9, end: 17 }, 5: { start: 9, end: 17 }, 6: null };

export function bookingConfig(s) {
  const c = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (s[k] !== undefined && s[k] !== null && s[k] !== '') c[k] = s[k];
  c.book_slot = Number(c.book_slot) || 30; c.book_ahead = Number(c.book_ahead) || 30; c.book_buffer_hours = Number(c.book_buffer_hours) || 0;
  let week = s.book_week && typeof s.book_week === 'object' ? s.book_week : null;
  if (!week && Array.isArray(s.book_days)) { // older single-range settings
    week = {}; for (let i = 0; i < 7; i++) week[i] = s.book_days.map(Number).includes(i) ? { start: Number(s.book_start ?? 9), end: Number(s.book_end ?? 17) } : null;
  }
  c.week = {}; for (let i = 0; i < 7; i++) { const w = (week || WEEK_DEFAULT)[i]; c.week[i] = w && Number(w.end) > Number(w.start) ? { start: Number(w.start), end: Number(w.end) } : null; }
  return c;
}

// "now" broken into the business time zone's calendar parts
function nowIn(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}
const pad = (n) => String(n).padStart(2, '0');
export const fmt12 = (mins) => { const h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 || 12; return `${hh}${m ? ':' + pad(m) : ''} ${ap}`; };

// [{ date: 'YYYY-MM-DD', label: 'Tue, Oct 14', times: ['9 AM', '9:30 AM', ...] }]
export function slotsFor(c, taken = new Set()) {
  const now = nowIn(c.book_tz);
  const earliest = now.h * 60 + now.min + c.book_buffer_hours * 60;
  const out = [];
  for (let i = 0; i < c.book_ahead; i++) {
    const d = new Date(Date.UTC(now.y, now.m - 1, now.d + i, 12));
    const hours = c.week[d.getUTCDay()];
    if (!hours) continue;
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const times = [];
    for (let t = hours.start * 60; t + c.book_slot <= hours.end * 60; t += c.book_slot) {
      if (i === 0 && t < earliest) continue;
      const label = fmt12(t);
      if (!taken.has(`${date} ${label}`)) times.push(label);
    }
    if (times.length) out.push({ date, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }), times });
  }
  return out;
}

export function todayIn(tz) { const n = nowIn(tz); return `${n.y}-${pad(n.m)}-${pad(n.d)}`; }

export const tzLabel = (tz) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName').value; } catch { return tz; } };
