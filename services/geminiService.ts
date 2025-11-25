import { GoogleGenAI, Type } from "@google/genai";
import { DowntimeEvent, OEEData, ProductionMetrics } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzePlantData = async (
  oee: OEEData,
  downtimes: DowntimeEvent[],
  production: ProductionMetrics[]
) => {
  try {
    const prompt = `
      Actúa como un Ingeniero de Planta Senior experto en Lean Manufacturing y TPM.
      Analiza los siguientes datos de producción de las últimas 8 horas y proporciona un diagnóstico breve.

      Datos OEE:
      - Disponibilidad: ${(oee.availability * 100).toFixed(1)}%
      - Rendimiento: ${(oee.performance * 100).toFixed(1)}%
      - Calidad: ${(oee.quality * 100).toFixed(1)}%
      - OEE Global: ${(oee.oee * 100).toFixed(1)}%

      Top 3 Paros de Máquina (Downtime):
      ${downtimes.slice(0, 3).map(d => `- ${d.reason}: ${d.durationMinutes} mins (${d.category})`).join('\n')}

      Tendencia de Producción:
      El promedio de producción por hora es ${Math.round(production.reduce((acc, curr) => acc + curr.producedUnits, 0) / production.length)} unidades.
      El objetivo es ${production[0].targetUnits} unidades.

      Genera una respuesta en formato JSON con la siguiente estructura:
      {
        "insight": "Un resumen ejecutivo de 1-2 frases sobre el estado crítico actual.",
        "recommendations": ["Acción concreta 1", "Acción concreta 2", "Acción concreta 3"],
        "priority": "high" | "medium" | "low"
      }
      Enfócate en identificar si el problema es técnico, organizacional o de calidad y sugiere acciones de mejora inmediata.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                insight: { type: Type.STRING },
                recommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
            }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No se pudo generar el análisis.");

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return {
      insight: "No se pudo conectar con el asistente de IA. Verifique su conexión o API Key.",
      recommendations: ["Revisar configuración de API", "Consultar logs manuales"],
      priority: "low"
    };
  }
};