"use server";

/**
 * Create-event server action. Re-validates the session server-side (never
 * trusts the client for host identity), resolves tier/limits from the server
 * source of truth, generates an anti-enumeration slug, optionally stores a
 * re-encoded (EXIF-stripped) cover image, then redirects to the dashboard.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getBlobs, getData } from "@/lib/data";
import { generateEventSlug } from "@/lib/slug";
import { TIERS } from "@/lib/tiers";
import { processImage } from "@/lib/image";
import { validateUpload } from "@/lib/upload-validation";
import { serverTrack } from "@/lib/analytics-server";
import { captureError } from "@/lib/monitoring";

const schema = z.object({
  title: z.string().trim().min(2, "Give your event a name").max(80),
  eventType: z.enum(["wedding", "birthday", "funeral", "corporate", "other"]),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  welcomeMessage: z.string().trim().max(300).optional(),
});

export type CreateEventState = { error?: string } | null;

export async function createEventAction(
  _prev: CreateEventState,
  formData: FormData
): Promise<CreateEventState> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    title: formData.get("title"),
    eventType: formData.get("eventType"),
    eventDate: formData.get("eventDate"),
    welcomeMessage: formData.get("welcomeMessage") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const input = parsed.data;

  // Free-tier defaults; upgrades happen through checkout only.
  const free = TIERS.free;
  const data = getData();

  // Unique slug (retry a few times against the tiny collision chance).
  let slug = generateEventSlug(input.title);
  for (let i = 0; i < 5 && (await data.getEventBySlug(slug)); i++) {
    slug = generateEventSlug(input.title);
  }

  // Optional cover image — re-encoded through sharp (strips EXIF/GPS).
  let coverPath: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    try {
      const buf = Buffer.from(await cover.arrayBuffer());
      const check = await validateUpload(buf);
      if (check.ok && check.value.kind === "photo") {
        const processed = await processImage(buf);
        coverPath = `events/${slug}/cover.jpg`;
        await getBlobs().put(coverPath, processed.original, "image/jpeg");
      }
    } catch (e) {
      captureError(e, { where: "events.new.cover" });
      // Non-fatal: proceed without a cover rather than blocking event creation.
    }
  }

  let event;
  try {
    event = await data.createEvent({
      hostId: user.id,
      slug,
      title: input.title,
      eventType: input.eventType,
      eventDate: input.eventDate,
      coverPath,
      tier: "free",
      brandColor: null,
      welcomeMessage: input.welcomeMessage ?? null,
      uploadLimit: free.uploadLimit,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: free.retentionMonths,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });
  } catch (e) {
    captureError(e, { where: "events.new.create" });
    return { error: "We couldn't create the event. Please try again." };
  }

  await serverTrack(user.id, "event_created", {
    event_id: event.id,
    event_type: event.eventType,
    tier: event.tier,
  });

  redirect(`/dashboard/${event.slug}`);
}
