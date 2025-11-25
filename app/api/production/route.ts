
import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  // Intenta parsear DD/MM/YYYY
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
  }
  return null;
}

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Maneja strings como "0,85", "85%", "1.200"
    let str = String(val).trim();
    if (str.includes('%')) {
        str = str.replace('%', '');
        return parseFloat(str.replace(',', '.')) / 100;
    }
    // Reemplazar coma decimal por punto si no es separador de miles (simple heuristic)
    return parseFloat(str.replace(',', '.'));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); 
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) return NextResponse.json({});

    const auth = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheetCabecera = doc.sheetsByTitle["PRODUCCION_CABECERA"];
    const sheetLista = doc.sheetsByTitle["PRODUCCION_LISTA"];

    if (!sheetCabecera || !sheetLista) {
        return NextResponse.json({ error: "Sheets not found" }, { status: 404 });
    }

    const [rowsCabecera, rowsLista] = await Promise.all([
        sheetCabecera.getRows(),
        sheetLista.getRows()
    ]);

    // 1. Filtrar Cabeceras por Fecha
    const cabecerasFiltradas = rowsCabecera.filter(row => {
        const d = parseSheetDate(row.get("fecha"));
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    const cabeceraIds = new Set(cabecerasFiltradas.map(r => r.get("id_produccion")));

    // 2. Filtrar Lista por ID de Cabecera válido
    const listaFiltrada = rowsLista.filter(row => cabeceraIds.has(row.get("ID_CABECERA")));

    // 3. Estructuras de Agregación
    let totalBags = 0;
    const shiftTotals: Record<string, number> = {};
    const machineTotals: Record<string, number> = {};
    
    // Mapa para agrupar detalles (Máquina + Turno) -> Métricas
    const detailsMap: Record<string, { 
        oeeSum: number, 
        dispSum: number, 
        perfSum: number, 
        count: number,
        machineName: string,
        shift: string
    }> = {};

    // Procesar Lista para Sumatorias de Bolsas
    listaFiltrada.forEach(row => {
        const idCab = row.get("ID_CABECERA");
        const bags = parseNumber(row.get("BOLSAS PRODUCIDAS"));
        
        // Buscar datos de la cabecera correspondiente
        const cabecera = cabecerasFiltradas.find(c => c.get("id_produccion") === idCab);
        if (!cabecera) return;

        const turno = cabecera.get("turno") || "Sin Turno";
        const maquina = cabecera.get("paletizadora") || "Desconocida"; // Usamos la de cabecera

        totalBags += bags;

        if (!shiftTotals[turno]) shiftTotals[turno] = 0;
        shiftTotals[turno] += bags;

        if (!machineTotals[maquina]) machineTotals[maquina] = 0;
        machineTotals[maquina] += bags;
    });

    // Procesar Cabecera para Métricas (Promedios ponderados por simple conteo por ahora)
    cabecerasFiltradas.forEach(row => {
        const maquina = row.get("paletizadora");
        const turno = row.get("turno");
        const key = `${maquina}-${turno}`;

        // Asumimos que los valores vienen en formato decimal (ej: 0.85) o porcentual
        const oee = parseNumber(row.get("oee"));
        const disp = parseNumber(row.get("disponibilidad"));
        const rend = parseNumber(row.get("rendimiento"));

        if (!detailsMap[key]) {
            detailsMap[key] = { 
                oeeSum: 0, dispSum: 0, perfSum: 0, count: 0, 
                machineName: maquina, shift: turno 
            };
        }
        detailsMap[key].oeeSum += oee;
        detailsMap[key].dispSum += disp;
        detailsMap[key].perfSum += rend;
        detailsMap[key].count += 1;
    });

    // Construir respuesta final
    const byShift = Object.entries(shiftTotals).map(([name, value]) => ({
        name, value, target: 12000 // Target fijo por ahora o calcular proporcional
    }));

    const byMachine = Object.entries(machineTotals).map(([name, value]) => ({
        name, value
    }));

    const details = Object.values(detailsMap).map(d => ({
        machineId: d.machineName, // Usamos nombre como ID por simplicidad
        machineName: d.machineName,
        shift: d.shift,
        availability: d.dispSum / d.count,
        performance: d.perfSum / d.count,
        quality: 1, // Asumimos 100% si no hay datos de calidad en cabecera
        oee: d.oeeSum / d.count
    }));

    return NextResponse.json({
        totalBags,
        byShift,
        byMachine,
        details
    });

  } catch (error: any) {
    console.error("Production API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
