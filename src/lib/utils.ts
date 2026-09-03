import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural || singular + "s"}`;
}

/**
 * Escape a string for safe interpolation into HTML (email templates, any
 * server-rendered raw HTML). React escapes JSX automatically, but our
 * transactional emails build raw HTML strings — user-controlled values like
 * an event title MUST be escaped here or they become a stored-XSS/HTML-
 * injection vector delivered straight to a guest's or host's inbox.
 */
export function escapeHtml(input: unknown): string {
  if (typeof input !== "string") {
    if (input === null || input === undefined) return "";
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
