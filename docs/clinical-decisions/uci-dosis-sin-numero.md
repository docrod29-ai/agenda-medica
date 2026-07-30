# ADR · Dosis que perdió su número

**Motor:** `uci-dosis-sin-numero` · `src/lib/uci/dosis-sin-numero.ts`
**Estado:** `validado`.

## Fuente de verdad

Medición directa sobre el corpus de 498 audios del Dr. (2026-07-30):

```
se dijo:      «Meropenem DOS gramos cada ocho horas en infusión extendida»
se entendió:  «Meropenem gramos cada ocho horas en infusión extendida»
```

**6 de 6 veces, en las tres voces.** El reconocedor funde «-nem dos» en «-nem».

## Referencia

Ninguna clínica: es un patrón de fallo del reconocedor, no una regla médica.

## Por qué existe

Es el único error crítico que **sobrevivió a todo lo demás**: al diccionario de
confusiones conocidas y al vocabulario del prompt, donde la frase está palabra
por palabra. No es un problema de sesgo.

Y lo peligroso no es que falte la dosis: es que **pase desapercibida**.
«Meropenem gramos cada ocho horas» se lee como una orden completa.

## Por qué NO se corrige adivinando

Sería trivial escribir «si falta el número, pon 2». Y sería **inventar una
dosis**. Un meropenem puede ser de 500 mg, de 1 g o de 2 g según la indicación y
la función renal, y el sistema no sabe cuál se dijo — sólo sabe que **había una y
se perdió**.

Un caso del golden comprueba que no existe ninguna función de
completar / rellenar / inferir.

## Lo que NO garantiza

Detecta **el patrón** «unidad de dosis sin cantidad delante». No garantiza
encontrarlas todas: si el reconocedor se come el número *y* la unidad, no queda
rastro que detectar.

## Golden

`src/__tests__/uci-dosis-sin-numero.test.ts` — **9 casos**.

| Congela |
|---|
| El caso exacto medido en el corpus |
| La dosis completa **no** dispara nada |
| «cada ocho horas» **no** es una dosis rota |
| Decimales y fracciones cuentan como cantidad |
| No existe ninguna función que rellene la dosis |
