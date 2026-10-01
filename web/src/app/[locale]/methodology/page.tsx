import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/JsonLd";
import { AUTHOR, SOURCES, absolute, breadcrumbLd, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMeta({ locale, path: "/methodology", title: t("methodologyTitle"), description: t("methodologyDescription") });
}

const EN = (
  <>
    <h2>What the IDC measures</h2>
    <p>The <em>indice de dépense de chaleur</em> (IDC) is the official Geneva indicator of a building&apos;s heat consumption: final energy used for space heating and domestic hot water, divided by the heated floor area (SRE), corrected for the severity of each winter (degree-days). It is expressed in MJ/m² per year (3.6 MJ = 1 kWh) and declared every year by building owners, one value per building (EGID).</p>
    <p>The IDC does <strong>not</strong> include process energy, cooling, lighting or equipment. For district heating, the delivered heat is counted; for heat pumps, the electricity used is counted — which makes heat-pump buildings look lower than fuel-based ones.</p>

    <h2>Which buildings are shown</h2>
    <p>Two groups of buildings are shown: every building in the industrial zones managed by the FTI foundation, and all industrial and logistics buildings elsewhere in the canton of Geneva. Buildings whose last IDC declaration is more than six years old are shown as outdated and excluded from statistics and medians. A building belongs to an FTI zone when its footprint lies mainly (≥ 50 % of the area) inside it. When no zone covers half of the footprint, a point inside the building decides; otherwise the building is unassigned. The assignment method is stored for each building.</p>

    <h2>Peer benchmark</h2>
    <ul>
      <li><strong>Peer group</strong>: all buildings of the same type (e.g. industrial, logistics, offices) across the canton of Geneva, in the same year. Types group the official SITG building uses.</li>
      <li><strong>Peer median</strong>: the middle IDC value of the group.</li>
      <li><strong>Difference</strong>: (IDC − peer median) / peer median.</li>
      <li><strong>Percentile</strong>: share of the group with a lower IDC. The 84th percentile means a higher IDC than 84 % of similar buildings.</li>
      <li>If a group has fewer than <strong>10 buildings</strong>, no benchmark is shown.</li>
      <li><strong>Zone median</strong> is shown as context only when the zone has at least 10 buildings in that year.</li>
    </ul>

    <h2>Trend and estimated energy</h2>
    <ul>
      <li><strong>3-year trend</strong>: change between the latest IDC and the IDC of the same building three years earlier. Because the IDC is climate-corrected, years are comparable.</li>
      <li><strong>Estimated final energy</strong> = IDC × SRE / 3600, in MWh per year, climate-normalised. It is an order of magnitude for heating and hot water, not a metered total.</li>
    </ul>

    <h2>Legal thresholds (indicative)</h2>
    <p>Geneva&apos;s energy regulation uses the average IDC of the last three years. Above 450 MJ/m², owners must take improvement measures. Above the &quot;significant&quot; threshold, an energy renovation is mandatory: 800 MJ/m² until the end of 2026, 650 from 2027 and 550 from 2031. ThermoGeneva compares the published 3-year average with these values for information only; obligations are determined by the cantonal energy office (OCEN).</p>

    <h2>Data quality rules</h2>
    <ul>
      <li>Records without EGID, with an implausible year or a negative IDC are rejected.</li>
      <li>Duplicates (same EGID and year) are resolved deterministically: most recent entry date, then highest source identifier.</li>
      <li>An invalid heated area is set to empty, so no energy estimate is computed for that record.</li>
      <li>If the official source changes its structure, the update stops instead of publishing inconsistent data.</li>
    </ul>

    <h2>Limitations</h2>
    <p>Values are self-declared by owners and depend on the declared heated area. Peer groups mix buildings of different ages and sizes. A high value is a reason to look closer, not a verdict: ThermoGeneva is a screening tool, not an energy audit.</p>
    <h2>Official sources</h2>
    <ul>
      <li><a href={SOURCES.idcInfo}>État de Genève — Knowing a building&apos;s energy consumption (IDC)</a></li>
      <li><a href={SOURCES.thresholds}>État de Genève — What to do depending on your building&apos;s IDC (thresholds)</a></li>
      <li><a href={SOURCES.idc}>SITG — IDC dataset (2- and 3-year averages)</a></li>
      <li><a href={SOURCES.fti}>FTI — Official names of the industrial zones (map of the Fondation pour les terrains industriels de Genève)</a></li>
    </ul>
  </>
);

const FR = (
  <>
    <h2>Ce que mesure l&apos;IDC</h2>
    <p>L&apos;<em>indice de dépense de chaleur</em> (IDC) est l&apos;indicateur officiel genevois de la consommation de chaleur d&apos;un bâtiment : énergie finale utilisée pour le chauffage et l&apos;eau chaude sanitaire, divisée par la surface de référence énergétique (SRE) et corrigée selon la rigueur de chaque hiver (degrés-jours). Il s&apos;exprime en MJ/m² par an (3,6 MJ = 1 kWh) et est déclaré chaque année par les propriétaires, une valeur par bâtiment (EGID).</p>
    <p>L&apos;IDC n&apos;inclut <strong>pas</strong> l&apos;énergie de processus, le froid, l&apos;éclairage ni les équipements. Pour le chauffage à distance, la chaleur livrée est comptée ; pour les pompes à chaleur, l&apos;électricité consommée — ce qui donne des valeurs plus basses que les systèmes à combustible.</p>

    <h2>Bâtiments affichés</h2>
    <p>Deux groupes de bâtiments sont affichés : tous les bâtiments des zones industrielles gérées par la FTI, et tous les bâtiments industriels et logistiques situés ailleurs dans le canton de Genève. Les bâtiments dont la dernière déclaration d&apos;IDC date de plus de six ans sont signalés comme non actualisés et exclus des statistiques et des médianes. Un bâtiment appartient à une zone FTI lorsque son emprise s&apos;y trouve majoritairement (≥ 50 % de la surface). Si aucune zone ne couvre la moitié de l&apos;emprise, un point situé dans le bâtiment décide ; sinon le bâtiment n&apos;est pas attribué. La méthode d&apos;attribution est conservée pour chaque bâtiment.</p>

    <h2>Benchmark par groupe</h2>
    <ul>
      <li><strong>Groupe de comparaison</strong> : tous les bâtiments du même type (industrie, logistique, bureaux…) dans le canton de Genève, la même année. Les types regroupent les destinations officielles du SITG.</li>
      <li><strong>Médiane du groupe</strong> : la valeur centrale de l&apos;IDC du groupe.</li>
      <li><strong>Écart</strong> : (IDC − médiane) / médiane.</li>
      <li><strong>Percentile</strong> : part du groupe ayant un IDC plus bas. Le 84e percentile signifie un IDC plus élevé que 84 % des bâtiments similaires.</li>
      <li>Si un groupe compte moins de <strong>10 bâtiments</strong>, aucun benchmark n&apos;est affiché.</li>
      <li>La <strong>médiane de la zone</strong> n&apos;est affichée, à titre de contexte, que si la zone compte au moins 10 bâtiments cette année-là.</li>
    </ul>

    <h2>Tendance et énergie estimée</h2>
    <ul>
      <li><strong>Tendance sur 3 ans</strong> : évolution entre le dernier IDC et celui du même bâtiment trois ans plus tôt. L&apos;IDC étant corrigé du climat, les années sont comparables.</li>
      <li><strong>Énergie finale estimée</strong> = IDC × SRE / 3600, en MWh par an, corrigée du climat. C&apos;est un ordre de grandeur pour le chauffage et l&apos;eau chaude, pas une mesure de compteur.</li>
    </ul>

    <h2>Seuils légaux (indicatif)</h2>
    <p>Le règlement genevois sur l&apos;énergie se base sur l&apos;IDC moyen des trois dernières années. Au-dessus de 450 MJ/m², des mesures d&apos;amélioration sont exigées. Au-dessus du seuil « significatif », une rénovation énergétique est obligatoire : 800 MJ/m² jusqu&apos;à fin 2026, 650 dès 2027 et 550 dès 2031. ThermoGeneva compare la moyenne publiée à ces valeurs à titre informatif ; les obligations sont déterminées par l&apos;office cantonal de l&apos;énergie (OCEN).</p>

    <h2>Règles de qualité</h2>
    <ul>
      <li>Les enregistrements sans EGID, avec une année invraisemblable ou un IDC négatif sont écartés.</li>
      <li>Les doublons (même EGID et même année) sont résolus de façon déterministe : date de saisie la plus récente, puis identifiant source le plus élevé.</li>
      <li>Une SRE invalide est laissée vide : aucune estimation d&apos;énergie n&apos;est alors calculée.</li>
      <li>Si la source officielle change de structure, la mise à jour s&apos;arrête plutôt que de publier des données incohérentes.</li>
    </ul>

    <h2>Limites</h2>
    <p>Les valeurs sont déclarées par les propriétaires et dépendent de la SRE déclarée. Les groupes mélangent des bâtiments d&apos;âges et de tailles différents. Une valeur élevée invite à regarder de plus près, ce n&apos;est pas un verdict : ThermoGeneva est un outil de pré-analyse, pas un audit énergétique.</p>
    <h2>Sources officielles</h2>
    <ul>
      <li><a href={SOURCES.idcInfo}>État de Genève — Connaître la consommation d&apos;énergie d&apos;un bâtiment (IDC)</a></li>
      <li><a href={SOURCES.thresholds}>État de Genève — Que faire selon le résultat IDC de votre immeuble (seuils)</a></li>
      <li><a href={SOURCES.idc}>SITG — Jeu de données IDC (moyennes 2 et 3 ans)</a></li>
      <li><a href={SOURCES.fti}>FTI — Noms officiels des zones industrielles (carte de la Fondation pour les terrains industriels de Genève)</a></li>
    </ul>
  </>
);

export default async function MethodologyPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const ts = await getTranslations("seo");
  const tn = await getTranslations("nav");
  return (
    <div className="container page">
      <JsonLd data={[
        breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("methodology"), path: `/${locale}/methodology` }]),
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: t("methodologyTitle"),
          description: ts("methodologyDescription"),
          inLanguage: locale,
          url: absolute(`/${locale}/methodology`),
          author: { "@type": "Person", name: AUTHOR },
          citation: [SOURCES.idcInfo, SOURCES.thresholds, SOURCES.idc, SOURCES.fti],
          about: [
            { "@type": "Thing", name: locale === "fr" ? "Indice de dépense de chaleur (IDC)" : "Heat consumption index (IDC)" },
            { "@type": "Place", name: "Canton of Geneva" },
          ],
        },
      ]} />
      <div className="prose">
        <h1>{t("methodologyTitle")}</h1>
        {locale === "fr" ? FR : EN}
      </div>
    </div>
  );
}
