import React from 'react';
import { getDowntimeRanking } from '../../services/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, Wrench, Users, ClipboardCheck } from 'lucide-react';
import { DateFilter } from '../DateFilter';

export const DowntimeView: React.FC = () => {
  const downtimes = getDowntimeRanking('all');
  
  const totalDowntime = downtimes.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  
  const byCategory = [
    { name: 'Técnico', value: downtimes.filter(d => d.category === 'technical').reduce((a, c) => a + c.durationMinutes, 0), color: '#3b82f6' },
    { name: 'Organizacional', value: downtimes.filter(d => d.category === 'organizational').reduce((a, c) => a + c.durationMinutes, 0), color: '#f59e0b' },
    { name: 'Calidad', value: downtimes.filter(d => d.category === 'quality').reduce((a, c) => a + c.durationMinutes, 0), color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Detallado de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Identificación de cuellos de botella y pérdidas principales.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
            <DateFilter />
        </div>
      </div>

      {/* KPI Cards for Downtime */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-100 rounded text-slate-600"><Clock size={16} /></div>
                <span className="text-sm font-medium text-slate-500">Total Paros</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{totalDowntime} <span className="text-sm font-normal text-slate-400">min</span></p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded text-blue-600"><Wrench size={16} /></div>
                <span className="text-sm font-medium text-slate-500">Fallas Técnicas</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{byCategory[0].value} <span className="text-sm font-normal text-slate-400">min</span></p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 rounded text-amber-600"><Users size={16} /></div>
                <span className="text-sm font-medium text-slate-500">Organizacional</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{byCategory[1].value} <span className="text-sm font-normal text-slate-400">min</span></p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-50 rounded text-red-600"><ClipboardCheck size={16} /></div>
                <span className="text-sm font-medium text-slate-500">Calidad</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{byCategory[2].value} <span className="text-sm font-normal text-slate-400">min</span></p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px] flex flex-col">
             <h3 className="font-semibold text-slate-800 mb-4">Ranking de Motivos (Pareto)</h3>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimes} layout="vertical" margin={{top:5, right:30, left:40, bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" unit="m" />
                    <YAxis type="category" dataKey="reason" width={150} style={{fontSize: '11px'}} />
                    <Tooltip contentStyle={{borderRadius: '8px'}} />
                    <Bar dataKey="durationMinutes" fill="#6366f1" radius={[0, 4, 4, 0]}>
                        {downtimes.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index < 2 ? '#ef4444' : '#6366f1'} />
                        ))}
                    </Bar>
                </BarChart>
             </ResponsiveContainer>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px] flex flex-col">
             <h3 className="font-semibold text-slate-800 mb-4">Distribución por Categoría</h3>
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {byCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                </PieChart>
             </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};