# Mobile — Auditoría del estado actual (Iteración 1: MOBILE_AUDIT)

- **Iteration ID:** nexusmed-mobile-001 · **Modo:** MOBILE_AUDIT · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Alcance de esta auditoría:** análisis de **código** + verificación de **páginas públicas** en viewport móvil (375px) en el navegador. **NO** incluye pruebas en dispositivos físicos ni en pantallas autenticadas del dashboard (requieren sesión y hardware real). Esos huecos están marcados como **PENDIENTE (dispositivo real)** y son trabajo de las iteraciones siguientes.

## Método y honestidad de la medición
- Lo verificable ahora: estructura del código (viewport, safe-areas, breakpoints, navegación, targets táctiles, grids/tablas, tamaño de JS) y render de rutas públicas en 375px.
- Lo NO verificable ahora (marcado PENDIENTE): tiempos/toques reales por tarea, render en iPhone/Android reales, teclado cubriendo campos, notch/Dynamic Island, offline, VoiceOver/TalkBack, INP/LCP/CLS de campo. **No se inventan cifras** — donde no medí, digo "pendiente" y cómo medirlo.

## Cimientos que YA están bien
- **Viewport:** `viewportFit: "cover"`, `width: device-width`, `maximumScale: 5` → **zoom permitido** (no bloquea accesibilidad). (`src/app/layout.tsx`)
- **PWA:** `src/app/manifest.ts` presente; Service Worker `nexusmed-v373`.
- **Navegación móvil:** `BottomNav` con **5 destinos**, target `minHeight: 52px` (≥44px), `padding-bottom: env(safe-area-inset-bottom)`. Drawer lateral + botón `Menu` en teléfono.
- **Safe areas:** usadas en `globals.css`, `BottomNav`, y páginas públicas de reserva/unión.
- **Anti-pérdida (consulta):** autoguardado cada 30 s + respaldo local con `respaldoKey`, guardado serializado (evita duplicados). Diálogo de confirmación **in-app** (arreglado hoy; ya no depende de `window.confirm`).
- **Público responsive verificado en 375px:** `/demo/interactivo`, `/contacto`, `/evidencia`, hero `ProductWindow` de la landing → sin overflow horizontal, targets usables (verificado en navegador esta sesión).

## Problemas encontrados (clasificados por categoría §1.3 del programa)

### Navegación
- **BottomNav sin acción principal contextual.** Son 5 destinos planos; el programa (Iter. 3) pide un botón central que cambie por contexto (Nueva cita / Nueva nota / Dictar). Además el destino "Consulta" apunta a `/pacientes` (etiqueta ≠ ruta) → posible confusión. **[NAV-1]**

### Layout / responsive
- **Calendario semanal `56px repeat(7,1fr)`** (`calendario/page.tsx:173,197`): 7 columnas de día en 375px ≈ 45px c/u → apretado; no se detectó vista "día" compacta para teléfono. **[LAY-1]**
- **Grids `repeat(3,1fr)` fijos** en `finanzas`, `corte-caja`, `farmacia`, `configuracion`: 3 columnas en 375px ≈ 115px → tarjetas de estadística al límite; conviene colapsar a 1–2 col. **[LAY-2]**
- **Anchos fijos grandes sin `maxWidth`** (540px, 420px, 900px — 3 instancias): riesgo de overflow horizontal en teléfono; verificar contexto por instancia. **[LAY-3]**
- **Tablas clínicas** en `nota/[…]` y `hospitalizacion/[…]` (+ `components/ui/Table.tsx`): riesgo de ilegibilidad en móvil. `hospitalizacion` ya usa `overflow-x` (mitigación parcial); `nota` no. **[LAY-4]**

### Táctil / entrada
- **10 `alert()` nativos** en el dashboard (validaciones): **misma clase de fallo que el `window.confirm` de hoy** — se ignoran en silencio en apps instaladas → el usuario no ve el mensaje de validación. Migrar a toast/in-app. **[TCH-1]**
- Teclado cubriendo campos, `Enter/Next/Done`, target real de iconos pequeños: **PENDIENTE (dispositivo real)**. **[TCH-2]**

### Flujo clínico
- **No existe una pantalla "Consulta actual" unificada** para teléfono (Iter. 4): `consulta/[patientId]` es una página larga con muchas secciones; en móvil implica mucho scroll y cambios de contexto. **[FLW-1]**

### Rendimiento
- **JS servido ≈ 5.3 MB** (sin gzip, en disco); **chunk mayor ≈ 920 KB**. Señal de carga pesada para Android gama baja / 4G. INP/LCP/CLS de campo: **PENDIENTE (Lighthouse/dispositivo)**. **[PRF-1]**

### Resiliencia / privacidad
- **Borrador clínico en `localStorage` plano** (`consulta`: `respaldoKey` guarda resumen/secciones/dx/medicamentos/transcripción). Viola §7.2 ("no usar localStorage para PHI sin protección"). Además no se detectó flush explícito en `visibilitychange`/`beforeunload` para el momento de bloquear pantalla o cambiar de app. **[RES-1]**
- Comportamiento offline, cola de sincronización, conflictos entre dispositivos: **PENDIENTE (revisión + dispositivo real)**. **[RES-2]**

### Seguridad / privacidad móvil
- PHI en notificaciones bloqueadas, ocultar datos en app-switcher, caché sensible al cerrar sesión: **PENDIENTE (revisión Iter. 8–9)**. **[SEC-1]**

### Accesibilidad
- Contraste, VoiceOver/TalkBack, orden de foco, texto aumentado sin ruptura: **PENDIENTE (dispositivo real, Iter. 10)**. `prefers-reduced-motion` ya se respeta en varios componentes nuevos. **[A11Y-1]**

## Conclusión
La base móvil es **mejor de lo esperado** (viewport correcto, BottomNav, safe-areas, PWA, autosave). Los focos reales para las siguientes iteraciones: **acción contextual + tablas/calendario responsive (Iter. 2–3)**, **pantalla de consulta unificada (Iter. 4)**, **alert()/teclado (Iter. 5)**, **peso de JS (Iter. 6)** y **PHI en localStorage + offline (Iter. 7)**. Ver `prioritized-backlog.md`.
