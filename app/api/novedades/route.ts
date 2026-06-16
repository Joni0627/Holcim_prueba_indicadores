import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const CACHE_TTL = 30 * 1000; 
const cache = new Map<string, { data: any; timestamp: number }>();

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); 
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing dates" }, { status: 400 });
    }

    const cacheKey = `novedades-v2-${startParam}-${endParam}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data);
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    // Fetch from Supabase tables
    const [rowsCabecera, rowsLista] = await Promise.all([
        fetchAllRows("produccionv2"),
        fetchAllRows("detalles_produccionv2")
    ]);

    // Build cabecera map
    const cabeceraMap = new Map<string, any>();
    rowsCabecera.forEach(cab => {
        const id = getSupabaseVal(cab, "id");
        if (id) cabeceraMap.set(String(id), cab);
    });

    // Reconstruct novelty shift notes from non-empty observations
    const validNotes: any[] = [];
    rowsLista.forEach(row => {
        const obs = getSupabaseVal(row, "observacion");
        if (!obs || String(obs).trim() === "") return;

        const prodId = getSupabaseVal(row, "produccion_id");
        const cab = cabeceraMap.get(String(prodId));
        if (!cab) return;

        const dateStr = getSupabaseVal(cab, "fecha");
        const d = parseSheetDate(dateStr);
        if (d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime()) {
            validNotes.push({
                id: getSupabaseVal(row, "id") || Math.random().toString(36).substr(2, 9),
                date: dateStr,
                shift: getSupabaseVal(cab, "descripcion_turno") || getSupabaseVal(cab, "turno") || "Sin Turno",
                detail: String(obs).trim()
            });
        }
    });

    cache.set(cacheKey, { data: validNotes, timestamp: Date.now() });
    return NextResponse.json(validNotes);

  } catch (err: any) {
    console.error("API Error novedades-v2:", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
