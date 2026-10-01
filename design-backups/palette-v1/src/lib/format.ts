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
  if (p === null || p === undefined) return "#8a919c";
  if (p <= 25) return "#2fc79a";
  if (p <= 75) return "#5a8dee";
  return "#ef4f5f";
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
export type BenchClass = "good" | "mid" | "high" | "none";

export const CLASS_COLOR: Record<BenchClass, string> = {
  good: "#2fc79a",
  mid: "#5a8dee",
  high: "#ef4f5f",
  none: "#8a919c",
};

export function classOf(p: number | null | undefined): BenchClass {
  if (p === null || p === undefined || Number.isNaN(p)) return "none";
  if (p <= 25) return "good";
  if (p <= 75) return "mid";
  return "high";
}
