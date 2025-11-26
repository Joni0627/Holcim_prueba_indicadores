import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// --- CONFIGURACIÓN DE CACHÉ ---
const CACHE_TTL = 60 * 1000; // 60 segundos
const cache = new Map<string, { data: any; timestamp: number }>();

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
    if (str === '') return 0;
    // Remove % if exists and handle comma decimal
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

    // 1. CACHÉ CHECK
    const cacheKey = `breakage-${startParam}-${endParam}`;
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

    // Env Vars
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) return NextResponse.json({});

    const auth = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["PRODUCCION_LISTA"];
    if (!sheet) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });

    const rows = await sheet.getRows();

    // FILTER BY DATE
    const filteredRows = rows.filter(row => {
        const d = parseSheetDate(row.get("FECHA"));
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    // AGGREGATION LOGIC
    let totalProduced = 0;
    
    // Sector Counters
    let sumEnsacadora = 0;
    let sumNoEmboquillada = 0;
    let sumVentocheck = 0;
    let sumTransporte = 0;

    // Aggregation Maps
    const providerStats: Record<string, { produced: number, broken: number }> = {};
    
    // Material Stats needs sector breakdown
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
    
    // History Map: date -> provider -> {produced, broken}
    const historyMap: Record<string, Record<string, { produced: number, broken: number }>> = {};

    filteredRows.forEach(row => {
        const produced = parseNumber(row.get("BOLSAS PRODUCIDAS"));
        const provider = row.get("DESCRIPCION_PROVEEDOR") || "Sin Proveedor";
        const material = row.get("DESCRIPCION_MATERIAL") || "Desconocido";
        const dateStr = row.get("FECHA")?.substring(0, 5) || "N/A"; // DD/MM

        // Breakage Columns
        const brkEnsacadora = parseNumber(row.get("BOLSAS DESCARTADAS_ENSACADORA"));
        const brkNoEmb = parseNumber(row.get("BOLSAS DESCARTADAS_NO_EMBOQUILLADA"));
        const brkVento = parseNumber(row.get("BOLSAS_DESCARTADAS_VENTOCHECK"));
        const brkTrans = parseNumber(row.get("BOLSAS_DESCARTADAS_TRANSPORTE"));

        const rowTotalBroken = brkEnsacadora + brkNoEmb + brkVento + brkTrans;

        // Global Sums
        totalProduced += produced;
        sumEnsacadora += brkEnsacadora;
        sumNoEmboquillada += brkNoEmb;
        sumVentocheck += brkVento;
        sumTransporte += brkTrans;

        // Provider Logic
        if (!providerStats[provider]) {
            providerStats[provider] = { produced: 0, broken: 0 };
        }
        providerStats[provider].produced += produced;
        providerStats[provider].broken += rowTotalBroken;

        // Material Logic with Sector Breakdown
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


        // History Logic
        if (!historyMap[dateStr]) historyMap[dateStr] = {};
        if (!historyMap[dateStr][provider]) historyMap[dateStr][provider] = { produced: 0, broken: 0 };
        historyMap[dateStr][provider].produced += produced;
        historyMap[dateStr][provider].broken += rowTotalBroken;
    });

    const totalBroken = sumEnsacadora + sumNoEmboquillada + sumVentocheck + sumTransporte;
    
    // Construct History Array
    const history = Object.entries(historyMap).map(([date, providers]) => {
        const item: any = { date };
        Object.entries(providers).forEach(([prov, stats]) => {
             const rate = stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0;
             item[prov] = parseFloat(rate.toFixed(2));
        });
        return item;
    });

    // Sort history by date
    history.sort((a, b) => {
        const [da, ma] = a.date.split('/').map(Number);
        const [db, mb] = b.date.split('/').map(Number);
        if (ma !== mb) return ma - mb;
        return da - db;
    });

    // Construct Response
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
            name,
            produced: stats.produced,
            broken: stats.broken,
            rate: stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0
        })).sort((a,b) => b.rate - a.rate),
        byMaterial: Object.entries(materialStats).map(([name, stats]) => ({
            name,
            produced: stats.produced,
            broken: stats.broken,
            rate: stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0,
            sectors: stats.sectors // Include sector breakdown
        })).sort((a,b) => b.rate - a.rate),
        history 
    };

    // 2. SET CACHE
    cache.set(cacheKey, { data: result, timestamp: now });

    // 3. RETURN
    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
            'X-Cache': 'MISS'
        }
    });

  } catch (error: any) {
    console.error("Breakage API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
