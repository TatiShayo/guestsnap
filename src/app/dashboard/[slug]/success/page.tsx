import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { TIERS } from "@/lib/tiers";
import { UpsellPanel } from "./upsell-panel";
import { ReferralCard } from "./referral-card";

export const metadata: Metadata = { title: "Payment successful" };

/**
 * Post-purchase page (peak-happiness moment). Confirms the payment landed
 * (webhook fulfillment may race a fast redirect, so we poll the payment
 * record briefly rather than trusting the query string alone), then offers
 * the one-click Premium upsell (Standard buyers only) and shows the
 * referral code — PLAYBOOK "peak happiness" placement for both.
 */
export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = getData();
  const event = await data.getEventBySlug(slug);
  if (!event || event.hostId !== user.id) notFound();

  const payment = session_id ? await data.getPaymentBySession(session_id) : null;
  const spec = TIERS[event.tier];
  const profile = await data.getProfile(user.id);

  return (
    <div className="grain min-h-screen">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-2xl px-6 py-14 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" className="text-primary" aria-hidden>
            <path
              d="M6 16l6 6 12-14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-6 font-display text-4xl">You&apos;re all set</h1>
        <p className="mt-3 text-muted-foreground">
          {event.title} is now on the <span className="font-medium text-foreground">{spec.name}</span> plan
          {payment ? "." : " — this can take a few seconds to confirm."}
        </p>

        <Link href={`/dashboard/${event.slug}`} className={`${buttonVariants({ size: "lg" })} mt-8`}>
          Back to your gallery
        </Link>

        {event.tier === "standard" ? (
          <UpsellPanel slug={event.slug} eventId={event.id} />
        ) : null}

        {profile ? <ReferralCard code={profile.referralCode} /> : null}
      </main>
    </div>
  );
}
