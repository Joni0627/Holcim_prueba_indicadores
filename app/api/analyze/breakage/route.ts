
import { NextResponse } from "next/server";
import { BreakageStats } from "../../../../types";

// Helper robusto para limpiar JSON
function cleanJsonString(str: string): string {
  if (!str) return "";
  
  // 1. Intentar extraer de bloque de código markdown
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
      return match[1].trim();
  }
  
  // 2. Intentar buscar el primer '{' y el último '}'
  const firstOpen = str.indexOf('{');
  const lastClose = str.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return str.substring(firstOpen, lastClose + 1);
  }
  
  // 3. Retornar tal cual (backup)
  return str.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stats } = body as { stats: BreakageStats };
    const apiKey = process.env.API_KEY;

    // --- MODO DEMO / FALLBACK ---
    // Si no hay API KEY, devolvemos una respuesta simulada para que la Demo luzca bien.
    if (!apiKey) {
      console.warn("MODO DEMO: API_KEY no encontrada. Devolviendo análisis simulado.");
      
      // Simulación basada en datos reales simples
      const topProvider = stats.byProvider?.[0]?.name || "Proveedor X";
      const topSector = stats.bySector?.[0]?.name || "Ensacadora";
      
      return NextResponse.json({
        insight: `Análisis Demo: Se detecta una concentración inusual de roturas en el sector ${topSector}, afectando principalmente al proveedor ${topProvider}.`,
        recommendations: [
          `Revisar calibración de mordazas en ${topSector}.`,
          `Solicitar nota de crédito a ${topProvider} por lote defectuoso.`,
          "Aumentar frecuencia de limpieza en sensores de transporte."
        ],
        priority: "high"
      });
    }

    if (!stats || !stats.totalProduced) {
        return NextResponse.json({
            insight: "No hay suficientes datos de producción para realizar un análisis de calidad.",
            recommendations: ["Seleccione un rango de fecha con producción."],
            priority: "low"
        });
    }

    const prompt = `
      Actúa como un Ingeniero de Calidad experto. Analiza estos datos de merma de sacos:

      DATOS:
      - Producción: ${stats.totalProduced.toLocaleString()}
      - Roturas: ${stats.totalBroken.toLocaleString()}
      - Tasa Falla: ${(stats.globalRate || 0).toFixed(2)}%

      SECTORES (Fallas):
      ${stats.bySector?.map(s => `- ${s.name}: ${s.value}`).join('\n') || 'N/A'}

      PROVEEDORES (Peores):
      ${stats.byProvider?.slice(0, 3).map(p => `- ${p.name}: ${p.rate.toFixed(2)}%`).join('\n') || 'N/A'}

      MATERIALES (Peores):
      ${stats.byMaterial?.slice(0, 3).map(m => `- ${m.name}: ${m.rate.toFixed(2)}%`).join('\n') || 'N/A'}

      IMPORTANTE: Responde SOLO con un objeto JSON válido. NO uses markdown. NO agregues texto antes ni después.
      Estructura:
      {
        "insight": "Diagnóstico breve (máx 150 caracteres).",
        "recommendations": ["Acción 1", "Acción 2", "Acción 3"],
        "priority": "high" | "medium" | "low"
      }
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (textResponse) {
      const cleanedJson = cleanJsonString(textResponse);
      try {
        return NextResponse.json(JSON.parse(cleanedJson));
      } catch (e) {
        console.error("JSON Parse Error:", e);
        console.error("Raw Text:", textResponse);
        throw new Error("La IA devolvió un formato inválido.");
      }
    }
    
    throw new Error("La IA no generó contenido.");

  } catch (error: any) {
    console.error("AI Breakage Analysis Error:", error);
    return NextResponse.json(
        { error: error.message || "Error interno del servidor" }, 
        { status: 500 }
    );
  }
}
