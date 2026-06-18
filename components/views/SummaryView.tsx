
import React, { useState, useMemo, useRef } from 'react';
import { PackageCheck, Timer, AlertTriangle, TrendingUp, TableProperties, CircleDashed, Loader2, Weight, BarChart2, Calendar, Activity, Clock, Share2, Download, Cpu, Layout, X, ClipboardCheck, Info, FileText, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { fetchDowntimes, fetchProductionStats, fetchStocks, fetchBreakageStats } from '@/services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats, BreakageStats } from '@/types';
import { DateFilter } from '@/components/DateFilter';

// Helper for hh:mm format
const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const toLocalISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const sheetDateToISO = (sheetDate: string) => {
    if (!sheetDate) return '';
    const cleanStr = String(sheetDate).split(/[ T]/)[0].trim();
    if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            let year = parts[0];
            let month = parts[1];
            let day = parts[2];
            if (year.length !== 4 && day.length === 4) {
                const tmp = year;
                year = day;
                day = tmp;
            }
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return cleanStr;
    }
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
        let year = parts[2];
        let month = parts[1];
        let day = parts[0];
        if (year.length !== 4 && day.length === 4) {
            const tmp = year;
            year = day;
            day = tmp;
        }
        if (year.length === 2) year = `20${year}`;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return cleanStr;
};

const isMachineMatch = (id1: string | null | undefined, id2: string | null | undefined): boolean => {
  if (!id1 || !id2) return false;
  const s1 = String(id1).replace(/\s/g, '').toUpperCase();
  const s2 = String(id2).replace(/\s/g, '').toUpperCase();
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  const a1 = s1.replace(/[^A-Z0-9]/g, '');
  const a2 = s2.replace(/[^A-Z0-9]/g, '');
  if (!a1 || !a2) return false;
  return a1.includes(a2) || a2.includes(a1);
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

export const SummaryView: React.FC<{ 
  dateRange: { start: Date, end: Date }, 
  setDateRange: (range: { start: Date, end: Date }) => void 
}> = ({ dateRange, setDateRange }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [customObservation, setCustomObservation] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

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
    queryFn: async () => fetchProductionStats(dateRange.start, dateRange.end),
  });

  const { data: stockResult, isLoading: loadingStocks } = useQuery({
    queryKey: ['stocks', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchStocks(dateRange.start, dateRange.end),
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
  const startStr = toLocalISO(dateRange.start);
  const endStr = toLocalISO(dateRange.end);
  const isSingleDay = startStr === endStr;

  const unifiedDetails = useMemo(() => {
    if (!prodResult?.details) return [];

    let filteredDetails = prodResult.details.map(d => ({
      ...d,
      dateISO: sheetDateToISO(d.date || '')
    }));

    if (isSingleDay) {
      return filteredDetails.filter(d => d.dateISO === startStr);
    } else {
      return filteredDetails.filter(d => d.dateISO >= startStr && d.dateISO <= endStr);
    }
  }, [prodResult, startStr, endStr, isSingleDay]);

  const totalTn = useMemo(() => {
    return unifiedDetails.reduce((acc, d) => acc + (d.valueTn || 0), 0);
  }, [unifiedDetails]);

  const byMachine = useMemo(() => {
    // 3 standard palletizers pre-initialized so they are always listed on Home
    const stats: Record<string, { bags: number, tn: number, availSum: number, perfSum: number, hsMarchaTotal: number, count: number, machineId: string, machineName: string }> = {
      'MG.672-PZ1': { bags: 0, tn: 0, availSum: 0, perfSum: 0, hsMarchaTotal: 0, count: 0, machineId: 'MG.672-PZ1', machineName: 'Paletizadora 672' },
      'MG.673-PZ1': { bags: 0, tn: 0, availSum: 0, perfSum: 0, hsMarchaTotal: 0, count: 0, machineId: 'MG.673-PZ1', machineName: 'Paletizadora 673' },
      'MG.674-PZ1': { bags: 0, tn: 0, availSum: 0, perfSum: 0, hsMarchaTotal: 0, count: 0, machineId: 'MG.674-PZ1', machineName: 'Paletizadora 674' }
    };

    unifiedDetails.forEach(d => {
      // Find a matched base machine from pre-initialized keys, or add a new one on-the-fly
      let key = Object.keys(stats).find(k => isMachineMatch(d.machineId, k) || isMachineMatch(d.machineName, k));
      if (!key) {
        stats[d.machineId] = { bags: 0, tn: 0, availSum: 0, perfSum: 0, hsMarchaTotal: 0, count: 0, machineId: d.machineId, machineName: d.machineName };
        key = d.machineId;
      }
      
      stats[key].tn += (d.valueTn || 0);
      stats[key].bags += (d.valueBags || 0);
      
      const hs = d.hsMarcha || 0;
      stats[key].availSum += (d.availability || 0) * hs;
      stats[key].perfSum += (d.performance || 0) * hs;
      stats[key].hsMarchaTotal += hs;
      stats[key].count += 1;
    });

    return Object.entries(stats).map(([id, s]) => {
      // Default to 100% (1.0) availability & performance if no dynamic run hours are reported
      const avgAvail = s.hsMarchaTotal > 0 ? s.availSum / s.hsMarchaTotal : 1.0;
      const avgPerf = s.hsMarchaTotal > 0 ? s.perfSum / s.hsMarchaTotal : 1.0;
      return {
        name: s.machineName,
        machineId: id,
        valueTn: s.tn,
        value: s.bags,
        availability: avgAvail * 100,
        performance: avgPerf * 100,
        oee: (avgAvail * avgPerf) * 100,
        hsMarcha: s.hsMarchaTotal
      };
    });
  }, [unifiedDetails]);

  const topDowntimesByMachine = useMemo(() => {
    if (!downtimeResult) return {};
    
    const internalStops = downtimeResult.filter(d => d.downtimeType === 'Interno');
    
    const grouped: Record<string, any[]> = {};
    
    internalStops.forEach(curr => {
      if (!grouped[curr.machineId]) grouped[curr.machineId] = [];
      // Group by both reason AND hac to be precise as requested
      const existing = grouped[curr.machineId].find(r => r.reason === curr.reason && r.hac === curr.hac);
      if (existing) {
        existing.duration += curr.durationMinutes;
      } else {
        grouped[curr.machineId].push({
          machineId: curr.machineId,
          hac: curr.hac || 'N/A',
          reason: curr.reason,
          duration: curr.durationMinutes
        });
      }
    });
    
    // Sort each machine's reasons and take top 5
    const result: Record<string, any[]> = {};
    Object.keys(grouped).forEach(mId => {
      result[mId] = grouped[mId]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);
    });
    
    return result;
  }, [downtimeResult]);

  const detailedMetrics = useMemo(() => prodResult?.details || [], [prodResult]);

  // Map of machine to HAC from downtime data
  const machineHacMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (downtimeResult) {
      downtimeResult.forEach(d => {
        if (d.machineId && d.hac) {
          map[d.machineId] = d.hac;
        }
      });
    }
    return map;
  }, [downtimeResult]);

  const getTnColor = (machineId: string, tn: number) => {
    if (tn === 0) return 'text-slate-400';
    const mId = machineId.toUpperCase();
    if (mId.includes('672')) {
      if (tn < 387) return 'text-red-500';
      if (tn < 430) return 'text-amber-500';
      return 'text-emerald-500';
    }
    if (mId.includes('673') || mId.includes('674')) {
      if (tn < 443) return 'text-red-500';
      if (tn < 492) return 'text-amber-500';
      return 'text-emerald-500';
    }
    return 'text-white';
  };

  const getPerformanceColor = (val: number) => {
    const p = val;
    if (p < 92) return 'text-red-500';
    if (p < 95) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getAvailabilityColor = (val: number) => {
    const a = val;
    if (a < 76) return 'text-red-500';
    if (a < 81) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const shiftData = useMemo(() => {
    if (unifiedDetails.length === 0) return [];

    const shifts = [
      { id: '1.MAÑANA', label: 'MAÑANA' },
      { id: '2.TARDE', label: 'TARDE' },
      { id: '3.NOCHE', label: 'NOCHE' },
      { id: '4.NOCHE FIN', label: 'NOCHE FIN' }
    ];

    return shifts.map(s => {
      const sMetrics = unifiedDetails.filter(d => {
        const shiftUpper = d.shift.toUpperCase();
        if (s.id === '3.NOCHE') {
          return shiftUpper.includes('NOCHE') && !shiftUpper.includes('FIN');
        }
        return shiftUpper.includes(s.label);
      });
      const totalTn = sMetrics.reduce((acc, m) => acc + (m.valueTn || 0), 0);
      const totalHsMarcha = sMetrics.reduce((acc, m) => acc + (m.hsMarcha || 0), 0);
      const count = sMetrics.length;
      const avgDisp = count > 0 ? sMetrics.reduce((acc, m) => acc + m.availability, 0) / count : 0;
      const avgRend = count > 0 ? sMetrics.reduce((acc, m) => acc + m.performance, 0) / count : 0;

      return {
        name: s.id,
        valueTn: totalTn,
        hsMarcha: totalHsMarcha,
        disp: Math.round(avgDisp * 100),
        rend: Math.round(avgRend * 100),
        breakdown: sMetrics.map(m => ({
          machineName: m.machineName,
          valueTn: m.valueTn || 0,
          hsMarcha: m.hsMarcha || 0,
          disp: Math.round((m.availability || 0) * 100),
          rend: Math.round((m.performance || 0) * 100),
          hac: machineHacMap[m.machineName] || 'N/A'
        }))
      };
    }).filter(s => s.valueTn > 0 || s.breakdown.length > 0);
  }, [unifiedDetails, machineHacMap]);

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

  const allProductsBreakdown = useMemo(() => {
    if (!prodResult?.byMachineProduct) return [];
    return prodResult.byMachineProduct.reduce((acc: any[], curr) => {
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
    }, []).sort((a, b) => b.value - a.value).map(p => ({
      name: p.name,
      valueTn: p.value
    }));
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
    const element = document.getElementById('summary-view-container');
    if (!element || isSharing) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#0a0f1e',
        windowWidth: 1400, // Ensure lg: grid classes are active
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('summary-view-container');
          if (el) {
            el.style.width = '1400px';
            el.style.padding = '20px';
            el.style.backgroundColor = '#0a0f1e';
            el.style.height = 'auto';
            el.style.overflow = 'visible';
            
            // Adjust heights of specific chart containers for the capture to be more compact
            const downtimeContainer = el.querySelector('[data-chart="downtime"]');
            if (downtimeContainer) {
                (downtimeContainer as HTMLElement).style.height = 'auto';
                (downtimeContainer as HTMLElement).style.minHeight = '300px';
                (downtimeContainer as HTMLElement).style.display = 'flex';
                (downtimeContainer as HTMLElement).style.flexDirection = 'column';
                (downtimeContainer as HTMLElement).style.padding = '10px';
                (downtimeContainer as HTMLElement).style.backgroundColor = '#0a0f1e';
                (downtimeContainer as HTMLElement).style.border = '1px solid rgba(255,255,255,0.1)';
            }
            
            const shiftContainer = el.querySelector('[data-chart="shift"]');
            if (shiftContainer) {
                (shiftContainer as HTMLElement).style.height = 'auto';
                (shiftContainer as HTMLElement).style.minHeight = '300px';
                (shiftContainer as HTMLElement).style.display = 'flex';
                (shiftContainer as HTMLElement).style.flexDirection = 'column';
                (shiftContainer as HTMLElement).style.padding = '10px';
                (shiftContainer as HTMLElement).style.backgroundColor = '#0a0f1e';
                (shiftContainer as HTMLElement).style.border = '1px solid rgba(255,255,255,0.1)';
                
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
                c.style.minHeight = '60px';
                c.style.padding = '10px';
                c.style.flex = '0 0 auto';
                c.style.marginBottom = '8px';
                
                // Adjust font sizes inside left cards to prevent overflow
                const mainTitle = c.querySelector('h2');
                if (mainTitle) {
                    mainTitle.style.fontSize = '42px'; 
                    mainTitle.style.lineHeight = '1';
                }
                const subValue = c.querySelector('span');
                if (subValue && subValue.innerText === 'Tn') {
                    subValue.style.fontSize = '18px';
                }
            });

            // Ensure grid layout is preserved but compact
            const grid = el.querySelector('.grid');
            if (grid) {
                (grid as HTMLElement).style.gap = '12px';
            }
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const response = await fetch(imgData);
      const blob = await response.blob();
      
      // Try to copy to clipboard first (Desktop focus)
      let copied = false;
      try {
        if (navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({
              'image/png': blob
            })
          ]);
          copied = true;
          // Only alert on desktop if sharing is not available
          if (!navigator.share) {
            alert('¡Reporte copiado al portapapeles! Ya puedes pegarlo (Ctrl+V) en WhatsApp o Correo.');
          }
        }
      } catch (clipError) {
        console.error('Error copying to clipboard:', clipError);
      }

      const fileName = `Reporte_Produccion_${new Date().toISOString().split('T')[0]}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Standard sharing logic (Mobile focus)
      if (navigator.share) {
        try {
          const data: ShareData = {
            title: 'Reporte de Producción',
            text: `Reporte de producción ${formatDate(dateRange.start)}`,
            files: [file]
          };

          await navigator.share(data);
        } catch (shareError) {
          if ((shareError as any).name !== 'AbortError' && !copied) {
            downloadFile(blob, fileName);
          }
        }
      } else if (!copied) {
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
    const element = document.getElementById('summary-view-container');
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
    <div id="summary-view-container" className="space-y-6 animate-in fade-in duration-500 pb-8 overflow-x-hidden min-h-screen bg-[#0a0f1e] p-4 md:p-6 text-slate-200">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4 relative z-30">
        <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                    <Layout size={24} className="text-white" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-white">EXPEDICION MALAGUEÑO</h1>
                    <p className="text-[10px] font-black text-blue-400/80 mt-1 uppercase tracking-widest">
                        {dateRange.start.toDateString() === dateRange.end.toDateString() 
                            ? formatDate(dateRange.start) 
                            : `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`}
                    </p>
                </div>
            </div>
            
            <button 
                onClick={() => setShowShareModal(true)}
                data-html2canvas-ignore="true"
                className="p-2 rounded-xl transition-all flex items-center gap-2 px-5 text-[11px] font-black shadow-lg border bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30 hover:scale-105 active:scale-95 cursor-pointer"
                title="Compartir Reporte Corporativo"
            >
                <Share2 size={16} />
                <span>COMPARTIR</span>
            </button>
        </div>
        <div data-html2canvas-ignore="true" className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          <DateFilter onFilterChange={handleFilterChange} />
        </div>
      </div>

      <div className="space-y-6 bg-[#0a0f1e]">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mb-2" size={40} />
            <p className="text-sm font-medium">Sincronizando con Planta...</p>
          </div>
        ) : (
          <div className="space-y-6">
                {/* ROW 1: KPI & STOCK */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Producción Total - 4/12 */}
                    <div className="lg:col-span-4">
                        <div data-card="left" className="h-full min-h-[140px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group border border-white/20 flex flex-col justify-center">
                            <div className="absolute -right-6 -bottom-6 opacity-20 group-hover:scale-110 transition-transform duration-700 blur-sm">
                                <PackageCheck size={140} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-blue-100 font-black uppercase tracking-[0.2em] text-[10px] mb-2 opacity-80">Producción Total</p>
                                <div className="flex items-baseline gap-3">
                                    <h2 className="text-6xl md:text-7xl font-black tracking-tighter drop-shadow-2xl">
                                        {totalTn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </h2>
                                    <span className="text-3xl font-bold text-blue-200/60">Tn</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stock Section - 8/12 */}
                    <div className="lg:col-span-8">
                        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden h-full">
                            <div className="bg-emerald-600/80 text-white px-5 py-2.5 flex justify-between items-center border-b border-white/5">
                                <h3 className="font-black uppercase tracking-[0.2em] text-[11px]">Stock a las 06:00 hs.</h3>
                                <Clock size={18} />
                            </div>
                            <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
                                {producedStock.length > 0 ? producedStock.map((item, idx) => (
                                    <div key={item.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center group hover:bg-emerald-500/10 transition-all hover:scale-[1.02]">
                                        <p className="text-[8px] uppercase font-black text-slate-400 mb-1 tracking-widest group-hover:text-emerald-400 transition-colors truncate w-full" title={item.product}>{item.product.replace('CEMENTO ', '')}</p>
                                        <p className="text-4xl font-black tracking-tighter text-white">
                                            {(item.tonnage || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            <span className="text-xs font-bold text-slate-500 ml-1">Tn</span>
                                        </p>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-10 text-center text-slate-500 italic text-sm">Sin datos de stock</div>
                                )}
                                
                                {producedStock.length > 0 && (
                                    <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center text-center shadow-inner">
                                        <p className="text-[9px] uppercase font-black text-emerald-400 mb-1 tracking-widest">TOTAL STOCK</p>
                                        <p className="text-4xl font-black tracking-tighter text-emerald-400">
                                            {totalStockTn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            <span className="text-xs font-bold text-emerald-500/60 ml-1">Tn</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROW 2: PRODUCTS & PALLETIZERS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* TN por PRODUCTO */}
                    <div className="lg:col-span-4">
                        <div data-card="left" className="bg-white/[0.03] backdrop-blur-sm text-white rounded-2xl shadow-xl border border-white/10 flex flex-col overflow-hidden h-full min-h-[300px]">
                            <div className="bg-white/5 px-5 py-3 flex items-center gap-3 border-b border-white/5">
                                <TrendingUp className="text-blue-400" size={18} />
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-100">TN por PRODUCTO</h3>
                            </div>
                            <div className="p-5 space-y-4 overflow-y-auto no-scrollbar flex-1">
                                {productBreakdown.length > 0 ? productBreakdown.map((prod, idx) => (
                                    <div key={prod.name} className="space-y-2">
                                        <div className="flex justify-between text-sm font-black uppercase tracking-wider">
                                            <span className="text-slate-300 truncate max-w-[150px] text-sm">{prod.name}</span>
                                            <span className="text-white text-xl tracking-tighter">{(prod.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px] text-slate-500 ml-0.5">Tn</span></span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden p-[1px]">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]" 
                                                style={{ width: `${(prod.valueTn / maxProductValue) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-xs text-slate-500 italic text-center py-10">Sin datos de producción</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Producción por Paletizadora */}
                    <div className="lg:col-span-8">
                        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 flex flex-col h-full overflow-hidden">
                            <div className="bg-blue-600/80 text-white px-5 py-3 flex items-center gap-3 border-b border-white/10">
                                <Cpu className="text-white" size={20} />
                                <h3 className="font-black text-white uppercase text-[11px] tracking-[0.2em]">Productividad por Paletizadora</h3>
                            </div>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 items-stretch">
                                {byMachine.map((m: any) => (
                                    <div key={m.machineId} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.05] transition-all flex flex-col gap-4 shadow-xl h-full">
                                        {/* Header: Machine Name & TN */}
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                                <div className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] truncate" title={m.name}>
                                                    {m.name}
                                                </div>
                                            </div>
                                            <div className={`text-4xl font-black tracking-tighter leading-tight ${getTnColor(m.machineId, m.valueTn)}`}>
                                                {m.valueTn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                <span className="text-sm ml-1 font-bold text-slate-500">TN</span>
                                            </div>
                                        </div>
                                        
                                        {/* Indicators Row */}
                                        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5 mt-auto">
                                            <div className="space-y-2">
                                                <div className="flex flex-col">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">DISP</p>
                                                    <p className={`text-[13px] font-black ${getAvailabilityColor(m.availability)}`}>{m.availability.toFixed(0)}%</p>
                                                </div>
                                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${m.availability < 76 ? 'bg-red-500' : m.availability < 81 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(m.availability, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2 border-x border-white/5 px-2">
                                                <div className="flex flex-col">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">REND</p>
                                                    <p className={`text-[13px] font-black ${getPerformanceColor(m.performance)}`}>{m.performance.toFixed(0)}%</p>
                                                </div>
                                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${m.performance < 92 ? 'bg-red-500' : m.performance < 95 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(m.performance, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex flex-col">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">OEE</p>
                                                    <p className="text-[13px] font-black text-white">{(m.oee).toFixed(0)}%</p>
                                                </div>
                                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500 rounded-full"
                                                        style={{ width: `${Math.min(m.oee, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROW 3: DOWNTIME TABLE (Full Width) */}
                <div className="w-full">
                    <div data-chart="downtime" className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 flex flex-col relative overflow-hidden group min-h-[400px]">
                        <div className="flex items-center gap-3 bg-amber-600/80 px-5 py-3 relative z-10 border-b border-white/10">
                            <AlertTriangle className="text-white" size={20} />
                            <h3 className="font-black text-white uppercase text-[11px] tracking-[0.2em]">Paros Internos (Top 5 por Máquina)</h3>
                        </div>
                        <div className="p-6 flex-grow flex flex-col overflow-x-auto no-scrollbar">
                            <div data-chart-wrapper className="flex-grow relative z-10 min-w-[800px]">
                            {Object.keys(topDowntimesByMachine).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">HAC</th>
                                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Causa del Paro</th>
                                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Duración</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {Object.entries(topDowntimesByMachine).map(([mId, reasons]) => (
                                            <React.Fragment key={mId}>
                                                <tr className="bg-white/5">
                                                    <td colSpan={3} className="py-2 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">{mId}</span>
                                                            <div className="h-px flex-1 bg-white/10"></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {reasons.map((item: any, idx: number) => (
                                                    <tr key={`${mId}-${idx}`} className="hover:bg-white/[0.08] transition-colors group/row">
                                                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{item.hac}</td>
                                                        <td className="py-3 px-4 text-slate-300 leading-tight group-hover/row:text-white transition-colors">{item.reason}</td>
                                                        <td className="py-3 px-4 text-right font-black text-red-400 whitespace-nowrap">
                                                            {item.duration} <span className="text-[10px] text-slate-500 ml-0.5">min</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500 italic text-sm py-20">Sin registros de paros internos</div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROW 3: SHIFT PRODUCTION TABLE (Full Width) */}
                <div className="w-full mt-2">
                    <div data-chart="shift" className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 flex flex-col relative overflow-hidden group">
                        <div className="flex items-center gap-3 bg-white/5 px-5 py-3 relative z-10 border-b border-white/5">
                            <TableProperties className="text-blue-400" size={18} />
                            <div>
                                <h3 className="font-black text-blue-100 uppercase text-[11px] tracking-[0.2em]">Producción y Métricas por Turno</h3>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Detalle consolidado por máquina y horario</p>
                            </div>
                        </div>
                        <div data-chart-wrapper data-table="shift" className="p-5 flex-grow relative z-10 overflow-x-auto no-scrollbar w-full flex flex-col">
                {shiftData.length > 0 ? (
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Turno / Paletizadora</th>
                                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Producción (Tn)</th>
                                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">HS Marcha</th>
                                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Disp %</th>
                                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Rend %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {shiftData.map((shift, idx) => (
                                <React.Fragment key={shift.name}>
                                    <tr className="bg-white/[0.04] transition-colors group/row border-l-4 border-blue-500">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse"></div>
                                                <span className="text-sm font-black text-white uppercase tracking-wider">{shift.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-xl font-black text-white tracking-tight">
                                                {(shift.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 ml-1.5 uppercase">Tn</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-lg font-black text-emerald-400 tracking-tight">
                                                {(shift.hsMarcha || 0).toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-lg font-black text-amber-400 tracking-tight">{shift.disp}%</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-lg font-black text-indigo-400 tracking-tight">{shift.rend}%</span>
                                        </td>
                                    </tr>
                                    {shift.breakdown.map((m: any, mIdx: number) => (
                                        <tr key={`${shift.name}-${m.machineName}`} className="hover:bg-white/[0.08] transition-colors border-b border-white/5 last:border-0">
                                            <td className="py-2.5 px-10">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{m.machineName}</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <span className={`text-sm font-bold tracking-tight ${getTnColor(m.machineName, m.valueTn)}`}>{(m.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                <span className="text-[10px] font-semibold text-slate-500 ml-1">Tn</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <span className="text-sm font-bold text-emerald-500/80 tracking-tight">{(m.hsMarcha || 0).toFixed(1)}</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <span className={`text-sm font-bold tracking-tight ${getAvailabilityColor(m.disp)}`}>{m.disp}%</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <span className={`text-sm font-bold tracking-tight ${getPerformanceColor(m.rend)}`}>{m.rend}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 italic text-sm py-10">Sin datos de producción por turno</div>
                )}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Share PDF-style Modal with custom observation saved in memory */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Resumen Corporativo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Generación de Reporte Ejecutivo en formato de alta resolución (PDF/PNG)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-1 px-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inner Body (Split Left Editor / Right preview) */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f1e] flex flex-col lg:flex-row gap-6">
              {/* Left Column (Inputs & Buttons) */}
              <div className="w-full lg:w-1/3 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  {/* Observation Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Redactar Observación</label>
                    <textarea
                      value={customObservation}
                      onChange={(e) => setCustomObservation(e.target.value)}
                      placeholder="Ej: Producción normal en los tres turnos. Se realizó mantenimiento preventivo en PZ1 de 14:00hs a 15:30hs sin impacto crítico en el stock..."
                      className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 placeholder-slate-600 resize-none transition-all font-medium"
                    />
                  </div>

                  {/* Actions buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      disabled={isSharing}
                      onClick={async () => {
                        const node = pdfRef.current;
                        if (!node) return;
                        setIsSharing(true);
                        try {
                          await new Promise(r => setTimeout(r, 200));
                          const canvas = await html2canvas(node, {
                            scale: 2,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#ffffff'
                          });
                          const imgData = canvas.toDataURL('image/png', 1.0);
                          const filename = `Reporte_PSCQube_${startStr}.png`;
                          const link = document.createElement('a');
                          link.download = filename;
                          link.href = imgData;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          setToast({ message: '¡Imagen de alta calidad descargada exitosamente!', type: 'success' });
                          setTimeout(() => setToast(null), 4000);
                        } catch (err) {
                          console.error(err);
                          setToast({ message: 'Hubo un error al generar la imagen corporativa.', type: 'error' });
                          setTimeout(() => setToast(null), 4000);
                        } finally {
                          setIsSharing(false);
                        }
                      }}
                      className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSharing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          GENERANDO...
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          DESCARGAR REPORTE (PNG)
                        </>
                      )}
                    </button>

                    <button
                      disabled={isSharing}
                      onClick={async () => {
                        const node = pdfRef.current;
                        if (!node) return;
                        setIsSharing(true);
                        try {
                          await new Promise(r => setTimeout(r, 200));
                          const canvas = await html2canvas(node, {
                            scale: 2,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#ffffff'
                          });
                          const imgData = canvas.toDataURL('image/png', 1.0);
                          const response = await fetch(imgData);
                          const blob = await response.blob();
                          
                          if (navigator.clipboard && (window as any).ClipboardItem) {
                            await navigator.clipboard.write([
                              new (window as any).ClipboardItem({
                                ['image/png']: blob
                              })
                            ]);
                            setToast({ message: '¡Copiado! Ya puedes pegarla directamente en WhatsApp o Slack.', type: 'success' });
                            setTimeout(() => setToast(null), 4000);
                          } else {
                            throw new Error('Fallback download');
                          }
                        } catch (err) {
                          console.error(err);
                          setToast({ message: 'No se pudo copiar directamente. Intente descargándolo.', type: 'error' });
                          setTimeout(() => setToast(null), 4000);
                        } finally {
                          setIsSharing(false);
                        }
                      }}
                      className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <ClipboardCheck size={14} className="text-blue-400" />
                      COPIAR AL PORTAPAPELES
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (High contrast white PDF page simulator) */}
              <div className="flex-1 bg-slate-950/50 rounded-2xl p-4 flex justify-center items-start overflow-auto shadow-inner relative max-h-[70vh] lg:max-h-none">
                {/* Scaled Preview Wrapper */}
                <div className="origin-top scale-[0.6] sm:scale-[0.7] md:scale-[0.75] lg:scale-[0.65] xl:scale-[0.75] transition-transform duration-300 h-0" style={{ minWidth: '800px', height: 'fit-content', paddingBottom: '1050px' }}>
                  
                  {/* The actual high-contrast white document element we target with html2canvas */}
                  <div
                    ref={pdfRef}
                    className="bg-white text-slate-900 border border-slate-300 rounded-lg shadow-2xl p-10 text-left select-none relative"
                    style={{ width: '800px', fontFamily: 'sans-serif', minHeight: '1000px' }}
                  >
                    {/* Header Row */}
                    <div className="pb-5 border-b-4 border-slate-900 flex justify-between items-start">
                      <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Reporte General de Expedición</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Planta Malagueño</p>
                        <div className="mt-4 flex gap-4 text-xs font-bold">
                          <div>
                            <span className="text-slate-400 text-[8px] uppercase tracking-wider block">Período de Análisis</span>
                            <span className="text-[13px] font-black text-blue-900 uppercase">
                              {isSingleDay ? formatDate(dateRange.start) : `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-2xl font-black tracking-tighter text-blue-900 block leading-none">PSCQube</span>
                      </div>
                    </div>

                    {/* Section 1: KPI Resumen */}
                    <div className="mt-4">
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Producción Total</span>
                          <span className="text-2xl font-black text-slate-900 tracking-tight mt-1 block">
                            {totalTn.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs font-bold text-slate-400">Tn</span>
                          </span>
                        </div>
                        <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                          <PackageCheck size={20} />
                        </div>
                      </div>
                    </div>

                    {/* Section I: Tn totales por producto */}
                    <div className="mt-5">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        I. Producción por Tipo de Producto
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {allProductsBreakdown.map((p: any) => (
                          <div key={p.name} className="border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg flex justify-between items-center font-bold">
                            <span className="text-[10px] text-slate-600 uppercase tracking-wide truncate max-w-[200px]" title={p.name}>
                              {p.name}
                            </span>
                            <span className="text-slate-900 font-extrabold whitespace-nowrap">
                              {(p.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tn
                            </span>
                          </div>
                        ))}
                        {allProductsBreakdown.length === 0 && (
                          <span className="col-span-2 text-xs text-slate-400 italic">Sin datos de producción en el período.</span>
                        )}
                      </div>
                    </div>

                    {/* Section II: Producción por Turno */}
                    <div className="mt-5">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        II. Producción por Turno
                      </h4>
                      <div className="grid grid-cols-4 gap-3">
                        {shiftData.map((s: any) => {
                          const cleanName = s.name.replace(/^\d\./, ''); // Removes '1.' from '1.MAÑANA' to leave 'MAÑANA'
                          return (
                            <div key={s.name} className="border border-slate-200 bg-slate-50/50 p-2.5 rounded-lg flex flex-col justify-between font-bold">
                              <div>
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest block truncate">{cleanName}</span>
                                <span className="text-sm font-black text-slate-900 block mt-0.5">
                                  {(s.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[9px] text-slate-400 font-bold">Tn</span>
                                </span>
                              </div>
                              <div className="mt-2 pt-1 border-t border-slate-200 space-y-0.5 text-[8px] text-slate-500 font-semibold">
                                <div className="flex justify-between">
                                  <span>Hs Marcha:</span>
                                  <span className="font-mono text-slate-950 font-extrabold">{(s.hsMarcha || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}h</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Disp / Rend:</span>
                                  <span className="font-mono text-slate-950 font-extrabold">{s.disp}% / {s.rend}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {shiftData.length === 0 && (
                          <span className="col-span-4 text-xs text-slate-400 italic">Sin datos de turno en el período.</span>
                        )}
                      </div>
                    </div>

                    {/* Section III: Tn producidas por paletizadora */}
                    <div className="mt-5">
                      <div className="flex justify-between items-end border-b border-slate-200 pb-1 mb-2">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                          III. Producción por Paletizadora
                        </h4>
                        <span className="text-[9px] font-black text-white bg-slate-900 px-2 py-0.5 rounded">
                          Total Paletizadoras: {byMachine.reduce((sum, m) => sum + (m.valueTn || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tn
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {byMachine.map((m: any) => (
                          <div key={m.machineId} className="border border-slate-200 bg-slate-50/50 p-2.5 rounded-lg flex flex-col justify-between font-bold">
                            <div>
                              <span className="text-[8px] text-slate-400 uppercase tracking-widest block truncate">{m.name}</span>
                              <span className="text-base font-black text-slate-900 block mt-0.5">
                                {(m.valueTn || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[9px] text-slate-400 font-bold">Tn</span>
                              </span>
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-slate-150 space-y-0.5 text-[8px] text-slate-600 font-semibold">
                              <div className="flex justify-between">
                                <span>Hs Marcha:</span>
                                <span className="font-mono text-slate-900 font-extrabold">{(m.hsMarcha || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} hs</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Disponibilidad:</span>
                                <span className={`font-mono font-extrabold ${m.availability < 76 ? 'text-red-600' : 'text-slate-950'}`}>{(m.availability || 0).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Rendimiento:</span>
                                <span className={`font-mono font-extrabold ${m.performance < 92 ? 'text-red-600' : 'text-slate-950'}`}>{(m.performance || 0).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section IV: Tn de materiales productivos contadas en stock físico */}
                    <div className="mt-5">
                      <div className="flex justify-between items-end border-b border-slate-200 pb-1 mb-2">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                          IV. Stock Conteo
                        </h4>
                        <span className="text-[9px] font-black text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Total Conteo: {totalStockTn.toLocaleString(undefined, { maximumFractionDigits: 0 })} Tn
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {producedStock.map((item) => (
                          <div key={item.id} className="border border-slate-200 bg-slate-50/50 p-2.5 rounded-lg text-center font-bold">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate" title={item.product}>
                              {item.product.replace('CEMENTO ', '')}
                            </span>
                            <span className="text-sm font-black text-slate-900 block mt-0.5 tracking-tight">
                              {(item.tonnage || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] text-slate-400 font-bold ml-0.5">Tn</span>
                            </span>
                          </div>
                        ))}
                        {producedStock.length === 0 && (
                          <span className="col-span-4 text-xs text-slate-400 italic">Sin datos de stock físico en el período.</span>
                        )}
                      </div>
                    </div>

                    {/* Section V: Los cinco paros internos más relevantes por paletizadora */}
                    <div className="mt-5">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        V. Paros Internos Relevantes
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'MG.672-PZ1', name: 'Paletizadora 672' },
                          { id: 'MG.673-PZ1', name: 'Paletizadora 673' },
                          { id: 'MG.674-PZ1', name: 'Paletizadora 674' }
                        ].map((core) => {
                          const matchedKey = Object.keys(topDowntimesByMachine).find(k => isMachineMatch(core.id, k));
                          const stops = matchedKey ? topDowntimesByMachine[matchedKey] : [];

                          return (
                            <div key={core.id} className="border border-slate-200 bg-slate-50/30 rounded-lg p-2.5 font-bold">
                              <span className="text-[9px] font-black text-blue-900 uppercase tracking-wider block border-b border-slate-200 pb-0.5 mb-1.5">{core.name}</span>
                              {stops && stops.length > 0 ? (
                                <ul className="space-y-1 font-semibold text-slate-700">
                                  {stops.map((stop: any, idx: number) => (
                                    <li key={idx} className="text-[8px] leading-tight flex justify-between items-start gap-1">
                                      <span className="truncate max-w-[155px]" title={stop.reason}>
                                        {idx + 1}. {stop.reason}
                                      </span>
                                      <span className="text-red-600 font-mono font-bold whitespace-nowrap ml-1 text-right">
                                        {stop.duration}m
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[8px] text-slate-400 italic block">Sin paros internos de relevancia.</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section VI: Observaciones de la Jornada (Active user-input) */}
                    <div className="mt-5">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        VI. Observaciones Operativas
                      </h4>
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                        {customObservation.trim() ? (
                          <p className="text-[10px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap">
                            {customObservation}
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic font-semibold">
                            Sin observaciones registradas para este reporte. Escriba en la sección izquierda del editor para personalizar este espacio del resumen corporativo.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer Certification */}
                    <div className="absolute bottom-6 left-10 right-10 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase border-t border-slate-200 pt-3">
                      <span> PSCQube • HOLCIM ARGENTINA S.A. </span>
                      <span> GENERADO: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR', { hour12: false })} </span>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Action Toast internally in SummaryView */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-5 py-3 rounded-2xl flex items-center gap-2 text-xs font-black z-[210] shadow-2xl border bg-slate-900 text-white animate-bounce border-slate-800">
          {toast.type === 'success' ? <Check className="text-emerald-400" size={16} /> : <AlertTriangle className="text-red-400" size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
    </div>
  );
};
