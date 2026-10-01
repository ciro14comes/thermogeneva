import { getMapGeoJSON } from "@/lib/data";

// GeoJSON per la mappa: zone FTI + edifici, generato da Supabase e messo in cache per 1 ora.
export const revalidate = 3600;

export async function GET() {
  try {
    const data = await getMapGeoJSON();
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("api/map", e);   // dettagli solo nei log del server, non al pubblico
    return Response.json({ error: "data temporarily unavailable" }, { status: 502 });
  }
}
