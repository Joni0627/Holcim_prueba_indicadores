import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { ProductionMetrics } from '../types';

interface Props {
  data: ProductionMetrics[];
}

export const ProductionChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Tendencia de Producción</h3>
        <div className="flex items-center space-x-2 text-sm">
          <span className="flex items-center text-slate-500">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1"></span> Real
          </span>
          <span className="flex items-center text-slate-500">
            <span className="w-2 h-2 bg-slate-400 rounded-full mr-1"></span> Target
          </span>
        </div>
      </div>
      <div className="flex-grow min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={12} tickMargin={10} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              itemStyle={{ color: '#1e293b' }}
            />
            <ReferenceLine y={data[0]?.targetUnits} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Target', position: 'right', fill: '#94a3b8', fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="producedUnits"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorProduced)"
              name="Producción"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};