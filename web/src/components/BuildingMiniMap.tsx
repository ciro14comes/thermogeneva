"use client";
// Mini-mappa della pagina edificio: il contorno dell'edificio sulla base swisstopo, nel colore della sua classe.
// Volutamente ferma (niente trascinamento o zoom con la rotella): per esplorare c'è il link alla mappa completa.
import { useEffect, useRef, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json";
type Shape = { type: "Feature"; geometry: { type: string; coordinates: number[][][] | number[][][][] } };

export default function BuildingMiniMap({ egid, color, label }: { egid: number; color: string; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: MLMap | null = null;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/buildings/${egid}/shape`).catch(() => null);
      const shape: Shape | null = res && res.ok ? await res.json() : null;
      if (cancelled) return;
      if (!shape || !el.current) { setFailed(true); return; }
      const mod = await import("maplibre-gl");
      const maplibregl = ((mod as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelled || !el.current) return;
      if (typeof maplibregl.setWorkerUrl === "function") maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const ring = (shape.geometry.type === "MultiPolygon"
        ? (shape.geometry.coordinates as number[][][][])[0][0]
        : (shape.geometry.coordinates as number[][][])[0]);
      const xs = ring.map((c) => c[0]), ys = ring.map((c) => c[1]);
      map = new maplibregl.Map({
        container: el.current,
        style: STYLE_URL,
        center: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
        zoom: 17,
        interactive: false,
        attributionControl: { compact: true, customAttribution: "© swisstopo" },
      });
      map.on("load", () => {
        if (!map) return;
        map.resize();
        map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 60, maxZoom: 17.5, duration: 0 });
        if (map.getLayer("building")) map.setPaintProperty("building", "fill-color", "#FFFFFF");
        if (map.getLayer("building_casing")) map.setPaintProperty("building_casing", "line-color", "hsl(220, 12%, 78%)");
        map.addSource("me", { type: "geojson", data: shape as never });
        map.addLayer({ id: "me-fill", type: "fill", source: "me", paint: { "fill-color": color, "fill-opacity": 0.85 } });
        map.addLayer({ id: "me-line", type: "line", source: "me", paint: { "line-color": "#0F172A", "line-width": 2 } });
      });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [egid, color]);

  if (failed) return null;
  return <div ref={el} className="mini-map" role="img" aria-label={label} />;
}
