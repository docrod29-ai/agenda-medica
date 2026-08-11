# V15 — estado vivo

**Rama canónica:** `v15/structural-uiux` · **PRs V15 abiertos:** 0

## Iteración en curso

`V15-BASELINE-001` — arrancada 11-ago-2026.

### Hecho en esta iteración

- **Prioridad 1 del routine (CSS de `.nx-stat-grid`) — resuelta.** El
  diagnóstico real no fue de parseo: la regla parsea bien (llaves balanceadas
  fuera de comentarios) y llega al navegador. El defecto era la regla hermana
  «escrito y sin conectar»: `.nx-stat-grid` llevaba desde el 4-ago-2026
  declarada «No cableada aún» en
  `docs/mobile/iteration-02-responsive-foundation.md` y **ningún** componente
  la usaba. Las cinco rejillas `repeat(3, 1fr)` que debía colapsar seguían
  fijas y desbordaban en teléfono.
- Cableada en sus cinco destinos documentados:
  - `src/app/(dashboard)/finanzas/page.tsx` (KPIs secundarios)
  - `src/app/(dashboard)/corte-caja/page.tsx` (embudo)
  - `src/app/(dashboard)/farmacia/page.tsx` (tarjetas de resumen)
  - `src/app/(dashboard)/cumplimiento/retencion/page.tsx` (resumen rápido)
  - `src/app/(dashboard)/configuracion/secciones-recetas.tsx` (estilos)
- Guardián: `src/__tests__/nx-stat-grid-cableada.test.ts` (probado al revés:
  6/10 casos fallan sin el cableado).
- Arnés de verificación en navegador:
  `scripts/design/capturar-stat-grid-v15.mjs` (mide columnas computadas reales
  a 1440/500/360 y falla si el colapso no es 3→2→1).
- **Verificado en navegador real** (11-ago-2026, build de producción +
  emuladores demo + siembra sintética): 15/15 mediciones correctas (5 pantallas
  × 3 anchos, colapso 3→2→1). Capturas en
  `docs/design/capturas/v15-stat-grid/` con `medidas-grid.json`.
- Compuertas: vitest 8656 pasan (1 fallo PRE-EXISTENTE y ambiental,
  `ops-timeout-y-punto-ciego` — también falla con el árbol limpio en este
  contenedor por el proxy de red) · trinquete 96 = techo, sin deuda nueva ·
  `npm run build` compila (necesita `.env.local` demo en contenedor fresco;
  sin él, `/dr/[clinicId]` truena con auth/invalid-api-key al recolectar
  page data — ambiental, no del cambio).

### Hallazgo de paso (para V15-VISUAL-SYSTEM / coherencia)

En móvil el encabezado dice «Agenda Médica» mientras el escritorio ya dice
«Ausculta» — marca inconsistente tras el renombre (commit 2ee0ba9). No se toca
en esta corrida (fuera de alcance de la prioridad 1); queda anotado.

### Pendiente de esta iteración (V15-BASELINE-001)

- Inventario de pantallas + conteo de destinos de navegación primaria.
- Capturas "before" del golden flow (el arnés V10 ya existe:
  `docs/design/capturas/v10-truth/README.md`).
- Mapa de IA actual + métricas de flujos golden (base para V15-IA-001).
- Crítica estructural (no de color) por escrito.

## Siguiente tarea exacta

Completar V15-BASELINE-001: correr el arnés de capturas para la línea base
"before", contar los destinos del sidebar actual y producir el mapa de IA
existente. Después: `V15-IA-001` (sitemap nuevo, ≤5 destinos de médico,
separación Operations).

## Reglas de la corrida (recordatorio)

- Una sola rama V15; sin PR nuevo por corrida; nunca force-push.
- Estructura antes que piel; greybox antes de estilo.
- Lógica clínica/negocio congelada.
