
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchDowntimes, fetchProductionStats, fetchStocks } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats } from '../../types';

// REUSABLE CONFIG FROM TIMELINE
const SHIFT_MAP = {
  '1.MAÑANA': { duration: 480, start: 6, label: 'Mañana', color: 'emerald' },
  '2.TARDE': { duration: 480, start: 14, label: 'Tarde', color: 'blue' },
  '4.NOCHE FIN': { duration: 120, start: 22, label: 'Noche Fin', color: 'slate' },
  '3.NOCHE': { duration: 360, start: 0, label: 'Noche', color: 'indigo' }
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
};

const getVisualShift = (startTime: string) => {
    const mins = timeToMinutes(startTime);
    if (mins >= 360 && mins < 840) return '1.MAÑANA';
    if (mins >= 840 && mins < 1320) return '2.TARDE';
    if (mins >= 1320 && mins < 1440) return '4.NOCHE FIN';
    if (mins >= 0 && mins < 360) return '3.NOCHE';
    return '1.MAÑANA';
};

const MonitorTimelineBar: React.FC<{ 
  shiftKey: string, 
  machineId: string, 
  events: DowntimeEvent[], 
  longestEvent: DowntimeEvent | null,
  productionTn?: number
}> = ({ shiftKey, machineId, events, longestEvent, productionTn }) => {
  const config = SHIFT_MAP[shiftKey as keyof typeof SHIFT_MAP];
  if (!config) return null;
  
  const totalMins = config.duration;
  const shiftStartMin = config.start * 60;

  const blocks = useMemo(() => {
    const segments: { type: 'uptime' | 'downtime', duration: number, event?: DowntimeEvent }[] = [];
    let currentPos = 0;

    const sortedEvents = events
      .map(e => ({ ...e, relativeStart: timeToMinutes(e.startTime || '00:00') - shiftStartMin }))
      .filter(e => e.relativeStart >= 0 && e.relativeStart < totalMins)
      .sort((a, b) => a.relativeStart - b.relativeStart);

    sortedEvents.forEach(event => {
      if (event.relativeStart > currentPos) {
        segments.push({ type: 'uptime', duration: event.relativeStart - currentPos });
      }
      const duration = Math.min(event.durationMinutes, totalMins - event.relativeStart);
      segments.push({ type: 'downtime', duration, event });
      currentPos = event.relativeStart + duration;
    });

    if (currentPos < totalMins) {
      segments.push({ type: 'uptime', duration: totalMins - currentPos });
    }

    return segments;
  }, [events, config]);

  const getBlockColor = (block: any) => {
    if (block.type === 'uptime') return 'bg-emerald-500/60';
    const type = (block.event?.downtimeType || '').toLowerCase();
    if (type.includes('interno')) return 'bg-red-500';
    if (type.includes('externo')) return 'bg-slate-500';
    return 'bg-red-500'; 
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{machineId}</span>
          {productionTn !== undefined && (
            <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                {Math.floor(productionTn)} Tn
              </span>
            </div>
          )}
        </div>
        {longestEvent && (
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-tight">
              Paro Mayor: {longestEvent.reason} ({longestEvent.durationMinutes} min)
            </span>
          </div>
        )}
      </div>
      <div className="w-full h-6 bg-slate-800/50 rounded-lg flex overflow-hidden border border-slate-700/30 shadow-inner">
        {blocks.map((block, idx) => (
          <div 
            key={idx}
            className={`h-full border-r border-white/5 last:border-0 ${getBlockColor(block)}`}
            style={{ width: `${(block.duration / totalMins) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export const MonitorView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const today = useMemo(() => new Date(), []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cycle shifts every 15 seconds (increased slightly for readability)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentShiftIndex((prev) => (prev + 1) % 4);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Cycle stocks every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStockIndex((prev) => (prev + 1));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Queries with 20 min refresh
  const { data: prodResult, isLoading: loadingProd } = useQuery({
    queryKey: ['monitor-prod'],
    queryFn: () => fetchProductionStats(today, today),
    refetchInterval: 1200000, // 20 minutes
  });

  const { data: downtimeResult = [], isLoading: loadingDowntime } = useQuery({
    queryKey: ['monitor-downtimes'],
    queryFn: () => fetchDowntimes(today, today),
    refetchInterval: 1200000,
  });

  const { data: stockResult, isLoading: loadingStock } = useQuery({
    queryKey: ['monitor-stocks'],
    queryFn: () => fetchStocks(today, today),
    refetchInterval: 1200000,
  });

  const topShift = useMemo(() => {
    if (!prodResult?.byShift || prodResult.byShift.length === 0) return null;
    return [...prodResult.byShift].sort((a, b) => b.valueTn - a.valueTn)[0];
  }, [prodResult]);

  const producedStock = useMemo(() => {
    if (!stockResult?.items) return [];
    const order = ["CEMENTO MAESTRO", "CEMENTO CPF 40", "CEMENTO RAPIDO", "CEMENTO CPC 30"];
    return stockResult.items
      .filter(i => i.isProduced)
      .sort((a, b) => {
        const nameA = a.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const nameB = b.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return order.indexOf(nameA) - order.indexOf(nameB);
      });
  }, [stockResult]);

  // Get current stock to display (cycling)
  const displayStock = useMemo(() => {
    if (producedStock.length === 0) return null;
    return producedStock[currentStockIndex % producedStock.length];
  }, [producedStock, currentStockIndex]);

  const groupedTimeline = useMemo(() => {
    const baseMachines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    const result: Record<string, Record<string, { events: DowntimeEvent[], longestEvent: DowntimeEvent | null }>> = {};
    
    Object.keys(SHIFT_MAP).forEach((shift) => {
      result[shift] = {};
      baseMachines.forEach((m) => {
        result[shift][m] = { events: [], longestEvent: null };
      });
    });

    downtimeResult.forEach((curr) => {
      const visualShift = getVisualShift(curr.startTime || '00:00');
      if (result[visualShift] && result[visualShift][curr.machineId]) {
        result[visualShift][curr.machineId].events.push(curr);
        
        const currentLongest = result[visualShift][curr.machineId].longestEvent;
        if (!currentLongest || curr.durationMinutes > currentLongest.durationMinutes) {
          result[visualShift][curr.machineId].longestEvent = curr;
        }
      }
    });

    return result;
  }, [downtimeResult]);

  const downtimeByShift = useMemo(() => {
    const result: Record<string, number> = {};
    downtimeResult.forEach(d => {
      const shift = getVisualShift(d.startTime || '00:00');
      result[shift] = (result[shift] || 0) + d.durationMinutes;
    });
    return result;
  }, [downtimeResult]);

  const top10Downtimes = useMemo(() => {
    return [...downtimeResult]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .slice(0, 10)
      .map(d => ({
        name: `${d.machineId.split('-')[1] || d.machineId}: ${d.reason.length > 15 ? d.reason.substring(0, 15) + '...' : d.reason}`,
        fullName: d.reason,
        duration: d.durationMinutes,
        machine: d.machineId
      }));
  }, [downtimeResult]);

  const shiftsOrdered = ['1.MAÑANA', '2.TARDE', '4.NOCHE FIN', '3.NOCHE'];

  if (loadingProd || loadingDowntime || loadingStock) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={64} />
        <p className="text-xl font-black uppercase tracking-[0.3em]">Cargando Monitor de Planta...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-hidden z-[60]">
      
      {/* Discreet Top Stock Bar */}
      <div className="bg-slate-900/40 border-b border-slate-800/50 px-6 py-1.5 flex items-center gap-8 overflow-x-auto no-scrollbar backdrop-blur-md">
        <div className="flex items-center gap-2 text-slate-500 shrink-0">
          <Package size={12} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Stock Planta</span>
        </div>
        <div className="flex items-center gap-8">
          {producedStock.map(item => (
            <div key={item.id} className="flex items-center gap-3 shrink-0">
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{item.product}</span>
              <span className="text-xs font-black text-slate-300 tracking-tight">
                {Math.floor(item.tonnage).toLocaleString()} <span className="text-[9px] text-blue-500/50">Tn</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-6">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all border border-slate-700 group flex items-center gap-2"
              >
                <ArrowLeft size={24} className="text-slate-400 group-hover:text-white" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-white">Volver</span>
              </button>
            )}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-600 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <Layout size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Monitor de Producción</h1>
                <p className="text-emerald-500 font-bold uppercase text-xs tracking-widest mt-1">Expedición Malagueño | Tiempo Real</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black tracking-tighter font-mono leading-none">
              {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
              {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
          
          {/* Left Column: Ranking & Top Downtimes */}
          <div className="col-span-4 flex flex-col gap-6 overflow-hidden">
            
            {/* Ranking Card */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col h-[45%]">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Trophy size={100} />
              </div>
              <p className="text-amber-500 font-black uppercase tracking-[0.2em] text-xs mb-4 flex items-center gap-2">
                <Trophy size={14} /> Ranking de Producción
              </p>
              
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar">
                {prodResult?.byShift && prodResult.byShift.length > 0 ? (
                  [...prodResult.byShift]
                    .sort((a, b) => b.valueTn - a.valueTn)
                    .map((shift, idx) => {
                      const isTop = idx === 0;
                      return (
                        <div 
                          key={shift.name} 
                          className={`relative group transition-all duration-500 p-3 rounded-xl border ${
                            isTop 
                              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                              : 'bg-slate-800/30 border-slate-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] ${
                                idx === 0 ? 'bg-amber-500 text-slate-900' : 
                                idx === 1 ? 'bg-slate-300 text-slate-900' : 
                                idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className={`font-black uppercase tracking-tighter ${isTop ? 'text-white text-base' : 'text-slate-400 text-xs'}`}>
                                  {shift.name.split('.')[1] || shift.name}
                                </p>
                                <p className="text-[9px] font-bold text-red-500/70 uppercase tracking-tighter">
                                  Paros: {downtimeByShift[shift.name] || 0} min
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-black tracking-tighter ${isTop ? 'text-emerald-400 text-xl' : 'text-slate-300 text-base'}`}>
                                {Math.floor(shift.valueTn).toLocaleString()}
                                <span className="text-[10px] font-bold text-slate-500 ml-1 uppercase">Tn</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-500 italic text-sm">Calculando ranking...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top 10 Downtimes Chart */}
            <div className="flex-1 bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <p className="text-red-400 font-black uppercase tracking-[0.2em] text-xs flex items-center gap-2">
                  <AlertCircle size={14} /> Top 10 Paros (Minutos)
                </p>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top10Downtimes}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      tick={{ fill: '#64748b', fontSize: 8, fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ color: '#ef4444', fontWeight: 'bold' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                      {top10Downtimes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#ef444480'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <div className="col-span-8 bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Clock className="text-indigo-400" size={24} />
                <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-sm">Cronograma Diario de Operación</p>
              </div>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500/60 rounded-sm"></div> Operativo</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Paro</div>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={shiftsOrdered[currentShiftIndex]}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-white uppercase tracking-[0.3em] whitespace-nowrap">
                          {SHIFT_MAP[shiftsOrdered[currentShiftIndex] as keyof typeof SHIFT_MAP].label}
                        </span>
                        <div className="h-px w-32 bg-slate-800"></div>
                      </div>
                      <div className="flex gap-2">
                        {shiftsOrdered.map((_, idx) => (
                          <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentShiftIndex ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-800'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-8">
                      {Object.entries(groupedTimeline[shiftsOrdered[currentShiftIndex]] || {}).map(([machine, data]) => {
                        // Find production for this machine in this shift from details array
                        const shiftName = shiftsOrdered[currentShiftIndex];
                        const machineProd = prodResult?.details?.find(d => 
                          d.machineId === machine && d.shift === shiftName
                        )?.valueTn;

                        return (
                          <div key={machine} className="space-y-2">
                            <MonitorTimelineBar 
                              shiftKey={shiftsOrdered[currentShiftIndex]} 
                              machineId={machine} 
                              events={data.events} 
                              longestEvent={data.longestEvent}
                              productionTn={machineProd}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
