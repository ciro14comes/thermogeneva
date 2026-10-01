// SEO / GEO: metadati comuni, URL canonici, hreflang e dati strutturati (schema.org).
import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thermogeneva.ch";
export const SITE_NAME = "ThermoGeneva";
export const AUTHOR = "Ciro Scognamiglio";
export const REPO_URL = "https://github.com/ciro14comes/thermogeneva";
export const SOURCES = {
  idc: "https://sitg.ge.ch/donnees/scane-indice-moyennes-3-ans",
  terms: "https://sitg.ge.ch/ressources/conditions-utilisation-donnees",
  thresholds: "https://www.ge.ch/connaitre-consommation-energie-batiment-idc/que-faire-resultat-idc-votre-immeuble",
  idcInfo: "https://www.ge.ch/connaitre-consommation-energie-batiment-idc/proprietaires-immeubles",
  swisstopo: "https://www.swisstopo.admin.ch/",
  fti: "https://www.ftige.ch/ecoparcs/",
};

const OG_LOCALE: Record<string, string> = { en: "en_CH", fr: "fr_CH" };

export function absolute(path: string): string {
  return `${SITE_URL}${path}`;
}

/** Metadati completi per una pagina: title, description, canonical, hreflang (+x-default), Open Graph, Twitter. */
export function pageMeta(opts: {
  locale: string;
  path: string; // senza lingua, es. "/zones" o "" per la home
  title: string;
  description: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
  keywords?: string[];
}): Metadata {
  const { locale, path, title, description } = opts;
  const url = `/${locale}${path}`;
  const other = locale === "fr" ? "en" : "fr";
  const ogImage = `/api/og?locale=${locale}`;
  return {
    title: opts.absoluteTitle ? { absolute: title } : title,
    description,
    keywords: opts.keywords,
    alternates: {
      canonical: url,
      languages: { en: `/en${path}`, fr: `/fr${path}`, "x-default": `/en${path}` },
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale] ?? "en_CH",
      alternateLocale: [OG_LOCALE[other]],
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    robots: opts.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absolute(it.path),
    })),
  };
}

export function faqLd(qa: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function datasetLd(opts: { locale: string; name: string; description: string; dateModified?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: opts.name,
    description: opts.description,
    url: absolute(`/${opts.locale}/data`),
    inLanguage: opts.locale,
    creator: { "@type": "Person", name: AUTHOR },
    isBasedOn: [SOURCES.idc],
    license: SOURCES.terms,
    isAccessibleForFree: true,
    keywords: ["IDC", "indice de dépense de chaleur", "heat consumption index", "Geneva", "Genève",
      "industrial zones", "zones industrielles", "FTI", "building energy benchmark"],
    spatialCoverage: {
      "@type": "Place",
      name: "Canton of Geneva, Switzerland",
      geo: { "@type": "GeoShape", box: "46.128 5.956 46.366 6.310" },
    },
    temporalCoverage: "2011/..",
    variableMeasured: [
      { "@type": "PropertyValue", name: "IDC", unitText: "MJ/m²·year", description: "Climate-corrected heat consumption (heating + hot water) per m² of heated floor area" },
      { "@type": "PropertyValue", name: "Peer percentile", unitText: "percent" },
      { "@type": "PropertyValue", name: "Estimated final energy", unitText: "MWh/year" },
    ],
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}
