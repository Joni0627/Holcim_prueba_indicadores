
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
        throw new Error(err.error || response.statusText);
    }
    return await response.json();
  } catch (error) {
    console.error("Error calling Gemini API proxy:", error);
    return {
      insight: "No se pudo conectar con el asistente de IA.",
      recommendations: ["Verificar conexión de red o API Key"],
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
             throw new Error(err.error || response.statusText);
        }
        return await response.json();
    } catch (error) {
        console.error("Error analyzing breakage:", error);
        return {
            insight: "Análisis no disponible por el momento.",
            recommendations: ["Revise los datos manualmente en la tabla", "Intente nuevamente en unos instantes"],
            priority: "low"
        };
    }
};
