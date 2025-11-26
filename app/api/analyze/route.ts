
import { NextResponse } from "next/server";
import { DowntimeEvent, OEEData, ProductionMetrics } from "../../../types";

// Helper robusto para limpiar JSON
function cleanJsonString(str: string): string {
  if (!str) return "";
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) return match[1].trim();
  
  const firstOpen = str.indexOf('{');
  const lastClose = str.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return str.substring(firstOpen, lastClose + 1);
  }
  return str.trim();
}

async function tryGenerateWithModel(model: string, apiKey: string, prompt: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    );

    if (!response.ok) {
        const status = response.status;
        const errText = await response.text();

        if (status === 404) {
            throw new Error(`MODEL_NOT_FOUND`);
        }
        if (status === 429) {
             throw new Error(`QUOTA_EXCEEDED`);
        }
        if (status === 400 && (errText.includes('API key not valid') || errText.includes('API_KEY_INVALID'))) {
             throw new Error(`API_KEY_INVALID`);
        }
        
        throw new Error(`API_ERROR_${status}: ${errText}`);
    }

    return response.json();
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.API_KEY;
    const body = await req.json();
    const { oee, downtimes, production } = body as {
      oee: OEEData;
      downtimes: DowntimeEvent[];
      production: ProductionMetrics[];
    };

    // --- MODO DEMO / FALLBACK ---
    if (!apiKey) {
       console.warn("MODO DEMO: API_KEY no encontrada. Devolviendo análisis simulado.");
       
       const topDowntime = downtimes?.[0]?.reason || "Falla Técnica";
       const oeeVal = (oee?.oee || 0) * 100;

       let insight = "La planta opera de manera estable.";
       let priority = "low";
       
       if (oeeVal < 60) {
           insight = `Análisis Demo: Crítico bajo OEE (${oeeVal.toFixed(1)}%) impulsado principalmente por '${topDowntime}'.`;
           priority = "high";
       } else if (oeeVal < 85) {
           insight = `Análisis Demo: OEE aceptable (${oeeVal.toFixed(1)}%), pero se observan pérdidas recurrentes por '${topDowntime}'.`;
           priority = "medium";
       }

       return NextResponse.json({
         insight,
         recommendations: [
           `Investigar causa raíz de: ${topDowntime}`,
           "Optimizar cambios de turno para recuperar disponibilidad",
           "Revisar velocidad de línea en Paletizadora 1"
         ],
         priority
       });
    }

    const prompt = `
      Actúa como Ingeniero de Planta. Analiza estos datos (últimas 8h):
      
      OEE Global: ${(oee?.oee * 100).toFixed(1)}% (Disp: ${(oee?.availability * 100).toFixed(1)}%, Rend: ${(oee?.performance * 100).toFixed(1)}%)
      Top Paros: ${downtimes?.slice(0, 3).map(d => `${d.reason} (${d.durationMinutes}m)`).join(', ') || 'Ninguno'}
      
      Responde SOLO JSON válido:
      {
        "insight": "Resumen ejecutivo (1 frase).",
        "recommendations": ["Acción 1", "Acción 2"],
        "priority": "high" | "medium" | "low"
      }
    `;

    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    let lastError = null;
    let data = null;

    for (const model of modelsToTry) {
        try {
            data = await tryGenerateWithModel(model, apiKey, prompt);
            if (data) break;
        } catch (e: any) {
            lastError = e;
            if (e.message.includes('API_KEY_INVALID')) {
                throw new Error("API Key inválida. Verifique configuración en Vercel.");
            }
            continue;
        }
    }

    if (!data) {
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
      try {
        const result = JSON.parse(cleanJsonString(textResponse));
        return NextResponse.json(result);
      } catch (e) {
        throw new Error("Error parseando respuesta de IA");
      }
    }

    throw new Error("Sin respuesta de IA");

  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
