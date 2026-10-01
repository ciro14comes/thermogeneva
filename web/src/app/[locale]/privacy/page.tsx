import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ locale: string }> };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ciro14comes@gmail.com";

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMeta({ locale, path: "/privacy", title: t("privacyTitle"), description: t("privacyDescription") });
}

export default async function PrivacyPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const fr = locale === "fr";
  const tn = await getTranslations("nav");

  return (
    <div className="container page">
      <JsonLd data={breadcrumbLd([{ name: tn("home"), path: `/${locale}` }, { name: tn("privacy"), path: `/${locale}/privacy` }])} />
      <div className="prose">
        <h1>{t("privacyTitle")}</h1>

        <h2>{fr ? "Responsable" : "Controller"}</h2>
        <p>
          ThermoGeneva — Ciro Scognamiglio.{" "}
          {CONTACT ? (
            <>{fr ? "Contact" : "Contact"}: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></>
          ) : null}
        </p>

        <h2>{fr ? "Données des visiteurs" : "Visitor data"}</h2>
        <ul>
          <li>{fr ? "Pas de comptes utilisateur, pas de formulaire, pas de publicité, pas de cookies de suivi." : "No user accounts, no forms, no advertising, no tracking cookies."}</li>
          <li>{fr ? "L'hébergeur (Vercel) traite techniquement l'adresse IP et les journaux d'accès pour délivrer le site et le protéger ; ces journaux ne sont pas utilisés pour profiler les visiteurs." : "The host (Vercel) technically processes IP addresses and access logs to deliver and protect the site; these logs are not used to profile visitors."}</li>
          <li>{fr ? "La carte charge des tuiles depuis swisstopo (geo.admin.ch), qui reçoit donc l'adresse IP du navigateur." : "The map loads tiles from swisstopo (geo.admin.ch), which therefore receives the browser's IP address."}</li>
          <li>{fr ? "Si une mesure d'audience est ajoutée, elle sera sans cookies et cette page sera mise à jour." : "If audience measurement is added, it will be cookieless and this page will be updated."}</li>
        </ul>

        <h2>{fr ? "Données sur les bâtiments" : "Building data"}</h2>
        <p>{fr ? "ThermoGeneva publie uniquement des données ouvertes sur les bâtiments (EGID, adresse, destination, IDC, SRE, agent énergétique, géométrie). Aucun nom de propriétaire, d'occupant ou de répondant n'est collecté ni publié." : "ThermoGeneva only publishes open building data (EGID, address, use, IDC, SRE, energy carrier, geometry). No owner, occupant or respondent names are collected or published."}</p>

        <h2>{fr ? "Vos droits" : "Your rights"}</h2>
        <p>{fr ? "Conformément à la loi fédérale sur la protection des données (LPD), vous pouvez demander des informations ou signaler une erreur en écrivant au contact ci-dessus." : "Under the Swiss Federal Act on Data Protection (FADP), you can request information or report an error by writing to the contact above."}</p>
      </div>
    </div>
  );
}
