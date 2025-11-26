
import { DowntimeEvent, OEEData, ProductionMetrics, AIAnalysisResult, BreakageStats } from "../types";

// Client-side service that calls our Next.js API Route
export const analyzePlantData = async (
  oee: OEEData,
  downtimes: DowntimeEvent[],
  production: ProductionMetrics[]
): Promise<AIAnalysisResult> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oee, downtimes, production }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    return {
      insight: `Error: ${error.message || 'Desconocido'}`,
      recommendations: ["Verifique conexión a internet", "Verifique configuración API Key"],
      priority: "low"
    };
  }
};

export const analyzeBreakageData = async (stats: BreakageStats): Promise<AIAnalysisResult> => {
    try {
        const response = await fetch('/api/analyze/breakage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stats }),
        });

        if (!response.ok) {
             const err = await response.json().catch(() => ({}));
             throw new Error(err.error || `Error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error: any) {
        console.error("Error analyzing breakage:", error);
        return {
            insight: `No se pudo generar análisis. ${error.message || ''}`,
            recommendations: ["Revise la tabla manualmente", "Verifique API Key en Vercel"],
            priority: "low"
        };
    }
};
