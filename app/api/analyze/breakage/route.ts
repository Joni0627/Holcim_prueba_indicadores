
import { NextResponse } from "next/server";
import { BreakageStats } from "../../../../types";

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

// --- MOTOR DE REGLAS DE RESPALDO (FALLBACK) ---
// Se ejecuta si la IA falla o no tiene cuota.
function generateFallbackAnalysis(stats: BreakageStats) {
    const topSector = stats.bySector?.[0];
    const topProvider = stats.byProvider?.[0];
    const topMaterial = stats.byMaterial?.[0];
    const rate = stats.globalRate || 0;

    let insight = "";
    let priority: 'high' | 'medium' | 'low' = 'low';
    const recommendations: string[] = [];

    // Lógica de Diagnóstico
    if (rate > 2.0) {
        priority = 'high';
        insight = `CRÍTICO: Tasa de rotura global del ${rate.toFixed(2)}% excede el límite aceptable. `;
        if (topSector) insight += `El sector '${topSector.name}' concentra la mayoría de fallas.`;
    } else if (rate > 0.8) {
        priority = 'medium';
        insight = `ALERTA: Tasa de rotura elevada (${rate.toFixed(2)}%). `;
        if (topMaterial) insight += `Revisar material '${topMaterial.name}' que presenta alta incidencia.`;
    } else {
        priority = 'low';
        insight = `ESTABLE: La tasa de rotura (${rate.toFixed(2)}%) se encuentra dentro de parámetros normales de operación.`;
    }

    // Generación de Recomendaciones
    if (topSector) {
        recommendations.push(`Realizar mantenimiento preventivo en sector: ${topSector.name}.`);
    }
    if (topProvider && topProvider.rate > 1.5) {
        recommendations.push(`Gestionar reclamo de calidad al proveedor ${topProvider.name} (${topProvider.rate.toFixed(1)}% falla).`);
    } else {
        recommendations.push("Monitorear variables de proceso en turno noche.");
    }
    if (topMaterial) {
        recommendations.push(`Verificar especificaciones técnicas del material: ${topMaterial.name}.`);
    }

    return {
        insight: `[Respaldo] ${insight}`, // Marcamos que es respaldo
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
    const body = await req.json();
    const { stats } = body as { stats: BreakageStats };
    const apiKey = process.env.API_KEY;

    // Validación básica de datos
    if (!stats || !stats.totalProduced) {
        return NextResponse.json({
            insight: "Datos insuficientes para análisis.",
            recommendations: ["Seleccione un rango de fecha con producción."],
            priority: "low"
        });
    }

    // Si no hay API Key, usamos Fallback directo
    if (!apiKey) {
      console.warn("API_KEY faltante. Usando Fallback.");
      return NextResponse.json(generateFallbackAnalysis(stats));
    }

    const prompt = `
      Actúa como un Ingeniero de Calidad experto. Analiza estos datos de merma de sacos:
      - Producción: ${stats.totalProduced.toLocaleString()}
      - Roturas: ${stats.totalBroken.toLocaleString()}
      - Tasa Falla: ${(stats.globalRate || 0).toFixed(2)}%
      SECTORES (Fallas): ${stats.bySector?.map(s => `- ${s.name}: ${s.value}`).join('\n') || 'N/A'}
      PROVEEDORES (Peores): ${stats.byProvider?.slice(0, 3).map(p => `- ${p.name}: ${p.rate.toFixed(2)}%`).join('\n') || 'N/A'}
      
      Responde SOLO JSON válido:
      {
        "insight": "Diagnóstico breve (máx 150 caracteres).",
        "recommendations": ["Acción 1", "Acción 2", "Acción 3"],
        "priority": "high" | "medium" | "low"
      }
    `;

    // Lista de modelos a probar
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

    // Intentar conectar con IA
    for (const model of modelsToTry) {
        try {
            data = await tryGenerateWithModel(model, apiKey, prompt);
            if (data) break;
        } catch (e: any) {
            // Si la llave es inválida, no seguimos probando, vamos directo al fallback
            if (e.message.includes('API_KEY_INVALID')) {
                console.error("API Key Inválida detectada.");
                break;
            }
            continue; 
        }
    }

    // Si la IA respondió
    if (data) {
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
            try {
                return NextResponse.json(JSON.parse(cleanJsonString(textResponse)));
            } catch (e) {
                console.error("Error parseando JSON de IA, usando fallback.");
            }
        }
    }

    // --- FALLBACK FINAL ---
    // Si llegamos aquí (por cuota, error 404, o parse error), usamos el motor de reglas
    console.warn("Usando sistema de respaldo (Fallback) para análisis.");
    return NextResponse.json(generateFallbackAnalysis(stats));

  } catch (error: any) {
    console.error("Critical Error:", error);
    // Incluso en error crítico, intentamos devolver un JSON válido
    return NextResponse.json({
        insight: "Error en servicio de análisis. Se requiere revisión manual.",
        recommendations: ["Verificar logs del servidor", "Revisar datos de entrada"],
        priority: "low"
    });
  }
}
