
import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const CACHE_TTL = 30 * 1000; 
const cache = new Map<string, { data: any; timestamp: number }>();

function hmsToMinutes(hms: string | null | undefined): number {
  if (!hms || typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.length === 3) {
    // H:MM:SS
    return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  } else if (parts.length === 2) {
    // MM:SS o HH:MM
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function formatTimeToHHmm(timeStr: string | null | undefined): string {
    if (!timeStr || typeof timeStr !== "string") return "00:00";
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
        const h = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        return `${h}:${m}`;
    }
    return "00:00";
}

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day);
}

export async function GET(req: Request) {
  try {
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

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) return NextResponse.json([]);

    const auth = new JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["PARO DE MAQUINA"];
    if (!sheet) return NextResponse.json([]);

    const rows = await sheet.getRows();

    const filtrado = rows.filter((r) => {
      const rowDate = parseSheetDate(String(r.get("FECHA")));
      return rowDate && rowDate.getTime() >= startDate.getTime() && rowDate.getTime() <= endDate.getTime();
    });

    const resultados = filtrado.map((r) => {
      const inicioRaw = r.get("INICIO") || "00:00:00";
      const duracionRaw = r.get("DURACIÓN") || "0:00:00";
      
      return {
        id: r.get("IDPARO") || Math.random().toString(36).substr(2, 9),
        date: r.get("FECHA"),
        machineId: r.get("MÁQUINA AFECTADA"),
        shift: r.get("TURNO"),
        startTime: formatTimeToHHmm(inicioRaw),
        durationMinutes: hmsToMinutes(duracionRaw),
        hac: r.get("HAC"),
        reason: r.get("TEXTO DE CAUSA"),
        sapCause: r.get("CAUSA SAP"),
        downtimeType: r.get("TIPO PARO")
      };
    });

    cache.set(cacheKey, { data: resultados, timestamp: Date.now() });
    return NextResponse.json(resultados);

  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
