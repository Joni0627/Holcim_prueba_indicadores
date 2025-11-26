
import { NextResponse } from "next/server";
import { DowntimeEvent, OEEData, ProductionMetrics } from "../../../types";

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

// --- MOTOR DE REGLAS DE RESPALDO (FALLBACK) ---
function generateFallbackAnalysis(oee: OEEData, downtimes: DowntimeEvent[]) {
    const oeeVal = (oee?.oee || 0) * 100;
    const topDowntime = downtimes?.[0];
    
    let insight = "";
    let priority: 'high' | 'medium' | 'low' = 'low';
    const recommendations: string[] = [];

    if (oeeVal < 65) {
        priority = 'high';
        insight = `CRÍTICO: Eficiencia global baja (${oeeVal.toFixed(1)}%). `;
        if (topDowntime) insight += `Impacto severo por '${topDowntime.reason}' (${topDowntime.durationMinutes}m).`;
    } else if (oeeVal < 85) {
        priority = 'medium';
        insight = `ATENCIÓN: OEE del ${oeeVal.toFixed(1)}% con oportunidades de mejora. `;
        if (topDowntime) insight += `Foco principal: '${topDowntime.reason}'.`;
    } else {
        priority = 'low';
        insight = `ÓPTIMO: Planta operando con alta eficiencia (${oeeVal.toFixed(1)}%). Mantener estándares.`;
    }

    if (topDowntime) {
        recommendations.push(`Analizar causa raíz de: ${topDowntime.reason}.`);
        recommendations.push(`Verificar frecuencia de: ${topDowntime.category}.`);
    } else {
        recommendations.push("Mantener ritmo de producción actual.");
    }
    recommendations.push("Revisar balance de línea para optimizar velocidad.");

    return {
        insight: `[Respaldo] ${insight}`,
        recommendations: recommendations.slice(0, 3),
        priority
    };
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
        if (status === 404) throw new Error(`MODEL_NOT_FOUND`);
        if (status === 429) throw new Error(`QUOTA_EXCEEDED`);
        if (status === 400 && (errText.includes('API key not valid') || errText.includes('API_KEY_INVALID'))) {
             throw new Error(`API_KEY_INVALID`);
        }
        throw new Error(`GOOGLE_ERROR_${status}: ${errText}`);
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

    // Sin API Key -> Fallback inmediato
    if (!apiKey) {
       console.warn("API_KEY faltante. Usando Fallback.");
       return NextResponse.json(generateFallbackAnalysis(oee, downtimes));
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
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-8b", 
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    let data = null;

    for (const model of modelsToTry) {
        try {
            data = await tryGenerateWithModel(model, apiKey, prompt);
            if (data) break;
        } catch (e: any) {
            if (e.message.includes('API_KEY_INVALID')) break;
            continue;
        }
    }

    if (data) {
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
            try {
                return NextResponse.json(JSON.parse(cleanJsonString(textResponse)));
            } catch (e) {
                console.error("Error parseando IA, usando fallback");
            }
        }
    }

    // --- FALLBACK FINAL ---
    return NextResponse.json(generateFallbackAnalysis(oee, downtimes));

  } catch (error: any) {
    console.error("Analysis Error:", error);
    // Fallback de emergencia
    return NextResponse.json({
         insight: "Sistema de análisis en modo seguro.",
         recommendations: ["Revise los datos manualmente"],
         priority: "low"
    });
  }
}
