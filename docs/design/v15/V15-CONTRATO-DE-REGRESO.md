# El contrato de regreso — §21, el tramo que faltaba

**Nace de una auditoría independiente.** `V15-ORIGINALITY-INDEPENDENT-REAUDIT-002`
(sobre el árbol inmutable `01a1086`) dejó dos P1 bloqueantes. Éste es el
segundo, y lo nombró con precisión:

> The outbound transition to the consultation is effectively normal navigation.

Tenía razón. La cadena de §21 es **fact → inspect → source → return exactly
where you were**. Los tres primeros tramos existían desde la rebanada anterior:
la lente contextual abre sobre el pendiente, contesta las cuatro preguntas de
§10 y ofrece la traza hacia la consulta que lo originó. El cuarto era un
`<Link href>` y nada más. Al aterrizar en la consulta el médico se quedaba sin
hilo de vuelta: sin ruta de origen, sin su sitio en la lista, sin foco y sin
memoria de qué hecho estaba inspeccionando.

## Por qué un módulo nuevo, y por qué éste es el más pequeño

Se miró primero lo que ya existe, porque un dueño nuevo para un estado que ya
tiene dueño es deuda:

| Candidato | Qué posee | Por qué no puede poseer esto |
|---|---|---|
| `@/lib/ui/continuidad` | Una navegación coreografiada (view transitions, candado de REG-312) | Su estado vive milisegundos y muere con la transición. No sobrevive al cambio de ruta. |
| `@/lib/nav/encuentro-abierto` | «¿Qué consulta tengo a medias en este dispositivo?» | `localStorage`, dura días, es por usuario. Otra pregunta y otra vida. |
| `@/lib/expediente/cierre-hechos` | Estado de interfaz efímero en `sessionStorage` | No es dueño de navegación — pero **es el precedente** que este módulo sigue. |

Ninguno puede ser dueño sin cambiar de significado. Lo que se añade es lo
mínimo: un contrato con vida propia y el veredicto que decide si se honra.

## Las respuestas que el contrato tiene que dar

| Pregunta | Respuesta |
|---|---|
| ¿Quién lo crea? | La lente, en el gesto de salir a la fuente. |
| ¿Quién lo posee? | `sessionStorage` de **la pestaña**. |
| ¿Cuándo caduca? | 30 min (`VIGENCIA_MS`), comprobado en el límite exacto. |
| ¿Qué identifica al paciente? | `limite.patientId` |
| ¿Y al encuentro? | `limite.notaId` |
| ¿Y al consultorio? | `limite.clinicId` |
| ¿Y a la superficie de origen? | `origen.ruta` + `origen.nombre` |
| ¿Y al hecho inspeccionado? | `hecho.{clase,id}` |
| ¿Y al invocador? | `origen.disparadorId`, derivado del pendiente (`idDelDisparador`) |
| ¿Cómo se repone el sitio? | `main.scrollTop`, esperando por fotogramas a que el contenido dé de sí, con tope |
| ¿Y el foco? | `getElementById(disparadorId).focus()` |
| ¿Si la fuente no existe? | No hay traza: la lente ya dice «no consta de qué consulta salió» |
| ¿Si cambia el paciente? | **Se declina** y se dice |
| ¿Si cambia el encuentro? | **Se declina** y se dice |
| ¿Si está rancio? | **Se declina** y se dice |
| ¿Otra pestaña? | `sessionStorage` es por pestaña → sin contrato → no se ofrece volver |
| ¿URL copiada? | Igual: el testigo llega solo, sin cuerpo |
| ¿Historial a mano? | El control se deriva de URL + almacén en cada render |
| ¿Tras recargar? | Sobrevive: es lo único que sí hay que conservar |
| ¿Móvil / escritorio? | El mismo contrato; el sitio se captura **al abrir** (ver abajo) |

## La invariante de seguridad

> **Un contrato rancio o de otro paciente NUNCA devuelve al médico a un contexto
> que no es el suyo.**

No se «repara» un contrato que no cuadra: se declina y se dice por qué.
`veredictoDeRegreso` compara el contrato contra **el destino real en el que el
navegador está de verdad** —consultorio de la sesión, paciente de la ruta, nota
del parámetro—, nunca contra lo que el contrato afirma: un contrato que se
valida con sus propios datos siempre dice que sí.

Y las tres fronteras se comprueban **por separado**. Comparar sólo el paciente
dejaría pasar un testigo de otra nota del mismo enfermo, y el médico volvería a
la lista creyendo que venía de un encuentro en el que nunca estuvo.

## En la URL viaja un testigo, no el paciente

`?volver=<uuid>` y nada más. El cuerpo —paciente, nota, ruta, desplazamiento—
vive en la pestaña. No es preferencia de implementación: **PHI nunca en la URL**
(regla de datos y privacidad), y un enlace de consulta acaba pegado en un chat.
El efecto secundario es la mejor parte: abrir el enlace en otra pestaña deja el
testigo sin contrato y **falla cerrado sin que nadie lo haya programado**.

## Lo que encontró el navegador y ninguna prueba podía ver

En el teléfono la lente es una hoja **en flujo**, hermana de `<main>`: al
abrirse, `<main>` cede alto y su `scrollTop` se desplaza. La primera versión
anotaba el sitio al **pulsar la traza** —con la lente ya abierta—, así que
guardaba una coordenada del layout encogido para reponerla sobre el normal.

Medido: **41 px de desfase en móvil y 0 en escritorio**, porque ahí la lente no
toca el alto. Cuarenta y un píxeles no arruinan una consulta, pero §21 promete
«exactly where you were», y una promesa que se cumple en escritorio y no en el
teléfono es el medio-cumplimiento que §22 existe para no aceptar.

El sitio se anota ahora en el gesto de **abrir**, cuando la pantalla todavía es
la que el médico estaba mirando.

## Evidencia

`scripts/design/medir-regreso-a-la-fuente-v15.mjs` — navegador real, build de
producción + emuladores + siembra, escritorio 1440×900 y móvil 390×844:
**24/24 PASS, 0 errores de consola**. Acta y capturas en
`docs/design/capturas/v15-regreso-a-la-fuente/`.

La cadena, medida en los dos anchos:

```
pendiente → inspeccionar → consulta de origen (mismo paciente)
          → volver → misma ruta · mismo scrollTop · mismo foco
```

Y el fallo seguro, también medido: el **mismo testigo** colgado de la consulta
de otro paciente no ofrece volver (0 controles) y lo dice en voz alta.

Una corrección del propio arnés queda escrita porque es la familia RTC-20 —el
instrumento que no mide lo que dice medir—: localizaba el disparador con
`filter({hasText}).last()`, que casa con **cada ancestro** y acababa devolviendo
el botón de otra tarjeta. Ahora va por el `id` estable, que es además lo que el
restaurador usa para devolver el foco.

## Lo que NO cubre

- **Un solo consumidor.** La traza sale hoy de `TareaClinica.notaId`.
  Expedientes, resultados y documentos quedan **declarados y sin hilo de
  vuelta** — y no se fabrican consumidores en Pacientes ni en Operaciones sólo
  para que la cuenta diga 6/6: la propia auditoría lo permite explícitamente.
- **No puntúa §29.** Este contrato no baja un número de genericidad; lo puntúa
  el revisor independiente.
- **No cubre render en la suite de nodo**: el foco, el desplazamiento y la
  aparición del control se miden en navegador, no con pruebas de fuente.
