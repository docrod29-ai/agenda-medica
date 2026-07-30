# ADR · Biblioteca de preparaciones de infusión (3 capas)

**Motor:** `infusion-library` · `src/lib/clinical/infusion-library.ts`
**Estado:** `pendiente_validacion` — la arquitectura está lista; **faltan las
preparaciones del hospital**, que sólo puede aportar el médico dueño.

## Fuente de verdad

**Decisiones Q2 e ICU-Q4.3 del médico dueño, 29-jul-2026**:

> «No disponemos todavía de las preparaciones locales. **NO INVENTAR NINGUNA.**
> Implementar arquitectura primero.»

```
Prioridad:  PATIENT_ACTIVE_PREPARATION  >  HOSPITAL_STANDARD  >  REFERENCE_LIBRARY
```

> «`REFERENCE_LIBRARY` **nunca** se tratará como estándar local.»
> «**Nunca** aprender una dilución local automáticamente de una sola infusión.»

Y el caso literal:

```
Falta preparación local + «Norepinefrina a 12 mL/h»
  medication = norepinephrine · pumpRate = 12 mL/h
  doseStatus = CANNOT_CALCULATE · reason = MISSING_CONCENTRATION
  → pedir: cantidad total · unidad · volumen final · peso si aplica
```

## Referencia

- La decisión menciona **ASHP Standardize 4 Safety** como fuente posible de la
  capa de referencia. **No se cargó**: hacerlo exige la fuente citada y su
  licencia revisada, y es su propia unidad de trabajo.
- El cálculo de dosis lo hace `src/lib/uci/infusiones.ts` (ya con
  `ClinicalQuantity`). Este módulo sólo decide **con qué preparación** se calcula.

⚠️ **Cero concentraciones en este archivo.** `REFERENCE_LIBRARY` es un arreglo
vacío a propósito: uno vacío es honesto, uno con números inventados es peligroso.

## Golden

`src/__tests__/infusion-library-capas.test.ts` — **15 casos**.

| Congela |
|---|
| La del paciente gana sobre la del hospital; la del hospital sobre nada |
| Con SÓLO referencia ⇒ `CANNOT_CALCULATE`, **nunca** un número |
| La referencia se devuelve para MOSTRARLA rotulada, no para calcular |
| Pide los **cuatro** datos que enumera la decisión |
| `REFERENCE_LIBRARY` está **vacía** (no se inventó ninguna) |
| El ejemplo literal: «12 mL/h» se registra como hecho observado, **sin dosis** |
| Promover a estándar exige confirmación explícita **Y** usuario autorizado |
| Promover **no muta** la preparación original |

## Unidades y firma

```ts
resolverPreparacion(Preparacion[], medicamento) → ResolucionPreparacion
registrarSinDosis(medication, pumpRate, motivo?) → InfusionSinDosis
promoverAEstandarHospital(prep, autor, confirmado, fechaIso) → Preparacion
```

La concentración se **deriva** de `cantidadFarmaco` / `volumenFinal`; nunca se
teclea, para que no pueda contradecir a sus componentes.

## Dato faltante

Es el caso central, no una excepción: sin preparación local el resultado es
`CANNOT_CALCULATE` con el motivo y la lista de lo que hay que pedir. El dato
dictado (la velocidad de bomba) **se conserva**: descartarlo perdería lo que el
médico dijo.

## Pendiente de validación clínica

**Las preparaciones de la unidad del Dr.** Mientras no existan,
`HOSPITAL_STANDARD` está vacío y el médico captura cantidad, volumen, velocidad
y peso a mano — que es exactamente lo que su decisión pide.
