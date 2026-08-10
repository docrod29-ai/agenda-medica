# V10 — Blockers

> Un blocker no detiene el programa: se documenta, se recomienda el mejor
> default y se sigue con otra tarea (V10 §5, §42).

## B-V10-1 · Trabajo V9 validado sin fusionar — **RESUELTO (9-ago-2026, V10-D1)**

El dueño decidió V10-D1: la rama V9 se fusionó a main (PR #279, `56d9fc7`),
con las REG de V9 renumeradas a 294…305 y los sellos en unión. Ya no hay
trabajo V9 validado fuera de main. **Consecuencia**: `V10-DEBT-001/002`
(sistema de diseño) quedan desbloqueados — ver `V10_BACKLOG.json`.

## B-V10-2 · Capturas de pantalla reales — **RESUELTO (9-ago-2026)**

El arnés completo existe y corrió de punta a punta:

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

**Segundo arnés de la corrida paralela (también en el repo)**:
`scripts/design/arnes-capturas-v10.sh` (emuladores demo → siembra
`scripts/design/sembrar-demo-v10.mjs` → `next start` con build real →
playwright `scripts/design/capturas-v10.mjs` → axe `scripts/design/axe-v10.mjs`).
Fotografía el build de PRODUCCIÓN (el otro usa `next dev`). El candado demo-*
de `src/lib/firebase.ts` tiene guardián (`emulador-solo-demo.test.ts`, probado
al revés).

**Tercer arnés (corrida nocturna del 9-ago, también en el repo)**:
`scripts/design/sembrar-capturas.mjs` (consultorio sintético: médica, prueba
con 9 días restantes, 6 pacientes, 7 citas) + `scripts/design/capturar-golden-flow.mjs`
(login real, tour marcado visto, 7 pantallas × 3 anchos, axe en escritorio,
errores de consola). Receta en `docs/design/capturas/v10-truth/README.md`.
Su primera corrida encontró y reparó **2 defectos reales el mismo día**
(REG-307, REG-308).

**TRES arneses para lo mismo es deuda** — cada corrida paralela del 9-ago
construyó el suyo sin ver a las otras (ver la lección de concurrencia en
`V10_DECISION_LOG.md`). Consolidar en UNO al abrir V10-VISUAL-REGRESSION-001
(registrado en el backlog como V10-HARNESS-CONSOLIDAR).

## (sin blockers abiertos)
