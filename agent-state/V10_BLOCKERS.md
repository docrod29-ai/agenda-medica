# V10 — Blockers

> Un blocker no detiene el programa: se documenta, se recomienda el mejor
> default y se sigue con otra tarea (V10 §5, §42).

## B-V10-1 · Trabajo V9 validado sin fusionar — **RESUELTO 9-ago-2026**

El dueño aprobó **V10-D1** y la rama V9 se fusionó a main vía PR #279
(`56d9fc7`), con las REG de V9 renumeradas a 294…305. `V10-DEBT-001/002`
quedan desbloqueadas. La regla sigue viva: V10 no duplica ni revierte ese
trabajo — se construye encima.

## B-V10-2 · Capturas de pantalla reales — **RESUELTO 10-ago-2026**

El arnés completo existe y corrió entero:

1. **Emuladores** Auth (9099) + Firestore (8080), proyecto
   `demo-nexusmed-test` (`firebase.json` ya declara ambos).
2. **Cableado cliente**: `src/lib/firebase.ts` conecta a los emuladores SOLO
   con `NEXT_PUBLIC_FIREBASE_EMULATOR=1` (opt-in, jamás en producción).
3. **Cableado servidor**: las rutas API necesitan `FIRESTORE_EMULATOR_HOST` y
   `FIREBASE_AUTH_EMULATOR_HOST` en el entorno del dev server — sin ellas,
   toda auditoría devuelve 401 (se vio y se corrigió en la corrida 1).
4. **Siembra sintética**: `scripts/design/sembrar-emulador-v10.mjs` — médico,
   consultorio en prueba, 4 pacientes, 6 citas. Las fechas se calculan en
   `America/Mexico_City` (la primera corrida usó UTC y la agenda salió vacía —
   la misma lección de REG-293).
5. **Captura**: `scripts/design/capturar-golden-flow.mjs` — login real,
   descarte del tour (Escape: «Saltar» tiene dos coincidencias y el modo
   estricto de Playwright truena), 8 pantallas × 4 viewports, axe-core por
   pantalla, JPEG q80. Evidencia en `tests/visual/capturas/`.

Nada de esto usa datos reales ni toca producción. `.env.local` (git-ignorado)
lleva los valores demo; recrearlo es copiar el bloque documentado aquí arriba.
