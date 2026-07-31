# ADR · Metas diarias (UCI)

**Motor:** `uci-metas-diarias` · `src/lib/uci/metas-diarias.ts`
**Estado:** `validado` — no aporta ningún objetivo; sólo compara contra los que
fija el médico.

## Fuente de verdad

**Charter §35**:

> «Registrar: MAP target · RASS target · fluid balance target · ventilator goals ·
> nutrition goal · mobility · antibiotics · devices.
>
> El copiloto compara datos contra objetivos definidos. **No inventar
> objetivos.**»

## Referencia

**Ninguna, y es deliberado.** Este módulo no contiene un solo valor objetivo. Una
PAM de 65 es razonable en muchos pacientes y equivocada en un hipertenso crónico
o en un neurocrítico con presión de perfusión comprometida — y el módulo no sabe
cuál tiene enfrente.

Un caso del golden verifica por reflexión que **no existe ningún export** cuyo
nombre sugiera un catálogo por defecto (`DEFAULT`, `SUGERIDO`, `HABITUAL`,
`RECOMENDADO`, `PROPUESTO`).

## Golden

`src/__tests__/uci-metas-diarias.test.ts` — **18 casos**.

| Congela |
|---|
| Comparación contra rango, umbral «al menos» y «como mucho» |
| **Sin medición ⇒ `sin_dato`**: ni cumplida ni incumplida |
| **Cero es una medición válida** |
| Las tareas se marcan hechas, no se miden |
| Los **pendientes del brief** salen de metas reales, no de sugerencias |
| Lo que no tiene medición **no** aparece como pendiente |
| No existe ningún catálogo de objetivos por defecto |
| Sin metas, la pantalla **dice que nadie las fijó** |
| Los ocho dominios del §35, en su orden |

## Dato faltante

**Sin medición ⇒ `sin_dato`, nunca «cumplida» ni «no cumplida».** Decir
«cumplida» sería inventar; decir «no cumplida» acusaría de un fallo de
tratamiento a lo que sólo es un hueco de documentación. Por eso `sinMedicion()`
es una lista aparte: **qué falta capturar**, no qué falla.

Y **sin metas** la pantalla no se queda en blanco: un blanco se lee como «todo en
orden». `SIN_METAS_FIJADAS` dice explícitamente que el sistema no propone
objetivos y que los fija el médico tratante.

## Qué desbloquea

La sección «PENDIENTE» del Morning Brief (§30) quedaba vacía y declarada como
vacía porque los pendientes exigen metas u órdenes abiertas como dato
estructurado. Este módulo las aporta: **un objetivo no cumplido es un pendiente
con dato real detrás**, que es exactamente lo que pide el charter cuando dice que
todas las frases deben vincularse a datos reales.

## Por qué `fijadaPor` y `fijadaEn` son obligatorios

Una meta sin autor no es una meta: es una suposición. El tipo lo impide, así que
no hay forma de construir un objetivo anónimo ni siquiera por error.
