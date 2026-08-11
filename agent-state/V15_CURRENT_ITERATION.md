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

### V15-BASELINE-001 — CERRADA (11-ago-2026)

- Capturas "before" del golden flow: 7 pantallas × 3 anchos + axe + consola en
  `docs/design/capturas/v15-baseline-before/` (arnés existente
  `capturar-golden-flow.mjs`, build de producción, datos sintéticos).
- IA medida en fuente: **23 destinos primarios** de médico
  (21 `NAV` + 2 Sistema) vs objetivo ≤5. Crítica estructural y métricas en
  `docs/design/capturas/v15-baseline-before/BASELINE.md`.
- Axe base: calendario 4 violaciones (button-name crítico), pacientes 1,
  resto 0.

## Siguiente tarea exacta

`V15-IA-001`: sitemap nuevo con ≤5 contextos de médico (TODAY · PATIENT ·
ENCOUNTER · WORK/FOLLOW-UP · SEARCH/COMMAND), separación Operations, mapa de
capacidades contextuales y plan de compatibilidad de rutas — y arrancar
`V15-SHELL-GREYBOX-001` (Instrument Strip + Flow Rail + Canvas + Lens en
greybox) en la misma corrida si el tiempo alcanza.

## Reglas de la corrida (recordatorio)

- Una sola rama V15; sin PR nuevo por corrida; nunca force-push.
- Estructura antes que piel; greybox antes de estilo.
- Lógica clínica/negocio congelada.
