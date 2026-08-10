# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 10-ago-2026 — **`POSTVISIT-001` cerrada**

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-7eaw5a` (la persistente de la especificación, `claude/nexus-patient-ux-v9`, se fusionó a `main` en el PR #279; el trabajo nuevo no se apila sobre historia ya fusionada) |
| **SHA de cierre** | `77ab367` |
| **Unidad cerrada** | **`POSTVISIT-001`** — REG-306, REG-307 |
| **Siguiente** | **`PATIENT-AI-001`** |

El bucle se cierra por primera vez de punta a punta: el médico firma, libera, y
**el paciente lo ve**. Cierra los dos P1 que la auditoría dejó declarados con
número de línea (`POSTVISIT-GATE-001`, `POSTVISIT-ENTREGA-001`) y trae de vuelta
`componerPaquete` y `cambiosDeMedicacion` **con su llamador delante**, que era la
condición con la que se difirieron.

### Lo que más vale de este turno, y no estaba en el plan

**REG-306.** El fármaco que el médico acaba de suspender salía impreso bajo «SUS
MEDICAMENTOS». No es un hueco de V9: llevaba meses en producción, con 8 000
pruebas en verde, porque ninguna dependía del comportamiento roto. Apareció
siguiendo el dato —al decidir qué hacer con `estado` hubo que buscar quién lo
escribe— y no leyendo la pantalla.

### Las tres decisiones que no se tocan

1. **El contenido no viaja en el cuerpo.** La ruta recibe tres identificadores;
   lo demás lo lee el servidor de la nota firmada. Si viajara, la compuerta de
   firma sería una comprobación del navegador.
2. **`firmar`, no `clinico.escribir`.** Enfermería escribe en el expediente y no
   puede aprobar lo que el paciente lee como palabra de su médico.
3. **El silencio no suspende.** Un fármaco que estaba antes y hoy no se menciona
   no se declara suspendido. Sin lista previa, `null` — «no se pudo comparar» no
   es «sin cambios».

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 596 casos · 1 fallo preexistente y de entorno** (`ops-timeout`; comprobado: falla igual con el árbol limpio) |
| `lint-trinquete` | **96, igual que el techo.** Subió a 97 con un `useCallback` cuya lista de dependencias el compilador de React no podía preservar; se arregló el cambio |
| `trinquete-de-diseno` | **sin deuda nueva** (subió +6 tamaños y +1 radio; se rehizo con `t-body`/`t-caption`/`t-overline` y los primitivos `btn`) |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila y pasa TypeScript**; no termina de recolectar páginas en este contenedor por falta de credenciales de Firebase — ya declarado en `NAV-NAVEGADOR-001` |
| navegador | **no ejecutado** |

### Lo que este checkpoint NO garantiza

Que el flujo funcione **en un navegador**. Los tres tramos —el médico libera, el
servidor compone, el paciente lo recibe— se sellan leyendo el código, no pulsando
el botón. Y **la ruta HTTP no se probó con Firestore**: montar `adminDb` exige el
emulador, que es otra suite.

### Qué hacer al reanudar

1. **No rehacer** `POSTVISIT-001`: cerrada, con SHA y sus dos REG.
2. **`PATIENT-AI-001`** — ASK NEXUS con las cinco clases de respuesta, la
   jerarquía de fuentes del §1 de `patient-facing-ai.md` y **las doce preguntas
   del equipo rojo como fixture permanente** en `evals/patient-ai/`. Hoy
   «Preguntar» escala al consultorio a propósito, y eso sigue siendo lo correcto
   hasta que exista la compuerta.
3. Lo que `POSTVISIT-001` deja apuntado para quien siga:
   - **`warningSigns` no tiene de dónde salir.** El campo existe y va vacío. Los
     signos de alarma son indicación médica: o los escribe el médico —y hoy no
     tiene dónde— o no los pone nadie. Es una casilla de producto, no un defecto.
   - **El paquete no se puede revocar.** Se liberan versiones nuevas y la
     anterior sigue visible. `DOCUMENTS-001` trae `REVOKED` en sus cuatro
     estados; el paquete debería heredarlo.
   - **El paciente no se entera de que hay algo nuevo.** No hay aviso por
     WhatsApp ni marca en el portal. Va con `CLOSED-LOOP-PATIENT-001`.

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
