import type { MetadataRoute } from "next";
import { getZones } from "@/lib/data";
import { routing } from "@/i18n/routing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thermogeneva.ch";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/explore", "/zones", "/methodology", "/data", "/privacy"];
  let zonePaths: string[] = [];
  try {
    const zones = await getZones();
    zonePaths = zones.filter((z) => z.buildings_total > 0).map((z) => `/zones/${z.slug}`);
  } catch {
    zonePaths = [];
  }
  const paths = [...staticPaths, ...zonePaths];
  return paths.map((p) => ({
    url: `${SITE}/${routing.defaultLocale}${p}`,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE}/${l}${p}`])),
    },
  }));
}
