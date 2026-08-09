# V10 — Blockers

> Un blocker no detiene el programa: se documenta, se recomienda el mejor
> default y se sigue con otra tarea (V10 §5, §42).

## B-V10-1 · Trabajo V9 validado sin fusionar — RESUELTO el 9-ago-2026 (V10-D1)

El dueño decidió V10-D1. El merge de main (v1163) en la rama V9 quedó resuelto
(colisión de REG renumerada a 291…302, mecanismo de audio unificado en el de
main, trinquete de diseño respetado) y el **PR #279** espera CI + fusión.
En cuanto main lo tenga: fusionar main a la rama V10 y abrir
V10-CONSTITUTION-001.

Historia del blocker (referencia):

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

## B-V10-2 · Capturas de pantalla reales — RESUELTO el 9-ago-2026

El arnés completo existe y corrió de punta a punta en esta corrida:

- `tests/visual/sembrar-sinteticos.mjs` — siembra sintética (clínica, membresía,
  config, 4 pacientes, 5 citas de hoy) contra emuladores Auth+Firestore; se
  niega a correr fuera de `demo-nexusmed-test`.
- `tests/visual/arnes-capturas.mjs` — sesión real por email+contraseña y captura
  del golden flow en 1440/1024/768/390 → `tests/visual/capturas/`.
- `tests/visual/arnes-a11y.mjs` — axe WCAG A/AA sobre las mismas pantallas.
- Cableado reversible: `connectAuthEmulator`/`connectFirestoreEmulator` en
  `src/lib/firebase.ts`, SOLO con `NEXT_PUBLIC_FIREBASE_EMULATORS=1` (.env.local).

Trampas documentadas para la siguiente corrida: usar `localhost` (no
`127.0.0.1` — Next 16 bloquea los recursos de dev de origen cruzado y la página
nunca hidrata), `--no-proxy-server` en Chromium, `waitUntil: 'load'` (los
onSnapshot de Firestore impiden networkidle), y pre-marcar en localStorage el
tour (`nexus_tour_v1_<uid>`) y el opt-in de push (`agenda-medica:push-dismissed`).

Historia del intento original (referencia):

### (histórico) Capturas de pantalla reales — MÉTODO PROBADO, alcance parcial

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
