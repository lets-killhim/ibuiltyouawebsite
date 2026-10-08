import React, { useEffect, useRef, useState } from 'react';
import { api, WARM, fmtMeeting } from '../api.js';
import { I, Pill, Socials, MonthGrid, TimeEntry, fmtTime, WarmthPicker } from '../components/ui.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Callcenter({ settings, toast, refreshCounts }) {
  const [niche, setNiche] = useState(settings?.last_niche || 'pool builders');
  const [where, setWhere] = useState(settings?.last_where || 'Phoenix AZ, Mesa AZ, Scottsdale AZ, Tucson AZ');
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [scan, setScan] = useState(null);
  const [leads, setLeads] = useState([]);
  const [visible, setVisible] = useState(0);
  const [filter, setFilter] = useState('new');
  const [open, setOpen] = useState({});
  const [popup, setPopup] = useState(null); // {id, kind, step, date, hour, ampm, notes}
  const [enriching, setEnriching] = useState(null);
  const timers = useRef([]);

  const load = async () => {
    const rows = await api.leads('new,callback');
    setLeads(rows);
    setVisible(rows.length);
    return rows;
  };
  useEffect(() => { load().then((r) => { if (r.length) { setPhase('done'); enrichAll(r); } }).catch(() => {}); return () => timers.current.forEach(clearTimeout); }, []);

  const startScan = async () => {
    if (!settings?.has_outscraper) { toast('Add your Outscraper key in settings first'); return; }
    setPhase('scanning'); setScan(null);
    try {
      const s = await api.startScan(niche, where);
      setScan(s);
      poll(s.id);
    } catch (e) { setPhase(leads.length ? 'done' : 'idle'); toast(e.message); }
  };

  const poll = (id) => {
    const tick = async () => {
      try {
        const s = await api.scanStatus(id);
        setScan(s);
        if (s.status === 'pending') { timers.current.push(setTimeout(tick, 5000)); return; }
        if (s.status === 'error') { setPhase(leads.length ? 'done' : 'idle'); toast('Scan failed: ' + (s.error || 'unknown')); return; }
        const before = new Set(leads.map((l) => l.id));
        const rows = await api.leads('new,callback');
        setLeads(rows); setPhase('done'); refreshCounts();
        // stagger the new ones in
        const fresh = rows.filter((l) => !before.has(l.id)).length;
        setVisible(rows.length - fresh);
        for (let i = 1; i <= fresh; i++) timers.current.push(setTimeout(() => setVisible(rows.length - fresh + i), 120 * i));
        timers.current.push(setTimeout(() => enrichAll(rows), 120 * fresh + 300));
      } catch (e) { timers.current.push(setTimeout(tick, 8000)); }
    };
    tick();
  };

  const enrichAll = async (rows, redoEmpty = false) => {
    const empty = (l) => !(l.photos || []).length && !l.links?.facebook && !l.links?.instagram;
    const todo = rows.filter((l) => l.status !== 'trash' && (!l.enriched_at || (redoEmpty && empty(l))));
    if (!todo.length) return;
    let next = 0; const busy = new Set();
    const worker = async () => {
      while (next < todo.length) {
        const l = todo[next++]; busy.add(l.id); setEnriching(new Set(busy));
        try { const u = await api.enrich(l.id); setLeads((ls) => ls.map((x) => (x.id === u.id ? u : x))); } catch (e) { /* keep going */ }
        busy.delete(l.id); setEnriching(busy.size ? new Set(busy) : null);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  };

  const patch = async (id, p) => {
    const u = await api.patchLead(id, p);
    setLeads((ls) => ls.map((x) => (x.id === id ? u : x)));
    refreshCounts();
    return u;
  };
  const trash = (id) => { setLeads((ls) => ls.filter((x) => x.id !== id)); api.patchLead(id, { status: 'trash' }).then(refreshCounts).catch(() => {}); };

  const shown = leads.slice(0, visible).filter((l) => l.status === filter);
  const headline = phase === 'idle' ? ['Who should', 'we find?'] : phase === 'scanning' ? ['Finding', niche + '.'] : [String(shown.length), filter === 'new' ? 'to call.' : 'to call back.'];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 260px', maxWidth: 360 }}>business type
          <input className="line" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="pool builders" />
        </label>
        <label className="field" style={{ flex: '1 1 320px', maxWidth: 520 }}>where, towns separated by commas
          <input className="line" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Phoenix AZ, Mesa AZ" />
        </label>
        <Pill onClick={startScan} disabled={phase === 'scanning'}>{phase === 'scanning' ? 'Scanning' : phase === 'done' ? 'Scan again' : 'Scan'}</Pill>
      </div>

      <div className="head">
        <h1>{headline[0]} <em>{headline[1]}</em></h1>
        <div className="filters">
          <button className={filter === 'new' ? 'on' : ''} onClick={() => setFilter('new')}>( today ) {leads.filter((l) => l.status === 'new').length || ''}</button>
          <button className={filter === 'callback' ? 'on' : ''} onClick={() => setFilter('callback')}>( call later ) {leads.filter((l) => l.status === 'callback').length || ''}</button>
        </div>
      </div>

      {phase === 'scanning' && (
        <span className="small muted">
          {scan?.towns ? `${scan.towns} towns, ` : ''}waiting on Google Maps{scan?.rows_returned ? `, ${scan.rows_returned} rows so far` : ''}. Usually one to three minutes.
        </span>
      )}
      {phase === 'done' && scan?.debug && <span className="small muted">{scan.rows_returned} rows from Google Maps, {scan.debug.with_site} had websites, {scan.debug.no_phone} had no phone, {scan.no_site} kept, {scan.new_leads} new</span>}
      {enriching && <span className="small muted">checking Facebook, Instagram and photos, four leads at a time; you can keep calling</span>}
      {phase === 'done' && !enriching && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {leads.some((l) => !(l.photos || []).length) && <button className="btn-ghost" onClick={() => enrichAll(leads, true)}>re-check leads with no photos or socials</button>}
          <button className="btn-ghost" onClick={async () => { if (!window.confirm(`Delete all ${leads.filter((l) => l.status === filter).length} leads in this list? Call-later and confirmed leads elsewhere are untouched.`)) return; await api.clear(filter); setLeads((ls) => ls.filter((l) => l.status !== filter)); refreshCounts(); }}>clear this list</button>
        </div>
      )}

      <div className="rows">
        {shown.map((l) => (
          <LeadRow key={l.id} lead={l} open={!!open[l.id]} toggle={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))}
            popup={popup && popup.id === l.id ? popup : null} setPopup={setPopup} patch={patch} trash={trash} enriching={!!(enriching && enriching.has(l.id))} />
        ))}
        {shown.length > 0 && <div className="end" />}
        {phase === 'idle' && leads.length === 0 && <span className="muted" style={{ padding: '24px 0' }}>Type a business and some towns, then scan. Every business we find has a phone number and no real website.</span>}
        {phase === 'done' && shown.length === 0 && <span className="muted" style={{ padding: '24px 0' }}>Nothing here. {filter === 'new' ? 'Scan more towns.' : 'Mark a lead "call back" and it lands here.'}</span>}
      </div>

      {popup && <button className="backdrop" aria-label="Close" onClick={() => setPopup(null)} />}
    </div>
  );
}

function LeadRow({ lead: l, open, toggle, popup, setPopup, patch, trash, enriching }) {
  const [preset, setPreset] = useState('pools');
  const first = l.name.split(' ')[0];
  const labeled = l.status === 'callback' || l.status === 'confirmed';

  const askConfirm = () => setPopup({ id: l.id, kind: 'confirmed', step: 'schedule', date: '', hour: '', ampm: 'PM', notes: '' });
  const askCallback = () => setPopup({ id: l.id, kind: 'callback', step: 'warm' });
  const setMeeting = () => { if (!popup.date) return; setPopup({ ...popup, step: 'warm' }); };
  const pickWarm = async (w) => {
    const p = { status: popup.kind, warmth: w };
    if (popup.kind === 'confirmed') p.meeting = { date: popup.date, time: fmtTime(popup.hour, popup.ampm), notes: popup.notes || '' };
    setPopup(null);
    await patch(l.id, p);
  };

  return (
    <div className={'rowwrap' + (popup ? ' z' : '')}>
      <div className="row">
        <span className="name">{l.name}</span>
        <span className="cell" style={{ flex: '0 0 140px', color: 'var(--txt)', fontSize: 15 }}>{l.phone}</span>
        <span className="cell" style={{ flex: '0 0 100px' }}>{l.reviews} reviews</span>
        <span style={{ flex: '0 0 150px' }}>{enriching ? <span className="small muted">looking…</span> : <Socials lead={l} />}</span>
        <span style={{ flex: '0 0 300px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, position: 'relative' }}>
          {!labeled && (<>
            <button className="icon-btn" aria-label="Confirmed" onClick={askConfirm}>{I.check}</button>
            <button className="icon-btn" aria-label="Call back" onClick={askCallback}>{I.dots}</button>
            <button className="icon-btn" aria-label="Trash" onClick={() => trash(l.id)}>{I.x}</button>
          </>)}
          {labeled && (
            <span className="tag"><span className="sq" style={{ background: WARM[Math.max(0, l.warmth - 1)] }} />{l.status === 'confirmed' ? 'confirmed' : 'call later'}<span className="when">{l.meeting ? ', ' + fmtMeeting(l.meeting) : ''}</span></span>
          )}
          {popup && popup.step === 'schedule' && (
            <div className="pop">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="label">when's the meeting?</span><span className="small" style={{ color: '#5E6E63' }}>{new Date().toLocaleDateString('en-US', { month: 'long' })}</span></div>
              <MonthGrid month={new Date(new Date().getFullYear(), new Date().getMonth(), 1)} selected={popup.date} onPick={(d) => setPopup({ ...popup, date: d })} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><TimeEntry hour={popup.hour} ampm={popup.ampm} onHour={(v) => setPopup({ ...popup, hour: v })} onAmpm={(v) => setPopup({ ...popup, ampm: v })} onEnter={setMeeting} /></div>
                <button className="btn" onClick={setMeeting}>Set</button>
              </div>
              <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>notes
                <textarea className="input" rows={2} value={popup.notes} onChange={(e) => setPopup({ ...popup, notes: e.target.value })} placeholder="what the meeting is about" style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none', resize: 'none' }} />
              </label>
            </div>
          )}
          {popup && popup.step === 'warm' && (
            <div className="pop" style={{ width: 'auto' }}><WarmthPicker name={first} onPick={pickWarm} /></div>
          )}
        </span>
        <button className={'arrow' + (open ? ' open' : '')} aria-label="Show details" onClick={toggle}>{I.chevron}</button>
      </div>

      {open && (
        <div className="drop">
          <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, lineHeight: 1.55 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>{l.address}</span>
              <span className="muted">{l.rating ? `${l.rating} stars, ` : ''}{l.reviews} reviews{l.category ? `, ${l.category}` : ''}</span>
              {l.enrich_error && <span className="small" style={{ color: 'var(--red)' }}>{l.enrich_error}</span>}
            </div>
            <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span>Google, from the listing</span>
              <span>Facebook, {l.matches?.facebook || (l.enriched_at ? 'not found' : 'not checked yet')}</span>
              <span>Instagram, {l.matches?.instagram || (l.enriched_at ? 'not found' : 'not checked yet')}</span>
            </div>
          </div>
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="small muted">{l.photos?.length || 0} photos of their work{l.photos?.length ? ', from their Google listing' : l.enriched_at ? '' : ', still loading'}</span>
            <div className="photos">
              {(l.photos || []).slice(0, 12).map((p, i) => <img key={i} src={p.src} alt="" loading="lazy" />)}
            </div>
          </div>
          <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="small muted">pick a preset</span>
            <div className="chips">{['pools', 'remodel', 'construction', 'services'].map((p) => <button key={p} className={'chip' + (preset === p ? ' on' : '')} onClick={() => setPreset(p)}>{p}</button>)}</div>
            <Pill small disabled>Build site</Pill>
            <span className="small muted">site builder arrives in v2; everything above is live data</span>
          </div>
        </div>
      )}
    </div>
  );
}
