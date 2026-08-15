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

**Ni un contenedor que no contiene más que una cosa.** Es la misma regla dicha
en general: la caja existe para agrupar. Cuando dentro hay un solo elemento —y
más aún si ese elemento ya es una superficie con su borde— el contenedor sólo
añade un marco alrededor de otro marco. Pasó en `/consulta`: dos radios
distintos (12 y 16) a 18px de distancia, alrededor del mismo botón.


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

**Y en las pantallas con ancla de paciente, el primario vive EN el ancla.** No
en una fila propia: medido en `/expediente` sobre los tres expedientes
sembrados, esa fila costaba 43px + 24px de margen con **720px sin usar a su
izquierda** — media lienzo vacío para sostener un botón que ya tenía sitio
junto al nombre (172px libres). En el teléfono, en cambio, la fila completa de
44px es lo correcto (es el objetivo del pulgar), pero **va después del aviso de
alergias**: en un ancho donde todo va en columna el orden es la jerarquía, y lo
único que hay que leer antes de empezar a atender es ese aviso.

## 4 · Un lienzo, un borde izquierdo — RTC-12(a), contestado midiendo

Esta regla nació aparcada («el ancho de la columna es deuda del monolito») y se
resolvió el 14-ago **cambiando qué se medía**.

El enunciado original de RTC-12(a) —«ninguna superficie usa el lienzo de
escritorio: columna única 880–1100px en todas»— da por hecho que el defecto es
**el ancho sobrante**. Medido, no lo es: 880px de historia clínica son **74
caracteres**, dentro del rango legible, y estirarlos hasta 1440 para llenar
píxeles sería el error contrario y más caro. Ensanchar no era la respuesta.

Lo que sí era un defecto, y no estaba escrito en ninguna parte, es que **no
había una regla**. El barrido estático contó **41 páginas del dashboard con
`maxWidth` propio en TRECE valores distintos** (480 · 520 · 720 · 800 · 820 ·
860 · 880 · 900 · 920 · 980 · 1000 · 1100 · 1180). Eso no es una decisión tomada
trece veces: es la ausencia de una decisión, repetida por quien tuviera prisa.

Y su consecuencia se ve en navegador (`medir-canvas-de-pagina-v15.mjs`, 1440px):
con cada contenedor centrado en su propio número, **el borde izquierdo del marco
—el píxel por el que se entra a leer— se movía al cambiar de pantalla**. El
médico no navega a un ancho: navega a una pantalla, y §20 pide que eso se sienta
como el mismo objeto haciéndose más detallado.

**La regla: un bloque compartido, un solo borde izquierdo.** `--nx-lienzo` fija
el ancho del bloque y no depende de la pantalla. Lo que cambia según el trabajo
es la MEDIDA del contenido dentro de él (`.nx-medida-lectura`), que **acorta por
la derecha sin mover el borde por el que se entra**. Dos pantallas distintas
empiezan en el mismo píxel; una acaba antes.

El valor —1100px— no se eligió por gusto: es el que el propio producto ya usaba
más veces (15 páginas), más que cualquier otro. La decisión aquí es que haya
**uno**, no cuál.

Y vive en la hoja, no en el JSX: la lección `nx-stat-grid` dice que un
`maxWidth` en línea vence a la hoja en silencio, así que al convertir una
pantalla el número escrito a mano **se borra, no se acompaña**. El trinquete
`lienzosAMano` cuenta los que quedan y sólo puede bajar.

## Lo que este documento NO decide todavía

- **Las píldoras de filtro — MEDIDAS el 14-ago, y la respuesta no era la
  esperada.** Contadas en las seis superficies
  (`docs/design/capturas/v15-pildoras/medicion.json`):

  | | píldoras | filas | con dato | sólo etiqueta | alto del pliegue |
  |---|---|---|---|---|---|
  | pendientes · consulta · hoy · operaciones | **0** | 0 | — | — | 0px |
  | pacientes | 3 | 1 | 2 | 1 | 102px |
  | **expediente** | **8** | **3** | 3 | **5** | **270px** |

  **No hay «exceso de píldoras» en el producto**: cuatro de seis superficies no
  tienen ninguna, y la fila de `/pacientes` lleva conteos reales — un filtro que
  dice cuántos hay informa; uno que sólo se pinta, decora. Convertirla en
  frases habría sido copiarle la forma a `/pendientes` sin mirar el trabajo:
  ahí las «píldoras» son conmutadores de una cosa, no un filtro sobre la misma
  lista.

  **El outlier es `/expediente`**: 8 píldoras en TRES filas y 270px del primer
  pliegue, con 5 de las 8 sin dato. Y las tres filas hacen **tres trabajos
  distintos** —el riel del Clinical Spine (navegación longitudinal, §7), el
  filtro de la historia clínica, y los chips de diagnósticos (datos)— vestidos
  igual. Eso no es «demasiadas píldoras»: es **RTC-18** («el elemento
  longitudinal de §7 se rinde como fila de píldoras igual a los filtros de
  /pacientes»), ahora confirmado con números. La rebanada que toque esto tiene
  que darle forma propia al Spine, no borrar píldoras.
- **El estado vacío** — es RTC-30, y a la tercera aplicación ya es regla. **Hoy**
  (14-ago, porque quitar la tarjeta dejó 250px de vacío ilustrado por encima de
  dos pendientes críticos), **`/citas`** (REG-314) y **`/pacientes`** (REG-315,
  15-ago). Lo que las tres comparten, y no se sabía al empezar:

  > **Todo vacío dice cuántos hay FUERA de lo que se está mirando**, y el gesto
  > sale de la CAUSA. Sólo el registro entero vacío conserva el héroe y ofrece
  > crear: ofrecer crear sobre lo que un filtro esconde es invitar al duplicado
  > — un expediente partido en `/pacientes`, una cita encima de otras seis en
  > `/citas`.

  **Las cuatro que quedaban, miradas una a una el 15-ago (REG-317) — y la
  cuarta vez la regla dejó de escribirse a mano.** Vive en
  `src/lib/ui/vacio-de-una-lista.ts`: héroe y gesto de alta sólo con el
  conjunto entero vacío; con filas escondidas, línea + recuento de lo que
  queda fuera + el gesto de la causa; y una causa que **no se puede soltar se
  dice igual, sin botón**. Los dos módulos anteriores no se convierten: llevan
  conocimiento propio (los parecidos por nombre, el día siguiente) y están
  medidos en navegador.

  | Pantalla | Veredicto |
  |---|---|
  | `/lista-espera` | **NO era defecto.** Sin buscador ni filtro, cero filas es cero de verdad: el héroe con «Agregar» es correcto. Queda declarado para que nadie lo «arregle». |
  | `/farmacia` | Convertida. «Sin resultados con esos filtros» + ilustración de 253px y cero controles → línea de 62px con el recuento y el gesto. |
  | `/cumplimiento` (bitácora) | Convertida. Con 200 asientos y el filtro de tipo puesto decía «Sin eventos registrados aún», dos líneas encima de la cita a NOM-024. |
  | `/reactivacion` | Convertida, y era el peor: **felicitaba** («¡Buen seguimiento!») escondiendo a cuatro pacientes por cuatro causas distintas — el umbral, la baja, ARCO y no tener teléfono. |

  Lo que enseñó la cuarta: **una causa que no se puede soltar sigue siendo una
  causa.** Antes sólo se pintaba lo que tenía botón, y por eso «no tiene
  teléfono registrado» —el caso que más se parecía a un éxito y menos lo era—
  no se decía en ninguna parte.
- **Los dos FAB de escritorio** — RTC-05 se pagó con alcance declarado; se
  vuelven a mirar cuando el marco esté hecho, no antes.
- **Las 35 páginas del dashboard que siguen con su ancho a mano.** La regla 4
  las cubre a todas; esta rebanada convirtió las SEIS que puntúa §29. El
  trinquete `lienzosAMano` (techo 52, sólo baja) impide que aparezca una
  nueva y hace que la cola sólo pueda encogerse.
- **Qué vive en el ancho que queda a la derecha.** El lienzo lo reserva; hoy
  está vacío. Es el sitio de la Capa 4 de §5 —la lente contextual— que no
  existe todavía como pieza. No se rellena con nada mientras tanto.

## Cómo se aplica

Rebanada a rebanada, y **cada una vuelve a puntuar**: el marco toca cinco
pantallas y convertirlas todas de golpe sin medir sería exactamente el error
que el sistema de diseño existe para evitar.

| Pantalla | Estado |
|---|---|
| `/pendientes` | Es el patrón. Sólo se le puso el lienzo compartido (6ª rebanada): era la única de las seis **sin contenedor de ningún tipo**, así que su ancho lo decidía el `<main>`. |
| `/pacientes` | **Convertida** (14-ago): subtítulo + lista sin tarjeta + encabezados que hablan. **Sus cuatro estados vacíos, 15-ago** (REG-315): de tres párrafos grises sin control a una decisión sola (`vacio-de-la-lista.ts`) que dice cuántos expedientes hay fuera y ofrece el gesto de la causa. |
| `/operaciones` | **Convertida** (14-ago, 3ª rebanada): RTC-29 le dio la lista; ahora su cabecera es la pieza compartida (`PageHeader`) en vez de un par de etiquetas propias. |
| `/dashboard` (Hoy) | **Convertida** (14-ago, 2ª rebanada): sus dos bloques dejaron la tarjeta, y su vacío pasó a línea (RTC-30). |
| `/expediente` | **A medias** (14-ago): su vacío de historia pasó a línea (RTC-30) y la pantalla entera cabe ahora en el primer viewport. Su marco de cabecera es distinto —el ancla de paciente, con su serif y su banda de alergias— y NO se le aplica la regla 1: ahí el `<h1>` es el nombre del paciente, no el de la pantalla. «Nueva consulta» subió al ancla tras medirlo (5ª rebanada): la historia clínica pasa de 491px a 424px. |
| `/consulta` | **A medias** (14-ago, 4ª rebanada): la caja de grabación ya no dibuja un segundo marco alrededor del botón —sólo se pinta cuando agrupa varios controles—. Su cabecera es el ancla de paciente, igual que el expediente: la regla 1 no le aplica tal cual. |

**6ª rebanada (14-ago) — el lienzo, en las seis.** Las seis entran ya por `.nx-canvas`: un ancho declarado en vez de cuatro (más `/pendientes` sin ninguno), y el borde izquierdo del marco idéntico en todas — salto **110px → 0px**, medido en navegador. Lo que cambia según el trabajo es la medida del contenido, no la puerta por la que se entra.

