
import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// --- CACHÉ ---
const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleaned = dateStr.trim();
  if (cleaned.includes('/')) {
      const parts = cleaned.split("/");
      if (parts.length === 3) {
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
    // Formato LATAM: 1.200,50
    if (str.includes('.') && str.includes(',')) {
         str = str.replace(/\./g, ''); 
         str = str.replace(',', '.');
    } else if (str.includes('.') && !str.includes(',')) {
         str = str.replace(/\./g, '');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
}

// Normalización simple: Trim y Uppercase para comparar
function cleanName(str: string): string {
    return String(str || "").trim().toUpperCase();
}

export async function GET(req: Request) {
  try {
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

    const auth = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const doc = new GoogleSpreadsheet(sheetId, auth);
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

    // 1. OBTENER PRODUCION NOCHE DE LA FECHA SELECCIONADA
    const cabecerasNoche = rowsCabecera.filter(row => {
        const d = parseSheetDate(row.get("fecha"));
        const turnoRaw = String(row.get("turno") || "").trim().toUpperCase();
        // Lógica Estricta: "3.NOCHE"
        const isTurnoNoche = turnoRaw === "3.NOCHE" || turnoRaw.startsWith("3.");
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime() && isTurnoNoche;
    });

    const idsNoche = new Set(cabecerasNoche.map(r => r.get("id_produccion")));

    // Mapa: Producto -> Tn Producidas en Noche
    const nightProductionMap: Record<string, number> = {};

    rowsLista.forEach(row => {
        if (idsNoche.has(row.get("ID_CABECERA"))) {
            const material = cleanName(row.get("DESCRIPCION_MATERIAL"));
            const tn = parseNumber(row.get("tn/bdp") || row.get("TN_PRODUCIDA"));
            
            if (!nightProductionMap[material]) nightProductionMap[material] = 0;
            nightProductionMap[material] += tn;
        }
    });

    // 2. OBTENER CONTEO (SNAPSHOT)
    const conteosFiltrados = rowsConteo.filter(row => {
        const d = parseSheetDate(row.get("FECHA"));
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    // LISTA EXACTA DE PRODUCTOS PRODUCIDOS EN PLANTA
    const PRODUCED_PRODUCTS = new Set([
        "CEMENTO MAESTRO",
        "CEMENTO CPF 40",
        "CEMENTO RAPIDO",
        "CEMENTO CPF 30"
    ]);

    const stockMap: Record<string, { qty: number, tn: number, isProduced: boolean, date: string }> = {};

    conteosFiltrados.forEach(row => {
        const productoOriginal = String(row.get("PRODUCTO") || "").trim();
        const productoNorm = cleanName(productoOriginal);
        
        const cantidad = parseNumber(row.get("CANTIDAD"));
        let tn = parseNumber(row.get("TN"));
        const fecha = row.get("FECHA");
        
        // Verificamos si está en la lista exacta de producidos
        // Usamos includes parcial SOLO si estamos seguros que no machea Envases
        // Pero dado que tenemos la lista exacta, usamos coincidencia exacta o startsWith seguro.
        // Como el usuario dijo que los nombres son identicos, usamos el Set.
        
        // Corrección: A veces hay espacios extra, cleanName ya los quitó.
        // Hacemos una verificación extra por si acaso "CEMENTO CPF 40 " vs "CEMENTO CPF 40"
        let isProduced = PRODUCED_PRODUCTS.has(productoNorm);
        
        // Si es producido, sumamos la producción noche correspondiente
        if (isProduced) {
            const nightTn = nightProductionMap[productoNorm] || 0;
            tn += nightTn;
        }

        if (!stockMap[productoOriginal]) {
            stockMap[productoOriginal] = { qty: 0, tn: 0, isProduced, date: fecha };
        }
        stockMap[productoOriginal].qty += cantidad;
        stockMap[productoOriginal].tn += tn;
    });

    const items = Object.entries(stockMap).map(([product, stats], idx) => ({
        id: `stk-${idx}`,
        product,
        quantity: stats.qty,
        tonnage: stats.tn,
        isProduced: stats.isProduced,
        lastUpdated: stats.date
    }));

    // Ordenar
    items.sort((a, b) => {
        if (a.isProduced && !b.isProduced) return -1;
        if (!a.isProduced && b.isProduced) return 1;
        return a.product.localeCompare(b.product);
    });

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
