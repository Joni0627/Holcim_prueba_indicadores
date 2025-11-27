
import React, { useState } from 'react';
import { Package, AlertTriangle, CheckCircle, Loader2, Factory, Box } from 'lucide-react';
import { DateFilter } from '../DateFilter';
import { fetchStocks } from '../../services/sheetService';
import { StockStats, StockItem } from '../../types';

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

  const producedItems = data?.items.filter(i => i.isProduced) || [];
  const otherItems = data?.items.filter(i => !i.isProduced) || [];

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
            {/* Produced Materials (Bubbles) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {producedItems.map((item) => (
                    <div key={item.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:bg-indigo-100 transition-colors"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
                                    <Factory size={20} />
                                </div>
                                <h3 className="font-bold text-slate-800 leading-tight">{item.product}</h3>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 tracking-tight">
                                    {item.tonnage.toLocaleString(undefined, {maximumFractionDigits: 1})} <span className="text-lg font-medium text-slate-400">Tn</span>
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
                        No se encontraron datos de Cementos en el conteo.
                    </div>
                )}
            </div>

            {/* Other Items (Table) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Package size={20} className="text-slate-500" />
                        Insumos y Otros Materiales
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Producto</th>
                                <th className="px-6 py-4 font-semibold text-right">Cantidad (Unid)</th>
                                <th className="px-6 py-4 font-semibold text-right">Total (Tn)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {otherItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700">{item.product}</td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">{item.quantity.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">{item.tonnage.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                </tr>
                            ))}
                            {otherItems.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
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
