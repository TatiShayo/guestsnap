import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Create your event" };

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="grain min-h-screen px-6 py-12">
      <div className="mx-auto max-w-lg">
        <Link href="/dashboard" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          ← Your events
        </Link>
        <h1 className="mt-6 font-display text-4xl">Create your event</h1>
        <p className="mt-3 text-muted-foreground">
          It&apos;s free to start. You&apos;ll get a QR code your guests can scan to add their
          photos — no app, no accounts.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <CreateEventForm />
        </div>
      </div>
    </main>
  );
}
