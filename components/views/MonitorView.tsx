
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
  longestEvent: DowntimeEvent | null
}> = ({ shiftKey, machineId, events, longestEvent }) => {
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

const CircularProgress: React.FC<{ value: number, label: string, size?: number, strokeWidth?: number, color?: string, showValue?: boolean }> = ({ value, label, size = 60, strokeWidth = 6, color = "text-emerald-500", showValue = true }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value * circumference);

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-800/50"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference, opacity: 0.5 }}
          animate={{ strokeDashoffset: offset, opacity: 1 }}
          transition={{ 
            duration: 2, 
            ease: [0.4, 0, 0.2, 1],
            delay: 0.2,
            repeat: Infinity,
            repeatDelay: 8
          }}
          strokeLinecap="round"
          filter="url(#glow)"
          className={color}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference, opacity: 0 }}
          animate={{ 
            strokeDashoffset: offset,
            opacity: [0, 0.3, 0]
          }}
          transition={{ 
            strokeDashoffset: { 
              duration: 2, 
              ease: [0.4, 0, 0.2, 1], 
              delay: 0.2,
              repeat: Infinity,
              repeatDelay: 8
            },
            opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          strokeLinecap="round"
          filter="url(#glow)"
          className={`${color} blur-[4px]`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && <span className="text-[11px] font-black leading-none text-white">{(value * 100).toFixed(0)}%</span>}
        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">{label}</span>
      </div>
    </div>
  );
};

export const MonitorView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const [currentDowntimePage, setCurrentDowntimePage] = useState(0);
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

  // Cycle downtime pages every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDowntimePage((prev) => prev + 1);
    }, 10000);
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
    const order = ["CPF 40", "CPC 30", "MAESTRO", "RAPIDO"];
    return stockResult.items
      .filter(i => i.isProduced)
      .sort((a, b) => {
        const nameA = a.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const nameB = b.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const indexA = order.findIndex(o => nameA.includes(o));
        const indexB = order.findIndex(o => nameB.includes(o));
        
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
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

  const allDowntimesOrdered = useMemo(() => {
    return [...downtimeResult]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .map((d, idx) => ({
        rank: idx + 1,
        shift: getVisualShift(d.startTime || '00:00').split('.')[1] || getVisualShift(d.startTime || '00:00'),
        hac: d.downtimeType || 'S/HAC',
        reason: d.reason.length > 35 ? d.reason.substring(0, 35) + '...' : d.reason,
        fullName: d.reason,
        duration: d.durationMinutes,
        machine: d.machineId
      }));
  }, [downtimeResult]);

  const ITEMS_PER_PAGE = 5;
  const paginatedDowntimes = useMemo(() => {
    if (allDowntimesOrdered.length === 0) return [];
    const totalPages = Math.ceil(allDowntimesOrdered.length / ITEMS_PER_PAGE);
    const page = currentDowntimePage % totalPages;
    return allDowntimesOrdered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  }, [allDowntimesOrdered, currentDowntimePage]);

  const globalKPIs = useMemo(() => {
    if (!prodResult?.details || prodResult.details.length === 0) return { oee: 0, availability: 0, performance: 0 };
    const count = prodResult.details.length;
    return {
      oee: prodResult.details.reduce((acc, curr) => acc + curr.oee, 0) / count,
      availability: prodResult.details.reduce((acc, curr) => acc + curr.availability, 0) / count,
      performance: prodResult.details.reduce((acc, curr) => acc + curr.performance, 0) / count,
    };
  }, [prodResult]);

  const machineKPIs = useMemo(() => {
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    return machines.map(m => {
      const machineDetails = prodResult?.details?.filter(d => d.machineId === m) || [];
      const totalTn = machineDetails.reduce((acc, curr) => acc + (curr.valueTn || 0), 0);
      if (machineDetails.length === 0) return { id: m, oee: 0, availability: 0, performance: 0, totalTn: 0 };
      const count = machineDetails.length;
      return {
        id: m,
        oee: machineDetails.reduce((acc, curr) => acc + curr.oee, 0) / count,
        availability: machineDetails.reduce((acc, curr) => acc + curr.availability, 0) / count,
        performance: machineDetails.reduce((acc, curr) => acc + curr.performance, 0) / count,
        totalTn
      };
    });
  }, [prodResult]);

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
      
      {/* Top Bar: Title, Date, Time, and Stocks */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 border-b border-blue-400/30 px-6 py-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative z-10">
        <div className="flex items-center gap-6">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 group flex items-center gap-2"
            >
              <ArrowLeft size={18} className="text-white/70 group-hover:text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/70 group-hover:text-white">Volver</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl shadow-lg">
              <Layout size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-white">Monitor de Producción</h1>
              <p className="text-emerald-400 font-bold uppercase text-[8px] tracking-[0.2em] mt-0.5">Expedición Malagueño | Tiempo Real</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2"></div>
          <div className="flex flex-col items-start">
            <p className="text-xl font-black tracking-tighter font-mono leading-none text-white">
              {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-white/50 font-bold uppercase tracking-widest text-[8px] mt-0.5">
              {currentTime.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-6">
            {producedStock.map(item => (
              <div key={item.id} className="flex flex-col items-center bg-black/20 px-4 py-1.5 rounded-xl border border-white/5 backdrop-blur-md">
                <span className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-0.5">{item.product.replace('CEMENTO ', '')}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white tracking-tighter leading-none">
                    {Math.floor(item.tonnage).toLocaleString()}
                  </span>
                  <span className="text-[8px] text-blue-300 font-black uppercase">Tn</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        {/* KPI Header Section */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex-1 flex items-center gap-8">
            {/* Global KPIs */}
            <div className="bg-slate-900/40 p-3 rounded-3xl border border-slate-800/50 shadow-inner flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">KPIs Globales</span>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <CircularProgress value={globalKPIs.oee} label="OEE" size={85} strokeWidth={10} color="text-emerald-400" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <CircularProgress value={globalKPIs.availability} label="DISP" size={55} strokeWidth={6} color="text-blue-400" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <CircularProgress value={globalKPIs.performance} label="REND" size={55} strokeWidth={6} color="text-amber-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Machine KPIs & Totalizers */}
            <div className="flex-1 flex items-center gap-3 border-l border-slate-800 pl-8">
              {machineKPIs.map(m => (
                <div key={m.id} className="flex-1 bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50 flex flex-col items-center gap-2 shadow-xl">
                  <div className="flex justify-between items-center w-full border-b border-slate-800 pb-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {m.id}
                    </span>
                    <div className="flex flex-col items-end">
                      <span className="text-[12px] font-black text-emerald-400 tracking-tighter leading-none">
                        {Math.floor(m.totalTn).toLocaleString()}
                      </span>
                      <span className="text-[6px] font-black text-slate-500 uppercase tracking-tighter">TOTAL TN</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CircularProgress value={m.oee} label="OEE" size={42} strokeWidth={5} color="text-emerald-500" />
                    <CircularProgress value={m.availability} label="DISP" size={42} strokeWidth={5} color="text-blue-500" />
                    <CircularProgress value={m.performance} label="REND" size={42} strokeWidth={5} color="text-amber-500" />
                  </div>
                </div>
              ))}
            </div>

            {/* Top Downtimes List (Relocated) */}
            <div className="w-[450px] bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50 flex flex-col shadow-xl border-l-4 border-l-red-500/50">
              <div className="flex justify-between items-center mb-2">
                <p className="text-red-400 font-black uppercase tracking-[0.2em] text-[9px] flex items-center gap-2">
                  <AlertCircle size={12} /> Ranking de Paros (Minutos)
                </p>
                {allDowntimesOrdered.length > ITEMS_PER_PAGE && (
                  <span className="text-[8px] font-bold text-slate-500 uppercase">
                    Pág {(currentDowntimePage % Math.ceil(allDowntimesOrdered.length / ITEMS_PER_PAGE)) + 1} / {Math.ceil(allDowntimesOrdered.length / ITEMS_PER_PAGE)}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="text-slate-500 uppercase font-black border-b border-slate-800">
                      <th className="text-left pb-1 w-6">#</th>
                      <th className="text-left pb-1">Turno</th>
                      <th className="text-left pb-1">HAC</th>
                      <th className="text-left pb-1">Motivo</th>
                      <th className="text-right pb-1">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDowntimes.map((d, idx) => (
                      <tr key={idx} className="border-b border-slate-800/30 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="py-1.5 text-slate-500 font-black">{d.rank}</td>
                        <td className="py-1.5 text-slate-400 font-bold uppercase">{d.shift}</td>
                        <td className="py-1.5 text-blue-400 font-black">{d.hac}</td>
                        <td className="py-1.5 text-slate-300 font-bold truncate max-w-[180px]" title={d.fullName}>
                          {d.reason}
                        </td>
                        <td className="py-1.5 text-right text-red-400 font-black">
                          {d.duration}
                        </td>
                      </tr>
                    ))}
                    {paginatedDowntimes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500 italic">Sin paros registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
          
          {/* Left Column: Ranking */}
          <div className="col-span-4 flex flex-col gap-6 overflow-hidden">
            
            {/* Ranking Card (Expanded) */}
            <div className="flex-1 bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Trophy size={150} />
              </div>
              <p className="text-amber-500 font-black uppercase tracking-[0.2em] text-sm mb-6 flex items-center gap-3">
                <Trophy size={18} /> Ranking de Producción por Turno
              </p>
              
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar">
                {prodResult?.byShift && prodResult.byShift.length > 0 ? (
                  [...prodResult.byShift]
                    .sort((a, b) => b.valueTn - a.valueTn)
                    .map((shift, idx) => {
                      const isTop = idx === 0;
                      return (
                        <div 
                          key={shift.name} 
                          className={`relative group transition-all duration-500 p-5 rounded-2xl border ${
                            isTop 
                              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                              : 'bg-slate-800/30 border-slate-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-5">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                                idx === 0 ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 
                                idx === 1 ? 'bg-slate-300 text-slate-900' : 
                                idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className={`font-black uppercase tracking-tighter ${isTop ? 'text-white text-xl' : 'text-slate-400 text-sm'}`}>
                                  {shift.name.split('.')[1] || shift.name}
                                </p>
                                <p className="text-[11px] font-bold text-red-500/70 uppercase tracking-tighter mt-1">
                                  Paros: {downtimeByShift[shift.name] || 0} min
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-black tracking-tighter ${isTop ? 'text-emerald-400 text-3xl' : 'text-slate-300 text-xl'}`}>
                                {Math.floor(shift.valueTn).toLocaleString()}
                                <span className="text-xs font-bold text-slate-500 ml-1 uppercase">Tn</span>
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
          </div>

          {/* Right Column: Timeline */}
          <div className="col-span-8 bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-6">
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
                  className="h-full flex flex-col"
                >
                  <div className="flex-1 flex flex-col gap-4">
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
                    <div className="flex-1 flex flex-col justify-around min-h-0">
                      {Object.entries(groupedTimeline[shiftsOrdered[currentShiftIndex]] || {}).map(([machine, data]) => {
                        return (
                          <div key={machine} className="w-full">
                            <MonitorTimelineBar 
                              shiftKey={shiftsOrdered[currentShiftIndex]} 
                              machineId={machine} 
                              events={data.events} 
                              longestEvent={data.longestEvent}
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
