# ADR · Normalización de cifras y unidades

**Motor:** `asr-normalizacion` · `src/lib/asr/normalizacion.ts`
**Estado:** `validado`.

## Fuente de verdad

`config/units-and-numbers.json` del paquete **NexusMED_CLINICAL_ASR_PIPELINE_V1**
(2026-07-30): las unidades canónicas y la exigencia de que «cero punto quince
microgramos por kilo por minuto» quede como `0.15 mcg/kg/min`, del caso 1 de sus
`critical-test-cases.json`.

Los nombres hablados de cada unidad salen de ese archivo y del corpus de 498
audios; las formas femeninas y la apócope («veintiún», «doscientas») se
añadieron al medir el corpus.

## Referencia

Ninguna clínica. Es ortografía de cantidades: se escribe con dígitos lo que se
dijo con letras, sin cambiar el valor.

## Por qué existe

Una nota que dice «cero punto quince microgramos por kilo por minuto» no se puede
leer de un vistazo, ni comparar con la de ayer, ni verificar contra una bomba de
infusión. Y es la etapa 4 de las nueve que pidió el Dr.

## Las tres reglas que le impiden inventar

1. **«un» y «una» no se convierten a solas.** Son artículos mucho más a menudo
   que números: «un paciente» no es «1 paciente». Cuentan cuando les sigue una
   unidad («un gramo» → `1 g`) o cuando forman parte de una cifra mayor.
2. **Dos cifras del mismo rango no se suman.** Quien dicta «uno dos cero sobre
   ocho cero» está deletreando 120/80; sumarlas daría 3. Al ver dos unidades
   seguidas se cierra el número y empieza otro: sale `1 2 0 sobre 8 0`, que es
   exactamente lo que se dijo.
3. **Una unidad hablada sólo se abrevia detrás de una cifra.** «pesa muchos
   kilos» se queda igual; «ochenta kilos» se vuelve `80 kg`.

## Por qué no se reusa el normalizador del benchmark

`benchmark-metricas.ts` ya convierte números y unidades y está calibrado al 100 %
contra el corpus — pero es un normalizador **de comparación**: baja a minúsculas,
quita acentos y borra la puntuación. Eso sirve para medir y arruinaría una nota.
Éste reescribe sólo los tramos de cifra y de unidad y deja el resto byte a byte
como estaba. Mantenerlos separados evita romper un instrumento calibrado para
arreglar una nota.

## Lo que NO garantiza

- **No completa una cifra ausente.** «Meropenem gramos cada ocho horas» sale
  «Meropenem gramos cada 8 horas»: se normaliza el ocho que sí está y la
  cantidad que falta la denuncia `uci-dosis-sin-numero`.
- **No convierte entre unidades.** Nunca pasa de mg a mcg ni de mL a L.
- **No cubre toda unidad que exista**, sólo la tabla declarada.

## Golden

`src/__tests__/asr-normalizacion.test.ts` — 23 casos.
