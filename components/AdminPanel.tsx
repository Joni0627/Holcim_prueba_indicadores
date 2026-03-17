'use client';

import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdminPanel = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al enviar la invitación');
      }

      setStatus('success');
      setMessage(`Invitación enviada con éxito a ${email}`);
      setEmail('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
          <ShieldCheck className="text-emerald-400" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-emerald-500">
            Panel de Gestión Usuarios
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Invitation Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden group"
        >
          {/* Neon Accents */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[80px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 blur-[60px] rounded-full" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Mail size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Enviar Invitación</span>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full bg-slate-950 border border-slate-800 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Send size={18} />
                    <span>Enviar Acceso</span>
                  </>
                )}
              </button>
            </form>

            <AnimatePresence mode="wait">
              {status !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex items-start gap-3 p-4 rounded-2xl border ${
                    status === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {status === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
                  <p className="text-sm font-medium">{message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Info Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={20} />
              Seguridad del Sistema
            </h3>
            <ul className="space-y-4">
              {[
                'Registro cerrado solo por invitación.',
                'Validación de dominio y correo electrónico.',
                'Asignación automática de roles básicos.',
                'Auditoría de accesos en tiempo real.'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
              Nota: Las invitaciones expiran en 7 días. El usuario recibirá un enlace único para completar su registro en PSC QUBE.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
