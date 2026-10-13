// Availability from settings → bookable slots, minus slots already taken by meetings. Times live in the
// business's time zone (settings.book_tz); meeting.time is stored like "9:30 AM" to match the app.
const DEFAULTS = { book_days: [1, 2, 3, 4, 5], book_start: 9, book_end: 17, book_slot: 30, book_ahead: 14, book_tz: 'America/Los_Angeles', book_buffer_hours: 2 };

export function bookingConfig(s) {
  const c = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (s[k] !== undefined && s[k] !== null && s[k] !== '') c[k] = s[k];
  c.book_days = (Array.isArray(c.book_days) ? c.book_days : DEFAULTS.book_days).map(Number);
  c.book_start = Number(c.book_start); c.book_end = Number(c.book_end); c.book_slot = Number(c.book_slot) || 30; c.book_ahead = Number(c.book_ahead) || 14; c.book_buffer_hours = Number(c.book_buffer_hours) || 0;
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
    const dow = d.getUTCDay();
    if (!c.book_days.includes(dow)) continue;
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const times = [];
    for (let t = c.book_start * 60; t + c.book_slot <= c.book_end * 60; t += c.book_slot) {
      if (i === 0 && t < earliest) continue;
      const label = fmt12(t);
      if (!taken.has(`${date} ${label}`)) times.push(label);
    }
    if (times.length) out.push({ date, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }), times });
  }
  return out;
}

export const tzLabel = (tz) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName').value; } catch { return tz; } };
