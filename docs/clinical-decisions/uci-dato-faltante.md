# ADR · Motor de dato faltante (UCI)

**Motor:** `uci-dato-faltante` · `src/lib/uci/dato-faltante.ts`
**Estado:** `validado` — no calcula nada; declara qué entradas necesita cada
derivación y reporta el hueco.

## Fuente de verdad

**Charter NEXUSMED CRITICAL CARE OS §31**:

> «Si el paciente está en ventilación mecánica y se documenta VT, RR, FiO₂ y PEEP
> pero falta PBW, mostrar:
>
> ```
> No se puede calcular VT/PBW: falta talla/PBW.
> ```
>
> **No inventar.**»

## Referencia

Ninguna fórmula se implementa aquí. Cada derivación **cita el motor real** que la
calcula, y un caso del golden lo verifica con expresión regular. La fórmula de
PBW citada (ARDSNet/Devine) **ya existía** en `ventilacion.ts`; no se inventó ni
se copió de ninguna parte.

## Golden

`src/__tests__/uci-dato-faltante.test.ts` — **19 casos**.

| Congela |
|---|
| El ejemplo del Dr.: VT/RR/FiO₂/PEEP sin talla ⇒ «No se puede calcular VT/PBW: falta…» |
| **No inventa**: el tipo no tiene `valor` ni `estimado` |
| Los datos se nombran como los dice el médico («talla»), no `tallaCm` |
| «No aplica» ≠ «falta un dato»: con esfuerzo espontáneo el driving pressure **no aplica**, y pedir la Pplat no arreglaría nada |
| «No aplica» **no se deduce aquí** — lo decide el motor clínico |
| **Cero es un dato presente**: un PEEP de 0 no cuenta como faltante |
| NaN / Infinity / cadena vacía **sí** cuentan como faltantes |
| La Pplat desbloquea driving pressure **y** compliance: se pide una vez |
| Un paciente sin ventilador **no** recibe avisos de VT/PBW |
| Cada entrada requerida tiene nombre legible; si falta, el mensaje mostraría la clave interna |

## Unidades y firma

```ts
huecoDe(Derivacion, capturados, noAplica?) → Hueco
huecos(capturados, { aplicables?, noAplican? }) → Hueco[]
datosQueDesbloquean(Hueco[]) → { dato, desbloquea }[]
```

Sin unidades físicas: sólo presencia/ausencia y nombres.

## Dato faltante

Es el tema del módulo, así que la regla es al revés de lo habitual: **el vacío se
convierte en una frase**. Tres estados distinguibles —`calculable`,
`faltan_datos`, `no_aplica`— porque en la pantalla los tres se veían igual: vacíos.

## Por qué existe

Un cálculo que no se puede hacer **desaparece en silencio**. El médico ve una
nota sin VT/PBW y no sabe si (a) el paciente no está ventilado, (b) el dato es
normal y no se destacó, o (c) falta la talla. Tres situaciones clínicas
distintas, una misma pantalla vacía.

## Por qué NO estima el dato ausente

Estimar una talla «típica» para poder mostrar un VT/PBW daría **un número
plausible calculado sobre un dato inventado** — el peor error posible, porque es
invisible: nada en la pantalla delataría que la talla nunca se midió.
