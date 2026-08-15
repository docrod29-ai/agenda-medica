# V15-FINAL-COHERENCE-001 — la coherencia de producto entero

**Rama:** `v15/structural-uiux` (desarrollado en
`claude/ausculta-v15-final-coherence-vhiuj8`, mismo árbol) ·
**SHA de partida:** `89865c2f` — el árbol que la lectura independiente cerró
con PASS en `V15-WORKFLOW-BENCHMARK-INDEPENDENT-CLOSURE-001`
(`P0 = 0`, `BLOQUEANTES P1 = 0`).

## La pregunta

> ¿Ausculta V15 se comporta como **un** producto clínico coherente, o como una
> colección de superficies localmente correctas?

No es la pregunta del banco de flujos —¿se puede hacer el trabajo?—, que ya se
contestó con 20/20. Es la de al lado: **el mismo objeto conceptual, ¿se
comporta igual en todas partes?** Una pantalla puede pasar su compuerta a
solas y aun así obligar al médico a reaprender el idioma al entrar.

Instrumento: `scripts/design/medir-coherencia-de-producto-v15.mjs`.
Arnés: `scripts/design/arnes-coherencia-v15.sh`.
Acta cruda: `docs/design/capturas/v15-coherencia/acta-coherencia.json`
(+ el ANTES conservado en `antes/`, y 22 capturas por corrida).

El instrumento mide **lo mismo en todas las superficies** y el defecto es la
**varianza**, no el valor: por eso no lleva umbrales por pantalla, lleva una
tabla y compara filas. Todo lo tipográfico se lee **calculado**
(`getComputedStyle`) — que una clase se llame `.nx-ident` no demuestra que se
pinte grande, y esta matriz existe justo para cazar la superficie donde la
clase está y la voz no.

---

## Lo primero, porque cambia cómo se lee todo lo demás

**Tres corridas del arnés murieron antes de medir nada, y las tres por el
INSTRUMENTO.** Se dicen porque un banco que no publica sus propios errores no
es un banco:

| lo que se vio | la verdad |
|---|---|
| `Executable doesn't exist … chromium_headless_shell-1228` | el `@playwright/test` instalado es más nuevo que los navegadores del contenedor. El repositorio **ya tenía** la convención (`axe-encuentro-v15.mjs` cae a `/opt/pw-browsers/chromium` si existe); el medidor nuevo nacía sin ella. Se le puso la misma. |
| «login: timeout esperando `/dashboard`» | el `.env.local` del arnés apuntaba a `demo-nexusmed-v10` y las siembras escriben en `demo-nexusmed-test`. El emulador de Auth segrega por proyecto: el usuario existía, en otro proyecto. |
| «login: timeout» otra vez, ya con el proyecto correcto | la variable que abre los emuladores en el cliente es `NEXT_PUBLIC_FIREBASE_EMULATORS` (**plural**); el arnés ponía la singular, que sólo aparece en un comentario. Sin ella el navegador hablaba con Firebase de verdad. |

Ninguno de los tres es del producto. Atribuirle a la aplicación un login roto
que era del arnés habría sido el defecto más caro de esta corrida.

**Y una cuarta, del entorno y no del arnés:** el contenedor llegó **sin
`node_modules`**. El primer `npm run build` falló copiando el worker de
`pdfjs-dist` — que no estaba instalado, junto con todo lo demás. `npm ci`
antes de nada.

---

## La matriz, medida (ANTES)

Escritorio 1440×900. El móvil 390×844 es idéntico salvo ~1px de escala.

| superficie | qué nombra el `<h1>` | h1 px/peso | voz más fuerte del paciente | primarias en `<main>` |
|---|---|---|---|---|
| hoy | — (saludo) | 15/500 | — | 1 · «Iniciar consulta» |
| pacientes | — (destino) | 20/600 | — | 1 |
| pendientes | — (destino) | 20/600 | — | 7 (una por fila) |
| **expediente** | **al paciente** | 20/600 | **20/600 (ancla)** | 0 * |
| **consulta** | **al paciente** | 20/700 | **20/700 (h1)** | 0 * |
| **nota** | **no hay `<h1>`** | — | **14/600 (franja)** | 1 |
| **receta** | «Generador de Receta» | 20/700 | **14/600 (franja)** | 1 |
| **orden** | «Orden Médica» | 20/700 | **14/600 (franja)** | 1 |
| referencia | «CARTA DE REFERENCIA» | 15/700 | 14/600 (franja) | 0 |
| operaciones | — (destino) | 20/600 | — | 0 |
| citas | — (destino) | 16/500 | — | 6 |

\* **Punto ciego del instrumento, declarado.** «0 primarias» en expediente y
consulta **no** significa que no tengan acción primaria: la tienen y se ve en
la captura («Nueva consulta» en el ancla). La sonda cuenta `.btn-primary` y
esas dos pintan su primaria con un estilo inline propio (`primaryBtn`). Es
deriva del sistema de botones, no ausencia de acción, y **no se repara aquí**:
renderiza correcto y el trinquete de diseño ya gobierna ese terreno.

### El hallazgo, dicho en una frase

**En las dos superficies donde el médico LEE sobre el paciente, el nombre del
paciente es la voz más fuerte de la pantalla (20px). En las tres donde EMITE
un documento que cambia su tratamiento —receta, orden, nota— el nombre cae a
14px de cromo periférico y el sitio dominante lo ocupa el nombre de la
HERRAMIENTA.** El degradado ocurre justo en las superficies consecuentes, que
es al revés de lo que pediría la seguridad.

La captura lo enseña sin ayuda: en la receta de Luz María Cervantes Ochoa, lo
más grande de la pantalla es **«Generador de Receta»**, y la vista previa del
papel —a la derecha, en la misma pantalla— sí encabeza con **PACIENTE · Luz
María Cervantes Ochoa**. El impreso sabía quién es el sujeto; la pantalla de
trabajo, no.

### La causa raíz no fue un descuido repetido tres veces

Fue que **nadie era dueño de la pregunta** «¿qué nombra el encabezado de un
documento clínico?». Cada pantalla la contestó sola, en su barra, con su
literal — mientras los comentarios de las tres afirman pertenecer a una
familia que «habla el mismo idioma y el mismo orden». Eran tres gramáticas
para una pregunta que nadie había hecho en voz alta.

Y `/nota` no tenía **ningún** `<h1>`: la única superficie clínica medida sin
encabezado de nivel uno. No lo había visto ninguna corrida de axe porque la
familia documental **nunca entró en su lista de pantallas**
(`scripts/design/axe-encuentro-v15.mjs`, `PANTALLAS`: Hoy, pacientes,
expediente, consulta, operaciones, pendientes).

---

## Lo que se reparó, y lo que deliberadamente no

### C-01 · el documento clínico nombra al paciente — PAGADA

`TituloDeDocumentoClinico` es el dueño que faltaba. El `<h1>` dice el nombre
del paciente; el tipo de documento baja a rótulo subordinado.

**Por qué un componente y no tres bloques copiados.** §22 prohíbe abstraer
para «hacer las cosas consistentes». La prueba que sí pasa: tres usos reales y
**una invariante de dominio**, no un parecido visual —

> en una superficie que emite un documento clínico, el encabezado dominante
> nombra AL PACIENTE; el tipo de documento es subordinado; y el nombre
> **nunca se inventa mientras carga**.

Esa última cláusula es la que obliga a tener dueño: es la misma regla que ya
cumplen `InstrumentStrip` («nunca enseña el nombre del paciente ANTERIOR
mientras carga el siguiente») y el ancla del expediente. Repetida a mano en
tres archivos, se rompe en el cuarto y nadie se entera.

**Lo que NO cambia, y es deliberado:** el documento impreso. El `<h1>` vive en
la barra `no-print` de la pantalla de trabajo — PDF, impresión y Word salen
exactamente igual. V15 congela el contenido de los artefactos medicolegales.

**La voz tampoco cambia:** 20/700, el mismo tamaño y peso que ya tenían
`/receta` y `/orden`. Cambia **qué** dice, no cuánto pesa — así la comparación
antes/después aísla una sola variable y no hay rediseño encubierto.

Guardián: `v15-el-documento-clinico-nombra-al-paciente.test.ts`, 10 casos,
**probado al revés ×3** — que la receta vuelva a titular la herramienta, que
la nota se quede sin encabezado, y que el título invente «Paciente» cuando no
ha cargado: cada reversión muerde los casos que le tocan.

#### Medido DESPUÉS, en navegador, en los dos anchos

No se aprueba desde el fuente. Misma matriz, mismo arnés, misma siembra:

| superficie | ANTES (h1 · identidad) | DESPUÉS (h1 · identidad) |
|---|---|---|
| nota | *sin `<h1>`* · 14/600 (franja) | **«Aurelio Domínguez Peña»** · **20/700 (h1)** |
| receta | «Generador de Receta» · 14/600 (franja) | **«Luz María Cervantes Ochoa»** · **20/700 (h1)** |
| orden | «Orden Médica» · 14/600 (franja) | **«Aurelio Domínguez Peña»** · **20/700 (h1)** |
| expediente | «Aurelio Domínguez Peña» · 20/600 | sin cambio |
| consulta | «Aurelio Domínguez Peña» · 20/700 | sin cambio |
| referencia | «CARTA DE REFERENCIA» · 14/600 | **sin cambio, a propósito** (deuda declarada) |

Móvil 390×844: idéntico a 19px de escala. **Las cinco superficies de paciente
hablan por fin la misma jerarquía**, y la que se queda fuera se queda por una
razón escrita, no por olvido.

El ANTES se conserva en `docs/design/capturas/v15-coherencia/antes/` — acta y
capturas — para que la comparación no dependa de la memoria de nadie.

### C-02 · dos contradicciones pequeñas de gramática — PAGADAS

Salieron de inventariar el encabezado de **las 45 pantallas del dashboard a la
vez**. Cuatro salían sin encabezado de nivel uno; sólo mirándolas una por una
se separan las de verdad de los falsos positivos:

| pantalla | veredicto |
|---|---|
| `/expedientes` | **falso positivo** — es un `router.replace` a `/pacientes`, no una pantalla |
| `/nota/[patientId]` | **falso positivo** como encabezado — es la ruta de rescate de un URL mal formado |
| `/nota/[…]/[notaId]` | defecto real → C-01 |
| `/chat` | **defecto real** — tiene título, pero fingido |

1. **`/chat` fingía su encabezado.** «Chat de la clínica» se pintaba en un
   `<div>` a 15/700, en el sitio exacto de un título y con su misma voz, sin
   serlo. Todas las demás superficies declaran el suyo de verdad, propio o vía
   `PageHeader`. Cambia la **semántica**, no la voz: mismo tamaño, mismo peso,
   mismo sitio.
2. **La ruta de rescate prometía un sitio y llevaba a otro.** Su botón decía
   «Ir a Consulta» y navegaba a `/pacientes`. Es la familia de **RTC-08**, que
   este producto ya declaró defecto y reparó en el riel: «un ítem que dice
   Encuentro, te deja en la lista de pacientes y encima ilumina Paciente rompe
   la pregunta de §15 en el primer uso». La regla que se fijó entonces —o hay
   un lugar, o se dice cuál es— nunca llegó hasta aquí. **El destino no se
   toca** (no se entra a una consulta sin elegir paciente): se corrige la
   promesa, que era la que mentía.

   Es la misma **forma** que REG-319: el producto aprendió la lección en un
   contenedor y no la aplicó en el hermano.

Guardián: `v15-cada-destino-declara-su-encabezado.test.ts`, 5 casos, probado
al revés ×2.

### Un error propio, del tipo que esta casa ya tiene fichado

El primer guardián de C-01 falló **contra sus propios comentarios**: leía el
archivo entero y el literal `<h1>` aparece en la prosa que explica la
reparación. Es el reverso exacto de **REG-316** («cuatro líneas de prosa fuera
de un comentario mataron una regla de CSS»): allí la prosa se escapó del
comentario; aquí la prosa de dentro del comentario se coló en una medición.

Un guardián que cuenta prosa no cuenta código, y se habría «arreglado»
borrando la explicación — justo lo que no debe pasar. Se filtra el comentario
**y se prueba el filtro**, porque un filtro que borrase de más dejaría el caso
pasando siempre: verde por no mirar nada.

---

## Regresión: el banco de flujos, re-corrido entero

La matriz mide superficies al aterrizar; **no recorre flujos**. Como la
reparación toca tres superficies clínicas —y una de ellas, `/receta`, está en
mitad de WF-05— el banco de la Iteración 17 se **re-corrió completo** sobre el
árbol reparado, mismo arnés y misma siembra:

```
20 corridas (10 flujos × 2 anchos)
20 COMPLETA · 0 pérdidas de contexto · 0 callejones
consola: 16 corridas con 0 · 2×3 (503 del proveedor de transcripción, WF-04)
         · 2×2 (500 de PORTAL_PACIENTE_SECRET, WF-05) = 10
```

**Paridad exacta con la Iteración 17**, incluidos los diez errores de consola,
que son los mismos dos grupos ambientales y ningún otro. WF-05 —el flujo que
atraviesa la receta— completa con 0 pérdidas; WF-07 y WF-08 —la cadena de §21,
`fact → inspect → source → return exactly where you were`— completan en los dos
anchos: **Source Reveal no regresó**. Y el expediente en el teléfono sigue
midiendo 15.85 pantallas (era 15.9): la deuda P2 heredada, **intacta y sin
disimular**.

**Las capturas y el acta de `v15-flujos/` se restauraron a las de la Iteración
17 después de leer el resultado.** Esa iteración está cerrada por lectura
independiente y su evidencia es inmutable: re-correr el banco sirve para saber
si algo regresó, no para reescribir el acta de una iteración que ya cerró. El
resultado de la re-corrida vive aquí, en texto, que es donde le toca.

## Deuda registrada y NO pagada

Se registra; no se repara. Y **no se asciende de severidad** porque la
iteración se llame «Coherencia Final».

1. **P3 · `/referencia` encabeza «CARTA DE REFERENCIA», y se queda así.** Su
   `<h1>` está **dentro del papel**, centrado, como título del propio oficio —
   no es cromo de pantalla. Cambiarlo cambiaría un documento medicolegal
   emitido. Es una diferencia de contexto clínico **legítima**, de las que §7
   prohíbe aplanar: no toda la familia documental tiene la misma forma, y
   forzarla habría sido consistencia superficial a costa del artefacto.
2. **P3 · expediente y consulta pintan su acción primaria con estilo inline
   propio**, no con `.btn-primary`. Deriva del sistema de botones; renderiza
   correcto, no afecta a la conducta, y el trinquete de diseño ya gobierna ese
   terreno. Se declara porque es el punto ciego que explica los «0» de la
   tabla, no como hallazgo nuevo.

### Refutado midiendo — no era defecto

- **«La barra del pulgar tiene otro tercer destino que el riel»** (móvil:
  Hoy · Paciente · **Nueva cita** · Seguimiento · Operaciones; escritorio:
  Hoy · Paciente · **Encuentro** · Seguimiento · Operaciones). La barra tiene
  **cuatro destinos y una acción central contextual**, no cinco destinos: esa
  acción es «Consulta → `/consulta/<paciente>`» cuando hay paciente en
  contexto y «Nueva cita» fuera de él, con la corona reservada a la entrada
  clínica. Está decidido y documentado en RTC-07. **Coherente por diseño.**
- **«Hoy llama "Consulta" a lo que el héroe llama "Iniciar consulta"»** — ya
  adjudicado en **RTC-24**: «la misma acción, abreviada por espacio», y
  unificar los cuatro nombres habría borrado una distinción que el médico usa
  a diario («Iniciar» ≠ «Nueva»). **No se reabre.**
- **«/pendientes tiene 7 primarias, /citas 6»** — son colas de trabajo: una
  primaria **por fila**, que es la forma correcta de un `WorkQueue`. §11 pide
  una acción dominante por superficie en las superficies críticas, no aplanar
  una cola. La Iteración 17 ya la midió PASS.
- **El vocabulario de trabajo sin resolver** — `ETIQUETA_ESTADO_DE_ACCION` es
  fuente única y `/pendientes` la consume; los grupos no divergen entre
  superficies.

---

## Estado de la deuda de la Iteración 17

| deuda | estado |
|---|---|
| P2 · Hoy mezcla reloj de consultorio y de dispositivo | **UNCHANGED_DEBT** — no es defecto de coherencia de superficie; sigue en el ledger. El arnés la esquiva fijando `timezoneId`, y lo dice. |
| P2 · el expediente mide 15.9 pantallas en el teléfono | **UNCHANGED_DEBT** — carga de lectura, no incoherencia. No bloquea WF-03. |
| P3 · el `<h1>` de la receta nombra la herramienta | **PAGADA** (C-01), y con ella salió que era **familia entera**, no una pantalla: orden igual y nota sin `<h1>` ninguno. |
| P3 · el cierre del encuentro no acusó lo hecho al volver de la receta | **UNCHANGED_DEBT** — mirado, no reparado: `hechosCierre` se inicializa de `notaIdParam` (`?nota=`), así que la marca sólo reaparece si la vuelta conserva ese parámetro. Diagnóstico anotado; reparar exige tocar la continuidad de `/consulta`, que está fuera del alcance medido de esta iteración. |
| Precisión de prueba WF-03 / WF-07 / WF-08 / WF-10 | **UNCHANGED_DEBT** — son del banco de flujos, cerrado por lectura independiente. Reabrirlas aquí sería reabrir la Iteración 17. |
| Heredadas (notificaciones, alergias, orden/receta, RTC-12(a), compuerta de prosa) | **UNCHANGED_DEBT** — ninguna se tocó. |

## No comprobable, con la dependencia dicha por su nombre

- **`PORTAL_PACIENTE_SECRET no configurada`** — los dos `500` de `/receta`,
  en los dos anchos. Son **los únicos errores de consola de la corrida**: las
  otras diez superficies corrieron con 0 en escritorio y en móvil. Mismo grupo
  que ya declaró la Iteración 17; no es defecto del producto y **no se cuenta
  como PASA**.
- **La transcripción y la nota que nace de ella**, y **la comunicación real al
  paciente**: fuera del alcance de esta matriz, que no graba ni envía nada.
  Siguen `UNVERIFIABLE`, y **no se convierten a PASS**.

## Qué NO cubre esta matriz

- **No juzga si una diferencia entre superficies está justificada.** Publica la
  tabla; decidir si una fila es defecto lo hace quien lee, con su razón
  escrita. §7 prohíbe forzar consistencia donde el contexto clínico difiere de
  verdad — `/referencia` es el ejemplo, y se dejó como está.
- No mide estética, ni sustituye al trinquete de diseño ni a axe.
- No mide percepción humana: los píxeles son de máquina.
- No recorre flujos. Mide superficies al aterrizar; los flujos son el banco de
  la Iteración 17 y se re-corren aparte como regresión.
- Una superficie que no se puede sembrar sale `NO_ALCANZABLE` con su razón,
  **nunca `PASA`**.
