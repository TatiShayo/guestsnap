# analytics.md — PostHog event catalog

Naming: `object_action` (PLAYBOOK Part 5). No PII in properties — ids only.
Client events fire through `useAnalytics()` (src/components/analytics-provider.tsx);
server events through `serverTrack()` (src/lib/analytics-server.ts). With no
`NEXT_PUBLIC_POSTHOG_KEY` both are console no-ops, so instrumentation is always on.

| Event | Where | Properties | Fires when |
|---|---|---|---|
| `$pageview` | client | `path` | every route change |
| `signup_started` | client | — | magic-link form submitted |
| `signup_completed` | server | `user_id` | first login creates profile |
| `event_created` | server | `event_id`, `event_type`, `tier` | host creates an event |
| `qr_downloaded` | client | `event_id`, `format` (png/pdf) | QR or table-card kit downloaded |
| `guest_page_viewed` | client | `event_id` | guest opens /e/[slug] |
| `guest_upload_started` | client | `event_id`, `file_count` | guest starts an upload batch |
| `guest_upload_completed` | server | `event_id`, `media_id`, `type` | media stored successfully |
| `guest_upload_rejected` | server | `event_id`, `reason` | validation/moderation rejection |
| `upload_limit_hit` | server | `event_id`, `tier` | upload blocked by tier limit |
| `album_email_captured` | server | `event_id` | guest subscribes to album email |
| `slideshow_viewed` | client | `event_id` | live slideshow opened |
| `guestbook_recorded` | client | `event_id` | video guestbook clip recorded |
| `upgrade_viewed` | client | `event_id`, `source` | pricing/upgrade UI viewed |
| `checkout_started` | server | `event_id`, `sku`, `with_bump` | checkout session created |
| `upgrade_paid` | server | `event_id`, `sku`, `amount_cents` | webhook fulfillment done |
| `upsell_accepted` | server | `event_id` | post-purchase premium upsell paid |
| `zip_downloaded` | server | `event_id` | host downloads ZIP export |
| `media_moderated` | server | `event_id`, `action` (hide/show/delete/favorite/approve) | host moderation action |
| `media_reported` | server | `event_id` | guest reports a media item |
| `referral_code_copied` | client | — | host copies referral code |
| `demo_viewed` | client | — | landing visitor opens the demo event |
| `event_settings_updated` | server | `event_id`, `changed` | host changes moderation/privacy settings |
| `culling_group_resolved` | client | `event_id` | host keeps sharpest + hides rest of a duplicate group |
| `lifecycle_cron_ran` | server | counts per job | daily lifecycle cron completes |

## Funnels (build in PostHog day 1)
1. Acquisition → activation: `$pageview` (landing) → `signup_completed` → `event_created` → `guest_upload_completed` (first = activation event)
2. Monetization: `upgrade_viewed` → `checkout_started` → `upgrade_paid`
3. Growth loop: `guest_page_viewed` → `album_email_captured` → `signup_completed`

North-star metric: events with ≥5 guest uploads per week.
