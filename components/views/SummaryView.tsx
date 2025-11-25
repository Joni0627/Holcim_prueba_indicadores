import React, { useState, useEffect } from 'react';
import { PackageCheck, Timer, AlertTriangle, TrendingUp, TableProperties, CircleDashed } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { getDowntimeRanking, getProductionByShift, getProductionByPalletizer, getMachineShiftDetails, machines } from '../../services/mockData';
import { DowntimeEvent, ShiftMetric } from '../../types';
import { DateFilter } from '../DateFilter';

export const SummaryView: React.FC = () => {
  const [downtimes, setDowntimes] = useState<DowntimeEvent[]>([]);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [machineData, setMachineData] = useState<any[]>([]);
  const [detailedMetrics, setDetailedMetrics] = useState<ShiftMetric[]>([]);
  
  useEffect(() => {
    // Get Top 10 downtimes
    const allDowntimes = getDowntimeRanking('all');
    setDowntimes(allDowntimes.slice(0, 10));
    
    setShiftData(getProductionByShift());
    setMachineData(getProductionByPalletizer());
    setDetailedMetrics(getMachineShiftDetails());
  }, []);

  // Calculate Total Bags Today
  const totalBags = machineData.reduce((acc, curr) => acc + curr.value, 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'];

  // Helper to colorize OEE values
  const getOEEColor = (val: number) => {
    if (val >= 0.85) return 'text-emerald-600 bg-emerald-50';
    if (val >= 0.65) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard General</h1>
            <p className="text-slate-500 mt-1">Resumen ejecutivo y métricas clave en tiempo real.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <DateFilter />
        </div>
      </div>

      {/* Main KPI: Total Bags */}
      <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-xl">
                <PackageCheck size={40} />
            </div>
            <div>
                <p className="text-indigo-100 font-medium uppercase tracking-wider text-sm">Producción Total (Día)</p>
                <h2 className="text-5xl font-bold mt-1">{totalBags.toLocaleString()} <span className="text-2xl font-normal opacity-70">bolsas</span></h2>
            </div>
          </div>
          <div className="hidden md:block text-right">
              <div className="text-indigo-200 text-sm">Objetivo Diario</div>
              <div className="text-2xl font-semibold">41,000</div>
              <div className="w-32 bg-indigo-900/50 h-2 rounded-full mt-1">
                 <div className="bg-emerald-400 h-2 rounded-full" style={{width: `${(totalBags/41000)*100}%`}}></div>
              </div>
          </div>
      </div>

      {/* Production Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Production by Shift */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Timer className="text-indigo-500" size={20} />
                      Producción por Turno
                  </h3>
              </div>
              <div className="flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shiftData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={13} fontWeight={500} />
                          <YAxis stroke="#64748b" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{fill: '#f1f5f9'}}
                          />
                          <Bar dataKey="value" name="Unidades" fill="#6366f1" radius={[6, 6, 0, 0]}>
                             {shiftData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={index === 3 ? '#94a3b8' : '#6366f1'} />
                             ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Production by Palletizer */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="text-emerald-500" size={20} />
                      Producción por Paletizadora
                  </h3>
              </div>
              <div className="flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={machineData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                          >
                              {machineData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                  </ResponsiveContainer>
                  {/* Custom Legend Values */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                      {machineData.map((m, i) => (
                          <div key={m.name} className="text-center">
                              <p className="text-xs text-slate-500">{m.name}</p>
                              <p className="font-bold text-slate-800" style={{color: COLORS[i]}}>{m.value.toLocaleString()}</p>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      {/* Top 10 Downtime Ranking */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
             <div className="p-2 bg-red-50 rounded-lg text-red-600">
                <AlertTriangle size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800">Top 10 Paros del Día</h3>
                <p className="text-sm text-slate-500">Ranking por duración acumulada en minutos.</p>
             </div>
          </div>

          <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={downtimes}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} unit=" min" />
                    <YAxis
                        type="category"
                        dataKey="reason"
                        stroke="#475569"
                        fontSize={12}
                        width={180}
                        tick={{ fill: '#334155', fontWeight: 500 }}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{fill: '#f8fafc'}}
                    />
                    <Bar dataKey="durationMinutes" name="Duración (min)" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20}>
                        {downtimes.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#f87171'} />
                        ))}
                    </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TableProperties className="text-slate-600" size={24} />
            <h3 className="text-xl font-bold text-slate-800">Detalle de Eficiencia por Turno</h3>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {machines.map((machine) => {
              const metrics = detailedMetrics.filter(m => m.machineId === machine.id);
              return (
                <div key={machine.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800">{machine.name}</h4>
                      <span className="text-xs font-mono text-slate-500 uppercase">{machine.location}</span>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                         <tr>
                           <th className="px-4 py-3 font-semibold">Turno</th>
                           <th className="px-4 py-3 font-semibold text-center">Disp %</th>
                           <th className="px-4 py-3 font-semibold text-center">Rend %</th>
                           <th className="px-4 py-3 font-semibold text-center">OEE</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {metrics.map((row) => (
                           <tr key={row.shift} className="hover:bg-slate-50">
                             <td className="px-4 py-3 font-medium text-slate-700">{row.shift}</td>
                             <td className="px-4 py-3 text-center text-slate-600">{(row.availability * 100).toFixed(1)}%</td>
                             <td className="px-4 py-3 text-center text-slate-600">{(row.performance * 100).toFixed(1)}%</td>
                             <td className="px-4 py-3 text-center">
                               <span className={`px-2 py-1 rounded text-xs font-bold ${getOEEColor(row.oee)}`}>
                                 {(row.oee * 100).toFixed(1)}%
                               </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </div>
              )
            })}
          </div>
      </div>

    </div>
  );
};