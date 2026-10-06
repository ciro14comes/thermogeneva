"use client";
// Storico IDC a confronto: un unico grafico in stile "trend".
// Per evitare colori che si confondono (più edifici della stessa classe = stesso colore) si usa
// l'evidenziazione: di base tutte le linee sono grigie con la lettera alla fine; l'edificio evidenziato
// (passando sulla legenda, oppure con il mouse vicino alla sua linea) prende il colore che ha sulla mappa.
import { useId, useRef, useState } from "react";
import { CLASS_COLOR, COMPARE_LETTERS, type BenchClass } from "@/lib/format";

export type HistorySeries = {
  label: string;
  cls: BenchClass;
  points: { year: number; idc: number; peer: number | null }[];
};

type Labels = { idc: string; peer: string; threshold: string; change: string; noData: string };

const GREY = "#A3AEBD";

export default function CompareChart({ series, labels, locale }: { series: HistorySeries[]; labels: Labels; locale: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);     // anno sotto il mouse
  const [near, setNear] = useState<number | null>(null);       // linea più vicina al mouse
  const [pinned, setPinned] = useState<number | null>(null);   // edificio scelto dalla legenda
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-CH" : "de-CH");

  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return null;
  const color = (i: number) => CLASS_COLOR[series[i].cls];
  const W = 760, H = 300, L = 44, R = 34, T = 64, B = 40;
  const y0 = Math.min(...all.map((p) => p.year));
  const y1 = Math.max(...all.map((p) => p.year));
  const vals = all.map((p) => p.idc).concat([450]);
  const vMin = Math.max(0, Math.floor((Math.min(...vals) * 0.85) / 100) * 100);
  const vMax = Math.ceil((Math.max(...vals) * 1.05) / 100) * 100;
  const x = (yr: number) => L + ((yr - y0) / Math.max(1, y1 - y0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - vMin) / (vMax - vMin)) * (H - T - B);
  const sorted = series.map((s) => [...s.points].sort((a, b) => a.year - b.year));
  // linea continua solo tra anni consecutivi; dove mancano dichiarazioni il tratto è tratteggiato
  const path = (pts: { year: number; idc: number }[]) =>
    pts.map((p, j) => `${j === 0 || p.year - pts[j - 1].year > 1 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.idc).toFixed(1)}`).join("");
  const gapPath = (pts: { year: number; idc: number }[]) =>
    pts.slice(1).map((p, j) => (p.year - pts[j].year > 1
      ? `M${x(pts[j].year).toFixed(1)},${y(pts[j].idc).toFixed(1)}L${x(p.year).toFixed(1)},${y(p.idc).toFixed(1)}` : "")).join("");
  const focus = pinned ?? near;

  const yearTicks: number[] = [];
  for (let yr = y0; yr <= y1; yr++) if ((yr - y0) % 3 === 0 || yr === y1) yearTicks.push(yr);
  const gridVals: number[] = [];
  const step = vMax - vMin > 600 ? 200 : 100;
  for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) gridVals.push(v);

  const onMove = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const yr = Math.min(y1, Math.max(y0, Math.round(y0 + ((((clientX - box.left) / box.width) * W - L) / (W - L - R)) * (y1 - y0))));
    setHover(yr);
    // linea più vicina al mouse in quell'anno
    const my = ((clientY - box.top) / box.height) * H;
    let best: number | null = null, dist = Infinity;
    sorted.forEach((pts, i) => {
      const p = pts.find((q) => q.year === yr);
      if (p && Math.abs(y(p.idc) - my) < dist) { dist = Math.abs(y(p.idc) - my); best = i; }
    });
    setNear(dist < 40 ? best : null);
  };
  const leave = () => { setHover(null); setNear(null); };

  const hx = hover != null ? x(hover) : null;
  const rows = hover == null ? [] : sorted.map((pts, i) => {
    const p = pts.find((q) => q.year === hover);
    const prev = pts.find((q) => q.year === hover - 1);
    return { i, p, delta: p && prev ? ((p.idc - prev.idc) / prev.idc) * 100 : null };
  });
  const tipLeftPct = hx == null ? 0 : (hx / W) * 100;
  // ordine di disegno: la linea evidenziata sopra le altre
  const order = series.map((_, i) => i).sort((a, b) => (a === focus ? 1 : 0) - (b === focus ? 1 : 0));

  return (
    <div className="trend-card">
      <div className="trend-legend">
        {series.map((s, i) => (
          <button key={i} type="button" title={s.label}
            className={`trend-key${focus === i ? " is-on" : ""}${focus != null && focus !== i ? " is-dim" : ""}`}
            onMouseEnter={() => setNear(i)} onMouseLeave={() => setNear(null)}
            onClick={() => setPinned((p) => (p === i ? null : i))} aria-pressed={pinned === i}>
            <i style={{ borderColor: color(i) }} />
            <strong>{COMPARE_LETTERS[i]}</strong> <span className="trend-key-name">{s.label}</span>
          </button>
        ))}
        <span className="trend-key trend-key-thr"><i className="thr" /> {labels.threshold}</span>
      </div>

      <div className="trend-plot">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={labels.idc}
          style={{ display: "block", touchAction: "pan-y" }}
          onMouseMove={(e) => onMove(e.clientX, e.clientY)} onMouseLeave={leave}
          onTouchStart={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}>
          <defs>
            <clipPath id={`past${uid}`}><rect x="0" y="0" width={hx ?? W} height={H} /></clipPath>
            <clipPath id={`future${uid}`}><rect x={hx ?? W} y="0" width={W} height={H} /></clipPath>
          </defs>

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
          {450 >= vMin && 450 <= vMax && <>
            <line x1={L} x2={W - R} y1={y(450)} y2={y(450)} stroke="#D97706" strokeDasharray="2 5" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
            <text x={L + 4} y={y(450) - 6} fontSize="10.5" fill="#B45309">450</text>
          </>}

          {order.map((i) => {
            const pts = sorted[i];
            if (!pts.length) return null;
            const on = focus === i;
            const stroke = on ? color(i) : GREY;
            const width = on ? 3 : 2;
            const op = focus == null || on ? 1 : 0.45;
            const last = pts[pts.length - 1];
            return (
              <g key={i} opacity={op}>
                {gapPath(pts) && <path d={gapPath(pts)} fill="none" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 5" opacity="0.55" />}
                <path d={path(pts)} fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"
                  clipPath={hover != null ? `url(#past${uid})` : undefined} />
                {hover != null && <path d={path(pts)} fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round"
                  strokeLinecap="round" opacity="0.3" clipPath={`url(#future${uid})`} />}
                {pts.filter((p, j) => (j === 0 || p.year - pts[j - 1].year > 1) && (j === pts.length - 1 || pts[j + 1].year - p.year > 1))
                  .map((p) => <circle key={p.year} cx={x(p.year)} cy={y(p.idc)} r="2.6" fill={stroke} />)}
                {/* lettera alla fine della linea */}
                <circle cx={x(last.year)} cy={y(last.idc)} r={on ? 4.5 : 3.5} fill={on ? color(i) : "#fff"} stroke={stroke} strokeWidth="2" />
                <text x={x(last.year) + 9} y={y(last.idc) + 4} fontSize="12" fontWeight="700" fill={on ? "#0F172A" : "#64748B"} fontFamily="var(--font-mono)">
                  {COMPARE_LETTERS[i]}
                </text>
              </g>
            );
          })}

          {hx != null && <>
            <line x1={hx} x2={hx} y1={T - 18} y2={H - B + 4} stroke="#64748B" strokeDasharray="3 4" />
            {rows.map(({ i, p }) => p && (
              <circle key={i} cx={hx} cy={y(p.idc)} r={focus === i ? 6 : 4.5} fill="#fff"
                stroke={focus === i ? color(i) : GREY} strokeWidth="2.6" opacity={focus == null || focus === i ? 1 : 0.6} />
            ))}
            <g transform={`translate(${hx},${H - 19})`}>
              <rect x="-22" y="-12" width="44" height="22" rx="11" fill="#0F172A" />
              <text x="0" y="4" fontSize="11.5" fontWeight="600" textAnchor="middle" fill="#fff" fontFamily="var(--font-mono)">{hover}</text>
            </g>
          </>}
          <rect x={L} y={T - 20} width={W - L - R} height={H - T - B + 20} fill="transparent" />
        </svg>

        {hover != null && (
          <div className="trend-tip" style={{ left: `${tipLeftPct}%`, transform: `translateX(${tipLeftPct > 70 ? "-100%" : tipLeftPct < 25 ? "0" : "-50%"})` }}>
            {rows.map(({ i, p, delta }) => (
              <div key={i} className={`trend-tip-row${focus === i ? " is-on" : ""}`}>
                <i style={{ background: color(i) }} />
                <strong>{COMPARE_LETTERS[i]}</strong>
                <span className={p ? "num" : "trend-nodata"}>{p ? nf.format(Math.round(p.idc)) : labels.noData}</span>
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
