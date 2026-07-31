# ADR · Pipeline clínico de dictado (orquestador)

**Motor:** `asr-pipeline` · `src/lib/asr/pipeline.ts`
**Estado:** `validado`.

## Fuente de verdad

`PARA_CLAUDE_CODE.md` del paquete del Dr. (2026-07-30), que fija el flujo
obligatorio y sus seis prohibiciones. Y sus `tests/critical-test-cases.json`, que
son los criterios de aceptación.

## Referencia

Ninguna clínica.

## Por qué existe

Los módulos sueltos pueden estar bien y la cadena estar mal. El orquestador hace
dos cosas que ningún módulo puede hacer solo:

**Vuelve a pasar el guardián al final.** Las etapas de normalización también
pueden equivocarse, y son código nuevo. Se compara el texto que salió del
guardián contra el texto final: si una etapa posterior se comió una sigla
crítica, una negación o el lado del paciente, se vuelve al texto que el guardián
ya había aprobado. Un guardián que sólo mira una etapa protege una etapa.

**Decide si hay que preguntar.** Es el gate de ambigüedad: junta lo que encontró
cada etapa y lo traduce a los `MOTIVOS_CONFIRMACION` que el Dr. declaró. Cuando
hay uno, la interfaz pregunta; no adivina.

## El flujo

```
audio
  → ASR primario                        · rutas /api/expediente
  → detección de especialidad/contexto  · lexicon.ts    ┐ ANTES de transcribir
  → lexicón médico dinámico             · lexicon.ts    ┘
  → corrección léxica + guardián        · corrector-vigilado.ts
  → normalización de cifras y unidades  · normalizacion.ts
  → normalización de siglas             · siglas.ts
  → protección de negación              · guardian-sustituciones.ts
  → protección de lateralidad           · guardian-sustituciones.ts
  → verificación de entidades críticas  · pipeline.ts
  → gate de ambigüedad                  · pipeline.ts
  → transcript final
```

Las dos primeras etapas van **antes** de llamar al reconocedor: son el
vocabulario que se le manda.

## Lo que NO garantiza

- **No arregla lo que el reconocedor oyó mal.** Sólo el léxico dinámico influye
  en eso, y sólo sesgando.
- **La verificación final no revierte al crudo**, sino al texto ya aprobado por
  el guardián: si la normalización rompió algo, tirar también la corrección
  léxica sería castigar dos veces.
- **El crudo nunca se borra** — regla 5 del Dr. Está en `crudo` y en `trazas[0]`.

## Golden

`src/__tests__/asr-pipeline.test.ts` — 18 casos, los diez críticos del paquete de
principio a fin en su forma hablada.
