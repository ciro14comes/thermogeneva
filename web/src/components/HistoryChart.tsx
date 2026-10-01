// Grafico SVG semplice (renderizzato sul server): IDC dell'edificio vs mediana del gruppo, con soglia 450.
type Point = { year: number; idc: number; peer_median: number | null };

export default function HistoryChart({
  points,
  labelIdc,
  labelPeer,
}: {
  points: Point[];
  labelIdc: string;
  labelPeer: string;
}) {
  if (points.length < 2) return null;
  const W = 640, H = 240, L = 44, R = 12, T = 14, B = 28;
  const years = points.map((p) => p.year);
  const vals = points.flatMap((p) => [p.idc, p.peer_median ?? p.idc]).concat([450]);
  const yMax = Math.ceil(Math.max(...vals) / 100) * 100;
  const yMin = 0;
  const x = (yr: number) => L + ((yr - years[0]) / Math.max(1, years[years.length - 1] - years[0])) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);

  const line = (get: (p: Point) => number | null) =>
    points
      .filter((p) => get(p) !== null)
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(get(p) as number).toFixed(1)}`)
      .join(" ");

  const ticks = [];
  for (let v = 0; v <= yMax; v += yMax > 600 ? 200 : 100) ticks.push(v);
  const yearTicks = years.filter((yr, i) => i === 0 || i === years.length - 1 || yr % 2 === 0);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${labelIdc} / ${labelPeer}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" />
            <text x={L - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#64748B" fontFamily="var(--font-mono)">{v}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(450)} y2={y(450)} stroke="#D97706" strokeDasharray="4 4" />
        <text x={W - R} y={y(450) - 5} fontSize="11" textAnchor="end" fill="#B45309">450</text>
        {yearTicks.map((yr) => (
          <text key={yr} x={x(yr)} y={H - 8} fontSize="11" textAnchor="middle" fill="#64748B" fontFamily="var(--font-mono)">{yr}</text>
        ))}
        <path d={line((p) => p.peer_median)} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" />
        <path d={line((p) => p.idc)} fill="none" stroke="#2563EB" strokeWidth="2.5" />
        {points.map((p) => (
          <circle key={p.year} cx={x(p.year)} cy={y(p.idc)} r="3" fill="#2563EB" />
        ))}
      </svg>
      <figcaption className="small muted" style={{ display: "flex", gap: 18, marginTop: 4 }}>
        <span>━ {labelIdc}</span>
        <span>╌ {labelPeer}</span>
      </figcaption>
    </figure>
  );
}
