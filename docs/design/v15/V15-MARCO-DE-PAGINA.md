# El marco de página — RTC-31

**Nace de una medición, no de un gusto.** La segunda pasada de §29
([`V15-REPUNTUACION-V29-CIERRE.md`](V15-REPUNTUACION-V29-CIERRE.md), 14-ago-2026)
dejó cinco superficies empatadas en 2.0–2.5 y una sola en **1.0**:
`/pendientes`. Pagados los defectos de contenido de las dos peores, lo que
quedaba dejó de repartirse por pantalla: **es el marco, y es el mismo en las
cinco.**

```
título de página + racimo de botones a la derecha
buscador o filtros de ancho completo
fila de píldoras
contenedor de tarjeta con filas dentro
(vacío) icono centrado + título + frase + botón primario
```

Ése es el esqueleto que genera cualquier andamio. Este documento dice qué hace
este producto en su lugar, y cada regla sale de comparar contra la superficie
que ya puntúa 1.0 — no de inventar una forma nueva.

## 1 · Toda pantalla dice qué es y de dónde sale su contenido

`PageHeader` exige `subtitle` **en el tipo**, no como recomendación.

Un título solo —«Pacientes»— no informa a nadie: el riel ya anuncia dónde
estás, así que repetir el nombre de la pantalla en 20px es decorar. Lo que
informa es la frase que dice de dónde sale lo que hay dentro:

> **Pendientes** — Estudios pedidos, resultados sin revisar y recetas sin
> entregar. **Salen solos al firmar la nota.**

Ocho de las nueve pantallas con cabecera ya lo hacían. La novena era
`/pacientes`, la más visitada del producto: una regla que se cumple ocho de
nueve veces no es una regla, es una costumbre, y la excepción cae siempre en la
pantalla que más prisa tuvo. En el tipo, el compilador se encarga.

**Y no vale cualquier frase.** Si el subtítulo repite el título con más
palabras («Pacientes — listado de pacientes»), sobra la frase y falta la
decisión sobre qué es esa pantalla.

## 2 · Una lista de trabajo no lleva tarjeta alrededor

El contenedor `.card` dibujaba un marco alrededor de la lista entera: una
frontera que no separa nada de nada, porque dentro hay una sola cosa. Sumado a
la tarjeta de cada fila, el resultado es el tablero «hecho enteramente de
tarjetas redondeadas» que la regla de diseño prohíbe por su nombre.

`/pendientes` no la tiene. Sus filas van a la página, y quien agrupa es **el
encabezado del grupo, que además DICE algo**: «Requiere atención (2)», «Vistos
recientemente», «3 con inasistencias». El marco era lo genérico; el encabezado
es lo que informa.

Regla: **agrupa el encabezado, no la caja.** Rol `.t-overline`, sin fondo y sin
borde propio.

## 3 · Un solo primario relleno por cabecera — y sólo si la pantalla tiene uno

Tres botones alineados a la derecha con uno relleno es el racimo de cualquier
CRM. La pregunta que decide no es estética: **¿cuál es LA acción de esta
pantalla?** Si hay dos respuestas, una de las dos es una operación (§11) y su
sitio es `/operaciones` — así salió «Respaldo» de `/pacientes` en RTC-29.

`/pendientes` no tiene ninguno relleno, porque su trabajo vive en las filas.

## Lo que este documento NO decide todavía

- **Las píldoras de filtro.** Están en la lista de residuos y se ven genéricas,
  pero las de `/pacientes` llevan conteos reales y sirven. Cambiarlas sin medir
  sería repintar. Queda para la rebanada que las mida contra el patrón de
  `/pendientes` («Ver sólo los míos» es una frase, no una píldora).
- **El estado vacío** — es RTC-30. **Pagado en Hoy** el 14-ago, porque quitar
  la tarjeta lo dejó insostenible (250px de vacío ilustrado por encima de dos
  pendientes críticos); el resto de pantallas sigue con el hero y se mira caso
  por caso — a veces el vacío ES la pantalla y el hero es correcto.
- **Los dos FAB de escritorio** — RTC-05 se pagó con alcance declarado; se
  vuelven a mirar cuando el marco esté hecho, no antes.
- **El ancho de la columna** — es RTC-12(a), deuda dimensionada del monolito.

## Cómo se aplica

Rebanada a rebanada, y **cada una vuelve a puntuar**: el marco toca cinco
pantallas y convertirlas todas de golpe sin medir sería exactamente el error
que el sistema de diseño existe para evitar.

| Pantalla | Estado |
|---|---|
| `/pendientes` | Es el patrón. No se toca. |
| `/pacientes` | **Convertida** (14-ago): subtítulo + lista sin tarjeta + encabezados que hablan. |
| `/operaciones` | Media hecha por RTC-29 (lista con propósito y cadencia); le falta la cabecera. |
| `/dashboard` (Hoy) | **Convertida** (14-ago, 2ª rebanada): sus dos bloques dejaron la tarjeta, y su vacío pasó a línea (RTC-30). |
| `/expediente` | Pendiente — su marco es distinto (ancla de paciente), hay que decidir qué le aplica. |
| `/consulta` | Pendiente — íd. |
