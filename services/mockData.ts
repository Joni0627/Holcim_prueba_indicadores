import { Machine, DowntimeEvent, ProductionMetrics, OEEData, StockItem, BreakageEvent, ShiftMetric } from '../types';

// Specific Palletizers requested
export const machines: Machine[] = [
  { id: 'M01', name: 'MG.672-PZ1', status: 'running', location: 'Línea 1', type: 'palletizer' },
  { id: 'M02', name: '673-PZ1', status: 'stopped', location: 'Línea 2', type: 'palletizer' },
  { id: 'M03', name: '674-PZ1', status: 'running', location: 'Línea 3', type: 'palletizer' },
];

// Mock function to get production aggregated by Shift
export const getProductionByShift = () => {
  return [
    { name: 'Mañana', value: 12450, target: 13000 },
    { name: 'Tarde', value: 11200, target: 13000 },
    { name: 'Noche', value: 9800, target: 11000 },
    { name: 'Noche Fin', value: 3200, target: 4000 }, 
  ];
};

// Mock function to get production aggregated by Palletizer
export const getProductionByPalletizer = () => {
  return [
    { name: 'MG.672-PZ1', value: 14500 },
    { name: '673-PZ1', value: 10200 }, 
    { name: '674-PZ1', value: 12800 },
  ];
};

// NEW: Detailed metrics per machine per shift
export const getMachineShiftDetails = (): ShiftMetric[] => {
  const shifts: ('Mañana' | 'Tarde' | 'Noche' | 'Noche Fin')[] = ['Mañana', 'Tarde', 'Noche', 'Noche Fin'];
  const metrics: ShiftMetric[] = [];

  machines.forEach(machine => {
    shifts.forEach(shift => {
      // Base performance depends on machine status logic (M02 is stopped/worse)
      const basePerf = machine.id === 'M02' ? 0.6 : 0.85;
      
      // Random variation per shift
      const availability = Math.min(0.99, basePerf + Math.random() * 0.15);
      const performance = Math.min(0.98, basePerf + Math.random() * 0.1);
      const quality = Math.min(0.995, 0.95 + Math.random() * 0.04);
      
      metrics.push({
        machineId: machine.id,
        machineName: machine.name,
        shift: shift,
        availability: parseFloat(availability.toFixed(3)),
        performance: parseFloat(performance.toFixed(3)),
        quality: parseFloat(quality.toFixed(3)),
        oee: parseFloat((availability * performance * quality).toFixed(3))
      });
    });
  });

  return metrics;
};

export const getOEE = (machineId: string): OEEData => {
  const isStopped = machineId === 'M02' || machineId === '673-PZ1'; 
  const base = isStopped ? 0.65 : 0.85;
  return {
    availability: Math.min(0.98, base + Math.random() * 0.1),
    performance: Math.min(0.95, base + Math.random() * 0.05),
    quality: Math.min(0.99, 0.90 + Math.random() * 0.09),
    oee: 0 // Will be calc in component
  };
};

export const getDowntimeRanking = (machineId: string | 'all'): DowntimeEvent[] => {
  const reasons = [
    { reason: 'Falla Sensor Presión', category: 'technical' as const, base: 45 },
    { reason: 'Cambio de Formato', category: 'organizational' as const, base: 120 },
    { reason: 'Atasco de Material', category: 'technical' as const, base: 30 },
    { reason: 'Falta de Operador', category: 'organizational' as const, base: 15 },
    { reason: 'Ajuste de Calidad', category: 'quality' as const, base: 25 },
    { reason: 'Falla Eléctrica', category: 'technical' as const, base: 60 },
    { reason: 'Desalineación Pallet', category: 'technical' as const, base: 40 },
    { reason: 'Rotura Film Stretch', category: 'quality' as const, base: 20 },
    { reason: 'Falla Pinza Robot', category: 'technical' as const, base: 55 },
    { reason: 'Espera de Producto', category: 'organizational' as const, base: 35 },
    { reason: 'Limpieza Cabezal', category: 'maintenance' as const, base: 15 },
    { reason: 'Falla Comunicación PLC', category: 'technical' as const, base: 25 },
    { reason: 'Atasco Transportador', category: 'technical' as const, base: 40 },
  ];

  const now = new Date();

  return reasons.map((r, idx) => ({
    id: `evt-${idx}`,
    reason: r.reason,
    category: r.category,
    durationMinutes: Math.floor(r.base * (0.8 + Math.random() * 0.4)),
    machineId: machineId === 'all' ? 'M01' : machineId,
    timestamp: now.toISOString(),
    // New fields required by DowntimeEvent interface
    date: now.toLocaleDateString(),
    shift: 'Mañana',
    hac: 'HAC-MOCK',
    hacDetail: 'Detalle simulado'
  })).sort((a, b) => b.durationMinutes - a.durationMinutes);
};

export const getProductionHistory = (hours: number = 8): ProductionMetrics[] => {
  const data: ProductionMetrics[] = [];
  const now = new Date();
  for (let i = 0; i < hours; i++) {
    const time = new Date(now.getTime() - (hours - i) * 60 * 60 * 1000);
    data.push({
      timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      producedUnits: Math.floor(800 + Math.random() * 200),
      targetUnits: 950,
      defects: Math.floor(Math.random() * 20),
      machineId: 'all'
    });
  }
  return data;
};

export const getStocks = (): StockItem[] => [
  { id: 'S1', product: 'Cemento CPF 40', quantity: 1200, tonnage: 60, isProduced: true, lastUpdated: new Date().toISOString() },
  { id: 'S2', product: 'Cemento CPF 30', quantity: 8500, tonnage: 425, isProduced: true, lastUpdated: new Date().toISOString() },
  { id: 'S3', product: 'Film Stretch Auto', quantity: 45, tonnage: 0, isProduced: false, lastUpdated: new Date().toISOString() },
  { id: 'S4', product: 'Adhesivo Pallet', quantity: 150, tonnage: 0, isProduced: false, lastUpdated: new Date().toISOString() },
  { id: 'S5', product: 'Pallet Madera Std', quantity: 300, tonnage: 0, isProduced: false, lastUpdated: new Date().toISOString() },
];

export const getBreakageData = (): BreakageEvent[] => {
    const types = ['sellado', 'mordida', 'reventado', 'material_defectuoso'] as const;
    const data: BreakageEvent[] = [];
    const now = new Date();
    
    for(let i=0; i<20; i++) {
        data.push({
            id: `brk-${i}`,
            machineId: Math.random() > 0.5 ? 'M01' : 'M03',
            timestamp: new Date(now.getTime() - i * 30 * 60 * 1000).toISOString(), 
            type: types[Math.floor(Math.random() * types.length)],
            count: Math.floor(Math.random() * 5) + 1
        });
    }
    return data;
};
