
import React, { useState, useMemo } from 'react';
import { PackageCheck, Timer, AlertTriangle, TrendingUp, TableProperties, CircleDashed, Loader2, Weight, BarChart2, Calendar, Activity, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchDowntimes, fetchProductionStats, fetchStocks } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats } from '../../types';
import { DateFilter } from '../DateFilter';

// Helper for hh:mm format
const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg z-50">
          <p className="font-semibold text-slate-800 text-sm mb-1">{data.reason}</p>
          <div className="text-xs text-slate-500 mb-2">
             <span className="font-mono bg-slate-100 px-1 rounded">{data.hac || 'N/A'}</span>
          </div>
          <p className="text-slate-600 text-sm">
            Duración: <span className="font-bold text-slate-900">{formatMinutes(data.durationMinutes)}</span> 
            <span className="text-xs text-slate-400 ml-1">({data.durationMinutes} min)</span>
          </p>
        </div>
      );
    }
    return null;
};

export const SummaryView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  // Queries with React Query for caching and optimization
  const { data: downtimeResult, isLoading: loadingDowntimes } = useQuery({
    queryKey: ['downtimes', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchDowntimes(dateRange.start, dateRange.end),
  });

  const { data: prodResult, isLoading: loadingProd } = useQuery({
    queryKey: ['production', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchProductionStats(dateRange.start, dateRange.end),
  });

  const { data: stockResult, isLoading: loadingStocks } = useQuery({
    queryKey: ['stocks', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchStocks(dateRange.start, dateRange.end),
  });

  const isLoading = loadingDowntimes || loadingProd || loadingStocks;

  const handleFilterChange = (range: { start: Date, end: Date }) => {
    setDateRange(range);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const SHIFT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'];

  // Formatear fecha como en la imagen: "Miércoles 04 de Marzo"
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long' 
    }).replace(/^\w/, (c) => c.toUpperCase());
  };

  // Data processing using useMemo for performance
  const downtimes = useMemo(() => {
    if (!downtimeResult) return [];
    return [...downtimeResult]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .slice(0, 10);
  }, [downtimeResult]);

  const shiftData = useMemo(() => {
    if (!prodResult?.byShift) return [];
    return prodResult.byShift.map(s => ({
        ...s,
        valueTn: s.valueTn // Ya viene en Tn desde la API
    }));
  }, [prodResult]);

  const productBreakdown = useMemo(() => {
    if (!prodResult?.byMachineProduct) return [];
    const breakdown = prodResult.byMachineProduct.reduce((acc: any[], curr) => {
      Object.keys(curr).forEach(key => {
        if (key !== 'name') {
          const existing = acc.find(p => p.name === key);
          if (existing) {
            existing.value += (curr[key] as number);
          } else {
            acc.push({ name: key, value: curr[key] as number });
          }
        }
      });
      return acc;
    }, []).sort((a, b) => b.value - a.value).slice(0, 4).map(p => ({
      ...p,
      valueTn: p.value // Ya es Tn desde la API
    }));
    return breakdown;
  }, [prodResult]);

  const maxProductValue = useMemo(() => 
    Math.max(...productBreakdown.map(p => p.valueTn), 1), 
  [productBreakdown]);

  const detailedMetrics = prodResult?.details || [];

  // Helper para obtener métricas promedio por turno
  const getShiftMetrics = (shiftName: string) => {
    const shiftMetrics = detailedMetrics.filter(m => m.shift === shiftName);
    if (shiftMetrics.length === 0) return { disp: 0, rend: 0, oee: 0 };
    
    const count = shiftMetrics.length;
    return {
      disp: shiftMetrics.reduce((acc, m) => acc + m.availability, 0) / count,
      rend: shiftMetrics.reduce((acc, m) => acc + m.performance, 0) / count,
      oee: shiftMetrics.reduce((acc, m) => acc + m.oee, 0) / count
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
            <Calendar className="text-slate-400" size={24} />
            <h1 className="text-2xl font-bold text-slate-800">{formatDate(dateRange.start)}</h1>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {isLoading ? (
           <div className="h-96 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={48} />
              <p className="text-lg font-medium">Sincronizando con Planta...</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN (KPIs) - 3/12 */}
            <div className="lg:col-span-3 space-y-6">
                
                {/* Producción Total Card */}
                <div className="bg-blue-600 text-white p-6 rounded-lg shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <PackageCheck size={120} />
                    </div>
                    <p className="text-blue-100 font-bold uppercase tracking-wider text-sm mb-1">Producción Total</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-black tracking-tighter">
                            {(prodResult?.totalTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h2>
                        <span className="text-2xl font-bold text-blue-200">Tn</span>
                    </div>
                </div>

                {/* Desglose por Producto */}
                <div className="bg-blue-700 text-white p-6 rounded-lg shadow-lg space-y-4">
                    {productBreakdown.length > 0 ? productBreakdown.map((prod, idx) => (
                        <div key={prod.name} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                                <span>{prod.name}</span>
                                <span>{prod.valueTn.toLocaleString(undefined, { maximumFractionDigits: 1 })} Tn</span>
                            </div>
                            <div className="h-2 bg-blue-900/50 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-red-500 rounded-full" 
                                    style={{ width: `${(prod.valueTn / maxProductValue) * 100}%` }}
                                />
                            </div>
                        </div>
                    )) : (
                        <p className="text-xs text-blue-300 italic">Sin datos de productos</p>
                    )}
                </div>

                {/* Disp % / Rend % Card */}
                <div className="bg-blue-600 text-white p-6 rounded-lg shadow-lg">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase text-blue-200">Disp %</p>
                            <p className="text-2xl font-black">
                                {(detailedMetrics.reduce((acc, m) => acc + m.availability, 0) / (detailedMetrics.length || 1) * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase text-blue-200">Rend %</p>
                            <p className="text-2xl font-black">
                                {(detailedMetrics.reduce((acc, m) => acc + m.performance, 0) / (detailedMetrics.length || 1) * 100).toFixed(0)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN (Stock & Downtime) - 9/12 */}
            <div className="lg:col-span-9 space-y-6">
                
                {/* Stock Section */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-green-500 text-white px-6 py-2 flex justify-between items-center">
                        <h3 className="font-black uppercase tracking-widest text-sm">Stock a las 06:00 hs.</h3>
                        <Clock size={16} />
                    </div>
                    <div className="bg-slate-800 text-white p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {stockResult?.items.filter(i => i.isProduced).slice(0, 4).map(item => (
                            <div key={item.id} className="border-r border-slate-700 last:border-0">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">TOTAL {item.product}</p>
                                <p className="text-2xl font-black tracking-tighter">
                                    {item.tonnage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-xs font-bold text-slate-500 ml-1">Tn</span>
                                </p>
                            </div>
                        )) || (
                            <div className="col-span-4 py-2 text-slate-500 text-xs italic">Datos de stock no disponibles</div>
                        )}
                    </div>
                </div>

                {/* Downtime Horizontal Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-[400px] flex flex-col">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                        <AlertTriangle className="text-red-500" size={18} />
                        <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Análisis de Paradas Principales</h3>
                    </div>
                    <div className="flex-grow">
                        {downtimes.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={downtimes}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="reason"
                                        stroke="#64748b"
                                        fontSize={10}
                                        width={180}
                                        tick={{ fill: '#475569', fontWeight: 600 }}
                                        tickFormatter={(val) => val.length > 25 ? `${val.substring(0,25)}...` : val}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                                    <Bar dataKey="durationMinutes" fill="#f87171" radius={[0, 4, 4, 0]} barSize={15} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">Sin registros de paros</div>
                        )}
                    </div>
                </div>
            </div>

            {/* BOTTOM ROW - Shift & Palletizer */}
            <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-[450px] flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="text-emerald-500" size={20} />
                    <h3 className="font-bold text-slate-800 uppercase text-sm tracking-widest">Producción por Turno (Tn)</h3>
                </div>
                <div className="flex-grow">
                    {shiftData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={shiftData} margin={{ top: 40, right: 30, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={700} />
                                <YAxis stroke="#64748b" fontSize={11} />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-xs">
                                                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                                                    <p className="text-slate-600">
                                                        Producción: <span className="font-bold">{payload[0].value?.toLocaleString(undefined, { maximumFractionDigits: 1 })} Tn</span>
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="valueTn" radius={[4, 4, 0, 0]} barSize={60}>
                                    {shiftData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={SHIFT_COLORS[index % SHIFT_COLORS.length]} />
                                    ))}
                                    <LabelList 
                                        dataKey="valueTn" 
                                        position="top" 
                                        content={(props: any) => {
                                            const { x, y, width, value, index } = props;
                                            const shiftName = shiftData[index].name;
                                            const metrics = getShiftMetrics(shiftName);
                                            return (
                                                <g>
                                                    <text x={x + width / 2} y={y - 5} fill="#1e293b" textAnchor="middle" fontSize={11} fontWeight="black">
                                                        {value.toFixed(0)} Tn
                                                    </text>
                                                    <text x={x + width / 2} y={y - 18} fill="#64748b" textAnchor="middle" fontSize={9} fontWeight="bold">
                                                        OEE: {(metrics.oee * 100).toFixed(0)}%
                                                    </text>
                                                    <text x={x + width / 2} y={y - 28} fill="#64748b" textAnchor="middle" fontSize={9} fontWeight="bold">
                                                        Rend: {(metrics.rend * 100).toFixed(0)}%
                                                    </text>
                                                    <text x={x + width / 2} y={y - 38} fill="#64748b" textAnchor="middle" fontSize={9} fontWeight="bold">
                                                        Disp: {(metrics.disp * 100).toFixed(0)}%
                                                    </text>
                                                </g>
                                            );
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">Sin datos de turnos</div>
                    )}
                </div>
            </div>

            <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-[450px] flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <Activity className="text-blue-500" size={20} />
                    <h3 className="font-bold text-slate-800 uppercase text-sm tracking-widest">Producción por Paletizadora (Tn)</h3>
                </div>
                
                {prodResult?.byMachine && prodResult.byMachine.length > 0 ? (
                    <div className="flex flex-col h-full">
                        <div className="h-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={prodResult.byMachine}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="valueTn"
                                        label={({ name, valueTn, index }) => {
                                            const machineName = prodResult.byMachine[index].name;
                                            const machineMetrics = detailedMetrics.filter(m => m.machineName === machineName);
                                            const avgMetrics = machineMetrics.length > 0 ? {
                                                oee: machineMetrics.reduce((acc, m) => acc + m.oee, 0) / machineMetrics.length,
                                                rend: machineMetrics.reduce((acc, m) => acc + m.performance, 0) / machineMetrics.length,
                                                disp: machineMetrics.reduce((acc, m) => acc + m.availability, 0) / machineMetrics.length
                                            } : { oee: 0, rend: 0, disp: 0 };

                                            return (
                                                <tspan fontSize={8} fontWeight="bold">
                                                    {name}: {valueTn.toFixed(0)} Tn
                                                    (OEE: {(avgMetrics.oee * 100).toFixed(0)}%)
                                                </tspan>
                                            );
                                        }}
                                    >
                                        {prodResult.byMachine.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const machineMetrics = detailedMetrics.filter(m => m.machineName === data.name);
                                                const avgMetrics = machineMetrics.length > 0 ? {
                                                    oee: machineMetrics.reduce((acc, m) => acc + m.oee, 0) / machineMetrics.length,
                                                    rend: machineMetrics.reduce((acc, m) => acc + m.performance, 0) / machineMetrics.length,
                                                    disp: machineMetrics.reduce((acc, m) => acc + m.availability, 0) / machineMetrics.length
                                                } : { oee: 0, rend: 0, disp: 0 };

                                                return (
                                                    <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-[10px]">
                                                        <p className="font-bold text-slate-800 mb-1">{data.name}</p>
                                                        <p className="text-slate-600">Prod: <span className="font-bold">{data.valueTn.toFixed(1)} Tn</span></p>
                                                        <p className="text-slate-500">OEE: {(avgMetrics.oee * 100).toFixed(0)}%</p>
                                                        <p className="text-slate-500">Rend: {(avgMetrics.rend * 100).toFixed(0)}%</p>
                                                        <p className="text-slate-500">Disp: {(avgMetrics.disp * 100).toFixed(0)}%</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="h-1/2 overflow-auto mt-4">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tighter">
                                    <tr>
                                        <th className="px-2 py-2 text-left">Máquina</th>
                                        <th className="px-2 py-2 text-right">Toneladas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {prodResult.byMachine.map((m, i) => (
                                        <tr key={m.name} className="hover:bg-slate-50">
                                            <td className="px-2 py-2 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                                                <span className="font-bold text-slate-700">{m.name}</span>
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono font-bold text-slate-800">
                                                {m.valueTn.toLocaleString(undefined, { maximumFractionDigits: 1 })} Tn
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-slate-400">Sin datos de máquinas</div>
                )}
            </div>

        </div>
      )}

    </div>
  );
};
