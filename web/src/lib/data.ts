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
const DATA_VERSION = "5";

async function rest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local / Vercel)",
    );
  }
  // Il database gratuito può rallentare quando il build genera molte pagine in parallelo:
  // in caso di errore temporaneo (5xx, timeout, rete) riprova fino a 3 volte con attese crescenti.
  const RETRY_WAIT_MS = [500, 1500, 3500];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: { apikey: SUPABASE_KEY, Accept: "application/json", "x-thermogeneva-data": DATA_VERSION },
        next: { revalidate: REVALIDATE_SECONDS },
      });
    } catch (err) {
      if (attempt < RETRY_WAIT_MS.length) { await sleep(RETRY_WAIT_MS[attempt]); continue; }
      throw err;
    }
    if (res.ok) return (await res.json()) as T;
    const body = await res.text();
    if (res.status >= 500 && attempt < RETRY_WAIT_MS.length) { await sleep(RETRY_WAIT_MS[attempt]); continue; }
    throw new Error(`Supabase ${res.status} su ${path}: ${body}`);
  }
}

// Supabase restituisce al massimo 1000 righe per richiesta: per le liste lunghe leggiamo a pagine.
const PAGE = 1000;
async function restAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE) {
    const rows = await rest<T[]>(`${path}&limit=${PAGE}&offset=${offset}`);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/** EGID valido: solo cifre (max 10). Evita che input arbitrari finiscano nella query verso Supabase. */
export function parseEgid(raw: string): number | null {
  return /^\d{1,10}$/.test(raw) ? Number(raw) : null;
}

export async function getBuilding(egid: number): Promise<BuildingLatest | null> {
  const rows = await rest<BuildingLatest[]>(`buildings_latest?egid=eq.${egid}&limit=1`);
  return rows[0] ? num(rows[0]) : null;
}

export async function getBuildingHistory(egid: number): Promise<HistoryPoint[]> {
  const rows = await rest<HistoryPoint[]>(`building_history?egid=eq.${egid}&order=year.asc`);
  return rows.map(num);
}

/** Più edifici in una sola richiesta (per il confronto). */
export async function getBuildingsByIds(ids: number[]): Promise<BuildingLatest[]> {
  if (!ids.length) return [];
  const rows = await rest<BuildingLatest[]>(`buildings_latest?egid=in.(${ids.join(",")})`);
  return rows.map(num);
}

export async function getHistoriesByIds(ids: number[]): Promise<HistoryPoint[]> {
  if (!ids.length) return [];
  const rows = await rest<HistoryPoint[]>(`building_history?egid=in.(${ids.join(",")})&order=year.asc`);
  return rows.map(num);
}

/** Lista di EGID dall'indirizzo (?b=1,2,3): solo cifre, senza doppioni, al massimo `max`. */
export function parseEgidList(raw: string | undefined | null, max = 4): number[] {
  const out: number[] = [];
  for (const part of (raw ?? "").split(",")) {
    const id = parseEgid(part.trim());
    if (id !== null && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export async function getBuildingsInZone(zoneId: number): Promise<BuildingLatest[]> {
  const rows = await rest<BuildingLatest[]>(
    `buildings_latest?zone_id=eq.${zoneId}&order=idc.desc`,
  );
  return rows.map(num);
}

export async function getAllBuildings(): Promise<BuildingLatest[]> {
  return (await restAll<BuildingLatest>(`buildings_latest?order=egid.asc`)).map(num);
}

export async function getZones(): Promise<Zone[]> {
  const rows = await rest<Zone[]>(`zones?order=zone_id.asc`);
  return rows.map(num);
}

export async function getZone(slug: string): Promise<Zone | null> {
  const rows = await rest<Zone[]>(`zones?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] ? num(rows[0]) : null;
}

export async function getZoneById(zoneId: number): Promise<Zone | null> {
  const rows = await rest<Zone[]>(`zones?zone_id=eq.${zoneId}&limit=1`);
  return rows[0] ? num(rows[0]) : null;
}

export async function getZoneMetrics(zoneId?: number): Promise<ZoneMetric[]> {
  const filter = zoneId !== undefined ? `zone_id=eq.${zoneId}&` : "";
  const rows = await restAll<ZoneMetric>(`zone_metrics?${filter}order=year.asc,zone_id.asc`);
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
