/**
 * Shared slideshow-PIN-token verification (server-only). The token is
 * minted by /api/events/[slug]/slideshow-auth after a correct PIN and is
 * scoped to one event id — a token for event A can never unlock event B.
 */
import { verifyToken } from "@/lib/tokens";
import type { EventRecord } from "@/lib/data";

export function hasSlideshowAccess(event: EventRecord, pinToken: string | null): boolean {
  if (!event.slideshowPinHash) return true; // no PIN configured
  if (!pinToken) return false;
  const payload = verifyToken<{ kind: string; eventId: string }>(pinToken);
  return !!payload && payload.kind === "slideshow_access" && payload.eventId === event.id;
}
