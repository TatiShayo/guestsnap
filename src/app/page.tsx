import Link from "next/link";

// Placeholder home — replaced by the full marketing landing in the
// marketing milestone. Kept on-theme so the scaffold screenshot passes.
export default function HomePage() {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-sm uppercase tracking-[0.2em] text-muted-foreground">GuestSnap</p>
      <h1 className="max-w-2xl text-balance font-display text-5xl sm:text-6xl">
        Every guest&apos;s photos. One QR code.
      </h1>
      <p className="mt-5 max-w-md text-muted-foreground">
        Guests upload from their phone browser — no app, no accounts. We&apos;re setting up. Come back soon.
      </p>
      <Link
        href="/login"
        className="mt-8 rounded-md bg-primary px-6 py-3 text-primary-foreground shadow-soft transition-transform hover:scale-[1.02] active:scale-[0.97]"
      >
        Create your event
      </Link>
    </main>
  );
}
