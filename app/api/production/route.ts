
import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
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
    let str = String(val).trim();
    if (str.includes('%')) {
        str = str.replace('%', '');
        return parseFloat(str.replace(',', '.')) / 100;
    }
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
    let totalTn = 0;
    const shiftTotals: Record<string, number> = {};
    const machineStats: Record<string, { bags: number, tn: number }> = {};
    
    // Mapa para agrupar detalles para OEE
    const detailsMap: Record<string, { 
        tnSum: number,
        hsMarchaSum: number,
        hsParoExtSum: number,
        duracionSum: number,
        bdpSum: number,
        count: number,
        machineName: string,
        shift: string
    }> = {};

    // --- PROCESAR CABECERA (KPIs y Toneladas) ---
    // Agrupamos por Descripción Paletizadora, no por ID
    cabecerasFiltradas.forEach(row => {
        const maquinaDesc = row.get("descripcion_paletizadora") || row.get("paletizadora") || "Desconocida";
        const turno = row.get("turno");
        const key = `${maquinaDesc}-${turno}`;

        // Valores numéricos para fórmulas
        const tn = parseNumber(row.get("tn_totales_turno"));
        const hsMarcha = parseNumber(row.get("hs_marcha"));
        const hsParoExt = parseNumber(row.get("hs_paro_externo_decimal"));
        const duracion = parseNumber(row.get("duracion_turno"));
        const bdp = parseNumber(row.get("bdp_ponderado"));
        
        // Acumular Totales Generales (Tn se saca de cabecera)
        totalTn += tn;

        // Acumular Totales por Máquina (Tn)
        if (!machineStats[maquinaDesc]) machineStats[maquinaDesc] = { bags: 0, tn: 0 };
        machineStats[maquinaDesc].tn += tn;

        // Acumular para OEE
        if (!detailsMap[key]) {
            detailsMap[key] = { 
                tnSum: 0, hsMarchaSum: 0, hsParoExtSum: 0, duracionSum: 0, bdpSum: 0, count: 0,
                machineName: maquinaDesc, shift: turno 
            };
        }
        detailsMap[key].tnSum += tn;
        detailsMap[key].hsMarchaSum += hsMarcha;
        detailsMap[key].hsParoExtSum += hsParoExt;
        detailsMap[key].duracionSum += duracion;
        detailsMap[key].bdpSum += bdp;
        detailsMap[key].count += 1;
    });

    // --- PROCESAR LISTA (Bolsas) ---
    // Debemos cruzar con cabecera para saber la "descripcion_paletizadora" correcta
    listaFiltrada.forEach(row => {
        const idCab = row.get("ID_CABECERA");
        const bags = parseNumber(row.get("BOLSAS PRODUCIDAS"));
        
        const cabecera = cabecerasFiltradas.find(c => c.get("id_produccion") === idCab);
        if (!cabecera) return;

        const turno = cabecera.get("turno") || "Sin Turno";
        const maquinaDesc = cabecera.get("descripcion_paletizadora") || cabecera.get("paletizadora") || "Desconocida";

        totalBags += bags;

        if (!shiftTotals[turno]) shiftTotals[turno] = 0;
        shiftTotals[turno] += bags;

        if (!machineStats[maquinaDesc]) machineStats[maquinaDesc] = { bags: 0, tn: 0 };
        machineStats[maquinaDesc].bags += bags;
    });


    // --- CONSTRUIR RESPUESTA ---

    const byShift = Object.entries(shiftTotals).map(([name, value]) => ({
        name, value, target: 0 // Target removed
    }));

    const byMachine = Object.entries(machineStats).map(([name, stats]) => ({
        name, 
        value: stats.bags,
        valueTn: stats.tn
    }));

    const details = Object.values(detailsMap).map(d => {
        // Fórmulas del Usuario:
        
        // 1. Disponibilidad = (hs_paro_externo_decimal + hs_marcha) / duracion_turno
        // Evitar división por cero
        const disponibilidad = d.duracionSum > 0 
            ? (d.hsParoExtSum + d.hsMarchaSum) / d.duracionSum 
            : 0;

        // 2. Rendimiento = (tn_totales_turno / hs_marcha) / bdp_ponderado
        // Primero calculamos velocidad real promedio
        const avgBdp = d.count > 0 ? d.bdpSum / d.count : 0;
        const realSpeed = d.hsMarchaSum > 0 ? d.tnSum / d.hsMarchaSum : 0;
        
        const rendimiento = avgBdp > 0 ? realSpeed / avgBdp : 0;

        // 3. OEE = Disponibilidad * Rendimiento
        const oee = disponibilidad * rendimiento;

        return {
            machineId: d.machineName,
            machineName: d.machineName,
            shift: d.shift,
            availability: disponibilidad,
            performance: rendimiento,
            quality: 1, // No medido
            oee: oee
        };
    });

    return NextResponse.json({
        totalBags,
        totalTn,
        byShift,
        byMachine,
        details
    });

  } catch (error: any) {
    console.error("Production API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
