
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

export async function POST(req: Request) {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API_KEY no configurada en Vercel" },
        { status: 500 }
      );
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
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
