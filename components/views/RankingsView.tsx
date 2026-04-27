
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRankings } from '../../services/sheetService';
import { DateFilter } from '../DateFilter';
import { StatCard } from '../StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Trophy, Clock, AlertTriangle, Users, Box, Hammer, Settings2, Combine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type RankingType = 'production' | 'downtime';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function RankingsView() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [rankingType, setRankingType] = useState<RankingType>('production');
  const [downtimeMetric, setDowntimeMetric] = useState<'duration' | 'count'>('duration');

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', dateRange.start, dateRange.end],
    queryFn: () => fetchRankings(dateRange.start, dateRange.end),
  });

  const renderRankingChart = (data: any[], title: string, icon: React.ReactNode, metricKey: string = 'value', unit: string = '') => {
    const sortedData = [...(data || [])].slice(0, 10);
    
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col h-[400px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            {icon}
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        </div>
        
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={10} 
                width={100} 
                tickLine={false} 
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderColor: '#1e293b', 
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value.toLocaleString()} ${unit}`, 'Métrica']}
              />
              <Bar dataKey={metricKey} radius={[0, 4, 4, 0]}>
                {sortedData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Trophy className="text-emerald-400" size={32} />
            RANKINGS OPERATIVOS
          </h1>
          <p className="text-slate-400 mt-1 uppercase tracking-widest text-xs font-semibold">Comparativa de Maquinistas y Equipos</p>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setRankingType('production')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              rankingType === 'production' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Producción (TN)
          </button>
          <button
            onClick={() => setRankingType('downtime')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              rankingType === 'downtime' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Paros de Máquina
          </button>
        </div>
      </div>

      <DateFilter 
        onFilterChange={(range) => setDateRange(range)} 
        defaultFilter="month" 
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[400px] bg-slate-900/50 rounded-3xl animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : data ? (
        <AnimatePresence mode="wait">
          {rankingType === 'production' ? (
            <motion.div 
              key="prod"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {renderRankingChart(data.productionRankings.byOperator, "Top Maquinistas por TN", <Users size={20} />, 'value', 'TN')}
                {renderRankingChart(data.productionRankings.byPalletizer, "Producción por Paletizadora", <Box size={20} />, 'value', 'TN')}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="downtime"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
               <div className="flex items-center gap-4 bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit">
                  <button 
                    onClick={() => setDowntimeMetric('duration')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${downtimeMetric === 'duration' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Por Duración (Min)
                  </button>
                  <button 
                    onClick={() => setDowntimeMetric('count')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${downtimeMetric === 'count' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Por Frecuencia
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {renderRankingChart(data.downtimeRankings.byOperator, "Maquinistas con Más Paros", <Users size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                  {renderRankingChart(data.downtimeRankings.byMachine, "Máquinas Afectadas", <Settings2 size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                  {renderRankingChart(data.downtimeRankings.byCause, "Causas más Frecuentes", <AlertTriangle size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                  {renderRankingChart(data.downtimeRankings.byEquipment, "Equipos con más Fallas (HAC)", <Hammer size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
               </div>

               <div>
                 <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                   <Combine className="text-emerald-400" size={24} />
                   Análisis de Combinaciones (Cruces de Datos)
                 </h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {renderRankingChart(data.downtimeRankings.combinations.operatorMachine, "Maquinista + Línea", <Combine size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                    {renderRankingChart(data.downtimeRankings.combinations.machineCause, "Línea + Causa", <Combine size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                    {renderRankingChart(data.downtimeRankings.combinations.equipmentCause, "Equipo HAC + Causa", <Combine size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                    {renderRankingChart(data.downtimeRankings.combinations.operatorEquipment, "Maquinista + Equipo HAC", <Combine size={20} />, downtimeMetric, downtimeMetric === 'duration' ? 'min' : 'paros')}
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
          <StatCard title="Sin Datos" value="--" icon={Trophy} trend="neutral" />
          <p className="text-slate-400 mt-4">No se encontraron registros para el rango seleccionado.</p>
        </div>
      )}
    </div>
  );
}
