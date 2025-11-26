
import { NextResponse } from "next/server";
import { BreakageStats } from "../../../../types";

// Helper robusto para limpiar JSON
function cleanJsonString(str: string): string {
  if (!str) return "";
  
  // 1. Intentar extraer de bloque de código markdown
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
      return match[1].trim();
  }
  
  // 2. Intentar buscar el primer '{' y el último '}'
  const firstOpen = str.indexOf('{');
  const lastClose = str.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return str.substring(firstOpen, lastClose + 1);
  }
  
  // 3. Retornar tal cual (backup)
  return str.trim();
}

async function tryGenerateWithModel(model: string, apiKey: string, prompt: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          },
        }),
      }
    );

    if (!response.ok) {
        // Si es 404 (Modelo no encontrado) o 400 (Bad Request), lanzamos error específico para intentar el siguiente
        if (response.status === 404 || response.status === 400) {
            throw new Error(`MODEL_NOT_FOUND`);
        }
        // Si es 429 (Cuota), también intentamos el siguiente por si acaso tiene cuota distinta
        if (response.status === 429) {
             throw new Error(`QUOTA_EXCEEDED`);
        }
        
        const errText = await response.text();
        throw new Error(`API_ERROR_${response.status}: ${errText}`);
    }

    return response.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stats } = body as { stats: BreakageStats };
    const apiKey = process.env.API_KEY;

    // --- MODO DEMO / FALLBACK ---
    if (!apiKey) {
      console.warn("MODO DEMO: API_KEY no encontrada. Devolviendo análisis simulado.");
      
      const topProvider = stats.byProvider?.[0]?.name || "Proveedor X";
      const topSector = stats.bySector?.[0]?.name || "Ensacadora";
      
      return NextResponse.json({
        insight: `Análisis Demo: Se detecta una concentración inusual de roturas en el sector ${topSector}, afectando principalmente al proveedor ${topProvider}.`,
        recommendations: [
          `Revisar calibración de mordazas en ${topSector}.`,
          `Solicitar nota de crédito a ${topProvider} por lote defectuoso.`,
          "Aumentar frecuencia de limpieza en sensores de transporte."
        ],
        priority: "high"
      });
    }

    if (!stats || !stats.totalProduced) {
        return NextResponse.json({
            insight: "No hay suficientes datos de producción para realizar un análisis de calidad.",
            recommendations: ["Seleccione un rango de fecha con producción."],
            priority: "low"
        });
    }

    const prompt = `
      Actúa como un Ingeniero de Calidad experto. Analiza estos datos de merma de sacos:

      DATOS:
      - Producción: ${stats.totalProduced.toLocaleString()}
      - Roturas: ${stats.totalBroken.toLocaleString()}
      - Tasa Falla: ${(stats.globalRate || 0).toFixed(2)}%

      SECTORES (Fallas):
      ${stats.bySector?.map(s => `- ${s.name}: ${s.value}`).join('\n') || 'N/A'}

      PROVEEDORES (Peores):
      ${stats.byProvider?.slice(0, 3).map(p => `- ${p.name}: ${p.rate.toFixed(2)}%`).join('\n') || 'N/A'}

      MATERIALES (Peores):
      ${stats.byMaterial?.slice(0, 3).map(m => `- ${m.name}: ${m.rate.toFixed(2)}%`).join('\n') || 'N/A'}

      IMPORTANTE: Responde SOLO con un objeto JSON válido. NO uses markdown. NO agregues texto antes ni después.
      Estructura:
      {
        "insight": "Diagnóstico breve (máx 150 caracteres).",
        "recommendations": ["Acción 1", "Acción 2", "Acción 3"],
        "priority": "high" | "medium" | "low"
      }
    `;

    // Lista exhaustiva de modelos a probar (Fallback Strategy)
    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    let lastError = null;
    let data = null;

    // Estrategia de Fallback: Probar modelos uno por uno
    for (const model of modelsToTry) {
        try {
            // console.log(`Trying model: ${model}...`);
            data = await tryGenerateWithModel(model, apiKey, prompt);
            if (data) break; // Si funciona, salimos del bucle
        } catch (e: any) {
            lastError = e;
            continue; 
        }
    }

    if (!data) {
        // Si ninguno funcionó
        if (lastError?.message?.includes('QUOTA_EXCEEDED')) {
             throw new Error("Límite de cuota IA excedido.");
        }
        if (lastError?.message?.includes('MODEL_NOT_FOUND')) {
             throw new Error("Ningún modelo Gemini disponible para esta API Key.");
        }
        throw new Error(lastError?.message || "No se pudo conectar con ningún modelo Gemini.");
    }

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (textResponse) {
      const cleanedJson = cleanJsonString(textResponse);
      try {
        return NextResponse.json(JSON.parse(cleanedJson));
      } catch (e) {
        console.error("JSON Parse Error:", e);
        console.error("Raw Text:", textResponse);
        throw new Error("La IA devolvió un formato inválido.");
      }
    }
    
    throw new Error("La IA no generó contenido.");

  } catch (error: any) {
    console.error("AI Breakage Analysis Error:", error);
    return NextResponse.json(
        { error: error.message || "Error interno del servidor" }, 
        { status: 500 }
    );
  }
}
