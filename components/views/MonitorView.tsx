
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout, ArrowLeft, Calendar, MessageSquare, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
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
  const s1 = String(id1).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const s2 = String(id2).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s1.includes(s2) || s2.includes(s1);
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
          className={`h-[80%] rounded-sm border-r border-white/5 last:border-0 transition-all ${getBlockStyle(block)}`}
          style={{ width: `${(block.duration / totalMins) * 100}%` }}
        />
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
          <span className="text-[clamp(12px,1.4vw,20px)] font-black leading-none text-white">
            {displayValue.toFixed(isRawValue ? 1 : 0)}{suffix}
          </span>
        )}
        <span className="text-[clamp(7px,0.7vw,9px)] font-black text-slate-500 uppercase tracking-tighter mt-0.5">{label}</span>
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

  // Cycle downtime pages every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDowntimePage((prev) => prev + 1);
    }, 10000);
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
                    {Math.floor(item.tonnage).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] text-blue-300 font-black uppercase">Tn</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 lg:p-3 xl:p-4 flex flex-col gap-2 lg:gap-3 xl:gap-4 overflow-hidden min-h-0">
        {/* KPI Header Section - Always Visible */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2 lg:pb-3 xl:pb-4 flex-shrink-0">
          <div className="flex-1 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-2 lg:gap-3 xl:gap-4">
            {/* Machine KPIs & Totalizers */}
            {machineKPIs.map(m => (
              <div key={m.id} className="bg-white/[0.03] backdrop-blur-sm p-3 lg:p-4 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-1 lg:gap-2 min-h-0 relative overflow-hidden group hover:bg-white/[0.05] transition-all">
                <div className="flex justify-between items-start w-full">
                  <div className="flex flex-col">
                    <span className="text-[clamp(8px,0.8vw,10px)] font-black text-slate-500 uppercase tracking-[0.2em]">Paletizadora</span>
                    <span className="text-[clamp(14px,1.2vw,18px)] font-black text-white uppercase tracking-tight mt-0.5">
                      {m.id.split('-')[0]}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[clamp(8px,0.8vw,10px)] font-black text-emerald-500/70 uppercase tracking-tighter hidden sm:block">Total Hoy</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl 2xl:text-5xl font-black text-emerald-400 tracking-tighter leading-none">
                        {Math.floor(m.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[clamp(10px,1vw,12px)] font-black text-slate-500 uppercase">Tn</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 flex-1 min-h-0 items-end -mt-2">
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5 flex flex-col items-center justify-center group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all flex-1">
                    <SemiCircleProgress 
                      value={m.availability} 
                      label="Disp." 
                      color="text-blue-400" 
                    />
                  </div>
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5 flex flex-col items-center justify-center group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all flex-1">
                    <SemiCircleProgress 
                      value={m.performance} 
                      label="Rend." 
                      color="text-emerald-400" 
                    />
                  </div>
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5 flex flex-col items-center justify-center group-hover:bg-amber-500/10 group-hover:border-amber-500/20 transition-all flex-1">
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
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Carousel Tabs */}
          <div className="w-full flex items-stretch border-b border-white/10 mb-4 bg-white/[0.02]">
            {carouselPages.map((page, idx) => (
              <button
                key={page.id}
                onClick={() => setCurrentCarouselPage(idx)}
                className={`flex-1 relative py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all group rounded-t-2xl ${
                  currentCarouselPage === idx 
                    ? 'text-emerald-400 bg-white/[0.05]' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                }`}
              >
                <span className="relative z-10">{page.label}</span>
                
                {currentCarouselPage === idx && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                
                {/* Subtle hover indicator */}
                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/[0.03] transition-colors" />
              </button>
            ))}
          </div>

          <div className="flex-1 relative overflow-hidden">
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
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 overflow-hidden min-h-0">
                    {/* Podium of the Day */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-5 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 xl:p-8 border border-white/10 shadow-2xl flex flex-col relative overflow-hidden min-h-0">
                      <div className="absolute top-0 right-0 p-4 lg:p-8 opacity-5 lg:opacity-10 pointer-events-none">
                        <Trophy className="w-[120px] h-[120px] lg:w-[160px] lg:h-[160px]" />
                      </div>
                      
                      <div className="flex items-center justify-between mb-4 lg:mb-8">
                        <p className="text-amber-500 font-black uppercase tracking-[0.2em] text-lg lg:text-xl flex items-center gap-3 lg:gap-4">
                          <Trophy className="animate-bounce w-6 h-6 lg:w-7 lg:h-7 text-amber-500" /> Líderes de Producción (Hoy)
                        </p>
                      </div>

                      <div className="flex-1 flex items-end justify-center gap-2 lg:gap-4 pb-2 lg:pb-4 min-h-0">
                        {/* 2nd Place */}
                        {(() => {
                          const sorted = [...machineKPIs].sort((a,b) => b.totalTn - a.totalTn);
                          const second = sorted[1];
                          if (!second) return null;
                          return (
                            <div className="flex flex-col items-center gap-2 lg:gap-4 w-1/3">
                              <div className="flex flex-col items-center">
                                <span className="text-sm lg:text-lg font-black text-slate-300 uppercase">{second.id.split('-')[0]}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl lg:text-2xl font-black text-white">{Math.floor(second.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[8px] lg:text-[10px] font-bold text-slate-500 uppercase">Tn</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-700/50 border border-white/10 rounded-t-2xl flex flex-col items-center justify-center py-4 lg:py-8 relative">
                                <div className="absolute -top-3 lg:-top-4 w-6 lg:h-8 h-6 lg:w-8 bg-slate-400 rounded-full flex items-center justify-center text-slate-900 font-black text-xs border-2 border-slate-700">2</div>
                                <div className="h-16 lg:h-24 w-full" />
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
                            <div className="flex flex-col items-center gap-2 lg:gap-4 w-1/3">
                              <div className="flex flex-col items-center">
                                <span className="text-base lg:text-xl font-black text-amber-500 uppercase">{first.id.split('-')[0]}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-3xl lg:text-4xl font-black text-white">{Math.floor(first.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase">Tn</span>
                                </div>
                              </div>
                              <div className="w-full bg-amber-500/20 border-x border-t border-amber-500/40 rounded-t-3xl flex flex-col items-center justify-center py-8 lg:py-12 relative shadow-[0_-20px_50px_-12px_rgba(245,158,11,0.3)]">
                                <div className="absolute -top-4 lg:-top-6 w-8 lg:h-12 h-8 lg:w-12 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-black text-sm lg:text-xl border-2 lg:border-4 border-amber-600 shadow-lg">1</div>
                                <div className="h-24 lg:h-40 w-full" />
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
                            <div className="flex flex-col items-center gap-2 lg:gap-4 w-1/3">
                              <div className="flex flex-col items-center">
                                <span className="text-sm lg:text-lg font-black text-amber-700 uppercase">{third.id.split('-')[0]}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl lg:text-2xl font-black text-white">{Math.floor(third.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[8px] lg:text-[10px] font-bold text-slate-500 uppercase">Tn</span>
                                </div>
                              </div>
                              <div className="w-full bg-amber-900/30 border border-white/10 rounded-t-2xl flex flex-col items-center justify-center py-3 lg:py-6 relative">
                                <div className="absolute -top-3 lg:-top-4 w-6 lg:h-8 h-6 lg:w-8 bg-amber-700 rounded-full flex items-center justify-center text-white font-black text-xs border-2 border-amber-900">3</div>
                                <div className="h-12 lg:h-16 w-full" />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Historical Records per Machine */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-7 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 xl:p-8 border border-white/10 shadow-2xl flex flex-col min-h-0">
                      <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-lg lg:text-xl mb-4 lg:mb-8 flex items-center gap-3 lg:gap-4">
                        <Trophy className="w-5 h-5 lg:w-6 lg:h-6" /> Récords Históricos: Hitos a Superar
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 flex-1 min-h-0">
                        {['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'].map(machineId => {
                          // Find the BEST record for this specific machine
                          const machineRecords = topRecords.filter(r => isMachineMatch(r.machineId, machineId));
                          const record = machineRecords.length > 0 
                            ? machineRecords.sort((a, b) => b.valueTn - a.valueTn)[0]
                            : null;
                          
                          if (!record) return null;

                          return (
                            <div key={machineId} className="bg-black/40 p-5 lg:p-7 rounded-3xl border border-white/5 flex flex-col justify-center group hover:bg-indigo-500/10 transition-all relative overflow-hidden min-h-0">
                              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <Trophy className="w-[80px] h-[80px] lg:w-[100px] h-[100px]" />
                              </div>
                              
                              <div className="relative z-10">
                                <span className="text-[10px] lg:text-xs font-black text-slate-500 uppercase tracking-widest">Récord {machineId.split('-')[0]}</span>
                                <div className="mt-2 lg:mt-4">
                                  <div className="flex items-baseline gap-1.5 lg:gap-2">
                                    <span className="text-4xl lg:text-5xl xl:text-6xl font-black text-amber-400 tracking-tighter leading-none">
                                      {Math.floor(record.valueTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-xs lg:text-sm font-bold text-slate-500 uppercase">Tn</span>
                                  </div>
                                  <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase mt-2 flex items-center gap-2">
                                    <Calendar size={12} className="text-indigo-400" /> {record.date || '---'}
                                  </p>
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
                  <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                    {/* Production per Shift and Paletizer */}
                    <div className="flex-1 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 border border-white/10 shadow-2xl flex flex-col min-h-0 overflow-hidden">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4 flex-shrink-0">
                        <p className="text-blue-400 font-black uppercase tracking-[0.2em] text-lg lg:text-2xl flex items-center gap-3">
                          <Activity className="w-6 h-6 lg:w-8 lg:h-8" /> Producción por Turno (Totales)
                        </p>
                        <div className="flex flex-wrap gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 shadow-inner">
                          {shiftsOrdered.map(s => (
                            <div key={s} className="flex flex-col items-center gap-0.5 min-w-[80px]">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full bg-${SHIFT_MAP[s as keyof typeof SHIFT_MAP].color}-500`} />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{SHIFT_MAP[s as keyof typeof SHIFT_MAP].label}</span>
                              </div>
                              <span className="text-lg lg:text-xl font-black text-white">{Math.floor(shiftTotals[s] || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} <span className="text-[10px] text-slate-500 uppercase">Tn</span></span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 flex-1 min-h-0 overflow-y-auto no-scrollbar pb-4">
                        {machineKPIs.map(machine => {
                          return (
                            <div key={machine.id} className="bg-black/40 rounded-2xl border border-white/5 flex flex-col overflow-hidden min-h-0">
                              <div className="bg-white/5 p-3 lg:p-4 border-b border-white/5 flex justify-between items-center flex-shrink-0">
                                <span className="text-lg lg:text-xl font-black text-white uppercase tracking-tighter">{machine.id.split('-')[0]}</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Diario</span>
                                  <span className="text-base lg:text-lg font-black text-emerald-400">{Math.floor(machine.totalTn).toLocaleString('es-AR', { maximumFractionDigits: 0 })} Tn</span>
                                </div>
                              </div>
                              
                              <div className="p-3 lg:p-4 flex-1 min-h-0">
                                <div className="h-48 lg:h-56 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                      data={shiftsOrdered.map(s => ({
                                        name: SHIFT_MAP[s as keyof typeof SHIFT_MAP].label,
                                        value: machine.shiftBreakdown[s] || 0
                                      }))}
                                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                                      />
                                      <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                                      />
                                      <Tooltip content={<MonitorTooltip />} />
                                      <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke="#10b981" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill={`url(#colorValue-${machine.id.replace(/[^a-zA-Z0-9]/g, '')})`}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                                      />
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
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 overflow-hidden min-h-0">
                    {/* Top 5 Paros - Larger */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-7 bg-white/[0.03] backdrop-blur-sm p-4 lg:p-6 xl:p-8 rounded-3xl border border-white/10 shadow-2xl border-l-8 border-l-red-500/50 flex flex-col min-h-0">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 lg:mb-8 gap-4">
                        <p className="text-red-400 font-black uppercase tracking-[0.2em] text-lg lg:text-2xl flex items-center gap-3 lg:gap-4">
                          <AlertCircle className="w-6 h-6 lg:w-8 lg:h-8" /> Top 5 Paros Internos
                        </p>
                        <div className="flex gap-2">
                          {['672', '673', '674'].map((m, idx) => (
                            <button 
                              key={m}
                              onClick={() => setCurrentDowntimePage(idx)}
                              className={`px-3 lg:px-4 py-1 lg:py-1.5 rounded-full text-[9px] lg:text-[10px] font-black transition-all ${currentDowntimePage === idx ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-500'}`}
                            >
                              PZ{m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar">
                        <table className="w-full text-xs lg:text-sm border-collapse">
                          <thead>
                            <tr className="text-slate-500 uppercase font-black border-b border-white/10">
                              <th className="text-left pb-2 lg:pb-4 w-8 lg:w-12">#</th>
                              <th className="text-left pb-2 lg:pb-4">HAC</th>
                              <th className="text-left pb-2 lg:pb-4">Motivo del Paro</th>
                              <th className="text-right pb-2 lg:pb-4">Duración (Min)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allDowntimesOrdered
                              .filter(d => {
                                const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
                                const targetMachine = machines[currentDowntimePage];
                                return isMachineMatch(d.machine, targetMachine);
                              })
                              .slice(0, 5)
                              .map((d, idx) => (
                              <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                                <td className="py-3 lg:py-4 text-slate-500 font-black text-base lg:text-lg">{idx + 1}</td>
                                <td className="py-3 lg:py-4 text-blue-400 font-black text-base lg:text-lg">{d.hac}</td>
                                <td className="py-3 lg:py-4">
                                  <p className="text-white font-bold text-base lg:text-lg">{d.reason}</p>
                                  <p className="text-[8px] lg:text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 lg:mt-1">{d.fullName}</p>
                                </td>
                                <td className="py-3 lg:py-4 text-right">
                                  <span className="text-xl lg:text-2xl font-black text-red-400">{d.duration}</span>
                                  <span className="text-[8px] lg:text-[10px] text-slate-500 font-bold ml-1 lg:ml-2 uppercase">Min</span>
                                </td>
                              </tr>
                            ))}
                            {allDowntimesOrdered.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-12 lg:py-20 text-center text-slate-500 italic text-lg lg:text-xl">Sin paros internos registrados</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-5 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 xl:p-8 border border-white/10 shadow-2xl flex flex-col overflow-hidden min-h-0">
                      <div className="flex items-center justify-between mb-4 lg:mb-8">
                        <div className="flex items-center gap-3 lg:gap-4">
                          <Clock className="text-indigo-400 w-6 h-6 lg:w-8 lg:h-8" />
                          <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-lg lg:text-xl">Cronograma Diario</p>
                        </div>
                        <div className="flex gap-2 lg:gap-4 text-[8px] lg:text-[10px] font-bold uppercase tracking-widest">
                          <div className="flex items-center gap-1.5 lg:gap-2"><div className="w-2 h-2 lg:w-3 lg:h-3 bg-emerald-500/60 rounded-sm"></div> <span className="hidden sm:inline">Operativo</span></div>
                          <div className="flex items-center gap-1.5 lg:gap-2"><div className="w-2 h-2 lg:w-3 lg:h-3 bg-red-500 rounded-sm"></div> <span className="hidden sm:inline">Paro</span></div>
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
                            <div className="flex-1 flex flex-col gap-4 lg:gap-8">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 lg:gap-6">
                                  <span className="text-2xl lg:text-4xl font-black text-white uppercase tracking-[0.3em] whitespace-nowrap">
                                    {SHIFT_MAP[shiftsOrdered[currentShiftIndex] as keyof typeof SHIFT_MAP].label}
                                  </span>
                                  <div className="h-px w-16 lg:w-32 bg-slate-800 hidden sm:block"></div>
                                </div>
                                <div className="flex gap-2 lg:gap-3">
                                  {shiftsOrdered.map((_, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`h-1.5 lg:h-2 rounded-full transition-all duration-500 ${idx === currentShiftIndex ? 'w-8 lg:w-12 bg-indigo-500' : 'w-2 lg:w-3 bg-slate-800'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col justify-around min-h-0 gap-2 lg:gap-4 overflow-y-auto no-scrollbar">
                                {Object.entries(groupedTimeline[shiftsOrdered[currentShiftIndex]] || {}).map(([machine, data]) => {
                                  const machineProdEntries = unifiedProd?.details?.filter(d => 
                                    (isMachineMatch(d.machineId, machine) || isMachineMatch(d.machineName, machine)) && 
                                    normalizeShift(d.shift) === shiftsOrdered[currentShiftIndex]
                                  ) || [];
                                  const machineProdTn = machineProdEntries.reduce((acc, curr) => acc + (curr.valueTn || 0), 0);
                                  
                                  return (
                                    <div key={machine} className="w-full">
                                      <div className="flex justify-between items-end mb-1 px-1 lg:px-2">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] lg:text-xs font-black text-white uppercase tracking-widest">{machine.split('-')[0]}</span>
                                          {data.longestEvent && (
                                            <span className="text-[8px] font-bold text-red-400 uppercase tracking-tighter">
                                              Paro Mayor: {data.longestEvent.reason} ({data.longestEvent.durationMinutes} min)
                                            </span>
                                          )}
                                        </div>
                                        <span className={`text-[10px] lg:text-xs font-black uppercase tracking-widest ${getTnColor(machine, machineProdTn)}`}>
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
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 overflow-hidden min-h-0">
                    {/* Stock Detailed View */}
                    <div className="col-span-1 md:col-span-12 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 xl:p-8 border border-white/10 shadow-2xl flex flex-col min-h-0">
                      <p className="text-blue-400 font-black uppercase tracking-[0.2em] text-lg lg:text-2xl mb-6 lg:mb-12 flex items-center gap-3 lg:gap-4">
                        <Package className="w-6 h-6 lg:w-8 lg:h-8" /> Inventario de Stock
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 xl:gap-8 flex-1 min-h-0 overflow-y-auto no-scrollbar">
                        {producedStock.map(item => (
                          <div key={item.id} className="bg-black/40 p-6 lg:p-8 xl:p-10 rounded-3xl border border-white/5 flex flex-col justify-between group hover:bg-blue-500/10 transition-all shadow-xl min-h-[200px]">
                            <div className="flex flex-col gap-1.5 lg:gap-2">
                              <span className="text-[10px] lg:text-xs font-black text-blue-400/70 uppercase tracking-widest">Producto</span>
                              <span className="text-xl lg:text-2xl xl:text-3xl font-black text-white uppercase tracking-tight leading-tight">{item.product}</span>
                            </div>
                            
                            <div className="mt-6 lg:mt-12">
                              <div className="flex items-baseline gap-2 lg:gap-3">
                                <span className="text-4xl lg:text-6xl xl:text-7xl font-black text-white tracking-tighter">{Math.floor(item.tonnage).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                <span className="text-lg lg:text-xl xl:text-2xl font-bold text-slate-500 uppercase">Tn</span>
                              </div>
                              <div className="h-1 lg:h-1.5 w-full bg-white/5 rounded-full mt-4 lg:mt-6 overflow-hidden">
                                <div className="h-full bg-blue-500 w-3/4" />
                              </div>
                            </div>

                            <div className="mt-6 lg:mt-8 flex justify-between items-center text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span className="hidden sm:inline">Actualizado Hoy</span>
                              <span className="text-blue-400">En Stock</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentCarouselPage === 4 && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 overflow-hidden min-h-0">
                    {/* Novedades / News Section */}
                    <div className="col-span-1 md:col-span-12 bg-white/[0.03] backdrop-blur-sm rounded-3xl p-4 lg:p-6 xl:p-8 border border-white/10 shadow-2xl flex flex-col min-h-0">
                      <p className="text-emerald-400 font-black uppercase tracking-[0.2em] text-lg lg:text-2xl mb-6 lg:mb-12 flex items-center gap-3 lg:gap-4">
                        <Activity className="w-6 h-6 lg:w-8 lg:h-8" /> Novedades y Observaciones
                      </p>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 xl:gap-8 overflow-y-auto no-scrollbar">
                        {[
                          { key: '1.MAÑANA', label: 'MAÑANA', color: 'emerald' },
                          { key: '2.TARDE', label: 'TARDE', color: 'blue' },
                          { key: '3.NOCHE', label: 'NOCHE', color: 'indigo' },
                          { key: '4.NOCHE FIN', label: 'NOCHE FIN', color: 'slate' }
                        ].map(shift => {
                          const news = shiftNews.filter(n => n.shift === shift.key);
                          return (
                            <div key={shift.key} className="bg-black/40 p-4 lg:p-5 rounded-3xl border border-white/5 flex flex-col gap-4 lg:gap-6 min-h-[350px] max-h-[600px]">
                              <div className="flex items-center justify-between border-b border-white/10 pb-3 lg:pb-4">
                                <div className="flex items-baseline gap-3">
                                  <span className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] text-${shift.color}-400/80`}>
                                    {shift.label}
                                  </span>
                                  <span className="text-xs font-bold text-white/20">[{news.length}]</span>
                                </div>
                                <div className={`w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full bg-${shift.color}-500/50 animate-pulse`} />
                              </div>
                              <div className="flex-1 flex flex-col min-h-0">
                                <NewsTicker news={news} />
                              </div>
                              <div className="flex items-center gap-2 text-[10px] lg:text-xs font-black text-slate-500 uppercase tracking-widest pt-3 border-t border-white/5">
                                <Clock className="w-3 h-3 lg:w-4 lg:h-4" /> <span className="hidden sm:inline">Sincronizado:</span> {currentTime.toLocaleTimeString()}
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
