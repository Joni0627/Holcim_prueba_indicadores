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

  // Initialize with Default Filter
  useEffect(() => {
    if (onFilterChange) {
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
  }, []); // Run once on mount

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
    <div className="relative z-20" ref={wrapperRef}>
      <div className="flex items-center gap-1 sm:gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex-wrap">
        <button
          onClick={() => handlePresetClick('today')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'today' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => handlePresetClick('yesterday')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'yesterday' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Ayer
        </button>
        <button
          onClick={() => handlePresetClick('week')}
          className={`hidden sm:block px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'week' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          7 Días
        </button>
        <button
          onClick={() => handlePresetClick('month')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'month' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Mes
        </button>
        
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        
        <button 
          onClick={() => setShowCustomRange(!showCustomRange)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'custom' || showCustomRange
            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' 
            : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          <Calendar size={14} />
          <span>{formatDateDisplay()}</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${showCustomRange ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Popover de Rango Personalizado */}
      {showCustomRange && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-200 z-50">
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-semibold text-slate-800 text-sm">Seleccionar Fecha</h4>
             <button onClick={() => setShowCustomRange(false)} className="text-slate-400 hover:text-slate-600">
               <X size={16} />
             </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
              <input 
                type="date" 
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                value={customRange.start}
                onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
              <input 
                type="date" 
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                value={customRange.end}
                onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
              />
            </div>
            
            <button 
              onClick={handleApplyRange}
              disabled={!customRange.start || !customRange.end}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Check size={16} />
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
