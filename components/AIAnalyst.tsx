import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AIAnalysisResult } from '../types';

interface Props {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

export const AIAnalyst: React.FC<Props> = ({ analysis, loading, onAnalyze }) => {
  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-6 shadow-lg overflow-hidden relative">
      {/* Background Element */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-2 rounded-lg">
            <Sparkles className="text-yellow-300" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">Asistente de Planta IA</h3>
        </div>
        {!loading && !analysis && (
          <button
            onClick={onAnalyze}
            className="bg-white text-indigo-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors shadow-md"
          >
            Generar Análisis
          </button>
        )}
        {loading && (
          <div className="flex items-center text-indigo-200 text-sm animate-pulse">
            <Loader2 className="animate-spin mr-2" size={16} />
            Analizando datos en tiempo real...
          </div>
        )}
      </div>

      {analysis && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
          <div className={`p-4 rounded-lg border ${
            analysis.priority === 'high' ? 'bg-red-500/10 border-red-500/30' :
            analysis.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <div className="flex items-start gap-3">
               {analysis.priority === 'high' ? <AlertCircle className="text-red-400 shrink-0 mt-1" size={20} /> :
                analysis.priority === 'medium' ? <AlertTriangle className="text-amber-400 shrink-0 mt-1" size={20} /> :
                <CheckCircle className="text-emerald-400 shrink-0 mt-1" size={20} />
               }
               <div>
                 <h4 className="font-semibold text-sm opacity-90 uppercase tracking-wider mb-1">Diagnóstico Principal</h4>
                 <p className="text-lg leading-snug">{analysis.insight}</p>
               </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-indigo-200 mb-3 uppercase tracking-wider">Recomendaciones de Acción</h4>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 bg-white/5 p-3 rounded-md hover:bg-white/10 transition-colors">
                  <div className="bg-indigo-500/20 p-1 rounded text-indigo-300 text-xs font-mono mt-0.5">0{i+1}</div>
                  <span className="text-sm text-slate-100">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="pt-2 flex justify-end">
             <button onClick={onAnalyze} className="text-xs text-indigo-300 hover:text-white transition-colors flex items-center gap-1">
                <Sparkles size={12} /> Actualizar Análisis
             </button>
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="text-center py-8 text-indigo-200/60">
            <p>Haz clic en generar para obtener insights sobre OEE y paros.</p>
        </div>
      )}
    </div>
  );
};