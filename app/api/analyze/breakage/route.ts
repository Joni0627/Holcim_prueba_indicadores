import { NextResponse } from "next/server";
import { BreakageStats } from "../../../../types";

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

    // GUARD CLAUSE: Handle empty data to avoid hallucination or errors
    if (!stats || stats.totalProduced === 0) {
        return NextResponse.json({
            insight: "No hay datos de producción suficientes en este período para generar un análisis.",
            recommendations: ["Amplíe el rango de fechas.", "Verifique la carga de datos en la hoja."],
            priority: "low"
        });
    }

    const prompt = `
      Actúa como un Ingeniero de Calidad experto en procesos de envasado industrial.
      Analiza los siguientes datos de merma/rotura de sacos.

      DATOS:
      - Producción Total: ${stats.totalProduced.toLocaleString()} bolsas
      - Roturas Totales: ${stats.totalBroken.toLocaleString()} bolsas
      - Tasa Global de Falla: ${stats.globalRate.toFixed(2)}%

      Desglose por Sector (Dónde se rompen):
      ${stats.bySector.map(s => `- ${s.name}: ${s.value} bolsas`).join('\n')}

      Peores Proveedores (Top 3 por Tasa de Falla):
      ${stats.byProvider.slice(0, 3).map(p => `- ${p.name}: ${p.rate.toFixed(2)}%`).join('\n')}

      Responde en formato JSON puro:
      {
        "insight": "Diagnóstico breve (1-2 frases) del principal problema.",
        "recommendations": ["3 acciones correctivas"],
        "priority": "${stats.globalRate > 2 ? 'high' : stats.globalRate > 0.5 ? 'medium' : 'low'}"
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
      return NextResponse.json(JSON.parse(textResponse));
    }
    
    throw new Error("No content generated");

  } catch (error: any) {
    console.error("AI Breakage Analysis Error:", error);
    // Return graceful error instead of 500 to UI
    return NextResponse.json({ 
        insight: "No se pudo generar el análisis automático en este momento.",
        recommendations: ["Revise la tabla manualmente."],
        priority: "low"
    });
  }
}
