# ADR · Reconciliación dictado ↔ calculado

**Motor:** `uci-reconciliacion` · `src/lib/uci/reconciliacion.ts`
**Estado:** `validado` — no contiene criterio clínico; compara dos números y
declara si cuadran.

## Fuente de verdad

**Charter NEXUSMED CRITICAL CARE OS §24** (Dr. David Alonso Rodríguez Luna):

> Si el médico dicta «Driving pressure 20» pero Pplat 22 y PEEP 8, el motor
> determinista obtiene **14**. **No sobrescribir.** Mostrar:
>
> ```
> Inconsistencia detectada.
> Dictado:   20 cmH₂O
> Calculado: 14 cmH₂O
> ```
>
> Solicitar revisión. **Esto es una función de enorme valor.**

Y la regla **antifatiga** de la decisión ICU-Q4.4: no se interrumpe por cada
valor; al terminar la sección se dice cuántos requieren revisión.

## Referencia

Ninguna fuente clínica externa: aquí no hay umbrales ni criterios médicos. Las
**fórmulas** viven en sus propios motores y este módulo **no las reimplementa** —
`PARES_RECONCILIABLES` cita, para cada par, de qué se deriva, con qué fórmula y
**qué motor la calcula**. Reconciliar contra una fórmula improvisada aquí sería
inventar el cálculo, no verificarlo.

## Golden

`src/__tests__/uci-reconciliacion.test.ts` — **21 casos**.

| Congela |
|---|
| El ejemplo literal del charter: 20 dictado vs 14 calculado → discrepan |
| **Conserva los dos valores**: no elige ganador, y el tipo no tiene por dónde colarlo (`valor`/`ganador`/`correcto` no existen) |
| El mensaje da los dos números y **ninguna palabra** sugiere cuál vale |
| Media unidad concuerda (13.7 se dicta «catorce»); 0.51 ya discrepa |
| Falta uno ⇒ **`incomparable`, NO «concuerdan»** — decir que concuerdan sería afirmar una verificación que no ocurrió |
| **Cero es un valor válido**, no un ausente (un PEEP de 0 existe) |
| NaN / ±Infinity no se comparan |
| Antifatiga: sólo se listan las discrepancias, y el resumen es una línea |
| Cada par del catálogo cita su motor real |

## Unidades y firma

```ts
reconciliar(campo, dictado, calculado, unidad, tolerancia = 0.5) → Reconciliacion
```

La unidad la pasa quien llama y se propaga al mensaje: comparar dos números de
unidades distintas sería el defecto que este módulo existe para cazar.

## Sobre la tolerancia

`0.5` **no es un umbral clínico**: es media unidad, el error máximo de redondear
a entero. Un médico que dicta «catorce» puede estar leyendo 13.7 en el
ventilador. Cualquier tolerancia **mayor** sí sería una decisión clínica, y por
eso hay que pasarla explícitamente — un test lo congela.

## Dato faltante

Falta uno de los dos ⇒ `incomparable` con su motivo (`falta_dictado`,
`falta_calculado`, `valor_no_finito`), nunca «concuerdan». La diferencia importa:
`concuerdan` afirma que se verificó; `incomparable` dice que no se pudo.

## Por qué existe, y por qué NO elige

Las dos direcciones de error son reales: el dictado puede venir mal transcrito
(«veinte» por «catorce»), y el cálculo puede estar hecho con una Pplat vieja o
con esfuerzo espontáneo, donde la Pplateau **no es interpretable**. Un módulo que
eligiera solo escondería la mitad de los casos.

Elegir por el médico sería además el error que prohíbe la decisión transversal
§4 (el LLM no decide hechos clínicos deterministas). Aquí ni siquiera hay un LLM:
hay dos números que no cuadran y una persona que sabe por qué.
