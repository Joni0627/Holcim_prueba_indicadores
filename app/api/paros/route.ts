import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const CACHE_TTL = 30 * 1000; 
const cache = new Map<string, { data: any; timestamp: number }>();

function hmsToMinutes(hms: string | null | undefined): number {
  if (!hms) return 0;
  if (typeof hms === "number") return hms;
  if (typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.length === 3) {
    // H:MM:SS
    return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  } else if (parts.length === 2) {
    // MM:SS o HH:MM
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(hms) || 0;
}

function formatTimeToHHmm(timeStr: any): string {
    if (!timeStr) return "00:00";
    if (typeof timeStr !== "string") return "00:00";
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
        const h = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        return `${h}:${m}`;
    }
    return "00:00";
}

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

    const cacheKey = `paros-v2-${startParam}-${endParam}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data);
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    // Fetch from Supabase parosv2 instead of Google Sheets
    const rows = await fetchAllRows("parosv2");

    if (!rows || rows.length === 0) {
        return NextResponse.json([]);
    }

    const filtrado = rows.filter((r) => {
      const rowDate = parseSheetDate(getSupabaseVal(r, "FECHA"));
      return rowDate && rowDate.getTime() >= startDate.getTime() && rowDate.getTime() <= endDate.getTime();
    });

    const resultados = filtrado.map((r) => {
      const inicioRaw = getSupabaseVal(r, "INICIO") || "00:00:00";
      const duracionRaw = getSupabaseVal(r, "DURACIÓN") || getSupabaseVal(r, "duration_minutes") || "0:00:00";
      const userRed = String(getSupabaseVal(r, "USUARIO") || "").trim();
      
      return {
        id: getSupabaseVal(r, "IDPARO") || r.id || Math.random().toString(36).substr(2, 9),
        date: getSupabaseVal(r, "FECHA"),
        machineId: getSupabaseVal(r, "MÁQUINA AFECTADA") || getSupabaseVal(r, "machine_id"),
        shift: getSupabaseVal(r, "TURNO"),
        startTime: formatTimeToHHmm(inicioRaw),
        durationMinutes: hmsToMinutes(duracionRaw),
        hac: getSupabaseVal(r, "HAC"),
        hacDetail: getSupabaseVal(r, "DETALLE HAC") || getSupabaseVal(r, "hac_detail"),
        reason: getSupabaseVal(r, "TEXTO DE CAUSA") || getSupabaseVal(r, "reason"),
        sapCause: getSupabaseVal(r, "CAUSA SAP") || getSupabaseVal(r, "sap_cause"),
        downtimeType: getSupabaseVal(r, "TIPO PARO") || getSupabaseVal(r, "downtime_type"),
        operatorName: getSupabaseVal(r, "operatorName") || getSupabaseVal(r, "operator_name") || userRed || "Desconocido"
      };
    });

    cache.set(cacheKey, { data: resultados, timestamp: Date.now() });
    return NextResponse.json(resultados);

  } catch (err: any) {
    console.error("API Error parosv2:", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
