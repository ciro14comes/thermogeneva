import { ImageResponse } from "next/og";

// Immagine di anteprima (Open Graph) 1200×630 per condivisioni su social, chat e motori di ricerca.
export async function GET(req: Request) {
  const locale = new URL(req.url).searchParams.get("locale") === "fr" ? "fr" : "en";
  const title = locale === "fr"
    ? "Benchmark thermique des bâtiments industriels de Genève"
    : "Heat benchmark for Geneva's industrial buildings";
  const sub = locale === "fr"
    ? "IDC officiel · comparaison par type de bâtiment · seuils légaux"
    : "Official IDC data · peer comparison · legal thresholds";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 72, background: "#F8FAFC", color: "#0F172A", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ width: 7, height: 18, borderRadius: 4, background: "#14B8A6" }} />
            <div style={{ width: 7, height: 30, borderRadius: 4, background: "#ffffff" }} />
            <div style={{ width: 7, height: 24, borderRadius: 4, background: "#2563EB" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>ThermoGeneva</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#64748B" }}>{sub}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["#14B8A6", "#5B8DEF", "#F26B6B", "#94A3B8"].map((c) => (
            <div key={c} style={{ width: 120, height: 14, borderRadius: 99, background: c }} />
          ))}
          <div style={{ marginLeft: "auto", fontSize: 26, color: "#2563EB" }}>thermogeneva.ch</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}
