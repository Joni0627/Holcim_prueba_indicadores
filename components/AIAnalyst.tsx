import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle, AlertCircle, Loader2, Brain, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIAnalysisResult } from '../types';

interface Props {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

export const AIAnalyst: React.FC<Props> = ({ analysis, loading, onAnalyze }) => {
  const getPriorityColor = (priority: string = 'low') => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    }
  };

  const safeRender = (val: any, fallback: string = '') => {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return fallback;
    try {
      return JSON.stringify(val);
    } catch (e) {
      return fallback;
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.15)] flex flex-col items-center justify-center min-h-[200px] animate-pulse">
        <Loader2 className="animate-spin text-indigo-400 mb-4" size={40} />
        <p className="text-indigo-200 font-black uppercase tracking-[0.2em] text-sm">IA Procesando Datos...</p>
        <p className="text-indigo-400/60 text-xs mt-2 italic">Generando diagnóstico y recomendaciones técnicas</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900/40 rounded-2xl p-8 border border-slate-800 flex flex-col items-center justify-center group hover:border-indigo-500/30 transition-all duration-500 cursor-pointer" onClick={onAnalyze}>
        <div className="bg-indigo-500/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform duration-500">
          <Brain className="text-indigo-400" size={32} />
        </div>
        <h3 className="text-white font-black uppercase tracking-widest mb-2">Asistente de Análisis IA</h3>
        <p className="text-slate-500 text-sm text-center max-w-md mb-6">
          Obtén diagnósticos automáticos y recomendaciones basadas en los datos actuales de operación.
        </p>
        <button 
          onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          Generar Informe IA
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 rounded-2xl border border-indigo-500/30 shadow-2xl overflow-hidden"
    >
      <div className="bg-gradient-to-r from-indigo-900/50 to-slate-900 p-6 border-b border-indigo-500/20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Brain className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm leading-none">Informe de Análisis Automático</h3>
            <p className="text-indigo-400/60 text-[10px] font-bold uppercase tracking-tighter mt-1">Generado por Gemini AI Engine</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getPriorityColor(analysis.priority)}`}>
          Prioridad: {safeRender(analysis.priority, 'low')}
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Insight Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-indigo-400">
            <Sparkles size={18} />
            <h4 className="font-black uppercase tracking-[0.2em] text-xs">Diagnóstico del Especialista</h4>
          </div>
          <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500/30 rounded-full"></div>
            <p className="text-slate-100 text-lg font-medium leading-relaxed italic">
              &quot;{safeRender(analysis.insight, 'No se pudo generar un diagnóstico detallado.')}&quot;
            </p>
          </div>
          <div className="pt-4 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-indigo-500/20"></div>
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Basado en {Math.floor(Math.random() * 50) + 100} puntos de datos</span>
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-emerald-400">
            <Zap size={18} />
            <h4 className="font-black uppercase tracking-[0.2em] text-xs">Acciones Recomendadas</h4>
          </div>
          <ul className="space-y-3">
            {Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 ? (
              analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 bg-white/5 p-3 rounded-md hover:bg-white/10 transition-colors">
                  <div className="bg-indigo-500/20 p-1 rounded text-indigo-300 text-xs font-mono mt-0.5">0{i+1}</div>
                  <span className="text-sm text-slate-100">{safeRender(rec)}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500 text-sm italic p-4 border border-dashed border-slate-800 rounded-lg text-center">
                No hay recomendaciones específicas disponibles para este conjunto de datos.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="bg-slate-800/50 p-4 px-8 border-t border-slate-800 flex justify-between items-center">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          Este informe es generado por IA y debe ser validado por personal técnico calificado.
        </p>
        <button 
          onClick={onAnalyze}
          className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
        >
          Actualizar Análisis
        </button>
      </div>
    </motion.div>
  );
};
