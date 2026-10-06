import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBuildingsInZone, getZone, getZoneById, getZoneMetrics, referenceYear, zoneLabel } from "@/lib/data";
import { ENERGY_GROUPS, ENERGY_GROUP_COLOR, energyGroup, fmtNum, fmtOrdinal, fmtPct, percentileColor, trendColor, type EnergyGroup } from "@/lib/format";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const revalidate = 3600;

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const z = await getZone(slug);
  if (!z) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const [metrics, all] = await Promise.all([getZoneMetrics(z.zone_id), getZoneMetrics()]);
  const year = referenceYear(all);
  const m = metrics.find((x) => x.year === year) ?? metrics[metrics.length - 1];
  const label = zoneLabel(z);
  return pageMeta({
    locale,
    path: `/zones/${slug}`,
    title: t("zoneTitle", { zone: label }),
    description: m
      ? t("zoneDescription", { zone: label, type: z.zone_type, n: m.buildings, median: m.median_idc ?? "—", year: m.year, above: m.buildings_above_450 })
      : t("zonesDescription"),
    noindex: !m || m.buildings === 0,
  });
}

export default async function ZonePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("zones");
  const tb = await getTranslations("building");
  const tf = await getTranslations("families");
  const tn = await getTranslations("nav");
  const te = await getTranslations("energyGroups");

  const zone = await getZone(slug);
  if (!zone) {
    // vecchi indirizzi numerici (/zones/49) → nuovo indirizzo con il nome ufficiale (/zones/zimeysa)
    if (/^\d+$/.test(slug)) {
      const byId = await getZoneById(Number(slug));
      if (byId && byId.slug !== slug) permanentRedirect(`/${locale}/zones/${byId.slug}`);
    }
    notFound();
  }
  const [buildings, metrics, allMetrics] = await Promise.all([
    getBuildingsInZone(zone.zone_id),
    getZoneMetrics(zone.zone_id),
    getZoneMetrics(),
  ]);
  const year = referenceYear(allMetrics);
  const current = metrics.find((m) => m.year === year) ?? metrics[metrics.length - 1];
  const series = metrics.filter((m) => m.year >= 2011 && m.median_idc != null);

  // mix delle fonti di energia (solo edifici con dati aggiornati) e copertura dei dati
  const fresh = buildings.filter((b) => !b.is_stale);
  const mix = ENERGY_GROUPS.map((g) => {
    const inG = fresh.filter((b) => (energyGroup(b.energy_source) ?? "other") === g);
    return { g: g as EnergyGroup, n: inG.length, mwh: inG.reduce((s, b) => s + (b.final_energy_mwh ?? 0), 0) };
  }).filter((m) => m.n > 0).sort((a, b) => b.n - a.n);
  const totalMwh = mix.reduce((s, m) => s + m.mwh, 0);
  const coveragePct = buildings.length ? Math.round((100 * fresh.length) / buildings.length) : null;
  const declaredRef = year != null ? buildings.filter((b) => b.year >= year).length : null;

  // mini grafico a barre della mediana di zona nel tempo
  const maxMed = Math.max(450, ...series.map((m) => m.median_idc ?? 0));

  return (
    <div className="container page">
      <p className="small"><Link href="/zones">← {t("title")}</Link></p>
      <div className="kicker">{zone.zone_type} · {zone.commune}</div>
      <JsonLd data={[
        breadcrumbLd([
          { name: tn("home"), path: `/${locale}` },
          { name: tn("zones"), path: `/${locale}/zones` },
          { name: zoneLabel(zone), path: `/${locale}/zones/${zone.slug}` },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Place",
          name: zoneLabel(zone),
          description: t("h1Zone", { zone: zoneLabel(zone) }),
          address: { "@type": "PostalAddress", addressLocality: zone.commune ?? "Genève", addressRegion: "GE", addressCountry: "CH" },
          containedInPlace: { "@type": "AdministrativeArea", name: "Canton of Geneva" },
        },
      ]} />
      <h1>{t("h1Zone", { zone: zoneLabel(zone) })}</h1>
      {current && (
        <p className="lead" style={{ fontSize: "1rem" }}>
          {t("zoneSummary", {
            year: current.year, n: current.buildings, zone: zoneLabel(zone), type: zone.zone_type, commune: zone.commune ?? "Genève",
            median: fmtNum(current.median_idc, locale), p25: fmtNum(current.p25_idc, locale), p75: fmtNum(current.p75_idc, locale),
            above: current.buildings_above_450, share: fmtNum(current.share_above_peer_median_pct, locale),
          })}
        </p>
      )}
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

      {buildings.length > 0 && (
        <div className="grid grid-2 section">
          <div className="card">
            <h2>{t("mixTitle")}</h2>
            {fresh.length > 0 ? (
              <>
                <div className="mix-bar" role="img" aria-label={t("mixTitle")}>
                  {mix.map((m) => (
                    <div key={m.g} style={{ width: `${(100 * m.n) / fresh.length}%`, background: ENERGY_GROUP_COLOR[m.g] }} title={`${te(m.g)}: ${m.n}`} />
                  ))}
                </div>
                <table className="mix-table">
                  <thead><tr><th /><th className="r">{t("mixBuildings")}</th><th className="r">{t("mixEnergy")}</th></tr></thead>
                  <tbody>
                    {mix.map((m) => (
                      <tr key={m.g}>
                        <td><span className="mix-dot" style={{ background: ENERGY_GROUP_COLOR[m.g] }} />{te(m.g)}</td>
                        <td className="r num">{m.n} <span className="muted">({Math.round((100 * m.n) / fresh.length)} %)</span></td>
                        <td className="r num">{totalMwh > 0 ? `${Math.round((100 * m.mwh) / totalMwh)} %` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="note">{t("mixNote", { n: fresh.length })}</p>
              </>
            ) : (
              <p className="muted">{t("noData")}</p>
            )}
          </div>
          <div className="card">
            <h2>{t("coverageTitle")}</h2>
            <div className="stat-value">{coveragePct ?? "—"}<small style={{ fontSize: "0.5em", marginLeft: 2 }}>%</small></div>
            <div className="cov-track"><div style={{ width: `${coveragePct ?? 0}%` }} /></div>
            <p style={{ marginBottom: 6 }}>{t("coverageText", { fresh: fresh.length, total: buildings.length })}</p>
            {declaredRef != null && year != null && <p className="small muted" style={{ margin: 0 }}>{t("coverageYear", { n: declaredRef, year })}</p>}
            <p className="note">{t("coverageNote")}</p>
          </div>
        </div>
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
