
'use client';

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, Settings, AlertCircle, Package, Ban, BarChart3, Menu, X, Home, Box, ChevronLeft, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { SummaryView } from './components/views/SummaryView';
import { StocksView } from './components/views/StocksView';
import { DowntimeView } from './components/views/DowntimeView';
import { PalletizerView } from './components/views/PalletizerView';
import { BreakageView } from './components/views/BreakageView';
import { DailyTimelineView } from './components/views/DailyTimelineView';
import { MonitorView } from './components/views/MonitorView';
import { AdminPanel } from './components/AdminPanel';
import { useUser, UserButton } from '@clerk/nextjs';

type ViewState = 'home' | 'stocks' | 'downtime' | 'palletizers' | 'breakage' | 'timeline' | 'admin' | 'monitor';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); 
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 2500); 
    return () => clearTimeout(timer);
  }, []);

  const { user } = useUser();
  const isAdmin = (user?.publicMetadata as { role?: string })?.role === 'admin';
  const isOwner = user?.primaryEmailAddress?.emailAddress === "joni0627@gmail.com";
  const canAccessAdmin = isAdmin || isOwner;

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'stocks', label: 'Hoja Stocks', icon: Package },
    { id: 'timeline', label: 'Cronograma Diario', icon: Clock },
    { id: 'monitor', label: 'Monitor de Planta', icon: LayoutDashboard },
    { id: 'downtime', label: 'Análisis Paros', icon: AlertCircle },
    { id: 'palletizers', label: 'Rendimiento Paletizadora', icon: Activity },
    { id: 'breakage', label: 'Roturas de Sacos', icon: Ban },
  ];

  const adminNavItem = { id: 'admin', label: 'Administración', icon: ShieldCheck };

  const renderView = () => {
    switch (currentView) {
      case 'home': return <SummaryView />;
      case 'stocks': return <StocksView />;
      case 'timeline': return <DailyTimelineView />;
      case 'downtime': return <DowntimeView />;
      case 'palletizers': return <PalletizerView />;
      case 'breakage': return <BreakageView />;
      case 'monitor': return <MonitorView onBack={() => setCurrentView('home')} />;
      case 'admin': return canAccessAdmin ? <AdminPanel /> : <SummaryView />;
      default: return <SummaryView />;
    }
  };

  if (showIntro) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
        <div className="flex flex-col items-center space-y-6 animate-pulse">
           <div className="p-4 bg-emerald-500/20 rounded-full border border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <Box size={64} className="text-emerald-400" />
           </div>
           <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                PSC QUBE
              </h1>
              <div className="h-1 w-24 bg-emerald-500 mx-auto rounded-full"></div>
              <h2 className="text-lg md:text-xl font-medium tracking-widest text-emerald-400 uppercase mt-2">
                Expedición Malagueño
              </h2>
           </div>
        </div>
        <p className="absolute bottom-8 text-slate-500 text-xs uppercase tracking-widest">Iniciando Sistemas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
         <div className="flex items-center gap-2">
             <Activity className="text-emerald-400" size={20} />
             <h1 className="font-bold text-lg">PSC QUBE</h1>
         </div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
             {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
         </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transform transition-all duration-300 ease-in-out shadow-2xl
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:sticky md:top-0 flex-shrink-0 flex flex-col border-r border-slate-800
        ${isCollapsed ? 'md:w-20' : 'md:w-72'}
      `}>
        
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3 top-9 bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-full p-1 shadow-lg z-50 items-center justify-center transition-colors"
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 border-b border-slate-800 flex ${isCollapsed ? 'justify-center' : 'justify-between'} items-center transition-all`}>
          <div className="overflow-hidden whitespace-nowrap">
             <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
                <Box className="text-emerald-400 shrink-0" size={isCollapsed ? 28 : 24} />
                <h1 className={`font-bold text-xl tracking-tight text-white transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                    PSC QUBE
                </h1>
             </div>
             <p className={`text-xs text-emerald-400/80 mt-1 font-medium uppercase tracking-wider pl-8 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                Expedición Malagueño
             </p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden no-scrollbar">
          {navItems.map((item) => (
             <button
               key={item.id}
               onClick={() => {
                 setCurrentView(item.id as ViewState);
                 setIsMobileMenuOpen(false);
               }}
               title={isCollapsed ? item.label : ''}
               className={`w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                 ${isCollapsed ? 'justify-center px-2' : 'px-4'}
                 ${currentView === item.id 
                 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 border border-emerald-500/50' 
                 : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'}
               `}
             >
               <item.icon size={20} className={`shrink-0 ${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
               <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                 {item.label}
               </span>
             </button>
          ))}
          
          <div className={`pt-6 mt-6 border-t border-slate-800 ${isCollapsed ? 'border-t-0 pt-2 mt-2' : ''}`}>
            {!isCollapsed && <p className="px-4 text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider animate-in fade-in">Sistema</p>}
            
            {canAccessAdmin && (
              <button
                onClick={() => {
                  setCurrentView('admin');
                  setIsMobileMenuOpen(false);
                }}
                title={isCollapsed ? 'Administración' : ''}
                className={`w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group mb-2
                  ${isCollapsed ? 'justify-center px-2' : 'px-4'}
                  ${currentView === 'admin' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 border border-emerald-500/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'}
                `}
              >
                <ShieldCheck size={20} className={`shrink-0 ${currentView === 'admin' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                  Administración
                </span>
              </button>
            )}

            <button title="Reportes" className={`w-full flex items-center gap-3 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-all ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
                <BarChart3 size={20} className="shrink-0" />
                <span className={`whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>Reportes Históricos</span>
            </button>
          </div>
        </nav>

        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <UserButton afterSignOutUrl="/sign-in" />
            <div className={`transition-all duration-200 overflow-hidden ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <p className="text-sm font-medium text-white whitespace-nowrap">{user?.fullName || 'Usuario'}</p>
              <p className="text-xs text-emerald-500/60 flex items-center gap-1 whitespace-nowrap">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 {canAccessAdmin ? 'Administrador' : 'Operador'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 p-2 md:p-8 overflow-y-auto overflow-x-hidden h-screen scroll-smooth bg-slate-50">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
