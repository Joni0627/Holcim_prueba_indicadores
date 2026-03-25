'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Users, UserCog, Shield, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: number;
  lastSignInAt: number | null;
}

export const AdminPanel = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const [users, setUsers] = useState<ClerkUser[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isInvitationsLoading, setIsInvitationsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, []);

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const fetchInvitations = async () => {
    setIsInvitationsLoading(true);
    try {
      const response = await fetch('/api/admin/invitations');
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      }
    } catch (err) {
      console.error('Error fetching invitations:', err);
    } finally {
      setIsInvitationsLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invitations?invitationId=${invitationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchInvitations();
      }
    } catch (err) {
      console.error('Error revoking invitation:', err);
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      if (response.ok) {
        setUsers(users.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

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
      // Refresh user list and invitations
      fetchUsers();
      fetchInvitations();
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invitation & Info */}
        <div className="lg:col-span-1 space-y-8">
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
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
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
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Pending Invitations Card */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="text-amber-400" size={20} />
                <h3 className="text-lg font-bold text-white">Invitaciones Pendientes</h3>
              </div>
              <button 
                onClick={fetchInvitations}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-all"
                title="Refrescar invitaciones"
              >
                <Loader2 className={isInvitationsLoading ? "animate-spin" : ""} size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isInvitationsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-amber-500" size={24} />
                </div>
              ) : invitations.length === 0 ? (
                <p className="text-center py-8 text-slate-500 text-sm italic">No hay invitaciones pendientes.</p>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3 flex items-center justify-between group">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{inv.email}</p>
                      <p className="text-slate-500 text-[10px]">{new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="text-red-400/50 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                      title="Revocar invitación"
                    >
                      <AlertCircle size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: User List */}
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden h-full flex flex-col"
          >
            <div className="p-8 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="text-blue-400" size={24} />
                <h2 className="text-xl font-bold text-white">Usuarios Activos</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchUsers}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-all"
                  title="Refrescar lista"
                >
                  <Loader2 className={isUsersLoading ? "animate-spin" : ""} size={18} />
                </button>
                <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                  {users.length} Total
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isUsersLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <Loader2 className="animate-spin text-emerald-500" size={40} />
                  <p className="text-slate-500 font-medium">Cargando usuarios...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <User size={40} className="mb-4 opacity-20" />
                  <p>No hay usuarios registrados aún.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div 
                      key={user.id}
                      className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-slate-700">
                          <User className="text-slate-400" size={20} />
                        </div>
                        <div>
                          <p className="text-white font-bold">
                            {user.firstName} {user.lastName}
                            {!user.firstName && !user.lastName && user.email.split('@')[0]}
                          </p>
                          <p className="text-slate-500 text-xs">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end mr-4">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1 ${
                            user.role === 'admin' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {user.role}
                          </span>
                          <p className="text-[10px] text-slate-600">
                            Ingreso: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : 'Nunca'}
                          </p>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => handleUpdateRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-emerald-400 transition-all"
                            title="Cambiar Rol"
                          >
                            <UserCog size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
