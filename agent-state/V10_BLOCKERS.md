# V10 — Blockers

> Un blocker no detiene el programa: se documenta, se recomienda el mejor
> default y se sigue con otra tarea (V10 §5, §42).

## B-V10-1 · Trabajo V9 validado sin fusionar — **RESUELTO (9-ago-2026)**

El dueño decidió V10-D1: la rama V9 se fusionó a main (PR #279, `56d9fc7`),
con las REG de V9 renumeradas a 294…305 y los sellos en unión. Ya no hay
trabajo V9 validado fuera de main. **Consecuencia**: `V10-DEBT-001/002`
(sistema de diseño) quedan desbloqueados — ver `V10_BACKLOG.json`.

## B-V10-2 · Capturas de pantalla reales — **RESUELTO (9-ago-2026)**

El arnés existe y corrió completo. Piezas, todas en el repo:

1. `src/lib/firebase.ts` conecta a los emuladores **sólo** con
   `NEXT_PUBLIC_FIREBASE_EMULATORS=1` en `.env.local` (gitignorado) **y**
   projectId `demo-*` (candado anti-producción, el de `emulator/entorno.ts`).
2. `firebase.json` declara el emulador de Auth (9099) junto al de Firestore
   (8080). `test:emulador` no cambia (sigue `--only firestore`).
3. `scripts/design/sembrar-capturas.mjs` — consultorio sintético completo:
   médica, clínica en prueba (9 días restantes), 6 pacientes, 7 citas de hoy
   con estados variados. Cero datos reales.
4. `scripts/design/capturar-golden-flow.mjs` — login real, tour marcado visto
   (con la clave real de `OnboardingTour`), 7 pantallas × 3 anchos, axe-core
   WCAG 2.x AA en escritorio, errores de consola recogidos.

**Receta completa** en `docs/design/capturas/v10-truth/README.md`.
Primera corrida: 21 capturas + línea base axe + **2 defectos reales
encontrados y reparados el mismo día** (REG-307, REG-308).

## (sin blockers abiertos)
