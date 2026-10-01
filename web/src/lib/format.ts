export function fmtNum(v: number | null | undefined, locale: string, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(locale === "fr" ? "fr-CH" : "en-CH", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v);
}

export function fmtPct(v: number | null | undefined, locale: string, signed = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = fmtNum(Math.abs(v), locale, 1);
  if (!signed) return `${s} %`;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s} %`;
}

export function fmtOrdinal(v: number | null | undefined, locale: string): string {
  if (v === null || v === undefined) return "—";
  if (locale === "fr") return v === 1 ? "1er" : `${v}e`;
  const s = ["th", "st", "nd", "rd"];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}

export function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CH" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Colore per percentile (0 = più efficiente, 100 = più energivoro): blu → giallo → rosso. */
export const PERCENTILE_STOPS: [number, string][] = [
  [0, "#2c7bb6"],
  [25, "#8cc4de"],
  [50, "#f4ecc0"],
  [75, "#f4a259"],
  [100, "#c8322b"],
];

export function percentileColor(p: number | null | undefined): string {
  return CLASS_COLOR[classOf(p)];
}

export function percentileGradientColor(p: number | null | undefined): string {
  if (p === null || p === undefined) return "#b9b6ae";
  for (let i = 1; i < PERCENTILE_STOPS.length; i++) {
    const [p1, c1] = PERCENTILE_STOPS[i];
    if (p <= p1) {
      const [p0, c0] = PERCENTILE_STOPS[i - 1];
      return mix(c0, c1, (p - p0) / (p1 - p0));
    }
  }
  return PERCENTILE_STOPS[PERCENTILE_STOPS.length - 1][1];
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "#" +
    pa
      .map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Classi di benchmark (stile "stato" della UI): ≤ P25 efficiente, P25–P75 nella norma, > P75 alto. */
export type BenchClass = "good" | "mid" | "high" | "none" | "old";

/* Palette v2 (ott. 2026). Palette v1 per tornare indietro:
   good #2fc79a · mid #5a8dee · high #ef4f5f · none #8a919c */
export const PALETTE = {
  primary: "#2563EB",
  text: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  background: "#F8FAFC",
  purple: "#7C3AED",
  warning: "#D97706",
  error: "#DC2626",
  idcScale: ["#E0F2FE", "#93C5FD", "#3B82F6", "#1E40AF"] as const,
  trend: { positive: "#14B8A6", negative: "#F26B6B", neutral: "#94A3B8" },
  series: ["#2563EB", "#14B8A6", "#7C3AED", "#D97706", "#F26B6B", "#94A3B8"] as const,
};

export const CLASS_COLOR: Record<BenchClass, string> = {
  good: "#14B8A6",   // Lower
  mid: "#5B8DEF",    // Typical
  high: "#F26B6B",   // Higher
  none: "#94A3B8",   // No benchmark
  old: "#CBD5E1",    // Dato non aggiornato (ultima dichiarazione > 6 anni)
};

/** IDC continuo (MJ/m²·anno) sulla scala blu: ≤200 chiaro → ≥800 scuro. */
export function idcColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return CLASS_COLOR.none;
  const stops: [number, string][] = [[200, PALETTE.idcScale[0]], [400, PALETTE.idcScale[1]], [600, PALETTE.idcScale[2]], [800, PALETTE.idcScale[3]]];
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}

/** Trend: calo dell'IDC = miglioramento (positivo), aumento = peggioramento. ±2% = stabile. */
export function trendColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return PALETTE.trend.neutral;
  if (pct <= -2) return PALETTE.trend.positive;
  if (pct >= 2) return PALETTE.trend.negative;
  return PALETTE.trend.neutral;
}

/** Classe che tiene conto anche dei dati non aggiornati. */
export function classOfBuilding(p: number | null | undefined, stale?: boolean | null): BenchClass {
  return stale ? "old" : classOf(p);
}

export function classOf(p: number | null | undefined): BenchClass {
  if (p === null || p === undefined || Number.isNaN(p)) return "none";
  if (p <= 25) return "good";
  if (p <= 75) return "mid";
  return "high";
}

/** Agente energetico: il dataset SITG è in francese; sulla versione inglese lo traduciamo. */
const ENERGY_EN: [RegExp, string][] = [
  [/^Électricité PAC \(DD après le 5 août 2010\)$/i, "Heat pump electricity (after 5 Aug 2010)"],
  [/^Électricité PAC \(DD avant le 5 août 2010\)$/i, "Heat pump electricity (before 5 Aug 2010)"],
  [/^PAC - Électricité consommée$/i, "Heat pump (electricity consumed)"],
  [/^PAC - Comptage de chaleur$/i, "Heat pump (heat metering)"],
  [/^Électricité directe$/i, "Direct electric heating"],
  [/^Chauffage à distance$/i, "District heating"],
  [/^CAD tarifé$/i, "District heating (metered tariff)"],
  [/^CAD réparti$/i, "District heating (allocated)"],
  [/^Gaz - Sous-comptage de chaleur$/i, "Gas (heat sub-metering)"],
  [/^Mazout - Sous-comptage de chaleur$/i, "Heating oil (heat sub-metering)"],
  [/^Bois - Sous-comptage de chaleur$/i, "Wood (heat sub-metering)"],
  [/^Bois plaquettes dur$/i, "Wood chips (hardwood)"],
  [/^Bois plaquettes PCI$/i, "Wood chips (calorific value)"],
  [/^Bois en pellets$/i, "Wood pellets"],
  [/^Bois en bûches dur$/i, "Firewood logs (hardwood)"],
  [/^Gaz$/i, "Gas"],
  [/^Mazout$/i, "Heating oil"],
  [/^Autre$/i, "Other"],
];
export function energyLabel(src: string | null | undefined, locale: string): string {
  if (!src) return "—";
  if (locale !== "en") return src;
  for (const [re, en] of ENERGY_EN) if (re.test(src.trim())) return en;
  return src;
}
