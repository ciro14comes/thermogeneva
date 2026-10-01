import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllBuildings, getZoneMetrics, referenceYear } from "@/lib/data";
import { fmtNum } from "@/lib/format";

export const revalidate = 3600;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const [buildings, metrics] = await Promise.all([getAllBuildings(), getZoneMetrics()]);
  const refYear = referenceYear(metrics);
  const zonesWithData = new Set(buildings.map((b) => b.zone_id)).size;
  const above450 = buildings.filter((b) => b.above_450).length;

  return (
    <div className="container page">
      <div className="kicker">{t("kicker")}</div>
      <h1 style={{ maxWidth: 820 }}>{t("title")}</h1>
      <p className="lead">{t("lead")}</p>
      <div className="btn-row">
        <Link href="/explore" className="btn btn-primary">{t("cta")}</Link>
        <Link href="/zones" className="btn btn-ghost">{t("ctaZones")}</Link>
      </div>

      <div className="grid grid-4 section">
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
      </div>

      <div className="grid grid-2 section">
        <div>
          <h2>{t("questionsTitle")}</h2>
          <ul className="list-plain">
            <li>{t("q1")}</li>
            <li>{t("q2")}</li>
            <li>{t("q3")}</li>
            <li>{t("q4")}</li>
          </ul>
        </div>
        <div>
          <h2>{t("notTitle")}</h2>
          <p className="muted">{t("notText")}</p>
        </div>
      </div>
    </div>
  );
}
