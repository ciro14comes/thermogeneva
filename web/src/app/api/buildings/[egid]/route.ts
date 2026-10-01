import { getBuilding, getBuildingHistory } from "@/lib/data";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ egid: string }> }) {
  const { egid } = await params;
  const id = Number(egid);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid egid" }, { status: 400 });
  try {
    const [building, history] = await Promise.all([getBuilding(id), getBuildingHistory(id)]);
    if (!building) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ building, history }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
