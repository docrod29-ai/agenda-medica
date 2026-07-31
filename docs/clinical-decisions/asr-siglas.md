# ADR · Siglas del dictado

**Motor:** `asr-siglas` · `src/lib/asr/siglas.ts`
**Estado:** `validado`.

## Fuente de verdad

`config/aliases.json` del paquete del Dr. (2026-07-30): 35 siglas con sus formas
habladas. Están las 35, ni una más ni una menos — un caso del golden lo comprueba
contra el JSON original, que se copió al repo en
`src/lib/asr/data/aliases.json`.

## Referencia

Ninguna clínica. Es ortografía de siglas.

## Por qué existe

Etapa 5 del pipeline. Y porque el JSON del Dr. mezcla dos cosas bajo el mismo
nombre de «alias»:

```
PEEP  ← «presión positiva al final de la espiración»
VExUS ← «vexus»
```

La segunda es **la misma palabra escrita de otra forma**; la primera es **su
significado**. Sustituir la primera reescribiría la prosa del médico: si él dictó
la frase completa, la nota debe decir la frase completa. Es su nota.

Así que cada forma se clasifica **a mano**, una por una, en `ortograficos` (se
reescriben) o `lectura` (sólo sirven para reconocer). Clasificarlas por parecido
automático sería la «similitud fonética» que él prohibió en la regla 3.

Decisiones concretas que se apartan de una lectura literal del JSON:

- **«PaFi» no se reescribe a «P/F»**: es como el Dr. la dice, y ya está así en el
  diccionario de confusiones medido en el corpus.
- **«ESBL» no se reescribe a «BLEE»**: es la sigla inglesa, no otra grafía.
- **«oxa 48»** se añade como forma ortográfica de `OXA-48`, porque la
  normalización de cifras corre antes y «oxa cuarenta y ocho» llega ya convertido.
  Es la única forma añadida por encima de su lista, y un caso del golden lo fija.

## Lo que NO garantiza

- No expande una sigla a su significado, ni al revés (salvo las formas habladas
  declaradas ortográficas, como «ECMO veno venoso» → `ECMO VV`).
- No cubre más siglas que las 35 del paquete.

## Golden

`src/__tests__/asr-siglas.test.ts` — 14 casos.
