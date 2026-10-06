import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CompareChart from "@/components/CompareChart";
import CompareGlance from "@/components/CompareGlance";
import JsonLd from "@/components/JsonLd";
import { IconArrowLeft } from "@/components/icons";
import {
  getBuildingsByIds, getHistoriesByIds, getZones, parseEgidList, zoneLabel,
  type BuildingLatest,
} from "@/lib/data";
import {
  CLASS_COLOR, COMPARE_LETTERS, classOfBuilding, energyLabel, fmtNum, fmtOrdinal, fmtPct, trendColor,
} from "@/lib/format";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

// La selezione vive solo nell'indirizzo (?b=EGID,EGID,…): nessun cookie, nessun dato salvato.
export const dynamic = "force-dynamic";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ b?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compare" });
  // pagina con parametri variabili: non indicizzata, ma i link vengono seguiti
  return pageMeta({ locale, path: "/compare", title: t("metaTitle"), description: t("metaDescription"), absoluteTitle: true, noindex: true });
}

type Row = {
  label: string;
  cell: (b: BuildingLatest) => ReactNode;
  /** valore numerico per segnare il più basso / il più alto tra gli edifici scelti */
  num?: (b: BuildingLatest) => number | null;
  note?: string;
};

export default async function ComparePage({ params, searchParams }: P) {
  const { locale } = await params;
  const { b: raw } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("compare");
  const tb = await getTranslations("building");
  const te = await getTranslations("explore");
  const tf = await getTranslations("families");
  const tn = await getTranslations("nav");

  const ids = parseEgidList(raw, 4);
  const [found, history, zones] = await Promise.all([getBuildingsByIds(ids), getHistoriesByIds(ids), getZones()]);
  // stesso ordine dell'indirizzo (A, B, C, D)
  const buildings = ids.map((id) => found.find((b) => b.egid === id)).filter((b): b is BuildingLatest => !!b);
  const missing = ids.length - buildings.length;
  const zoneOf = (b: BuildingLatest) => zones.find((z) => z.zone_id === b.zone_id);
  const exploreHref = `/explore${buildings.length ? `?compare=${buildings.map((b) => b.egid).join(",")}` : ""}`;
  const withoutHref = (egid: number) => {
    const rest = buildings.filter((x) => x.egid !== egid).map((x) => x.egid);
    return rest.length ? `/compare?b=${rest.join(",")}` : "/compare";
  };

  const unitMwh = locale === "fr" ? "MWh/an" : "MWh/yr";
  const num = (v: number | null | undefined, unit?: string) =>
    v == null ? <span className="muted">—</span> : <>{fmtNum(v, locale)}{unit ? <span className="unit"> {unit}</span> : null}</>;
  const pct = (v: number | null | undefined) => (v == null ? <span className="muted">—</span> : fmtPct(v, locale));
  const gap = (b: BuildingLatest) =>
    b.peer_median == null || b.sre == null ? null : Math.max(0, ((b.idc - b.peer_median) * b.sre) / 3600);
  const threshold = (b: BuildingLatest, above: boolean | null) =>
    b.idc_avg_3y == null ? <span className="muted small">{tb("noAvg")}</span>
      : above ? <span className="badge badge-warn">{tb("above")}</span>
      : <span className="badge badge-ok">{tb("below")}</span>;

  const sections: { title: string; rows: Row[] }[] = [
    { title: t("sectionIdc"), rows: [
      { label: t("rowIdc"), cell: (b) => num(b.idc, "MJ/m²"), num: (b) => b.idc },
      { label: t("rowAvg3y"), cell: (b) => num(b.idc_avg_3y, "MJ/m²"), num: (b) => b.idc_avg_3y },
      { label: t("rowTrend"), cell: (b) => <span style={{ color: trendColor(b.trend_3y_pct), fontWeight: 600 }}>{pct(b.trend_3y_pct)}</span>, num: (b) => b.trend_3y_pct },
      { label: t("rowYear"), cell: (b) => <span className="num">{b.year}</span> },
    ] },
    { title: t("sectionPeers"), rows: [
      { label: t("rowPeerGroup"), cell: (b) => t("peerGroupValue", { family: tf(b.family), n: b.peer_n }) },
      { label: t("rowPeerMedian"), cell: (b) => num(b.peer_median, "MJ/m²") },
      { label: t("rowDiffPeer"), cell: (b) => pct(b.delta_vs_peer_pct), num: (b) => b.delta_vs_peer_pct },
      { label: t("rowPercentile"), cell: (b) => (b.peer_percentile == null ? <span className="muted">—</span> : fmtOrdinal(b.peer_percentile, locale)), num: (b) => b.peer_percentile },
      { label: t("rowZoneMedian"), cell: (b) => num(b.zone_median, "MJ/m²") },
      { label: t("rowDiffZone"), cell: (b) => pct(b.delta_vs_zone_pct), num: (b) => b.delta_vs_zone_pct },
    ] },
    { title: t("sectionEnergy"), rows: [
      { label: t("rowSre"), cell: (b) => num(b.sre, "m²") },
      { label: t("rowEnergy"), cell: (b) => num(b.final_energy_mwh, unitMwh), num: (b) => b.final_energy_mwh },
      { label: t("rowGap"), cell: (b) => num(gap(b), unitMwh), num: gap, note: t("gapNote") },
      { label: t("rowCarrier"), cell: (b) => energyLabel(b.energy_source, locale) },
    ] },
    { title: t("sectionThresholds"), rows: [
      { label: t("rowT450"), cell: (b) => threshold(b, b.above_450) },
      { label: t("rowT800"), cell: (b) => threshold(b, b.above_significant_until_2026) },
      { label: t("rowT650"), cell: (b) => threshold(b, b.above_significant_from_2027) },
    ] },
    { title: t("sectionData"), rows: [
      { label: t("rowStatus"), cell: (b) => (b.is_stale
        ? <span className="badge">{t("statusStale", { year: b.year })}</span>
        : <span className="badge badge-ok">{t("statusFresh")}</span>) },
    ] },
  ];

  // il più basso / il più alto tra gli edifici scelti (solo se ci sono almeno 2 valori diversi)
  const extremes = (row: Row) => {
    if (!row.num) return null;
    const vals = buildings.map((b) => row.num!(b)).filter((v): v is number => v != null);
    if (vals.length < 2 || Math.min(...vals) === Math.max(...vals)) return null;
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const series = buildings.map((b) => ({
    label: b.address ?? `EGID ${b.egid}`,
    cls: classOfBuilding(b.peer_percentile, b.is_stale),
    points: history.filter((h) => h.egid === b.egid).map((h) => ({ year: h.year, idc: h.idc, peer: h.peer_median })),
  }));

  return (
    <div className="container page cmp-page">
      <JsonLd data={breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("compare"), path: `/${locale}/compare` }])} />
      <p className="small"><Link href={exploreHref}><IconArrowLeft size={14} /> {t("backToMap")}</Link></p>
      <div className="kicker">{t("title")}</div>
      <h1>{t("h1")}</h1>
      <p className="lead">{t("lead")}</p>
      {missing > 0 && <p className="note">{t("notFound")}</p>}

      {buildings.length < 2 ? (
        <section className="card section" style={{ maxWidth: 640 }}>
          <h2 style={{ marginTop: 0 }}>{t("emptyTitle")}</h2>
          <p className="muted">{t("emptyText")}</p>
          {buildings.length === 1 && (
            <p className="small">
              <span className={`cmp-letter cmp-c-${classOfBuilding(buildings[0].peer_percentile, buildings[0].is_stale)}`}>A</span>{" "}
              {buildings[0].address ?? `EGID ${buildings[0].egid}`}
            </p>
          )}
          <div className="btn-row"><Link href={exploreHref} className="btn btn-primary">{t("emptyCta")}</Link></div>
        </section>
      ) : (
        <>
          {/* intestazioni: un riquadro per edificio */}
          <section className="cmp-heads section" style={{ gridTemplateColumns: `repeat(${buildings.length}, minmax(0, 1fr))` }}>
            {buildings.map((b, i) => {
              const cls = classOfBuilding(b.peer_percentile, b.is_stale);
              const z = zoneOf(b);
              return (
                <article key={b.egid} className={`card cmp-head cmp-hc-${cls}`}>
                  <div className="cmp-head-top">
                    <span className={`cmp-letter cmp-c-${cls}`}>{COMPARE_LETTERS[i]}</span>
                    <Link href={withoutHref(b.egid)} className="cmp-remove" aria-label={`${t("remove")} ${b.address ?? b.egid}`}>× {t("remove")}</Link>
                  </div>
                  <h2 className="cmp-title"><Link href={`/buildings/${b.egid}`}>{b.address ?? `EGID ${b.egid}`}</Link></h2>
                  <div className="small muted">{z ? zoneLabel(z) : te("outsideFti")} · {tf(b.family)}</div>
                  <div className="small muted">EGID <span className="num">{b.egid}</span></div>
                  <div style={{ marginTop: 10 }}>
                    <span className="badge"><span className="dot" style={{ background: CLASS_COLOR[cls], margin: 0 }} />
                      {{ good: te("classGood"), mid: te("classMid"), high: te("classHigh"), none: te("classNone"), old: te("classOld") }[cls]}
                    </span>
                  </div>
                </article>
              );
            })}
          </section>

          {new Set(buildings.map((b) => b.year)).size > 1 && (
            <p className="note">{t("yearsDiffer", {
              from: Math.min(...buildings.map((b) => b.year)), to: Math.max(...buildings.map((b) => b.year)),
            })}</p>
          )}

          {/* a colpo d'occhio */}
          <section className="section">
            <h2>{t("glanceTitle")}</h2>
            <CompareGlance
              locale={locale}
              items={buildings.map((b) => ({
                idc: b.idc, peer_median: b.peer_median, peer_percentile: b.peer_percentile, is_stale: b.is_stale,
                final_energy_mwh: b.final_energy_mwh, gap_mwh: gap(b),
                median_mwh: b.peer_median != null && b.sre != null ? (b.peer_median * b.sre) / 3600 : null,
              }))}
              labels={{
                posTitle: t("posTitle"), posNote: t("posNote"), noBenchmark: t("noBenchmark"), outdated: t("outdated"),
                lower: t("lower"), typical: t("typical"), higher: t("higher"), median: t("median"),
                idcTitle: t("idcTitle"), idcLegendBar: t("idcLegendBar"), idcLegendPeer: t("idcLegendPeer"), idcLegendThreshold: t("idcLegendThreshold"),
                energyTitle: t("energyTitle"), energyLegendBase: t("energyLegendBase"), energyLegendAbove: t("energyLegendAbove"), aboveMedian: t("aboveMedian"),
                energyLegendBelow: t("energyLegendBelow"), energyLegendMedian: t("energyLegendMedian"), vsMedian: t("vsMedian"), noMedian: t("noMedian"),
                energyColTotal: t("energyColTotal"), energyColDiff: t("energyColDiff"), atMedian: t("atMedian"), energyNote: t("energyNote"),
              }}
            />
          </section>

          {/* tabella delle metriche */}
          <section className="section">
            <div className="table-wrap cmp-table-wrap">
              <table className="data cmp-table">
                <thead>
                  <tr>
                    <th scope="col">{t("metric")}</th>
                    {buildings.map((b, i) => (
                      <th key={b.egid} scope="col">
                        <span className={`cmp-letter cmp-c-${classOfBuilding(b.peer_percentile, b.is_stale)}`}>{COMPARE_LETTERS[i]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {sections.map((s) => (
                  <tbody key={s.title}>
                    <tr className="cmp-section"><th colSpan={buildings.length + 1} scope="colgroup">{s.title}</th></tr>
                    {s.rows.map((row) => {
                      const ex = extremes(row);
                      return (
                        <tr key={row.label}>
                          <th scope="row">{row.label}{row.note && <span className="cmp-note">{row.note}</span>}</th>
                          {buildings.map((b) => {
                            const v = row.num?.(b);
                            const tag = ex && v != null ? (v === ex.min ? "low" : v === ex.max ? "high" : null) : null;
                            return (
                              <td key={b.egid}>
                                {row.cell(b)}
                                {tag && <span className={`cmp-tag cmp-tag-${tag}`}>{tag === "low" ? `▼ ${t("lowest")}` : `▲ ${t("highest")}`}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          {/* storico */}
          <section className="card section">
            <h2 style={{ marginTop: 0 }}>{t("chartTitle")}</h2>
            <CompareChart series={series} locale={locale}
              labels={{ idc: t("histIdc"), peer: t("idcLegendPeer"), threshold: t("idcLegendThreshold"), change: t("histChange"), noData: t("noDeclaration") }} />
            <p className="small muted" style={{ marginBottom: 0 }}>{t("chartNote")}</p>
          </section>

          <p className="note">{t("share")} {tb("thresholdNote")}</p>
          <div className="btn-row">
            {buildings.length < 4 && <Link href={exploreHref} className="btn btn-ghost">{t("addMore")}</Link>}
          </div>
        </>
      )}
    </div>
  );
}
