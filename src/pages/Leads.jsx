import React, { useEffect, useRef, useState } from 'react';
import { api, WARM, fmtMeeting } from '../api.js';
import { I, Socials, Lightbox, SitePanel } from '../components/ui.jsx';

const STEPS = [
  ['Domain purchased', 'https://dash.cloudflare.com/?to=/:account/domains/register'],
  ['Cloudflare', 'https://dash.cloudflare.com/'],
  ['Site live', 'https://dash.cloudflare.com/?to=/:account/pages'],
  ['Contact form functional', 'https://formspree.io/'],
];

export default function Leads({ settings, openId, toast, refreshCounts }) {
  const [leads, setLeads] = useState([]);
  const [open, setOpen] = useState({});
  const [box, setBox] = useState(null);
  useEffect(() => {
    api.leads('confirmed').then((rows) => {
      setLeads(rows);
      if (openId) setOpen({ [openId]: true });
    }).catch(() => {});
  }, [openId]);

  const patch = async (id, p) => {
    const u = await api.patchLead(id, p);
    setLeads((ls) => ls.map((x) => (x.id === id ? u : x)));
    return u;
  };

  const sorted = [...leads].sort((a, b) => (b.warmth || 0) - (a.warmth || 0));
  return (
    <div className="page">
      <div className="head"><h1>{sorted.length} <em>clients.</em></h1></div>
      <div className="rows">
        {sorted.map((l) => <ClientRow key={l.id} lead={l} open={!!open[l.id]} toggle={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))} patch={patch} settings={settings} toast={toast} refreshCounts={refreshCounts} setBox={setBox} patchLocal={(u) => setLeads((ls) => ls.map((x) => (x.id === u.id ? u : x)))} />)}
        {sorted.length > 0 ? <div className="end" /> : <span className="muted" style={{ padding: '24px 0' }}>Nothing confirmed yet. Hit the green check on a lead in the callcenter and it lands here.</span>}
      </div>
      {box && <Lightbox photos={box.photos} index={box.index} onClose={() => setBox(null)} onIndex={(i) => setBox({ ...box, index: i })} />}
    </div>
  );
}

function ClientRow({ lead: l, open, toggle, patch, settings, toast, refreshCounts, setBox, patchLocal }) {
  const [notes, setNotes] = useState(l.notes || '');
  const [editOwner, setEditOwner] = useState(false);
  const [owner, setOwner] = useState(l.owner || '');
  const [dragging, setDragging] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [showSubs, setShowSubs] = useState(false);
  const [sendingInv, setSendingInv] = useState(false);
  const lastInvoice = ((l.site || {}).sent || []).filter((x) => x.kind === 'invoice').slice(-1)[0];
  const sendInvoice = async () => {
    const to = (invoice || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast('that is not an email address'); return; }
    setSendingInv(true);
    try { patchLocal(await api.sendInvoice(l.id, to, plan)); setInvoice(null); toast('invoice sent to ' + to); } catch (e) { toast('Could not send: ' + e.message); }
    setSendingInv(false);
  };
  const saveT = useRef(null);
  const site = l.site || {};
  const live = l.live || [0, 0, 0, 0];
  const plans = settings?.plans || [];
  const plan = l.plan || (plans[0] && plans[0].title) || '';

  const onNotes = (v) => { setNotes(v); clearTimeout(saveT.current); saveT.current = setTimeout(() => patch(l.id, { notes: v }).catch(() => {}), 600); };
  const saveOwner = () => { setEditOwner(false); if (owner !== (l.owner || '')) patch(l.id, { owner }).catch(() => {}); };
  const toggleStep = (i) => patch(l.id, { live: live.map((v, j) => (j === i ? (v ? 0 : 1) : v)) }).catch(() => {});
  const addFiles = async (files) => {
    for (const f of Array.from(files || [])) {
      try { const u = await api.upload(l.id, f); patch(l.id, { photos: [...(l.photos || []), { src: u.url, source: 'yours' }] }); } catch (e) { toast('Upload failed: ' + e.message); }
    }
  };
  const remove = () => patch(l.id, { status: 'new', warmth: 0, meeting: null }).then(refreshCounts);

  return (
    <div className="rowwrap">
      <button className="row" onClick={toggle} style={{ background: 'transparent', border: 0, borderTop: '2px solid var(--rule)', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', minHeight: 64 }}>
        <span className="tag"><span className="sq" style={{ background: WARM[Math.max(0, l.warmth - 1)] }} /></span>
        <span className="name" style={{ flex: '1 1 300px' }}>{l.name}</span>
        <span className="cell" style={{ flex: '0 0 200px' }}>{l.meeting ? fmtMeeting(l.meeting) : 'no meeting'}</span>
        <span className="cell" style={{ flex: '0 0 160px', color: site.status === 'ready' ? 'var(--txt)' : site.status === 'building' ? 'var(--muted)' : 'var(--red)' }}>{site.status === 'ready' ? 'site ready' : site.status === 'building' ? 'site building' : 'no site yet'}</span>
        <span className="cell" style={{ flex: '0 0 150px' }}>{live.filter(Boolean).length === 4 ? 'live' : l.pay === 'paid' ? `paid, ${live.filter(Boolean).length} of 4 live steps` : 'not paid'}</span>
        <span className={'arrow' + (open ? ' open' : '')} style={{ opacity: 1 }}>{I.chevron}</span>
      </button>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 40, padding: '12px 0 40px' }} className="drop-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 26, color: 'var(--bright)' }}>{l.phone}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', minHeight: 32 }}>owner name
                {editOwner
                  ? <input className="input" autoFocus value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={saveOwner} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') saveOwner(); }} placeholder="unknown" style={{ width: 180, minHeight: 32, padding: '4px 10px' }} />
                  : <button onClick={() => setEditOwner(true)} style={{ background: 'transparent', border: 0, padding: 0, color: owner ? 'var(--bright)' : 'var(--muted)', fontSize: 15, cursor: 'text', minHeight: 32 }}>{owner || 'unknown'}</button>}
              </div>
              <span className="muted">{l.email || 'no email, texts only'}</span>
              <span className="muted">{l.address}</span>
              <div style={{ paddingTop: 4 }}><Socials lead={l} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14, flex: '1 1 auto' }}>
              <span className="sect">notes</span>
              <textarea className="input" value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="scratchpad: who decides, contact info, what they want changed, anything they say" style={{ flex: '1 1 auto', minHeight: 180, resize: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="sect">their site</span>
            <SitePanel lead={l} settings={settings} onLead={(u) => patchLocal(u)} toast={toast} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontSize: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="sect">money</span>
              <select className="input" value={plan} onChange={(e) => patch(l.id, { plan: e.target.value })}>
                {plans.length ? plans.map((p) => <option key={p.title} value={p.title}>{p.title}</option>) : <option value="">add plans in settings</option>}
              </select>
              {invoice === null ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className={'btn-sage' + (plans.length ? '' : ' off')} onClick={() => setInvoice(l.email || '')}>{lastInvoice ? 'send invoice again' : 'send invoice'}</button>
                  {l.pay === 'paid' ? <span style={{ color: 'var(--ok)' }}>paid</span> : lastInvoice ? <span className="muted">sent {new Date(lastInvoice.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · <button className="linkish" onClick={() => patch(l.id, { pay: 'paid' })}>mark paid</button></span> : <span className="muted">not sent</span>}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" autoFocus value={invoice} onChange={(e) => setInvoice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendInvoice(); if (e.key === 'Escape') setInvoice(null); }} placeholder="their email" style={{ flex: '1 1 auto' }} />
                  <button className="btn-sage" onClick={sendInvoice} disabled={sendingInv}>{sendingInv ? 'sending' : 'send'}</button>
                  <button className="btn-ghost" onClick={() => setInvoice(null)}>cancel</button>
                </div>
              )}
              <span className="small muted">emails the {plan ? plan : 'selected'} Stripe link and the hosting agreement; they accept by replying "I agree" or by paying</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <span className="sect">going live</span>
              {STEPS.map(([label, href], i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => toggleStep(i)} aria-label={(live[i] ? 'Uncheck ' : 'Check ') + label} style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, border: '1.5px solid ' + (live[i] ? 'var(--ok)' : 'rgba(191,224,184,0.35)'), background: live[i] ? 'var(--ok)' : 'transparent', display: 'block' }} />
                  </button>
                  <a href={href} target="_blank" rel="noreferrer" style={{ flex: '1 1 auto', color: live[i] ? 'var(--muted)' : 'var(--bright)', lineHeight: '28px' }}>{label}</a>
                </div>
              ))}
              <label className="field" style={{ fontSize: 13 }}>domain<input className="input" defaultValue={l.domain || ''} onBlur={(e) => patch(l.id, { domain: e.target.value })} placeholder="theirbusiness.com" /></label>
              <label className="field" style={{ fontSize: 13 }}>contact form goes to<input className="input" defaultValue={l.form_email || ''} onBlur={(e) => patch(l.id, { form_email: e.target.value })} placeholder="their email; until set, submissions come to you" /></label>
              <div className="small muted" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {site.form_token ? (
                  <>
                    <span>form is live: {(site.submissions || []).length ? `${site.submissions.length} submission${site.submissions.length === 1 ? '' : 's'}, last ${new Date(site.submissions[site.submissions.length - 1].at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'no submissions yet'}</span>
                    <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="linkish" onClick={async () => { try { const r = await fetch(`/f/${site.form_token}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: 'Test from the app', phone: settings?.my_phone || '', email: settings?.my_email || '', message: 'If you got this, the form on the site works.' }) }); const d = await r.json(); toast(d.ok ? 'test sent' : 'test failed: ' + d.message); } catch (e) { toast('test failed: ' + e.message); } }}>send a test submission</button>
                      {(site.submissions || []).length > 0 && <button className="linkish" onClick={() => setShowSubs((v) => !v)}>{showSubs ? 'hide' : 'show'} submissions</button>}
                    </span>
                    {showSubs && (site.submissions || []).slice().reverse().map((x, i) => (
                      <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--box)', color: 'var(--txt)' }}>
                        <div className="small muted">{new Date(x.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                        {Object.entries(x.fields).map(([k, v]) => <div key={k}><span className="muted">{k}: </span>{v}</div>)}
                      </div>
                    ))}
                  </>
                ) : site.url ? (
                  <span>this site was built before forms were wired up · <button className="linkish" onClick={async () => { try { patchLocal(await api.activateForm(l.id)); toast('form activated'); } catch (e) { toast('Could not activate: ' + e.message); } }}>activate the form</button></span>
                ) : <span>build the site and its form is live automatically</span>}
              </div>
              <button className="btn-ghost" onClick={remove} style={{ alignSelf: 'flex-start' }}>back to callcenter</button>
            </div>
          </div>

          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line)', padding: '18px 8px 8px', borderRadius: 8, background: dragging ? 'rgba(168,200,166,0.12)' : 'transparent', transition: 'background 160ms' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="sect">photos, {(l.photos || []).length}</span>
              <span className="small muted">drag photos from your computer anywhere on this row; they join the gallery and the site prompts</span>
            </div>
            <div className="photos" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
              {(l.photos || []).map((p, i) => <img key={i} src={p.src} alt="" loading="lazy" title={p.source} style={{ cursor: 'zoom-in' }} onClick={() => setBox({ photos: l.photos, index: i })} />)}
              <label className="ph add">{I.plus}add<input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} style={{ display: 'none' }} /></label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
