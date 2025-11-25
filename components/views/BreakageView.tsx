import React from 'react';
import { getBreakageData } from '../../services/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Ban, AlertOctagon } from 'lucide-react';
import { DateFilter } from '../DateFilter';

export const BreakageView: React.FC = () => {
  const rawData = getBreakageData();
  
  // Aggregate by type for Pie Chart
  const byType = rawData.reduce((acc, curr) => {
      const existing = acc.find(i => i.name === curr.type);
      if (existing) {
          existing.value += curr.count;
      } else {
          acc.push({ name: curr.type, value: curr.count });
      }
      return acc;
  }, [] as {name: string, value: number}[]);

  const COLORS = ['#f87171', '#fb923c', '#60a5fa', '#a78bfa'];

  // Format for trend chart (chronological)
  const trendData = [...rawData]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        count: d.count,
        type: d.type
    }));

  const totalBreakage = rawData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Roturas de Sacos</h2>
          <p className="text-slate-500 text-sm mt-1">Monitoreo de mermas por defectos de empaque.</p>
        </div>
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
           <DateFilter />
           <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-lg text-red-700">
                <Ban size={20} />
                <span className="font-bold text-lg">{totalBreakage}</span>
                <span className="text-sm font-normal opacity-80">Sacos Rotos (Turno)</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Trend Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
              <h3 className="font-semibold text-slate-800 mb-4">Tendencia Temporal de Roturas</h3>
              <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorBreak" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#ef4444" fillOpacity={1} fill="url(#colorBreak)" name="Roturas" />
                  </AreaChart>
              </ResponsiveContainer>
          </div>

          {/* Type Breakdown */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
              <h3 className="font-semibold text-slate-800 mb-4">Causas Raíz</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={byType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {byType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="mt-4 space-y-2">
                  {byType.sort((a, b) => b.value - a.value).map((item, i) => (
                       <div key={i} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                           <span className="flex items-center gap-2 text-slate-600 capitalize">
                               <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                               {item.name.replace('_', ' ')}
                           </span>
                           <span className="font-bold text-slate-800">{item.value}</span>
                       </div>
                  ))}
              </div>
          </div>
      </div>

       <div className="bg-indigo-900 text-white p-6 rounded-xl flex items-start gap-4">
            <AlertOctagon className="shrink-0 text-yellow-400" size={24} />
            <div>
                <h4 className="font-bold text-lg">Insight de Calidad</h4>
                <p className="text-indigo-100 mt-1">
                    El 60% de las roturas actuales provienen de <strong>Fallas de Sellado</strong> en la Ensacadora M03. 
                    Se recomienda verificar la temperatura de las mordazas de sellado inmediatamente.
                </p>
            </div>
       </div>
    </div>
  );
};