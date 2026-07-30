# ADR · La infusión como registro (UCI)

**Motor:** `uci-infusion-registro` · `src/lib/uci/infusion-registro.ts`
**Estado:** `pendiente_validacion` — la estructura está completa; **los chequeos
de MAGNITUD del §20 esperan umbrales del médico dueño**.

## Fuente de verdad

**Charter §13, §19 y §20**:

> §13 — «**No almacenar únicamente "Norepinefrina 0.1".** Almacenar: medicamento,
> cantidad total, unidad, volumen final, concentración, velocidad, peso, tipo de
> peso, dosis calculada, inicio, canal de bomba, fuente, verificado.»
>
> §19 — «Cada cambio debe registrarse: 08:00 0.18 · 09:15 0.14 · 10:30 0.10 …»
>
> §20 — Distinguir **ERROR / WARNING / INFORMATION**.

Y la decisión **ICU-Q4.3**: sin concentración, la infusión se registra **sin
dosis** (`CANNOT_CALCULATE`), no se descarta.

## Referencia

No implementa fórmulas: el cálculo de dosis es `infusiones.ts` (ya con
`ClinicalQuantity`, en las dos direcciones) y la elección de preparación es
`infusion-library.ts` (jerarquía PATIENT > HOSPITAL > REFERENCE). Aquí sólo vive
la **forma** del registro y la línea de titulación.

## Golden

`src/__tests__/uci-infusion-registro.test.ts` — **26 casos**.

| Congela |
|---|
| **ERROR** — dosis sin concentración; dosis por kilo sin peso; concentración que no cuadra con sus partes; bomba sin medicamento; velocidad inválida |
| **WARNING** — sin concentración; peso sin decir cuál es; **dictada sin verificar** (nivel 1 de Q4.4); preparación sin origen |
| **INFORMATION** — preparación de referencia; sin canal de bomba |
| Una infusión **sin concentración NO es un error**: existe y se registra sin dosis |
| La titulación sale ordenada y la dosis vigente es la **disponible en ese momento**, no la última fila |
| **No interpola** entre cambios |
| Lo que **NO** se revisa, y por qué (ver abajo) |

## Dato faltante

Falta la concentración ⇒ `WARNING`, **no** `ERROR`: la infusión existe, corre en
el paciente, y descartar el registro por no poder calcular perdería lo que el
médico dijo. La velocidad de bomba se conserva siempre.

## Lo que deliberadamente NO revisa

El §20 pide también detectar **«velocidad absurda»**, **«error de decimal»** y
**«concentración diferente a la habitual del hospital»**. Los tres están
**fuera** a propósito:

- Los dos primeros exigen un **umbral clínico** que nadie ha definido. Inventar
  un «rate máximo razonable» es exactamente lo que prohíbe la carta operativa, y
  el error sería peor que el hueco: una alarma falsa en un paciente que sí
  necesita esa velocidad.
- El tercero exige la **biblioteca del hospital**, que sigue vacía por decisión
  del médico dueño («no disponemos de las preparaciones locales; no inventar
  ninguna»).

Dos casos del golden congelan esas ausencias, para que quede claro que son una
decisión y no un olvido.

## Pendiente de validación clínica

Los umbrales de magnitud del §20, por fármaco. Mientras no existan, este módulo
revisa **estructura pura**: contradicciones internas del registro que se pueden
afirmar sin saber medicina.

## Por qué existe

«Norepinefrina 0.1» **no es un dato clínico**: no dice a qué concentración corre,
con qué peso se dosificó ni quién lo verificó. Dos hospitales con preparaciones
distintas escriben **lo mismo** para infusiones que entregan cantidades
diferentes de fármaco. Y al día siguiente nadie puede reconstruir por qué la
dosis era esa.
