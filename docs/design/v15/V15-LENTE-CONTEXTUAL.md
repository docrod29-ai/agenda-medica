# La lente contextual — Capa 4 de §5

**Nace de una auditoría independiente, no de un plan interno.**
`V15-ORIGINALITY-INDEPENDENT-GATE-001` (sobre el árbol inmutable `b72378d`)
declaró la Capa 4 **genuinamente ausente** como P1 bloqueante, y añadió que ni
los bloques embebidos ni los cambios de ruta son equivalentes a ella.

Tenía razón, y este repositorio ya lo sabía sin haberlo dicho en voz alta:

- `V15-SHELL-GREYBOX-001` se cerró con tres capas de las cuatro que pide §5.
- `V15-MARCO-DE-PAGINA.md` llegó a **reservarle el sitio físico** —«qué vive en
  el ancho que queda a la derecha… es el sitio de la Capa 4, que no existe
  todavía como pieza»— y a dejarlo vacío a propósito.
- Y `/pendientes` **afirmaba en un comentario** que el tramo «→ Source» de la
  cadena §20 ya era «Source Reveal (§21): revelación en el flujo». No lo era. El
  comentario describía una pieza que nadie había escrito: familia «escrito y sin
  conectar», cometida sobre la propia documentación.

## Qué es

Un **plano de inspección transitorio**. Se abre sobre un hecho clínico concreto,
dice de dónde salió, y se cierra devolviendo al médico exactamente donde estaba.

```
hecho / dato
→ inspeccionar
→ fuente / evidencia / contexto
→ cerrar
→ mismo paciente · mismo encuentro · mismo sitio de la pantalla
```

## Qué NO es

No es una barra lateral permanente de copiloto. No es otro chat. No es un módulo
nuevo. No es una segunda fuente de datos. No es un riel decorativo a la derecha.

**La lente no lee nada que su llamador no tuviera ya**, salvo un caso declarado y
uno solo: la nota de la que cuelga un pendiente, leída con `getNota` — la misma
función, con el mismo alcance de consultorio, que ya usan expediente, consulta,
receta y orden.

## La regla que lo hace seguro: se falla cerrado

Si de un hecho no consta procedencia, **se dice que no consta**. Nunca se
inventa una asociación de origen.

Y —esto es lo que se olvida siempre— **«no consta» y «no se pudo leer» son
estados distintos y se pintan distinto**: ámbar el hueco del registro, rojo el
fallo de lectura. Es la regla 4 de seguridad clínica dicha en la dirección que
cuesta, la misma distinción que `sin-pendientes` frente a `sin-leer` en
`estado-clinico.ts`.

El sitio exacto donde una lente mal escrita fabricaría procedencia es
`citaDeOrigen`: basta con devolver el título del pendiente para que todo «tenga
fuente». Por eso cita **lo que la nota dice**, y si el estudio ya no aparece en
la orden de esa nota lo **declara** — esa discrepancia es información clínica
real (alguien editó la tarea, o cuelga de la nota equivocada) y taparla con el
título la volvería invisible para siempre.

## Los límites, y por qué se cortan en el shell

`tenant · paciente · encuentro · fuente` no se pierden ni se reatan:

- Todo hecho declara su `clinicId` y su `patientId`; la lente **nunca los
  deduce**.
- Una nota que dice pertenecer a otro paciente **no se enseña** (familia
  «paciente equivocado», REG-312).
- **El hecho se guarda con la ruta desde la que se abrió y se DERIVA al pintar.**
  La primera versión cerraba la lente con un efecto sobre `pathname`: funcionaba
  y dejaba un frame en el que el plano viejo se pinta sobre la pantalla nueva.
  Atado a la ruta, ese estado inválido no llega a existir — no es una
  comprobación que se ejecuta, es una que no se puede saltar.

El estado vive **una vez, en el shell**. Si cada pantalla guardara su propio
«panel abierto» habría seis paneles que se parecen y ninguno sería la Capa 4, y
cada uno decidiría por su cuenta qué hacer al cambiar de paciente.

## Dos presentaciones, una implementación

| | Escritorio | Teléfono |
|---|---|---|
| Forma | Columna **hermana** del lienzo (Capa 3 ‖ Capa 4) | Hoja desde abajo, con telón |
| Flota | **No** — RTC-32 sacó del shell todo lo que flotaba | Sí: ahí es un diálogo |
| `aria-modal` | `false` — el trabajo sigue legible | `true`, con foco atrapado |
| Medido | `position: static`, 420px, a la derecha del lienzo | 390px, anclada al fondo |

La FORMA la decide el CSS, que es quien sabe de anchos (lección de RTC-22). Lo
único que pregunta JavaScript es la SEMÁNTICA, porque `aria-modal` no es un
estilo y decirlo cuando no es verdad es peor que no decirlo.

**No es la columna encogida** (§22 lo prohíbe por su nombre): a 390px una
columna de 420 no cabe, y media pantalla partida en vertical no deja leer
ninguna de las dos mitades.

## Los tres llamadores, y por qué tres

La abstracción se justifica por llamadores reales con invariantes compartidas,
no por simetría:

1. **`/pendientes`** — un pendiente → la nota firmada de la que salió, con su
   línea literal. `TareaClinica.notaId` llevaba desde su primer día documentado
   como «la traza hacia atrás» y **no se pintaba en ningún sitio**: escrito,
   guardado, y sin ningún lector.
2. **`/pacientes`** — el estado clínico de la fila → los pendientes que lo
   producen. RTC-15 consiguió que la fila DIGA algo clínico; lo que no podía era
   sostenerlo. Enseña las **mismas** tareas que la fila resumió: un solo filtro
   (`tareasDelPaciente`), porque una explicación que no coincide con lo
   explicado es peor que no explicar.
3. **La banda de alergias del ancla** — la lectura → el texto del que se leyó.
   La banda no pinta el campo: pinta lo que la semántica sellada de REG-311
   **entendió** del campo, y esa lectura acaba en el cruce alergia↔fármaco y en
   una receta impresa con cédula. Ver las dos cosas juntas es la única forma de
   cazar una lectura equivocada antes de que se imprima.

## Evidencia

`scripts/design/medir-lente-contextual-v15.mjs` — navegador real, build de
producción + emuladores + siembra, escritorio 1440×900 y móvil 390×844:
**41/41 PASS, 0 errores de consola**. Capturas y acta en
`docs/design/capturas/v15-lente-contextual/`.

La cadena que la auditoría pidió fotografiar, medida en los dos anchos:

```
hecho → abrir → cita literal de la nota → cerrar
      → misma ruta · mismo scroll · mismo paciente · foco de vuelta al disparador
```

Dos correcciones que el propio arnés se hizo y que quedan escritas porque son la
familia RTC-02/RTC-20 (el instrumento que no mide lo que dice medir):

- Buscaba el disparador por el `div` que contuviera el título; con
  `filter({hasText})` eso casa con **cada ancestro**, así que medía un pendiente
  que no era el que decía. Ahora va por nombre accesible, que es único por tarea
  y es además lo que oye un lector de pantalla.
- Anotaba el «antes» y **después** traía el disparador a la vista, así que el
  propio arnés movía el lienzo y se acusaba a sí mismo (260 → 1217).

Y una medida que se **declara no aplicable** en vez de contarse como aprobada: a
1440×900 `/pendientes` cabe entero, su `scrollTop` es 0 y un «vuelve al mismo
sitio» medido ahí no prueba nada. La cadena de regreso con scroll de verdad se
mide en el expediente, que sí desplaza en los dos anchos.

## Lo que NO cubre

- **Sólo tres llamadores.** `/consulta` y la historia clínica quedan declaradas
  y sin lente; el encuentro grabando sigue sin fotografiarse (hueco declarado
  desde los dos paneles del equipo rojo).
- **No baja un score por existir.** Que la Capa 4 exista no cierra §26 ni §29:
  eso lo puntúa un revisor independiente sobre capturas nuevas, que es
  exactamente lo que la auditoría dejó dicho y lo que la 5ª pasada de §29
  reconoció al llegar al límite del método.
- **No inventa procedencia donde no la hay.** Un pendiente nacido en el
  laboratorio dice que nació ahí; no se le busca una nota.
