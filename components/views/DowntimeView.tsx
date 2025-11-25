import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, Wrench, Users, ClipboardCheck, Loader2 } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { DowntimeEvent } from '../../types';

export const DowntimeView: React.FC = () => {
  const [downtimes, setDowntimes] = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  
  const handleDateChange = async (date: Date) => {
      setLoading(true);
      try {
          const result = await fetchDowntimes(date);
          setDowntimes(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const totalDowntime = downtimes.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  
  // Calculate categories dynamically from fetched data
  const byCategory = [
    { name: 'Técnico', value: downtimes.filter(d => d.category === 'technical').reduce((a, c) => a + c.durationMinutes, 0), color: '#3b82f6' },
    { name: 'Organizacional', value: downtimes.filter(d => d.category === 'organizational').reduce((a, c) => a + c.durationMinutes, 0), color: '#f59e0b' },
    { name: 'Calidad', value: downtimes.filter(d => d.category === 'quality').reduce((a, c) => a + c.durationMinutes, 0), color: '#ef4444' },
    { name: 'Mantenimiento', value: downtimes.filter(d => d.category === 'maintenance').reduce((a, c) => a + c.durationMinutes, 0), color: '#6366f1' },
  ].filter(c => c.value > 0); // Only show active categories

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Detallado de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Identificación de cuellos de botella y pérdidas principales.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
            <DateFilter onFilterChange={handleDateChange} />
        </div>
      </div>

      {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Cargando datos del servidor...</p>
          </div>
      ) : (
          <>
            {/* KPI Cards for Downtime */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-100 rounded text-slate-600"><Clock size={16} /></div>
                        <span className="text-sm font-medium text-slate-500">Total Paros</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{totalDowntime} <span className="text-sm font-normal text-slate-400">min</span></p>
                </div>
                {byCategory.find(c => c.name === 'Técnico') && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded text-blue-600"><Wrench size={16} /></div>
                            <span className="text-sm font-medium text-slate-500">Fallas Técnicas</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{byCategory.find(c => c.name === 'Técnico')?.value || 0} <span className="text-sm font-normal text-slate-400">min</span></p>
                    </div>
                )}
                 {byCategory.find(c => c.name === 'Organizacional') && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-50 rounded text-amber-600"><Users size={16} /></div>
                            <span className="text-sm font-medium text-slate-500">Organizacional</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{byCategory.find(c => c.name === 'Organizacional')?.value || 0} <span className="text-sm font-normal text-slate-400">min</span></p>
                    </div>
                 )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pareto Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Ranking de Motivos (Pareto)</h3>
                    {downtimes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={downtimes.slice(0, 15)} layout="vertical" margin={{top:5, right:30, left:40, bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" unit="m" />
                                <YAxis type="category" dataKey="reason" width={150} style={{fontSize: '11px'}} />
                                <Tooltip contentStyle={{borderRadius: '8px'}} />
                                <Bar dataKey="durationMinutes" fill="#6366f1" radius={[0, 4, 4, 0]}>
                                    {downtimes.slice(0, 15).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 2 ? '#ef4444' : '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">No hay datos para mostrar</div>
                    )}
                </div>

                {/* Category Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Distribución por Categoría</h3>
                    {byCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={byCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {byCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
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