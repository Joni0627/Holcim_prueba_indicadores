
import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// --- CONFIGURACIÓN DE CACHÉ ---
const CACHE_TTL = 60 * 1000; // 60 segundos
const cache = new Map<string, { data: any; timestamp: number }>();

// Helper to generate safe keys for Recharts (replace dots, spaces, special chars)
// PREPEND 'id_' to ensure it doesn't start with a number (e.g. "3M") which breaks Recharts
const toSafeKey = (str: string) => `id_${str.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleaned = dateStr.trim();
  
  // Try split by slash
  if (cleaned.includes('/')) {
      const parts = cleaned.split("/");
      if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          const fullYear = year < 100 ? 2000 + year : year;
          return new Date(fullYear, month - 1, day);
      }
  }
  
  // Try split by dash
  if (cleaned.includes('-')) {
      const parts = cleaned.split("-");
      // Check if it is YYYY-MM-DD or DD-MM-YYYY
      if (parts[0].length === 4) {
           return new Date(cleaned + "T12:00:00");
      } else {
           const [day, month, year] = parts.map(Number);
           const fullYear = year < 100 ? 2000 + year : year;
           return new Date(fullYear, month - 1, day);
      }
  }

  return null;
}

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    let str = String(val).trim();
    if (str === '') return 0;

    // Manejo de Porcentajes
    if (str.includes('%')) {
        str = str.replace('%', '');
        // Si tiene punto de miles y coma decimal (ej: 1.200,50%)
        if (str.includes('.') && str.includes(',')) {
             str = str.replace(/\./g, ''); // Quitar miles
             str = str.replace(',', '.'); // Cambiar coma a punto
        } else if (str.includes(',')) {
             str = str.replace(',', '.');
        }
        return parseFloat(str) / 100;
    }

    // Manejo de Números (Cantidades)
    // Formato LATAM: 1.200,50 (Punto para miles, Coma para decimales)
    // Formato US: 1,200.50
    
    // Si contiene puntos y comas, asumimos formato LATAM o mixto complejo.
    // Estrategia segura: Eliminar puntos (miles), reemplazar coma por punto.
    if (str.includes('.') && str.includes(',')) {
         str = str.replace(/\./g, ''); // Quitar puntos de miles
         str = str.replace(',', '.');  // Reemplazar coma decimal
    } 
    // Si solo tiene puntos (ej: 1.200), asumimos que es mil si son 3 digitos tras el punto, 
    // pero es arriesgado. En este contexto industrial, 1.200 suele ser mil doscientos.
    else if (str.includes('.') && !str.includes(',')) {
         // Verificamos si parece un decimal o un millar.
         // Si hay más de un punto, son miles seguro (1.000.000)
         if ((str.match(/\./g) || []).length > 1) {
             str = str.replace(/\./g, '');
         } else {
             // Caso difícil: 1.200 (1200) vs 1.5 (1.5)
             // Asumiremos que si viene de SAP/Excel Latam, el punto es miles
             // SIEMPRE que no sea un número pequeño lógico (ej < 100 podria ser decimal)
             // Para seguridad en roturas (bolsas), eliminamos el punto.
             str = str.replace(/\./g, '');
         }
    }
    // Si solo tiene coma (1200,50)
    else if (str.includes(',')) {
        str = str.replace(',', '.');
    }

    return parseFloat(str) || 0;
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

    // FILTER BY DATE AND PREPARE DATA
    const validRows = rows.map(row => {
        const d = parseSheetDate(row.get("FECHA"));
        return { row, date: d };
    }).filter(item => {
        return item.date && item.date.getTime() >= startDate.getTime() && item.date.getTime() <= endDate.getTime();
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
    
    // Internal Material Stats (to be flattened later)
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
    
    // History Map: dateString -> SAFE_PROVIDER_KEY -> {produced, broken}
    const historyMap: Record<string, Record<string, { produced: number, broken: number }>> = {};

    validRows.forEach(({ row, date }) => {
        const produced = parseNumber(row.get("BOLSAS PRODUCIDAS"));
        const providerRaw = row.get("DESCRIPCION_PROVEEDOR");
        const provider = providerRaw ? String(providerRaw).trim() : "Sin Proveedor";
        const providerSafeKey = toSafeKey(provider); // SANITIZED KEY (e.g., id_3M, id_FABRICA_S_A)
        
        const materialRaw = row.get("DESCRIPCION_MATERIAL");
        const material = materialRaw ? String(materialRaw).trim() : "Desconocido";

        // Generate consistent date key DD/MM
        const day = date!.getDate().toString().padStart(2, '0');
        const month = (date!.getMonth() + 1).toString().padStart(2, '0');
        const dateKey = `${day}/${month}`;

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


        // History Logic (Using SAFE KEY)
        if (!historyMap[dateKey]) historyMap[dateKey] = {};
        if (!historyMap[dateKey][providerSafeKey]) historyMap[dateKey][providerSafeKey] = { produced: 0, broken: 0 };
        historyMap[dateKey][providerSafeKey].produced += produced;
        historyMap[dateKey][providerSafeKey].broken += rowTotalBroken;
    });

    const totalBroken = sumEnsacadora + sumNoEmboquillada + sumVentocheck + sumTransporte;
    
    // Construct History Array
    const history = Object.entries(historyMap).map(([date, providers]) => {
        const item: any = { date };
        Object.entries(providers).forEach(([safeProv, stats]) => {
             // Calculate percentage rate
             const rate = stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0;
             item[safeProv] = parseFloat(rate.toFixed(2));
        });
        return item;
    });

    // Sort history by date (Day/Month)
    history.sort((a, b) => {
        const [da, ma] = a.date.split('/').map(Number);
        const [db, mb] = b.date.split('/').map(Number);
        if (ma !== mb) return ma - mb;
        return da - db;
    });

    // Construct Response with Safe IDs and Flattened structures
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
            id: toSafeKey(name), // Safe ID for charts (e.g. id_3M)
            name, // Real name for display
            produced: stats.produced,
            broken: stats.broken,
            rate: stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0
        })).sort((a,b) => b.rate - a.rate),
        
        byMaterial: Object.entries(materialStats).map(([name, stats]) => ({
            id: toSafeKey(name), // Safe ID
            name,
            produced: stats.produced,
            broken: stats.broken,
            rate: stats.produced > 0 ? (stats.broken / stats.produced) * 100 : 0,
            // FLATTENED SECTORS for Stacked Bar Chart compatibility
            sector_Ensacadora: stats.sectors.Ensacadora,
            sector_NoEmboquillada: stats.sectors.NoEmboquillada,
            sector_Ventocheck: stats.sectors.Ventocheck,
            sector_Transporte: stats.sectors.Transporte
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
