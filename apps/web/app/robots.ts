import { db } from "@repo/db";
import type { MetadataRoute } from "next";

const DEFAULT_ROBOTS: MetadataRoute.Robots = {
  rules: [
    {
      userAgent: "*",
      allow: ["/ar", "/en", "/auth/login", "/auth/register"],
      disallow: ["/dashboard/", "/api/", "/auth/invite/", "/auth/reset-password/"],
    },
  ],
  sitemap: "https://mimarek.sa/sitemap.xml",
};

export default async function robots(): Promise<MetadataRoute.Robots> {
  try {
    const config = await db.systemConfig.findUnique({ where: { id: "system" } });
    if (!config?.robotsTxtRules) return DEFAULT_ROBOTS;

    const rules = JSON.parse(config.robotsTxtRules) as MetadataRoute.Robots["rules"];
    return {
      rules,
      sitemap: "https://mimarek.sa/sitemap.xml",
    };
  } catch {
    return DEFAULT_ROBOTS;
  }
}
