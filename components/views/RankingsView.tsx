'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRankings, fetchDowntimes } from '../../services/sheetService';
import { DateFilter } from '../DateFilter';
import { Trophy, Clock, AlertTriangle, Users, Box, Hammer, Settings2, BarChart3, TrendingUp, Hash, Percent, ChevronRight, ChevronDown, X, Check, Calendar, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type RankingType = 'production' | 'downtime';
type DrillDownFilter = { type: string; value: string } | null;

interface KPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  className?: string;
}

function KPICard({ title, value, subtext, icon: Icon, className = "" }: KPICardProps) {
  return (
    <div className={`bg-slate-800/40 border border-slate-700/50 p-5 rounded-3xl backdrop-blur-sm hover:bg-slate-800/60 transition-colors ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 truncate" title={title}>{title}</p>
          <h4 className="text-2xl font-black text-white tracking-tight truncate" title={String(value)}>{value}</h4>
          {subtext && (
            <p className="text-slate-500 text-[10px] mt-2 font-bold italic truncate" title={subtext}>
              {subtext}
            </p>
          )}
        </div>
        <div className="p-3 bg-slate-900/60 rounded-2xl text-slate-400 shrink-0 border border-slate-700/30">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

interface LeaderboardItemProps {
  rank: number;
  name: string;
  value: number;
  max: number;
  unit: string;
  percentage?: number;
  colorClass?: string;
  onClick?: () => void;
}

function LeaderboardItem({ rank, name, value, max, unit, percentage, colorClass = "bg-emerald-500", onClick }: LeaderboardItemProps) {
  const progress = (value / max) * 100;
  
  return (
    <div 
        onClick={onClick}
        className={`group flex items-center gap-4 py-3 px-2 rounded-2xl transition-all duration-300 ${onClick ? 'cursor-pointer hover:bg-slate-800/50' : 'hover:bg-slate-800/20'}`}
    >
      <div className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black shrink-0 ${
        rank === 1 ? 'bg-amber-500 text-amber-950 ring-4 ring-amber-500/20' :
        rank === 2 ? 'bg-slate-300 text-slate-900 ring-4 ring-slate-300/20' :
        rank === 3 ? 'bg-amber-700 text-amber-100 ring-4 ring-amber-700/20' :
        'bg-slate-800 text-slate-400'
      }`}>
        {rank}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-2">
          <div className="truncate pr-4" title={name}>
            <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{name}</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-black text-white">{value.toLocaleString()} <span className="text-[10px] text-slate-500 font-bold uppercase">{unit}</span></span>
            {percentage !== undefined && (
              <p className="text-[10px] text-slate-500 font-bold">{percentage.toFixed(1)}% participación</p>
            )}
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full ${colorClass} shadow-[0_0_8px_rgba(0,0,0,0.3)] shadow-current/20`}
          />
        </div>
      </div>
      {onClick && <ChevronRight size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
}

function ContextItem({ label, value, className = "" }: { label: string; value: string, className?: string }) {
    return (
        <div className={`flex items-center gap-3 min-w-0 ${className}`}>
            <span className="text-slate-500 font-black uppercase text-[10px] shrink-0 tracking-[0.1em] font-mono whitespace-nowrap">{label}:</span>
            <span className="text-slate-200 font-bold truncate cursor-help border-b border-dashed border-slate-700/50 pb-0.5 hover:text-white transition-colors" title={value}>
                {value}
            </span>
        </div>
    );
}

function Separator() {
    return <span className="hidden xl:block text-slate-700 font-thin select-none">|</span>;
}

function MultiSelectFilter({ 
    label, 
    options, 
    selected, 
    onChange, 
    icon: Icon 
}: { 
    label: string, 
    options: string[], 
    selected: string[], 
    onChange: (val: string[]) => void,
    icon: any
}) {
    const [isOpen, setIsOpen] = useState(false);
    
    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            const next = selected.filter(o => o !== option);
            onChange(next);
        } else {
            onChange([...selected, option]);
        }
    };

    const isAllSelected = selected.length === 0;

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm min-w-[160px] justify-between ${
                    selected.length > 0 
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
            >
                <div className="flex items-center gap-2">
                    <Icon size={14} className={selected.length > 0 ? "text-emerald-400" : "text-slate-500"} />
                    <span>{selected.length === 0 ? `Todos (${label})` : `${selected.length} Sel.`}</span>
                </div>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[70] p-4 flex flex-col max-h-[400px]"
                        >
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 shrink-0">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                                {selected.length > 0 && (
                                    <button 
                                        onClick={() => { onChange([]); setIsOpen(false); }} 
                                        className="text-[10px] font-black text-emerald-500 uppercase hover:text-emerald-400 transition-colors"
                                    >
                                        Restablecer
                                    </button>
                                )}
                            </div>
                            
                            <div className="overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                <div 
                                    onClick={() => { onChange([]); setIsOpen(false); }}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between group ${
                                        isAllSelected 
                                        ? 'bg-white/5 text-white' 
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                    }`}
                                >
                                    <span>Ver Todos</span>
                                    {isAllSelected && <Check size={14} className="text-emerald-500" />}
                                </div>
                                
                                <div className="h-px bg-slate-800/50 my-2" />

                                {options.length === 0 ? (
                                    <p className="text-slate-600 text-[10px] text-center py-4">No hay opciones disponibles</p>
                                ) : options.map(opt => {
                                    const isSelected = selected.includes(opt);
                                    return (
                                        <div 
                                            key={opt}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleOption(opt);
                                            }}
                                            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between group ${
                                                isSelected 
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                            }`}
                                        >
                                            <span className="truncate max-w-[180px]">{opt}</span>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-700 group-hover:border-slate-500'
                                            }`}>
                                                {isSelected && <Check size={12} className="text-slate-900" strokeWidth={3} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function getPeriodText(start: Date, end: Date) {
    const diff = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days <= 1) return "Hoy";
    if (days <= 7) return "Últimos 7 días";
    if (days <= 31) return "Mes actual";
    return `${days} días filtrados`;
}

export function RankingsView() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [rankingType, setRankingType] = useState<RankingType>('production');
  const [downtimeMetric, setDowntimeMetric] = useState<'duration' | 'count'>('duration');
  const [drillDown, setDrillDown] = useState<DrillDownFilter>(null);
  
  // Downtime specific filters
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', dateRange.start, dateRange.end, selectedOperators, selectedTypes],
    queryFn: () => fetchRankings(dateRange.start, dateRange.end, selectedOperators, selectedTypes),
  });

  const { data: detailRecords, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['downtime-details', dateRange.start, dateRange.end, drillDown],
    queryFn: async () => {
        if (!drillDown) return [];
        const all = await fetchDowntimes(dateRange.start, dateRange.end);
        return all.filter(event => {
            if (drillDown.type === 'operator') return event.operatorName === drillDown.value;
            if (drillDown.type === 'machine') return event.machineId === drillDown.value;
            if (drillDown.type === 'cause') return event.reason === drillDown.value;
            if (drillDown.type === 'equipment') return event.hacDetail === drillDown.value;
            return false;
        });
    },
    enabled: !!drillDown && rankingType === 'downtime'
  });

  const getMaxValue = (items: any[], key: string) => Math.max(...items.map(i => i[key])) || 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-12">
      
      {/* Detail Modal */}
      <AnimatePresence>
        {drillDown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrillDown(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl shadow-black h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <Search className="text-emerald-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Detalle de Incidencias</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                      Filtrado por <span className="text-emerald-400">{drillDown.type}</span>: <span className="text-white bg-slate-800 px-2 py-0.5 rounded-md">{drillDown.value}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setDrillDown(null)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                {isLoadingDetails ? (
                  <div className="space-y-4">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-slate-800/50 animate-pulse rounded-2xl" />)}
                  </div>
                ) : detailRecords && detailRecords.length > 0 ? (
                  <div className="min-w-full inline-block align-middle">
                    <table className="w-full text-left border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="pb-4 pl-4 font-black">Fecha / Turno</th>
                                <th className="pb-4 font-black">Línea / Equipo HAC</th>
                                <th className="pb-4 font-black">Motivo / Causa</th>
                                <th className="pb-4 font-black">Maquinista</th>
                                <th className="pb-4 pr-4 font-black text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detailRecords.map((event) => (
                                <tr key={event.id} className="group bg-slate-800/20 hover:bg-slate-800/40 transition-all rounded-2xl">
                                    <td className="py-5 pl-4 rounded-l-3xl border-y border-l border-transparent group-hover:border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <Calendar size={14} className="text-slate-500" />
                                            <div>
                                                <p className="text-sm font-bold text-white leading-none">{event.date}</p>
                                                <p className="text-[10px] font-black text-slate-500 mt-1 uppercase">Turno {event.shift}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 border-y border-transparent group-hover:border-slate-700/50">
                                        <p className="text-sm font-black text-slate-200">{event.machineId}</p>
                                        <p className="text-[10px] font-medium text-slate-500 italic mt-0.5">{event.hacDetail}</p>
                                    </td>
                                    <td className="py-5 border-y border-transparent group-hover:border-slate-700/50">
                                        <div className="max-w-sm">
                                            <p className="text-sm font-medium text-slate-300 line-clamp-1" title={event.reason}>{event.reason}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-black text-slate-500">{event.sapCause || 'NO SAP'}</span>
                                                <span className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-black text-slate-500">{event.downtimeType}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 border-y border-transparent group-hover:border-slate-700/50">
                                        <p className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">{event.operatorName}</p>
                                    </td>
                                    <td className="py-5 pr-4 text-right rounded-r-3xl border-y border-r border-transparent group-hover:border-slate-700/50">
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-xl font-black text-emerald-400">{event.durationMinutes}</span>
                                            <span className="text-[10px] font-black text-slate-600 uppercase">min</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12">
                    <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 text-slate-600 border border-slate-700/50 shadow-inner">
                        <AlertTriangle size={32} />
                    </div>
                    <h4 className="text-2xl font-black text-white tracking-tight">No se encontraron detalles</h4>
                    <p className="text-slate-500 text-sm mt-3 font-medium max-w-sm">Hubo un problema al recuperar los registros individuales o no existen para este periodo.</p>
                    <button 
                        onClick={() => setDrillDown(null)}
                        className="mt-8 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all"
                    >
                        Cerrar Ventana
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main View Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-900/30 p-6 sm:p-8 rounded-[3rem] border border-slate-800/50">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
            <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 shadow-lg">
                <Trophy className="text-emerald-400" size={32} />
            </div>
            RANKINGS <span className="text-emerald-500 italic">OPERATIVOS</span>
          </h1>
          <p className="text-slate-400 mt-2 uppercase tracking-[0.3em] text-[10px] font-black opacity-60 pl-1">Inteligencia de Planta & Desempeño Ejecutivo</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full xl:w-auto">
            {/* View Switcher */}
            <div className="flex p-1 bg-slate-950/80 rounded-[1.5rem] border border-slate-800 shadow-2xl shrink-0">
                <button
                    onClick={() => setRankingType('production')}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 justify-center ${
                    rankingType === 'production' 
                        ? 'bg-emerald-600 text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] scale-[1.02]' 
                        : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                    <Box size={12} />
                    Producción
                </button>
                <button
                    onClick={() => setRankingType('downtime')}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 justify-center ${
                    rankingType === 'downtime' 
                        ? 'bg-emerald-600 text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] scale-[1.02]' 
                        : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                    <Clock size={12} />
                    Paros
                </button>
            </div>

            {/* Date Filter Container */}
            <div className="flex-1 md:min-w-[420px] max-w-full">
                <DateFilter 
                    onFilterChange={(range) => setDateRange(range)} 
                    defaultFilter="month" 
                />
            </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-900/40 rounded-3xl animate-pulse border border-slate-800/40" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {[1, 2].map(i => <div key={i} className="h-[500px] bg-slate-900/40 rounded-[3rem] animate-pulse border border-slate-800/40" />)}
            </div>
        </div>
      ) : data ? (
        <AnimatePresence mode="wait">
          {rankingType === 'production' ? (
            <motion.div 
              key="prod"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Production Consolidated Executive Header */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-xl overflow-hidden">
                  <div className="flex flex-col xl:flex-row gap-12 items-start xl:items-center">
                    <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-white tracking-tighter shadow-sm">
                            {Math.round(data.summary.production.totalTN).toLocaleString()}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-none">Toneladas</span>
                          <span className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">Carga Total</span>
                        </div>
                    </div>
                    
                    <div className="w-px h-12 bg-slate-700/30 hidden xl:block" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 flex-1">
                        <div className="flex flex-col min-w-0">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Maquinista Estrella</span>
                            <span className="text-xl font-black text-slate-200 truncate" title={data.summary.production.topOperator}>{data.summary.production.topOperator}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Línea Líder</span>
                            <span className="text-xl font-black text-slate-200 truncate" title={data.summary.production.topPalletizer}>{data.summary.production.topPalletizer}</span>
                        </div>
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Operator Leaderboard */}
                <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-8 backdrop-blur-md shadow-xl sm:p-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Leaderboard Maquinistas</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Top 10 Rendimiento en Toneladas</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        {data.productionRankings.byOperator.slice(0, 10).map((item, idx) => (
                            <LeaderboardItem 
                                key={item.name}
                                rank={idx + 1}
                                name={item.name}
                                value={Math.round(item.value)}
                                max={getMaxValue(data.productionRankings.byOperator, 'value')}
                                unit="TN"
                                colorClass="bg-emerald-500"
                            />
                        ))}
                    </div>
                </div>

                {/* Palletizer Leaderboard */}
                <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-8 backdrop-blur-md text-white shadow-xl sm:p-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20">
                                <Box size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Producción por Línea</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Participación sobre el Total</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {data.productionRankings.byPalletizer.slice(0, 8).map((item, idx) => (
                            <LeaderboardItem 
                                key={item.name}
                                rank={idx + 1}
                                name={item.name}
                                value={Math.round(item.value)}
                                max={getMaxValue(data.productionRankings.byPalletizer, 'value')}
                                unit="TN"
                                percentage={(item.value / data.summary.production.totalTN) * 100}
                                colorClass="bg-blue-500"
                            />
                        ))}
                    </div>
                    <div className="mt-12 p-8 bg-slate-950/40 rounded-[2rem] border border-slate-800/60 flex items-center justify-between group cursor-help transition-all hover:bg-slate-950/60 shadow-inner">
                        <div className="max-w-[70%]">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Análisis de participación</p>
                            <p className="text-base font-medium text-slate-400 leading-relaxed">
                                La línea líder <span className="text-white font-black">{data.summary.production.topPalletizer}</span> aporta un <span className="text-blue-400 font-black">{((data.productionRankings.byPalletizer[0]?.value || 0) / data.summary.production.totalTN * 100).toFixed(1)}%</span> al volumen global del sector.
                            </p>
                        </div>
                        <div className="bg-blue-500/10 p-4 rounded-3xl text-blue-500 group-hover:scale-110 transition-transform">
                            <Percent size={28} />
                        </div>
                    </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="downtime"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
               {/* Downtime Consolidated Executive Header */}
               <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 backdrop-blur-md shadow-xl overflow-hidden">
                  <div className="flex flex-col xl:flex-row gap-12 mb-8 items-start xl:items-center">
                    <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-white tracking-tighter shadow-sm">
                            {(data.summary.downtime.totalDuration / 60).toFixed(1)}h
                        </span>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-none">Horas</span>
                          <span className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">De Paro</span>
                        </div>
                    </div>
                    <div className="w-px h-12 bg-slate-700/30 hidden xl:block" />
                    <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-white tracking-tighter shadow-sm">
                            {data.summary.downtime.totalCount}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-none">Incidencias</span>
                          <span className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">Registradas</span>
                        </div>
                    </div>
                    <div className="w-px h-12 bg-slate-700/30 hidden xl:block" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 flex-1">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Reporte Máximo</span>
                            <span className="text-xl font-black text-slate-200 truncate" title={data.summary.downtime.topOperator}>{data.summary.downtime.topOperator}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Línea Crítica</span>
                            <span className="text-xl font-black text-slate-200 truncate" title={data.summary.downtime.topMachine}>{data.summary.downtime.topMachine}</span>
                        </div>
                    </div>
                  </div>
                  
                  <div className="h-px bg-slate-700/30 mb-6" />

                  <div className="grid grid-cols-1 gap-4">
                    <ContextItem label="Causa principal" value={data.summary.downtime.mostFreqCause} className="!max-w-none" />
                    <ContextItem label="HAC crítico" value={data.summary.downtime.mostFreqEquipment} className="!max-w-none" />
                  </div>
               </div>

               <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-slate-950/40 px-8 py-4 rounded-[2.5rem] border border-slate-800/60 backdrop-blur-md shadow-lg">
                  <div className="flex flex-wrap items-center gap-4">
                    <MultiSelectFilter 
                        label="Maquinistas" 
                        options={data.availableFilters?.operators || []} 
                        selected={selectedOperators} 
                        onChange={setSelectedOperators} 
                        icon={Users} 
                    />
                    <MultiSelectFilter 
                        label="Tipos" 
                        options={data.availableFilters?.downtimeTypes || []} 
                        selected={selectedTypes} 
                        onChange={setSelectedTypes} 
                        icon={Hash} 
                    />
                    {(selectedOperators.length > 0 || selectedTypes.length > 0) && (
                        <button 
                            onClick={() => { setSelectedOperators([]); setSelectedTypes([]); }}
                            className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400 transition-colors flex items-center gap-1.5 px-3 py-2 hover:bg-rose-500/10 rounded-xl"
                        >
                            <X size={14} />
                            Limpiar Filtros
                        </button>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-emerald-500" size={14} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Ranking:</span>
                    </div>
                    <div className="flex p-1 bg-slate-900 rounded-[1.25rem] border border-slate-800/80 shadow-inner">
                        <button 
                            onClick={() => setDowntimeMetric('duration')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${downtimeMetric === 'duration' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Duración
                        </button>
                        <button 
                            onClick={() => setDowntimeMetric('count')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${downtimeMetric === 'count' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Frecuencia
                        </button>
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Causes */}
                  <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-8 shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                            <AlertTriangle size={18} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Top Causas</h4>
                     </div>
                     <div className="space-y-1">
                        {[...data.downtimeRankings.byCause]
                            .sort((a,b) => b[downtimeMetric] - a[downtimeMetric])
                            .slice(0, 5).map((item, idx) => (
                            <LeaderboardItem 
                                key={idx}
                                rank={idx + 1}
                                name={item.name}
                                value={item[downtimeMetric]}
                                max={getMaxValue(data.downtimeRankings.byCause, downtimeMetric)}
                                unit={downtimeMetric === 'duration' ? 'min' : 'inc'}
                                colorClass="bg-amber-500"
                                onClick={() => setDrillDown({ type: 'cause', value: item.name })}
                            />
                        ))}
                     </div>
                  </div>

                  {/* Equipment HAC */}
                  <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-8 shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                            <Hammer size={18} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Fallas HAC</h4>
                     </div>
                     <div className="space-y-1">
                        {[...data.downtimeRankings.byEquipment]
                            .sort((a,b) => b[downtimeMetric] - a[downtimeMetric])
                            .slice(0, 5).map((item, idx) => (
                            <LeaderboardItem 
                                key={idx}
                                rank={idx + 1}
                                name={item.name}
                                value={item[downtimeMetric]}
                                max={getMaxValue(data.downtimeRankings.byEquipment, downtimeMetric)}
                                unit={downtimeMetric === 'duration' ? 'min' : 'inc'}
                                colorClass="bg-rose-500"
                                onClick={() => setDrillDown({ type: 'equipment', value: item.name })}
                            />
                        ))}
                     </div>
                  </div>

                  {/* Operators */}
                  <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-8 shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-violet-500/10 rounded-xl text-violet-500">
                            <Users size={18} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Reportes Maquinistas</h4>
                     </div>
                     <div className="space-y-1">
                        {[...data.downtimeRankings.byOperator]
                            .sort((a,b) => b[downtimeMetric] - a[downtimeMetric])
                            .slice(0, 5).map((item, idx) => (
                            <LeaderboardItem 
                                key={idx}
                                rank={idx + 1}
                                name={item.name}
                                value={item[downtimeMetric]}
                                max={getMaxValue(data.downtimeRankings.byOperator, downtimeMetric)}
                                unit={downtimeMetric === 'duration' ? 'min' : 'inc'}
                                colorClass="bg-violet-500"
                                onClick={() => setDrillDown({ type: 'operator', value: item.name })}
                            />
                        ))}
                     </div>
                  </div>

                  {/* Machines */}
                  <div className="bg-slate-900/30 border border-slate-800/50 rounded-[3rem] p-8 shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                            <Settings2 size={18} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Líneas Afectadas</h4>
                     </div>
                     <div className="space-y-1">
                        {[...data.downtimeRankings.byMachine]
                            .sort((a,b) => b[downtimeMetric] - a[downtimeMetric])
                            .slice(0, 5).map((item, idx) => (
                            <LeaderboardItem 
                                key={idx}
                                rank={idx + 1}
                                name={item.name}
                                value={item[downtimeMetric]}
                                max={getMaxValue(data.downtimeRankings.byMachine, downtimeMetric)}
                                unit={downtimeMetric === 'duration' ? 'min' : 'inc'}
                                colorClass="bg-blue-500"
                                onClick={() => setDrillDown({ type: 'machine', value: item.name })}
                            />
                        ))}
                     </div>
                  </div>
               </div>

               <div className="pt-12">
                 <div className="flex items-center justify-between mb-10">
                    <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                            <CombineIcon className="text-emerald-500" size={28} />
                        </div>
                        CRUCES DE INFORMACIÓN <span className="text-slate-600">INTELIGENTES</span>
                    </h2>
                    <div className="h-px flex-1 bg-slate-800/50 mx-8"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700/50">Top 5 Correlaciones</span>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <CombineSection title="Maquinista & Línea" data={data.downtimeRankings.combinations.operatorMachine} metric={downtimeMetric} icon={Users} color="bg-emerald-500" />
                    <CombineSection title="Línea & Causa" data={data.downtimeRankings.combinations.machineCause} metric={downtimeMetric} icon={Settings2} color="bg-blue-500" />
                    <CombineSection title="Equipo HAC & Causa" data={data.downtimeRankings.combinations.equipmentCause} metric={downtimeMetric} icon={Hammer} color="bg-rose-500" />
                    <CombineSection title="Maquinista & Equipo HAC" data={data.downtimeRankings.combinations.operatorEquipment} metric={downtimeMetric} icon={Users} color="bg-violet-500" />
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-20 text-center max-w-2xl mx-auto shadow-2xl backdrop-blur-md">
          <div className="w-24 h-24 bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-slate-600 border border-slate-700/50 shadow-inner">
            <Trophy size={48} />
          </div>
          <h3 className="text-3xl font-black text-white mb-3 tracking-tight">SIN REGISTROS DISPONIBLES</h3>
          <p className="text-slate-500 font-medium leading-relaxed max-w-md mx-auto">No se han encontrado datos suficientes para generar rankings de desempeño en este rango de fechas. Intenta ampliar el periodo de consulta.</p>
          <button className="mt-10 px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-900/20">
              Recargar Información
          </button>
        </div>
      )}
    </div>
  );
}

function CombineIcon({ className, size }: { className: string, size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 7 7v3.5a2.5 2.5 0 0 1-5 0V11a2 2 0 1 0-4 0v11" />
            <path d="M7 11V5.5a2.5 2.5 0 0 1 5 0V12a2 2 0 1 1-4 0V5" />
            <circle cx="12" cy="12" r="10" strokeOpacity="0.1" />
        </svg>
    )
}

function CombineSection({ title, data: rawData, metric, icon: Icon, color }: any) {
    const data = [...rawData].sort((a,b) => b[metric] - a[metric]);
    const maxVal = Math.max(...data.map((i: any) => i[metric])) || 1;
    return (
        <div className="bg-slate-800/20 border border-slate-700/40 rounded-[3rem] p-8 hover:bg-slate-800/40 transition-all group shadow-lg hover:shadow-black/20">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-slate-900/80 rounded-2xl text-slate-400 group-hover:text-white transition-all group-hover:scale-110 border border-slate-700/30">
                    <Icon size={20} />
                </div>
                <h4 className="text-xl font-black text-white tracking-tight">{title}</h4>
            </div>
            <div className="space-y-1">
                {data.slice(0, 5).map((item: any, idx: number) => (
                    <LeaderboardItem 
                        key={idx}
                        rank={idx + 1}
                        name={item.name}
                        value={item[metric]}
                        max={maxVal}
                        unit={metric === 'duration' ? 'min' : 'inc'}
                        colorClass={color}
                    />
                ))}
            </div>
        </div>
    )
}
