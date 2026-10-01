import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getZoneMetrics, getZones, referenceYear, zoneLabel } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import JsonLd from "@/components/JsonLd";
import { absolute, breadcrumbLd, pageMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMeta({ locale, path: "/zones", title: t("zonesTitle"), description: t("zonesDescription") });
}

export default async function ZonesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("zones");
  const tn = await getTranslations("nav");

  const [zones, metrics] = await Promise.all([getZones(), getZoneMetrics()]);
  const year = referenceYear(metrics);
  const rows = zones
    .map((z) => ({ z, m: metrics.find((m) => m.zone_id === z.zone_id && m.year === year) }))
    .filter((r) => r.m)
    .sort((a, b) => (b.m!.buildings - a.m!.buildings));

  return (
    <div className="container page">
      <JsonLd data={[
        breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("zones"), path: `/${locale}/zones` }]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("title"),
          itemListElement: rows.map(({ z }, i) => ({
            "@type": "ListItem", position: i + 1, name: zoneLabel(z), url: absolute(`/${locale}/zones/${z.slug}`),
          })),
        },
      ]} />
      <h1>{t("title")}</h1>
      <p className="lead">{t("lead", { year: year ?? "—" })}</p>
      <p className="small muted">{t("unnamedNote")}</p>

      <div className="table-wrap section">
        <table className="data">
          <thead>
            <tr>
              <th>{t("zone")}</th>
              <th>{t("type")}</th>
              <th className="r">{t("buildings")}</th>
              <th className="r">{t("medianIdc")}</th>
              <th className="r">{t("above450")}</th>
              <th className="r">{t("abovePeer")}</th>
              <th className="r">{t("energy")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ z, m }) => (
              <tr key={z.zone_id}>
                <td>
                  <Link href={`/zones/${z.slug}`}>{zoneLabel(z)}</Link>
                  {!m!.zone_benchmark_valid && <span className="muted small"> *</span>}
                </td>
                <td>{z.zone_type}</td>
                <td className="r">{m!.buildings}</td>
                <td className="r">{fmtNum(m!.median_idc, locale)}</td>
                <td className="r">{m!.buildings_above_450}</td>
                <td className="r">{m!.share_above_peer_median_pct != null ? `${fmtNum(m!.share_above_peer_median_pct, locale)} %` : "—"}</td>
                <td className="r">{fmtNum(m!.total_final_energy_mwh, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">* {t("smallZone")}</p>
    </div>
  );
}
