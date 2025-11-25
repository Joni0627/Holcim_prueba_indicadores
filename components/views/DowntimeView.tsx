import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, Wrench, Users, ClipboardCheck, Loader2 } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

export const DowntimeView: React.FC = () => {
  const [downtimes, setDowntimes] = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  
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

  const totalDowntime = downtimes.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  
  // Aggregate by SAP CAUSE for Pie Chart
  // category field in DowntimeEvent is already mapped to sapCause in sheetService
  const bySapCause = downtimes.reduce((acc, curr) => {
      const cause = curr.category || 'Sin Clasificar';
      const existing = acc.find(c => c.name === cause);
      if (existing) {
          existing.value += curr.durationMinutes;
      } else {
          acc.push({ name: cause, value: curr.durationMinutes });
      }
      return acc;
  }, [] as { name: string, value: number }[]).sort((a,b) => b.value - a.value);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Detallado de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Ranking de motivos y distribución por Causas SAP.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
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
                        <p className="text-3xl font-bold text-slate-800 mt-2">{totalDowntime} <span className="text-sm font-normal text-slate-400">min</span></p>
                    </div>
                    {/* Convert minutes to hours for quick reference */}
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
                        <p className="text-3xl font-bold text-slate-800 mt-2">{downtimes.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ranking by TEXTO DE CAUSA (Reason) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Ranking Top 10 Motivos (Texto de Causa)</h3>
                    {downtimes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={downtimes.slice(0, 10)} layout="vertical" margin={{top:5, right:30, left:20, bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" unit="m" stroke="#94a3b8" fontSize={12} />
                                <YAxis 
                                    type="category" 
                                    dataKey="reason" 
                                    width={180} 
                                    style={{fontSize: '11px', fontWeight: 500, fill: '#475569'}} 
                                    tickFormatter={(val) => val.length > 25 ? `${val.substring(0,25)}...` : val}
                                />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                />
                                <Bar dataKey="durationMinutes" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                                    {downtimes.slice(0, 10).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">No hay datos para mostrar</div>
                    )}
                </div>

                {/* Pie Chart by CAUSA SAP */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Distribución por Grupo (Causa SAP)</h3>
                    {bySapCause.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={bySapCause}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={140}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {bySapCause.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">No hay datos para mostrar</div>
                    )}
                </div>
            </div>
          </>
      )}
    </div>
  );
};