// Alleggerisce il GeoJSON della mappa prima di inviarlo al browser:
// - coordinate arrotondate a 5 decimali (≈ 1 m: più che sufficiente per disegnare un edificio);
// - proprietà vuote (null) omesse: sulla mappa un campo mancante vale comunque "null".
// Risultato: meno dati da scaricare e da leggere nel browser, nessuna differenza visibile.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

function roundCoords(c: Json): Json {
  if (typeof c === "number") return round5(c);
  if (Array.isArray(c)) return c.map(roundCoords);
  return c;
}

function dropNulls(p: Json): Json {
  if (!p || typeof p !== "object" || Array.isArray(p)) return p;
  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(p)) if (v !== null) out[k] = v;
  return out;
}

type Feature = { type: string; id?: number; geometry: { type: string; coordinates: Json }; properties: Json };
type FC = { type: string; features: Feature[] };
export type MapPayload = { zones: FC; buildings: FC; generated_at?: string };

function slimFC(fc: FC, slimProps: boolean): FC {
  return {
    type: fc.type,
    features: fc.features.map((f) => ({
      type: f.type,
      id: f.id,
      geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
      properties: slimProps ? dropNulls(f.properties) : f.properties,
    })),
  };
}

export function slimMapPayload(d: MapPayload): MapPayload {
  return { zones: slimFC(d.zones, false), buildings: slimFC(d.buildings, true), generated_at: d.generated_at };
}

/** Un solo edificio (per la mini-mappa della pagina edificio). */
export function findBuilding(d: MapPayload, egid: number): Feature | null {
  const f = d.buildings.features.find((x) => Number(x.id) === egid);
  return f ? { type: "Feature", id: f.id, geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) }, properties: null } : null;
}
