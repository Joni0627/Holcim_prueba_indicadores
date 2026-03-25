
import React, { useState, useMemo } from 'react';
import { PackageCheck, Timer, AlertTriangle, TrendingUp, TableProperties, CircleDashed, Loader2, Weight, BarChart2, Calendar, Activity, Clock, Share2, Download, Cpu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { fetchDowntimes, fetchProductionStats, fetchStocks, fetchBreakageStats } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats, BreakageStats } from '../../types';
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
    queryKey: ['stocks', 'today'],
    queryFn: () => {
      const today = new Date();
      return fetchStocks(today, today);
    },
    refetchInterval: 300000,
  });

  const { data: breakageResult, isLoading: loadingBreakage } = useQuery({
    queryKey: ['breakage', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchBreakageStats(dateRange.start, dateRange.end),
  });

  const isLoading = loadingDowntimes || loadingProd || loadingStocks || loadingBreakage;

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
  const downtimesByMachine = useMemo(() => {
    if (!downtimeResult) return [];
    
    const internalStops = downtimeResult.filter(d => d.downtimeType === 'Interno');
    
    const grouped = internalStops.reduce((acc: Record<string, any[]>, curr) => {
      const machine = curr.machineId || 'Desconocida';
      if (!acc[machine]) acc[machine] = [];
      acc[machine].push(curr);
      return acc;
    }, {});
    
    return Object.entries(grouped).map(([machineId, events]) => {
      const reasonMap = events.reduce((acc: Record<string, number>, curr) => {
        acc[curr.reason] = (acc[curr.reason] || 0) + curr.durationMinutes;
        return acc;
      }, {});
      
      const topReasons = Object.entries(reasonMap)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([reason, duration]) => ({ reason, duration: duration as number }));
        
      const totalDuration = topReasons.reduce((acc, r) => acc + r.duration, 0);
      const hac = events[0]?.hac || 'N/A';
      
      return {
        machineId,
        hac,
        totalDuration,
        reasons: topReasons
      };
    }).sort((a, b) => b.totalDuration - a.totalDuration);
  }, [downtimeResult]);

  const detailedMetrics = useMemo(() => prodResult?.details || [], [prodResult]);

  // Map of machine to HAC from downtime data
  const machineHacMap = useMemo(() => {
    const map: Record<string, string> = {};
    downtimesByMachine.forEach(m => {
      map[m.machineId] = m.hac;
    });
    return map;
  }, [downtimesByMachine]);

  const shiftData = useMemo(() => {
    if (!prodResult?.byShift) return [];
    return prodResult.byShift.map(s => {
        const shiftMetrics = detailedMetrics.filter(m => m.shift === s.name);
        const count = shiftMetrics.length;
        
        const totalHsMarcha = shiftMetrics.reduce((acc, m) => acc + (m.hsMarcha || 0), 0);
        
        const metrics = count > 0 ? {
            disp: shiftMetrics.reduce((acc, m) => acc + m.availability, 0) / count,
            rend: shiftMetrics.reduce((acc, m) => acc + m.performance, 0) / count,
        } : { disp: 0, rend: 0 };

        return {
            ...s,
            valueTn: s.valueTn || 0,
            hsMarcha: totalHsMarcha || 0,
            disp: Math.round((metrics.disp || 0) * 100),
            rend: Math.round((metrics.rend || 0) * 100),
            breakdown: shiftMetrics.map(m => ({
                machineName: m.machineName,
                valueTn: m.valueTn || 0,
                hsMarcha: m.hsMarcha || 0,
                disp: Math.round((m.availability || 0) * 100),
                rend: Math.round((m.performance || 0) * 100),
                hac: machineHacMap[m.machineName] || 'N/A'
            }))
        };
    });
  }, [prodResult, detailedMetrics, machineHacMap]);

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
    const order = ["CEMENTO CPF 40", "CEMENTO CPC 30", "CEMENTO MAESTRO", "CEMENTO RAPIDO"];
    return stockResult.items
      .filter(i => i.isProduced)
      .sort((a, b) => {
        const nameA = a.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const nameB = b.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const indexA = order.indexOf(nameA);
        const indexB = order.indexOf(nameB);
        
        if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
  }, [stockResult]);

  const totalStockTn = useMemo(() => {
    return producedStock.reduce((acc, item) => acc + item.tonnage, 0);
  }, [producedStock]);

  const totalDowntimeMinutes = useMemo(() => {
    if (!downtimeResult) return 0;
    return downtimeResult.reduce((acc, d) => acc + d.durationMinutes, 0);
  }, [downtimeResult]);

  const breakageRate = useMemo(() => breakageResult?.globalRate || 0, [breakageResult]);
  const totalBags = useMemo(() => prodResult?.totalBags || 0, [prodResult]);

  const handleShare = async () => {
    const element = document.getElementById('summary-view-content');
    if (!element || isSharing) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1400, // Ensure lg: grid classes are active
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('summary-view-content');
          if (el) {
            el.style.width = '1400px';
            el.style.padding = '20px';
            el.style.backgroundColor = '#ffffff';
            
            // Adjust heights of specific chart containers for the capture to be more compact
            const downtimeContainer = el.querySelector('[data-chart="downtime"]');
            if (downtimeContainer) {
                (downtimeContainer as HTMLElement).style.height = 'auto';
                (downtimeContainer as HTMLElement).style.minHeight = '350px';
                (downtimeContainer as HTMLElement).style.display = 'flex';
                (downtimeContainer as HTMLElement).style.flexDirection = 'column';
                (downtimeContainer as HTMLElement).style.padding = '12px';
                (downtimeContainer as HTMLElement).style.backgroundColor = '#ffffff';
                (downtimeContainer as HTMLElement).style.border = '1px solid #e2e8f0';
            }
            
            const shiftContainer = el.querySelector('[data-chart="shift"]');
            if (shiftContainer) {
                (shiftContainer as HTMLElement).style.height = 'auto';
                (shiftContainer as HTMLElement).style.minHeight = '350px';
                (shiftContainer as HTMLElement).style.display = 'flex';
                (shiftContainer as HTMLElement).style.flexDirection = 'column';
                (shiftContainer as HTMLElement).style.padding = '12px';
                (shiftContainer as HTMLElement).style.backgroundColor = '#ffffff';
                (shiftContainer as HTMLElement).style.border = '1px solid #e2e8f0';
                
                const table = shiftContainer.querySelector('table');
                if (table) {
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                }
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

  const handleDownloadPDF = async () => {
    const element = document.getElementById('summary-view-content');
    if (!element || isSharing) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        windowWidth: 1400,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reporte_Produccion_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF.');
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
    <div className="space-y-4 animate-in fade-in duration-500 pb-8 overflow-x-hidden">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-200 pb-2">
        <div className="flex flex-col gap-0">
            <div className="flex items-center gap-2">
                <Calendar className="text-slate-400" size={20} />
                <h1 className="text-lg md:text-xl font-bold text-slate-800">{formatDate(dateRange.start)}</h1>
            </div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight ml-7">Resumen de productividad Expedición Malagueño</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <button 
                onClick={handleShare}
                disabled={isSharing}
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-2 px-3 text-[10px] font-bold shadow-sm border ${isSharing ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100'}`}
                title="Compartir Imagen"
            >
                {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                <span className="hidden sm:inline">{isSharing ? 'Generando...' : 'Compartir Imagen'}</span>
            </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center w-full md:w-auto scale-90 origin-right">
          <DateFilter onFilterChange={handleFilterChange} />
        </div>
      </div>

      <div id="summary-view-content" className="space-y-3 bg-white p-2 md:p-4 rounded-xl border border-slate-200 shadow-lg">
        
        {isLoading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={40} />
              <p className="text-sm font-medium">Sincronizando con Planta...</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            
            {/* LEFT COLUMN (KPIs) - 3/12 */}
            <div className="lg:col-span-3 flex flex-col gap-4 lg:h-full">
                
                {/* Producción Total Card */}
                <div data-card="left" className="h-auto min-h-[100px] bg-gradient-to-br from-blue-600 to-blue-400 text-white p-4 rounded-lg shadow-md relative overflow-hidden group border border-blue-300/30 flex flex-col justify-center">
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <PackageCheck size={80} />
                    </div>
                    <p className="text-white font-bold uppercase tracking-wider text-[10px] mb-0.5">Producción Total</p>
                    <div className="flex items-baseline gap-1">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
                            {(prodResult?.totalTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h2>
                        <span className="text-xl font-bold text-blue-100">Tn</span>
                    </div>
                </div>

                {/* TN por PRODUCTO */}
                <div data-card="left" className="flex-grow bg-slate-50 text-slate-800 p-4 rounded-lg shadow-sm space-y-4 border border-slate-200 flex flex-col min-h-[400px]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1 border-b border-slate-200 pb-1">TN por PRODUCTO</h3>
                    <div className="space-y-4 flex-grow overflow-y-auto no-scrollbar py-2">
                        {productBreakdown.length > 0 ? productBreakdown.map((prod, idx) => (
                            <div key={prod.name} className="space-y-1.5">
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-tight">
                                    <span className="text-slate-600 truncate max-w-[140px]">{prod.name}</span>
                                    <span className="text-slate-900">{(prod.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Tn</span>
                                </div>
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                                        style={{ width: `${(prod.valueTn / maxProductValue) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )) : (
                            <p className="text-[10px] text-slate-400 italic">Sin datos</p>
                        )}
                    </div>
                </div>


            </div>

            {/* RIGHT COLUMN (Stock & Downtime) - 9/12 */}
            <div className="lg:col-span-9 flex flex-col gap-4 lg:h-full">
                
                {/* Stock Section */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-emerald-600 text-white px-4 py-1.5 flex justify-between items-center shadow-sm">
                        <h3 className="font-black uppercase tracking-widest text-[10px]">Stock a las 06:00 hs.</h3>
                        <Clock size={14} />
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                        {producedStock.length > 0 ? producedStock.map((item, idx) => (
                            <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center group hover:bg-emerald-50 transition-colors">
                                <p className="text-[9px] uppercase font-black text-slate-400 mb-0.5 tracking-widest group-hover:text-emerald-600 transition-colors truncate w-full" title={item.product}>{item.product.replace('CEMENTO ', '')}</p>
                                <p className="text-xl font-black tracking-tighter text-slate-800">
                                    {(item.tonnage || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-[10px] font-bold text-slate-400 ml-0.5">Tn</span>
                                </p>
                            </div>
                        )) : (
                            <div className="col-span-full py-4 text-center text-slate-400 italic text-xs">Sin datos de stock</div>
                        )}
                        
                        {producedStock.length > 0 && (
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex flex-col items-center justify-center text-center shadow-inner">
                                <p className="text-[8px] uppercase font-bold text-emerald-700 mb-0.5 leading-tight">TOTAL STOCK</p>
                                <p className="text-xl font-black tracking-tighter text-emerald-600">
                                    {totalStockTn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-[10px] font-bold text-emerald-700 ml-0.5">Tn</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                               {/* Downtime Table Section */}
                <div data-chart="downtime" className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group h-auto lg:flex-1">
                    <div className="flex items-center gap-2 bg-amber-600 px-4 py-2 relative z-10 shadow-sm">
                        <AlertTriangle className="text-white" size={16} />
                        <h3 className="font-bold text-white uppercase text-[10px] tracking-widest">Ranking de Paros Internos (Top 5)</h3>
                    </div>
                    <div className="p-4 flex-grow flex flex-col">
                        <div data-chart-wrapper className="flex-grow relative z-10 overflow-x-auto">
                        {downtimesByMachine.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Máquina</th>
                                        <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">HAC</th>
                                        <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-1/2">Motivos Principales</th>
                                        <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Total (min)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {downtimesByMachine.map((machine, idx) => (
                                        <tr key={machine.machineId} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2 px-2">
                                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{machine.machineId}</span>
                                            </td>
                                            <td className="py-2 px-2">
                                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{machine.hac}</span>
                                            </td>
                                            <td className="py-2 px-2">
                                                <div className="space-y-0.5">
                                                    {machine.reasons.slice(0, 2).map((r: any, rIdx: number) => (
                                                        <div key={rIdx} className="flex justify-between gap-4 text-[10px]">
                                                            <span className="text-slate-600 truncate max-w-[350px]">{r.reason}</span>
                                                            <span className="text-red-500 font-bold whitespace-nowrap">{r.duration}m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-right align-top">
                                                <span className="text-base font-black text-slate-900 tracking-tighter">{machine.totalDuration}</span>
                                                <span className="text-[9px] font-bold text-slate-400 ml-0.5 uppercase">min</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-xs py-6">Sin registros de paros internos</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Producción por Turno (Tabla) */}
            <div data-chart="shift" className="lg:col-span-6 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group">
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 relative z-10 shadow-sm">
                    <TableProperties className="text-white" size={18} />
                    <h3 className="font-bold text-white uppercase text-[10px] tracking-widest">Producción y Métricas por Turno</h3>
                </div>
                <div className="p-4 flex-grow flex flex-col">
                    <div data-chart-wrapper data-table="shift" className="flex-grow relative z-10 overflow-x-auto no-scrollbar min-w-0">
                    {shiftData.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Turno / Paletizadora</th>
                                    <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Producción (Tn)</th>
                                    <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">HS Marcha</th>
                                    <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Disp %</th>
                                    <th className="py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Rend %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {shiftData.map((shift, idx) => (
                                    <React.Fragment key={shift.name}>
                                        <tr className="bg-slate-50/50 transition-colors group/row">
                                            <td className="py-2 px-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{shift.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                <span className="text-base font-black text-slate-900 tracking-tighter">
                                                    {(shift.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 ml-0.5 uppercase">Tn</span>
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                <span className="text-base font-black text-emerald-600 tracking-tighter">
                                                    {(shift.hsMarcha || 0).toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                <span className="text-base font-black text-amber-600 tracking-tighter">{shift.disp}%</span>
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                <span className="text-base font-black text-indigo-600 tracking-tighter">{shift.rend}%</span>
                                            </td>
                                        </tr>
                                        {shift.breakdown.map((m: any, mIdx: number) => (
                                            <tr key={`${shift.name}-${m.machineName}`} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                                <td className="py-1.5 px-6">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{m.machineName}</span>
                                                </td>
                                                <td className="py-1.5 px-2 text-right">
                                                    <span className="text-xs font-bold text-slate-700 tracking-tight">{(m.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                                    <span className="text-[8px] font-medium text-slate-400 ml-0.5">Tn</span>
                                                </td>
                                                <td className="py-1.5 px-2 text-right">
                                                    <span className="text-xs font-bold text-emerald-600 tracking-tight">{(m.hsMarcha || 0).toFixed(1)}</span>
                                                </td>
                                                <td className="py-1.5 px-2 text-right">
                                                    <span className="text-xs font-bold text-amber-600 tracking-tight">{m.disp}%</span>
                                                </td>
                                                <td className="py-1.5 px-2 text-right">
                                                    <span className="text-xs font-bold text-indigo-600 tracking-tight">{m.rend}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-xs py-6">Sin datos de producción por turno</div>
                    )}
                </div>
                {/* Footer decorativo para la tabla */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center relative z-10">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Resumen Operativo</p>
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-200"></div>)}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-6 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group">
                <div className="flex items-center bg-blue-900 px-4 py-2 relative z-10 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Cpu className="text-white" size={16} />
                        <h3 className="font-bold text-white uppercase text-[10px] tracking-widest">Producción por Paletizadora</h3>
                    </div>
                </div>
                
                <div className="p-4 flex-grow flex flex-col">
                    {prodResult?.byMachine && prodResult.byMachine.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                    className="bg-slate-50 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                                >
                                    {/* Card Header */}
                                    <div className="px-3 py-1.5 border-b border-slate-100 flex justify-between items-center bg-slate-100/50">
                                        <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{m.name}</span>
                                        <Activity size={10} className="text-emerald-500" />
                                    </div>

                                    {/* Main Value Area */}
                                    <div className="p-3 flex-grow flex flex-col">
                                        <div className="bg-white rounded-xl p-3 mb-3 relative overflow-hidden border border-slate-100">
                                            <p className="text-slate-400 text-[7px] font-bold uppercase mb-0.5 tracking-widest">Producción Total</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-slate-900 tracking-tighter">
                                                    {(m.valueTn || 0).toFixed(0)}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tn</span>
                                            </div>
                                        </div>

                                        {/* KPIs Grid - Modernized */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="flex flex-col items-center">
                                                <div className="w-full h-1 bg-slate-200 rounded-full mb-1 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-slate-400" 
                                                        style={{ width: `${Math.min((avg.oee || 0) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[7px] font-bold text-slate-400 uppercase">OEE</p>
                                                <p className="text-xs font-black text-slate-800">{((avg.oee || 0) * 100).toFixed(0)}%</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="w-full h-1 bg-slate-200 rounded-full mb-1 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-emerald-500" 
                                                        style={{ width: `${Math.min((avg.disp || 0) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[7px] font-bold text-slate-400 uppercase">Disp</p>
                                                <p className="text-xs font-black text-emerald-600">{((avg.disp || 0) * 100).toFixed(0)}%</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="w-full h-1 bg-slate-200 rounded-full mb-1 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500" 
                                                        style={{ width: `${Math.min((avg.rend || 0) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[7px] font-bold text-slate-400 uppercase">Rend</p>
                                                <p className="text-xs font-black text-amber-600">{((avg.rend || 0) * 100).toFixed(0)}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-slate-400 py-8 italic text-xs">Sin datos de máquinas</div>
                )}
                </div>
                {/* Footer decorativo para la tabla */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center relative z-10">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Resumen Operativo</p>
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-200"></div>)}
                    </div>
                </div>
            </div>
        </div>
      )}
      </div>
    </div>
  </div>
  );
};
