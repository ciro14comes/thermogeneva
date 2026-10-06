import type { MetadataRoute } from "next";
import { getLastRefresh, getZones } from "@/lib/data";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

// Tutte le pagine indicizzabili, in inglese e francese, con le alternative hreflang.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/explore", priority: 0.9, freq: "weekly" },
    { path: "/zones", priority: 0.8, freq: "weekly" },
    { path: "/insights", priority: 0.7, freq: "weekly" },
    { path: "/insights/thresholds", priority: 0.7, freq: "weekly" },
    { path: "/methodology", priority: 0.7, freq: "monthly" },
    { path: "/data", priority: 0.6, freq: "weekly" },
    { path: "/privacy", priority: 0.2, freq: "monthly" },
  ];
  try {
    const zones = await getZones();
    zones.filter((z) => z.buildings_total > 0).forEach((z) => pages.push({ path: `/zones/${z.slug}`, priority: 0.6, freq: "weekly" }));
  } catch { /* sitemap senza zone se il database non risponde */ }
  const last = (await getLastRefresh()) ?? undefined;

  return pages.flatMap(({ path, priority, freq }) =>
    routing.locales.map((l) => ({
      url: `${SITE_URL}/${l}${path}`,
      lastModified: last,
      changeFrequency: freq,
      priority,
      alternates: {
        languages: {
          ...Object.fromEntries(routing.locales.map((x) => [x, `${SITE_URL}/${x}${path}`])),
          "x-default": `${SITE_URL}/en${path}`,
        },
      },
    })),
  );
}
