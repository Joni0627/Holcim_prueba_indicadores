import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

/**
 * Limpia una cadena de texto que contiene un JSON, eliminando bloques de código markdown.
 */
export function cleanJsonString(str: string): string {
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

/**
 * Intenta generar contenido con Gemini usando una lista de modelos en cascada.
 */
export async function generateAIAnalysis(prompt: string): Promise<any | null> {
  if (!API_KEY) {
    console.warn("Gemini API_KEY no configurada.");
    return null;
  }

  const genAI = new GoogleGenAI({ apiKey: API_KEY });
  
  // Modelos a intentar en orden de preferencia
  const modelsToTry = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro"
  ];

  for (const modelName of modelsToTry) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          temperature: 0.2, // Baja temperatura para respuestas más consistentes y técnicas
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        try {
          return JSON.parse(cleanJsonString(text));
        } catch (parseError) {
          console.error(`Error parseando JSON del modelo ${modelName}:`, parseError);
          // Intentamos con el siguiente modelo si el JSON es inválido
        }
      }
    } catch (error: any) {
      console.error(`Error con modelo ${modelName}:`, error.message);
      // Si es un error de cuota o modelo no encontrado, seguimos con el siguiente
      if (error.message?.includes("429") || error.message?.includes("404")) {
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
