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

if (!supabaseUrl) {
    console.error("ERROR: SUPABASE_URL is missing in environment variables!");
}
if (!supabaseKey) {
    console.error("ERROR: SUPABASE_KEY is missing in environment variables!");
}

export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * Robust helper function to fetch all rows using the requested page chunk mechanism
 * of size 1000 with a range(from, to) loop.
 */
export async function fetchAllRows(tableName: string): Promise<any[]> {
    if (!supabase) {
        console.error(`Supabase Client not initialized. Cannot fetch table: ${tableName}`);
        return [];
    }
    
    const allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    try {
        console.log(`[Supabase] Starting paginated load for table: ${tableName}`);
        while (hasMore) {
            const to = from + pageSize - 1;
            const { data, error } = await supabase
                .from(tableName)
                .select("*")
                .range(from, to);
                
            if (error) {
                console.error(`[Supabase] Error reading table ${tableName}:`, error.message, error);
                throw error;
            }
            
            if (data && data.length > 0) {
                allRows.push(...data);
                console.log(`[Supabase] Table ${tableName}: Loaded ${data.length} rows (total so far: ${allRows.length})`);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    from += pageSize;
                }
            } else {
                hasMore = false;
            }
        }
        console.log(`[Supabase] Succeeded loading table ${tableName}. Total rows: ${allRows.length}`);
    } catch (err: any) {
        console.error(`[Supabase] Connection or reading failed on table ${tableName}:`, err);
    }
    
    return allRows;
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

  // 1. Try to parse ISO 8601 strings directly first (e.g. standard PostgreSQL timestamps)
  if (cleaned.includes("T") || cleaned.includes(" ") || cleaned.length > 10) {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // 2. Handle DD/MM/YYYY or YYYY-MM-DD manually
  let parts: string[] = [];
  if (cleaned.includes("/")) {
    parts = cleaned.split("/");
  } else if (cleaned.includes("-")) {
    parts = cleaned.split("-");
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

