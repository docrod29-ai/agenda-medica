# ADR · Léxico dinámico del dictado

**Motor:** `asr-lexicon` · `src/lib/asr/lexicon.ts`
**Estado:** `validado`.

## Fuente de verdad

`config/specialty-context-map.json` del paquete del Dr. (2026-07-30): **79
especialidades y 1 400 términos**, más su `strategy` —
`max_active_contexts: 4`, `merge_global_critical_lexicon: true`, y la instrucción
de no inyectar el diccionario completo en cada llamada. El archivo se copió al
repo en `src/lib/asr/data/especialidades.json`.

El límite de 224 tokens del prompt es del reconocedor, no suyo.

## Referencia

Ninguna clínica.

## Por qué existe

Etapas 2 y 3 del pipeline, y **la única que mejora lo que el reconocedor oye**;
las demás trabajan sobre lo que ya oyó.

El problema no es de diccionario sino **de presupuesto**: 1 400 términos no caben
en 224 tokens, y el modelo lee los últimos y tira el resto **sin avisar**. Eso ya
pasó en esta app — el prompt de UCI se pasaba de largo y lo que se perdía era,
justamente, la parte de cuidados críticos.

## En qué orden se gasta

1. Los fármacos y problemas de **este** paciente. Ningún término genérico vale
   más que el nombre del antibiótico que se está dictando ahora.
2. Los términos críticos globales (`merge_global_critical_lexicon`).
3. Los críticos de las especialidades activas, luego los de alta prioridad, luego
   los normales.

Lo que no cabe se cuenta y se devuelve en `descartados`: un recorte silencioso se
lee como cobertura completa.

## Dato para el Dr., no un fallo

Con su tope de 4 contextos activos, una nota de UCI gasta ~90 de los 224 tokens
disponibles. **Lo que limita el vocabulario es su `max_active_contexts`, no el
presupuesto del reconocedor.** Subirlo es decisión suya; un caso del golden avisa
el día que deje de ser cierto.

## Lo que es mío y no suyo

La tabla `CONTEXTOS_POR_MODULO` — qué especialidades activa cada pantalla de
NexusMED. Su mapa define las especialidades y su vocabulario, pero no qué módulo
corresponde a cuál. Un caso del golden comprueba que ningún nombre de esa tabla
esté mal escrito: un nombre inventado daría un léxico vacío sin avisar.

## Golden

`src/__tests__/asr-lexicon.test.ts` — 13 casos.
