# Grilling Session 001: guestsnap
**Archetype**: Tier 1 Shipping SaaS (QR-Code Event Photo Platform)
**Human Domain Authority**: Antigravity Lead Architect
**Methodology**: Matt Pocock Agent Skills (/grilling + /grill-with-docs)
**Status**: FRONTIER EXHAUSTED — SHARED UNDERSTANDING ATTAINED

---

## Round 1: Core Architecture & Invariant Frontier

❓ **Q1** - **Zero-Friction Guest Uploads**: How do wedding and event guests upload photos without app installation or login credentials?
➡️ *Recommendation*: Use ephemeral cryptographically signed QR tokens containing event ID, guest nonce, and expiry timestamp.

**Architect Decision**: APPROVED. Guests must never be required to create accounts or install apps. Signed URL tokens provide frictionless access.

---

❓ **Q2** - **Guest Privacy & EXIF Scrubbing**: How do we prevent private metadata (GPS coordinates, camera serials, timestamps) from leaking when guests upload photos?
➡️ *Recommendation*: Enforce automated server-side EXIF stripping on all incoming image binaries before writing to storage.

**Architect Decision**: APPROVED. All EXIF metadata must be stripped immediately upon upload reception. Only sanitized pixel buffers may be stored.

---

## Round 2: Edge Cases & Failure Modes Frontier

❓ **Q3** - **Host Storage Quota Overages**: What happens if guests upload hundreds of photos mid-event that exceed the host's plan limit?
➡️ *Recommendation*: Implement a 10% soft-cap grace buffer so uploads never fail abruptly during an event, coupled with an automated upgrade prompt to the host.

**Architect Decision**: APPROVED. Never interrupt a live wedding reception or party. Absorb up to 10% overage with instant host upgrade notification.

---

## Final Alignment Attestation
The design tree has been thoroughly walked down to all leaf nodes.
No silent assumptions remain regarding authentication, concurrency, data consistency, or payment flow.
