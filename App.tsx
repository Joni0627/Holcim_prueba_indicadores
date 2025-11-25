import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, Settings, AlertCircle, Package, Ban, BarChart3, Menu, X, Home, Box } from 'lucide-react';
import { SummaryView } from './components/views/SummaryView';
import { StocksView } from './components/views/StocksView';
import { DowntimeView } from './components/views/DowntimeView';
import { PalletizerView } from './components/views/PalletizerView';
import { BreakageView } from './components/views/BreakageView';

type ViewState = 'home' | 'stocks' | 'downtime' | 'palletizers' | 'breakage';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 2500); // 2.5 seconds intro
    return () => clearTimeout(timer);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'stocks', label: 'Hoja Stocks', icon: Package },
    { id: 'downtime', label: 'Análisis Paros', icon: AlertCircle },
    { id: 'palletizers', label: 'Rendimiento Paletizadora', icon: Activity },
    { id: 'breakage', label: 'Roturas de Sacos', icon: Ban },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'home': return <SummaryView />;
      case 'stocks': return <StocksView />;
      case 'downtime': return <DowntimeView />;
      case 'palletizers': return <PalletizerView />;
      case 'breakage': return <BreakageView />;
      default: return <SummaryView />;
    }
  };

  // Intro Screen Component
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
      
      {/* Mobile Header - Reduced z-index so Sidebar can cover it */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
         <div className="flex items-center gap-2">
             <Activity className="text-emerald-400" size={20} />
             <h1 className="font-bold text-lg">PSC QUBE</h1>
         </div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
             {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
         </button>
      </div>

      {/* Sidebar - Increased z-index (z-50) to sit ABOVE the mobile header */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:sticky md:top-0 flex-shrink-0 flex flex-col border-r border-slate-800
      `}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
             <div className="flex items-center gap-2">
                <Box className="text-emerald-400" />
                <h1 className="font-bold text-xl tracking-tight text-white">PSC QUBE</h1>
             </div>
             <p className="text-xs text-emerald-400/80 mt-1 font-medium uppercase tracking-wider pl-8">Expedición Malagueño</p>
          </div>
          {/* Close button only visible on mobile */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
             <button
               key={item.id}
               onClick={() => {
                 setCurrentView(item.id as ViewState);
                 setIsMobileMenuOpen(false);
               }}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                 currentView === item.id 
                 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 border border-emerald-500/50' 
                 : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
               }`}
             >
               <item.icon size={18} className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
               {item.label}
             </button>
          ))}
          
          <div className="pt-6 mt-6 border-t border-slate-800">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider">Sistema</p>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-all">
                <BarChart3 size={18} />
                Reportes Históricos
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-all">
                <Settings size={18} />
                Configuración Planta
            </button>
          </div>
        </nav>

        <div className="p-6 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900/50 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">OP</div>
            <div>
              <p className="text-sm font-medium text-white">Operador Turno</p>
              <p className="text-xs text-emerald-500/60 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 En Línea
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar - High z-index but below sidebar */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen scroll-smooth">
        {renderView()}
      </main>
    </div>
  );
}

export default App;