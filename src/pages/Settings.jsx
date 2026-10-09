import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { I } from '../components/ui.jsx';

const KEYS = [
  ['outscraper_key', 'Outscraper, for finding businesses'],
  ['anthropic_key', 'Claude, for writing the sites'],
  ['twilio_sid', 'Twilio account SID, for calls and texts (v2)'],
  ['twilio_token', 'Twilio auth token (v2)'],
  ['cloudflare_token', 'Cloudflare, for hosting (v2)'],
  ['stripe_key', 'Stripe, for getting paid (v2)'],
];

// Rough cost of one build: ~2k tokens in, ~6k out, at each model's list price.
const MODELS = [
  ['claude-fable-5-1', 'Fable 5.1, best design, ~40¢ a build'],
  ['claude-opus-5-5', 'Opus 5.5, ~15¢ a build'],
  ['claude-sonnet-5-5', 'Sonnet 5.5, ~7¢ a build'],
];

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
              <input className="input" value={keys[k] ?? (s[k + '_last4'] ? '••••••••' + s[k + '_last4'] : '')} onChange={(e) => saveKey(k, e.target.value)} placeholder={k === 'outscraper_key' ? 'paste the key from outscraper.com → API' : 'not needed yet'} />
            </label>
          ))}
          <label className="field" style={{ fontSize: 13 }}>Claude model for site builds
            <select className="input" value={s.claude_model || 'claude-fable-5-1'} onChange={(e) => save({ claude_model: e.target.value })}>
              {MODELS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="field" style={{ fontSize: 13 }}>your name, as you sign messages<input className="input" value={s.me || ''} onChange={(e) => save({ me: e.target.value })} /></label>
          <label className="field" style={{ fontSize: 13 }}>your phone<input className="input" value={s.my_phone || ''} onChange={(e) => save({ my_phone: e.target.value })} /></label>
          <label className="field" style={{ fontSize: 13 }}>your sending email<input className="input" value={s.my_email || ''} onChange={(e) => save({ my_email: e.target.value })} /></label>

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
          <label className="field" style={{ fontSize: 13, flex: '1 1 auto' }}>design prompt<textarea className="input" rows={11} value={cur.prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
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
          <span className="small muted">the preset is a finished layout; the prompt only decides tone and which scraped fields go where</span>
        </div>

        <div className="col">
          <span className="sect">send the link</span>
          {T('tpl_text', 'text, sent from your Twilio number', 4)}
          <label className="field" style={{ fontSize: 13 }}>email subject<input className="input" value={s.tpl_email_subject || ''} onChange={(e) => save({ tpl_email_subject: e.target.value })} /></label>
          {T('tpl_email', 'email body', 7)}
          {T('tpl_meet', 'meeting invite, sent with a fresh Google Meet link each time', 3)}
          {T('tpl_pay', 'hosting agreement and payment message', 5)}
          <label className="field" style={{ fontSize: 13 }}>hosting agreement link<input className="input" value={s.agreement_link || ''} onChange={(e) => save({ agreement_link: e.target.value })} placeholder="link to your agreement PDF or e-sign page" /></label>
          <span className="small muted">fields in braces fill in from the lead: {'{business} {owner} {phone} {link} {plan} {pay_link} {agreement_link} {meet_link} {date} {time} {me} {my_phone}'}</span>
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
        {diag && <pre className="input" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.4, maxHeight: 420, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{JSON.stringify(diag, null, 2)}</pre>}
      </div>
    </div>
  );
}
