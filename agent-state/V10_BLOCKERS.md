# V10 — Blockers

> Un blocker no detiene el programa: se documenta, se recomienda el mejor
> default y se sigue con otra tarea (V10 §5, §42).

## B-V10-1 · Trabajo V9 sin fusionar — **RESUELTO (9-ago-2026, PR #279)**

El dueño fusionó `claude/nexus-patient-ux-v9` a main (merge `56d9fc7`,
«decisión V10-D1»). Verificado por **ancestría de commits**, no por el acta:
`5bb1a2c` (DESIGN-SYSTEM-001), `fed81cc` (NAVIGATION-001) y `5d496cf`
(PATIENT-COMPANION-001) son ancestros de `origin/main`, y la rama V10 ya
absorbió ese main (merge `2290b71`).

**Consecuencia**: `V10-CONSTITUTION-001` (V10-DEBT-001/002 del backlog) queda
**desbloqueada** — el sistema de diseño canónico vive en main y V10 construye
encima, no en paralelo.

<details><summary>Texto original del blocker (histórico)</summary>

`origin/claude/nexus-patient-ux-v9` (6feaf5a) lleva **8 commits que main no
tiene**: DESIGN-SYSTEM-001 (REG-274/275), NAVIGATION-001 (REG-276…279) y
PATIENT-COMPANION-001 (REG-280/281). La rama está 48 commits detrás de main.
</details>

- **Riesgo**: si V10 rediseña sobre main sin ese trabajo, lo duplica o lo
  pisa — prohibido por V10 §41 y por la orden del dueño de preservar V7/V9.
- **Default recomendado**: fusionar la rama V9 a main (o abrir su PR) antes de
  que V10 toque sistema de diseño, navegación o compañero del paciente.
- **Mientras tanto**: V10 avanza con TRUTH-001 (auditoría y estado), que no
  toca esos archivos.
- **Decisión**: del dueño — registrada en `V10_OWNER_DECISIONS_REQUIRED.md`.

## B-V10-2 · Capturas del golden flow autenticado — **RESUELTO (9-ago-2026)**

El arnés existe y corre completo: `npm run capturas:golden` levanta Auth +
Firestore emulados (`firebase emulators:exec`, nunca deja servidores vivos),
siembra el consultorio sintético (`scripts/design/sembrar-emulador.mjs`),
enciende la compuerta de emuladores del cliente
(`src/lib/firebase-emuladores.ts`, doble cerrojo probado al derecho y al
revés) y captura el golden flow con sesión iniciada: 7 pantallas × escritorio
y móvil. Evidencia: `docs/design/capturas/golden-flow/*.png`; puntuaciones en
`V10_VISUAL_SCORECARD.json`.

Lecciones que costaron corridas, escritas para no reaprenderlas:

- **Next 16 bloquea `/_next/*` como cross-origin**: navegar por `127.0.0.1`
  cuando Next considera `localhost` el origen permitido aborta TODOS los
  chunks (ERR_ABORTED) sin un solo error de JS — la página queda en el
  spinner SSR para siempre. Se navega por `localhost`.
- `networkidle` **nunca llega** con Firestore vivo (websocket permanente):
  `domcontentloaded` + espera de contenido.
- En dev la primera visita compila la ruta (>30 s): se calienta cada ruta
  con `fetch` antes de abrir el navegador.
- La salida del servidor va a archivo, spawn `detached`, y se mata el grupo
  de proceso entero: un pipe huérfano bloquea a next dev en el write y deja
  un zombi con el puerto tomado.
- El chromium del entorno se lanza por `executablePath` fijo y
  `--no-proxy-server`.

<details><summary>Texto original del blocker (histórico)</summary>

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
</details>

## Sin blockers abiertos

Lo que requiere decisión del dueño vive en `V10_OWNER_DECISIONS_REQUIRED.md`;
nada de ello detiene la siguiente unidad.
