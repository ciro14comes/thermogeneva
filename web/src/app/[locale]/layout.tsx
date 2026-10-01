import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Sidebar from "@/components/Sidebar";
import { getLastRefresh } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import "../globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-ui" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-num" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thermogeneva.ch";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE),
    title: { default: t("title"), template: "%s · ThermoGeneva" },
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", fr: "/fr" },
    },
    openGraph: { title: t("title"), description: t("description"), siteName: "ThermoGeneva", locale },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "footer" });
  const last = await getLastRefresh();

  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
      <body>
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
