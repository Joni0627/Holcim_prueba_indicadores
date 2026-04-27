
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function getVal(row: any, key: string) {
    return row.get(key) || row.get(key.toUpperCase()) || row.get(key.toLowerCase()) || 
           row.get(key.replace(/ /g, "_").toUpperCase()) || 
           row.get(key.replace(/ /g, "_").toLowerCase());
}

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    if (str.includes(',')) str = str.replace(',', '.');
    return parseFloat(str) || 0;
}

function hmsToMinutes(hms: string | null | undefined): number {
  if (!hms || typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseSheetDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') return new Date((dateStr - 25569) * 86400 * 1000);
  if (typeof dateStr !== "string") return null;
  
  const cleaned = dateStr.trim();
  let parts: string[] = [];
  if (cleaned.includes("/")) parts = cleaned.split("/");
  else if (cleaned.includes("-")) parts = cleaned.split("-");
  
  if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) [year, month, day] = parts.map(Number);
      else [day, month, year] = parts.map(Number);
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); 
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    const cacheKey = `rankings-${startParam}-${endParam}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data);
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");
    const productionFilterDate = new Date("2025-12-01T00:00:00");

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!email || !key || !sheetId) return NextResponse.json({ error: "Config missing" }, { status: 500 });

    const authClient = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const doc = new GoogleSpreadsheet(sheetId, authClient);
    await doc.loadInfo();

    const sheetCabecera = doc.sheetsByTitle["PRODUCCION_CABECERA"];
    const sheetParos = doc.sheetsByTitle["PARO DE MAQUINA"];
    const sheetUsuarios = doc.sheetsByTitle["USUARIOS"];

    if (!sheetCabecera || !sheetParos || !sheetUsuarios) {
        return NextResponse.json({ error: "Required sheets not found" }, { status: 404 });
    }

    const [rowsCabecera, rowsParos, rowsUsuarios] = await Promise.all([
        sheetCabecera.getRows(),
        sheetParos.getRows(),
        sheetUsuarios.getRows()
    ]);

    // Create User Mappings
    const usersById: Record<string, string> = {};
    const usersByRed: Record<string, string> = {};
    rowsUsuarios.forEach(u => {
        const id = String(getVal(u, "IDUSUARIO") || "").trim();
        const red = String(getVal(u, "USUARIORED") || "").trim();
        const desc = String(getVal(u, "DESCRIPCIÓN USUARIO") || "").trim();
        if (id) usersById[id] = desc;
        if (red) usersByRed[red] = desc;
    });

    // --- PRODUCTION RANKINGS ---
    const prodByOperator: Record<string, number> = {};
    const prodByPalletizer: Record<string, number> = {};

    rowsCabecera.forEach(row => {
        const d = parseSheetDate(getVal(row, "FECHA"));
        if (!d || d < productionFilterDate) return;
        if (d < startDate || d > endDate) return;

        const tn = parseNumber(getVal(row, "tn_totales_turno"));
        const maquinistaId = String(getVal(row, "maquinista") || "").trim();
        const palletizer = String(getVal(row, "descripcion_paletizadora") || "Desconocida").trim();

        const operatorName = usersById[maquinistaId] || `ID: ${maquinistaId}`;
        prodByOperator[operatorName] = (prodByOperator[operatorName] || 0) + tn;
        prodByPalletizer[palletizer] = (prodByPalletizer[palletizer] || 0) + tn;
    });

    // --- DOWNTIME RANKINGS ---
    const parosByOperator: Record<string, { duration: number; count: number }> = {};
    const parosByMachine: Record<string, { duration: number; count: number }> = {};
    const parosByCause: Record<string, { duration: number; count: number }> = {};
    const parosByEquipment: Record<string, { duration: number; count: number }> = {};
    
    // Combinations
    const combOpMach: Record<string, { duration: number; count: number }> = {};
    const combMachCause: Record<string, { duration: number; count: number }> = {};
    const combEquipCause: Record<string, { duration: number; count: number }> = {};
    const combOpEquip: Record<string, { duration: number; count: number }> = {};

    rowsParos.forEach(row => {
        const d = parseSheetDate(getVal(row, "FECHA"));
        if (!d || d < startDate || d > endDate) return;

        const duration = hmsToMinutes(getVal(row, "DURACIÓN"));
        const machine = String(getVal(row, "MÁQUINA AFECTADA") || "Desconocida").trim();
        const userRed = String(getVal(row, "USUARIO") || "").trim();
        const cause = String(getVal(row, "TEXTO DE CAUSA") || "Sin Causa").trim();
        const equipment = String(getVal(row, "DETALLE HAC") || "Sin Detalle").trim();

        const operatorName = usersByRed[userRed] || userRed || "Desconocido";

        // Simple aggregations
        const update = (map: any, key: string) => {
            if (!map[key]) map[key] = { duration: 0, count: 0 };
            map[key].duration += duration;
            map[key].count += 1;
        };

        update(parosByOperator, operatorName);
        update(parosByMachine, machine);
        update(parosByCause, cause);
        update(parosByEquipment, equipment);

        // Combination aggregations
        update(combOpMach, `${operatorName} @ ${machine}`);
        update(combMachCause, `${machine} -> ${cause}`);
        update(combEquipCause, `${equipment} -> ${cause}`);
        update(combOpEquip, `${operatorName} & ${equipment}`);
    });

    const formatRank = (map: any) => Object.entries(map).map(([name, val]: [string, any]) => ({ name, ...val }));
    const formatProdRank = (map: any) => Object.entries(map).map(([name, value]: [string, any]) => ({ name, value }));

    const result = {
        productionRankings: {
            byOperator: formatProdRank(prodByOperator).sort((a,b) => b.value - a.value),
            byPalletizer: formatProdRank(prodByPalletizer).sort((a,b) => b.value - a.value),
        },
        downtimeRankings: {
            byOperator: formatRank(parosByOperator).sort((a,b) => b.duration - a.duration),
            byMachine: formatRank(parosByMachine).sort((a,b) => b.duration - a.duration),
            byCause: formatRank(parosByCause).sort((a,b) => b.duration - a.duration),
            byEquipment: formatRank(parosByEquipment).sort((a,b) => b.duration - a.duration),
            combinations: {
                operatorMachine: formatRank(combOpMach).sort((a,b) => b.duration - a.duration),
                machineCause: formatRank(combMachCause).sort((a,b) => b.duration - a.duration),
                equipmentCause: formatRank(combEquipCause).sort((a,b) => b.duration - a.duration),
                operatorEquipment: formatRank(combOpEquip).sort((a,b) => b.duration - a.duration),
            }
        }
    };

    cache.set(cacheKey, { data: result, timestamp: now });
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Rankings API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
