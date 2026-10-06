import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllBuildings } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { thresholdInsight } from "@/lib/insights";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "insights" });
  return pageMeta({ locale, path: "/insights", title: t("title"), description: t("lead") });
}

// Elenco delle analisi. Ogni scheda mostra il numero chiave, ricalcolato dai dati.
export default async function InsightsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("insights");
  const tn = await getTranslations("nav");
  const th = thresholdInsight(await getAllBuildings());

  const items = [
    {
      href: "/insights/thresholds",
      kicker: t("thKicker"),
      title: t("thTitle"),
      key: `${fmtNum(th.waves[0].n, locale)} → ${fmtNum(th.waves[th.waves.length - 1].n, locale)}`,
      keyLabel: t("thCardKey"),
    },
  ];

  return (
    <div className="container page">
      <JsonLd data={[breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("insights"), path: `/${locale}/insights` }])]} />
      <div className="kicker">{t("kicker")}</div>
      <h1>{t("title")}</h1>
      <p className="lead">{t("lead")}</p>
      <div className="grid grid-2 section">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="card ins-card">
            <div className="kicker" style={{ marginBottom: 6 }}>{it.kicker}</div>
            <h2 style={{ margin: "0 0 14px" }}>{it.title}</h2>
            <div className="stat-value">{it.key}</div>
            <div className="stat-label">{it.keyLabel}</div>
            <span className="ins-card-go small">{t("read")} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
