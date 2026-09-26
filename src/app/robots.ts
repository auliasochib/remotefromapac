import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The sign-in flow and the AI dashboard have no SEO value and contain
      // personal workflows.
      disallow: ["/api/", "/signin", "/dashboard", "/saved"],
    },
    sitemap: "https://remotefromapac.vercel.app/sitemap.xml",
  };
}
