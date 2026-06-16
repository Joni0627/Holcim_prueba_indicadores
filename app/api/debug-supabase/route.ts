import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const reports: any = {};
  
  try {
    let rawUrl = process.env.SUPABASE_URL || "";
    let rawKey = process.env.SUPABASE_KEY || "";
    
    reports.rawEnvReceived = {
      hasUrl: !!rawUrl,
      urlLength: rawUrl.length,
      hasKey: !!rawKey,
      keyLength: rawKey.length,
    };

    // Clean quotes or trims
    let cleanUrl = rawUrl.trim();
    let cleanKey = rawKey.trim();

    if (cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) {
      cleanUrl = cleanUrl.slice(1, -1).trim();
    } else if (cleanUrl.startsWith("'") && cleanUrl.endsWith("'")) {
      cleanUrl = cleanUrl.slice(1, -1).trim();
    }

    if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
      cleanKey = cleanKey.slice(1, -1).trim();
    } else if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
      cleanKey = cleanKey.slice(1, -1).trim();
    }

    // Clean trailing /v1/, /v1, /rest/v1/ or /rest/v1 or just premium path trails that ruin client routing
    if (cleanUrl) {
      cleanUrl = cleanUrl.replace(/\/+$/, "");
      if (cleanUrl.endsWith("/v1")) {
        cleanUrl = cleanUrl.substring(0, cleanUrl.length - 3);
      }
      if (cleanUrl.endsWith("/rest")) {
        cleanUrl = cleanUrl.substring(0, cleanUrl.length - 5);
      }
      cleanUrl = cleanUrl.replace(/\/+$/, "");
    }

    reports.cleanedEnvVars = {
      urlMasked: cleanUrl ? `${cleanUrl.substring(0, 12)}...${cleanUrl.substring(cleanUrl.length - 4)}` : "missing",
      keyMasked: cleanKey ? `${cleanKey.substring(0, 8)}...${cleanKey.substring(cleanKey.length - 8)}` : "missing",
      urlTrimmedLength: cleanUrl.length,
      keyTrimmedLength: cleanKey.length,
    };

    if (!cleanUrl || !cleanKey) {
      return NextResponse.json({
        success: false,
        error: "Missing required environment variables SUPABASE_URL or SUPABASE_KEY.",
        reports
      });
    }

    // Try initializing and fetching
    const client = createClient(cleanUrl, cleanKey);
    reports.clientInitialized = true;

    // Test table list
    const tablesToTest = ["produccionv2", "parosv2", "detalles_produccionv2", "inventario_fisico"];
    reports.tableTests = {};

    for (const table of tablesToTest) {
      try {
        const { data, error, status, statusText } = await client
          .from(table)
          .select("*")
          .limit(3);

        reports.tableTests[table] = {
          success: !error,
          status,
          statusText,
          rowCountFetched: data ? data.length : 0,
          error: error ? {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          } : null,
          sampleData: data && data.length > 0 ? data.map(d => ({ id: d.id || d.idparo || d.id_produccion || "no-id-field" })) : []
        };
      } catch (tableErr: any) {
        reports.tableTests[table] = {
          success: false,
          error: {
            message: tableErr.message || String(tableErr),
            stack: tableErr.stack
          }
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Diagnostics complete",
      reports
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || String(err),
      reports
    }, { status: 500 });
  }
}
