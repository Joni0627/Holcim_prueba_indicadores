
import { DowntimeEvent, ProductionStats, BreakageStats, StockStats } from "../types";

export const fetchDowntimes = async (start: Date, end: Date): Promise<DowntimeEvent[]> => {
  try {
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    // Llamada a la API con el rango de fechas
    const res = await fetch(`/api/paros?start=${startStr}&end=${endStr}`);
    
    if (!res.ok) {
        console.warn("La API devolvió un error, se usará un arreglo vacío");
        return [];
    }

    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Mapeo de datos brutos de la API a los tipos de la aplicación
    return data.map((row: any) => ({
        id: row.id,
        reason: row.reason || 'Sin motivo',
        durationMinutes: row.durationMinutes || 0,
        machineId: row.machineId || 'Desconocida',
        category: row.sapCause || 'Otros',
        
        // Campos específicos para el cronograma y tabla detallada
        date: row.date,
        shift: row.shift,
        startTime: row.startTime, // CRÍTICO: Asegurar que este campo pase al front
        hac: row.hac,
        hacDetail: row.hacDetail,
        sapCause: row.sapCause,
        downtimeType: row.downtimeType,
        
        timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error("Error al obtener paros de la hoja:", error);
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
        console.error("Error al obtener estadísticas de producción:", error);
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
        console.error("Error al obtener estadísticas de roturas:", error);
        return null;
    }
};

export const fetchStocks = async (start: Date, end: Date): Promise<StockStats | null> => {
    try {
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const res = await fetch(`/api/stocks?start=${startStr}&end=${endStr}`);
        
        if (!res.ok) return null;

        const data = await res.json();
        return data as StockStats;
    } catch (error) {
        console.error("Error al obtener stocks:", error);
        return null;
    }
};
