"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  IconBook, IconDatabase, IconGithub, IconHome, IconMap, IconPanel, IconShield, IconZones,
} from "./icons";

export default function Sidebar({ lastRefresh }: { lastRefresh: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("tg-sidebar") === "collapsed");
    } catch { /* storage non disponibile */ }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "open";
    try { localStorage.setItem("tg-sidebar", collapsed ? "collapsed" : "open"); } catch { /* ignore */ }
  }, [collapsed]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const main = [
    { href: "/", label: t("overview"), icon: <IconHome /> },
    { href: "/explore", label: t("explore"), icon: <IconMap /> },
    { href: "/zones", label: t("zones"), icon: <IconZones /> },
  ];
  const info = [
    { href: "/methodology", label: t("methodology"), icon: <IconBook /> },
    { href: "/data", label: t("data"), icon: <IconDatabase /> },
    { href: "/privacy", label: t("privacy"), icon: <IconShield /> },
  ];

  const item = (it: { href: string; label: string; icon: React.ReactNode }) => (
    <Link
      key={it.href}
      href={it.href}
      className="side-item"
      aria-current={isActive(it.href) ? "page" : undefined}
      title={collapsed ? it.label : undefined}
    >
      {it.icon}
      <span className="side-label">{it.label}</span>
    </Link>
  );

  return (
    <aside className="sidebar">
      <div className="side-top">
        <Link href="/" className="side-brand" aria-label="ThermoGeneva">
          <span className="side-logo" aria-hidden>
            <span /><span /><span />
          </span>
          <span className="side-label side-brand-name">ThermoGeneva</span>
        </Link>
        <button
          className="side-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t("expand") : t("collapse")}
          title={collapsed ? t("expand") : t("collapse")}
        >
          <IconPanel />
        </button>
      </div>

      <div className="side-section side-label">{t("sectionMain")}</div>
      <nav className="side-nav">{main.map(item)}</nav>

      <div className="side-section side-label">{t("sectionInfo")}</div>
      <nav className="side-nav">{info.map(item)}</nav>

      <div className="side-bottom">
        <div className="lang-switch" role="group" aria-label="Language">
          {(["en", "fr"] as const).map((l) => (
            <Link key={l} href={pathname} locale={l} aria-current={l === locale ? "true" : undefined} hrefLang={l}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <div className="side-meta side-label">
          <span>{t("updated")}</span>
          <strong>{lastRefresh}</strong>
        </div>
        <a className="side-item side-small" href="https://github.com/ciro14comes/thermogeneva" title="GitHub">
          <IconGithub />
          <span className="side-label">GitHub</span>
        </a>
      </div>
    </aside>
  );
}
