
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
    [key: string]: number | string; // Dynamic provider keys (using safeIds)
}

export interface BreakageStats {
  totalProduced: number;
  totalBroken: number;
  globalRate: number; // Percentage
  bySector: { name: string; value: number; percentage: number }[]; 
  byProvider: { 
    id: string; // Safe Key for Recharts
    name: string; 
    produced: number; 
    broken: number; 
    rate: number; // Percentage
  }[];
  byMaterial: {
    id: string; // Safe Key for Recharts
    name: string;
    produced: number;
    broken: number;
    rate: number;
    // Flattened Breakdown for Stacked Bar Chart compatibility
    sector_Ensacadora: number;
    sector_NoEmboquillada: number;
    sector_Ventocheck: number;
    sector_Transporte: number;
  }[];
  history: BreakageHistoryItem[]; 
}

export interface StockItem {
  id: string;
  product: string;
  quantity: number; // From 'CANTIDAD'
  tonnage: number; // From 'TN' (Count) + 'TN' (Production Night)
  isProduced: boolean; // True for the 4 special cements
  lastUpdated: string;
}

export interface StockStats {
  date: string; // Date of the count
  items: StockItem[];
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
