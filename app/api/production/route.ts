
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// --- CONFIGURACIÓN DE CACHÉ ---
const CACHE_TTL = 60 * 1000; // 60 segundos
const cache = new Map<string, { data: any; timestamp: number }>();

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
      let [day, month, year] = parts.map(Number);
      if (year < 100) year += 2000;
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
    // Seguridad: Verificar autenticación
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); 
    const endParam = searchParams.get("end");
    const topParam = searchParams.get("top");

    if (!topParam && (!startParam || !endParam)) {
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    // 1. VERIFICAR CACHÉ
    const cacheKey = topParam ? `prod-top-${topParam}` : `prod-${startParam}-${endParam}`;
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

    const startDate = startParam ? new Date(startParam + "T00:00:00") : null;
    const endDate = endParam ? new Date(endParam + "T23:59:59") : null;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) return NextResponse.json({});

    const authClient = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const doc = new GoogleSpreadsheet(sheetId, authClient);
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

    if (topParam) {
        const topCount = parseInt(topParam);
        const allRecords = rowsCabecera.map(row => {
            const maquinaId = row.get("paletizadora") || "Desconocida";
            const maquinaDesc = row.get("descripcion_paletizadora") || maquinaId;
            return {
                date: row.get("fecha"),
                shift: row.get("turno"),
                machineId: maquinaId,
                machineName: maquinaDesc,
                valueTn: parseNumber(row.get("tn_totales_turno")),
            };
        }).sort((a, b) => b.valueTn - a.valueTn).slice(0, topCount);

        cache.set(cacheKey, { data: allRecords, timestamp: now });
        return NextResponse.json(allRecords);
    }

    // 1. Filtrar Cabeceras por Fecha
    const cabecerasFiltradas = rowsCabecera.filter(row => {
        const d = parseSheetDate(row.get("fecha"));
        return d && startDate && endDate && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    const cabeceraIds = new Set(cabecerasFiltradas.map(r => r.get("id_produccion")));

    // 2. Filtrar Lista por ID de Cabecera válido
    const listaFiltrada = rowsLista.filter(row => cabeceraIds.has(row.get("ID_CABECERA")));

    // 3. Estructuras de Agregación
    let totalBags = 0;
    let totalTn = 0;
    const shiftTotalsTn: Record<string, number> = {};
    const shiftTotalsBags: Record<string, number> = {};
    const machineStats: Record<string, { bags: number, tn: number, name: string }> = {};
    
    // New Aggregation for Stacked Bar (Machine -> Product -> Quantity)
    const machineProductMap: Record<string, Record<string, number>> = {};
    
    // Mapa para agrupar detalles para OEE
    const detailsMap: Record<string, { 
        hsMarchaSum: number,
        hsParoExtSum: number,
        duracionSum: number,
        weightedRendNumer: number, 
        weightedRendDenom: number,
        bagsSum: number,
        count: number,
        machineId: string,
        machineName: string,
        shift: string
    }> = {};

    // --- PROCESAR CABECERA (KPIs y Toneladas) ---
    cabecerasFiltradas.forEach(row => {
        const maquinaId = row.get("paletizadora") || "Desconocida";
        const maquinaDesc = row.get("descripcion_paletizadora") || maquinaId;
        const turno = row.get("turno") || "Sin Turno";
        const fecha = row.get("fecha") || "Sin Fecha";
        const key = `${maquinaId}|${turno}|${fecha}`;

        const tnHeader = parseNumber(row.get("tn_totales_turno"));
        const hsMarcha = parseNumber(row.get("hs_marcha"));
        const hsParoExt = parseNumber(row.get("hs_paro_externo_decimal"));
        const duracion = parseNumber(row.get("duracion_turno"));
        
        const rendimientoFila = parseNumber(row.get("rendimiento"));
        
        if (!machineStats[maquinaId]) machineStats[maquinaId] = { bags: 0, tn: 0, name: maquinaDesc };

        if (!detailsMap[key]) {
            detailsMap[key] = { 
                hsMarchaSum: 0, hsParoExtSum: 0, duracionSum: 0, 
                weightedRendNumer: 0, weightedRendDenom: 0,
                bagsSum: 0,
                count: 0,
                machineId: maquinaId,
                machineName: maquinaDesc, 
                shift: turno 
            };
        }
        
        detailsMap[key].hsMarchaSum += hsMarcha;
        detailsMap[key].hsParoExtSum += hsParoExt;
        detailsMap[key].duracionSum += duracion;

        if (tnHeader > 0) {
            detailsMap[key].weightedRendNumer += (rendimientoFila * tnHeader);
            detailsMap[key].weightedRendDenom += tnHeader;
        }

        detailsMap[key].count += 1;
    });

    // --- PROCESAR LISTA (Bolsas y Productos) ---
    listaFiltrada.forEach(row => {
        const idCab = row.get("ID_CABECERA");
        const bags = parseNumber(row.get("BOLSAS PRODUCIDAS"));
        const tn = parseNumber(row.get("TN_PRODUCIDA"));
        const material = String(row.get("DESCRIPCION_MATERIAL") || "Otros").trim();
        
        const cabecera = cabecerasFiltradas.find(c => c.get("id_produccion") === idCab);
        if (!cabecera) return;

        const turno = cabecera.get("turno") || "Sin Turno";
        const maquinaId = cabecera.get("paletizadora") || "Desconocida";
        const maquinaDesc = cabecera.get("descripcion_paletizadora") || maquinaId;
        const fecha = cabecera.get("fecha") || "Sin Fecha";
        const key = `${maquinaId}|${turno}|${fecha}`;

        totalBags += bags;
        totalTn += tn;

        if (detailsMap[key]) {
            detailsMap[key].bagsSum += bags;
        }

        if (!shiftTotalsTn[turno]) shiftTotalsTn[turno] = 0;
        shiftTotalsTn[turno] += tn;

        if (!shiftTotalsBags[turno]) shiftTotalsBags[turno] = 0;
        shiftTotalsBags[turno] += bags;

        if (!machineStats[maquinaId]) machineStats[maquinaId] = { bags: 0, tn: 0, name: maquinaDesc };
        machineStats[maquinaId].bags += bags;
        machineStats[maquinaId].tn += tn;
        
        if (!machineProductMap[maquinaDesc]) machineProductMap[maquinaDesc] = {};
        if (!machineProductMap[maquinaDesc][material]) machineProductMap[maquinaDesc][material] = 0;
        machineProductMap[maquinaDesc][material] += tn;
    });


    // --- CONSTRUIR RESPUESTA ---

    const byShift = Object.entries(shiftTotalsTn).map(([name, value]) => ({
        name, 
        valueTn: value,
        valueBags: shiftTotalsBags[name] || 0,
        target: 0 
    }));

    const byMachine = Object.entries(machineStats).map(([id, stats]: [string, any]) => ({
        name: stats.name,
        machineId: id,
        value: stats.bags,
        valueTn: stats.tn
    }));

    // Convert Stacked Map to Array
    const byMachineProduct = Object.entries(machineProductMap).map(([name, products]) => ({
        name,
        ...products
    })).sort((a,b) => a.name.localeCompare(b.name));

    const details = Object.entries(detailsMap).map(([key, d]) => {
        const parts = key.split('|');
        const fecha = parts[parts.length - 1];
        const disponibilidad = d.duracionSum > 0 
            ? (d.hsParoExtSum + d.hsMarchaSum) / d.duracionSum 
            : 0;

        const rendimiento = d.weightedRendDenom > 0 
            ? d.weightedRendNumer / d.weightedRendDenom 
            : 0;

        const oee = disponibilidad * rendimiento;

        return {
            machineId: d.machineId,
            machineName: d.machineName,
            shift: d.shift,
            date: fecha,
            availability: disponibilidad,
            performance: rendimiento,
            quality: 1, 
            oee: oee,
            valueTn: d.weightedRendDenom,
            valueBags: d.bagsSum,
            hsMarcha: d.hsMarchaSum
        };
    });

    const result = {
        totalBags,
        totalTn,
        byShift,
        byMachine,
        byMachineProduct,
        details
    };

    cache.set(cacheKey, { data: result, timestamp: now });

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
            'X-Cache': 'MISS'
        }
    });

  } catch (error: any) {
    console.error("Production API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
