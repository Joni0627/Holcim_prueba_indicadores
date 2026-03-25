
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { BreakageStats } from "../../../../types";
import { generateAIAnalysis } from "../../../../lib/ai";

// --- MOTOR DE REGLAS DE RESPALDO (FALLBACK) ---
function generateFallbackAnalysis(stats: BreakageStats) {
    const topSector = stats.bySector?.[0];
    const topProvider = stats.byProvider?.[0];
    const topMaterial = stats.byMaterial?.[0];
    const rate = stats.globalRate || 0;

    let insight = "";
    let priority: 'high' | 'medium' | 'low' = 'low';
    const recommendations: string[] = [];

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
        insight: `[Respaldo] ${insight}`,
        recommendations: recommendations.slice(0, 3),
        priority
    };
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { stats } = body as { stats: BreakageStats };

    if (!stats || !stats.totalProduced) {
        return NextResponse.json({
            insight: "Datos insuficientes para análisis.",
            recommendations: ["Seleccione un rango de fecha con producción."],
            priority: "low"
        });
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

    const analysis = await generateAIAnalysis(prompt);

    if (analysis) {
        return NextResponse.json(analysis);
    }

    return NextResponse.json(generateFallbackAnalysis(stats));

  } catch (error: any) {
    console.error("Critical Error:", error);
    return NextResponse.json({
        insight: "Error en servicio de análisis. Se requiere revisión manual.",
        recommendations: ["Verificar logs del servidor", "Revisar datos de entrada"],
        priority: "low"
    });
  }
}
