import { db, json, bad, getSettings } from '../_lib/db.js';

const SECRET = ['outscraper_key', 'anthropic_key', 'twilio_sid', 'twilio_token', 'cloudflare_token', 'stripe_key'];
const DEFAULTS = {
  presets: [
    { name: 'pools', prompt: 'One page for a residential pool builder. Lead with their best three photos full width, then services as short lines, then reviews pulled from Google, then a quote form. Warm, sunlit, confident. No stock photos. Phone number visible at every scroll position. Use {business}, {owner}, {phone}, {hours}, {services}, {reviews}, {photos}.' },
    { name: 'remodel', prompt: 'One page for a remodel contractor. Before and after pairs first, two per row. Then the process in three steps, then reviews, then a quote form. Calm and precise. Use {business}, {owner}, {phone}, {hours}, {services}, {reviews}, {photos}.' },
    { name: 'construction', prompt: 'One page for a general contractor. Big hero photo of a finished job, then a short list of what they build, then recent projects as a grid, then reviews and a call button. Plain and solid, nothing clever. Use {business}, {owner}, {phone}, {hours}, {services}, {reviews}, {photos}.' },
    { name: 'services', prompt: 'One page for a home services business. Phone number is the hero. Then the three most common jobs with a price range, then reviews, then service area. Fast to read on a phone. Use {business}, {owner}, {phone}, {hours}, {services}, {reviews}, {photos}.' },
  ],
  plans: [],
  tpl_text: "Hey {owner}, it's {me} from the call just now. Here's the site I built for {business}: {link}. Take a look and I'll make any changes you want.",
  tpl_email_subject: 'Your new {business} website',
  tpl_email: "Hi {owner},\n\nGood talking with you. Here's the website I put together for {business}: {link}\n\nEverything on it came from your Google listing and photos, so tell me what to change. If you want it live on your own domain, the plan is {plan}, and you can pay here: {pay_link}\n\n{me}\n{my_phone}",
  tpl_meet: "Hi {owner}, here's the link for our call on {date} at {time}: {meet_link}. Talk soon, {me}",
  tpl_pay: "Hi {owner}, here's the hosting agreement for {business}: {agreement_link}. Your plan is {plan}. When you're ready, pay here and I'll start on the domain: {pay_link}. {me}",
};

export function mask(data) {
  const out = { ...DEFAULTS, ...data };
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
    await db(env).upsert('settings', [{ id: 1, data: next }], 'id');
    return json(mask(next));
  } catch (e) { return bad(e.message, 500); }
}
