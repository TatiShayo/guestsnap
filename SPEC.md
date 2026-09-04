# SPEC 001: Frictionless Event Photo Collection & Privacy Engine

## Problem Statement
Event hosts struggle to gather photos from wedding and party guests because apps require cumbersome downloads and accounts, while raw uploads expose sensitive guest location data.

## Solution
A QR-based photo collection system allowing unauthenticated, cryptographically signed guest uploads with automated server-side EXIF metadata stripping and host storage management.

## User Stories
1. As an event guest, I want to scan a QR code at my table and immediately upload photos, without creating an account or downloading an app.
2. As an event guest, I want my phone's location and device metadata stripped from photos, so that my personal privacy is protected.
3. As an event host, I want a live photo gallery of all guest submissions, so that I can relive my event in real time.
4. As an event host, I want upload grace allowances if my guests take more photos than my plan limit, so that my event is not disrupted.

## Implementation Decisions
- Implement signed token generation in `lib/tokens.ts`.
- Server-side EXIF stripping pipeline in `lib/exif.ts`.
- Host upgrade modal with Stripe Checkout integration on `/pricing`.

## Testing Decisions
- Seam: `tests/exif-sanitization.test.ts`.
- Verify complete removal of GPS, camera serials, and device metadata from sample JPEG/HEIC binaries.
