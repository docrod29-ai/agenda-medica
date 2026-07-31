# ADR · Métricas del corpus de 498 audios

**Motor:** `uci-benchmark-metricas` · `src/lib/uci/benchmark-metricas.ts`
**Ejecutor:** `scripts/benchmark-voz-uci.ts`
**Estado:** `validado` — calibrado contra el propio corpus.

## Fuente de verdad

`PARA_CLAUDE.md` y `MANIFEST_498.csv` del corpus entregado por el Dr.
(2026-07-30): 498 MP3 = 83 frases clínicas × 6 condiciones de voz, con
`canonical_text` y `key_terms` por audio.

Las seis métricas que pidió: **WER · Clinical Term Recall · Acronym Recall ·
Number Accuracy · Unit Accuracy · Critical Semantic Error Rate**.

## Referencia

Métricas estándar de reconocimiento del habla (WER por distancia de edición
sobre palabras) más recall por término. Ninguna fuente clínica: son métricas de
ingeniería de voz.

## El problema central: el gold está escrito de dos formas

`canonical_text` dice «flujo de sangre **ciento cincuenta mililitros por
minuto**» y `key_terms` dice «**150 mL/min**». Comparar literal daría **0 % en
todos los números y unidades**: un informe catastrófico y falso.

Y hay un segundo nivel: muchos `key_terms` son **el concepto en taquigrafía, no
lo que se pronuncia** — `HCO3` se dice «bicarbonato», `PAM` «presión arterial
media», `MRSA` «*Staphylococcus aureus* resistente a meticilina». Exigir la sigla
literal contaría como fallo del transcriptor **algo que nadie dijo**.

`FORMAS_HABLADAS` resuelve eso, y **cada entrada está leída del manifiesto**: es
la correspondencia que el corpus del Dr. establece. No inventé ninguna.

## Las equivalencias semánticas salen del documento

`PARA_CLAUDE.md` fija dos reglas y **sólo esas se aplican**:

- CKRT ≡ «terapia de reemplazo renal continua»;
- **perder o sustituir CVVHDF sí es error clínico**.

Un caso comprueba que no hay más equivalencias que esa única.

## El evaluador NO culpa al transcriptor de sus propios huecos

Si un término no aparece **ni en su propio `canonical_text`**, mi capa de
equivalencia no sabe expresarlo. Ese término **sale del cálculo** y se declara en
`terminosNoEvaluables`. Nunca cuenta como error de reconocimiento.

## Calibración: la prueba que el arnés tiene que pasar antes de medir

`--simular` evalúa usando el propio `canonical_text` como transcripción. Con
entrada perfecta, **todo debe dar 100 %**. Si no, el fallo es del evaluador.

La primera ejecución dio **73.8 %** de Clinical Term Recall con entrada perfecta.
Ese número era enteramente mío. Corrigiéndolo aparecieron cinco defectos reales
del evaluador:

| Defecto | Efecto |
|---|---|
| `normalizar` quitaba la barra | «150 mL/min» se partía en dos y no casaba nunca |
| Decimal sólo con unidades tras el punto | «cero punto **treinta**» no formaba 0.30 |
| Faltaban los femeninos | «tres mil **doscientas** rpm» no formaba 3200 |
| Unidades de una letra por subcadena | «san**g**re» contaba como gramos → error **crítico** falso |
| Separador de millar | «48,000/uL» era el único término incomprobable |

**Estado actual: 100 % en las cuatro métricas de recall, 0 % de error crítico y
CERO términos no evaluables.** Sólo ahora un número real significa algo.

## Golden

`src/__tests__/uci-benchmark-metricas.test.ts` — **34 casos**.

| Congela |
|---|
| «ciento cincuenta» = 150; «cero punto treinta» = 0.30 |
| La forma larga de unidad gana sobre la corta |
| «HCO3» ≡ «bicarbonato», y se marca que fue por equivalencia |
| CVVHDF **no** es sustituible |
| Un WER bajo con la cifra perdida se delata en la tasa crítica |
| Sin términos de un tipo, la métrica es `null` y **no** 100 % |
| Lo no evaluable no cuenta ni a favor ni en contra |

## Lo que falta para tener el número real

El corpus está listo y el arnés calibrado. **Falta ejecutar el STT**, y eso
necesita la llave de OpenAI: `vercel env pull` devuelve `[SENSITIVE]` en las
variables cifradas, que es lo correcto. El Dr. la pone en `.env.local` y ejecuta
un comando.
