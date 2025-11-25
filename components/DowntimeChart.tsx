import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { DowntimeEvent } from '../types';

interface Props {
  data: DowntimeEvent[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg">
        <p className="font-semibold text-slate-800">{payload[0].payload.reason}</p>
        <p className="text-slate-600 text-sm">
          Duración: <span className="font-bold text-slate-900">{payload[0].value} mins</span>
        </p>
        <p className="text-xs text-slate-400 mt-1 capitalize">{payload[0].payload.category}</p>
      </div>
    );
  }
  return null;
};

export const DowntimeChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Ranking de Paros (Pareto)</h3>
      <div className="flex-grow min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}m`} />
            <YAxis
                type="category"
                dataKey="reason"
                stroke="#475569"
                fontSize={11}
                width={120}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
            <Bar dataKey="durationMinutes" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};