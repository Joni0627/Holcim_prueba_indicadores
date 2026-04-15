
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout, ArrowLeft, Calendar, MessageSquare, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, LabelList } from 'recharts';
import { fetchDowntimes, fetchProductionStats, fetchStocks, fetchTopRecords, fetchShiftNews } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats, ShiftNews } from '../../types';

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
  if (!id1 || !id2) return false;
  
  // User requested normalization (removes spaces)
  const s1 = String(id1).replace(/\s/g, '').toUpperCase();
  const s2 = String(id2).replace(/\s/g, '').toUpperCase();
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  // Fallback: aggressive normalization (removes all non-alphanumeric)
  const a1 = s1.replace(/[^A-Z0-9]/g, '');
  const a2 = s2.replace(/[^A-Z0-9]/g, '');
  if (!a1 || !a2) return false;
  return a1.includes(a2) || a2.includes(a1);
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
  events: DowntimeEvent[]
}> = ({ shiftKey, events }) => {
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

  const longestDowntime = useMemo(() => {
    const downtimeBlocks = blocks.filter(b => b.type === 'downtime' && b.event);
    if (downtimeBlocks.length === 0) return null;
    return downtimeBlocks.reduce((prev, curr) => (prev.duration > curr.duration ? prev : curr));
  }, [blocks]);

  if (!config) return null;

  const getBlockStyle = (block: any) => {
    if (block.type === 'uptime') return 'bg-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
    const type = (block.event?.downtimeType || '').toLowerCase();
    if (type.includes('interno')) return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
    if (type.includes('externo')) return 'bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.3)]';
    return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'; 
  };

  return (
    <div className="w-full h-10 lg:h-12 bg-white/5 rounded-md flex items-center border border-white/5 shadow-inner px-1 relative">
      {blocks.map((block, idx) => (
        <div 
          key={idx}
          className={`h-[80%] rounded-sm border-r border-white/5 last:border-0 transition-all ${getBlockStyle(block)} relative group`}
          style={{ width: `${(block.duration / totalMins) * 100}%` }}
        >
          {block === longestDowntime && block.duration > 15 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <span className="text-[9px] font-black text-white whitespace-nowrap px-1.5 py-0.5 bg-black/40 rounded backdrop-blur-sm border border-white/10 shadow-lg uppercase tracking-tighter">
                {block.event?.reason} ({block.duration} MIN)
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const normalizeShift = (shift: string) => {
  if (!shift) return '';
  const s = shift.toUpperCase();
  if (s.includes('MAÑANA')) return '1.MAÑANA';
  if (s.includes('TARDE')) return '2.TARDE';
  if (s.includes('NOCHE FIN')) return '4.NOCHE FIN';
  if (s.includes('NOCHE')) return '3.NOCHE';
  return shift;
};

const SemiCircleProgress: React.FC<{ 
  value: number, 
  label: string, 
  color?: string, 
  showValue?: boolean,
  suffix?: string,
  isRawValue?: boolean
}> = ({ value, label, color = "text-emerald-500", showValue = true, suffix = "%", isRawValue = false }) => {
  const radius = 40;
  const circumference = Math.PI * radius;
  const displayValue = isRawValue ? value : value * 100;
  const progressValue = isRawValue ? Math.min(value / 8, 1) : value; // HS Marcha max 8
  const dashOffset = circumference - (Math.min(Math.max(progressValue, 0), 1) * circumference);

  return (
    <div className="flex flex-col items-center justify-center relative w-full aspect-[2/1.1] overflow-hidden">
      <svg viewBox="0 0 100 55" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <path
          d="M 10,50 A 40,40 0 0 1 90,50"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-slate-800/50"
          strokeLinecap="round"
        />
        <motion.path
          d="M 10,50 A 40,40 0 0 1 90,50"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ 
            duration: 1.5, 
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 8.5
          }}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-center">
        {showValue && (
          <span className="text-[clamp(10px,1.2vw,16px)] font-black leading-none text-white">
            {displayValue.toFixed(isRawValue ? 1 : 0)}{suffix}
          </span>
        )}
        <span className="text-[clamp(10px,1vw,14px)] font-black text-slate-500 uppercase tracking-tighter mt-0.5">{label}</span>
      </div>
    </div>
  );
};

const CircularProgress: React.FC<{ value: number, label: string, size?: number, strokeWidth?: number, color?: string, showValue?: boolean }> = ({ value, label, size = 100, strokeWidth = 8, color = "text-emerald-500", showValue = true }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value * circumference);

  return (
    <div className="flex flex-col items-center justify-center relative w-full aspect-square max-w-[120px]">
      <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" className="transform -rotate-90 w-full h-full">
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
        {showValue && <span className="text-[clamp(10px,1.2vw,16px)] font-black leading-none text-white">{(value * 100).toFixed(0)}%</span>}
        <span className="text-[clamp(8px,0.8vw,10px)] font-black text-slate-400 uppercase tracking-tighter mt-0.5">{label}</span>
      </div>
    </div>
  );
};

const shiftsOrdered = ['1.MAÑANA', '2.TARDE', '4.NOCHE FIN', '3.NOCHE'];

const MonitorTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/30 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-lg font-black text-emerald-400">
          {Math.floor(payload[0].value).toLocaleString()} <span className="text-[10px] text-slate-500 uppercase">Tn</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomDataLabel = (props: any) => {
  const { x, y, value } = props;
  return (
    <text 
      x={x} 
      y={y - 12} 
      fill="#10b981" 
      fontSize={10} 
      fontWeight="900" 
      textAnchor="middle"
      className="font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
    >
      {Math.floor(value)} TN
    </text>
  );
};

const NewsTicker: React.FC<{ news: ShiftNews[] }> = ({ news }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    if (news.length <= 1) {
      setCurrentIndex(0);
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % news.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [news.length]);

  if (news.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-3xl">
        <p className="text-slate-500 font-bold text-sm lg:text-base uppercase tracking-widest opacity-40">Sin novedades reportadas</p>
      </div>
    );
  }

  const currentNews = news[currentIndex] || news[0];
  const detailUpper = currentNews.detail.toUpperCase();
  const isError = ['PARADA', 'AVERÍA', 'ERROR', 'FUERA DE SERVICIO', 'BLOQUEADO'].some(k => detailUpper.includes(k));
  const isSuccess = ['OK', 'INICIO', 'COMPLETO', 'EN MARCHA'].some(k => detailUpper.includes(k));

  return (
    <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-[200px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentNews.id}-${currentIndex}`}
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: 1,
            filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"]
          }}
          exit={{ y: -40, opacity: 0, scale: 0.98 }}
          transition={{ 
            y: { type: 'spring', stiffness: 100, damping: 15 },
            opacity: { duration: 0.3 },
            scale: { duration: 0.3 },
            filter: { duration: 0.5 }
          }}
          className={`w-full p-5 lg:p-6 bg-blue-600/10 rounded-2xl border-l-[6px] flex gap-4 lg:gap-6 shadow-2xl relative overflow-hidden min-h-[160px]
            ${isError ? 'border-red-500 shadow-[inset_6px_0_15px_-5px_rgba(239,68,68,0.4)]' : 
              isSuccess ? 'border-emerald-500 shadow-[inset_6px_0_15px_-5px_rgba(16,185,129,0.4)]' : 
              'border-blue-500/50'}`}
        >
          <div className="mt-1 shrink-0">
            {isError ? (
              <AlertCircle className="w-6 h-6 lg:w-8 lg:h-8 text-red-400" />
            ) : (
              <div className="bg-blue-500/20 p-2 lg:p-3 rounded-full">
                <User className="w-4 h-4 lg:w-5 lg:h-5 text-blue-400" />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <p className="text-lg lg:text-xl xl:text-2xl text-slate-100 leading-relaxed whitespace-pre-wrap font-medium tracking-tight">
              {currentNews.detail}
            </p>
          </div>
          
          {/* Progress bar for the 5s timer */}
          {news.length > 1 && (
            <motion.div 
              className="absolute bottom-0 left-0 h-1.5 bg-blue-500/40"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              key={`progress-${currentIndex}`}
              transition={{ duration: 5, ease: "linear" }}
            />
          )}
        </motion.div>
      </AnimatePresence>
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
  
  // Auto-rotate downtime ranking every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDowntimePage(prev => (prev + 1) % 3);
    }, 8000);
    return () => clearInterval(interval);
  }, []);
  const [currentCarouselPage, setCurrentCarouselPage] = useState(0);
  
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

  // Cycle downtime pages every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDowntimePage((prev) => (prev + 1) % 3);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Cycle carousel every 25 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCarouselPage((prev) => (prev + 1) % 5);
    }, 25000);
    return () => clearInterval(timer);
  }, []);

  const carouselPages = [
    { id: 'production', label: 'Producción y Récords' },
    { id: 'shift-production', label: 'Producción por Turno' },
    { id: 'downtimes', label: 'Paros y Cronograma' },
    { id: 'stocks', label: 'Inventario de Stock' },
    { id: 'news', label: 'Novedades de Turno' }
  ];

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

  const { data: shiftNews = [], isLoading: loadingNews } = useQuery({
    queryKey: ['monitor-news', selectedDate.toISOString()],
    queryFn: () => fetchShiftNews(selectedDate, selectedDate),
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
      .filter(i => {
        const name = i.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return order.some(o => name.includes(o));
      })
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

  const topDowntimesByMachine = useMemo(() => {
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    const result: Record<string, any[]> = {};

    machines.forEach(m => {
      const machineDowntimes = downtimeResult.filter(d => isMachineMatch(d.machineId, m));
      
      // We want the top 5 longest individual events for this paletizer
      result[m] = machineDowntimes
        .map(d => ({
          hac: d.hac || 'S/HAC',
          reason: d.reason || 'S/MOTIVO',
          duration: d.durationMinutes,
          id: d.id
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);
    });

    return result;
  }, [downtimeResult]);

  const allDowntimesOrdered = useMemo(() => {
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    const result: any[] = [];

    machines.forEach(m => {
      const machineDowntimes = downtimeResult
        .filter(d => isMachineMatch(d.machineId, m))
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
          machine: m,
          type: d.downtimeType || 'Interno'
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
      const machineDetails = unifiedProd?.details?.filter(d => 
        isMachineMatch(d.machineId, m) || isMachineMatch(d.machineName, m)
      ) || [];
      
      const totalTn = machineDetails.reduce((acc, curr) => acc + (curr.valueTn || 0), 0);
      
      const shiftBreakdown: Record<string, number> = {};
      shiftsOrdered.forEach(s => shiftBreakdown[s] = 0);
      machineDetails.forEach(d => {
        const normalized = normalizeShift(d.shift);
        if (shiftBreakdown[normalized] !== undefined) {
          shiftBreakdown[normalized] += (d.valueTn || 0);
        }
      });

      if (machineDetails.length === 0) return { id: m, oee: 0, availability: 0, performance: 0, hsMarcha: 0, totalTn: 0, shiftBreakdown };
      const count = machineDetails.length;
      return {
        id: m,
        oee: machineDetails.reduce((acc, curr) => acc + (curr.oee || 0), 0) / count,
        availability: machineDetails.reduce((acc, curr) => acc + (curr.availability || 0), 0) / count,
        performance: machineDetails.reduce((acc, curr) => acc + (curr.performance || 0), 0) / count,
        hsMarcha: machineDetails.reduce((acc, curr) => acc + (curr.hsMarcha || 0), 0),
        totalTn,
        shiftBreakdown
      };
    });
  }, [unifiedProd]);

  const shiftTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    shiftsOrdered.forEach(s => totals[s] = 0);
    unifiedProd?.details?.forEach(d => {
      const normalized = normalizeShift(d.shift);
      if (totals[normalized] !== undefined) {
        totals[normalized] += (d.valueTn || 0);
      }
    });
    return totals;
  }, [unifiedProd]);

  const { data: topRecords = [], isLoading: loadingTop } = useQuery({
    queryKey: ['monitor-top-records'],
    queryFn: () => fetchTopRecords(15), // Fetch more to find per-machine records
    refetchInterval: 3600000, // 1 hour
  });

  // Memoized historical records to avoid re-calculating on every render
  const historicalRecords = useMemo(() => {
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    return machines.map(machineId => {
      const machineRecords = topRecords.filter(r => isMachineMatch(r.machineId, machineId));
      const record = machineRecords.length > 0 
        ? [...machineRecords].sort((a, b) => b.valueTn - a.valueTn)[0]
        : null;
      return { machineId, record };
    });
  }, [topRecords]);

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
      <div className="bg-[#0a1b33] border-b border-white/10 px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center shadow-2xl relative z-10 h-[8vh] min-h-[60px]">
        {/* Left: Title */}
        <div className="flex items-center gap-3 lg:gap-6 overflow-hidden">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group flex items-center gap-2 shrink-0"
            >
              <ArrowLeft size={16} className="text-white/70 group-hover:text-white" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/70 group-hover:text-white hidden sm:inline">Volver</span>
            </button>
          )}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-1.5 bg-blue-600 rounded-lg shadow-lg">
              <Layout size={18} className="text-white" />
            </div>
            <h1 className="text-[clamp(14px,1.2vw,20px)] font-black tracking-tighter uppercase leading-none text-white whitespace-nowrap">MONITOR DE PRODUCTIVIDAD</h1>
          </div>
        </div>

        {/* Center: Clock & Date */}
        <div className="flex flex-col items-center justify-center px-6 border-x border-white/5 shrink-0">
          <p className="text-[clamp(24px,3vw,42px)] font-black tracking-tighter font-mono leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-blue-300/80 font-black uppercase tracking-[0.2em] text-[clamp(7px,0.6vw,9px)] font-mono whitespace-nowrap mt-0.5">
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Right: Stock Totalizers */}
        <div className="flex items-center justify-end gap-3 lg:gap-6 overflow-hidden">
          {producedStock.map(item => (
            <div key={item.id} className="flex flex-col items-end shrink">
              <span className="text-[clamp(7px,0.6vw,9px)] font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] lg:max-w-none">
                {item.product.replace('CEMENTO ', '')}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-[clamp(16px,1.8vw,28px)] font-black text-white tracking-tighter leading-none">
                  {Math.floor(item.tonnage).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[clamp(7px,0.6vw,9px)] text-slate-500 font-black uppercase">Tn</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-2 lg:p-3 flex flex-col gap-2 lg:gap-3 overflow-hidden min-h-0">
        {/* KPI Header Section - Always Visible */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0 h-[18vh] min-h-[120px]">
          <div className="flex-1 grid grid-cols-3 gap-2 lg:gap-4 h-full">
            {/* Machine KPIs & Totalizers */}
            {machineKPIs.map(m => (
              <div key={m.id} className="bg-white/[0.03] backdrop-blur-sm p-2 lg:p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-1 min-h-0 relative overflow-hidden group hover:bg-white/[0.05] transition-all h-full">
                <div className="flex justify-between items-start w-full">
                  <div className="flex flex-col">
                    <span className="text-[clamp(7px,0.6vw,9px)] font-black text-slate-500 uppercase tracking-[0.15em]">Paletizadora</span>
                    <span className="text-[clamp(12px,1vw,16px)] font-black text-white uppercase tracking-tight">
                      {m.id.split('-')[0]}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[clamp(7px,0.6vw,9px)] font-black text-emerald-500/70 uppercase tracking-tighter hidden sm:block">Total Hoy</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[clamp(20px,2.5vw,40px)] font-black text-emerald-400 tracking-tighter leading-none">
                        {Math.floor(m.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[clamp(8px,0.8vw,10px)] font-black text-slate-500 uppercase">Tn</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row gap-1 flex-1 min-h-0 items-end">
                  <div className="bg-black/40 p-0.5 rounded-xl border border-white/5 flex flex-col items-center justify-center group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all flex-1 h-full overflow-hidden">
                    <SemiCircleProgress 
                      value={m.availability} 
                      label="Disp." 
                      color="text-blue-400" 
                    />
                  </div>
                  <div className="bg-black/40 p-0.5 rounded-xl border border-white/5 flex flex-col items-center justify-center group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all flex-1 h-full overflow-hidden">
                    <SemiCircleProgress 
                      value={m.performance} 
                      label="Rend." 
                      color="text-emerald-400" 
                    />
                  </div>
                  <div className="bg-black/40 p-0.5 rounded-xl border border-white/5 flex flex-col items-center justify-center group-hover:bg-amber-500/10 group-hover:border-amber-500/20 transition-all flex-1 h-full overflow-hidden">
                    <SemiCircleProgress 
                      value={m.hsMarcha} 
                      label="HS Marcha" 
                      color="text-amber-500"
                      isRawValue={true}
                      suffix="h"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carousel Section */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
          {/* Carousel Tabs */}
          <div className="w-full flex items-stretch border-b border-white/10 bg-white/[0.02] flex-shrink-0 h-[6vh] min-h-[40px]">
            {carouselPages.map((page, idx) => (
              <button
                key={page.id}
                onClick={() => setCurrentCarouselPage(idx)}
                className={`flex-1 relative py-2 text-[clamp(8px,0.7vw,10px)] font-black uppercase tracking-[0.15em] transition-all group rounded-t-xl ${
                  currentCarouselPage === idx 
                    ? 'text-emerald-400 bg-white/[0.05]' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                }`}
              >
                <span className="relative z-10">{page.label}</span>
                
                {currentCarouselPage === idx && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 relative overflow-hidden mt-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCarouselPage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex flex-col"
              >
                {currentCarouselPage === 0 && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 overflow-hidden h-full min-h-0">
                    {/* Podium of the Day */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-5 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-3 lg:p-4 border border-white/10 shadow-2xl flex flex-col relative overflow-hidden min-h-0 h-full">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Trophy className="w-[80px] h-[80px] lg:w-[120px] lg:h-[120px]" />
                      </div>
                      
                      <div className="flex items-center justify-between mb-2 lg:mb-4 flex-shrink-0">
                        <p className="text-amber-500 font-black uppercase tracking-[0.15em] text-[clamp(12px,1.2vw,18px)] flex items-center gap-2 lg:gap-3">
                          <Trophy className="animate-bounce w-5 h-5 lg:w-6 lg:h-6 text-amber-500" /> Líderes de Producción
                        </p>
                      </div>

                      <div className="flex-1 flex items-end justify-center gap-2 lg:gap-4 pb-2 min-h-0">
                        {/* 2nd Place */}
                        {(() => {
                          const sorted = [...machineKPIs].sort((a,b) => b.totalTn - a.totalTn);
                          const second = sorted[1];
                          if (!second) return null;
                          return (
                            <div className="flex flex-col items-center gap-1 lg:gap-2 w-1/3">
                              <div className="flex flex-col items-center">
                                <span className="text-[clamp(10px,0.8vw,14px)] font-black text-slate-300 uppercase">{second.id.split('-')[0]}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[clamp(14px,1.2vw,20px)] font-black text-white">{Math.floor(second.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase">Tn</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-700/50 border border-white/10 rounded-t-2xl flex flex-col items-center justify-center py-2 lg:py-4 relative">
                                <div className="absolute -top-2 w-5 h-5 bg-slate-400 rounded-full flex items-center justify-center text-slate-900 font-black text-[10px] border-2 border-slate-700">2</div>
                                <div className="h-12 lg:h-20 w-full" />
                              </div>
                            </div>
                          );
                        })()}

                        {/* 1st Place */}
                        {(() => {
                          const sorted = [...machineKPIs].sort((a,b) => b.totalTn - a.totalTn);
                          const first = sorted[0];
                          if (!first) return null;
                          return (
                            <div className="flex flex-col items-center gap-1 lg:gap-2 w-1/3">
                              <div className="flex flex-col items-center">
                                <span className="text-[clamp(12px,1.4vw,22px)] font-black text-amber-500 uppercase">{first.id.split('-')[0]}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[clamp(20px,2vw,32px)] font-black text-white">{Math.floor(first.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Tn</span>
                                </div>
                              </div>
                              <div className="w-full bg-amber-500/20 border-x border-t border-amber-500/40 rounded-t-3xl flex flex-col items-center justify-center py-4 lg:py-8 relative shadow-[0_-20px_50px_-12px_rgba(245,158,11,0.3)]">
                                <div className="absolute -top-3 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-black text-sm border-2 border-amber-600 shadow-lg">1</div>
                                <div className="h-20 lg:h-32 w-full" />
                              </div>
                            </div>
                          );
                        })()}

                        {/* 3rd Place */}
                        {(() => {
                          const sorted = [...machineKPIs].sort((a,b) => b.totalTn - a.totalTn);
                          const third = sorted[2];
                          if (!third) return null;
                          return (
                            <div className="flex flex-col items-center gap-1 lg:gap-2 w-1/3">
                              <div className="flex flex-col items-center">
                                <span className="text-[clamp(10px,0.8vw,14px)] font-black text-amber-700 uppercase">{third.id.split('-')[0]}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[clamp(14px,1.2vw,20px)] font-black text-white">{Math.floor(third.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase">Tn</span>
                                </div>
                              </div>
                              <div className="w-full bg-amber-900/30 border border-white/10 rounded-t-2xl flex flex-col items-center justify-center py-2 lg:py-4 relative">
                                <div className="absolute -top-2 w-5 h-5 bg-amber-700 rounded-full flex items-center justify-center text-white font-black text-[10px] border-2 border-amber-900">3</div>
                                <div className="h-8 lg:h-12 w-full" />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Historical Records per Machine */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-7 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-3 lg:p-4 border border-white/10 shadow-2xl flex flex-col min-h-0 h-full">
                      <p className="text-indigo-400 font-black uppercase tracking-[0.15em] text-[clamp(12px,1.2vw,18px)] mb-2 lg:mb-4 flex items-center gap-2 lg:gap-3 flex-shrink-0">
                        <Trophy className="w-5 h-5 lg:w-6 lg:h-6" /> Récords Históricos
                      </p>
                      <div className="grid grid-cols-3 gap-3 lg:gap-4 flex-1 min-h-0">
                        {historicalRecords.map(({ machineId, record }) => {
                          if (!record) return null;

                          return (
                            <div key={machineId} className="bg-black/40 p-3 lg:p-4 rounded-3xl border border-white/5 flex flex-col justify-center group hover:bg-indigo-500/10 transition-all relative overflow-hidden min-h-0 h-full">
                              {/* Trophy Watermark */}
                              <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <Trophy className="w-[60px] h-[60px] lg:w-[80px] h-[80px]" />
                              </div>

                              {/* Machine Badge (Top Right) */}
                              <div className="absolute top-2 right-2 z-20">
                                <span className="px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[clamp(7px,0.6vw,9px)] font-black text-slate-400 uppercase tracking-widest">
                                  {machineId.split('-')[0]}
                                </span>
                              </div>
                              
                              <div className="relative z-10 flex flex-col gap-2 lg:gap-4">
                                {/* Date Header */}
                                <div className="flex flex-col">
                                  <span className="text-[clamp(7px,0.6vw,9px)] font-black text-cyan-400/70 uppercase tracking-[0.15em]">
                                    Récord
                                  </span>
                                  <p className="text-[clamp(9px,0.8vw,12px)] font-bold text-slate-200 font-mono flex items-center gap-1.5">
                                    <Calendar size={12} className="text-cyan-400" /> {record.date ? record.date.split('-').reverse().join('/') : '---'}
                                  </p>
                                </div>

                                {/* Main Record Value */}
                                <div className="flex flex-col">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-[clamp(20px,2.5vw,42px)] font-black text-amber-400 tracking-tighter leading-none">
                                      {Math.floor(record.valueTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-[clamp(8px,0.8vw,10px)] font-bold text-slate-500 uppercase">Tn</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {currentCarouselPage === 1 && (
                  <div className="flex-1 flex flex-col gap-3 overflow-hidden h-full min-h-0">
                    {/* Production per Shift and Paletizer */}
                    <div className="flex-1 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-3 lg:p-4 border border-white/10 shadow-2xl flex flex-col min-h-0 h-full overflow-hidden">
                      <div className="flex justify-between items-center mb-2 lg:mb-4 gap-4 flex-shrink-0">
                        <p className="text-blue-400 font-black uppercase tracking-[0.15em] text-[clamp(12px,1.2vw,18px)] flex items-center gap-2 lg:gap-3">
                          <Activity className="w-5 h-5 lg:w-6 lg:h-6" /> Producción por Turno
                        </p>
                        <div className="flex gap-3 bg-white/5 p-2 rounded-xl border border-white/10 shadow-inner">
                          {shiftsOrdered.map(s => (
                            <div key={s} className="flex flex-col items-center gap-0 min-w-[60px]">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full bg-${SHIFT_MAP[s as keyof typeof SHIFT_MAP].color}-500`} />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{SHIFT_MAP[s as keyof typeof SHIFT_MAP].label}</span>
                              </div>
                              <span className="text-[clamp(12px,1vw,16px)] font-black text-white">{Math.floor(shiftTotals[s] || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} <span className="text-[8px] text-slate-500 uppercase">Tn</span></span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 lg:gap-4 flex-1 min-h-0 overflow-hidden">
                        {machineKPIs.map(machine => {
                          return (
                            <div key={machine.id} className="bg-black/40 rounded-2xl border border-white/5 flex flex-col overflow-hidden min-h-0 h-full">
                              <div className="bg-white/5 p-2 lg:p-3 border-b border-white/5 flex justify-between items-center flex-shrink-0">
                                <span className="text-[clamp(12px,1vw,16px)] font-black text-white uppercase tracking-tighter">{machine.id.split('-')[0]}</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Total</span>
                                  <span className="text-[clamp(12px,1vw,16px)] font-black text-emerald-400">{Math.floor(machine.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })} Tn</span>
                                </div>
                              </div>
                              
                              <div className="p-2 lg:p-3 flex-1 min-h-0">
                                <div className="h-full w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                      data={shiftsOrdered.map(s => ({
                                        name: SHIFT_MAP[s as keyof typeof SHIFT_MAP].label,
                                        value: machine.shiftBreakdown[s] || 0
                                      }))}
                                      margin={{ top: 20, right: 10, left: -25, bottom: 0 }}
                                    >
                                      <defs>
                                        <linearGradient id={`colorValue-${machine.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ffffff10" />
                                      <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 'bold' }}
                                      />
                                      <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 'bold' }}
                                      />
                                      <Tooltip content={<MonitorTooltip />} />
                                      <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke="#10b981" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill={`url(#colorValue-${machine.id.replace(/[^a-zA-Z0-9]/g, '')})`}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                                      >
                                        <LabelList dataKey="value" content={<CustomDataLabel />} />
                                      </Area>
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {currentCarouselPage === 2 && (
                  <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3 lg:gap-4 overflow-hidden h-full min-h-0">
                    {/* Top 5 Paros - Larger */}
                    <div className="col-span-1 xl:col-span-7 bg-white/[0.03] backdrop-blur-sm p-3 lg:p-4 rounded-3xl border border-white/10 shadow-2xl border-l-8 border-l-red-500/50 flex flex-col min-h-0 h-full">
                      <div className="flex justify-between items-center mb-2 lg:mb-4 gap-4 flex-shrink-0">
                        <p className="text-red-400 font-black uppercase tracking-[0.15em] text-[clamp(12px,1.2vw,18px)] flex items-center gap-2 lg:gap-3">
                          <AlertCircle className="w-5 h-5 lg:w-6 lg:h-6" /> Ranking de Paros (Top 5)
                        </p>
                        <div className="flex gap-1.5">
                          {['672', '673', '674'].map((m, idx) => (
                            <button 
                              key={m}
                              onClick={() => setCurrentDowntimePage(idx)}
                              className={`px-2 lg:px-3 py-1 rounded-full text-[clamp(8px,0.6vw,10px)] font-black transition-all ${currentDowntimePage === idx ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-500'}`}
                            >
                              PZ{m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-start overflow-hidden min-h-0">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={currentDowntimePage}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            variants={{
                              initial: { opacity: 0 },
                              animate: { opacity: 1, transition: { staggerChildren: 0.1 } },
                              exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } }
                            }}
                            className="flex flex-col h-full gap-1.5 lg:gap-2"
                          >
                            {(() => {
                              const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
                              const targetMachine = machines[currentDowntimePage];
                              const machineData = topDowntimesByMachine[targetMachine] || [];
                              
                              const machineColors: Record<string, { border: string, text: string, badge: string, glow: string, dot: string }> = {
                                'MG.672-PZ1': { 
                                  border: 'border-l-cyan-500', 
                                  text: 'text-cyan-400', 
                                  badge: 'bg-black text-cyan-400 border-cyan-500/50', 
                                  glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
                                  dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                                },
                                'MG.673-PZ1': { 
                                  border: 'border-l-emerald-500', 
                                  text: 'text-emerald-400', 
                                  badge: 'bg-black text-emerald-400 border-emerald-500/50', 
                                  glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
                                  dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                },
                                'MG.674-PZ1': { 
                                  border: 'border-l-rose-500', 
                                  text: 'text-rose-400', 
                                  badge: 'bg-black text-rose-400 border-rose-500/50', 
                                  glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
                                  dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                                },
                              };

                              const colors = machineColors[targetMachine] || machineColors['MG.672-PZ1'];

                              if (machineData.length === 0) {
                                return (
                                  <motion.div 
                                    variants={{
                                      initial: { x: '120%', opacity: 0 },
                                      animate: { x: 0, opacity: 1 },
                                      exit: { x: '-120%', opacity: 0 }
                                    }}
                                    className="py-12 text-center text-slate-500 italic text-sm lg:text-base"
                                  >
                                    Sin paros internos registrados
                                  </motion.div>
                                );
                              }

                              return machineData.map((d, idx) => {
                                const hhmm = `${Math.floor(d.duration / 60).toString().padStart(2, '0')}:${Math.floor(d.duration % 60).toString().padStart(2, '0')}`;
                                return (
                                  <motion.div 
                                    key={idx}
                                    variants={{
                                      initial: { x: '120%', opacity: 0 },
                                      animate: { x: 0, opacity: 1 },
                                      exit: { x: '-120%', opacity: 0 }
                                    }}
                                    transition={{ 
                                      type: "spring", 
                                      stiffness: 70, 
                                      damping: 18,
                                      mass: 0.8
                                    }}
                                    className={`flex items-center gap-2 lg:gap-3 p-1.5 lg:p-2 bg-gradient-to-r from-white/[0.04] to-transparent border-l-4 ${colors.border} border-b border-white/5 last:border-b-0 backdrop-blur-sm group hover:from-white/[0.07] transition-all duration-300 ${colors.glow} min-h-0`}
                                  >
                                    {/* HAC Badge */}
                                    <div className={`shrink-0 px-2 py-0.5 rounded border font-mono text-[clamp(8px,0.6vw,10px)] font-bold tracking-wider flex items-center gap-1.5 ${colors.badge}`}>
                                      <div className={`w-1 h-1 rounded-full animate-pulse ${colors.dot}`} />
                                      {d.hac}
                                    </div>
                                    
                                    {/* Motivo - Full Width */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white font-bold text-[clamp(10px,0.8vw,13px)] leading-tight truncate">
                                        {d.reason}
                                      </p>
                                    </div>
                                    
                                    {/* Duration */}
                                    <div className="shrink-0 flex items-center gap-2 bg-black/40 px-2 py-1 rounded-xl border border-white/10 shadow-inner">
                                      <Clock className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${idx === 0 ? 'text-yellow-400' : colors.text}`} />
                                      <div className="flex flex-col items-end">
                                        <span className={`font-mono text-[clamp(14px,1.2vw,20px)] font-black leading-none tracking-tighter ${idx === 0 ? 'text-yellow-400' : colors.text}`}>
                                          {hhmm}
                                        </span>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              });
                            })()}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="col-span-1 xl:col-span-5 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-3 lg:p-4 rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden min-h-0 h-full">
                      <div className="flex items-center justify-between mb-2 lg:mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2 lg:gap-3">
                          <Clock className="text-indigo-400 w-5 h-5 lg:w-6 lg:h-6" />
                          <p className="text-indigo-400 font-black uppercase tracking-[0.15em] text-[clamp(12px,1.2vw,18px)]">Cronograma</p>
                        </div>
                        <div className="flex gap-2 text-[clamp(7px,0.6vw,9px)] font-bold uppercase tracking-widest">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500/60 rounded-sm"></div> <span className="hidden sm:inline">OK</span></div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> <span className="hidden sm:inline">Paro</span></div>
                        </div>
                      </div>

                      <div className="flex-1 relative overflow-hidden min-h-0">
                        <AnimatePresence mode="wait">
                          <motion.div 
                            key={shiftsOrdered[currentShiftIndex]}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.5 }}
                            className="h-full flex flex-col"
                          >
                            <div className="flex-1 flex flex-col gap-2 lg:gap-4 min-h-0">
                              <div className="flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-[clamp(16px,1.5vw,24px)] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap">
                                    {SHIFT_MAP[shiftsOrdered[currentShiftIndex] as keyof typeof SHIFT_MAP].label}
                                  </span>
                                  <div className="h-px w-10 lg:w-20 bg-slate-800 hidden sm:block"></div>
                                </div>
                                <div className="flex gap-1.5">
                                  {shiftsOrdered.map((_, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`h-1 rounded-full transition-all duration-500 ${idx === currentShiftIndex ? 'w-6 lg:w-10 bg-indigo-500' : 'w-1.5 lg:w-2 bg-slate-800'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col justify-around min-h-0 gap-2 overflow-hidden">
                                {Object.entries(groupedTimeline[shiftsOrdered[currentShiftIndex]] || {}).map(([machine, data]) => {
                                  const machineProdEntries = unifiedProd?.details?.filter(d => 
                                    (isMachineMatch(d.machineId, machine) || isMachineMatch(d.machineName, machine)) && 
                                    normalizeShift(d.shift) === shiftsOrdered[currentShiftIndex]
                                  ) || [];
                                  const machineProdTn = machineProdEntries.reduce((acc, curr) => acc + (curr.valueTn || 0), 0);
                                  
                                  return (
                                    <div key={machine} className="w-full">
                                      <div className="flex justify-between items-end mb-0.5 px-1">
                                        <div className="flex flex-col">
                                          <span className="text-[clamp(8px,0.7vw,10px)] font-black text-white uppercase tracking-widest">{machine.split('-')[0]}</span>
                                        </div>
                                        <span className={`text-[clamp(8px,0.7vw,10px)] font-black uppercase tracking-widest ${getTnColor(machine, machineProdTn)}`}>
                                          {Math.floor(machineProdTn).toLocaleString()} Tn
                                        </span>
                                      </div>
                                      <MonitorTimelineBar 
                                        shiftKey={shiftsOrdered[currentShiftIndex]} 
                                        events={data.events} 
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
                )}

                {currentCarouselPage === 3 && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 overflow-hidden h-full min-h-0">
                    {/* Stock Detailed View */}
                    <div className="col-span-1 md:col-span-12 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col min-h-0 h-full">
                      <p className="text-blue-400 font-black uppercase tracking-[0.2em] text-[clamp(14px,1.5vw,24px)] mb-4 lg:mb-8 flex items-center gap-3 flex-shrink-0">
                        <Package className="w-6 h-6 lg:w-8 lg:h-8" /> Inventario de Stock
                      </p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-6 flex-1 min-h-0 overflow-hidden">
                        {producedStock.map(item => (
                          <div key={item.id} className="bg-black/40 p-3 lg:p-4 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-blue-500/10 transition-all shadow-xl h-full min-h-0">
                            <div className="mb-2 lg:mb-4">
                              <span className="text-[clamp(12px,1.2vw,20px)] font-black text-white uppercase tracking-tight leading-tight block">{item.product}</span>
                            </div>
                            
                            <div className="flex items-baseline gap-1.5 lg:gap-3">
                              <span className="text-[clamp(28px,4vw,64px)] font-black text-white tracking-tighter leading-none">
                                {Math.floor(item.tonnage).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                              </span>
                              <span className="text-[clamp(10px,1vw,18px)] font-bold text-slate-500 uppercase">Tn</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentCarouselPage === 4 && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 overflow-hidden h-full min-h-0">
                    {/* Novedades / News Section */}
                    <div className="col-span-1 md:col-span-12 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col min-h-0 h-full">
                      <p className="text-emerald-400 font-black uppercase tracking-[0.2em] text-[clamp(14px,1.5vw,24px)] mb-4 lg:mb-8 flex items-center gap-3 flex-shrink-0">
                        <Activity className="w-6 h-6 lg:w-8 lg:h-8" /> Novedades y Observaciones
                      </p>
                      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-1 min-h-0 overflow-hidden">
                        {[
                          { key: '1.MAÑANA', label: 'MAÑANA', color: 'emerald' },
                          { key: '2.TARDE', label: 'TARDE', color: 'blue' },
                          { key: '3.NOCHE', label: 'NOCHE', color: 'indigo' },
                          { key: '4.NOCHE FIN', label: 'NOCHE FIN', color: 'slate' }
                        ].map(shift => {
                          const news = shiftNews.filter(n => n.shift === shift.key);
                          return (
                            <div key={shift.key} className="bg-black/40 p-3 lg:p-4 rounded-3xl border border-white/5 flex flex-col gap-3 lg:gap-4 min-h-0 h-full overflow-hidden">
                              <div className="flex items-center justify-between border-b border-white/10 pb-2 lg:pb-3 flex-shrink-0">
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-[clamp(10px,0.8vw,14px)] font-black uppercase tracking-[0.15em] text-${shift.color}-400/80`}>
                                    {shift.label}
                                  </span>
                                  <span className="text-[10px] font-bold text-white/20">[{news.length}]</span>
                                </div>
                                <div className={`w-2 h-2 rounded-full bg-${shift.color}-500/50 animate-pulse`} />
                              </div>
                              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <NewsTicker news={news} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
