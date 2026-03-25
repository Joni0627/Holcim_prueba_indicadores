# Rutas del Proyecto - PSC QUBE (Detalle Completo)

Este documento proporciona una guía exhaustiva de todas las rutas del proyecto, incluyendo sus características técnicas, parámetros y lógica de negocio.

---

## 📂 1. Rutas de API (Backend - `/app/api`)

Todas las rutas de API están protegidas por Clerk y requieren autenticación (`auth().userId`). Implementan caché del lado del servidor para optimizar el rendimiento.

### 🔵 Producción (`/api/production`)
- **Método:** `GET`
- **Parámetros:** `start` (YYYY-MM-DD), `end` (YYYY-MM-DD)
- **Hojas de Google:** `PRODUCCION_CABECERA`, `PRODUCCION_LISTA`
- **Características:**
    - Calcula el **OEE** (Disponibilidad, Rendimiento, Calidad).
    - Agrupa producción por **Turno** y **Máquina**.
    - Genera datos para gráficos de barras apiladas (Máquina -> Producto -> Toneladas).
    - **Caché:** 60 segundos.

### 🔵 Paros de Máquina (`/api/paros`)
- **Método:** `GET`
- **Parámetros:** `start` (YYYY-MM-DD), `end` (YYYY-MM-DD)
- **Hojas de Google:** `PARO DE MAQUINA`
- **Características:**
    - Convierte tiempos en formato `H:MM:SS` a minutos decimales.
    - Formatea horas de inicio para visualización (`HH:mm`).
    - Clasifica paros por **Causa SAP**, **HAC** y **Tipo de Paro**.
    - **Caché:** 30 segundos.

### 🔵 Stocks e Inventario (`/api/stocks`)
- **Método:** `GET`
- **Parámetros:** `start` (YYYY-MM-DD), `end` (YYYY-MM-DD)
- **Hojas de Google:** `DETALLE CONTEO`, `PRODUCCION_CABECERA`, `PRODUCCION_LISTA`
- **Características:**
    - **Lógica de Stock Real:** Combina el conteo físico ("DETALLE CONTEO") con la producción del turno noche ("PRODUCCION_LISTA" filtrada por turno "3.NOCHE") para obtener el stock proyectado al inicio del día.
    - Normaliza nombres de productos (quita acentos y convierte a mayúsculas).
    - **Caché:** 60 segundos.

### 🔵 Roturas de Sacos (`/api/breakage`)
- **Método:** `GET`
- **Parámetros:** `start` (YYYY-MM-DD), `end` (YYYY-MM-DD)
- **Hojas de Google:** `PRODUCCION_LISTA`
- **Características:**
    - Analiza descartes en 4 sectores: Ensacadora, No Emboquillada, Ventocheck y Transporte.
    - Calcula el **Índice de Rotura Global** (%).
    - Agrupa por **Proveedor** y **Material**.
    - Genera claves seguras (`id_...`) para compatibilidad con Recharts.
    - **Caché:** 60 segundos.

### 🔵 Análisis de IA (`/api/analyze`)
- **Método:** `POST`
- **Body:** `{ oee, downtimes, production }`
- **Características:**
    - Envía métricas técnicas a **Google Gemini**.
    - Devuelve un diagnóstico ejecutivo, recomendaciones y nivel de prioridad en formato JSON.
    - **Fallback:** Si la IA falla, utiliza un motor de reglas local para generar un análisis básico.

### 🔵 Administración de Usuarios (`/api/admin/*`)
- **Invite (`/api/admin/invite`):** `POST`. Envía invitaciones de Clerk. Solo accesible por Super Admin (`joni0627@gmail.com`) o rol `admin`.
- **Invitations (`/api/admin/invitations`):** `GET` (listar pendientes) y `DELETE` (revocar).
- **Users (`/api/admin/users`):** `GET` (listar todos los usuarios) y `PATCH` (cambiar roles entre `admin` y `user`).

---

## 📂 2. Vistas del Frontend (React - `/components/views`)

Las vistas se renderizan dinámicamente en `App.tsx` según el estado de navegación.

### 🖼️ Resumen General (`SummaryView.tsx`)
- **Propósito:** Panel de control principal con KPIs críticos.
- **Componentes:**
    - Tarjetas de métricas (OEE, Toneladas, Paros).
    - Gráfico de Pareto de paros.
    - Distribución de producción por turno.
    - **Captura de Pantalla:** Usa `html2canvas` para exportar el dashboard como imagen.

### 🖼️ Monitor de Planta (`MonitorView.tsx`)
- **Propósito:** Interfaz de alta visibilidad para pantallas en planta.
- **Características:**
    - Ciclo automático entre datos de producción y stock.
    - Barra de progreso de tiempo real.
    - Modo pantalla completa optimizado.

### 🖼️ Cronograma Diario (`DailyTimelineView.tsx`)
- **Propósito:** Visualización temporal de la jornada.
- **Características:**
    - Gráfico tipo Gantt que muestra estados de marcha y paros por máquina.
    - Eje de tiempo de 24 horas.

### 🖼️ Análisis de Paros (`DowntimeView.tsx`)
- **Propósito:** Diagnóstico profundo de ineficiencias.
- **Características:**
    - Top 10 de causas de parada.
    - Análisis por categoría (Mecánico, Eléctrico, Operativo, etc.).

### 🖼️ Roturas de Sacos (`BreakageView.tsx`)
- **Propósito:** Control de calidad de insumos.
- **Características:**
    - Ranking de proveedores por tasa de rotura.
    - Histórico de merma por día.

### 🖼️ Hoja de Stocks (`StocksView.tsx`)
- **Propósito:** Gestión de inventario de producto terminado.
- **Características:**
    - Tabla detallada de bolsas y toneladas por producto.
    - Indicador de "Producido" vs "Comercializado".

---

## 📂 3. Archivos de Configuración y Soporte

- **`middleware.ts`**: Protege todas las rutas excepto `/sign-in` y `/sign-up`.
- **`lib/ai.ts`**: Cliente de Gemini con lógica de reintento y sanitización de JSON.
- **`services/sheetService.ts`**: Centraliza las llamadas `fetch` a las APIs de Google Sheets.
- **`App.tsx`**: Gestiona el menú lateral colapsable, el estado de la vista actual y la lógica de permisos de usuario.
- **`layout.tsx`**: Configura `ClerkProvider` con el tema visual personalizado (Azul/Slate).
- **`globals.css`**: Define el scrollbar estético y gradientes de fondo.
- **`GOLDEN_RULES.md`**: Estándares de seguridad y manejo de datos que deben seguirse en cada actualización.
