# TICKETS — GuestSnap Event Collection Pipeline

## [TICKET-001] Signed QR Upload Token Generation & Verification
- **Blocked by**: None
- **Delivers**: HMAC-SHA256 URL token generator granting unauthenticated guest upload permissions.
- **Verification**: Unit tests testing token signature validation and timestamp expiration.

## [TICKET-002] Automated Server-Side EXIF Metadata Sanitizer
- **Blocked by**: TICKET-001
- **Delivers**: Zero-leak image buffer sanitizer stripping GPS, serial numbers, and device tags.
- **Verification**: `tests/exif-sanitization.test.ts`

## [TICKET-003] Live Event Soft-Cap Storage Buffer
- **Blocked by**: TICKET-002
- **Delivers**: 10% grace storage policy with host upgrade trigger webhook.
- **Verification**: Quota calculation tests verifying grace threshold activation.
