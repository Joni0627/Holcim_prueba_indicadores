import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Check } from 'lucide-react';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateFilterProps {
  onFilterChange?: (range: DateRange, type: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => void;
  defaultFilter?: 'today' | 'yesterday' | 'week' | 'month';
}

export const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange, defaultFilter = 'today' }) => {
  const [activeFilter, setActiveFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>(defaultFilter);
  const [showCustomRange, setShowCustomRange] = useState(false);
  // Internal state for strings to bind to input
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Helper to get a Date object set to Local Noon to avoid Timezone shifts when converting to ISO/UTC later
  const getLocalNoonDate = (offsetDays = 0) => {
      const date = new Date();
      date.setDate(date.getDate() + offsetDays);
      date.setHours(12, 0, 0, 0); // Force noon to be safe from UTC shifts
      return date;
  };

  const getStartOfMonth = () => {
      const date = new Date();
      date.setDate(1); // First day of month
      date.setHours(12, 0, 0, 0);
      return date;
  };

  // Initial filter trigger
  const initialTriggerRef = React.useRef(false);
  useEffect(() => {
    if (!initialTriggerRef.current) {
        initialTriggerRef.current = true;
        let start = getLocalNoonDate(0);
        let end = getLocalNoonDate(0);

        if (defaultFilter === 'yesterday') {
            start = getLocalNoonDate(-1);
            end = getLocalNoonDate(-1);
        } else if (defaultFilter === 'week') {
            start = getLocalNoonDate(-7);
        } else if (defaultFilter === 'month') {
            start = getStartOfMonth();
        }
        
        onFilterChange({ start, end }, defaultFilter);
    }
  }, [defaultFilter, onFilterChange]); // Run once on mount

  // Cerrar el menú si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowCustomRange(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePresetClick = (type: 'today' | 'yesterday' | 'week' | 'month') => {
      setActiveFilter(type);
      setShowCustomRange(false);
      
      const end = getLocalNoonDate(0);
      let start = getLocalNoonDate(0);

      if (type === 'yesterday') {
          start = getLocalNoonDate(-1);
          end.setTime(start.getTime()); // End is also yesterday
      } else if (type === 'week') {
          start = getLocalNoonDate(-7);
      } else if (type === 'month') {
          start = getStartOfMonth();
      }
      
      if (onFilterChange) onFilterChange({ start, end }, type);
  };

  const handleApplyRange = () => {
    if (customRange.start && customRange.end) {
      setActiveFilter('custom');
      setShowCustomRange(false);
      
      const start = new Date(customRange.start + 'T12:00:00'); // Add time to avoid timezone shifts
      const end = new Date(customRange.end + 'T12:00:00');

      if (onFilterChange) onFilterChange({ start, end }, 'custom');
    }
  };

  const formatDateDisplay = () => {
    if (activeFilter === 'custom' && customRange.start && customRange.end) {
        const s = new Date(customRange.start + 'T12:00:00');
        const e = new Date(customRange.end + 'T12:00:00');
        return `${s.getDate()}/${s.getMonth()+1} - ${e.getDate()}/${e.getMonth()+1}`;
    }
    return 'Rango';
  };

  return (
    <div className="relative z-[60] w-full" ref={wrapperRef}>
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900/50 rounded-2xl border border-slate-700/30 shadow-inner overflow-hidden backdrop-blur-md">
        <button
          onClick={() => handlePresetClick('today')}
          className={`flex-1 min-w-[50px] px-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeFilter === 'today' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => handlePresetClick('yesterday')}
          className={`flex-1 min-w-[50px] px-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeFilter === 'yesterday' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          Ayer
        </button>
        <button
          onClick={() => handlePresetClick('week')}
          className={`flex-1 min-w-[50px] px-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeFilter === 'week' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          7D
        </button>
        <button
          onClick={() => handlePresetClick('month')}
          className={`flex-1 min-w-[50px] px-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeFilter === 'month' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          Mes
        </button>
        
        <button 
          onClick={() => setShowCustomRange(!showCustomRange)}
          className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeFilter === 'custom' || showCustomRange
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
            : 'text-slate-500 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="whitespace-nowrap">{activeFilter === 'custom' ? formatDateDisplay() : 'Rango'}</span>
          <ChevronDown size={10} className={`shrink-0 transition-transform duration-200 ${showCustomRange ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showCustomRange && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-5 animate-in fade-in zoom-in-95 duration-200 z-[100] backdrop-blur-xl">
          <div className="flex justify-between items-center mb-5">
             <h4 className="font-black text-white text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                <Calendar size={14} className="text-emerald-500" />
                Seleccionar Período
             </h4>
             <button onClick={() => setShowCustomRange(false)} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-lg">
               <X size={16} />
             </button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha Inicial</label>
              <input 
                type="date" 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-white transition-all"
                value={customRange.start}
                onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha Final</label>
              <input 
                type="date" 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-white transition-all"
                value={customRange.end}
                onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
              />
            </div>
            
            <button 
              onClick={handleApplyRange}
              disabled={!customRange.start || !customRange.end}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-black uppercase tracking-[0.2em] py-3 px-4 rounded-xl text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
            >
              <Check size={14} strokeWidth={3} />
              Aplicar Rango
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
