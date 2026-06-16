import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const CACHE_TTL = 30 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    if (str.includes(',')) str = str.replace(',', '.');
    return parseFloat(str) || 0;
}

function hmsToMinutes(hms: string | null | undefined): number {
  if (!hms) return 0;
  if (typeof hms === "number") return hms;
  if (typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(hms) || 0;
}

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start"); 
    const endParam = searchParams.get("end");
    const filterOpParam = searchParams.get("operators");
    const filterTypeParam = searchParams.get("types");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    const cacheKey = `rankings-v2-${startParam}-${endParam}-${filterOpParam || 'all'}-${filterTypeParam || 'all'}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data);
    }

    const filterOperators = filterOpParam ? filterOpParam.split(",").map(s => s.trim().toLowerCase()) : null;
    const filterTypes = filterTypeParam ? filterTypeParam.split(",").map(s => s.trim().toLowerCase()) : null;

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");
    const productionFilterDate = new Date("2025-12-01T00:00:00");

    // Fetch from Supabase tables
    const [rowsCabecera, rowsParos] = await Promise.all([
        fetchAllRows("produccionv2"),
        fetchAllRows("parosv2")
    ]);

    // --- PRODUCTION RANKINGS ---
    const prodByOperator: Record<string, number> = {};
    const prodByPalletizer: Record<string, number> = {};

    let prodRecordCount = 0;
    rowsCabecera.forEach(row => {
        const d = parseSheetDate(getSupabaseVal(row, "fecha"));
        if (!d || d < productionFilterDate) return;
        if (d < startDate || d > endDate) return;

        prodRecordCount++;
        const tn = parseNumber(getSupabaseVal(row, "tn_producidas"));
        const maquinistaId = String(getSupabaseVal(row, "id_maquinista") || "").trim();
        const palletizer = String(getSupabaseVal(row, "hac_paletizadora") || getSupabaseVal(row, "palletizadora") || "Desconocida").trim();

        const operatorName = getSupabaseVal(row, "descripcion_maquinista") || `ID: ${maquinistaId}`;
        prodByOperator[operatorName] = (prodByOperator[operatorName] || 0) + tn;
        prodByPalletizer[palletizer] = (prodByPalletizer[palletizer] || 0) + tn;
    });

    // --- DOWNTIME RANKINGS ---
    const parosByOperator: Record<string, { duration: number; count: number }> = {};
    const parosByMachine: Record<string, { duration: number; count: number }> = {};
    const parosByCause: Record<string, { duration: number; count: number }> = {};
    const parosByEquipment: Record<string, { duration: number; count: number }> = {};
    const parosByType: Record<string, { duration: number; count: number }> = {};
    
    const availableOps = new Set<string>();
    const availableTypes = new Set<string>();

    const combOpMach: Record<string, { duration: number; count: number }> = {};
    const combMachCause: Record<string, { duration: number; count: number }> = {};
    const combEquipCause: Record<string, { duration: number; count: number }> = {};
    const combOpEquip: Record<string, { duration: number; count: number }> = {};

    rowsParos.forEach(row => {
        const d = parseSheetDate(getSupabaseVal(row, "fecha"));
        if (!d || d < startDate || d > endDate) return;

        const duration = hmsToMinutes(getSupabaseVal(row, "duracion") || getSupabaseVal(row, "duración") || getSupabaseVal(row, "duration_minutes"));
        const machine = String(getSupabaseVal(row, "maquina_afectada") || getSupabaseVal(row, "máquina afectada") || "Desconocida").trim();
        const userRed = String(getSupabaseVal(row, "usuario") || "").trim();
        const cause = String(getSupabaseVal(row, "texto_de_causa") || getSupabaseVal(row, "texto de causa") || "Sin Causa").trim();
        const equipment = String(getSupabaseVal(row, "detalle_hac") || getSupabaseVal(row, "detalle hac") || "Sin Detalle").trim();
        const typeP = String(getSupabaseVal(row, "tipo_paro") || getSupabaseVal(row, "tipo paro") || "Sin Tipo").trim();

        const operatorName = getSupabaseVal(row, "operator_name") || getSupabaseVal(row, "operatorName") || userRed || "Desconocido";

        availableOps.add(operatorName);
        availableTypes.add(typeP);

        if (filterOperators && !filterOperators.includes(operatorName.toLowerCase())) return;
        if (filterTypes && !filterTypes.includes(typeP.toLowerCase())) return;

        const update = (map: any, key: string) => {
            if (!map[key]) map[key] = { duration: 0, count: 0 };
            map[key].duration += duration;
            map[key].count += 1;
        };

        update(parosByOperator, operatorName);
        update(parosByMachine, machine);
        update(parosByCause, cause);
        update(parosByEquipment, equipment);
        update(parosByType, typeP);

        update(combOpMach, `${operatorName} @ ${machine}`);
        update(combMachCause, `${machine} -> ${cause}`);
        update(combEquipCause, `${equipment} -> ${cause}`);
        update(combOpEquip, `${operatorName} & ${equipment}`);
    });

    const formatRank = (map: any) => Object.entries(map).map(([name, val]: [string, any]) => ({ name, ...val }));
    const formatProdRank = (map: any) => Object.entries(map).map(([name, value]: [string, any]) => ({ name, value }));

    const prodRankings = {
        byOperator: formatProdRank(prodByOperator).sort((a,b) => b.value - a.value),
        byPalletizer: formatProdRank(prodByPalletizer).sort((a,b) => b.value - a.value),
    };

    const downRankings = {
        byOperator: formatRank(parosByOperator).sort((a,b) => b.duration - a.duration),
        byMachine: formatRank(parosByMachine).sort((a,b) => b.duration - a.duration),
        byCause: formatRank(parosByCause).sort((a,b) => b.duration - a.duration),
        byEquipment: formatRank(parosByEquipment).sort((a,b) => b.duration - a.duration),
        byType: formatRank(parosByType).sort((a,b) => b.duration - a.duration),
        combinations: {
            operatorMachine: formatRank(combOpMach).sort((a,b) => b.duration - a.duration),
            machineCause: formatRank(combMachCause).sort((a,b) => b.duration - a.duration),
            equipmentCause: formatRank(combEquipCause).sort((a,b) => b.duration - a.duration),
            operatorEquipment: formatRank(combOpEquip).sort((a,b) => b.duration - a.duration),
        }
    };

    const totalProdTN = prodRankings.byOperator.reduce((acc, curr) => acc + curr.value, 0);
    const totalDownDuration = downRankings.byOperator.reduce((acc, curr) => acc + curr.duration, 0);
    const totalDownCount = downRankings.byOperator.reduce((acc, curr) => acc + curr.count, 0);

    const sortedByCount = {
        byCause: [...downRankings.byCause].sort((a,b) => b.count - a.count),
        byEquipment: [...downRankings.byEquipment].sort((a,b) => b.count - a.count),
        byOperator: [...downRankings.byOperator].sort((a,b) => b.count - a.count),
        byMachine: [...downRankings.byMachine].sort((a,b) => b.count - a.count),
    };

    const result = {
        summary: {
            production: {
                totalTN: totalProdTN,
                topOperator: prodRankings.byOperator[0]?.name || "N/A",
                topPalletizer: prodRankings.byPalletizer[0]?.name || "N/A",
                avgTN: prodRankings.byOperator.length ? totalProdTN / prodRankings.byOperator.length : 0,
                recordCount: prodRecordCount
            },
            downtime: {
                totalDuration: totalDownDuration,
                totalCount: totalDownCount,
                mostFreqCause: sortedByCount.byCause[0]?.name || "N/A",
                mostFreqEquipment: sortedByCount.byEquipment[0]?.name || "N/A",
                topOperator: sortedByCount.byOperator[0]?.name || "N/A",
                topMachine: sortedByCount.byMachine[0]?.name || "N/A"
            }
        },
        productionRankings: prodRankings,
        downtimeRankings: downRankings,
        availableFilters: {
            operators: Array.from(availableOps).sort(),
            downtimeTypes: Array.from(availableTypes).sort()
        }
    };

    cache.set(cacheKey, { data: result, timestamp: now });
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Rankings API Error rankings-v2:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
