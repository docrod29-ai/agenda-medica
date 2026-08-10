# V10 — iteración en curso

## `V10-TRUTH-001` · parte 1 CERRADA en este run (10-ago-2026)

Qué quedó hecho:

1. **Bootstrap completo del estado V10** (primer run real del programa; los
   commits «V10» anteriores sólo arreglaban el documento de la directiva).
2. **Auditoría en navegador** de la superficie pública / entrada del golden
   flow: 16 capturas escritorio+móvil + 4 del flujo del demo clínico, en
   `docs/design/screenshots/v10/`. Informe: `docs/design/V10_TRUTH_AUDIT.md`.
   Puntuaciones con evidencia: `agent-state/V10_VISUAL_SCORECARD.json`.
3. **D-1 reparado**: desajuste de hidratación (`data-theme`) que ensuciaba la
   consola en todas las páginas → `suppressHydrationWarning` en `<html>`
   (`src/app/layout.tsx`), según la guía oficial incluida en
   `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.
   Verificado corriendo: 0 errores de consola en 4 rutas.
4. Herramientas reproducibles: `scripts/design/v10-capturas.mjs`,
   `scripts/design/v10-demo-flujo.mjs`.

Puertas: vitest 8554 ✅ · trinquete lint ✅ · trinquete de diseño ✅ · build ✅.

## SIGUIENTE ACCIÓN EXACTA (para el próximo run)

**Opción A (si el dueño respondió V10-O1)**: cablear emulador sólo-dev y abrir
V10-TRUTH-001 parte 2 (pantallas `medico` corriendo, con datos sintéticos).

**Opción B (por omisión, sin esperar a nadie)**: `V10-CONSTITUTION-001` —
trabajo seguro y medible que no toca pantallas de V7/V9:

1. Leer `docs/design/NEXUS_DESIGN_SYSTEM.md` §1-§3 y el trinquete.
2. Elegir el peor archivo del trinquete que NO esté en vuelo de V7/V9
   (consultar `git log --since=... -- <ruta>` antes): candidatos
   `configuracion/page.tsx` (168 pts) o `uci/page.tsx` (131 pts, alpha).
3. Migrar tamaños/radios fuera de escala a tokens, bajar techos con
   `node scripts/design/trinquete-de-diseno.mjs --actualizar`, y correr las
   puertas completas.
4. Además: puntuar `/demo` y `/demo/razonamiento` mirándolas (15 min), y línea
   base de accesibilidad con axe sobre lo público.

Reglas de coordinación: antes de editar cualquier pantalla, `git fetch` y mirar
si V7/V9 la tocaron en los últimos días. V9 es dueño de `/mi/**` y
`/api/portal/**`.
