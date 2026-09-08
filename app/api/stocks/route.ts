import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, fetchRowsByDateRange, fetchRowsByIds, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300'
};

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

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    // Check in-memory cache
    const cacheKey = `stocks-v2-${startParam}-${endParam}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, { headers: CACHE_HEADERS });
    }

    // Reference tables (small, static) — fetch full
    const [rowsTurnos, rowsMateriales] = await Promise.all([
        fetchAllRows("turnosv2"),
        fetchAllRows("materialesv2")
    ]);

    // Date-sensitive tables — filter in Supabase
    const [rowsConteo, rowsCabecera] = await Promise.all([
        fetchRowsByDateRange("inventario_fisicov2", "fecha", startParam, endParam),
        fetchRowsByDateRange("produccionv2", "fecha", startParam, endParam),
    ]);

    // Load detalles only for the filtered cabecera IDs (noche shift detection happens below)
    const cabeceraIdsList = rowsCabecera.map(r => getSupabaseVal(r, "id")).filter(Boolean);
    const rowsLista = await fetchRowsByIds("detalles_produccionv2", "produccion_id", cabeceraIdsList);

    // Map turnosv2 to find the ID with the name 'NOCHE'
    const turnoNocheRow = rowsTurnos.find(t => {
        const name = String(getSupabaseVal(t, "name") || getSupabaseVal(t, "nombre") || getSupabaseVal(t, "descripcion") || "").toUpperCase();
        return name === "NOCHE" || name.includes("NOCHE") || name.startsWith("3.");
    });
    const turnoNocheId = turnoNocheRow ? getSupabaseVal(turnoNocheRow, "id") : null;

    // Helper to determine if a material is productive
    const isMaterialProductive = (m: any): boolean => {
        const esProd = getSupabaseVal(m, "es_productivo");
        return esProd === true || esProd === "true" || esProd === "TRUE" || esProd === 1 || esProd === "1";
    };

    const materialesProductivos = rowsMateriales.filter(isMaterialProductive);

    // Build O(1) material maps
    const materialsById = new Map<string, any>();
    const prodMaterialsById = new Map<string, any>();
    const prodMaterialsByNormName = new Map<string, any>();
    const allMaterialsByNormName = new Map<string, any>();

    rowsMateriales.forEach(m => {
        const id = getSupabaseVal(m, "id");
        const name = String(getSupabaseVal(m, "nombre") || getSupabaseVal(m, "name") || "").trim();
        const norm = cleanName(name);

        if (id) {
            materialsById.set(String(id), m);
            if (isMaterialProductive(m)) {
                prodMaterialsById.set(String(id), m);
            }
        }
        if (norm) {
            allMaterialsByNormName.set(norm, m);
            if (isMaterialProductive(m)) {
                prodMaterialsByNormName.set(norm, m);
            }
        }
    });

    const findProdMaterial = (rowMatId: any, materialNorm: string) => {
        if (rowMatId && prodMaterialsById.has(String(rowMatId))) {
            return prodMaterialsById.get(String(rowMatId));
        }
        if (materialNorm && prodMaterialsByNormName.has(materialNorm)) {
            return prodMaterialsByNormName.get(materialNorm);
        }
        if (materialNorm) {
            return materialesProductivos.find(m => {
                const mNameNorm = cleanName(getSupabaseVal(m, "nombre") || getSupabaseVal(m, "name") || "");
                return mNameNorm === materialNorm || 
                       (mNameNorm.length > 3 && materialNorm.length > 3 && (mNameNorm.includes(materialNorm) || materialNorm.includes(mNameNorm)));
            }) || null;
        }
        return null;
    };

    const findAllMaterial = (rowMatId: any, materialNorm: string) => {
        if (rowMatId && materialsById.has(String(rowMatId))) {
            return materialsById.get(String(rowMatId));
        }
        if (materialNorm && allMaterialsByNormName.has(materialNorm)) {
            return allMaterialsByNormName.get(materialNorm);
        }
        if (materialNorm) {
            return rowsMateriales.find(m => {
                const mNameNorm = cleanName(getSupabaseVal(m, "nombre") || getSupabaseVal(m, "name") || "");
                return mNameNorm === materialNorm || 
                       (mNameNorm.length > 3 && materialNorm.length > 3 && (mNameNorm.includes(materialNorm) || materialNorm.includes(mNameNorm)));
            }) || null;
        }
        return null;
    };

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
            const rowMatId = getSupabaseVal(row, "material_id") || 
                             getSupabaseVal(row, "id_material") ||
                             getSupabaseVal(row, "id_materiales") ||
                             getSupabaseVal(row, "idmaterial");
                             
            const materialOriginal = String(getSupabaseVal(row, "descripcion_material") || 
                                            getSupabaseVal(row, "material") || 
                                            getSupabaseVal(row, "nombre") || 
                                            "").trim();
            const materialNorm = cleanName(materialOriginal);
            
            let matchedMaterialName = "";
            let isProd = false;

            const mat = findProdMaterial(rowMatId, materialNorm);
            if (mat) {
                matchedMaterialName = String(getSupabaseVal(mat, "nombre") || getSupabaseVal(mat, "name") || "").trim();
                isProd = true;
            }

            const targetKey = isProd ? cleanName(matchedMaterialName) : materialNorm;
            const tn = parseNumber(getSupabaseVal(row, "tn_producidas") || getSupabaseVal(row, "tn_producida"));
            
            if (!nightProductionMap[targetKey]) nightProductionMap[targetKey] = 0;
            nightProductionMap[targetKey] += tn;
        }
    });

    // 2. OBTENER CONTEO (SNAPSHOT) FROM inventario_fisicov2
    const conteosPorFecha = rowsConteo.filter(row => {
        const d = parseSheetDate(getSupabaseVal(row, "fecha"));
        if (!d) return false;
        return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    // Filter strictly by NOCHE shift, no fallback to all of the date's records
    const conteosFiltrados = conteosPorFecha.filter(row => {
        const rowTurnoId = getSupabaseVal(row, "turno_id") || getSupabaseVal(row, "id_turno") || getSupabaseVal(row, "id_turnos") || getSupabaseVal(row, "idturnos");
        const rowTurnoRaw = String(getSupabaseVal(row, "turno") || getSupabaseVal(row, "descripcion_turno") || "").trim().toUpperCase();

        if (turnoNocheId && rowTurnoId) {
            return String(rowTurnoId) === String(turnoNocheId);
        }
        
        return rowTurnoRaw === "NOCHE" || rowTurnoRaw.includes("NOCHE") || rowTurnoRaw.startsWith("3.");
    });

    const stockMap: Record<string, { displayName: string, qty: number, tn: number, isProduced: boolean, date: string }> = {};

    // Initialize stockMap with all productive materials to make sure none are missing
    materialesProductivos.forEach(m => {
        const mName = String(getSupabaseVal(m, "nombre") || getSupabaseVal(m, "name") || "").trim();
        const normKey = cleanName(mName);
        stockMap[normKey] = {
            displayName: mName,
            qty: 0,
            tn: 0,
            isProduced: true,
            date: startParam
        };
    });

    conteosFiltrados.forEach(row => {
        const rowMatId = getSupabaseVal(row, "material_id") || 
                         getSupabaseVal(row, "id_material") ||
                         getSupabaseVal(row, "id_materiales") ||
                         getSupabaseVal(row, "idmaterial");
                         
        const productoOriginal = String(getSupabaseVal(row, "descripcion_material") || 
                                        getSupabaseVal(row, "material") || 
                                        getSupabaseVal(row, "nombre") || 
                                        getSupabaseVal(row, "nombre_material") || 
                                        "").trim();
        const productoNorm = cleanName(productoOriginal);

        // Find match in ALL materials list from materialesv2 to support non-productive items
        const matchedMat = findAllMaterial(rowMatId, productoNorm);

        const matchedMaterialName = matchedMat 
            ? String(getSupabaseVal(matchedMat, "nombre") || getSupabaseVal(matchedMat, "name") || "").trim()
            : productoOriginal;

        const isProd = matchedMat ? isMaterialProductive(matchedMat) : false;

        const cantidad = parseNumber(getSupabaseVal(row, "cantidad") || getSupabaseVal(row, "qty"));
        const tn = parseNumber(getSupabaseVal(row, "peso_tn") || getSupabaseVal(row, "peso") || getSupabaseVal(row, "tonelaje") || getSupabaseVal(row, "tn"));
        const fecha = getSupabaseVal(row, "fecha");
        
        const normKey = cleanName(matchedMaterialName);
        
        if (!stockMap[normKey]) {
            stockMap[normKey] = { 
                displayName: matchedMaterialName, 
                qty: 0, 
                tn: 0, 
                isProduced: isProd, 
                date: String(fecha || startParam)
            };
        }
        stockMap[normKey].qty += cantidad;
        stockMap[normKey].tn += tn;
        if (fecha) {
            stockMap[normKey].date = String(fecha);
        }
    });

    // 3. SUMAR PRODUCCIÓN NOCHE A LOS TOTALES DE CEMENTOS PRODUCIDOS
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

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result, { headers: CACHE_HEADERS });

  } catch (error: any) {
    console.error("Stocks API Error inventario_fisico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

