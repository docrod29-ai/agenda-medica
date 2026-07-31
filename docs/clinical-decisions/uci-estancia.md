# ADR · Día de UCI y estancia

**Motor:** `uci-estancia` · `src/lib/uci/estancia.ts`
**Estado:** `validado`.

## Fuente de verdad

**Decisión del Dr. David Alonso Rodríguez Luna, 2026-07-30.** Ante la propuesta
de contar el día de UCI por bloques de 24 h, respondió que **no elegiría una de
las dos definiciones**: guardaría ambas.

> «No usar bloques de 24 h como única definición de "Día UCI". Guardar:
> `admittedAt`, `unitTimezone`, `elapsedMinutes`, `calendarDayNumber`,
> `completed24hPeriods`. El display clínico será "Día UCI N · X h de estancia".»

## Referencia

Convención administrativo-clínica, no una regla médica. El Dr. la fundamenta en
que muchos flujos clínicos y administrativos —cita el uso de días naturales en
NHS England para ciertos fines— cuentan el día de atención crítica como día de
calendario, no como bloques sucesivos de 24 h.

**Fundamento aportado por el médico**, no verificado por mí contra la fuente
primaria: la decisión se registra como suya.

## Por qué guardar los tres

Cada dato responde una pregunta distinta, y elegir uno destruye el otro. El
ejemplo que fijó la decisión:

| Ingreso lunes 23:50, se mira el martes 08:00 | |
|---|---|
| `calendarDayNumber` | **2** — ya es el día siguiente en la unidad |
| `elapsedMinutes` | **490** — 8 h 10 min |
| `completed24hPeriods` | **0** — no ha cumplido ni un periodo |

Decir «Día 1» sería falso para el turno. Decir «Día 2» a secas sugeriría un día
entero de estancia. Por eso el encabezado dice las dos cosas:
**«Día UCI 2 · 8 h de estancia»**.

## La zona horaria nunca es la del navegador

`calendarDayNumber` se calcula con `config.zonaHoraria` —la zona de la unidad—,
no con la del equipo desde el que se abre la pantalla. El mismo paciente tiene
que estar en el mismo día de UCI para el intensivista que pasa visita y para el
residente que lo consulta desde otro huso.

Por eso `unitTimezone` es **obligatorio** y una cadena vacía **lanza**: no hay
default silencioso que pueda degradar a la zona del navegador. Es la lección
REG-011 aplicada, resuelta con configuración en vez de con una convención que
esquiva el problema.

## Para cálculos clínicos, timestamps

`calendarDayNumber` es para **mostrar y reportar**. Un balance de «últimas 24 h»,
una tendencia o una exposición se calculan con instantes reales y ventanas
exactas — ver `PARA_CALCULOS_USAR_TIMESTAMPS`, congelado en un caso.

## Golden

`src/__tests__/uci-estancia.test.ts` — **18 casos**.

| Congela |
|---|
| El ejemplo del Dr., dato por dato, y la etiqueta literal |
| A los 10 min ya es día 2 pero 0 periodos cumplidos |
| La misma hora real da días distintos en zonas distintas — y eso es correcto |
| La duración exacta **no** depende del huso |
| El mismo instante con otro desfase da lo mismo derivado |
| Sin zona horaria **lanza**, con el porqué en el mensaje |
| Un ingreso en el futuro no produce día 0 ni duración negativa |
| El número de día **no** sirve para calcular |
