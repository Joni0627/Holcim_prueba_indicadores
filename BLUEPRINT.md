# PSC QUBE - Blueprint del Proyecto

Este documento detalla la arquitectura, estructura de archivos y el diseño de cada componente del sistema PSC QUBE para el monitoreo de la planta Malagueño.

## 1. Arquitectura General
El sistema está construido sobre **Next.js 15+** utilizando el **App Router**.
- **Frontend:** React, Tailwind CSS, Lucide React (iconos), Recharts (gráficos), Motion (animaciones).
- **Backend:** API Routes de Next.js.
- **Autenticación:** Clerk (Gestión de usuarios, roles e invitaciones).
- **Base de Datos:** Google Sheets API (como motor de datos principal).
- **IA:** Google Gemini (Análisis predictivo y diagnóstico de planta).

---

## 2. Estructura de Archivos y Diseño de Programación

### `/app` (Rutas y Configuración Next.js)
- **`layout.tsx`**: Configura los proveedores globales (`ClerkProvider` para autenticación y `QueryProvider` para caché de datos). Define la fuente Inter y el tema base.
- **`page.tsx`**: Punto de entrada que renderiza el componente principal `App.tsx`.
- **`globals.css`**: Importa Tailwind CSS y define variables de animación personalizadas.
- **`api/`**: Contiene la lógica de servidor.
    - **`production/route.ts`**: Lee la hoja "PRODUCCION_CABECERA" y "PRODUCCION_LISTA". Calcula OEE (Disponibilidad, Rendimiento, Calidad) y agrupa por turno y máquina. Implementa caché de 1 minuto.
    - **`paros/route.ts`**: Filtra eventos de la hoja "PAROS". Convierte tiempos HMS a minutos y categoriza por motivo y sector.
    - **`stocks/route.ts`**: Lógica compleja que combina el snapshot de "DETALLE CONTEO" con la producción del turno noche de "PRODUCCION_LISTA" para dar el stock real al inicio del día.
    - **`breakage/route.ts`**: Analiza roturas por proveedor, material y sector. Genera claves seguras para Recharts.
    - **`analyze/`**: Endpoints que construyen prompts técnicos para Gemini y devuelven diagnósticos en JSON.
    - **`admin/`**: Rutas protegidas para que solo el admin (o `joni0627@gmail.com`) pueda invitar usuarios y cambiar roles vía Clerk.

### `/components` (Interfaz de Usuario)
- **`App.tsx`**: El "cerebro" del frontend. Gestiona el estado de la vista actual, el menú lateral colapsable, la lógica de roles (isAdmin/isOwner) y la pantalla de carga (Splash Screen).
- **`AdminPanel.tsx`**: Interfaz completa para gestión de usuarios. Usa `useUser` de Clerk y llama a las APIs de admin para invitar, revocar y listar usuarios.
- **`views/`**: Vistas modulares del dashboard.
    - **`SummaryView.tsx`**: Vista general con KPIs principales. Integra `html2canvas` para permitir compartir capturas del dashboard.
    - **`MonitorView.tsx`**: Diseñado para pantallas grandes en planta. Cicla automáticamente entre datos de producción y stock. Muestra una línea de tiempo en tiempo real.
    - **`DailyTimelineView.tsx`**: Gráfico de Gantt personalizado que muestra el estado de las máquinas y los paros a lo largo de las 24 horas.
    - **`DowntimeView.tsx`**: Análisis de Pareto y distribución de paros.
    - **`BreakageView.tsx`**: KPIs de merma y análisis de proveedores.
- **`StatCard.tsx`**: Componente reutilizable para tarjetas de métricas con indicadores de tendencia.
- **`AIAnalyst.tsx`**: Componente que muestra los insights generados por Gemini con animaciones de escritura.

### `/services` (Lógica de Datos)
- **`sheetService.ts`**: Capa de abstracción que realiza los `fetch` a las API Routes. Centraliza las llamadas para que los componentes no manejen URLs directamente.
- **`geminiService.ts`**: Orquestador de análisis de IA. Llama a los endpoints de `/api/analyze/*`.
- **`mockData.ts`**: Datos de respaldo para desarrollo y pruebas sin conexión a Google Sheets.

### `/lib` (Utilidades)
- **`ai.ts`**: Cliente de Gemini con lógica de "Fallback" (si falla un modelo, intenta con otro) y limpieza de strings para asegurar JSON válido.
- **`utils.ts`**: Funciones de ayuda para Tailwind (`cn`) y formateo de números/fechas.

---

## 3. Reglas de Oro para la Replicación
1. **Identidad Visual:** Mantener el esquema de colores `slate-900` para fondos oscuros y `emerald-500` para acentos positivos.
2. **Seguridad:** Nunca exponer las Keys de Google o Clerk en el cliente. Usar siempre las API Routes.
3. **Robustez:** El parsing de datos de Google Sheets debe ser tolerante a errores (manejar puntos, comas y celdas vacías).
4. **Interactividad:** Todas las transiciones de vista deben usar `motion` (framer-motion) para una experiencia fluida.
5. **Admin Hardcoded:** El email `joni0627@gmail.com` siempre debe ser tratado como Super Admin independientemente de los metadatos de Clerk.
