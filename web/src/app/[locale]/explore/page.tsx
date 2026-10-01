import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Explorer from "@/components/Explorer";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMeta({ locale, path: "/explore", title: t("exploreTitle"), description: t("exploreDescription") });
}

export default async function ExplorePage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("explore");
  const tn = await getTranslations("nav");
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("explore"), path: `/${locale}/explore` }])} />
      <p className="sr-only">{t("srIntro")}</p>
      <Explorer />
    </>
  );
}
