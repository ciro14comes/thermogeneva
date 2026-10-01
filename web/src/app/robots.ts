import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Motori di ricerca e assistenti AI sono i benvenuti (dati pubblici): solo le API interne sono escluse,
// tranne l'immagine di anteprima usata dai social.
export default function robots(): MetadataRoute.Robots {
  const rule = { allow: ["/", "/api/og"], disallow: ["/api/"] };
  return {
    rules: [
      { userAgent: "*", ...rule },
      { userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
          "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"], ...rule },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
