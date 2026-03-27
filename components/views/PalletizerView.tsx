
import React, { useState, useMemo } from 'react';
import { Cell, PieChart, Pie, ResponsiveContainer, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '../DateFilter';
import { Zap, Activity, Gauge, Loader2, AlertCircle } from 'lucide-react';
import { fetchProductionStats } from '../../services/sheetService';
import { ShiftMetric } from '../../types';

export const PalletizerView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  const { data: productionStats, isLoading: loading } = useQuery({
    queryKey: ['production', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchProductionStats(dateRange.start, dateRange.end),
  });

  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
  };

  const { machineMetrics, globalMetrics, hasData } = useMemo(() => {
    if (!productionStats || !productionStats.details || productionStats.details.length === 0) {
        return { machineMetrics: [], globalMetrics: { availability: 0, performance: 0, oee: 0 }, hasData: false };
    }

    const details = productionStats.details;

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
        // Redondeo a enteros usando Math.round
        availability: Math.round(m.availSum / m.count * 100),
        performance: Math.round(m.perfSum / m.count * 100),
        oee: Math.round(m.oeeSum / m.count * 100)
    })).sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabéticamente (672 -> 673 -> 674)

    // 3. Calcular Promedio Global de Planta
    let global = { availability: 0, performance: 0, oee: 0 };
    if (metrics.length > 0) {
        const totalAvail = metrics.reduce((acc, curr) => acc + curr.availability, 0) / metrics.length;
        const totalPerf = metrics.reduce((acc, curr) => acc + curr.performance, 0) / metrics.length;
        // OEE Global recalculado como Disp * Rend (o promedio de OEEs, matemáticamente Disp*Rend es más puro)
        const totalOEE = (totalAvail * totalPerf) / 100;

        global = {
            availability: Math.round(totalAvail),
            performance: Math.round(totalPerf),
            oee: Math.round(totalOEE)
        };
    }

    return { machineMetrics: metrics, globalMetrics: global, hasData: true };
  }, [productionStats]);

  const gaugeData = [
    { name: 'OEE', value: globalMetrics.oee, fill: '#6366f1' },
    { name: 'Loss', value: 100 - globalMetrics.oee, fill: '#f1f5f9' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 overflow-x-hidden text-slate-200 bg-[#0a0f1e] min-h-screen p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Rendimiento Paletizadoras</h2>
            <p className="text-slate-400 text-sm mt-1 font-medium">Comparativa directa entre unidades de paletizado basada en producción real.</p>
          </div>
          <DateFilter onFilterChange={handleFilterChange} />
        </div>

        {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="animate-spin mb-2 text-blue-500" size={32} />
              <p className="text-xs font-black uppercase tracking-widest">Calculando OEE en tiempo real...</p>
          </div>
        ) : !hasData ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-white/10 rounded-2xl bg-white/5 italic text-sm">
              <AlertCircle className="mb-2 opacity-50" size={32} />
              <p>No hay registros de producción para el período seleccionado.</p>
           </div>
        ) : (
            <>
                {/* Global Indicators Panel */}
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <Gauge className="text-indigo-400" size={18} />
                            Promedio Global Planta ({machineMetrics.length} Equipos)
                        </h3>
                    </div>
                    
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                        
                        {/* OEE Gauge */}
                        <div className="relative h-[250px] flex flex-col items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%" debounce={50}>
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
                                        <Cell fill={globalMetrics.oee >= 85 ? '#10b981' : globalMetrics.oee >= 65 ? '#f59e0b' : '#ef4444'} fillOpacity={0.8} />
                                        <Cell fill="rgba(255,255,255,0.05)" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">OEE Global</p>
                                <p className={`text-5xl font-black tracking-tighter ${globalMetrics.oee >= 85 ? 'text-emerald-400' : globalMetrics.oee >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
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
                                        <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                                            <Zap size={16} />
                                        </div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Disponibilidad Promedio</span>
                                    </div>
                                    <span className="font-black text-white text-xl tracking-tighter">{globalMetrics.availability}%</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{width: `${Math.min(globalMetrics.availability, 100)}%`}}></div>
                                </div>
                            </div>

                            {/* Performance */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                                            <Activity size={16} />
                                        </div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Rendimiento Promedio</span>
                                    </div>
                                    <span className="font-black text-white text-xl tracking-tighter">{globalMetrics.performance}%</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                                    <div className="bg-amber-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.3)]" style={{width: `${Math.min(globalMetrics.performance, 100)}%`}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual Machine Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {machineMetrics.map((p) => (
                        <div key={p.name} className="bg-white/[0.03] backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl hover:bg-white/[0.05] transition-all group">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-black text-white uppercase tracking-tight">{p.name}</h4>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                    p.oee > 85 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                    p.oee > 65 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                    'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    {p.oee}% OEE
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disponibilidad
                                    </span>
                                    <span className="font-black text-white tracking-tighter">{p.availability}%</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Rendimiento
                                    </span>
                                    <span className="font-black text-white tracking-tighter">{p.performance}%</span>
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
