import { getBuilding, getBuildingHistory, parseEgid } from "@/lib/data";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ egid: string }> }) {
  const { egid } = await params;
  const id = parseEgid(egid);
  if (id === null) return Response.json({ error: "invalid egid" }, { status: 400 });
  try {
    const [building, history] = await Promise.all([getBuilding(id), getBuildingHistory(id)]);
    if (!building) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ building, history }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("api/buildings", e);   // dettagli solo nei log del server, non al pubblico
    return Response.json({ error: "data temporarily unavailable" }, { status: 502 });
  }
}
