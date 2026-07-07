import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { LiveSlideshow } from "./live-slideshow";
import { PinGate } from "./pin-gate";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getData().getEventBySlug(slug);
  return { title: event ? `${event.title} — live` : "Live slideshow", robots: { index: false } };
}

/** Cast-to-TV slideshow — the product's signature interaction (PLAYBOOK).
 *  Server component just resolves the event + whether a PIN gate is needed;
 *  all polling/animation lives client-side in LiveSlideshow. */
export default async function LiveSlideshowPage({ params }: Params) {
  const { slug } = await params;
  const event = await getData().getEventBySlug(slug);
  if (!event || event.visibility === "host") notFound();

  if (event.slideshowPinHash) {
    return <PinGate slug={slug} title={event.title} />;
  }

  return (
    <LiveSlideshow
      slug={slug}
      title={event.title}
      brandColor={event.brandColor}
      watermark={event.tier === "free"}
    />
  );
}
