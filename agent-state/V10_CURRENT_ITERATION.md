# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: historia V10 encadenada — `claude/nexus-visual-excellence-v10`
(instalación) → `claude/kind-brahmagupta-exbp9m` (arnés) →
`claude/kind-brahmagupta-2yxowl` (cierre TRUTH-001) →
`claude/kind-brahmagupta-rms50y` (quick-strike NOTE-001, 9-ago). Cada sesión
cloud empuja a su rama configurada y arranca de la punta más adelantada
(V10 §3). OJO para la siguiente corrida: la punta es **rms50y**.

**Iteración en curso**: `V10-NOTE-001` — el **quick-strike quedó CERRADO**
(DEBT-008 y DEBT-009). La unidad completa de §20 (editor premium, tiempo a
primer borrador, rendimiento de la ruta) sigue en la secuencia normal.

## Corrida del 9-ago (madrugada-2) — qué se hizo

| Qué | Evidencia |
|---|---|
| **DEBT-008 cerrado** — la nota BORRADOR es inconfundible | Banda ámbar `role=status` arriba (no-print) · marca de agua SVG «BORRADOR» dentro de `#doc` — pantalla, PDF e impresión (repetida por hoja impresa vía `@media print` en globals.css, porque el popup de impresión sólo copia los `<link>`; la vía membretada la estampa en cada `.nota-sheet`) · Word con banda roja. Capturas `nota--1440.png` / `nota--390.png` nuevas |
| **Contraste serious ×7 reparado de raíz** | `tbody td { color: var(--text2) }` de la app se colaba en el documento-papel (pantalla Y popup de impresión → papel impreso con datos en gris). Los `<td>` del papel llevan `#1a1a1a` inline. Y `tbody tr:hover` pintaba una BANDA oscura sobre Edad/Sexo/Tel — neutralizado con `#doc tbody tr` |
| **DEBT-009 cerrado** — barra móvil | Bajo 480px: barra envuelve, «Atrás» visible, PDF primario a fila completa, resto rejilla 2×N, objetivos 44px. Captura `nota--390.png` |
| **axe nota: 0 critical/serious** en 1440 y 390 | `reporte-a11y.json`: programa 12 → 8 → **6** hallazgos (los 6 restantes: contraste hoy/agenda → V10-TODAY/AGENDA-001, nested-interactive pacientes → DEBT-010) |
| **Guardián probado al revés** | `src/__tests__/nota-borrador-inconfundible.test.ts` — 9/9 fallan sin el arreglo (verificado con stash), 9/9 pasan con él |
| **Scorecard** | nota 7.9 → **8.5** · global 8.2 → **8.27** · cara-de-IA nota se mantiene 1.0 (la marca de agua es práctica documental clásica) |

## Compuertas de esta corrida

- `npx vitest run`: **8 473 pasan · 1 saltada · 1 falla** — la falla es
  `ops-timeout-y-punto-ciego` («el error dice cuánto esperó y a quién»), la
  MISMA falla de entorno documentada en la corrida anterior: espera que
  `10.255.255.1` cuelgue hasta el timeout y el proxy del sandbox contesta al
  instante. No toca nada de esta corrida (el cambio es JSX/CSS puro) y en CI
  de GitHub pasa. No se tocó el test.
- `lint-trinquete`: **96, igual que el techo.**
- `npm run build`: **compila.**
- axe en navegador real: nota **0** critical/serious (ambos anchos).

## Advertencia de concurrencia (V10 §41)

Esta corrida tocó `globals.css` (regla `@media print` de 6 líneas al final del
bloque de tokens de impresión) — archivo que la rama V9 sin fusionar también
toca. El guardián `nota-borrador-inconfundible.test.ts` **falla si una fusión
pierde la regla** (test 4). La nota en sí NO fue tocada por V9: cero riesgo ahí.

## Próxima acción exacta (siguiente corrida)

1. Arrancar de `claude/kind-brahmagupta-rms50y` (o su descendiente más
   adelantado) y verificar si el dueño ya decidió **V10-D1** (fusión V9).
2. Si V10-D1 decidido a favor → **V10-CONSTITUTION-001** (DEBT-001/002) sobre
   main fusionado — es lo que desbloquea todo lo demás.
3. Si no → **quick-strike V10-DEBT-006 en el expediente** (CTA primario «Nueva
   consulta con IA» en 4.º lugar tras tres secundarios de igual peso en móvil):
   `expediente/[patientId]/page.tsx` NO fue tocado por la rama V9 → cero
   riesgo. Con guardián y capturas antes/después.
4. DEBT-003 (agenda móvil, la pantalla más usada) sigue esperando: `citas/page.tsx`
   SÍ está en la rama V9 — sólo con decisión explícita de rebase o tras V10-D1.

### Cómo relanzar el arnés (resumen operativo)

```bash
# 0. .env.local demo (si el contenedor es nuevo — valores NO reales):
#    NEXT_PUBLIC_FIREBASE_API_KEY=demo-nexusmed-api-key
#    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-nexusmed-test.firebaseapp.com
#    NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nexusmed-test
#    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-nexusmed-test.appspot.com
#    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
#    NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demo
#    NEXT_PUBLIC_FIREBASE_EMULATORS=1
# 1. emuladores            npx firebase-tools emulators:start --only firestore,auth --project demo-nexusmed-test
# 2. siembra               FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
#                            GCLOUD_PROJECT=demo-nexusmed-test node tests/visual/sembrar-sinteticos.mjs
# 3. app                   npm run dev
# 4. capturas + rendimiento ARNES_CHROMIUM=/opt/pw-browsers/chromium node tests/visual/arnes-capturas.mjs
# 5. accesibilidad         npm i --no-save axe-core && ARNES_CHROMIUM=... node tests/visual/arnes-a11y.mjs
# Trampas: localhost (no 127.0.0.1), --no-proxy-server, waitUntil:'load',
# pre-marcar tour y push en localStorage (ya lo hacen los arneses).
```
