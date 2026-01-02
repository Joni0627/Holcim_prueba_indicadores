
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, ClipboardCheck, Loader2, Table, AlertTriangle } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { analyzeDowntimeData } from '../../services/geminiService';
import { DowntimeEvent, AIAnalysisResult } from '../../types';
import { AIAnalyst } from '../AIAnalyst';

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Estadísticas de disponibilidad y ranking de causas.</p>
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
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={18} />
                        Ranking Top 10 Motivos (Pareto)
                    </h3>
                    {filteredDowntimes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredDowntimes.slice(0, 10).sort((a,b) => b.durationMinutes - a.durationMinutes)} layout="vertical" margin={{top:5, right:30, left:20, bottom:5}}>
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
                            {filteredDowntimes.sort((a,b) => (a.startTime || '').localeCompare(b.startTime || '')).map((event, idx) => (
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
