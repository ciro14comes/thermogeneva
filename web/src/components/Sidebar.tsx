"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  IconBook, IconClose, IconCompare, IconDatabase, IconGithub, IconHome, IconInsight, IconMap, IconMenu, IconPanel, IconShield, IconZones,
} from "./icons";

export default function Sidebar({ lastRefresh }: { lastRefresh: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // telefono: menu a tendina aperto dal pulsante ☰
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname, locale]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
    { href: "/compare", label: t("compare"), icon: <IconCompare /> },
    { href: "/insights", label: t("insights"), icon: <IconInsight /> },
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

  const langSwitch = (extra = "") => (
    <div className={`lang-switch${extra}`} role="group" aria-label="Language">
      {(["en", "fr"] as const).map((l) => (
        <Link key={l} href={pathname} locale={l} aria-current={l === locale ? "true" : undefined} hrefLang={l}>
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
  const menuItem = (it: { href: string; label: string; icon: React.ReactNode }) => (
    <Link key={it.href} href={it.href} className="side-item" aria-current={isActive(it.href) ? "page" : undefined}>
      {it.icon}
      <span>{it.label}</span>
    </Link>
  );

  return (
    <aside className={`sidebar${menuOpen ? " is-menu-open" : ""}`}>
      {/* ---- barra per telefono: logo, Explore, lingua, menu ---- */}
      <div className="m-bar">
        <Link href="/" className="m-brand" aria-label="ThermoGeneva">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="side-logo" src="/logo.png" alt="" width={32} height={32} />
        </Link>
        <Link href="/explore" className="m-explore" aria-current={isActive("/explore") ? "page" : undefined}>
          <IconMap size={16} /> {t("explore")}
        </Link>
        {langSwitch(" m-lang")}
        <button type="button" className="m-burger" aria-expanded={menuOpen} aria-controls="m-menu"
          aria-label={menuOpen ? t("menuClose") : t("menuOpen")} onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <>
          <div className="m-backdrop" onClick={() => setMenuOpen(false)} aria-hidden />
          <nav id="m-menu" className="m-menu" aria-label={t("menuOpen")}>
            <div className="side-section">{t("sectionMain")}</div>
            {main.map(menuItem)}
            <div className="side-section">{t("sectionInfo")}</div>
            {info.map(menuItem)}
            <div className="m-menu-foot">
              <span className="side-meta" style={{ padding: 0 }}><span>{t("updated")}</span><strong>{lastRefresh}</strong></span>
              <a className="side-item side-small" href="https://github.com/ciro14comes/thermogeneva"><IconGithub /> GitHub</a>
            </div>
          </nav>
        </>
      )}

      <div className="side-top">
        <Link href="/" className="side-brand" aria-label="ThermoGeneva">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="side-logo" src="/logo.png" alt="" width={34} height={34} />
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
        {langSwitch()}
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
