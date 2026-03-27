
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout, ArrowLeft, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchDowntimes, fetchProductionStats, fetchStocks, fetchTopRecords } from '../../services/sheetService';
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

const isMachineMatch = (id1: string, id2: string) => {
  const s1 = String(id1 || '').toUpperCase();
  const s2 = String(id2 || '').toUpperCase();
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  // Extract numbers (e.g., 672, 673, 674)
  const n1 = s1.match(/\d+/)?.[0];
  const n2 = s2.match(/\d+/)?.[0];
  if (n1 && n2 && n1 === n2) return true;
  
  return false;
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
  
  const totalMins = config?.duration || 480;
  const shiftStartMin = (config?.start || 0) * 60;

  const blocks = useMemo(() => {
    if (!config) return [];
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
  }, [events, config, shiftStartMin, totalMins]);

  if (!config) return null;

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
      <div className="w-full h-4 bg-slate-800/50 rounded-lg flex overflow-hidden border border-slate-700/30 shadow-inner">
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

export const MonitorView: React.FC<{ 
  onBack?: () => void,
  dateRange: { start: Date, end: Date },
  setDateRange: (range: { start: Date, end: Date }) => void
}> = ({ onBack, dateRange, setDateRange }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const [currentDowntimePage, setCurrentDowntimePage] = useState(0);
  
  const selectedDate = useMemo(() => dateRange.start, [dateRange.start]);

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
    queryKey: ['monitor-prod', selectedDate.toISOString()],
    queryFn: async () => {
      return fetchProductionStats(selectedDate, selectedDate);
    },
    refetchInterval: 1200000, // 20 minutes
  });

  const { data: downtimeResult = [], isLoading: loadingDowntime } = useQuery({
    queryKey: ['monitor-downtimes', selectedDate.toISOString()],
    queryFn: async () => {
      return fetchDowntimes(selectedDate, selectedDate);
    },
    refetchInterval: 1200000,
  });

  const { data: stockResult, isLoading: loadingStock } = useQuery({
    queryKey: ['monitor-stocks', selectedDate.toISOString()],
    queryFn: () => fetchStocks(selectedDate, selectedDate),
    refetchInterval: 1200000,
  });

  // Update lastUpdated when data changes
  useEffect(() => {
    if (prodResult || downtimeResult.length > 0 || stockResult) {
      setLastUpdated(new Date());
    }
  }, [prodResult, downtimeResult, stockResult]);

  const toLocalISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = useMemo(() => toLocalISO(selectedDate), [selectedDate]);
  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    return toLocalISO(d);
  }, [selectedDate]);

  const unifiedProd = useMemo(() => {
    return prodResult;
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
      if (result[visualShift]) {
        const machineKey = Object.keys(result[visualShift]).find(m => 
          isMachineMatch(curr.machineId, m) || isMachineMatch(curr.hac, m)
        );
        
        if (machineKey) {
          result[visualShift][machineKey].events.push(curr);
          
          const currentLongest = result[visualShift][machineKey].longestEvent;
          if (!currentLongest || curr.durationMinutes > currentLongest.durationMinutes) {
            result[visualShift][machineKey].longestEvent = curr;
          }
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
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    const result: any[] = [];

    machines.forEach(m => {
      const machineDowntimes = downtimeResult
        .filter(d => isMachineMatch(d.machineId, m) && (d.downtimeType || '').toLowerCase().includes('interno'))
        .sort((a, b) => b.durationMinutes - a.durationMinutes)
        .slice(0, 5);
      
      machineDowntimes.forEach((d, idx) => {
        result.push({
          rank: idx + 1,
          shift: getVisualShift(d.startTime || '00:00').split('.')[1] || getVisualShift(d.startTime || '00:00'),
          hac: d.hac || 'S/HAC',
          reason: d.reason.length > 25 ? d.reason.substring(0, 25) + '...' : d.reason,
          fullName: d.reason,
          duration: d.durationMinutes,
          machine: m // Use the matched machine ID from our list
        });
      });
    });

    return result;
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

  const getTnColor = (machineId: string, tn: number) => {
    return 'text-white';
  };

  const getPerformanceColor = (val: number) => {
    return 'text-emerald-500';
  };

  const getAvailabilityColor = (val: number) => {
    return 'text-emerald-500';
  };

  const machineKPIs = useMemo(() => {
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    return machines.map(m => {
      // Use even more flexible matching for machine IDs
      const machineDetails = unifiedProd?.details?.filter(d => 
        isMachineMatch(d.machineId, m) || isMachineMatch(d.machineName, m)
      ) || [];
      
      const totalTn = machineDetails.reduce((acc, curr) => acc + (curr.valueTn || 0), 0);
      if (machineDetails.length === 0) return { id: m, oee: 0, availability: 0, performance: 0, totalTn: 0 };
      const count = machineDetails.length;
      return {
        id: m,
        oee: machineDetails.reduce((acc, curr) => acc + (curr.oee || 0), 0) / count,
        availability: machineDetails.reduce((acc, curr) => acc + (curr.availability || 0), 0) / count,
        performance: machineDetails.reduce((acc, curr) => acc + (curr.performance || 0), 0) / count,
        totalTn
      };
    });
  }, [unifiedProd]);

  const shiftsOrdered = ['1.MAÑANA', '2.TARDE', '4.NOCHE FIN', '3.NOCHE'];

  const { data: topRecords = [], isLoading: loadingTop } = useQuery({
    queryKey: ['monitor-top-records'],
    queryFn: () => fetchTopRecords(3),
    refetchInterval: 3600000, // 1 hour
  });

  if (loadingProd || loadingDowntime || loadingStock || loadingTop) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={64} />
        <p className="text-xl font-black uppercase tracking-[0.3em]">Cargando Monitor de Planta...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0f1e] text-white flex flex-col overflow-hidden z-[60]">
      <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
      
      {/* Top Bar: Title, Date, Time, and Stocks */}
      <div className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-2xl relative z-10">
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
              <h1 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">MONITOR DE PRODUCTIVIDAD</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
                <span className="text-[8px] font-bold text-emerald-400/60 uppercase tracking-widest border-l border-white/10 pl-2">
                  Actualizado: {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2"></div>
          <div className="flex flex-col items-start">
            <p className="text-xl font-black tracking-tighter font-mono leading-none text-white">
              {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="flex items-center gap-2 mt-1">
               <p className="text-white/50 font-bold uppercase tracking-widest text-[8px]">
                 {currentTime.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
               </p>
               <input 
                 type="date" 
                 value={toLocalISO(selectedDate)}
                 onChange={(e) => {
                   const newDate = new Date(e.target.value + 'T12:00:00');
                   setDateRange({ start: newDate, end: newDate });
                 }}
                 className="bg-white/5 border border-white/10 rounded px-1 text-[8px] font-black uppercase tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500/50"
               />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-6">
            {producedStock.map(item => (
              <div key={item.id} className="flex flex-col items-center bg-black/30 px-6 py-2 rounded-2xl border border-white/10 backdrop-blur-xl shadow-lg">
                <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.15em] mb-1">{item.product.replace('CEMENTO ', '')}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white tracking-tighter leading-none">
                    {Math.floor(item.tonnage).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-blue-300 font-black uppercase">Tn</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 overflow-hidden min-h-0">
        {/* KPI Header Section */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 lg:pb-6 flex-shrink-0">
          <div className="flex-1 flex items-center gap-4 lg:gap-8 overflow-x-auto no-scrollbar">
            {/* Machine KPIs & Totalizers */}
            <div className="flex-1 flex items-center gap-4">
              {machineKPIs.map(m => (
                <div key={m.id} className="flex-1 bg-white/[0.03] backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-6 min-w-[220px] relative overflow-hidden group hover:bg-white/[0.05] transition-all">
                  <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Paletizadora</span>
                      <span className="text-xl font-black text-white uppercase tracking-tight mt-1">
                        {m.id.split('-')[0]}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-emerald-500/70 uppercase tracking-tighter">Total Hoy</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-emerald-400 tracking-tighter leading-none">
                          {Math.floor(m.totalTn).toLocaleString()}
                        </span>
                        <span className="text-xs font-black text-slate-500 uppercase">Tn</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                      <CircularProgress 
                        value={m.oee} 
                        label="OEE" 
                        size={72} 
                        strokeWidth={8} 
                        color="text-amber-500" 
                      />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OEE</span>
                    </div>
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                      <CircularProgress 
                        value={m.availability} 
                        label="DISP" 
                        size={72} 
                        strokeWidth={8} 
                        color="text-blue-400" 
                      />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Disponibilidad</span>
                    </div>
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3 group-hover:bg-amber-500/10 group-hover:border-amber-500/20 transition-all">
                      <CircularProgress 
                        value={m.performance} 
                        label="REND" 
                        size={72} 
                        strokeWidth={8} 
                        color="text-emerald-400" 
                      />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rendimiento</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Downtimes List (Relocated) */}
            <div className="w-[450px] bg-white/[0.03] backdrop-blur-sm p-3 rounded-2xl border border-white/10 flex flex-col shadow-xl border-l-4 border-l-red-500/50 flex-shrink-0">
              <div className="flex justify-between items-center mb-2">
                <p className="text-red-400 font-black uppercase tracking-[0.2em] text-[9px] flex items-center gap-2">
                  <AlertCircle size={12} /> Top 5 Paros Internos por Máquina
                </p>
                <span className="text-[8px] font-bold text-slate-500 uppercase">
                  Pág {(currentDowntimePage % 3) + 1} / 3
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="text-slate-500 uppercase font-black border-b border-white/5">
                      <th className="text-left pb-1 w-6">#</th>
                      <th className="text-left pb-1">Máquina</th>
                      <th className="text-left pb-1">HAC</th>
                      <th className="text-left pb-1">Motivo</th>
                      <th className="text-right pb-1">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDowntimesOrdered
                      .filter(d => {
                        const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
                        const targetMachine = machines[currentDowntimePage % 3];
                        return d.machine === targetMachine;
                      })
                      .map((d, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="py-1.5 text-slate-500 font-black">{d.rank}</td>
                        <td className="py-1.5 text-slate-400 font-bold uppercase">{d.machine.split('-')[0]}</td>
                        <td className="py-1.5 text-blue-400 font-black">{d.hac}</td>
                        <td className="py-1.5 text-slate-300 font-bold truncate max-w-[150px]" title={d.fullName}>
                          {d.reason}
                        </td>
                        <td className="py-1.5 text-right text-red-400 font-black">
                          {d.duration}
                        </td>
                      </tr>
                    ))}
                    {allDowntimesOrdered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500 italic">Sin paros internos registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
          
          {/* Left Column: Ranking (Expanded to 7/12) */}
          <div className="col-span-7 flex flex-col gap-6 overflow-hidden">
            
            {/* Ranking Card (Expanded) */}
            <div className="flex-1 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-10 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Trophy size={220} />
              </div>
              <div className="flex flex-col gap-10 mb-12">
                <div className="flex items-center justify-between">
                  <p className="text-amber-500 font-black uppercase tracking-[0.2em] text-3xl flex items-center gap-5">
                    <Trophy size={42} /> Ranking de Producción
                  </p>
                  {topRecords[0] && (
                    <div className="flex items-center gap-4 bg-indigo-500/20 border border-indigo-500/30 px-8 py-3 rounded-full">
                      <div className="w-4 h-4 rounded-full bg-indigo-400 animate-pulse" />
                      <span className="text-base font-black text-indigo-300 uppercase tracking-widest">Récord Histórico: {Math.floor(topRecords[0].valueTn).toLocaleString()} Tn</span>
                    </div>
                  )}
                </div>

                {/* Today's Leader Highlight */}
                {unifiedProd?.byShift && unifiedProd.byShift.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-500/20 to-transparent border-l-[12px] border-amber-500 p-12 rounded-r-3xl shadow-2xl shadow-amber-500/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-black text-amber-500/70 uppercase tracking-widest leading-none mb-5">Líder del Día (Puesto 1)</p>
                        <p className="text-7xl font-black text-white uppercase tracking-tighter">
                          {([...unifiedProd.byShift].sort((a, b) => b.valueTn - a.valueTn)[0].name.split('.')[1] || [...unifiedProd.byShift].sort((a, b) => b.valueTn - a.valueTn)[0].name)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-8xl font-black text-emerald-400 tracking-tighter leading-none">
                          {Math.floor([...unifiedProd.byShift].sort((a, b) => b.valueTn - a.valueTn)[0].valueTn).toLocaleString()}
                          <span className="text-3xl font-bold text-slate-500 ml-3 uppercase">Tn</span>
                        </p>
                        {topRecords[0] && [...unifiedProd.byShift].sort((a, b) => b.valueTn - a.valueTn)[0].valueTn >= topRecords[0].valueTn && (
                          <span className="text-base font-black text-emerald-500 uppercase animate-bounce block mt-5">¡Récord Superado!</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col gap-5 overflow-y-auto no-scrollbar">
                <p className="text-base font-black text-slate-500 uppercase tracking-widest mb-4 px-1">Desempeño por Turno</p>
                {unifiedProd?.byShift && unifiedProd.byShift.length > 0 ? (
                  [...unifiedProd.byShift]
                    .sort((a, b) => b.valueTn - a.valueTn)
                    .map((shift, idx) => {
                      const isTop = idx === 0;
                      return (
                        <div 
                          key={shift.name} 
                          className={`relative group transition-all duration-500 p-8 rounded-2xl border ${
                            isTop 
                              ? 'bg-amber-500/10 border-amber-500/30' 
                              : 'bg-white/[0.03] border-white/5'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-8">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl ${
                                idx === 0 ? 'bg-amber-500 text-slate-900' : 
                                idx === 1 ? 'bg-slate-300 text-slate-900' : 
                                idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-slate-400'
                              }`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className={`font-black uppercase tracking-tighter ${isTop ? 'text-amber-500 text-3xl' : 'text-slate-400 text-2xl'}`}>
                                  {shift.name.split('.')[1] || shift.name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-black tracking-tighter ${isTop ? 'text-white text-5xl' : 'text-slate-400 text-3xl'}`}>
                                {Math.floor(shift.valueTn).toLocaleString()}
                                <span className="text-sm font-bold text-slate-500 ml-2 uppercase">Tn</span>
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

              {/* RÉCORD HISTÓRICO (TOP 1) */}
              <div className="mt-10 border-t border-white/5 pt-10">
                <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-base mb-8 flex items-center gap-4">
                  <Trophy size={28} /> Récord Histórico de Producción
                </p>
                <div className="grid grid-cols-1 gap-6">
                  {topRecords.length > 0 ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/30 p-10 rounded-3xl flex items-center justify-between group hover:bg-indigo-500/20 transition-all shadow-2xl shadow-indigo-500/10">
                      <div className="flex items-center gap-8">
                        <div className="w-20 h-20 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center font-black text-4xl shadow-2xl shadow-amber-500/30">
                          1
                        </div>
                        <div className="flex flex-col">
                          <span className="text-2xl font-black text-white uppercase tracking-wider leading-none">{topRecords[0].machineId}</span>
                          <span className="text-sm font-bold text-slate-400 uppercase mt-4 flex items-center gap-5">
                            <Calendar size={18} /> {topRecords[0].date} 
                            <span className="text-slate-600">•</span>
                            <Clock size={18} /> {topRecords[0].shift.split('.')[1] || topRecords[0].shift}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-3">
                          <span className="text-6xl font-black text-indigo-400 tracking-tighter">{Math.floor(topRecords[0].valueTn).toLocaleString()}</span>
                          <span className="text-lg font-bold text-slate-500 uppercase">Tn</span>
                        </div>
                        <p className="text-sm font-black text-indigo-500/70 uppercase tracking-widest mt-3">Máximo Histórico</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-600 italic text-sm">
                      Cargando récord...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Timeline (Reduced to 5/12) */}
          <div className="col-span-5 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col overflow-hidden">
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
                    <div className="flex-1 flex flex-col justify-around min-h-0 gap-2">
                      {Object.entries(groupedTimeline[shiftsOrdered[currentShiftIndex]] || {}).map(([machine, data]) => {
                        const machineProd = unifiedProd?.details?.find(d => d.machineId === machine && d.shift === shiftsOrdered[currentShiftIndex]);
                        return (
                          <div key={machine} className="w-full">
                            <div className="flex justify-between items-center mb-0.5 px-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{machine.split('-')[0]}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${getTnColor(machine, machineProd?.valueTn || 0)}`}>
                                {Math.floor(machineProd?.valueTn || 0).toLocaleString()} Tn
                              </span>
                            </div>
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
