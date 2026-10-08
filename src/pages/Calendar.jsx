import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { I, TimeEntry, fmtTime } from '../components/ui.jsx';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sortTime = (t) => { const m = /(\d+)(?::(\d+))?\s*(AM|PM)/i.exec(t || ''); if (!m) return 0; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + (+m[2] || 0); };

export default function Calendar({ go, toast }) {
  const [view, setView] = useState('week');
  const [meetings, setMeetings] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [ask, setAsk] = useState(null); // {id, date, hour, ampm}
  const [sent, setSent] = useState({});
  const today = new Date(); const todayISO = iso(today);

  const load = () => api.leads('confirmed').then((rows) => setMeetings(rows.filter((l) => l.meeting && l.meeting.date))).catch(() => {});
  useEffect(() => { load(); }, []);

  // this week, Monday to Friday
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const nDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const items = (date) => meetings.filter((m) => m.meeting.date === date).sort((a, b) => sortTime(a.meeting.time) - sortTime(b.meeting.time));
  const dropOn = (date) => { const m = meetings.find((x) => x.id === dragging); setDragging(null); setOver(null); if (!m || m.meeting.date === date) return; const [h, ap] = (m.meeting.time || '12 PM').split(' '); setAsk({ id: m.id, name: m.name, date, hour: h, ampm: ap || 'PM' }); };
  const confirmMove = async () => {
    const a = ask; if (!a) return; setAsk(null);
    const m = meetings.find((x) => x.id === a.id);
    const u = await api.patchLead(a.id, { meeting: { ...m.meeting, date: a.date, time: fmtTime(a.hour, a.ampm) } });
    setMeetings((ms) => ms.map((x) => (x.id === u.id ? u : x)));
  };
  const meet = (m) => { setSent((s) => ({ ...s, [m.id]: true })); window.open('https://meet.google.com/new', '_blank', 'noopener'); toast('Meet link opened; sending the invite text/email arrives with Twilio in v2'); };

  const Card = ({ m, small }) => (
    <div className={'meet' + (small ? ' sm' : '') + (m.site?.status === 'ready' ? '' : ' nosite')} draggable onDragStart={() => setDragging(m.id)}>
      <span className="t"><b>{small ? `${m.meeting.time} ${m.name.split(' ').slice(0, 2).join(' ')}` : m.name}</b>{!small && <span className="small muted">{m.meeting.time}{m.meeting.notes ? ', ' + m.meeting.notes : ''}</span>}</span>
      <button className="ring" aria-label="Open in leads" onClick={() => go('leads', m.id)}>{I.dotsPale}</button>
      <button className="ring" aria-label="Send a Google Meet link" onClick={() => meet(m)}>{sent[m.id] ? I.sent : I.cam}</button>
    </div>
  );

  return (
    <div className="page">
      <div className="head">
        <h1>{view === 'week' ? <>This <em>week.</em></> : <>{today.toLocaleDateString('en-US', { month: 'long' })}, <em>{meetings.filter((m) => m.meeting.date.startsWith(todayISO.slice(0, 7))).length} meetings.</em></>}</h1>
        <div className="filters">
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>( this week )</button>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>( this month )</button>
        </div>
      </div>

      {view === 'week' && (
        <div className="week">
          {weekDays.map((d) => { const k = iso(d); return (
            <div key={k} className={'day' + (k === todayISO ? ' today' : '') + (over === k && dragging ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDrop={(e) => { e.preventDefault(); dropOn(k); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 16, color: k === todayISO ? 'var(--bright)' : 'var(--muted)' }}>{d.toLocaleDateString('en-US', { weekday: 'long' })}</span><span className="small muted">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
              {items(k).map((m) => <Card key={m.id} m={m} />)}
            </div>
          ); })}
        </div>
      )}

      {view === 'month' && (
        <div className="month">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((h) => <span key={h} className="small muted" style={{ padding: '0 4px 6px' }}>{h}</span>)}
          {Array.from({ length: first.getDay() }, (_, i) => <div key={'p' + i} className="mday pad" />)}
          {Array.from({ length: nDays }, (_, i) => { const d = new Date(today.getFullYear(), today.getMonth(), i + 1); const k = iso(d); return (
            <div key={k} className={'mday' + (k === todayISO ? ' today' : '') + (over === k && dragging ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDrop={(e) => { e.preventDefault(); dropOn(k); }}>
              <span className="small" style={{ color: k === todayISO ? 'var(--bright)' : 'var(--muted)' }}>{i + 1}</span>
              {items(k).map((m) => <Card key={m.id} m={m} small />)}
            </div>
          ); })}
        </div>
      )}

      {ask && (
        <div className="modal-bg">
          <button className="shade" aria-label="Close" onClick={() => setAsk(null)} />
          <div className="modal">
            <span className="label">move {ask.name}</span>
            <span className="small" style={{ color: '#5E6E63' }}>what time on {new Date(ask.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}?</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><TimeEntry hour={ask.hour} ampm={ask.ampm} onHour={(v) => setAsk({ ...ask, hour: v })} onAmpm={(v) => setAsk({ ...ask, ampm: v })} onEnter={confirmMove} /></div>
              <button className="btn" onClick={confirmMove}>Move</button>
            </div>
            <button onClick={() => setAsk(null)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, fontSize: 13, color: '#5E6E63', minHeight: 32 }}>keep it where it was</button>
          </div>
        </div>
      )}
    </div>
  );
}
