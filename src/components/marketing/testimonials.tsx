/**
 * PLACEHOLDER TESTIMONIALS — not real customer quotes. BUILD_PROMPT
 * "Placeholder honesty": never ship invented quotes as real. Each card is
 * visibly labeled "Illustrative example" in the UI (not just a code
 * comment) so nothing here misrepresents itself as a verified review.
 * Replace with real quotes (and remove the label) once collected.
 */
const EXAMPLES = [
  {
    quote:
      "Guests just scanned the code on the table card and started uploading — I didn't have to explain anything twice.",
    role: "Wedding host, illustrative example",
  },
  {
    quote:
      "We had the slideshow running on the TV during dinner. Watching new photos land in real time was the moment that stuck.",
    role: "Birthday host, illustrative example",
  },
  {
    quote:
      "Every family member could add their own photos without downloading anything. That mattered a lot to the older relatives.",
    role: "Family event host, illustrative example",
  },
];

export function Testimonials() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {EXAMPLES.map((t) => (
        <figure key={t.role} className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <blockquote className="font-display text-lg leading-snug">&ldquo;{t.quote}&rdquo;</blockquote>
          <figcaption className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t.role}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
              Example
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
