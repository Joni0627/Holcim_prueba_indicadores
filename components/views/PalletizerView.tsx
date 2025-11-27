
import React, { useState } from 'react';
import { Cell, PieChart, Pie, ResponsiveContainer, Tooltip } from 'recharts';
import { DateFilter } from '../DateFilter';
import { Zap, Activity, Gauge, Loader2, AlertCircle } from 'lucide-react';
import { fetchProductionStats } from '../../services/sheetService';
import { ShiftMetric } from '../../types';

export const PalletizerView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [machineMetrics, setMachineMetrics] = useState<any[]>([]);
  const [globalMetrics, setGlobalMetrics] = useState({ availability: 0, performance: 0, oee: 0 });
  const [hasData, setHasData] = useState(false);

  const handleFilterChange = async (range: { start: Date, end: Date }) => {
      setLoading(true);
      try {
          const result = await fetchProductionStats(range.start, range.end);
          
          if (result && result.details && result.details.length > 0) {
              processMetrics(result.details);
              setHasData(true);
          } else {
              setMachineMetrics([]);
              setGlobalMetrics({ availability: 0, performance: 0, oee: 0 });
              setHasData(false);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const processMetrics = (details: ShiftMetric[]) => {
      // 1. Agrupar por Máquina (ignorando turnos para sacar el promedio del periodo)
      const grouped = details.reduce((acc, curr) => {
          if (!acc[curr.machineName]) {
              acc[curr.machineName] = {
                  name: curr.machineName,
                  availSum: 0,
                  perfSum: 0,
                  oeeSum: 0,
                  count: 0
              };
          }
          acc[curr.machineName].availSum += curr.availability;
          acc[curr.machineName].perfSum += curr.performance;
          acc[curr.machineName].oeeSum += curr.oee;
          acc[curr.machineName].count += 1;
          return acc;
      }, {} as Record<string, any>);

      // 2. Calcular Promedios por Máquina
      const metrics = Object.values(grouped).map((m: any) => ({
          name: m.name,
          availability: +(m.availSum / m.count * 100).toFixed(1),
          performance: +(m.perfSum / m.count * 100).toFixed(1),
          oee: +(m.oeeSum / m.count * 100).toFixed(1)
      })).sort((a, b) => b.oee - a.oee); // Ranking por OEE

      setMachineMetrics(metrics);

      // 3. Calcular Promedio Global de Planta
      if (metrics.length > 0) {
          const totalAvail = metrics.reduce((acc, curr) => acc + curr.availability, 0) / metrics.length;
          const totalPerf = metrics.reduce((acc, curr) => acc + curr.performance, 0) / metrics.length;
          // OEE Global recalculado como Disp * Rend (o promedio de OEEs, matemáticamente Disp*Rend es más puro)
          const totalOEE = (totalAvail * totalPerf) / 100;

          setGlobalMetrics({
              availability: +totalAvail.toFixed(1),
              performance: +totalPerf.toFixed(1),
              oee: +totalOEE.toFixed(1)
          });
      }
  };

  const gaugeData = [
    { name: 'OEE', value: globalMetrics.oee, fill: '#6366f1' },
    { name: 'Loss', value: 100 - globalMetrics.oee, fill: '#f1f5f9' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Rendimiento Paletizadoras</h2>
            <p className="text-slate-500 text-sm mt-1">Comparativa directa entre unidades de paletizado basada en producción real.</p>
          </div>
          <DateFilter onFilterChange={handleFilterChange} />
        </div>

        {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Calculando OEE en tiempo real...</p>
          </div>
        ) : !hasData ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
              <AlertCircle className="mb-2 opacity-50" size={32} />
              <p>No hay registros de producción para el período seleccionado.</p>
           </div>
        ) : (
            <>
                {/* Global Indicators Panel */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Gauge className="text-indigo-600" size={20} />
                            Promedio Global Planta ({machineMetrics.length} Equipos)
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
                                        <Cell fill={globalMetrics.oee >= 85 ? '#10b981' : globalMetrics.oee >= 65 ? '#f59e0b' : '#ef4444'} />
                                        <Cell fill="#f1f5f9" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">OEE Global</p>
                                <p className={`text-5xl font-black ${globalMetrics.oee >= 85 ? 'text-emerald-600' : globalMetrics.oee >= 65 ? 'text-amber-500' : 'text-red-500'}`}>
                                    {globalMetrics.oee}%
                                </p>
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
                                    <span className="font-bold text-slate-900 text-lg">{globalMetrics.availability}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{width: `${Math.min(globalMetrics.availability, 100)}%`}}></div>
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
                                    <span className="font-bold text-slate-900 text-lg">{globalMetrics.performance}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div className="bg-amber-400 h-full rounded-full transition-all duration-1000" style={{width: `${Math.min(globalMetrics.performance, 100)}%`}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual Machine Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {machineMetrics.map((p) => (
                        <div key={p.name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-bold text-lg text-slate-800">{p.name}</h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.oee > 85 ? 'bg-emerald-100 text-emerald-700' : p.oee > 65 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
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
            </>
        )}
    </div>
  );
};
