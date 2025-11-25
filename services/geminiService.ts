import { DowntimeEvent, OEEData, ProductionMetrics, AIAnalysisResult } from "../types";

// Client-side service that calls our Next.js API Route
// This prevents exposing the API Key and importing Node.js-only libraries in the browser
export const analyzePlantData = async (
  oee: OEEData,
  downtimes: DowntimeEvent[],
  production: ProductionMetrics[]
): Promise<AIAnalysisResult> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oee,
        downtimes,
        production
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling Gemini API proxy:", error);
    return {
      insight: "No se pudo conectar con el asistente de IA. Verifique su conexión.",
      recommendations: ["Intentar nuevamente en unos minutos", "Revisar conexión a internet"],
      priority: "low"
    };
  }
};