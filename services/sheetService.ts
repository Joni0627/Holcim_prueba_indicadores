
import { DowntimeEvent, ProductionStats, BreakageStats } from "../types";

export const fetchDowntimes = async (start: Date, end: Date): Promise<DowntimeEvent[]> => {
  try {
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    // Call API with Range
    const res = await fetch(`/api/paros?start=${startStr}&end=${endStr}`);
    
    if (!res.ok) {
        console.warn("API returned error, using empty data");
        return [];
    }

    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Map Raw API Data to App Types
    return data.map((row: any) => ({
        id: row.id,
        reason: row.reason || 'Sin motivo',
        durationMinutes: row.durationMinutes || 0,
        machineId: row.machineId || 'Desconocida',
        category: row.sapCause || 'Otros', // Map SAP CAUSE to category for charts
        
        // New fields
        date: row.date,
        shift: row.shift,
        hac: row.hac,
        hacDetail: row.hacDetail,
        sapCause: row.sapCause,
        downtimeType: row.downtimeType,
        
        timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error("Failed to fetch downtimes from sheet:", error);
    return [];
  }
};

export const fetchProductionStats = async (start: Date, end: Date): Promise<ProductionStats | null> => {
    try {
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const res = await fetch(`/api/production?start=${startStr}&end=${endStr}`);
        
        if (!res.ok) return null;

        const data = await res.json();
        return data as ProductionStats;
    } catch (error) {
        console.error("Failed to fetch production stats:", error);
        return null;
    }
};

export const fetchBreakageStats = async (start: Date, end: Date): Promise<BreakageStats | null> => {
    try {
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const res = await fetch(`/api/breakage?start=${startStr}&end=${endStr}`);
        
        if (!res.ok) return null;

        const data = await res.json();
        return data as BreakageStats;
    } catch (error) {
        console.error("Failed to fetch breakage stats:", error);
        return null;
    }
};
