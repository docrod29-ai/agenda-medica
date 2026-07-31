# ADR · Confirmación basada en riesgo (voz de UCI)

**Motor:** `uci-confirmacion` · `src/lib/uci/confirmacion.ts`
**Estado:** `pendiente_validacion` — la lógica está completa; **los dos umbrales
numéricos necesitan calibración del médico dueño con datos reales**.

## Fuente de verdad

**Decisión ICU-Q4.4 del médico dueño, 29-jul-2026**:

> «**NO** usar un threshold universal tipo `confidence < 0.90 → preguntar`. Eso
> produciría fatiga.»
>
> «**El LLM no toma la decisión final de seguridad. La clasificación debe ser
> DETERMINISTA.**»
>
> «Nunca preguntar inmediatamente por cinco valores seguidos.»

Los cuatro niveles y las dos listas de conceptos (nivel 1 y nivel 2) están
transcritos **literalmente** de esa decisión, sin añadidos.

## Referencia

Ninguna fuente clínica externa. No hay umbrales fisiológicos aquí: hay señales
del reconocedor de voz y una tabla de riesgo que escribió el médico.

## Golden

`src/__tests__/uci-confirmacion-riesgo.test.ts` — **54 casos**.

Los **dos ejemplos trabajados** de la decisión son el criterio de aceptación:

| Ejemplo del Dr. | Comportamiento congelado |
|---|---|
| «RASS menos cuatro» · 0.98 · contexto neuro | **NO pregunta** · nivel `PASSIVE` |
| «PEEP ocho» → PEEP 0.73 / PIP 0.68 | **Pregunta** «¿PEEP 8 o PIP 8?» |

| Y además |
|---|
| Los 11 conceptos de nivel 1 son `ALWAYS_CONFIRM` **aunque la confianza sea 1.0** |
| Nivel 1 **NO interrumpe el dictado** — se confirma antes de guardar la orden |
| Los 14 conceptos de nivel 2 limpios **no** interrumpen |
| Se pregunta por cada una de las 5 razones concretas, y se **acumulan** |
| `plausible: null` (no evaluable) **no** cuenta como improbable |
| Antifatiga: cinco ambigüedades dan **una línea de resumen**, no cinco modales |
| Es determinista y no muta su entrada |

## Unidades y firma

```ts
clasificarConfirmacion(SenalesConfirmacion) → DecisionConfirmacion
planificarConfirmaciones(SenalesConfirmacion[]) → PlanConfirmacion
```

Sin unidades físicas. Sin reloj, sin red, **sin LLM**.

## Dato faltante

`plausible: null` significa «no evaluable», y **no** se trata como improbable:
confundirlos generaría preguntas por todo lo que el sistema aún no sabe validar,
que es la definición de fatiga de alertas.

## Pendiente de validación clínica

Dos constantes, **ancladas a los ejemplos de la decisión pero no derivadas de
datos**:

| Constante | Valor | Anclaje |
|---|---|---|
| `MARGEN_AMBIGUEDAD` | 0.15 | La separación 0.73 − 0.68 del ejemplo es 0.05, así que el margen debe ser ≥ 0.05 |
| `CONFIANZA_BAJA` | 0.80 | 0.73 ya merecía pregunta y 0.98 no |

**Calibrarlas es del médico dueño.** Subirlas pregunta más y fatiga; bajarlas
deja pasar confusiones. **Ninguna dirección es «segura» por defecto**, y por eso
no se eligió una a ciegas: son constantes con nombre, no números dentro de un
`if`, para que ajustarlas sea un acto explícito y revisable.
