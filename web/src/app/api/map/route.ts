import { getMapGeoJSON } from "@/lib/data";
import { slimMapPayload, type MapPayload } from "@/lib/mapPayload";

// GeoJSON per la mappa: zone FTI + edifici, generato da Supabase e messo in cache per 1 ora.
// Prima dell'invio viene alleggerito (coordinate a 5 decimali, campi vuoti omessi).
export const revalidate = 3600;

export async function GET() {
  try {
    const data = slimMapPayload((await getMapGeoJSON()) as MapPayload);
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("api/map", e);   // dettagli solo nei log del server, non al pubblico
    return Response.json({ error: "data temporarily unavailable" }, { status: 502 });
  }
}
