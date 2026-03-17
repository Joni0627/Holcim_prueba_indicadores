
import React, { useState, useMemo } from 'react';
import { PackageCheck, Timer, AlertTriangle, TrendingUp, TableProperties, CircleDashed, Loader2, Weight, BarChart2, Calendar, Activity, Clock, Share2, Download, Cpu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
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

const GaugeChart = ({ value, label, color = "#3b82f6" }: { value: number, label: string, color?: string }) => {
    const data = [
        { name: 'value', value: value * 100 },
        { name: 'remaining', value: 100 - (value * 100) }
    ];
    
    // Needle calculation for 180 degree gauge
    const angle = 180 - (value * 180);
    const rad = (angle * Math.PI) / 180;
    const length = 45;
    const x = 50 + length * Math.cos(rad);
    const y = 100 - length * Math.sin(rad);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative">
            <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell fill={color} opacity={0.2} />
                        <Cell fill="#f1f5f9" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            
            {/* Needle SVG Overlay */}
            <svg viewBox="0 0 100 100" className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <line 
                    x1="50" y1="100" 
                    x2={x} y2={y} 
                    stroke="#1e293b" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                />
                <circle cx="50" cy="100" r="3" fill="#1e293b" />
            </svg>

            <div className="mt-[-30px] text-center">
                <p className="text-xl font-black text-slate-800">{(value * 100).toFixed(0)}%</p>
                <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider font-mono">{label}</p>
            </div>
        </div>
    );
};

export const SummaryView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  const [isSharing, setIsSharing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const detailedMetrics = prodResult?.details || [];

  const shiftData = useMemo(() => {
    if (!prodResult?.byShift) return [];
    return prodResult.byShift.map(s => {
        const shiftMetrics = detailedMetrics.filter(m => m.shift === s.name);
        const count = shiftMetrics.length;
        const metrics = count > 0 ? {
            disp: shiftMetrics.reduce((acc, m) => acc + m.availability, 0) / count,
            rend: shiftMetrics.reduce((acc, m) => acc + m.performance, 0) / count,
            oee: shiftMetrics.reduce((acc, m) => acc + m.oee, 0) / count
        } : { disp: 0, rend: 0, oee: 0 };

        return {
            ...s,
            valueTn: s.valueTn,
            oee: Math.round(metrics.oee * 100),
            disp: Math.round(metrics.disp * 100),
            rend: Math.round(metrics.rend * 100)
        };
    });
  }, [prodResult, detailedMetrics]);

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

  const producedStock = useMemo(() => {
    if (!stockResult?.items) return [];
    const order = ["CEMENTO MAESTRO", "CEMENTO CPF 40", "CEMENTO RAPIDO", "CEMENTO CPC 30"];
    return stockResult.items
      .filter(i => i.isProduced)
      .sort((a, b) => {
        const nameA = a.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const nameB = b.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return order.indexOf(nameA) - order.indexOf(nameB);
      })
      .slice(0, 4);
  }, [stockResult]);

  const handleShare = async () => {
    const element = document.getElementById('summary-view-content');
    if (!element || isSharing) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        windowWidth: 1400, // Ensure lg: grid classes are active
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('summary-view-content');
          if (el) {
            el.style.width = '1400px';
            el.style.padding = '32px';
            el.style.backgroundColor = '#0f172a';
            
            // Adjust heights of specific chart containers for the capture to be more compact
            const downtimeContainer = el.querySelector('[data-chart="downtime"]');
            if (downtimeContainer) {
                (downtimeContainer as HTMLElement).style.height = '420px';
                (downtimeContainer as HTMLElement).style.minHeight = '420px';
                (downtimeContainer as HTMLElement).style.display = 'flex';
                (downtimeContainer as HTMLElement).style.flexDirection = 'column';
                (downtimeContainer as HTMLElement).style.padding = '10px';
                (downtimeContainer as HTMLElement).style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
                (downtimeContainer as HTMLElement).style.border = '1px solid rgba(51, 65, 85, 0.5)';
            }
            
            const shiftContainer = el.querySelector('[data-chart="shift"]');
            if (shiftContainer) {
                (shiftContainer as HTMLElement).style.height = '420px';
                (shiftContainer as HTMLElement).style.minHeight = '420px';
                (shiftContainer as HTMLElement).style.display = 'flex';
                (shiftContainer as HTMLElement).style.flexDirection = 'column';
                (shiftContainer as HTMLElement).style.padding = '10px';
                (shiftContainer as HTMLElement).style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
                (shiftContainer as HTMLElement).style.border = '1px solid rgba(51, 65, 85, 0.5)';
            }

            // Compact the left column cards
            const leftCards = el.querySelectorAll('[data-card="left"]');
            leftCards.forEach((c: any) => {
                c.style.height = 'auto';
                c.style.minHeight = '70px';
                c.style.padding = '12px';
                c.style.flex = '0 0 auto';
                c.style.marginBottom = '10px';
                
                // Adjust font sizes inside left cards to prevent overflow
                const mainTitle = c.querySelector('h2');
                if (mainTitle) {
                    mainTitle.style.fontSize = '48px'; // Reduced from 6xl (60px)
                    mainTitle.style.lineHeight = '1';
                }
                const subValue = c.querySelector('span');
                if (subValue && subValue.innerText === 'Tn') {
                    subValue.style.fontSize = '20px'; // Reduced from 3xl
                }
            });

            // Target the inner wrappers to force them to take all space
            const wrappers = el.querySelectorAll('[data-chart-wrapper]');
            wrappers.forEach((w: any) => {
                w.style.flex = '1';
                w.style.height = '100%';
                w.style.minHeight = '320px';
            });

            // Force the actual Recharts SVG and wrapper to be large but without distortion
            const rechartsWrappers = el.querySelectorAll('.recharts-wrapper');
            rechartsWrappers.forEach((rw: any) => {
                rw.style.height = '420px';
                rw.style.width = '100%';
                rw.style.display = 'block';
            });

            const rechartsSurfaces = el.querySelectorAll('.recharts-surface');
            rechartsSurfaces.forEach((rs: any) => {
                rs.style.height = '420px';
                rs.style.width = '100%';
            });

            // Ensure recharts containers grow and fill
            const containers = el.querySelectorAll('.recharts-responsive-container');
            containers.forEach((c: any) => {
                c.style.height = '420px';
                c.style.minHeight = '420px';
                c.style.width = '100%';
                c.style.display = 'block';
            });

            // Trigger a resize event in the cloned window to help Recharts re-render
            if (clonedDoc.defaultView) {
                clonedDoc.defaultView.dispatchEvent(new Event('resize'));
            }

            // Special fix for labels: sometimes they are hidden if the container is too small
            // We ensure the chart wrapper has enough top padding
            const chartWrappers = el.querySelectorAll('[data-chart-wrapper]');
            chartWrappers.forEach((cw: any) => {
                cw.style.paddingTop = '40px';
                cw.style.marginTop = '0px';
            });
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 0.9);
      const response = await fetch(imgData);
      const blob = await response.blob();
      
      const fileName = `Reporte_Produccion_${new Date().toISOString().split('T')[0]}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Standard sharing logic
      if (navigator.share) {
        try {
          // Check if file sharing is supported
          const data: ShareData = {
            title: 'Reporte de Producción',
            text: `Reporte de producción ${formatDate(dateRange.start)}`,
          };

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            data.files = [file];
          }

          await navigator.share(data);
        } catch (shareError) {
          // Only download if it wasn't a user cancellation
          if ((shareError as any).name !== 'AbortError') {
            downloadFile(blob, fileName);
          }
        }
      } else {
        downloadFile(blob, fileName);
      }
    } catch (error) {
      console.error('Error sharing Image:', error);
      alert('Hubo un error al generar la imagen. Por favor intente de nuevo.');
    } finally {
      setIsSharing(false);
    }
  };

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    <div className="space-y-6 w-full overflow-x-hidden px-0">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4 px-2">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
                <Calendar className="text-slate-400" size={24} />
                <h1 className="text-2xl font-bold text-slate-800">{formatDate(dateRange.start)}</h1>
            </div>
            <button 
                onClick={handleShare}
                disabled={isSharing}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 px-3 text-xs font-bold shadow-sm border ${isSharing ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100'}`}
                title="Compartir Imagen"
            >
                {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                <span className="hidden sm:inline">{isSharing ? 'Generando...' : 'Compartir Imagen'}</span>
            </button>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      <div id="summary-view-content" className="space-y-6 w-full overflow-x-hidden px-2">
        {isLoading ? (
           <div className="h-96 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={48} />
              <p className="text-lg font-medium">Sincronizando con Planta...</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN (KPIs) - 3/12 */}
            <div className="lg:col-span-3 flex flex-col gap-6 h-full">
                
                {/* Producción Total Card */}
                <div data-card="left" className="flex-1 bg-gradient-to-br from-slate-950 to-blue-900 text-white p-6 rounded-lg shadow-xl relative overflow-hidden group border border-slate-800 flex flex-col justify-center">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <PackageCheck size={120} />
                    </div>
                    <p className="text-blue-300 font-bold uppercase tracking-wider text-sm mb-1">Producción Total</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-6xl font-black tracking-tighter">
                            {(prodResult?.totalTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h2>
                        <span className="text-3xl font-bold text-blue-400">Tn</span>
                    </div>
                </div>

                {/* TN por PRODUCTO */}
                <div data-card="left" className="flex-1 bg-gradient-to-br from-blue-900 to-blue-700 text-white p-6 rounded-lg shadow-lg space-y-4 border border-blue-800/50 flex flex-col justify-center">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-blue-300 mb-2 border-b border-blue-800/30 pb-2">TN por PRODUCTO</h3>
                    <div className="space-y-4">
                        {productBreakdown.length > 0 ? productBreakdown.map((prod, idx) => (
                            <div key={prod.name} className="space-y-1">
                                <div className="flex justify-between text-[12px] font-bold uppercase tracking-tight">
                                    <span className="text-blue-100">{prod.name}</span>
                                    <span className="text-white">{prod.valueTn.toLocaleString(undefined, { maximumFractionDigits: 0 })} Tn</span>
                                </div>
                                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" 
                                        style={{ width: `${(prod.valueTn / maxProductValue) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )) : (
                            <p className="text-xs text-blue-300 italic">Sin datos de productos</p>
                        )}
                    </div>
                </div>

                {/* RENDIMIENTO GLOBAL */}
                <div data-card="left" className="flex-1 bg-gradient-to-br from-blue-700 to-blue-500 p-5 rounded-lg shadow-lg border border-blue-400/30 space-y-4 text-white flex flex-col justify-center">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100/60 mb-1 border-b border-blue-500/30 pb-2">RENDIMIENTO GLOBAL</h3>
                    <div className="space-y-3">
                        <div className="bg-white/10 backdrop-blur-sm p-3 rounded-md border border-white/10">
                            <p className="text-[10px] font-bold uppercase text-blue-200 tracking-wider">OEE Total</p>
                            <p className="text-3xl font-black text-white">
                                {(detailedMetrics.reduce((acc, m) => acc + m.oee, 0) / (detailedMetrics.length || 1) * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-md border border-white/10">
                                <p className="text-[10px] font-bold uppercase text-emerald-300 tracking-wider">Disp %</p>
                                <p className="text-2xl font-black text-white">
                                    {(detailedMetrics.reduce((acc, m) => acc + m.availability, 0) / (detailedMetrics.length || 1) * 100).toFixed(0)}%
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-md border border-white/10">
                                <p className="text-[10px] font-bold uppercase text-amber-300 tracking-wider">Rend %</p>
                                <p className="text-2xl font-black text-white">
                                    {(detailedMetrics.reduce((acc, m) => acc + m.performance, 0) / (detailedMetrics.length || 1) * 100).toFixed(0)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN (Stock & Downtime) - 9/12 */}
            <div className="lg:col-span-9 flex flex-col gap-6 h-full">
                
                {/* Stock Section */}
                <div className="bg-gradient-to-br from-slate-950 to-blue-900 rounded-lg shadow-xl border border-slate-800 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-2 flex justify-between items-center shadow-lg">
                        <h3 className="font-black uppercase tracking-widest text-sm">Stock a las 06:00 hs.</h3>
                        <Clock size={16} />
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {producedStock.length > 0 ? producedStock.map(item => (
                            <div key={item.id} className="border-r border-slate-700 last:border-0">
                                <p className="text-[9px] uppercase font-bold text-slate-400 mb-1 leading-tight truncate" title={item.product}>{item.product}</p>
                                <p className="text-2xl font-black tracking-tighter text-white">
                                    {item.tonnage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-xs font-bold text-emerald-500 ml-1">Tn</span>
                                </p>
                            </div>
                        )) : (
                            <div className="col-span-4 py-2 text-slate-500 text-xs italic">Datos de stock no disponibles</div>
                        )}
                    </div>
                </div>

                {/* Downtime Horizontal Chart */}
                <div data-chart="downtime" className="flex-1 bg-gradient-to-br from-slate-950 to-blue-900 p-6 rounded-lg shadow-xl border border-slate-800 flex flex-col relative overflow-hidden group min-h-[400px]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-400/10 transition-colors"></div>
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-800/50 pb-3 relative z-10">
                        <AlertTriangle className="text-red-500" size={18} />
                        <h3 className="font-bold text-slate-200 uppercase text-xs tracking-widest">Análisis de Paradas Principales</h3>
                    </div>
                    <div data-chart-wrapper className="flex-grow relative z-10">
                        {downtimes.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                <BarChart
                                    data={downtimes}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="reason"
                                        stroke="#94a3b8"
                                        fontSize={isMobile ? 10 : 16}
                                        width={isMobile ? 80 : 200}
                                        tick={{ fill: '#e2e8f0', fontWeight: 900 }}
                                        tickFormatter={(val) => {
                                            const maxLen = isMobile ? 15 : 40;
                                            return val.length > maxLen ? `${val.substring(0, maxLen)}...` : val;
                                        }}
                                    />
                                    <Tooltip 
                                        content={<CustomTooltip />} 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                                    />
                                    <Bar dataKey="durationMinutes" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={70}>
                                        {downtimes.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f87171'} fillOpacity={1 - (index * 0.08)} />
                                        ))}
                                        <LabelList 
                                            dataKey="durationMinutes" 
                                            position="right" 
                                            formatter={(val: number) => `${val} min`}
                                            style={{ fill: '#cbd5e1', fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">Sin registros de paros</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Producción por Turno (Tabla) */}
            <div data-chart="shift" className="lg:col-span-7 bg-gradient-to-br from-slate-950 to-blue-900 p-6 rounded-lg shadow-xl border border-slate-800 min-h-[400px] flex flex-col h-full relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 pointer-events-none"></div>
                <div className="flex items-center gap-2 mb-6 relative z-10 border-b border-slate-800/50 pb-3">
                    <TableProperties className="text-emerald-500" size={20} />
                    <h3 className="font-bold text-slate-200 uppercase text-sm tracking-widest">Producción y Métricas por Turno</h3>
                </div>
                <div data-chart-wrapper className="flex-grow relative z-10 overflow-x-auto no-scrollbar">
                    {shiftData.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Turno</th>
                                    <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-blue-400 text-right">Producción (Tn)</th>
                                    <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 text-right">OEE %</th>
                                    <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-amber-500 text-right">Disp %</th>
                                    <th className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 text-right">Rend %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {shiftData.map((shift, idx) => (
                                    <tr key={shift.name} className="hover:bg-white/5 transition-colors group/row">
                                        <td className="py-4 px-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SHIFT_COLORS[idx % SHIFT_COLORS.length] }}></div>
                                                <span className="text-sm font-black text-white uppercase tracking-tight">{shift.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <span className="text-lg font-black text-white tracking-tighter">
                                                {shift.valueTn.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 ml-1 uppercase">Tn</span>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <div className="inline-flex flex-col items-end">
                                                <span className="text-sm font-black text-emerald-400">{shift.oee}%</span>
                                                <div className="w-12 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${shift.oee}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <span className="text-sm font-bold text-amber-400">{shift.disp}%</span>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <span className="text-sm font-bold text-indigo-300">{shift.rend}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 italic">Sin datos de turnos</div>
                    )}
                </div>
                
                {/* Footer decorativo para la tabla */}
                <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center relative z-10">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Resumen Operativo</p>
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-700"></div>)}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 to-blue-900 p-6 rounded-lg shadow-xl border border-slate-800 min-h-[480px] flex flex-col h-full">
                <div className="flex items-center mb-6 border-b border-slate-800/50 pb-3">
                    <div className="flex items-center gap-2">
                        <Cpu className="text-blue-400" size={20} />
                        <h3 className="font-bold text-slate-200 uppercase text-sm tracking-widest">Producción por Paletizadora</h3>
                    </div>
                </div>
                
                {prodResult?.byMachine && prodResult.byMachine.length > 0 ? (
                    <div className={`grid gap-6 flex-grow items-start ${prodResult.byMachine.length === 1 ? 'grid-cols-1 max-w-md mx-auto w-full' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {prodResult.byMachine.map((m, i) => {
                            const machineMetrics = detailedMetrics.filter(met => met.machineName === m.name);
                            const avg = machineMetrics.length > 0 ? {
                                oee: machineMetrics.reduce((acc, curr) => acc + curr.oee, 0) / machineMetrics.length,
                                rend: machineMetrics.reduce((acc, curr) => acc + curr.performance, 0) / machineMetrics.length,
                                disp: machineMetrics.reduce((acc, curr) => acc + curr.availability, 0) / machineMetrics.length
                            } : { oee: 0, rend: 0, disp: 0 };

                            return (
                                <div 
                                    key={m.name} 
                                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-lg hover:shadow-blue-900/40 transition-all group flex flex-col overflow-hidden"
                                >
                                    {/* Card Header */}
                                    <div className="px-5 py-3 border-b border-slate-700 flex justify-between items-center bg-black/20">
                                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{m.name}</span>
                                        <Activity size={12} className="text-emerald-500" />
                                    </div>

                                    {/* Main Value Area */}
                                    <div className="p-5 flex-grow flex flex-col">
                                        <div className="bg-slate-950 rounded-2xl p-5 mb-5 relative overflow-hidden shadow-2xl group-hover:bg-blue-950 transition-colors duration-500 border border-slate-800">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-blue-400/10 transition-colors"></div>
                                            <p className="text-slate-500 text-[9px] font-bold uppercase mb-1 tracking-widest">Producción Total</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-5xl font-black text-white tracking-tighter">
                                                    {m.valueTn.toFixed(0)}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tn</span>
                                            </div>
                                        </div>

                                        {/* KPIs Grid - Modernized */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className="w-full h-1.5 bg-slate-900 rounded-full mb-2 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500 rounded-full" 
                                                        style={{ width: `${Math.min(avg.oee * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase">OEE</p>
                                                <p className="text-sm font-black text-blue-400">{(avg.oee * 100).toFixed(0)}%</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="w-full h-1.5 bg-slate-900 rounded-full mb-2 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-emerald-500 rounded-full" 
                                                        style={{ width: `${Math.min(avg.disp * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase">Disp</p>
                                                <p className="text-sm font-black text-emerald-600">{(avg.disp * 100).toFixed(0)}%</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="w-full h-1.5 bg-slate-900 rounded-full mb-2 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500 rounded-full" 
                                                        style={{ width: `${Math.min(avg.rend * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase">Rend</p>
                                                <p className="text-sm font-black text-amber-400">{(avg.rend * 100).toFixed(0)}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-slate-400">Sin datos de máquinas</div>
                )}
            </div>

        </div>
      )}
      </div>

    </div>
  );
};
