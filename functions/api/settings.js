import { db, json, bad, getSettings } from '../_lib/db.js';
import { REMODEL_PROMPT } from '../_lib/remodel-prompt.js';

// Presets saved before this version are the old four and are dropped; edits saved from now on carry the version.
const PRESETS_VERSION = 3;

const SECRET = ['outscraper_key', 'anthropic_key', 'resend_key', 'twilio_sid', 'twilio_token', 'cloudflare_token', 'stripe_key'];
const DEFAULTS = {
  presets: [{ name: 'remodel', prompt: REMODEL_PROMPT }],
  plans: [],
  claude_model: 'claude-fable-5-1',
  claude_effort: 'medium',
  tpl_text: "Hey {owner}, it's {me} from the call just now. Here's the site I built for {business}: {link}. Take a look and I'll make any changes you want.",
  tpl_email_subject: 'Your new {business} website',
  tpl_email: "Hi {owner},\n\nGood talking with you. Here's the website I put together for {business}: {link}\n\nEverything on it came from your Google listing and photos, so tell me what to change. If you want it live on your own domain, the plan is {plan}, and you can pay here: {pay_link}\n\n{me}\n{my_phone}",
  tpl_meet: "Hi {owner}, here's the link for our call on {date} at {time}: {meet_link}. Talk soon, {me}",
  tpl_pay_subject: '{business}: website hosting agreement and payment',
  tpl_pay: "Hi {owner},\n\nThanks again for choosing to move forward. Here is everything to get {business}'s website live:\n\n1. Hosting Agreement: attached to this email as a PDF.\n   Please read it in full. To accept, reply to this email with the words \"I agree\". Your reply constitutes your electronic signature and acceptance of the Hosting Agreement, in accordance with the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN). Completing the payment below also constitutes acceptance of the Agreement.\n\n2. Payment: {pay_link}\n   Plan: {plan}. The link is a secure Stripe checkout; you'll get a receipt by email from Stripe.\n\nOnce I have your reply and the payment confirmation, I'll register your domain and have the site live within a few business days. Reply to this email or call me at {my_phone} with any questions.\n\n{me}\n{my_email}\n{date}",
};

export const presetsOf = (data) => (data.presets_version === PRESETS_VERSION && Array.isArray(data.presets) && data.presets.length ? data.presets : DEFAULTS.presets);

// Settings exactly as the settings tab shows them: saved values over the defaults.
export const withDefaults = (data) => ({ ...DEFAULTS, ...data, presets: presetsOf(data) });

export function mask(data) {
  const out = withDefaults(data);
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
