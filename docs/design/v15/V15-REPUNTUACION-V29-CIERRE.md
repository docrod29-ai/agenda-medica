# Re-puntuación §29 (segunda pasada) — después de RTC-15 y RTC-29

**Fecha:** 14-ago-2026 · **Iteración:** `V15-ORIGINALITY-REDTEAM-001` (16/19)
**Capturas:** `docs/design/capturas/v15-repuntuacion-v29-cierre/` — 18 imágenes
nuevas (6 superficies × escritorio 1440×900 · móvil 390×844 · logo-off), build
de producción + emuladores + siembra, **0 errores de consola**.
**Primera pasada:** [`V15-REPUNTUACION-V29.md`](V15-REPUNTUACION-V29.md).

## El resultado

| Superficie | Antes | Ahora | Qué cambió |
|---|---|---|---|
| Pendientes | 1.0 | **1.0** | Nada. Sigue siendo la superficie de referencia. |
| Hoy | 2.0 | **2.0** | Nada. |
| Consulta | 2.0 | **2.0** | Nada. |
| Expediente | 2.5 | **2.5** | Nada. Su residuo es el estado vacío de plantilla (RTC-30). |
| **Operaciones** | 4.0 | **2.0** | RTC-29: dejó de ser un lanzador. Lista con propósito y cadencia por grupo; el respaldo aterrizó aquí. |
| **Pacientes** | 5.0 | **2.0** | RTC-15: cada fila dice su estado clínico en prosa. Ya no es una libreta de contactos. |

**GENERIC_AI_LOOK_SCORE (peor superficie) = 2.5.** Antes: 5.0. Objetivo ≤ 1.0.

## Veredicto de compuerta

`GENERIC_AI_LOOK ≤ 1` → **sigue FAIL**, y la iteración **no se cierra**.

Pero el mapa cambió, y de una forma que importa más que el número: **ya no hay
una superficie mala**. Hay seis superficies entre 1.0 y 2.5 con **el mismo
residuo compartido**, y eso convierte lo que quedaba en un problema distinto
del que se estaba resolviendo.

## Lo que la segunda pasada enseñó, y la primera no podía

La primera pasada encontró dos superficies fuera de sitio y las nombró. Pagadas
las dos, lo que queda ya no se puede repartir por pantalla: **es el marco de
página**, y es idéntico en cinco de las seis.

Cinco superficies comparten esta anatomía, en este orden:

```
título de página + racimo de botones a la derecha
buscador o filtros de ancho completo
fila de píldoras
contenedor de tarjeta con filas dentro
(cuando está vacío) icono centrado + título + frase + botón primario
+ dos botones circulares flotantes abajo a la derecha, en las seis
```

Es el esqueleto que genera cualquier andamio. **La única que no lo tiene es
`/pendientes`** —la que puntúa 1.0—: sus filas van a sangre, sin tarjeta
contenedora, sin píldoras de filtro, y su cabecera no es un título con botones
sino una frase que dice de dónde salen las tareas.

Esa correlación es la respuesta a por qué el resto se atasca en 2.0–2.5 por más
que mejore su contenido: **el contenido ya es de este producto; el marco sigue
siendo de cualquiera.** Ninguna cantidad de trabajo dentro de las filas baja un
score que se paga en el frame.

## El trabajo que sale de aquí

1. **RTC-31 · El marco de página es la parte genérica** (NUEVO, P1). Un
   contenedor de página propio: qué hace la cabecera cuando la pantalla ya se
   anuncia en el riel, dónde viven los filtros, y por qué una lista de trabajo
   no necesita una tarjeta alrededor. `/pendientes` es la prueba de que este
   producto ya sabe hacerlo — hay que llevarlo a las otras cinco. Emparenta con
   **RTC-16** (P2: «no hay UN contenedor de página; 4 contenedores distintos»),
   que deja de ser un detalle de consistencia y pasa a ser la causa medida.
2. **RTC-30 · El estado vacío de plantilla** (P2, ya abierto). Es la mitad del
   residuo de Expediente y de Hoy.
3. **Los dos FAB de escritorio** siguen sin ser trabajo nuevo: RTC-05 se pagó
   con alcance declarado. Pero aparecen en 6/6 y, cuando el marco se rehaga,
   habrá que volver a mirarlos con esa decisión sobre la mesa — no antes.

## Honestidad sobre el número

Dos superficies bajaron 3.0 y 2.0 puntos con una rebanada cada una. Sería fácil
escribir que la compuerta «casi» pasa. No pasa: **2.5 no es ≤1.0**, y el
objetivo lo fijó el dueño en §29, no el equipo rojo. Lo que sí se puede decir
con la medición en la mano es que lo que falta está **localizado, medido y
nombrado**, y que es UNA cosa repetida cinco veces en vez de cinco cosas.

## Qué NO cubre esta medición

- Lo mismo que la primera pasada: no es auditoría de accesibilidad, no puntúa
  móvil por separado, y no cubre pantallas llenas (la siembra deja el
  expediente de `pac-refugio-alcantara` con 0 encuentros).
- **No re-puntúa Hoy, Consulta, Expediente ni Pendientes con criterio nuevo**:
  su código no cambió entre las dos pasadas, así que se conservan las lecturas
  de la primera. Lo que sí se hizo fue mirar sus capturas nuevas para descartar
  regresión — ninguna la tiene.
- No es reproducible por un guardián: un score es un juicio documentado.
