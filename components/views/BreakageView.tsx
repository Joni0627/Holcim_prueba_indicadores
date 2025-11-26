import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { Ban, AlertOctagon, Loader2, Factory, TrendingDown, Layers, Activity } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchBreakageStats } from '../../services/sheetService';
import { analyzeBreakageData } from '../../services/geminiService';
import { BreakageStats, AIAnalysisResult } from '../../types';
import { AIAnalyst } from '../AIAnalyst';

export const BreakageView: React.FC = () => {
  const [data, setData] = useState<BreakageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleFilterChange = async (range: { start: Date, end: Date }) => {
      setLoading(true);
      setAiAnalysis(null); // Reset AI on filter change
      try {
          const result = await fetchBreakageStats(range.start, range.end);
          setData(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
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
  const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Roturas de Sacos</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de mermas por sector, material y proveedor.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Procesando datos de calidad...</p>
          </div>
      ) : !data ? (
           <div className="h-64 flex items-center justify-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
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
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Factory size={20} /></div>
                        <span className="text-sm font-medium text-slate-500">Total Producido</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{data.totalProduced.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">Bolsas Totales</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Ban size={20} /></div>
                        <span className="text-sm font-medium text-slate-500">Total Roturas</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{data.totalBroken.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">Sacos Descartados</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><TrendingDown size={20} /></div>
                        <span className="text-sm font-medium text-slate-500">% Merma Global</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{data.globalRate.toFixed(2)}%</p>
                    <p className="text-xs text-slate-400 mt-1">Tasa de falla</p>
                </div>
            </div>

            {/* Evolution Chart (History) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                     <Activity size={20} className="text-indigo-500" />
                     <h3 className="font-bold text-slate-800">Evolución de Falla por Proveedor</h3>
                </div>
                <p className="text-xs text-slate-500 mb-6">Tendencia diaria del porcentaje de rotura.</p>

                {data.history && data.history.length > 0 ? (
                     <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`${value}%`, '']}
                                />
                                <Legend wrapperStyle={{paddingTop: '10px'}} />
                                {data.byProvider.map((prov, idx) => (
                                    <Line 
                                        key={prov.name}
                                        type="monotone" 
                                        dataKey={prov.name} 
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
                    <div className="flex-grow flex items-center justify-center text-slate-400">
                        Seleccione un rango mayor a 1 día para ver evolución
                    </div>
                )}
            </div>

            {/* Main Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Sector Breakdown Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-1">Distribución por Sector</h3>
                    <p className="text-xs text-slate-500 mb-4">¿En qué parte del proceso ocurren las roturas?</p>
                    
                    {data.bySector.length > 0 ? (
                        <div className="flex-grow flex flex-col items-center justify-center">
                            <div className="w-full h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.bySector}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {data.bySector.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            layout="horizontal"
                                            formatter={(value, entry: any) => {
                                                const item = data.bySector.find(s => s.name === value);
                                                return `${value} (${item?.percentage.toFixed(1)}%)`;
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">Sin datos de roturas</div>
                    )}
                </div>

                {/* Provider Ranking Table */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-1">Ranking por Proveedor</h3>
                    <p className="text-xs text-slate-500 mb-4">Ranking de tasa de falla por fabricante.</p>
                    
                    <div className="flex-grow overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                                <tr>
                                    <th className="px-3 py-2">Proveedor</th>
                                    <th className="px-3 py-2 text-right">Prod.</th>
                                    <th className="px-3 py-2 text-right">Rotas</th>
                                    <th className="px-3 py-2 text-right">% Falla</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.byProvider.map((prov) => (
                                    <tr key={prov.name} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 font-medium text-slate-700">{prov.name}</td>
                                        <td className="px-3 py-2 text-right text-slate-500">{prov.produced.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-800">{prov.broken}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                prov.rate > 0.5 ? 'bg-red-100 text-red-700' : 
                                                prov.rate > 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {prov.rate.toFixed(2)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.byProvider.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-400">Sin datos</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Material Breakdown Table (Full Width) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col lg:col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Layers size={20} className="text-indigo-600" />
                        <h3 className="font-bold text-slate-800">Detalle por Material / SKU</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Identificación de productos con mayor incidencia de rotura.</p>
                    
                    <div className="flex-grow overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Material</th>
                                    <th className="px-4 py-3 text-right">Producción</th>
                                    <th className="px-4 py-3 text-right">Roturas</th>
                                    <th className="px-4 py-3 text-right">Tasa de Falla</th>
                                    <th className="px-4 py-3 w-1/3">Impacto Visual</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.byMaterial.map((mat) => (
                                    <tr key={mat.name} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-700 max-w-xs truncate" title={mat.name}>{mat.name}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{mat.produced.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-800">{mat.broken}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                mat.rate > 0.5 ? 'bg-red-100 text-red-700' : 
                                                mat.rate > 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {mat.rate.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                             <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${mat.rate > 0.5 ? 'bg-red-500' : mat.rate > 0.2 ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                                                    style={{width: `${Math.min(mat.rate * 20, 100)}%`}} // Scale visual impact
                                                ></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {data.byMaterial.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-400">Sin datos de materiales</td>
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