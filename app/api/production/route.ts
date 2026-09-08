import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, fetchRowsByDateRange, fetchRowsByIds, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

// In-memory cache: avoids re-fetching Supabase for the same date range across requests
const CACHE_TTL = 60 * 1000; // 60 seconds
const cache = new Map<string, { data: any; timestamp: number }>();

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300'
};

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    if (str.includes('%')) {
        str = str.replace('%', '');
        return parseFloat(str.replace(',', '.')) / 100;
    }
    if (str.includes('.') && str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
}

function hmsToMinutes(hms: string | null | undefined): number {
  if (!hms) return 0;
  if (typeof hms === "number") return hms;
  if (typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.length === 3) {
    // H:MM:SS
    return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  } else if (parts.length === 2) {
    // MM:SS o HH:MM
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(hms) || 0;
}

function normalizeMachine(m: any): string {
    if (!m) return "";
    return String(m).trim().toUpperCase().replace(/[\s_\-\.\/]+/g, '');
}

function isMachineMatch(id1: string | null | undefined, id2: string | null | undefined): boolean {
  if (!id1 || !id2) return false;
  const s1 = String(id1).trim().toUpperCase();
  const s2 = String(id2).trim().toUpperCase();

  const clean1 = s1.replace(/\s/g, '');
  const clean2 = s2.replace(/\s/g, '');
  if (clean1 === clean2) return true;

  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  const a1 = clean1.replace(/[^A-Z0-9]/g, '');
  const a2 = clean2.replace(/[^A-Z0-9]/g, '');
  if (!a1 || !a2) return false;
  return a1 === a2;
}

function normalizeShift(s: any): string {
    if (!s) return "";
    let str = String(s).trim().toUpperCase();
    if (str.includes("MAÑANA") || str.includes("MANANA")) return "MAÑANA";
    if (str.includes("TARDE")) return "TARDE";
    if (str.includes("NOCHE")) return "NOCHE";
    return str;
}

function sameDate(d1Str: any, d2Str: any): boolean {
    const date1 = parseSheetDate(d1Str);
    const date2 = parseSheetDate(d2Str);
    if (!date1 || !date2) return false;
    return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
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
    const topParam = searchParams.get("top");

    if (!topParam && (!startParam || !endParam)) {
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    const startDate = startParam ? new Date(startParam + "T00:00:00") : null;
    const endDate = endParam ? new Date(endParam + "T23:59:59") : null;

    // Check in-memory cache
    const cacheKey = `production-v2-${startParam}-${endParam}-${topParam || 'none'}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, { headers: CACHE_HEADERS });
    }

    // Reference tables are small — fetch in full; date-sensitive tables use server-side filter
    let rowsCabecera: any[];
    let rowsLista: any[];
    let rowsParos: any[];

    if (topParam) {
      // Top-records mode needs full history; keep fetchAllRows
      [rowsCabecera, rowsLista, rowsParos] = await Promise.all([
          fetchAllRows("produccionv2"),
          Promise.resolve([]), // not needed for topParam branch
          Promise.resolve([]),
      ]);
    } else {
      // Date-range mode: filter in Supabase — avoids downloading the full table
      rowsCabecera = await fetchRowsByDateRange("produccionv2", "fecha", startParam!, endParam!);
      // Load detalles only for the filtered cabecera IDs
      const cabeceraIdsList = rowsCabecera
          .map(r => getSupabaseVal(r, "id"))
          .filter(Boolean);
      // Load paros for the date range in parallel with detalles
      [rowsLista, rowsParos] = await Promise.all([
          fetchRowsByIds("detalles_produccionv2", "produccion_id", cabeceraIdsList),
          fetchRowsByDateRange("parosv2", "fecha", startParam!, endParam!),
      ]);
    }

    // Reference tables (small, no date filter needed)
    const [rowsTurnos, rowsPaletizadoras] = await Promise.all([
        fetchAllRows("turnosv2"),
        fetchAllRows("paletizadorav2")
    ]);

    // Pre-build O(1) Lookup Maps
    const paletizadoraMap = new Map<string, any>();
    rowsPaletizadoras.forEach(p => {
        const id = getSupabaseVal(p, "id");
        if (id) paletizadoraMap.set(String(id), p);
    });

    const turnosMap = new Map<string, any>();
    rowsTurnos.forEach(t => {
        const id = getSupabaseVal(t, "id");
        if (id) turnosMap.set(String(id), t);
    });

    if (topParam) {
        const topCount = parseInt(topParam);
        const dailySums: Record<string, { tn: number, machineId: string, machineName: string, date: string }> = {};
        
        rowsCabecera.forEach(row => {
            const palId = getSupabaseVal(row, "palletizadora_id");
            const palletizerRow = palId ? paletizadoraMap.get(String(palId)) : null;
            const maquinaId = palId ? String(palId) : (getSupabaseVal(row, "palletizadora") || "Desconocida");
            const maquinaDesc = palletizerRow ? (getSupabaseVal(palletizerRow, "hac_id") || getSupabaseVal(palletizerRow, "nombre") || maquinaId) : (getSupabaseVal(row, "hac_paletizadora") || maquinaId);
            
            const rawDate = getSupabaseVal(row, "fecha");
            const d = parseSheetDate(rawDate);
            if (!d) return;
            
            const dateStr = d.toISOString().split('T')[0];
            const valueTn = parseNumber(getSupabaseVal(row, "tn_producidas"));
            
            const key = `${maquinaDesc}|${dateStr}`;
            if (!dailySums[key]) {
                dailySums[key] = {
                    tn: 0,
                    machineId: maquinaDesc,
                    machineName: maquinaDesc,
                    date: dateStr
                };
            }
            dailySums[key].tn += valueTn;
        });

        const machineMax: Record<string, any> = {};
        Object.values(dailySums).forEach(d => {
            if (!machineMax[d.machineName] || d.tn > machineMax[d.machineName].valueTn) {
                machineMax[d.machineName] = {
                    date: d.date,
                    machineId: d.machineName,
                    machineName: d.machineName,
                    valueTn: d.tn,
                };
            }
        });

        const topOverall = Object.values(dailySums)
            .map(d => ({
                date: d.date,
                machineId: d.machineName,
                machineName: d.machineName,
                valueTn: d.tn,
            }))
            .sort((a, b) => b.valueTn - a.valueTn)
            .slice(0, topCount);

        const combined = [...topOverall];
        Object.values(machineMax).forEach((mMax: any) => {
            const alreadyIn = combined.some(r => 
                r.machineName === mMax.machineName && 
                Math.abs(r.valueTn - mMax.valueTn) < 0.01 && 
                r.date === mMax.date
            );
            if (!alreadyIn) {
                combined.push(mMax);
            }
        });

        const finalRecords = combined.sort((a, b) => b.valueTn - a.valueTn);

        cache.set(cacheKey, { data: finalRecords, timestamp: Date.now() });
        return NextResponse.json(finalRecords, { headers: CACHE_HEADERS });
    }

    // rowsCabecera is already filtered by date from Supabase (fetchRowsByDateRange).
    // The JS re-filter below is kept as a lightweight safety guard for edge cases.
    const cabecerasFiltradas = rowsCabecera.filter(row => {
        const d = parseSheetDate(getSupabaseVal(row, "fecha"));
        return d && startDate && endDate && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    const cabeceraMap = new Map<string, any>();
    cabecerasFiltradas.forEach(r => {
        const id = getSupabaseVal(r, "id");
        if (id) cabeceraMap.set(String(id), r);
    });

    // rowsLista is already scoped to these cabeceraIds via fetchRowsByIds
    const listaFiltrada = rowsLista.filter(row => cabeceraMap.has(String(getSupabaseVal(row, "produccion_id"))));

    // Pre-group paros by date string (YYYY-MM-DD) for fast lookup
    const parosByDateMap = new Map<string, any[]>();
    rowsParos.forEach(p => {
        const pDate = getSupabaseVal(p, "FECHA") || getSupabaseVal(p, "fecha");
        const parsedD = parseSheetDate(pDate);
        if (parsedD) {
            const dateStr = parsedD.toISOString().split('T')[0];
            if (!parosByDateMap.has(dateStr)) {
                parosByDateMap.set(dateStr, []);
            }
            parosByDateMap.get(dateStr)!.push(p);
        }
    });

    let totalBags = 0;
    let totalTn = 0;
    const shiftTotalsTn: Record<string, number> = {};
    const shiftTotalsBags: Record<string, number> = {};
    const machineStats: Record<string, { bags: number, tn: number, name: string }> = {};
    
    const machineProductMap: Record<string, Record<string, number>> = {};
    
    const detailsMap: Record<string, { 
        hsMarchaSum: number,
        hasExplicitHsMarcha: boolean,
        calculatedHsMarcha: number,
        bagsSum: number,
        count: number,
        machineId: string,
        machineName: string,
        shift: string,
        oeeSum: number,
        dispSum: number,
        rendSum: number,
        valueTnSum: number
    }> = {};

    cabecerasFiltradas.forEach(row => {
        const palId = getSupabaseVal(row, "palletizadora_id");
        const palletizerRow = palId ? paletizadoraMap.get(String(palId)) : null;
        const maquinaId = palId ? String(palId) : (getSupabaseVal(row, "palletizadora") || "Desconocida");
        
        // Extract real HAC (e.g., "MG.672-PZ1") and description (e.g., "Paletizadora 672") from master table paletizadorav2
        const maquinaHac = palletizerRow 
            ? (getSupabaseVal(palletizerRow, "hac") || getSupabaseVal(palletizerRow, "hac_id") || maquinaId)
            : (getSupabaseVal(row, "hac_paletizadora") || maquinaId);
            
        const maquinaDesc = palletizerRow 
            ? (getSupabaseVal(palletizerRow, "descripcion") || getSupabaseVal(palletizerRow, "nombre") || maquinaHac)
            : (getSupabaseVal(row, "hac_paletizadora") || maquinaId);

        const shiftId = getSupabaseVal(row, "turno_id");
        const shiftRow = shiftId ? turnosMap.get(String(shiftId)) : null;
        const turno = getSupabaseVal(row, "descripcion_turno") || (shiftRow ? getSupabaseVal(shiftRow, "name") : null) || "Sin Turno";
        const fecha = getSupabaseVal(row, "fecha") || "Sin Fecha";
        const key = `${maquinaId}|${turno}|${fecha}`;

        const tnHeader = parseNumber(getSupabaseVal(row, "tn_producidas"));
        
        let rendimiento = parseNumber(getSupabaseVal(row, "rendimiento"));
        if (rendimiento > 1.0) rendimiento = rendimiento / 100;

        // Fetch duration_hours from matched turnosv2 or fallback
        const duracionTurno = shiftRow ? parseNumber(getSupabaseVal(shiftRow, "duration_hours")) : (parseNumber(getSupabaseVal(row, "duracion_turno")) || 8);
        const duracionTurnoMinutes = duracionTurno * 60;

        // Calculate dynamic availability based on actual downtime events (parosv2)
        const rowDateObj = parseSheetDate(fecha);
        const dateStr = rowDateObj ? rowDateObj.toISOString().split('T')[0] : null;
        const candidateParos = dateStr ? (parosByDateMap.get(dateStr) || []) : [];

        const matchedParos = candidateParos.filter(p => {
            const pMachine = getSupabaseVal(p, "MÁQUINA AFECTADA") || getSupabaseVal(p, "maquina_afectada") || getSupabaseVal(p, "HAC") || getSupabaseVal(p, "hac") || getSupabaseVal(p, "machine_id") || getSupabaseVal(p, "machine");
            const pTurnoId = getSupabaseVal(p, "turno_id");
            const rowTurnoId = getSupabaseVal(row, "turno_id");

            const isMachineMatchResult = isMachineMatch(maquinaDesc, pMachine) || isMachineMatch(maquinaHac, pMachine) || isMachineMatch(maquinaId, pMachine);
            const isShiftMatch = (pTurnoId && rowTurnoId)
                ? String(pTurnoId) === String(rowTurnoId)
                : normalizeShift(turno) === normalizeShift(getSupabaseVal(p, "TURNO") || getSupabaseVal(p, "turno"));

            return isMachineMatchResult && isShiftMatch;
        });

        // Split paros into internal and external minutes
        let paroInternoMinutes = 0;
        let paroExternoMinutes = 0;

        matchedParos.forEach(p => {
            const durRaw = getSupabaseVal(p, "DURACIÓN") || getSupabaseVal(p, "duracion") || getSupabaseVal(p, "duration_minutes") || "0:00:00";
            const durMinutes = hmsToMinutes(durRaw);
            const tipoParoRaw = String(getSupabaseVal(p, "TIPO PARO") || getSupabaseVal(p, "tipo_paro") || getSupabaseVal(p, "tipo") || "").toLowerCase();
            
            if (tipoParoRaw.includes("externo")) {
                paroExternoMinutes += durMinutes;
            } else {
                paroInternoMinutes += durMinutes;
            }
        });

        // Determine availability based on user rules
        let disponibilidad = 1.0;
        let hsMarcha = 0;

        if (paroInternoMinutes >= duracionTurnoMinutes) {
            disponibilidad = 0.0;
            hsMarcha = 0;
        } else if (paroExternoMinutes >= duracionTurnoMinutes) {
            disponibilidad = 1.0;
            hsMarcha = 0;
        } else if (tnHeader === 0) {
            rendimiento = 0.0;
            if (paroInternoMinutes === 0 && paroExternoMinutes === 0) {
                disponibilidad = 1.0;
            } else if (paroExternoMinutes >= duracionTurnoMinutes) {
                disponibilidad = 1.0;
            } else if (paroInternoMinutes > 0) {
                disponibilidad = Math.max(0, (duracionTurnoMinutes - paroInternoMinutes) / duracionTurnoMinutes);
            } else {
                disponibilidad = 1.0;
            }
            hsMarcha = Math.max(0, duracionTurnoMinutes - paroInternoMinutes - paroExternoMinutes) / 60;
        } else {
            hsMarcha = (duracionTurnoMinutes - paroInternoMinutes - paroExternoMinutes) / 60;
            if (hsMarcha < 0) hsMarcha = 0;

            const hsParoExterno = paroExternoMinutes / 60;
            let calculatedDisp = duracionTurno > 0 ? (hsParoExterno + hsMarcha) / duracionTurno : 1.0;
            if (calculatedDisp < 0) calculatedDisp = 0;
            if (calculatedDisp > 1) calculatedDisp = 1;
            disponibilidad = calculatedDisp;
        }

        const oee = disponibilidad * rendimiento;

        // Use direct hs_marcha_tis saved by operator form if available
        let rawHsMarcha = getSupabaseVal(row, "hs_marcha_tis");
        if (rawHsMarcha === null || rawHsMarcha === undefined || rawHsMarcha === "") rawHsMarcha = getSupabaseVal(row, "hs_marcha");
        if (rawHsMarcha === null || rawHsMarcha === undefined || rawHsMarcha === "") rawHsMarcha = getSupabaseVal(row, "horas_marcha");
        
        let hasExplicitHsMarcha = false;
        let explicitHsMarcha = 0;
        if (rawHsMarcha !== null && rawHsMarcha !== undefined && rawHsMarcha !== "") {
            explicitHsMarcha = parseNumber(rawHsMarcha);
            if (explicitHsMarcha > 0) {
                hasExplicitHsMarcha = true;
            }
        }
        
        if (!machineStats[maquinaId]) machineStats[maquinaId] = { bags: 0, tn: 0, name: maquinaHac };

        if (!detailsMap[key]) {
            detailsMap[key] = { 
                hsMarchaSum: 0, 
                hasExplicitHsMarcha: false,
                calculatedHsMarcha: 0,
                bagsSum: 0,
                count: 0,
                machineId: maquinaId,
                machineName: maquinaHac, // Display HAC (e.g. MG.672-PZ1)
                shift: turno,
                oeeSum: 0,
                dispSum: 0,
                rendSum: 0,
                valueTnSum: 0
            };
        }
        
        if (hasExplicitHsMarcha) {
            detailsMap[key].hasExplicitHsMarcha = true;
            detailsMap[key].hsMarchaSum = Math.max(detailsMap[key].hsMarchaSum, explicitHsMarcha);
        } else {
            detailsMap[key].calculatedHsMarcha = Math.max(detailsMap[key].calculatedHsMarcha, hsMarcha);
        }

        detailsMap[key].oeeSum += oee;
        detailsMap[key].dispSum += disponibilidad;
        detailsMap[key].rendSum += rendimiento;
        detailsMap[key].valueTnSum += tnHeader;
        detailsMap[key].count += 1;
    });

    const productionByShiftProductMap = new Map<string, { shift: string; product: string; tonnage: number }>();

    listaFiltrada.forEach(row => {
        const idCab = getSupabaseVal(row, "produccion_id");
        const bags = parseNumber(getSupabaseVal(row, "bolsas_producidas"));
        const tn = parseNumber(getSupabaseVal(row, "tn_producidas"));
        const material = String(getSupabaseVal(row, "descripcion_material") || "Otros").trim();
        
        const cabecera = cabeceraMap.get(String(idCab));
        if (!cabecera) return;

        const palId = getSupabaseVal(cabecera, "palletizadora_id");
        const palletizerRow = palId ? paletizadoraMap.get(String(palId)) : null;
        const maquinaId = palId ? String(palId) : (getSupabaseVal(cabecera, "palletizadora") || "Desconocida");
        const maquinaHac = palletizerRow ? (getSupabaseVal(palletizerRow, "hac_id") || getSupabaseVal(palletizerRow, "hac") || maquinaId) : (getSupabaseVal(cabecera, "hac_paletizadora") || maquinaId);

        const shiftId = getSupabaseVal(cabecera, "turno_id");
        const shiftRow = shiftId ? turnosMap.get(String(shiftId)) : null;
        const turno = getSupabaseVal(cabecera, "descripcion_turno") || (shiftRow ? getSupabaseVal(shiftRow, "name") : null) || "Sin Turno";
        const fecha = getSupabaseVal(cabecera, "fecha") || "Sin Fecha";
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

        if (!machineStats[maquinaId]) machineStats[maquinaId] = { bags: 0, tn: 0, name: maquinaHac };
        machineStats[maquinaId].bags += bags;
        machineStats[maquinaId].tn += tn;
        
        if (!machineProductMap[maquinaHac]) machineProductMap[maquinaHac] = {};
        if (!machineProductMap[maquinaHac][material]) machineProductMap[maquinaHac][material] = 0;
        machineProductMap[maquinaHac][material] += tn;

        // Group by shift and product in O(1)
        const shiftProdKey = `${turno}|${material}`;
        const existing = productionByShiftProductMap.get(shiftProdKey);
        if (existing) {
            existing.tonnage += tn;
        } else {
            productionByShiftProductMap.set(shiftProdKey, { shift: turno, product: material, tonnage: tn });
        }
    });

    const productionByShiftProduct = Array.from(productionByShiftProductMap.values());

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

    const byMachineProduct = Object.entries(machineProductMap).map(([name, products]) => ({
        name,
        ...products
    })).sort((a,b) => a.name.localeCompare(b.name));

    const details = Object.entries(detailsMap).map(([key, d]) => {
        const parts = key.split('|');
        const fecha = parts[parts.length - 1];
        
        const rawOee = d.count > 0 ? d.oeeSum / d.count : 0;
        const rawDisp = d.count > 0 ? d.dispSum / d.count : 0;
        const rawRend = d.count > 0 ? d.rendSum / d.count : 0;
        
        const finalHsMarcha = d.hasExplicitHsMarcha ? d.hsMarchaSum : d.calculatedHsMarcha;

        return {
            machineId: d.machineId,
            machineName: d.machineName,
            shift: d.shift,
            date: fecha,
            availability: rawDisp,
            performance: rawRend,
            quality: 1, 
            oee: rawOee,
            valueTn: d.valueTnSum,
            valueBags: d.bagsSum,
            hsMarcha: finalHsMarcha
        };
    });

    const result = {
        totalBags,
        totalTn,
        byShift,
        byMachine,
        byMachineProduct,
        details,
        productionByShiftProduct
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result, { headers: CACHE_HEADERS });

  } catch (error: any) {
    console.error("Production API Error produccionv2:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

