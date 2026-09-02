# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 2-sep-2026 — **`PATIENT-AI-001` cerrada · REG-446**

| | |
|---|---|
| **Unidad cerrada** | **`PATIENT-AI-001`** — REG-446 |
| **SHA** | (esta rama) |
| **Cierra además** | `PATIENT-TELE-002`, el último P0 abierto — **sin reparar nada**: el renglón estaba desfasado, no el producto |
| **Siguiente** | **`DOCUMENTS-001`** |

«ASK NEXUS» existe. El destino «Preguntar» del portal era un párrafo que le
decía al paciente que llamara por teléfono, y de las cinco clases de respuesta
del §2 de `patient-facing-ai.md` el código implementaba **una**.

Ahora clasifica, y **sin modelo de lenguaje**. Lo que devuelve como respuesta es
una cadena que ya venía dentro del paquete que su médico liberó; si no la
encuentra, escala. El nivel 9 del §1 no origina datos del paciente, y la forma
más barata de garantizarlo es no tenerlo.

**El orden es la defensa**, y es lo único que hay que recordar de esta unidad:

```
1. urgencia (§6)   2. acto prohibido (§3)   3. administrativa
4. cita del plan liberado                   5. escalar
```

El 2 va antes que el 4. «¿Puedo tomarme el doble del metoprolol?» encuentra el
metoprolol en el plan del propio paciente: buscar primero le habría contestado
cómo tomarlo, respondiendo una pregunta que nadie hizo. Peor con «estoy
embarazada, ¿sigo con el metoprolol?», sobre un plan que quizá se escribió sin
saberlo. Los dos son fixture permanente (`ai-05`, `ai-06`) y con el orden
invertido se ponen rojos — comprobado inyectando el defecto en el módulo real:
11 casos caen.

**Y la escalación llega**: se guarda en `preguntas_paciente` ANTES de contestarle
al paciente, y sale un aviso al WhatsApp del consultorio. Decirle «ya quedó
registrada» y que no quede es peor que no ofrecer el canal.

**Lo que esta unidad NO afirma**, y queda declarado:

- **La pantalla no se ha visto en un navegador.** La regla de diseño dice que no
  se aprueba una interfaz leyendo el código; este contenedor no puede levantarla
  porque faltan las `NEXT_PUBLIC_FIREBASE_*`. Es el mismo bloqueo que tiene
  parado a `NAV-NAVEGADOR-001`, y ahora frena a dos unidades: está en
  `BLOCKERS.md` como **B-12**.
- **`EDUCATIONAL_EXPLANATION` sigue sin implementación.** Cuatro de cinco.
- **No hay pantalla del médico** para lo que se escaló: la pregunta se guarda y
  el aviso sale por WhatsApp, pero el buzón donde el consultorio las cierra es
  trabajo con nombre.
- **Las reglas de Firestore de la colección nueva no rigen todavía**: se
  despliegan con el botón, y eso es del dueño. Declarado en
  `docs/ops/REGLAS-DE-FIRESTORE.md` con qué se rompe mientras tanto (nada hoy).

---

## Checkpoint · 28-ago-2026 — **`GP-FINAL` recorrido · REG-336 cerrada**

| | |
|---|---|
| **Unidad cerrada** | **`GP-FINAL`** — REG-336 |
| **SHA** | `ac6a4bc4` sobre `release/consultorio-final-candidate-2026-08-27` |
| **Incorpora** | PR #382 (`bac9b02c`, POSTVISIT-001) en avance rápido, sin perder nada previo |
| **Siguiente** | **`PATIENT-AI-001`** |

El checkpoint anterior decía, con todas las letras: «**nada se ha visto en un
navegador**». Ya se ha visto. El consultorio se recorrió de punta a punta en
Chromium, como médico y como paciente, contra un build de producción y los
emuladores: **78 casos, 0 P0, 0 P1**, actas en `docs/audit/gp-final/`.

Reproducible con una orden:

```bash
bash scripts/golden-path/arnes-gp-final.sh
```

**Lo que encontró — REG-336.** Con los 10 480 casos de la suite en verde, el
paso 22 no se podía dar: la nota se firmaba, la receta salía, y «Liberar al
paciente» estaba apagado culpando a una cédula que sí estaba. Faltaba el
**nombre**. `validarNOM004` (deja firmar) no lo pide; `componerPaquete` (deja
entregar) sí. En el hueco cabía una nota firmable e **inentregable**, y con
`nota.firma` inmutable, irreparable. Arreglado en la compuerta única de REG-189,
con golden probado al revés, sello y clasificación.

**Lo que este recorrido NO afirma**, y queda declarado:

- **Sin proveedor de ASR no se dicta.** La transcripción tardía tras edición
  manual (escenario F) y H-19 en navegador (paso 15) siguen sin recorrerse. Sus
  goldens sellados los cubren; la vuelta por el navegador, no.
- Corre contra el **emulador**, no contra Firestore real.
- No se mandó ningún WhatsApp ni se emitió ninguna receta real.
- El arnés **no corre en CI**: necesita emuladores, build y Chromium. Es la
  compuerta del *release*, no la de cada cambio.

**Una advertencia para quien lo repita.** El arnés se equivocó ocho veces antes
de acertar una, y estuvo a punto de reportar ocho defectos inexistentes. Está
contado en `docs/audit/gp-final/README.md`. Antes de creerle a una prueba que
dice que el producto está roto, hay que descartar que la rota sea la prueba.

---

## Checkpoint · 27-ago-2026 — **`POSTVISIT-001` cerrada**

| | |
|---|---|
| **Unidad cerrada** | **`POSTVISIT-001`** — REG-335 |
| **Cierra además** | `POSTVISIT-GATE-001` · `POSTVISIT-ENTREGA-001` |
| **Siguiente** | **`PATIENT-AI-001`** |

El post-visita del consultorio está cerrado de punta a punta: consulta → nota
firmada → receta y órdenes → paquete → **liberación explícita** → portal del
paciente → entrega. Y el invariante que lo gobierna tiene por fin dónde vivir:

```
FIRMAR UNA NOTA ≠ LIBERARLE INFORMACIÓN AL PACIENTE
```

- **`componerPaquete` volvió a `paquete-de-visita.ts`**, con su llamador. Se
  niega a componer de un borrador y de una nota sin firma con cédula, y dice
  cuál de las dos.
- **`/api/expediente/paquete-de-visita`** es la única puerta que escribe: bajo
  `firmar`, contra la membresía real del consultorio, idempotente por el id
  derivado del `notaId`, con `versionEsperada` para que la pestaña vieja no pise
  la nueva, y con `retirar` como única marcha atrás — que sube versión, no borra.
- **`/api/portal/link` ya emite alcance `clinico`** a petición explícita
  cobrando `firmar`. Sin eso no había llave y la entrega no podía existir.
- **`/mi/[token]`** pinta lo liberado, con prescriptor y cédula del sello de
  firma, y distingue el fallo de red de la ausencia.

**Lo que sigue vacío y declarado**: `warningSigns` y `educationalMaterial`. Son
indicación médica y evidencia curada; la pantalla del médico **enseña el hueco**
en vez de rellenarlo. `documents` y `unansweredQuestions` esperan a
`DOCUMENTS-001` y `PATIENT-AI-001`.

**Lo que este checkpoint NO afirma**: nada se ha visto en un navegador. La regla
de diseño exige recorrer el flujo de verdad, y eso queda pendiente.

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
