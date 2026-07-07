import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center text-sm uppercase tracking-[0.2em] text-muted-foreground">
          GuestSnap
        </Link>
        <h1 className="text-center font-display text-4xl">Create your event</h1>
        <p className="mt-3 text-center text-muted-foreground">
          Sign in with your email. No password — we&apos;ll send a one-tap link.
        </p>
        {error ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-center text-sm text-destructive">
            {error === "link_expired"
              ? "That sign-in link expired. Request a new one below."
              : "Something went wrong. Try again."}
          </p>
        ) : null}
        <LoginForm />
        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
