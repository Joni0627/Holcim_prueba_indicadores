
import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const CACHE_TTL = 60 * 1000; 
const cache = new Map<string, { data: any; timestamp: number }>();

function hmsToSeconds(hms: string | null | undefined) {
  if (!hms || typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.length < 2) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // mm:ss
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); 
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "Debe enviar ?start=YYYY-MM-DD&end=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const cacheKey = `paros-${startParam}-${endParam}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data, {
           headers: {
               'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
               'X-Cache': 'HIT-MEMORY'
           }
       });
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) {
      return NextResponse.json([]); 
    }

    const auth = new JWT({
      email,
      key,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["PARO DE MAQUINA"];
    if (!sheet) return NextResponse.json([], { status: 404 });

    const rows = await sheet.getRows();

    const filtrado = rows.filter((r) => {
      const fechaCell = r.get("FECHA");
      const rowDate = parseSheetDate(String(fechaCell));
      if (!rowDate) return false;
      return rowDate.getTime() >= startDate.getTime() && rowDate.getTime() <= endDate.getTime();
    });

    const resultados = filtrado.map((r) => {
      const durHMS = r.get("DURACIÓN") ?? "0:00:00";
      const seconds = hmsToSeconds(durHMS);

      return {
        date: r.get("FECHA"),
        machineId: r.get("MÁQUINA AFECTADA"),
        shift: r.get("TURNO"),
        startTime: r.get("HORA") || "00:00", // Nueva columna capturada
        durationMinutes: Math.round(seconds / 60),
        hac: r.get("HAC"),
        hacDetail: r.get("DETALLE HAC"),
        reason: r.get("TEXTO DE CAUSA"),
        sapCause: r.get("CAUSA SAP"),
        downtimeType: r.get("TIPO PARO"),
        id: r.get("IDPARO") || Math.random().toString(36).substr(2, 9)
      };
    });

    cache.set(cacheKey, { data: resultados, timestamp: now });

    return NextResponse.json(resultados, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
            'X-Cache': 'MISS'
        }
    });

  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
