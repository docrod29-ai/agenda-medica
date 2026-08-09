# V10 — iteración en curso

**Iteración**: `V10-TRUTH-001` — auditoría de verdad visual y de producto.
**Estado**: **parcial** — superficie pública verificada en navegador; superficie
clínica con sesión, bloqueada por entorno (ver `V10_BLOCKERS.md`).
**Fecha**: 9-ago-2026 · **Rama**: `claude/kind-brahmagupta-ake878`

---

## Lo que esta corrida hizo de verdad

1. **Leyó** la especificación V10 completa, CLAUDE.md, las reglas de
   `.claude/rules/`, el estado V7/V9 y el historial git. V10 **nunca había
   corrido**: no existía ningún archivo `agent-state/V10_*`.
2. **Desbloqueó el navegador en este contenedor.** El bloqueo que V9 registró
   («build falla sin credenciales de Firebase») tiene una causa más simple:
   `src/lib/firebase.ts:52` hace `getAuth(app)` al evaluar el módulo y sin
   `NEXT_PUBLIC_FIREBASE_API_KEY` **toda** página devuelve 500. Con un
   `.env.local` sintético (claves falsas, no versionado, cubierto por
   `.gitignore`) la superficie pública renderiza completa en `next dev`.
3. **Inspeccionó en navegador real** (Chromium vía CDP, escritorio 1440×900 y
   móvil 390×844): `/`, `/registro`, `/login`, `/precios`, `/demo`,
   `/demo/interactivo` (flujo completo: agenda → dictado → nota → receta →
   herramientas), `/contacto`, `/evidencia`, `/seguridad`, `/paquetes`.
4. **Guardó evidencia**: 10 JPEG en `docs/design/evidence/v10/2026-08-09/`.
5. **Puntuó** lo inspeccionado (`V10_VISUAL_SCORECARD.json`) y **priorizó** el
   backlog (`V10_BACKLOG.json`).
6. **Compuertas**: `npx vitest run` → 8 553 ✓ / 1 ✗ **preexistente y de
   entorno** (`ops-timeout`, ya documentado así en el checkpoint V9: pide una IP
   agujero-negro que en este contenedor responde al instante). Trinquete y build:
   ver cierre de la corrida en `V10_DECISION_LOG.md`.

## Lo que NO afirma

- **Nada de la superficie `medico` (33 pantallas) ni `paciente` con sesión (9)
  se ha visto.** El corazón del producto —agenda real, consulta, nota real,
  recetas reales— sigue sin evidencia visual. El flujo de `/demo/interactivo`
  es una *simulación de marketing* del flujo clínico, no el flujo clínico.
- No hay línea base automatizada de accesibilidad ni de rendimiento todavía.
- Las puntuaciones cubren **sólo** lo que tiene captura.

## Siguiente acción exacta (para la próxima corrida)

**`V10-ENV-001`** — cablear soporte **opcional** de emuladores de Firebase:
`connectAuthEmulator`/`connectFirestoreEmulator` detrás de
`NEXT_PUBLIC_USE_EMULATORS=1` (jamás activo sin la bandera; revisar
`vitest.emulator.config.ts` y `npm run test:emulador`, que ya usan
`firebase emulators:exec`), más una semilla de pacientes sintéticos. Con eso la
próxima corrida abre las pantallas clínicas reales en el navegador y **termina
V10-TRUTH-001**. Es trabajo reversible, no toca producción y no necesita al
dueño.

Si el emulador resultara inviable en este contenedor (descarga de binarios,
red), el plan B está en `V10_BLOCKERS.md` B-1.
