import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo";

/** Static + SEO route sitemap. Host-only pages (dashboard, admin, event
 * galleries) are intentionally excluded — they're private or per-event. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.appUrl.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/wedding-photo-sharing-app`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/qr-code-wedding-photos`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/funeral-photo-sharing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/birthday-party-photo-collection`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/corporate-event-photo-sharing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/e/${DEMO_SLUG}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  return staticRoutes;
}
