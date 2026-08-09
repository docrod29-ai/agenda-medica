# Bitácora del trabajo autónomo

## 2026-08-04 — INFRA-001 · el sistema operativo del programa

- `CLAUDE.md` reescrito: misión, invariantes, comandos, mapa, seguridad clínica,
  condición de terminado, prohibiciones y decisiones ya tomadas por el dueño.
- `.claude/rules/` — seis reglas por dominio.
- `.claude/agents/` — ocho especialistas con herramientas limitadas y contrato de
  salida; el equipo rojo es independiente y su trabajo es **refutar**.
- `agent-state/` — estado, métricas, bloqueadores, supuestos, decisiones y riesgos.

**Lo que de verdad importa de esta iteración**: se corrió por primera vez el
corpus V3 de **6 000 frases** contra el pipeline. El dueño tenía razón en
reclamar — el corpus llevaba en disco desde hace días y nadie lo había medido.

Resultado: **96.02 % intactas, cero términos clave perdidos**, y un defecto real
encontrado por la medición (R-02).

## 2026-08-04 — VOICE-004 · el balance negativo pedía confirmación

Encontrado **midiendo**: 25 de 6 000 frases, todas la misma. `ES_CANTIDAD` no
aceptaba signo delante de la cifra. Re-medido tras el arreglo: **25 → 0**, con
las intactas y los términos clave sin moverse.

## 2026-08-04 — SAFE-002 · la defensa miraba sólo el resumen

Visto en producción, en la alerta del propio Dr.: «…Diabetes mellitus tipo 2.
[object Object]…». `diagnosticos` y `secciones` son arreglos de objetos, así que
el texto contrastado era basura y **el cuerpo de la nota era invisible** para la
comprobación de negación y de temporalidad.

Y la prueba que debía protegerlo **certificaba el defecto**: exigía la línea
literal rota. Fijar la forma de una expresión no prueba su comportamiento.

## 2026-08-04 — OPS-001 · la caída de IA sigue al dueño

Franja en el armazón de la app, sólo para el dueño, con el titular y qué hacer.

**Nota honesta**: la premisa inicial era que `avisoAlDueno` no lo llamaba nadie.
Era falsa —lo busqué con el nombre mal escrito— y se verificó **antes** de
construir nada encima. Lo que faltaba no era el registro: era que llegara a él.

## 2026-08-04 — SAFE-001 · un solo parser de alergias, y conectado

Cuatro parsers del mismo campo. `alergenosDe` había salido a producción en la
v1031 **sin un solo llamador** — error del propio agente, cazado revisando el
estado. El trinquete de lint bajó a 97 y se apretó.

## 2026-08-04 — EVAL-003 · el trinquete de voz, en CI

Las 6 000 frases del Dr. corriendo en cada push. La regresión de texto **no
necesita el audio**: 1.2 MB de frases contra 429 MB de mp3.

Mide que el pipeline no dañe lo correcto (criterio CERO en términos clave) y que
el término clínico sobreviva al pasar de hablado a escrito. Probado al revés.

**Hallazgo sobre el corpus, para el Dr.**: algunas filas traen la forma hablada
corrompida por el generador — «dosis guiada» quedó como «dosis gramosuiada»
(alguien expandió «g» → «gramos» dentro de la palabra). Son del corpus, no del
pipeline, y bajan su propia medición.

## 2026-08-09 — La especificación de V9 pasa a ser la fuente de verdad

El dueño entregó el Master Loop V9 completo (907 líneas) y pidió que se guardara
íntegro, sin resumir, como especificación autoritativa.

- `docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md` es ahora
  **exactamente** ese archivo (md5 `f4a6d421c2944ccc565a670037940419`, verificado
  con `diff` contra el original).
- Lo que antes vivía dentro de él —la lectura operativa y la bitácora de unidades
  cerradas con su SHA— se movió a `docs/ai/V9-BITACORA-Y-OPERACION.md`, **sin
  perder nada**, para que la especificación no se mezcle con su interpretación.
- `CLAUDE.md`, `MASTER_STATE.json` y `CURRENT_ITERATION.md` obligan a leerla
  completa antes de elegir trabajo.
- Nace `agent-state/V9_COMPLETE_CRITERIA.md`: cuándo puede existir
  `V9_COMPLETE.md`. **No existe todavía** y `v9-completo-no-se-declara-antes-de-
  tiempo.test.ts` falla si aparece con unidades pendientes, con P0/P1 abiertos o
  con una compuerta sin ejecutar.

La razón de la compuerta, escrita antes de que hiciera falta: un programa
autónomo sin condición de terminado no termina, **se le ocurren tareas**. Y un
criterio escrito al final se escribe para que dé aprobado.

## 2026-08-09 — Disparo de rutina «Master Loop V7»: sin especificación, se
continuó V9 (PATIENT-TELE-002, REG-306)

La rutina programada exigía leer
`docs/ai/NEXUSMED_AUTONOMOUS_MEDICAL_INTELLIGENCE_MASTER_LOOP_V7.md` como
primer paso obligatorio. **Ese archivo no existe y nunca existió** en este
repositorio (`git log --all` no lo encuentra). `agent-state/V7-ITERACION.md` —el
tablero propio que V7 se dio el 8-ago para no pisar a V9— quedó congelado en un
solo commit y nunca se volvió a tocar; todo el trabajo real posterior es V9.
Documentado en `agent-state/OWNER_DECISIONS_REQUIRED.md`, sección «PROGRAMA».

Sin inventar trabajo de V7, se continuó el programa que el propio estado
persistente señala como vivo: **V9, unidad `POSTVISIT-001`**, empezando por el
P0 pendiente `PATIENT-TELE-002` (el enlace de videoconsulta por WhatsApp seguía
sin token en los dos caminos automáticos — cron de recordatorios y confirmación
del bot).

**REG-306** — `crearTokenPaciente(clinicId, patientId, 1, 'agenda',
portalTokenVersion)` en `api/cron/reminders` y en los dos caminos de
confirmación de `api/whatsapp/webhook`. `lib/whatsapp.ts` (el módulo que se
importa desde el navegador) queda sin tocar a propósito. Prueba al revés en
`donde-es-la-cita.test.ts`: falla sin el arreglo (falta el import/llamada y
falta `tokenPaciente:` en el mensaje), pasa con él.

Efecto de cascada, cada uno con su propio guardián: `authz-rutas-declaradas`
(nueva ruta que toca `patients`, declarada con su razón), `familias-de-defecto`
(REG-306 clasificado en `no_conectado`), `la-sala-de-datos-no-infla` y
`el-tablero-del-loop-no-miente` (cifras derivadas con
`node scripts/data-room/actualizar-cifras.mjs` y
`node scripts/agent-state/actualizar.mjs`).

Compuertas: `npx vitest run` 8563 casos, **1 fallo preexistente y de entorno**
(`ops-timeout`, ya declarado en el checkpoint anterior) · `lint-trinquete` 96,
igual que el techo · `npm run build` limpio con las variables de relleno de CI.
**No verificado en navegador**: sigue pendiente confirmar que el paciente real
recibe un enlace que abre.

Siguiente: `POSTVISIT-GATE-001` (compuerta de firma para `HojaParaElPaciente`)
y `POSTVISIT-ENTREGA-001` (que la hoja llegue al portal), los dos P1 restantes
de `POSTVISIT-001`.
