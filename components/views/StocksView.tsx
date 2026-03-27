
import React, { useState, useMemo } from 'react';
import { Loader2, Factory, Layers, Container, BoxSelect } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '../DateFilter';
import { fetchStocks } from '../../services/sheetService';
import { StockStats } from '../../types';

export const StocksView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  const { data, isLoading: loading } = useQuery({
    queryKey: ['stocks', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchStocks(dateRange.start, dateRange.end),
  });

  const handleFilterChange = (range: { start: Date, end: Date }) => {
    setDateRange(range);
  };

  // Memoize processed data for performance
  const processedData = useMemo(() => {
    if (!data) return { producedItems: [], pallets: [], packaging: [], supplies: [] };

    const producedItems = data.items.filter(i => i.isProduced).sort((a,b) => a.product.localeCompare(b.product));
    const allOtherItems = data.items.filter(i => !i.isProduced);
    
    const pallets = allOtherItems.filter(i => 
        i.product.toUpperCase().includes('TARIMA') || 
        i.product.toUpperCase().includes('PALLET')
    ).sort((a, b) => b.quantity - a.quantity);
    
    const packaging = allOtherItems.filter(i => 
        i.product.toUpperCase().includes('ENVASE') || 
        i.product.toUpperCase().includes('SACO') || 
        i.product.toUpperCase().includes('BOLSA') ||
        i.product.toUpperCase().includes('BIG BAG') ||
        i.product.toUpperCase().includes('FILM')
    ).sort((a, b) => b.quantity - a.quantity);
    
    const supplies = allOtherItems.filter(i => 
        !pallets.includes(i) && !packaging.includes(i)
    ).sort((a, b) => b.tonnage - a.tonnage);

    return { producedItems, pallets, packaging, supplies };
  }, [data]);

  const { producedItems, pallets, packaging, supplies } = processedData;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 overflow-x-hidden text-slate-200 bg-[#0a0f1e] min-h-screen p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Control de Stocks</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">Inventario físico ajustado con producción nocturna.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p className="text-sm font-black uppercase tracking-widest">Consultando conteos y producción...</p>
          </div>
      ) : !data ? (
           <div className="h-64 flex items-center justify-center text-slate-500 border border-dashed border-white/10 rounded-2xl bg-white/5 italic text-sm">
               Seleccione una fecha para ver el stock.
           </div>
      ) : (
          <>
            {/* 1. PRODUCTOS PRODUCIDOS (Burbujas Fijas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {producedItems.map((item) => (
                    <div key={item.id} className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden group hover:bg-white/10 transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-600 rounded-xl shadow-lg">
                                    <Factory size={20} className="text-white" />
                                </div>
                                <h3 className="font-black text-white uppercase text-sm tracking-tight leading-tight">{item.product}</h3>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-4xl font-black text-white tracking-tighter">
                                    {/* Sin decimales */}
                                    {item.tonnage.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-lg font-bold text-slate-500 uppercase ml-1">Tn</span>
                                </p>
                                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">
                                    {item.quantity.toLocaleString()} <span className="text-[10px] opacity-60">unid.</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                {producedItems.length === 0 && (
                    <div className="col-span-full p-6 text-center text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10 italic text-sm">
                        No se encontraron datos de Cementos Producidos.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 2. TARIMAS TABLE (Cantidad) */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-white/10 bg-cyan-600/20 flex items-center gap-2">
                        <Layers size={20} className="text-cyan-400" />
                        <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Tarimas</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 border-b border-white/5 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px]">Tipo</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-right">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pallets.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-300 uppercase text-xs">{item.product}</td>
                                        <td className="px-4 py-3 text-right font-black text-white text-lg tracking-tighter">{item.quantity.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {pallets.length === 0 && (
                                    <tr><td colSpan={2} className="p-4 text-center text-slate-500 italic">Sin datos</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. ENVASES TABLE (Cantidad) */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-white/10 bg-blue-600/20 flex items-center gap-2">
                        <Container size={20} className="text-blue-400" />
                        <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Envases</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 border-b border-white/5 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px]">Producto</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-right">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {packaging.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-300 uppercase text-xs">{item.product}</td>
                                        <td className="px-4 py-3 text-right font-black text-white text-lg tracking-tighter">{item.quantity.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {packaging.length === 0 && (
                                    <tr><td colSpan={2} className="p-4 text-center text-slate-500 italic">Sin datos</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 4. INSUMOS / OTROS TABLE (Solo TN) */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-slate-800/50 flex items-center gap-2">
                    <BoxSelect size={20} className="text-slate-400" />
                    <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Insumos y Productos Especiales</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 border-b border-white/5 text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Producto</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right">Total (Tn)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {supplies.map((item) => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-300 uppercase text-xs">{item.product}</td>
                                    {/* Sin decimales */}
                                    <td className="px-6 py-4 text-right font-black text-white text-lg tracking-tighter">{item.tonnage > 0 ? item.tonnage.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-'}</td>
                                </tr>
                            ))}
                            {supplies.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-6 py-8 text-center text-slate-500 italic">
                                        No hay otros materiales registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

          </>
      )}
    </div>
  );
};
