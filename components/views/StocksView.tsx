import React from 'react';
import { getStocks } from '../../services/mockData';
import { Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { DateFilter } from '../DateFilter';

export const StocksView: React.FC = () => {
  const stocks = getStocks();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Control de Stocks</h2>
          <p className="text-slate-500 text-sm mt-1">Inventario de materias primas y consumibles críticos.</p>
        </div>
        <DateFilter />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Material</th>
                <th className="px-6 py-4 font-semibold text-slate-700">SKU</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Nivel Actual</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Mínimo / Máximo</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stocks.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                        <Package size={18} />
                      </div>
                      <span className="font-medium text-slate-900">{item.materialName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.sku}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-slate-800 text-lg">{item.currentLevel.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {item.minLevel.toLocaleString()} / {item.maxLevel.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      item.status === 'critical' ? 'bg-red-50 text-red-700 border-red-100' :
                      item.status === 'low' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      item.status === 'overstock' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {item.status === 'critical' && <AlertTriangle size={12} />}
                      {item.status === 'ok' && <CheckCircle size={12} />}
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="text-blue-800 font-semibold text-sm">Total Referencias</h4>
            <p className="text-2xl font-bold text-blue-900 mt-1">{stocks.length}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h4 className="text-red-800 font-semibold text-sm">Críticos (Stock Out)</h4>
            <p className="text-2xl font-bold text-red-900 mt-1">{stocks.filter(s => s.status === 'critical').length}</p>
        </div>
         <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <h4 className="text-amber-800 font-semibold text-sm">Bajo Stock (Reordenar)</h4>
            <p className="text-2xl font-bold text-amber-900 mt-1">{stocks.filter(s => s.status === 'low').length}</p>
        </div>
      </div>
    </div>
  );
};