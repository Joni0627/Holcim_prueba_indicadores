
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const CACHE_TTL = 30 * 1000; 
const cache = new Map<string, { data: any; timestamp: number }>();

function getVal(row: any, key: string) {
    return row.get(key) || row.get(key.toUpperCase()) || row.get(key.toLowerCase());
}

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
  const cleaned = dateStr.trim();
  let parts: string[] = [];
  if (cleaned.includes("/")) parts = cleaned.split("/");
  else if (cleaned.includes("-")) parts = cleaned.split("-");
  
  if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) {
          // YYYY-MM-DD
          [year, month, day] = parts.map(Number);
      } else {
          // DD/MM/YYYY
          [day, month, year] = parts.map(Number);
      }
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    // Seguridad: Verificar autenticación
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

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) return NextResponse.json([]);

    const authClient = new JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(sheetId, authClient);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["PARO DE MAQUINA"];
    const sheetUsuarios = doc.sheetsByTitle["USUARIOS"];

    if (!sheet) return NextResponse.json([]);

    const [rows, rowsUsuarios] = await Promise.all([
      sheet.getRows(),
      sheetUsuarios ? sheetUsuarios.getRows() : Promise.resolve([])
    ]);

    const usersByRed: Record<string, string> = {};
    rowsUsuarios.forEach(u => {
        const red = String(u.get("USUARIORED") || "").trim();
        const desc = String(u.get("DESCRIPCIÓN USUARIO") || "").trim();
        if (red) usersByRed[red] = desc;
    });

    const filtrado = rows.filter((r) => {
      const rowDate = parseSheetDate(String(getVal(r, "FECHA")));
      return rowDate && rowDate.getTime() >= startDate.getTime() && rowDate.getTime() <= endDate.getTime();
    });

    const resultados = filtrado.map((r) => {
      const inicioRaw = getVal(r, "INICIO") || "00:00:00";
      const duracionRaw = getVal(r, "DURACIÓN") || "0:00:00";
      const userRed = String(getVal(r, "USUARIO") || "").trim();
      
      return {
        id: getVal(r, "IDPARO") || Math.random().toString(36).substr(2, 9),
        date: getVal(r, "FECHA"),
        machineId: getVal(r, "MÁQUINA AFECTADA"),
        shift: getVal(r, "TURNO"),
        startTime: formatTimeToHHmm(inicioRaw),
        durationMinutes: hmsToMinutes(duracionRaw),
        hac: getVal(r, "HAC"),
        hacDetail: getVal(r, "DETALLE HAC"),
        reason: getVal(r, "TEXTO DE CAUSA"),
        sapCause: getVal(r, "CAUSA SAP"),
        downtimeType: getVal(r, "TIPO PARO"),
        operatorName: usersByRed[userRed] || userRed || "Desconocido"
      };
    });

    cache.set(cacheKey, { data: resultados, timestamp: Date.now() });
    return NextResponse.json(resultados);

  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
