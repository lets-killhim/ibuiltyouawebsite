-- ibuiltyouawebsite: run this once in Supabase → SQL Editor → New query → Run.
create extension if not exists pgcrypto;

create table if not exists settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
insert into settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  niche text, where_text text, towns jsonb,
  request_id text, status text default 'pending', error text,
  rows_returned int, no_site int, new_leads int, est_cost_usd numeric,
  created_at timestamptz default now(), finished_at timestamptz
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  scan_id uuid references scans(id),
  name text, phone text, phone_digits text, email text,
  address text, city text, state text, zip text,
  rating numeric, reviews int default 0, category text, hours text, owner text,
  maps_url text, main_photo text, logo text,
  facebook_url text, instagram_url text, fb_match text, ig_match text,
  photos jsonb default '[]'::jsonb, best_reviews jsonb default '[]'::jsonb, blurb text,
  score int default 0, tier text,
  status text default 'new',          -- new | callback | confirmed | trash
  warmth int default 0,               -- 1 cold .. 5 hot
  meeting jsonb,                      -- {date:'2026-10-14', time:'2 PM', notes:''}
  notes text default '',
  site jsonb, live jsonb default '[0,0,0,0]'::jsonb, plan text, pay text, domain text, form_email text,
  enriched_at timestamptz, enrich_error text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists leads_phone on leads(phone_digits);
create index if not exists leads_status on leads(status, score desc);

create table if not exists costs (
  id bigserial primary key,
  at timestamptz default now(),
  what text, units int, usd numeric
);

-- photos you drag into a lead's gallery
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;

-- built sites (added in v1.1): run this block if your database predates it
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  token text unique,
  preset text, version int default 1,
  html text,
  model text, input_tokens int, output_tokens int,
  created_at timestamptz default now()
);
create index if not exists sites_lead on sites(lead_id);
