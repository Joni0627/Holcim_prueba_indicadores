
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
         // Asumimos miles si es grande, pero stock puede ser cualquier cosa.
         // En este contexto, eliminamos punto de miles.
         str = str.replace(/\./g, '');
    } else if (str.includes(',')) {
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
    // Filtramos cabeceras que sean del rango Y que sean específicamente "3.NOCHE"
    const cabecerasNoche = rowsCabecera.filter(row => {
        const d = parseSheetDate(row.get("fecha"));
        const turnoRaw = String(row.get("turno") || "").trim().toUpperCase();
        
        // Lógica Estricta: Debe ser "3.NOCHE" o empezar con "3."
        // Esto excluye "4.NOCHE FIN"
        const isTurnoNoche = turnoRaw === "3.NOCHE" || turnoRaw.startsWith("3.");
        
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime() && isTurnoNoche;
    });

    const idsNoche = new Set(cabecerasNoche.map(r => r.get("id_produccion")));

    // Mapa: Producto -> Tn Producidas en Noche
    const nightProductionMap: Record<string, number> = {};

    rowsLista.forEach(row => {
        if (idsNoche.has(row.get("ID_CABECERA"))) {
            const material = String(row.get("DESCRIPCION_MATERIAL") || "").trim();
            const tn = parseNumber(row.get("tn/bdp") || row.get("TN_PRODUCIDA")); // Usar columna de TN disponible
            
            if (!nightProductionMap[material]) nightProductionMap[material] = 0;
            nightProductionMap[material] += tn;
        }
    });

    // 2. OBTENER CONTEO (SNAPSHOT)
    // Filtramos conteos del rango
    const conteosFiltrados = rowsConteo.filter(row => {
        const d = parseSheetDate(row.get("FECHA"));
        return d && d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
    });

    const PRODUCED_MATERIALS = [
        'Cemento CPF 40',
        'Cemento CPF 30',
        'Cemento Rápido',
        'Cemento Maestro'
    ];

    // Mapa final de stock
    const stockMap: Record<string, { qty: number, tn: number, isProduced: boolean, date: string }> = {};

    conteosFiltrados.forEach(row => {
        const producto = String(row.get("PRODUCTO") || "").trim();
        const cantidad = parseNumber(row.get("CANTIDAD"));
        let tn = parseNumber(row.get("TN"));
        const fecha = row.get("FECHA");

        // Identificar si es uno de los producidos
        const isProduced = PRODUCED_MATERIALS.some(pm => producto.includes(pm) || pm.includes(producto));
        
        // Si es producido, SUMAR la producción de la noche
        if (isProduced) {
            // Intentar matchear nombre exacto o aproximado
            const nightProdKey = Object.keys(nightProductionMap).find(k => k.includes(producto) || producto.includes(k));
            if (nightProdKey) {
                const addedTn = nightProductionMap[nightProdKey];
                tn += addedTn;
            }
        }

        if (!stockMap[producto]) {
            stockMap[producto] = { qty: 0, tn: 0, isProduced, date: fecha };
        }
        stockMap[producto].qty += cantidad;
        stockMap[producto].tn += tn;
    });

    const items = Object.entries(stockMap).map(([product, stats], idx) => ({
        id: `stk-${idx}`,
        product,
        quantity: stats.qty,
        tonnage: stats.tn,
        isProduced: stats.isProduced,
        lastUpdated: stats.date
    }));

    // Ordenar: Producidos primero, luego alfabético
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
