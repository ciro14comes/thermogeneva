"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Link } from "@/i18n/navigation";
import { CLASS_COLOR, PALETTE, classOf, fmtNum, fmtOrdinal, fmtPct, idcColor, trendColor, type BenchClass } from "@/lib/format";
import { IconArrowLeft, IconChevron, IconList, IconMap, IconSearch } from "./icons";

/* ---------------- tipi ---------------- */
type Props = {
  egid: number;
  address: string | null;
  zone_id: number;
  family: string;
  year: number;
  idc: number;
  idc_avg_3y: number | null;
  peer_percentile: number | null;
  delta_vs_peer_pct: number | null;
  peer_median: number | null;
  final_energy_mwh: number | null;
  energy_source: string | null;
  sre: number | null;
  above_450: boolean | null;
  trend_3y_pct: number | null;
};
type ZoneProps = { zone_id: number; zone_type: string; zone_name: string | null; slug: string; commune: string | null };
type Geom = { type: string; coordinates: number[][][][] | number[][][] };
type Feature<P> = { type: "Feature"; id: number; geometry: Geom; properties: P };
type FC<P> = { type: "FeatureCollection"; features: Feature<P>[] };
type MapData = { zones: FC<ZoneProps>; buildings: FC<Props> };
type HistoryPoint = { year: number; idc: number; peer_median: number | null };

type ColorMode = "class" | "idc";
type View = "map" | "list";

const STYLE_URL = "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json";
const PANEL_W = 388 + 36;

/* ---------------- espressioni colore MapLibre ---------------- */
const CLASS_EXPR = [
  "case",
  ["==", ["get", "peer_percentile"], null], CLASS_COLOR.none,
  ["<=", ["get", "peer_percentile"], 25], CLASS_COLOR.good,
  ["<=", ["get", "peer_percentile"], 75], CLASS_COLOR.mid,
  CLASS_COLOR.high,
];
const IDC_EXPR = [
  "interpolate", ["linear"], ["get", "idc"],
  200, PALETTE.idcScale[0], 400, PALETTE.idcScale[1], 600, PALETTE.idcScale[2], 800, PALETTE.idcScale[3],
];

/* ---------------- geometria ---------------- */
function firstRing(g: Geom): number[][] {
  if (g.type === "MultiPolygon") return (g.coordinates as number[][][][])[0][0];
  return (g.coordinates as number[][][])[0];
}
function centroid(g: Geom): [number, number] {
  const ring = firstRing(g);
  const n = ring.length || 1;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}
function zoneLabel(z: ZoneProps | undefined): string {
  if (!z) return "—";
  return z.zone_name ?? `${z.commune ?? "Zone"} · ${z.zone_type}`;
}
function toNum(v: unknown): number | null {
  return v === null || v === undefined || v === "" || v === "null" ? null : Number(v);
}
function normalize(p: Props): Props {
  return {
    ...p,
    egid: Number(p.egid), zone_id: Number(p.zone_id), year: Number(p.year), idc: Number(p.idc),
    idc_avg_3y: toNum(p.idc_avg_3y), peer_percentile: toNum(p.peer_percentile),
    delta_vs_peer_pct: toNum(p.delta_vs_peer_pct), peer_median: toNum(p.peer_median),
    final_energy_mwh: toNum(p.final_energy_mwh), sre: toNum(p.sre), trend_3y_pct: toNum(p.trend_3y_pct),
    above_450: p.above_450 === true || (p.above_450 as unknown) === "true",
  };
}
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ================================================================ */
export default function Explorer() {
  const t = useTranslations("explore");
  const tb = useTranslations("building");
  const tf = useTranslations("families");
  const locale = useLocale();

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [selected, setSelected] = useState<Props | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("class");
  const [family, setFamily] = useState("all");
  const [zoneId, setZoneId] = useState("all");
  const [classFilter, setClassFilter] = useState<BenchClass | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("map");
  const [canton, setCanton] = useState<{ geometry: Geom; bbox: [number, number, number, number] } | null>(null);

  /* ---------- dati ---------- */
  useEffect(() => {
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: MapData) => {
        d.buildings.features.forEach((f) => (f.properties = normalize(f.properties)));
        setData(d);
      })
      .catch((e) => setError(String(e)));
    fetch("/api/canton")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (c?.geometry) setCanton(c); })
      .catch(() => {});
  }, []);

  const zonesById = useMemo(() => {
    const m = new Map<number, ZoneProps>();
    data?.zones.features.forEach((f) => m.set(Number(f.properties.zone_id), f.properties));
    return m;
  }, [data]);

  const points = useMemo<FC<Props> | null>(() => {
    if (!data) return null;
    return {
      type: "FeatureCollection",
      features: data.buildings.features.map((f) => ({
        type: "Feature", id: f.id, properties: f.properties,
        geometry: { type: "Point", coordinates: centroid(f.geometry) as unknown as number[][][] },
      })),
    };
  }, [data]);

  /* ---------- filtri ---------- */
  const visible = useMemo(() => {
    if (!data) return [];
    return data.buildings.features
      .map((f) => f.properties)
      .filter((p) => (family === "all" || p.family === family) && (zoneId === "all" || p.zone_id === Number(zoneId)));
  }, [data, family, zoneId]);

  const shown = useMemo(
    () => (classFilter ? visible.filter((p) => classOf(p.peer_percentile) === classFilter) : visible),
    [visible, classFilter],
  );

  const stats = useMemo(() => {
    const counts: Record<BenchClass, number> = { good: 0, mid: 0, high: 0, none: 0 };
    visible.forEach((p) => counts[classOf(p.peer_percentile)]++);
    const withPeer = visible.filter((p) => p.peer_median != null);
    const abovePeer = withPeer.filter((p) => p.idc > (p.peer_median ?? Infinity)).length;
    return {
      counts,
      sharePct: withPeer.length ? Math.round((100 * abovePeer) / withPeer.length) : null,
      medianIdc: median(shown.map((p) => p.idc)),
      above450: shown.filter((p) => p.above_450).length,
      energy: shown.reduce((s, p) => s + (p.final_energy_mwh ?? 0), 0),
      n: shown.length,
    };
  }, [visible, shown]);

  const hist = useMemo(() => {
    const bins = Array.from({ length: 20 }, (_, i) => ({ from: i * 50, n: 0 }));
    shown.forEach((p) => { bins[Math.min(19, Math.max(0, Math.floor(p.idc / 50)))].n++; });
    return { bins, max: Math.max(1, ...bins.map((b) => b.n)) };
  }, [shown]);

  /* ---------- mappa ---------- */
  useEffect(() => {
    if (!data || !points || !mapEl.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const mod = await import("maplibre-gl");
      const maplibregl = ((mod as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelled || !mapEl.current) return;
      // v6: il worker viene servito da /public/maplibre (vedi scripts/copy-maplibre-worker.mjs)
      if (typeof maplibregl.setWorkerUrl === "function") maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const map = new maplibregl.Map({
        container: mapEl.current,
        style: STYLE_URL,
        center: [6.12, 46.2],
        zoom: 11,
        attributionControl: { compact: true, customAttribution: "© swisstopo · Data © SITG" },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });

      map.on("load", () => {
        map.addSource("zones", { type: "geojson", data: data.zones as never });
        map.addSource("buildings", { type: "geojson", data: data.buildings as never, promoteId: "egid" });
        map.addSource("points", { type: "geojson", data: points as never, promoteId: "egid" });

        map.addLayer({ id: "zones-fill", type: "fill", source: "zones",
          paint: { "fill-color": PALETTE.primary, "fill-opacity": 0.05 } });
        map.addLayer({ id: "zones-line", type: "line", source: "zones",
          paint: { "line-color": PALETTE.primary, "line-width": 1.3, "line-opacity": 0.5, "line-dasharray": [3, 2] } });

        // poligoni dal livello di quartiere in su
        // colore pieno solo sull'edificio selezionato; gli altri restano tenui (hover = intermedio)
        map.addLayer({ id: "buildings-fill", type: "fill", source: "buildings", minzoom: 14.5,
          paint: {
            "fill-color": CLASS_EXPR as never,
            "fill-opacity": ["case",
              ["boolean", ["feature-state", "selected"], false], 0.95,
              ["boolean", ["feature-state", "hover"], false], 0.6,
              0.3] as never,
          } });
        map.addLayer({ id: "buildings-line", type: "line", source: "buildings", minzoom: 14.5,
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "selected"], false], PALETTE.text, CLASS_EXPR] as never,
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1] as never,
            "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0.7] as never,
          } });

        // punti "glow" a zoom bassi (come nel riferimento)
        map.addLayer({ id: "points-glow", type: "circle", source: "points", maxzoom: 15,
          paint: {
            "circle-color": CLASS_EXPR as never,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 13] as never,
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.28, 15, 0] as never,
            "circle-blur": 0.6,
          } });
        map.addLayer({ id: "points", type: "circle", source: "points", maxzoom: 15,
          paint: {
            "circle-color": CLASS_EXPR as never,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6.5] as never,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.5] as never,
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 1, 15, 0] as never,
            "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 14, 1, 15, 0] as never,
          } });

        const coords = data.zones.features.flatMap((f) => firstRing(f.geometry));
        if (coords.length) {
          const xs = coords.map((c) => c[0]);
          const ys = coords.map((c) => c[1]);
          map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
            { padding: { top: 60, bottom: 40, right: 60, left: window.innerWidth > 900 ? PANEL_W : 40 }, duration: 0 });
        }

        let hovered: number | null = null;
        const setHover = (id: number | null) => {
          if (hovered !== null) map.setFeatureState({ source: "buildings", id: hovered }, { hover: false });
          hovered = id;
          if (id !== null) map.setFeatureState({ source: "buildings", id }, { hover: true });
        };
        map.on("mouseleave", "buildings-fill", () => setHover(null));

        for (const layer of ["buildings-fill", "points"]) {
          map.on("mousemove", layer, (e) => {
            map.getCanvas().style.cursor = "pointer";
            const p = e.features?.[0]?.properties as Props | undefined;
            if (!p) return;
            if (layer === "buildings-fill") setHover(Number(p.egid));
            popup.setLngLat(e.lngLat)
              .setHTML(`<strong>${p.address ?? "EGID " + p.egid}</strong><br/>IDC ${fmtNum(Number(p.idc), locale)}` +
                (p.peer_median != null && String(p.peer_median) !== "null"
                  ? ` · ${tb("peerMedian")} ${fmtNum(Number(p.peer_median), locale)}` : ""))
              .addTo(map);
          });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; popup.remove(); });
          map.on("click", layer, (e) => {
            const p = e.features?.[0]?.properties as Props | undefined;
            if (p) setSelected(normalize(p));
          });
        }
        setMapReady(true);
      });
    })();

    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, points]);

  /* maschera "fuori Ginevra" + limiti di spostamento */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !canton || map.getSource("canton-mask")) return;
    const polys = (canton.geometry.type === "MultiPolygon"
      ? (canton.geometry.coordinates as number[][][][])
      : [canton.geometry.coordinates as number[][][]]);
    const [x0, y0, x1, y1] = canton.bbox;
    const world = [[x0 - 3, y0 - 3], [x1 + 3, y0 - 3], [x1 + 3, y1 + 3], [x0 - 3, y1 + 3], [x0 - 3, y0 - 3]];
    const mask = {
      type: "Feature", properties: {},
      geometry: { type: "Polygon", coordinates: [world, ...polys.map((p) => p[0])] },
    };
    map.addSource("canton-mask", { type: "geojson", data: mask as never });
    map.addSource("canton", { type: "geojson", data: { type: "Feature", properties: {}, geometry: canton.geometry } as never });
    // sotto le zone e gli edifici, sopra lo sfondo
    map.addLayer({ id: "canton-mask", type: "fill", source: "canton-mask",
      paint: { "fill-color": PALETTE.background, "fill-opacity": 0.82 } }, "zones-fill");
    map.addLayer({ id: "canton-line", type: "line", source: "canton",
      paint: { "line-color": PALETTE.textSecondary, "line-width": 1.6, "line-opacity": 0.8 } }, "zones-fill");
    const pad = 0.06;
    map.setMaxBounds([[x0 - pad, y0 - pad], [x1 + pad, y1 + pad]]);
    map.setMinZoom(9.5);
  }, [mapReady, canton]);

  /* colore */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const expr = (colorMode === "class" ? CLASS_EXPR : IDC_EXPR) as never;
    map.setPaintProperty("buildings-fill", "fill-color", expr);
    map.setPaintProperty("buildings-line", "line-color",
      ["case", ["boolean", ["feature-state", "selected"], false], PALETTE.text, expr] as never);
    for (const l of ["points", "points-glow"]) map.setPaintProperty(l, "circle-color", expr);
    // sulla scala blu i valori bassi sono quasi bianchi: bordo scuro per distinguerli dalla base
    map.setPaintProperty("points", "circle-stroke-color", colorMode === "idc" ? PALETTE.textSecondary : "#ffffff");
  }, [colorMode, mapReady]);

  /* filtri sulla mappa */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const conds: unknown[] = ["all"];
    if (family !== "all") conds.push(["==", ["get", "family"], family]);
    if (zoneId !== "all") conds.push(["==", ["get", "zone_id"], Number(zoneId)]);
    if (classFilter === "none") conds.push(["==", ["get", "peer_percentile"], null]);
    if (classFilter === "good") conds.push(["all", ["!=", ["get", "peer_percentile"], null], ["<=", ["get", "peer_percentile"], 25]]);
    if (classFilter === "mid") conds.push(["all", ["!=", ["get", "peer_percentile"], null], [">", ["get", "peer_percentile"], 25], ["<=", ["get", "peer_percentile"], 75]]);
    if (classFilter === "high") conds.push(["all", ["!=", ["get", "peer_percentile"], null], [">", ["get", "peer_percentile"], 75]]);
    const filter = (conds.length > 1 ? conds : null) as never;
    for (const l of ["buildings-fill", "buildings-line", "points", "points-glow"]) map.setFilter(l, filter);
  }, [family, zoneId, classFilter, mapReady]);

  /* zoom sulla zona scelta */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data || zoneId === "all") return;
    const z = data.zones.features.find((f) => Number(f.properties.zone_id) === Number(zoneId));
    if (!z) return;
    const ring = firstRing(z.geometry);
    const xs = ring.map((c) => c[0]), ys = ring.map((c) => c[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
      { padding: { top: 80, bottom: 40, right: 60, left: window.innerWidth > 900 ? PANEL_W : 40 }, duration: 800 });
  }, [zoneId, mapReady, data]);

  /* selezione: evidenzia + storico */
  const prevSel = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (map && mapReady) {
      for (const src of ["buildings", "points"]) {
        if (prevSel.current !== null) map.setFeatureState({ source: src, id: prevSel.current }, { selected: false });
        if (selected) map.setFeatureState({ source: src, id: selected.egid }, { selected: true });
      }
    }
    prevSel.current = selected?.egid ?? null;
    setHistory(null);
    if (!selected) return;
    let alive = true;
    fetch(`/api/buildings/${selected.egid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.history) setHistory(d.history.map((h: HistoryPoint) => ({ year: Number(h.year), idc: Number(h.idc), peer_median: toNum(h.peer_median) }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selected, mapReady]);

  const families = useMemo(
    () => (data ? [...new Set(data.buildings.features.map((f) => f.properties.family))].sort() : []),
    [data],
  );
  const zoneOptions = useMemo(() => {
    if (!data) return [];
    const withB = new Set(data.buildings.features.map((f) => f.properties.zone_id));
    return data.zones.features.map((f) => f.properties)
      .filter((z) => withB.has(Number(z.zone_id)))
      .sort((a, b) => zoneLabel(a).localeCompare(zoneLabel(b)));
  }, [data]);

  const results = useMemo(() => {
    if (!data || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return data.buildings.features
      .filter((f) => String(f.properties.egid).includes(q) || (f.properties.address ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [data, query]);

  function selectEgid(egid: number) {
    const f = data?.buildings.features.find((x) => x.properties.egid === egid);
    if (!f) return;
    setSelected(f.properties);
    setQuery("");
    mapRef.current?.flyTo({ center: centroid(f.geometry), zoom: 16.5, duration: 900,
      padding: { left: window.innerWidth > 900 ? PANEL_W : 0, top: 0, right: 0, bottom: 0 } });
  }

  const zoneSel = zoneId === "all" ? undefined : zonesById.get(Number(zoneId));
  const classes: { key: BenchClass; label: string; sub: string }[] = [
    { key: "good", label: t("classGood"), sub: "≤ P25" },
    { key: "mid", label: t("classMid"), sub: "P25 – P75" },
    { key: "high", label: t("classHigh"), sub: "> P75" },
    { key: "none", label: t("classNone"), sub: t("classNoneSub") },
  ];

  /* ================= render ================= */
  return (
    <div className="explore">
      <div ref={mapEl} className="map" />
      {!mapReady && !error && <div className="map-status">{t("loading")}</div>}
      {error && <div className="map-status">⚠ {error}</div>}

      {/* ---------- card metriche, sempre visibile ---------- */}
      <section className="panel" aria-label={t("title")}>
        {!selected ? (
          <>
            <header className="panel-head">
              <div className="panel-crumb">{t("crumbRoot")}</div>
              <div className="panel-title">
                Genève <IconChevron size={16} /> {zoneSel ? zoneLabel(zoneSel) : t("allZones")}
              </div>
              <div className="search-box">
                <IconSearch size={16} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} autoComplete="off" aria-label={t("search")} />
                {query.trim().length >= 2 && (
                  <ul className="search-results">
                    {results.length === 0 && <li className="small muted" style={{ padding: 8 }}>{t("noResults")}</li>}
                    {results.map((f) => (
                      <li key={f.properties.egid}>
                        <button type="button" onClick={() => selectEgid(f.properties.egid)}>
                          <span className="dot" style={{ background: CLASS_COLOR[classOf(f.properties.peer_percentile)] }} />
                          {f.properties.address ?? "—"} <span className="muted small">· {f.properties.egid}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="filters">
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} aria-label={t("zone")}>
                  <option value="all">{t("allZones")}</option>
                  {zoneOptions.map((z) => <option key={z.zone_id} value={z.zone_id}>{zoneLabel(z)}</option>)}
                </select>
                <select value={family} onChange={(e) => setFamily(e.target.value)} aria-label={t("family")}>
                  <option value="all">{t("allTypes")}</option>
                  {families.map((f) => <option key={f} value={f}>{tf(f)}</option>)}
                </select>
              </div>
            </header>

            <div className="panel-body">
              {/* stato */}
              <div className="panel-block" style={{ paddingTop: 0 }}>
                <div className="status-row">
                  <div className="status-gauge" aria-hidden>
                    <div style={{ height: `${stats.sharePct ?? 0}%`, background: (stats.sharePct ?? 0) > 50 ? "var(--high)" : "var(--good)" }} />
                  </div>
                  <div>
                    <div className="eyebrow">{t("shareAbove")}</div>
                    <div className="status-value">{stats.sharePct ?? "—"}<small>%</small></div>
                  </div>
                </div>
                <div className="pills">
                  {classes.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`pill pill-${c.key} ${classFilter && classFilter !== c.key ? "dim" : ""}`}
                      aria-pressed={classFilter === c.key}
                      onClick={() => setClassFilter((cur) => (cur === c.key ? null : c.key))}
                    >
                      <span className="count">{stats.counts[c.key]}</span>
                      <span className="lbl">{c.label}<small>{c.sub}</small></span>
                    </button>
                  ))}
                </div>
              </div>

              {/* tiles */}
              <div className="panel-block">
                <div className="tiles">
                  <div className="tile"><div className="eyebrow">{t("tileMedian")}</div><div className="tile-value">{fmtNum(stats.medianIdc, locale)}<small>MJ/m²</small></div></div>
                  <div className="tile"><div className="eyebrow">{t("tileBuildings")}</div><div className="tile-value">{stats.n}</div></div>
                  <div className="tile"><div className="eyebrow">{t("tileAbove450")}</div><div className="tile-value">{stats.above450}</div></div>
                  <div className="tile"><div className="eyebrow">{t("tileEnergy")}</div><div className="tile-value">{fmtNum(stats.energy / 1000, locale, 1)}<small>GWh</small></div></div>
                </div>
              </div>

              {/* distribuzione */}
              <div className="panel-block">
                <div className="eyebrow">{t("distribution")}</div>
                <div className="hist">
                  {hist.bins.map((b) => (
                    <div key={b.from} title={`${b.from}–${b.from + 50}: ${b.n}`}
                      style={{ height: `${(b.n / hist.max) * 100}%`, background: idcColor(b.from + 25), opacity: b.n ? 1 : 0.25, outline: b.from + 25 < 300 ? "1px solid #BAE6FD" : undefined }} />
                  ))}
                  <div className="hist-line" style={{ left: `${(450 / 1000) * 100}%` }}><span>450</span></div>
                </div>
                <div className="hist-axis"><span>0</span><span>250</span><span>500</span><span>750</span><span>1000+</span></div>
              </div>

              {/* colore mappa */}
              <div className="panel-block">
                <div className="eyebrow" style={{ marginBottom: 8 }}>{t("colorBy")}</div>
                <div className="seg" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
                  <button aria-pressed={colorMode === "class"} onClick={() => setColorMode("class")}>{t("colorClass")}</button>
                  <button aria-pressed={colorMode === "idc"} onClick={() => setColorMode("idc")}>{t("colorIdc")}</button>
                </div>
                {colorMode === "idc" && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 8, borderRadius: 99, background: `linear-gradient(90deg, ${PALETTE.idcScale.join(", ")})`, border: "1px solid var(--line)" }} />
                    <div className="hist-axis"><span>≤ 200</span><span>400</span><span>600</span><span>≥ 800 MJ/m²</span></div>
                  </div>
                )}
                <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>{t("clickHint")}</p>
              </div>
            </div>
          </>
        ) : (
          <BuildingCard
            b={selected}
            history={history}
            zone={zonesById.get(selected.zone_id)}
            onBack={() => setSelected(null)}
          />
        )}
      </section>

      {/* ---------- strumenti in alto a destra ---------- */}
      <div className="map-tools">
        <div className="seg" role="group">
          <button aria-pressed={view === "map"} onClick={() => setView("map")}><IconMap size={15} /> {t("viewMap")}</button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")}><IconList size={15} /> {t("viewList")}</button>
        </div>
      </div>

      {view === "list" && (
        <section className="list-panel" aria-label={t("viewList")}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>{tb("idc")}</th><th>{t("address")}</th><th className="r">{tb("percentile")}</th></tr>
              </thead>
              <tbody>
                {[...shown].sort((a, b) => b.idc - a.idc).map((p) => (
                  <tr key={p.egid} onClick={() => selectEgid(p.egid)}>
                    <td className="num"><span className="dot" style={{ background: CLASS_COLOR[classOf(p.peer_percentile)] }} />{fmtNum(p.idc, locale)}</td>
                    <td>{p.address ?? `EGID ${p.egid}`}<div className="small muted">{tf(p.family)}</div></td>
                    <td className="r">{fmtOrdinal(p.peer_percentile, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );

  /* ---------------- card edificio ---------------- */
  function BuildingCard({ b, history, zone, onBack }: { b: Props; history: HistoryPoint[] | null; zone?: ZoneProps; onBack: () => void }) {
    const cls = classOf(b.peer_percentile);
    const clsLabel = { good: t("classGood"), mid: t("classMid"), high: t("classHigh"), none: t("classNone") }[cls];
    return (
      <>
        <header className="panel-head">
          <button className="back-btn" onClick={onBack}><IconArrowLeft size={15} /> {t("backAll")}</button>
          <div className="panel-crumb">{zoneLabel(zone)} · {tf(b.family)}</div>
          <div className="panel-title">{b.address ?? `EGID ${b.egid}`}</div>
          <div className="small muted">EGID <span className="num">{b.egid}</span> · {tb("year", { year: b.year })}</div>
        </header>
        <div className="panel-body">
          <div className="panel-block" style={{ paddingTop: 0 }}>
            <span className={`badge ${cls === "high" ? "badge-high" : cls === "good" ? "badge-ok" : cls === "mid" ? "badge-mid" : ""}`}>
              <span className="dot" style={{ background: CLASS_COLOR[cls], margin: 0 }} /> {clsLabel}
            </span>
            <div className="big-idc" style={{ marginTop: 12 }}>{fmtNum(b.idc, locale)}<small>MJ/m²·{locale === "fr" ? "an" : "yr"}</small></div>

            {b.peer_percentile != null ? (
              <>
                <div className="bench" style={{ marginTop: 18 }}>
                  <div className="bench-track">
                    <div className="bench-median" style={{ left: "50%" }} />
                    <div className="bench-marker" style={{ left: `${b.peer_percentile}%` }} />
                  </div>
                  <div className="bench-scale"><span>P0</span><span>{tb("peerMedian")}</span><span>P100</span></div>
                </div>
                <p className="small" style={{ margin: "10px 0 0" }}>{tb("percentileExplain", { p: b.peer_percentile })}</p>
              </>
            ) : (
              <p className="note">{tb("peerTooSmall")}</p>
            )}
          </div>

          <div className="panel-block">
            <dl className="kv">
              <dt>{tb("peerMedian")}</dt><dd>{fmtNum(b.peer_median, locale)}</dd>
              <dt>{tb("difference")}</dt><dd>{fmtPct(b.delta_vs_peer_pct, locale)}</dd>
              <dt>{tb("idcAvg3y")}</dt><dd>{fmtNum(b.idc_avg_3y, locale)}</dd>
              <dt>{tb("trend3y")}</dt><dd className="trend" style={{ color: trendColor(b.trend_3y_pct) }}>{fmtPct(b.trend_3y_pct, locale)}</dd>
              <dt>{tb("finalEnergy")}</dt><dd>{fmtNum(b.final_energy_mwh, locale)} MWh</dd>
              <dt>{tb("energySource")}</dt><dd>{b.energy_source ?? "—"}</dd>
            </dl>
          </div>

          <div className="panel-block">
            <div className="eyebrow">{tb("historyTitle")}</div>
            {history ? <Spark points={history} /> : <div className="small muted" style={{ padding: "18px 0" }}>…</div>}
            <div className="small muted" style={{ display: "flex", gap: 14 }}>
              <span>━ {tb("historyLegendIdc")}</span><span>╌ {tb("historyLegendPeer")}</span><span style={{ color: "var(--warning)" }}>┄ 450</span>
            </div>
          </div>

          <div className="panel-block">
            {b.idc_avg_3y == null ? (
              <span className="badge">{tb("noAvg")}</span>
            ) : b.above_450 ? (
              <span className="badge badge-warn">{tb("threshold450")}: {tb("above")}</span>
            ) : (
              <span className="badge badge-ok">450: {tb("below")}</span>
            )}
            <div className="btn-row">
              <Link href={`/buildings/${b.egid}`} className="btn btn-primary">{t("fullAnalysis")}</Link>
            </div>
          </div>
        </div>
      </>
    );
  }
}

/* ---------------- sparkline SVG ---------------- */
function Spark({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) return null;
  const W = 340, H = 70, P = 4;
  const ys = points.flatMap((p) => [p.idc, p.peer_median ?? p.idc, 450]);
  const max = Math.max(...ys) * 1.05, min = 0;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / (max - min)) * (H - 2 * P);
  const path = (get: (p: HistoryPoint) => number | null) =>
    points.map((p, i) => (get(p) == null ? "" : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(p)!).toFixed(1)}`)).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      <line x1={0} x2={W} y1={y(450)} y2={y(450)} stroke={PALETTE.warning} strokeDasharray="3 3" strokeWidth="1" />
      <path d={path((p) => p.peer_median)} fill="none" stroke={PALETTE.series[5]} strokeWidth="1.5" strokeDasharray="5 3" />
      <path d={path((p) => p.idc)} fill="none" stroke={PALETTE.series[0]} strokeWidth="2" />
      {points.map((p, i) => <circle key={p.year} cx={x(i)} cy={y(p.idc)} r="2.2" fill={PALETTE.series[0]} />)}
      <text x={P} y={H - 2} fontSize="9" fill={PALETTE.textSecondary}>{points[0].year}</text>
      <text x={W - P} y={H - 2} fontSize="9" fill={PALETTE.textSecondary} textAnchor="end">{points[points.length - 1].year}</text>
    </svg>
  );
}
