
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, ClipboardCheck, Loader2, Filter, Table, ArrowDownCircle, BarChart2 } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

// Helper for hh:mm format
const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg z-50">
          <p className="font-semibold text-slate-800 text-sm mb-1">{data.reason}</p>
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
             <span className="font-mono bg-slate-100 px-1 rounded">{data.hac || 'N/A'}</span>
             {data.downtimeType && (
                 <span className={`px-1 rounded text-[10px] uppercase font-bold ${data.downtimeType.toLowerCase().includes('interno') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {data.downtimeType}
                 </span>
             )}
          </div>
          <p className="text-slate-600 text-sm">
            Duración: <span className="font-bold text-slate-900">{formatMinutes(data.durationMinutes)}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{data.sapCause}</p>
        </div>
      );
    }
    return null;
};

// Tooltip para el gráfico apilado
const StackedTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Calcular total de la barra actual
        const total = payload.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
        
        return (
            <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg z-50 max-h-64 overflow-y-auto">
                <p className="font-bold text-slate-800 text-sm mb-2 border-b border-slate-100 pb-1">{label} (HAC)</p>
                <div className="space-y-1">
                    {payload.map((entry: any, idx: number) => (
                         entry.value > 0 && (
                            <div key={idx} className="flex justify-between items-center gap-4 text-xs">
                                <span className="flex items-center gap-1.5 text-slate-600 max-w-[150px] truncate" title={entry.name}>
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: entry.color}}></span>
                                    {entry.name}
                                </span>
                                <span className="font-mono font-medium text-slate-800 shrink-0">
                                    {formatMinutes(entry.value)}
                                </span>
                            </div>
                         )
                    ))}
                </div>
                <div className="mt-2 pt-1 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-900">
                    <span>Total</span>
                    <span>{formatMinutes(total)}</span>
                </div>
            </div>
        );
    }
    return null;
};

export const DowntimeView: React.FC = () => {
  const [downtimes, setDowntimes] = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'interno' | 'externo'>('all');
  
  const handleFilterChange = async (range: { start: Date, end: Date }) => {
      setLoading(true);
      try {
          const result = await fetchDowntimes(range.start, range.end);
          setDowntimes(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // Filter Data based on selection
  const filteredDowntimes = downtimes.filter(d => {
      if (selectedType === 'all') return true;
      if (!d.downtimeType) return false;
      return d.downtimeType.toLowerCase().includes(selectedType);
  });

  const totalDowntime = filteredDowntimes.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  
  // Aggregate by REASON (Texto de Causa) for Pie Chart
  const byReason = filteredDowntimes.reduce((acc, curr) => {
      const reason = curr.reason || 'Sin Motivo';
      const existing = acc.find(c => c.name === reason);
      if (existing) {
          existing.value += curr.durationMinutes;
      } else {
          acc.push({ name: reason, value: curr.durationMinutes });
      }
      return acc;
  }, [] as { name: string, value: number }[]).sort((a,b) => b.value - a.value);

  // --- LOGIC FOR STACKED BAR CHART (HAC vs REASON/TEXTO DE CAUSA) ---
  const stackedDataMap = filteredDowntimes.reduce((acc, curr) => {
      const machine = curr.hac || 'Sin HAC';
      // CHANGED: Use reason (Texto de Causa) instead of sapCause for stacking
      const cause = curr.reason || 'Sin Motivo';
      
      if (!acc[machine]) {
          acc[machine] = { name: machine, totalDuration: 0 };
      }
      
      // Sumar al acumulador específico de esa causa
      acc[machine][cause] = (acc[machine][cause] || 0) + curr.durationMinutes;
      // Sumar al total de la máquina para ordenamiento
      acc[machine].totalDuration += curr.durationMinutes;
      
      return acc;
  }, {} as Record<string, any>);

  // Convertir mapa a array y ordenar por duración total (Pareto de Máquinas)
  const stackedData = Object.values(stackedDataMap).sort((a: any, b: any) => b.totalDuration - a.totalDuration);

  // Obtener todas las claves únicas de MOTIVOS (Reasons) para las barras apiladas
  // CHANGED: Source from reason instead of sapCause
  const stackKeys = Array.from(new Set(filteredDowntimes.map(d => d.reason || 'Sin Motivo')));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#84cc16'];
  // Expanded palette for reasons since there might be many
  const STACK_COLORS = [
      '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16', 
      '#3b82f6', '#ef4444', '#14b8a6', '#d946ef', '#f97316', '#a855f7', '#0ea5e9', '#22c55e'
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Detallado de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Ranking de motivos y distribución por Causas.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Downtime Type Filter */}
            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button 
                    onClick={() => setSelectedType('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedType === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Todos
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button 
                    onClick={() => setSelectedType('interno')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedType === 'interno' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Interno
                </button>
                <button 
                    onClick={() => setSelectedType('externo')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedType === 'externo' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Externo
                </button>
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
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-slate-100 rounded text-slate-600"><Clock size={16} /></div>
                            <span className="text-sm font-medium text-slate-500">Tiempo Total de Parada</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{formatMinutes(totalDowntime)} <span className="text-sm font-normal text-slate-400">hh:mm</span></p>
                    </div>
                    <div className="text-right text-sm text-slate-400">
                         ≈ {(totalDowntime / 60).toFixed(1)} horas
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
            
            {/* NEW STACKED BAR CHART (HAC vs REASON) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
                <div className="flex items-center gap-2 mb-1">
                     <BarChart2 size={20} className="text-indigo-500" />
                     <h3 className="font-bold text-slate-800">Impacto por Equipo (HAC) y Motivo</h3>
                </div>
                <p className="text-xs text-slate-500 mb-6">Visualización de qué equipos paran más y sus motivos específicos (Texto de Causa).</p>

                {stackedData.length > 0 ? (
                    <div className="flex-grow w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stackedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#64748b" 
                                    fontSize={12} 
                                    tick={{fill: '#334155'}}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={formatMinutes} />
                                <Tooltip content={<StackedTooltip />} cursor={{fill: '#f8fafc'}} />
                                {/* Removed Legend for Clarity as Reasons can be many */}
                                {stackKeys.map((key, index) => (
                                    <Bar 
                                        key={key} 
                                        dataKey={key} 
                                        stackId="a" 
                                        fill={STACK_COLORS[index % STACK_COLORS.length]} 
                                        name={key}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                        Sin datos para mostrar
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ranking by TEXTO DE CAUSA (Reason) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[550px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Ranking Top 10 Motivos (Texto de Causa)</h3>
                    {filteredDowntimes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredDowntimes.slice(0, 10)} layout="vertical" margin={{top:5, right:30, left:20, bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" unit="m" stroke="#94a3b8" fontSize={12} tickFormatter={formatMinutes} />
                                <YAxis 
                                    type="category" 
                                    dataKey="reason" 
                                    width={200} 
                                    style={{fontSize: '11px', fontWeight: 500, fill: '#475569'}} 
                                    tickFormatter={(val, index) => {
                                        const item = filteredDowntimes[index];
                                        const hacShort = item?.hac ? ` - [${item.hac}]` : '';
                                        const fullLabel = `${val}${hacShort}`;
                                        return fullLabel.length > 30 ? `${fullLabel.substring(0,30)}...` : fullLabel;
                                    }}
                                />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    content={<CustomBarTooltip />}
                                />
                                <Bar dataKey="durationMinutes" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                                    {filteredDowntimes.slice(0, 10).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">No hay datos para mostrar</div>
                    )}
                </div>

                {/* Pie Chart by TEXTO DE CAUSA (Reason) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[550px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Distribución por Motivo (Texto de Causa)</h3>
                    {byReason.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={byReason}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={140}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {byReason.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => [formatMinutes(value), 'Duración']}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={80} 
                                    layout="horizontal"
                                    wrapperStyle={{ fontSize: '11px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">No hay datos para mostrar</div>
                    )}
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Table size={20} className="text-slate-500"/>
                        Registro Detallado de Eventos
                    </h3>
                    <div className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                        Mostrando {filteredDowntimes.length} registros
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Fecha</th>
                                <th className="px-6 py-3 font-semibold">Turno</th>
                                <th className="px-6 py-3 font-semibold">Máquina (HAC)</th>
                                <th className="px-6 py-3 font-semibold">Motivo</th>
                                <th className="px-6 py-3 font-semibold">Tipo</th>
                                <th className="px-6 py-3 font-semibold text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDowntimes.map((event, idx) => (
                                <tr key={event.id || idx} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{event.date}</td>
                                    <td className="px-6 py-3 text-slate-600">{event.shift}</td>
                                    <td className="px-6 py-3 font-medium text-slate-800">{event.hac}</td>
                                    <td className="px-6 py-3 text-slate-600 max-w-xs truncate" title={event.reason}>
                                        {event.reason}
                                    </td>
                                    <td className="px-6 py-3">
                                        {event.downtimeType && (
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${event.downtimeType.toLowerCase().includes('interno') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {event.downtimeType}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-medium text-slate-700">
                                        {formatMinutes(event.durationMinutes)}
                                    </td>
                                </tr>
                            ))}
                            {filteredDowntimes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                        No se encontraron paros con los filtros seleccionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      )}
    </div>
  );
};
