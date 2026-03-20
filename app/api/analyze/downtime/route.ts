
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { DowntimeEvent } from "../../../../types";
import { generateAIAnalysis } from "../../../../lib/ai";

function generateFallbackAnalysis(downtimes: DowntimeEvent[]) {
    const topDowntime = downtimes?.[0];
    const totalMinutes = downtimes.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    
    let insight = "";
    let priority: 'high' | 'medium' | 'low' = 'low';
    const recommendations: string[] = [];

    if (totalMinutes > 120) {
        priority = 'high';
        insight = `CRÍTICO: Elevada acumulación de tiempo de parada (${totalMinutes} min). `;
        if (topDowntime) insight += `Falla principal: '${topDowntime.reason}' en ${topDowntime.hac}.`;
    } else {
        priority = 'medium';
        insight = `OPERATIVO: Se registran paros menores en el periodo. `;
        if (topDowntime) insight += `Motivo recurrente: '${topDowntime.reason}'.`;
    }

    if (topDowntime) {
        recommendations.push(`Inspeccionar sensor/mecanismo asociado a: ${topDowntime.reason}.`);
        recommendations.push(`Revisar historial de mantenimiento de equipo: ${topDowntime.hac}.`);
    }
    recommendations.push("Validar correcta carga de motivos en SAP/Hoja de Campo.");

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
    const { downtimes } = body as { downtimes: DowntimeEvent[] };

    if (!downtimes || downtimes.length === 0) {
        return NextResponse.json({
            insight: "No hay eventos de parada registrados en este rango.",
            recommendations: ["Verificar carga de datos en planilla"],
            priority: "low"
        });
    }

    const prompt = `
      Actúa como Especialista en Mantenimiento Industrial. Analiza estos paros de planta:
      Eventos: ${downtimes.slice(0, 8).map(d => `- ${d.reason} en ${d.hac} (${d.durationMinutes}m, Tipo: ${d.downtimeType})`).join('\n')}
      
      Responde SOLO JSON válido:
      {
        "insight": "Diagnóstico de qué está fallando más y por qué (máx 150 carac).",
        "recommendations": ["Acción técnica 1", "Acción preventiva 2"],
        "priority": "high" | "medium" | "low"
      }
    `;

    const analysis = await generateAIAnalysis(prompt);

    if (analysis) {
        return NextResponse.json(analysis);
    }

    return NextResponse.json(generateFallbackAnalysis(downtimes));

  } catch (error: any) {
    console.error("Downtime Analysis Error:", error);
    return NextResponse.json({
         insight: "Error en análisis automático.",
         recommendations: ["Revisar ranking de Pareto"],
         priority: "low"
    });
  }
}
