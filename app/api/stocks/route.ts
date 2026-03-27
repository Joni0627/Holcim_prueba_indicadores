
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// --- CACHÉ ---
const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function getVal(row: any, key: string) {
    return row.get(key) || row.get(key.toUpperCase()) || row.get(key.toLowerCase());
}

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleaned = dateStr.trim();
  let parts: string[] = [];
  if (cleaned.includes("/")) parts = cleaned.split("/");
  else if (cleaned.includes("-")) parts = cleaned.split("-");
  
  if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) {
          // YYYY-MM-DD
          [year, month, day] = parts.map(Number);
      } else {
          // DD/MM/YYYY
          [day, month, year] = parts.map(Number);
      }
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
  }
  return null;
}

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    if (str === '') return 0;
    
    // Formato LATAM: 1.200,50 -> 1200.50
    if (str.includes('.') && str.includes(',')) {
         str = str.replace(/\./g, ''); 
         str = str.replace(',', '.');
    } 
    else if (str.includes('.') && !str.includes(',')) {
         // Check if it's thousands or decimals
         if ((str.match(/\./g) || []).length > 1) {
             str = str.replace(/\./g, '');
         } else {
             // If it's something like 1.200, it's likely thousands in this context
             str = str.replace(/\./g, '');
         }
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
}

// Normalización robusta: Trim, Uppercase y Quitar Acentos (NFD)
function cleanName(str: string): string {
    return String(str || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing date params" }, { status: 400 });
    }

    const cacheKey = `stocks-${startParam}-${endParam}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
       return NextResponse.json(cachedEntry.data, {
           headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30', 'X-Cache': 'HIT-MEMORY' }
       });
    }

    const startDate = new Date(startParam + "T00:00:00");
    const endDate = new Date(endParam + "T23:59:59");

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) return NextResponse.json({});

    const authClient = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const doc = new GoogleSpreadsheet(sheetId, authClient);
    await doc.loadInfo();

    const sheetConteo = doc.sheetsByTitle["DETALLE CONTEO"];
    const sheetCabecera = doc.sheetsByTitle["PRODUCCION_CABECERA"];
    const sheetLista = doc.sheetsByTitle["PRODUCCION_LISTA"];

    if (!sheetConteo || !sheetCabecera || !sheetLista) {
        return NextResponse.json({ error: "Sheets missing" }, { status: 404 });
    }

    const [rowsConteo, rowsCabecera, rowsLista] = await Promise.all([
        sheetConteo.getRows(),
        sheetCabecera.getRows(),
        sheetLista.getRows()
    ]);

    // 1. OBTENER PRODUCION NOCHE
    const cabecerasNoche = rowsCabecera.filter(row => {
        const d = parseSheetDate(getVal(row, "fecha"));
        const turnoRaw = String(getVal(row, "turno") || "").trim().toUpperCase();
        // Lógica Estricta: "3.NOCHE" o empieza con "3."
        const isTurnoNoche = turnoRaw === "3.NOCHE" || turnoRaw.startsWith("3.");
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime() && isTurnoNoche;
    });

    const idsNoche = new Set(cabecerasNoche.map(r => getVal(r, "id_produccion")));

    // Mapa: Producto -> Tn Producidas en Noche
    const nightProductionMap: Record<string, number> = {};

    rowsLista.forEach(row => {
        if (idsNoche.has(getVal(row, "ID_CABECERA"))) {
            const material = cleanName(getVal(row, "DESCRIPCION_MATERIAL"));
            // Prioridad a TN_PRODUCIDA, fallback a tn/bdp
            const tn = parseNumber(getVal(row, "TN_PRODUCIDA") || getVal(row, "tn/bdp"));
            
            if (!nightProductionMap[material]) nightProductionMap[material] = 0;
            nightProductionMap[material] += tn;
        }
    });

    // 2. OBTENER CONTEO (SNAPSHOT)
    const conteosFiltrados = rowsConteo.filter(row => {
        const d = parseSheetDate(getVal(row, "FECHA"));
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    // LISTA EXACTA DE PRODUCTOS PRODUCIDOS (Normalizada: Sin acentos, Mayus)
    const PRODUCED_PRODUCTS = new Set([
        "CEMENTO MAESTRO",
        "CEMENTO CPF 40",
        "CEMENTO RAPIDO",
        "CEMENTO CPC 30"
    ]);

    const stockMap: Record<string, { displayName: string, qty: number, tn: number, isProduced: boolean, date: string }> = {};

    conteosFiltrados.forEach(row => {
        const productoOriginal = String(getVal(row, "PRODUCTO") || "").trim();
        const productoNorm = cleanName(productoOriginal);
        
        const cantidad = parseNumber(getVal(row, "CANTIDAD"));
        const tn = parseNumber(getVal(row, "TN"));
        const fecha = getVal(row, "FECHA");
        
        const isProduced = PRODUCED_PRODUCTS.has(productoNorm);
        
        if (!stockMap[productoNorm]) {
            stockMap[productoNorm] = { 
                displayName: productoOriginal, 
                qty: 0, 
                tn: 0, 
                isProduced, 
                date: fecha 
            };
        }
        stockMap[productoNorm].qty += cantidad;
        stockMap[productoNorm].tn += tn;
    });

    // 3. SUMAR PRODUCCIÓN NOCHE A LOS TOTALES (Solo una vez por producto)
    Object.keys(stockMap).forEach(productoNorm => {
        if (stockMap[productoNorm].isProduced) {
            const nightTn = nightProductionMap[productoNorm] || 0;
            stockMap[productoNorm].tn += nightTn;
            
            // También podríamos estimar bolsas si fuera necesario, 
            // pero el usuario pidió enfocarse en TN_PRODUCIDA.
            // Si 1 bolsa = 0.05 Tn, entonces nightBags = nightTn / 0.05
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
    console.error("Stocks API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
