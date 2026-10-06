// Calcoli per le pagine "Insights". Tutto viene ricalcolato dai dati pubblici a ogni aggiornamento
// (nessun numero scritto a mano nel testo).
import type { BuildingLatest } from "./data";
import { energyGroup, type EnergyGroup } from "./format";

/** Fasce della media IDC su 3 anni (MJ/m²·anno), legate alle soglie del regolamento ginevrino. */
export const THRESHOLD_BANDS = [
  { key: "le450", min: -Infinity, max: 450, color: "#E2E8F0" },
  { key: "b450", min: 450, max: 550, color: "#FBD9C4" },
  { key: "b550", min: 550, max: 650, color: "#F5A782" },
  { key: "b650", min: 650, max: 800, color: "#E6704E" },
  { key: "gt800", min: 800, max: Infinity, color: "#A8322A" },
] as const;
export type BandKey = (typeof THRESHOLD_BANDS)[number]["key"];

/** Soglia "significativa" (risanamento obbligatorio) per periodo. */
export const WAVES = [
  { key: "until2026", threshold: 800, bands: ["gt800"] as BandKey[] },
  { key: "from2027", threshold: 650, bands: ["gt800", "b650"] as BandKey[] },
  { key: "from2031", threshold: 550, bands: ["gt800", "b650", "b550"] as BandKey[] },
] as const;

type Agg = { n: number; mwh: number; sre: number };
const empty = (): Agg => ({ n: 0, mwh: 0, sre: 0 });

export function thresholdInsight(all: BuildingLatest[]) {
  // solo edifici con dati aggiornati e con una media su 3 anni pubblicata
  const fresh = all.filter((b) => !b.is_stale);
  const rows = fresh.filter((b) => b.idc_avg_3y != null);
  const stale = all.length - fresh.length;
  const noAvg = fresh.length - rows.length;

  const bandOf = (v: number) => THRESHOLD_BANDS.find((t) => v > t.min && v <= t.max)!.key;
  const bands = Object.fromEntries(THRESHOLD_BANDS.map((t) => [t.key, empty()])) as Record<BandKey, Agg>;
  for (const b of rows) {
    const a = bands[bandOf(b.idc_avg_3y!)];
    a.n++; a.mwh += b.final_energy_mwh ?? 0; a.sre += b.sre ?? 0;
  }
  const total: Agg = rows.reduce((s, b) => ({ n: s.n + 1, mwh: s.mwh + (b.final_energy_mwh ?? 0), sre: s.sre + (b.sre ?? 0) }), empty());

  const waves = WAVES.map((w) => ({
    ...w,
    n: w.bands.reduce((s, k) => s + bands[k].n, 0),
    mwh: w.bands.reduce((s, k) => s + bands[k].mwh, 0),
    sre: w.bands.reduce((s, k) => s + bands[k].sre, 0),
  }));
  const above450 = rows.length - bands.le450.n;

  // quota sopra 550 (soglia 2031) per fonte di energia e per tipo di edificio (gruppi con almeno 15 edifici)
  const share = <K extends string>(keyOf: (b: BuildingLatest) => K) => {
    const m = new Map<K, { n: number; gt550: number; gt650: number }>();
    for (const b of rows) {
      const k = keyOf(b);
      const r = m.get(k) ?? { n: 0, gt550: 0, gt650: 0 };
      r.n++;
      if (b.idc_avg_3y! > 550) r.gt550++;
      if (b.idc_avg_3y! > 650) r.gt650++;
      m.set(k, r);
    }
    return [...m.entries()]
      .filter(([, r]) => r.n >= 15)
      .map(([k, r]) => ({ key: k, ...r, pct550: (100 * r.gt550) / r.n, pct650: (100 * r.gt650) / r.n }))
      .sort((a, b) => b.pct550 - a.pct550);
  };
  const byEnergy = share<EnergyGroup>((b) => energyGroup(b.energy_source) ?? "other");
  const byFamily = share<string>((b) => b.family);

  return { n: rows.length, stale, noAvg, bands, total, waves, above450, byEnergy, byFamily };
}
