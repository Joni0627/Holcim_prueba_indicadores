import React from 'react';
import { Cell, PieChart, Pie, ResponsiveContainer, Tooltip } from 'recharts';
import { machines, getOEE } from '../../services/mockData';
import { DateFilter } from '../DateFilter';
import { Zap, Activity, Gauge } from 'lucide-react';

export const PalletizerView: React.FC = () => {
  // Filter only palletizers
  const palletizers = machines.filter(m => m.type === 'palletizer');
  
  const data = palletizers.map(m => {
      const oeeData = getOEE(m.id);
      
      const avail = +(oeeData.availability * 100).toFixed(1);
      const perf = +(oeeData.performance * 100).toFixed(1);
      
      // Since Quality is not measured, OEE = Availability * Performance
      const calculatedOEE = (avail * perf) / 100;

      return {
          name: m.name,
          availability: avail,
          performance: perf,
          oee: +calculatedOEE.toFixed(1)
      };
  });

  // Calculate Global Averages
  const count = data.length;
  const avgAvail = data.reduce((acc, curr) => acc + curr.availability, 0) / count;
  const avgPerf = data.reduce((acc, curr) => acc + curr.performance, 0) / count;
  
  // Recalculate OEE based on averaged metrics
  // Formula: (AvgAvail * AvgPerf) / 100
  const globalOEEPercent = +((avgAvail * avgPerf) / 100).toFixed(1);

  // Gauge Data
  const gaugeData = [
    { name: 'OEE', value: globalOEEPercent, fill: '#6366f1' },
    { name: 'Loss', value: 100 - globalOEEPercent, fill: '#e2e8f0' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Rendimiento Paletizadoras</h2>
            <p className="text-slate-500 text-sm mt-1">Comparativa directa entre unidades de paletizado.</p>
          </div>
          <DateFilter />
        </div>

        {/* Global Indicators Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Gauge className="text-indigo-600" size={20} />
                    Promedio Global Planta (3 Equipos)
                </h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                
                {/* OEE Gauge */}
                <div className="relative h-[250px] flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={gaugeData}
                                cx="50%"
                                cy="70%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={80}
                                outerRadius={110}
                                paddingAngle={0}
                                dataKey="value"
                                stroke="none"
                            >
                                <Cell fill="#6366f1" />
                                <Cell fill="#f1f5f9" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">OEE Global</p>
                        <p className="text-5xl font-black text-slate-800">{globalOEEPercent}%</p>
                    </div>
                </div>

                {/* Detailed Metrics Breakdown */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Availability */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-green-100 text-green-700 rounded-md">
                                    <Zap size={16} />
                                </div>
                                <span className="font-semibold text-slate-700">Disponibilidad Promedio</span>
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{avgAvail.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{width: `${avgAvail}%`}}></div>
                        </div>
                    </div>

                    {/* Performance */}
                    <div>
                         <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-md">
                                    <Activity size={16} />
                                </div>
                                <span className="font-semibold text-slate-700">Rendimiento Promedio</span>
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{avgPerf.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full transition-all duration-1000" style={{width: `${avgPerf}%`}}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((p) => (
                <div key={p.name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-lg text-slate-800">{p.name}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.oee > 80 ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'}`}>
                            {p.oee}% OEE
                        </span>
                    </div>
                    
                    <div className="space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span className="text-sm text-slate-500 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Disponibilidad
                            </span>
                            <span className="font-semibold text-slate-700">{p.availability}%</span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                            <span className="text-sm text-slate-500 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span> Rendimiento
                            </span>
                            <span className="font-semibold text-slate-700">{p.performance}%</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};