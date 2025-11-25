import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'red' | 'green' | 'amber';
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon: Icon, trend, color = 'blue' }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
          {subValue && <p className="text-sm text-slate-500 mt-1">{subValue}</p>}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-green-100 text-green-700' :
            trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {trend === 'up' ? '↑ Mejora' : trend === 'down' ? '↓ Crítico' : '• Estable'}
          </span>
        )}
      </div>
    </div>
  );
};