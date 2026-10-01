import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Sidebar from "@/components/Sidebar";
import { getLastRefresh } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import JsonLd from "@/components/JsonLd";
import { AUTHOR, REPO_URL, SITE_URL } from "@/lib/seo";
import "../globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-ui" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-num" });

const SITE = SITE_URL;

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  return {
    metadataBase: new URL(SITE),
    title: { default: t("title"), template: "%s · ThermoGeneva" },
    description: t("description"),
    keywords: ts("keywords").split(", "),
    applicationName: "ThermoGeneva",
    authors: [{ name: AUTHOR, url: REPO_URL }],
    creator: AUTHOR,
    category: "energy",
    alternates: { canonical: `/${locale}`, languages: { en: "/en", fr: "/fr", "x-default": "/en" } },
    openGraph: { title: t("title"), description: t("description"), siteName: "ThermoGeneva", locale: locale === "fr" ? "fr_CH" : "en_CH", type: "website",
      images: [{ url: `/api/og?locale=${locale}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: [`/api/og?locale=${locale}`] },
    formatDetection: { telephone: false, address: false, email: false },
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "footer" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  const last = await getLastRefresh();
  const siteLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ThermoGeneva",
      url: SITE,
      inLanguage: ["en", "fr"],
      description: tm("description"),
      creator: { "@type": "Person", name: AUTHOR },
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: AUTHOR,
      url: REPO_URL,
      sameAs: [REPO_URL],
    },
  ];

  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
      <body>
        <JsonLd data={siteLd} />
        <NextIntlClientProvider>
          <div className="shell">
            <Sidebar lastRefresh={fmtDate(last, locale)} />
            <main className="main">
              {children}
              <footer className="footer">
                <p>{t("source")}</p>
                <p>{t("disclaimer")}</p>
              </footer>
            </main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
