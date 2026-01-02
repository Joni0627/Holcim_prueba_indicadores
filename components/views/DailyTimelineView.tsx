
import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Loader2, Info, Activity, AlertTriangle, ChevronLeft, ChevronRight, Calendar, Box } from 'lucide-react';
import { fetchDowntimes } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

// CONFIGURACIÓN DE TURNOS EXACTA SEGÚN USUARIO
const SHIFT_MAP = {
  '1.MAÑANA': { duration: 480, start: 6, label: 'Mañana (06:00 - 13:59)', color: 'emerald' },
  '2.TARDE': { duration: 480, start: 14, label: 'Tarde (14:00 - 21:59)', color: 'blue' },
  '4.NOCHE FIN': { duration: 120, start: 22, label: 'Noche Fin (22:00 - 23:59)', color: 'slate' },
  '3.NOCHE': { duration: 360, start: 0, label: 'Noche (00:00 - 05:59)', color: 'indigo' }
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
};

// Clasificación automática basada puramente en la hora de inicio
const getVisualShift = (startTime: string) => {
    const mins = timeToMinutes(startTime);
    if (mins >= 360 && mins < 840) return '1.MAÑANA';
    if (mins >= 840 && mins < 1320) return '2.TARDE';
    if (mins >= 1320 && mins < 1440) return '4.NOCHE FIN';
    if (mins >= 0 && mins < 360) return '3.NOCHE';
    return '1.MAÑANA';
};

const TimelineBar: React.FC<{ shiftKey: string, machineId: string, events: DowntimeEvent[] }> = ({ shiftKey, machineId, events }) => {
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

  const downtimeTotal = events.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  const availability = Math.max(0, ((totalMins - downtimeTotal) / totalMins) * 100);

  const getBlockColor = (block: any) => {
    if (block.type === 'uptime') return 'bg-emerald-500/80 hover:bg-emerald-500';
    const type = (block.event?.downtimeType || '').toLowerCase();
    if (type.includes('interno')) return 'bg-red-500 hover:bg-red-600 cursor-help';
    if (type.includes('externo')) return 'bg-slate-400 hover:bg-slate-500 cursor-help';
    return 'bg-red-500 hover:bg-red-600 cursor-help'; 
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row h-auto md:h-20 overflow-visible mb-2">
      <div className="w-full md:w-56 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-3 flex flex-col justify-center shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Box size={14} className="text-indigo-500" />
          <span className="text-[11px] font-black text-slate-800 uppercase truncate">{machineId}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
            <span className={`text-[10px] font-bold ${availability > 90 ? 'text-emerald-600' : availability > 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {availability.toFixed(1)}% Disp.
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{downtimeTotal} min paros</span>
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col justify-center gap-1.5 overflow-visible">
        <div className="w-full h-6 bg-slate-100 rounded-md flex border border-slate-200 shadow-inner group relative overflow-visible">
          {blocks.map((block, idx) => (
            <div 
              key={idx}
              className={`h-full relative transition-all border-r border-white/20 last:border-0 group/block ${getBlockColor(block)}`}
              style={{ width: `${(block.duration / totalMins) * 100}%` }}
            >
              {block.type === 'downtime' && block.event && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 text-white p-3 rounded-xl shadow-2xl opacity-0 group-hover/block:opacity-100 transition-all z-[100] pointer-events-none transform translate-y-1 group-hover/block:translate-y-0">
                  <div className="text-[10px] font-black border-b border-white/10 pb-1 mb-2 flex justify-between uppercase">
                    <span className="text-indigo-300">{block.event.startTime}</span>
                    <span className="text-white/60">{block.event.downtimeType}</span>
                    <span className="text-red-400">{block.duration} MIN</span>
                  </div>
                  <p className="text-[11px] font-bold text-white mb-1 uppercase tracking-tight">{block.event.hac}</p>
                  <p className="text-[10px] leading-tight text-slate-300 italic">"{block.event.reason}"</p>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between px-1 text-[8px] text-slate-400 font-mono uppercase">
           {Array.from({ length: (totalMins/60) + 1 }).map((_, i) => (
             <span key={i}>{((config.start + i) % 24).toString().padStart(2, '0')}:00</span>
           ))}
        </div>
      </div>
    </div>
  );
};

export const DailyTimelineView: React.FC = () => {
  const [downtimes, setDowntimes] = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);

  const loadData = async (dateStr: string) => {
    setLoading(true);
    try {
      const parts = dateStr.split('-');
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      const result = await fetchDowntimes(dateObj, dateObj);
      setDowntimes(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDay);
  }, [selectedDay]);

  const handleDayChange = (offset: number) => {
    const d = new Date(selectedDay + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDay(d.toISOString().split('T')[0]);
  };

  // Agrupamiento por Turno -> Máquina
  const groupedData = useMemo(() => {
    // Definimos las máquinas base para asegurar que aparezcan aunque no tengan paros
    const baseMachines = ['MG.672-PZ1', 'MG.673-PZ1', 'MG.674-PZ1'];
    
    // Extraer máquinas adicionales presentes en los datos
    const dynamicMachines = Array.from(new Set(downtimes.map(d => d.machineId))).filter(id => id && !baseMachines.includes(id));
    const allMachines = [...baseMachines, ...dynamicMachines];

    const result: Record<string, Record<string, DowntimeEvent[]>> = {};
    
    // Add explicit type for shift to avoid unknown inference
    Object.keys(SHIFT_MAP).forEach((shift: string) => {
      result[shift] = {};
      allMachines.forEach((m: string) => {
        result[shift][m] = [];
      });
    });

    // Add explicit type for curr to ensure startTime property is recognized correctly
    downtimes.forEach((curr: DowntimeEvent) => {
      const visualShift = getVisualShift(curr.startTime || '00:00');
      if (result[visualShift]) {
        if (!result[visualShift][curr.machineId]) result[visualShift][curr.machineId] = [];
        result[visualShift][curr.machineId].push(curr);
      }
    });

    return result;
  }, [downtimes]);

  const shiftsOrdered = ['1.MAÑANA', '2.TARDE', '4.NOCHE FIN', '3.NOCHE'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 overflow-visible pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                <Clock size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Cronograma de Operación</h2>
                <p className="text-slate-500 text-sm">Paros divididos por línea de producción y turno.</p>
            </div>
        </div>

        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => handleDayChange(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronLeft size={20} />
            </button>
            <div className="relative flex items-center">
                <Calendar size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input 
                    type="date" 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 pl-9 pr-4 py-1"
                />
            </div>
            <button onClick={() => handleDayChange(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronRight size={20} />
            </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mb-4 text-indigo-500" size={48} />
          <p className="font-medium uppercase tracking-widest text-xs">Sincronizando cronograma...</p>
        </div>
      ) : (
        <div className="space-y-8 overflow-visible">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-6 text-[10px] text-slate-500 shadow-sm font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> OPERATIVO</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> PARO INTERNO</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-400 rounded-sm"></div> PARO EXTERNO</div>
            <div className="ml-auto flex items-center gap-1.5 font-medium text-slate-400 italic normal-case">
                <Info size={14} className="text-indigo-400" />
                Visualización detallada por línea de producción.
            </div>
          </div>

          <div className="space-y-10 overflow-visible">
            {shiftsOrdered.map(s => (
              <div key={s} className="space-y-3">
                 <div className="flex items-center gap-3 px-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                        TURNO {SHIFT_MAP[s as keyof typeof SHIFT_MAP].label}
                    </h3>
                    <div className="flex-grow h-px bg-slate-100"></div>
                 </div>
                 <div className="grid grid-cols-1 gap-1">
                    {Object.entries(groupedData[s] || {}).map(([machine, events]) => (
                        <TimelineBar key={machine} shiftKey={s} machineId={machine} events={events} />
                    ))}
                 </div>
              </div>
            ))}
          </div>

          {downtimes.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-100 p-12 rounded-3xl flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <Activity size={32} />
                </div>
                <h3 className="text-xl font-bold text-emerald-900 uppercase">Sin Novedades de Parada</h3>
                <p className="text-emerald-700/70 max-w-sm mt-2 text-sm italic">Planta operando con normalidad teórica.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Detalle del Registro de Paros</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">INICIO (REAL)</th>
                                <th className="px-6 py-4">PALETIZADORA</th>
                                <th className="px-6 py-4">TURNO</th>
                                <th className="px-6 py-4">TIPO</th>
                                <th className="px-6 py-4">DETALLE EQUIPO</th>
                                <th className="px-6 py-4">MOTIVO</th>
                                <th className="px-6 py-4 text-right">DURACIÓN (MIN)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {downtimes.sort((a,b) => (a.startTime || '').localeCompare(b.startTime || '')).map((e, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-indigo-600">{e.startTime || '00:00'}</td>
                                    <td className="px-6 py-4 font-black text-slate-800 uppercase text-[11px]">{e.machineId}</td>
                                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{getVisualShift(e.startTime || '')}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                            (e.downtimeType || '').toLowerCase().includes('interno') 
                                            ? 'bg-red-50 text-red-600' 
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {e.downtimeType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600 text-[11px] uppercase">{e.hac}</td>
                                    <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate text-xs">"{e.reason}"</td>
                                    <td className="px-6 py-4 text-right font-black text-red-600">{e.durationMinutes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
