
import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

const MonitorTimelineBar: React.FC<{ shiftKey: string, machineId: string, events: DowntimeEvent[] }> = ({ shiftKey, machineId, events }) => {
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
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{machineId}</span>
      </div>
      <div className="w-full h-4 bg-slate-800/50 rounded flex overflow-hidden border border-slate-700/30">
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

export const MonitorView: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const today = useMemo(() => new Date(), []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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
      })
      .slice(0, 4);
  }, [stockResult]);

  const groupedTimeline = useMemo(() => {
    const baseMachines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    const result: Record<string, Record<string, DowntimeEvent[]>> = {};
    
    Object.keys(SHIFT_MAP).forEach((shift) => {
      result[shift] = {};
      baseMachines.forEach((m) => {
        result[shift][m] = [];
      });
    });

    downtimeResult.forEach((curr) => {
      const visualShift = getVisualShift(curr.startTime || '00:00');
      if (result[visualShift]) {
        if (!result[visualShift][curr.machineId]) result[visualShift][curr.machineId] = [];
        result[visualShift][curr.machineId].push(curr);
      }
    });

    return result;
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
    <div className="fixed inset-0 bg-slate-950 text-white p-6 flex flex-col gap-6 overflow-hidden z-[60]">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Layout size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Monitor de Producción</h1>
            <p className="text-emerald-500 font-bold uppercase text-sm tracking-widest">Expedición Malagueño | Tiempo Real</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-5xl font-black tracking-tighter font-mono">
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left Column: Ranking & Stock */}
        <div className="col-span-4 flex flex-col gap-6 overflow-hidden">
          
          {/* Ranking Card */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[250px]">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Trophy size={120} />
            </div>
            <p className="text-amber-500 font-black uppercase tracking-[0.2em] text-sm mb-4">Ranking del Día</p>
            {topShift ? (
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-400 uppercase tracking-tight">Turno Destacado</h2>
                <h3 className="text-6xl font-black text-white tracking-tighter uppercase">{topShift.name}</h3>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-4xl font-black text-emerald-400">{topShift.valueTn.toFixed(0)}</span>
                  <span className="text-xl font-bold text-slate-500 uppercase">Toneladas</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 italic">Calculando ranking...</p>
            )}
          </div>

          {/* Stock Card */}
          <div className="flex-1 bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <p className="text-blue-400 font-black uppercase tracking-[0.2em] text-sm">Estado de Stock</p>
              <Package size={20} className="text-slate-600" />
            </div>
            <div className="space-y-6 flex-grow flex flex-col justify-around">
              {producedStock.map(item => (
                <div key={item.id} className="flex justify-between items-end border-b border-slate-800 pb-4 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{item.product}</p>
                    <p className="text-4xl font-black tracking-tighter text-white">
                      {item.tonnage.toLocaleString()}
                      <span className="text-lg font-bold text-blue-500 ml-2">Tn</span>
                    </p>
                  </div>
                  <div className="h-12 w-1 bg-emerald-500/30 rounded-full"></div>
                </div>
              ))}
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

          <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pr-2">
            {shiftsOrdered.map(s => (
              <div key={s} className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] whitespace-nowrap">
                    {SHIFT_MAP[s as keyof typeof SHIFT_MAP].label}
                  </span>
                  <div className="flex-grow h-px bg-slate-800"></div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(groupedTimeline[s] || {}).map(([machine, events]) => (
                    <MonitorTimelineBar key={machine} shiftKey={s} machineId={machine} events={events} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] pt-2 border-t border-slate-800">
        <p>Sistema de Monitoreo PSC QUBE v2.0</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <p>Conexión Activa | Actualización cada 20 min</p>
        </div>
      </div>
    </div>
  );
};
