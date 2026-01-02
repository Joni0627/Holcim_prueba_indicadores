
import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Loader2, Info, ArrowRight, Activity, AlertTriangle } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

// CONFIGURACIÓN DE TURNOS SEGÚN TABLA "TURNOS"
const SHIFT_MAP = {
  '1.MAÑANA': { duration: 480, start: 6, label: 'Mañana (06:00 - 14:00)', color: 'emerald' },
  '2.TARDE': { duration: 480, start: 14, label: 'Tarde (14:00 - 22:00)', color: 'blue' },
  '3.NOCHE': { duration: 360, start: 22, label: 'Noche (22:00 - 04:00)', color: 'indigo' },
  '4.NOCHE FIN': { duration: 120, start: 4, label: 'Noche Fin (04:00 - 06:00)', color: 'slate' }
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const formatMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const TimelineBar: React.FC<{ shiftKey: string, events: DowntimeEvent[] }> = ({ shiftKey, events }) => {
  const config = SHIFT_MAP[shiftKey as keyof typeof SHIFT_MAP] || { duration: 480, start: 0, label: shiftKey };
  const totalMins = config.duration;
  const shiftStartMin = config.start * 60;

  const blocks = useMemo(() => {
    // Normalizar tiempos relativos al inicio del turno
    const sortedEvents = events
      .map(e => {
        let eventStartMin = timeToMinutes(e.startTime || '00:00');
        
        // Manejo de cruce de medianoche
        if (config.start === 22 && eventStartMin < 6 * 60) eventStartMin += 24 * 60;
        if (config.start === 4 && eventStartMin < 4 * 60) eventStartMin += 24 * 60; // Caso raro Noche Fin
        
        let relativeStart = eventStartMin - shiftStartMin;
        // Ajuste si el cálculo da negativo por lógica de medianoche
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-auto md:h-24">
      {/* Sidebar de Turno */}
      <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={14} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{config.label}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-400 font-mono">Duración: {totalMins/60}h</span>
            <span className={`text-xs font-bold ${availability > 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {availability.toFixed(1)}% Disp.
            </span>
        </div>
      </div>

      {/* Timeline Principal */}
      <div className="flex-1 p-4 flex flex-col justify-center gap-2">
        <div className="w-full h-8 bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200 shadow-inner group relative">
          {blocks.map((block, idx) => (
            <div 
              key={idx}
              className={`h-full relative transition-all border-r border-white/20 last:border-0 ${
                block.type === 'uptime' ? 'bg-emerald-500/80 hover:bg-emerald-500' : 'bg-red-500 hover:bg-red-600 cursor-help'
              }`}
              style={{ width: `${(block.duration / totalMins) * 100}%` }}
            >
              {block.type === 'downtime' && block.event && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white p-3 rounded-xl shadow-2xl opacity-0 hover:opacity-100 transition-all z-50 pointer-events-none transform translate-y-1 group-hover:translate-y-0">
                  <p className="text-[10px] font-black border-b border-white/10 pb-1 mb-2 flex justify-between uppercase">
                    <span>{block.event.startTime}</span>
                    <span className="text-red-400">{block.duration} MIN</span>
                  </p>
                  <p className="text-[11px] font-bold text-indigo-300 mb-1">{block.event.hac}</p>
                  <p className="text-[10px] leading-tight text-slate-300">{block.event.reason}</p>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Marcadores de tiempo */}
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
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString());

  const handleFilterChange = async (range: { start: Date, end: Date }) => {
    setLoading(true);
    try {
      setSelectedDay(range.start.toLocaleDateString());
      const result = await fetchDowntimes(range.start, range.start); // Forzar 1 día
      setDowntimes(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    return downtimes.reduce((acc, curr) => {
      const s = String(curr.shift || '1.MAÑANA').toUpperCase();
      if (!acc[s]) acc[s] = [];
      acc[s].push(curr);
      return acc;
    }, {} as Record<string, DowntimeEvent[]>);
  }, [downtimes]);

  const shifts = ['1.MAÑANA', '2.TARDE', '3.NOCHE', '4.NOCHE FIN'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                <Activity size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Cronograma de Operación</h2>
                <p className="text-slate-500 text-sm flex items-center gap-2">
                    <Calendar size={14} /> Análisis de disponibilidad del día: <span className="font-bold text-indigo-600">{selectedDay}</span>
                </p>
            </div>
        </div>
        <DateFilter onFilterChange={handleFilterChange} defaultFilter="today" />
      </div>

      {loading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mb-4 text-indigo-500" size={48} />
          <p className="font-medium">Mapeando eventos cronológicos...</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 text-xs text-slate-500 shadow-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded"></div> Operativo</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded"></div> Paro de Máquina</div>
            <div className="ml-auto flex items-center gap-1"><Info size={14} /> Los anchos de las barras son proporcionales a las horas del turno (8h, 6h, 2h).</div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {shifts.map(s => (
              <TimelineBar key={s} shiftKey={s} events={grouped[s] || []} />
            ))}
          </div>

          {downtimes.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-100 p-12 rounded-3xl flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <Activity size={32} />
                </div>
                <h3 className="text-xl font-bold text-emerald-900">Operación 100% Disponible</h3>
                <p className="text-emerald-700/70 max-w-md mt-2">No se han registrado paros en este día. La planta ha operado de forma continua según el cronograma.</p>
            </div>
          )}

          {/* Tabla de resumen rápido al final */}
          {downtimes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="font-bold text-slate-800">Resumen de Paros del Día</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-3">Turno</th>
                                <th className="px-6 py-3">Hora Inicio</th>
                                <th className="px-6 py-3">Equipo (HAC)</th>
                                <th className="px-6 py-3">Motivo</th>
                                <th className="px-6 py-3 text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {downtimes.sort((a,b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!)).map((e, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-500">{e.shift}</td>
                                    <td className="px-6 py-4 font-mono">{e.startTime}</td>
                                    <td className="px-6 py-4 font-bold text-indigo-600">{e.hac}</td>
                                    <td className="px-6 py-4 text-slate-600">{e.reason}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-800">{e.durationMinutes} min</td>
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
