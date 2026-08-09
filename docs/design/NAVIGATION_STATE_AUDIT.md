# Auditoría de navegación y persistencia de estado

> **Unidad**: V9 · `PATIENT-UX-TRUTH-001` · 8-ago-2026
> **Método**: lectura estática de `src/app/(dashboard)/`, `src/components/`,
> `src/hooks/`, `src/context/`, `src/lib/`. **La aplicación no se ejecutó.**
> Todo lo que aquí se infiere del código y no se observó corriendo está marcado
> como tal en §6.
> **Insumo de**: `NAVIGATION-001` (iteración 2 de V9).

---

## §0 — El titular, y hay que decirlo entero

**Este código está mucho mejor defendido que la media.** Hay un almacén de
borrador en memoria montado en el layout, un respaldo a `localStorage` con
rebote y volcado forzado, recuperación de audio en IndexedDB, restauración de
scroll y supervivencia de tareas de IA entre navegaciones. Nada de eso es
habitual y casi todo está bien razonado en comentarios que explican por qué.

**Y aun así, lo que queda roto es lo más caro que hay.** Los tres hallazgos P0
no son molestias de navegación: son **pérdida permanente de una consulta ya
grabada**. La asimetría es la conclusión importante de esta auditoría — el
esfuerzo se puso en el texto de la nota, que ya estaba a salvo, y el audio, que
no tiene segunda copia en ningún sitio, quedó fuera.

## §1 — Los tres P0

### P0-1 · Volver a grabar borra el audio de antes

`useGrabacionAudio.ts:1508-1509` construye el blob a subir **sólo con los trozos
de esta sesión** (`todosChunksRef.current`). Pero al terminar bien borra **todo
el rango de la clave**: `:1562`, `:1578`, `:1627` → `borrarChunks(recoveryKey)`,
y `borrarChunks` usa `IDBKeyRange.bound([clave, 0], [clave, MAX_SAFE_INTEGER])`
(`:359-366`).

**Lo que pasa**: se graban 22 minutos → se toca «Agenda» en la barra inferior →
se vuelve → se pulsa grabar otra vez 90 segundos → se detiene. Los 90 segundos
se transcriben. **Los 22 minutos se borran de IndexedDB sin transcribir.**

Lo que hace este defecto especialmente traicionero es que el autor **ya estaba
pensando en el huérfano**: `recoveryBaseRef` (`:1276-1278`) desplaza los trozos
nuevos justo para no pisarlo, y su comentario (`:1002-1005`) lo dice. Lo que no
se actualizó fue el borrado. Media defensa.

**Plan de arreglo** (para `NAVIGATION-001`): que el borrado se limite al rango
de **esta** sesión (`[clave, recoveryBase]` → fin) en vez de al rango completo.
Es el cambio mínimo y sólo puede conservar más datos de los que conserva hoy.
Prueba al revés: dejar un huérfano, grabar y detener, y comprobar que el
huérfano **sigue** en IndexedDB.

### P0-2 · Navegar termina la grabación en curso, en silencio

`useGrabacionAudio.ts:1069` — `useEffect(() => () => { liberarRecursos() }, …)`.
`liberarRecursos` (`:1009-1056`) suelta `ondataavailable`, para el `MediaRecorder`
y las pistas, cierra el `AudioContext` — y **nunca llama a `detener()`**, así que
no se dispara ninguna transcripción.

El hook se instancia en el cuerpo de la página (`consulta:360`), y
`(dashboard)/template.tsx:19` **garantiza** que la página se desmonta en cada
navegación (su propio comentario lo dice, líneas 4-6).

**Lo que ve el médico**: toca «Agenda» durante una consulta y la grabación se
acaba. Sin confirmación, sin aviso, sin diferencia visible — la barra de
`MientrasHablas` simplemente no se pinta en la pantalla siguiente. Hay
recuperación (los trozos están en IndexedDB y sale un cartel de «Recuperar» en
`consulta:4100-4118`), pero es **opcional, silenciosa y fácil de no ver**.

### P0-3 · El cierre por inactividad no oye dictar, y se lleva el audio

`AutoLogout.tsx:88` escucha `mousemove, mousedown, keydown, touchstart, scroll`.
**Hablar no genera ninguno.** El propio comentario del archivo (`:14-18`) lo
reconoce. A los 30 minutos (`:30`) + 60 s de aviso (`:31`) → `salirSeguro()`.

En `salir-seguro.ts` la purga de la **nota** sí es condicional (`if
(r.todoGuardado)`, `:141`, con su razonamiento en `:169-173` — está bien
pensado). Pero `limpiarAudioLocal()` se llama en **las dos** ramas (`:145` y
`:159`), y hace `indexedDB.deleteDatabase('nexusmed-recovery')`
(`local-drafts.ts:78-80`).

Y se suman dos huecos:

1. El oyente de `EVENTO_GUARDAR_TODO` en la consulta (`:2900-2940`) sólo llama a
   `guardarBorrador(true)`. **Nunca llama a `audio.detener()`** — la grabación en
   vuelo no se vuelca a transcripción antes de que se destruya la pestaña.
2. El comentario que justifica la purga (`salir-seguro.ts:157-158`) —«el texto ya
   transcrito vive en el borrador que se está conservando»— es cierto **sólo
   para una grabación terminada**. A mitad de grabación, la cola sin transcribir
   no existe en ningún otro sitio. Y es justo el caso de mitad de grabación el
   que dispara el cierre por inactividad.

**Neto**: una consulta dictada de 45 minutos puede alcanzar el minuto 30 de
«inactividad», cerrar sesión, y llevarse su propia recuperación.

## §2 — P1

| # | Hallazgo | Evidencia | Qué se pierde |
|---|---|---|---|
| 4 | El *service worker* recarga la pestaña sin condiciones al cambiar de versión | `ServiceWorkerRegister.tsx:22-28` | Grabación cortada a media frase en cada despliegue |
| 5 | Comprar créditos de IA **desde dentro de la consulta** hace `window.location.href` | `consulta:1981` | Lo mismo que P0-2, en el peor momento |
| 6 | **Cero** `beforeunload` y cero guardas de cambio de ruta en todo el repositorio | única coincidencia: un comentario en `ofuscar-local.ts:7` | No hay última línea de defensa para 4, 5 y P0-2 |
| ~~7~~ **cerrado 9-ago (REG-289)** | Agenda → Consulta → atrás **nunca vuelve a la Agenda**. La consulta ya usa `useSmartBack`, y la agenda guarda fecha, filtro y búsqueda en la URL | `citas:436`; `consulta:265,3752` (destino fijo, con `push`); `expediente:53` | Renavegar tras **cada** paciente |
| 8 | Turnos diarizados, evidencia, verificación, NER y roles de hablante mueren al navegar | `consulta:769,779,797,1039`; `useGrabacionAudio.ts:1054`; ausentes de `consulta:2842` | Salida de IA ya pagada; «quién dijo qué» y «palabras a verificar» desaparecen |

Sobre el nº 7, el detalle importa: la agenda entra directo a la consulta
(`citas:436`), la consulta tiene su vuelta **fija** al expediente y con `push`
(`consulta:265,3752`), y el expediente usa `useSmartBack('/pacientes')`
(`expediente:53`). El historial queda `/citas → /consulta → /expediente` y el
médico oscila entre consulta y expediente. Existe `useSmartBack` y lo usan diez
pantallas; **la consulta no**.

## §3 — P2 y P3

| # | Sev | Hallazgo | Evidencia |
|---|---|---|---|
| ~~9~~ | **cerrado 9-ago (REG-289)** | `proximoSeguimiento` se pierde al navegar — y el volcado de desmontaje **borra** la copia ya persistida. Los tres caminos de escritura y las dos rutas de restauración lo llevan, y el golden compara los caminos entre sí para que el siguiente campo también falle | está en `:2671,2809`; **ausente** en `:2819`, `:2842`, `:2881-2884`, `:2838`, `:2876` |
| ~~10~~ | **cerrado 9-ago (REG-289)** | Fecha, vista, filtro y búsqueda de la agenda se reinician en cada vuelta | `citas:61,86,87`; `calendario:41,58` |
| 11 | P2 | El panel de laboratorio interpretado por IA y sin confirmar muere al navegar | `PanelLaboratorios.tsx:34,63-69,74-85` |
| 12 | P2 | Scroll restaurado en **una sola** pantalla de toda la aplicación | sólo `consulta:2853-2870` |
| 13 | P2 | `AppointmentModal` tiene ~20 campos sin guarda de suciedad | `AppointmentModal.tsx:58-119,436,455` |
| 14 | P2 | Filtro y nota abierta del expediente se reinician | `expediente:63,64` |
| 15 | P2 | El botón central de la barra inferior es un enlace **a sí mismo** en la consulta | `BottomNav.tsx:37-38`; la prueba lo afirma, `bottomnav-accion.test.ts:12-16` |
| 16 | P2 | La pestaña «Agenda» se ilumina en `/citas` pero navega a `/calendario` | `BottomNav.tsx:26` |
| 17 | P3 | La herramienta clínica seleccionada se reinicia al montar | `Herramientas.tsx:37` |
| 18 | P3 | No hay forma de volver a una consulta en curso desde otra pantalla | `BottomNav.tsx:36-40` |

El nº 9 tiene una vuelta de tuerca que merece nombrarse: `proximoSeguimiento` no
sólo no se restaura — es que `flushRespaldo` **reescribe la clave sin el campo**,
borrando lo que el rebote de 1500 ms ya había guardado. Y el comentario de
`:2662-2670` documenta que este mismo campo ya se perdió una vez (REG-193): el
arreglo de entonces cubrió **uno** de los tres caminos de escritura.

## §4 — Lo que ya está bien (y no hay que romper al arreglar lo demás)

- **`BorradorContext`** (`context/BorradorContext.tsx:24-38`), montado en el
  layout: el borrador de la nota sobrevive a la navegación **sin parpadeo**. Su
  razonamiento de «nunca borres por parecer vacío» (`consulta:2828-2840`) es
  correcto y carga peso.
- **`TareasContext`**: una tarea de «Procesar con IA» en vuelo sobrevive a la
  navegación y su resultado se reaplica al volver (`consulta:1990-2064`).
- **`useSmartBack`** (`hooks/useSmartBack.ts:15-18`): comprueba
  `history.state.idx` antes de retroceder. El patrón correcto ya existe.
- **El protocolo `nx:guardar-todo`** con acuse (`salir-seguro.ts:37,78-101`) y su
  entrega por promesa (`consulta:2925-2937`).
- **La restauración de scroll de la consulta** (`:2853-2870`), con doble
  `requestAnimationFrame` para restaurar después de pintar. Es el patrón a
  replicar en las otras pantallas.
- **`(dashboard)/consulta/[patientId]/error.tsx:57-62`** le dice al médico, con
  todas las letras, que su audio y su nota están guardados y cómo recuperarlos.

## §5 — Lo que esto significa para `NAVIGATION-001`

El requisito de la directiva —«Agenda → Paciente → Consulta → Resultados →
Consulta debe devolver exactamente el contexto anterior»— se descompone así:

1. **Primero los tres P0 del audio.** No son de navegación estrictamente, pero
   la navegación es lo que los dispara y son pérdida de datos irreversible.
2. **`Resultados` no es una navegación** y eso está bien: `PanelLaboratorios` se
   monta dentro de la consulta (`:4791`) y del expediente (`:282`). El ciclo de
   la directiva, tal como está escrito, **ya no cuesta nada** en esa pata. Lo
   que cuesta es la pata de la Agenda.
3. **El patrón de arreglo ya existe en el repositorio**: subir el estado al
   layout (como `BorradorContext`) o llevarlo a la URL. No hace falta inventar
   nada; hace falta aplicarlo a la agenda, al expediente y al scroll.
4. **`beforeunload` sólo se justifica para la grabación.** Para el texto, el
   volcado al desmontar hace innecesario el diálogo, y eso es una decisión
   defendible que **no** se va a revertir. Para el audio no hay volcado posible.

## §6 — Qué **NO** cubre esta auditoría

Es estática. Nada de lo siguiente se pudo determinar sin ejecutar la aplicación,
y **la directiva V9 §4 prohíbe aprobar interfaz leyendo código**:

1. **Si el botón central de la barra inferior remonta de verdad la consulta** al
   pulsarlo estando ya en ella. Depende de cómo Next 16 trate un `push` a la
   misma URL con un `template.tsx` de por medio. **Si remonta, el nº 15 sube a
   P0**, porque mataría una grabación por la vía del P0-2.
2. **Si la transcripción parcial en streaming está siempre activa.**
   `flushChunks` depende de `streamingActivoRef` (`useGrabacionAudio.ts:1077`).
   Si hay configuración donde va apagada, los P0-1 a P0-3 pierden su única
   mitigación de texto y la pérdida es total.
3. **Cuánto audio representan los ~2 s de cola descartados** (`:1013-1021`).
4. **Si `stripUndefined` en `updateNota` (`firestore.ts:301`) protege de verdad**
   `dialogoDiarizado` y `palabrasAVerificar` de que un autoguardado posterior a
   la navegación los deje en blanco. Leyendo el código debería aguantar. **Si no
   aguanta, el nº 8 es P0**: una nota firmada archivada sin su diálogo.
5. **El comportamiento real de `history.state.idx` tras una recarga completa**,
   del que dependen `useSmartBack` y `MobileBackButton`.
6. **Si la nota queda rancia tras una ausencia larga**: `getNota` sólo corre con
   `?nota=` (`consulta:1447`), así que al volver se ve el borrador en memoria y
   nunca una relectura del servidor.

Los seis van a `agent-state/BACKLOG.json` como comprobaciones de navegador de
`NAVIGATION-001`, no como hallazgos cerrados.
