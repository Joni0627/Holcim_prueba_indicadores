import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Check } from 'lucide-react';

export const DateFilter: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const handleApplyRange = () => {
    if (dateRange.start && dateRange.end) {
      setActiveFilter('custom');
      setShowCustomRange(false);
      console.log("Filtro aplicado:", dateRange);
    }
  };

  const formatDateDisplay = () => {
    if (activeFilter === 'custom' && dateRange.start && dateRange.end) {
      return `${new Date(dateRange.start).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})} - ${new Date(dateRange.end).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}`;
    }
    return 'Rango';
  };

  return (
    <div className="relative z-20" ref={wrapperRef}>
      <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
        <button
          onClick={() => { setActiveFilter('today'); setShowCustomRange(false); }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'today' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => { setActiveFilter('yesterday'); setShowCustomRange(false); }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'yesterday' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Ayer
        </button>
        <button
          onClick={() => { setActiveFilter('week'); setShowCustomRange(false); }}
          className={`hidden sm:block px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeFilter === 'week' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          7 Días
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
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-semibold text-slate-800 text-sm">Seleccionar Fechas</h4>
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
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
              <input 
                type="date" 
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                value={dateRange.end}
                min={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
            
            <button 
              onClick={handleApplyRange}
              disabled={!dateRange.start || !dateRange.end}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Check size={16} />
              Aplicar Filtro
            </button>
          </div>
        </div>
      )}
    </div>
  );
};