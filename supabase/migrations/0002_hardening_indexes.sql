-- GuestSnap hardening pass 0002: access-pattern indexes + a race-free
-- upload-limit insert. Apply after 0001. Idempotent (IF NOT EXISTS / OR REPLACE).

-- ── indexes ──────────────────────────────────────────────────────────────
-- Public gallery feed: the hot path filters one event's non-hidden,
-- non-pending media newest-first. A partial index keeps it tiny (moderation
-- state is a small fraction of rows) and matches listMedia()'s default filter.
create index if not exists media_public_feed_idx
  on public.media (event_id, created_at desc)
  where is_hidden = false and needs_review = false;

-- "Own uploads" visibility scopes the feed to one anonymous device key.
create index if not exists media_uploader_key_idx
  on public.media (event_id, uploader_key)
  where uploader_key is not null;

-- Host moderation "needs review" tab.
create index if not exists media_needs_review_idx
  on public.media (event_id)
  where needs_review = true;

-- Payment lookups by session id (webhook fulfillment idempotency anchor).
-- The unique constraint from 0001 already indexes stripe_session_id; this
-- covers the owner's payment history read on the account page.
create index if not exists payments_user_id_idx on public.payments (user_id, created_at desc);

-- Lifecycle cron scans by event date / archive state.
create index if not exists events_lifecycle_idx on public.events (event_date)
  where is_demo = false;

-- ── race-free per-event upload cap ─────────────────────────────────────────
-- The app calls insertMediaWithinLimit(); in Supabase mode it currently uses
-- an insert-then-verify compensation (see src/lib/data/supabase.ts). This
-- function is the fully atomic form — a single statement that inserts only
-- when the event is still under its cap, holding a row lock on the parent
-- event so two concurrent guest uploads can't both slip past the limit.
-- Swap the store's insertMediaWithinLimit body to `rpc('insert_media_within_limit', …)`
-- to adopt it. Runs as SECURITY DEFINER because guests never touch these
-- tables directly — only the service-role server routes do.
create or replace function public.insert_media_within_limit(
  p_event_id uuid,
  p_limit int,
  p_row jsonb
) returns public.media
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_result public.media;
begin
  -- Lock the parent event row so concurrent inserts serialize on the count.
  perform 1 from public.events where id = p_event_id for update;

  select count(*) into v_count from public.media where event_id = p_event_id;
  if v_count >= p_limit then
    return null;
  end if;

  insert into public.media (
    event_id, storage_path, thumb_path, type, uploader_name, uploader_key,
    phash, sharpness, is_hidden, is_favorite, needs_review, flag_reason,
    report_count, is_guestbook, width, height, duration_sec, size_bytes
  )
  select
    p_event_id,
    p_row->>'storage_path',
    p_row->>'thumb_path',
    (p_row->>'type')::public.media_type,
    p_row->>'uploader_name',
    p_row->>'uploader_key',
    p_row->>'phash',
    (p_row->>'sharpness')::double precision,
    coalesce((p_row->>'is_hidden')::boolean, false),
    coalesce((p_row->>'is_favorite')::boolean, false),
    coalesce((p_row->>'needs_review')::boolean, false),
    p_row->>'flag_reason',
    coalesce((p_row->>'report_count')::int, 0),
    coalesce((p_row->>'is_guestbook')::boolean, false),
    (p_row->>'width')::int,
    (p_row->>'height')::int,
    (p_row->>'duration_sec')::double precision,
    coalesce((p_row->>'size_bytes')::bigint, 0)
  returning * into v_result;

  return v_result;
end;
$$;
