# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: historia V10 encadenada — `claude/nexus-visual-excellence-v10`
(instalación) → `claude/kind-brahmagupta-exbp9m` (arnés) →
`claude/kind-brahmagupta-2yxowl` (cierre TRUTH-001) →
`claude/kind-brahmagupta-rms50y` (quick-strike NOTE-001) →
`claude/kind-brahmagupta-ysxb6q` (quick-strike DEBT-006, 9-ago). Cada sesión
cloud empuja a su rama configurada y arranca de la punta más adelantada
(V10 §3). OJO para la siguiente corrida: la punta es **ysxb6q**.

**Iteración en curso**: quick-strikes entre unidades. `V10-NOTE-001` quick
cerrado (DEBT-008/009); `V10-DEBT-006` **mitad expediente cerrada** (la mitad
HOY va en V10-TODAY-001). Las unidades completas de la secuencia §32 esperan
V10-D1.

## Corrida del 9-ago (madrugada-3) — qué se hizo

| Qué | Evidencia |
|---|---|
| **DEBT-006 (mitad expediente) cerrado** — el CTA primario va primero en móvil | Bajo 480px `exp-actions` pasa a rejilla: «Nueva consulta con IA» (último hijo DOM — escritorio y orden de foco intactos) sube a la primera fila completa con `order:-1`; Carta de referencia a su fila; Expediente completo \| FHIR comparten; objetivos 44px. Mismo patrón que `nota-toolbar` (§8.33). Captura `expediente--390.png` nueva |
| **Guardián probado al revés** | `src/__tests__/expediente-cta-primero-movil.test.ts` — 4/5 fallan sin el arreglo (git stash); el 5.º es el canario del orden DOM (documenta que `last-child` apunta al botón correcto) |
| **Trinquete de escala reparado** | `escala-visual-trinquete` fallaba en rojo EN MAIN: v1163 (`/cumplimiento/motores`, corrida V7) metió `fontSize: 25` — 39.º tamaño distinto contra techo 38. El h1 pasó a `className="t-h1"` como sus 7 páginas hermanas. No fue esta corrida quien lo rompió (verificado con stash contra HEAD) |
| **axe re-verificado** | expediente **0 critical/serious** en 1440 y 390; el programa sigue en 6 hallazgos (contraste hoy/agenda → TODAY/AGENDA-001, nested-interactive pacientes → DEBT-010). `reporte-a11y.json` regenerado |
| **Scorecard** | expediente 8.7 → **8.8** (jerarquía 9→9.5, responsive 8→8.5) · global **8.28** |

## Compuertas de esta corrida

- `npx vitest run`: **8 478 pasan · 1 saltada · 1 falla** — la falla es
  `ops-timeout-y-punto-ciego`, la MISMA falla de entorno documentada en las dos
  corridas anteriores (espera que `10.255.255.1` cuelgue y el proxy del sandbox
  contesta al instante). En CI de GitHub pasa. No se tocó el test.
- `lint-trinquete`: **96, igual que el techo.**
- `escala-visual-trinquete`: **verde otra vez** (38 = techo 38).
- `npm run build`: **compila.**
- axe en navegador real: expediente **0** critical/serious (ambos anchos).

## Advertencia de concurrencia (V10 §41)

`expediente/[patientId]/page.tsx` NO está entre los archivos de la rama V9 sin
fusionar (sólo `src/lib/expediente/exportacion.ts` — otro archivo). El arreglo
del trinquete tocó `cumplimiento/motores/page.tsx`, archivo nuevo de main
(v1163), tampoco en la rama V9. Cero riesgo de pisar trabajo validado.

## Próxima acción exacta (siguiente corrida)

1. Arrancar de `claude/kind-brahmagupta-ysxb6q` (o su descendiente más
   adelantado) y verificar si el dueño ya decidió **V10-D1** (fusión V9).
2. Si V10-D1 decidido a favor → **V10-CONSTITUTION-001** (DEBT-001/002) sobre
   main fusionado — es lo que desbloquea todo lo demás.
3. Si no → quick-strikes restantes sin riesgo V9:
   - **DEBT-007a**: la barra lateral resalta «Consulta» estando en `/pacientes`
     (mirar el matcher de rutas del shell; OJO: si el shell está en la rama V9,
     saltar a la b);
   - **DEBT-006b**: círculos de icono de las 4 KPI de hoy-escritorio (§9) —
     `dashboard/page.tsx` no está en la rama V9.
4. DEBT-003 (agenda móvil) y DEBT-010 (pacientes móvil) siguen esperando
   V10-D1: `citas/page.tsx` y `pacientes/page.tsx` SÍ están en la rama V9.

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
# esperar a que el emulador ESCUCHE de verdad antes de sembrar (el primer curl
# puede mentir), y pre-marcar tour y push en localStorage (ya lo hacen los arneses).
```
