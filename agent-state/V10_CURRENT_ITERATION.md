# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: la historia V10 quedó **RECONCILIADA** el 9-ago-2026 (tarde) en
`claude/kind-brahmagupta-40oom1`. OJO para la siguiente corrida: **la punta es
40oom1** — contiene la cadena completa (instalación → exbp9m → 2yxowl →
rms50y → ysxb6q), la corrida paralela iurzog y HOME-001 de la rama canónica.
`c51p2n` y `9xajvg` están superadas: no arrancar de ellas ni fusionarlas.

## Por qué hizo falta reconciliar (que no se repita)

El 9-ago corrieron **en paralelo** varias sesiones V10 sin verse entre sí:
la cadena (que sí se encadenaba corrida a corrida), iurzog (arrancó de la rama
canónica vieja) y la sesión local del dueño (HOME-001 en la rama canónica).
Resultado: dos arneses de captura para lo mismo, dos scorecards de las mismas
pantallas, dos líneas base de accesibilidad, y hallazgos re-encontrados que la
otra línea ya había reparado. **Protocolo desde ahora**: antes de trabajar,
`git fetch` y comparar TODAS las ramas `claude/*` y la canónica por fecha de
commit; si hay una corrida viva (push < 10 min), no tocar sus archivos y
reconciliar sólo cuando quede quieta (V10 §41).

## Estado tras la reconciliación

| Qué | Estado |
|---|---|
| **V10-TRUTH-001** | ✅ CERRADA (cadena, 9-ago noche) y ENRIQUECIDA por iurzog: scorecard con revisor independiente (§40), 2.ª línea base axe, backlog +24 hallazgos con evidencia |
| **V10-D1 (fusión V9)** | ✅ EJECUTADA: PR #279 en main (`56d9fc7a`); REG de V9 = 294…305 |
| **HOME-001** (/dashboard) | ✅ implementado y fusionado; **re-captura pendiente** para puntuar con revisor independiente (las dos puntuaciones existentes son de la pantalla ANTERIOR) |
| **NOTE-001 quick** (DEBT-008/009) | ✅ cerrado; re-captura `nota--*.png` pendiente (banda 13→14, radio 12→10) |
| **DEBT-006a** (expediente móvil) | ✅ cerrado con guardián |
| **V10-SAFETY-ALERGIAS-WORDING** | ✅ cerrado (iurzog): «No registradas», con guardián |
| **Alineación a11y** | unión de las dos líneas en `docs/design/ACCESSIBILITY.md`; abiertos: FAB de tema sin nombre (todas), iconos citas/calendario, contrastes hoy/agenda/nota, nested-interactive pacientes/calendario |
| **Trinquete de diseño** | BAJÓ a **560 hex / 2020 tamaños / 637 radios** medido sobre la fusión |
| **Backlog** | 32 items reconciliados en `V10_BACKLOG.json` (estado cruzado: lo que una línea encontró y otra reparó, marcado) |

## Compuertas de esta corrida (reconciliación)

- `npx vitest run`: **8 592 pasan · 1 falla** — `ops-timeout-y-punto-ciego`,
  la MISMA falla de entorno documentada por las tres corridas anteriores (el
  proxy del sandbox contesta donde el test espera un cuelgue; en CI pasa).
- `lint-trinquete`: **96 = techo**.
- trinquete de diseño: **verde, techos bajados** (560/2020/637).
- `npm run build`: **compila** (161 páginas). OJO contenedor nuevo: el build
  necesita el `.env.local` demo ANTES de arrancar — sin ninguna config de
  Firebase, `collecting page data` revienta en `/dr/[clinicId]` con
  `auth/invalid-api-key`. No es defecto del código: es el paso 0 del arnés.
- Resolución de `firebase.ts`: gana la versión iurzog (doble candado
  `NEXT_PUBLIC_FIREBASE_EMULATORS=1` **y** projectId `demo-*`, conexión también
  en servidor) — su guardián `emulador-solo-demo.test.ts` la exige y hace
  posible fotografiar el build de producción.

## Próxima acción exacta (siguiente corrida)

1. **Re-captura y puntuación independiente** de `/dashboard` (HOME-001) y
   `nota--*` con cualquiera de los dos arneses — cierra la evidencia de las
   dos unidades ya implementadas. De paso: primera puntuación de expediente y
   consulta con siembra fiel (quedaron SIN PUNTUAR).
2. **V10-CONSTITUTION-001** (DEBT-001/002, ya sin candado V9): construir los
   tokens/utilidades que faltan SOBRE el sistema de diseño de V9 que ya está
   en main — no rehacerlo.
3. Después, por prioridad del backlog: DEBT-003 (agenda móvil rota, P1) y
   DEBT-010 + nested-interactive (pacientes móvil).
4. Consolidar los DOS arneses de captura en uno (registrado en backlog) al
   abrir V10-VISUAL-REGRESSION-001.

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
# Trampas: localhost (no 127.0.0.1), --no-proxy-server, waitUntil:'load',
# esperar a que el emulador ESCUCHE antes de sembrar, pre-marcar tour y push
# en localStorage (los arneses ya lo hacen).
```
