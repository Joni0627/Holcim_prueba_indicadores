
import React, { useState } from 'react';
import { Loader2, Factory, Layers, Container, BoxSelect } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchStocks } from '../../services/sheetService';
import { StockStats } from '../../types';

export const StocksView: React.FC = () => {
  const [data, setData] = useState<StockStats | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFilterChange = async (range: { start: Date, end: Date }) => {
      setLoading(true);
      try {
          const result = await fetchStocks(range.start, range.end);
          setData(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // Mantener orden alfabético para las burbujas principales para consistencia visual
  const producedItems = data?.items.filter(i => i.isProduced).sort((a,b) => a.product.localeCompare(b.product)) || [];
  
  const allOtherItems = data?.items.filter(i => !i.isProduced) || [];
  
  // Logic to separate categories and SORT DESCENDING
  
  // 1. Pallets - Sort by Quantity DESC
  const pallets = allOtherItems.filter(i => 
      i.product.toUpperCase().includes('TARIMA') || 
      i.product.toUpperCase().includes('PALLET')
  ).sort((a, b) => b.quantity - a.quantity);
  
  // 2. Packaging - Sort by Quantity DESC
  const packaging = allOtherItems.filter(i => 
      i.product.toUpperCase().includes('ENVASE') || 
      i.product.toUpperCase().includes('SACO') || 
      i.product.toUpperCase().includes('BOLSA') ||
      i.product.toUpperCase().includes('BIG BAG') ||
      i.product.toUpperCase().includes('FILM')
  ).sort((a, b) => b.quantity - a.quantity);
  
  // 3. Supplies - Sort by Tonnage DESC (since we only show TN for these)
  const supplies = allOtherItems.filter(i => 
      !pallets.includes(i) && !packaging.includes(i)
  ).sort((a, b) => b.tonnage - a.tonnage);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Control de Stocks</h2>
          <p className="text-slate-500 text-sm mt-1">Inventario físico ajustado con producción nocturna.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Consultando conteos y producción...</p>
          </div>
      ) : !data ? (
           <div className="h-64 flex items-center justify-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
               Seleccione una fecha para ver el stock.
           </div>
      ) : (
          <>
            {/* 1. PRODUCTOS PRODUCIDOS (Burbujas Fijas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {producedItems.map((item) => (
                    <div key={item.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full -mr-10 -mt-10 group-hover:bg-teal-100 transition-colors"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-teal-600 text-white rounded-lg shadow-sm">
                                    <Factory size={20} />
                                </div>
                                <h3 className="font-bold text-slate-800 leading-tight">{item.product}</h3>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 tracking-tight">
                                    {/* Sin decimales */}
                                    {item.tonnage.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-lg font-medium text-slate-400">Tn</span>
                                </p>
                                <p className="text-sm text-slate-500 font-medium">
                                    {item.quantity.toLocaleString()} <span className="text-xs">unid.</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                {producedItems.length === 0 && (
                    <div className="col-span-full p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No se encontraron datos de Cementos Producidos.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 2. TARIMAS TABLE (Cantidad) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-slate-200 bg-cyan-50/50 flex items-center gap-2">
                        <Layers size={20} className="text-cyan-600" />
                        <h3 className="font-bold text-slate-800">Tarimas</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Tipo</th>
                                    <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pallets.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">{item.product}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {pallets.length === 0 && (
                                    <tr><td colSpan={2} className="p-4 text-center text-slate-400">Sin datos</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. ENVASES TABLE (Cantidad) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-slate-200 bg-blue-50/50 flex items-center gap-2">
                        <Container size={20} className="text-blue-600" />
                        <h3 className="font-bold text-slate-800">Envases</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Producto</th>
                                    <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {packaging.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">{item.product}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {packaging.length === 0 && (
                                    <tr><td colSpan={2} className="p-4 text-center text-slate-400">Sin datos</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 4. INSUMOS / OTROS TABLE (Solo TN) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
                    <BoxSelect size={20} className="text-slate-500" />
                    <h3 className="font-bold text-slate-800">Insumos y Productos Especiales</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Producto</th>
                                <th className="px-6 py-4 font-semibold text-right">Total (Tn)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {supplies.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700">{item.product}</td>
                                    {/* Sin decimales */}
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">{item.tonnage > 0 ? item.tonnage.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-'}</td>
                                </tr>
                            ))}
                            {supplies.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-6 py-8 text-center text-slate-400">
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
