# Reglas de Oro: Conexiones API y Seguridad

Este documento establece los estándares para las integraciones con Google Sheets y Gemini AI, garantizando seguridad, escalabilidad y facilidad de replicación.

## 1. Google Sheets API (Lectura de Datos)

### Configuración de Variables
- **GOOGLE_SERVICE_ACCOUNT_EMAIL**: Email de la cuenta de servicio (ej: `service-account@project.iam.gserviceaccount.com`).
- **GOOGLE_SERVICE_ACCOUNT_KEY**: Clave privada completa (incluyendo `-----BEGIN PRIVATE KEY-----`).
- **GOOGLE_SHEET_ID**: El ID de la hoja de cálculo (extraído de la URL).

### Reglas de Oro
1. **Acceso de Solo Lectura**: La cuenta de servicio debe tener permisos de "Lector" en la hoja de cálculo para minimizar riesgos.
2. **Caché del Lado del Servidor**: Implementar un caché (TTL de 30-60s) en las API Routes para evitar exceder las cuotas de Google y mejorar el rendimiento.
3. **Limpieza de Datos**: Nunca exponer datos sensibles de la hoja (como IDs de usuario o correos) si no son necesarios para la visualización.
4. **Manejo de Errores**: Siempre devolver un arreglo vacío o un estado controlado si la hoja no está disponible, evitando que la app se rompa.

## 2. Gemini AI (Análisis Inteligente)

### Configuración de Variables
- **API_KEY**: Clave de API de Google AI Studio.

### Reglas de Oro
1. **Llamadas Server-Side**: Las llamadas a Gemini **DEBEN** realizarse desde API Routes (`/api/*`). Nunca exponer la `API_KEY` en el cliente.
2. **Librería Centralizada**: Usar `/lib/ai.ts` para todas las interacciones con la IA. Esto permite manejar modelos en cascada (fallback) y sanitización de JSON en un solo lugar.
3. **Prompt Engineering**: Usar instrucciones de sistema claras para que la IA responda estrictamente en formato JSON, facilitando el parseo en el front-end.
4. **Mecanismo de Respaldo (Fallback)**: Implementar una lógica de análisis local (basada en reglas) por si la cuota de la IA se agota o hay un error de red.
5. **Sanitización de JSON**: Limpiar la respuesta de la IA (quitar bloques de código markdown) antes de intentar parsear el JSON.

## 3. Estándares de Seguridad

### Autenticación
- **Protección de Rutas**: Todas las API Routes deben estar protegidas por middleware (Clerk) para asegurar que solo usuarios autenticados puedan consultar los datos de planta.
- **Verificación Explícita**: Además del middleware, cada API Route debe verificar `auth().userId` al inicio de la función para garantizar que la sesión es válida.
- **Variables de Entorno**: Nunca usar el prefijo `NEXT_PUBLIC_` para claves secretas (`API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`).

### Integridad de Datos
- **Validación de Entradas**: Validar los parámetros de consulta (como rangos de fechas) para evitar inyecciones o errores de procesamiento.
- **HTTPS**: Todas las conexiones externas deben realizarse sobre HTTPS.

### Monitoreo
- **Logs de Error**: Registrar errores de API en el servidor para diagnóstico rápido sin exponer detalles técnicos al usuario final.
