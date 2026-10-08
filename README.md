# ibuiltyouawebsite

The homebase for a one-person web design agency: scan Google Maps for businesses with no website, call them, keep each client's file, book the meetings.

Runs as a website on Cloudflare Pages (this repo) with Supabase for the database. No servers to run.

## Setup, once (about 15 minutes, all in the browser)

1. **Supabase**: open your project → SQL Editor → New query → paste everything from `supabase/schema.sql` → Run. Then Project Settings → API: keep this page open for step 3.
2. **Cloudflare**: dashboard → Workers & Pages → Create → Pages → Connect to Git → pick `ibuiltyouawebsite`.
   - Framework preset: None. Build command: `npm run build`. Build output directory: `dist`.
   - Save and Deploy. The first deploy will fail to log in until step 3 is done; that's fine.
3. **Cloudflare → the project → Settings → Variables and Secrets**, add three (choose "Secret"):
   - `SUPABASE_URL` = the Project URL from the Supabase API page
   - `SUPABASE_SERVICE_KEY` = the `service_role` key from the same page (the long one, not `anon`)
   - `APP_PASSWORD` = any password you like; it's the login for the site
   Then Deployments → Retry deployment.
4. Open the site, log in with that password, go to settings, paste your Outscraper key.
5. Callcenter → type a business type and a few towns → Scan.

## What v1 does

- Scan: Outscraper pulls every listing for the business type in each town, drops anything with a real website, keeps the ones with a phone, scores them, dedupes against everything you've ever scanned.
- Enrich: for each new lead, its Google photos, a phone-number search on Facebook and Instagram, and its best reviews. Runs on its own after a scan.
- Callcenter: the dial list, confirm → schedule → warmth, call back, trash, dropdown with photos and details.
- Leads: one file per confirmed client, notes that save as you type, go-live checklist, photo uploads.
- Calendar: week and month, drag to reschedule, Meet button, dots to open the client.
- Settings: keys, site presets, payment plans, message templates.
- Every Outscraper call is logged to a `costs` table; money tab shows the total.

## Not yet (v2)

Site generation with Claude, the edit chat, publishing to Cloudflare, Stripe payment links, Twilio calling and texting, email sending.

## If a scan errors with "CPU time limit"

Cloudflare's free plan gives each request 10 ms of CPU. A very large scan (hundreds of businesses) can exceed it while saving results. Scan fewer towns at a time, or upgrade Workers to the $5/month paid plan in Cloudflare → Workers & Pages → Plans.
