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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fechaParam = searchParams.get("fecha");

    if (!fechaParam) {
      return NextResponse.json(
        { error: "Debe enviar ?fecha=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Formato del sheet: DD/MM/YYYY
    const [year, month, day] = fechaParam.split("-");
    const fechaSheets = `${day}/${month}/${year}`;

    // Variables de entorno
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) {
      // Fallback para desarrollo local si no hay credenciales, devolver array vacío o mock para no romper el front
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

    // Filtrar por fecha exacta
    const filtrado = rows.filter((r) => {
      const fechaCell = r.get("FECHA");
      return String(fechaCell).trim() === fechaSheets;
    });

    if (filtrado.length === 0) return NextResponse.json([]);

    // Convertir cada fila en un objeto con TODOS los campos
    const resultados = filtrado.map((r) => {
      // trae todas las columnas dinámicamente
      const valores = Object.fromEntries(
        sheet.headerValues.map((header) => [header, r.get(header)])
      );

      // agregamos duración en segundos
      const durHMS = valores["DURACIÓN"] ?? "0:00:00";

      return {
        ...valores,
        duracion: hmsToSeconds(durHMS),
        duracion_hms: durHMS,
      };
    });

    // Ordenar por mayor duración
    resultados.sort((a, b) => b.duracion - a.duracion);

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