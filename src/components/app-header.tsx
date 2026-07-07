import Link from "next/link";

/** Host-facing header with brand + sign-out. Sign-out posts to the logout
 *  route (clears the session cookie / Supabase session server-side). */
export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          GuestSnap
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
