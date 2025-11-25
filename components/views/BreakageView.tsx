import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Ban, AlertOctagon, Loader2, Factory, TrendingDown } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchBreakageStats } from '../../services/sheetService';
import { BreakageStats } from '../../types';

export const BreakageView: React.FC = () => {
  const [data, setData] = useState<BreakageStats | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFilterChange = async (range: { start: Date, end: Date }) => {
      setLoading(true);
      try {
          const result = await fetchBreakageStats(range.start, range.end);
          setData(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Roturas de Sacos</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de mermas por sector y proveedor.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Procesando datos de roturas...</p>
          </div>
      ) : !data ? (
           <div className="h-64 flex items-center justify-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
               Seleccione un rango de fecha para ver el análisis.
           </div>
      ) : (
          <>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Sector Breakdown Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-4">Distribución por Sector</h3>
                    {data.bySector.length > 0 ? (
                        <div className="flex-grow">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.bySector}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {data.bySector.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                                    <Legend verticalAlign="bottom" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">Sin datos de roturas</div>
                    )}
                </div>

                {/* Provider Ranking Table */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-4">Análisis por Proveedor</h3>
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
            </div>
          </>
      )}
    </div>
  );
};
