"use client";
// Storico IDC a confronto in "piccoli multipli": un riquadro per edificio, tutti sulla stessa scala.
// Stile moderno: curva morbida, area sfumata nel colore della classe (lo stesso della mappa),
// mediana del gruppo tratteggiata, soglia 450, ultimo valore in evidenza, dettaglio dell'anno al passaggio del mouse.
import { useId, useRef, useState } from "react";
import { CLASS_COLOR, COMPARE_LETTERS, type BenchClass } from "@/lib/format";

export type HistorySeries = {
  label: string;
  cls: BenchClass;
  points: { year: number; idc: number; peer: number | null }[];
};

type Labels = { idc: string; peer: string; threshold: string; change: string };

/** Curva morbida che passa per tutti i punti senza "sbordare" (monotona, Fritsch–Carlson). */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 2) return "";
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function Panel({ s, index, y0, y1, vMax, labels, nf }: {
  s: HistorySeries; index: number; y0: number; y1: number; vMax: number; labels: Labels; nf: Intl.NumberFormat;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 360, H = 180, L = 6, R = 6, T = 10, B = 22;
  const color = CLASS_COLOR[s.cls];
  const pts = [...s.points].sort((a, b) => a.year - b.year);
  const x = (yr: number) => L + ((yr - y0) / Math.max(1, y1 - y0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / vMax) * (H - T - B);
  const xy = pts.map((p) => [x(p.year), y(p.idc)] as [number, number]);
  const line = smoothPath(xy);
  const area = pts.length >= 2 ? `${line}L${xy[xy.length - 1][0].toFixed(1)},${H - B}L${xy[0][0].toFixed(1)},${H - B}Z` : "";
  const peerPts = pts.filter((p) => p.peer != null).map((p) => [x(p.year), y(p.peer!)] as [number, number]);
  const last = pts[pts.length - 1];
  const before = last ? pts.find((p) => p.year === last.year - 3) : undefined;
  const change = last && before ? ((last.idc - before.idc) / before.idc) * 100 : null;
  const hp = hover == null ? null : pts.find((p) => p.year === hover) ?? null;

  const onMove = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const yr = Math.round(y0 + ((((clientX - box.left) / box.width) * W - L) / (W - L - R)) * (y1 - y0));
    setHover(Math.min(y1, Math.max(y0, yr)));
  };

  return (
    <article className="hist-panel">
      <header className="hist-head">
        <span className={`cmp-letter cmp-c-${s.cls}`}>{COMPARE_LETTERS[index]}</span>
        <span className="hist-name" title={s.label}>{s.label}</span>
      </header>
      <div className="hist-kpi">
        <span className="hist-value num">{hp ? nf.format(Math.round(hp.idc)) : last ? nf.format(Math.round(last.idc)) : "—"}</span>
        <span className="hist-unit">MJ/m²</span>
        <span className="hist-year num">{hover ?? last?.year}</span>
        {hover == null && change != null && (
          <span className={`hist-chip ${change <= -2 ? "is-down" : change >= 2 ? "is-up" : ""}`}>
            {change > 0 ? "▲" : change < 0 ? "▼" : "■"} {Math.abs(change).toFixed(1)}% · {labels.change}
          </span>
        )}
        {hp && hp.peer != null && <span className="hist-peer">{labels.peer}: <span className="num">{nf.format(Math.round(hp.peer))}</span></span>}
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${COMPARE_LETTERS[index]} · ${s.label}`}
        style={{ display: "block", touchAction: "pan-y" }}
        onMouseMove={(e) => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)} onTouchMove={(e) => onMove(e.touches[0].clientX)}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.38" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#E2E8F0" />
        <line x1={L} x2={W - R} y1={y(450)} y2={y(450)} stroke="#D97706" strokeDasharray="3 4" strokeWidth="1.2" opacity="0.85" />
        {area && <path d={area} fill={`url(#g${uid})`} />}
        {peerPts.length >= 2 && <path d={smoothPath(peerPts)} fill="none" stroke="#475569" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.75" />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {last && !hp && <>
          <circle cx={x(last.year)} cy={y(last.idc)} r="8" fill={color} opacity="0.2" />
          <circle cx={x(last.year)} cy={y(last.idc)} r="4.2" fill={color} stroke="#fff" strokeWidth="2" />
        </>}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#94A3B8" strokeDasharray="3 3" />}
        {hp && <>
          <circle cx={x(hp.year)} cy={y(hp.idc)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
          {hp.peer != null && <circle cx={x(hp.year)} cy={y(hp.peer)} r="3.5" fill="#fff" stroke="#475569" strokeWidth="1.5" />}
        </>}
        <text x={L} y={H - 6} fontSize="10.5" fill="#94A3B8" fontFamily="var(--font-mono)">{y0}</text>
        <text x={W - R} y={H - 6} fontSize="10.5" fill="#94A3B8" fontFamily="var(--font-mono)" textAnchor="end">{y1}</text>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
      </svg>
    </article>
  );
}

export default function CompareChart({ series, labels, locale }: { series: HistorySeries[]; labels: Labels; locale: string }) {
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-CH" : "de-CH");
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return null;
  const y0 = Math.min(...all.map((p) => p.year));
  const y1 = Math.max(...all.map((p) => p.year));
  // stessa scala verticale per tutti i riquadri, così le altezze sono confrontabili
  const vMax = Math.ceil((Math.max(450, ...all.flatMap((p) => [p.idc, p.peer ?? 0])) * 1.1) / 100) * 100;
  return (
    <>
      <div className="hist-grid">
        {series.map((s, i) => <Panel key={i} s={s} index={i} y0={y0} y1={y1} vMax={vMax} labels={labels} nf={nf} />)}
      </div>
      <div className="glance-legend small muted" style={{ marginTop: 14 }}>
        <span><i className="lg-curve" /> {labels.idc}</span>
        <span><i className="lg-peer-dash" /> {labels.peer}</span>
        <span><i className="lg-thr-h" /> {labels.threshold}</span>
        <span>· 0–{nf.format(vMax)} MJ/m²</span>
      </div>
    </>
  );
}
