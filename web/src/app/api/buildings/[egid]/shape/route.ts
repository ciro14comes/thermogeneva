import { getMapGeoJSON, parseEgid } from "@/lib/data";
import { findBuilding, type MapPayload } from "@/lib/mapPayload";

// Contorno di un solo edificio (per la mini-mappa della pagina edificio).
// Usa gli stessi dati già in cache della mappa: nessuna richiesta in più al database.
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ egid: string }> }) {
  const { egid } = await params;
  const id = parseEgid(egid);
  if (id === null) return Response.json({ error: "invalid egid" }, { status: 400 });
  try {
    const f = findBuilding((await getMapGeoJSON()) as MapPayload, id);
    if (!f) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(f, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (e) {
    console.error("api/buildings/shape", e);   // dettagli solo nei log del server, non al pubblico
    return Response.json({ error: "data temporarily unavailable" }, { status: 502 });
  }
}
