import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://mimarek.sa";
  const now = new Date();

  return [
    { url: `${base}/ar`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/en`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/auth/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/auth/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
