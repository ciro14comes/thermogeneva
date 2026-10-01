import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JsonLd from "@/components/JsonLd";
import { getAllBuildings, getZoneMetrics, referenceYear } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { faqLd, pageMeta } from "@/lib/seo";

export const revalidate = 3600;

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMeta({ locale, path: "", title: t("homeTitle"), description: t("homeDescription"), absoluteTitle: true });
}

const FAQ_KEYS = ["1", "2", "3", "4", "5", "6"] as const;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default async function Home({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tf = await getTranslations("faq");

  const [buildings, metrics] = await Promise.all([getAllBuildings(), getZoneMetrics()]);
  const refYear = referenceYear(metrics);
  const zonesWithData = new Set(buildings.map((b) => b.zone_id)).size;
  const above450 = buildings.filter((b) => b.above_450).length;
  const med = median(buildings.map((b) => b.idc));

  const faq = FAQ_KEYS.map((k) => ({ q: tf(`q${k}`), a: tf(`a${k}`) }));

  return (
    <div className="container page">
      <JsonLd data={faqLd(faq)} />

      <div className="kicker">{t("kicker")}</div>
      <h1 style={{ maxWidth: 860 }}>{t("title")}</h1>
      <p className="lead">{t("lead")}</p>
      <div className="btn-row">
        <Link href="/explore" className="btn btn-primary">{t("cta")}</Link>
        <Link href="/zones" className="btn btn-ghost">{t("ctaZones")}</Link>
      </div>

      <section className="grid grid-4 section" aria-label={t("statYear")}>
        <div className="card">
          <div className="stat-value">{fmtNum(buildings.length, locale)}</div>
          <div className="stat-label">{t("statBuildings")}</div>
        </div>
        <div className="card">
          <div className="stat-value">{fmtNum(zonesWithData, locale)}</div>
          <div className="stat-label">{t("statZones")}</div>
        </div>
        <div className="card">
          <div className="stat-value">{fmtNum(above450, locale)}</div>
          <div className="stat-label">{t("statAbove450")}</div>
        </div>
        <div className="card">
          <div className="stat-value">{refYear ?? "—"}</div>
          <div className="stat-label">{t("statYear")}</div>
        </div>
      </section>

      {med != null && (
        <p className="section" style={{ maxWidth: 760 }}>
          {t("summary", { n: fmtNum(buildings.length, locale), median: fmtNum(med, locale), above: fmtNum(above450, locale) })}
        </p>
      )}

      <div className="grid grid-2 section">
        <section>
          <h2>{t("questionsTitle")}</h2>
          <ul className="list-plain">
            <li>{t("q1")}</li>
            <li>{t("q2")}</li>
            <li>{t("q3")}</li>
            <li>{t("q4")}</li>
          </ul>
        </section>
        <section>
          <h2>{t("howTitle")}</h2>
          <ol style={{ paddingLeft: "1.2em", margin: 0 }}>
            <li style={{ marginBottom: 8 }}>{t("how1")}</li>
            <li style={{ marginBottom: 8 }}>{t("how2")}</li>
            <li>{t("how3")}</li>
          </ol>
          <h2 style={{ marginTop: 24 }}>{t("notTitle")}</h2>
          <p className="muted">{t("notText")}</p>
        </section>
      </div>

      <section className="section prose">
        <h2>{t("faqTitle")}</h2>
        {faq.map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 18 }}>
            <h3>{q}</h3>
            <p className="muted" style={{ margin: 0 }}>{a}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
