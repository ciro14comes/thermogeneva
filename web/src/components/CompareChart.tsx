"use client";
// Storico IDC a confronto: un unico grafico in stile "trend" (linee sottili, legenda con cerchietti,
// linea verticale che segue il mouse, cerchietti sulle linee, riquadro dei valori e anno in una pastiglia).
// Colore di ogni linea = colore della classe dell'edificio sulla mappa; se due edifici hanno la stessa
// classe, il secondo usa una tonalità più scura dello stesso colore.
import { useId, useRef, useState } from "react";
import { CLASS_COLOR, COMPARE_LETTERS, type BenchClass } from "@/lib/format";

export type HistorySeries = {
  label: string;
  cls: BenchClass;
  points: { year: number; idc: number; peer: number | null }[];
};

type Labels = { idc: string; peer: string; threshold: string; change: string };

function shade(hex: string, k: number): string {
  // k = 0 colore base; 1 più scuro; 2 più chiaro; 3 molto scuro
  const target = k === 2 ? [255, 255, 255] : [15, 23, 42];
  const amount = [0, 0.35, 0.3, 0.55][k] ?? 0;
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (target[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function seriesColors(classes: BenchClass[]): string[] {
  const seen: Record<string, number> = {};
  return classes.map((c) => {
    const k = seen[c] ?? 0;
    seen[c] = k + 1;
    return shade(CLASS_COLOR[c], k);
  });
}

export default function CompareChart({ series, labels, locale }: { series: HistorySeries[]; labels: Labels; locale: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-CH" : "de-CH");

  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return null;
  const colors = seriesColors(series.map((s) => s.cls));
  const W = 760, H = 300, L = 44, R = 20, T = 64, B = 40;
  const y0 = Math.min(...all.map((p) => p.year));
  const y1 = Math.max(...all.map((p) => p.year));
  const vals = all.map((p) => p.idc).concat([450]);
  const vMin = Math.max(0, Math.floor((Math.min(...vals) * 0.85) / 100) * 100);
  const vMax = Math.ceil((Math.max(...vals) * 1.05) / 100) * 100;
  const x = (yr: number) => L + ((yr - y0) / Math.max(1, y1 - y0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - vMin) / (vMax - vMin)) * (H - T - B);
  const sorted = series.map((s) => [...s.points].sort((a, b) => a.year - b.year));
  const path = (pts: { year: number; idc: number }[]) =>
    pts.map((p, j) => `${j === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.idc).toFixed(1)}`).join("");

  const yearTicks: number[] = [];
  for (let yr = y0; yr <= y1; yr++) if ((yr - y0) % 3 === 0 || yr === y1) yearTicks.push(yr);
  const gridVals: number[] = [];
  const step = vMax - vMin > 600 ? 200 : 100;
  for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) gridVals.push(v);

  const onMove = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const yr = Math.round(y0 + ((((clientX - box.left) / box.width) * W - L) / (W - L - R)) * (y1 - y0));
    setHover(Math.min(y1, Math.max(y0, yr)));
  };

  const hx = hover != null ? x(hover) : null;
  const rows = hover == null ? [] : sorted.map((pts, i) => {
    const p = pts.find((q) => q.year === hover);
    const prev = pts.find((q) => q.year === hover - 1);
    const delta = p && prev ? ((p.idc - prev.idc) / prev.idc) * 100 : null;
    return { i, p, delta };
  });
  const tipLeftPct = hx == null ? 0 : (hx / W) * 100;

  return (
    <div className="trend-card">
      {/* legenda */}
      <div className="trend-legend">
        {series.map((s, i) => (
          <span key={i} className="trend-key" title={s.label}>
            <i style={{ borderColor: colors[i] }} />
            <strong>{COMPARE_LETTERS[i]}</strong> <span className="trend-key-name">{s.label}</span>
          </span>
        ))}
        <span className="trend-key trend-key-thr"><i className="thr" /> {labels.threshold}</span>
      </div>

      <div className="trend-plot">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={labels.idc}
          style={{ display: "block", touchAction: "pan-y" }}
          onMouseMove={(e) => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)} onTouchMove={(e) => onMove(e.touches[0].clientX)}>
          <defs>
            {/* a destra dell'anno sotto il mouse le linee diventano più chiare */}
            <clipPath id={`past${uid}`}><rect x="0" y="0" width={hx ?? W} height={H} /></clipPath>
            <clipPath id={`future${uid}`}><rect x={hx ?? W} y="0" width={W} height={H} /></clipPath>
          </defs>

          {/* griglia molto leggera */}
          {gridVals.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E9EDF2" />
              <text x={L - 10} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#94A3B8" fontFamily="var(--font-mono)">{v}</text>
            </g>
          ))}
          {yearTicks.map((yr) => (
            <g key={yr}>
              <line x1={x(yr)} x2={x(yr)} y1={T - 8} y2={H - B} stroke="#EEF1F5" />
              {hover !== yr && <text x={x(yr)} y={H - 14} fontSize="11" textAnchor="middle" fill="#94A3B8" fontFamily="var(--font-mono)">{yr}</text>}
            </g>
          ))}
          {/* soglia 450 */}
          {450 >= vMin && 450 <= vMax && <>
            <line x1={L} x2={W - R} y1={y(450)} y2={y(450)} stroke="#D97706" strokeDasharray="2 5" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
            <text x={W - R} y={y(450) - 6} fontSize="10.5" textAnchor="end" fill="#B45309">450</text>
          </>}

          {/* linee */}
          {sorted.map((pts, i) => (
            <g key={i}>
              <path d={path(pts)} fill="none" stroke={colors[i]} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"
                clipPath={hover != null ? `url(#past${uid})` : undefined} />
              {hover != null && <path d={path(pts)} fill="none" stroke={colors[i]} strokeWidth="2.4" strokeLinejoin="round"
                strokeLinecap="round" opacity="0.3" clipPath={`url(#future${uid})`} />}
            </g>
          ))}

          {/* linea verticale + cerchietti sulle linee + anno in pastiglia */}
          {hx != null && <>
            <line x1={hx} x2={hx} y1={T - 18} y2={H - B + 4} stroke="#64748B" strokeDasharray="3 4" />
            {rows.map(({ i, p }) => p && (
              <circle key={i} cx={hx} cy={y(p.idc)} r="5.5" fill="#fff" stroke={colors[i]} strokeWidth="2.6" />
            ))}
            <g transform={`translate(${hx},${H - 19})`}>
              <rect x="-22" y="-12" width="44" height="22" rx="11" fill="#0F172A" />
              <text x="0" y="4" fontSize="11.5" fontWeight="600" textAnchor="middle" fill="#fff" fontFamily="var(--font-mono)">{hover}</text>
            </g>
          </>}
          <rect x={L} y={T - 20} width={W - L - R} height={H - T - B + 20} fill="transparent" />
        </svg>

        {/* riquadro dei valori */}
        {hover != null && (
          <div className="trend-tip" style={{ left: `${tipLeftPct}%`, transform: `translateX(${tipLeftPct > 70 ? "-100%" : tipLeftPct < 25 ? "0" : "-50%"})` }}>
            {rows.map(({ i, p, delta }) => (
              <div key={i} className="trend-tip-row">
                <i style={{ background: colors[i] }} />
                <strong>{COMPARE_LETTERS[i]}</strong>
                <span className="num">{p ? `${nf.format(Math.round(p.idc))}` : "—"}</span>
                <span className={`num trend-delta ${delta == null ? "" : delta <= 0 ? "is-down" : "is-up"}`}>
                  {delta == null ? "" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
