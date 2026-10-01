import { getCanton } from "@/lib/data";

// Confine del Canton de Genève (swisstopo), per maschera e limiti della mappa.
export const revalidate = 86400;

export async function GET() {
  try {
    const canton = await getCanton();
    if (!canton) return Response.json({ error: "not loaded" }, { status: 404 });
    return Response.json(canton, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
