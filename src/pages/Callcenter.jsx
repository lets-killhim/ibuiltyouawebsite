import React, { useEffect, useRef, useState } from 'react';
import { api, WARM, fmtMeeting } from '../api.js';
import { I, Pill, Socials, MonthGrid, TimeEntry, fmtTime, WarmthPicker, Lightbox, SitePanel } from '../components/ui.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

// Turns vertical mouse-wheel motion into sideways scrolling while the pointer is over a scrolling photo strip.
function wheelScroll(el) {
  if (!el || el.__wheel) return;
  el.__wheel = true;
  el.addEventListener('wheel', (e) => {
    if (!el.classList.contains('scroll') || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
    if (next !== el.scrollLeft) { e.preventDefault(); el.scrollLeft = next; }
  }, { passive: false });
}

export default function Callcenter({ settings, toast, refreshCounts, summary }) {
  const [niche, setNiche] = useState(settings?.last_niche || 'pool builders');
  const [where, setWhere] = useState(settings?.last_where || 'Phoenix AZ, Mesa AZ, Scottsdale AZ, Tucson AZ');
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [scan, setScan] = useState(null);
  const [leads, setLeads] = useState([]);
  const [visible, setVisible] = useState(0);
  const [filter, setFilter] = useState('new');
  const [sort, setSort] = useState('score'); // score | photos | reviews | area | site
  const [open, setOpen] = useState({});
  const [popup, setPopup] = useState(null); // {id, kind, step, date, hour, ampm, notes}
  const [enriching, setEnriching] = useState(null);
  const [scanErr, setScanErr] = useState(null);
  const [box, setBox] = useState(null); // { photos, index }
  const [find, setFind] = useState('');
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
    setPhase('scanning'); setScan(null); setScanErr(null);
    try {
      const s = await api.startScan(niche, where, 'thorough');
      setScan(s);
      poll(s.id);
    } catch (e) { setPhase(leads.length ? 'done' : 'idle'); toast(e.message); }
  };

  const poll = (id) => {
    let fails = 0;
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
      } catch (e) { fails++; if (fails >= 3) { setScanErr(e.message); setPhase(leads.length ? 'done' : 'idle'); return; } timers.current.push(setTimeout(tick, 8000)); }
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

  const needle = find.trim().toLowerCase();
  const area = (l) => { const d = (l.phone || '').replace(/\D/g, ''); return d.length === 11 ? d.slice(1, 4) : d.slice(0, 3); };
  const SORTS = {
    score: (a, b) => (b.score || 0) - (a.score || 0) || (b.reviews || 0) - (a.reviews || 0),
    photos: (a, b) => (b.photos || []).length - (a.photos || []).length,
    reviews: (a, b) => (b.reviews || 0) - (a.reviews || 0),
    area: (a, b) => area(a).localeCompare(area(b)) || (b.reviews || 0) - (a.reviews || 0),
    site: (a, b) => (b.site?.url ? 1 : 0) - (a.site?.url ? 1 : 0) || (b.reviews || 0) - (a.reviews || 0),
  };
  const shown = [...leads].sort(SORTS[sort] || SORTS.score).slice(0, visible).filter((l) => l.status === filter && (!needle || `${l.name} ${l.city || ''} ${l.phone || ''}`.toLowerCase().includes(needle)));
  const allOpen = shown.length > 0 && shown.every((l) => open[l.id]);
  const headline = phase === 'idle' ? ['Who should', 'we find?'] : phase === 'scanning' ? ['Finding', niche + '.'] : [String(shown.length), filter === 'new' ? 'to call.' : 'to call back.'];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 260px', maxWidth: 360 }}>business type, use / for more phrasings
          <input className="line" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="pool builders" />
        </label>
        <label className="field" style={{ flex: '1 1 320px', maxWidth: 520 }}>where, towns separated by commas
          <input className="line" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Phoenix AZ, Mesa AZ" />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <Pill onClick={startScan} disabled={phase === 'scanning'}>{phase === 'scanning' ? 'Scanning' : phase === 'done' ? 'Scan again' : 'Scan'}</Pill>
          <span className="small muted">{estimate(niche, where)}</span>
        </div>
      </div>

      <div className="head">
        <h1>{headline[0]} <em>{headline[1]}</em></h1>
        <div className="filters" style={{ alignItems: 'center' }}>
          <input className="input" value={find} onChange={(e) => setFind(e.target.value)} placeholder="find a name" aria-label="Find a lead" style={{ width: 180, minHeight: 36, padding: '6px 12px', borderRadius: 999, fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: 'var(--bright)' }} />
          <button className={filter === 'new' ? 'on' : ''} onClick={() => setFilter('new')}>today {leads.filter((l) => l.status === 'new').length || ''}</button>
          <button className={filter === 'callback' ? 'on' : ''} onClick={() => setFilter('callback')}>call later {leads.filter((l) => l.status === 'callback').length || ''}</button>
          <select className="input pill-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={{ width: 'auto', minHeight: 36, padding: '6px 34px 6px 12px', borderRadius: 999, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>
            <option value="score">sort: best first</option>
            <option value="reviews">sort: most reviews</option>
            <option value="photos">sort: most photos</option>
            <option value="area">sort: area code</option>
            <option value="site">sort: site built</option>
          </select>
          <button className={allOpen ? 'on' : ''} onClick={() => setOpen(allOpen ? {} : Object.fromEntries(shown.map((l) => [l.id, true])))} title={allOpen ? 'close every row' : 'open every row'}>{allOpen ? 'close all' : 'open all'}</button>
        </div>
      </div>

      {phase === 'scanning' && (
        <span className="small muted">
          {scan?.total ? `${scan.done} of ${scan.total} searches back` : 'starting'}{scan?.rows_returned ? `, ${scan.rows_returned} rows so far` : ''}. Usually one to three minutes; leads appear when every town is in.
        </span>
      )}
      {scanErr && <span className="small" style={{ color: 'var(--red)' }}>scan stopped: {scanErr}</span>}
      {phase === 'done' && scan?.debug && (
        <span className="small muted">
          {scan.rows_returned} rows from Google Maps, {scan.debug.with_site} had websites, {scan.debug.no_phone} had no phone{scan.debug.far ? `, ${scan.debug.far} too far from the town` : ''}, {scan.no_site} kept, {scan.new_leads} new
          {Object.keys(scan.debug.known || {}).length > 0 && <>, {Object.entries(scan.debug.known).map(([k, v]) => `${v} already in ${k === 'new' ? 'today' : k === 'callback' ? 'call later' : k}`).join(', ')}</>}
        </span>
      )}
      {enriching && <span className="small muted">checking Facebook, Instagram and photos, four leads at a time; you can keep calling</span>}
      {phase === 'done' && !enriching && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-ghost sm" onClick={async () => { if (!window.confirm(`Delete all ${leads.filter((l) => l.status === filter).length} leads in this list? Call-later and confirmed leads elsewhere are untouched.`)) return; await api.clear(filter); setLeads((ls) => ls.filter((l) => l.status !== filter)); refreshCounts(); }}>clear this list</button>
        </div>
      )}

      <div className="rows">
        {shown.map((l) => (
          <LeadRow key={l.id} lead={l} open={!!open[l.id]} toggle={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))}
            popup={popup && popup.id === l.id ? popup : null} setPopup={setPopup} patch={patch} trash={trash} enriching={!!(enriching && enriching.has(l.id))} setBox={setBox} settings={settings} toast={toast} onLead={(u) => setLeads((ls) => ls.map((x) => (x.id === u.id ? u : x)))} />
        ))}
        {shown.length > 0 && <div className="end" />}
        {phase === 'idle' && leads.length === 0 && <span className="muted" style={{ padding: '24px 0' }}>Type a business and some towns, then scan. Every business we find has a phone number and no real website.</span>}
        {phase === 'done' && shown.length === 0 && <span className="muted" style={{ padding: '24px 0' }}>Nothing here. {filter === 'new' ? 'Scan more towns.' : 'Mark a lead "call back" and it lands here.'}</span>}
      </div>

      {popup && <button className="backdrop" aria-label="Close" onClick={() => setPopup(null)} />}
      {box && <Lightbox photos={box.photos} index={box.index} onClose={() => setBox(null)} onIndex={(i) => setBox({ ...box, index: i })} />}
    </div>
  );
}

function estimate(niche, where) {
  const phr = niche.split('/').filter((t) => t.trim()).length || 1; const towns = where.split(',').filter((t) => t.trim()).length || 1;
  return `~$${(towns * phr * 1.2).toFixed(2)}`;
}

function LeadRow({ lead: l, open, toggle, popup, setPopup, patch, trash, enriching, setBox, settings, onLead, toast }) {
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
          <div className="drop-info" style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, lineHeight: 1.55 }}>
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
          <div className="drop-photos" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="small muted">{l.photos?.length || 0} photos of their work{l.photos?.length ? ', from their Google listing' : l.enriched_at ? '' : ', still loading'}</span>
            <div className="photo-panel">
              <div className={'photos' + ((l.photos || []).length > 12 ? ' scroll' : '')} ref={wheelScroll}>
                {(l.photos || []).map((p, i) => <img key={i} src={p.src} alt="" loading="lazy" style={{ cursor: 'zoom-in' }} onClick={() => setBox({ photos: l.photos, index: i })} />)}
              </div>
            </div>
          </div>
          <div className="drop-site" style={{ flex: '0 1 340px', minWidth: 0 }}>
            <SitePanel lead={l} settings={settings} onLead={onLead} toast={toast} />
          </div>
        </div>
      )}
    </div>
  );
}
