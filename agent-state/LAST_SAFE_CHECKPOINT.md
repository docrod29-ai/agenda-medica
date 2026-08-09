# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026 — **`POSTVISIT-001` cerrada**

| | |
|---|---|
| **Unidad cerrada** | **`POSTVISIT-001`** — REG-306, 307, 308, 309 |
| **Rama** | `claude/relaxed-fermi-o6x2r4` (ver nota de rama abajo) |
| **Siguiente** | **`PATIENT-AI-001`** — ASK NEXUS, con las doce del §0 como fixture |

**El acto que faltaba, existe.** `PATIENT-COMPANION-001` dejó la superficie del
paciente montada y lo dijo por escrito: *hoy ningún paquete existe*. Ahora el
médico libera desde su consulta, el servidor compone de la nota **guardada**, y
el paquete llega al portal.

El camino completo, de punta a punta:

```
nota firmada
  → /api/expediente/paquete-visita (compone en el SERVIDOR, exige firma)
  → liberar: sella quién y cuándo, escribe {notaId}-v{n} con .create()
  → /api/portal filtra con visibleParaElPaciente
  → /mi/[token] · Cuidado lo pinta
```

### Lo que se cerró, y por qué importa

- **REG-306** La hoja del paciente se componía del **borrador en curso**. Su
  única guarda era «no es hospital»; la cabecera prometía material firmado y eso
  era intención, no precondición. Ahora hay **dos** compuertas: la pantalla exige
  `firmada` y el motor **lanza**. Cierra `POSTVISIT-GATE-001`.
- **REG-307** `cambiosDeMedicacion` **no deduce una suspensión de una ausencia**.
  Que el médico no re-listara hoy la metformina no significa que la haya
  quitado, y decírselo al paciente le hace dejar de tomarla. `suspendido` sólo
  sale de que el médico lo marcara. Sin lista previa: `null`, no `[]`.
- **REG-308** `proximoSeguimiento` se sella en la nota. Vivía sólo en el campo
  del paciente, que cada consulta pisa: el paquete le habría enseñado el
  seguimiento de hace tres meses como el de hoy.
- **REG-309** Tres `{ id, ...data() }` donde el spread pisaba el id del
  documento — uno de ellos el `notaId` del paquete, que es **el puntero a la
  única fuente de verdad**. Lo cazó `tsc` con la suite entera en verde.

Cierra además `POSTVISIT-ENTREGA-001`: `proximaCita` deja de estar fijo en
`undefined` (llevaba desde REG-242 sin poder renderizar su cuarto bloque).

### Decisiones de esta unidad, para no rediscutirlas

- **Compone el servidor, no la pantalla.** Si la pantalla compusiera y mandara
  el resultado, la lista blanca validaría la forma de algo que ya viene del
  cliente. Del cuerpo sólo se aceptan **identificadores** — hay guardián.
- **Liberar pide `firmar`**, previsualizar `clinico.leer`. El mapa vive en el
  **registro de rutas**, no en la ruta: es un gateway `porAccion`, como
  `hospital/mutar`.
- **Un liberado no se reescribe**: `.create()` sobre `{notaId}-v{n}`. Corregir
  es liberar una versión nueva, igual que una adenda no reescribe la nota.
- **Lo que no se puede sostener, no se afirma**: `warningSigns` y
  `educationalMaterial` van vacíos y declarados.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **573 archivos · 1 fallo preexistente y de entorno** (`ops-timeout`, verificado con el árbol sin mis cambios) |
| `lint-trinquete` | **96, igual que el techo.** Subió a 97 con un `setState` síncrono en un efecto; se arregló **el cambio** |
| trinquete de diseño | **sin deuda nueva.** Subió `tamanosFueraDeEscala` +12 y aparecieron dos tokens inexistentes (`--danger`, `--nx-radius-lg`); se arregló el cambio |
| `npm run build` (TypeScript) | **limpio** — y cazó REG-309 |
| `npm run build` (datos de página) | **falla por falta de credenciales de Firebase en este contenedor**. Sin `.env`, `NEXT_PUBLIC_FIREBASE_API_KEY` vacía, y la página que revienta (`/dr/[clinicId]`) no la toca esta unidad. Es `NAV-NAVEGADOR-001`, no una regresión |
| navegador | **no ejecutado** |

### Nota de rama — hay que decirlo

La especificación fija `claude/nexus-patient-ux-v9` como rama persistente. Esa
rama **se fusionó a `main`** en el PR #279, así que su historia ya está en
`main`. Esta ejecución trabajó sobre la rama que le asignó el arnés,
`claude/relaxed-fermi-o6x2r4`, partiendo de ese merge. No se perdió nada y no se
forzó nada; si el dueño prefiere volver al nombre de la especificación, es un
`git branch` y un PR nuevo.

## Lo que este checkpoint NO garantiza

- **Que funcione en un navegador.** Ni la pantalla del médico ni la del
  paciente se han visto con los ojos. Los guardianes comprueban que las
  decisiones quedaron escritas donde tienen que estar, y **los tres se probaron
  al revés** (defecto inyectado → rojo). Pero Firestore no existe en la suite:
  la ruta se vigila leyéndola, no ejecutándola.
- **Que el paciente entienda lo que lee.** No hay medidor de legibilidad.
- **Que dos pestañas liberando a la vez se comporten bien en producción.**
  `.create()` lo hace fallar en vez de pisar, que es lo correcto, pero no se ha
  provocado la carrera de verdad.

## Qué hacer al reanudar

1. `node scripts/agent-state/actualizar.mjs` y comprobar el `git log`.
2. **No rehacer** `POSTVISIT-001`: cerrada, con sus cuatro REG.
3. **`PATIENT-AI-001`** — ASK NEXUS. Es la unidad más peligrosa del programa:
   la primera vez que un modelo le habla al paciente. Las **doce preguntas** del
   §0 de la especificación son fixture permanente en `evals/patient-ai/`, y la
   jerarquía de fuentes del §1 de `patient-facing-ai.md` es la defensa, no una
   preferencia. `unansweredQuestions` del paquete ya existe y la espera.
4. Cuando haya entorno con credenciales: las seis comprobaciones de navegador de
   `NAV-NAVEGADOR-001` y la verificación en vivo del ciclo liberar → ver.

---

## Checkpoint anterior · 9-ago-2026 — **`PATIENT-COMPANION-001` cerrada**

| | |
|---|---|
| **Unidad cerrada** | **`PATIENT-COMPANION-001`** — REG-304, REG-305 |
| **Siguiente** | **`POSTVISIT-001`** |

Los cinco destinos existen en `/mi/[token]`, el `PaqueteDeVisita` tiene sus dos
estados y **la compuerta la aplica el servidor**: un borrador no sale de
`/api/portal`. La colección está declarada en los tres sitios de la regla de
aislamiento **y en la exportación ARCO**.

**`POSTVISIT-001` empieza con deberes ya escritos**: `componerPaquete` y
`cambiosDeMedicacion` se difirieron allí porque no tenían llamador, y su llamador
es la pantalla donde el médico revisa y libera. Están descritas en REG-304 con
sus reglas —sin lista previa de medicación, `null` y no «sin cambios»— para que
no haya que redescubrirlas.

---

## Checkpoint anterior · 9-ago-2026 — **`NAVIGATION-001` cerrada**

| | |
|---|---|
| **Unidad cerrada** | **`NAVIGATION-001`** — REG-300 a REG-303 |
| **Siguiente** | **`PATIENT-COMPANION-001`** |

El ciclo que pide la especificación —Agenda → Paciente → Consulta → Resultados →
Consulta— ya devuelve el contexto. Con un descubrimiento que ahorró trabajo: **la
pata de «Resultados» no era una navegación** (`PanelLaboratorios` se monta dentro
de la consulta y del expediente), así que sólo costaba la pata de la Agenda.

- **REG-300** `proximoSeguimiento` se perdía al navegar, y el volcado **borraba**
  la copia que el rebote ya había guardado. Causa raíz: la regla de «hay
  contenido» estaba escrita **tres veces**. Ahora una.
- **REG-301** El atrás de la consulta era un destino fijo con `push`: quien venía
  de la agenda nunca volvía a ella. `useSmartBack` existía y lo usaban diez
  pantallas; la consulta no.
- **REG-302** Día, filtro y búsqueda de la agenda viven en la URL, validados.
- **REG-303** Navegar dentro de la app ya avisa antes de cortar el dictado.

Cierra además `PATIENT-AUDIO-004`, el residuo declarado del turno anterior.

**Lo que sigue abierto de navegación**: evidencia, verificación, entidades y
roles de hablante siguen muriendo al navegar; el scroll sólo se restaura en la
consulta. Y **nada de esto se ha visto en un navegador**.

---

## Checkpoint anterior · 9-ago-2026 — **`DESIGN-SYSTEM-001` cerrada**

| | |
|---|---|
| **Unidad cerrada** | **`DESIGN-SYSTEM-001`** — REG-298, REG-299 |
| **Siguiente** | **`NAVIGATION-001`** |

`@theme inline` pasó de exponer 4 tokens a ~35 (con prefijo `nx-`, para poder
migrar poco a poco); nacen las escalas de radio, espacio, elevación, movimiento
y tipografía; y se retiraron **286 respaldos de color** — 253 obsoletos y 5
sobre tokens que no existían. Techo de respaldos: **0**, invariante.

Y se corrigió un guardián que **no podía fallar**: `inventario-de-pantallas.mjs`
reescribía el markdown al importarlo, así que la prueba se comparaba contra un
archivo que ella misma acababa de poner al día. Llevaba dos commits así.

Detalle: `agent-state/DESIGN_STATE.md` y `docs/design/NEXUS_DESIGN_SYSTEM.md`.

---

## Checkpoint anterior · 9-ago-2026 — **los tres P0 de audio, cerrados**

| | |
|---|---|
| **Rama** | `claude/nexus-patient-ux-v9` |
| **SHA anterior** | `6a6501d` (cierre de `PATIENT-UX-TRUTH-001`) |
| **Unidad cerrada** | **`PATIENT-AUDIO-001/002/003`** — REG-294, 271, 272, 273 |
| **Siguiente** | `DESIGN-SYSTEM-001`, empezando por `@theme inline` |

### Qué quedó hecho

**REG-294 · Volver a grabar ya no borra el audio anterior.**
`borrarChunks(clave, desde)`; los tres caminos de éxito borran sólo desde
`recoveryBase`. El huérfano sobrevive para el cartel de «Recuperar».

**REG-295 · El trozo final ya no se tira al salir grabando.** El índice de disco
sale de un contador monótono (`persistIdxRef`) en vez de la longitud de un array,
así que la colisión que obligaba a desenganchar el handler ya no puede ocurrir.

**REG-296 · Dictar cuenta como actividad.** El hook late cada minuto mientras
graba y `AutoLogout` reinicia el contador. **No desactiva** el cierre por
inactividad: al parar la grabación, corre como siempre. Y se registra el primer
`beforeunload` del repositorio mientras se graba — cubre también la recarga que
hace el service worker al desplegar.

**REG-297 · Cerrar sesión ya no se lleva el audio sin transcribir.** El acuse de
`nx:guardar-todo` gana `marcarAudioSinTranscribir()`; la purga pasa a ser
condicional, igual que ya lo era la del borrador de la nota.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 104 casos · 1 fallo preexistente y de entorno** (`ops-timeout`) |
| `lint-trinquete` | **96, igual que el techo.** Subió a 97 con un ref tocado durante el render; se arregló el cambio, **no el techo** |
| `npx tsc --noEmit` | **limpio** |
| navegador | **no ejecutado** |

---

## Lo que NO cerró, y hay que decirlo

**`PATIENT-AUDIO-004` (P1, abierto).** Navegar **dentro** de la aplicación sigue
terminando la grabación sin avisar. `beforeunload` no se dispara en un
`router.push`, y App Router no expone eventos de ruta.

Lo que cambió: **ya no se pierde audio** —los trozos están en IndexedDB, el
final incluido, y el cartel los ofrece al volver—. Lo que queda es que el médico
no se entera en el momento.

Dos caminos, y conviene decidirlo con la aplicación abierta: interceptar los
clics de `BottomNav`/`Sidebar` mientras se graba, o un cartel persistente de
«grabación en curso» que siga al médico entre pantallas. El segundo resuelve
además que hoy no haya forma de volver a una consulta en curso.

## Qué hacer al reanudar

1. `node scripts/agent-state/actualizar.mjs` y comprobar el `git log`.
2. **No rehacer** ni la auditoría ni los tres P0: cerrados, con sus REG.
3. **`DESIGN-SYSTEM-001`**, empezando por ensanchar `@theme inline`
   (`globals.css:126-131`) — **no por colores**, que lo prohíbe §13 de la
   directiva y además no es el problema.
4. Cuando haya entorno con credenciales de Firebase: las seis comprobaciones de
   navegador de `NAV-NAVEGADOR-001`, **dos de las cuales pueden convertir un P2
   en P0**, y la verificación en vivo de estos cuatro arreglos.

## Lo que este checkpoint NO garantiza

Que los arreglos funcionen **en un navegador**. Se sellaron con guardianes que
comprueban que las decisiones quedaron escritas donde tienen que estar —el rango
del borrado, el origen del índice, el latido, la condición de la purga— y los
cuatro fallan al revés. Pero `MediaRecorder` e IndexedDB no existen en Node:
**ejecutar el ciclo de verdad sigue pendiente**.
