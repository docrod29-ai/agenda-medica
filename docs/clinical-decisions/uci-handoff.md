# ADR · ICU Handoff

**Motor:** `uci-handoff` · `src/lib/uci/handoff.ts`
**Estado:** `validado` — compone datos que ya existen; no redacta contenido
clínico.

## Fuente de verdad

**Charter §36**:

> «Generar ICU HANDOFF con: identificación · problemas activos · soportes ·
> cambios · pendientes · contingencias · dispositivos.
>
> **Siempre revisado por médico.**»

## Referencia

Ninguna fuente clínica: el módulo **ensambla** secciones que otros motores ya
redactaron (`morning-brief` los cambios, `metas-diarias` los pendientes,
`ICUStay` los soportes) y **no reescribe** ninguna. No aporta criterio médico.

## La regla vive en el TIPO, no en un comentario

Un handoff **nace `BORRADOR`** y **no hay forma de construirlo `REVISADO`**: sólo
`marcarRevisado()` cambia el estado, y exige quién y cuándo. Un caso del golden
intenta colar `estado: 'REVISADO'` por la entrada y comprueba que se ignora.

Un comentario que dijera «recuerda revisarlo» se ignora. Un tipo que no te deja,
no.

Esto importa aquí más que en cualquier otro módulo: **el handoff es el documento
que se lee cuando el que conoce al paciente ya se fue.** Un error que pase el
cambio de turno se propaga a un equipo que no tiene con quién contrastarlo.

## Golden

`src/__tests__/uci-handoff.test.ts` — **23 casos**.

| Congela |
|---|
| Nace `BORRADOR`; no se puede construir revisado |
| No se entrega el turno sin revisión; la revisión exige médico identificado |
| Revisar **no muta** el borrador |
| Que falten secciones **no** impide entregar; que nadie lo lea, **sí** |
| **Problemas activos** y **contingencias** van vacíos **y declarados** |
| Cada hueco lleva su motivo, distinguiendo «no se documentó» de «no lo propone el sistema» |
| Ventilado sin día de VM: se avisa. **No** ventilado: no se avisa de lo que no aplica |
| Compone lo ya redactado, sin re-redactarlo |
| No muta los arreglos que recibe |

## Dato faltante

**Un hueco nunca se calla.** Cada sección vacía entra en `ausentes` con su
motivo, porque en un handoff un espacio en blanco se lee como «no hay nada» — y
en **contingencias** eso es peligroso.

## Las dos secciones que el sistema NO redacta

- **Problemas activos** — es una síntesis clínica, no un volcado de diagnósticos.
- **Contingencias** — «si la MAP baja de X, hacer Y» es un **plan terapéutico**.
  Sugerirlas sería dar indicación de tratamiento.

`loQueFaltaDelMedico()` las devuelve como lista explícita de lo que él tiene que
escribir antes de entregar.
