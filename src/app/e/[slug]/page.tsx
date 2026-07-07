import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getData, getBlobs } from "@/lib/data";
import { TIERS } from "@/lib/tiers";
import { GuestUploader } from "./guest-uploader";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getData().getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.title} — add your photos`,
    description: `Share your photos and videos from ${event.title}. No app, no account — just tap to upload.`,
    robots: { index: false }, // guest pages are private per-event
  };
}

export default async function GuestUploadPage({ params }: Params) {
  const { slug } = await params;
  const event = await getData().getEventBySlug(slug);
  if (!event) notFound();

  const spec = TIERS[event.tier];
  const used = await getData().countMedia(event.id);
  const remaining = Math.max(0, spec.uploadLimit - used);
  const coverUrl = event.coverPath ? await getBlobs().getSignedUrl(event.coverPath, 3600) : null;
  const closed = !event.isActive || !!event.archivedAt;

  return (
    <main className="grain min-h-screen">
      {/* Cover */}
      <div className="relative h-52 w-full overflow-hidden bg-secondary sm:h-64">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-secondary to-muted" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-5">
          <h1 className="font-display text-3xl text-white drop-shadow sm:text-4xl">{event.title}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 py-7">
        {event.welcomeMessage ? (
          <p className="mb-6 text-center text-[17px] leading-relaxed text-muted-foreground">
            {event.welcomeMessage}
          </p>
        ) : (
          <p className="mb-6 text-center text-[17px] leading-relaxed text-muted-foreground">
            Add your favorite moments. They&apos;ll appear in the host&apos;s gallery right away.
          </p>
        )}

        {closed ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center shadow-soft">
            <p className="font-display text-xl">Uploads are closed</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The host has closed photo collection for this event. Thanks for celebrating with them.
            </p>
          </div>
        ) : (
          <GuestUploader
            slug={event.slug}
            eventId={event.id}
            remaining={remaining}
            unlimited={spec.uploadLimit > 1_000_000}
            tier={event.tier}
            allowGuestbook={spec.videoGuestbook}
          />
        )}

        {spec.watermark ? (
          <p className="mt-10 text-center text-xs text-muted-foreground">
            <Link href="/" className="underline underline-offset-2">
              Powered by GuestSnap
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
