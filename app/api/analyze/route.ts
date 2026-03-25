
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { DowntimeEvent, OEEData, ProductionMetrics } from "../../../types";
import { generateAIAnalysis } from "../../../lib/ai";

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

export async function POST(req: Request) {
  try {
    // Seguridad: Verificar autenticación explícitamente
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { oee, downtimes, production } = body as {
      oee: OEEData;
      downtimes: DowntimeEvent[];
      production: ProductionMetrics[];
    };

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

    const analysis = await generateAIAnalysis(prompt);

    if (analysis) {
        return NextResponse.json(analysis);
    }

    // --- FALLBACK FINAL ---
    return NextResponse.json(generateFallbackAnalysis(oee, downtimes));

  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json({
         insight: "Sistema de análisis en modo seguro.",
         recommendations: ["Revise los datos manualmente"],
         priority: "low"
    });
  }
}
