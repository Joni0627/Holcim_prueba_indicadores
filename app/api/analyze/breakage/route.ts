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

    const prompt = `
      Actúa como un Ingeniero de Calidad experto en procesos de envasado industrial.
      Analiza los siguientes datos de merma/rotura de sacos:

      Totales:
      - Producción: ${stats.totalProduced.toLocaleString()} bolsas
      - Roturas: ${stats.totalBroken.toLocaleString()} bolsas
      - Tasa Global de Falla: ${stats.globalRate.toFixed(2)}%

      Desglose por Sector (Dónde se rompen):
      ${stats.bySector.map(s => `- ${s.name}: ${s.value} bolsas (${s.percentage.toFixed(1)}% del total)`).join('\n')}

      Peores Proveedores (Top 3 por Tasa de Falla):
      ${stats.byProvider.slice(0, 3).map(p => `- ${p.name}: ${p.rate.toFixed(2)}% falla`).join('\n')}

      Peores Materiales (Top 3):
      ${stats.byMaterial.slice(0, 3).map(m => `- ${m.name}: ${m.rate.toFixed(2)}% falla`).join('\n')}

      Genera una respuesta JSON breve con:
      {
        "insight": "Diagnóstico de 1 frase identificando el mayor problema (ej. Proveedor X o Sector Y).",
        "recommendations": ["3 acciones correctivas concretas"],
        "priority": "high" | "medium" | "low"
      }
      Si la tasa global es menor al 0.5%, la prioridad es low. Si es mayor a 2%, es high.
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
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                insight: { type: "STRING" },
                recommendations: { type: "ARRAY", items: { type: "STRING" } },
                priority: { type: "STRING", enum: ["high", "medium", "low"] },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini API Error");

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (textResponse) {
      return NextResponse.json(JSON.parse(textResponse));
    }
    
    throw new Error("No content generated");

  } catch (error: any) {
    console.error("AI Breakage Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}