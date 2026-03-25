import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

/**
 * Limpia una cadena de texto que contiene un JSON, eliminando bloques de código markdown.
 */
export function cleanJsonString(str: string): string {
  if (!str) return "";
  
  // Remove markdown code blocks
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let cleaned = match && match[1] ? match[1].trim() : str.trim();
  
  // Find first { and last }
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  
  // Basic cleanup of common issues
  return cleaned
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .trim();
}

/**
 * Intenta generar contenido con Gemini usando una lista de modelos en cascada.
 */
export async function generateAIAnalysis(prompt: string): Promise<any | null> {
  if (!API_KEY) {
    console.warn("Gemini API_KEY no configurada.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Modelos a intentar en orden de preferencia (usando modelos permitidos)
  const modelsToTry = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview"
  ];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1, // Muy baja para respuestas determinísticas
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        const cleaned = cleanJsonString(text);
        try {
          const parsed = JSON.parse(cleaned);
          // Basic validation of expected structure
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch (parseError) {
          console.error(`Error parseando JSON del modelo ${modelName}:`, parseError, "Texto original:", text);
          // Intentamos con el siguiente modelo si el JSON es inválido
        }
      }
    } catch (error: any) {
      console.error(`Error con modelo ${modelName}:`, error.message);
      // Si es un error de cuota o modelo no encontrado, seguimos con el siguiente
      if (error.message?.includes("429") || error.message?.includes("404") || error.message?.includes("503")) {
        continue;
      }
      // Si es error de API Key, no tiene sentido seguir intentando
      if (error.message?.includes("API key not valid")) {
        break;
      }
    }
  }

  return null;
}
