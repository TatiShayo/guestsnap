export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQ block with FAQPage schema.org JSON-LD for rich results. Reused by the
 * landing page and every SEO page with page-specific questions. */
export function Faq({ items, id = "faq" }: { items: FaqItem[]; id?: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div id={id}>
      {/* Static, server-authored JSON-LD (no user input) — safe to inject. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <dl className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
        {items.map((item) => (
          <div key={item.question} className="p-6">
            <dt className="font-display text-lg">{item.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
