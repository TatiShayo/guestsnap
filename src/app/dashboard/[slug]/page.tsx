import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tv } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { toMediaViews } from "@/lib/media";
import { AppHeader } from "@/components/app-header";
import { TIERS } from "@/lib/tiers";
import { pluralize } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { GalleryGrid } from "./gallery-grid";
import { UpgradePanel } from "./upgrade-panel";

interface Params {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Gallery" };

export default async function HostGalleryPage({ params }: Params) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = getData();
  const event = await data.getEventBySlug(slug);
  if (!event || event.hostId !== user.id) notFound(); // object-level auth: owner only

  const media = await data.listMedia(event.id, { includeHidden: true });
  const views = await toMediaViews(media);
  const spec = TIERS[event.tier];
  const profile = await data.getProfile(user.id);

  return (
    <div className="grain min-h-screen">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All events
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">{event.title}</h1>
            <p className="mt-2 text-muted-foreground tabular-nums">
              {pluralize(media.length, "photo or video")} · {spec.name} plan
            </p>
          </div>
          <a
            href={`/e/${event.slug}/live`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <Tv className="h-4 w-4" /> Live slideshow
          </a>
        </div>

        <GalleryGrid
          slug={event.slug}
          initialMedia={views}
          hideUploaderNames={event.hideUploaderNames}
        />

        <UpgradePanel
          slug={event.slug}
          eventId={event.id}
          tier={event.tier}
          eventCredits={profile?.eventCredits ?? 0}
        />
      </main>
    </div>
  );
}
