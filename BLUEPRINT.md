# PSC QUBE - Blueprint de Proyecto

Este documento establece las "Reglas de Oro" y la arquitectura técnica del proyecto PSC QUBE para su implementación en plantas industriales.

## 1. Arquitectura de Datos
- **Fuente de Verdad:** Google Sheets (vía `sheetService`). Permite una actualización sencilla por parte del personal de planta sin necesidad de bases de datos complejas.
- **Sincronización:** React Query para manejo de caché, estados de carga y re-validación automática.
- **Tipado:** TypeScript estricto para asegurar la integridad de los datos desde la hoja de cálculo hasta la UI.

## 2. Identidad Visual (UI/UX)
- **Tema:** Dark Mode (Slate-950) para reducir la fatiga visual en entornos industriales.
- **Contraste:** Uso de colores vibrantes para estados:
  - `Emerald-500`: Operativo / Positivo.
  - `Red-500`: Paro Interno / Crítico.
  - `Amber-500`: Advertencia / Rendimiento Medio.
  - `Blue-500`: Informativo / Stock.
- **Tipografía:** Sans-serif moderna (Inter) con pesos `Black` (900) para KPIs numéricos.

## 3. Funcionalidades Core
- **Home (Summary):** Dashboard ejecutivo con KPIs principales (OEE, Disponibilidad, Rendimiento).
- **Cronograma Diario:** Visualización tipo Gantt de la operación por turno y máquina.
- **Monitor de Planta:** Vista de alta fidelidad diseñada para proyectores/monitores en áreas comunes, con auto-refresco cada 20 minutos.
- **Compartir:** Generación de reportes visuales mediante `html2canvas` para distribución rápida por mensajería.

## 4. Reglas de Oro de Implementación
1. **Prioridad de Carga:** Siempre mostrar estados de carga (`Loader`) claros mientras se sincronizan los datos de planta.
2. **Responsividad:** El sistema debe ser 100% funcional en móviles para supervisores en campo.
3. **Kiosk-Ready:** La vista de Monitor debe ser independiente y no requerir interacción para mantenerse actualizada.
4. **Validación de Datos:** Manejar casos de "Sin Datos" de forma elegante para evitar errores de renderizado.
5. **Seguridad:** Integración con Clerk para asegurar que solo personal autorizado acceda a la administración y visualización.

## 5. Guía de Escalabilidad
- Para implementar en nuevas empresas, solo es necesario clonar el repositorio y actualizar las `SHEET_ID` y el mapeo de columnas en `sheetService.ts`.
- Los turnos y máquinas se configuran en `DailyTimelineView.tsx` y `MonitorView.tsx` mediante el objeto `SHIFT_MAP`.
