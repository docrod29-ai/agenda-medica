# Re-puntuación §29 — `GENERIC_AI_LOOK_SCORE` tras los diez P1

**Fecha:** 14-ago-2026 · **Iteración:** `V15-ORIGINALITY-REDTEAM-001` (16/19)
**Capturas:** `docs/design/capturas/v15-repuntuacion-v29/` — 18 imágenes NUEVAS
(6 superficies × escritorio 1440×900 · móvil 390×844 · logo-off), 0 errores de
consola, build de producción + emuladores + siembra sintética.

## Por qué se vuelve a puntuar

El score **no se hereda**. Los diez P1 del registro canónico están pagados, pero
puntuar sobre las capturas que *encontraron* los defectos sería puntuar el
pasado. §29 pide una lectura sobre la pantalla que existe hoy, y §34 la exige
como parte de la compuerta estructural.

La escala es 0–10 contra: Claude Artifacts · v0 · Lovable · Bolt · Replit ·
Tailwind-shadcn genérico · plantilla de administración médica genérica.
**Objetivo: ≤ 1.0.** §29 prohíbe expresamente bajar el score sólo porque la
paleta sea inusual: las razones tienen que ser **estructurales** y quedar
escritas. Aquí lo están.

## El instrumento, primero — y otra vez estaba roto

La pasada **logo-off** de la primera corrida ocultaba
`.nx-marca, [data-marca], svg[aria-label*="Ausculta"]`. **Ninguno de los tres
existe en este repositorio**: la marca la dibuja `MarcaAusculta` con
`aria-hidden`, dentro de `.sidebar-logo`, y el nombre del consultorio lo pinta
la franja. Las seis capturas «sin logotipo» salieron **con el logotipo puesto** y
habrían contestado la pregunta de §34 sin haber quitado nada.

Es la cuarta vez en esta iteración que el defecto está en el instrumento y no en
el producto, y es literalmente la misma forma que el `window.scrollTo` de RTC-12:
*una condición que se cumple porque el gesto no ocurrió.* El arnés ahora cuenta
cuántos nodos ocultó y lo escribe en `marcas-ocultadas.json` (3–4 por
superficie); si contara cero, lo dice en voz alta. La pasada se repitió entera.

## Las seis lecturas

| Superficie | Score | Lo que la hace ESTE producto | Lo que todavía la hace cualquiera |
|---|---|---|---|
| **Pendientes** | **1.0** | Filas a sangre, sin tarjeta. Progresión de estado explícita (`Resultado → Significado → Dueño → Revisión → Decisión → Acción → Aviso al paciente → Cerrado`) con lo ya recorrido en sólido y lo pendiente en cursiva apagada. «sin dueño», «venció 13-ago», y la **consecuencia en prosa**: «Venció y nadie la tomó», «Prioridad crítica sin nadie asignado». Acciones con verbo de trabajo: «Tomarla», «Ya no aplica», «Lo revisé — cerrar». Ninguna plantilla escribe la consecuencia de no hacer la tarea. | Nada estructural. Residuo compartido: la banda de prueba y los dos botones flotantes de escritorio. |
| **Hoy** | **2.0** | El Flow Rail de cuatro destinos con el quinto contexto como acción. «Sigue abierto de antes» — continuidad entre días, no un contador de tareas. La agenda vacía dice «Mañana tienes 6», que es información, no consuelo. | Estado vacío de manual: icono centrado + título + frase + botón primario (RTC-30). Los dos FAB de escritorio (alcance ya decidido en RTC-05). |
| **Consulta** | **2.0** | Identidad y alergias **antes** que nada, con el nombre en serif. «Herramientas clínicas (6)» como lista plegada de una línea con su *para qué*, no como rejilla de tarjetas. El dictado es el centro de la pantalla porque es el trabajo. | El micrófono es un disco de acento sobre tarjeta redondeada — el gesto «héroe de producto de IA». Los dos FAB. |
| **Expediente** | **2.5** | RTC-10 se ve funcionando: identidad primero, banda de alergias, riel del Clinical Spine en píldoras, **un** primario, exportación fuera de la cabecera, tarjetas vacías plegadas a la línea honesta («Este expediente todavía no tiene signos ni diagnósticos registrados»). | Estado vacío ilustrado con botón «Crear primera nota». Dos filas de píldoras de filtro. La tarjeta ACTIVIDAD sola en su rejilla, sobrante de cuando eran tres. El primario flota en una fila vacía. Los dos FAB. |
| **Operaciones** | **4.0** | RTC-09 se ve: no hay grupo «Clínico», y el texto de entrada dice la verdad sobre qué es esto y qué no. | **Es un lanzador de aplicaciones.** Diecinueve azulejos idénticos —borde, radio y peso iguales— bajo antetítulos en versalitas. Nada dice qué se hace primero, qué es raro, qué está caliente. Cualquier plantilla de administración pinta esta pantalla. |
| **Pacientes** | **5.0** | Casi nada. RTC-11 arregló la identidad en móvil, pero **no cambió lo que la pantalla ES** en escritorio. | Título a la izquierda + racimo de tres botones a la derecha con el primario relleno. Buscador de ancho completo. Fila de píldoras con conteos. Filas con inicial en disco de color, nombre, teléfono, edad, «Editar» y chevron. Es RTC-15 tal como estaba escrito, ahora con número: la lista de contactos de un CRM que **no dice nada clínico de nadie** — ni quién tiene algo abierto, ni a quién se vio ayer, ni quién tiene una alerta. La única pista clínica es un chip «Con alerta» que hay que ir a buscar. |

**GENERIC_AI_LOOK_SCORE (peor superficie) = 5.0.** Objetivo ≤ 1.0.

## Veredicto de compuerta

`GENERIC_AI_LOOK ≤ 1` → **FAIL**. `V15-ORIGINALITY-REDTEAM-001` **no se cierra**.

Esto no invalida los diez P1: cuatro superficies de seis quedaron entre 1.0 y
2.5, y las que fallan lo hacen por razones que la iteración **no había tocado**
—ningún P1 pedía rehacer la lista de pacientes ni el lanzador de operaciones—.
La re-puntuación hizo lo que tenía que hacer: convertir una impresión en tres
rebanadas con nombre.

## El trabajo que sale de aquí

No se inventan defectos nuevos donde el registro ya tenía uno escrito. Dos de
los tres ya existían como P2 y lo que hace esta medición es **subirlos de
prioridad con un número delante**:

1. **RTC-15 · Pacientes deja de ser una libreta de contactos** — **P2 → P1**.
   Ya estaba escrito («anatomía CRUD; única affordance por fila = Editar») y la
   re-puntuación lo confirma como la **peor superficie del producto (5.0)**. Que
   cada fila diga el **estado clínico** —abierto de antes, resultado sin
   revisar, alerta, última vez visto— en vez del teléfono. Es la cirugía que ya
   funcionó en `/pendientes`, aplicada a la pantalla que más se abre.
2. **RTC-29 · Operaciones deja de ser un lanzador** (NUEVO, P1). Diecinueve
   azulejos idénticos no son jerarquía: son inventario, y §34 lo nombra así con
   todas sus letras. RTC-09 arregló **qué** vive en esa pantalla; nadie ha
   tocado todavía **qué es** esa pantalla.
3. **RTC-30 · El estado vacío de plantilla** (NUEVO, P2). «Icono centrado +
   título + frase + botón primario» en 3 de 6 superficies — es el estado vacío
   que genera cualquier andamio. En Hoy ya hay una versión mejor a medio camino
   («Mañana tienes 6» es información); el patrón se decide una vez y se paga en
   todas.

**Lo que NO es trabajo nuevo:** los dos FAB circulares de escritorio. Aparecen
en 6/6 superficies y pesan en la lectura, pero **RTC-05 ya se pagó** con alcance
declarado —se aquietan al grabar, en móvil ninguno flota— y que sigan flotando
en escritorio es una decisión tomada, no un resto. Se anota como observación,
no como defecto; si el score los vuelve a nombrar tras pagar RTC-15 y RTC-29,
entonces sí.

## Qué NO cubre esta medición

- **No es una auditoría de accesibilidad.** El contraste, el foco y los objetivos
  táctiles los mide su propia compuerta.
- **No puntúa móvil por separado.** Las capturas de 390px existen y se
  consultaron, pero el score es una lectura de la superficie, no del breakpoint.
  Un defecto que sólo aparezca en móvil no lo caza esta medición.
- **No cubre `/consulta` con nota escrita ni expedientes con historia larga.** La
  siembra sintética de esta corrida dejó a `pac-refugio-alcantara` con 0
  encuentros; las pantallas llenas pueden leerse distinto y no están puntuadas.
- **No es reproducible por un guardián.** Un score es un juicio humano
  documentado; lo que sí queda automatizado es que el instrumento no mienta
  (`v15-arnes-logo-off-oculta-algo.test.ts`).
