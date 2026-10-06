import type { MetadataRoute } from "next";

const SITE_URL = "https://amana.ayiba.dev";

// Public pages only — /dashboard and receipt pages require auth/context.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now },
    { url: `${SITE_URL}/signin`, lastModified: now },
    { url: `${SITE_URL}/kyc`, lastModified: now },
  ];
}
