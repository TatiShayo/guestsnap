-- GuestSnap initial schema. Apply with `supabase db push` or the SQL editor.
-- RLS: default-deny on every table, explicit host policies. Guest uploads and
-- public gallery reads NEVER hit these tables directly — they go through
-- server routes using the service role after event-access checks.

-- ── profiles ────────────────────────────────────────────────────────────
-- Retention: kept while the account exists; self-serve delete cascades.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  referral_code text not null default ('GS-' || upper(substr(md5(random()::text), 1, 6))),
  event_credits int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: owner update name" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- inserts happen server-side (service role) on first login

-- ── events ──────────────────────────────────────────────────────────────
-- Retention: media purged per retention_months (90 days free, 12–24mo paid),
-- soft archive (archived_at) with 30-day grace, then hard purge by cron.
create type public.event_tier as enum ('free', 'standard', 'premium');
create type public.event_type as enum ('wedding', 'birthday', 'funeral', 'corporate', 'other');
create type public.event_visibility as enum ('gallery', 'own', 'host');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  title text not null,
  event_type public.event_type not null default 'other',
  event_date date not null,
  cover_url text,
  tier public.event_tier not null default 'free',
  brand_color text,
  welcome_message text,
  upload_limit int not null default 20,
  is_active boolean not null default true,
  require_approval boolean not null default false,
  visibility public.event_visibility not null default 'gallery',
  slideshow_pin_hash text,
  hide_uploader_names boolean not null default false,
  retention_months int not null default 3,
  is_demo boolean not null default false,
  archived_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now()
);

create index events_host_id_idx on public.events (host_id);
create index events_slug_idx on public.events (slug);

alter table public.events enable row level security;

create policy "events: host all" on public.events
  for all using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ── media ───────────────────────────────────────────────────────────────
-- Retention: rows + storage objects removed with the event or by lifecycle
-- purge; guests' EXIF/GPS already stripped at upload (server re-encode).
create type public.media_type as enum ('photo', 'video');

create table public.media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  type public.media_type not null default 'photo',
  uploader_name text,
  uploader_key text,
  phash text,
  sharpness double precision,
  is_hidden boolean not null default false,
  is_favorite boolean not null default false,
  needs_review boolean not null default false,
  flag_reason text,
  report_count int not null default 0,
  is_guestbook boolean not null default false,
  width int,
  height int,
  duration_sec double precision,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index media_event_id_idx on public.media (event_id, created_at desc);

alter table public.media enable row level security;

create policy "media: host all" on public.media
  for all using (exists (select 1 from public.events e where e.id = media.event_id and e.host_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = media.event_id and e.host_id = auth.uid()));

-- ── payments ────────────────────────────────────────────────────────────
-- Retention: financial records kept 7 years (accounting requirement).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  user_id uuid not null,
  provider text not null default 'stripe',
  stripe_session_id text not null unique,
  amount int not null,
  sku text not null,
  add_ons text[] not null default '{}',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "payments: owner read" on public.payments
  for select using (auth.uid() = user_id);
-- writes are service-role only (webhook fulfillment)

-- ── processed_webhooks (idempotency) ────────────────────────────────────
-- Retention: prune rows older than 90 days via lifecycle cron.
create table public.processed_webhooks (
  id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.processed_webhooks enable row level security;
-- no policies: service-role only

-- ── album_subscribers (guest growth loop) ───────────────────────────────
-- Retention: deleted with the event; guests can unsubscribe via email link.
create table public.album_subscribers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);
alter table public.album_subscribers enable row level security;
-- no policies: service-role only (emails are PII — hosts never see them raw)

-- ── email_sends (lifecycle dedupe) ──────────────────────────────────────
-- Retention: prune rows older than 24 months via lifecycle cron.
create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  recipient text not null,
  event_id uuid,
  sent_at timestamptz not null default now()
);
create index email_sends_dedupe_idx on public.email_sends (kind, recipient, event_id);
alter table public.email_sends enable row level security;
-- no policies: service-role only

-- ── audit_log (admin actions) ───────────────────────────────────────────
-- Retention: kept 24 months.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
-- no policies: service-role only

-- ── storage: private media bucket ───────────────────────────────────────
-- Private by default; all reads via short-lived signed URLs issued by the
-- server after an event-access check. No public bucket listing.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;
