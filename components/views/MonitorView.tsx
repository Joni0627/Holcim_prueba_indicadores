import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // Corregido a framer-motion o motion/react según tu setup
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchDowntimes, fetchProductionStats, fetchStocks } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

// CONFIGURACIÓN DE TURNOS
const SHIFT_MAP = {
  '1.MAÑANA': { duration: 480, start: 6, label: 'Turno Mañana', color: 'emerald' },
  '2.TARDE': { duration: 480, start: 14, label: 'Turno Tarde', color: 'blue' },
  '3.NOCHE': { duration: 360, start: 0, label: 'Turno Noche', color: 'indigo' },
  '4.NOCHE FIN': { duration: 120, start: 22, label: 'Noche (Cierre)', color: 'slate' }
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getVisualShift = (startTime: string) => {
  const mins = timeToMinutes(startTime);
  if (mins >= 360 && mins < 840) return '1.MAÑANA';
  if (mins >= 840 && mins < 1320) return '2.TARDE';
  if (mins >= 1320 && mins < 1440) return '4.NOCHE FIN';
  return '3.NOCHE';
};

// COMPONENTE: BARRA DE TIEMPO POR MÁQUINA
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
      .map(e => ({ ...e, relativeStart: timeToMinutes(e.startTime) - shiftStartMin }))
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

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{machineId}</span>
        {longestEvent && (
          <div className="flex items-center gap-2 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
            <AlertCircle size={10} className="text-red-500" />
            <span className="text-[9px] font-bold text-red-500 uppercase">
              Principal: {longestEvent.reason} ({longestEvent.durationMinutes} min)
            </span>
          </div>
        )}
      </div>
      <div className="w-full h-8 bg-slate-800/50 rounded-xl flex overflow-hidden border border-slate-700/30 shadow-inner">
        {blocks.map((block, idx) => (
          <div 
            key={idx}
            className={`h-full border-r border-white/5 last:border-0 ${
              block.type === 'uptime' ? 'bg-emerald-500/40' : 'bg-red-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]'
            }`}
            style={{ width: `${(block.duration / totalMins) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
};

// COMPONENTE: PROGRESO CIRCULAR
const CircularProgress: React.FC<{ value: number, label: string, size?: number, strokeWidth?: number, color?: string }> = ({ 
  value, label, size = 60, strokeWidth = 6, color = "text-emerald-500" 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value * circumference);

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-800" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-black text-white">{(value * 100).toFixed(0)}%</span>
        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">{label}</span>
      </div>
    </div>
  );
};

export const MonitorView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);
  const [currentDowntimePage, setCurrentDowntimePage] = useState(0);
  
  const today = useMemo(() => new Date(), []);
  const shiftsOrdered = ['1.MAÑANA', '2.TARDE', '4.NOCHE FIN', '3.NOCHE'];

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ciclo Automático de Turnos y Páginas
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentShiftIndex(prev => (prev + 1) % shiftsOrdered.length);
      setCurrentDowntimePage(prev => prev + 1);
    }, 12000);
    return () => clearInterval(timer);
  }, [shiftsOrdered.length]);

  // Queries
  const { data: prodResult, isLoading: loadingProd } = useQuery({
    queryKey: ['monitor-prod'],
    queryFn: () => fetchProductionStats(today, today),
    refetchInterval: 600000, // 10 min
  });

  const { data: downtimeResult = [], isLoading: loadingDowntime } = useQuery({
    queryKey: ['monitor-downtimes'],
    queryFn: () => fetchDowntimes(today, today),
    refetchInterval: 600000,
  });

  const { data: stockResult, isLoading: loadingStock } = useQuery({
    queryKey: ['monitor-stocks'],
    queryFn: () => fetchStocks(today, today),
    refetchInterval: 600000,
  });

  useEffect(() => {
    if (prodResult || downtimeResult.length > 0) setLastUpdated(new Date());
  }, [prodResult, downtimeResult]);

  // Lógica de Datos
  const producedStock = useMemo(() => {
    if (!stockResult?.items) return [];
    return stockResult.items.filter(i => i.isProduced).slice(0, 4);
  }, [stockResult]);

  const groupedTimeline = useMemo(() => {
    const machines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    const result: any = {};
    shiftsOrdered.forEach(s => {
      result[s] = {};
      machines.forEach(m => result[s][m] = { events: [], longestEvent: null });
    });

    downtimeResult.forEach(event => {
      const shift = getVisualShift(event.startTime);
      if (result[shift]?.[event.machineId]) {
        result[shift][event.machineId].events.push(event);
        const currentLongest = result[shift][event.machineId].longestEvent;
        if (!currentLongest || event.durationMinutes > currentLongest.durationMinutes) {
          result[shift][event.machineId].longestEvent = event;
        }
      }
    });
    return result;
  }, [downtimeResult]);

  const allDowntimesOrdered = useMemo(() => {
    return [...downtimeResult]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .slice(0, 15);
  }, [downtimeResult]);

  const paginatedDowntimes = useMemo(() => {
    const items = 5;
    const totalPages = Math.ceil(allDowntimesOrdered.length / items);
    if (totalPages === 0) return [];
    const page = currentDowntimePage % totalPages;
    return allDowntimesOrdered.slice(page * items, (page + 1) * items);
  }, [allDowntimesOrdered, currentDowntimePage]);

  if (loadingProd || loadingDowntime || loadingStock) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <span className="text-white font-black tracking-widest uppercase">Sincronizando Monitor...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-hidden font-sans">
      {/* Header Estilo Dashboard */}
      <div className="h-20 bg-slate-900 border-b border-slate-800 px-8 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-6">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-emerald-500">Plant Monitor <span className="text-white">v3.0</span></h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Actualizado: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {producedStock.map(stock => (
            <div key={stock.product} className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
              <p className="text-[8px] font-black text-slate-500 uppercase">{stock.product.split(' ')[1]}</p>
              <p className="text-lg font-black text-white leading-none">{Math.floor(stock.tonnage)}<span className="text-[10px] ml-1 text-emerald-500">TN</span></p>
            </div>
          ))}
        </div>

        <div className="text-right">
          <p className="text-2xl font-mono font-black leading-none">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{currentTime.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Columna Izquierda: Rankings */}
        <div className="col-span-4 flex flex-col gap-6">
          <div className="flex-1 bg-slate-900/50 rounded-3xl border border-slate-800 p-6 flex flex-col shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-amber-500" />
              <h2 className="text-sm font-black uppercase tracking-widest">Producción por Turno</h2>
            </div>
            <div className="space-y-3">
              {prodResult?.byShift?.sort((a,b) => b.valueTn - a.valueTn).map((s, idx) => (
                <div key={s.name} className={`p-4 rounded-2xl border transition-all ${idx === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-400 uppercase">{s.name.split('.')[1]}</span>
                    <span className={`text-xl font-black ${idx === 0 ? 'text-emerald-400' : 'text-white'}`}>{Math.floor(s.valueTn)} TN</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-1/3 bg-red-950/20 rounded-3xl border border-red-900/30 p-6 flex flex-col">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2">
                 <AlertCircle size={14}/> Top Paros del Día
               </h2>
             </div>
             <div className="space-y-2 overflow-hidden">
               {paginatedDowntimes.map((d, i) => (
                 <div key={i} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-2">
                   <span className="font-bold text-slate-300 truncate max-w-[150px]">{d.reason}</span>
                   <span className="font-black text-red-400">{d.durationMinutes} min</span>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Columna Derecha: Timeline Dinámico */}
        <div className="col-span-8 bg-slate-900/80 rounded-3xl border border-slate-800 p-8 flex flex-col relative shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentShiftIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white">
                    {SHIFT_MAP[shiftsOrdered[currentShiftIndex] as keyof typeof SHIFT_MAP].label}
                  </h2>
                  <p className="text-emerald-500 font-bold text-sm">Cronograma de disponibilidad en tiempo real</p>
                </div>
                <div className="flex gap-2">
                  {shiftsOrdered.map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === currentShiftIndex ? 'w-12 bg-emerald-500' : 'w-4 bg-slate-800'}`} />
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center gap-8">
                {Object.entries(groupedTimeline[shiftsOrdered[currentShiftIndex]] || {}).map(([machine, data]: any) => (
                  <MonitorTimelineBar 
                    key={machine} 
                    shiftKey={shiftsOrdered[currentShiftIndex]} 
                    machineId={machine} 
                    events={data.events} 
                    longestEvent={data.longestEvent} 
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
