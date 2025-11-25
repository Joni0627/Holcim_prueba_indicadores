export interface Machine {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'maintenance' | 'idle';
  location: string;
  type: 'palletizer' | 'bagger' | 'wrapper' | 'other';
}

export interface ProductionMetrics {
  timestamp: string;
  producedUnits: number;
  targetUnits: number;
  defects: number;
  machineId: string;
}

export interface DowntimeEvent {
  id: string;
  reason: string; // Mapped from 'TEXTO DE CAUSA'
  durationMinutes: number;
  machineId: string; // Mapped from 'MÁQUINA AFECTADA'
  category: string; // Mapped from 'CAUSA SAP'
  
  // New specific SAP fields
  date: string; // FECHA
  shift: string; // TURNO
  hac: string; // HAC
  hacDetail: string; // DETALLE HAC
  downtimeType?: string; // TIPO PARO (Interno/Externo)
  sapCause?: string; // Mapped from 'CAUSA SAP'
  
  timestamp: string; // ISO String for internal use
}

export interface OEEData {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

// New Interface for specific shift details
export interface ShiftMetric {
  machineId: string;
  machineName: string;
  shift: 'Mañana' | 'Tarde' | 'Noche' | 'Noche Fin';
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface StockItem {
  id: string;
  materialName: string;
  sku: string;
  currentLevel: number;
  minLevel: number;
  maxLevel: number;
  unit: string;
  status: 'ok' | 'low' | 'critical' | 'overstock';
}

export interface BreakageEvent {
  id: string;
  machineId: string;
  timestamp: string;
  type: 'sellado' | 'mordida' | 'reventado' | 'material_defectuoso';
  count: number;
}

export interface DashboardState {
  selectedMachine: string | 'all';
  dateRange: 'shift' | 'day' | 'week';
  lastUpdated: Date;
}

export interface AIAnalysisResult {
  insight: string;
  recommendations: string[];
  priority: 'low' | 'medium' | 'high';
}