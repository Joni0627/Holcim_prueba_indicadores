
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, ClipboardCheck, Loader2, Filter, Table, ArrowDownCircle, BarChart2, CalendarDays, Info } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { analyzeDowntimeData } from '../../services/geminiService';
import { DowntimeEvent, AIAnalysisResult } from '../../types';
import { AIAnalyst } from '../AIAnalyst';

// --- HELPERS PARA LÍNEA DE TIEMPO ---
const SHIFTS_CONFIG = {
    '1.MAÑANA': { start: 6, end: 14, label: 'Mañana (06:00 - 14:00)' },
    '2.TARDE': { start: 14, end: 22, label: 'Tarde (14:00 - 22:00)' },
    '3.NOCHE': { start: 22, end: 6, label: 'Noche (22:00 - 06:00)' },
    '3. NOCHE': { start: 22, end: 6, label: 'Noche (22:00 - 06:00)' },
};

const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// --- COMPONENTE SHIFT TIMELINE ---
const ShiftTimeline: React.FC<{ shiftKey: string, events: DowntimeEvent[] }> = ({ shiftKey, events }) => {
    const config = SHIFTS_CONFIG[shiftKey.toUpperCase() as keyof typeof SHIFTS_CONFIG] || { start: 0, end: 24, label: shiftKey };
    
    const blocks = useMemo(() => {
        const totalDuration = 480; // 8 hours in minutes
        const shiftStartMin = config.start * 60;
        
        // Normalizar tiempos de eventos relativos al inicio del turno
        const sortedEvents = events
            .map(e => {
                let eventStartMin = timeToMinutes(e.startTime || '00:00');
                
                // Manejo de cruce de medianoche para el turno noche
                if (config.start === 22 && eventStartMin < 6 * 60) {
                    eventStartMin += 24 * 60;
                }
                
                let relativeStart = eventStartMin - shiftStartMin;
                if (relativeStart < 0 && config.start === 22) relativeStart += 24 * 60;

                return { ...e, relativeStart };
            })
            .filter(e => e.relativeStart >= 0 && e.relativeStart < totalDuration)
            .sort((a, b) => a.relativeStart - b.relativeStart);

        const segments: { type: 'uptime' | 'downtime', duration: number, event?: DowntimeEvent }[] = [];
        let currentPos = 0;

        sortedEvents.forEach(event => {
            // Gap (Uptime)
            if (event.relativeStart > currentPos) {
                segments.push({ type: 'uptime', duration: event.relativeStart - currentPos });
            }
            // Paro (Downtime)
            const duration = Math.min(event.durationMinutes, totalDuration - event.relativeStart);
            segments.push({ type: 'downtime', duration, event });
            currentPos = event.relativeStart + duration;
        });

        // Rellenar hasta el final del turno
        if (currentPos < totalDuration) {
            segments.push({ type: 'uptime', duration: totalDuration - currentPos });
        }

        return segments;
    }, [events, config]);

    return (
        <div className="space-y-2 mb-8">
            <div className="flex justify-between items-center px-1">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{config.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">Total: 8h</span>
            </div>
            
            <div className="relative w-full h-10 bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200 shadow-inner group">
                {blocks.map((block, idx) => (
                    <div 
                        key={idx}
                        className={`h-full relative transition-all border-r border-white/20 last:border-0 ${
                            block.type === 'uptime' ? 'bg-emerald-500/80 hover:bg-emerald-500' : 'bg-red-500 hover:bg-red-600 cursor-help'
                        }`}
                        style={{ width: `${(block.duration / 480) * 100}%` }}
                    >
                        {block.type === 'downtime' && (
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100" />
                        )}
                        
                        {/* Tooltip Nativo o Personalizado al hacer Hover */}
                        {block.type === 'downtime' && block.event && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                <p className="font-bold border-b border-white/10 pb-1 mb-1">{block.event.startTime} - {block.event.hac}</p>
                                <p className="leading-tight">{block.event.reason}</p>
                                <p className="mt-1 text-red-400 font-bold">Duración: {block.duration} min</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Marcadores de hora */}
            <div className="flex justify-between px-1 text-[9px] text-slate-400 font-mono uppercase">
                {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i}>{((config.start + i) % 24).toString().padStart(2, '0')}:00</span>
                ))}
            </div>
        </div>
    );
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg z-50">
          <p className="font-semibold text-slate-800 text-sm mb-1">{data.reason}</p>
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
             <span className="font-mono bg-slate-100 px-1 rounded">{data.hac || 'N/A'}</span>
             <span className="font-mono bg-indigo-50 text-indigo-600 px-1 rounded">{data.startTime || '00:00'}</span>
          </div>
          <p className="text-slate-600 text-sm">
            Duración: <span className="font-bold text-slate-900">{formatMinutes(data.durationMinutes)}</span>
          </p>
        </div>
      );
    }
    return null;
};

export const DowntimeView: React.FC = () => {
  const [downtimes, setDowntimes] = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'interno' | 'externo'>('all');
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const handleFilterChange = async (range: { start: Date, end: Date }) => {
      setLoading(true);
      setAiAnalysis(null);
      try {
          const result = await fetchDowntimes(range.start, range.end);
          setDowntimes(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAIAnalysis = async () => {
      if (downtimes.length === 0) return;
      setAiLoading(true);
      try {
          const result = await analyzeDowntimeData(downtimes);
          setAiAnalysis(result);
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  const filteredDowntimes = downtimes.filter(d => {
      if (selectedType === 'all') return true;
      if (!d.downtimeType) return false;
      return d.downtimeType.toLowerCase().includes(selectedType);
  });

  const totalDowntime = filteredDowntimes.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  
  // Agrupar por turnos para la línea de tiempo
  const eventsByShift = filteredDowntimes.reduce((acc, curr) => {
      const s = String(curr.shift || 'Sin Turno').toUpperCase();
      if (!acc[s]) acc[s] = [];
      acc[s].push(curr);
      return acc;
  }, {} as Record<string, DowntimeEvent[]>);

  const shiftsToShow = ['1.MAÑANA', '2.TARDE', '3.NOCHE'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Detallado de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Línea de tiempo cronológica y ranking de Pareto.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => setSelectedType('all')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedType === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}>Todos</button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button onClick={() => setSelectedType('interno')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedType === 'interno' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:text-slate-800'}`}>Interno</button>
                <button onClick={() => setSelectedType('externo')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedType === 'externo' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>Externo</button>
            </div>
            <DateFilter onFilterChange={handleFilterChange} />
        </div>
      </div>

      {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Cargando datos...</p>
          </div>
      ) : (
          <>
            <div className="mb-6">
                <AIAnalyst analysis={aiAnalysis} loading={aiLoading} onAnalyze={handleAIAnalysis} />
            </div>

            {/* CRONOGRAMA POR TURNOS (NUEVA SECCIÓN) */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <CalendarDays size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Cronograma de Operación (Disponibilidad)</h3>
                        <p className="text-xs text-slate-500">Visualización de paros reportados a lo largo de cada turno.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {shiftsToShow.map(shiftKey => (
                        <ShiftTimeline 
                            key={shiftKey} 
                            shiftKey={shiftKey} 
                            events={eventsByShift[shiftKey] || []} 
                        />
                    ))}
                    
                    <div className="mt-4 flex items-center gap-6 justify-center py-2 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                            <div className="w-3 h-3 bg-emerald-500 rounded"></div> Operativo (Uptime)
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                            <div className="w-3 h-3 bg-red-500 rounded"></div> Paro (Downtime)
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Info size={12} /> Pasa el mouse sobre el rojo para detalles
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-slate-100 rounded text-slate-600"><Clock size={16} /></div>
                            <span className="text-sm font-medium text-slate-500">Tiempo Total de Parada</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{formatMinutes(totalDowntime)} <span className="text-sm font-normal text-slate-400">hh:mm</span></p>
                    </div>
                </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-blue-50 rounded text-blue-600"><ClipboardCheck size={16} /></div>
                            <span className="text-sm font-medium text-slate-500">Eventos Registrados</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{filteredDowntimes.length}</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Ranking Top 10 Motivos</h3>
                    {filteredDowntimes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredDowntimes.slice(0, 10)} layout="vertical" margin={{top:5, right:30, left:20, bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={formatMinutes} />
                                <YAxis 
                                    type="category" 
                                    dataKey="reason" 
                                    width={180} 
                                    style={{fontSize: '11px', fontWeight: 500, fill: '#475569'}} 
                                    tickFormatter={(val) => val.length > 25 ? `${val.substring(0,25)}...` : val}
                                />
                                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomBarTooltip />} />
                                <Bar dataKey="durationMinutes" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                                    {filteredDowntimes.slice(0, 10).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">No hay datos</div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Distribución por Causa SAP</h3>
                    {filteredDowntimes.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie
                                     data={Object.entries(filteredDowntimes.reduce((acc, curr) => {
                                         const cat = curr.sapCause || 'Otros';
                                         acc[cat] = (acc[cat] || 0) + curr.durationMinutes;
                                         return acc;
                                     }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                                     cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value"
                                 >
                                     {filteredDowntimes.map((_, index) => (
                                         <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                                     ))}
                                 </Pie>
                                 <Tooltip formatter={(value: number) => formatMinutes(value)} />
                                 <Legend />
                             </PieChart>
                         </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">Sin datos</div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Table size={20} className="text-slate-500"/>
                        Registro Detallado de Eventos
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Hora</th>
                                <th className="px-6 py-3 font-semibold">Turno</th>
                                <th className="px-6 py-3 font-semibold">Máquina (HAC)</th>
                                <th className="px-6 py-3 font-semibold">Motivo</th>
                                <th className="px-6 py-3 text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDowntimes.map((event, idx) => (
                                <tr key={event.id || idx} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-3 font-mono text-slate-500">{event.startTime}</td>
                                    <td className="px-6 py-3 text-slate-600">{event.shift}</td>
                                    <td className="px-6 py-3 font-medium text-slate-800">{event.hac}</td>
                                    <td className="px-6 py-3 text-slate-600 max-w-xs truncate">{event.reason}</td>
                                    <td className="px-6 py-3 text-right font-mono font-medium text-slate-700">{formatMinutes(event.durationMinutes)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      )}
    </div>
  );
};
