# V10 — Blockers

> Un blocker no detiene el programa: se documenta, se recomienda el mejor
> default y se sigue con otra tarea (V10 §5, §42).

## B-V10-1 · Trabajo V9 validado sin fusionar — **RESUELTO 9-ago-2026**

El dueño decidió V10-D1: la fusión se ejecutó (`d088c34`, REG renumeradas a
291…305) y entró a main por el PR #279 (`56d9fc7`). V10-DEBT-001/002 quedan
desbloqueadas. Detalle histórico abajo.

## B-V10-1 (histórico) · Trabajo V9 validado sin fusionar (afecta la secuencia V10)

`origin/claude/nexus-patient-ux-v9` (6feaf5a) lleva **8 commits que main no
tiene**: DESIGN-SYSTEM-001 (REG-274/275), NAVIGATION-001 (REG-276…279) y
PATIENT-COMPANION-001 (REG-280/281). La rama está 48 commits detrás de main.

- **Riesgo**: si V10 rediseña sobre main sin ese trabajo, lo duplica o lo
  pisa — prohibido por V10 §41 y por la orden del dueño de preservar V7/V9.
- **Default recomendado**: fusionar la rama V9 a main (o abrir su PR) antes de
  que V10 toque sistema de diseño, navegación o compañero del paciente.
- **Mientras tanto**: V10 avanza con TRUTH-001 (auditoría y estado), que no
  toca esos archivos.
- **Decisión**: del dueño — registrada en `V10_OWNER_DECISIONS_REQUIRED.md`.

## B-V10-2 · Capturas de pantalla reales — **RESUELTO 9-ago-2026**

El arnés completo existe y corrió: emuladores Auth+Firestore
(`demo-nexusmed-test`), siembra sintética (`tests/visual/sembrar-sintetico.mjs`
— aborta sin emuladores), conexión de la app detrás de
`NEXT_PUBLIC_FIREBASE_EMULATORS=1` (`src/lib/firebase.ts`), build de
producción, 36 capturas autenticadas (9 pantallas × 4 anchos) en
`docs/design/capturas/golden-flow/` y línea base axe. Receta completa:
`tests/visual/README.md`. Detalle histórico abajo.

## B-V10-2 (histórico) · Capturas de pantalla reales — MÉTODO PROBADO, alcance parcial

Intento del 9-ago-2026, en esta corrida:

- **Sin variables `NEXT_PUBLIC_FIREBASE_*` la app entera da 500** (hasta la
  landing): `src/lib/firebase.ts` inicializa en import y `auth/invalid-api-key`
  tumba el render.
- **Con `.env.local` demo** (valores no reales, proyecto `demo-nexusmed-test`,
  ignorado por git) la app levanta y las pantallas públicas rinden 200.
- **Capturas verificadas en navegador real** (chromium + playwright del repo):
  landing y login, 1440×900 y 390×844. La landing ya obedece la identidad
  declarada (oscuro, Fraunces sólo display, cobalto en acción); sin cara de IA.
- **Lo que falta para el golden flow autenticado** (salidas 2, 10, 11, 12, 14,
  15 completas): emulador de Auth + Firestore con datos sintéticos sembrados.
  El repo ya trae el camino: `npm run test:emulador` usa
  `firebase emulators:exec --project demo-nexusmed-test`. La siguiente corrida
  construye ese arnés (levantar emuladores + sembrar paciente sintético +
  sesión) y captura las pantallas del golden flow.

Nada de esto usa datos reales ni toca producción.
