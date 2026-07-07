import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { config } from "@/lib/config";
import { ShareKit } from "./share-kit";

interface Params {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "QR & share kit" };

export default async function SharePage({ params }: Params) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await getData().getEventBySlug(slug);
  if (!event || event.hostId !== user.id) notFound();

  const guestUrl = `${config.appUrl}/e/${event.slug}`;

  return (
    <div className="grain min-h-screen">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/dashboard/${event.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to gallery
        </Link>

        <h1 className="mt-3 font-display text-4xl">QR & share kit</h1>
        <p className="mt-2 text-muted-foreground">
          Print table cards, or share the link directly. Guests need no app and no account.
        </p>

        <ShareKit slug={event.slug} guestUrl={guestUrl} />
      </main>
    </div>
  );
}
