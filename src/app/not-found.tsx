import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <svg viewBox="0 0 120 90" className="mb-6 h-20 w-28 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="10" y="10" width="100" height="70" rx="4" />
        <rect x="22" y="20" width="76" height="42" rx="2" />
        <path d="M28 58l16-18 12 12 10-8 26 20" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="42" cy="30" r="4" />
      </svg>
      <h1 className="font-display text-4xl">This page slipped out of the album</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        The link may be mistyped, or the event has been archived by its host.
      </p>
      <Link href="/" className="mt-6 text-primary underline underline-offset-4">
        Back to GuestSnap
      </Link>
    </main>
  );
}
