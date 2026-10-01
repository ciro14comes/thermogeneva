import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBuildingsInZone, getZone, getZoneMetrics, referenceYear, zoneLabel } from "@/lib/data";
import { fmtNum, fmtOrdinal, fmtPct, percentileColor, trendColor } from "@/lib/format";

export const revalidate = 3600;

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const z = await getZone(slug);
  if (!z) return {};
  const label = zoneLabel(z);
  return {
    title: locale === "fr" ? `Benchmark énergétique industriel ${label}` : `${label} industrial energy benchmark`,
    alternates: { canonical: `/${locale}/zones/${slug}`, languages: { en: `/en/zones/${slug}`, fr: `/fr/zones/${slug}` } },
  };
}

export default async function ZonePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("zones");
  const tb = await getTranslations("building");
  const tf = await getTranslations("families");

  const zone = await getZone(slug);
  if (!zone) notFound();
  const [buildings, metrics, allMetrics] = await Promise.all([
    getBuildingsInZone(zone.zone_id),
    getZoneMetrics(zone.zone_id),
    getZoneMetrics(),
  ]);
  const year = referenceYear(allMetrics);
  const current = metrics.find((m) => m.year === year) ?? metrics[metrics.length - 1];
  const series = metrics.filter((m) => m.year >= 2011 && m.median_idc != null);

  // mini grafico a barre della mediana di zona nel tempo
  const maxMed = Math.max(450, ...series.map((m) => m.median_idc ?? 0));

  return (
    <div className="container page">
      <p className="small"><Link href="/zones">← {t("title")}</Link></p>
      <div className="kicker">{zone.zone_type} · {zone.commune}</div>
      <h1>{zoneLabel(zone)}</h1>
      {current && !current.zone_benchmark_valid && <p className="note">{t("smallZone")}</p>}

      {current ? (
        <div className="grid grid-4 section">
          <div className="card"><div className="stat-value">{current.buildings}</div><div className="stat-label">{t("buildings")} · {current.year}</div></div>
          <div className="card"><div className="stat-value">{fmtNum(current.median_idc, locale)}</div><div className="stat-label">{t("medianIdc")} (p25 {fmtNum(current.p25_idc, locale)} – p75 {fmtNum(current.p75_idc, locale)})</div></div>
          <div className="card"><div className="stat-value">{current.buildings_above_450}</div><div className="stat-label">{t("above450")} MJ/m² ({tb("idcAvg3y")})</div></div>
          <div className="card"><div className="stat-value">{fmtNum(current.total_final_energy_mwh, locale)}</div><div className="stat-label">{t("energy")}</div></div>
        </div>
      ) : (
        <p className="muted section">{t("noData")}</p>
      )}

      {series.length > 1 && (
        <div className="card section">
          <h2>{t("trendTitle")}</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, borderBottom: "1px solid var(--line)" }}>
            {series.map((m) => (
              <div key={m.year} title={`${m.year}: ${m.median_idc}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span className="num" style={{ fontSize: 10, color: "var(--muted)" }}>{m.median_idc}</span>
                <div style={{ width: "100%", height: `${((m.median_idc ?? 0) / maxMed) * 130}px`, background: "var(--primary)", borderRadius: "3px 3px 0 0", opacity: m.zone_benchmark_valid ? 1 : 0.35 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {series.map((m) => (
              <span key={m.year} className="num" style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--muted)" }}>{String(m.year).slice(2)}</span>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2>{t("buildingsTitle")}</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("address")}</th>
                <th>{tb("type")}</th>
                <th className="r">{tb("idc")}</th>
                <th className="r">{tb("peerMedian")}</th>
                <th className="r">{tb("difference")}</th>
                <th className="r">{t("percentileShort")}</th>
                <th className="r">{tb("trend3y")}</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr key={b.egid}>
                  <td>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 8, background: percentileColor(b.peer_percentile) }} />
                    <Link href={`/buildings/${b.egid}`}>{b.address ?? `EGID ${b.egid}`}</Link>
                    {b.year < (year ?? b.year) && <span className="muted small"> ({b.year})</span>}
                  </td>
                  <td>{tf(b.family)}</td>
                  <td className="r">{fmtNum(b.idc, locale)}</td>
                  <td className="r">{fmtNum(b.peer_median, locale)}</td>
                  <td className="r">{fmtPct(b.delta_vs_peer_pct, locale)}</td>
                  <td className="r">{fmtOrdinal(b.peer_percentile, locale)}</td>
                  <td className="r trend" style={{ color: trendColor(b.trend_3y_pct) }}>{fmtPct(b.trend_3y_pct, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
