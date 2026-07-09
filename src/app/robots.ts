import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/** Allow everything except host-private and API surfaces. */
export default function robots(): MetadataRoute.Robots {
  const base = config.appUrl.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/dashboard/", "/admin", "/admin/", "/auth/", "/mock/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
