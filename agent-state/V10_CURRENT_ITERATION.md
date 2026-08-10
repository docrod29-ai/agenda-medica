# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: la historia V10 quedó **RECONCILIADA POR SEGUNDA VEZ** el
10-ago-2026 en `claude/kind-brahmagupta-ajtolc`. Esa punta contiene:
la cadena completa (instalación → exbp9m → 2yxowl → rms50y → ysxb6q),
iurzog, HOME-001 de la rama canónica, la reconciliación 40oom1 **y** la
corrida nocturna 9r4m7a (REG-307/308, v1169) — más el arreglo de hidratación
que i2uo2j y bttia7 encontraron por separado (portado, con guardián).
Superadas (NO arrancar de ellas ni fusionarlas): c51p2n, 9xajvg, dwmunz,
gu7h9g, i2uo2j, 397pqw, 4tkrhu, ake878, bttia7 — la lista con motivos vive en
`V10_MASTER_STATE.json → ramasSuperadas`.

## Protocolo de arranque (que la fragmentación no se repita)

El 9-ago corrieron **ocho** sesiones V10 en paralelo sin verse: cuatro
construyeron un arnés de capturas cada una, dos repararon el MISMO bug de
hidratación, tres re-auditaron la superficie pública ya auditada. Causa raíz:
cada corrida programada nace en SU rama de sesión (`claude/kind-brahmagupta-*`)
y no puede empujar a la canónica, así que ninguna veía a las demás.

**Protocolo desde ahora, ANTES de trabajar**:

1. `git fetch origin` y comparar por fecha TODAS las ramas
   `claude/kind-brahmagupta-*`, la canónica V10 y main.
2. Arrancar desde la punta más avanzada que contenga `puntaReconciliada`
   (hoy: la fusión del 10-ago); si otra corrida avanzó después, fusionarla
   ANTES de trabajar — nunca rehacer su trabajo.
3. Si hay una corrida viva (push < 10 min), no tocar sus archivos y
   reconciliar sólo cuando quede quieta (V10 §41).
4. Al empujar, dejar en `V10_MASTER_STATE.json → puntaReconciliada` el nombre
   de la rama propia para que la siguiente corrida la encuentre.

**Recomendación al dueño (pendiente)**: fusionar la punta reconciliada a la
rama canónica o a main por PR — mientras la verdad viva en ramas de sesión,
cada reconciliación cuesta una corrida entera.

## Estado tras la fusión del 10-ago

| Qué | Estado |
|---|---|
| **V10-TRUTH-001** | ✅ CERRADA — cerrada dos veces por corridas ciegas entre sí y reconciliada: capturas de dos arneses, scorecard con revisor independiente + lectura nocturna, dos líneas base axe unidas + una tercera confirmatoria, backlog con evidencia |
| **V10-D1 (fusión V9)** | ✅ EJECUTADA: PR #279 en main (`56d9fc7a`); REG de V9 = 294…305 |
| **HOME-001** (/dashboard) | ✅ implementado; la corrida nocturna lo verificó en navegador (8.6/1.0, cero axe tras REG-308); falta contrarrevisión independiente sobre la línea fusionada |
| **REG-307/308** | ✅ reparados con guardián (`lo-que-la-captura-real-midio.test.ts`), sellados, sw v1169 (SIN desplegar) |
| **NOTE-001 quick** (DEBT-008/009) | ✅ cerrado; re-captura `nota--*.png` pendiente |
| **DEBT-005 / DEBT-006a** | ✅ cerrados con guardián (etiquetas del flujo central; CTA primero en expediente móvil) |
| **Hidratación (V10-BUG-001)** | ✅ portado de i2uo2j/bttia7: `suppressHydrationWarning` en `<html>` (el script anti-flicker pone `data-theme` antes de hidratar), con guardián |
| **Trinquete de diseño** | 560 hex / 2020 tamaños / 637 radios (bajó en la fusión anterior; verificar tras esta) |
| **Backlog** | unión de TRES corridas en `V10_BACKLOG.json`; P0 vigente: agenda/citas móvil (DEBT-003) |
| **Arneses de captura** | TRES en el repo (deuda declarada): consolidar en V10-VISUAL-REGRESSION-001 |

## Compuertas de esta corrida (10-ago, reconciliación 2)

Ver mensaje del commit de fusión: vitest + lint-trinquete + build corridos
sobre la línea fusionada ANTES de empujar.

## Próxima acción exacta (siguiente corrida)

1. **`V10-DEBT-003` (P0, adoptado de V10-CITAS-001)**: la fila de `/citas` a
   390 px — botones pintados ENCIMA del texto (evidencia `citas--mobile.png` y
   `agenda--390.png`). Misma cirugía que HOME-001: decidir qué sobra de la
   fila (muro de 4 CTA × 3 colores, filtro duplicado, badge del propio médico,
   teléfono en cada fila) y hacerla apilable. Re-capturar y re-puntuar al
   cerrar.
2. **`V10-A11Y-001` segunda tanda** (la primera cerró en DEBT-005): nombre del
   FAB de luna/tema (todas las pantallas), kebab/lápiz de citas y calendario,
   `nested-interactive` de pacientes/calendario, contrastes «Registrar cobro»
   y ranuras.
3. **Re-captura y puntuación independiente** de `/dashboard` (HOME-001) y
   `nota--*` sobre la línea fusionada — cierra la evidencia de las unidades ya
   implementadas y estrena el promedio vigente del scorecard.
4. **`V10-CONSTITUTION-001`** (DEBT-001/002, sin candado): tokens/utilidades
   SOBRE el sistema de diseño V9 ya en main — no rehacerlo.
5. Si queda espacio: `/calendario` móvil abre en Día (V10-MOBILE-CALENDARIO-SEMANA).
6. Al abrir V10-VISUAL-REGRESSION-001: consolidar los tres arneses en UNO.

### Cómo relanzar el arnés (resumen operativo — contenedor nuevo)

```bash
# 0. .env.local demo (OBLIGATORIO antes de npm run build; valores NO reales):
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
# 3a. app (arnés dev)      npm run dev
# 4a. capturas             ARNES_CHROMIUM=/opt/pw-browsers/chromium node tests/visual/arnes-capturas.mjs
# 5a. accesibilidad        npm i --no-save axe-core && ARNES_CHROMIUM=... node tests/visual/arnes-a11y.mjs
# 3b. ALTERNATIVA prod:    bash scripts/design/arnes-capturas-v10.sh   (build real + siembra propia + axe propio)
# 3c. ALTERNATIVA nocturna: scripts/design/sembrar-capturas.mjs + capturar-golden-flow.mjs
#                           (receta: docs/design/capturas/v10-truth/README.md)
# Trampas: localhost (no 127.0.0.1), --no-proxy-server, waitUntil:'load',
# esperar a que el emulador ESCUCHE antes de sembrar, pre-marcar tour y push
# en localStorage (los arneses ya lo hacen).
```
