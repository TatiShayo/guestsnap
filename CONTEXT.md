# CONTEXT.md — Ubiquitous Domain Language (GuestSnap)

## Core Entities
- **EventGallery**: An event collection owned by an authenticated host, gated by date range and tier limits.
- **SignedQrToken**: An ephemeral HMAC-signed URL token allowing guests to upload media without authenticating.
- **ExifSanitizer**: Pipeline component removing GPS coordinates, device identifiers, and timestamps from uploaded images.
- **GraceBuffer**: Operational storage cushion (10%) preventing upload failures during active celebrations.

## Domain Invariants
- No image binary may be written to permanent storage with intact EXIF GPS tags.
- Guest upload tokens expire automatically 72 hours after the event end date.
- Free event galleries are limited to 100 uploads and 7-day retention.

## Forbidden Terminology
- Do not call event attendees "users"; they are "Guests".
- Do not refer to the host dashboard as "admin panel"; use "HostDashboard".
