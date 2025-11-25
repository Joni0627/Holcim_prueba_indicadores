import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/**
 * Convierte "0:15:00" → 900
 */
function hmsToSeconds(hms: string | null | undefined) {
  if (!hms || typeof hms !== "string") return 0;

  const parts = hms.split(":").map(Number);
  if (parts.length !== 3) return 0;

  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

/**
 * Parsea una fecha en formato "DD/MM/YYYY" a un objeto Date (ignorando hora)
 */
function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  // Crear fecha en UTC o local consistente
  return new Date(year, month - 1, day);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); // YYYY-MM-DD
    const endParam = searchParams.get("end");     // YYYY-MM-DD

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "Debe enviar ?start=YYYY-MM-DD&end=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Convertir params a Dates (inicio del día start, final del día end)
    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    // Variables de entorno
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) {
      console.warn("Faltan variables de entorno para Google Sheets.");
      return NextResponse.json([]); 
    }

    // Auth
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

    // Hoja PARO DE MAQUINA
    const sheet = doc.sheetsByTitle["PARO DE MAQUINA"];
    if (!sheet) {
      return NextResponse.json(
        { error: "No existe hoja PARO DE MAQUINA" },
        { status: 404 }
      );
    }

    const rows = await sheet.getRows();

    // Filtrar por RANGO de fechas
    const filtrado = rows.filter((r) => {
      const fechaCell = r.get("FECHA");
      const rowDate = parseSheetDate(String(fechaCell));
      if (!rowDate) return false;

      // Comparación simple de timestamps
      return rowDate.getTime() >= startDate.getTime() && rowDate.getTime() <= endDate.getTime();
    });

    if (filtrado.length === 0) return NextResponse.json([]);

    // Mapeo de columnas específicas solicitadas
    const resultados = filtrado.map((r) => {
      const durHMS = r.get("DURACIÓN") ?? "0:00:00";
      const seconds = hmsToSeconds(durHMS);

      return {
        date: r.get("FECHA"),
        machineId: r.get("MÁQUINA AFECTADA"),
        shift: r.get("TURNO"),
        durationMinutes: Math.round(seconds / 60),
        hac: r.get("HAC"),
        hacDetail: r.get("DETALLE HAC"),
        reason: r.get("TEXTO DE CAUSA"),
        sapCause: r.get("CAUSA SAP"),
        // Metadata extra
        rawDuration: durHMS,
        id: r.get("IDPARO") || Math.random().toString(36).substr(2, 9)
      };
    });

    // Ordenar por mayor duración
    resultados.sort((a, b) => b.durationMinutes - a.durationMinutes);

    return NextResponse.json(resultados);
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      {
        error: "Error interno",
        message: err.message,
      },
      { status: 500 }
    );
  }
}