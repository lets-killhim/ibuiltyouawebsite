import { db, json, bad, getSettings } from '../_lib/db.js';
import { REMODEL_PROMPT } from '../_lib/remodel-prompt.js';

// Presets saved before this version are the old four and are dropped; edits saved from now on carry the version.
const PRESETS_VERSION = 2;

const SECRET = ['outscraper_key', 'anthropic_key', 'twilio_sid', 'twilio_token', 'cloudflare_token', 'stripe_key'];
const DEFAULTS = {
  presets: [{ name: 'remodel', prompt: REMODEL_PROMPT }],
  plans: [],
  claude_model: 'claude-fable-5-1',
  tpl_text: "Hey {owner}, it's {me} from the call just now. Here's the site I built for {business}: {link}. Take a look and I'll make any changes you want.",
  tpl_email_subject: 'Your new {business} website',
  tpl_email: "Hi {owner},\n\nGood talking with you. Here's the website I put together for {business}: {link}\n\nEverything on it came from your Google listing and photos, so tell me what to change. If you want it live on your own domain, the plan is {plan}, and you can pay here: {pay_link}\n\n{me}\n{my_phone}",
  tpl_meet: "Hi {owner}, here's the link for our call on {date} at {time}: {meet_link}. Talk soon, {me}",
  tpl_pay: "Hi {owner}, here's the hosting agreement for {business}: {agreement_link}. Your plan is {plan}. When you're ready, pay here and I'll start on the domain: {pay_link}. {me}",
};

export const presetsOf = (data) => (data.presets_version === PRESETS_VERSION && Array.isArray(data.presets) && data.presets.length ? data.presets : DEFAULTS.presets);

export function mask(data) {
  const out = { ...DEFAULTS, ...data, presets: presetsOf(data) };
  for (const k of SECRET) { if (out[k]) { out[k + '_last4'] = String(out[k]).slice(-4); } delete out[k]; }
  out.has_outscraper = !!data.outscraper_key;
  return out;
}

export async function onRequestGet({ env }) {
  try { return json(mask(await getSettings(env))); } catch (e) { return bad(e.message, 500); }
}

export async function onRequestPut({ request, env }) {
  try {
    const patch = await request.json();
    const current = await getSettings(env);
    const next = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (SECRET.includes(k) && (!v || String(v).includes('••••'))) continue;
      next[k] = v;
    }
    if ('presets' in patch) next.presets_version = PRESETS_VERSION;
    await db(env).upsert('settings', [{ id: 1, data: next }], 'id');
    return json(mask(next));
  } catch (e) { return bad(e.message, 500); }
}
