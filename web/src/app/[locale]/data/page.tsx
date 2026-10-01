import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, datasetLd, pageMeta } from "@/lib/seo";
import { getLastRefresh } from "@/lib/data";
import { fmtDate } from "@/lib/format";

type P = { params: Promise<{ locale: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMeta({ locale, path: "/data", title: t("dataTitle"), description: t("dataDescription") });
}

export default async function DataPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const lastIso = await getLastRefresh();
  const last = fmtDate(lastIso, locale);
  const fr = locale === "fr";
  const ts = await getTranslations("seo");
  const tn = await getTranslations("nav");

  return (
    <div className="container page">
      <JsonLd data={[
        breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("data"), path: `/${locale}/data` }]),
        datasetLd({
          locale,
          name: fr ? "ThermoGeneva — benchmark de l'IDC des bâtiments des zones industrielles de Genève" : "ThermoGeneva — IDC benchmark of buildings in Geneva's industrial zones",
          description: ts("dataDescription"),
          dateModified: lastIso,
        }),
      ]} />
      <div className="prose">
        <h1>{t("dataTitle")}</h1>
        <p>{fr ? `Dernière mise à jour réussie : ${last}.` : `Last successful update: ${last}.`}</p>

        <h2>{fr ? "Sources officielles" : "Official sources"}</h2>
        <ul>
          <li>
            <a href="https://sitg.ge.ch/donnees/scane-indice-moyennes-3-ans">SITG — {fr ? "IDC des bâtiments, moyennes 2/3 ans" : "Building IDC, 2/3-year averages"}</a>{" "}
            (<code>SCANE_INDICE_MOYENNES_3_ANS</code>, OCEN)
          </li>
          <li>
            SITG — {fr ? "Périmètre des zones industrielles FTI" : "FTI industrial-zone perimeters"} (<code>FTI_PERIMETRE</code>)
          </li>
          <li>{fr ? "Fond de carte" : "Base map"}: © swisstopo (Light Base Map)</li>
        </ul>
        <p>
          {fr
            ? "Ces jeux de données sont publiés par le SITG en classe A (accès libre), qui autorise la consultation, le téléchargement, l'usage privé et commercial, sous réserve de mentionner la source. ThermoGeneva n'est pas un service officiel de l'État de Genève."
            : "These datasets are published by SITG under class A (open access), which allows consultation, download, private and commercial use, subject to source attribution. ThermoGeneva is not an official service of the State of Geneva."}{" "}
          <a href="https://sitg.ge.ch/ressources/conditions-utilisation-donnees">{fr ? "Conditions d'utilisation" : "Terms of use"}</a>
        </p>

        <h2>{fr ? "Transformations appliquées" : "Transformations applied"}</h2>
        <ul>
          <li>{fr ? "Seuls les champs nécessaires sont importés (liste blanche). Les champs de répondants/contacts, l'identifiant du concessionnaire et le nombre de preneurs ne sont jamais importés." : "Only the necessary fields are imported (allow-list). Respondent/contact fields, the concession-holder identifier and the number of heat consumers are never imported."}</li>
          <li>{fr ? "Nettoyage, dédoublonnage et contrôles de qualité (voir Méthodologie)." : "Cleaning, de-duplication and quality checks (see Methodology)."}</li>
          <li>{fr ? "Attribution des bâtiments aux zones industrielles par analyse spatiale." : "Spatial assignment of buildings to industrial zones."}</li>
          <li>{fr ? "Calcul des benchmarks, percentiles, tendances et estimations d'énergie." : "Computation of benchmarks, percentiles, trends and energy estimates."}</li>
        </ul>

        <h2>{fr ? "Mises à jour" : "Updates"}</h2>
        <p>{fr ? "Les données sont téléchargées automatiquement depuis les services du SITG, validées puis recalculées. Chaque exécution est journalisée. Les déclarations IDC de l'année en cours sont incomplètes jusqu'à la fin de la période de déclaration." : "Data is downloaded automatically from SITG services, validated and recomputed. Each run is logged. IDC declarations for the current year remain incomplete until the declaration period ends."}</p>

        <h2>{fr ? "Code source" : "Source code"}</h2>
        <p><a href="https://github.com/ciro14comes/thermogeneva">github.com/ciro14comes/thermogeneva</a></p>
      </div>
    </div>
  );
}
