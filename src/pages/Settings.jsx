import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { I } from '../components/ui.jsx';

const KEYS = [
  ['outscraper_key', 'Outscraper, for finding businesses'],
  ['anthropic_key', 'Claude, for writing the sites'],
  ['resend_key', 'Resend, for sending emails'],
  ['twilio_sid', 'Twilio account SID, for calls and texts (v2)'],
  ['twilio_token', 'Twilio auth token (v2)'],
  ['cloudflare_token', 'Cloudflare, for hosting (v2)'],
  ['stripe_key', 'Stripe, for getting paid (v2)'],
];

// Rough cost of one build: ~2k tokens in, ~6k out, at each model's list price.
const MODELS = [
  ['claude-fable-5-1', 'Fable 5.1, best design, ~$1–1.50 a build'],
  ['claude-opus-5-5', 'Opus 5.5, ~40–60¢ a build'],
  ['claude-sonnet-5-5', 'Sonnet 5.5, ~20–30¢ a build'],
];
// How long the model thinks before writing. Thinking is billed like the page itself.
const EFFORTS = [
  ['low', 'low: barely thinks, cheapest and fastest'],
  ['medium', 'medium: thinks some, the default'],
  ['high', 'high: thinks a lot, roughly double the cost and time'],
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const h12 = (h) => `${h % 12 || 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;

// A week strip: click a day, set its hours (or none), tick to save, move to the next.
function WeekEditor({ week, onSave }) {
  const w = week && typeof week === 'object' ? week : {};
  const [day, setDay] = useState(null);
  const [draft, setDraft] = useState(null); // { on, start, end }
  const pick = (i) => { const cur = w[i]; setDay(i); setDraft({ on: !!cur, start: cur ? cur.start : 9, end: cur ? cur.end : 17 }); };
  const commit = () => { const next = { ...w, [day]: draft.on && draft.end > draft.start ? { start: draft.start, end: draft.end } : null }; onSave(next); setDay(null); setDraft(null); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DAYS.map((dn, i) => { const cur = w[i]; const sel = day === i; return (
          <button key={dn} onClick={() => pick(i)} title={cur ? `${h12(cur.start)} to ${h12(cur.end)}` : 'not available'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64, borderRadius: 12, padding: '8px 10px', border: '1px solid ' + (sel ? 'var(--bright)' : cur ? 'var(--sage)' : 'var(--line)'), background: cur ? 'var(--sage)' : 'transparent', color: cur ? 'var(--green)' : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {dn}<span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{cur ? `${cur.start % 12 || 12}–${cur.end % 12 || 12}` : 'off'}</span>
          </button>); })}
      </div>
      {draft && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: 12, borderRadius: 12, background: 'var(--box)' }}>
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--bright)', minWidth: 36 }}>{DAYS[day]}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, alignSelf: 'center' }}><input type="checkbox" checked={draft.on} onChange={(e) => setDraft({ ...draft, on: e.target.checked })} /> available</label>
          {draft.on && (<>
            <label className="field" style={{ fontSize: 13 }}>from<select className="input" value={draft.start} onChange={(e) => setDraft({ ...draft, start: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h12(h)}</option>)}</select></label>
            <label className="field" style={{ fontSize: 13 }}>to<select className="input" value={draft.end} onChange={(e) => setDraft({ ...draft, end: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h + 1} value={h + 1}>{h12(h + 1)}</option>)}</select></label>
          </>)}
          <button className="icon-btn" aria-label="Save day" onClick={commit} disabled={draft.on && draft.end <= draft.start} style={{ background: 'var(--sage)', color: 'var(--green)' }}>{I.check}</button>
          <button className="btn-ghost" onClick={() => { setDay(null); setDraft(null); }}>cancel</button>
        </div>
      )}
    </div>
  );
}

export default function Settings({ settings, onSaved, toast }) {
  const [s, setS] = useState(settings || {});
  const [keys, setKeys] = useState({});
  const [preset, setPreset] = useState((settings?.presets || [])[0]?.name || '');
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planLink, setPlanLink] = useState('');
  const saveT = useRef(null);
  useEffect(() => { setS(settings || {}); if (!preset && settings?.presets?.length) setPreset(settings.presets[0].name); }, [settings]);

  const save = (patch) => {
    const next = { ...s, ...patch }; setS(next);
    clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      try { const saved = await api.saveSettings(patch); onSaved(saved); } catch (e) { toast('Could not save: ' + e.message); }
    }, 500);
  };
  const saveKey = (k, v) => { setKeys((x) => ({ ...x, [k]: v })); if (v && !v.includes('••••')) save({ [k]: v }); };

  const presets = s.presets || [];
  const cur = presets.find((p) => p.name === preset) || presets[0] || { name: '', prompt: '' };
  const setPrompt = (v) => { setDirty(true); save({ presets: presets.map((p) => (p.name === cur.name ? { ...p, prompt: v } : p)) }); };
  const saveAs = () => { const name = newName.trim().toLowerCase(); if (!name || presets.some((p) => p.name === name)) return; save({ presets: [...presets, { name, prompt: cur.prompt }] }); setPreset(name); setNaming(false); setNewName(''); setDirty(false); };
  const plans = s.plans || [];
  const savePlan = () => { if (!planTitle.trim() || !planLink.trim()) return; save({ plans: [...plans, { title: planTitle.trim(), link: planLink.trim() }] }); setPlanTitle(''); setPlanLink(''); };

  const [diag, setDiag] = useState(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [check, setCheck] = useState('');
  const [tl, setTl] = useState({ name: 'TitanCorp', email: '', phone: '' });
  const uploadAgreement = async (f) => { if (!f) return; try { const u = await api.upload('agreement', f); save({ agreement_file: { url: u.url, name: f.name } }); toast('agreement uploaded'); } catch (e) { toast('Upload failed: ' + e.message); } };
  const addTest = async () => { try { await api.addLead(tl.name, tl.email, tl.phone); toast(`${tl.name} added to the callcenter`); } catch (e) { toast('Could not add: ' + e.message); } };
  const runDiag = async () => { setDiagBusy(true); setDiag(null); try { setDiag(await api.diag(s.last_niche || 'pool builders', (s.last_where || 'Scottsdale AZ').split(',')[0].trim(), check.trim() || undefined)); } catch (e) { setDiag({ error: e.message }); } setDiagBusy(false); };
  const T = (k, label, rows) => (
    <label className="field" style={{ fontSize: 13 }}>{label}<textarea className="input" rows={rows} value={s[k] || ''} onChange={(e) => save({ [k]: e.target.value })} /></label>
  );

  return (
    <div className="page">
      <div className="head"><h1>Your <em>setup.</em></h1><span className="small muted" style={{ paddingBottom: 8 }}>everything here saves as you type; keys are stored on your server and never shown again in full</span></div>
      <div className="cols3">
        <div className="col">
          <span className="sect">keys</span>
          {KEYS.map(([k, label]) => (
            <label key={k} className="field" style={{ fontSize: 13 }}>{label}
              <input className="input" value={keys[k] ?? (s[k + '_last4'] ? '••••••••' + s[k + '_last4'] : '')} onChange={(e) => saveKey(k, e.target.value)} placeholder={k === 'outscraper_key' ? 'paste the key from outscraper.com → API' : k === 'resend_key' ? 'resend.com → API Keys' : 'not needed yet'} />
            </label>
          ))}
          <label className="field" style={{ fontSize: 13 }}>Claude model for site builds
            <select className="input" value={s.claude_model || 'claude-fable-5-1'} onChange={(e) => save({ claude_model: e.target.value })}>
              {MODELS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="field" style={{ fontSize: 13 }}>how hard it thinks per build
            <select className="input" value={s.claude_effort || 'medium'} onChange={(e) => save({ claude_effort: e.target.value })}>
              {EFFORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="field" style={{ fontSize: 13 }}>your name, as you sign messages<input className="input" value={s.me || ''} onChange={(e) => save({ me: e.target.value })} /></label>
          <label className="field" style={{ fontSize: 13 }}>your phone<input className="input" value={s.my_phone || ''} onChange={(e) => save({ my_phone: e.target.value })} /></label>
          <label className="field" style={{ fontSize: 13 }}>your sending email<input className="input" value={s.my_email || ''} onChange={(e) => save({ my_email: e.target.value })} placeholder="titan@ibuiltyouawebsite.xyz, on the domain you verified in Resend" /></label>

          <div className="col" style={{ borderTop: '1px solid var(--line)', paddingTop: 16, gap: 12 }}>
            <span className="sect">booking link</span>
            <span className="small muted">{'{book_link}'} in any message opens a page where they pick a slot from this week's hours; it lands on your calendar as a confirmed meeting</span>
            <WeekEditor week={s.book_week} onSave={(week) => save({ book_week: week })} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label className="field" style={{ fontSize: 13, flex: '1 1 100px' }}>slot<select className="input" value={s.book_slot ?? 30} onChange={(e) => save({ book_slot: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
              <label className="field" style={{ fontSize: 13, flex: '1 1 100px' }}>days ahead<select className="input" value={s.book_ahead ?? 30} onChange={(e) => save({ book_ahead: Number(e.target.value) })}>{[14, 30, 45, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="field" style={{ fontSize: 13, flex: '1 1 100px' }}>notice<select className="input" value={s.book_buffer_hours ?? 2} onChange={(e) => save({ book_buffer_hours: Number(e.target.value) })}>{[0, 1, 2, 4, 24].map((n) => <option key={n} value={n}>{n === 0 ? 'none' : n + ' h'}</option>)}</select></label>
              <label className="field" style={{ fontSize: 13, flex: '1 1 160px' }}>time zone<select className="input" value={s.book_tz || 'America/Los_Angeles'} onChange={(e) => save({ book_tz: e.target.value })}>{['America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/New_York', 'Pacific/Honolulu', 'America/Anchorage'].map((z) => <option key={z} value={z}>{z.split('/')[1].replace('_', ' ')}</option>)}</select></label>
            </div>
          </div>

          <div className="col" style={{ borderTop: '1px solid var(--line)', paddingTop: 16, gap: 12 }}>
            <span className="sect">payment plans</span>
            <span className="small muted">make the plan in Stripe, paste its payment link here, give it a name; it shows up in the leads tab</span>
            {plans.map((p, i) => (
              <div key={p.title} className="plan"><span style={{ color: 'var(--bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span><button className="icon-btn" aria-label="Remove plan" onClick={() => save({ plans: plans.filter((_, j) => j !== i) })} style={{ width: 32, height: 32 }}>{I.x}</button></div>
            ))}
            <input className="input" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder="plan name, e.g. $1,000 build + $100 a month" />
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={planLink} onChange={(e) => setPlanLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') savePlan(); }} placeholder="https://buy.stripe.com/…" />
              <button className={'btn-sage' + (planTitle.trim() && planLink.trim() ? '' : ' off')} onClick={savePlan}>save</button>
            </div>
          </div>
        </div>

        <div className="col">
          <span className="sect">site presets</span>
          <select className="input" value={cur.name} onChange={(e) => { setPreset(e.target.value); setNaming(false); setDirty(false); }}>
            {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <label className="field" style={{ fontSize: 13, flex: '1 1 auto' }}>design prompt<textarea className="input" rows={24} style={{ fontSize: 12, lineHeight: 1.45 }} value={cur.prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          {!naming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className={'btn-sage' + (dirty ? '' : ' off')} onClick={() => setNaming(true)}>Save as new preset</button>
              {dirty && <span className="small muted">edits to {cur.name} are kept; save as new to keep both</span>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveAs(); if (e.key === 'Escape') setNaming(false); }} placeholder="name it, then Enter" style={{ borderRadius: 999, borderColor: 'var(--sage)' }} />
              <button className="btn-ghost" onClick={() => setNaming(false)}>cancel</button>
            </div>
          )}
          <span className="small muted">this whole text is the system prompt for a build; the app fills the CLIENT BRIEF block at the bottom from the lead</span>
        </div>

        <div className="col">
          <span className="sect">send the link</span>
          {T('tpl_text', 'text, opens in your Messages app from your own number', 4)}
          <label className="field" style={{ fontSize: 13 }}>email subject<input className="input" value={s.tpl_email_subject || ''} onChange={(e) => save({ tpl_email_subject: e.target.value })} /></label>
          {T('tpl_email', 'email body', 7)}
          {T('tpl_meet', 'meeting invite, sent with a fresh Google Meet link each time', 3)}
          <label className="field" style={{ fontSize: 13 }}>hosting agreement email subject<input className="input" value={s.tpl_pay_subject || ''} onChange={(e) => save({ tpl_pay_subject: e.target.value })} /></label>
          {T('tpl_pay', 'hosting agreement and payment email, sent from the leads tab', 12)}
          <div className="field" style={{ fontSize: 13 }}>hosting agreement, attached to the invoice email
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn-sage" style={{ cursor: 'pointer' }}>{s.agreement_file ? 'replace file' : 'upload PDF'}<input type="file" accept=".pdf,.doc,.docx" onChange={(e) => uploadAgreement(e.target.files[0])} style={{ display: 'none' }} /></label>
              {s.agreement_file ? <a href={s.agreement_file.url} target="_blank" rel="noreferrer" style={{ color: 'var(--bright)' }}>{s.agreement_file.name}</a> : <span className="small muted">none yet</span>}
            </div>
          </div>
          <span className="small muted">fields in braces fill in from the lead: {'{business} {owner} {phone} {link} {book_link} {plan} {pay_link} {meet_link} {date} {time} {me} {my_phone} {my_email}'}</span>
        </div>
      </div>
      <div className="col" style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
        <span className="sect">diagnostics</span>
        <span className="small muted">runs one tiny live scan (3 businesses, a few photos, one search) and shows exactly what Outscraper sends back. Costs under a cent. Copy the output and paste it to Claude when something looks wrong.</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" value={check} onChange={(e) => setCheck(e.target.value)} placeholder='check one business: "Austin Remodeling Experts, Austin TX" (leave empty for the full test)' style={{ flex: '1 1 360px' }} />
          <button className="btn-sage" onClick={runDiag} disabled={diagBusy}>{diagBusy ? 'running, up to a minute' : check.trim() ? 'check this business' : 'test Outscraper'}</button>
          {diag && <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(JSON.stringify(diag, null, 2)); toast('copied'); }}>copy output</button>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <span className="small muted">add a test lead (no scraping):</span>
          <input className="input" value={tl.name} onChange={(e) => setTl({ ...tl, name: e.target.value })} placeholder="name" style={{ width: 160 }} />
          <input className="input" value={tl.email} onChange={(e) => setTl({ ...tl, email: e.target.value })} placeholder="email" style={{ width: 240 }} />
          <input className="input" value={tl.phone} onChange={(e) => setTl({ ...tl, phone: e.target.value })} placeholder="phone, optional" style={{ width: 160 }} />
          <button className="btn-sage" onClick={addTest}>add</button>
        </div>
        {diag && <pre className="input" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.4, maxHeight: 420, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{JSON.stringify(diag, null, 2)}</pre>}
      </div>
    </div>
  );
}
