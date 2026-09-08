
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, ClipboardCheck, Loader2, Table, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
        <div className="bg-slate-900 p-3 border border-white/10 shadow-2xl rounded-xl z-50">
          <p className="font-semibold text-white text-sm mb-1">{data.reason}</p>
          <div className="text-[10px] text-slate-400 mb-2 flex items-center gap-2">
             <span className="font-black bg-white/5 px-1.5 py-0.5 rounded uppercase border border-white/5">{data.hac || 'N/A'}</span>
             <span className="font-black bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/10">{data.startTime || '00:00'}</span>
          </div>
          <p className="text-slate-300 text-sm">
            Duración: <span className="font-black text-white">{formatMinutes(data.durationMinutes)}</span>
          </p>
        </div>
      );
    }
    return null;
};

export const DowntimeView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [selectedType, setSelectedType] = useState<'all' | 'interno' | 'externo'>('all');
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: downtimes = [], isLoading: loading } = useQuery({
    queryKey: ['downtimes', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchDowntimes(dateRange.start, dateRange.end),
  });
  
  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
      setAiAnalysis(null);
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

  const filteredDowntimes = useMemo(() => {
    return downtimes.filter(d => {
        if (selectedType === 'all') return true;
        if (!d.downtimeType) return false;
        return d.downtimeType.toLowerCase().includes(selectedType);
    });
  }, [downtimes, selectedType]);

  const totalDowntime = useMemo(() => 
    filteredDowntimes.reduce((acc, curr) => acc + curr.durationMinutes, 0),
  [filteredDowntimes]);

  const pieData = useMemo(() => {
    const counts = filteredDowntimes.reduce((acc, curr) => {
        const cat = curr.sapCause || 'Otros';
        acc[cat] = (acc[cat] || 0) + curr.durationMinutes;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredDowntimes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 overflow-x-hidden min-h-screen bg-[#0a0f1e] text-slate-200">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-900/20">
                <AlertTriangle size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Análisis de Paros</h2>
                <p className="text-slate-400 text-sm">Estadísticas de disponibilidad y ranking de causas.</p>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center bg-white/[0.03] p-1 rounded-xl border border-white/10 shadow-sm backdrop-blur-sm">
                <button onClick={() => setSelectedType('all')} className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${selectedType === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Todos</button>
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <button onClick={() => setSelectedType('interno')} className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${selectedType === 'interno' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Interno</button>
                <button onClick={() => setSelectedType('externo')} className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${selectedType === 'externo' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Externo</button>
            </div>
            <DateFilter onFilterChange={handleFilterChange} />
        </div>
      </div>

      {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="animate-spin mb-2 text-blue-500" size={32} />
              <p className="text-xs font-black uppercase tracking-widest">Cargando datos...</p>
          </div>
      ) : (
          <>
            <div className="mb-6">
                <AIAnalyst analysis={aiAnalysis} loading={aiLoading} onAnalyze={handleAIAnalysis} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/10 shadow-sm backdrop-blur-sm flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform"><Clock size={16} /></div>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Tiempo Total de Parada</span>
                        </div>
                        <p className="text-4xl font-black text-white mt-2 tracking-tighter">{formatMinutes(totalDowntime)} <span className="text-sm font-bold text-slate-500 ml-1">hh:mm</span></p>
                    </div>
                </div>
                 <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/10 shadow-sm backdrop-blur-sm flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform"><ClipboardCheck size={16} /></div>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Eventos Registrados</span>
                        </div>
                        <p className="text-4xl font-black text-white mt-2 tracking-tighter">{filteredDowntimes.length}</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/[0.03] p-6 rounded-2xl shadow-sm border border-white/10 h-[500px] flex flex-col backdrop-blur-sm">
                    <h3 className="font-black text-white mb-6 flex items-center gap-2 uppercase text-xs tracking-[0.2em]">
                        <AlertTriangle className="text-red-500" size={18} />
                        Ranking Top 10 Motivos (Pareto)
                    </h3>
                    {filteredDowntimes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
                            <BarChart data={[...filteredDowntimes].sort((a,b) => b.durationMinutes - a.durationMinutes).slice(0, 10)} layout="vertical" margin={{top:5, right:30, left:20, bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" stroke="#475569" fontSize={10} tickFormatter={formatMinutes} />
                                <YAxis 
                                    type="category" 
                                    dataKey="reason" 
                                    width={120} 
                                    style={{fontSize: '9px', fontWeight: 900, fill: '#94a3b8'}} 
                                    tickFormatter={(val) => val.length > 20 ? `${val.substring(0,20)}...` : val}
                                />
                                <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} content={<CustomBarTooltip />} />
                                <Bar dataKey="durationMinutes" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24}>
                                    {filteredDowntimes.slice(0, 10).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#3b82f6'} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest">No hay datos</div>
                    )}
                </div>

                <div className="bg-white/[0.03] p-6 rounded-2xl shadow-sm border border-white/10 h-[500px] flex flex-col backdrop-blur-sm">
                    <h3 className="font-black text-white mb-6 uppercase text-xs tracking-[0.2em]">Distribución por Causa SAP</h3>
                    {pieData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%" debounce={50}>
                             <PieChart>
                                 <Pie
                                     data={pieData}
                                     cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={4} dataKey="value"
                                     stroke="none"
                                 >
                                     {pieData.map((_, index) => (
                                         <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} fillOpacity={0.8} />
                                     ))}
                                 </Pie>
                                 <Tooltip 
                                    contentStyle={{backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff'}}
                                    itemStyle={{color: '#fff'}}
                                    formatter={(value: number) => formatMinutes(value)} 
                                 />
                                 <Legend wrapperStyle={{fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'}} />
                             </PieChart>
                         </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest">Sin datos</div>
                    )}
                </div>
            </div>

            <div className="bg-white/[0.03] rounded-2xl shadow-sm border border-white/10 overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                    <h3 className="font-black text-white flex items-center gap-2 uppercase text-xs tracking-[0.2em]">
                        <Table size={20} className="text-blue-400"/>
                        Registro Detallado de Eventos
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.02] text-slate-500 sticky top-0 z-10 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Hora</th>
                                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Turno</th>
                                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Máquina (HAC)</th>
                                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Motivo</th>
                                <th className="px-6 py-4 text-right font-black uppercase text-[10px] tracking-widest">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {[...filteredDowntimes].sort((a,b) => (a.startTime || '').localeCompare(b.startTime || '')).map((event, idx) => (
                                <tr key={event.id || idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-blue-400">{event.startTime}</td>
                                    <td className="px-6 py-4 text-slate-400 font-bold text-xs uppercase">{event.shift}</td>
                                    <td className="px-6 py-4 font-black text-white text-[11px] uppercase">{event.hac}</td>
                                    <td className="px-6 py-4 text-slate-400 italic max-w-xs truncate text-xs">&quot;{event.reason}&quot;</td>
                                    <td className="px-6 py-4 text-right font-mono font-black text-red-400">{formatMinutes(event.durationMinutes)}</td>
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
