
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
  shift: string; // Changed from literal union to string to accept API values
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface ProductionStats {
  totalBags: number;
  totalTn: number; // New field for Total Tons
  byShift: { name: string; value: number; target: number }[];
  byMachine: { name: string; value: number; valueTn: number }[]; // Added valueTn
  details: ShiftMetric[];
}

// Interface for Historical Evolution Chart
export interface BreakageHistoryItem {
    date: string; // DD/MM
    [key: string]: number | string; // Dynamic provider keys
}

export interface BreakageStats {
  totalProduced: number;
  totalBroken: number;
  globalRate: number; // Percentage
  bySector: { name: string; value: number; percentage: number }[]; // Added percentage relative to total broken
  byProvider: { 
    name: string; 
    produced: number; 
    broken: number; 
    rate: number; // Percentage
  }[];
  byMaterial: {
    name: string;
    produced: number;
    broken: number;
    rate: number;
    // New breakdown for Stacked Bar Chart
    sectors: {
        Ensacadora: number;
        NoEmboquillada: number;
        Ventocheck: number;
        Transporte: number;
    };
  }[];
  history: BreakageHistoryItem[]; // New field for evolution chart
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
