import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    if (str === '') return 0;
    
    if (str.includes('.') && str.includes(',')) {
         str = str.replace(/\./g, ''); 
         str = str.replace(',', '.');
    } 
    else if (str.includes('.') && !str.includes(',')) {
         if ((str.match(/\./g) || []).length > 1) {
             str = str.replace(/\./g, '');
         } else {
             str = str.replace(/\./g, '');
         }
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
}

function cleanName(str: string): string {
    return String(str || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    const cacheKey = `stocks-v2-${startParam}-${endParam}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data, {
           headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30', 'X-Cache': 'HIT-MEMORY' }
       });
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    // Fetch from Supabase tables instead of Google Sheets, including turnosv2 and materialesv2
    const [rowsConteo, rowsCabecera, rowsLista, rowsTurnos, rowsMateriales] = await Promise.all([
        fetchAllRows("inventario_fisico"),
        fetchAllRows("produccionv2"),
        fetchAllRows("detalles_produccionv2"),
        fetchAllRows("turnosv2"),
        fetchAllRows("materialesv2")
    ]);

    // Map turnosv2 to find the ID with the name 'NOCHE'
    const turnoNocheRow = rowsTurnos.find(t => {
        const name = String(getSupabaseVal(t, "name") || getSupabaseVal(t, "nombre") || "").toUpperCase();
        return name === "NOCHE" || name.includes("NOCHE");
    });
    const turnoNocheId = turnoNocheRow ? getSupabaseVal(turnoNocheRow, "id") : null;

    // Filter productive materials where es_productivo is true/TRUE
    const materialesProductivos = rowsMateriales.filter(m => {
        const esProd = getSupabaseVal(m, "es_productivo");
        return esProd === true || esProd === "true" || esProd === "TRUE" || esProd === 1 || esProd === "1";
    });

    // 1. OBTENER PRODUCCION NOCHE
    const cabecerasNoche = rowsCabecera.filter(row => {
        const d = parseSheetDate(getSupabaseVal(row, "fecha"));
        if (!d) return false;
        
        const isDateMatch = d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
        if (!isDateMatch) return false;

        const shiftId = getSupabaseVal(row, "turno_id");
        const turnoRaw = String(getSupabaseVal(row, "descripcion_turno") || getSupabaseVal(row, "turno") || "").trim().toUpperCase();
        
        const isShiftIdNoche = shiftId && turnoNocheId && String(shiftId) === String(turnoNocheId);
        const isTurnoRawNoche = turnoRaw === "3.NOCHE" || turnoRaw.startsWith("3.") || turnoRaw === "NOCHE";

        return isShiftIdNoche || isTurnoRawNoche;
    });

    const idsNoche = new Set(cabecerasNoche.map(r => getSupabaseVal(r, "id")));

    const nightProductionMap: Record<string, number> = {};

    rowsLista.forEach(row => {
        const prodId = getSupabaseVal(row, "produccion_id");
        if (prodId && idsNoche.has(prodId)) {
            const material = cleanName(getSupabaseVal(row, "descripcion_material") || getSupabaseVal(row, "material"));
            const tn = parseNumber(getSupabaseVal(row, "tn_producidas") || getSupabaseVal(row, "tn_producida"));
            
            if (!nightProductionMap[material]) nightProductionMap[material] = 0;
            nightProductionMap[material] += tn;
        }
    });

    // 2. OBTENER CONTEO (SNAPSHOT) FROM inventario_fisico
    const conteosFiltrados = rowsConteo.filter(row => {
        const d = parseSheetDate(getSupabaseVal(row, "fecha"));
        if (!d) return false;

        const isDateMatch = d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
        if (!isDateMatch) return false;

        const rowTurnoId = getSupabaseVal(row, "turno_id") || getSupabaseVal(row, "id_turno");
        const rowTurnoRaw = String(getSupabaseVal(row, "turno") || getSupabaseVal(row, "descripcion_turno") || "").trim().toUpperCase();

        const isShiftMatch = (rowTurnoId && turnoNocheId)
            ? String(rowTurnoId) === String(turnoNocheId)
            : (rowTurnoRaw === "NOCHE" || rowTurnoRaw.includes("NOCHE") || rowTurnoRaw.startsWith("3."));
            
        return isShiftMatch;
    });

    const stockMap: Record<string, { displayName: string, qty: number, tn: number, isProduced: boolean, date: string }> = {};

    conteosFiltrados.forEach(row => {
        const rowMatId = getSupabaseVal(row, "material_id") || getSupabaseVal(row, "id_material");
        const productoOriginal = String(getSupabaseVal(row, "descripcion_material") || getSupabaseVal(row, "material") || "").trim();
        const productoNorm = cleanName(productoOriginal);

        // Find match in productive materials list from materialesv2
        let matchedMaterialName = "";
        let isProductive = false;

        if (rowMatId) {
            const mat = materialesProductivos.find(m => String(getSupabaseVal(m, "id")) === String(rowMatId));
            if (mat) {
                matchedMaterialName = String(getSupabaseVal(mat, "nombre") || getSupabaseVal(mat, "name") || "").trim();
                isProductive = true;
            }
        }

        if (!isProductive && productoNorm) {
            const mat = materialesProductivos.find(m => {
                const mNameNorm = cleanName(getSupabaseVal(m, "nombre") || getSupabaseVal(m, "name") || "");
                return mNameNorm === productoNorm;
            });
            if (mat) {
                matchedMaterialName = String(getSupabaseVal(mat, "nombre") || getSupabaseVal(mat, "name") || "").trim();
                isProductive = true;
            }
        }

        // We only showcase productive materials
        if (!isProductive) {
            return;
        }

        const cantidad = parseNumber(getSupabaseVal(row, "cantidad") || getSupabaseVal(row, "qty"));
        const tn = parseNumber(getSupabaseVal(row, "peso_tn") || getSupabaseVal(row, "peso") || getSupabaseVal(row, "tonelaje") || getSupabaseVal(row, "tn"));
        const fecha = getSupabaseVal(row, "fecha");
        
        const normKey = cleanName(matchedMaterialName);
        
        if (!stockMap[normKey]) {
            stockMap[normKey] = { 
                displayName: matchedMaterialName, 
                qty: 0, 
                tn: 0, 
                isProduced: true, 
                date: String(fecha)
            };
        }
        stockMap[normKey].qty += cantidad;
        stockMap[normKey].tn += tn;
    });

    // 3. SUMAR PRODUCCIÓN NOCHE A LOS TOTALES
    Object.keys(stockMap).forEach(productoNorm => {
        if (stockMap[productoNorm].isProduced) {
            const nightTn = nightProductionMap[productoNorm] || 0;
            stockMap[productoNorm].tn += nightTn;
            const nightBags = nightTn / 0.05;
            stockMap[productoNorm].qty += nightBags;
        }
    });

    const items = Object.entries(stockMap).map(([norm, stats], idx) => ({
        id: `stk-${idx}`,
        product: stats.displayName,
        quantity: stats.qty,
        tonnage: stats.tn,
        isProduced: stats.isProduced,
        lastUpdated: stats.date
    }));

    const result = {
        date: items[0]?.lastUpdated || startParam,
        items
    };

    cache.set(cacheKey, { data: result, timestamp: now });

    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30', 'X-Cache': 'MISS' }
    });

  } catch (error: any) {
    console.error("Stocks API Error inventario_fisico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
