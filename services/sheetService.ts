import { DowntimeEvent } from "../types";
import { getDowntimeRanking } from "./mockData";

// Helper to normalize categories from Spanish Sheet data to App types
const normalizeCategory = (cat: string): 'technical' | 'organizational' | 'quality' | 'maintenance' => {
  if (!cat) return 'technical';
  const lower = cat.toLowerCase();
  
  if (lower.includes('mec') || lower.includes('elec') || lower.includes('sensor') || lower.includes('falla')) return 'technical';
  if (lower.includes('org') || lower.includes('espera') || lower.includes('falta')) return 'organizational';
  if (lower.includes('calidad') || lower.includes('rotura') || lower.includes('defect')) return 'quality';
  if (lower.includes('limpieza') || lower.includes('mantenimiento')) return 'maintenance';
  
  return 'technical'; // Default
};

export const fetchDowntimes = async (date: Date): Promise<DowntimeEvent[]> => {
  try {
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Call our Next.js API Route
    const res = await fetch(`/api/paros?fecha=${formattedDate}`);
    
    if (!res.ok) {
        console.warn("API returned error, using fallback data");
        // If API fails (e.g. locally without keys), return empty or fallback
        return [];
    }

    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Map Raw Sheet Data to App Type
    return data.map((row: any, index: number) => ({
        id: `sheet-${index}-${Date.now()}`,
        reason: row['MOTIVO'] || 'Sin motivo especificado',
        durationMinutes: Math.round((row.duracion || 0) / 60), // Convert seconds to minutes
        machineId: row['MÁQUINA'] || row['MAQUINA'] || 'Unknown',
        category: normalizeCategory(row['CATEGORÍA'] || row['CATEGORIA'] || ''),
        timestamp: new Date().toISOString() // API doesn't return time, so we default
    }));

  } catch (error) {
    console.error("Failed to fetch downtimes from sheet:", error);
    return [];
  }
};
