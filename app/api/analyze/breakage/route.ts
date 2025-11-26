
import { NextResponse } from "next/server";
import { BreakageStats } from "../../../../types";

// Helper to clean Markdown code blocks from JSON string
function cleanJsonString(str: string): string {
  if (!str) return "";
  // Remove ```json and ``` wrap
  return str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API_KEY not configured on server" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { stats } = body as { stats: BreakageStats };

    if (!stats || !stats.totalProduced) {
        return NextResponse.json({
            insight: "No hay suficientes datos para realizar un análisis de calidad.",
            recommendations: ["Seleccione un rango de fecha con producción."],
            priority: "low"
        });
    }

    // Ensure we use the readable 'name' and not the 'id' (safeKey)
    const prompt = `
      Actúa como un Ingeniero de Calidad experto en procesos de envasado industrial.
      Analiza los siguientes datos de merma/rotura de sacos.

      DATOS:
      - Producción Total: ${stats.totalProduced?.toLocaleString() || 0} bolsas
      - Roturas Totales: ${stats.totalBroken?.toLocaleString() || 0} bolsas
      - Tasa Global de Falla: ${(stats.globalRate || 0).toFixed(2)}%

      Desglose por Sector (Dónde se rompen):
      ${stats.bySector?.map(s => `- ${s.name}: ${s.value} bolsas`).join('\n') || 'Sin datos de sector'}

      Peores Proveedores (Top 3 por Tasa de Falla):
      ${stats.byProvider?.slice(0, 3).map(p => `- ${p.name}: ${p.rate.toFixed(2)}%`).join('\n') || 'Sin datos de proveedores'}

      Responde en formato JSON puro:
      {
        "insight": "Diagnóstico breve (1-2 frases) del principal problema.",
        "recommendations": ["3 acciones correctivas"],
        "priority": "${(stats.globalRate || 0) > 2 ? 'high' : (stats.globalRate || 0) > 0.5 ? 'medium' : 'low'}"
      }
    `;

    // Use stable model gemini-1.5-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (textResponse) {
      const cleanedJson = cleanJsonString(textResponse);
      try {
        return NextResponse.json(JSON.parse(cleanedJson));
      } catch (e) {
        console.error("JSON Parse Error:", e, "Raw Text:", textResponse);
        throw new Error("Failed to parse AI response");
      }
    }
    
    throw new Error("No content generated");

  } catch (error: any) {
    console.error("AI Breakage Analysis Error:", error);
    return NextResponse.json({ 
        insight: "No se pudo generar el análisis automático en este momento.",
        recommendations: ["Revise la tabla manualmente."],
        priority: "low"
    });
  }
}
