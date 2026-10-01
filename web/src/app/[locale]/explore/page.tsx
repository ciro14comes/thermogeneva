import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Explorer from "@/components/Explorer";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return { title: t("title"), alternates: { canonical: `/${locale}/explore`, languages: { en: "/en/explore", fr: "/fr/explore" } } };
}

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Explorer />;
}
