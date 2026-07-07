/**
 * Host-only event settings: approve-before-visible toggle, gallery
 * visibility (everyone / own-uploads-only / host-only), hide-uploader-names,
 * and the slideshow PIN (set/change/clear). Re-validates ownership; the PIN
 * is hashed server-side (never stored or returned in plaintext) via the
 * same scrypt helper used by the slideshow-auth route.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData } from "@/lib/data";
import { ApiError, parseBody, withErrorHandling, requireEventOwner } from "@/lib/api";
import { hashPin } from "@/lib/tokens";
import { serverTrack } from "@/lib/analytics-server";

const schema = z.object({
  requireApproval: z.boolean().optional(),
  visibility: z.enum(["gallery", "own", "host"]).optional(),
  hideUploaderNames: z.boolean().optional(),
  // PIN: 4 digits to set/change, "" to clear, omit to leave unchanged.
  slideshowPin: z.union([z.string().regex(/^\d{4}$/), z.literal("")]).optional(),
});

export const PATCH = withErrorHandling(
  "events.settings.patch",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const found = await getData().getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { user, event } = await requireEventOwner(found.id);

    const body = await parseBody(req, schema);
    const patch: Partial<{
      requireApproval: boolean;
      visibility: "gallery" | "own" | "host";
      hideUploaderNames: boolean;
      slideshowPinHash: string | null;
    }> = {};

    if (body.requireApproval !== undefined) patch.requireApproval = body.requireApproval;
    if (body.visibility !== undefined) patch.visibility = body.visibility;
    if (body.hideUploaderNames !== undefined) patch.hideUploaderNames = body.hideUploaderNames;
    if (body.slideshowPin !== undefined) {
      patch.slideshowPinHash = body.slideshowPin === "" ? null : hashPin(body.slideshowPin);
    }

    await getData().updateEvent(event.id, patch);
    await serverTrack(user.id, "event_settings_updated", {
      event_id: event.id,
      changed: Object.keys(patch),
    });

    return NextResponse.json({ ok: true, hasPinSet: patch.slideshowPinHash !== undefined ? !!patch.slideshowPinHash : !!event.slideshowPinHash });
  }
);
