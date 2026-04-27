
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
  startTime?: string; // HORA (HH:mm) - New for Timeline
  hac: string; // HAC
  hacDetail: string; // DETALLE HAC
  downtimeType?: string; // TIPO PARO (Interno/Externo)
  sapCause?: string; // Mapped from 'CAUSA SAP'
  operatorName?: string; // Mapped from 'USUARIO' join 'USUARIOS'
  
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
  shift: string; 
  date?: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  valueTn?: number;
  valueBags?: number;
  hsMarcha?: number;
  hac?: string;
}

export interface ProductionStats {
  totalBags: number;
  totalTn: number; 
  byShift: { name: string; value: number; valueTn: number; valueBags: number; target: number }[];
  byMachine: { name: string; value: number; valueTn: number }[]; 
  byMachineProduct: { name: string; [key: string]: number | string }[];
  details: ShiftMetric[];
}

export interface BreakageHistoryItem {
    date: string; 
    [key: string]: number | string; 
}

export interface BreakageStats {
  totalProduced: number;
  totalBroken: number;
  globalRate: number; 
  bySector: { name: string; value: number; percentage: number }[]; 
  byProvider: { 
    id: string; 
    name: string; 
    produced: number; 
    broken: number; 
    rate: number; 
  }[];
  byMaterial: {
    id: string; 
    name: string;
    produced: number;
    broken: number;
    rate: number;
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
  quantity: number; 
  tonnage: number; 
  isProduced: boolean; 
  lastUpdated: string;
}

export interface StockStats {
  date: string; 
  items: StockItem[];
}

export interface BreakageEvent {
  id: string;
  machineId: string;
  timestamp: string;
  type: 'sellado' | 'mordida' | 'reventado' | 'material_defectuoso';
  count: number;
}

export interface RankingData {
  summary: {
    production: {
      totalTN: number;
      topOperator: string;
      topPalletizer: string;
      avgTN: number;
      recordCount?: number;
    };
    downtime: {
      totalDuration: number;
      totalCount: number;
      mostFreqCause: string;
      mostFreqEquipment: string;
      topOperator: string;
      topMachine: string;
    };
  };
  productionRankings: {
    byOperator: { name: string; value: number }[];
    byPalletizer: { name: string; value: number }[];
  };
  downtimeRankings: {
    byOperator: { name: string; duration: number; count: number }[];
    byMachine: { name: string; duration: number; count: number }[];
    byCause: { name: string; duration: number; count: number }[];
    byEquipment: { name: string; duration: number; count: number }[];
    byType?: { name: string; duration: number; count: number }[];
    combinations: {
      operatorMachine: { name: string; duration: number; count: number }[];
      machineCause: { name: string; duration: number; count: number }[];
      equipmentCause: { name: string; duration: number; count: number }[];
      operatorEquipment: { name: string; duration: number; count: number }[];
    };
  };
  availableFilters?: {
    operators: string[];
    downtimeTypes: string[];
  };
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

export interface ShiftNews {
  id: string;
  date: string;
  shift: string;
  detail: string;
}
