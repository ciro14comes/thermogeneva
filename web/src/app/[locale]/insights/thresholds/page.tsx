import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllBuildings } from "@/lib/data";
import { ENERGY_GROUP_COLOR, fmtNum, type EnergyGroup } from "@/lib/format";
import { THRESHOLD_BANDS, thresholdInsight } from "@/lib/insights";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "insights" });
  return pageMeta({ locale, path: "/insights/thresholds", title: t("thTitle"), description: t("thMeta") });
}

export default async function ThresholdsInsight({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("insights");
  const tn = await getTranslations("nav");
  const tf = await getTranslations("families");
  const te = await getTranslations("energyGroups");

  const d = thresholdInsight(await getAllBuildings());
  const n = (v: number) => fmtNum(v, locale);
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const last = d.waves[d.waves.length - 1];
  const first = d.waves[0];
  const waveMax = Math.max(1, ...d.waves.map((w) => w.n));
  const bandColor = Object.fromEntries(THRESHOLD_BANDS.map((b) => [b.key, b.color]));

  return (
    <div className="container page ins-page">
      <JsonLd data={[
        breadcrumbLd([
          { name: tn("home"), path: `/${locale}` },
          { name: tn("insights"), path: `/${locale}/insights` },
          { name: t("thTitle"), path: `/${locale}/insights/thresholds` },
        ]),
      ]} />
      <p className="small"><Link href="/insights">← {tn("insights")}</Link></p>
      <div className="kicker">{t("thKicker")}</div>
      <h1>{t("thTitle")}</h1>
      <p className="lead" style={{ fontSize: "1.05rem" }}>
        {t("thLead", { n: n(d.n), today: n(first.n), y2027: n(d.waves[1].n), y2031: n(last.n), times: Math.round(last.n / Math.max(1, first.n)) })}
      </p>

      {/* 1 — tre gradini */}
      <section className="card section">
        <h2>{t("thStepsTitle")}</h2>
        <p className="muted small" style={{ marginTop: 0 }}>{t("thStepsSub")}</p>
        <div className="ins-steps" role="img" aria-label={t("thStepsTitle")}>
          {d.waves.map((w) => (
            <div key={w.key} className="ins-step">
              <div className="ins-step-n num">{n(w.n)}</div>
              <div className="ins-step-bar" style={{ height: `${(w.n / waveMax) * 180}px` }}>
                {[...w.bands].reverse().map((k) => (
                  <div key={k} style={{ flex: d.bands[k].n, background: bandColor[k] }} title={`${t(`band_${k}`)}: ${n(d.bands[k].n)}`} />
                ))}
              </div>
              <div className="ins-step-label"><strong>{t(`wave_${w.key}`)}</strong><span className="muted small">{t("thAbove", { v: w.threshold })}</span></div>
            </div>
          ))}
        </div>
        <ul className="ins-legend small">
          {THRESHOLD_BANDS.filter((b) => b.key !== "le450" && b.key !== "b450").reverse().map((b) => (
            <li key={b.key}><i style={{ background: b.color }} />{t(`band_${b.key}`)}</li>
          ))}
        </ul>
        <p className="note">{t("thStepsNote")}</p>
      </section>

      {/* 2 — dove si trovano oggi */}
      <section className="card section">
        <h2>{t("thDistTitle")}</h2>
        <div className="ins-stack" role="img" aria-label={t("thDistTitle")}>
          {THRESHOLD_BANDS.map((b) => (
            <div key={b.key} style={{ flex: d.bands[b.key].n, background: b.color }} title={`${t(`band_${b.key}`)}: ${n(d.bands[b.key].n)}`} />
          ))}
        </div>
        <div className="ins-stack-axis small muted"><span>{t("thLower")}</span><span>{t("thHigher")}</span></div>
        <table className="ins-table">
          <thead>
            <tr><th>{t("colBand")}</th><th className="r">{t("colBuildings")}</th><th className="r">{t("colArea")}</th><th className="r">{t("colEnergy")}</th><th>{t("colMeaning")}</th></tr>
          </thead>
          <tbody>
            {THRESHOLD_BANDS.map((b) => {
              const a = d.bands[b.key];
              return (
                <tr key={b.key}>
                  <td><i className="ins-dot" style={{ background: b.color }} />{t(`band_${b.key}`)}</td>
                  <td className="r num">{n(a.n)} <span className="muted">({pct(a.n, d.n)} %)</span></td>
                  <td className="r num">{pct(a.sre, d.total.sre)} %</td>
                  <td className="r num">{pct(a.mwh, d.total.mwh)} %</td>
                  <td className="small">{t(`mean_${b.key}`)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 3 — poca superficie, molta energia */}
      <section className="grid grid-2 section">
        <div className="card">
          <div className="stat-value">{pct(last.sre, d.total.sre)} %</div>
          <div className="stat-label">{t("thShareArea", { n: n(last.n) })}</div>
        </div>
        <div className="card">
          <div className="stat-value">{pct(last.mwh, d.total.mwh)} %</div>
          <div className="stat-label">{t("thShareEnergy", { mwh: n(Math.round(last.mwh / 1000)) })}</div>
        </div>
      </section>
      <p className="muted" style={{ margin: "14px 0 0" }}>{t("thShareText")}</p>

      {/* 4 — per fonte di energia e per tipo */}
      <section className="grid grid-2 section">
        <div className="card">
          <h2>{t("thByEnergy")}</h2>
          <ShareRows rows={d.byEnergy.map((r) => ({ ...r, label: te(r.key), color: ENERGY_GROUP_COLOR[r.key as EnergyGroup] }))} n={n} head={t("colShare550")} />
          <p className="note">{t("thHeatPumpNote")}</p>
        </div>
        <div className="card">
          <h2>{t("thByType")}</h2>
          <ShareRows rows={d.byFamily.map((r) => ({ ...r, label: tf(r.key) }))} n={n} head={t("colShare550")} />
        </div>
      </section>

      {/* 5 — limiti */}
      <section className="card section">
        <h2>{t("limitsTitle")}</h2>
        <ul className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>
          <li>{t("limit1")}</li>
          <li>{t("limit2", { stale: n(d.stale), noAvg: n(d.noAvg) })}</li>
          <li>{t("limit3")}</li>
          <li>{t("limit4")}</li>
        </ul>
        <p className="note">{t("computedNote")} <Link href="/methodology">{tn("methodology")}</Link> · <Link href="/explore">{t("openMap")}</Link></p>
      </section>
    </div>
  );
}

function ShareRows({ rows, n, head }: {
  rows: { key: string; label: string; color?: string; n: number; gt550: number; pct550: number }[];
  n: (v: number) => string;
  head: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.pct550));
  return (
    <>
      <div className="ins-share-head small muted"><span /><span>{head}</span></div>
      {rows.map((r) => (
        <div key={r.key} className="ins-share">
          <span className="ins-share-name">{r.color && <i className="ins-dot" style={{ background: r.color }} />}{r.label}<span className="muted small"> · {n(r.n)}</span></span>
          <div className="ins-share-track"><div style={{ width: `${(r.pct550 / max) * 100}%` }} /></div>
          <span className="num ins-share-val">{Math.round(r.pct550)} %</span>
        </div>
      ))}
    </>
  );
}
