import { createClient } from "@supabase/supabase-js";

let supabaseUrl = (process.env.SUPABASE_URL || "").trim();
let supabaseKey = (process.env.SUPABASE_KEY || "").trim();

// Clean quotes if any
if (supabaseUrl.startsWith('"') && supabaseUrl.endsWith('"')) {
    supabaseUrl = supabaseUrl.slice(1, -1).trim();
} else if (supabaseUrl.startsWith("'") && supabaseUrl.endsWith("'")) {
    supabaseUrl = supabaseUrl.slice(1, -1).trim();
}

if (supabaseKey.startsWith('"') && supabaseKey.endsWith('"')) {
    supabaseKey = supabaseKey.slice(1, -1).trim();
} else if (supabaseKey.startsWith("'") && supabaseKey.endsWith("'")) {
    supabaseKey = supabaseKey.slice(1, -1).trim();
}

// Clean trailing /v1/, /v1, /rest/v1/ or /rest/v1 or just premium path trails that ruin client routing
if (supabaseUrl) {
    supabaseUrl = supabaseUrl.replace(/\/+$/, "");
    if (supabaseUrl.endsWith("/v1")) {
        supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 3);
    }
    if (supabaseUrl.endsWith("/rest")) {
        supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 5);
    }
    supabaseUrl = supabaseUrl.replace(/\/+$/, "");
}

// Initialize client silently
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * Robust helper function to fetch all rows using the requested page chunk mechanism
 * of size 1000 with a range(from, to) loop. Includes an automatic self-healing fallback
 * for spelling variations or versions of standard tables (e.g. inventario_fisico vs inventario_fisicov2)
 */
export async function fetchAllRows(tableName: string): Promise<any[]> {
    if (!supabase) {
        console.error(`Supabase Client not initialized. Cannot fetch table: ${tableName}`);
        return [];
    }
    
    // Determine possible fallback table name to avoid PGRST errors due to different DB schemas
    let alternateTableName: string | null = null;
    if (tableName === "inventario_fisico") {
        alternateTableName = "inventario_fisicov2";
    } else if (tableName === "inventario_fisicov2") {
        alternateTableName = "inventario_fisico";
    } else if (tableName === "inventario") {
        alternateTableName = "inventariov2";
    } else if (tableName === "inventariov2") {
        alternateTableName = "inventario";
    }

    async function tryFetch(nameToTry: string): Promise<{ success: boolean; data?: any[]; error?: any }> {
        const allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        try {
            while (hasMore) {
                const to = from + pageSize - 1;
                const { data, error } = await supabase!
                    .from(nameToTry)
                    .select("*")
                    .range(from, to);
                    
                if (error) {
                    return { success: false, error };
                }
                
                if (data && data.length > 0) {
                    allRows.push(...data);
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        from += pageSize;
                    }
                } else {
                    hasMore = false;
                }
            }
            return { success: true, data: allRows };
        } catch (catchErr: any) {
            return { success: false, error: catchErr };
        }
    }

    console.log(`[Supabase] Starting paginated load for table: ${tableName}`);
    let result = await tryFetch(tableName);

    // If initial fetch failed, and we have an alternate table name, try that too
    if (!result.success && alternateTableName) {
        console.warn(`[Supabase] Table ${tableName} returned warning/error code ${result.error?.code || 'unknown'}. Retrying with alternate table name: ${alternateTableName}...`);
        const altResult = await tryFetch(alternateTableName);
        if (altResult.success) {
            console.log(`[Supabase] Successfully loaded fallback table: ${alternateTableName}`);
            result = altResult;
        } else {
            console.error(`[Supabase] Failed loading both ${tableName} and fallback ${alternateTableName}`);
        }
    }

    if (result.success && result.data) {
        console.log(`[Supabase] Succeeded loading table data. Total rows: ${result.data.length}`);
        return result.data;
    }
    
    return [];
}

/**
 * Defensive utility to retrieve key value dynamically regardless of lowercase/uppercase/snake_case formatting
 */
export function getSupabaseVal(row: any, key: string): any {
    if (!row) return undefined;
    const cleanKey = key.trim().toLowerCase();
    
    if (row[key] !== undefined) return row[key];
    if (row[cleanKey] !== undefined) return row[cleanKey];
    
    const upperKey = key.trim().toUpperCase();
    if (row[upperKey] !== undefined) return row[upperKey];
    
    const snakeKey = cleanKey.replace(/\s+/g, '_');
    if (row[snakeKey] !== undefined) return row[snakeKey];
    
    const normalizedKey = cleanKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (row[normalizedKey] !== undefined) return row[normalizedKey];
    
    const normalizedSnakeKey = normalizedKey.replace(/\s+/g, '_');
    if (row[normalizedSnakeKey] !== undefined) return row[normalizedSnakeKey];
    
    // Custom synonyms fallback
    if (cleanKey === "idparo" && row["id"] !== undefined) return row["id"];
    if (cleanKey === "id_produccion" && row["id"] !== undefined) return row["id"];
    if (cleanKey === "turno" && row["descripcion_turno"] !== undefined) return row["descripcion_turno"];
    if (cleanKey === "maquinista" && row["id_maquinista"] !== undefined) return row["id_maquinista"];
    
    return undefined;
}

/**
 * Robust helper to parse different date formats safely:
 * - Date objects
 * - Excel serial numbers (numbers)
 * - ISO timestamps (e.g. "2025-11-20T00:00:00")
 * - Simple dash or slash formats (e.g. "2025-11-20" or "20/11/2025")
 */
export function parseSheetDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  if (typeof dateStr === "number") {
    return new Date((dateStr - 25569) * 86400 * 1000);
  }
  
  const cleaned = String(dateStr).trim();
  if (!cleaned) return null;

  // Extract date portion (up to space or 'T') to parse consistently as a local date
  let datePart = cleaned;
  if (cleaned.includes("T")) {
    datePart = cleaned.split("T")[0].trim();
  } else if (cleaned.includes(" ")) {
    datePart = cleaned.split(" ")[0].trim();
  }

  // 2. Handle DD/MM/YYYY or YYYY-MM-DD manually to avoid timezone shift
  let parts: string[] = [];
  if (datePart.includes("/")) {
    parts = datePart.split("/");
  } else if (datePart.includes("-")) {
    parts = datePart.split("-");
  }

  if (parts.length === 3) {
    let day = 1;
    let month = 1;
    let year = 2025;
    
    const cleanPart0 = parts[0].split(/[ T]/)[0].trim();
    const cleanPart2 = parts[2].split(/[ T]/)[0].trim();

    if (cleanPart0.length === 4) {
      year = Number(cleanPart0);
      month = Number(parts[1]);
      day = Number(cleanPart2);
    } else {
      day = Number(cleanPart0);
      month = Number(parts[1]);
      year = Number(cleanPart2);
    }

    if (year < 100) year += 2000;
    
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }

  // 3. Fallback direct parsing as dynamic Date
  const finalFallback = new Date(cleaned);
  if (!isNaN(finalFallback.getTime())) {
    return finalFallback;
  }

  return null;
}

