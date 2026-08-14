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


---

# Tercera pasada — después de las tres rebanadas de RTC-31

**Fecha:** 14-ago-2026 · **Capturas:** `docs/design/capturas/v15-rtc31-b/`
(escritorio, las seis superficies, build de producción + emuladores + siembra,
0 errores de consola) y `v15-rtc31-hoy/` · `v15-rtc31/`.

| Superficie | 1ª pasada | 2ª pasada | **3ª** | Qué la movió |
|---|---|---|---|---|
| Pendientes | 1.0 | 1.0 | **1.0** | Nada: es el patrón. |
| **Hoy** | 2.0 | 2.0 | **1.5** | Sus dos bloques soltaron la tarjeta; el vacío pasó a línea y el worklist entero cabe en el primer viewport. |
| **Pacientes** | 5.0 | 2.0 | **1.5** | Subtítulo, lista sin tarjeta, encabezados que agrupan hablando. |
| **Operaciones** | 4.0 | 2.0 | **1.5** | Cabecera compartida sobre la lista con propósito y cadencia de RTC-29. |
| **Expediente** | 2.5 | 2.5 | **2.0** | El vacío de la historia dejó de ser un hero: la pantalla entera cabe arriba. |
| Consulta | 2.0 | 2.0 | **2.0** | **Nada — no se tocó.** |

**GENERIC_AI_LOOK_SCORE = 2.0.** Objetivo ≤ 1.0 → **sigue FAIL**.

## El control que hace creíble la medición

`/consulta` no se tocó en ninguna de las tres rebanadas y **no se movió**: 2.0
en las tres pasadas. Eso importa porque quien puntúa es quien hizo el trabajo, y
un score que baja en todo lo que uno toca —y sólo ahí— es lo mínimo que se le
puede pedir a una medición hecha por parte interesada. No la vuelve objetiva;
la vuelve comprobable por otro.

## Lo que queda, con nombre

- **`/consulta` y `/expediente` (2.0)** son ahora las peores, y su marco es el
  que RTC-31 todavía **no ha decidido**: los dos tienen ancla de paciente, y ahí
  el `<h1>` es el nombre de la persona, no el de la pantalla — la regla 1 no les
  aplica tal cual. Decidir qué les aplica es la rebanada siguiente.
- **Observado y no tocado** en `/expediente`: «Nueva consulta» flota solo en una
  fila vacía. Moverlo al ancla toca la rejilla móvil de V10-DEBT-006 y competiría
  con «Consulta sin cerrar — continuar»; se mide antes.
- **Las píldoras de filtro** siguen en tres superficies, sin decidir.
- **Los dos FAB de escritorio** siguen en 6/6 (RTC-05, alcance declarado).

## Honestidad sobre el número

Ninguna superficie llega al objetivo salvo la que ya estaba. El producto pasó de
**5.0 a 2.0** en una jornada y eso es real y medido, pero **2.0 no es ≤1.0** y la
iteración `V15-ORIGINALITY-REDTEAM-001` **no se cierra**.


---

## Nota del 14-ago (posterior): las tres pasadas se puntuaron con expedientes VACÍOS

Las tres declararon la misma limitación —«no cubre pantallas llenas: la siembra
deja el expediente con 0 encuentros»— sin darse cuenta de que la limitación
tenía arreglo. La siembra sintética **no creaba ni una sola nota**; ese mismo
hueco es el que impidió a RTC-10 medir `#spine-problemas` y a RTC-31 medir la
convivencia del primario con «Consulta sin cerrar — continuar».

**Cerrado el 14-ago**: la siembra crea ahora cuatro notas (tres firmadas con
diagnósticos y signos, una en borrador) y deja pacientes sin notas a propósito,
porque el expediente vacío es el estado del paciente nuevo y también hay que
poder medirlo. Con historia real, `/expediente` enseña lo que no se había visto
nunca en una medición: banda de alergias con alérgeno real y su procedencia,
riel del Spine con «1 dx · 0 fármacos», tarjetas de signos y diagnósticos con
contenido, el bloque de problemas, los pendientes del paciente con «1 vencido ·
1 en plazo», y la historia con su badge de borrador.

**Consecuencia para el score:** las lecturas de `/expediente` de las tres
pasadas son de la pantalla vacía. La cuarta pasada tendrá que puntuar la
pantalla llena, que es la que el médico ve. No se corrigen aquí los números
viejos: se declara de qué eran.


---

# Cuarta pasada — con historia sembrada, y con el marco en seis pantallas

**Fecha:** 14-ago-2026 · **Capturas:** `docs/design/capturas/v15-repuntuacion-v29-4a/`
(las seis superficies **con historia real**, más `/expediente` y `/consulta`
también en su estado vacío, que es el del paciente nuevo). 0 errores de consola.

Es la primera pasada que puntúa la pantalla que el médico ve de verdad: las tres
anteriores puntuaron expedientes sin una sola nota.

| Superficie | 1ª | 2ª | 3ª | **4ª** | Qué la movió |
|---|---|---|---|---|---|
| Pendientes | 1.0 | 1.0 | 1.0 | **1.0** | Nada: sigue siendo el patrón. |
| Hoy | 2.0 | 2.0 | 1.5 | **1.5** | Nada desde la 3ª. |
| Pacientes | 5.0 | 2.0 | 1.5 | **1.5** | Nada desde la 3ª. |
| Operaciones | 4.0 | 2.0 | 1.5 | **1.5** | Nada desde la 3ª. |
| **Expediente** | 2.5 | 2.5 | 2.0 | **1.5** | Con historia enseña lo que es: alergia con procedencia, riel con conteos que significan algo, bloque de problemas con su «de lo último que se dijo… en sus notas firmadas», pendientes del paciente con «1 vencido · 1 en plazo». |
| **Consulta** | 2.0 | 2.0 | 2.0 | **1.5** | RTC-14 (una sola alergia, con «se lee:») y la identidad encabezando. |

**GENERIC_AI_LOOK_SCORE = 1.5.** Objetivo ≤ 1.0 → **sigue FAIL**.

## Lo que queda ya no es «el marco»: son tres cosas con nombre

En la 2ª pasada lo que quedaba era el marco de página entero, repetido en cinco
superficies. Pagado eso, la distancia entre el 1.5 general y el 1.0 de
`/pendientes` se reduce a tres residuos concretos:

1. **Las píldoras de filtro** — en `/pacientes`, `/expediente` y en la historia
   clínica. `/pendientes` no las tiene: usa frases («Ver sólo los míos»). Sigue
   sin decidirse, y ahora es lo más caro que queda.
2. **La fila de tarjetas-estadística** del expediente (ÚLTIMOS SIGNOS ·
   DIAGNÓSTICOS ACTIVOS · ACTIVIDAD). Su CONTENIDO es clínico y específico; su
   FORMA es la fila de KPIs de cualquier tablero.
3. **Los dos FAB de escritorio**, en 6 de 6. RTC-05 se pagó con alcance
   declarado y esa decisión sigue en pie — pero ahora que no quedan defectos
   mayores, son lo que más se parece a otro producto.

## El control, otra vez

`/pendientes` no se ha tocado en ninguna de las seis rebanadas y sigue en 1.0.
`Hoy`, `/pacientes` y `/operaciones` no se tocaron desde la 3ª pasada y no se
movieron. Sólo se movió lo que se tocó. Sigue sin ser una medición objetiva
—la hace quien hizo el trabajo— pero es comprobable por otro, que es lo máximo
que puede ofrecer un score documentado.

## Honestidad sobre el número

De **5.0 a 1.5** en una jornada, medido cuatro veces sobre capturas nuevas. Y
sigue sin cumplir: **1.5 no es ≤1.0**, la compuerta §29/§34 continúa en FAIL y
`V15-ORIGINALITY-REDTEAM-001` no se cierra.


---

# Quinta pasada — y el límite del método

**Fecha:** 14-ago-2026 · **Capturas:** `docs/design/capturas/v15-repuntuacion-v29-5a/`.
0 errores de consola.

| Superficie | 1ª | 2ª | 3ª | 4ª | **5ª** |
|---|---|---|---|---|---|
| Pendientes | 1.0 | 1.0 | 1.0 | 1.0 | **1.0** |
| Hoy | 2.0 | 2.0 | 1.5 | 1.5 | **1.5** |
| Pacientes | 5.0 | 2.0 | 1.5 | 1.5 | **1.5** |
| Operaciones | 4.0 | 2.0 | 1.5 | 1.5 | **1.5** |
| Consulta | 2.0 | 2.0 | 2.0 | 1.5 | **1.5** |
| **Expediente** | 2.5 | 2.5 | 2.0 | 1.5 | **≈1.0–1.5** |

`/expediente` bajó por RTC-18 (el riel dejó de vestirse de filtro) y por la
fila de KPIs convertida en prosa. En la lectura general ya no se distingue de
`/pendientes`… **y ahí está el problema con el número.**

## El método llegó a su resolución

Entre 1.0 y 1.5 este score deja de discriminar. Las diferencias que quedan son
de juicio, no de estructura: dos personas mirando la misma captura pondrían
1.0 y 1.5 sin que ninguna se equivoque. Y quien puntúa es quien hizo el
trabajo, que es el peor sesgo posible justo cuando los márgenes se estrechan.

Por eso la 5ª pasada **no declara PASS**, aunque una lectura amable podría
hacerlo. Lo honesto es decir dos cosas:

1. **La compuerta sigue formalmente en FAIL**, porque `≤1.0` exige que TODAS
   las superficies lleguen, y cuatro están en 1.5 por lecturas que yo mismo
   hice.
2. **El siguiente juez no puedo ser yo.** §29 nombra un panel de equipo rojo
   precisamente para esto. Lo que queda no es implementación a ciegas: es una
   lectura independiente sobre las capturas de la 5ª pasada.

## Lo que sigue abierto, con su decisión ya tomada

- **Las píldoras de `/pacientes`** — se quedan: la medición dice que informan
  (3 en una fila, 2 con conteos). Convertirlas en frases sería copiarle la
  forma a `/pendientes` sin mirar el trabajo.
- **Los dos FAB de escritorio** (6/6) — RTC-05 se pagó con alcance declarado.
  Si el panel independiente los nombra, se reabre; no antes.

## Corrección al alcance de la medición de píldoras

El arnés cuenta **controles** (`button`, `a`) con radio de píldora. `/pendientes`
salió con **0**, y eso no significa que no tenga formas de píldora: su cola de
cierre pinta ocho *chips* de estado por fila, que son `<span>` no interactivos.
La conclusión —«lo que navega y lo que filtra no pueden compartir silueta»— no
cambia, pero el «0» hay que leerlo como «cero píldoras PULSABLES», no como
«cero píldoras».
