import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import HistoryChart from "@/components/HistoryChart";
import { getBuilding, getBuildingHistory, getZones, zoneLabel } from "@/lib/data";
import { fmtNum, fmtOrdinal, fmtPct, trendColor } from "@/lib/format";
import { pageMeta } from "@/lib/seo";

export const revalidate = 3600;

type Params = { params: Promise<{ locale: string; egid: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, egid } = await params;
  const b = Number.isFinite(Number(egid)) ? await getBuilding(Number(egid)) : null;
  if (!b) return { robots: { index: false, follow: true } };
  const t = await getTranslations({ locale, namespace: "seo" });
  const tf = await getTranslations({ locale, namespace: "families" });
  const address = b.address ?? `EGID ${b.egid}`;
  // pagine edificio: noindex all'inizio (runbook) — restano raggiungibili e seguono i link
  return pageMeta({
    locale,
    path: `/buildings/${b.egid}`,
    title: t("buildingTitle", { address }),
    description: t("buildingDescription", {
      address, commune: b.commune ?? "Genève", idc: b.idc, year: b.year,
      median: b.peer_median ?? "—", percentile: b.peer_percentile ?? "—", family: tf(b.family).toLowerCase(),
    }),
    noindex: true,
  });
}

export default async function BuildingPage({ params }: Params) {
  const { locale, egid } = await params;
  setRequestLocale(locale);
  const id = Number(egid);
  if (!Number.isInteger(id)) notFound();

  const t = await getTranslations("building");
  const tf = await getTranslations("families");
  const [b, history, zones] = await Promise.all([getBuilding(id), getBuildingHistory(id), getZones()]);
  if (!b) notFound();
  const zone = zones.find((z) => z.zone_id === b.zone_id);

  const reading =
    b.delta_vs_peer_pct == null ? null
      : b.delta_vs_peer_pct > 10 ? t("readingAbove")
      : b.delta_vs_peer_pct < -10 ? t("readingBelow")
      : t("readingNear");
  const isHeatPump = (b.energy_source ?? "").toUpperCase().includes("PAC");

  const thresholdRow = (label: string, above: boolean | null) => (
    <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span>{label}</span>
      {b.idc_avg_3y == null ? (
        <span className="muted small">{t("noAvg")}</span>
      ) : above ? (
        <span className="badge badge-warn">{t("above")}</span>
      ) : (
        <span className="badge badge-ok">{t("below")}</span>
      )}
    </li>
  );

  return (
    <div className="container page">
      <p className="small"><Link href="/explore">← {t("backToMap")}</Link></p>
      <div className="kicker">{tf(b.family)} · {b.commune}</div>
      <h1>{b.address ?? `EGID ${b.egid}`}</h1>
      <p className="muted">
        {t("egid")} <span className="num">{b.egid}</span> · {t("year", { year: b.year })}
        {zone && (
          <> · <Link href={`/zones/${zone.slug}`}>{zoneLabel(zone)}</Link></>
        )}
      </p>

      <div className="grid grid-4 section">
        <div className="card">
          <div className="stat-value">{fmtNum(b.idc, locale)}</div>
          <div className="stat-label">{t("idc")} · {t("idcUnit")}</div>
        </div>
        <div className="card">
          <div className="stat-value">{fmtNum(b.idc_avg_3y, locale)}</div>
          <div className="stat-label">{t("idcAvg3y")}</div>
        </div>
        <div className="card">
          <div className="stat-value">{fmtNum(b.final_energy_mwh, locale)}</div>
          <div className="stat-label">{t("finalEnergy")} · MWh</div>
        </div>
        <div className="card">
          <div className="stat-value">{fmtNum(b.sre, locale)}</div>
          <div className="stat-label">{t("sre")} · m²</div>
        </div>
      </div>

      <div className="grid grid-2 section">
        <div className="card">
          <h2>{t("benchmarkTitle")}</h2>
          {b.peer_percentile != null ? (
            <>
              <div className="bench">
                <div className="bench-track">
                  <div className="bench-median" style={{ left: "50%" }} />
                  <div className="bench-marker" style={{ left: `${b.peer_percentile}%` }} />
                </div>
                <div className="bench-scale"><span>0</span><span>50</span><span>100</span></div>
              </div>
              <dl className="kv" style={{ marginTop: 14 }}>
                <dt>{t("idc")}</dt><dd>{fmtNum(b.idc, locale)}</dd>
                <dt>{t("peerMedian")}</dt><dd>{fmtNum(b.peer_median, locale)}</dd>
                <dt>{t("difference")}</dt><dd>{fmtPct(b.delta_vs_peer_pct, locale)}</dd>
                <dt>{t("percentile")}</dt><dd>{fmtOrdinal(b.peer_percentile, locale)}</dd>
                <dt>{t("zoneMedian")}</dt><dd>{b.zone_median != null ? `${fmtNum(b.zone_median, locale)} (${fmtPct(b.delta_vs_zone_pct, locale)})` : "—"}</dd>
              </dl>
              <p style={{ marginTop: 12 }}>{t("percentileExplain", { p: b.peer_percentile })} {reading}</p>
              <p className="note">{t("peerGroup", { family: tf(b.family), year: b.year, n: b.peer_n })}</p>
              {b.zone_median == null && <p className="note">{t("zoneTooSmall")}</p>}
            </>
          ) : (
            <p className="note">{t("peerTooSmall")}</p>
          )}
        </div>

        <div className="card">
          <h2>{t("trendTitle")}</h2>
          {b.trend_3y_pct != null ? (
            <>
              <div className="stat-value" style={{ color: trendColor(b.trend_3y_pct) }}>{fmtPct(b.trend_3y_pct, locale)}</div>
              <div className="stat-label">{t("trend3y")} ({b.year - 3} → {b.year}: {fmtNum(b.idc_3y_ago, locale)} → {fmtNum(b.idc, locale)})</div>
            </>
          ) : (
            <p className="muted">{t("trendNone")}</p>
          )}

          <h3 style={{ marginTop: 24 }}>{t("thresholdsTitle")}</h3>
          <p className="small muted">{t("thresholdsText")}</p>
          <ul className="list-plain small">
            {thresholdRow(t("threshold450"), b.above_450)}
            {thresholdRow(t("threshold800"), b.above_significant_until_2026)}
            {thresholdRow(t("threshold650"), b.above_significant_from_2027)}
          </ul>
          <p className="note">{t("thresholdNote")}</p>
        </div>
      </div>

      <div className="card section">
        <h2>{t("historyTitle")}</h2>
        <HistoryChart
          points={history.map((h) => ({ year: h.year, idc: h.idc, peer_median: h.peer_median }))}
          labelIdc={t("historyLegendIdc")}
          labelPeer={t("historyLegendPeer")}
        />
      </div>

      <div className="card section">
        <dl className="kv">
          <dt>{t("type")}</dt><dd style={{ fontFamily: "inherit" }}>{tf(b.family)}</dd>
          <dt>{t("destination")}</dt><dd style={{ fontFamily: "inherit" }}>{b.destination ?? "—"}</dd>
          <dt>{t("energySource")}</dt><dd style={{ fontFamily: "inherit" }}>{b.energy_source ?? "—"}</dd>
          <dt>{t("zone")}</dt><dd style={{ fontFamily: "inherit" }}>{zone ? zoneLabel(zone) : "—"}</dd>
        </dl>
        <p className="note">{t("finalEnergyNote")}</p>
        {isHeatPump && <p className="note">{t("heatPumpNote")}</p>}
      </div>
    </div>
  );
}
