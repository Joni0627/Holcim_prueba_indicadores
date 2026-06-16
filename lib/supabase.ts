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
