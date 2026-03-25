# PSC QUBE - Code Blueprint (Código Fuente Completo)

Este documento contiene el código fuente completo de todos los archivos del proyecto. Es una **regla de oro** replicar la aplicación de manera idéntica a este código para asegurar que todas las funcionalidades (monitoreo en tiempo real, análisis de IA, gestión de administración, etc.) funcionen correctamente.

---

## 1. Estructura de Archivos

```text
/
├── App.tsx (Componente Principal)
├── BLUEPRINT.md (Arquitectura)
├── CODE_BLUEPRINT.md (Este archivo)
├── GOLDEN_RULES.md (Reglas de Oro)
├── app/
│   ├── layout.tsx (Layout Raíz)
│   ├── page.tsx (Página de Entrada)
│   └── api/ (Rutas de API)
├── components/
│   ├── AIAnalyst.tsx
│   ├── AdminPanel.tsx
│   ├── DateFilter.tsx
│   ├── MonitorTimelineBar.tsx (Definido en MonitorView.tsx)
│   ├── providers/
│   │   └── QueryProvider.tsx
│   └── views/
│       ├── BreakageView.tsx
│       ├── DailyTimelineView.tsx
│       ├── DowntimeView.tsx
│       ├── MonitorView.tsx
│       ├── PalletizerView.tsx
│       ├── StocksView.tsx
│       └── SummaryView.tsx
├── lib/
│   └── ai.ts
├── services/
│   ├── geminiService.ts
│   ├── mockData.ts
│   └── sheetService.ts
├── types.ts
├── middleware.ts
└── package.json
```

---

## 2. Código Fuente Completo

### 2.1. Archivos Raíz y Configuración

#### `App.tsx`
```tsx
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
        
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
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
```

#### `types.ts`
```tsx
export interface Machine {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'maintenance' | 'idle';
  location: string;
  type: 'palletizer' | 'bagger' | 'wrapper' | 'other';
}

export interface ProductionMetrics {
  timestamp: string;
  producedUnits: number;
  targetUnits: number;
  defects: number;
  machineId: string;
}

export interface DowntimeEvent {
  id: string;
  reason: string;
  durationMinutes: number;
  machineId: string;
  category: string;
  date: string;
  shift: string;
  startTime?: string;
  hac: string;
  hacDetail: string;
  downtimeType?: string;
  sapCause?: string;
  timestamp: string;
}

export interface OEEData {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface ShiftMetric {
  machineId: string;
  machineName: string;
  shift: string; 
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  valueTn?: number;
}

export interface ProductionStats {
  totalBags: number;
  totalTn: number; 
  byShift: { name: string; value: number; valueTn: number; valueBags: number; target: number }[];
  byMachine: { name: string; value: number; valueTn: number }[]; 
  byMachineProduct: { name: string; [key: string]: number | string }[];
  details: ShiftMetric[];
}

export interface BreakageHistoryItem {
    date: string; 
    [key: string]: number | string; 
}

export interface BreakageStats {
  totalProduced: number;
  totalBroken: number;
  globalRate: number; 
  bySector: { name: string; value: number; percentage: number }[]; 
  byProvider: { 
    id: string; 
    name: string; 
    produced: number; 
    broken: number; 
    rate: number; 
  }[];
  byMaterial: {
    id: string; 
    name: string;
    produced: number;
    broken: number;
    rate: number;
    sector_Ensacadora: number;
    sector_NoEmboquillada: number;
    sector_Ventocheck: number;
    sector_Transporte: number;
  }[];
  history: BreakageHistoryItem[]; 
}

export interface StockItem {
  id: string;
  product: string;
  quantity: number; 
  tonnage: number; 
  isProduced: boolean; 
  lastUpdated: string;
}

export interface StockStats {
  date: string; 
  items: StockItem[];
}

export interface AIAnalysisResult {
  insight: string;
  recommendations: string[];
  priority: 'low' | 'medium' | 'high';
}
```

#### `package.json`
```json
{
  "name": "psc-qube-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@clerk/nextjs": "^5.3.0",
    "@google/genai": "^1.46.0",
    "@tanstack/react-query": "^5.90.21",
    "clsx": "^2.1.1",
    "google-auth-library": "^9.10.0",
    "google-spreadsheet": "^4.1.1",
    "html2canvas": "^1.4.1",
    "jspdf": "^4.2.0",
    "lucide-react": "^0.378.0",
    "motion": "^12.35.2",
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/react": "^18.3.2",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5"
  }
}
```

#### `middleware.ts`
```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/clerk-webhook(.*)'
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### 2.2. Servicios y Librerías

#### `lib/ai.ts`
```ts
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

export function cleanJsonString(str: string): string {
  if (!str) return "";
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) return match[1].trim();
  
  const firstOpen = str.indexOf('{');
  const lastClose = str.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      return str.substring(firstOpen, lastClose + 1);
  }
  return str.trim();
}

export async function generateAIAnalysis(prompt: string): Promise<any | null> {
  if (!API_KEY) return null;

  const genAI = new GoogleGenAI({ apiKey: API_KEY });
  const modelsToTry = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-pro"];

  for (const modelName of modelsToTry) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: { temperature: 0.2, responseMimeType: "application/json" }
      });

      const text = response.text;
      if (text) {
        try {
          return JSON.parse(cleanJsonString(text));
        } catch (e) { continue; }
      }
    } catch (e) { continue; }
  }
  return null;
}
```

#### `services/sheetService.ts`
```ts
import { DowntimeEvent, ProductionStats, BreakageStats, StockStats } from "../types";

export const fetchDowntimes = async (start: Date, end: Date): Promise<DowntimeEvent[]> => {
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const res = await fetch(`/api/paros?start=${startStr}&end=${endStr}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((row: any) => ({
    ...row,
    category: row.sapCause || 'Otros',
    timestamp: new Date().toISOString()
  }));
};

export const fetchProductionStats = async (start: Date, end: Date): Promise<ProductionStats | null> => {
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const res = await fetch(`/api/production?start=${startStr}&end=${endStr}`);
  return res.ok ? await res.json() : null;
};

export const fetchBreakageStats = async (start: Date, end: Date): Promise<BreakageStats | null> => {
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const res = await fetch(`/api/breakage?start=${startStr}&end=${endStr}`);
  return res.ok ? await res.json() : null;
};

export const fetchStocks = async (start: Date, end: Date): Promise<StockStats | null> => {
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const res = await fetch(`/api/stocks?start=${startStr}&end=${endStr}`);
  return res.ok ? await res.json() : null;
};
```

### 2.3. Rutas de API (Backend)

#### `app/api/production/route.ts`
```ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const cacheKey = `prod-${start}-${end}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return NextResponse.json(cached.data);

    const authClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, authClient);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Producción"];
    const rows = await sheet.getRows();

    // Lógica de filtrado por fecha y cálculo de OEE...
    // (Ver implementación completa en el archivo original)
    
    const result = { /* ... */ };
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
```

### 2.3. Vistas de Análisis (Summary, Downtime, Breakage, Palletizer, DailyTimeline)

#### 2.3.1. SummaryView.tsx (Vista de Resumen)

Este componente es el "corazón" del dashboard, proporcionando una visión general de la producción, paros y stock. Incluye la funcionalidad de captura de pantalla para compartir reportes.

```tsx
import React, { useState, useMemo } from 'react';
import { PackageCheck, Timer, AlertTriangle, TrendingUp, TableProperties, CircleDashed, Loader2, Weight, BarChart2, Calendar, Activity, Clock, Share2, Download, Cpu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
import { fetchDowntimes, fetchProductionStats, fetchStocks } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats } from '../../types';
import { DateFilter } from '../DateFilter';

const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg z-50">
          <p className="font-semibold text-slate-800 text-sm mb-1">{data.reason}</p>
          <div className="text-xs text-slate-500 mb-2">
             <span className="font-mono bg-slate-100 px-1 rounded">{data.hac || 'N/A'}</span>
          </div>
          <p className="text-slate-600 text-sm">
            Duración: <span className="font-bold text-slate-900">{formatMinutes(data.durationMinutes)}</span> 
            <span className="text-xs text-slate-400 ml-1">({data.durationMinutes} min)</span>
          </p>
        </div>
      );
    }
    return null;
};

export const SummaryView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  const [isSharing, setIsSharing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: downtimeResult, isLoading: loadingDowntimes } = useQuery({
    queryKey: ['downtimes', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchDowntimes(dateRange.start, dateRange.end),
  });

  const { data: prodResult, isLoading: loadingProd } = useQuery({
    queryKey: ['production', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchProductionStats(dateRange.start, dateRange.end),
  });

  const { data: stockResult, isLoading: loadingStocks } = useQuery({
    queryKey: ['stocks', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchStocks(dateRange.start, dateRange.end),
  });

  const isLoading = loadingDowntimes || loadingProd || loadingStocks;

  const handleFilterChange = (range: { start: Date, end: Date }) => {
    setDateRange(range);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long' 
    }).replace(/^\w/, (c) => c.toUpperCase());
  };

  const downtimes = useMemo(() => {
    if (!downtimeResult) return [];
    return [...downtimeResult]
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .slice(0, 10);
  }, [downtimeResult]);

  const detailedMetrics = prodResult?.details || [];

  const shiftData = useMemo(() => {
    if (!prodResult?.byShift) return [];
    return prodResult.byShift.map(s => {
        const shiftMetrics = detailedMetrics.filter(m => m.shift === s.name);
        const count = shiftMetrics.length;
        const metrics = count > 0 ? {
            disp: shiftMetrics.reduce((acc, m) => acc + m.availability, 0) / count,
            rend: shiftMetrics.reduce((acc, m) => acc + m.performance, 0) / count,
            oee: shiftMetrics.reduce((acc, m) => acc + m.oee, 0) / count
        } : { disp: 0, rend: 0, oee: 0 };

        return {
            ...s,
            valueTn: s.valueTn,
            oee: Math.round(metrics.oee * 100),
            disp: Math.round(metrics.disp * 100),
            rend: Math.round(metrics.rend * 100)
        };
    });
  }, [prodResult, detailedMetrics]);

  const productBreakdown = useMemo(() => {
    if (!prodResult?.byMachineProduct) return [];
    const breakdown = prodResult.byMachineProduct.reduce((acc: any[], curr) => {
      Object.keys(curr).forEach(key => {
        if (key !== 'name') {
          const existing = acc.find(p => p.name === key);
          if (existing) {
            existing.value += (curr[key] as number);
          } else {
            acc.push({ name: key, value: curr[key] as number });
          }
        }
      });
      return acc;
    }, []).sort((a, b) => b.value - a.value).slice(0, 4).map(p => ({
      ...p,
      valueTn: p.value
    }));
    return breakdown;
  }, [prodResult]);

  const maxProductValue = useMemo(() => 
    Math.max(...productBreakdown.map(p => p.valueTn), 1), 
  [productBreakdown]);

  const producedStock = useMemo(() => {
    if (!stockResult?.items) return [];
    const order = ["CEMENTO MAESTRO", "CEMENTO CPF 40", "CEMENTO RAPIDO", "CEMENTO CPC 30"];
    return stockResult.items
      .filter(i => i.isProduced)
      .sort((a, b) => {
        const nameA = a.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const nameB = b.product.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return order.indexOf(nameA) - order.indexOf(nameB);
      })
      .slice(0, 4);
  }, [stockResult]);

  const handleShare = async () => {
    const element = document.getElementById('summary-view-content');
    if (!element || isSharing) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        windowWidth: 1400,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('summary-view-content');
          if (el) {
            el.style.width = '1400px';
            el.style.padding = '32px';
            el.style.backgroundColor = '#0f172a';
            
            const downtimeContainer = el.querySelector('[data-chart="downtime"]');
            if (downtimeContainer) {
                (downtimeContainer as HTMLElement).style.height = '420px';
                (downtimeContainer as HTMLElement).style.minHeight = '420px';
            }
            
            const shiftContainer = el.querySelector('[data-chart="shift"]');
            if (shiftContainer) {
                (shiftContainer as HTMLElement).style.height = '420px';
                (shiftContainer as HTMLElement).style.minHeight = '420px';
            }

            const leftCards = el.querySelectorAll('[data-card="left"]');
            leftCards.forEach((c: any) => {
                c.style.height = 'auto';
                c.style.minHeight = '70px';
                c.style.padding = '12px';
            });
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 0.9);
      const response = await fetch(imgData);
      const blob = await response.blob();
      
      const fileName = `Reporte_Produccion_${new Date().toISOString().split('T')[0]}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.share) {
        try {
          const data: ShareData = {
            title: 'Reporte de Producción',
            text: `Reporte de producción ${formatDate(dateRange.start)}`,
          };
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            data.files = [file];
          }
          await navigator.share(data);
        } catch (shareError) {
          if ((shareError as any).name !== 'AbortError') {
            downloadFile(blob, fileName);
          }
        }
      } else {
        downloadFile(blob, fileName);
      }
    } catch (error) {
      console.error('Error sharing Image:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
                <Calendar className="text-slate-400" size={24} />
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">{formatDate(dateRange.start)}</h1>
            </div>
            <button 
                onClick={handleShare}
                disabled={isSharing}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 px-3 text-xs font-bold shadow-sm border ${isSharing ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100'}`}
            >
                {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                <span className="hidden sm:inline">{isSharing ? 'Generando...' : 'Compartir Imagen'}</span>
            </button>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      <div id="summary-view-content" className="space-y-6">
        {isLoading ? (
           <div className="h-96 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={48} />
              <p className="text-lg font-medium">Sincronizando con Planta...</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 flex flex-col gap-6 lg:h-full">
                <div data-card="left" className="h-auto min-h-[140px] md:flex-1 bg-gradient-to-br from-blue-600 to-blue-400 text-white p-6 rounded-lg shadow-xl relative overflow-hidden group border border-blue-300/30 flex flex-col justify-center">
                    <p className="text-white font-bold uppercase tracking-wider text-sm mb-1">Producción Total</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter">
                            {(prodResult?.totalTn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h2>
                        <span className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-100">Tn</span>
                    </div>
                </div>
                <div data-card="left" className="h-auto min-h-[140px] md:flex-1 bg-gradient-to-br from-blue-900 to-blue-700 text-white p-6 rounded-lg shadow-lg space-y-4 border border-blue-800/50 flex flex-col justify-center">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-blue-300 mb-2 border-b border-blue-800/30 pb-2">TN por PRODUCTO</h3>
                    <div className="space-y-4">
                        {productBreakdown.map((prod) => (
                            <div key={prod.name} className="space-y-1">
                                <div className="flex justify-between text-[12px] font-bold uppercase tracking-tight">
                                    <span className="text-blue-100">{prod.name}</span>
                                    <span className="text-white">{prod.valueTn.toLocaleString(undefined, { maximumFractionDigits: 0 })} Tn</span>
                                </div>
                                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400" style={{ width: `${(prod.valueTn / maxProductValue) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div data-card="left" className="h-auto min-h-[140px] md:flex-1 bg-gradient-to-br from-blue-700 to-blue-500 p-5 rounded-lg shadow-lg border border-blue-400/30 space-y-4 text-white flex flex-col justify-center">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100/60 mb-1 border-b border-blue-500/30 pb-2">RENDIMIENTO GLOBAL</h3>
                    <div className="space-y-3">
                        <div className="bg-white/10 backdrop-blur-sm p-3 rounded-md border border-white/10">
                            <p className="text-[10px] font-bold uppercase text-blue-200 tracking-wider">OEE Total</p>
                            <p className="text-3xl font-black text-white">
                                {(detailedMetrics.reduce((acc, m) => acc + m.oee, 0) / (detailedMetrics.length || 1) * 100).toFixed(0)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-9 flex flex-col gap-6 lg:h-full">
                <div className="bg-gradient-to-br from-slate-950 to-blue-900 rounded-lg shadow-xl border border-slate-800 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-2 flex justify-between items-center shadow-lg">
                        <h3 className="font-black uppercase tracking-widest text-sm">Stock a las 06:00 hs.</h3>
                        <Clock size={16} />
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {producedStock.map(item => (
                            <div key={item.id} className="sm:border-r border-slate-700 last:border-0 px-1">
                                <p className="text-[9px] uppercase font-bold text-slate-400 mb-1 leading-tight truncate">{item.product}</p>
                                <p className="text-xl md:text-2xl font-black tracking-tighter text-white">
                                    {item.tonnage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-[10px] md:text-xs font-bold text-emerald-500 ml-1">Tn</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div data-chart="downtime" className="bg-gradient-to-br from-slate-950 to-blue-900 p-4 md:p-6 rounded-lg shadow-xl border border-slate-800 flex flex-col relative overflow-hidden group h-[450px] lg:flex-1">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-800/50 pb-3 relative z-10">
                        <AlertTriangle className="text-red-500" size={18} />
                        <h3 className="font-bold text-slate-200 uppercase text-xs tracking-widest">Análisis de Paradas Principales</h3>
                    </div>
                    <div data-chart-wrapper className="flex-grow relative z-10">
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
                            <BarChart data={downtimes} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="reason" stroke="#94a3b8" fontSize={12} width={150} tick={{ fill: '#e2e8f0', fontWeight: 900 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="durationMinutes" fill="#ef4444" radius={[0, 4, 4, 0]}>
                                    {downtimes.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f87171'} fillOpacity={1 - (index * 0.08)} />
                                    ))}
                                    <LabelList dataKey="durationMinutes" position="right" formatter={(val: number) => `${val}m`} style={{ fill: '#cbd5e1', fontSize: '10px', fontWeight: 'bold' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
      )}
      </div>
    </div>
  );
};

#### 2.3.2. DowntimeView.tsx (Vista de Paros)

```tsx
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Clock, ClipboardCheck, Loader2, Table, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '../DateFilter';
import { fetchDowntimes } from '../../services/sheetService';
import { analyzeDowntimeData } from '../../services/geminiService';
import { DowntimeEvent, AIAnalysisResult } from '../../types';
import { AIAnalyst } from '../AIAnalyst';

const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const DowntimeView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [selectedType, setSelectedType] = useState<'all' | 'interno' | 'externo'>('all');
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: downtimes = [], isLoading: loading } = useQuery({
    queryKey: ['downtimes', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchDowntimes(dateRange.start, dateRange.end),
  });
  
  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
      setAiAnalysis(null);
  };

  const handleAIAnalysis = async () => {
      if (downtimes.length === 0) return;
      setAiLoading(true);
      try {
          const result = await analyzeDowntimeData(downtimes);
          setAiAnalysis(result);
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  const filteredDowntimes = useMemo(() => {
    return downtimes.filter(d => {
        if (selectedType === 'all') return true;
        if (!d.downtimeType) return false;
        return d.downtimeType.toLowerCase().includes(selectedType);
    });
  }, [downtimes, selectedType]);

  const totalDowntime = useMemo(() => 
    filteredDowntimes.reduce((acc, curr) => acc + curr.durationMinutes, 0),
  [filteredDowntimes]);

  const pieData = useMemo(() => {
    const counts = filteredDowntimes.reduce((acc, curr) => {
        const cat = curr.sapCause || 'Otros';
        acc[cat] = (acc[cat] || 0) + curr.durationMinutes;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredDowntimes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 overflow-x-hidden">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis de Paros</h2>
          <p className="text-slate-500 text-sm mt-1">Estadísticas de disponibilidad y ranking de causas.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Cargando datos...</p>
          </div>
      ) : (
          <>
            <AIAnalyst analysis={aiAnalysis} loading={aiLoading} onAnalyze={handleAIAnalysis} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Clock size={16} className="text-slate-600" />
                            <span className="text-sm font-medium text-slate-500">Tiempo Total de Parada</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{formatMinutes(totalDowntime)}</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">Ranking Top 10 Motivos</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...filteredDowntimes].sort((a,b) => b.durationMinutes - a.durationMinutes).slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={formatMinutes} />
                            <YAxis type="category" dataKey="reason" width={120} style={{fontSize: '10px'}} />
                            <Tooltip />
                            <Bar dataKey="durationMinutes" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </>
      )}
    </div>
  );
};

#### 2.3.3. BreakageView.tsx (Vista de Roturas)

```tsx
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, BarChart, Bar } from 'recharts';
import { Ban, AlertOctagon, Loader2, Factory, TrendingDown, Layers, Activity, GanttChartSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '../DateFilter';
import { fetchBreakageStats } from '../../services/sheetService';
import { analyzeBreakageData } from '../../services/geminiService';
import { BreakageStats, AIAnalysisResult } from '../../types';
import { AIAnalyst } from '../AIAnalyst';

export const BreakageView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['breakage', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchBreakageStats(dateRange.start, dateRange.end),
  });

  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
      setAiAnalysis(null);
  };

  const handleAIAnalysis = async () => {
      if (!data) return;
      setAiLoading(true);
      try {
          const result = await analyzeBreakageData(data);
          setAiAnalysis(result);
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis Roturas de Sacos</h2>
        </div>
        <DateFilter onFilterChange={handleFilterChange} defaultFilter="month" />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Procesando datos de calidad...</p>
          </div>
      ) : (
          <>
            <AIAnalyst analysis={aiAnalysis} loading={aiLoading} onAnalyze={handleAIAnalysis} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">Total Roturas</p>
                    <p className="text-3xl font-bold text-slate-800">{data?.totalBroken.toLocaleString()}</p>
                </div>
            </div>
          </>
      )}
    </div>
  );
};
```

#### 2.3.4. PalletizerView.tsx (Vista de Paletizadoras)

```tsx
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';
import { Cpu, Activity, Loader2, Gauge, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '../DateFilter';
import { fetchProductionStats } from '../../services/sheetService';
import { ShiftMetric } from '../../types';

export const PalletizerView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  const { data, isLoading: loading } = useQuery({
    queryKey: ['production', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchProductionStats(dateRange.start, dateRange.end),
  });

  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
  };

  const palletizerData = useMemo(() => {
    if (!data?.details) return [];
    return data.details;
  }, [data]);

  const globalOEE = useMemo(() => {
    if (palletizerData.length === 0) return 0;
    return Math.round((palletizerData.reduce((acc, curr) => acc + curr.oee, 0) / palletizerData.length) * 100);
  }, [palletizerData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Rendimiento por Paletizadora</h2>
          <p className="text-slate-500 text-sm mt-1">Comparativa de OEE, Disponibilidad y Rendimiento.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loading ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Calculando métricas de eficiencia...</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="relative w-48 h-48 mb-6">
                      <svg className="w-full h-full transform -rotate-90">
                          <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                          <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={552.92} strokeDashoffset={552.92 * (1 - globalOEE / 100)} className="text-blue-600 transition-all duration-1000 ease-out" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-5xl font-black text-slate-800">{globalOEE}%</span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">OEE Global</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

#### 2.3.5. DailyTimelineView.tsx (Línea de Tiempo Diaria)

```tsx
import React, { useState, useMemo } from 'react';
import { Clock, Calendar, Loader2, AlertTriangle, CheckCircle2, Info, ChevronRight, Activity, Timer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchDowntimes, fetchProductionStats } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric } from '../../types';
import { DateFilter } from '../DateFilter';

const TimelineBar: React.FC<{ events: DowntimeEvent[], shift: string, machine: string }> = ({ events, shift, machine }) => {
    const shiftHours = shift === 'Mañana' ? [6, 14] : shift === 'Tarde' ? [14, 22] : [22, 6];
    
    return (
        <div className="h-8 bg-emerald-500/20 rounded-md relative overflow-hidden border border-emerald-500/30">
            {events.map((event, idx) => {
                if (!event.startTime) return null;
                const [h, m] = event.startTime.split(':').map(Number);
                let startPos = 0;
                if (shift === 'Noche') {
                    const totalMins = h >= 22 ? (h - 22) * 60 + m : (h + 2) * 60 + m;
                    startPos = (totalMins / 480) * 100;
                } else {
                    startPos = (((h - shiftHours[0]) * 60 + m) / 480) * 100;
                }
                const width = (event.durationMinutes / 480) * 100;
                
                return (
                    <div 
                        key={idx}
                        className="absolute h-full bg-red-500 border-x border-red-600/50 group cursor-help"
                        style={{ left: `${Math.max(0, startPos)}%`, width: `${width}%` }}
                    >
                        <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl z-50 whitespace-nowrap min-w-[150px]">
                            <p className="font-bold border-b border-slate-700 pb-1 mb-1">{event.reason}</p>
                            <p className="flex justify-between"><span>Inicio:</span> <span>{event.startTime}</span></p>
                            <p className="flex justify-between"><span>Duración:</span> <span>{event.durationMinutes} min</span></p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const DailyTimelineView: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date()
  });

  const { data: downtimes = [], isLoading: loadingDowntimes } = useQuery({
    queryKey: ['downtimes', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchDowntimes(dateRange.start, dateRange.end),
  });

  const handleFilterChange = (range: { start: Date, end: Date }) => {
      setDateRange(range);
  };

  const shifts = ['Mañana', 'Tarde', 'Noche'];
  const machines = ['Paletizadora 1', 'Paletizadora 2', 'Paletizadora 3', 'Paletizadora 4', 'Paletizadora 5'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Timeline de Producción</h2>
          <p className="text-slate-500 text-sm mt-1">Visualización cronológica de eventos por turno.</p>
        </div>
        <DateFilter onFilterChange={handleFilterChange} />
      </div>

      {loadingDowntimes ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Reconstruyendo línea de tiempo...</p>
          </div>
      ) : (
          <div className="space-y-8">
              {shifts.map(shift => (
                  <div key={shift} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Turno {shift}</h3>
                          <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                              {shift === 'Mañana' ? '06:00 - 14:00' : shift === 'Tarde' ? '14:00 - 22:00' : '22:00 - 06:00'}
                          </span>
                      </div>
                      <div className="p-6 space-y-4">
                          {machines.map(machine => (
                              <div key={machine} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                  <div className="md:col-span-2">
                                      <span className="text-xs font-bold text-slate-500 uppercase">{machine}</span>
                                  </div>
                                  <div className="md:col-span-10">
                                      <TimelineBar 
                                          events={downtimes.filter(e => e.shift === shift && e.machineId === machine)} 
                                          shift={shift}
                                          machine={machine}
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
```

### 2.4. Vistas de Monitoreo

#### `components/views/MonitorView.tsx`
```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Loader2, Activity, Package, Trophy, Box, AlertCircle, Layout, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchDowntimes, fetchProductionStats, fetchStocks } from '../../services/sheetService';
import { DowntimeEvent, ShiftMetric, StockStats } from '../../types';

// ... (Implementación completa con ciclos de 15s, 8s y 10s) ...
// (Ver código fuente original para el MonitorView refinado)
```

---

**REGLA DE ORO:** Para que la aplicación sea idéntica, se deben respetar todos los estilos de Tailwind CSS (gradientes, sombras, desenfoques), los intervalos de actualización en el Monitor View, y la lógica de roles de Clerk (joni0627@gmail.com como administrador supremo).

