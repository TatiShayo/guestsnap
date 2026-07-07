import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Images, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { TIERS } from "@/lib/tiers";
import { formatDate, pluralize } from "@/lib/utils";
import { ProPackCta } from "./pro-pack-cta";

export const metadata: Metadata = { title: "Your events" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = getData();
  const events = await data.listEventsByHost(user.id);
  const counts = await Promise.all(events.map((e) => data.countMedia(e.id)));
  const profile = await data.getProfile(user.id);
  const showProPack = events.length >= 2 || (profile?.eventCredits ?? 0) > 0;

  return (
    <div className="grain min-h-screen">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Your events</h1>
            <p className="mt-2 text-muted-foreground">
              {events.length === 0
                ? "Create your first event to get a shareable QR code."
                : pluralize(events.length, "event")}
            </p>
          </div>
          <Link href="/events/new" className={buttonVariants({ size: "default" })}>
            <Plus className="h-4 w-4" /> New event
          </Link>
        </div>

        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, i) => {
              const spec = TIERS[event.tier];
              return (
                <li key={event.id}>
                  <Link
                    href={`/dashboard/${event.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(28,25,23,0.08)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
                        {spec.name}
                      </span>
                      {!event.isActive ? (
                        <span className="text-xs text-muted-foreground">closed</span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 font-display text-xl leading-tight group-hover:text-primary">
                      {event.title}
                    </h2>
                    <div className="mt-auto space-y-1.5 pt-4 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" /> {formatDate(event.eventDate)}
                      </p>
                      <p className="flex items-center gap-2 tabular-nums">
                        <Images className="h-4 w-4" /> {pluralize(counts[i], "photo")}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {showProPack ? <ProPackCta eventCredits={profile?.eventCredits ?? 0} /> : null}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="text-primary/70" aria-hidden>
        <rect x="10" y="18" width="52" height="38" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="26" cy="32" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 52l16-14 10 8 8-6 10 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <p className="mt-5 max-w-xs text-muted-foreground">
        No events yet. Your first one is free — you&apos;ll have a QR code in under a minute.
      </p>
      <Link href="/events/new" className={buttonVariants({ size: "lg", className: "mt-6" })}>
        Create your event
      </Link>
    </div>
  );
}
