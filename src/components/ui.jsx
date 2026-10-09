import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export const TABS = [
  ['home', '( HOME )'], ['callcenter', '( CALLCENTER )'], ['leads', '( LEADS )'],
  ['calendar', '( CALENDAR )'], ['money', '( MONEY )'], ['settings', '( SETTINGS )'],
];

export function Strip({ tab, go, counts }) {
  return (
    <nav className="strip">
      {TABS.map(([key, label]) => (
        <button key={key} className={'tab' + (tab === key ? ' active' : '')} onClick={() => go(key)}>
          {label}{counts && counts[key] ? <span className="n">{counts[key]}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export const I = {
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8C8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M13 5l7 7-7 7" /></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8C8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BFE0B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>,
  check: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6EB464" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>,
  dots: <svg width="24" height="24" viewBox="0 0 24 24" fill="#E0A84A"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></svg>,
  dotsPale: <svg width="14" height="14" viewBox="0 0 24 24" fill="#BFE0B8"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FB596" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  xDark: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F3B2E" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  ig: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BFE0B8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="#BFE0B8" /></svg>,
  msg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BFE0B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" /></svg>,
  mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BFE0B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  sent: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6EB464" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  cam: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#BFE0B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 11l5-3v8l-5-3z" /></svg>,
  expand: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCF1D7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" /></svg>,
  pencil: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCF1D7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4z" /><path d="M13 7l4 4" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BFE0B8" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  cold: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5C9DD8" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /></svg>,
  smile: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3E9A4A" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14c1 1.4 2.2 2 3.5 2s2.5-0.6 3.5-2" /><circle cx="9" cy="10" r="0.8" fill="#3E9A4A" /><circle cx="15" cy="10" r="0.8" fill="#3E9A4A" /></svg>,
};

export function Pill({ children, onClick, icon = 'arrow', disabled, small, href }) {
  const inner = <><span>{children}</span><span className="dot">{I[icon]}</span></>;
  if (href) return <a className={'pill' + (small ? ' sm' : '')} href={href} target="_blank" rel="noreferrer">{inner}</a>;
  return <button className={'pill' + (small ? ' sm' : '')} onClick={onClick} disabled={disabled}>{inner}</button>;
}

export function Socials({ lead }) {
  const L = lead.links || {};
  return (
    <span style={{ display: 'flex', gap: 6 }}>
      {L.google && <a className="ring" href={L.google} target="_blank" rel="noreferrer" aria-label="Open their Google Maps listing">G</a>}
      {L.facebook && <a className="ring" href={L.facebook} target="_blank" rel="noreferrer" aria-label="Open their Facebook page" style={{ fontSize: 15, paddingBottom: 2 }}>f</a>}
      {L.instagram && <a className="ring" href={L.instagram} target="_blank" rel="noreferrer" aria-label="Open their Instagram">{I.ig}</a>}
    </span>
  );
}

export function Lightbox({ photos, index, onClose, onIndex }) {
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length); if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [index, photos.length]);
  if (!photos.length) return null;
  const p = photos[index] || photos[0];
  const Arrow = ({ dir }) => (
    <button aria-label={dir > 0 ? 'Next photo' : 'Previous photo'} onClick={(e) => { e.stopPropagation(); onIndex((index + dir + photos.length) % photos.length); }}
      style={{ position: 'absolute', top: '50%', [dir > 0 ? 'right' : 'left']: 16, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 999, border: '1px solid rgba(220,241,215,0.35)', background: 'rgba(15,59,46,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DCF1D7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={dir > 0 ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} /></svg>
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(8,28,20,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 72, cursor: 'zoom-out' }}>
      <img src={p.src} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, cursor: 'default', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }} />
      {photos.length > 1 && <><Arrow dir={-1} /><Arrow dir={1} /></>}
      <span className="small" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'var(--muted)' }}>{index + 1} of {photos.length}{p.source ? `, ${p.source === 'yours' ? 'yours' : 'from Google'}` : ''} · click outside to close</span>
    </div>
  );
}

// The site builder block: preset, build, loader, preview, link, send buttons. Used in the callcenter and leads dropdowns.
export function SitePanel({ lead, settings, onLead, toast }) {
  const presets = settings?.presets || [];
  const site = lead.site || {};
  const [preset, setPreset] = useState(site.preset || (presets[0] && presets[0].name) || '');
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const building = busy || site.status === 'building';
  const build = async () => {
    if (!settings?.anthropic_key_last4) { toast('Add your Claude API key in settings first'); return; }
    setBusy(true);
    try { onLead(await api.build(lead.id, preset)); } catch (e) { toast('Build failed: ' + e.message); }
    setBusy(false);
  };
  const vars = { business: lead.name, owner: lead.owner || 'there', phone: lead.phone || '', link: site.url || '', me: settings?.me || '', my_phone: settings?.my_phone || '', plan: lead.plan || '' };
  const fill = (tpl) => (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
  const smsHref = lead.phone ? `sms:${lead.phone.replace(/[^+\d]/g, '')}?&body=${encodeURIComponent(fill(settings?.tpl_text))}` : null;
  const mailHref = lead.email ? `mailto:${lead.email}?subject=${encodeURIComponent(fill(settings?.tpl_email_subject))}&body=${encodeURIComponent(fill(settings?.tpl_email))}` : null;
  const copy = () => { navigator.clipboard.writeText(site.url); toast('link copied'); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="input" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Preset" style={{ flex: '1 1 auto', minHeight: 44 }}>
          {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <Pill small onClick={build} disabled={building}>{site.status === 'ready' ? 'Rebuild' : 'Build site'}</Pill>
      </div>
      {building && <div style={{ aspectRatio: '16 / 10', borderRadius: 8, background: 'var(--box)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}><div className="loader"><span /><span /><span /></div><span className="small muted">writing the site, about a minute; you can close this and keep calling</span></div>}
      {!building && site.status === 'ready' && (<>
        <div style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 8, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}>
          <iframe title="site preview" src={site.url} style={{ width: 1280, height: 800, border: 0, transform: 'scale(0.265)', transformOrigin: 'top left', pointerEvents: 'none' }} />
          <button onClick={() => setFull(true)} aria-label="Open fullscreen" style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 999, border: 0, background: 'rgba(15,59,46,0.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.expand}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <a href={site.url} target="_blank" rel="noreferrer" style={{ color: 'var(--bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.url.replace(/^https?:\/\//, '')}</a>
          <button className="btn-ghost" onClick={copy} style={{ height: 32, padding: '0 12px', flexShrink: 0 }}>copy</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <span>send the link:</span>
          {smsHref ? <a className="ring lg" href={smsHref} aria-label="Text the link">{I.msg}</a> : <span className="ring lg off" aria-label="No phone">{I.msg}</span>}
          {mailHref ? <a className="ring lg" href={mailHref} aria-label="Email the link">{I.mail}</a> : <span className="ring lg off" title="no email found for this business">{I.mail}</span>}
          <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>v{site.version}{site.preset ? `, ${site.preset}` : ''}</span>
        </div>
      </>)}
      {!building && site.status === 'error' && <span className="small" style={{ color: 'var(--red)' }}>{site.error}</span>}
      {!building && !site.status && <span className="small muted">builds a one-page site from the photos and details above; about a minute</span>}
      {full && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#F4F1EA' }}>
          <iframe title="site" src={site.url} style={{ width: '100%', height: '100%', border: 0 }} />
          <button onClick={() => setFull(false)} aria-label="Close" style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 999, border: '1px solid rgba(30,43,34,0.3)', background: 'rgba(244,241,234,0.95)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.xDark}</button>
        </div>
      )}
    </div>
  );
}

export function Loader({ text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24 }}>
      <div className="loader"><span /><span /><span /></div>
      {text && <span className="small muted">{text}</span>}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3200); return () => clearTimeout(t); }, [msg]);
  return [msg ? <div className="toast">{msg}</div> : null, setMsg];
}

// Hour + AM/PM entry; "9" becomes "9 AM"
export function TimeEntry({ hour, ampm, onHour, onAmpm, onEnter }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <input className="input" value={hour} onChange={(e) => onHour(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }} placeholder="9 or 9:30" aria-label="Hour" style={{ flex: '1 1 auto', minWidth: 0 }} />
      <select className="input" value={ampm} onChange={(e) => onAmpm(e.target.value)} aria-label="AM or PM" style={{ width: 'auto' }}>
        <option value="AM">AM</option><option value="PM">PM</option>
      </select>
    </div>
  );
}
export const fmtTime = (hour, ampm) => ((hour || '').trim() || '12') + ' ' + (ampm || 'AM');

export function MonthGrid({ month, selected, onPick }) {
  // month: Date for the 1st of a month
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const pad = first.getDay();
  const iso = (d) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <div className="cal7">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((h, i) => <span key={i} className="h">{h}</span>)}
      {Array.from({ length: pad }, (_, i) => <span key={'p' + i} />)}
      {Array.from({ length: days }, (_, i) => {
        const d = iso(i + 1);
        return <button key={d} className={'d' + (selected === d ? ' on' : '')} onClick={() => onPick(d)}>{i + 1}</button>;
      })}
    </div>
  );
}

export function WarmthPicker({ name, onPick }) {
  const colors = ['#5C9DD8', '#6DB6C3', '#8AC7AA', '#9ACD86', '#6EB464'];
  const names = ['cold', 'cool', 'lukewarm', 'warm', 'hot'];
  return (
    <>
      <span className="label">how warm is {name}?</span>
      <div className="warms">
        {I.cold}
        {colors.map((c, i) => <button key={c} style={{ background: c }} aria-label={names[i]} onClick={() => onPick(i + 1)} />)}
        {I.smile}
      </div>
    </>
  );
}
