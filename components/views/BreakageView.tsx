
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, BarChart, Bar } from 'recharts';
import { Ban, AlertOctagon, Loader2, Factory, TrendingDown, Layers, Activity, GanttChartSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '../DateFilter';
import { fetchBreakageStats } from '../../services/sheetService';
import { analyzeBreakageData } from '../../services/geminiService';
import { BreakageStats, AIAnalysisResult } from '../../types';
import { AIAnalyst } from '../AIAnalyst';

export const BreakageView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['breakage', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchBreakageStats(dateRange.start, dateRange.end),
  });

  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
      setAiAnalysis(null); // Reset AI on filter change
  };

  const handleAIAnalysis = async () => {
      if (!data) return;
      setAiLoading(true);
      try {
          const result = await analyzeBreakageData(data);
          setAiAnalysis(result);
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6'];
  const SECTOR_COLORS = {
      'Ensacadora': '#ef4444',
      'NoEmboquillada': '#f97316',
      'Ventocheck': '#f59e0b',
      'Transporte': '#3b82f6'
  };
  const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    if (percent < 0.05) return null; // Don't show label for small slices
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Análisis Roturas de Sacos</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">Análisis de mermas por sector, material y proveedor.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} defaultFilter="month" />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p className="font-medium">Procesando datos de calidad...</p>
          </div>
      ) : !data ? (
           <div className="h-64 flex items-center justify-center text-slate-400 border border-dashed border-white/10 rounded-xl bg-white/5">
               Seleccione un rango de fecha para ver el análisis.
           </div>
      ) : (
          <>
            {/* AI Analyst Section */}
            <div className="mb-6">
                <AIAnalyst 
                    analysis={aiAnalysis} 
                    loading={aiLoading} 
                    onAnalyze={handleAIAnalysis} 
                />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl group hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 group-hover:scale-110 transition-transform">
                            <Factory className="text-blue-500" size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Producido</span>
                    </div>
                    <h3 className="text-4xl font-black text-white tracking-tighter">
                        {data.totalProduced.toLocaleString()}
                        <span className="text-sm font-bold text-slate-500 ml-1 uppercase">Bolsas</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Bolsas Totales</p>
                </div>

                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl group hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 group-hover:scale-110 transition-transform">
                            <Ban className="text-red-500" size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Roturas</span>
                    </div>
                    <h3 className="text-4xl font-black text-white tracking-tighter">
                        {data.totalBroken.toLocaleString()}
                        <span className="text-sm font-bold text-slate-500 ml-1 uppercase">Sacos</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Sacos Descartados</p>
                </div>

                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl group hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30 group-hover:scale-110 transition-transform">
                            <TrendingDown className="text-amber-500" size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">% Merma Global</span>
                    </div>
                    <h3 className="text-4xl font-black text-white tracking-tighter">
                        {data.globalRate.toFixed(2)}%
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Tasa de falla</p>
                </div>
            </div>

            {/* Evolution Chart (History) */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col h-[450px]">
                <div className="flex items-center gap-2 mb-1">
                     <Activity size={20} className="text-indigo-400" />
                     <h3 className="font-black text-white uppercase tracking-widest text-sm">Evolución de Falla por Proveedor</h3>
                </div>
                <p className="text-xs text-slate-400 mb-6 font-medium">Tendencia diaria del porcentaje de rotura.</p>

                {data.history && data.history.length > 0 ? (
                     <div className="flex-grow w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#0f172a', 
                                        borderRadius: '12px', 
                                        border: '1px solid rgba(255,255,255,0.1)', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number) => [`${value}%`, '']}
                                />
                                <Legend wrapperStyle={{paddingTop: '10px', color: '#94a3b8'}} />
                                {data.byProvider.map((prov, idx) => (
                                    <Line 
                                        key={prov.id} // SAFE KEY (id_Provider)
                                        type="monotone" 
                                        dataKey={prov.id} // Matches SAFE KEY in history object
                                        name={prov.name} // Shows REAL NAME
                                        stroke={LINE_COLORS[idx % LINE_COLORS.length]} 
                                        strokeWidth={2}
                                        dot={{r: 4}}
                                        activeDot={{r: 6}}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                     </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                        Seleccione un rango mayor a 1 día para ver evolución
                    </div>
                )}
            </div>

             {/* Stacked Bar Chart: Materials by Sector */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col h-[500px]">
                <div className="flex items-center gap-2 mb-1">
                     <GanttChartSquare size={20} className="text-emerald-400" />
                     <h3 className="font-black text-white uppercase tracking-widest text-sm">Roturas de Material por Sector</h3>
                </div>
                <p className="text-xs text-slate-400 mb-6 font-medium">Cantidad de bolsas rotas de cada material, clasificadas por lugar de falla.</p>

                {data.byMaterial.length > 0 ? (
                     <div className="flex-grow w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.byMaterial} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#64748b" 
                                    fontSize={11} 
                                    tickFormatter={(val) => val.length > 15 ? val.substring(0,15)+'...' : val}
                                />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#0f172a', 
                                        borderRadius: '12px', 
                                        border: '1px solid rgba(255,255,255,0.1)', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                                        color: '#fff'
                                    }}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Legend wrapperStyle={{paddingTop: '10px', color: '#94a3b8'}} />
                                {/* FLATTENED KEYS */}
                                <Bar dataKey="sector_Ensacadora" name="Ensacadora" stackId="a" fill={SECTOR_COLORS['Ensacadora']} />
                                <Bar dataKey="sector_NoEmboquillada" name="No Emboquillada" stackId="a" fill={SECTOR_COLORS['NoEmboquillada']} />
                                <Bar dataKey="sector_Ventocheck" name="Ventocheck" stackId="a" fill={SECTOR_COLORS['Ventocheck']} />
                                <Bar dataKey="sector_Transporte" name="Transporte" stackId="a" fill={SECTOR_COLORS['Transporte']} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                        Sin datos de materiales en este período
                    </div>
                )}
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Sector Breakdown Pie Chart */}
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col h-[450px]">
                    <h3 className="font-black text-white uppercase tracking-widest text-sm mb-1">Distribución Total por Sector</h3>
                    <p className="text-xs text-slate-400 mb-4 font-medium">¿En qué parte del proceso ocurren las roturas?</p>
                    
                    {data.bySector.length > 0 ? (
                        <div className="flex-grow flex flex-col items-center justify-center">
                            <div className="w-full h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.bySector}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={renderCustomizedLabel}
                                            labelLine={false}
                                        >
                                            {data.bySector.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#0f172a', 
                                                borderRadius: '12px', 
                                                border: '1px solid rgba(255,255,255,0.1)', 
                                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                                                color: '#fff'
                                            }}
                                            formatter={(value: number) => value.toLocaleString()} 
                                        />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            layout="horizontal"
                                            formatter={(value, entry: any) => {
                                                const item = data.bySector.find(s => s.name === value);
                                                return <span className="text-slate-400 text-xs">{value} ({item?.percentage.toFixed(1)}%)</span>;
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">Sin datos de roturas</div>
                    )}
                </div>

                {/* Provider Ranking Table */}
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col h-[450px]">
                    <h3 className="font-black text-white uppercase tracking-widest text-sm mb-1">Ranking por Proveedor</h3>
                    <p className="text-xs text-slate-400 mb-4 font-medium">Ranking de tasa de falla por fabricante.</p>
                    
                    <div className="flex-grow overflow-auto no-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-slate-400 font-black uppercase tracking-widest text-[10px] sticky top-0">
                                <tr>
                                    <th className="px-3 py-3">Proveedor</th>
                                    <th className="px-3 py-3 text-right">Prod.</th>
                                    <th className="px-3 py-3 text-right">Rotas</th>
                                    <th className="px-3 py-3 text-right">% Falla</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.byProvider.map((prov) => (
                                    <tr key={prov.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-3 py-3 font-bold text-slate-200">{prov.name}</td>
                                        <td className="px-3 py-3 text-right text-slate-400">{prov.produced.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-right font-bold text-white">{prov.broken}</td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                                                prov.rate > 0.5 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                                prov.rate > 0.2 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            }`}>
                                                {prov.rate.toFixed(2)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.byProvider.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-500">Sin datos</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Material Breakdown Table (Full Width) */}
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col min-h-[400px] lg:col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Layers size={20} className="text-indigo-400" />
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">Detalle por Material / SKU</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 font-medium">Identificación de productos con mayor incidencia de rotura.</p>
                    
                    <div className="flex-grow overflow-auto no-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-slate-400 font-black uppercase tracking-widest text-[10px] sticky top-0">
                                <tr>
                                    <th className="px-4 py-4">Material</th>
                                    <th className="px-4 py-4 text-right">Producción</th>
                                    <th className="px-4 py-4 text-right">Roturas</th>
                                    <th className="px-4 py-4 text-right">Tasa de Falla</th>
                                    <th className="px-4 py-4 w-1/3">Impacto Visual</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.byMaterial.map((mat) => (
                                    <tr key={mat.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-4 font-bold text-slate-200 max-w-xs truncate" title={mat.name}>{mat.name}</td>
                                        <td className="px-4 py-4 text-right text-slate-400">{mat.produced.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-bold text-white">{mat.broken}</td>
                                        <td className="px-4 py-4 text-right">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                                                mat.rate > 0.5 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                                mat.rate > 0.2 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-slate-300 border border-white/10'
                                            }`}>
                                                {mat.rate.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                             <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${mat.rate > 0.5 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : mat.rate > 0.2 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]'}`} 
                                                    style={{width: `${Math.min(mat.rate * 20, 100)}%`}} // Scale visual impact
                                                ></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {data.byMaterial.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-500">Sin datos de materiales</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </>
      )}
    </div>
  );
};
