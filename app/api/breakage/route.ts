import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAllRows, getSupabaseVal, parseSheetDate } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const CACHE_TTL = 60 * 1000; 
const cache = new Map<string, { data: any; timestamp: number }>();

const toSafeKey = (str: string) => `id_${str.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    let str = String(val).trim();
    if (str === '') return 0;

    if (str.includes('%')) {
        str = str.replace('%', '');
        if (str.includes('.') && str.includes(',')) {
             str = str.replace(/\./g, ''); 
             str = str.replace(',', '.'); 
        } else if (str.includes(',')) {
             str = str.replace(',', '.');
        }
        return parseFloat(str) / 100;
    }

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
    }
    else if (str.includes(',')) {
        str = str.replace(',', '.');
    }

    return parseFloat(str) || 0;
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

    const cacheKey = `breakage-v2-${startParam}-${endParam}`;
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

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    // Fetch from Supabase tables
    const [rowsCabecera, rowsLista] = await Promise.all([
        fetchAllRows("produccionv2"),
        fetchAllRows("detalles_produccionv2")
    ]);

    // Build cabecera map for quick lookup
    const cabeceraMap = new Map<string, any>();
    rowsCabecera.forEach(cab => {
        const id = getSupabaseVal(cab, "id");
        if (id) {
            cabeceraMap.set(String(id), cab);
        }
    });

    // MAP AND FILTER BY DATE
    const validRows: { row: any; date: Date }[] = [];
    rowsLista.forEach(row => {
        const prodId = getSupabaseVal(row, "produccion_id");
        const cabecera = cabeceraMap.get(String(prodId));
        if (!cabecera) return;
        
        const d = parseSheetDate(getSupabaseVal(cabecera, "fecha"));
        if (d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime()) {
            validRows.push({ row, date: d });
        }
    });

    let totalProduced = 0;
    
    let sumEnsacadora = 0;
    let sumNoEmboquillada = 0;
    let sumVentocheck = 0;
    let sumTransporte = 0;

    const providerStats: Record<string, { produced: number, broken: number }> = {};
    
    const materialStats: Record<string, { 
        produced: number, 
        broken: number, 
        sectors: {
            Ensacadora: number,
            NoEmboquillada: number,
            Ventocheck: number,
            Transporte: number
        }
    }> = {};
    
    const historyMap: Record<string, Record<string, { produced: number, broken: number }>> = {};

    validRows.forEach(({ row, date }) => {
        const produced = parseNumber(getSupabaseVal(row, "bolsas_producidas"));
        const providerRaw = getSupabaseVal(row, "proveedor_bolsa");
        const provider = providerRaw ? String(providerRaw).trim() : "Sin Proveedor";
        const providerSafeKey = toSafeKey(provider); 
        
        const materialRaw = getSupabaseVal(row, "descripcion_material");
        const material = materialRaw ? String(materialRaw).trim() : "Desconocido";

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const dateKey = `${day}/${month}`;

        // Breakage Columns from detalles_produccionv2
        const brkEnsacadora = parseNumber(getSupabaseVal(row, "bolsas_rech_ensacadora"));
        const brkNoEmb = parseNumber(getSupabaseVal(row, "bolsas_sin_boquilla"));
        const brkVento = parseNumber(getSupabaseVal(row, "bolsas_rech_ventocheck"));
        const brkTrans = parseNumber(getSupabaseVal(row, "bolsas_rech_transporte"));

        const rowTotalBroken = brkEnsacadora + brkNoEmb + brkVento + brkTrans;

        totalProduced += produced;
        sumEnsacadora += brkEnsacadora;
        sumNoEmboquillada += brkNoEmb;
        sumVentocheck += brkVento;
        sumTransporte += brkTrans;

        if (!providerStats[provider]) {
            providerStats[provider] = { produced: 0, broken: 0 };
        }
        providerStats[provider].produced += produced;
        providerStats[provider].broken += rowTotalBroken;

        if (!materialStats[material]) {
            materialStats[material] = { 
                produced: 0, 
                broken: 0,
                sectors: { Ensacadora: 0, NoEmboquillada: 0, Ventocheck: 0, Transporte: 0 }
            };
        }
        materialStats[material].produced += produced;
        materialStats[material].broken += rowTotalBroken;
        materialStats[material].sectors.Ensacadora += brkEnsacadora;
        materialStats[material].sectors.NoEmboquillada += brkNoEmb;
        materialStats[material].sectors.Ventocheck += brkVento;
        materialStats[material].sectors.Transporte += brkTrans;

        if (!historyMap[dateKey]) historyMap[dateKey] = {};
        if (!historyMap[dateKey][providerSafeKey]) historyMap[dateKey][providerSafeKey] = { produced: 0, broken: 0 };
        historyMap[dateKey][providerSafeKey].produced += produced;
        historyMap[dateKey][providerSafeKey].broken += rowTotalBroken;
    });

    const totalBroken = sumEnsacadora + sumNoEmboquillada + sumVentocheck + sumTransporte;
    
    const history = Object.entries(historyMap).map(([date, providers]) => {
        const item: any = { date };
        Object.entries(providers).forEach(([safeProv, stats]) => {
             const rate = stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0;
             item[safeProv] = parseFloat(rate.toFixed(2));
        });
        return item;
    });

    history.sort((a, b) => {
        const [da, ma] = a.date.split('/').map(Number);
        const [db, mb] = b.date.split('/').map(Number);
        if (ma !== mb) return ma - mb;
        return da - db;
    });

    const result = {
        totalProduced,
        totalBroken,
        globalRate: totalProduced > 0 ? (totalBroken / totalProduced) * 100 : 0,
        bySector: [
            { name: "Ensacadora", value: sumEnsacadora, percentage: totalBroken > 0 ? (sumEnsacadora / totalBroken) * 100 : 0 },
            { name: "No Emboquillada", value: sumNoEmboquillada, percentage: totalBroken > 0 ? (sumNoEmboquillada / totalBroken) * 100 : 0 },
            { name: "Ventocheck", value: sumVentocheck, percentage: totalBroken > 0 ? (sumVentocheck / totalBroken) * 100 : 0 },
            { name: "Transporte", value: sumTransporte, percentage: totalBroken > 0 ? (sumTransporte / totalBroken) * 100 : 0 },
        ].filter(s => s.value > 0), 
        
        byProvider: Object.entries(providerStats).map(([name, stats]) => ({
            id: toSafeKey(name), 
            name, 
            produced: stats.produced,
            broken: stats.broken,
            rate: stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0
        })).sort((a,b) => b.rate - a.rate),
        
        byMaterial: Object.entries(materialStats).map(([name, stats]) => ({
            id: toSafeKey(name), 
            name,
            produced: stats.produced,
            broken: stats.broken,
            rate: stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0,
            sector_Ensacadora: stats.sectors.Ensacadora,
            sector_NoEmboquillada: stats.sectors.NoEmboquillada,
            sector_Ventocheck: stats.sectors.Ventocheck,
            sector_Transporte: stats.sectors.Transporte
        })).sort((a,b) => b.rate - a.rate),
        
        history 
    };

    cache.set(cacheKey, { data: result, timestamp: now });

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
            'X-Cache': 'MISS'
        }
    });

  } catch (error: any) {
    console.error("Breakage API Error detalles_produccionv2:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
