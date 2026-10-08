import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api.js';
import { Strip, Pill, useToast } from './components/ui.jsx';
import Callcenter from './pages/Callcenter.jsx';
import Leads from './pages/Leads.jsx';
import Calendar from './pages/Calendar.jsx';
import Settings from './pages/Settings.jsx';

const readHash = () => { const [tab, arg] = (location.hash || '#home').slice(1).split('/'); return { tab: tab || 'home', arg: arg || null }; };

export default function App() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [route, setRoute] = useState(readHash());
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState({});
  const [summary, setSummary] = useState({});
  const [toastEl, toast] = useToast();

  const go = (tab, arg) => { location.hash = arg ? `${tab}/${arg}` : tab; };
  useEffect(() => { const h = () => setRoute(readHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);

  const refreshCounts = useCallback(async () => {
    try { const s = await api.summary(); setSummary(s); setCounts({ callcenter: s.to_call || '', leads: s.clients || '' }); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try { const s = await api.settings(); setSettings(s); setAuthed(true); refreshCounts(); }
      catch (e) { setAuthed(e instanceof ApiError && e.status === 401 ? false : false); if (!(e instanceof ApiError && e.status === 401)) toast('Server not reachable: ' + e.message); }
    })();
  }, []);

  if (authed === null) return <div className="login"><span className="muted">one second</span></div>;
  if (!authed) return <Login onDone={async () => { setAuthed(true); setSettings(await api.settings()); refreshCounts(); }} toast={toast} />;

  const page = route.tab;
  return (
    <div className="app">
      <Strip tab={page} go={go} counts={counts} />
      {page === 'home' && <Home summary={summary} go={go} />}
      {page === 'callcenter' && <Callcenter settings={settings} toast={toast} refreshCounts={refreshCounts} />}
      {page === 'leads' && <Leads settings={settings} openId={route.arg} toast={toast} refreshCounts={refreshCounts} />}
      {page === 'calendar' && <Calendar go={go} toast={toast} />}
      {page === 'money' && <Money summary={summary} />}
      {page === 'settings' && <Settings settings={settings} onSaved={setSettings} toast={toast} />}
      {toastEl}
    </div>
  );
}

function Login({ onDone, toast }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.login(pw); onDone(); } catch (err) { toast(err.status === 401 ? 'Wrong password' : err.message); } setBusy(false); };
  return (
    <div className="login">
      <form onSubmit={submit}>
        <span style={{ fontSize: 40, letterSpacing: '-0.03em', color: 'var(--txt)' }}>ibuiltyou<em>awebsite</em></span>
        <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password" autoFocus />
        <Pill disabled={busy}>Come in</Pill>
        <span className="small muted">the password is the APP_PASSWORD you set in Cloudflare</span>
      </form>
    </div>
  );
}

function Home({ summary, go }) {
  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 76px)' }}>
      <div className="home-top">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="#BFE0B8" aria-hidden="true"><circle cx="28" cy="12" r="7" /><circle cx="28" cy="44" r="7" /><circle cx="12" cy="28" r="7" /><circle cx="44" cy="28" r="7" /><circle cx="16.7" cy="16.7" r="7" /><circle cx="39.3" cy="39.3" r="7" /><circle cx="16.7" cy="39.3" r="7" /><circle cx="39.3" cy="16.7" r="7" /><circle cx="28" cy="28" r="6" fill="#0F3B2E" /></svg>
        <div className="home-nums label">
          <button onClick={() => go('callcenter')}>{summary.to_call || 0} to call</button>
          <button onClick={() => go('leads')}>{summary.clients || 0} clients</button>
          <button onClick={() => go('calendar')}>{summary.meetings_week || 0} meetings this week</button>
        </div>
      </div>
      <div className="wordmark">ibuiltyou<em>awebsite</em></div>
    </div>
  );
}

function Money({ summary }) {
  return (
    <div className="page">
      <div className="head"><h1>{new Date().toLocaleDateString('en-US', { month: 'long' })} <em>so far.</em></h1></div>
      <div style={{ display: 'flex', gap: 72, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--bright)' }}>$0</div><div className="small muted">collected</div></div>
        <div><div style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--bright)' }}>$0</div><div className="small muted">a month, recurring</div></div>
        <div><div style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--muted)' }}>${(summary.spend_usd || 0).toFixed(2)}</div><div className="small muted">spent on scraping so far</div></div>
      </div>
      <span className="small muted">Stripe payments and receipts arrive in v2. The scraping spend is real, logged from every Outscraper call.</span>
    </div>
  );
}
