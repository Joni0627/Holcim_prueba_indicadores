'use client';

import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div className="inline-flex p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-400">
          <ShieldCheck size={48} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tight">Acceso Restringido</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Tu cuenta no tiene permisos para acceder a esta aplicación. 
            Solo los usuarios invitados por un administrador pueden ingresar.
          </p>
        </div>
        <div className="pt-4 flex flex-col items-center gap-4">
          <UserButton afterSignOutUrl="/sign-in" />
          <p className="text-xs text-slate-500 uppercase tracking-widest">Cerrar Sesión para reintentar</p>
          <a 
            href="/sign-in" 
            className="text-emerald-400 hover:text-emerald-300 text-sm font-bold transition-colors"
          >
            Volver al Inicio de Sesión
          </a>
        </div>
      </div>
    </div>
  );
}
