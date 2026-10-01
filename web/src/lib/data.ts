// Accesso ai dati: legge SOLO le viste pubbliche di Supabase (sola lettura) via API REST.
// Le risposte vengono messe in cache da Next.js e rinnovate ogni ora.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const REVALIDATE_SECONDS = 3600;

export type Family =
  | "industria"
  | "logistica"
  | "uffici"
  | "commercio_servizi"
  | "tecnico"
  | "residenziale"
  | "residenziale_misto"
  | "istruzione"
  | "sanitario"
  | "cultura_sport"
  | "culto"
  | "altro";

export type BuildingLatest = {
  egid: number;
  address: string | null;
  postal_code: string | null;
  commune: string | null;
  destination: string | null;
  family: Family;
  zone_id: number;
  year: number;
  idc: number;
  idc_avg_3y: number | null;
  sre: number | null;
  final_energy_mwh: number | null;
  energy_source: string | null;
  peer_n: number;
  peer_median: number | null;
  peer_p25: number | null;
  peer_p75: number | null;
  delta_vs_peer: number | null;
  delta_vs_peer_pct: number | null;
  peer_percentile: number | null;
  zone_n: number | null;
  zone_median: number | null;
  delta_vs_zone_pct: number | null;
  zone_percentile: number | null;
  idc_3y_ago: number | null;
  trend_3y_pct: number | null;
  above_450: boolean | null;
  above_significant_until_2026: boolean | null;
  above_significant_from_2027: boolean | null;
  is_stale: boolean;
};

export type HistoryPoint = {
  egid: number;
  year: number;
  idc: number;
  idc_avg_3y: number | null;
  peer_median: number | null;
  zone_median: number | null;
  energy_source: string | null;
};

export type Zone = {
  zone_id: number;
  zone_type: string;
  zone_name: string | null;
  slug: string;
  surface_m2: number | null;
  commune: string | null;
  buildings_total: number;
};

export type ZoneMetric = {
  zone_id: number;
  zone_type: string;
  year: number;
  buildings: number;
  median_idc: number | null;
  p25_idc: number | null;
  p75_idc: number | null;
  total_sre_m2: number | null;
  total_final_energy_mwh: number | null;
  buildings_above_450: number;
  buildings_above_650: number;
  share_above_peer_median_pct: number | null;
  zone_benchmark_valid: boolean;
};

// Cambiare DATA_VERSION invalida la cache di Next.js dopo modifiche alla struttura delle viste.
const DATA_VERSION = "3";

async function rest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local / Vercel)",
    );
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json", "x-thermogeneva-data": DATA_VERSION },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} su ${path}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// PostgREST restituisce i numeric come stringhe: li convertiamo in numeri (solo i campi numerici).
const TEXT_FIELDS = new Set(["postal_code", "slug", "address", "commune", "zone_name", "destination", "zone_type", "energy_source", "family"]);

function num<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && !TEXT_FIELDS.has(k) && /^-?\d+(\.\d+)?$/.test(v)) {
      out[k] = Number(v);
    }
  }
  return out as T;
}

export async function getBuilding(egid: number): Promise<BuildingLatest | null> {
  const rows = await rest<BuildingLatest[]>(`buildings_latest?egid=eq.${egid}&limit=1`);
  return rows[0] ? num(rows[0]) : null;
}

export async function getBuildingHistory(egid: number): Promise<HistoryPoint[]> {
  const rows = await rest<HistoryPoint[]>(`building_history?egid=eq.${egid}&order=year.asc`);
  return rows.map(num);
}

export async function getBuildingsInZone(zoneId: number): Promise<BuildingLatest[]> {
  const rows = await rest<BuildingLatest[]>(
    `buildings_latest?zone_id=eq.${zoneId}&order=idc.desc`,
  );
  return rows.map(num);
}

export async function getAllBuildings(): Promise<BuildingLatest[]> {
  const rows = await rest<BuildingLatest[]>(`buildings_latest?order=egid.asc&limit=5000`);
  return rows.map(num);
}

export async function getZones(): Promise<Zone[]> {
  const rows = await rest<Zone[]>(`zones?order=zone_id.asc`);
  return rows.map(num);
}

export async function getZone(slug: string): Promise<Zone | null> {
  const rows = await rest<Zone[]>(`zones?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] ? num(rows[0]) : null;
}

export async function getZoneMetrics(zoneId?: number): Promise<ZoneMetric[]> {
  const filter = zoneId !== undefined ? `zone_id=eq.${zoneId}&` : "";
  const rows = await rest<ZoneMetric[]>(`zone_metrics?${filter}order=year.asc&limit=5000`);
  return rows.map(num);
}

export async function getLastRefresh(): Promise<string | null> {
  try {
    const rows = await rest<{ last_refresh: string | null }[]>(`data_freshness`);
    return rows[0]?.last_refresh ?? null;
  } catch {
    return null;
  }
}

export async function getMapGeoJSON(): Promise<unknown> {
  return rest<unknown>(`rpc/map_geojson`);
}

/** Anno di riferimento: l'ultimo anno "completo", cioè con almeno il 90% degli edifici dell'anno precedente
 *  (le dichiarazioni dell'anno in corso e del precedente arrivano gradualmente). */
export function referenceYear(metrics: ZoneMetric[]): number | null {
  const byYear = new Map<number, number>();
  for (const m of metrics) byYear.set(m.year, (byYear.get(m.year) ?? 0) + m.buildings);
  const years = [...byYear.keys()].sort((a, b) => b - a);
  for (const y of years) {
    const prev = byYear.get(y - 1);
    if (prev !== undefined && (byYear.get(y) ?? 0) >= 0.9 * prev) return y;
  }
  return years[0] ?? null;
}

export function zoneLabel(z: Pick<Zone, "zone_id" | "zone_name" | "commune" | "zone_type">): string {
  if (z.zone_name) return z.zone_name;
  return `${z.commune ?? "Zone"} · ${z.zone_type} #${z.zone_id}`;
}

export type Canton = {
  canton_code: string;
  name: string;
  geometry: { type: "MultiPolygon" | "Polygon"; coordinates: number[][][][] | number[][][] };
  bbox: [number, number, number, number];
};

export async function getCanton(): Promise<Canton | null> {
  const rows = await rest<Canton[]>(`canton?select=canton_code,name,geometry,bbox&canton_code=eq.GE&limit=1`);
  return rows[0] ?? null;
}
