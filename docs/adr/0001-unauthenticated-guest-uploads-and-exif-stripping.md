# ADR 0001: Signed QR Upload Tokens and Mandatory EXIF Stripping

## Context
GuestSnap relies on zero-friction event photo uploads. Requiring app downloads or logins destroys guest participation. However, raw photo uploads pose significant privacy risks due to embedded GPS metadata.

## Decision
1. **Signed QR Tokens**: Upload access is authorized via HMAC-SHA256 signed event tokens embedded in QR codes.
2. **Mandatory EXIF Stripping**: All uploaded image buffers pass through `sanitizeExifData` prior to persistence.
3. **Event Soft-Cap**: Active events receive a 10% grace buffer above plan limits to avoid event disruption.

## Consequences
- **Positive**: Complete guest privacy protection and zero upload friction.
- **Negative**: Removes photo capture timestamps, requiring server reception time for chronological sorting.
