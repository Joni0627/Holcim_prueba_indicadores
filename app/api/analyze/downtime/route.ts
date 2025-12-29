
import { NextResponse } from "next/server";
import { DowntimeEvent } from "../../../../types";

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
        throw new Error(`GOOGLE_ERROR_${response.status}`);
    }
    return response.json();
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.API_KEY;
    const body = await req.json();
    const { downtimes } = body as { downtimes: DowntimeEvent[] };

    if (!downtimes || downtimes.length === 0) {
        return NextResponse.json({
            insight: "No hay eventos de parada registrados en este rango.",
            recommendations: ["Verificar carga de datos en planilla"],
            priority: "low"
        });
    }

    if (!apiKey) return NextResponse.json(generateFallbackAnalysis(downtimes));

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

    const modelsToTry = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
    let data = null;

    for (const model of modelsToTry) {
        try {
            data = await tryGenerateWithModel(model, apiKey, prompt);
            if (data) break;
        } catch (e) { continue; }
    }

    if (data) {
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
            try {
                return NextResponse.json(JSON.parse(cleanJsonString(textResponse)));
            } catch (e) { }
        }
    }

    return NextResponse.json(generateFallbackAnalysis(downtimes));

  } catch (error: any) {
    return NextResponse.json({
         insight: "Error en análisis automático.",
         recommendations: ["Revisar ranking de Pareto"],
         priority: "low"
    });
  }
}
