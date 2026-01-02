
import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Loader2, Info, Activity, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchDowntimes } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

// CONFIGURACIÓN DE TURNOS SEGÚN TABLA "TURNOS"
const SHIFT_MAP = {
  '1.MAÑANA': { duration: 480, start: 6, end: 14, label: 'Mañana (06:00 - 14:00)' },
  '2.TARDE': { duration: 480, start: 14, end: 22, label: 'Tarde (14:00 - 22:00)' },
  '3.NOCHE': { duration: 360, start: 22, end: 4, label: 'Noche (22:00 - 04:00)' },
  '4.NOCHE FIN': { duration: 120, start: 4, end: 6, label: 'Noche Fin (04:00 - 06:00)' }
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

// FUNCIÓN PARA ACOMODAR PAROS EN EL TURNO CORRECTO SEGÚN LA HORA (Fix Mismatch)
const getVisualShift = (startTime: string) => {
    const mins = timeToMinutes(startTime);
    if (mins >= 360 && mins < 840) return '1.MAÑANA';
    if (mins >= 840 && mins < 1320) return '2.TARDE';
    if (mins >= 1320 || mins < 240) return '3.NOCHE'; // 22:00 a 04:00
    if (mins >= 240 && mins < 360) return '4.NOCHE FIN'; // 04:00 a 06:00
    return '1.MAÑANA';
};

const TimelineBar: React.FC<{ shiftKey: string, events: DowntimeEvent[] }> = ({ shiftKey, events }) => {
  const config = SHIFT_MAP[shiftKey as keyof typeof SHIFT_MAP] || { duration: 480, start: 0, label: shiftKey };
  const totalMins = config.duration;
  const shiftStartMin = config.start * 60;

  const blocks = useMemo(() => {
    const sortedEvents = events
      .map(e => {
        let eventStartMin = timeToMinutes(e.startTime || '00:00');
        
        // Manejo de cruce de medianoche para el cálculo relativo
        if (config.start === 22 && eventStartMin < 6 * 60) eventStartMin += 24 * 60;
        
        let relativeStart = eventStartMin - shiftStartMin;
        if (relativeStart < 0 && config.start >= 22) relativeStart += 24 * 60;

        return { ...e, relativeStart };
      })
      .filter(e => e.relativeStart >= 0 && e.relativeStart < totalMins)
      .sort((a, b) => a.relativeStart - b.relativeStart);

    const segments: { type: 'uptime' | 'downtime', duration: number, event?: DowntimeEvent }[] = [];
    let currentPos = 0;

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row h-auto md:h-24">
      <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col justify-center shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={14} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{config.label}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-400 font-mono">Total: {totalMins/60}h</span>
            <span className={`text-xs font-bold ${availability > 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {availability.toFixed(1)}% Disp.
            </span>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-center gap-2 overflow-visible">
        <div className="w-full h-8 bg-slate-100 rounded-lg flex border border-slate-200 shadow-inner group relative overflow-visible">
          {blocks.map((block, idx) => (
            <div 
              key={idx}
              className={`h-full relative transition-all border-r border-white/20 last:border-0 group/block ${
                block.type === 'uptime' ? 'bg-emerald-500/80 hover:bg-emerald-500' : 'bg-red-500 hover:bg-red-600 cursor-help'
              }`}
              style={{ width: `${(block.duration / totalMins) * 100}%` }}
            >
              {block.type === 'downtime' && block.event && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 text-white p-3 rounded-xl shadow-2xl opacity-0 group-hover/block:opacity-100 transition-all z-[100] pointer-events-none transform translate-y-1 group-hover/block:translate-y-0">
                  <div className="text-[10px] font-black border-b border-white/10 pb-1 mb-2 flex justify-between uppercase">
                    <span className="text-indigo-300">INICIO: {block.event.startTime}</span>
                    <span className="text-red-400">{block.duration} MINUTOS</span>
                  </div>
                  <p className="text-[11px] font-bold text-white mb-1 uppercase">{block.event.hac}</p>
                  <p className="text-[10px] leading-tight text-slate-300 italic">"{block.event.reason}"</p>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between px-1 text-[9px] text-slate-400 font-mono uppercase">
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
      const dateObj = new Date(dateStr + "T12:00:00");
      const result = await fetchDowntimes(dateObj, dateObj);
      setDowntimes(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData(selectedDay);
  }, [selectedDay]);

  const handleDayChange = (offset: number) => {
    const d = new Date(selectedDay + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDay(d.toISOString().split('T')[0]);
  };

  const grouped = useMemo(() => {
    return downtimes.reduce((acc, curr) => {
      const visualShift = getVisualShift(curr.startTime || '00:00');
      if (!acc[visualShift]) acc[visualShift] = [];
      acc[visualShift].push(curr);
      return acc;
    }, {} as Record<string, DowntimeEvent[]>);
  }, [downtimes]);

  const shifts = ['1.MAÑANA', '2.TARDE', '3.NOCHE', '4.NOCHE FIN'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 overflow-visible">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                <Clock size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Cronograma de Operación</h2>
                <p className="text-slate-500 text-sm flex items-center gap-2">
                    Seleccione el día para ver la cronología de paros.
                </p>
            </div>
        </div>

        {/* SELECTOR DE DÍA ÚNICO */}
        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => handleDayChange(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronLeft size={20} />
            </button>
            <input 
                type="date" 
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 px-4 py-1"
            />
            <button onClick={() => handleDayChange(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronRight size={20} />
            </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mb-4 text-indigo-500" size={48} />
          <p className="font-medium">Sincronizando cronograma...</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-visible">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-6 text-[11px] text-slate-500 shadow-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> OPERATIVO (UPTIME)</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> PARO REGISTRADO (DOWNTIME)</div>
            <div className="ml-auto flex items-center gap-1.5 font-medium">
                <Info size={14} className="text-indigo-400" />
                Los paros se clasifican automáticamente por hora de inicio.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 overflow-visible">
            {shifts.map(s => (
              <TimelineBar key={s} shiftKey={s} events={grouped[s] || []} />
            ))}
          </div>

          {downtimes.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-100 p-12 rounded-3xl flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <Activity size={32} />
                </div>
                <h3 className="text-xl font-bold text-emerald-900 uppercase">Sin Novedades de Parada</h3>
                <p className="text-emerald-700/70 max-w-sm mt-2 text-sm">Planta operando al 100% de disponibilidad teórica para el día seleccionado.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="font-bold text-slate-800">Eventos del Día ({selectedDay})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="px-6 py-3">CARRIL VISUAL</th>
                                <th className="px-6 py-3">HORA</th>
                                <th className="px-6 py-3">HAC</th>
                                <th className="px-6 py-3">MOTIVO SAP / CAUSA</th>
                                <th className="px-6 py-3 text-right">MINUTOS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {downtimes.sort((a,b) => (a.startTime || '').localeCompare(b.startTime || '')).map((e, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-[10px] font-black text-slate-400">{getVisualShift(e.startTime || '')}</td>
                                    <td className="px-6 py-4 font-mono font-bold text-indigo-600">{e.startTime}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{e.hac}</td>
                                    <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">"{e.reason}"</td>
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
