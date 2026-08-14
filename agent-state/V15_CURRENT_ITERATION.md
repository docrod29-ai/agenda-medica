# V15 — estado vivo

**Rama canónica:** `v15/structural-uiux` · **PRs V15 abiertos:** 1 (#292)

## Iteración en curso

`V15-ORIGINALITY-REDTEAM-001` (§43 orden 16, §41) — **EN CURSO. 14-ago, 5ª
corrida: RTC-32 pagó el tercer y último residuo de la 4ª pasada de §29 (el cromo
flotante del escritorio, 6/6 → 0/6). Con él NO queda trabajo estructural
nombrado por delante: lo que falta para cerrar la iteración es la lectura
INDEPENDIENTE de §26/§29 — quien implementa no puede ser el juez.**

Historia previa — **registros UNIFICADOS 13-ago-2026. P0 cerrados y NUEVE P1
pagados** (RTC-03, RTC-04,
RTC-05, RTC-06, RTC-07, RTC-08, RTC-09, RTC-10, RTC-11). Queda RTC-12,
declarado deuda dimensionada del monolito:

- **Registro canónico**: `docs/design/v15/V15-REDTEAM-REGISTRO-CANONICO.md`
  (IDs `RTC-01..28`, mapeo ORT↔RT por CONTENIDO — los paréntesis RT/DS/CW
  de los ORT eran informes internos del panel A, no los RT del panel B —
  severidad reconciliada, estado por defecto). Los dos veredictos quedan
  como ACTAS con nota de superseded; **la cola de reparación vive sólo en
  el canónico**.
- **RTC-03 / RT-08 (clic ciego → paciente equivocado): FIXED como REG-312.**
  Candado `data-vt-congelada` → `pointer-events:none` sobre `<body>`
  durante el callback de `startViewTransition` (con `finally`), tope
  1200→400ms. Guardián `rt-08-ventana-de-clic-ciego.test.ts` (6 casos,
  BEHAVIORAL con DOM de mentira + fake timers, probado al revés ×2: sin
  candado fallan 5, con tope viejo fallan 2). Sello 4569→4575; familia
  `se_contradice` (312 clasificado). Verificado en NAVEGADOR REAL:
  `medir-continuidad-v15.mjs` extendido con 3 casos RT-08 (regla parseada,
  congelado durante callback, suelto al terminar) — **25/25 en verde**, la
  cadena §20 entera sigue funcionando con el tope nuevo (equivalencia
  funcional medida, no supuesta).
- **RTC-02 / RT-01 (vara de genericidad rota): FIXED.** El trinquete de
  diseño gana TRES contadores de genericidad — `gradientes` (16), `cristal`
  (16), `halosDeColor` (9: rgba con croma dentro de sombra) — medidos al
  nivel del VALOR CSS, TSX + `globals.css` (la genericidad no depende de
  dónde viva el valor), techos sellados sólo-baja y probados al revés (los
  tres muerden). `GENERIC_AI_AESTHETIC_AUDIT.md` lleva la CORRECCIÓN
  escrita: la tabla de clases Tailwind queda como acta del error de método.
- Colaterales pagados: `FAMILIAS-DE-DEFECTO.md` (30 de 160, REG-312),
  tablero (`actualizar.mjs`), sala de datos (`actualizar-cifras.mjs`).

Historia de la unificación (dos corridas concurrentes el mismo día, §39):
Dos corridas concurrentes del routine ejecutaron el equipo rojo el mismo
día sobre las MISMAS 27 capturas (§39: quedó registrado; el estado se
consolidó por merge, sin force-push):

- **Panel A** (3 revisores): veredicto en
  `docs/design/v15/ORIGINALITY-REDTEAM-001-veredicto.md`, registro
  **ORT-01..21** (1 P0 — REPARADO como **REG-311**: el PatientAnchor traía
  la SÉPTIMA copia de la negación de alergias, sin `\b`; las tres piezas
  derivan ahora del módulo sellado y hay guardián contra la octava copia —
  7 P1, 8 P2, 5 P3). Scores §29: Hoy 3.5/4.5 · Pacientes 6/7 ·
  Expediente 4.5 · Consulta 3 · Pendientes 2 · Operaciones 7. Hueco
  declarado: el encuentro GRABANDO no está fotografiado.
- **Panel B** (4 revisores + verificación del orquestador): veredicto en
  `docs/design/V15_ORIGINALITY_REDTEAM_VEREDICTO.md`, registro
  **RT-01…RT-22**. Coincide en lo grueso (imitación REFUTADA, §14 PASS,
  pacientes/operaciones ~7, pendientes 2-3) y aporta hallazgos que A no
  tiene: **RT-08** (ventana de clic ciego en `continuidad.ts` — riesgo de
  PACIENTE EQUIVOCADO), **RT-01** (la vara de genericidad contaba clases
  Tailwind en código 88.5% inline; re-medido: 14 gradientes, 56 sombras,
  15 backdrop-filter, y sin trinquete de genericidad). Pagos de B:
  RT-03 (héroe móvil de Hoy con breakpoint, verificado en navegador),
  RT-05 parcial (4 etiquetas de IA-feature muertas, §25), el degradado
  morado literal y un radio 12.

- **RTC-04 (banner de cobro + pila de avisos ↔ EVENTO_GRABANDO): FIXED
  13-ago (2ª corrida).** La suscripción vive ahora en la compuerta
  COMPARTIDA `@/hooks/useGrabando` (las dos copias privadas idénticas de
  FlowRail/BottomNav murieron — la familia `depende_de_recordar` era la
  causa raíz de que la pila no se hubiera enterado nunca), y el layout
  agrupa los 5 avisos administrativos (ModeBanner, correo, cobro, prueba,
  push opt-in) en `PilaDeAvisosAdmin`, que devuelve null mientras se graba
  y los devuelve al detener. `OfflineBanner` y `AvisoIncidenteIA` quedan
  FUERA a propósito: degradación no es admin — grabando es cuando MÁS
  importan. Guardián `v15-avisos-se-aquietan-al-grabar.test.ts` (9 casos,
  probado al revés: 6 rojos sin el arreglo aplicado); navegador real
  desktop+móvil sobre `/consulta/[id]` con offline simulado DURANTE la
  grabación: el banner de prueba desaparece al grabar, el de offline SÍ
  aparece grabando, todo vuelve al detener
  (`docs/design/capturas/v15-avisos-quietos/acta-avisos-quietos.json`,
  PASS; capturas antes/grabando/grabando-offline/al-detener ×2 viewports).

- **RTC-06 (Hoy: UNA primaria clínica): FIXED 13-ago (2ª corrida).** El
  único relleno primario de /dashboard es el CTA del héroe NOW («Iniciar
  consulta»); «Nueva cita» pasó a `variant="secondary"` y los seis
  «Consulta» por fila a `btn-secondary` (la conducta —href, `puedeIniciar`,
  coreografía §20— no cambió); el saludo bajó de 32px display a KICKER
  (15px `--text2`, sigue siendo el `<h1>`), y el achique móvil global
  `main h1 { 19px !important }` lo excluye (lo estaba AGRANDANDO). Guardián
  `v15-hoy-una-primaria-clinica.test.ts` (6 casos, probado al revés: 5
  rojos); navegador real con getComputedStyle desktop+móvil
  (`docs/design/capturas/v15-hoy-una-primaria/acta-hoy-una-primaria.json`,
  PASS, 0 errores de consola). Inventario de pantallas regenerado.

**Nota operativa (13-ago, 2ª corrida):** una captura intermedia salió con la
app SIN CSS y el dashboard en error boundary — no era defecto del producto:
el `next start` del arnés anterior sobrevivía al `trap` (el kill mataba al
wrapper de npx, no a next-server) y el arnés siguiente, al chocar con
EADDRINUSE, medía contra el server VIEJO sirviendo un `.next` recién
sobrescrito (hashes de chunk desajustados → CSS 404). Los arneses nuevos
llevan guardia de puerto + `pkill -f next-server` en el trap. Si una corrida
futura ve «todo desnudo + Algo salió mal», revisar puerto 3000 ANTES de
diagnosticar CSS.

- **RTC-07 (la corona del pulgar es clínica): FIXED 13-ago (3ª corrida).**
  La CORONA del BottomNav (círculo relleno elevado, §8.6) sólo se pinta
  cuando la acción central ES clínica (`centralCoronada`); «Nueva cita»
  (admin) conserva posición/href/táctil pero pesa como destino normal y se
  aquieta al grabar (`iconoAtenuado(quieto, coronada)`); el CTA del header
  de Hoy se suprime en móvil (`.hoy-accion` ≤768px — la acción ya vive en
  el pulgar; escritorio la conserva). Alcance: shell V15 del médico — la
  barra de Secretaria conserva su conducta completa («Nueva cita» ES su
  trabajo primario, mismo alcance que `quieto`). Guardián
  `v15-rtc07-accion-del-pulgar-clinica.test.ts` (5 casos, probado al revés:
  4 rojos); navegador real (acta-pulgar-y-fabs.json PASS, ver RTC-05).

- **RTC-05 (FABs quietos y fuera del arco del pulgar): FIXED 13-ago (3ª
  corrida).** BotonAyuda y ThemeToggle consumen `@/hooks/useGrabando` y
  devuelven null al grabar (vuelven al detener — medido ida y vuelta en
  navegador). En MÓVIL ninguno flota: la ayuda es botón ESTÁTICO de la
  topbar (44×44, cero oclusión) que abre el panel real por
  `EVENTO_ABRIR_AYUDA` (declarado UNA vez en BotonAyuda, importado por el
  layout — lección de `estoy-grabando`), y el tema es la fila «Apariencia»
  de /operaciones (§11). El tema ganó UNA fuente de verdad
  (`@/hooks/useTema`: llave, ciclo y pintado; el toggle flotante y la fila
  son dos VISTAS sincronizadas por evento `nx:tema`; el guardián de marca
  ahora vigila la llave en su casa nueva). El cristal del toggle murió
  (fondo sólido — trinquete `cristal` 16→14) y el halo teal del FAB también
  (`halosDeColor` 9→8, techos sellados a la baja). Murieron los parches de
  convivencia por-pantalla (bottom 78 móvil, 136 del lienzo de chat; el
  guardián de chat-contraste ahora exige la regla que hace imposible la
  colisión: en el shell móvil el toggle NO existe). Nota de método: la
  primera pasada del arnés falló con «el FAB sigue flotando» — el FAB
  declara `display:flex` EN LÍNEA y la regla de hoja necesitó `!important`;
  el arnés lo cazó porque mide lo PINTADO, no el fuente. Guardián
  `v15-rtc05-fabs-quietos.test.ts` (6 casos, probado al revés: 6 rojos);
  navegador real desktop+móvil despachando `nx:grabando`
  (`docs/design/capturas/v15-pulgar-y-fabs/acta-pulgar-y-fabs.json`, PASS,
  0 errores de consola, 8 capturas).

- **RTC-09 (la IA es contextual, no un módulo del índice admin): FIXED
  14-ago (4ª corrida).** El grupo «Clínico» de `/operaciones` MURIÓ. Consultor
  y Antibiograma se declaran UNA vez en `@/lib/nav/capacidades-del-paciente` y
  viven en la barra de `Herramientas` del EXPEDIENTE: el consultor se abre
  LLEVANDO al paciente (`?paciente=`, que su página ya leía) y el antibiograma
  se USA ahí mismo (import perezoso del MISMO `AntibiogramaTool` que la
  consulta ya embebía — esto termina de aplicar el patrón del encuentro, no lo
  inventa). Hospitalización/UCI se quedan en el índice secundario con el nombre
  de lo que son —«Hospital y UCI»: otro escenario de atención, ALPHA tras
  bandera (§11)— y el copy de la pantalla dejó de prometer sólo «lo
  administrativo». **Ninguna ruta se borró.** Los dos freeze que tocaban esto
  (los 20 destinos, la alcanzabilidad post-Sidebar) ahora cuentan las DOS casas
  LEYENDO la declaración, no una lista escrita a mano: el invariante («ninguno
  se cayó») es el mismo, el mecanismo tiene una superficie más. Guardián
  `v15-rtc09-ia-contextual.test.ts` (7 casos, probado al revés: 4 rojos).

- **RTC-11 (la identidad del paciente cabe en un teléfono): FIXED 14-ago (4ª
  corrida).** La fila de `/pacientes` tiene variante MÓVIL: bajo 768px salen
  «Editar» (datos de CONTACTO: administrativo) y el chevron decorativo, y la
  identidad se queda con el ancho. Medido en navegador real: **de 3 renglones
  en ~90px a 1 renglón en 228px**; en escritorio «Editar» sigue pintado — es
  variante, no amputación. Y la capacidad se MUEVE de verdad: «Editar datos»
  del expediente hacía `push('/pacientes')` —un viaje que no llegaba: soltaba
  al médico en la lista con el editor cerrado, agujero que sólo se volvía
  visible al quitar el botón de la fila— y ahora abre `?editar=<id>`, que la
  lista obedece (con el `setState` dentro del temporizador: el linter marca con
  razón el encadenado de renders). El `!important` de la regla no es pereza:
  los dos elementos declaran su `display` EN LÍNEA — la trampa que el arnés
  cazó en RTC-05. Guardián `v15-rtc11-fila-paciente-movil.test.ts` (5 casos,
  probado al revés: 3 rojos).

**Arnés de esta corrida:** `scripts/design/verificar-rtc09-rtc11-v15.mjs`
(390×844 + 1440×900, build de producción + emuladores + siembra sintética):
**23/23 condiciones PASS, 0 errores de consola**, 5 capturas en
`docs/design/capturas/v15-rtc09-rtc11/`. Dos condiciones fallaron en la primera
pasada y NINGUNA era defecto del producto — las dos eran del arnés, y quedan
escritas porque la próxima corrida tropezaría igual: (1) Hospital/UCI son
`MODULOS_OPT_IN` y la clínica de capturas no los contrata, así que
`rutaPermitida` filtra el grupo entero (la condición se reescribió como «el
grupo aparece si y sólo si su módulo está permitido» — un grupo vacío pintado
SÍ sería defecto); (2) «Datos del paciente» viene plegado, así que el botón de
editar no existe en el DOM hasta abrirlo y el clic caía en la nada.

- **RTC-08 («Encuentro» es un lugar, o dice que no lo hay): FIXED 14-ago (5ª
  corrida).** El riel tiene TRES respuestas y ninguna es el silencio: estás
  dentro · hay uno abierto y lo RETOMA · no hay ninguno y lo DICE en su nombre
  accesible (`title` Y `aria-label`: un `title` suelto no lo oye nadie). El
  estado NO se inventó — `@/lib/nav/encuentro-abierto` lo lee del respaldo
  local que la consulta ya escribía mientras se dicta, que es exactamente «hay
  un encuentro abierto en este dispositivo». Saca IDs y sello de tiempo, ni un
  dato clínico; un respaldo ilegible sigue contando (esconder una consulta a
  medias es el caso que más duele). La cabecera de `FlowRail`, que desde
  V15-IA-001 decía «no hay que inventarlo aquí», quedó reescrita: la decisión
  fue correcta entonces y lo que faltó fue volver cuando el estado ya existía.
  Guardián `v15-rtc08-encuentro-es-un-lugar.test.ts` (10 casos, 6 CONDUCTUALES
  sobre el módulo real con `window` sustituido; probado al revés: 3 rojos).
  Nota de método: la primera versión pintaba la señal con `var(--nexus)` EN
  LÍNEA y la suite completa la cazó — `v15-el-acento-entra-al-shell` (Fase 10)
  exige que el riel no lleve acento propio. El color se movió a `.nx-rail-senal`
  en la hoja y el guardián de Fase 10 volvió a verde **sin tocarlo**: cuando
  dos guardianes se contradicen, casi siempre el que está mal es el arreglo.
  Navegador real recorriendo el ciclo entero —sin encuentro → abrir y escribir
  → salir a Hoy → retomar—: `docs/design/capturas/v15-rtc08/acta-rtc08.json`,
  **13/13 PASS**, 0 errores de consola, 4 capturas.

- **RTC-10 (el primer viewport del expediente es el PACIENTE): FIXED 14-ago
  (6ª corrida).** El orden de la página dice ahora lo que la pantalla ES:
  identidad → estado → pendientes → historia → utilidades → documentos. Los
  tres botones de documentos/exportación bajaron al final con nombre propio
  (misma conducta, mismos avisos de lo que cada formato no lleva); las tarjetas
  de signos y dx sólo se pintan CON contenido —y su ausencia se DICE en una
  línea que habla del REGISTRO, no del paciente: la regla 4 corta en las dos
  direcciones—; las dos cajas-módulo plegadas bajaron bajo la historia; y el
  riel del Clinical Spine sigue el orden visual. Antes/después con el MISMO
  instrumento (3 expedientes, 1440×900): pendientes **775px bajo el pliegue →
  492px antes de la historia**, cajas-módulo sobre la historia **2 → 0**,
  tarjetas vacías **2 → 0**, export sobre la historia **3 → 0**. Guardián
  `v15-rtc10-primer-viewport-clinico.test.ts` (8 casos, probado al revés ×2).

**Lecciones de método de esta corrida — tres, y las tres del INSTRUMENTO:**
(1) La primera métrica elegida («a qué altura empieza la historia clínica»)
MIENTE en las dos direcciones: baja al borrar cromo, pero también sube al meter
contenido clínico encima, que es justo lo que se quería — un expediente
«empeoró» de 745 a 798px precisamente porque su primer viewport se llenó de
datos del paciente. (2) El detector de «primer dato clínico» escrito a ojo
contaba el contador «Consultas: 6» de la tarjeta Actividad y **aprobaba el
baseline** que el equipo rojo acababa de reprobar; se sustituyó por landmarks
con `id` del propio Clinical Spine, que no admiten interpretación. (3) El
guardián falló contra SUS PROPIOS COMENTARIOS (mencionan «Documentos y
exportación»), y el limpiador que se escribió para evitarlo borraba también los
cierres ` */` y se comía código hasta el siguiente — cinco casos rojos por el
limpiador, no por el producto. Las tres son la misma familia que
`grafo-de-dependencias` ya tenía escrita: **el lector veía texto donde tenía que
ver código**. Un instrumento que aprueba el defecto que viene a medir es peor
que no tener instrumento.

- **RTC-12 — PARTIDO por la medición (14-ago, 6ª corrida).** El defecto juntaba
  dos cosas y sólo una era cierta hoy:
  · **(b) «en consulta a 1440 el paciente se pierde al desplazar»: NO SE
    REPRODUCE.** Con el `<main>` desplazado 1500 de 2549px REALES, la identidad
    sigue a la vista — el `InstrumentStrip` vive FUERA del contenedor con
    `overflow-y:auto`, así que por construcción no puede irse con el contenido.
    Lo contestó el shell de V15-SHELL-GREYBOX-001 antes de que nadie lo
    preguntara. No se deja sin candado: guardián
    `v15-rtc12-la-identidad-no-se-desplaza.test.ts` (3 casos, probado al revés)
    porque basta un refactor de layout que meta la franja dentro del `<main>`
    para que el nombre del paciente empiece a irse a mitad de una nota — familia
    «paciente equivocado», la de REG-312.
  · **(a) «columna única 880–1100px»: CONFIRMADO y dimensionado** — hoy 900,
    pacientes 1100, expediente 880, consulta 980, de 1440 (340–560px sin usar).
    Sigue ABIERTO y es lo que el propio registro declara deuda del monolito de
    6147 líneas → V15-NOTE-PLAN-CONTINUITY / refactor. **No se abre aquí**: se
    planea entero antes, que es lo que el registro pedía desde el principio.
  Nota de método: la primera pasada del arnés hacía `window.scrollTo` y no movía
  NADA —el contenedor con scroll es `<main>`, no la ventana— y aun así informaba
  «la identidad sigue a la vista». Una condición que pasa porque el gesto no
  ocurrió es peor que una que falla; es la tercera vez en dos corridas que el
  instrumento, y no el producto, resulta ser el defecto.

### Re-puntuación §29 (14-ago, 7ª corrida) — hecha, y la compuerta sigue FAIL

18 capturas NUEVAS (6 superficies × escritorio/móvil/logo-off), 0 errores de
consola, sobre build de producción + emuladores + siembra. Veredicto entero en
`docs/design/v15/V15-REPUNTUACION-V29.md`:

| Pendientes | Hoy | Consulta | Expediente | Operaciones | Pacientes |
|---|---|---|---|---|---|
| **1.0** | **2.0** | **2.0** | **2.5** | **4.0** | **5.0** |

Cuatro de seis entre 1.0 y 2.5 — los diez P1 se VEN pagados en la pantalla. Pero
la compuerta se juzga por la peor: `GENERIC_AI_LOOK ≤ 1` → **FAIL**.

Las dos que fallan lo hacen por razones que **ningún P1 había tocado**, y por eso
no son una sorpresa sino el trabajo siguiente:

- **RTC-15 sube de P2 a P1** — `/pacientes` (5.0) es la lista de contactos de un
  CRM: no dice nada clínico de nadie. Ya estaba escrito en el registro; la
  medición le pone número y prioridad.
- **RTC-29, nuevo P1** — `/operaciones` (4.0) es un lanzador de aplicaciones:
  19 azulejos idénticos. RTC-09 arregló QUÉ vive ahí; nadie ha tocado QUÉ ES.
- **RTC-30, nuevo P2** — el estado vacío de plantilla (icono + título + frase +
  botón) en 3 de 6 superficies.
- **NO es trabajo nuevo** el par de FAB de escritorio: RTC-05 se pagó con alcance
  declarado y que sigan flotando en escritorio es decisión tomada, no resto.

**Cuarta vez que el defecto estaba en el instrumento.** La pasada «logo-off»
ocultaba `.nx-marca, [data-marca], svg[aria-label*="Ausculta"]` — ninguno de los
tres existe en este repositorio, así que las seis capturas «sin logotipo»
salieron CON el logotipo puesto y habrían contestado la pregunta de §34 sin
haber quitado nada. Misma forma exacta que el `window.scrollTo` de RTC-12. El
arnés ahora cuenta los nodos que oculta (3–4 por superficie, en
`marcas-ocultadas.json`) y lo grita si cuenta cero; guardián
`v15-arnes-logo-off-oculta-algo.test.ts` (3 casos, probado al revés) para que
ningún selector huérfano vuelva a colarse — **y ese guardián falló primero por
leerse a sí mismo**, porque su propia cabecera cita `.nx-marca` para explicar el
defecto: la misma ceguera de `grafo-de-dependencias` («el lector veía texto donde
tenía que ver código») por tercera vez en la iteración.

### RTC-15 PAGADA (14-ago, 8ª corrida) — la lista de pacientes es un worklist

La peor superficie del producto (5.0/10) dejó de ser una libreta de contactos.
Cada fila dice ahora su estado clínico, en prosa y ANTES del teléfono:

    Aurelio Domínguez Peña
    ⊙ Reconciliar — crítica, sin dueño · 2 pendientes en total
      visto hace 1 mes · +52 55 5555 0101 · 72 años

- **No es una fuente de datos nueva.** `tareasVivas()` es la MISMA lectura que
  ya hacen `/pendientes` y el `ContinuidadPanel` de Hoy —una consulta por
  consultorio, no una por paciente— y el orden lo pone `ordenWorklist`, el
  mismo del worklist. Un segundo criterio de urgencia aquí sería una segunda
  verdad sobre la misma entidad clínica.
- **Tres respuestas, no dos:** `con-pendientes`, `sin-pendientes` (la lectura
  llegó y no había nada) y `sin-leer` (falló o no ha llegado). `sin-leer`
  **nunca** se pinta como «sin pendientes» — una fila que afirma que no hay
  nada abierto por un error de red es el daño exacto que esto evita. Regla 4,
  en la dirección que se olvida.
- **La consecuencia, en prosa** («venció y nadie la tomó»), que es lo que hace
  que `/pendientes` sea la superficie mejor puntuada; el color acompaña sin ser
  el único canal.
- **`ultimaCita` se pinta por fin**: estaba leída desde siempre para ORDENAR la
  pestaña «Recientes» y no aparecía en ningún sitio. «visto hace 14 días».
- **`ETIQUETA_TIPO` tenía DOS copias** y ésta iba a ser la tercera. Ahora vive
  una vez en el modelo; el guardián de cableado de reconciliación se movió CON
  el dato y comprueba las dos mitades (que la etiqueta exista y que la pantalla
  la reciba), que es más de lo que comprobaba antes.
- El icono de la derecha pasó de `FileText` (un documento: describe el destino)
  a chevron (dice el gesto). Un botón «Abrir» con texto se descartó a propósito:
  sería un segundo control que hace lo que ya hace la fila entera, en la
  pantalla que §29 penaliza por exceso de cromo.
- Guardián `v15-rtc15-la-lista-dice-algo-clinico.test.ts` (12 casos, probado al
  revés ×5). Navegador real 1440+390: **17/17, 0 errores de consola**, con la
  condición que de verdad importa —los pacientes que `/pendientes` enseña con
  trabajo vivo son exactamente los que la lista marca—.
- **Y otra vez el instrumento**: la primera pasada del arnés dio 13/17 y las
  cuatro rojas eran suyas, no del producto — barría `[class*="nx-ident"]` y se
  llevaba la identidad del InstrumentStrip («Ausculta» contaba como paciente sin
  marcar); preguntaba si el chevron EXISTE cuando RTC-11 lo esconde con
  `display:none` (presencia no es visibilidad); y contaba RENGLONES de la
  identidad cuando el defecto de RTC-11 se midió en ANCHO, así que marcaba en
  rojo a «María del Refugio Alcántara Solís» por tener el nombre largo.
- **Declarado sin pagar:** «Respaldo» sigue en la cabecera primaria de
  `/pacientes` siendo una operación de §11. Mudarlo exige darle casa en
  `/operaciones`, que es justo la pantalla que RTC-29 va a rehacer; hacerlo dos
  veces sería trabajo tirado.

### RTC-29 PAGADA (14-ago, 9ª corrida) — Operaciones deja de ser un lanzador

**La causa raíz era de FORMA.** La rejilla de azulejos de 200px no dejaba sitio
físico para explicar nada: en ese ancho sólo cabe la etiqueta. La forma imponía
el contenido, y el contenido resultante era un menú de iconos.

- Ahora es una **lista**: un borde por grupo (19 cajas eran 19 fronteras
  compitiendo por atención), filas separadas por línea, y **todo destino con su
  `para`** — «Reactivación — avisar a quien lleva meses sin volver». El patrón
  no se inventa aquí: es el mismo `para` de `capacidades-del-paciente` (RTC-09)
  que ya pintan las Herramientas clínicas de la consulta.
- **La jerarquía es la cadencia** («Todos los días» · «Cada semana o cada mes» ·
  «Se configura una vez»), que es lo único honesto que esta pantalla puede decir
  sin inventarse datos. Un contador por área costaría una lectura por área en
  una pantalla administrativa (§8.5) y **una cifra equivocada es peor que
  ninguna**. Queda escrito como decisión, no como olvido.
- **Se pagó el resto de RTC-15**: «Respaldo» dejó la cabecera primaria de
  `/pacientes` y aterrizó aquí con su conducta ENTERA extraída a
  `@/lib/clinica/descargar-respaldo` — misma ruta, mismo streaming, mismo aviso
  de que la última línea del archivo declara si quedó completo. Mover no puede
  significar perder.
- Las tres anatomías que convivían en la pantalla —azulejo, botón de tema,
  botón de salir— se unificaron en una pieza (`FILA_DE_GRUPO` + `CAJA_DE_GRUPO`
  + `CabeceraDeGrupo`). Tres dialectos en una pantalla que es UNA lista.
- Guardián `v15-rtc29-operaciones-no-es-un-lanzador.test.ts` (8 casos, probado
  al revés ×5, incluido uno que caza el `para` que se explica repitiéndose).
  Navegador real 1440+390: **19/19, 0 errores de consola**, con el respaldo
  DESCARGANDO de verdad desde su casa nueva — mover una capacidad y no
  comprobarla en el destino es exactamente «el dato tiene que LLEGAR».
- **Lo encontró el arnés, no el guardián:** «Apariencia» y «Sesión» se quedaban
  sin cadencia porque en el fuente ni siquiera pasan por el catálogo. En una
  página cuya jerarquía ES la cadencia, un grupo que no la dice se lee como un
  olvido. Se les dio la suya y la misma anatomía que a todo lo demás.
- Dos guardianes ajustados con intención: el mínimo táctil (contaba apariciones
  de `minHeight: 44` — cuanto mejor factorizado, más rojo daba; ahora exige la
  pieza compartida y que ninguna fila se pinte fuera) y el del armado del
  respaldo (sigue al módulo donde la conducta vive hoy).

### Re-puntuación §29, 2ª pasada (14-ago) — 5.0 → 2.5, y el residuo es UNO

18 capturas nuevas, 0 errores de consola. Veredicto entero en
`docs/design/v15/V15-REPUNTUACION-V29-CIERRE.md`:

| Pendientes | Hoy | Consulta | **Pacientes** | **Operaciones** | Expediente |
|---|---|---|---|---|---|
| 1.0 | 2.0 | 2.0 | **5.0 → 2.0** | **4.0 → 2.0** | 2.5 |

Los dos pagos se VEN, y ninguna de las otras cuatro regresó. La compuerta queda
en **2.5 (peor superficie): sigue FAIL** contra ≤1.0.

**Lo que enseñó esta pasada y la primera no podía:** pagadas las dos
superficies malas, lo que queda **ya no se reparte por pantalla**. Cinco de las
seis comparten el MISMO marco —título + racimo de botones · buscador de ancho
completo · fila de píldoras · contenedor de tarjeta · estado vacío ilustrado—
que es el esqueleto que genera cualquier andamio. **La única que no lo tiene es
`/pendientes`, y es justo la que puntúa 1.0.** Por eso el resto se atasca en
2.0–2.5 por más que mejore su contenido: el contenido ya es de este producto;
el marco sigue siendo de cualquiera.

Eso es **RTC-31 (P1, nuevo)**, y **absorbe RTC-16** (P2, «no hay UN contenedor
de página»), que deja de ser un detalle de consistencia y pasa a ser la causa
medida del score que queda.

### RTC-31, 1ª rebanada (14-ago) — el marco de página, y `/pacientes` convertida

La ley entera en `docs/design/v15/V15-MARCO-DE-PAGINA.md`, derivada **por
comparación con `/pendientes`** (la que puntúa 1.0), no inventada:

1. **Toda pantalla dice qué es y de dónde sale su contenido.** `subtitle` pasó
   a ser OBLIGATORIO en el tipo de `PageHeader`. Ocho de las nueve pantallas ya
   lo ponían; la novena era `/pacientes`, la más visitada del producto — una
   regla que se cumple ocho de nueve veces no es una regla, es una costumbre, y
   la excepción cae siempre en la pantalla que más prisa tuvo. En el tipo, el
   compilador se encarga.
2. **Una lista de trabajo no lleva tarjeta alrededor.** La `.card` contenedora
   dibujaba una frontera que no separa nada de nada (dentro hay una sola cosa),
   y sumada a la tarjeta de cada fila daba el tablero «hecho enteramente de
   tarjetas redondeadas» que la regla de diseño prohíbe por su nombre. Agrupa
   **el encabezado, que además DICE algo**, no la caja.
3. **Un solo primario relleno por cabecera, y sólo si la pantalla tiene una
   acción primaria.** Ya se aplicó de hecho al sacar «Respaldo» en RTC-29.

`/pacientes` convertida y medida: 17/17 en navegador (1440+390), 0 errores de
consola, sin regresión de RTC-15 ni de RTC-11.

**Lo que se vio al quitar la caja, y no antes:** las bandas de inicial de «Todos
A-Z» (`--s2` a todo lo ancho) pasaron de ser separadores DENTRO de una tarjeta a
ser el elemento más pesado de la pantalla — más que los nombres de los
pacientes. Quitar un contenedor cambia el peso de todo lo que había dentro; se
mira después, no se supone.

Guardián `v15-rtc31-marco-de-pagina.test.ts` (5 casos, probado al revés ×3). El
trinquete de diseño BAJÓ solo: `tamanosFueraDeEscala` 1970 → 1969, re-sellado
con `--actualizar`.

**Declarado, no olvidado** (en la tabla del documento): faltan `/dashboard`,
`/expediente`, `/consulta` y la cabecera de `/operaciones`; las píldoras de
filtro y el estado vacío (RTC-30) siguen abiertos. Convertir cinco pantallas de
golpe sin volver a puntuar sería repintar.

### RTC-31, 2ª rebanada + RTC-30 (14-ago) — Hoy suelta la tarjeta, y el vacío se calla

- Los dos bloques de Hoy («Agenda de hoy» y «Sigue abierto de antes») dejaron
  de ser tarjetas: `.hoy-bloque` en vez de `.card`, con los laterales a 2px —
  dentro de una caja, 20px de padding es margen interior; sin caja, es una
  sangría que desalinea el bloque del resto de la página.
- **Y otra vez: quitar un contenedor cambia el peso de todo lo que había
  dentro.** Sin la caja que lo justificaba, «Sin citas hoy» se convirtió en
  **250px de vacío ilustrado por encima de dos pendientes críticos y sin
  dueño**, que quedaban fuera del primer viewport. Es la segunda vez en la
  misma rebanada (la primera fueron las bandas de inicial de /pacientes).
- Por eso **RTC-30 se pagó aquí**: `EmptyState` gana `variante="linea"` —el
  mismo componente, no uno paralelo— para el vacío de UN BLOQUE dentro de una
  pantalla que sigue teniendo trabajo debajo. «Hoy no hay citas. Mañana tienes
  6.» en un renglón, con su acción al lado.
- **El ERROR conserva su peso**: «No es que no tengas citas: no se pudieron
  leer» sigue siendo hero. Aligerarlo haría que un fallo de red se leyera como
  una agenda libre — regla 4, y la frase más peligrosa de esa pantalla.
- Guardianes: `v15-rtc30-estado-vacio-de-bloque.test.ts` (4 casos, al revés ×2)
  y un caso nuevo en el de RTC-31 (al revés). **El caso 4 de RTC-30 falló
  primero por el instrumento**: miraba ±400 caracteres alrededor del título y
  se llevaba por delante el `EmptyState` vecino; ahora acota el ELEMENTO.
- Medido en navegador: 0 errores de consola, y el worklist entero cabe ahora en
  el primer viewport de Hoy. Capturas en `docs/design/capturas/v15-rtc31-hoy/`.

### RTC-31, 3ª rebanada (14-ago) — el expediente respira y Operaciones habla la pieza

- **`/expediente`**: el vacío de la historia («Sin notas todavía», con
  ilustración y botón) era un hero de media pantalla dentro de una pantalla que
  NO estaba vacía —arriba ya había identidad, alergias y el riel del Spine—.
  Pasó a línea: ahora el expediente entero (identidad → estado → historia →
  datos → herramientas clínicas) cabe en el primer viewport. El **error** de
  carga conserva su hero, por lo mismo de siempre.
- **`/operaciones`**: su cabecera era un `<h1>` + `<p>` propios. Ahora es
  `PageHeader`, que además garantiza el subtítulo por tipo. El guardián de
  cromo se movió CON el código: comprueba que use la pieza compartida y que el
  `t-h1` siga existiendo donde ahora vive — más de lo que fijaba antes.
- **Observado y NO tocado**: en `/expediente`, «Nueva consulta» flota solo en
  una fila vacía a la derecha. Se ve raro, pero moverlo al ancla del paciente
  toca la rejilla móvil de V10-DEBT-006 y compite con «Consulta sin cerrar —
  continuar». Se mide antes de tocarlo: cambiar sin medir es repintar.

### RTC-31, 4ª rebanada (14-ago) — /consulta pierde el marco dentro del marco

- `grabCard` envolvía a `EmpezarAGrabar`, que YA es una superficie con su borde
  y su radio de 16: tarjeta dentro de tarjeta, con dos radios distintos a 18px
  de distancia. La caja existe para agrupar los controles de la grabación EN
  CURSO (medidor, tamaño, avisos, descarga de emergencia); antes de pulsar no
  hay nada que agrupar. No se borra: se le quita la piel mientras esté sola.
- Es la regla 2 del marco dicha en general, y así queda escrita en el
  documento: **un contenedor que no contiene más que una cosa no contiene
  nada.**
- El trinquete de diseño lo cazó en la misma corrida: `borderRadius: 0` es un
  radio fuera de escala. Se quitó — una caja transparente y sin borde no tiene
  esquina que redondear.
- Medido en navegador: la lista de herramientas clínicas sube ~120px y entra
  entera en el primer viewport. 0 errores de consola.

### RTC-31, 5ª rebanada (14-ago) — el primario del expediente, medido y mudado

La única rebanada que se tomó **con una medición delante**, porque la
observación («se ve raro») no bastaba y moverlo tocaba la deuda V10-DEBT-006.

    ANTES   fila propia de 43px + 24px de margen · 720px sin usar a su izquierda
            historia clínica a 491px (y 736px en los otros dos expedientes)
    DESPUÉS en el ancla, junto al nombre (172px libres medidos a su derecha)
            historia clínica a 424px (669px) — 67px recuperados, exactos

- En el **teléfono** la fila completa de 44px sigue siendo lo correcto, pero va
  **después del aviso de alergias**. La primera versión la metió ENTRE el nombre
  y el aviso: en un ancho donde todo va en columna el orden ES la jerarquía, y
  lo único que hay que leer antes de empezar a atender es ese aviso. Se vio en
  la captura, no en el código.
- Dos sitios, uno por ancho (medido: 1 de 2 visible en los dos). Murió la
  rejilla `.exp-actions` de V10-DEBT-006, que ordenaba cuatro botones donde
  quedaba uno.
- **El guardián de V10-DEBT-006 no se borró: se reescribió.** Su invariante —«el
  primario es lo primero que encuentra el pulgar»— sigue vivo y ahora se cumple
  mejor; lo que cambió es dónde se comprueba. Un guardián que se borra porque su
  código se movió deja de proteger justo cuando el código es más frágil.
- **Hueco declarado**: ningún expediente sembrado tiene encuentro sin cerrar, así
  que la convivencia del primario con «Consulta sin cerrar — continuar» en la
  misma fila NO se ha medido en navegador.
- **Y el instrumento falló tres veces más**: buscaba el botón sólo dentro de
  `.exp-actions` (la fila que él mismo recomendó quitar, así que el «después»
  informaba «?» en todo); cogía el primero del DOM en vez del VISIBLE (0×0 en
  móvil, el de escritorio oculto); y no medía el orden respecto al aviso de
  alergias hasta que se lo añadí.

### La siembra tenía expedientes sin historia (14-ago) — tres huecos, una causa

Buscando cómo medir el hueco que dejó RTC-31 (la convivencia del primario con
«Consulta sin cerrar — continuar»), la respuesta no estaba en el arnés sino en
la siembra: **`sembrar-capturas.mjs` no creaba ni una sola nota**. Todos los
expedientes salían con «Sin notas todavía», 0 encuentros, sin signos y sin
diagnósticos. Sobre esa pantalla vacía se midió media docena de rebanadas.

Los tres huecos declarados por separado tenían la misma causa:

  · RTC-10 — `#spine-problemas` «no llegó a pintarse: ningún paciente sembrado
    tiene notas firmadas con dx ni fármacos».
  · Las TRES pasadas de §29 — «no cubre pantallas llenas».
  · RTC-31 5ª rebanada — sin borrador no hay «Consulta sin cerrar».

Ahora la siembra crea cuatro notas: tres firmadas (con diagnósticos, signos y
un alérgeno real) y **una en borrador**; y deja pacientes SIN notas a propósito,
porque el expediente vacío es el estado del paciente nuevo y también hay que
poder medirlo. El sello de integridad se declara falso por su nombre
(`siembra-sintetica-sin-sello`): estas notas no pasan por `sellar()` y un hash
inventado dejaría creer que sí.

**Lo que se vio la primera vez que el expediente tuvo historia** (acta y
capturas en `docs/design/capturas/v15-rtc31-primario-con-notas/`): banda de
alergias con alérgeno real y su procedencia («Último cambio: Nota de Primera Vez
· hace 20 días»), riel del Spine con «1 dx · 0 fármacos», tarjetas de signos y
dx con contenido, el bloque de problemas —el que RTC-10 nunca pudo medir—, los
pendientes del paciente con «1 vencido · 1 en plazo», y la historia con su badge
de borrador. **La convivencia medida**: el primario mide 160×43 junto a la
píldora ámbar de «continuar», 1 de 2 copias visible, 0 errores de consola.

Guardián `v15-la-siembra-tiene-expedientes-con-historia.test.ts` (5 casos,
probado al revés ×2) para que la siembra no vuelva a quedarse sin historia en
silencio.

**Consecuencia honesta:** las lecturas de `/expediente` de las TRES pasadas de
§29 son de la pantalla vacía. La cuarta tendrá que puntuar la llena, que es la
que el médico ve. Los números viejos no se corrigen: se declara de qué eran.

### Lo primero que enseñó la siembra con historia: RTC-14 se puede medir (14-ago)

La 4ª tanda de capturas —ahora con `/expediente` y `/consulta` en sus DOS
estados, con historia y vacíos— encontró a la primera lo que el pliegue vacío
escondía:

- **RTC-14 confirmado y medido, y sube a P1.** En `/consulta` la alergia se
  pinta **×2 en el primer pliegue** (49px): la franja EDITABLE de arriba y una
  píldora de sólo lectura bajo el nombre. En `/expediente` es ×1 — esa mitad ya
  estaba pagada. Llevaba desde el panel del equipo rojo sin poder medirse
  porque ningún paciente sembrado tenía alergias.
- **Y un hallazgo nuevo**: con historia, la identidad del paciente cae a
  **287px en escritorio y 404px en móvil** —las cajas de alergias, problemas y
  visitas anteriores van por delante— y «Grabar la consulta» a 452/564px. El
  trabajo de la pantalla queda en el tercio inferior del teléfono, y de quién
  es la consulta se lee a media pantalla. Con el expediente vacío la identidad
  estaba a ~172px: el defecto sólo existe cuando el paciente tiene historia,
  que es siempre menos el primer día.
- **No se paga a ciegas**: cuál de las dos presentaciones sobrevive tiene peso
  clínico —una es editable (el médico registra la alergia durante la consulta)
  y la otra enseña la lectura semántica de `alergenosDe` (REG-279/REG-311)—.
  Hay que conservar las dos capacidades en un solo sitio. Ésa es la rebanada
  siguiente, con el acta delante.

**Estado de la iteración:** `V15-ORIGINALITY-REDTEAM-001` tiene los DOS P0, los
DIEZ P1 originales, **RTC-15**, **RTC-29**, **RTC-30**, las dos pasadas de §29 y
cinco rebanadas de **RTC-31** y **RTC-14** (la mitad de la duplicación).

### RTC-14 PAGADA (14-ago) — una presentación, los dos hechos

Sobrevive la franja de arriba: es la primera, es la que permite **escribir** la
alergia durante la consulta, y ya tenía color e icono medidos en los dos temas.
Lo único que la píldora aportaba de más —la lectura semántica de `alergenosDe`—
**sube a la franja, junto al texto del que sale**. Y sólo se enseña cuando añade
algo: si lo escrito ya es el alérgeno, repetirlo al lado sería el mismo defecto.

    ×2 → ×1 en el pliegue · 49px → 20px
    «Grabar la consulta» 452 → 416px (escritorio) · 564 → 527px (móvil)

**El dato LLEGA, comprobado**: se sembró a propósito el caso de REG-311 —«Niega
penicilina. Alérgico a sulfas», la frase que una copia local del criterio llegó
a pintar como neutra— y la franja enseña «se lee: sulfas» en los dos anchos.
Sin ese paciente, esa mitad quedaba escrita y sin comprobar, que es exactamente
por lo que RTC-14 tardó un día en poder medirse.

**Queda abierta la otra mitad de RTC-14**: la salience cromática de la franja
(«en gris es el elemento MENOS saliente») no se ha medido.

### RTC-31, 6ª rebanada (14-ago) — en /consulta la identidad encabeza

    con historia, ANTES   identidad a 287px (escritorio) · 404px (móvil)
    con historia, DESPUÉS               105px           · 183px
    el expediente, para comparar        117px           · 195px

Las cajas de contexto —alergias, problemas, visitas anteriores— iban por delante
del nombre. **Con el paciente vacío la identidad estaba a ~172px**, así que el
defecto sólo existía cuando el paciente tiene historia: la pantalla se veía bien
justo en el caso que no importa. El orden no se inventa —es el que el expediente
ya había elegido en su ancla— y ahora el mismo paciente se ancla igual en las
dos pantallas.

### 4ª pasada de §29 (14-ago) — 2.0 → 1.5, y lo que queda son TRES cosas

Primera pasada que puntúa la pantalla que el médico ve de verdad: las tres
anteriores puntuaron expedientes sin una sola nota.

| Pendientes | Hoy | Pacientes | Operaciones | **Expediente** | **Consulta** |
|---|---|---|---|---|---|
| 1.0 | 1.5 | 1.5 | 1.5 | **2.0 → 1.5** | **2.0 → 1.5** |

**Peor superficie 1.5: sigue FAIL** contra ≤1.0. Pero lo que queda ya no es «el
marco» —eso se pagó en seis rebanadas—: son tres residuos con nombre.

1. **Las píldoras de filtro** (pacientes, expediente, historia). `/pendientes`
   no las tiene: usa frases. Es lo más caro que queda y sigue sin decidirse.
2. **La fila de tarjetas-estadística** del expediente: su contenido es clínico
   y específico, su forma es la fila de KPIs de cualquier tablero.
3. **Los dos FAB de escritorio** (6/6). RTC-05 se pagó con alcance declarado y
   esa decisión sigue en pie — pero ahora que no quedan defectos mayores, son
   lo que más se parece a otro producto.

El control se sostiene: `/pendientes` no se ha tocado en ninguna rebanada y
sigue en 1.0; Hoy, pacientes y operaciones no se tocaron desde la 3ª y no se
movieron. Sólo se movió lo que se tocó.

### RTC-18 PAGADA (14-ago) — lo que navega deja de vestirse de filtro

La 4ª pasada nombró «las píldoras» como el residuo más caro y la tentación era
convertirlas en frases, como `/pendientes`. Se contaron primero, y la respuesta
NO era la esperada: cuatro de seis superficies tienen CERO píldoras y la fila de
`/pacientes` lleva conteos —un filtro que dice cuántos hay informa—. **El
outlier era `/expediente`**: 8 píldoras en 3 filas, 270px del primer pliegue, y
las tres filas haciendo **tres trabajos distintos vestidos igual** (navegar,
filtrar, mostrar datos).

O sea: el defecto nunca fue la cantidad, era **la silueta compartida**. Si no se
cuenta, se convierte en frases un filtro que sirve y se deja intacto el defecto.

- El riel habla ahora el idioma de navegación del producto: barra de acento,
  texto que sube de peso, sin relleno. La barra va debajo porque el riel es
  horizontal; en el FlowRail va al costado — misma gramática, otra orientación.
- Táctil 32 → **44**: como píldora nadie lo miró porque parecía un chip.
- **El corte cae entre ítems** (`scroll-snap`), no tapado con un degradado —que
  habría sido deuda nueva del trinquete y, sobre todo, esconder el defecto en
  vez de quitarlo.
- Medido: **8 en 3 filas (270px) → 4 en 2 (134px)** escritorio · **5 en 2
  (220px) → 1 en 1 (44px)** móvil.
- El guardián del acento de Fase 10 se movió CON el código: su invariante
  —selección = cobalto, y el acento sólo en la selección— se comprueba igual
  sobre la barra. Lo que ya no aplica es el par de contraste
  texto-blanco-sobre-relleno, porque no hay relleno.
- El trinquete cazó de paso un `fontSize: 13` mío fuera de la escala.

### 7ª rebanada (14-ago) — el resumen del paciente deja de ser una fila de KPIs

El segundo de los tres residuos que nombró la 4ª pasada. Su CONTENIDO siempre
fue clínico y específico; su FORMA era la fila de KPIs de cualquier tablero:
tres cajas con borde, encabezado en versalitas y una cifra grande dentro.

Ahora se pinta como lo escribe un médico —«Últimos signos: TA 118/74 · FC 82 ·
T° 36.8», los diagnósticos en su línea, la actividad al final en voz baja— y es
**la misma anatomía del bloque de «Problemas / Toma» que va justo debajo**: dos
bloques vecinos que dicen cosas del mismo orden ya no hablan idiomas distintos.

No se pierde un dato, y lo que falta se sigue diciendo hablando del REGISTRO
(los casos 4 y 5 de RTC-10 lo fijan y siguen en verde). El trinquete de diseño
**bajó solo**: `tamanosFueraDeEscala` 1969 → **1963**, seis tamaños inline
menos, re-sellado con `--actualizar`.

### 5ª pasada de §29 (14-ago) — y el LÍMITE del método

| Pendientes | Hoy | Pacientes | Operaciones | Consulta | Expediente |
|---|---|---|---|---|---|
| 1.0 | 1.5 | 1.5 | 1.5 | 1.5 | **≈1.0–1.5** |

`/expediente` bajó por RTC-18 y por la fila de KPIs convertida en prosa; en la
lectura general ya no se distingue de `/pendientes`. **Y ahí está el problema
con el número**: entre 1.0 y 1.5 este score deja de discriminar. Las
diferencias que quedan son de juicio, no de estructura — dos personas mirando
la misma captura pondrían 1.0 y 1.5 sin que ninguna se equivoque. Y quien
puntúa es quien hizo el trabajo, que es el peor sesgo posible cuando los
márgenes se estrechan.

Por eso la 5ª pasada **no declara PASS** aunque una lectura amable pudiera:

1. La compuerta sigue formalmente en **FAIL** (≤1.0 exige que lleguen TODAS, y
   cuatro están en 1.5 por lecturas mías).
2. **El siguiente juez no puedo ser yo.** §29 nombra un panel de equipo rojo
   precisamente para esto. Lo que falta no es implementar a ciegas: es una
   lectura independiente sobre las capturas de la 5ª pasada.

**Corrección al alcance de mi propia medición de píldoras**: el arnés cuenta
CONTROLES (`button`, `a`). `/pendientes` salió con 0 y eso no significa que no
tenga formas de píldora — su cola de cierre pinta ocho chips de estado por
fila, que son `<span>` no interactivos. La conclusión no cambia; el «0» hay que
leerlo como «cero píldoras PULSABLES».

### RTC-19, mitad de cromo (14-ago) — el teal escrito a mano sale de lo que se ve siempre

`#14b8a6` / `rgba(20,184,166,…)` es teal-500 a mano: no cambia con el tema, no
lo ve ningún token y no lo mide nadie. De los 67 que contó el equipo rojo, los
**dos que importaban** vivían en el cromo persistente —lo que está en pantalla
en todas las rutas, todo el día—: el halo del botón central del pulgar (con un
teal DISTINTO del que usa el propio círculo) y el tinte del panel de ayuda.

- El halo pasa a `var(--elev-2)`: la elevación está medida en los dos temas, y
  el color de la acción ya lo pone el fondo del círculo — no hace falta
  repetirlo en el halo.
- El tinte, a `color-mix` sobre `var(--nexus)`, como el resto de la familia.
- **Trinquete `halosDeColor` 8 → 7**: la deuda no se declara, se retira.
- RTC-05 ya había matado el halo teal del FAB de ayuda por esta misma razón;
  estos dos sobrevivieron por vivir en otros archivos — la forma clásica de
  este repositorio: se arregla lo que se está mirando y la copia de al lado se
  queda.
- **Quedan ~74 fuera del cromo** y NO se barren a ciegas: muchos son colores de
  impresión (documentos de receta), donde un token puede no resolverse.
  Declarado como otra rebanada.

### RTC-17 PAGADA (14-ago) — la pista de ocho etapas deja de informar sólo con color

Tres defectos en la superficie de REFERENCIA del producto —`/pendientes` es la
única que llega al objetivo de §29, y la pista es lo que la hace distinta—:

1. La etapa actual se distinguía **sólo por color**. En gris (impresión,
   monitor mal calibrado, médico daltónico) la pista dejaba de decir dónde está
   el trabajo, que es lo único que existe para decir. Ahora hay un **glifo por
   estado**: `✓` hecha · `●` actual · `○` todavía no · `—` sin dato.
2. El **porqué** de un «sin dato» vivía sólo en el `title=`, que en táctil no
   existe. Ahora entra en el resumen accesible: es la diferencia entre
   «todavía no ha pasado» y «esto no lo registramos».
3. A 390px las ocho píldoras caían en **dos renglones**. Ahora, una línea —
   «Etapa 2 de 8 · sigue: Dueño»— en un `<details>` **nativo** (teclado, foco y
   lectores gratis), cerrado por defecto: ocho etapas desplegadas en una fila
   de worklist serían el defecto otra vez.

El cálculo de las etapas **no se tocó**: esto es cómo se dicen, no qué se dice.
Y una tarea terminal no promete «lo que sigue» — prometerlo sería inventarlo,
la misma regla que hace que tres de las ocho nunca se marquen como hechas.

### RTC-13 PAGADA (14-ago) — la IA se experimenta, no se rotula

Quedó PARCIAL en su día **y sin guardián**, y por eso volvió a crecer. Los que
faltaban, todos en controles que ve el médico:

    «Redactar con IA»          → «Redactar la valoración»
    «Detectar campos con IA»   → «Detectar los campos»
    «Nota con IA (dictado)»    → «Escribir la nota dictando»

Y sus textos de ayuda y de error se renombraron CON ellos: una instrucción que
nombra un botón que ya no se llama así manda al médico a buscar algo que no
existe.

**Lo que NO se toca, con su razón escrita: los créditos.** «Se acabaron tus
créditos con IA del mes» no rotula una función — nombra un límite que el médico
compró y que se le acabó. Quitarle el «IA» dejaría el aviso sin decir QUÉ se
agotó. §25 prohíbe vender la IA como característica, no esconder de qué es la
cuota, y esa distinción es lo que codifica el guardián (que por eso mira
CONTROLES, no todo el árbol).

**Declarado y no pagado**: el icono `Sparkles` sigue en los tres. §25 habla de
texto, y decidir si el destello es «rotular» es un juicio que nadie ha medido.

### Lección de método: `npm run build` NO teclea las pruebas

CI (`verificar`) cazó un `TS1501` en un guardián que yo había dado por bueno:
`npm run build` compila la app pero **no** typechea `src/__tests__`, y yo había
corrido vitest y build, no `npx tsc --noEmit`. La regla del repositorio dice
«tsc cubre lo que vitest no ve»; a partir de aquí, `npx tsc --noEmit` antes de
cada commit, no sólo `npm run build`.

### §39 — RTC-21 se implementó DOS veces el mismo día, y una se tiró (14-ago)

Dos corridas concurrentes del routine tomaron RTC-21 a la vez. La otra
(`fb95630a`) es la que vive; **ésta se descartó entera antes de publicarse**, y
queda escrita porque la razón importa más que el trabajo perdido.

Las dos leyeron el mismo defecto y llegaron a diseños incompatibles:

    ésta      una LISTA con el `para` de cada documento, tras UN gesto
              (`<details>` nativo). Medido: el bloque pasa de 231px a 44px
              en escritorio y de 308 a 83 en el teléfono.
    la otra   los tres controles se quedan a la vista; «FHIR» pasa a
              «Enviar a otro sistema» con la sigla debajo; y una línea que
              dice qué lleva cada archivo ANTES de descargarlo.

**Gana la otra, y no por llegar primero: por haber medido la pregunta correcta.**
Antes de construir nada midió DÓNDE empieza el bloque —820px en escritorio,
1105px en el teléfono, detrás de la historia clínica— y con eso refutó la mitad
del pago que el propio registro pedía: plegar lo que ya está al pie no recupera
pantalla que nadie estuviera peleando, y **cuesta un gesto más por exportación**.
Mi «231px → 44px» medía el alto del bloque, que es una cifra verdadera que no
contesta la pregunta: es la misma familia que el estado ya tenía escrita cuando
la métrica de RTC-10 «mentía en las dos direcciones». Un número correcto sobre lo
que no importa se lee igual que un número bueno.

Y la otra corrida encontró, mirando el exportador **del otro lado**, lo que ésta
copió sin mirar: **REG-313**, dos avisos que se contradecían sobre si las notas
en borrador viajan en el archivo FHIR (viajan). Yo moví esos dos `toast()`
íntegros a una función con nombre y no leí lo que decían. Reordenar un defecto no
lo arregla, y lo deja pareciendo revisado.

Lo único que esta corrida deja en pie es una advertencia para quien vuelva a
tocar un `<summary>`: **`display:flex` mata el marcador nativo del navegador**, y
el bloque se queda plegado sin una sola señal de que haya algo dentro. No se ve
en el fuente —el `<details>` era correcto— y el guardián estaba verde; se vio en
la captura. Si un día se pliega algo aquí, el chevron hay que ponerlo a mano.

**No se cierra**: la compuerta §29 pide ≤1.0 y la 5ª pasada dejó cuatro
superficies en 1.5, **puntuadas por quien hizo el trabajo** — el sesgo que §29
nombra cuando pide un panel.

**Siguiente tarea exacta** (actualizada tras RTC-32, que pagó el tercer y último
residuo de la 4ª pasada): **una lectura independiente** de las capturas, ahora
con las de RTC-32 incluidas (§26/§29). Es lo único que falta para declarar PASS
o FAIL sin ser juez y parte, y ya no hay trabajo estructural nombrado por
delante: los tres residuos están pagados y el único P1 abierto del registro
—RTC-31— quedó cerrado en seis rebanadas. Si la lectura independiente encuentra
más, eso es la cola; si da PASS, §43 orden 17: `V15-WORKFLOW-BENCHMARK-001`.

Trabajo estructural que sigue declarado y con dueño, por si la lectura no llega
antes: **RTC-12(a)** (el lienzo multicolumna — deuda del monolito de 6147
líneas, va con V15-NOTE-PLAN-CONTINUITY / refactor) y la deuda táctil del riel
que dejó anotada RTC-32 (`.nav-item` a 36px, se paga como unidad).


---

## RTC-32 — en el shell no flota nada (14-ago, 5ª corrida)

**El tercero y último de los tres residuos que nombró la 4ª pasada de §29.**
Los otros dos ya estaban pagados (RTC-18 y la fila de KPIs del expediente).

### Medido ANTES de construir, y la medición corrigió el diagnóstico

`scripts/design/medir-cromo-flotante-v15.mjs`, actas en
`docs/design/capturas/v15-cromo-flotante/`:

| | escritorio 1440 | móvil 390 (control) |
|---|---|---|
| superficies con cromo flotante | **6 de 6** | 0 de 6 |
| rellenos de marca en `/consulta` | 2 (`Todo a la nota` + `Abrir ayuda`) | 1 |
| rellenos de marca en `/operaciones` | 1 — **y era la ayuda** | 0 |
| coste de la ayuda | 1 gesto | 1 gesto |

- **REFUTADO: la oclusión.** En escritorio el FAB cae sobre el envoltorio de la
  página, nunca sobre texto clínico. RTC-05 tenía razón cuando declaró el hueco
  («ahí la esquina no ocluye la columna clínica»), y por eso ése **no** es el
  motivo del cambio. Cuarta vez en la fase que medir cambia lo que se iba a
  escribir.
- **CONFIRMADO: el peso.** El FAB se pintaba con `--nexus-solido`, el mismo
  relleno que la acción primaria de la pantalla. Es exactamente el defecto que
  RTC-06 pagó DENTRO del contenido de Hoy — mientras el cromo lo repetía por
  encima de las seis. Y en `/operaciones` lo más enfático de la pantalla era el
  botón de ayuda.
- **El control no había que imaginarlo**: móvil ya estaba en el estado objetivo
  desde RTC-05, con las dos capacidades intactas y al mismo coste.

### El pago

- En el shell **no flota nada**, y la regla del toggle pierde la media query:
  el alcance es el shell, no el ancho. Fuera —login, registro, marketing— el
  toggle sigue flotando, porque allí no hay ni columna clínica ni riel con pie.
- **La ayuda se muda, no se ampu­ta**, y a los DOS roles: pie del riel en
  `FlowRail` (médico) y en `Sidebar` (asistente), más la topbar en móvil. Va
  **fuera del `<nav>`** de los ≤5 contextos: abre un panel, no lleva a un sitio,
  y dentro del nav sería un sexto destino para cualquier vara que cuente hijos.
- Los tres sitios usan `DisparadorAyuda`, que trae dentro el nombre del evento y
  la compuerta `useGrabando` — ningún consumidor teclea la cadena.
- **El panel se abre al lado del riel** (x=236 medido, riel de 224): un panel
  que aparece en la esquina opuesta a lo que se pulsó rompe §20.
- El tema ya tenía casa desde RTC-05 (`/operaciones` → «Apariencia»), y responde
  en los dos anchos: mover no costó construir nada nuevo.

### Medido DESPUÉS

    cromo flotante escritorio     6/6 → 0/6
    rellenos de marca escritorio  coinciden EXACTAMENTE con los de móvil
                                  en las seis superficies (era el control)
    ayuda                         1 gesto en los dos anchos, panel pegado al riel
    móvil                         sin cambio (0 regresiones)
    consola                       0 errores

**Muere la familia entera de parches de convivencia**, no se le añade otro: los
bottoms 78/92/120/136, el arbitraje con el aviso de push (el FAB tapaba su X) y
el apartado al enfocar un campo *dentro* del shell. Todos existían para negociar
con algo que ya no está. El trinquete de diseño **bajó solo**: `sombrasEnLinea`
22 → 21 (la sombra en línea del FAB), re-sellado con `--actualizar`.

### Cinco guardianes ajustados con intención — ninguno silenciado

La suite dio 9 rojos y **todos eran guardianes cuyo sujeto había muerto**:
oclusión de campo, push opt-in, contraste de /chat, «una voz por elemento» y el
propio RTC-05. Ninguno se borró y ninguno se relajó: cada uno pasa a exigir **la
condición que hace imposible la colisión** en vez del apaño que la sorteaba, con
el porqué escrito dentro. El precedente es el de RTC-31 (5ª rebanada): un
guardián que se borra porque su código se movió deja de proteger justo cuando el
código es más frágil.

El de RTC-05 lleva además el aviso de que su «qué NO cubre» —el hueco del
escritorio— ya está cerrado, porque ese texto fue durante un día la única razón
por la que nadie miraba ahí.

### Compuertas

- Guardián nuevo `v15-rtc32-en-el-shell-nada-flota.test.ts` (7 casos). **Al
  revés**: los 7 fallan contra el árbol previo; y dos reversiones quirúrgicas
  sobre el árbol nuevo — devolverle la media query a la regla del toggle rompe
  *sólo* el caso 2, y meter el disparador DENTRO del `<nav>` rompe el 4 (sexto
  destino) y el 3 (sale del pie): las dos quejas son ciertas y se dejan las dos.
- `npx tsc --noEmit` limpio · `npx vitest run` **9433/9433 en 669 archivos, cero
  fallos** (incluso el ambiental `ops-timeout-y-punto-ciego` pasó en este
  contenedor) · lint 96 = techo · trinquete de diseño sin deuda nueva y con un
  techo bajado · `npm run build` compila.
- Navegador real (§40) antes y después, 1440 + 390, con `capturar-pulgar-y-fabs`
  re-corrido en verde tras invertirle la mitad de escritorio con su porqué.

### Defecto del instrumento, cazado por él mismo

La pasada «antes» informó **«ayuda inalcanzable en escritorio»** con el FAB ahí a
la vista: el localizador cogía el primer `[aria-label="Abrir ayuda"]` del DOM, que
en escritorio es el de la topbar —presente pero oculto por CSS—. Corregido a
`:visible` en los dos arneses (el mío y el de RTC-05/07, que tenía el mismo
patrón), y anotado: décimo defecto de instrumento cazado midiendo en esta fase.

### Declarado y NO pagado

El disparador del riel mide **207×36px**, por debajo del mínimo táctil de §24.
Usa `.nav-item`, que es la geometría de **todos** los destinos del riel,
«Cerrar sesión» incluido. Si 36 es deuda, es deuda **del riel entero** y se paga
como unidad: subir sólo éste haría la ayuda más prominente que los destinos
clínicos, que es lo contrario de esta rebanada. El de móvil mide 44×44.

[Histórico — ejecutado 13-ago-2026: (1) unificación → registro canónico;
(2) RT-08 → REG-312; (3) RT-01 → contadores de genericidad; (4) RTC-04 →
compuerta compartida + pila de avisos; (5) RTC-06 → una primaria clínica
en Hoy; (6) 3ª corrida: RTC-07 + RTC-05 → el pulgar es clínico y los FAB
se aquietan; (7) 14-ago, 4ª corrida: RTC-09 + RTC-11 → la IA vive en el
paciente y la identidad cabe en el teléfono.]

Iteración anterior:
`V15-PERF-001` (§43 orden 15, §30) — **CERRADA 13-ago-2026** tras CINCO
rebanadas: (1ª) arnés del presupuesto de percepción; (2ª) el opt-in de push
fuera de la cadena clínica — el LCP pasó a ser la IDENTIDAD del paciente en
toda la cadena; (3ª) seis paneles condicionales a dynamic() (734→691 KB);
(4ª) el pipeline de dictado carga al DICTAR (691→686 KB), verificado con
micrófono sintético; (5ª) **el excedente restante quedó NOMBRADO con
marcadores de runtime y declarado ESTRUCTURAL del monolito** — la hipótesis
«103 KB de maquinaria de grabación eager» quedó REFUTADA (el hook real pesa
19 KB; los 103 KB son medical-vocabulary + medical-dictionary, el corpus que
las validaciones de seguridad EN RENDER —alergia×medicamento, PROA—
necesitan y que no se difiere sin arriesgar el CUÁNDO de un aviso clínico).
Serie de long tasks móviles de /consulta: 591→867 con los cortes pagados; lo
restante es la hidratación del monolito de 6147 líneas (deuda dimensionada
del refactor del monolito / V15-NOTE-PLAN-CONTINUITY, no de PERF). Acta:
`docs/design/capturas/v15-perf/atribucion-consulta-final.json` + guardián
`v15-perf-atribucion-marcadores-runtime.test.ts` (9 casos, probado al revés
×3). Ver sección al FINAL.

La 4ª rebanada había sido (13-ago-2026): el veredicto de varianza que
pidió la 3ª — dos muestras más del baseline vivo (951 y 964 ms de long tasks
móviles en /consulta; serie completa 591/766/940/964/951 — SOSTENIDAS sobre
el umbral de 500) — y el corte pactado para ese caso: **la maquinaria de
dictado carga cuando se dicta, no cuando se abre la pantalla**. El pipeline
de voz (`@/lib/asr/pipeline`: léxico, normalización, corrector vigilado,
guardián, siglas) salió del JS inicial de /consulta a import dinámico en los
DOS hooks de grabación, con precalentado en `iniciar()` (audio) y espera
antes de `rec.start()` (voz, cuyo onresult es síncrono). Verificado en
navegador real con un MICRÓFONO SINTÉTICO de Web Audio (los flags de fake
device de Chrome no materializan dispositivo alguno en este contenedor):
la grabación ARRANCA, el chunk del pipeline llega AL PULSAR grabar, y el
marcador del guardián no viaja en la carga inicial. Ver sección al FINAL.
Las tres primeras rebanadas: (1ª) **el arnés del presupuesto de percepción EXISTE**
(`scripts/design/medir-perf-v15.mjs`: TTFB/FCP/LCP con IDENTIDAD del
elemento LCP, cascada de hitos por MutationObserver, tráfico
Firestore/Auth por resource timing, peso REAL transferido sin service
worker, long tasks y DOM — por las 5 rutas de la cadena clínica ×
escritorio 1×/móvil CPU 4×, contra build de producción + emuladores +
siembra sintética); (2ª) **el opt-in de push deja de asaltar la cadena
clínica** — el baseline midió que la tarjeta de recordatorios era el LCP de
las DIEZ mediciones (cronómetro fijo de 3 s armado en el layout, pintando
sobre CUALQUIER pantalla de la primera sesión, consulta incluida — §8 manda
que ahí lo administrativo desaparezca): ahora sólo se pinta en HOY
(`usePathname` leído al RENDER, no al armar; el programador de avisos
conserva su semántica exacta en toda ruta). Después del arreglo el LCP de la
cadena ES el contenido clínico — el NOMBRE del paciente (.nx-ident /
.nx-ancla-nombre / .nx-vt-paciente): escritorio 3264→300 ms (/pacientes),
3512→548 (expediente), 3448→624 (consulta), 3268→272 (/pendientes). Queda:
/consulta con +240 KB de JS sobre sus hermanas y las long tasks móviles más
altas (591–766 ms). Ver sección al FINAL.

Iteración anterior:
`V15-MOTION-001` (§43 orden 14, §18 paso 8 / §20) — **CERRADA 13-ago-2026**
tras CINCO rebanadas: tokens de movimiento en hoja e inline (28 transiciones
TSX migradas, 2 medidores declarados INSTRUMENTO), cascada una-voz, apagador
§24 con dos candados, y las DOS cadenas de §20 coreografiadas con
`document.startViewTransition` NATIVO y medidas 22/22 en navegador real
(Hoy→Paciente→Encuentro y Result queue→Patient result, con la franja
persistente cediendo el nombre y /pacientes entrando a la cadena). Ver sus
secciones al FINAL.

Iteración anterior:
`V15-A11Y-001` (§43 orden 13, §24) — **CERRADA 13-ago-2026** tras SEIS
rebanadas de código y una séptima entrega de cierre: DEBT-008
(`.receta-sheet`) quedó **documentado con cifras y CONSULTADO al dueño**
(el default `#14b8a6` del acento del papel mide 2.49:1; la opción segura
—default `#0f766e`/`#12626e` + unificar el default de Word `#2845EA`— está
escrita en la sección al FINAL; un color guardado por un médico nunca se
toca). Única deuda restante de la iteración, bloqueada en decisión de
plantilla del dueño, no en código. Seis superficies miden axe 0 TOTAL.
— Empezó así: **EN CURSO** desde 12-ago-2026, con su
inventario de deuda medido y SEIS rebanadas pagadas: **avisos del shell en
landmark** (`role="status"` para TrialBanner/ModeBanner/OfflineBanner — el
hallazgo `region` más repetido de la rama muere; /dashboard mide 0 por
primera vez), **el formulario de /referencia tiene nombre** (la única deuda
CRÍTICA: `label` ×3 + `select-name` ×2 → 9/9 controles con su pareja
htmlFor/id; /referencia mide 0), **las filas de /pacientes ya no anidan
controles** (`nested-interactive` ×5, la familia del botón Editar, muere con
el patrón de acción extendida `.nx-fila-abrir`; /pacientes mide 0 en oscuro,
claro y móvil — y la etiqueta «color-contrast Editar» del inventario quedó
cerrada como conflación, con cifras), **los contrastes de /chat hablan
tokens por tema y los widgets flotantes ceden** (axe 0 en las cuatro
mediciones; el gesto Enviar-sin-foco medido de punta a punta), **el lienzo
de /consulta tiene un esquema de encabezados honesto** (h1 → h2 → h3 en
cualquier combinación de render; `heading-order` 0 y **axe 0 TOTAL** en la
consulta poblada — oscuro, claro y móvil —, y el contraste teal de evidencia
anotado a 3.03:1 quedó confirmado MUERTO por la Fase 10: computa 5.9/6.13) y
**los dos táctiles chicos que eran ENLACES** (el bloque
`pointer: coarse` nunca cubrió `<a>`: el enlace de paciente de /pendientes
—156×20— y el CTA del TrialBanner —100×24— ganan área de golpe ≥44px con un
pseudo estirado, MEDIDA por hit-testing y ENTREGADA con tap real; el
escritorio no se estira ni un píxel).
Resta sólo: DEBT-008 (`.receta-sheet`, decisión de diseño de
plantilla pendiente — carga una decisión del dueño). Ver secciones al FINAL.

Iteración anterior:
`V15-REMAINING-SCREENS-001` (§43 orden 12, §32) — **CERRADA** (barrido de
CROMO §32 completo en cinco rebanadas; el CONTENIDO de las 16 pestañas de
/configuracion queda como deuda declarada). — Empezó así:
12-ago-2026. El inventario de superficies Practice no tocadas por las fases
estructurales quedó medido por grep (tabla en su sección) y van cinco
rebanadas pagadas: **/nota** (una primaria §16, modal de adenda accesible,
papel intacto), **/receta** (17/17 campos con nombre accesible; el `#b91c1c`
fijo de la alerta de DOSIS murió; primaria PRIMERO), **/orden — la familia
documental queda completa** (una sola primaria en la página, campos y chips
con nombre accesible, el Check `#000` sobre teal pagado con `--nexus-solido`
+ blanco), **/login + /registro — la puerta de entrada habla el sistema**
(la CTA de /registro pintaba `#000` sobre `var(--teal)` — 2.99:1 en claro,
el MISMO defecto por tercera vez — ahora es `btn-primary` medida por tema;
el formulario de /registro dejó su dialecto inline por
`.form-group/.label/.input` y GANÓ anillo de foco real; el aviso de
restablecer de /login cambia de tema de verdad; táctiles 44/48; `<main>`
landmark en las dos; alta REAL → /setup y login REAL → /dashboard con clic,
contra emulador) y **/configuracion + /operaciones — la familia de
Operaciones habla el sistema** (el riel de secciones deja su dialecto por
`.nav-item`/`.active` + `aria-current`; el ÍNDIGO VIEJO `rgba(61,90,254,…)`
murió en los 20 sitios de la familia con `color-mix` sobre `var(--nexus)`;
el `<select>` móvil y el `<nav>` ganaron nombre accesible; el horario
semanal pagó sus 17 campos sin nombre — axe `label` ×17 → 0; roles §2 en
/operaciones con `t-h1`/`t-overline`/`t-body` y táctiles 44). El barrido
§32 del CROMO queda cerrado; el CONTENIDO de las 16 pestañas de
/configuracion (≈150 `fontSize` inline restantes) queda anotado como deuda
de rebanadas futuras si el programa lo prioriza. Ver sección al FINAL de
este archivo.

Iteración anterior:
`V15-VISUAL-SYSTEM-001` (Fase 10, §18/§33) — **CERRADA 12-ago-2026** tras
nueve rebanadas. La novena declaró el paso 7 de §18 COMPLETO (el inventario
de §2 quedó vacío en la octava y ninguna superficie nueva apareció), midió
los pasos 8-9 (motion/polish) contra el código real Y el navegador real,
pagó el único defecto de conducta encontrado — el scroll programático de
JavaScript ignoraba `prefers-reduced-motion` en 5 de 6 sitios, porque
`scrollIntoView({behavior})` no lee el apagador CSS de §24 — y dejó POR
ESCRITO qué se difiere a `V15-MOTION-001` y por qué (tabla en la sección al
FINAL). Siguiente iteración: `V15-REMAINING-SCREENS-001` (§43 orden 12).
Octava rebanada previa
entregada 12-ago-2026: «la identidad de la franja tiene una voz, y el
inventario de §2 queda VACÍO» — las candidatas (a) y (b) que dejó nombradas
la séptima, pagadas juntas porque el arnés (emuladores + build + navegador)
se paga una vez por corrida. (a) La decisión de diseño de InstrumentStrip:
`.nx-ident-franja` nace en `globals.css` — la identidad de la franja tiene
UNA voz (14/600/`var(--text)`, escala oficial) y la porta el paciente cuando
hay paciente en la ruta (§5: «current patient» es el PRIMER estado
periférico), el consultorio cuando no; antes el paciente era cromo de
12/`--text2` CON ellipsis mientras el respaldo pintaba 16 — la franja
hablaba más fuerte enseñando lo menos importante. En la topbar móvil el
nombre envuelve hasta 2 líneas (`--clamp`, excepción a §24 DECLARADA con su
razón en la hoja) dentro de un objetivo táctil de 44px medidos; el timer de
grabación lleva `nx-num` (tabular) en las dos variantes. (b) El barrido
final: conteos de ClinicalSpine a `nx-num`, tarjetas de duplicados de
/pacientes a `.nx-ident`/`.nx-meta`, detalle y «+N más» de PanelPendientes a
`.nx-meta`. Guardián `v15-roles-tipograficos-en-franja-y-barrido.test.ts`
(15 casos, 13 fallan al revés — verificado con `git stash`). Medido en
navegador real (`capturar-roles-franja-v15.mjs`): enlace 14/600 por tema con
subrayado, `identidadDominaCromo: true`, clic real desde /referencia (la
pantalla sin otro rastro del paciente) aterriza en el expediente, timer y
conteos `tabular-nums`, móvil sin desborde con táctil de 44px exactos, axe
móvil 0. Trinquete de diseño BAJADO: `tamanosFueraDeEscala` 1995→1988.
Hallazgo preexistente anotado a `V15-A11Y-001`: /referencia trae su
formulario sin etiquetas (`label` ×3 crítico, `select-name` ×2 — primera
medición axe de esa pantalla; el cambio de la franja no aporta nodos). Con
(a) y (b) pagadas, **el inventario de §2 está VACÍO**: la siguiente corrida
declara el paso 7 de §18 COMPLETO (ver siguiente tarea al FINAL). Séptima
rebanada previa 12-ago-2026: «el inventario de §2 se corrió — NO salió vacío — y
Hoy (NOW + TODAY) habla los roles» — la candidata (b) que dejó nombrada la
quinta rebanada y confirmó la sexta. El inventario por grep de TODAS las
superficies del shell V15 encontró que la pantalla MÁS usada del producto
seguía en dialecto propio con los dos defectos de la familia a la vez:
`ProxHero` (NOW) truncaba el nombre del paciente con ellipsis a 16px inline,
y en `AppointmentRow` (TODAY) la HORA pesaba 700 contra el nombre a 500 —
R3 invertida en la entrada más leída de la mañana. Pagado: identidad
`span.nx-ident` que ENVUELVE en las dos zonas (§24), hora en
`.riel-hora`/`.riel-dur` (el idioma del riel de /citas — 14/600 tabular),
metadato en `.nx-meta`. Guardián
`v15-roles-tipograficos-en-hoy.test.ts` (13 casos, 9 fallan al revés —
verificado con `git stash`). Medido en navegador real
(`capturar-roles-hoy-v15.mjs`): identidad 15.5/600 por tema en héroe y fila,
`nombreDominaSobreHora: true`, el nombre largo sembrado envuelve a 2 líneas
en 390px sin desborde (`anchoDocumento: 390`), clic real de fila aterriza en
`/citas?id=cita-hoy-0900` y del CTA del héroe en `/consulta/...` — y **axe:
0 violaciones en oscuro, claro Y móvil** (0 errores de consola). El
inventario deja nombradas las superficies restantes de §2 (ver siguiente
tarea al FINAL). Trinquete de diseño BAJADO de verdad:
`tamanosFueraDeEscala` 1997→1995, resellado a la baja. Sexta rebanada previa
12-ago-2026: «el TrialBanner habla tokens por tema, y el hallazgo
axe recurrente de la fase muere» — la candidata (a) que dejó nombrada la
quinta rebanada. El defecto visual MÁS medido de la rama (la violación
`color-contrast` que apareció con fingerprint idéntico en las rebanadas 2,
3, 4 y 5) se pagó completo: el banner de prueba pintaba `#f59e0b`/`#f87171`
/`#000` a mano — colores de fondo oscuro, 2.2:1 sobre el crema del claro.
Arreglo en tres partes medidas con la fórmula de luminancia WCAG (no
adivinadas): mensaje en `var(--text)` (el ámbar COMO TEXTO falla en claro
incluso con token: #B45309 sobre el tinte ≈4.3:1), icono en
`var(--red)`/`var(--amber)` (no-textual, 3:1, pasa en los dos temas), y CTA
de relleno sólido con token NUEVO `--sobre-aviso` (tinta #0B0C0E sobre el
ámbar oscuro, blanco sobre el ámbar profundo del claro; definido en los
cuatro bloques de tema de `globals.css`, papel incluido). Y el arnés de esta
misma rebanada — que guarda el failureSummary COMPLETO de axe, a diferencia
del recorte que dejó un nodo sin identificar en la cuarta — descubrió que el
«segundo nodo» de /pacientes NUNCA fue el CTA del banner: era el chip activo
del directorio («Recientes (5)») con `#000` sobre `var(--teal)` (2.99:1 en
claro — el token de TRAZO usado como fondo). Pagado en la misma corrida con
el par que ya existía medido: `--nexus-solido` + blanco (el de
`.btn-primary`). Trinquete de COLOR bajado de verdad: `TECHO_CRUDOS`
265→256 (los 7 hex del banner), `hexEnLinea` del trinquete de diseño
508→501, resellados a la baja. Guardián
`v15-trial-banner-tokens-por-tema.test.ts` (8 casos, 6+1 fallan al revés —
verificado con `git stash` por separado para el banner y para el chip).
Axe medido en navegador real tras el arreglo: **0 `color-contrast` en
claro, oscuro y móvil** — la única violación restante es `nested-interactive`
×5, la familia PREEXISTENTE del botón Editar ya anotada a `V15-A11Y-001`
(su presencia además confirma que las filas SÍ se pintaron: no se midió una
página rota). Ver sección al FINAL. Quinta rebanada previa
12-ago-2026: «el Patient Anchor habla los roles de §2 y su
identidad es nivel display» — la superficie que el inventario de la cuarta
rebanada dejó nombrada. El `<h1>` del ancla era `fontSize: 16/700` grotesca
(tamaño de fila) en la ÚNICA pantalla donde VISUAL_DNA §1 R3 reserva la
serif display («nombre del paciente en su espacio clínico»): ahora es
`nx-display nx-ancla-nombre` (Fraunces 20/600, envuelve, clase nueva en
`globals.css` con la razón escrita); edad·sexo·teléfono y «Último cambio»
son `.nx-meta`; y la alergia REGISTRADA es `span.nx-critico` — peso + icono
al lado, nunca sólo color — mientras «no registradas» se queda neutra (dato
del registro, no valor crítico). `.nx-critico` gana `flex-wrap: wrap`: una
alergia larga ENVUELVE en vez de truncarse (§24). Guardián
`v15-roles-tipograficos-en-patient-anchor.test.ts` (13 casos, 11 fallan al
revés). Medido con `getComputedStyle` + scroll real (sticky sobrevive) + axe
en los dos temas y en móvil (ver sección al FINAL). Cuarta rebanada previa
12-ago-2026: «las filas de /pacientes hablan los mismos roles» — el
directorio de pacientes era la única superficie estructurada donde la
identidad seguía siendo un fontSize 14 inline CON ellipsis (la identidad se
truncaba, §24): ahora `span.nx-ident` encabeza cada fila (span, NO enlace:
la fila entera es `role="button"` vía activable — nested-interactive), el
metadato es `.nx-meta`, y el nombre largo sembrado ENVUELVE (3 líneas en
390px, sin desborde). Medido con `getComputedStyle` + clic real que aterriza
en el expediente + axe en los dos temas y en móvil (ver sección al FINAL).
Dos hallazgos preexistentes anotados a `V15-A11Y-001`: `nested-interactive`
(el botón Editar DENTRO de la fila role="button", 5 nodos, primera medición
axe de /pacientes) y `color-contrast` claro (TrialBanner: span #f59e0b + su
botón — la familia ya conocida, aquí 2 nodos). Tercera rebanada previa
12-ago-2026: «ContinuidadPanel habla los mismos roles» — la zona
CONTINUITY de /dashboard («Sigue abierto de antes») muestra la MISMA entidad
que /pendientes (TareaClinica) y ahora habla el mismo idioma tipográfico: la
identidad del paciente encabeza cada fila como `span.nx-ident` (span, NO
enlace anidado: la fila entera ya navega al expediente — nested-interactive),
el tipo es `.nx-estado`, el escalamiento es `.nx-critico` CON icono, y el pie
«+N más» es `.nx-meta`. Medido con `getComputedStyle` + clic real que
aterriza en el expediente + axe en los dos temas y en móvil (ver sección al
FINAL). Segunda rebanada previa
12-ago-2026: «los roles tipográficos de §2 existen como clases y
/pendientes los habla» — `.nx-ident`/`.nx-meta`/`.nx-critico` nacen en
`globals.css` (los otros dos roles ya existían) y la cola de cierre de Fase 7
los usa: la identidad del paciente ENCABEZA cada entrada (R3) en vez de vivir
enterrada como enlace teal de 13px en el metadato, medido con
`getComputedStyle` + navegación real + axe en los dos temas y en móvil (ver
sección al FINAL). Primera rebanada previa
12-ago-2026: «el acento entra al shell» — los tres puntos de acento
que las fases estructurales dejaron explícitamente diferidos a Fase 10
(FlowRail activo, ClinicalSpine seleccionado, indicador «Grabando» del
InstrumentStrip) pasaron del neutro greybox al cobalto semántico de
VISUAL_DNA §3, medidos con `getComputedStyle` en navegador real en los DOS
temas (ver sección al FINAL de este archivo). Nota de lectura previa: la
«ley Cantera + Instrument» que nombra §33 del master loop NO está definida
en ningún documento del repo (verificado por grep en `docs/` y `src/`) — la
ley operativa escrita es `docs/design/NEXUSMED_VISUAL_DNA.md` (los tokens se
quedan, la gramática de composición es la firma) y esta fase se ejecuta
contra ELLA; si el dueño tiene una especificación Cantera/Instrument aparte,
falta instalarla en el repo.
`V15-MOBILE-001` (Fase 9, §22/§23/§24) — **CERRADA 12-ago-2026** tras siete
rebanadas: los trabajos §22 quedaron medidos contra pantallas reales en dos
radiografías (390×844) y sus defectos pagados (rebanadas 1–6); la séptima
midió el modelo responsivo §23 en OCHO anchos (390/767/768/769/834/1024/
1280/1440), encontró el único defecto estructural del rango intermedio —
**en 768px exacto convivían los dos shells** — lo arregló, y dejó §23
documentado por breakpoint en
`docs/design/v15/MOBILE-001-modelo-responsivo.md` (ver sección al FINAL).
Los pendientes anotados de la fase (táctiles chicos preexistentes, familia
`region`, contrastes de /chat, colisiones de widgets flotantes) viven en la
lista de `V15-A11Y-001` — no bloquean el cierre: son deuda de accesibilidad
declarada, no estructura móvil. Sexta rebanada previa
12-ago-2026: «el chat cabe en el shell» — la radiografía 2
(`medir-trabajos-moviles-2-v15.mjs`) midió los tres trabajos §22 restantes:
/nota sana en 390px, /pendientes con acciones ≥44px al pulgar, y /chat con el
composer ENTERRADO bajo el BottomNav (bottom 889 en viewport de 844 — la
página restaba 52px a 100vh por su cuenta, suposición anterior al shell).
Arreglo: pantalla-LIENZO (`nx-lienzo-completo` + cadena
main → .page-transition en la HOJA con `:has`) + §24 en el composer + los
104px de aire muerto del claro legacy neutralizados bajo el lienzo. Medido de
punta a punta en navegador real: composer pegado a la barra, tap en Enviar y
el mensaje LLEGA a la lista (ida y vuelta por el emulador). Ver sección al
FINAL de este archivo. Quinta rebanada previa
12-ago-2026: «el aviso push ya no tapa el pulgar» — `NotificacionesPushOptIn`
deja de ser `fixed bottom:16 z-1000` SOBRE el BottomNav (se comió el tap de
dos arneses) y pasa a hoja anclada ENCIMA de la barra en ≤768px, con su
posición en la HOJA (lección nx-stat-grid), z-index 44 < 45 (si vuelven a
solaparse gana la navegación), objetivos táctiles de 44px, landmark con
nombre y el FAB de ayuda cediendo el paso mientras pregunta. Medido en
navegador real: tap en «Seguimiento» LLEGA a /pendientes con el aviso
abierto. Ver sección al FINAL de este archivo. Cuarta rebanada previa
12-ago-2026: «firmar/cerrar desde el teléfono» — `CierreAlPulgar` (barra
pegada al borde inferior de /consulta que acerca el cierre al pulgar SIN
firmar por su cuenta) + **el arreglo estructural que destapó su arnés**:
el shell del dashboard no tenía tope de altura, `<main>` nunca desplazaba
y TODO el sistema sticky del producto estaba mudo (BottomNav a 2,321px
del borde en /consulta) — `nx-app-shell` lo arregla de raíz. Tercera
rebanada (12-ago-2026): shell móvil consolidado — la franja de
instrumentos ES el centro de la topbar en móvil (una fila, «Ausculta» una
vez, enlace de paciente 44px táctiles, shell fijo 135→105px) + pistas de
teclado de la paleta ocultas en el teléfono. Segunda rebanada
(12-ago-2026): cajón lateral retirado en modo médico + topbar con Buscar
+ Cerrar sesión en /operaciones. Primera rebanada (12-ago-2026):
`BottomNav` recompuesto a la IA de V15. Ver secciones al FINAL de este
archivo.
`V15-NOTE-PLAN-CONTINUITY-001` (Fase 8) — **CERRADA 12-ago-2026** por
decisión de alcance: la integración por continuidad ES la forma final de
Fase 8 (ver «Fase 8 — decisión de cierre» abajo). Quinta rebanada previa
(11-ago-2026): el cierre agenda el seguimiento y REG-310 sellado. `V15-FOLLOWUP-WORK-001` (Fase 7, §10) — **CERRADA 11-ago-2026**
tras dos rebanadas: primera, `/pendientes` agrupa lo no urgente por
`estadoDeAccion` (necesita revisión · esperando resultado · necesita
agendar · esperando al paciente · otros); segunda, «closed recently» bajo
demanda (`tareasCerradasRecientes()` + botón «Ver cerrados recientemente»,
sólo lectura). Ver secciones propias abajo. `V15-RESULTS-CLOSURE-001`
(Fase 6, §9) — **CERRADA 11-ago-2026** tras
medir los 8 comportamientos de §9 contra el código actual (tabla en su
propia sección) y decidir diferir la extensión de modelo (campo de cierre
decisión/acción/aviso al paciente) a fase futura, con razón escrita — mismo
criterio de cierre que ya usó `V15-ENCOUNTER-MODE-001` con sus 9
comportamientos de §8. `V15-ENCOUNTER-MODE-001` (Fase 5) — CERRADA
11-ago-2026 (cuarta y última rebanada: el Copiloto se pinta junto a los
hechos que interpreta, §8 comportamiento #8). `V15-PATIENT-WORKSPACE-001`
(Fase 4) — CERRADA 11-ago-2026 (ver secciones abajo). `V15-TODAY-001`
(Fase 3), `V15-IA-001` y `V15-SHELL-GREYBOX-001` — cerradas antes, misma
fecha.

### V15-IA-001 — CERRADA

- Sitemap nuevo, mapa de capacidades contextuales (dónde quedó cada uno de
  los 23 destinos del `Sidebar` de médico) y plan de compatibilidad de rutas:
  `docs/design/v15/IA-001-sitemap.md`.
- Los cinco contextos fijados por el routine: **TODAY · PATIENT · ENCOUNTER ·
  WORK/FOLLOW-UP · SEARCH/COMMAND**. Ninguna URL existente cambió; sólo cambió
  desde dónde se llega a ella.

### V15-SHELL-GREYBOX-001 — CERRADA (Instrument Strip + Flow Rail + Canvas + operaciones)

- **`src/components/FlowRail.tsx`** — reemplaza `Sidebar` (23 destinos) por 5
  contextos, **sólo en modo médico** (`esMedicoReal && mode === 'medico'`;
  Secretaria sigue con `Sidebar` sin cambio — fuera de alcance de esta fase).
  Greybox real, no sólo revisado así: el estado activo usa `var(--text)`, no
  `var(--nexus)` (clase `.nx-flow-rail` en `globals.css`).
- **`src/components/InstrumentStrip.tsx`** — Capa 1 (peor periférica):
  consultorio + grabación activa con duración, releyendo el mismo
  `EVENTO_GRABANDO` que ya usa `MarcoEscuchando` (no es una segunda fuente de
  verdad). Paciente actual queda para `V15-PATIENT-WORKSPACE-001` (Fase 4) —
  anotado, no rellenado con un placeholder.
- **`src/app/(dashboard)/operaciones/page.tsx`** — índice agrupado de los 18
  destinos que salieron del rail primario (Agenda · Clínico · Negocio ·
  Cumplimiento y documentos · Comunicación · Sistema), filtrado por
  `rutaPermitida` (mismo entitlement que ya regía `Sidebar`).
- Cableado en `src/app/(dashboard)/layout.tsx` (desktop + cajón móvil), con
  guardián que se probó al revés:
  `src/__tests__/v15-flow-rail-cableado.test.ts` — falla si `layout.tsx`
  vuelve a `Sidebar` fijo, y falla si algún `href` de los 23 antiguos se
  queda sin ruta de entrada nueva (FlowRail u Operaciones).
- De paso: la topbar móvil decía «Agenda Médica» mientras el resto de la app
  ya dice «Ausculta» (hallazgo anotado en la corrida de baseline) — corregido
  en el mismo archivo que ya se estaba tocando.

### Verificado en navegador real (11-ago-2026)

Build de producción + emuladores Auth/Firestore + siembra sintética
(`scripts/design/sembrar-capturas.mjs`), igual método que V10-TRUTH-001.
Arnés nuevo: `scripts/design/capturar-flow-rail-v15.mjs`. Capturas en
`docs/design/capturas/v15-shell-greybox/` (desktop 1440 + mobile 390):

- `flow-rail-destinos.json` — el DOM real confirma exactamente 5 destinos:
  Hoy · Paciente · Encuentro · Seguimiento · Operaciones, en las 4 pantallas
  probadas (`/dashboard`, `/pacientes`, `/pendientes`, `/operaciones`).
- `axe.json` — 0 violaciones nuevas. La única violación (`nested-interactive`
  en `/pacientes`, 5 nodos) es **preexistente**: mismo fingerprint exacto que
  `docs/design/capturas/v15-baseline-before/axe-baseline.json`, no la causó
  este cambio.
- Consola: un único warning transitorio de reconexión de Firestore del
  emulador, igual que en la captura de baseline — no es una regresión.
- Móvil sin cambio de comportamiento (`BottomNav` no se tocó esta corrida).

### Compuertas

- `npx vitest run`: 8662 pasan, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (los 6
  `fontSize`/1 `borderRadius` fuera de escala que introdujeron los componentes
  nuevos se corrigieron a la escala oficial, no se subió el techo).
- `npm run build`: TypeScript compila limpio. Con `.env.local` demo
  (emuladores) el build completo también compila — `/operaciones` sale como
  ruta estática (`○`) en la salida de Next.
- Guardianes de integridad tocados de paso porque el cambio los movía de
  verdad, no accidentalmente: `el-inventario-de-pantallas-no-miente`
  (regenerado — 80 pantallas, +1 `/operaciones`) y `csp-guard` (`/operaciones`
  añadida a `src/lib/security/rutas-privadas.ts`: zona autenticada, hereda
  cabecera anti-clickjacking igual que cualquier pantalla del dashboard).

### V15-TODAY-001 — CERRADA (zona CONTINUITY añadida a `/dashboard`)

- `/dashboard` ya tenía NOW (`ProxHero`) · NEEDS ATTENTION (`PanelPendientes`)
  · TODAY (sección «Agenda de hoy») desde V10-HOME-001. Esta corrida añadió la
  cuarta zona que faltaba de las cinco de §6:
  **`src/components/ContinuidadPanel.tsx`** — CONTINUITY: lo que cruzó de una
  consulta anterior y sigue sin cerrarse (resultado por revisar, seguimiento,
  reconciliación de medicamento). Lee `tareasVivas()` de
  `src/lib/tareas-clinicas/firestore.ts` — la MISMA fuente que ya usa
  `/pendientes`, no una copia (invariante «una entidad, una fuente de
  verdad» de la carta operativa). Vista previa de 5, ordenada por
  `ordenWorklist`, con «Ver todo» hacia `/pendientes`. Se pinta sola y
  desaparece sola cuando no hay nada abierto — no es un bloque fijo con
  estado vacío.
- **PREPARED BY NEXUS queda deliberadamente sin construir.** No existe hook
  que lea «contexto preparado para el próximo paciente» (mismo hallazgo que
  ya declaró `InstrumentStrip` para «paciente actual»). Se documenta en la
  cabecera de `dashboard/page.tsx` en vez de rellenarse con un placeholder —
  le corresponde a `V15-PATIENT-WORKSPACE-001` decidir qué significa
  «paciente actual» antes de que Nexus pueda preparar algo sobre él.
- Guardián nuevo, probado al revés (igual patrón que
  `v15-flow-rail-cableado.test.ts`):
  `src/__tests__/v15-continuidad-en-hoy.test.ts` — falla si
  `ContinuidadPanel` se escribe y no se importa/renderiza en
  `dashboard/page.tsx`, y falla si el panel abriera su propia consulta a
  `tareas_clinicas` en vez de reusar `tareasVivas()` (duplicaría la fuente de
  verdad). `la-pantalla-de-hoy-no-es-un-tablero.test.ts` (V10) sigue vigente
  sin tocarse: el orden que ya probaba (`ProxHero` → `PanelPendientes` →
  «Agenda de hoy») no cambió, sólo se añadió una zona después.
- `scripts/design/sembrar-capturas.mjs` ahora siembra 3 `tareas_clinicas`
  sintéticas (urocultivo vencido sin dueño, seguimiento de EPOC, reconciliación
  crítica de metformina) — sin esto el arnés de capturas no tenía nada que
  mostrar en la zona nueva.

### Verificado en navegador real (11-ago-2026)

Mismo método que V15-SHELL-GREYBOX-001: emuladores Auth/Firestore + build de
producción + `npm start` contra los emuladores + siembra sintética. Arnés
nuevo: `scripts/design/capturar-today-continuidad-v15.mjs`. Capturas en
`docs/design/capturas/v15-today-continuidad/` (desktop 1440 + mobile 390):

- Las 4 zonas presentes hoy se confirman en el DOM real: NOW (`Próxima cita`
  — condicional, no apareció en esta corrida porque no había cita futura a la
  hora real de la captura, comportamiento existente sin cambio), NEEDS
  ATTENTION (`Siguiente acción`), TODAY (`Agenda de hoy`), CONTINUITY (`Sigue
  abierto de antes`) con sus 3 filas sembradas, en el orden correcto y con el
  escalamiento real de `debeEscalar()` visible («Prioridad crítica sin nadie
  asignado.», «Venció y nadie la tomó.»).
- Móvil: la zona nueva se apila debajo de la agenda sin desbordar, mismo
  patrón de fila que `.cita-fila` ya prueba a 560px.
- `axe.json` (`resultado.json` en la carpeta de capturas): 2 violaciones
  moderadas — **ninguna en `ContinuidadPanel`**. `landmark-unique` en el
  `<aside>` del cajón móvil de `FlowRail` (mismo `aria-label` que la versión
  de escritorio) y `region` en el banner de prueba gratuita (contenido fuera
  de un landmark). Las dos son de componentes que esta corrida no tocó
  (`FlowRail.tsx`, banner de suscripción) — **hallazgo nuevo, no regresión de
  esta corrida**, y queda anotado para que una corrida futura de
  accesibilidad lo tome; no se repara aquí para no salirse de fase.
- Consola: un único warning de reconexión de Firestore del emulador
  («Could not reach Cloud Firestore backend… offline mode»), igual familia
  que el ya visto en V15-SHELL-GREYBOX-001 — no es una regresión de esta
  corrida.

### Compuertas

- `npx vitest run`: 8669 pasan, 0 fallos (la falla ambiental
  `ops-timeout-y-punto-ciego` de la corrida anterior no se repitió en ésta).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva — los dos
  `fontSize` fuera de escala que introdujo el primer borrador de
  `ContinuidadPanel.tsx` (11 y 11.5) se corrigieron a 10.5/12 de la escala
  oficial antes de sellar, no se subió el techo.
- `npm run build`: TypeScript compila limpio; con `.env.local` demo
  (emuladores) el build completo también compila, `/dashboard` sigue
  saliendo como ruta estática (`○`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/dashboard` cambió de
  313 a 321 líneas de fuente) — el guardián `el-inventario-de-pantallas-no-miente`
  lo exigía.

### V15-PATIENT-WORKSPACE-001 — EN CURSO (primera rebanada: Patient Anchor)

- **`src/components/expediente/PatientAnchor.tsx`** — el ancla de §7:
  identidad, edad/sexo/teléfono, alergia/seguridad, encuentro actual y
  último cambio, en UN bloque `position: sticky` dentro de `<main>`
  (`overflowY: auto` del layout del dashboard — el contenedor de scroll
  real). Reemplaza los DOS bloques sueltos e independientes que tenía
  `expediente/[patientId]/page.tsx` al inicio (banner de alergias +
  encabezado `<h1>` de identidad, cada uno con su propio layout): el médico
  ya no concilia dos avisos para "¿en qué paciente estoy y qué necesito
  saber ya?". La página bajó de 686 a 648 líneas de fuente por la
  extracción (regenerado en `SCREEN_INVENTORY.md`).
- **"Encuentro actual"** se deriva de `notas` (la MISMA lista que ya carga
  `useExpediente` en la página, no una consulta nueva a Firestore): la nota
  más reciente sin firmar es un encuentro que empezó y no cerró — misma
  noción que ya usa `CabosSueltosDelPaciente`. Con CTA "Consulta sin
  cerrar — continuar" que lleva a `/consulta/[patientId]?nota=...`.
- **"Último cambio"** se deriva igual: la nota firmada más reciente, con su
  tipo y una fecha relativa ("hace 3 días"), al lado del banner de
  alergias — no un bloque nuevo.
- El banner de alergias conserva exactamente su regla de antes (regla 4 de
  seguridad clínica): SIEMPRE visible, "no registradas" cuando el campo
  está vacío (nunca "sin alergias"), rojo sólo con alergias reales. El caso
  del error de lectura del paciente (antes un `<div>` aparte) también se
  mudó al ancla, en el mismo lugar donde iría el banner.
- Guardián nuevo, probado al revés (mismo patrón que
  `v15-flow-rail-cableado.test.ts`):
  `src/__tests__/v15-patient-anchor-cableado.test.ts` — falla si la página
  deja de importar/renderizar `PatientAnchor`, si los dos bloques viejos
  reaparecen, si el ancla abre su propia consulta a Firestore para
  encuentro/último cambio, si el banner de alergias se vuelve condicional,
  o si pierde el `position: sticky`. Verificado manualmente contra el árbol
  sin el cambio (stash): los 3 casos de "bloques viejos ya no están"
  fallan como se espera.
- `src/__tests__/alergias-placeholder-no-afirma.test.ts` actualizado: el
  caso 3 ahora lee `PatientAnchor.tsx` (donde vive el banner ahora) en vez
  de `page.tsx` — el texto y la regla que prueba no cambiaron, sólo dónde
  vive el JSX.
- Trinquete de diseño: la extracción bajó `tamanosFueraDeEscala` (2007→2004)
  y `radiosFueraDeEscala` (636→635) — resellado a la baja con
  `--actualizar` (nunca se sube, y aquí bajó de verdad).

**Pendiente de esta misma fase, para una corrida siguiente:** Clinical
Spine (recorrido longitudinal por encuentros/diagnósticos/medicamentos/
labs/etc., §7) y Active Patient Canvas (abrir un evento/tarea/nota sin
perder el contexto del paciente). Esta corrida sólo entregó el Patient
Anchor — es una rebanada real y verificable, no la fase completa.

### V15-PATIENT-WORKSPACE-001 — CERRADA (segunda rebanada: Clinical Spine)

- **`src/components/expediente/ClinicalSpine.tsx`** — el riel de §7: "a
  longitudinal structural element... should allow movement through
  encounters, diagnoses, medications, labs...". Antes de esta corrida el
  expediente era una pila lineal sin forma de moverse entre categorías
  salvo la rueda del ratón. El riel sólo enseña las categorías que
  **de verdad tienen algo para ESE paciente** ("señalar de menos, nunca de
  más" — regla 5 de seguridad clínica aplicada a navegación, no sólo a
  vocabulario clínico): Encuentros siempre (incluso en 0, es el corazón del
  expediente), Diagnósticos y medicamentos / Pendientes / Ingresos sólo
  cuando ya cargaron y hay algo. Microbiología, imágenes, procedimientos,
  órdenes y comunicaciones **no tienen todavía sección propia** en esta
  pantalla — no se inventan entradas para secciones que no existen; quedan
  para cuando esas pantallas se construyan.
- **Ningún conteo se inventa ni se recalcula dos veces.** `problemas`/
  `vigentes` se levantaron de la IIFE local (que ya existía, REG-262) a un
  `useMemo` de la página: el bloque "Problemas/Toma" y el riel leen el
  MISMO cálculo. Para Pendientes/Ingresos —cuyos datos vive dentro de
  `CabosSueltosDelPaciente`/`InternamientosDelPaciente`— se añadió un
  callback opcional (`onResumen`/`onCargado`) que reporta hacia arriba lo
  que esos componentes YA leyeron, con un `ref` para que el callback no
  entre al array de dependencias del efecto de carga (si entrara, una
  función inline nueva en cada render releería Firestore sin que
  `clinicId`/`patientId` hubieran cambiado). Ninguna de las tres fuentes se
  duplicó.
- **Interacción real, no sólo un índice de atajos**: `IntersectionObserver`
  resalta (`aria-current`) la categoría que el médico está leyendo mientras
  baja con la rueda — no sólo tras pulsar un botón. Verificado con scroll
  real (ver abajo), no sólo leído en el código.
- **Greybox real**: estado activo en `var(--text)`/`var(--bg)`, no
  `var(--nexus)` — mismo patrón que ya fijó `FlowRail.tsx` en
  `V15-SHELL-GREYBOX-001`; el acento de marca espera a
  `V15-VISUAL-SYSTEM-001` (Fase 10).
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-clinical-spine-cableado.test.ts` — falla si la página
  deja de importar/renderizar `ClinicalSpine`, si un item del riel apunta a
  un ancla que no existe en el DOM, si `ClinicalSpine.tsx` ganara su propia
  consulta a Firestore, o si `onResumen`/`onCargado` entraran al array de
  dependencias del efecto de carga (11 de 15 casos fallan contra el árbol
  sin el cambio — verificado con `git stash`).
- Dos pruebas existentes se actualizaron para reflejar la MISMA conducta con
  forma de código distinta (el `if (...) return null` de la IIFE pasó a
  condición de render; el `.catch` de `InternamientosDelPaciente` ahora
  también reporta `null` hacia arriba): `el-expediente-resume-el-estado.test.ts`
  y `el-expediente-ensena-los-ingresos.test.ts`. Ninguna prueba se debilitó
  — se comprobó que las dos siguen fallando si se revierte la conducta real
  que protegen.
- **Hallazgo y arreglo de paso, encontrado por este mismo arnés**: axe marcó
  `button-name` (crítico) en `NotificacionesPushOptIn.tsx` — el botón de
  cerrar el banner de recordatorios de citas (`<X size={14} />` sin texto ni
  `aria-label`) no tenía nombre accesible. Preexistente, no causado por esta
  corrida (el componente vive fuera del expediente y no se tocó su lógica),
  pero se arregló aquí por ser un cambio de una línea, seguro, y porque el
  propio arnés de esta corrida lo encontró — mismo criterio que ya usó
  `V15-PATIENT-WORKSPACE-001` (primera rebanada) con el `<h1>` perdido.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore + build
de producción + `npm start` + siembra sintética). Arnés nuevo:
`scripts/design/capturar-clinical-spine-v15.mjs` — no sólo screenshot: prueba
comportamiento real. Capturas en `docs/design/capturas/v15-clinical-spine/`
(desktop 1440 + mobile 390):

- **El riel real, con datos reales**: `Encuentros 0 · Laboratorios y
  fotografía · Pendientes 1` — exactamente las 3 categorías que este
  paciente sintético tiene (0 encuentros, 0 diagnósticos/medicamentos
  firmados, 1 pendiente en plazo, 0 ingresos) — ninguna categoría vacía se
  enseña.
- **Clic navega, medido de verdad**: se pulsó el botón "Pendientes" y se
  midió `getBoundingClientRect().top` de su ancla (`#spine-pendientes`)
  antes (694.5px) y después (312.5px) del `scrollIntoView` suave. Se movió
  382px hacia arriba — el máximo físicamente posible en esta página
  (documento de 1282px de alto, viewport de 900px) — y quedó visible en
  pantalla.
- **Scroll resalta, medido de verdad**: tras volver a `scrollTop=0` y bajar
  900px con la rueda, `aria-current` pasó de "Pendientes" a "Laboratorios y
  fotografía" — el `IntersectionObserver` responde a scroll real, no sólo
  a clics.
- **Axe, 0 violaciones nuevas** tras el arreglo de `button-name`: quedan las
  dos familias ya conocidas y preexistentes — `landmark-unique` (cajón móvil
  de `FlowRail`) y `region` (banner de prueba gratuita / banner de push,
  ninguno dentro de `.nx-clinical-spine`, confirmado inspeccionando los
  `target` de axe).
- **Consola**: sin errores nuevos en desktop; el único mensaje en móvil es
  el warning ya familiar de reconexión de Firestore del emulador.
- **Móvil**: el riel se desplaza horizontalmente sin desbordar la pantalla
  (mismo patrón `overflowX: auto` que ya usan los filtros Todas/Consulta/
  Hospital de esta misma pantalla).

### Compuertas de esta corrida (Clinical Spine)

- `npx vitest run`: 8696 pasan, 0 fallos propios (la falla ambiental
  `ops-timeout-y-punto-ciego` es intermitente por el proxy de red del
  contenedor — reproduce igual en el árbol limpio, no relacionada).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores); `/expediente/[patientId]`
  sigue en la lista de rutas dinámicas del build.
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/expediente/[patientId]`
  pasó de 648 a 701 líneas de fuente por la extracción del riel y el
  `useMemo` compartido).

### Verificación en navegador real — CERRADA (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore +
siembra sintética + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-patient-anchor-v15.mjs` (navega a
`/expediente/pac-aurelio-dominguez`, un paciente sintético con una nota
firmada y una en borrador sembradas para esta verificación — ver siembra
ad-hoc, no forma parte del repo). Capturas en
`docs/design/capturas/v15-patient-anchor/` (desktop 1440 + mobile 390):

- **El ancla real, con datos reales**: `Aurelio Domínguez Peña · 72 años ·
  Masculino · +52 55 5555 0101 · Consulta sin cerrar — continuar · Alergias:
  Penicilina (rash generalizado, 2019) · Último cambio: Nota de Seguimiento
  · hace 10 días`. Las cinco piezas de §7 (identidad, edad/sexo, alergia,
  encuentro actual, último cambio) están en el DOM real, no sólo en el JSX.
- **"SIEMPRE visible" verificado como COMPORTAMIENTO**: se leyó
  `getBoundingClientRect().top` del ancla antes y después de hacer scroll
  600px dentro de `<main>` — 106.5px en los dos casos (`siguePegado: true`).
  Si no fuera `sticky` de verdad, el segundo valor habría sido muy negativo.
- **`page-has-heading-one` — DEFECTO ENCONTRADO Y ARREGLADO por este mismo
  arnés**: la primera captura (antes de este hallazgo) mostró una violación
  axe nueva que NO estaba en la línea base: al mover la identidad del
  paciente de un `<h1 className="t-h1">` a un `<div>` dentro del ancla, la
  página se quedó sin su único encabezado de nivel 1. Arreglado devolviendo
  el nombre del paciente a un `<h1>` (ahora dentro de `PatientAnchor.tsx`).
  Recapturado: la violación desaparece, quedan sólo las dos preexistentes.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2 nodos, el `<aside>`
  del cajón móvil de `FlowRail`) y `region` (2-3 nodos, el banner de prueba
  gratuita) — **mismo fingerprint exacto** que
  `docs/design/capturas/v15-today-continuidad/resultado.json`: ninguna de
  las dos vive en `.nx-patient-anchor` (confirmado inspeccionando los
  `target` de axe), y esta corrida no tocó ni `FlowRail.tsx` ni el banner.
- **Móvil**: hallazgo de pulido encontrado por la propia captura — el CTA
  "Consulta sin cerrar — continuar" compartía fila con el nombre partido en
  varias líneas y quedaba apretado a media altura. Arreglado con una regla
  `@media (max-width: 480px) { flex-basis: 100% }` sobre el botón (mismo
  patrón que `exp-actions` en la página, DEBT-006): pasa a su propia fila
  completa sin tocar el DOM ni el layout de escritorio.
- **Consola**: el único hallazgo nuevo (no visto en capturas V15 previas) es
  un `401 Unauthorized` en la escritura de bitácora (`logAudit` de
  `login_exitoso`/`expediente_lectura`) contra los emuladores — código que
  esta corrida NO tocó (vive en `layout.tsx` y en el `useEffect` de
  `expediente/[patientId]/page.tsx` desde antes de V15). Es un artefacto del
  arnés de emuladores (el token del emulador no valida igual contra la ruta
  de auditoría que un ID token real), no una regresión de este cambio — se
  deja anotado para quien retome el arnés de capturas en general, no se
  investiga más aquí por no salirse de fase.

### Compuertas de esta corrida

- `npx vitest run`: 8677 pasan, 1 skip, 0 fallos (dos fallos vistos en un
  corrida intermedia — `ops-timeout-y-punto-ciego` y `la-agenda-es-un-riel`
  — resultaron ser contención de recursos al correr la suite completa en
  paralelo: ambos pasan en aislamiento y en la corrida completa final).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: bajó de verdad
  (`tamanosFueraDeEscala` 2007→2004, `radiosFueraDeEscala` 636→635),
  resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) igual que las
  corridas anteriores.

### V15-PATIENT-WORKSPACE-001 — Active Patient Canvas, DECISIÓN (11-ago-2026, tercera rebanada)

La pregunta que dejó la corrida anterior: de los botones de `NotaCard`
(`onEditar`/`onImprimir`/`onGenerarReceta`/`onGenerarOrden`) y de
`CabosSueltosDelPaciente.alAbrirPendientes`, ¿cuáles navegan a un modo
DISTINTO legítimo (§8, Encounter Mode) y cuáles deberían abrir sin perder el
ancla/riel? Se investigó cada uno antes de tocar código — la respuesta no
era la misma para los cinco:

- **`onEditar`** (`/consulta/[patientId]?nota=...`, continuar un encuentro sin
  cerrar) — modo distinto legítimo. Es exactamente la entrada a Encounter
  Mode (§8, Fase 5, todavía sin construir); forzarlo a abrir inline
  adelantaría trabajo de una fase que aún no arrancó. **Sin cambio.**
- **`onImprimir`** (`/nota/[pid]/[id]`) — genera un documento para imprimir:
  necesita su propia página con hoja de estilo de impresión, no un panel
  dentro del expediente. **Sin cambio.**
- **`onGenerarReceta`/`onGenerarOrden`** (`/receta/...`, `/orden/...`) — el
  propio master loop los nombra explícitamente en la Fase 8 («Integrate
  Note → Rx → Orders → Instructions → Follow-up», §33, DESPUÉS de Encounter
  Mode/Results-Closure/Follow-up). Adelantarlos aquí sería invertir el orden
  obligatorio de fases (§18). **Sin cambio, diferido a Fase 8 a propósito —
  no es un olvido.**
- **`CabosSueltosDelPaciente.alAbrirPendientes`** (`/pendientes`, worklist
  global) — se investigó si esto es el defecto real de «reseteo mental» y
  NO lo es: `src/__tests__/los-cabos-sueltos-del-paciente.test.ts` (caso «el
  componente no cierra tareas») ya prueba, con su razón escrita en el propio
  componente, que CERRAR una tarea exige la validación de `cambiarEstado`
  (transiciones legales del modelo) y que repetirla aquí la desalinearía en
  la primera prisa. Además el componente YA enseña el detalle completo
  in-line (título, grupo, días vencido, dueño) — **leer** un pendiente de
  este paciente no pierde el ancla; sólo **cerrarlo** navega, y eso es
  correcto por diseño ya probado. Revertir esa decisión sin motivo nuevo
  contradiría un guardián existente. **Sin cambio.**

Con los cinco candidatos resueltos como modos legítimos o fases diferidas a
propósito, lo que SÍ quedaba genuinamente pendiente de §7 no era ninguno de
ellos: era `InstrumentStrip` sin pintar «paciente actual» — anotado desde
`V15-SHELL-GREYBOX-001` y otra vez al cierre de la corrida anterior («ahora
que el Patient Anchor existe, esa corrida puede decidir qué significa
"paciente actual" fuera del expediente»). Ver entrega abajo.

### `InstrumentStrip` pinta «paciente actual» (11-ago-2026, tercera rebanada)

- **`src/lib/nav/paciente-de-la-ruta.ts`** (módulo puro, nuevo) —
  `patientIdDeLaRuta(pathname)` deriva el `patientId` de la URL para las seis
  rutas que lo llevan como primer segmento dinámico (`expediente`,
  `consulta`, `nota`, `receta`, `orden`, `referencia`). No toca Firestore: es
  URL, no una consulta.
- **`src/components/InstrumentStrip.tsx`** — añade `usePacienteActual()`,
  que llama `getPatient()` de `@/lib/firestore` — LA MISMA función, con el
  mismo alcance de clínica, que ya usan expediente/consulta/receta/orden/
  nota/referencia — no una lectura nueva con su propio criterio de permisos
  (la razón por la que esto quedó pendiente desde V15-SHELL-GREYBOX-001).
  El nombre se muestra como enlace de vuelta a `/expediente/[patientId]`
  (continuidad, §20). Así el médico no pierde de vista EN QUIÉN ESTÁ al
  pasar del expediente a `/receta`/`/orden`, aunque esas pantallas sigan
  sin tocarse (Fase 8, diferida a propósito — ver decisión arriba).
- **Nunca enseña el paciente ANTERIOR mientras carga el siguiente**: el
  hook guarda el último `{id, nombre}` resuelto y sólo lo devuelve si ese
  `id` coincide con el `patientId` de la URL actual — filtrado derivado en
  el valor de retorno, no un `setState(null)` a ciegas al principio del
  efecto (la primera versión SÍ lo hacía así; `node scripts/lint-trinquete.mjs`
  lo cazó como `react-hooks/set-state-in-effect` antes de sellarse — ver
  compuertas abajo).
- Guardianes nuevos, probados al revés (mismo patrón que sus hermanos de
  fase): `src/__tests__/paciente-de-la-ruta.test.ts` (la función pura — qué
  rutas SÍ llevan paciente y cuáles no, con `/hospitalizacion/[id]` como
  caso trampa porque su segundo segmento es un internamiento, no un
  paciente) y `src/__tests__/v15-instrument-strip-paciente-actual.test.ts`
  (que reutiliza `getPatient` en vez de una consulta propia, que filtra por
  id antes de enseñar, y que no volvió al patrón de `setState` síncrono que
  cazó el trinquete de lint).

**Pendiente, no bloqueante:** PREPARED BY NEXUS (quinta zona de Hoy) sigue
sin construirse — depende de la MISMA pregunta de «paciente actual» fuera
del expediente, pero para el caso «próximo paciente de la agenda», que es
distinto al caso que esta corrida resolvió («paciente cuya pantalla estoy
viendo ahora»). Candidata para una corrida futura de `V15-TODAY-001` o de
esta misma fase si vuelve a abrirse.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores: emuladores Auth/Firestore reales
+ siembra sintética (`scripts/design/sembrar-capturas.mjs`) + build de
producción + `npm start`. Arnés nuevo: `scripts/design/capturar-instrument-strip-paciente-v15.mjs`.
Capturas en `docs/design/capturas/v15-instrument-strip-paciente/` (desktop
1440 + mobile 390):

- **Persiste al salir del expediente, medido de verdad, no leído en JSX**:
  la franja dice `Ausculta · Aurelio Domínguez Peña` en `/expediente/
  pac-aurelio-dominguez` Y en `/referencia/pac-aurelio-dominguez` (Carta de
  referencia — pantalla sin ningún otro rastro del paciente en su UI salvo
  el formulario) — la razón de ser de este cambio, confirmada con el
  paciente real.
- **Se limpia al salir a una pantalla sin paciente**: en `/dashboard` la
  franja vuelve a decir sólo `Ausculta`, sin arrastrar el nombre del
  paciente anterior.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2 nodos) y `region`
  (2-3 nodos) — mismas dos familias preexistentes ya documentadas en
  `v15-today-continuidad` y `v15-patient-anchor` (cajón móvil de `FlowRail`
  y banner de prueba gratuita), ninguna en `.nx-instrument-strip`.
- **Consola**: sin errores, en desktop ni en móvil.
- **Móvil**: el nombre cabe en la segunda fila de la franja sin desbordar
  ni truncarse con este paciente; queda anotado como algo a vigilar con
  nombres más largos cuando `V15-MOBILE-001` (Fase 9) recomponga el shell
  completo, no se resuelve aquí por no salirse de fase.
- Nota operativa para quien retome el arnés de capturas en general: la
  siembra de `sembrar-capturas.mjs` vive bajo el proyecto de emulador
  `demo-nexusmed-test` (hardcoded en el script), NO `demo-nexusmed-v10` que
  usa la familia `arnes:*` de V10 — arrancar los emuladores con
  `--project demo-nexusmed-v10` (como sugiere `package.json`) siembra y
  sirve la app en proyectos distintos y el login falla en silencio con
  `EMAIL_NOT_FOUND` sin que nada lo señale como error de proyecto. Costó
  tres reconstrucciones de `npm run build` en esta corrida diagnosticarlo
  (las variables `NEXT_PUBLIC_FIREBASE_*` se hornean en el build, no se
  leen en caliente) — se deja escrito aquí para que la próxima corrida no
  lo repita.

Con la decisión de Active Patient Canvas tomada y `InstrumentStrip`
entregado, **`V15-PATIENT-WORKSPACE-001` (Fase 4) puede darse por
CERRADA** — sigue `V15-ENCOUNTER-MODE-001` (Fase 5) como siguiente tarea
exacta para la corrida que retome este routine.

### V15-ENCOUNTER-MODE-001 — medición de baseline (11-ago-2026)

Antes de tocar código se leyó completo `src/app/(dashboard)/consulta/
[patientId]/page.tsx` (5881 líneas) y se comparó contra el ciclo de vida y
los 9 comportamientos de §8 (misma disciplina que `V15-BASELINE-001` aplicó
a la navegación). Resumen:

- **No existe una máquina de estados de "encounter"** — confirmado por grep
  (`encounterPhase`/`estadoEncuentro`/`EncounterMode`: 0 resultados). Las 10
  fases de §8 existen como FUNCIONALIDAD (nada clínico falta) pero ninguna
  existe como fase visual o de navegación: todo vive en una sola columna de
  ~2000 líneas de JSX gobernada sólo por `audio.estado` y `firmada`.
- **De los 9 comportamientos de §8**: 3 cumplen (grabación inconfundible,
  contexto clínico siempre disponible, transcripción opcional), 1 cumple
  sólo al inicio (acción primaria dominante — `EmpezarAGrabar`, ejemplar),
  2 parciales, **2 NO cumplen**: #1 «navigation visually quiets» y #5
  «nonessential admin disappears».
- **#1 medido como el más lejano y el más seguro/barato de arreglar**: la
  infraestructura de señal (`EVENTO_GRABANDO`) ya existe y ya la consumen
  `MarcoEscuchando` e `InstrumentStrip` — pero `FlowRail.tsx` no tenía
  NINGUNA referencia a ella. Con el marco perimetral encendido durante la
  grabación, la navegación de al lado no reaccionaba en absoluto. Rebanada
  elegida para esta corrida.
- Riesgo de lógica clínica evaluado y documentado: todo lo que se tocó en
  esta corrida es JSX/CSS del shell (`FlowRail.tsx`, `globals.css`) — cero
  archivos de `src/lib/asr/`, `src/lib/expediente/`, `src/lib/seguridad/`,
  ni hooks de grabación.

### FlowRail se aquieta al grabar (§8.1) — primera rebanada de Encounter Mode

- **`src/components/FlowRail.tsx`** — nuevo hook `useGrabando()`, suscrito al
  MISMO `EVENTO_GRABANDO` que ya escuchan `MarcoEscuchando` e
  `InstrumentStrip` (no es una fuente de verdad nueva). El `<aside>` añade
  `nx-flow-rail--quieto` mientras `activo === true`.
- **Hallazgo de esta misma corrida, encontrado por su propio arnés**: el
  primer intento atenuaba con `opacity` plano TODO lo no esencial, ETIQUETAS
  de texto incluidas. `scripts/design/probar-opacidad-quieta-v15.mjs` (axe
  real contra el riel real, no lectura de JSX) lo cazó como una violación
  `color-contrast` NUEVA — `--text3` sobre `--s1` en modo oscuro mide apenas
  ~5.6:1, sin margen para atenuar sin caer bajo el mínimo AA de 4.5:1. Subir
  la opacidad hasta un valor que pasara AA (~0.95) dejaba el atenuado
  invisible: ni cumplía §8.1 ni pasaba la compuerta de accesibilidad. Se
  midió el margen real con el mismo arnés (0.42→11 nodos, 0.85→2 nodos,
  0.95→0) antes de decidir la forma final — no se adivinó un valor.
- **Forma final, sin ese conflicto**: separa qué se atenúa de qué
  desaparece. `.nx-flow-rail-quiet-icon` (SVG decorativos: marca, lupa,
  cerrar sesión, e íconos de ítems NO activos vía
  `.nav-item:not(.active) .nav-icon`) usa `opacity` — sujeto al umbral
  WCAG 1.4.11 no-textual (3:1, no 4.5:1), verificado en 0 violaciones entre
  0.3–0.5. `.nx-flow-rail-quiet-hide` (texto puramente secundario y NO
  interactivo: nombre del médico, correo bajo "Cerrar sesión", atajo "⌘K",
  rótulo "Operaciones") usa `display:none` de verdad — seguro porque ninguno
  de esos nodos recibía el foco de teclado, así que no hay tabulación que
  perder; es además la lectura correcta de §8.5 («nonessential admin
  disappears»). **Las etiquetas de navegación (Hoy/Paciente/Encuentro/
  Seguimiento/Operaciones) y el nombre del consultorio no se tocan** — se
  quedan con su contraste de siempre; regla 6 de seguridad clínica en
  lenguaje de interfaz: bajar contraste en la navegación por estética no
  vale el precio de un defecto de accesibilidad bloqueante (§24).
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-flow-rail-se-aquieta-al-grabar.test.ts` — 9 de sus 20
  casos fallan contra el árbol previo a este cambio (verificado con
  `git stash`), incluido el caso que habría dejado pasar la PRIMERA versión
  con opacidad plana sobre texto si no se hubiera corregido.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore +
siembra sintética + build de producción + `npm start`). El evento se simuló
con el mismo `CustomEvent('nx:grabando', {detail:{activo}})` que dispara
`avisarEscucha()` — no se activó el micrófono real, que no es lo que este
cambio toca. Arnés nuevo: `scripts/design/capturar-flow-rail-quieto-v15.mjs`.
Capturas y medición en
`docs/design/capturas/v15-encounter-mode-flow-rail-quieto/` (desktop 1440):

- **Antes de grabar**: `claseQuieto=false`, íconos y etiquetas en opacidad 1,
  las 8 piezas de texto secundario visibles.
- **Grabando, en `/expediente/[patientId]` (activo="Paciente") y en
  `/consulta/[patientId]` (activo="Encuentro")**: `claseQuieto=true`, los 14
  íconos no-activos bajan a 0.4, las 8 piezas de texto secundario se ocultan
  — Y las 10 etiquetas de navegación + el nombre del consultorio + el ícono y
  la etiqueta del contexto activo se quedan en opacidad 1, sin tocar.
  Confirmado con datos reales, no leído en JSX.
- **Después de grabar**: los tres grupos vuelven exactamente a su estado
  inicial.
- **Foco de teclado**: el ícono dentro del botón enfocado (`Buscar…`) vuelve
  a opacidad 1 mientras el resto del riel sigue atenuado.
- **Axe, 0 violaciones nuevas** en `/consulta/[patientId]` con la grabación
  activa (0 violaciones en total en esa corrida — ni siquiera las dos
  familias preexistentes ya conocidas aparecieron en esta página/estado).
- **Consola**: 0 errores.
- Capturas visuales (`expediente--antes.png` vs `expediente--grabando.png`)
  confirman la diferencia a simple vista: el marco perimetral se enciende, el
  subtítulo "Consultorio", el atajo "⌘K" y el rótulo "Operaciones"
  desaparecen, y los íconos de Hoy/Encuentro/Seguimiento/Operaciones se ven
  visiblemente más tenues — mientras "Paciente" (el contexto activo en esa
  pantalla) se mantiene con su peso completo.

### Compuertas de esta corrida

- `npx vitest run`: 8737 pasan, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores).

**Deuda anotada, no bloqueante:**
- `BottomNav.tsx` (navegación persistente en móvil) tampoco se suscribe a
  `EVENTO_GRABANDO` — mismo hallazgo que tenía `FlowRail`, pero fuera de
  alcance de esta rebanada (la recomposición de móvil es
  `V15-MOBILE-001`, Fase 9, deliberadamente diferida). Verificado (no
  supuesto): `grep EVENTO_GRABANDO src/components/BottomNav.tsx` → sin
  coincidencias.
- Dos familias de violaciones axe moderadas preexistentes —
  `landmark-unique` (cajón móvil de `FlowRail`) y `region` (banners fuera de
  landmark) — siguen sin tocarse, candidatas a `V15-A11Y-001`.
- §8.5 «nonessential admin disappears» sigue sólo PARCIALMENTE resuelto: esta
  corrida lo resolvió para la navegación persistente (FlowRail/
  InstrumentStrip); el admin DENTRO de la propia página de consulta (menú de
  motor de IA, banner de créditos/plan, enlaces a `/precios`) sigue con su
  peso completo durante la grabación — es el hallazgo #5 del mapeo de
  baseline, candidato real para la siguiente rebanada de esta misma fase.
- §8.6 «one primary action dominates» sigue sin resolverse fuera del inicio
  (`EmpezarAGrabar`): en el cierre, "Firmar y cerrar nota" comparte peso
  visual con "Guardar borrador"/"Leer resumen"/"Descartar" (líneas 5660-5699
  del baseline medido). Candidato alternativo para la siguiente rebanada.

### "Firmar y cerrar nota" domina el cierre (§8.6) — segunda rebanada de Encounter Mode (11-ago-2026)

- **`consulta-ui.tsx` (`S.firmar`/`S.guardar`/`S.descartar`)** — `S.firmar`
  creció de verdad (relleno 13px→15/28px, tamaño 15→16, y ganó una sombra que
  ninguna otra acción del cierre lleva). `S.guardar` y `S.descartar`
  PERDIERON su caja: sin `border`, sin fondo, tamaño 14→12 — pasan de ser
  botones del mismo peso que Firmar a texto de apoyo. Aplica la regla del
  sistema de diseño (posición → tipografía → espacio → agrupación → énfasis,
  antes que cajas con borde) al hallazgo #6 que dejó anotado la rebanada
  anterior (baseline: las cuatro acciones vivían en una sola fila del mismo
  alto, líneas 5660-5699).
- **`page.tsx`** — el `<div>` que contenía las cuatro acciones en una sola
  fila con wrap se partió en DOS filas: Firmar (con el motivo de bloqueo
  justo debajo, donde está el dedo) en su propio contenedor; Guardar
  borrador/Leer resumen/Descartar/Completitud en un segundo contenedor,
  visualmente subordinado. Ningún `onClick`, `disabled`, `title` ni el texto
  de `motivoNoFirma`/`bloqueosDeFirma` cambió — es reordenar JSX/CSS de lo
  que ya existía, no lógica nueva (`firmar`, `bloqueosDeFirma`,
  `motivoNoFirma`, `guardarBorrador`, `leerResumen`, `descartar` — ninguna
  de esas seis definiciones se tocó).
- **Hallazgo y arreglo de la misma corrida, encontrado por su propio
  arnés**: el primer intento atenuaba `S.descartar` con `opacity: 0.8` sobre
  `var(--red)` para bajarle peso visual. `scripts/design/capturar-firmar-domina-v15.mjs`
  (axe real, no lectura de JSX) lo cazó como una violación `color-contrast`
  NUEVA: `#ba5253` sobre `#0b0c0e` mide 4.11:1, bajo el mínimo AA de 4.5:1
  para texto normal (12px). Se quitó la opacidad — el color `var(--red)` a
  plena intensidad ya tenía margen de sobra sin necesitar atenuado — y la
  violación desapareció en la recaptura, en desktop y en móvil.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-firmar-domina-al-cerrar.test.ts` — 4 de sus 8 casos
  fallan contra el árbol previo a este cambio (verificado con `git stash`):
  padding/tamaño de `S.firmar`, `border`/`background` de
  `S.guardar`/`S.descartar`, y que Firmar viva en un contenedor separado del
  de las acciones de apoyo. Los otros 4 casos protegen el freeze funcional
  (mismo `onClick`/`disabled`/texto de motivo que antes).
- `node scripts/design/inventario-de-pantallas.mjs` regenerado
  (`/consulta/[patientId]` bajó de 5900 a 5882 líneas de fuente por la
  extracción de la estructura de dos filas) y
  `node scripts/design/trinquete-de-diseno.mjs --actualizar` (bajó de
  verdad: `tamanosFueraDeEscala` 2004→2003 — el `fontSize: 15` viejo de
  `S.firmar`, fuera de escala, pasó a 16, que sí está en la escala oficial;
  `radiosFueraDeEscala` se quedó igual, no subió).

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
siembra sintética `sembrar-capturas.mjs` + build de producción + `npm start`).
Arnés nuevo: `scripts/design/capturar-firmar-domina-v15.mjs`. Capturas en
`docs/design/capturas/v15-firmar-domina/` (desktop 1440 + mobile 390, más una
captura de cada uno desplazada hasta el pie de cierre):

- **Medido con `getComputedStyle`, no leído en JSX**: `Firmar` renderiza
  `fontSize: 16px`/`padding: 15px 28px`/con sombra; `Guardar`/`Descartar`
  renderizan `fontSize: 12px`/`padding: 6px 8px`/sin borde/sin fondo. Las dos
  filas están realmente separadas (`filasSeparadas: true`,
  `altoFirmarMayorQueGuardar: true`).
- **Nota operativa para quien retome el arnés de capturas**: `.env.local`
  necesita `NEXT_PUBLIC_FIREBASE_EMULATORS=1` (con **S** al final) — la
  variable que de verdad lee `src/lib/firebase.ts`. El nombre sin `S` que
  sugiere `arnes:dev` en `package.json` deja el login colgado en «Entrando…»
  sin ningún error visible, porque el cliente nunca intenta conectar contra
  el emulador. Costó un ciclo de build completo diagnosticarlo — las
  `NEXT_PUBLIC_*` se hornean en el build, no se leen en caliente.
- **Axe, 0 violaciones nuevas** tras el arreglo de contraste: quedan sólo las
  dos familias ya conocidas y preexistentes — `landmark-unique` (cajón móvil
  de `FlowRail`) y `region` (banner de prueba gratuita) — mismo fingerprint
  que las corridas anteriores de esta fase.
- **Consola**: 0 errores en desktop; el único mensaje en móvil es el warning
  ya familiar de reconexión de Firestore del emulador.
- Capturas visuales (`consulta--desktop-cierre.png`,
  `consulta--mobile-cierre.png`) confirman la jerarquía a simple vista:
  Firmar es el bloque más grande y oscuro de la fila, con el motivo de
  bloqueo justo debajo en rojo; Guardar borrador/Leer resumen/Descartar
  quedan como texto plano sin caja, con Completitud alineada a la derecha.

### Compuertas de esta corrida

- `npx vitest run`: 8745 pasan, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: bajó de verdad
  (`tamanosFueraDeEscala` 2004→2003), resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores).
- `docs/design/SCREEN_INVENTORY.md` regenerado.

### Admin no esencial DENTRO de `/consulta/[patientId]` se calla al grabar (§8.5, hallazgo #5) — tercera rebanada de Encounter Mode (11-ago-2026)

- **Medición antes de tocar código**: el hallazgo #5 del baseline decía
  «menú de motor de IA, banner de créditos/plan, enlaces a `/precios` siguen
  con su peso completo durante la grabación». Al medir con precisión (grep +
  lectura de `page.tsx`) resultó ser DOS defectos, no uno:
  1. El «Menú de IA: motor por nota + medidor de créditos» usaba
     `!voz.grabando` como compuerta — que sólo cubre la ruta de Web Speech.
     `modoVoz` está fijo en `'whisper'` (la ruta REAL, diarización/Whisper
     por `voice-asr.md`), y con esa ruta `voz.transcripcion` se llena EN VIVO
     desde `audio.transcripcionParcial` (efecto ya existente en `page.tsx`,
     línea ~530) mientras `voz.grabando` se queda en `false` — así que este
     menú SÍ se mostraba con su peso íntegro durante una grabación de audio
     real, no sólo durante la (inexistente en la práctica) grabación por voz
     del navegador. Es el más severo de los dos: no es sólo peso visual, es
     una compuerta que nunca se cerraba en el camino que de verdad se usa.
  2. Los tres avisos de créditos/plan (tope duro agotado, modo económico,
     candado de gasto suave) no tenían NINGUNA compuerta de grabación —
     visibles sin condición siempre que su estado de negocio fuera cierto,
     grabando o no.
- **`page.tsx`** — los cuatro sitios ahora comparten `grabandoAhora()`, el
  MISMO helper que ya existía en el archivo (línea ~1394,
  `audio.estado === 'grabando' || audio.estado === 'pausado' ||
  voz.grabando` — pausado cuenta como activo, mismo criterio que
  `estoy-grabando.ts`) y que ya usaban `iniciarPorVoz`/`cerrarPorVoz`: no es
  un criterio nuevo, es cerrar el mismo criterio en cuatro sitios que no lo
  usaban. El menú de IA cambió su compuerta de `!voz.grabando` a
  `!grabandoAhora()`; los tres avisos de créditos ganaron `&&
  !grabandoAhora()` al final de su condición existente. Ningún `onClick`,
  texto, ni lógica de negocio de estos bloques se tocó.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-admin-no-esencial-se-calla-al-grabar.test.ts` — 4 de
  sus 8 casos fallan contra el árbol previo a este cambio (verificado con
  `git show HEAD:` del archivo antes de editar): el menú de IA seguía en
  `!voz.grabando` y los tres avisos no llevaban ninguna compuerta.

### Verificado en navegador real (11-ago-2026) — grabación DE VERDAD, no simulada

A diferencia de las dos rebanadas anteriores de esta fase (que simulan
`EVENTO_GRABANDO` con un `CustomEvent` porque el shell vive en otro árbol de
componentes), aquí `audio.estado` es estado interno de
`useGrabacionAudio()` dentro de la propia página — no hay evento externo que
simular sin dejar de probar lo que de verdad importa. Se usó micrófono FALSO
de Chromium (`--use-fake-device-for-media-stream` +
`--use-fake-ui-for-media-stream`) para que `getUserMedia`/`MediaRecorder`
corrieran de verdad, e interceptando (`page.route`) SÓLO la frontera de red
hacia el proveedor de ASR/IA (no hay llave real de AssemblyAI/Whisper/
Anthropic en este entorno) — todo lo demás (React, efectos, DOM) corrió sin
tocar. Arnés: `scripts/design/capturar-admin-se-calla-v15.mjs`. Capturas y
medición en `docs/design/capturas/v15-admin-se-calla/` (desktop 1440):

- **Login real + `/consulta/[patientId]` real + consentimiento real +
  grabación real** con audio sintético. El primer trozo EN VIVO (flush cada
  20 s, `INTERVALO_CHUNK_DEFAULT_MS`) llegó por la ruta real
  (`/api/expediente/transcribir-chunk`, mockeada sólo en la respuesta del
  proveedor) y pobló `voz.transcripcion` de verdad, con
  `audio.estado === 'grabando'` todavía activo: `chunkVisto: true`,
  `grabandoConTranscripcionParcial: {"grabando":true,"menuDeIA":false,...}`
  — el defecto más severo (#1), confirmado y confirmado corregido con datos
  reales, no leído en JSX.
- **El aviso de créditos, disparado MIENTRAS SIGUE GRABANDO** (pulsando
  «Procesar con IA» directamente — visible y habilitado con transcripción no
  vacía sin importar `audio.estado` — contra `/api/expediente/procesar`
  mockeada para devolver `sinCreditos: true`): el estado de negocio se puso
  cierto y el aviso se quedó AUSENTE —
  `creditosAgotadosMientrasGraba: {"grabando":true,"avisoSinCreditos":false}`
  — la prueba directa de que `!grabandoAhora()` gobierna el aviso, no una
  coincidencia de que nunca se disparó.
- **Al detener** (`despuesDeDetenerAvisoAparece`): con `grabando:false`, TANTO
  el menú de IA COMO el aviso de créditos reaparecen en el mismo instante —
  `{"grabando":false,"menuDeIA":true,"avisoSinCreditos":true}` — confirmado
  con capturas (`04-detenido-aviso-aparece.png`): «Motor de IA para esta
  nota» y «Se acabaron tus consultas con IA del mes (30/30)» los dos
  visibles con su peso completo, tal como antes de esta fase.
- **Ojo con el toast**: `sinCreditos` también dispara un TOAST transitorio
  con el MISMO título que el aviso persistente («Se acabaron tus consultas
  con IA del mes») — buscar sólo ese título en el DOM habría dado un falso
  positivo mientras el toast estaba en pantalla (pasó en el primer intento
  de este mismo arnés). Se corrigió buscando una frase que sólo lleva el
  cuerpo del aviso persistente («La IA se pausó para no generarte cargos
  extra»), que el toast no tiene.
- **No se ejercitó la diarización completa al detener** (`aplicar()` nunca
  llegó a `setEstado('listo')` en los primeros intentos de este arnés —
  quedó `audio.estado` fijo en `'subiendo'` incluso con
  `/api/expediente/transcribir-diarizado` mockeada devolviendo `completed`
  en la primera consulta). Diagnosticado como algo del propio sandbox
  (probablemente el intento de `guardarAudioDeLaConsulta` de subir a
  Firebase Storage, sin emulador de Storage levantado aquí, o similar), NO
  del cambio de esta corrida — los cuatro sitios tocados son JSX puro y el
  fallo persistía igual con y sin la compuerta nueva. Se evitó por completo
  disparando el aviso de créditos con «Procesar con IA» directo en vez de
  depender de la vuelta completa detener→diarizar→procesar automático — el
  MISMO botón y la MISMA ruta que el flujo real usa, sin la diarización de
  por medio.
- **Axe, 0 violaciones** en los cuatro estados medidos (antes, grabando,
  grabando-con-aviso-agotado, detenido-con-aviso-visible).
- **Consola**: el único error nuevo son dos `503` esperados de la ruta de
  diarización REAL (sin mockear en el paso 4, sin llave de proveedor en este
  entorno) — degradación conocida y ya manejada por
  `intentarDiarizar`/`falla('error_proveedor')`, no una regresión de esta
  corrida. El aviso de reconexión de Firestore del emulador es el mismo
  transitorio ya visto en corridas anteriores de esta fase.

### Compuertas de esta corrida

- `npx vitest run`: 8750 pasan (8 nuevos), 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — todas las
  rutas generadas, incluida `/consulta/[patientId]`.
- `docs/design/SCREEN_INVENTORY.md` regenerado (consulta subió de 5882 a
  5901 líneas por el comentario que explica el porqué del cambio de
  compuerta).

### V15-ENCOUNTER-MODE-001 — re-medición de los 9 comportamientos de §8 (11-ago-2026, cuarta rebanada)

Con #1 y #5 ya cerrados por rebanadas previas, esta corrida releyó
`/consulta/[patientId]` completa (5924 líneas, tras las tres rebanadas
anteriores) y re-midió los 9 comportamientos de §8 UNO POR UNO contra el
código actual — no contra la medición de baseline, que es de antes de esas
tres rebanadas:

| # | Comportamiento (§8) | Estado | Evidencia |
|---|---|---|---|
| 1 | navigation visually quiets | **PASS** | `FlowRail.tsx` (§8.1, ya cerrado). `BottomNav.tsx` (móvil) sigue sin suscribirse a `EVENTO_GRABANDO` — deuda ya anotada, diferida a `V15-MOBILE-001` (Fase 9), no bloquea Fase 5. |
| 2 | patient identity remains unmistakable | **PASS** | Header de `page.tsx` (`<h1>{patient?.nombre}</h1>` + edad/sexo + banner de alergias, líneas ~4029-4054 de antes de esta corrida) **nunca** está detrás de `grabandoAhora()` — confirmado con `grep grabandoAhora` (sólo 4 sitios: menú IA + 3 avisos de crédito, ninguno es el header). El CSS de "quieto" de §8.1/§8.5 (`.nx-flow-rail-quiet-*`, `globals.css` líneas 772-783) está encapsulado bajo `.nx-flow-rail--quieto`, que sólo existe dentro del `<aside>` de `FlowRail` — no puede alcanzar nada de `/consulta/[patientId]` (confirmado: `grep nx-flow-rail-quiet` en `page.tsx` → 0 resultados). Además `InstrumentStrip` (§ tercera rebanada de `V15-PATIENT-WORKSPACE-001`) también pinta "paciente actual" en `/consulta`, doble refuerzo. |
| 3 | recording state becomes unmistakable | **PASS** | Sin cambio desde el baseline: `MientrasHablas` + `InstrumentStrip` + `MarcoEscuchando`. |
| 4 | clinically important current context remains available | **PASS** | Sin cambio desde el baseline: alergias, "Está tomando", "Visitas anteriores" siguen sin gate de grabación. |
| 5 | nonessential admin disappears | **PASS** | Cerrado por la rebanada anterior (§8.5): menú de IA + 3 avisos de crédito ahora gatean con `grabandoAhora()`, verificado con grabación real. |
| 6 | one primary action dominates | **PASS** | `EmpezarAGrabar` al inicio (ya lo tenía el baseline) y "Firmar y cerrar nota" al cierre (§8.6, ya cerrado). |
| 7 | live transcript is optional, not the default wall | **PASS** | Sin cambio desde el baseline. |
| 8 | contextual intelligence appears beside relevant facts | **Era PARCIAL → PASS esta corrida** | Ver rebanada de abajo. Este era uno de los "2 parciales" que el baseline nunca nombró por número — el otro era el propio #6, que ya se resolvió con §8.6 al pasar de "sólo al inicio" a "también al cierre". |
| 9 | note/plan emerge from the encounter without switching to unrelated modules | **Deliberadamente diferido a Fase 8, no bloquea Fase 5** | Ver razonamiento abajo. |

**Sobre #9** (para que quede explícito y no se re-litigue sin motivo): el
propio master loop ubica "Integrate Note → Rx → Orders → Instructions →
Follow-up" en la Fase 8 (§33), DESPUÉS de Encounter Mode. La corrida de
`V15-PATIENT-WORKSPACE-001` (tercera rebanada, sección "Active Patient
Canvas, DECISIÓN" arriba) ya investigó `onGenerarReceta`/`onGenerarOrden` y
decidió, con razón escrita, que navegar a `/receta`/`/orden` es un diferido
A PROPÓSITO, no un olvido. Esta corrida confirma que esa decisión sigue
vigente (no se tocó `onGenerarReceta`/`onGenerarOrden` ni la navegación de
`NotaCard`) y la adopta para #9: forzar Rx/Orders a vivir inline dentro de
`/consulta/[patientId]` ahora invertiría el orden de fases obligatorio de
§18. Documentado, no bloqueante — no se cuenta como comportamiento
incumplido de esta fase.

Con #1-8 en PASS real y #9 diferido con razón documentada y ya tomada por
una corrida anterior, **los 9 comportamientos de §8 quedan resueltos o
legítimamente diferidos** — condición para cerrar `V15-ENCOUNTER-MODE-001`.

### El Copiloto se pinta junto a los hechos (§8 #8) — cuarta y última rebanada de Encounter Mode

- **Medición antes de tocar código**: `/consulta/[patientId]` es una sola
  columna sin pestañas (confirmado: `grep gridTemplateColumns` sólo
  encuentra la cuadrícula de Signos vitales — ninguna estructura de dos
  columnas en toda la página). El orden real de JSX (no supuesto: medido con
  `grep -n` de cada marcador de sección) era: Grabación → extracción NER →
  avisos de crédito → Resumen ejecutivo → Segunda opinión → **Copiloto +
  PanelRazonamiento** → Herramientas → Evidencia (PubMed) → PROA →
  reproyección de voces → sugerencias de IA pendientes → Signos vitales →
  Preop → Inmuno → Secciones narrativas → **Diagnósticos** → **Medicamentos**
  → Validación + Acciones (cierre). El Copiloto —que calcula alertas de
  dosis/alergia/renal/prevención LEYENDO `diagnosticos`/`medicamentos`/
  `signosNum` vía el `useMemo` `entradaCopiloto`— se pintaba casi 700 líneas
  ANTES de que esos mismos diagnósticos y medicamentos existieran siquiera
  como lista editable en la pantalla. Un médico que lee de arriba abajo veía
  "para este paciente…" y alertas de seguridad antes de haber llegado a
  escribir el diagnóstico o el medicamento que las dispara: la inteligencia
  contextual estaba desconectada de los hechos que interpretaba, no "al
  lado" de ellos — el comportamiento #8 de §8, PARCIAL en la medición.
- **Corrección**: se reubicó el bloque `<Copiloto>` + `<PanelRazonamiento>`
  (sin tocar una sola prop, sin tocar `entradaCopiloto`) a que se pinte
  DESPUÉS de Secciones narrativas + Diagnósticos + Medicamentos, y justo
  ANTES de "Validación + Acciones" (el cierre/firma). El dato que consume
  (`entradaCopiloto`) no cambió — es el mismo `useMemo` de siempre, calculado
  arriba de la función, independiente de dónde se pinte su consumidor. Sólo
  cambió DÓNDE se pinta: ahora el Copiloto reacciona a lo que el médico YA
  fijó, justo antes de firmar, en vez de adelantar una opinión sobre datos
  que todavía no existen en pantalla.
- **No se tocó** `Herramientas`, `Evidencia (PubMed)` ni `PROA` — son
  herramientas bajo demanda (el médico las abre si las necesita), no el
  motor de sugerencias reactivo que dispara #8. Reordenarlas también habría
  sido un cambio mucho más grande y con más riesgo (~1200 líneas de JSX) por
  un beneficio marginal; se dejó fuera de esta rebanada a propósito.
- **Hallazgo de paso, encontrado por el mismo arnés de verificación**: al
  disparar una sugerencia real del Copiloto (agregar un medicamento que
  choca con la alergia del paciente) aparecieron dos violaciones axe
  `critical`/`serious` NUEVAS para esta fase — no en el bloque que se movió,
  sino en las filas de Diagnósticos/Medicamentos que ninguna captura previa
  de esta fase había llegado a poblar: el botón de basurero (`Trash2`, sin
  texto ni `aria-label`, 2 nodos: uno en Diagnósticos y otro en Medicamentos)
  y el `<select>` de vía de administración (sin `<label>` ni `aria-label`, 1
  nodo). Arreglados aquí por ser un cambio de una línea cada uno, seguro
  (sólo agrega `aria-label`, ningún `onClick`/`disabled`/comportamiento
  cambia) y porque el propio arnés de esta corrida los encontró — mismo
  criterio que ya usaron las rebanadas de `V15-PATIENT-WORKSPACE-001` con el
  `<h1>` perdido y el botón de `NotificacionesPushOptIn.tsx`.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-copiloto-junto-a-los-hechos.test.ts` — análisis estático
  de fuente (índice de texto = orden de render, mismo patrón que el resto de
  guardianes `v15-*`). Verificado contra `git stash` del cambio en
  `page.tsx`: el caso "Secciones narrativas → Diagnósticos → Medicamentos →
  Copiloto, en ese orden" falla contra el árbol previo (`<Copiloto` aparecía
  ANTES de "Diagnósticos" en el texto fuente, `299226 < 262140` fallando la
  aserción `toBeLessThan`); los otros 5 casos (freeze funcional + bloque
  contiguo) pasan sin el cambio porque protegen algo que no se tocó.

### Verificado en navegador real (11-ago-2026) — sugerencia crítica real, no simulada

Mismo método que las corridas anteriores de esta fase: emuladores
Auth/Firestore reales (`--project demo-nexusmed-test`) + siembra sintética
(`sembrar-capturas.mjs`) + build de producción + `npm start`. Esta
verificación además EJERCITA una sugerencia real del Copiloto en vez de sólo
medir posición con datos vacíos: sobre `pac-aurelio-dominguez` (alergia
registrada: Penicilina), se agregó un diagnóstico y el medicamento
"Amoxicilina" desde la UI real — `alergiaVsReceta()`
(`src/lib/expediente/copiloto.ts`) clasifica la amoxicilina dentro de la
familia "betalactámicos" que dispara la alergia a penicilina, así que es un
disparador determinista, no supuesto. Arnés nuevo:
`scripts/design/capturar-copiloto-junto-a-hechos-v15.mjs`. Capturas y
medición en `docs/design/capturas/v15-copiloto-junto-a-hechos/` (desktop
1440 + mobile 390):

- **La sugerencia crítica real apareció en el DOM**: `hayCriticaEnDOM: true`,
  `textoCritica: "Amoxicilina choca con una alergia registrada"` — medido
  con `document.querySelectorAll('span')`, no leído en el código fuente.
- **Orden real, medido con `getBoundingClientRect().top`, no supuesto**:
  `topMedicamentos: 1178.66` < `topCopiloto: 1363.41` < `topFirmar:
  2317.16` → `medicamentosAntesDeCopiloto: true`,
  `copilotoAntesDeFirmar: true`. El Copiloto (con la alerta crítica real
  visible) queda entre Medicamentos y el cierre, exactamente donde lo puso
  la corrección.
- **Antes de agregar datos, el Copiloto calla**: `copilotoAntesDeAgregarDatos_desktop: false`,
  `_mobile: false` — sin diagnóstico ni medicamento en la nota nueva, ningún
  texto "Para este paciente"/"cosa que revisar" aparece (silencio como
  condición normal, regla ya documentada en la cabecera de `Copiloto.tsx`).
- **Axe, ANTES del arreglo de aria-label**: `button-name` (crítico, 2 nodos:
  el basurero de Diagnósticos y el de Medicamentos) y `select-name`
  (crítico, 1 nodo: el `<select>` de vía) — NUEVOS para esta fase porque
  ninguna captura previa de `V15-ENCOUNTER-MODE-001` había llegado a poblar
  esas filas. **DESPUÉS del arreglo** (rebuild + recaptura): los dos
  desaparecen — 0 nodos en ambos.
- **Axe, violaciones que quedan tras el arreglo**: `landmark-unique` (2
  nodos, desktop) y `region` (2-3 nodos) son el mismo fingerprint
  preexistente ya documentado en TODAS las capturas anteriores de esta fase
  (cajón móvil de `FlowRail`, banners fuera de landmark) — no se tocan aquí,
  candidatas a `V15-A11Y-001`. `color-contrast` (1 nodo, serio, texto teal
  del encabezado "Análisis basado en evidencia" — `#0f6e56` sobre fondo
  oscuro, 3.03:1) y `heading-order` (1 nodo, `<h4>Sus medicamentos</h4>` de
  `src/lib/paciente/como-se-lo-explico.ts`, la hoja para el paciente) son
  **hallazgos nuevos para esta fase, pero en componentes que esta rebanada
  NO tocó** (el panel de Evidencia/PubMed y la hoja para el paciente no
  forman parte del bloque `Copiloto`/`PanelRazonamiento` que se movió, y su
  estilo/markup no cambió una línea) — aparecen recién ahora porque es la
  primera captura de la fase que puebla Diagnósticos/Medicamentos lo
  suficiente para que esos paneles se activen. Anotados para
  `V15-A11Y-001`, no arreglados aquí para no salirse de una rebanada ya de
  por sí concentrada en #8.
- **Consola**: 0 errores en desktop; en móvil, sólo el warning ya familiar de
  reconexión de Firestore del emulador.

### Compuertas de esta corrida

- `npx vitest run`: 8754 pasan, 1 skip, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado, mismo fallo documentado en todas las
  corridas previas de esta fase).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — todas las
  rutas generadas, incluida `/consulta/[patientId]`, sin error de tipos ni
  de compilación.
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/consulta/[patientId]`
  subió de 5912 a 5925 líneas de fuente por el comentario que explica el
  reordenamiento y los dos `aria-label` nuevos).

## V15-ENCOUNTER-MODE-001 (Fase 5) — CERRADA

Los 9 comportamientos de §8 quedan en PASS real (1-8) o diferidos con razón
documentada y ya decidida por una corrida anterior (#9, Fase 8 por diseño
del propio master loop, §18/§33). Tres rebanadas reales cerraron gaps de
verdad (§8.1 navegación, §8.5 admin no esencial, §8.6 acción dominante al
cierre) y una cuarta reposicionó la inteligencia contextual junto a los
hechos que interpreta (§8.8). Ningún cambio de esta fase tocó
`src/lib/asr/`, `src/lib/expediente/` (motor clínico), `src/lib/seguridad/`,
una ruta de API ni una regla de Firestore — presentación/estructura
únicamente, lógica clínica congelada.

## V15-RESULTS-CLOSURE-001 (Fase 6, §9) — EN CURSO, primera rebanada: `ProgresoResultado` en `/pendientes`

**Decisión tomada esta corrida, con razón escrita (no era obvia):** §9 pide
un "work queue" — no exige por sí solo una ruta nueva. Añadir un sexto
destino al `FlowRail` para "Resultados" habría violado `§14` (≤5 destinos
primarios, ya cerrado por `V15-SHELL-GREYBOX-001`). `/pendientes`
(WORK/FOLLOW-UP) YA es una cola de trabajo real (agrupa por escalamiento,
no una tabla) y YA trata `estudio_pendiente`/`resultado_por_revisar` como
tipos de primera clase (`ETIQUETA_TIPO`). El gap real medido contra §9 no
era "falta una pantalla": cada tarjeta de resultado sólo mostraba UN botón
de "siguiente paso" (3 estados visibles) sin exponer las ocho etapas de §9
ni decir cuáles de ellas el sistema ni siquiera registra. Se construyó AHÍ,
no en una ruta nueva. `V15-FOLLOWUP-WORK-001` (Fase 7, siguiente en la
secuencia tras cerrar esta) es quien reorganiza TODO `/pendientes` por
estado de acción (§10); esta rebanada no invade esa fase, sólo hace visible
la progresión de resultado sobre la estructura de tarjeta que ya existe.

- **`src/lib/tareas-clinicas/progreso-resultado.ts`** (módulo puro, nuevo)
  — `progresoResultado()` mapea una `TareaClinica` a las ocho etapas de §9.
  **Hallazgo estructural, no un detalle de implementación**: sólo CINCO de
  las ocho tienen dato real hoy (RESULT, SIGNIFICANCE vía `prioridad`,
  OWNER vía `ownerUid`, REVIEW vía la progresión de `estado`, CLOSED vía
  `estado === 'cerrada'`). DECISION, ACTION y PATIENT COMMUNICATION **no
  tienen campo propio** — el propio modelo (`POR_QUE_COMPLETADA_NO_ES_CERRADA`
  en `modelo.ts`) dice que "cerrar" es hoy el único acto y abarca las tres
  de golpe, sin registrar cada una por separado. La función las marca
  `sin_dato` SIEMPRE, cerrada o no la tarea — inventarlas como "hecha" en
  cuanto se cierra habría sido la regla 5 de seguridad clínica rota en
  código ("señalar de menos, nunca de más"). Es exactamente el mismo
  criterio que ya usó `InstrumentStrip` con "paciente actual" y `dashboard`
  con "PREPARED BY NEXUS": declarar la ausencia, no rellenarla.
- **`src/components/tareas/ProgresoResultado.tsx`** — pinta las ocho
  etiquetas como píldoras (`var(--r-pill)`, escala de fuente oficial
  10.5px): hecha/actual con color de texto normal/`--teal`, pendiente y
  sin_dato en `--text3`, sin_dato ADEMÁS en itálica para que no se confunda
  con "pendiente" a simple vista. `role="group"` con `aria-label` que lee
  la progresión completa para lector de pantalla (no sólo color).
- **`pendientes/page.tsx`** — la pista se pinta SÓLO cuando
  `esTareaDeResultado(t.tipo)` — nunca para seguimiento, receta,
  reconciliación u "otra": no son "un resultado" en el sentido de §9 y
  pintarles la pista sugeriría una progresión que no aplica (regla 5 otra
  vez). Recibe `estado`/`ownerUid`/`prioridad` de la MISMA `TareaClinica`
  que la página ya carga con `tareasVivas()` — no una lectura nueva.
- Guardianes nuevos, probados al revés (mismo patrón que sus hermanos de
  fase): `src/__tests__/progreso-resultado.test.ts` (el módulo puro — 19
  casos, entre ellos uno parametrizado que prueba, para los SEIS estados
  posibles, que DECISION/ACTION/PATIENT COMMUNICATION siguen en `sin_dato`
  — el caso que atraparía a alguien "arreglando" la función para que
  cerrada marcara las tres como hechas) y
  `src/__tests__/v15-progreso-resultado-conectado.test.ts` (que está
  conectado en `/pendientes` y que `ProgresoResultado.tsx` delega en el
  módulo puro en vez de reimplementar transiciones o abrir su propia
  consulta a Firestore). Verificado contra `git stash` del árbol previo:
  las 4 aserciones de conexión fallan (0 import, 0 compuerta), las 19 del
  módulo puro pasan igual porque no dependen del cableado.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
build de producción + `npm start` + siembra sintética). `sembrar-capturas.mjs`
ganó dos tareas de resultado más (`tarea-estudio-catalina` en `en_curso` con
dueño, `tarea-resultado-completado-aurelio` en `completada` con dueño) para
que las tres etapas alcanzables con dato real (Dueño/Revisión/Cerrado) se
vieran en sus tres puntos distintos, no siempre en el mismo. Arnés nuevo:
`scripts/design/capturar-progreso-resultado-v15.mjs`. Capturas y medición en
`docs/design/capturas/v15-progreso-resultado/` (desktop 1440 + mobile 390):

- **Las tres tarjetas, medidas con `getComputedStyle`, no leídas en JSX**:
  Urocultivo (solicitada, sin dueño) → Dueño en `--teal` (actual), Revisión y
  Cerrado en `--text3` (pendientes). Perfil lipídico y Espirometría
  (completada/en_curso, con dueño) → Dueño y Revisión en color de texto
  normal (hechas), Cerrado en `--teal` (actual). Las tres, sin excepción:
  Decisión/Acción/Aviso al paciente en `--text3` e itálica — confirmado
  `fontStyle: "italic"` en las nueve celdas (3 tarjetas × 3 etapas), nunca
  "hecha".
- **La compuerta de tipo, confirmada con datos reales**: "Seguimiento de
  EPOC" y "Confirmar si la metformina" (ninguno es tipo resultado) —
  `tienePista: false` en las dos, medido buscando `.nx-progreso-resultado`
  dentro de su tarjeta, no supuesto por el código fuente.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2, desktop) y `region`
  (2-3) — mismo fingerprint preexistente que todas las capturas V15
  anteriores (cajón móvil de `FlowRail`, banners fuera de landmark).
  Ninguna violación `color-contrast` en las píldoras nuevas.
- **Consola**: sólo el warning ya familiar de reconexión de Firestore del
  emulador, en desktop y en móvil.
- **Móvil**: las ocho píldoras envuelven en dos líneas sin desbordar,
  legibles a 390px (captura visual confirmada).

### Compuertas de esta corrida

- `npx vitest run`: 8781 pasan (26 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por
  el proxy de red del contenedor — no relacionado, mismo fallo documentado
  en corridas previas).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (la
  píldora nueva usa `var(--r-pill)` y `fontSize: 10.5`, ambos ya en la
  escala oficial — el primer borrador usaba `borderRadius: 9999` literal y
  `escala-visual-trinquete.test.ts` lo cazó como violación de "la píldora
  se escribe de una sola forma"; corregido antes de sellar).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — `/pendientes`
  sigue como ruta estática (`○`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/pendientes` bajó de 271 a
  259 líneas de fuente — el guardián `el-inventario-de-pantallas-no-miente`
  lo exigía; la baja es real: se reemplazó JSX inline repetido por el
  componente extraído).

**Pendiente de esta misma fase, para una corrida siguiente:**
- `PanelLaboratorios.tsx` sigue siendo la "tabla estática" literal que §9
  nombra como el patrón a evitar (upload + gráfica, cero enlace con
  `tareas_clinicas`). Conectarlo — por ejemplo, que subir un panel de
  laboratorio genere una `resultado_por_revisar` — es una decisión de
  FLUJO DE NEGOCIO (¿siempre? ¿sólo si hay valor crítico? ¿el médico ya
  está revisando en el momento de subir, así que sería una tarea nacida ya
  cerrada?), no sólo de presentación — cruzaría el congelamiento funcional
  de `§1` si se decide sin el dueño. Investigado y diferido a propósito,
  no un olvido.
- Las tres etapas `sin_dato` (DECISION/ACTION/PATIENT COMMUNICATION) son el
  hallazgo real de esta fase: hoy "cerrar" una tarea de resultado no deja
  constancia de QUÉ se decidió, QUÉ acción se tomó ni SI se avisó al
  paciente. Resolverlo de verdad (no fingiendo con la función de
  presentación) exigiría un campo nuevo opcional en `TareaClinica` y un
  pequeño formulario al cerrar — cambio de modelo, con su propia revisión,
  fuera de alcance de una rebanada de presentación. Candidato explícito
  para la siguiente rebanada de esta misma fase o para
  `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8), que ya trata la integración
  Note→Rx→Orders→Instructions→Follow-up.

## V15-RESULTS-CLOSURE-001 (Fase 6) — decisión de cierre y medición de §9 (11-ago-2026)

**Decisión, con razón escrita:** NO se implementa el campo de cierre
(decisión/acción/aviso al paciente) esta corrida. Es una extensión de
MODELO (`TareaClinica` ganaría campos nuevos, con su propio formulario al
cerrar) — cruza exactamente la línea que `§1` marca como "record the
dependency; do not silently modify logic; escalate only if truly
blocking": no es una decisión que un archivo de presentación deba tomar
sin el dueño (¿un formulario obligatorio? ¿opcional? ¿qué pasa con las
~8700 tareas que YA se cerraron sin ese dato?). Queda registrado como
dependencia pendiente de decisión del dueño, no como olvido.

**Medición de los 8 elementos de §9 contra el código actual** (mismo
método que la tabla de 9 comportamientos de §8 en `V15-ENCOUNTER-MODE-001`):

| Etapa (§9) | Estado | Evidencia |
|---|---|---|
| RESULT | **PASS** | La tarea existe — `progresoResultado()` la marca `hecha` siempre. |
| SIGNIFICANCE | **PASS** | `prioridad`, obligatoria desde que la tarea nace. |
| OWNER | **PASS** | `ownerUid`/`ownerNombre`, con su propia etapa `actual` cuando falta. |
| REVIEW | **PASS** | La progresión de `estado` (aceptada→en_curso→completada) enseña revisión real. |
| DECISION | **`sin_dato`, declarado** | No hay campo — ver decisión arriba. |
| ACTION | **`sin_dato`, declarado** | Ídem. |
| PATIENT COMMUNICATION | **`sin_dato`, declarado** | Ídem. |
| CLOSED | **PASS** | `estado === 'cerrada'`. |
| «status progression and next action, no tabla estática» | **PASS** | `ProgresoResultado` pinta las 8 etapas como pista, no un semáforo de 3; `siguientePaso()` ya daba «next action» desde antes de V15. |

5 de 8 etapas con dato real, 3 declaradas `sin_dato` con razón visible en
pantalla (itálica, no confundible con "hecha") — regla 5 de seguridad
clínica aplicada, no un hueco sin explicar. Con la pista conectada
(primera rebanada) y esta medición explícita, **`V15-RESULTS-CLOSURE-001`
(Fase 6) queda CERRADA** — sigue `V15-FOLLOWUP-WORK-001` (Fase 7, §10).

## V15-FOLLOWUP-WORK-001 (Fase 7, §10) — primera rebanada: agrupar `/pendientes` por estado de acción (11-ago-2026)

**Lo que pide §10:** «Group by action state, not by arbitrary module: needs
review · waiting on patient · waiting on result · needs scheduling · needs
communication · needs signature · overdue · closed recently.» Antes de esta
corrida, todo lo que no escalaba (crítico sin dueño / vencido, ya cubierto
por `debeEscalar`) caía en una sola sección plana «Abiertos (n)» — el
médico tenía que leerla entera para saber QUÉ está esperando cada tarea.

- **`src/lib/tareas-clinicas/estado-de-accion.ts`** (módulo puro, nuevo) —
  `estadoDeAccion()` deriva, de `tipo`/`estado`/`venceEn` (sin campo nuevo),
  CINCO de las ocho categorías de §10 con señal real e inequívoca:
  `vencida` (overdue, `estaVencida()`), `necesita_revision` (needs review:
  `tipo === 'resultado_por_revisar'` O `estado === 'completada'`),
  `esperando_resultado` (waiting on result: `tipo === 'estudio_pendiente'`),
  `necesita_agendar` (needs scheduling: `tipo === 'seguimiento'`),
  `esperando_paciente` (waiting on patient: `tipo === 'receta_por_entregar'`,
  cuyo propio texto de creación en `derivar.ts` dice «se cierra cuando el
  paciente la tiene»). **`cerrada_reciente` (closed recently) queda
  deliberadamente sin construir esta rebanada**: `tareasVivas()` EXCLUYE a
  propósito las tareas cerradas (comentario en `firestore.ts`: «Las tareas
  VIVAS»), así que mostrarlo exige una lectura nueva a Firestore, no sólo
  clasificar lo que ya está en memoria — candidata real para la siguiente
  rebanada, no un olvido. **`needs communication` y `needs signature` no
  tienen campo ni tipo que las distinga hoy** — inventar esa distinción
  habría sido la regla 5 de seguridad clínica rota en código; caen en
  `otros`, declarado, igual criterio que ya usó `progreso-resultado.ts` con
  `sin_dato`.
- **`pendientes/page.tsx`** — `resto` (lo que NO escala) ya no se pinta como
  una sección «Abiertos» única: se reparte con `ORDEN_ESTADO_DE_ACCION`
  (filtrando `vencida`, que ya vive en «Requiere atención» arriba) en hasta
  cinco secciones reales. `urgentes`/`debeEscalar` NO se tocaron — la
  escalación sigue exactamente igual que antes de esta corrida.
- Guardianes nuevos, probados al revés (mismo patrón que sus hermanos de
  fase): `src/__tests__/estado-de-accion.test.ts` (el módulo puro, 12
  casos, incluido que vencida gana sobre cualquier otra señal y que
  `reconciliacion_medicamento`/`indicacion_paciente`/`otra` caen en `otros`
  en vez de forzarse a una de las cinco) y
  `src/__tests__/v15-pendientes-agrupa-por-estado-de-accion.test.ts` (que
  la página importa y delega en el módulo puro, y que «Abiertos (» ya no
  existe). Verificado contra `git stash` del cambio en `page.tsx`: 4 de
  los 5 casos de este último fallan contra el árbol previo (el quinto,
  `debeEscalar` sin tocar, pasa igual porque protege algo que no se tocó).
- `scripts/design/sembrar-capturas.mjs` ganó dos tareas más (`receta_por_entregar`
  y `otra`, ninguna escalando) para que los grupos «Esperando al paciente»
  y «Otros pendientes» tuvieran algo real que enseñar — sin ellas, de las
  cinco tareas ya sembradas dos escalan (vencida / crítica-sin-dueño) y las
  otras tres sólo cubren tres de los cinco grupos no-vencidos.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
`sembrar-capturas.mjs` + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-estado-de-accion-v15.mjs`. Capturas y medición en
`docs/design/capturas/v15-estado-de-accion/` (desktop 1440 + mobile 390):

- **Los seis encabezados reales, con las tareas exactas que les
  corresponden — medido en el DOM, no supuesto**: «Requiere atención (2)»
  → Confirmar metformina + Urocultivo; «Necesita revisión (1)» → Perfil
  lipídico; «Esperando resultado (1)» → Espirometría; «Necesita agendar
  (1)» → Seguimiento de EPOC; «Esperando al paciente (1)» → Entregar
  receta; «Otros pendientes (1)» → Llamar a laboratorio externo. Coincide
  exactamente con lo que predice `estadoDeAccion()` para cada fixture
  sembrado.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2, desktop) y `region`
  (2-3) — mismo fingerprint preexistente que TODAS las capturas V15
  anteriores (cajón móvil de `FlowRail`, banners fuera de landmark).
  Ninguna violación de contraste en los encabezados nuevos.
- **Consola**: el warning ya familiar de reconexión de Firestore del
  emulador y el `401` de auditoría ya documentado en
  `v15-instrument-strip-paciente` (artefacto del arnés de emuladores, no de
  este cambio) — sin errores nuevos.
- **Móvil**: los seis grupos se apilan sin desbordar ni requerir CSS nuevo
  — la agrupación es puramente semántica (secciones/encabezados que ya
  existían como patrón), confirmado con la captura visual.

### Compuertas de esta corrida

- `npx vitest run`: 8798 pasan (17 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por
  el proxy de red del contenedor — no relacionado, mismo fallo documentado
  en todas las corridas previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila (con `.env.local` demo de emuladores, recreado
  esta corrida porque `node_modules`/`.env.local` no venían en el
  contenedor — `npm ci` corrido primero) — las 96 rutas del build salen
  limpias, ninguna nueva por este cambio.
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/pendientes` subió de 271
  a 297 líneas de fuente por la agrupación nueva).

## `V15-FOLLOWUP-WORK-001` (Fase 7, §10) — segunda rebanada: «closed recently» (11-ago-2026)

**Decisión tomada esta corrida, con razón escrita:** SÍ se construye la
lectura, pero BAJO DEMANDA — no en el `useEffect` que carga `tareasVivas()`
al montar `/pendientes`. Es la pantalla más visitada del médico; pagarle una
lectura más a Firestore en cada visita, para un dato que la mayoría de las
veces nadie va a mirar, es el costo que la tarea anterior dejó anotado sin
resolver. Cargarla sólo cuando el médico pulsa «Ver cerrados recientemente»
resuelve el §10 (la categoría existe y es real) sin ese costo por defecto.

- **`src/lib/tareas-clinicas/firestore.ts`** — `tareasCerradasRecientes()`,
  módulo nuevo junto a `tareasVivas()`: `where('estado', '==', 'cerrada')`,
  sin `orderBy` (mismo motivo que `tareasVivas()` — evitar el índice
  compuesto; el orden por fecha lo pone quien llama, en cliente). Sólo
  `cerrada`, nunca `cancelada`: son dos cierres semánticamente distintos
  («alguien revisó y decidió» contra «ya no aplica», que ya tiene su propio
  motivo visible en la bitácora) — mezclarlos habría sido inventar una
  categoría que §10 no pide.
- **`pendientes/page.tsx`** — botón «Ver cerrados recientemente» al pie de
  la pantalla, colapsado por defecto (`cerradas: TareaClinica[] | null`,
  `null` = no cargado todavía). Al pulsarlo, `verCerradas()` llama
  `tareasCerradasRecientes()` UNA vez y guarda el resultado; pulsarlo de
  nuevo sólo colapsa (`setCerradas(null)`), sin volver a leer. Las tareas
  cerradas se pintan con `TarjetaCerrada` — un componente NUEVO de sólo
  lectura, no `Tarjeta`: una tarea `cerrada` no tiene transición legal a
  ningún otro estado (`TRANSICIONES.cerrada = []` en `modelo.ts`), así que
  ofrecerle los mismos botones («Tomarla»/«Ya no aplica») sería una acción
  que `cambiarEstado` va a rechazar — la UI prometería algo que el modelo ya
  niega.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-cerrados-recientes-conectado.test.ts` — 4 de sus 5
  casos fallan contra el árbol previo a este cambio (verificado con
  `git stash` de los dos archivos de código, dejando sólo la prueba nueva):
  que `tareasCerradasRecientes` exista y filtre por `cerrada` sin tocar
  `cancelada`, que la página la importe, que NO se llame dentro del
  `useEffect` de montaje, que se llame dentro de un callback aparte, y que
  las tareas cerradas usen `TarjetaCerrada` (sin el botón «Ya no aplica»).
- Trinquete de diseño: el primer borrador de `TarjetaCerrada` copió los
  mismos `fontSize` fuera de escala que ya tenía `Tarjeta` (11/15/13,
  ninguno en la escala oficial `{10.5,12,14,16,20,28}`) — como el nuevo
  componente los REPITE en vez de sólo heredarlos, cada aparición cuenta
  aparte y el trinquete subió de 2003 a 2007. Corregido a 10.5/14/12 (los
  valores de la escala oficial más cercanos) antes de sellar — no se subió
  el techo, y de paso `TarjetaCerrada` no repite la deuda ya conocida de
  `Tarjeta`.
- `scripts/design/sembrar-capturas.mjs` ganó una tarea más en `estado:
  'cerrada'` (`tarea-cerrada-luzmaria`, radiografía sin hallazgos) — sin
  ella, `tareasCerradasRecientes()` no tenía nada real que devolver en el
  arnés de capturas (las ocho tareas sembradas hasta ahora paraban en
  `completada`, nunca llegaban a `cerrada`).

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
siembra sintética + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-cerrados-recientes-v15.mjs` — mide la interacción
completa, no sólo una captura. Resultado en
`docs/design/capturas/v15-cerrados-recientes/resultado.json` (desktop 1440 +
mobile 390):

- **Antes de pulsar nada, la carga es de verdad bajo demanda**: con la
  pantalla ya cargada y el botón diciendo «Ver cerrados recientemente», la
  tarea cerrada («Radiografía de tórax») NO está en el DOM
  (`radiografiaEnDOM: false`) — no es un placeholder oculto con CSS, no está
  ahí.
- **Al pulsar, la lectura trae el dato real**: `radiografiaEnDOM: true`,
  `textoCerrada: true` («Cerrada 09-ago» en la tarjeta), y el botón cambia a
  «Ocultar cerrados recientemente» — medido con `document.evaluate`/
  `querySelectorAll`, no supuesto por el código.
- **La tarjeta cerrada es de sólo lectura, confirmado en el DOM real**:
  `tarjetaTieneYaNoAplica: false` — ningún botón «Ya no aplica» en la
  tarjeta de la tarea cerrada, a diferencia de cualquier `Tarjeta` normal.
- **Colapsar no deja rastro**: al pulsar «Ocultar», `radiografiaEnDOM`
  vuelve a `false` y el botón vuelve a decir «Ver cerrados recientemente» —
  el estado es realmente `null`, no `display: none` sobre datos que se
  quedaron en memoria (aunque tampoco importaría clínicamente si lo
  estuviera; se verificó igual).
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2, desktop) y `region`
  (2-3) — mismo fingerprint preexistente que TODAS las capturas V15
  anteriores (cajón móvil de `FlowRail`, banners fuera de landmark).
  Ninguna violación de contraste en `TarjetaCerrada`.
- **Consola**: el único hallazgo es el `401` de auditoría del emulador
  (`login_exitoso` rechazado) ya documentado en `v15-instrument-strip-paciente`
  y corridas posteriores — artefacto conocido del arnés de emuladores, no de
  este cambio.
- **Hallazgo operativo de esta corrida**: el tour de bienvenida
  (`OnboardingTour.tsx`, primera vez del uid en ese navegador) tapa la
  pantalla con un modal («Bienvenida a Ausculta») que ningún arnés previo de
  esta fase había necesitado descartar (sus interacciones no requerían
  pulsar nada bajo el modal). Se descarta con su botón
  `aria-label="Saltar"` antes de interactuar — anotado en el arnés nuevo
  para que scripts futuros que SÍ necesiten hacer clic en la pantalla lo
  reutilicen.

### Compuertas de esta corrida

- `npx vitest run`: 8799 pasan (5 nuevos), 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — mismo fallo documentado en todas las corridas
  previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva tras la
  corrección de `fontSize` (ver arriba) — resellado, el techo no subió.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — `/pendientes`
  sigue como ruta estática (`○`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`el-inventario-de-pantallas-no-miente`
  lo exigía porque `pendientes/page.tsx` cambió de tamaño).

Con las cinco categorías de la primera rebanada más «closed recently» de
ésta (seis de ocho con señal real), y «needs communication»/«needs
signature» declaradas sin campo propio (razón ya escrita en la cabecera de
`estado-de-accion.ts`, regla 5 de seguridad clínica), **los 8 elementos de
§10 quedan resueltos o legítimamente declarados sin dato —
`V15-FOLLOWUP-WORK-001` (Fase 7) puede darse por CERRADA.**

## Siguiente tarea exacta

`V15-NOTE-PLAN-CONTINUITY-001` (Fase 8, §33): «Integrate Note → Rx → Orders
→ Instructions → Follow-up» — la fase que `V15-PATIENT-WORKSPACE-001`
(tercera rebanada, sección "Active Patient Canvas, DECISIÓN" arriba) y
`V15-ENCOUNTER-MODE-001` (comportamiento #9 de §8) ya identificaron y
diferieron a propósito hacia aquí: `onGenerarReceta`/`onGenerarOrden`
navegando a `/receta`/`/orden` en vez de vivir inline. Empezar releyendo
§8 (comportamiento #9), §33 (Fase 8) y las dos decisiones ya tomadas antes
de tocar código — la pregunta de qué significa "integrar sin salirse de
fase" para esas dos rutas ya tiene contexto escrito, no hay que
redescubrirlo.

**Deuda anotada, no bloqueante (heredada de fases previas, sigue sin
resolverse, candidata a fases futuras — no se repite su detalle si ya está
arriba):**
- `BottomNav.tsx` no se suscribe a `EVENTO_GRABANDO` → `V15-MOBILE-001`
  (Fase 9).
- `landmark-unique` (cajón móvil `FlowRail`) y `region` (banners fuera de
  landmark) → `V15-A11Y-001` (Fase 13).
- `color-contrast` (encabezado teal de "Análisis basado en evidencia",
  3.03:1) y `heading-order` (`<h4>Sus medicamentos</h4>` de la hoja para el
  paciente) → también `V15-A11Y-001`.
- La diarización completa (`/api/expediente/transcribir-diarizado`) cuelga
  en `audio.estado === 'subiendo'` en este sandbox concreto incluso con la
  respuesta del proveedor mockeada — causa no confirmada. Cualquier arnés
  futuro que necesite llegar a `audio.estado === 'listo'` debe investigarlo
  primero o levantar también el emulador de Storage.
- El campo de cierre (decisión/acción/aviso al paciente) de §9 sigue sin
  construirse — decisión de modelo pendiente del dueño, ver arriba, no
  bloqueante para cerrar Fase 6.
- Esta corrida encontró `node_modules` y `.env.local` ausentes del
  contenedor al arrancar — `npm ci` (45s) y un `.env.local` demo
  (`NEXT_PUBLIC_FIREBASE_EMULATORS=1`, proyecto `demo-nexusmed-test`)
  resolvieron ambos sin tocar nada del repositorio (`.env.local` está en
  `.gitignore`). Anotado por si la próxima corrida ve el mismo estado
  limpio del contenedor y quiere ir directo al mismo arreglo.

## Reglas de la corrida (recordatorio)

- Una sola rama V15; sin PR nuevo por corrida; nunca force-push.
- Estructura antes que piel; greybox antes de estilo — ya aplicado al código,
  no sólo a una revisión puntual.
- Lógica clínica/negocio congelada: ningún cambio de esta corrida tocó una
  ruta de API, una regla de Firestore ni un cálculo clínico.
- Móvil: `V15-MOBILE-001` (Fase 9) sigue pendiente; `BottomNav` no se tocó.


## Nota de CI — PR #292 (11-ago-2026)

`e2e-publico` (A3 · /operaciones anti-clickjacking) sale rojo en el PR y es
**esperado**, no un defecto: `e2e/seguridad.spec.ts` corre contra
PRODUCCIÓN a propósito (sin `PLAYWRIGHT_BASE_URL` en el job), y `/operaciones`
todavía no está desplegada ahí. Mismo patrón que REG-054/REG-062 en
`docs/audit/regression-ledger.md`: «CLOSED en código, PENDIENTE DE
DESPLIEGUE». Verificado local (`next build && next start`) que la cabecera
sale correcta. No tocar el workflow para «arreglarlo» — se resuelve solo al
fusionar y desplegar. Detalle en el comentario del PR.

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8, §33 / §20) — primera rebanada: el checklist de cierre recuerda lo hecho (11-ago-2026)

Empezó releyendo exactamente lo que dejó escrito la corrida anterior: §8
(comportamiento #9), §33 (Fase 8) y las dos decisiones ya tomadas
(`onGenerarReceta`/`onGenerarOrden` diferidos a propósito a esta fase). Antes
de tocar código se releyó `ComoCerrarLaConsulta.tsx` (REG-244) completo —
y ahí apareció el hueco real de esta fase, no en `/receta` ni `/orden`:

**El componente sabía DECIR lo que ya se hizo (`hechos?: readonly
string[]`) y nadie se lo decía.** `grep hechos=` en
`/consulta/[patientId]/page.tsx`, su único punto de montaje, no daba nada —
la prop nunca se pasaba. Es el patrón de `.claude/rules/el-dato-tiene-que-llegar.md`
(«escrito y sin conectar»), encontrado dentro de la propia pieza que la Fase 8
pide continuar. Segundo hueco emparentado, mismo archivo: el paso
`hoja_del_paciente` llevaba `ruta: null` desde REG-244 («vive en la propia
consulta: no hay a dónde ir»), pero `ComoCerrarLaConsulta` deshabilita
cualquier botón sin `ruta` — el paso aparecía en la lista y NUNCA se podía
pulsar ni marcar hecho. Un botón muerto disfrazado de tarea.

**Decisión de alcance, con razón escrita:** NO se intentó volver
`/receta`/`/orden` inline dentro de `/consulta` esta corrida. Son
generadores de receta/orden con motores de seguridad completos (dosis,
interacciones, alergias, ajuste renal) — moverlos adentro es el trabajo
grande de Fase 8 y merece su propia corrida, no una decisión apurada al
final de ésta. Lo que SÍ se arregló es más chico, real, y ya estaba
DECLARADO por el propio componente REG-244 sin construirse: que el
checklist de cierre recuerde de una vuelta a otra qué ya se hizo, y que
«Darle sus instrucciones» deje de ser un botón que no hace nada.

- **`src/lib/expediente/cierre-hechos.ts`** (nuevo, casi-puro) —
  `leerHechosDeCierre`/`marcarHechoDeCierre`, sobre `sessionStorage`
  (clave `nx-cierre-hechos:<notaId>`), no Firestore: es estado de esta
  pestaña sobre esta nota — «ya se hizo»—, no un hecho clínico. Nada que
  auditar, nada que respaldar, nada que otro consultorio necesite leer.
- **`src/lib/expediente/que-falta-para-cerrar.ts`** — el paso
  `hoja_del_paciente` pasa de `ruta: null` a `ruta: '#hoja-para-el-paciente'`.
  `aDondeIrDirecto` lo sigue excluyendo del conteo de «un solo destino → se
  va directo» (ya lo excluía por `que`, no por `ruta`), así que el caso
  simple (un solo destino real) sigue sin tocarse — verificado con la
  batería `la-orden-no-se-queda-en-el-tintero.test.ts` completa en verde.
- **`src/components/HojaParaElPaciente.tsx`** — `id="hoja-para-el-paciente"`
  para que el ancla tenga a dónde ir de verdad, y una prop nueva
  `onInteraccion?: () => void` que dispara al copiar O al imprimir (las dos
  cuentan como «se usó», no sólo «se vio» — a propósito, ninguna de las dos
  es más válida que la otra).
- **`/consulta/[patientId]/page.tsx`** — `hechosCierre` (estado, inicializado
  perezosamente desde `leerHechosDeCierre(notaIdParam)` — el caso que
  importa: volver de `/receta`/`/orden` con `useSmartBack` trae la MISMA
  URL con `?nota=...`, y esto la recupera aunque Next remonte la pantalla).
  `alIr` ya no hace SIEMPRE `router.push`: si la ruta empieza con `#`, hace
  `scrollIntoView` en vez de navegar; si es `/receta` o `/orden`, marca el
  paso hecho ANTES de salir. **A propósito NO se sincroniza con un
  `useEffect` cuando `notaId` cambia DESPUÉS del montaje** — ese id nuevo
  nunca tuvo entrada en `sessionStorage` (nota recién creada), así que
  `leerHechosDeCierre` daría `[]` de todos modos, igual al estado inicial;
  añadir el efecto sólo habría repetido, al revés, el mismo defecto que ya
  tiene `uuidRespaldoRef` un poco más arriba (`react-hooks/refs`) — y el
  trinquete de lint (techo 96, sin margen) lo habría cazado igual. Motivo
  completo en el comentario del código, no sólo aquí.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-cierre-recuerda-lo-hecho.test.ts` — el módulo puro
  (con una ventana `sessionStorage` fake, patrón ya usado en
  `salir-seguro.test.ts`) y una batería «está CONECTADO» que falla si se
  deshace cualquiera de los cinco cables (import, `hechos=`, marcar antes de
  navegar, el `#` que no navega, el ancla real, el aviso desde
  `HojaParaElPaciente`). Verificado con `git stash` del código (dejando sólo
  la prueba): el archivo entero falla al cargar (`Cannot find package
  '@/lib/expediente/cierre-hechos'`) — no hay ambigüedad de que sin el
  cambio, la prueba no pasa.

### Verificado en navegador real (11-ago-2026)

Emuladores Auth/Firestore reales + siembra sintética + build de producción +
`npm start` (arnés nuevo: `scripts/design/capturar-cierre-recuerda-lo-hecho-v15.mjs`).
A diferencia de otras capturas de esta rama, aquí hacía falta un encuentro
REAL con dos destinos a la vez (medicamentos Y estudios) para que
`ComoCerrarLaConsulta` se quedara en pantalla — se llegó por Valoración
Inmunocomprometido (motivo «Profilaxis antiinfecciosa», huésped «VIH»), no
mockeando IA. Resultado completo en
`docs/design/capturas/v15-cierre-recuerda-lo-hecho/resultado.json`:

- **El checklist recuerda de verdad, medido en el DOM, no supuesto**: tras
  firmar, «Imprimir la orden de estudios» se pulsa (marca `'orden'` en
  `sessionStorage`, confirmado leyendo la clave real:
  `nx-cierre-hechos:<notaId>` → `["orden","hoja_del_paciente"]`); al volver
  a la nota, «Darle sus instrucciones» pasa de opacidad `1` a `0.55` en
  cuanto se pulsa «Copiar» en la hoja del paciente — captura
  `03-hoja-marcada.png` lo enseña con el círculo verde ✓ real.
- **El ancla funciona sin navegar**: pulsar «Darle sus instrucciones»
  mantiene la URL EXACTA (`sinNavegar: true`) y desplaza
  `#hoja-para-el-paciente` hasta 2px del borde superior del viewport
  (`hojaEnViewport.enViewport: true`) — medido con
  `getBoundingClientRect()`, no leído del JSX.
- **Axe, sin violaciones nuevas**: mismas cuatro familias preexistentes ya
  documentadas en capturas V15 anteriores (`color-contrast` del encabezado
  teal de evidencia, `heading-order`, `landmark-unique` del cajón móvil de
  `FlowRail`, `region` de banners fuera de landmark) — ninguna en el
  checklist ni en la hoja del paciente.
- **Consola**: sólo los artefactos ya documentados del arnés de emuladores
  (401 de auditoría, Firestore offline) — sin errores nuevos.

**Hallazgo de esta corrida, anotado y NO arreglado — condiciona el alcance
real de esta pieza:** `router.back()` (el que usa `useSmartBack` en
`/receta` y `/orden`) NO conserva el contexto de `/consulta` en el caso más
común. `firmar()` nunca escribe el `notaId` en la URL — vive sólo en estado
de React — así que la URL tras firmar sigue siendo `/consulta/[patientId]`
SIN `?nota=...`. Volver desde `/orden` con el botón real de esa pantalla no
encuentra ningún id que releer y el panel entero desaparece (`firmada`
vuelve a `false`), sin que el `sessionStorage` de esta corrida tenga
oportunidad de mostrarse. Verificado también: recargar la nota firmada
explícitamente con `?nota=<id>` (lo que hace un médico que reabre una nota
ya firmada desde el expediente) SÍ conserva `firmada=true` y SÍ deja ver el
checklist con las marcas — pero ahí aparece un SEGUNDO hueco, hermano del
primero: el paso «orden» desaparece de la lista entera (no se pinta
apagado, se pinta INEXISTENTE) porque `estudiosOrden` — a diferencia de
`secciones`/`diagnosticos`/`medicamentos` — nunca se restaura desde
Firestore en el efecto de carga de la nota (`setFirmada(n.estado ===
'firmada')` y sus vecinas no incluyen `setEstudiosOrden(n.estudiosOrden)`).
Los dos son huecos de continuidad PREVIOS a esta corrida («el dato tiene que
LLEGAR», hermana) — no se tocaron aquí porque arreglarlos de verdad exige
decidir CUÁNDO escribir el `notaId` en la URL (¿en cada autoguardado? ¿sólo
al firmar?) y si `estudiosOrden` debe persistirse como campo propio de la
nota o derivarse de otra fuente — ninguna de las dos es una decisión de
presentación pura, y las dos merecen su propia corrida. Candidatos fuertes
para la siguiente rebanada de `V15-NOTE-PLAN-CONTINUITY-001`.

### Compuertas de esta corrida

- `npx vitest run`: 8813 pasan (14 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por
  el proxy de red del contenedor — no relacionado, mismo fallo documentado
  en todas las corridas previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva (el primer
  borrador SÍ subió el techo a 97 con un `react-hooks/set-state-in-effect`
  nuevo — corregido quitando el `useEffect` en vez de subir el techo, ver
  el comentario en el código).
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (con `.env.local` demo de emuladores,
  recreado esta corrida — `npm ci` primero porque `node_modules` no venía
  en el contenedor).
- `docs/design/SCREEN_INVENTORY.md` regenerado dos veces (el tamaño de
  `/consulta/[patientId]` cambió dos veces: al insertar el código y al
  corregir el lint).

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8) — tercera rebanada: `firmar()` refleja el notaId en la URL (11-ago-2026)

Empezó exactamente donde la corrida anterior lo dejó escrito: de los dos
huecos («la URL sin `?nota=`» y «`estudiosOrden` no se restaura»), el
primero es la causa raíz y el segundo es su síntoma más visible en el
checklist. Se arreglaron los dos, en el mismo archivo, en el mismo efecto.

- **`firmar()` (`/consulta/[patientId]/page.tsx`)** — justo después de
  `setFirmada(true)`, con el `id` ya definitivo (creado o reusado),
  `router.replace(`/consulta/${patientId}?nota=${id}`)`. **`replace`, no
  `push`**: no es una navegación nueva, es la misma pantalla diciendo la
  verdad sobre qué nota tiene abierta — un `push` habría ensuciado el
  historial con una entrada extra. Corre ANTES de cualquier
  `router.push(destino)` hacia `/receta`/`/orden`, así que la entrada de
  historial que queda atrás YA lleva `?nota=`.
- **El efecto "Cargar nota existente" (mismo archivo)** — ganó
  `if (Array.isArray(n.estudiosOrden)) setEstudiosOrden(n.estudiosOrden)`,
  al lado de `setFirmada(n.estado === 'firmada')`. A diferencia de
  `secciones`/`diagnosticos`/`medicamentos`, este campo nunca se leía de
  vuelta desde Firestore — con la URL ahora llevando `?nota=`, remontar la
  pantalla (volver de `/orden`, o F5 sobre una nota firmada) SÍ dispara este
  efecto, y sin esta línea el paso «Imprimir la orden de estudios»
  desaparecía de `ComoCerrarLaConsulta` en vez de pintarse marcado.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-firmar-refleja-la-url.test.ts` — sus 6 casos fallan
  contra el árbol previo a este cambio (verificado con `git stash` de
  `page.tsx`, dejando sólo la prueba nueva).

### HALLAZGO SEPARADO, IMPORTANTE, NO ARREGLADO AQUÍ: `useSmartBack` nunca hace back de verdad en esta versión de Next

Verificando el arreglo de arriba con el botón "Atrás" REAL de `/orden`
(no `page.goBack()`) apareció un defecto distinto y más grande:
`useSmartBack` decide entre `router.back()` y su `fallback` mirando
`window.history.state.idx` — y en Next.js 16.2.12 (App Router) **ese campo
no existe nunca**. Confirmado con dos scripts de diagnóstico aparte
(`node -e`, no el arnés): con navegación por `page.goto` Y con click SPA
real sobre un `<a>` del `FlowRail`, `window.history.state` sólo trae
`{ __NA, __PRIVATE_NEXTJS_INTERNALS_TREE }` — nunca `idx`. `idx ?? 0 > 0`
es SIEMPRE falso, así que el botón "Atrás" de **las diez pantallas** que
usan `useSmartBack` (`/receta`, `/orden`, `/nota`, `/expediente`,
`/referencia`, `/hospitalizacion/[id]`, `/hospitalizacion/camas`,
`/hospitalizacion/unidades`, `/hospitalizacion/indicadores`, `/uci/*`)
**nunca hace `router.back()` — siempre navega a su `fallback` fijo**,
aunque el usuario sí venga de una navegación real dentro de la app.

Medido en el arnés nuevo (`urlTrasBotonApp`): pulsar "Atrás" en `/orden`
lleva a `/expediente/[patientId]` (el `fallback` de esa pantalla), NO a
`/consulta/[patientId]?nota=...` — aunque la URL de `/consulta` YA es
correcta desde este cambio. Es decir: el arreglo de esta corrida sí
funciona con el atrás NATIVO del navegador (Alt+Izquierda, gesto, botón
del propio navegador — verificado, ver abajo) pero el botón "Atrás" QUE
PINTA LA APP en esas diez pantallas sigue sin beneficiarse, porque el
defecto está en cómo decide entre back y fallback, no en qué URL dejó
`/consulta` atrás.

**No se arregla en esta rebanada** — es un defecto de una pieza compartida
por diez pantallas, con su propia causa (una API de Next que cambió de
forma entre versiones, coherente con el aviso de `AGENTS.md`: "This is NOT
the Next.js you know"), y merece su propia investigación de cuál señal SÍ
existe en `window.history.state` en esta versión para reemplazar `idx` —
no una decisión apurada al cierre de esta corrida. Candidato fuerte y de
alto impacto para la siguiente rebanada de `V15-NOTE-PLAN-CONTINUITY-001`
o su propia unidad: mientras siga así, "el checklist recuerda lo hecho"
(rebanada anterior) sólo se experimenta con back nativo del navegador, no
con el botón que la propia app pinta.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales
+ siembra sintética + build de producción + `npm start`; `node_modules`
volvió a faltar al arrancar el contenedor — `npm ci` de nuevo, sin tocar el
repo). Arnés nuevo: `scripts/design/capturar-firmar-refleja-url-v15.mjs`
— repite el mismo camino de la corrida anterior (Valoración Inmuno,
medicamentos Y estudios a la vez) pero mide el atrás NATIVO por separado
del botón de la app. Resultado completo en
`docs/design/capturas/v15-firmar-refleja-url/resultado.json`:

- **La URL lleva `?nota=` INMEDIATAMENTE al firmar**, antes de navegar a
  ningún lado: `urlTrasFirmar` = `.../consulta/pac-aurelio-dominguez?nota=Gdp8OdahhFtynBkRgZw1`.
- **Atrás NATIVO del navegador (`page.goBack()`) SÍ conserva el contexto,
  medido de verdad**: `urlTrasVolver` conserva el mismo `nota=`
  (`conservaNotaId: true`), `panelTrasVolver: true`, `firmadaBadgeTrasVolver:
  true` — el checklist de cierre YA NO desaparece, que es exactamente el
  defecto que esta rebanada corrige.
- **El checklist recuerda lo hecho, confirmado en el DOM real**: tras
  volver, "Imprimir la orden de estudios" está en opacidad `0.55` (marcado
  — el mismo patrón que ya probó la rebanada anterior), y sigue en la lista
  en absoluto — **prueba indirecta pero real de que `estudiosOrden` se
  restauró**: si `estudiosOrden.length` hubiera vuelto a 0, ese paso ni
  aparecería (`hayEstudios: estudiosOrden.length > 0` lo condiciona).
- **F5 sobre la URL con `?nota=` sobrevive**: `panelTrasRecargar: true` tras
  una recarga dura, no sólo una navegación SPA.
- **El hallazgo separado, medido, no supuesto**: el botón "Atrás" de la
  app en `/orden` navegó a `/expediente/pac-aurelio-dominguez`
  (`fueAlFallbackFijoEnVezDeConsulta: true`).
- **Axe, 0 violaciones nuevas**: las cuatro familias ya conocidas y
  preexistentes de toda esta rama (`color-contrast` del encabezado teal de
  evidencia, `heading-order`, `landmark-unique` del cajón móvil de
  `FlowRail`, `region` de banners fuera de landmark) — ninguna nueva.
- **Consola**: sólo los artefactos ya documentados del arnés de emuladores
  (401 de auditoría) — sin errores nuevos.

### Compuertas de esta corrida

- `npx vitest run`: 8825 pasan (6 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, confirmado con `git stash` que
  falla igual en el árbol limpio — proxy de red del contenedor, no
  relacionado; documentado en todas las corridas previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo recreado esta
  corrida — emuladores, proyecto `demo-nexusmed-test`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/consulta/[patientId]`
  cambió de tamaño por las dos líneas + comentarios nuevos).

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8) — cuarta rebanada: `useSmartBack` ahora sí regresa de verdad (11-ago-2026)

Empezó exactamente donde la corrida anterior lo dejó escrito: releyendo la
sección "HALLAZGO SEPARADO" con la causa raíz ya diagnosticada
(`window.history.state.idx` no existe en Next 16.2.12) y las dos vías
propuestas (investigar una señal real de Next, o el `fallback` calculado
como respaldo). Antes de tocar código se confirmó la causa raíz en el
propio paquete instalado: `grep -n "idx" node_modules/next/dist/client/components/app-router.js`
no encuentra nada — `HistoryUpdater` reescribe `window.history.state` con
`useInsertionEffect` en CADA render (`__NA` + `__PRIVATE_NEXTJS_INTERNALS_TREE`),
incluida la primerísima entrada de la pestaña — y el propio archivo deja el
comentario `// TODO: Use Navigation API if available`, que es exactamente
la señal que faltaba.

- **`src/hooks/useSmartBack.ts`** — se quitó `window.history.state.idx` y se
  reemplazó por `window.navigation.currentEntry.index` (la Navigation API
  del NAVEGADOR, mantenida fuera del control de Next: sube con cada `push`
  real, se queda igual con un `replace` —como el que usa `firmar()` desde
  la rebanada anterior—, baja con un retroceso real). Se extrajeron dos
  funciones puras y exportadas para poder probarlas sin `renderHook` ni
  jsdom (el proyecto corre en `environment: 'node'`): `profundidadDeNavegacion()`
  (lee `window.navigation?.currentEntry?.index`, `undefined` si no existe la
  API o si `window` no existe) y `sePuedeRegresarDeVerdad(profundidad)`
  (`true` sólo si es un número mayor que 0).
- **Decisión de alcance, con razón escrita**: en navegadores SIN Navigation
  API (Firefox, Safari antiguos) NO se reimplementó el historial a mano con
  un contador propio en `sessionStorage` — contar `push`/`replace`/`back`
  por fuera del navegador se desincroniza de su historial real, con su
  propio riesgo de error, y el `fallback` YA es un destino lógico válido.
  El comportamiento en esos navegadores queda IDÉNTICO al de antes de esta
  corrida (siempre `fallback`, cero regresión); la mejora aplica donde la
  API existe (Chromium: Chrome, Edge, el navegador de este mismo arnés).
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-smart-back-navigation-api.test.ts` — 10 casos, los 10
  fallan contra el árbol previo a este cambio (verificado con `git stash`
  de `useSmartBack.ts`): unos porque el import de `profundidadDeNavegacion`/
  `sePuedeRegresarDeVerdad` no existía, otros porque el código viejo seguía
  mencionando `history.state`/`idx`.

### Verificado en navegador real (11-ago-2026), DOS de las diez pantallas, con el botón "Atrás" DE LA APP

Primero se verificó el mecanismo suelto (Chromium real, páginas públicas
`/login` → `/registro` → atrás nativo, sin emuladores): `index=0` al cargar
directo, `index=1` tras un clic SPA real en un `<a>`, `index=0` de vuelta
tras el atrás — exactamente la semántica que `idx` pretendía tener y nunca
tuvo.

Después, el camino completo con emuladores Auth/Firestore + siembra
sintética + build de producción + `npm start` (mismo método que todas las
corridas de esta fase), arnés nuevo:
`scripts/design/capturar-atras-de-la-app-v15.mjs`. A diferencia de la
corrida anterior (que probó `page.goBack()`, el atrás NATIVO del
navegador), esta pulsa el botón **"Atrás" que pinta la propia app** — el
`onClick={volver}` real de `useSmartBack` — en `/orden` y en `/receta`.
Resultado completo en
`docs/design/capturas/v15-atras-de-la-app/resultado.json`:

- **`/orden`**: `indiceNavAlLlegarOrden: 3` (Navigation API real, no
  supuesta). Botón "Atrás" pulsado → `urlTrasBotonOrden` es
  `/consulta/pac-aurelio-dominguez?nota=VUmCrc1X966zgluDyfSC` —
  `volvioAConsultaConNota: true`, `fueAlFallbackFijoDeExpediente: false`
  (el defecto que corrige esta rebanada, medido en cero). El checklist de
  cierre («Ya está firmada. Falta esto») sigue visible tras volver:
  `panelTrasVolverDeOrden: true`.
- **`/receta`**: mismo resultado — `indiceNavAlLlegarReceta: 3`,
  `urlTrasBotonReceta` de vuelta en `/consulta/...?nota=...`,
  `volvioAConsultaConNota: true`, `fueAlFallbackFijoDeExpediente: false`.
- **Axe, 0 violaciones nuevas**: las mismas familias preexistentes ya
  documentadas en corridas anteriores de esta fase (`color-contrast`,
  `heading-order`, `landmark-unique`, `region`) — este cambio no tocó JSX
  de ninguna pantalla, sólo la función de decisión del hook.
- **Consola**: sólo los artefactos ya conocidos del arnés de emuladores
  (401 de auditoría, Firestore offline) — sin errores nuevos.

Con esto, el hallazgo que la corrida anterior dejó anotado como "el más
lejano y el más caro" queda cerrado: el botón "Atrás" de las diez pantallas
que usan `useSmartBack` ahora sí regresa a la pantalla anterior real cuando
el médico navegó dentro de la app — verificado con dos de las diez, no
supuesto por extensión al resto (las otras ocho comparten exactamente el
mismo hook sin ninguna lógica por pantalla, así que el riesgo de que se
comporten distinto es bajo, pero no se afirma "diez de diez verificadas").

### Compuertas de esta corrida

- `npx vitest run`: 8839 pasan (10 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, confirmado en aislamiento que
  también falla contra el árbol limpio — proxy de red del contenedor, no
  relacionado; documentado en todas las corridas previas de esta rama).
  `la-agenda-es-un-riel` se vio fallar por timeout una vez en la corrida
  completa en paralelo y pasar en aislamiento y con `testTimeout` más
  alto — contención de recursos, mismo patrón ya documentado en
  `V15-PATIENT-WORKSPACE-001`, no relacionado con este cambio (confirmado
  con `git stash` de `useSmartBack.ts`: falla igual sin el cambio).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (este
  cambio no tocó CSS ni JSX).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo recreado esta
  corrida — `npm ci` primero porque `node_modules` no venía en el
  contenedor, mismo hallazgo operativo de todas las corridas previas).

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8, §33) — quinta rebanada: el cierre agenda el seguimiento (11-ago-2026)

La cadena de §33 Fase 8 es «Note → Rx → Orders → Instructions → Follow-up»
y el último eslabón no existía en el cierre: el médico ponía fecha en
«Próxima consulta», la firma derivaba la tarea del worklist… y el checklist
de cierre no decía nada — la cita se agendaba después, desde `/pendientes`,
con el paciente ya ido. Tres cables conectados, todos del patrón «escrito y
sin conectar»:

- **`que-falta-para-cerrar.ts`** — paso nuevo `seguimiento` («Agendar el
  seguimiento» → `/citas?d=<fecha>`), SÓLO si el médico puso fecha con
  forma ISO exacta (lo único que `paramFecha` de /citas sabe leer — otra
  cosa aterrizaría en «hoy» sin avisar). **No fuerza el panel**
  (`aDondeIrDirecto` lo excluye, razón exportada
  `POR_QUE_EL_SEGUIMIENTO_NO_FUERZA_EL_PANEL`): a diferencia de la orden de
  REG-244, el seguimiento ya tiene red — la tarea del worklist — y forzar el
  panel añadiría un clic a la consulta más común para proteger algo ya
  protegido. El caso común (sólo receta) sigue yendo directo, verificado
  por la batería vieja `la-orden-no-se-queda-en-el-tintero.test.ts` en verde
  sin tocarse.
- **`page.tsx`** — pasa `proximoSeguimiento` al motor de cierre; `alIr`
  marca `seguimiento` hecho ANTES de salir a `/citas` (mismo patrón que
  receta/orden); y `HojaParaElPaciente` deja de recibir
  `proximaCita={undefined}` — el motor (`comoSeLoExplico`, REG-242) tenía el
  bloque «Su próxima cita» desde su primer día y esta pantalla nunca se lo
  alimentó. En la hoja va en palabras (`formatDateMX`): el paciente lee
  «martes, 8 de septiembre de 2026», no «2026-09-08».
- **`cierre-hechos.ts`** — pareja nueva `guardarSeguimientoDeCierre`/
  `leerSeguimientoDeCierre` (`sessionStorage`, mismo criterio escrito del
  módulo): la nota NO guarda `proximoSeguimiento` (va al paciente y a la
  tarea; añadirle el campo sería cambio de esquema congelado por §1), así
  que al volver de `/citas` el remonte dejaba el paso INEXISTENTE — ni
  marcado ni pendiente. Lo encontró el propio arnés de esta rebanada
  (`marcado: null` en la primera pasada), no una lectura del código.
  `firmar()` guarda la fecha; el estado la recupera con inicialización
  perezosa al remontar.

### REG-310 — hallazgo de esta corrida, ARREGLADO y sellado

Verificando lo anterior contra el emulador apareció un defecto PREVIO y más
serio: `firmar` es un `useCallback` sin `proximoSeguimiento` en sus
dependencias (ni en las de `construirNota`), así que teclear la fecha como
ÚLTIMO gesto antes de firmar — el orden natural — dejaba el callback con la
fecha memorizada `''`: **la tarea «Agendar el seguimiento» de REG-300 nunca
nacía y `patient.proximoSeguimiento` (contador del CRM) nunca se
actualizaba**, mientras la pantalla pintaba todo correcto. Medido, no
supuesto: 5 firmas con fecha → `estudio_pendiente`/`receta_por_entregar` SÍ
nacieron y CERO tareas `seguimiento`; tras añadir la dependencia, 2 firmas
→ 2 tareas `seguimiento` y el campo del paciente en `2026-09-08`. Es el
tercer camino de pérdida del MISMO dato (REG-193, REG-300, éste). Entrada
completa en `docs/audit/regression-ledger.md` (REG-310) y
`v15-cierre-agenda-el-seguimiento.test.ts` sellado en
`invariantes-clinicos.json` (16 casos; `clinical-safety-gate` en verde).

- Guardián nuevo, probado al revés (6 de sus casos fallan contra el árbol
  sin el cambio, verificado con `git stash`):
  `src/__tests__/v15-cierre-agenda-el-seguimiento.test.ts` — el paso y su
  ruta, la ausencia sin fecha/con fecha malformada, el orden (hoja →
  seguimiento → expediente), que NO fuerza el panel, la pareja de
  `sessionStorage` con ventana fake, el array de dependencias REAL de
  `firmar` leído de la fuente (REG-310), y los dos lados del enlace («el
  dato tiene que llegar»: `/citas` lee `?d=`).

### Verificado en navegador real (11-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start`).
Arnés nuevo: `scripts/design/capturar-cierre-agenda-seguimiento-v15.mjs`.
Resultado y 5 capturas en `docs/design/capturas/v15-cierre-agenda-seguimiento/`
(desktop 1440 + móvil 390, flujo COMPLETO en los dos — el móvil no reabre la
nota del escritorio, firma la suya):

- **La hoja del paciente dice «Su próxima cita · martes, 8 de septiembre de
  2026»** — en palabras, no ISO (`enPalabrasNoISO: true`), desktop y móvil.
- **El checklist trae «Agendar el seguimiento»** tras firmar
  (`seguimientoEnChecklist: true`).
- **Pulsarlo aterriza en la agenda del día exacto del control**:
  `urlCitas=/citas?d=2026-09-08` y el `input[type=date]` de la pantalla
  real dice `2026-09-08` (`agendaAterrizoEnElDia: true`) — el otro lado del
  enlace, medido.
- **Al volver, el paso está MARCADO** (opacidad 0.55 con ✓ verde, captura
  `03-tras-volver-seguimiento-marcado.png`) — en la primera pasada del
  arnés esto daba `marcado: null`; la pareja de `sessionStorage` y REG-310
  salieron de ahí.
- **Emulador como testigo del dato**: tareas `seguimiento` derivadas y
  `patient.proximoSeguimiento` actualizado (ver REG-310 arriba).
- **Axe**: las mismas cuatro familias preexistentes de toda la rama
  (`color-contrast` teal de evidencia, `heading-order`, `landmark-unique`,
  `region`) — ninguna nueva, ninguna en el paso nuevo ni en la hoja.
- **Consola**: sólo los artefactos conocidos del arnés de emuladores (401
  de auditoría, warning de reconexión de Firestore).

### Compuertas de esta corrida

- `npx vitest run`: en verde salvo el fallo PRE-EXISTENTE y ambiental de
  siempre (`ops-timeout-y-punto-ciego`, proxy de red del contenedor,
  verificado en aislamiento) — 16 casos nuevos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (3 veces esta corrida: base, +sessionStorage,
  +REG-310).
- `clinical-safety-gate.test.ts`: en verde con el sello nuevo (totalCasos
  4544→4560).
- `docs/design/SCREEN_INVENTORY.md` regenerado.

## Fase 8 — decisión de cierre (12-ago-2026): la integración por continuidad ES la forma final

La pregunta que la corrida anterior dejó abierta a propósito («¿volver
`/receta`/`/orden` inline dentro de `/consulta`, o declarar la integración
por continuidad como la forma final de Fase 8?») se decidió al inicio de
una corrida fresca, como estaba escrito. **Decisión: la integración por
continuidad es la forma final de Fase 8. La fase se cierra.** Razones:

1. **Lo que §33 Fase 8 pide** es «Make note/prescription/order transition
   part of encounter, not module hopping». El module hopping era la
   PÉRDIDA DE CONTEXTO, y esa ya no existe — verificado en navegador real
   por las cinco rebanadas: la URL dice la verdad (`?nota=`), el atrás de
   la app regresa de verdad a la consulta con su checklist vivo
   (Navigation API), el checklist recuerda receta/orden/seguimiento
   hechos, `InstrumentStrip` mantiene EN QUIÉN ESTÁ el médico dentro de
   `/receta`/`/orden`, y el cierre agenda el seguimiento. §21 («return
   exactly where you were») se cumple medido, no supuesto.
2. **Inlinear los generadores sería el cambio más caro y más riesgoso de
   todo V15**: `/receta` y `/orden` cargan motores de seguridad completos
   (dosis, alergias, interacciones — regla medication-safety) y
   `/consulta` ya es una página de ~5900 líneas. Moverlos a un panel roza
   la lógica congelada de §1 y multiplica el riesgo de regresión clínica
   por un beneficio que la continuidad ya entrega por otra vía.
3. **Es reversible**: si el dueño quiere el inline, es una unidad nueva
   con su propio análisis de riesgo — nada de lo entregado lo estorba.
4. La decisión de la tercera rebanada («Active Patient Canvas, DECISIÓN»)
   ya había clasificado `/receta`/`/orden`/`/nota` como modos distintos
   legítimos (documento imprimible, motores propios) — esta decisión es su
   consecuencia natural, no un giro.

Con esto, la siguiente fase del plan (§33) es `V15-MOBILE-001` (Fase 9).

## Siguiente tarea exacta (histórico pre-decisión)

Con la quinta rebanada cerrada, la cadena «Note → Rx → Orders →
Instructions → Follow-up» de §33 Fase 8 tiene TODOS sus eslabones en el
cierre. La decisión de alcance quedaba abierta para una corrida fresca —
resuelta arriba el 12-ago-2026.

**Deuda anotada, no bloqueante (heredada de fases previas, sigue sin
resolverse, candidata a fases futuras — no se repite su detalle si ya está
arriba):**
- `BottomNav.tsx` no se suscribe a `EVENTO_GRABANDO` → `V15-MOBILE-001`
  (Fase 9).
- `landmark-unique` (cajón móvil `FlowRail`) y `region` (banners fuera de
  landmark) → `V15-A11Y-001` (Fase 13).
- `color-contrast` (encabezado teal de "Análisis basado en evidencia",
  3.03:1) y `heading-order` (`<h4>Sus medicamentos</h4>` de la hoja para el
  paciente) → también `V15-A11Y-001`.
- El campo de cierre (decisión/acción/aviso al paciente) de §9 sigue sin
  construirse — decisión de modelo pendiente del dueño, no bloqueante para
  cerrar Fase 6.
- `useSmartBack` sigue sin mejora en navegadores sin Navigation API
  (Firefox, Safari antiguos) — comportamiento idéntico al de antes de esta
  corrida ahí, decisión de alcance escrita arriba, no un olvido.

## `V15-MOBILE-001` (Fase 9, §22/§33) — primera rebanada: el pulgar navega la misma IA que el escritorio (12-ago-2026)

Medición de baseline de la fase, antes de tocar código: `BottomNav` (médico,
móvil) seguía con la IA VIEJA — Inicio · Agenda · [acción central] ·
Pacientes · CRM — mientras el escritorio ya navegaba por los cinco contextos
de V15 desde `V15-SHELL-GREYBOX-001`. El mismo médico tenía DOS mapas
mentales según el tamaño de su pantalla; en móvil no existía NINGUNA entrada
a `/pendientes` (la cola de cierre de Fase 7) ni a `/operaciones`, y
`BottomNav` ignoraba `EVENTO_GRABANDO` (deuda anotada desde
`V15-ENCOUNTER-MODE-001`). Las dos deudas se pagaron en una rebanada porque
viven en el mismo archivo y el mismo arnés las verifica juntas:

- **`src/components/BottomNav.tsx`** — nuevo bloque `CONTEXTOS_V15` (Hoy ·
  Paciente · Seguimiento · Operaciones — los MISMOS hrefs que pinta
  `FlowRail`, comparados archivo contra archivo por el guardián, no copiados
  a mano) que se usa cuando `navPrimaria` es verdadero. ENCUENTRO no es una
  quinta pestaña: sigue siendo la ACCIÓN CENTRAL contextual que este
  componente ya tenía (`accionContextual`, sin tocar — su prueba vieja sigue
  en verde sin cambios), que es exactamente lo que §22 pide («start
  encounter» como trabajo primario del pulgar). Sin filtro `rutaPermitida`
  en el bloque V15: FlowRail decidió que los contextos núcleo no se recortan
  por paquete y el móvil no diverge del escritorio. Agenda y CRM viven en
  `/operaciones` (§11), igual que en escritorio.
- **`navPrimaria` viene del layout** (`<BottomNav navPrimaria={navPrimaria} />`)
  — el MISMO criterio, calculado UNA vez, que elige FlowRail vs Sidebar
  (`esMedicoReal && mode === 'medico'`): no se recalcula el rol en el
  componente. Secretaria / rol no-médico conservan la barra anterior
  byte-idéntica (COMMON + CRM/Chat + filtro de paquete) — mismo alcance
  escrito que fijó FlowRail.
- **§8.1 también en móvil**: `useGrabando()` local suscrito al MISMO
  `EVENTO_GRABANDO` (patrón FlowRail: el evento es la única fuente de
  verdad; cada pieza del shell se suscribe por su cuenta). Sólo se atenúan
  ÍCONOS de destinos no activos (0.4 — WCAG 1.4.11, no-textual, 3:1);
  ETIQUETAS y acción central jamás (la lección de contraste de FlowRail:
  `--text3` sobre `--s1` no tiene margen AA para atenuarse). Gate
  `navPrimaria && grabando`: la barra heredada no cambia de conducta ni
  durante una grabación. `iconoAtenuado()` exportada pura para probarse
  sin jsdom.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos):
  `src/__tests__/v15-bottom-nav-cinco-contextos.test.ts` — 6 de sus 10
  casos fallan contra el árbol previo (verificado con `git stash`):
  paridad de hrefs con FlowRail, prop del layout, suscripción al evento,
  `iconoAtenuado`, gate del aquietado y «sólo el ícono se atenúa».

### Verificado en navegador real (12-ago-2026)

Mismo método que todas las corridas de la rama (emuladores Auth/Firestore
+ siembra `sembrar-capturas.mjs` + build de producción + `npm start`;
`node_modules` volvió a faltar al arrancar el contenedor — `npm ci` de
nuevo). Arnés nuevo: `scripts/design/capturar-bottom-nav-v15.mjs`
(viewport móvil 390×844 con touch real + control de escritorio 1440).
Resultado y 3 capturas en `docs/design/capturas/v15-bottom-nav/`:

- **La IA nueva, en el DOM real**: `Hoy→/dashboard · Paciente→/pacientes ·
  Nueva cita→/asistente (central) · Seguimiento→/pendientes ·
  Operaciones→/operaciones`.
- **El enlace llega («el dato tiene que llegar» aplicado a navegación)**:
  se PULSÓ «Seguimiento» con tap real y la URL aterrizó en `/pendientes` —
  la cola de cierre por fin es alcanzable con el pulgar.
- **En el expediente la acción central ofrece la consulta de ESE
  paciente**: `Consulta→/consulta/pac-aurelio-dominguez`.
- **Grabando, medido con `getComputedStyle`**: íconos no activos
  (Hoy/Seguimiento/Operaciones) en 0.4; el contexto activo (Paciente) en 1;
  la acción central en 1; las CINCO etiquetas de texto en 1. Al apagar el
  evento, todo vuelve a 1.
- **Escritorio 1440**: la barra NO se pinta (`display:none` por CSS, sin
  cambio).
- **Axe (móvil, dashboard): 0 violaciones. Consola: 0 errores.**

### Compuertas de esta corrida

- `npx vitest run`: 8855 pasan (10 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego` — mismo caso «el error dice cuánto
  esperó y a quién», mismo fingerprint del proxy de red del contenedor
  documentado en todas las corridas previas; reproducido en aislamiento).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo, emuladores,
  proyecto `demo-nexusmed-test`).

**Siguiente tarea exacta de esta fase:** §22/§23 son más que la barra —
quedan por revisar los trabajos móviles restantes (revisar nota generada,
revisar resultado, firmar/cerrar desde el teléfono, borrador de
comunicación al paciente) y el modelo responsivo §23 por breakpoint (qué
persiste, qué colapsa, qué se vuelve hoja/cajón). El cajón lateral móvil
(`FlowRail` dentro del `role="dialog"` — origen del `landmark-unique`
preexistente) y la topbar móvil tampoco se han recompuesto — candidatos
para la siguiente rebanada de `V15-MOBILE-001`.

## Reglas de la corrida (recordatorio)

- Una sola rama V15; sin PR nuevo por corrida; nunca force-push.
- Estructura antes que piel; greybox antes de estilo — ya aplicado al código,
  no sólo a una revisión puntual.
- Lógica clínica/negocio congelada: ningún cambio de esta corrida tocó una
  ruta de API, una regla de Firestore ni un cálculo clínico.
- Móvil: `V15-MOBILE-001` (Fase 9) EN CURSO — primera rebanada entregada
  (`BottomNav` con la IA de V15 + aquietado al grabar).

## `V15-MOBILE-001` (Fase 9, §22/§23) — segunda rebanada: el cajón se retira y Buscar llega al pulgar (12-ago-2026)

La deuda que la primera rebanada dejó nombrada («el cajón lateral móvil —
origen del `landmark-unique` preexistente — y la topbar móvil tampoco se
han recompuesto») se pagó completa, y la corrida arrancó verificando la
prioridad 1 del routine: el asunto de CSS de `.nx-stat-grid` ya estaba
resuelto y sellado desde `c98525d` (guardián `nx-stat-grid-cableada.test.ts`
+ arnés propio) — verificado, no re-hecho.

- **`layout.tsx`** — el cajón móvil (backdrop + `role="dialog"` + clon de
  `FlowRail`) se renderiza SÓLO cuando `!navPrimaria`. Para el médico era
  exactamente lo que §22 prohíbe («Do not expose the complete desktop
  navigation tree on mobile»): el mismo territorio dos veces (BottomNav con
  los 5 contextos Y una hamburguesa con los mismos 5 en cajón), y el clon
  duplicaba `<aside aria-label="Navegación clínica principal">` — la RAÍZ
  del `landmark-unique` que axe marcó en TODAS las capturas de esta rama
  (13 corridas, verificado contra sus `resultado.json`). No se renombró el
  aria-label (eso callaría a axe dejando el defecto de IA intacto): se
  quitó la segunda navegación. La asistente conserva su cajón con `Sidebar`
  sin cambio.
- **Topbar de médico**: sin hamburguesa (no hay cajón que abrir) y con un
  botón Buscar (44×44, borde derecho — pulgar, §22) que dispara
  `nexus:open-palette`. SEARCH/COMMAND — quinto contexto de la IA V15 — no
  tenía NINGUNA entrada móvil: ⌘K no existe en un teléfono y el único
  botón visible vivía dentro del cajón retirado.
- **`operaciones/page.tsx`** — sección «Sesión» con «Cerrar sesión»
  (`salirSeguro`, el MISMO de FlowRail/Sidebar — espera acuse y purga
  IndexedDB, no una salida propia): era lo único del cajón sin otra casa
  móvil. Operaciones es el área de sistema (§11).
- Guardián nuevo, probado al revés (6 de 7 casos fallan contra el árbol
  previo, verificado con `git stash`):
  `src/__tests__/v15-topbar-y-cajon-movil.test.ts` — compuerta
  `!navPrimaria` del cajón, `FlowRail` renderizado UNA sola vez, hamburguesa
  sólo en rama de asistente, Buscar cableado al evento real con los dos
  lados del enlace (la paleta lo escucha y está habilitada para el médico),
  y el logout de /operaciones con `salirSeguro` (no `firebase/auth`
  directo). `v15-flow-rail-cableado.test.ts` caso 3 actualizado a la
  conducta nueva (el cajón ya no clona FlowRail) — la MISMA conducta
  gruesa, forma nueva.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores Auth/Firestore + siembra +
build de producción + `npm start`; `node_modules` volvió a faltar —
`npm ci` de nuevo). Arnés nuevo: `scripts/design/capturar-topbar-movil-v15.mjs`.
Resultado y 5 capturas en `docs/design/capturas/v15-topbar-movil/`
(móvil 390×844 + escritorio 1440):

- **Móvil, medido en DOM real**: `hamburguesaEnDOM: false`,
  `buscarEnDOM: true`, `buscarTactil: 44×44`, `buscarPegadoADerecha: true`,
  `asidesNavPrincipal: 1`, `dialogMenuEnDOM: false` — en `/dashboard` y en
  `/expediente/[patientId]`.
- **El enlace llega, de punta a punta**: tap en Buscar → la paleta ABRE →
  se tecleó «Aurelio» → tap en el resultado → aterrizó en
  `/expediente/pac-aurelio-dominguez`. Los dos lados medidos, no supuestos.
- **`landmark-unique`: CERO por primera vez en la rama.** Las 13 carpetas
  de capturas V15 previas lo traían; esta corrida no (axe con
  `best-practice` incluido, mismo alcance que cuando se detectó). Queda
  sólo la familia `region` preexistente (banners/topbar fuera de landmark,
  3-5 nodos) → sigue anotada para `V15-A11Y-001`.
- **Cerrar sesión desde /operaciones SALE de verdad**: tap → `/login`
  (`cerrarSesionAterrizaEnLogin: true`). El locator necesitó scope a
  `<main>` porque el botón de FlowRail (oculto por CSS en móvil) también
  dice «Cerrar sesión» — anotado en el propio arnés.
- **Escritorio 1440 sin cambio**: topbar móvil `display:none`, FlowRail
  con su propio Cerrar sesión (`railLogout: true`), un solo aside.
- **Consola**: sólo los 401 de auditoría ya documentados como artefacto
  del arnés de emuladores (mismo fingerprint que v15-patient-anchor).

### Compuertas de esta corrida

- `npx vitest run`: en verde (ver commit); guardianes nuevos incluidos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo, emuladores,
  proyecto `demo-nexusmed-test`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/operaciones` creció por
  la sección «Sesión»).

**Hallazgos de pulido de esta corrida (anotados, no bloqueantes):**
- En móvil la palabra «Ausculta» aparece DOS veces apiladas (topbar +
  `InstrumentStrip` justo debajo) — redundancia visual que la captura
  `dashboard--movil.png` enseña a simple vista. Candidato a fusionar
  topbar e InstrumentStrip en móvil en una rebanada futura de esta fase.
- El pie de la paleta dice «⌘K abrir/cerrar» también en el teléfono, donde
  ⌘K no existe — desktop-ism de contenido (§25), candidato al mismo lote.

**Siguiente tarea exacta de esta fase:** el modelo responsivo §23 por
breakpoint (qué persiste, qué colapsa, qué se vuelve hoja/cajón) y los
trabajos móviles restantes de §22 (revisar nota generada, revisar
resultado, firmar/cerrar desde el teléfono, borrador de comunicación al
paciente) — medirlos primero contra las pantallas reales en 390px antes
de decidir la rebanada.

## `V15-MOBILE-001` (Fase 9, §22/§23/§24/§25) — tercera rebanada: el shell móvil se consolida (12-ago-2026)

Se cumplió el «medir primero» que dejó escrito la rebanada anterior:
`scripts/design/medir-trabajos-moviles-v15.mjs` radiografió a 390×844
dashboard / consulta (inicio y pie) / pendientes / expediente — desborde
horizontal, objetivos táctiles <44px, acción primaria visible y tamaño,
alturas del shell fijo, y cuántas veces se lee «Ausculta» en el shell.
Resultado de la línea base en
`docs/design/capturas/v15-trabajos-moviles-baseline/`:

- sin desborde-X en ninguna pantalla; acciones primarias dominantes
  (EmpezarAGrabar 320×228 visible; «Nueva consulta» 358×44 visible);
- **«Ausculta» ×2 apiladas** en el shell de TODAS las pantallas (topbar +
  franja) y **135px de shell fijo** (52+30+53) — 16% del viewport;
- **el enlace del paciente en la franja: 141×18px** — menos de la mitad
  del mínimo táctil de §24, en el elemento de continuidad más importante;
- «Firmar» a ~2,900px de scroll en /consulta — hallazgo ANOTADO para una
  rebanada futura de composición de esa página (no es del shell);
- pistas «⌘K / ↑↓ / ↵» visibles en el pie de la paleta en el teléfono.

La rebanada consolidó el shell (los 3 defectos del shell + el §25):

- **`InstrumentStrip.tsx`** — variante `enTopbar`: en móvil la franja no es
  una segunda fila, es el CENTRO de la topbar. El paciente GANA a la
  clínica (con 390px no caben los dos; a media consulta lo periférico que
  importa es EN QUIÉN estás y si grabas — la clínica es admin, §8.5). Sin
  paciente, la identidad de siempre una sola vez. El enlace del paciente
  lleva `padding: 13px` vertical → 44px táctiles reales. MISMOS hooks
  (`usePacienteActual`/`useSegundosGrabando`) para las dos variantes — el
  mismo estado pintado distinto, no una segunda fuente de verdad.
- **`layout.tsx`** — la topbar de médico renderiza
  `<InstrumentStrip enTopbar />` en vez del wordmark estático (que queda
  para la asistente); la franja de fila propia queda SÓLO en escritorio
  (`hidden md:block`).
- **`PaletteBusqueda.tsx` + `globals.css`** — pie de pistas de teclado con
  clase `nx-pista-teclado`, display en la HOJA (flex) y `display:none`
  bajo 768px. **El primer intento dejó `display:'flex'` inline y el
  media query nunca pudo ocultarlo** — lo cazó el arnés en navegador real
  (`pistasTecladoMovil: true`), no una lectura de código: misma trampa
  que documenta `nx-stat-grid-cableada` (un estilo inline vence a la
  hoja en silencio). El guardián ganó un caso específico para esto.
- El `fontSize: 15` del primer borrador de la variante compacta lo cazó
  el trinquete de diseño (2004 > techo 2003) — corregido a 16 (escala
  oficial), el techo no se tocó.
- Guardián nuevo, probado al revés (5 de 7 casos fallan contra el árbol
  previo, verificado con `git stash` de los 4 archivos):
  `src/__tests__/v15-shell-movil-consolidado.test.ts`.
  `v15-instrument-strip-paciente-actual.test.ts` actualizado en un caso:
  protege que `InstrumentStrip` siga exportada, no la forma de la firma.

### Verificado en navegador real (12-ago-2026)

Arnés nuevo: `scripts/design/capturar-shell-consolidado-v15.mjs`.
Resultado y 5 capturas en `docs/design/capturas/v15-shell-consolidado/`
(390×844 + 1440):

- **Shell 135→105px** (`franjaFilaVisible: false`, contenido dentro de la
  topbar); **«Ausculta» ×1** en dashboard, **×0** en consulta (ahí manda
  el paciente).
- **Enlace del paciente: 142×44** (antes 141×18) y el tap ATERRIZA en
  `/expediente/pac-aurelio-dominguez` — los dos lados del enlace.
- **Grabando**: contador `0:01` visible en la topbar junto al nombre del
  paciente (captura `expediente--grabando-movil.png`, revisada a simple
  vista: marco perimetral encendido, una sola fila de shell).
- **Pistas de teclado**: ocultas en móvil (`false`), visibles en
  escritorio (`true`) — verificado DESPUÉS del arreglo del display inline.
- **Axe**: sólo la familia `region` preexistente (4 nodos), sin
  `landmark-unique`, nada nuevo.
- **Escritorio 1440 sin cambio**: franja de fila propia visible (30px),
  topbar oculta, «Ausculta» ×1.
- **Consola**: sólo los 401 de auditoría conocidos del arnés de
  emuladores.

### Compuertas de esta corrida

- `npx vitest run`: en verde (ver commit); guardianes nuevos incluidos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: 2003 = techo tras
  corregir el 15→16 — sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (2 veces: base y tras el arreglo del
  display inline).
- `docs/design/SCREEN_INVENTORY.md` regenerado sin cambios (los archivos
  tocados no son pantallas).

**Deuda anotada de la radiografía, no bloqueante, para rebanadas futuras:**
- «Firmar» a ~2,900px de scroll en /consulta móvil — composición de esa
  página, candidata a la siguiente rebanada de esta fase o a una unidad
  propia de Encounter Mode móvil.
- Objetivos táctiles <44px FUERA del shell de esta fase: «Activar plan →»
  (100×24, TrialBanner), botón de tema (34×44), un input de 244×24 en
  /consulta, enlaces de paciente en /pendientes (156×20) → `V15-A11Y-001`.

**Siguiente tarea exacta:** el trabajo móvil «firmar/cerrar desde el
teléfono» (§22) — el hallazgo de los 2,900px — o el modelo responsivo §23
por breakpoint documentado como decisión, lo que la corrida siguiente
mida como más valioso.

## `V15-MOBILE-001` (Fase 9, §22/§23) — cuarta rebanada: firmar/cerrar desde el teléfono, y el shell gana fondo (12-ago-2026)

La tarea que dejó nombrada la rebanada anterior («el trabajo móvil
"firmar/cerrar desde el teléfono" — el hallazgo de los 2,900px») se pagó, y
en el camino su propio arnés destapó un defecto estructural mucho más viejo
que la barra.

### `CierreAlPulgar` — el cierre al alcance del pulgar (§22)

- **`src/components/CierreAlPulgar.tsx`** — barra `position: sticky;
  bottom: 0` al FINAL del flujo de /consulta, sólo móvil (≤768px, display
  en la HOJA — la lección de `nx-stat-grid`: el default es `display:none` y
  el media query la enciende, no al revés). Enseña el ESTADO del cierre con
  las MISMAS fuentes que el botón real (`bloqueosDeFirma.length`,
  `motivoNoFirma`, `validacion.puntajeCompletitud` — ni un recálculo) y un
  toque hace scroll+foco hasta `#cierre-de-la-consulta` (ancla nueva con
  `tabIndex={-1}`: teclado y lector aterrizan donde aterriza la vista;
  `prefers-reduced-motion` respetado).
- **LO QUE NO HACE, A PROPÓSITO: firmar.** Firmar es acto consecuente
  (§19, regla 6 de seguridad clínica) — el botón real vive junto a la
  validación NOM-004 y ahí se queda. La barra es navegación; el guardián
  caza cualquier `firmar(` que alguien le cablee.
- **Cuándo existe** (`cierreAlPulgarVisible`, función pura): nota sin
  firmar + sin grabación en curso (grabando/pausado/subiendo — §8.5/§8.6:
  a media escucha no se ofrece el cierre) + hay contenido real
  (`hayContenidoDeNota`: sección escrita, diagnóstico, medicamento o
  dictado — señales que ya existían, no estado nuevo). Se esconde sola
  cuando la zona de cierre ya está en pantalla (IntersectionObserver,
  rootMargin que descuenta su propia altura): dos accesos a «Firmar» a la
  vez confundirían cuál es el de verdad.

### El hallazgo estructural: el shell no tenía fondo y TODO sticky estaba mudo

El primer intento de tap del arnés falló con `<html> intercepts pointer
events` y la sonda de geometría enseñó por qué — y no era la barra:

- el layout del dashboard usaba `minHeight: 100vh` SIN tope, la columna
  entera crecía con el contenido, `<main>` (con `overflowY: auto` desde
  siempre, con la intención de ser EL contenedor de scroll) tenía
  `clientHeight === scrollHeight` — **jamás desplazó nada**; quien
  desplazaba era el documento;
- consecuencia silenciosa: **todo `position: sticky` cuyo scrollport era
  `<main>` no pegaba** — `PatientAnchor`, encabezado del calendario,
  encabezado de la tabla de pacientes, paneles laterales de receta/orden…
  y el propio `BottomNav` en páginas largas: medido a **2,321px del borde
  en un viewport de 844** en /consulta — la navegación del pulgar
  simplemente NO ESTABA en la página más larga del producto;
- ninguna prueba lo veía porque los arneses hacían `main.scrollTop = N`
  (un no-op sobre un main que no desplaza) y las aserciones «sigue pegado»
  pasaban trivialmente: el elemento no se movía porque nada se movía. La
  medición de PatientAnchor («106.5px antes y después») era un falso
  verde por esta misma vía.

**Arreglo de raíz, no parche por elemento**: clase `nx-app-shell`
(`height: 100vh` + fallback `100dvh` + `overflow: hidden`) en el div raíz
del layout del dashboard; `.sidebar` gana `overflow-y: auto` (dentro de un
shell con tope el riel desplaza su propio contenido); la restauración de
scroll de /consulta (única dependencia de `window.scrollY` en el
dashboard, verificada por grep) ahora lee/escribe EN LOS DOS lados (main y
window — mover el que no desplaza es un no-op, funciona sea cual sea el
contenedor activo). Sólo el área clínica: login/portal/marketing siguen
desplazando el documento, y está bien.

### Guardianes nuevos, probados al revés

- `src/__tests__/v15-cierre-al-pulgar.test.ts` (18 casos) — no-firma,
  misma-fuente, ancla con foco, estados del encuentro como función pura,
  display en la hoja, botón real ≥44px. 7 de 18 fallan con page/CSS
  revertidos; el archivo entero falla si el componente no existe
  (verificado con `git stash`).
- `src/__tests__/v15-el-scroll-vive-en-main.test.ts` (7 casos) — el tope
  del shell (height, no min-height: min-height FUE el defecto), la clase
  en el layout, main con overflowY auto, sidebar con scroll propio, y la
  restauración de scroll a dos lados. 6 de 7 fallan contra el árbol
  previo (verificado con `git stash`).

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start`; `node_modules` volvió a faltar — `npm ci`). Arnés nuevo:
`scripts/design/capturar-cierre-al-pulgar-v15.mjs`. Resultado y 5 capturas
en `docs/design/capturas/v15-cierre-al-pulgar/` (390×844 + 1440):

- **Nota vacía → sin barra** (al principio manda EmpezarAGrabar). **Con
  contenido escrito por la UI real** (textarea de Motivo, sin siembra
  ad-hoc) → barra visible 358×65, pegada; **misma posición tras
  `main.scrollTop = 800`** — y ahora ese scroll ES real (el shell con
  tope): `scrollMain: 800` medido.
- **La barra dice la verdad**: «Aún no se puede firmar · No se puede
  firmar todavía — 6 cosas por resolver: Falta cédula profesional del
  médico» — byte-idéntico al `role="status"` junto al botón real (misma
  fuente, probada en DOM).
- **Tap → aterriza**: Firmar (a 2,935px) visible en viewport, foco en el
  ancla (`focoEnAncla: true`), barra oculta (IntersectionObserver). Los
  dos lados del viaje, medidos.
- **BottomNav POR FIN pegado en /consulta**: top 791 = 844−53 (antes
  2,321) — el arreglo del shell, visible en la misma captura.
- **Escritorio 1440**: barra no visible (CSS), pantalla sin cambio.
- **Axe**: sólo la familia `region` preexistente (2 nodos, banner de
  prueba/`suscripcion`), nada nuevo, nada en la barra.
- **Consola**: sólo los artefactos conocidos del arnés (reconexión de
  Firestore del emulador + 401 de auditoría, mismo fingerprint documentado
  desde v15-patient-anchor).

### Hallazgos de esta corrida (anotados, no bloqueantes)

- **`NotificacionesPushOptIn` tapa el borde inferior completo en 390px**
  (fixed bottom 16, z-1000, aparece a los 3s): se comió el tap del arnés
  dos veces. Preexistente — en móvil compite con TODA la zona del pulgar
  (BottomNav incluido), no sólo con la barra nueva. El arnés lo esquiva
  sembrando su flag de descarte (lo que haría un médico que ya pulsó
  «Después»). Candidato: en móvil, ese banner debería ser una fila del
  flujo o una hoja, no un fixed sobre la navegación → rebanada futura de
  esta fase o `V15-A11Y-001`.
- El gap de ~72px entre la barra y el borde de main (padding inferior de
  la página) se ve bien a simple vista — no se tocó.

### Compuertas de esta corrida

- `npx vitest run`: en verde (ver commit) — 25 casos nuevos; el único
  fallo es el PRE-EXISTENTE ambiental de siempre (`ops-timeout-y-punto-
  ciego`, proxy de red del contenedor, verificado en aislamiento con el
  mismo fingerprint de todas las corridas).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (12 y
  10.5 de la barra están en la escala oficial).
- `npx tsc --noEmit`: limpio (cazó de paso un comentario JSX ilegal antes
  del raíz del layout — corregido a comentario de línea).
- `npm run build`: compila limpio (2 veces: barra, y barra+shell).
- `docs/design/SCREEN_INVENTORY.md` regenerado.

**Siguiente tarea exacta:** los trabajos móviles restantes de §22 medidos
contra pantallas reales (revisar nota generada, revisar resultado,
borrador de comunicación al paciente); el modelo responsivo §23 por
breakpoint ya tiene su primera decisión escrita (el shell con fondo) —
documentar el resto cuando las rebanadas lo midan. El banner push como
hoja quedó ENTREGADO en la quinta rebanada (ver abajo).

## `V15-MOBILE-001` (Fase 9, §22/§24) — quinta rebanada: el aviso push ya no tapa el pulgar (12-ago-2026)

El hallazgo que la cuarta rebanada dejó nombrado («`NotificacionesPushOptIn`
tapa el borde inferior completo en 390px… candidato: fila del flujo o una
hoja, no un fixed sobre la navegación») se pagó completo. El banner era
`position:fixed; bottom:16; right:16; z-index:1000` INLINE — en 390px eso es
el ancho completo de la pantalla montado sobre el BottomNav (z-45) y toda la
zona del pulgar, durante los segundos en los que el médico más navega (recién
entrado a la app). No lo encontró una prueba: se comió el TAP de dos arneses
de captura distintos, que lo esquivaban sembrando su flag de descarte.

- **`src/components/NotificacionesPushOptIn.tsx`** — el contenedor pierde
  TODOS sus estilos inline de posición y gana `className="nx-push-optin"`
  (la lección de nx-stat-grid, tercera vez que se aplica en esta fase: un
  `position:'fixed'` inline vencería al media query en silencio). Gana
  además `role="region"` + `aria-label` (ver hallazgo axe abajo) y clases en
  sus tres controles. NADA de su conducta cambió: mismo `DISMISS_KEY`, mismo
  retraso de 3s, mismo gate `concedido` del programador de avisos, mismo
  `solicitarPermisoPush()` — congelado por el guardián.
- **`src/app/globals.css`** — `.nx-push-optin`: en escritorio la tarjeta
  abajo-derecha de siempre (máx 360px). En ≤768px: hoja de borde a borde
  anclada ENCIMA del BottomNav (`bottom: calc(53px + 8px + safe-area)` —
  53px es el alto real medido en v15-cierre-al-pulgar) con `z-index: 44`,
  DEBAJO del 45 del BottomNav: si la geometría volviera a fallar algún día,
  gana la NAVEGACIÓN, nunca el aviso. §24: `Activar`/`Después` suben a
  min-height 44 y la X gana área táctil de 44×44 con margen compensado.
  El FAB de ayuda (z-60, misma esquina en todos los tamaños) cede el paso
  mientras el aviso pregunta (`body:has(.nx-push-optin) .boton-ayuda-fab`,
  mismo patrón que ya usa el FAB al enfocar un input) y vuelve solo al
  decidir o descartar.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-push-optin-no-tapa-el-pulgar.test.ts` — 6 de sus 10
  casos fallan contra el árbol previo (verificado con `git stash`): clase en
  el contenedor, hoja con la clase, media query con safe-area, z-index por
  debajo del BottomNav, clases táctiles y regla del FAB. Los otros 4
  protegen el freeze funcional del aviso.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores Auth/Firestore + siembra
`sembrar-capturas.mjs` + build de producción + `npm start`; `node_modules`
volvió a faltar — `npm ci`). Arnés nuevo:
`scripts/design/capturar-push-optin-v15.mjs` — el PRIMERO de la rama que NO
siembra el flag de descarte: quiere el aviso ABIERTO, porque lo que mide es
que la navegación sobreviva con él en pantalla. Resultado y 4 capturas en
`docs/design/capturas/v15-push-optin/` (390×844 + 1440):

- **Hoja encima del BottomNav, medido**: aviso `bottom: 783`, BottomNav
  `top: 791` — 8px de separación, `seIntersecan: false`; z 44 < 45.
- **La razón de ser del cambio, medida de punta a punta**: CON el aviso
  abierto, tap real en «Seguimiento» del BottomNav → la URL aterriza en
  `/pendientes`. Antes ese tap se lo comía el aviso (documentado en el
  arnés de la cuarta rebanada).
- **§24**: `Activar 64×44 · Después 66×44 · X 44×44` — los tres al mínimo
  táctil o encima.
- **El FAB cede y vuelve**: `opacity 0 / pointer-events none` con el aviso
  abierto; `opacity 1` tras «Después». Tras descartar y RECARGAR, el aviso
  no vuelve (flag persistido — conducta de siempre, ahora medida).
- **Hallazgo axe de este mismo arnés, arreglado en la misma corrida**: al
  ser el primero que escanea con el aviso abierto, axe cazó a sus hijos
  fuera de todo landmark (`region`, 2 nodos en `.nx-push-optin`). Arreglado
  con `role="region"` + `aria-label` en el contenedor; en la recaptura
  quedan SOLO los 2 nodos preexistentes de la familia `region` ya
  documentada (span del InstrumentStrip + enlace del TrialBanner), ninguno
  del aviso → siguen anotados para `V15-A11Y-001`.
- **Escritorio 1440 sin cambio**: tarjeta 360px abajo-derecha.
- **Consola**: sólo los 401 de auditoría documentados como artefacto del
  arnés de emuladores (mismo fingerprint desde v15-patient-anchor).
- Anotado, no bloqueante: el toggle de tema (z-199, flotante) pinta sobre
  el espacio vacío del borde derecho del aviso en 390px sin tapar ningún
  control (el tap en «Después» llegó a través del arnés) — colisión
  preexistente de la familia de widgets flotantes, candidata a
  `V15-A11Y-001` junto con sus hermanos ya anotados.

### Compuertas de esta corrida

- `npx vitest run`: en verde (ver commit) — 10 casos nuevos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (2 veces: hoja, y hoja+landmark).
- `docs/design/SCREEN_INVENTORY.md`: sin cambios (los archivos tocados no
  son pantallas) — regenerado para comprobarlo.

**Siguiente tarea exacta:** los trabajos móviles restantes de §22 medidos
contra las pantallas reales en 390px (revisar nota generada, revisar
resultado, borrador de comunicación al paciente) — decidir la rebanada con
la medición, no desde el checkpoint; o si la medición no da una rebanada
clara, documentar el modelo responsivo §23 por breakpoint con las
decisiones ya tomadas (shell con fondo, franja en topbar, hoja del aviso).

## `V15-MOBILE-001` (Fase 9, §22/§23/§24) — sexta rebanada: el chat cabe en el shell (12-ago-2026)

La tarea que dejó nombrada la quinta rebanada («los trabajos móviles
restantes de §22 medidos contra las pantallas reales en 390px — decidir la
rebanada con la medición, no desde el checkpoint») se pagó con una segunda
radiografía y su rebanada.

### La medición primero (`scripts/design/medir-trabajos-moviles-2-v15.mjs`)

Radiografía a 390×844 de los tres trabajos §22 que la primera medición no
cubrió (resultado en `docs/design/capturas/v15-trabajos-moviles-2/`):

- **«review generated note» → `/nota/[pid]/[notaId]`** (nota FIRMADA
  sintética sembrada ad-hoc en el emulador, misma técnica que
  v15-patient-anchor): SANA en 390px — sin desborde horizontal, el
  documento-carta cabe (342px), «Imprimir» 167×44 visible sin scroll. Sólo
  aparecen los táctiles chicos ya anotados para `V15-A11Y-001` (enlace del
  TrialBanner, toggle de tema). Sin rebanada que hacer.
- **«review result» a nivel de ITEM → `/pendientes`**: la fila real ofrece
  «Tomarla» 75×44 y «Ya no aplica» 118×44 — al mínimo táctil. El enlace del
  paciente (140×20) ya estaba anotado para `V15-A11Y-001`. Sin rebanada.
- **«patient communication draft» → `/chat`**: DEFECTO REAL — composer con
  bottom a 889px en un viewport de 844, BottomNav en top 791:
  `composerTapadoPorNav: true`. Escribir un mensaje ocurría en una franja
  parcialmente enterrada bajo la navegación.

**Honestidad de alcance**: /chat es mensajería INTERNA (médico↔asistente).
El trabajo §22 «patient communication draft/review» hacia el PACIENTE no
tiene superficie propia hoy — el paquete de visita es POSTVISIT/Fase 8 de
otro programa. Esa ausencia queda declarada aquí; la rebanada arregla la
única superficie de mensajería que el producto sí tiene.

### La causa raíz y el arreglo (pantalla-LIENZO)

- La página fijaba `height: calc(100vh - 52px)` — la suposición de que entre
  ella y el viewport sólo existe la topbar de escritorio. Es anterior al
  `nx-app-shell` (4ª rebanada): hoy el alto real lo dicta `<main>`. MISMA
  familia de defecto que «el shell no tenía fondo».
- **Primer intento fallido, cazado por el propio arnés**: `height: '100%'`
  inline colapsó al alto del contenido (composer a 514px de un main de 844)
  porque entre `<main>` y la página vive `.page-transition` (template.tsx,
  alto auto) — el 100% no tenía contra qué resolverse. No se adivinó la
  causa: se sondearon los `getComputedStyle` de la cadena completa en los
  dos viewports.
- **Forma final**: `src/app/(dashboard)/chat/page.tsx` declara
  `className="nx-lienzo-completo"` (sin ningún alto inline — la lección de
  nx-stat-grid, cuarta vez en esta fase) y `globals.css` transmite el alto
  por la cadena `main:has(.nx-lienzo-completo) → .page-transition → lienzo`
  (flex + min-height:0; `:has` con el mismo patrón que ya usa el FAB con
  `.nx-push-optin`). En ≤768px el lienzo además neutraliza los colchones de
  las páginas-documento (72px de claro para un BottomNav que ya no flota
  sobre el documento + 16+16 de `main > div`): eran 104px de aire muerto
  entre el composer y la barra.
- **§24 en el composer**: textarea minHeight 42→44; botón Enviar gana
  minWidth/minHeight 44.
- **Freeze funcional**: `enviarMensaje` conserva su contrato exacto
  (clinicId, texto, sender uid/email/nombre/rol) y Enter-sin-Shift sigue
  enviando — protegido por el guardián, no sólo afirmado.

### Guardián nuevo, probado al revés

`src/__tests__/v15-chat-cabe-en-el-shell.test.ts` (9 casos) — clase-lienzo
sin alto inline, cadena completa en la hoja (incluido el `min-height: 0` sin
el cual el contenido largo desbordaría el shell), neutralización móvil del
claro legacy, §24, contrato del shell y freeze funcional. 5 de 9 fallan
contra el árbol previo (verificado con `git stash`); los de contrato/freeze
pasan antes y después — protegen el invariante, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start`). Arnés nuevo: `scripts/design/capturar-chat-al-pulgar-v15.mjs` —
mide punta a punta, no sólo pantalla. Resultado y 3 capturas en
`docs/design/capturas/v15-chat-al-pulgar/` (390×844 + 1440):

- **Composer pegado a la barra, medido**: textarea bottom 779 + 12px de
  padding de su fila = 791 = exactamente el top del BottomNav
  (`composerEncimaDelNav: true`; antes 889 > 791). Enviar visible y
  54×46 ≥ 44 táctil (`tactilOk: true`).
- **«El dato tiene que LLEGAR», medido**: se escribió un mensaje único con
  el teclado real y se pulsó Enviar — el texto aparece en la lista (ida y
  vuelta por el Firestore del emulador, no un setState local).
  Anotado como artefacto del arnés: `composerVacioTrasEnviar: false` — el
  `await` de la escritura tarda en resolver contra el canal inestable del
  emulador (misma familia que el warning de reconexión documentado desde
  v15-shell-greybox), así que el `setTexto('')` del `finally` aún no había
  corrido al medir; el mensaje SÍ llegó y el código de limpieza no cambió
  (congelado por el guardián 4a).
- **Escritorio 1440**: el lienzo llena main EXACTO (composer bottom 900 =
  main bottom 900, `llenaElAlto: true`) — antes también estaba mal en
  escritorio (779 de 900 utilizados, resto vacío bajo el composer).
- **Axe**: 1 familia `color-contrast` (serious, 3 nodos: subtítulo del
  encabezado, hora dentro de la burbuja propia, píldora de rol) — PRIMERA
  vez que un arnés V15 escanea /chat, así que no hay línea base previa;
  los tres nodos son COLORES DE CONTENIDO que esta rebanada (sólo layout)
  no tocó → anotados para `V15-A11Y-001` junto con sus hermanos, con la
  misma disciplina de fase que v15-today-continuidad. Ninguna violación en
  el composer ni en la cadena del lienzo.
- **Consola**: sólo los artefactos conocidos del arnés (reconexión del
  emulador + 401 de auditoría, mismo fingerprint desde v15-patient-anchor).
- **Hallazgo del arnés sobre el propio arnés**: la clave de descarte del
  aviso push que usaban los scripts nuevos era inventada
  (`nx_push_optin_dismissed`); la real es `agenda-medica:push-dismissed`
  (línea 17 de `NotificacionesPushOptIn.tsx`). Corregida en los dos
  scripts de esta corrida — la captura intermedia con el aviso abierto
  confirmó de paso que la hoja de la 5ª rebanada tapa el composer del chat
  mientras pregunta (aceptable por diseño: transitoria, descartable y la
  navegación gana; anotado por si `V15-A11Y-001` decide otra cosa).

### Compuertas de esta corrida

- `npx vitest run`: en verde (ver commit) — 9 casos nuevos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (3 veces: fix inicial, lienzo, lienzo+claro).
- `docs/design/SCREEN_INVENTORY.md` regenerado (/chat cambió de líneas).

**Siguiente tarea exacta:** con los tres trabajos §22 restantes medidos y el
único defecto real arreglado, la fase puede cerrar la parte de trabajos §22 y
pasar a documentar el modelo responsivo §23 por breakpoint con las decisiones
ya tomadas (shell con fondo, franja en topbar, hoja del aviso, pantalla-
lienzo) — o, si una medición nueva enseña algo más barato/valioso, esa
rebanada. Después de §23 documentado, `V15-MOBILE-001` es candidata a
CERRARSE y sigue `V15-VISUAL-SYSTEM-001` (Fase 10) según el orden de §43.

## `V15-MOBILE-001` (Fase 9, §23) — séptima rebanada: un solo shell por ancho, y Fase 9 CERRADA (12-ago-2026)

La tarea que dejó nombrada la sexta rebanada («documentar el modelo
responsivo §23 por breakpoint con las decisiones ya tomadas — o, si una
medición nueva enseña algo más barato/valioso, esa rebanada») se pagó con
las dos cosas: la medición ENSEÑÓ el defecto, el defecto se arregló, y el
modelo quedó documentado con evidencia en vez de desde el checkpoint.

### La medición primero (`scripts/design/medir-breakpoints-v15.mjs`)

Radiografía del shell en OCHO anchos (390 · 767 · 768 · 769 · 834 · 1024 ·
1280 · 1440) — las seis rebanadas anteriores sólo habían medido 390 y 1440.
Arnés hermano: `scripts/design/arnes-breakpoints-v15.sh` (emulators:exec +
siembra + build de producción, el método de toda la rama). Resultado ANTES
en `docs/design/capturas/v15-breakpoints/`:

- 767 y menos: shell móvil limpio. 769 en adelante: shell de escritorio
  limpio. Sin desborde horizontal en ningún ancho.
- **768 EXACTO — el ancho CSS de un iPad Mini/9.7/10.2 en vertical, no un
  ancho teórico — era el único ancho con shell HÍBRIDO**: topbar móvil +
  franja de instrumentos de escritorio (instrumentos dos veces apilados, la
  duplicación que la 3ª rebanada mató en <768 renacía justo ahí) + BottomNav
  + colchones móviles de main, y el FlowRail AHOGADO (su wrapper Tailwind
  `md:flex` encendía, pero la regla móvil `.sidebar { display:none }` ≤768
  lo apagaba por dentro).

### La causa raíz

Dos familias de media queries con fronteras que se PISAN en un ancho: todo
el lado móvil del shell vive bajo `max-width: 768px` (inclusive) y las dos
piezas exclusivas de escritorio (barra lateral, franja de fila propia)
vivían bajo Tailwind `md:` = `min-width: 768px` (inclusive). En 768.0–768.9
aplicaban las dos a la vez. Eran los ÚNICOS dos usos reales de `md:` en toda
la app (grep: los otros dos hits son claves de objeto).

### El arreglo

**El ancho 768 le pertenece al MÓVIL** — coherente con todas las reglas
`max-width: 768px` ya selladas por los guardianes de las rebanadas 1–6 (que
no se reescriben), y un iPad vertical es un dispositivo de pulgar.

- `src/app/globals.css` — clases de hoja `nx-lado-escritorio` (flex) y
  `nx-franja-escritorio` (block): base `display:none`, encienden en
  `@media (min-width: 769px)` — la misma frontera que ya usaba
  `.mobile-sidebar-wrap`. Y la regla `min-width: 768px` de `.mobile-topbar`
  (que sólo no rompía porque una regla posterior la pisaba) se corrió a 769:
  ya no queda NINGÚN `min-width: 768px` en la hoja.
- `src/app/(dashboard)/layout.tsx` — los dos wrappers dejan Tailwind
  (`hidden md:flex` / `hidden md:block`) por las clases de hoja. Nada más
  cambió: mismo árbol, mismos gates `navPrimaria`.
- Guardián actualizado: `v15-shell-movil-consolidado.test.ts` caso 2 pinneaba
  el literal `hidden md:block`; su INVARIANTE (la franja jamás sin gate) no
  cambió — ahora pinnea el gate nuevo y remite al guardián de la frontera.

### Guardián nuevo, probado al revés

`src/__tests__/v15-frontera-768-un-solo-shell.test.ts` (6 casos) — clases en
el layout sin utilidades `md:*`, clases en la hoja con base apagada y
encendido en ≥769, gate jamás inline, CERO `min-width: 768px` en globals.css,
y el lado móvil SIGUE en `max-width: 768px` (el arreglo fue mover el lado
escritorio, no reescribir el móvil). 4 de 6 fallan contra el árbol previo
(verificado con `git stash`).

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama. Resultado DESPUÉS y 8 capturas en
`docs/design/capturas/v15-breakpoints-despues/`:

- **768×1024**: `mobileTopbarVisible: true, franjaEscritorioVisible: false,
  bottomNavVisible: true, navsPrimariasSimultaneas: 1, franjasInstrumentos:
  1 (la de la topbar), mainPaddingBottom: 72px` — shell móvil puro, mirado
  además en la captura (una sola marca, una sola navegación).
- **769×1024**: FlowRail + franja de fila propia, sin topbar móvil, sin
  BottomNav, sin colchones móviles — shell de escritorio puro desde el
  primer píxel del lado suyo de la frontera.
- Los otros seis anchos: sin cambio contra el ANTES (el arreglo sólo toca
  768.0–768.9). Cero errores de consola en los 8 anchos.
- Artefacto del arnés cazado en el camino: la primera recaptura midió TODO
  en null — un `next-server` HUÉRFANO de la corrida anterior seguía dueño
  del puerto 3000 sirviendo chunks borrados (el trap del arnés mata al
  wrapper de npx, no al servidor; ChunkLoadError + MIME text/plain, la misma
  familia que documenta el README de v10-truth). Se mató el proceso y la
  recaptura salió limpia — anotado aquí porque le va a pasar al siguiente
  arnés que corra dos veces en el mismo contenedor.

### El modelo §23, documentado

`docs/design/v15/MOBILE-001-modelo-responsivo.md` — por breakpoint: qué
persiste, qué es contextual, qué colapsa, dónde vive la acción primaria; la
frontera única (móvil ≤768 · escritorio ≥769); táctil por CAPACIDAD
(`pointer: coarse`), no por ancho; y la regla de no inventar cortes que
ningún trabajo pide (1280 vs 1440 medidos sin diferencia estructural).

### Compuertas de esta corrida

- `npx vitest run`: 8924 pasan, 6 casos nuevos; el único fallo es el
  PRE-EXISTENTE ambiental de siempre (`ops-timeout-y-punto-ciego`, proxy del
  contenedor, verificado en aislamiento con el mismo fingerprint).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (el build que sirvió la verificación).
- `docs/design/SCREEN_INVENTORY.md`: regenerado, sin cambios (layout y
  globals no son pantallas).

**Siguiente tarea exacta:** `V15-VISUAL-SYSTEM-001` (Fase 10, §18): releer
§12/§16/§18 y la ley de diseño en `docs/design/` (Cantera + Instrument), y
decidir la primera rebanada de sistema visual SOBRE la estructura ya
aprobada en greybox — sin deshacer ningún gate estructural. Los pendientes
anotados de accesibilidad de la Fase 9 quedan en la lista de `V15-A11Y-001`.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — primera rebanada: el acento entra al shell (12-ago-2026)

La tarea que dejó nombrada la séptima rebanada de Fase 9 («decidir la primera
rebanada de sistema visual SOBRE la estructura ya aprobada en greybox — sin
deshacer ningún gate estructural») se pagó con el inventario de los deferrals
explícitos que las fases estructurales dejaron ESCRITOS para Fase 10:

1. **FlowRail activo** — `globals.css` re-declaraba barra e icono del contexto
   activo en `var(--text)` (el override greybox de V15-SHELL-GREYBOX-001, con
   su comentario «la fase de estilo decide si el acento entra aquí»). El shell
   hablaba DOS idiomas: `BottomNav` móvil marcaba el contexto activo en
   cobalto desde su primera rebanada; el escritorio en neutro.
2. **ClinicalSpine seleccionado** — `var(--text)`/`var(--bg)` con la nota «el
   acento de marca espera a V15-VISUAL-SYSTEM-001».
3. **Indicador «Grabando» del InstrumentStrip** — `var(--text)`, mientras el
   marco perimetral (`MarcoEscuchando`) decía LO MISMO en cobalto.

### El arreglo (semántica escrita, no gusto)

- **`globals.css`** — el override greybox se RETIRÓ (quitar el override ES el
  cambio: el activo vuelve a las reglas base de `.nav-item.active`, barra +
  icono en `var(--nexus)`); la decisión quedó escrita donde vivió el override.
- **`ClinicalSpine.tsx`** — seleccionado en `var(--nexus-solido)` + texto
  `#fff` (el par AA documentado del token: 5.16:1 oscuro / 7.0:1 claro).
  `var(--bg)` encima de cobalto habría sido una cifra de contraste inventada.
- **`InstrumentStrip.tsx`** — las dos variantes (topbar móvil y fila propia)
  en `var(--nexus)`: un solo idioma para «el micrófono está abierto», y NUNCA
  rojo (la regla de MarcoEscuchando: rojo = riesgo clínico).
- **`FlowRail.tsx`** — cabecera actualizada («GREYBOX PRIMERO, ACENTO
  DESPUÉS»): el gate §12 pasó el 11-ago con capturas; la jerarquía aprobada
  no se tocó — misma barra, mismo peso, sólo el color.
- **Hallazgo de lectura previa**: la «ley Cantera + Instrument» de §33 no
  existe como documento en el repo — la fase se ejecuta contra
  `NEXUSMED_VISUAL_DNA.md` (§3: cobalto = acción/selección/ahora). Anotado en
  la cabecera de este archivo.

### Guardián nuevo, probado al revés

`src/__tests__/v15-el-acento-entra-al-shell.test.ts` (14 casos) — override
greybox ausente Y reglas base en cobalto (si alguien «limpiara» las bases,
quitar el override no dejaría acento), spine en sólido+blanco (no el par
inventado), 2 indicadores en cobalto y ninguno en rojo, freeze del latido y
del estado no seleccionado, el aquietado §8.1 intacto, y FlowRail sin estilos
inline de `--nexus` (dos fuentes del acento = la lección nx-stat-grid). 8 de
14 fallan contra el árbol previo (verificado con `git stash`).

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start`). Arnés nuevo: `scripts/design/capturar-acento-en-el-shell-v15.mjs`
— mide `getComputedStyle`, no JSX, y es el PRIMERO de la rama que escanea
también el TEMA CLARO (el token cambia de hex por tema). Resultado y 3
capturas en `docs/design/capturas/v15-acento-en-el-shell/` (1440 + 390):

- **Oscuro, medido**: barra activa `rgb(42,165,181)` = `--nexus`; icono igual;
  chip del spine `rgb(23,120,134)` = `--nexus-solido` con texto blanco;
  «Grabando» `rgb(42,165,181)`.
- **Claro, medido**: los tres puntos en `rgb(18,98,110)` = `#12626E` (el hex
  del token claro), chip con texto blanco — el acento respeta el tema, no es
  un hex pegado.
- **Al apagar la grabación**: el indicador desaparece (freeze de conducta).
- **Móvil 390**: BottomNav activo `rgb(42,165,181)` — escritorio y pulgar
  hablan por fin el MISMO acento — e indicador de topbar igual. (La primera
  corrida del arnés midió `var(--text)` en el BottomNav: era un defecto del
  ARNÉS — `nav a[aria-current]` sin scope devolvía el FlowRail oculto de
  escritorio, primero en el DOM. Corregido con scope a `.bottom-nav-wrap` y
  re-medido: cobalto.)
- **Axe oscuro: CERO violaciones** en la página completa con la grabación
  activa y el chip seleccionado.
- **Axe claro: 1 violación `color-contrast`** (serious, 1 nodo) — el `<span>`
  del TrialBanner con `#f59e0b` HARDCODED sobre fondo ámbar claro. Es
  contenido PREEXISTENTE que esta rebanada no tocó (mismo componente de las
  familias `region` ya anotadas); no había línea base previa del tema claro
  porque ningún arnés V15 lo había escaneado. Anotado para `V15-A11Y-001`
  (candidato: `var(--amber)` por tema en vez del hex) — no se repara aquí
  por no salirse de rebanada: los colores del banner de suscripción son UX
  de negocio con decisión del dueño (v972).
- **Consola**: sólo la familia conocida de reconexión del emulador.

### Compuertas de esta corrida

- `npx vitest run`: 8934 pasan + 14 casos nuevos; único fallo el
  PRE-EXISTENTE ambiental de siempre (`ops-timeout-y-punto-ciego`, proxy del
  contenedor, verificado en aislamiento con el mismo fingerprint).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio con `.env.local` demo.
- `docs/design/SCREEN_INVENTORY.md`: regenerado, sin cambios (componentes y
  hoja, no pantallas).

**Siguiente tarea exacta:** segunda rebanada de `V15-VISUAL-SYSTEM-001` —
candidatos medidos, no adivinados: (a) los roles tipográficos de VISUAL_DNA
§2 que aún no existen como clases (`.nx-ident`, `.nx-estado`, `.nx-meta`,
`.nx-num`) aplicados a UNA superficie del shell V15 ya estructurada (p.ej.
las filas de ContinuidadPanel o /pendientes) con su arnés; o (b) si una
medición nueva enseña un defecto visual más barato/valioso del shell ya
entregado, esa rebanada. La deuda de tema claro del TrialBanner queda en la
lista de `V15-A11Y-001`.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — segunda rebanada: los roles tipográficos de §2, y /pendientes los habla (12-ago-2026)

La tarea que dejó nombrada la primera rebanada («los roles tipográficos de
VISUAL_DNA §2 que aún no existen como clases, aplicados a UNA superficie del
shell V15 ya estructurada») se pagó con el inventario primero: de los cuatro
roles nombrados, DOS ya existían (`.nx-num` línea 389 de `globals.css`,
`.nx-estado` junto al riel del día) — el checkpoint anterior los daba por
inexistentes; verificado por grep antes de escribir nada. Los que faltaban:
`.nx-ident`, `.nx-meta`, `.nx-critico`.

### Las clases (globals.css, junto a .nx-display)

- **`.nx-ident`** — identidad del paciente (R3): 15.5px/1.3, **peso 600, no
  550**: IBM Plex Sans se carga en cortes estáticos 400/500/600/700
  (`layout.tsx`) y un 550 declarado resolvería a 600 por font-matching de
  todos modos — se declara lo que se pinta, con la razón escrita en la hoja
  (mismo peso que `.riel-nombre`, la primera implementación de R3).
- **`a.nx-ident`** subraya (decoración atenuada `--text3`, `--text` al
  hover/focus): dentro de una fila donde todo lo demás es texto plano, un
  enlace que sólo se distingue por color no se distingue (WCAG 1.4.1).
- **`.nx-meta`** — 12.5/`--text3`/1.5. **`.nx-critico`** — 13/700/`--red`,
  con el ICONO exigido en el JSX por el guardián, nunca sólo color.

### La superficie: /pendientes (la cola de cierre de Fase 7)

- **La identidad del paciente ENCABEZA cada entrada** — R3 nombra «tarea» en
  su lista literal, y el modelo de producto V15 §4 lo dice en clínico: «el
  resultado de ESTE paciente necesita mi decisión». Antes el paciente era un
  enlace teal de 13px enterrado en la fila de metadatos; ahora es `a.nx-ident`
  en la primera línea y SIGUE navegando al expediente (mismo destino).
  El título de la tarea baja a segunda línea (14/500): dice QUÉ, el paciente
  dice QUIÉN, y quién manda. Si una tarea trae nombre sin `patientId`, la
  identidad se pinta como `<span>` — no un href a `/expediente/undefined`
  (defecto latente del código anterior, cerrado de paso).
- **El tipo de tarea es `.nx-estado`** (versalitas + punto) en vez de su
  fontSize 11 inline; en `TarjetaCerrada` el punto va en **verde**
  (`--estado-tono: var(--green)`) — §3: cerrado/completo, atenuado, nunca
  celebratorio. Metadatos (dueño/vencimiento/detalle/aviso del modal) en
  `.nx-meta`; fechas en `.nx-num` (tabulares); el motivo de escalamiento en
  `.nx-critico` con su `AlertTriangle` en el mismo elemento.
- **Freeze funcional**: ningún `onClick`/`disabled`/texto de acción cambió
  (Tomarla · Ya se hizo · Lo revisé — cerrar · Ya no aplica), cancelar sigue
  exigiendo motivo, y el borde izquierdo de prioridad no se tocó (señal de
  seguridad, no tipografía).

### Guardián nuevo, probado al revés

`src/__tests__/v15-roles-tipograficos-en-pendientes.test.ts` (15 casos) —
clases con los valores de §2 (incluida la razón escrita del 550→600),
identidad como enlace que navega, sin enlace roto sin patientId, el teal del
metadato muerto, tipo en `.nx-estado`, verde en la cerrada, `.nx-critico` CON
icono, deriva vetada (los fontSize 11/13/15 inline retirados no vuelven), y
freeze funcional. **12 de 15 fallan contra el árbol previo** (verificado con
`git stash`); los 3 que pasan protegen el invariante funcional, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start`; `node_modules` volvió a faltar — `npm ci`). Arnés nuevo:
`scripts/design/capturar-roles-tipograficos-v15.mjs` — `getComputedStyle`,
navegación real y axe, en los DOS temas y en móvil. Resultado y 4 capturas en
`docs/design/capturas/v15-roles-tipograficos/` (1440 + 390):

- **Oscuro, medido**: ident `15.5px/600 underline rgb(242,239,233)`; estado
  `11.5 uppercase` con punto `--text3`; meta `12.5 rgb(138,143,148)`; crítico
  `13/700 rgb(230,100,100)` con `conIcono: true`; num `tabular-nums`.
- **Claro, medido**: los mismos cinco roles con los hex del tema claro — los
  tokens respetan el tema, no hay hex pegado.
- **La cerrada**: punto `rgb(27,163,77)` = `--green`, tono declarado
  `var(--green)` — visible además en la captura (tarjeta subordinada por
  opacidad, «Cerrada 10-ago» tabular).
- **Equivalencia funcional, medida**: clic real en `a.nx-ident` → la URL
  aterriza en `/expediente/pac-aurelio-dominguez` = el href declarado
  (`llega: true`), y `goBack()` vuelve al worklist.
- **Móvil 390**: sin desborde horizontal (`anchoDocumento: 390`), la
  identidad envuelve en su propia línea sin truncarse.
- **Axe: 0 violaciones en oscuro y en móvil.** En claro, 1 `color-contrast`
  (serious, 1 nodo) — **fingerprint IDÉNTICO** al de la primera rebanada (el
  `<span>` del TrialBanner con `#f59e0b` hardcoded, comparado JSON contra
  JSON): preexistente, sigue anotado para `V15-A11Y-001`, no lo causó esta
  rebanada.
- **Consola**: sólo la familia conocida de reconexión del emulador (2).
- Artefacto del arnés cazado y arreglado en la misma corrida: `fullPage`
  captura la VENTANA, no el scroll interno de `<main>` bajo `nx-app-shell` —
  la tarjeta cerrada quedaba medida pero fuera de la foto; el arnés ahora
  hace `scrollIntoView` antes de capturar.

### Compuertas de esta corrida

- `npx vitest run`: 8948 pasan + 15 casos nuevos; fallos: el PRE-EXISTENTE
  ambiental de siempre (`ops-timeout-y-punto-ciego`, proxy del contenedor,
  mismo fingerprint línea 54) y `el-inventario-de-pantallas-no-miente`, que
  exigía regenerar el inventario por el cambio de líneas de `/pendientes` —
  regenerado (80 pantallas) y en verde.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: **bajó de verdad**
  (`tamanosFueraDeEscala` 2003→1997 — los fontSize 11/13/15 inline que los
  roles reemplazaron), resellado a la baja con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio con `.env.local` demo.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/pendientes cambió de
  líneas).

**Siguiente tarea exacta:** tercera rebanada de `V15-VISUAL-SYSTEM-001` —
candidatos medidos, no adivinados: (a) los mismos roles aplicados a la
SIGUIENTE superficie ya estructurada que aún habla tamaños inline para los
mismos papeles — `ContinuidadPanel` (filas de «Sigue abierto de antes» en
/dashboard: título 14/500 inline, meta 12, escalamiento 10.5/700 en rojo
SIN clase) es la candidata natural porque comparte entidad (TareaClinica) y
debería compartir idioma con /pendientes; o (b) si una medición nueva enseña
un defecto visual más barato/valioso del shell ya entregado, esa rebanada.
La deuda de tema claro del TrialBanner sigue en la lista de `V15-A11Y-001`.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — tercera rebanada: ContinuidadPanel habla los mismos roles (12-ago-2026)

La tarea que dejó nombrada la segunda rebanada — candidata (a):
«ContinuidadPanel … comparte entidad (TareaClinica) y debería compartir
idioma con /pendientes» — se pagó completa. El defecto: una entidad, dos
jerarquías. En /pendientes el paciente ya encabezaba la entrada como
`.nx-ident`; en la zona CONTINUITY de /dashboard el MISMO paciente seguía
enterrado en la fila de metadatos a 12px («Tipo · Nombre»), y el motivo de
escalamiento era un fontSize 10.5/700 rojo SIN clase y SIN icono pegado al
texto.

### El cambio (`src/components/ContinuidadPanel.tsx`, sólo JSX)

- **La identidad encabeza la fila como `span.nx-ident`** — span, NO `<a>`,
  y esta diferencia con /pendientes es deliberada y quedó escrita en el
  JSX: la FILA ENTERA de este panel ya es un `<Link>` al expediente; un
  enlace dentro de un enlace sería nested-interactive (axe) y dos destinos
  para el mismo gesto. El subrayado de `a.nx-ident` queda para superficies
  donde la identidad es lo único que navega.
- **El tipo es `.nx-estado`** (versalitas + punto) en la cabecera de la
  fila; la fila vieja «Tipo · Nombre» a 12px murió. El título baja a
  segunda línea (14/500, el mismo valor que /pendientes conserva): el
  paciente dice QUIÉN, el título dice QUÉ, y quién manda.
- **El escalamiento es `.nx-critico` CON su `AlertTriangle`** en el mismo
  elemento (nunca sólo color, §24); el icono del carril izquierdo conserva
  su semántica de vistazo (triángulo al escalar, reloj si no).
- **El pie «+N más en el worklist» es `.nx-meta`** en vez de fontSize 12
  inline.
- **Freeze funcional**: mismo href por fila (expediente o /pendientes),
  misma vista previa de 5, mismo «Ver todo», misma fuente `tareasVivas()`
  (el guardián `v15-continuidad-en-hoy.test.ts` siguió en verde sin
  tocarse).

### Guardián nuevo, probado al revés

`src/__tests__/v15-roles-tipograficos-en-continuidad.test.ts` (11 casos) —
identidad como span que encabeza (y ANTES que el título en el fuente), veto
al enlace anidado con la razón escrita, tipo en `.nx-estado` y la fila vieja
muerta, `.nx-critico` con icono en el mismo elemento, pie en `.nx-meta`,
deriva vetada (fontSize 10.5/12 inline no vuelven), y freeze funcional
(href, TOPE_VISIBLE=5, icono del carril, tareasVivas). **7 de 11 fallan
contra el árbol previo** (verificado con `git stash`); los 4 que pasan
protegen el invariante funcional, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start`; `node_modules` volvió a faltar — `npm ci`; el arnés se corrió
vía `arnes-breakpoints-v15.sh` reutilizado, que ya empaqueta siembra +
next start). Arnés nuevo: `scripts/design/capturar-roles-continuidad-v15.mjs`
— `getComputedStyle` DENTRO del panel, navegación real y axe, en los DOS
temas y en móvil. Resultado y 3 capturas en
`docs/design/capturas/v15-roles-continuidad/` (1440 + 390):

- **Oscuro, medido**: 5 filas; ident `15.5px/600 rgb(242,239,233)` SIN
  subrayado (`identEsEnlace: false`, `interactivosAnidados: 0`); estado
  `11.5 uppercase` con punto; crítico `13/700 rgb(230,100,100)` con
  `conIcono: true` («Prioridad crítica sin nadie asignado.»).
- **Claro, medido**: los mismos roles con los hex del tema claro (ident
  `rgb(11,12,14)`, crítico `rgb(185,28,28)`) — tokens por tema, no hex
  pegado.
- **Equivalencia funcional, medida**: clic real en la PRIMERA fila → la URL
  aterriza en `/expediente/pac-aurelio-dominguez` = el href declarado
  (`llega: true`), y `goBack()` vuelve a Hoy con el panel vivo.
- **Móvil 390**: sin desborde horizontal (`anchoDocumento: 390`), la
  identidad envuelve sin truncarse.
- **Axe: 0 violaciones en oscuro y en móvil.** En claro, 1 `color-contrast`
  (serious, 1 nodo) — **fingerprint IDÉNTICO byte a byte** al de las dos
  rebanadas anteriores (el `<span>` del TrialBanner con `#f59e0b` hardcoded,
  comparado JSON contra JSON): preexistente, sigue anotado para
  `V15-A11Y-001`, no lo causó esta rebanada.
- **Consola**: 0 errores, en desktop y en móvil.

### Compuertas de esta corrida

- `npx vitest run`: 8964 pasan + 11 casos nuevos; único fallo el
  PRE-EXISTENTE ambiental de siempre (`ops-timeout-y-punto-ciego`, proxy del
  contenedor, mismo fingerprint). `nx-stat-grid-cableada` y toda la familia
  de guardianes V15 en verde.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (los
  tamaños retirados, 10.5 y 12, ya eran de la escala oficial — el conteo no
  baja, tampoco sube).
- `npm run build`: compila limpio con `.env.local` demo (el build que sirvió
  la verificación).
- `docs/design/SCREEN_INVENTORY.md`: sin regenerar — `ContinuidadPanel.tsx`
  es componente, `dashboard/page.tsx` no cambió de líneas (el guardián
  `el-inventario-de-pantallas-no-miente` pasó en la suite).

**Siguiente tarea exacta:** cuarta rebanada de `V15-VISUAL-SYSTEM-001` —
candidatos medidos, no adivinados: (a) inventariar con grep qué OTRAS
superficies del shell V15 ya estructurado siguen hablando tamaños inline
para los papeles de §2 (candidata natural: el riel de «Agenda de hoy» en
/dashboard ya habla `.riel-nombre`/`.nx-estado` — verificar si PatientAnchor
y las filas de /pacientes hablan los roles o tamaños a mano) y migrar UNA
con su arnés; o (b) si una medición nueva enseña un defecto visual más
barato/valioso del shell ya entregado, esa rebanada. La deuda de tema claro
del TrialBanner sigue en la lista de `V15-A11Y-001`.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — cuarta rebanada: las filas de /pacientes hablan los mismos roles (12-ago-2026)

La tarea que dejó nombrada la tercera rebanada — candidata (a): inventariar
con grep qué superficies estructuradas siguen hablando tamaños inline para
los papeles de §2 — se ejecutó y se pagó UNA superficie. El inventario: el
riel de «Agenda de hoy» ya habla `.riel-nombre`/`.nx-estado` (en regla);
`PatientAnchor` tiene 6 fontSize inline pero su identidad es un `<h1>` de
cabecera de workspace, no el papel R3 de fila; las filas de `/pacientes`
tenían el defecto exacto de la familia: la identidad — EL contenido del
directorio — era `fontSize: 14` inline con `whiteSpace: nowrap` +
`textOverflow: ellipsis`. Dos defectos en uno: idioma distinto al de
/pendientes y Hoy, y la identidad del paciente TRUNCADA con puntos
suspensivos justo donde más nombres compuestos largos se ven (§24: no
critical truncation).

### El cambio (`src/app/(dashboard)/pacientes/page.tsx`, sólo el JSX de `PacienteRow`)

- **La identidad encabeza la fila como `span.nx-ident`** (`display: block`)
  — span, NO enlace, y la razón quedó escrita en el JSX: la fila entera ya
  es `role="button"` (activable) y abre el expediente; un enlace dentro
  sería nested-interactive y dos destinos para el mismo gesto. Misma
  decisión deliberada que ContinuidadPanel.
- **El nombre ENVUELVE**: nowrap/hidden/ellipsis retirados — `.nx-ident`
  trae `overflow-wrap: anywhere`.
- **El metadato (teléfono · edad · internado) es `.nx-meta`** en vez de
  fontSize 12 inline; conserva su flex/gap/wrap inline (no son tipografía).
- **Lo que NO se tocó, a propósito**: el avatar (15), las píldoras de
  no-show/cancelación (11), el botón Editar (12/600), los encabezados de
  sección (11.5 uppercase) — no son papeles de §2; cada rol se paga en su
  rebanada.
- **Freeze funcional**: misma etiqueta accesible («Abrir el expediente de
  X»), mismo stopPropagation del botón Editar, mismas píldoras, mismo
  marcador de internado.

### Guardián nuevo, probado al revés

`src/__tests__/v15-roles-tipograficos-en-pacientes.test.ts` (10 casos) —
identidad como span.nx-ident, veto al enlace anidado con la razón escrita,
veto al ellipsis sobre la identidad, metadato en .nx-meta, deriva vetada
(fontSize 14 no vuelve a la fila), y freeze funcional (activable+etiqueta,
stopPropagation, internado, píldoras). Los vetos se recortan al segmento
`function PacienteRow` → `function PatientModal` para no vetar los fontSize
legítimos del resto de la página. **5 de 10 fallan contra el árbol previo**
(verificado con `git stash`); los 5 que pasan protegen el invariante
funcional, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-roles-pacientes-v15.mjs` — `getComputedStyle`
DENTRO de las filas, navegación real y axe, en los DOS temas y en móvil.
Resultado y 3 capturas en `docs/design/capturas/v15-roles-pacientes/`
(1440 + 390):

- **Oscuro, medido**: 5 filas (Recientes); ident `15.5px/600
  rgb(242,239,233)` sin subrayado, `whiteSpace: normal`, `textOverflow:
  clip`; meta `12.5px rgb(138,143,148)`; `enlacesAnidados: 0`,
  `identEsEnlace: false`.
- **Claro, medido**: los mismos roles con los hex del tema claro (ident
  `rgb(11,12,14)`, meta `rgb(107,111,117)`) — tokens por tema.
- **La identidad envuelve**: «María del Refugio Alcántara Solís» —
  `recortado: false` en 1440 (1 línea) y en 390 (3 líneas), documento a 390
  exactos, sin desborde horizontal.
- **Equivalencia funcional, medida**: clic real en la primera fila → la URL
  aterriza en `/expediente/pac-luzmaria-cervantes` (`llega: true`).
- **Axe**: cero violaciones CAUSADAS por la rebanada. Dos hallazgos
  PREEXISTENTES quedan anotados a `V15-A11Y-001`: (1) `nested-interactive`,
  5 nodos, en los dos temas y en móvil — el botón Editar vive DENTRO de la
  fila `role="button"` desde antes de V15 (primera medición axe de
  /pacientes en la rama; la rebanada no añadió interactivos: la identidad es
  span); (2) `color-contrast` claro, 2 nodos — el TrialBanner de
  `(dashboard)/layout.tsx` (span `#f59e0b` + su botón CTA), la familia ya
  conocida de las rebanadas 2-3 (allí 1 nodo porque /dashboard pinta otra
  variante del banner).
- **Consola**: sólo el aviso familiar de reconexión de Firestore del
  emulador (desktop y móvil) — ambiental; los datos SÍ llegaron (5 filas
  pintadas y navegación real).

### Compuertas de esta corrida

- `npx vitest run`: 8974 pasan (618 archivos) + los 10 casos nuevos; único
  fallo el PRE-EXISTENTE ambiental de siempre (`ops-timeout-y-punto-ciego`,
  el proxy del contenedor responde en vez de agotar, mismo fingerprint).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (14 y 12
  eran de la escala oficial — el conteo no baja, tampoco sube).
- `npm run build`: compila limpio (162 páginas) con `.env.local` demo.
  **Nota operativa**: el `.env.local` mínimo de 2 variables NO basta para
  el build — `/dr/[clinicId]` evalúa `src/lib/firebase.ts` al recolectar
  datos de página y `getAuth` revienta con `auth/invalid-api-key`; hacen
  falta las 7 (`NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key`, AUTH_DOMAIN,
  PROJECT_ID, STORAGE_BUCKET, SENDER_ID, APP_ID y EMULATORS=1). También:
  un build puede fallar transitorio en las fuentes de Google (proxy del
  contenedor) — reintentar antes de diagnosticar.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/pacientes cambió de
  líneas).

**Siguiente tarea exacta (histórico — ejecutada por la quinta rebanada):**
quinta rebanada de `V15-VISUAL-SYSTEM-001` —
candidatos medidos, no adivinados: (a) el inventario de la cuarta rebanada
dejó UNA superficie estructurada con tamaños a mano sin pagar:
`PatientAnchor` (6 fontSize inline — cabecera del Patient Workspace; decidir
si su `<h1>` de identidad merece un rol de cabecera propio en vez de
.nx-ident de fila, y si sus 12px de metadatos/alergias son .nx-meta); o
(b) si una medición nueva enseña un defecto visual más barato/valioso del
shell ya entregado, esa rebanada. La deuda anotada de `V15-A11Y-001` creció:
TrialBanner claro (2 nodos en /pacientes) + `nested-interactive` del botón
Editar en las filas de /pacientes (preexistente, 5 nodos).

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — quinta rebanada: el Patient Anchor habla los roles de §2, y su identidad es nivel display (12-ago-2026)

Se ejecutó la candidata (a) que dejó nombrada la cuarta rebanada:
`PatientAnchor.tsx`, la última superficie estructurada del shell V15 con
papeles de §2 hablados en dialecto propio (6 fontSize inline). La decisión
de diseño que la tarea pedía tomar — ¿la identidad del ancla es `.nx-ident`
de fila o un rol de cabecera propio? — la responde VISUAL_DNA §1 R3
literalmente: «Serif Fraunces SOLO en el nivel display (saludo, **nombre del
paciente en su espacio clínico**)». El Patient Workspace ES ese espacio: la
identidad del ancla es nivel display, no fila.

### El cambio

- **`src/app/globals.css`** — `.nx-ancla-nombre` nace junto a los otros
  roles de §2, con la razón escrita en el comentario: Fraunces la pone
  `.nx-display` (se usan juntas), la clase pone 20px de la escala oficial
  (el ancla es pegajosa y compacta — no el saludo de 32px de /dashboard),
  peso 600, `overflow-wrap: anywhere` y `color: var(--text)`. Además
  `.nx-critico` gana `flex-wrap: wrap`: era `inline-flex` sin wrap y un
  valor crítico largo (una alergia con su reacción entre paréntesis)
  DESBORDABA en 390px — recortar justo el texto crítico es la truncación
  que §24 prohíbe.
- **`src/components/expediente/PatientAnchor.tsx`** —
  1. El `<h1>` es `className="nx-display nx-ancla-nombre"`, sin style: su
     tipografía vive en la clase (era `fontSize: 16, fontWeight: 700`
     grotesca — tamaño de fila de lista para el título del workspace).
  2. Edad · sexo · teléfono es `.nx-meta` (era fontSize 12 inline).
  3. «Último cambio» es `.nx-meta` y conserva sólo su `marginLeft: 'auto'`
     (layout, no tipografía).
  4. La alergia REGISTRADA es `span.nx-critico` — 13/700 en `--red` CON el
     icono AlertTriangle al lado en la misma fila (nunca sólo color). «No
     registradas» NO lleva la clase: es un dato del registro, no un valor
     crítico — la distinción quedó escrita en el JSX.
  5. Lo que NO se tocó, a propósito: la inicial del avatar (16), el botón
     «continuar» (12) y el cuerpo del aviso (`alertaEstilo`, 12) no son
     papeles de §2 — cada rol se paga en su rebanada.
- **Freeze funcional**: el aviso sigue SIEMPRE visible (nunca condicional a
  que existan alergias), el vacío sigue diciendo «no registradas», el ancla
  sigue sticky, la derivación de `notas` no se tocó.

### Guardián nuevo, probado al revés

`src/__tests__/v15-roles-tipograficos-en-patient-anchor.test.ts` (13 casos)
— display en el h1, deriva vetada (ni `<h1 style=` ni un cuarto fontSize
inline), `.nx-ancla-nombre` en la hoja con 20px + overflow-wrap, metadatos
en `.nx-meta`, alergia condicional a `.nx-critico` con icono real al lado,
`.nx-critico` envuelve, y freeze funcional. **11 de 13 fallan contra el
árbol previo** (verificado con `git stash`); los 2 que pasan protegen el
invariante funcional (aviso siempre visible, sticky), no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-roles-patient-anchor-v15.mjs` — `getComputedStyle`
DENTRO del ancla, scroll real, axe, en los DOS temas y en móvil. Resultado y
4 capturas en `docs/design/capturas/v15-roles-patient-anchor/` (1440 + 390):

- **Oscuro, medido** (`/expediente/pac-aurelio-dominguez`): h1 `Fraunces
  20px/600 rgb(242,239,233)` con `overflow-wrap: anywhere`; meta `12.5px
  rgb(138,143,148)`; crítico `13px/700 rgb(230,100,100)` con `flex-wrap:
  wrap` e `iconoJuntoAlCritico: true`.
- **Claro, medido**: los mismos roles con los hex del tema claro (h1
  `rgb(11,12,14)`, crítico `rgb(185,28,28)`) — tokens por tema.
- **La distinción crítico/neutro es real**: en
  `/expediente/pac-refugio-alcantara` (sin alergias) el aviso dice
  «Alergias: no registradas» y `elAvisoNeutroLlevaCritico: false`.
- **Sticky medido de verdad** (§7): `main.scrollTop = 446` y el nombre
  sigue dentro del viewport (`visibleTrasScroll: true`).
- **Móvil 390**: el nombre largo sembrado cabe sin recorte ni desborde
  (`recortado: false`, documento a 390 exactos); la alergia con reacción
  larga tampoco desborda (`criticoRecortado: false`, `flexWrap: wrap`).
- **Axe**: oscuro 0 · móvil 0 · claro 1 (`color-contrast`, 1 nodo: el span
  del TrialBanner del shell — la familia PREEXISTENTE ya anotada en
  `V15-A11Y-001` desde las rebanadas 2-4; el ancla no aporta nodos).
- **Consola**: sólo el aviso familiar de reconexión de Firestore del
  emulador (desktop y móvil) — ambiental; los datos SÍ llegaron (ancla
  pintada con paciente, alergia y navegación real).
- **Nota de honestidad del arnés**: la siembra no crea documentos
  `NotaMedica`, así que «Último cambio» y «Consulta sin cerrar» no se
  pintan en el emulador — su tipografía la vigila el guardián estático;
  el arnés lo declara en su cabecera en vez de fingir que lo midió.

### Compuertas de esta corrida

- `npx vitest run`: **8988 pasan (619 archivos), CERO fallos** — incluso el
  ambiental `ops-timeout-y-punto-ciego` pasó en este contenedor.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (los
  fontSize retirados eran de la escala, el conteo no se movió: 1997).
- `npm run build`: compila limpio con `.env.local` demo. **Dos lecciones
  operativas del contenedor**: (1) la variable es
  `NEXT_PUBLIC_FIREBASE_EMULATORS=1` — «EMULATORS=1» a secas no conecta
  los emuladores y el login del arnés se cae por timeout; (2) si un arnés
  anterior murió sin limpiar, su `next start` huérfano sigue sirviendo el
  build VIEJO en el 3000 (chunks 500/MIME text-plain) — matar el proceso
  antes de diagnosticar el build.

**Siguiente tarea exacta:** sexta rebanada de `V15-VISUAL-SYSTEM-001` —
candidatos medidos, no adivinados: (a) el defecto visual MÁS medido de la
rama es el TrialBanner en tema claro (`color-contrast`, span `#f59e0b` +
botón CTA — apareció en las mediciones de las rebanadas 2, 3, 4 y 5;
técnicamente vive en la lista de `V15-A11Y-001` pero es trabajo de sistema
visual puro: tokens de color por tema para el banner); pagarlo cerraría la
única violación axe recurrente de las superficies V15. O (b) inventariar
con grep si queda ALGUNA superficie del shell V15 estructurado con papeles
de §2 en dialecto propio — si el inventario sale vacío, declarar el paso 7
de §18 (tokens/roles) COMPLETO en esta fase y decidir el cierre de Fase 10
contra los pasos 8-9 (motion, polish) con la misma vara de comportamientos
medidos que usaron las fases 5 y 6.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — sexta rebanada: el TrialBanner habla tokens por tema, y el hallazgo axe recurrente muere (12-ago-2026)

Se ejecutó la candidata (a) que dejó nombrada la quinta rebanada: pagar el
defecto visual más medido de la rama — el `color-contrast` del TrialBanner
en tema claro, presente con fingerprint idéntico en las mediciones de las
rebanadas 2, 3, 4 y 5.

### El cambio

- **`src/app/(dashboard)/layout.tsx` (`TrialBanner`, las dos variantes)** —
  fuera `#f59e0b`/`#f87171`/`#000` (7 hex de la lista CRUDOS). El arreglo se
  midió con la fórmula de luminancia WCAG 2.1 ANTES de escribirse, porque la
  respuesta obvia («usa var(--amber)») está MAL para el texto: #B45309 sobre
  el tinte del banner en claro mide ≈4.3:1 < 4.5. Forma final:
  1. el MENSAJE va en `var(--text)` — como ya hacía la variante de prueba
     VENCIDA del mismo banner desde que existe; la urgencia la dicen icono +
     tinte + CTA (nunca sólo color, §24);
  2. el ICONO va en `var(--red)`/`var(--amber)` — no-textual (WCAG 1.4.11,
     3:1): pasa en los dos temas (4.2/4.3/3.9/5.7);
  3. los DOS CTA de relleno sólido usan `--sobre-aviso`, token nuevo en
     `globals.css`: tinta #0B0C0E en oscuro (5.9:1 amber / 5.8:1 red),
     blanco en claro (4.8:1 / 6.5:1), definido en `:root`,
     `[data-theme="light"]`, `prefers-color-scheme: light` y `@media print`.
- **`src/app/(dashboard)/pacientes/page.tsx` (chip activo del directorio)** —
  el «segundo nodo» que la cuarta rebanada atribuyó al CTA del banner (su
  arnés recortaba los datos de axe) resultó ser OTRA superficie, identificada
  porque el arnés de ESTA rebanada guarda el failureSummary completo:
  `Recientes (5)` activo pintaba `#000` sobre `var(--teal)` — 2.99:1 en
  claro, el token de TRAZO usado como fondo. Ahora: `var(--nexus-solido)` +
  `#fff`, el par YA medido del sistema (5.16:1 oscuro / 7.0:1 claro, el
  mismo de `.btn-primary`). De paso el chip activo quedó visualmente
  consistente con «Nuevo paciente» en la misma pantalla.
- **Freeze funcional**: mismos href (`/configuracion?tab=suscripcion` ×2),
  mismos textos, misma compuerta `clinic.plan !== 'trial'`, mismo
  `estadoPaywall`, mismo cómputo de días; el chip conserva su onClick y sus
  tres filtros.

### Trinquetes BAJADOS de verdad (no sólo «sin deuda nueva»)

- `color-trinquete.test.ts`: `TECHO_CRUDOS` 265→256 — los 7 hex del banner.
- `trinquete-de-diseno.mjs`: `hexEnLinea` 508→501, resellado con
  `--actualizar` (el guardián `el-sistema-de-diseno-no-pierde-terreno` exige
  el sello exacto, sin holgura — se puso rojo él solo en la suite completa y
  eso ES el guardián funcionando).

### Guardián nuevo, probado al revés

`src/__tests__/v15-trial-banner-tokens-por-tema.test.ts` (8 casos) — los hex
de fondo oscuro no vuelven al banner, el `#000` tampoco, icono con tokens
por urgencia, mensaje en `var(--text)` con la razón medida escrita, los dos
CTA con `--sobre-aviso`, el token definido en los cuatro bloques de tema, el
chip de /pacientes en relleno sólido, y freeze funcional. **6 de 8 fallan
contra el árbol previo** (git stash del banner) y el caso del chip falla por
separado (git stash de /pacientes); los que pasan protegen el invariante
funcional, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-trial-banner-v15.mjs` — `getComputedStyle` del span
/icono/CTA, navegación real del CTA, axe con failureSummary COMPLETO, en los
DOS temas y en móvil. Resultado y 3 capturas en
`docs/design/capturas/v15-trial-banner/` (1440 + 390):

- **Oscuro, medido**: span `rgb(242,239,233)` = `--text`; CTA fondo
  `rgb(217,119,6)` = `--amber` oscuro.
- **Claro, medido**: span `rgb(11,12,14)` = tinta; CTA fondo `rgb(180,83,9)`
  = `--amber` claro con texto `rgb(255,255,255)` = `--sobre-aviso`.
- **Axe: 0 `color-contrast` en claro, oscuro Y móvil** — la violación
  recurrente de las rebanadas 2-5 muere. Única restante:
  `nested-interactive` ×5 (botón Editar dentro de la fila role="button",
  PREEXISTENTE, ya anotada a `V15-A11Y-001`) — y su presencia confirma que
  las filas se pintaron de verdad.
- **Equivalencia funcional, medida**: clic real en «Activar plan →» aterriza
  en `/configuracion?tab=suscripcion` (`llega: true`).
- **Móvil 390**: sin desborde (`anchoDocumento: 390`).
- **Consola**: sólo el aviso familiar de reconexión del emulador (1).
- **Honestidad del arnés**: una corrida intermedia dio «0 violaciones en
  TODO» con 10 errores de consola — era el `next start` HUÉRFANO de un arnés
  anterior sirviendo un build viejo (ChunkLoadError + error boundary: se
  estaba midiendo una página rota). Se detectó por la DESAPARICIÓN de la
  violación preexistente conocida (una medición demasiado buena es
  sospechosa), se mató el proceso (la lección de la quinta rebanada dice
  `next start` pero el proceso se llama `next-server`) y se re-midió contra
  el build real. La cifra buena de arriba es la de la re-medición.

### Compuertas de esta corrida

- `npx vitest run` (suite completa final): ver resultado en el reporte de la
  corrida; los guardianes tocados (color-trinquete, diseño-no-pierde-terreno,
  inventario, roles-en-pacientes, trial-banner) todos en verde en corrida
  dirigida.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: hexEnLinea BAJÓ 508→501.
- `npx tsc --noEmit`: limpio (y cazó de verdad: el primer intento de
  comentario JSX dentro de `return (` era un error de sintaxis — el build lo
  detuvo antes de llegar a ninguna medición).
- `npm run build`: compila limpio (un intento falló transitorio en Google
  Fonts por el proxy del contenedor — reintentar antes de diagnosticar, como
  ya documentó la cuarta rebanada).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/pacientes cambió de
  líneas).

**Siguiente tarea exacta (histórico — ejecutada por la séptima rebanada):**
séptima rebanada de `V15-VISUAL-SYSTEM-001` —
la candidata (b) que la quinta rebanada dejó pendiente: inventariar con grep
si queda ALGUNA superficie del shell V15 estructurado con papeles de §2 en
dialecto propio — si el inventario sale vacío, declarar el paso 7 de §18
(tokens/roles) COMPLETO en esta fase y decidir el cierre de Fase 10 contra
los pasos 8-9 (motion, polish) con la misma vara de comportamientos medidos
que usaron las fases 5 y 6. La deuda de `V15-A11Y-001` queda ahora SIN la
familia TrialBanner (pagada aquí): restan `nested-interactive` (Editar en
filas de /pacientes), `landmark-unique`/`region`, táctiles chicos y
contrastes de /chat anotados por Fase 9.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — séptima rebanada: el inventario de §2 NO salió vacío, y Hoy habla los roles (12-ago-2026)

Se ejecutó la candidata (b): el inventario por grep de `fontSize` inline en
TODAS las superficies estructuradas del shell V15 (FlowRail, InstrumentStrip,
ContinuidadPanel, PatientAnchor, ClinicalSpine, BottomNav, CierreAlPulgar,
NotificacionesPushOptIn, /operaciones, /pendientes, /pacientes, /dashboard).
**No salió vacío** — el paso 7 de §18 NO puede declararse completo todavía.
Lo encontrado, clasificado papel por papel contra la tabla de §2:

- **`/dashboard` — ProxHero (NOW) y AppointmentRow (TODAY)**: identidad del
  paciente en dialecto propio (16/600 y 14/500 inline) CON ellipsis — la
  truncación de identidad que §24 prohíbe — y en la fila la HORA a 700
  pesaba más que el nombre a 500 (R3 invertida). **Pagado en esta rebanada**
  (la superficie más usada del producto; ver abajo).
- **`InstrumentStrip`**: la identidad del paciente vive como cromo de 12px/
  `--text2` con ellipsis (más CHICA que el nombre del consultorio de
  respaldo, 16px), y los dígitos del timer de grabación no son tabulares
  (tiemblan cada segundo). Queda nombrada — exige una decisión de diseño
  propia: .nx-ident de 15.5 en una franja de 30px es una pregunta de §5
  Capa 1, no un reemplazo mecánico de clase.
- **`ClinicalSpine`**: los conteos (10.5/800) sin `tabular-nums` (.nx-num).
- **`/pacientes`**: las tarjetas de duplicados (modal «Posibles expedientes
  repetidos» y el aviso «¿Puede que ya esté registrado?» del formulario)
  pintan `p.nombre`/`c.paciente.nombre` a 13/600 y 13.5/600 inline —
  identidad estructurada de §2 fuera de la fila del directorio ya migrada.
- **`PanelPendientes`**: `detalle` a 11.5/text3 inline (en /pendientes la
  misma pieza ya es `.nx-meta`) y el «+N más» del pie, ídem.
- **NO son papeles de §2** (misma vara que las rebanadas 4–6, no se tocan):
  las etiquetas de navegación de FlowRail/BottomNav/ClinicalSpine (cromo),
  los títulos de tarea (contenido, como decidió /pendientes con `titulo` a
  14/500), los avatares-inicial, los CTA, y los textos del banner de push.

### El cambio (dashboard/page.tsx — las dos zonas con identidad)

- **`AppointmentRow`**: hora `700` inline + `fontVariantNumeric` a mano →
  `span.riel-hora` + `span.riel-dur` (el idioma que ya habla el riel de
  /citas: 14/600 tabular — y el nombre a 15.5 vuelve a dominar su entrada,
  R3); nombre `div` 14/500 con ellipsis → `span.nx-ident` display:block que
  ENVUELVE; metadato (tipo · motivo) 12/text3 inline → `.nx-meta`.
- **`ProxHero`**: nombre `div` 16/600 con ellipsis → `span.nx-ident` — la
  dominancia del héroe la dan su posición, el avatar y el CTA (§16), no un
  tamaño inventado; hora `t-num` 13 inline → `.riel-hora` (inline);
  metadato 13/text2 → `.nx-meta`.
- **Freeze funcional**: mismos href (`/citas?id=...`, `/consulta/[pid]`),
  misma compuerta `puedeIniciar`, mismo StatusBadge, mismo atenuado 0.6 de
  lo pasado, misma selección de `prox`.

### Guardián nuevo, probado al revés

`src/__tests__/v15-roles-tipograficos-en-hoy.test.ts` (13 casos) — identidad
como .nx-ident en las dos zonas, cero ellipsis/nowrap en los segmentos, hora
en .riel-hora/.riel-dur sin 700 ni fontVariantNumeric a mano, metadato en
.nx-meta, veto de deriva (los tamaños retirados no vuelven) y freeze
funcional. **9 de 13 fallan contra el árbol previo** (verificado con
`git stash`); los 4 que pasan protegen el invariante funcional y la
existencia de los segmentos.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-roles-hoy-v15.mjs` — `getComputedStyle` dentro del
héroe Y de la fila, clic real en los dos caminos, axe con failureSummary,
en los DOS temas y en móvil. Resultado y 3 capturas en
`docs/design/capturas/v15-roles-hoy/` (1440 + 390). La corrida cayó a las
06:43 de America/Mexico_City, ANTES de la primera cita sembrada — el héroe
NOW se pintó de verdad (con el nombre largo sembrado, además):

- **Oscuro, medido**: héroe y fila `15.5px/600 rgb(242,239,233)` con
  `overflow-wrap: anywhere` y SIN ellipsis computado; hora `14px/600
  tabular-nums`; dur `11px tabular-nums`; meta `12.5px rgb(138,143,148)`.
  `nombreDominaSobreHora: true`.
- **Claro, medido**: los mismos roles con la tinta del claro
  (`rgb(11,12,14)`) — tokens por tema.
- **Equivalencia funcional, medida con clic real**: la fila aterriza en
  `/citas?id=cita-hoy-0900` (`llega: true`) y el CTA del héroe en
  `/consulta/pac-refugio-alcantara` (`llega: true`).
- **Móvil 390**: sin desborde (`anchoDocumento: 390`); el nombre largo
  («María del Refugio Alcántara Solís») envuelve a 2 líneas en la fila y
  completo en el héroe — antes se truncaba con puntos suspensivos.
- **Axe: 0 violaciones en oscuro, claro Y móvil** — /dashboard queda sin
  ninguna violación medible con la siembra del arnés.
- **Consola: 0 errores** (desktop y móvil).

### Compuertas de esta corrida

- `npx vitest run`: ver reporte de la corrida (suite completa lanzada tras
  las compuertas dirigidas; guardianes tocados — roles-en-hoy,
  no-es-un-tablero, continuidad-en-hoy, inventario, diseño-no-pierde-terreno
  — todos en verde en corrida dirigida).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: `tamanosFueraDeEscala`
  BAJÓ 1997→1995, resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio con `.env.local` demo (las 7 variables +
  `NEXT_PUBLIC_FIREBASE_EMULATORS=1`, receta de la quinta rebanada).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/dashboard cambió de
  líneas).

**Siguiente tarea exacta (histórico — ejecutada por la octava rebanada):**
octava rebanada de `V15-VISUAL-SYSTEM-001` — el
inventario de la séptima dejó CUATRO superficies de §2 nombradas y ninguna
nueva por descubrir: (a) **InstrumentStrip** — la de más peso clínico: la
identidad del paciente como cromo de 12px con ellipsis, MÁS CHICA que el
nombre del consultorio de respaldo (16px), y el timer de grabación sin
tabular-nums; exige decidir qué significa .nx-ident dentro de una franja
periférica de 30px (§5 Capa 1: «current patient» es el PRIMER estado
periférico) — la decisión de diseño es de esa rebanada, no mecánica. O
(b) las tres mecánicas juntas como una sola rebanada de barrido: conteos de
ClinicalSpine a .nx-num, tarjetas de duplicados de /pacientes a
.nx-ident/.nx-meta, y detalle/pie de PanelPendientes a .nx-meta. Cuando (a)
y (b) estén pagadas, el inventario queda vacío: declarar el paso 7 de §18
COMPLETO y decidir el cierre de Fase 10 contra los pasos 8-9 (motion,
polish) con la vara de comportamientos medidos de las fases 5 y 6.

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 paso 7) — octava rebanada: la identidad de la franja tiene una voz, y el inventario de §2 queda VACÍO (12-ago-2026)

Se ejecutaron JUNTAS las candidatas (a) y (b) que dejó nombradas la séptima
rebanada — el costo del arnés (emuladores + siembra + build de producción +
navegador real) se paga una vez por corrida, y las dos candidatas comparten
exactamente ese arnés. Con las dos pagadas, el inventario por grep de la
séptima queda VACÍO: ninguna superficie estructurada del shell V15 habla
papeles de §2 en dialecto propio.

### (a) InstrumentStrip — la decisión de diseño, escrita donde vive la regla

La pregunta que la séptima dejó planteada: ¿qué significa `.nx-ident` (15.5)
dentro de una franja periférica de 30px? Respuesta — NO es .nx-ident:

- **`.nx-ident-franja`** (nueva en `globals.css`, con la decisión escrita en
  el comentario): la identidad de la franja tiene UNA voz — 14px de la
  escala oficial, 600, `var(--text)` — y la porta el paciente cuando hay
  paciente en la ruta («current patient» es el PRIMER estado periférico de
  §5 Capa 1), el consultorio cuando no. Más fuerte que el cromo de la franja
  (12/`--text3`), por debajo de la identidad de lienzo (15.5) y del ancla
  (20): periférica, no protagonista. Antes el paciente era cromo de
  12/`--text2` CON ellipsis de una línea mientras el respaldo del
  consultorio pintaba 16 inline: la franja hablaba más fuerte cuando
  enseñaba lo MENOS importante.
- **`.nx-ident-franja--clamp`**: en la topbar de una fila (móvil) el nombre
  ENVUELVE hasta 2 líneas y sólo más allá se recorta — excepción DECLARADA a
  «la identidad no se trunca» (§24), con la razón en la hoja: la franja es
  eco periférico, este mismo enlace lleva al ancla donde el nombre vive
  completo a nivel display, y crecer sin tope empujaría el indicador de
  grabación (señal de seguridad) fuera de la fila. El enlace centra un
  objetivo táctil de `minHeight: 44`.
- **`a.nx-ident-franja`** conserva el subrayado atenuado de `a.nx-ident`
  (WCAG 1.4.1: junto al nombre del consultorio en texto plano, un enlace que
  sólo se distingue por color no se distingue).
- El separador «·» del escritorio salió DEL enlace (`<span aria-hidden>`):
  subrayar el punto diría que también navega.
- El timer de grabación lleva `nx-num` en las dos variantes: los dígitos son
  tabulares, el ancho ya no tiembla a cada segundo.
- **Freeze funcional**: mismo `getPatient()` reutilizado, mismo filtro por
  id contra la ruta, mismos href `/expediente/[pid]`, mismo cobalto de
  grabación.

### (b) El barrido final

- **`ClinicalSpine`**: los dos conteos (10.5/800) llevan `nx-num` — cifras
  clínicas tabulares (§2).
- **`/pacientes`**: la tarjeta del modal «Posibles expedientes repetidos»
  (`p.nombre` 13/600 → `span.nx-ident` block; metadatos 11.5 → `.nx-meta`,
  incluido el motivo del par) y el aviso del formulario
  (`c.paciente.nombre` 13.5/600 → `.nx-ident`; su metadato → `.nx-meta`).
  Los onClick/href de las tarjetas no cambiaron.
- **`PanelPendientes`**: `detalle` y «+N más» (11.5 inline) → `.nx-meta` —
  la misma pieza que /pendientes ya hablaba con ese rol. Los títulos de
  acción NO se tocan (contenido, no rol de §2 — misma vara que la séptima).

### Guardián nuevo, probado al revés

`src/__tests__/v15-roles-tipograficos-en-franja-y-barrido.test.ts` (15
casos) — la clase existe con la decisión y la excepción DECLARADAS, el
enlace del paciente la habla en las dos variantes, el clamp vive en un span
interior (no ellipsis en el Link), veto de deriva (ni 16 inline ni cromo
--text2 vuelven), táctil de 44 escrito, timer y conteos `nx-num`, duplicados
y PanelPendientes en sus roles, y freeze funcional de franja y barrido.
**13 de 15 fallan contra el árbol previo** (verificado con `git stash` de
los cinco archivos tocados); los 2 que pasan protegen el invariante
funcional (getPatient + onClick de duplicados), no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`capturar-roles-franja-v15.mjs` — `getComputedStyle` de enlace/respaldo/
timer/conteos, grabación simulada con el MISMO `CustomEvent('nx:grabando')`
que dispara `avisarEscucha()` (el micrófono real no es lo que este cambio
toca), clic real, axe con failureSummary, dos temas y móvil. Resultado y 3
capturas en `docs/design/capturas/v15-roles-franja/` (1440 + 390):

- **Oscuro, medido** (`/referencia/pac-refugio-alcantara` — la pantalla sin
  ningún otro rastro del paciente, la razón de ser de la franja): enlace
  `14px/600 rgb(242,239,233)` con `underline`; cromo del consultorio
  `12px/600 rgb(168,172,174)`; `identidadDominaCromo: true`; timer
  `tabular-nums` en cobalto.
- **Claro, medido**: enlace `14px/600 rgb(11,12,14)` — tokens por tema.
- **Equivalencia funcional, clic real**: el enlace de la franja aterriza en
  `/expediente/pac-refugio-alcantara` (`llega: true`).
- **Barrido medido**: conteo del ClinicalSpine `tabular-nums` en el
  expediente real; detalle de PanelPendientes en /dashboard pinta `.nx-meta`
  12.5/`--text3`.
- **Móvil 390**: enlace de topbar `14px` con clamp 2, objetivo táctil de
  **44px exactos** medidos, nombre completo en el DOM
  (`nombreCompleto: true` — con la fuente real cupo en 1 línea; el clamp
  queda para nombres más largos), sin desborde (`anchoDocumento: 390`); el
  respaldo «Ausculta» habla la MISMA voz (14px). Timer móvil `tabular-nums`.
- **Axe: móvil 0.** Escritorio 2 familias en oscuro Y claro — **ninguna de
  la franja** (confirmado por targets: `textarea`/`select` del formulario):
  `/referencia` trae su formulario sin etiquetas (`label` ×3 crítico,
  `select-name` ×2). Es la PRIMERA medición axe de esa pantalla en V15 —
  hallazgo preexistente nuevo, anotado a la lista de `V15-A11Y-001`.
- **Consola**: sólo el aviso familiar de reconexión de Firestore del
  emulador (1) — ambiental; los datos SÍ llegaron.
- **Honestidad del arnés**: las tarjetas de duplicados NO se midieron (la
  siembra no crea pares duplicados — el modal nunca se abre en el emulador);
  su rol lo vigila el guardián estático y el arnés lo declara en cabecera.
  La primera corrida midió `spineNums: []` y `movilRespaldo: null` por leer
  el DOM antes de que cargara — se añadieron los `waitForSelector` y se
  re-midió completo; las cifras de arriba son de la re-medición.

### Compuertas de esta corrida

- `npx vitest run`: **9023 pasan (621 archivos), 1 fallo AMBIENTAL** — el
  conocido `ops-timeout-y-punto-ciego` («el error dice cuánto esperó y a
  quién»): el proxy de red del contenedor responde en vez de agotar.
  Verificado que falla IGUAL en el árbol limpio (`git stash` con todo,
  incluida la prueba nueva) — no lo causa esta corrida, mismo fingerprint
  documentado por rebanadas anteriores.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: `tamanosFueraDeEscala`
  BAJÓ 1995→1988 (los 7 inline retirados: 11.5×5, 13, 13.5), resellado con
  `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio con `.env.local` demo (las 7 variables +
  `NEXT_PUBLIC_FIREBASE_EMULATORS=1`, receta de la quinta rebanada).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/pacientes cambió de
  líneas).

**Siguiente tarea exacta:** novena rebanada de `V15-VISUAL-SYSTEM-001` — con
el inventario de §2 VACÍO, declarar el paso 7 de §18 (visual hierarchy /
design tokens como roles) COMPLETO y decidir el cierre de Fase 10 contra los
pasos 8-9 de §18 (motion, polish) con la MISMA vara de comportamientos
medidos que usaron las fases 5 y 6: enumerar qué comportamientos de motion/
polish exige el master loop (§19 transiciones interrumpibles, §20
choreography sin animación decorativa, §24 reduced motion), medir cuáles ya
existen en el código real, pagar los que falten si son seguros, y cerrar la
fase con la tabla escrita — o declarar con razón escrita qué se difiere a
`V15-MOTION-001` (§43 lo lista como iteración propia, DESPUÉS de
REMAINING-SCREENS y A11Y). La deuda de `V15-A11Y-001` suma ahora el
formulario de /referencia (`label` ×3, `select-name` ×2) a las familias ya
anotadas: `nested-interactive` (Editar en filas de /pacientes),
`landmark-unique`/`region`, táctiles chicos y contrastes de /chat (Fase 9).

## `V15-VISUAL-SYSTEM-001` (Fase 10, §18 pasos 7-9) — novena rebanada: paso 7 COMPLETO, motion medido (no leído), y el cierre de la fase (12-ago-2026)

### Paso 7 de §18 — COMPLETO, declarado con la vara de la séptima

El inventario por grep de la séptima rebanada quedó VACÍO en la octava y esta
corrida lo re-verificó: ninguna superficie estructurada del shell V15 habla
papeles de §2 en dialecto propio. Los roles (`.nx-ident`, `.nx-ident-franja`,
`.nx-meta`, `.nx-critico`, `.nx-estado`, `.nx-num`, `nx-display`) existen como
clases con su decisión escrita, y ocho rebanadas los cablearon superficie por
superficie con guardián propio cada una. **Paso 7: COMPLETO.**

### Pasos 8-9 (motion, polish) — la tabla medida, misma vara que Fases 5 y 6

Se enumeraron los comportamientos de motion que el master loop exige (§19
transiciones interrumpibles, §20 coreografía sin animación decorativa, §24
reduced motion) y se midió cada uno contra el código real y el navegador real:

| Comportamiento exigido | Estado medido | Veredicto |
|---|---|---|
| §24 reduced motion — CSS | Apagador global en `globals.css` (`animation/transition-duration: 0.01ms !important` para todo el árbol) + opt-outs por regla (`.page-transition`, `.empty-illus`, `.nx-reveal`, `.cita-fila`) + el marco de escucha queda FIJO (la información de micrófono abierto no se apaga con la animación). Medido en navegador: `animation-duration: 1e-05s` computado bajo reduce; box-shadow del marco idéntico en dos muestras a 1.3s. | CUMPLE |
| §24 reduced motion — JavaScript | **NO CUMPLÍA.** `scrollIntoView({behavior:'smooth'})` no lee el apagador CSS: cuando el comportamiento llega como opción de JS, se aplica tal cual. 5 de 6 sitios (ClinicalSpine, AsistenteChat, 2 saltos de /consulta, /consultor) animaban bajo la preferencia; el único correcto era CierreAlPulgar, con copia local. | **PAGADO esta rebanada** |
| §19/§20 transiciones interrumpibles | Todo el motion del producto es CSS (interrumpible por naturaleza). Cero `animationend`/`transitionend`/`element.animate()` que bloqueen interacción (grep = 0). El scroll suave del navegador es interrumpible por el usuario. | CUMPLE |
| §20 sin animación decorativa | Inventario de los 12 `@keyframes`: entradas de orientación cortas (180-520ms: modal, overlay, indicator, reveal), bucles FUNCIONALES (spin=carga, pulse/nx-escuchando=grabación —señal de seguridad—, shimmer=skeleton), crossfade de navegación (documentado en `template.tsx` con su razón). Ningún parallax, ningún bucle decorativo. | CUMPLE |
| §20 coreografía de continuidad («same object becoming more detailed» Hoy→Paciente→Encuentro) | NO existe: el crossfade comunica cambio, no continuidad de objeto. Exige diseño de movimiento entre rutas (shared element / View Transitions) — trabajo de diseño real, no una rebanada segura de cierre de fase. | **DIFERIDO a `V15-MOTION-001`** (§43 la lista como iteración propia, orden 14, DESPUÉS de REMAINING-SCREENS y A11Y) |
| Paso 8 como sistema (tokens de movimiento) | `--mov-rapido/normal/lento/curva/nada` definidos en `globals.css`… y usados CERO veces: las 22 transiciones escriben su duración a mano y conviven dos curvas. Unificarlo es mecánico y cosmético, sin impacto de conducta ni a11y. | **DIFERIDO a `V15-MOTION-001`** con el conteo escrito para que no se pierda |
| Paso 9 (polish) | Lo entregado por las rebanadas 1-8 (acento, roles, tokens por tema) ES el polish estructuralmente ganado de esta fase; el pulido restante pantalla por pantalla pertenece a `V15-REMAINING-SCREENS-001` (§43 orden 12), que barre §32. | CUMPLE para el alcance de Fase 10 |

Con el único defecto de conducta pagado y los dos diferimientos declarados
con razón, **Fase 10 (`V15-VISUAL-SYSTEM-001`) queda CERRADA** — mismo
criterio de cierre por comportamientos medidos que usaron las Fases 5 y 6.

### Lo pagado: `comportamientoScroll()` — una sola voz para el scroll

- **`src/lib/ui/movimiento.ts`** (nuevo, con el fallo/regla/no-cubre escritos
  en cabecera): `comportamientoScroll()` consulta matchMedia y devuelve
  `'auto'` bajo la preferencia (o en SSR), `'smooth'` si no. Una sola
  implementación por la misma razón que `activable.ts`.
- Los 6 sitios la preguntan ahora (ClinicalSpine, AsistenteChat,
  CierreAlPulgar —su copia local se retiró—, los 2 saltos de /consulta,
  /consultor), cada uno con su `block` original intacto (freeze funcional).
- Barrido verificado: cero `behavior: 'smooth'` a mano en src/ fuera de la
  propia implementación.

### Guardián nuevo, probado al revés

`src/__tests__/v15-motion-scroll-respeta-reduced-motion.test.ts` (11 casos):
la función (auto bajo preferencia / smooth sin ella / auto en SSR), el
barrido recursivo de src/ que caza `behavior:'smooth'` escrito a mano (para
el séptimo sitio que aún no se escribió), los 6 sitios con su block original,
CierreAlPulgar sin copia local (y su focus a11y intacto), y el veto de deriva
del apagador CSS de §24. **10 de 11 fallan contra el árbol previo**
(verificado con `git stash` de los 7 archivos); el que pasa protege el
apagador CSS preexistente, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/medir-motion-reduced-v15.mjs` — `emulateMedia` de Playwright,
midiendo `scrollTop` del contenedor real (no el rect del destino: las
secciones asíncronas del expediente empujan el layout y la primera corrida
midió la carga en vez del movimiento — el arnés espera a que el documento sea
DESPLAZABLE antes de medir, y esa lección quedó escrita en su cabecera).
Resultado y captura en `docs/design/capturas/v15-motion-reduced/`:

- **Con reduce, el salto es instantáneo**: clic en el spine → scrollTop
  0→200px ya a los 80ms, sin moverse más a los 680ms
  (`saltoInstantaneo: true`). Antes del arreglo esto animaba.
- **Sin preferencia, el suave sigue vivo y LLEGA**: 0→18px a los 80ms (en
  vuelo) →200px a los 680ms (`enVueloA80: true`, `llega: true`) — quitar el
  defecto no quitó el desplazamiento suave de quien no pidió menos
  movimiento, y el destino es el MISMO por los dos caminos (equivalencia
  funcional, 200px de recorrido idéntico).
- **El apagador CSS medido vivo**: `.page-transition` computa
  `animation-duration: 1e-05s` (0.01ms) bajo reduce.
- **El marco de escucha queda FIJO, no apagado**: box-shadow sólido idéntico
  en dos muestras separadas 1.3s (`fijo: true`) — la información de que el
  micrófono está abierto sobrevive a la preferencia (§24 non-color state).
- **Consola**: sólo el aviso ambiental familiar de reconexión de Firestore
  del emulador.
- **Honestidad del arnés**: no corre axe — el cambio no añade ni quita un
  solo nodo del DOM (cambia el CÓMO del desplazamiento), y la octava rebanada
  ya midió axe de estas pantallas sin cambios de DOM desde entonces. La
  nota operativa de esta corrida: `page.goto` con `networkidle` NUNCA
  resuelve en pantallas con listeners de Firestore — usar `load` +
  `waitForSelector`, y el Chromium preinstalado del contenedor vive en
  `/opt/pw-browsers/chromium` (el arnés lo usa como `executablePath` si la
  versión de Playwright pide otra carpeta).

### Compuertas de esta corrida

- `npx vitest run`: ver reporte de la corrida (suite completa lanzada tras
  las compuertas dirigidas; el guardián nuevo 11/11 en corrida dirigida).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva (los 9
  `no-explicit-any` del primer borrador del guardián se pagaron con
  `vi.stubGlobal`, no subiendo el techo).
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (el cambio
  no toca un solo estilo).
- `npm run build`: compila limpio con `.env.local` demo (las 7 variables +
  `NEXT_PUBLIC_FIREBASE_EMULATORS=1`).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/consulta y /consultor
  cambiaron de líneas por el import).

**Siguiente tarea exacta:** `V15-REMAINING-SCREENS-001` (§43 orden 12, §32):
inventariar las superficies Practice que las fases estructurales NO tocaron
(login, signup/onboarding, /citas, nota, receta/orden, documentos,
comunicación, pagos, configuración, operaciones por dentro, estados
vacío/error/carga) contra la vara V15 (§34: IA/layout/jerarquía/interacción
+ roles de §2 donde aplique), priorizar por uso clínico real, y pagar la
primera pantalla del inventario como rebanada — con el MISMO método de
inventario-por-grep + navegador real que usó la Fase 10. La deuda anotada de
`V15-A11Y-001` (§43 orden 13) sigue creciendo y NO se toca en REMAINING salvo
hallazgo de paso barato: formulario de /referencia (`label` ×3,
`select-name` ×2), `nested-interactive` (Editar en filas de /pacientes),
`landmark-unique`/`region`, táctiles chicos y contrastes de /chat (Fase 9).

**Siguiente tarea exacta:** (superada — ver la sección siguiente:
`V15-REMAINING-SCREENS-001` arrancó en la corrida del 12-ago-2026.)

## `V15-REMAINING-SCREENS-001` (§43 orden 12, §32/§34) — primera rebanada: el inventario, y /nota habla el sistema (12-ago-2026)

### El inventario de §32 — medido por grep, no supuesto

Método de la Fase 10: conteo de roles §2 (`nx-ident|nx-meta|nx-critico|
nx-num|nx-display|nx-estado`) contra `fontSize:` inline por pantalla, sobre
las superficies que las fases estructurales NO tocaron:

| Superficie | Roles §2 | fontSize inline | Veredicto |
|---|---|---|---|
| `/citas` | 3 (nx-display, riel-hora, nx-estado) | 1 | **PASA en lo esencial** — riel con R2/R3, una primaria por fila, estados con rol. No es rebanada. |
| `/nota/[pid]/[nid]` | 0 | 47 | **PRIMERA rebanada (esta corrida)** — el documento de TODA consulta. |
| `/receta/[pid]/[nid]` | 0 | 31 | **Siguiente rebanada** — misma familia documental (toolbar + papel). |
| `/orden/[pid]/[nid]` | 0 | 11 | Tercera — misma familia. |
| `/login` | 1 | 14 | Cuarta — puerta de entrada, estructura simple. |
| `/registro` | 1 | 19 | Con login. |
| `/configuracion` | 0 | 172 | Operaciones (§11): subordinada al trabajo clínico; al final del barrido. |
| `/operaciones` | 0 | 6 | Chica; con configuración. |

Matiz importante de la familia documental: en /nota, /receta y /orden la
mayor parte de los `fontSize` inline es **papel, no deuda** — el documento
viaja por `outerHTML` a la ventana de impresión y al lienzo del PDF, donde
las variables del tema NO deben mandar (DEBT-008; los tres archivos están en
la lista PAPEL del trinquete de color por esa razón). La vara V15 aplica al
**cromo** (toolbar, modales, estados) — y justamente porque el archivo entero
está excluido del trinquete de color, el cromo llevaba teal/violeta CRUDOS
sin que ningún guardián los viera.

### Lo pagado: /nota — «el cromo habla el sistema, el papel intacto»

- **Jerarquía §16**: la barra de acciones pintaba SIETE botones a mano
  (siete rellenos/pesos propios, `rgba(20,184,166,…)` y `#a78bfa` crudos que
  no cambian de tema). Ahora habla el sistema de botones que ya existía:
  **UNA primaria** (`btn-primary` = Descargar PDF, el trabajo dominante de
  la pantalla), Imprimir/Word/Receta/Orden/Adenda secundarias
  (`btn-secondary`), Atrás fantasma (`btn-ghost btn-sm`). Los onClick,
  disabled y rutas NO cambiaron (freeze funcional, guardián abajo).
- **Interacción (la razón de ser de la rebanada)**: el modal de adenda — la
  corrección de un documento medicolegal FIRMADO — era un overlay a mano SIN
  trampa de foco, sin Escape, sin `role="dialog"` y con la X sin nombre
  accesible: exactamente lo que la regla de diseño lista como falla de
  compuerta. Ahora usa la primitiva `Modal` de `components/ui` (foco
  atrapado, Escape, foco devuelto, scroll bloqueado, aria) que existía desde
  antes. El cierre sigue bloqueado mientras guarda — y ahora TAMBIÉN por la
  X del encabezado (antes la X cerraba a media escritura sin guardar:
  equivalente o MÁS seguro, no menos).
- **Roles §2 en el cromo**: los metadatos de la vista de transcripción
  («compara con la nota», «Material de apoyo…») hablan `.nx-meta`. NINGÚN
  rol se metió al papel — y el guardián lo veta expresamente (un `nx-*`
  dentro de `printables` haría que el documento impreso dependiera de la
  hoja del tema).
- Trinquete de diseño BAJADO de verdad y resellado: `hexEnLinea` 501→500,
  `tamanosFueraDeEscala` 1988→1984, `radiosFueraDeEscala` 634→633.

### Guardián nuevo, probado al revés

`src/__tests__/v15-nota-cromo-habla-el-sistema.test.ts` (16 casos): una sola
primaria por capa (2 `btn-primary` en el archivo: toolbar + pie del modal),
secundarias del sistema, veto del dialecto (ni `--nexus-solido` inline ni
teal/violeta crudos — el trinquete de color NO puede verlos aquí porque el
archivo es PAPEL; este guardián sí), Modal primitiva con cierre guardado
mientras guarda, freeze funcional (validación de adenda ≥3, guardas de
config, rutas de Receta/Orden sólo con nota firmada), papel intacto (TINTA,
Times New Roman, `#doc`, reglas de impresión) y roles §2 sólo en el cromo.
**9 de 16 fallan contra el árbol previo** (verificado con `git stash`); los
7 que pasan protegen invariantes funcionales preexistentes, no el cambio.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores + siembra + build de producción +
`npm start` vía `arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-nota-cromo-v15.mjs` — la siembra estándar NO crea
documentos `NotaMedica`, así que el arnés siembra la suya: una nota FIRMADA
sintética (con transcripción — la primera corrida devolvió `nxMeta: null`
porque sin transcripción el bloque no se pinta; se sembró el dato y se
re-midió: medir de verdad, no declarar). Resultado y 4 capturas en
`docs/design/capturas/v15-nota-cromo/` (1440 oscuro/claro + modal + 390):

- **Jerarquía medida en los DOS temas**: la toolbar tiene EXACTAMENTE una
  primaria («Descargar PDF», relleno sólido `rgb(23,120,134)` oscuro /
  `rgb(18,98,110)` claro — el token cambia por tema, cosa que los hex crudos
  de antes no hacían), 5 secundarias transparentes, y **cero botones a mano**
  (`botonesAManoQueQuedan: []`).
- **El modal de adenda, interacción REAL medida**: al abrir, el foco ENTRA
  al diálogo; tras 8 Tab el foco SIGUE dentro (trampa verificada); `aria-modal`
  + etiquetado; **Escape lo cierra** y el foco **VUELVE** al botón Adenda.
  Las cuatro conductas que el overlay viejo no tenía.
- **Equivalencia funcional, clic real**: «Receta» aterriza en
  `/receta/pac-aurelio-dominguez/nota-cromo-v15-firmada` (`llega: true`).
- **El papel sigue siendo papel**: `#doc` computa
  `"Times New Roman", Georgia, serif`.
- **Rol §2 medido**: «compara con la nota» computa 12.5px (`.nx-meta`).
- **Móvil 390**: sin desborde (`anchoDocumento: 390`), la primaria ocupa la
  fila completa (rejilla DEBT-009 viva), **cero táctiles chicos** en la
  toolbar.
- **Axe (primera medición de /nota en V15)**: 0 violaciones NUEVAS. Las dos
  familias presentes en oscuro, claro y móvil son PREEXISTENTES:
  `page-has-heading-one` (la página nunca tuvo `<h1>` — el título del
  documento es papel, no un heading del cromo; anotada a `V15-A11Y-001`) y
  `region` ×2 (la familia conocida del banner de prueba). Ninguna vive en la
  toolbar ni en el modal.
- **Consola**: sólo el aviso ambiental familiar de reconexión de Firestore
  del emulador (×2, desktop y móvil).

### Compuertas de esta corrida

- `npx vitest run`: **9045 pasan (621 archivos), 1 skip** — el guardián
  nuevo 16/16. Los 2 fallos de la corrida completa: el inventario de
  pantallas (estaba DESACTUALIZADO en medio de la corrida — regenerado, 5/5
  al re-correr) y el AMBIENTAL conocido `ops-timeout-y-punto-ciego` (el
  proxy del contenedor responde en vez de agotar — mismo fingerprint
  documentado por rebanadas anteriores).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: BAJÓ de verdad
  (`hexEnLinea` 501→500, `tamanosFueraDeEscala` 1988→1984,
  `radiosFueraDeEscala` 634→633), resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio con `.env.local` demo. Lección operativa
  de este contenedor: `✓ Compiled successfully` sale a MEDIO build (falta
  TypeScript + generación estática) — esperar `BUILD_ID` en `.next/` antes
  de arrancar el arnés, o `next start` muere con «Could not find a
  production build».
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/nota cambió de líneas).

**Siguiente tarea exacta:** (superada — ver la sección siguiente: la segunda
rebanada /receta se pagó en la corrida del 12-ago-2026.)

## `V15-REMAINING-SCREENS-001` — segunda rebanada: /receta, el EDITOR tiene nombre y el cromo habla tokens por tema (12-ago-2026)

/receta es la segunda del inventario de §32 (0 roles §2, 31 `fontSize`
inline) y, a diferencia de /nota, es un **editor** además de un impreso.
Leída entera antes de rebanar, como pedía el estado. Tres defectos §34
pagados en el cromo — el papel (`RecetaDocumento`) intacto:

- **Interacción/§24 (la razón de ser)**: el editor del documento medicolegal
  tenía TODOS sus campos sin nombre accesible — etiquetas visibles sin
  asociar (`htmlFor`/`id` ahora en Diagnóstico, Creatinina, Peso,
  Indicaciones, Nota al paciente), y los SEIS campos de cada fila de
  medicamento sólo con placeholder (que desaparece al escribir): `aria-label`
  en los seis, incluida LA DOSIS; «quitar medicamento» (icono solo) también.
  «Medicamentos» dejó de ser `<label>` huérfano. Medido en navegador:
  **17/17 campos con nombre accesible** (antes: 0).
- **Tema**: el archivo es PAPEL para el trinquete de color (la receta se
  rasteriza), así que su cromo llevaba crudos que ningún guardián veía. El
  peor: la alerta de DOSIS — la más importante de la pantalla — titulaba en
  `#b91c1c` fijo, ilegible sobre el canvas oscuro (la MISMA lección que el
  bloque de alergia de al lado ya tenía escrita). Ahora: badges por tema
  (medido: título `#f87171` oscuro / `#991B1B` claro, `alertaCambiaDeTema:
  true`), banners de cédula/domicilio/firma en `--badge-red/amber-*`, ámbar
  y azul COMO TEXTO en `--badge-*-t` (lección TrialBanner), teal crudo del
  tip muerto, borde del botón quitar en `color-mix`. El aviso de apoyo
  dentro de las cajas tintadas va en `var(--text2)` con la fórmula WCAG
  corrida (5.8:1 sobre el tinte rojo claro): el text3 del rol computaba
  4.22:1 y axe lo cazó en la primera corrida del arnés — se pagó en la misma
  corrida y la re-medición salió limpia.
- **Jerarquía §16**: «Atrás» era texto suelto de 13px → `btn-ghost btn-sm`;
  la primaria (Descargar PDF) va PRIMERO en la fila como en /nota (las dos
  pantallas de la familia documental hablan el mismo orden), y la rejilla
  móvil de /nota (DEBT-009) se heredó con `.receta-toolbar`.
- **Roles §2 en el cromo**: «Vista previa…», avisos de apoyo, tip y «Tus más
  recetados» hablan `.nx-meta`.
- Trinquete de diseño BAJADO de verdad y resellado: `hexEnLinea` 500→497,
  `tamanosFueraDeEscala` 1984→1980.

### Guardián nuevo, probado al revés

`src/__tests__/v15-receta-cromo-habla-el-sistema.test.ts` (23 casos): una
primaria y PRIMERA, Atrás del sistema, rejilla móvil, los 5 `htmlFor` + 6
`aria-label` + quitar-con-nombre, veto del dialecto (`#b91c1c`, rgba crudos,
teal — el trinquete de color NO ve este archivo; este guardián sí), freeze
funcional (guardas de la primaria, `receta_generada`/`receta_descargada` +
aprendizaje, MAX_MEDS=6, receta-en-blanco bloqueada, `loQueSeReceta` +
`estaVigente`, folio de la nota, QR minteado en servidor, rutas), papel
intacto (impresión sólo enseña `#receta-doc`, cero roles §2 en
`RecetaDocumento`, `colorAccento` sigue siendo config del médico). **13 de
23 fallan contra el árbol previo** (verificado con `git stash` DESPUÉS del
último retoque); los 10 que pasan protegen invariantes funcionales
preexistentes.

### Verificado en navegador real (12-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start` vía
`arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-receta-cromo-v15.mjs` — siembra su propia nota
FIRMADA sintética con metformina 2000 mg (>1000 máx/toma del catálogo
determinista) para que la alerta de dosis se PINTE y su color se pueda medir
por tema. Resultado y 3 capturas en `docs/design/capturas/v15-receta-cromo/`:

- **Toolbar en los DOS temas**: exactamente una primaria, PRIMERA
  (`primariaEsLaPrimera: true`), relleno `rgb(23,120,134)` oscuro /
  `rgb(18,98,110)` claro, 3 secundarias, `botonesAManoQueQuedan: []`,
  Atrás del sistema.
- **La alerta de dosis cambia de tema de verdad**: título
  `rgb(248,113,113)` oscuro / `rgb(153,27,27)` claro
  (`alertaCambiaDeTema: true`) — antes computaba el mismo `#b91c1c` en los
  dos. El aviso de apoyo computa text2 por tema.
- **17/17 campos del editor con nombre accesible** (`sinNombre: []`).
- **Equivalencia funcional, clic real**: «Template» aterriza en
  `/configuracion?tab=recetas` (`llega: true`). El QR se minteó (con
  `PORTAL_PACIENTE_SECRET` demo en `.env.local`; sin él, la ruta
  `verificacion-url` respondía 500 y el QR caía al folio — conducta prevista).
- **Rol §2 medido**: «Vista previa…» computa 12.5px.
- **Móvil 390**: sin desborde, primaria a fila completa, **cero táctiles
  chicos** en la toolbar.
- **Axe (primera medición de /receta en V15)**: 0 violaciones nuevas del
  cromo. Restantes, PREEXISTENTES: `color-contrast` DENTRO del papel
  (`.receta-sheet`: el acento teal del template del médico sobre el blanco
  del papel — territorio DEBT-008/config del médico, anotado a
  `V15-A11Y-001` como decisión pendiente de diseño de plantilla, NO de tema)
  y `region` ×2 (familia conocida del banner de prueba). En móvil sólo
  `region` ×2.
- **Consola**: sólo el aviso ambiental de reconexión de Firestore del
  emulador.
- Nota operativa del contenedor: si el arnés se corre DOS veces, matar el
  `next-server` de la corrida anterior antes de re-lanzar — el `trap` del
  arnés no siempre lo alcanza, el puerto 3000 queda tomado y la segunda
  corrida mide un servidor con chunks viejos (la página nunca hidrata y
  `.receta-toolbar` no aparece). Con `kill` del PID de `next-server` basta.

### Compuertas de esta corrida

- `npx vitest run`: **9071 pasan (622 archivos), 3 fallos** — dos eran
  archivos de compuerta DESACTUALIZADOS a media corrida (inventario de
  pantallas y sello del trinquete de diseño: regenerados/resellados, 37/37
  al re-correr junto con el guardián nuevo) y el tercero es el AMBIENTAL
  conocido `ops-timeout-y-punto-ciego` (el proxy del contenedor responde en
  vez de agotar — mismo fingerprint documentado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: BAJÓ de verdad
  (`hexEnLinea` 500→497, `tamanosFueraDeEscala` 1984→1980), resellado con
  `--actualizar`.
- `npm run build`: compila limpio (TS incluido) con `.env.local` demo — en
  este contenedor hubo que recrearlo (7 variables + emuladores +
  `PORTAL_PACIENTE_SECRET` demo).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/receta cambió de líneas).

**Siguiente tarea exacta:** (superada — ver la sección siguiente: la tercera
rebanada /orden se pagó en la corrida del 12-ago-2026.)

## `V15-REMAINING-SCREENS-001` — tercera rebanada: /orden, la familia documental queda completa (12-ago-2026)

/orden es la tercera de la familia documental (§32, 11 `fontSize` inline, 0
roles §2) y compartía TODOS los defectos que /nota y /receta ya pagaron,
más uno propio. Leída entera antes de rebanar. El papel (`RecetaDocumento`)
intacto — el archivo es PAPEL para el trinquete de color, así que ningún
guardián veía sus crudos; el de esta rebanada sí:

- **Jerarquía §16**: «Atrás» texto suelto de 13px → `btn-ghost btn-sm`; la
  primaria (Descargar PDF) va PRIMERO como en /nota y /receta (la familia
  habla un solo orden); y el defecto propio: el «Agregar» del estudio
  personalizado era una SEGUNDA `btn-primary` en la misma capa — dos voces
  primarias en un lienzo. Ahora es secundaria: la página tiene UNA primaria
  (medido: `primariasEnPagina: ["Descargar PDF"]`). Los onClick/disabled no
  cambiaron (freeze funcional, guardián abajo). Rejilla móvil DEBT-009
  heredada con `.orden-toolbar`.
- **Interacción/§24 (la razón de ser)**: el editor del documento medicolegal
  tenía campos sin nombre accesible — Diagnóstico e Indicaciones sin asociar
  (`htmlFor`/`id` ahora), el estudio personalizado sólo con placeholder
  (`aria-label`), y el quitar de cada CHIP (icono solo, repetido N veces)
  mudo: ahora dice QUÉ estudio quita (`aria-label={`Quitar ${e}`}`).
  «Estudios solicitados» dejó de ser `<label>` huérfano. El catálogo declara
  estado: `aria-expanded` en categorías, `aria-pressed` en estudios.
- **Tema**: banners de cédula/firma en `--badge-red/amber-*` (los rgba
  crudos murieron), `#f59e0b` del estado de error → `var(--amber)`, y la
  lección YA MEDIDA del chip del directorio de /pacientes que aquí seguía
  viva: el Check `#000` sobre `var(--teal)` (2.99:1 en claro) → casilla
  `--nexus-solido` + check blanco (el par medido 5.16:1/7:1). El teal COMO
  TEXTO murió en chips y estudios seleccionados (lección TrialBanner): el
  texto habla `var(--text)` + peso y el estado lo llevan tinte/borde/casilla
  (no-textuales, `color-mix` sobre el token).
- **Roles §2 en el cromo**: «Vista previa…» habla `.nx-meta` (12.5px
  medidos).
- Trinquete de diseño BAJADO de verdad y resellado: `hexEnLinea` 497→496,
  `tamanosFueraDeEscala` 1980→1978.

### Guardián nuevo, probado al revés

`src/__tests__/v15-orden-cromo-habla-el-sistema.test.ts` (25 casos): una
primaria y PRIMERA («Agregar» vetado como segunda), Atrás del sistema,
rejilla móvil, htmlFor/aria-label/aria-expanded/aria-pressed, veto del
dialecto (rgba crudos, teal-como-texto, `#000` sobre teal, `#f59e0b` — el
trinquete de color NO ve este archivo; este guardián sí), freeze funcional
(guardas de la primaria, `orden_generada` ×3 con `crearPendientesDeLaOrden`
en los TRES caminos de emisión — la promesa de /pendientes —, orden-en-
blanco bloqueada, folio `OM-` derivado de la nota, estudios de la nota
pre-poblando, rutas), papel intacto (impresión sólo `#receta-doc`, cero
roles §2 en RecetaDocumento, `colorAccento` config del médico) y roles §2
sólo en el cromo. **15 de 25 fallan contra el árbol previo** (verificado
con `git stash`); los 10 que pasan protegen invariantes funcionales
preexistentes.

### Verificado en navegador real (12-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start` vía
`arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-orden-cromo-v15.mjs` — siembra su propia nota
FIRMADA sintética con `estudiosOrden` pre-poblado (dos estudios, el primero
de «Laboratorio general» que abre por defecto) para que chips y casilla
marcada se PINTEN y se puedan medir por tema. Lección de medición pagada en
la misma corrida: lucide pinta con STROKE (el prop `color` va a `stroke=`),
así que medir la propiedad CSS `color` del svg devuelve el texto heredado,
no lo que se ve — la primera corrida midió eso, se corrigió el arnés y se
re-midió. Resultado y 3 capturas en `docs/design/capturas/v15-orden-cromo/`:

- **Toolbar en los DOS temas**: exactamente una primaria, PRIMERA
  (`primariaEsLaPrimera: true`), relleno `rgb(23,120,134)` oscuro /
  `rgb(18,98,110)` claro, 3 secundarias, `botonesAManoQueQuedan: []`, Atrás
  del sistema, y `primariasEnPagina: ["Descargar PDF"]` — la página entera
  tiene UNA voz primaria.
- **El chip cambia de tema de verdad**: texto `rgb(242,239,233)` oscuro /
  `rgb(11,12,14)` claro (`chipCambiaDeTema: true`), tinte y borde en
  `color-mix` sobre el token; quitar con nombre («Quitar Biometría hemática
  completa»).
- **La casilla marcada**: fondo `--nexus-solido` por tema y **check
  `stroke: rgb(255,255,255)`** en los dos temas — el par medido; antes era
  `#000` sobre teal. `aria-pressed: "true"`, categoría `aria-expanded`.
- **Campos con nombre**: `sinNombre: []` (los 2 visibles al cargar; el
  personalizado lleva `aria-label` — guardián).
- **Equivalencia funcional, clic real**: «Template» aterriza en
  `/configuracion?tab=recetas` (`llega: true`).
- **Rol §2 medido**: «Vista previa…» computa 12.5px (`.nx-meta`).
- **Móvil 390**: sin desborde (`anchoDocumento: 390`), primaria a fila
  completa, **cero táctiles chicos** en la toolbar.
- **Axe (primera medición de /orden en V15)**: 0 violaciones nuevas del
  cromo. Restantes, PREEXISTENTES y ya anotadas: `color-contrast` DENTRO
  del papel (`.receta-sheet`: el acento `#14b8a6` del template del médico —
  territorio DEBT-008/`V15-A11Y-001`, misma familia que /receta) y `region`
  ×2 (banner de prueba). En móvil sólo `region` ×2.
- **Consola**: sólo el aviso ambiental de reconexión de Firestore del
  emulador (×2, desktop y móvil).

### Compuertas de esta corrida

- `npx vitest run`: ver el reporte de la corrida (guardián nuevo 25/25).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: BAJÓ de verdad
  (`hexEnLinea` 497→496, `tamanosFueraDeEscala` 1980→1978), resellado con
  `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio con `.env.local` demo (recreado en este
  contenedor: 7 variables + emuladores + `PORTAL_PACIENTE_SECRET` demo).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/orden cambió de líneas).

**Siguiente tarea exacta:** (superada — ver la sección siguiente: la cuarta
rebanada /login + /registro se pagó en la corrida del 12-ago-2026.)

## `V15-REMAINING-SCREENS-001` — cuarta rebanada: /login + /registro, la puerta de entrada habla el sistema (12-ago-2026)

La puerta de entrada: las dos pantallas que TODO médico cruza antes de tocar
nada clínico, y /registro es además la primera impresión del producto en la
prueba de 14 días. Leídas enteras antes de rebanar. Compartían la familia de
las rebanadas 1-3, más dos defectos propios:

- **La CTA de /registro pintaba `#000` sobre `var(--teal)`** — 2.99:1 en
  claro, EXACTAMENTE el defecto ya medido y pagado en el chip del directorio
  de /pacientes (VISUAL-SYSTEM 6ª) y en la casilla de /orden (3ª rebanada).
  La TERCERA aparición de la misma familia — y en el botón que convierte al
  visitante en cliente. Ahora es `btn btn-primary` (el par medido:
  `--nexus-solido` + blanco, 5.16:1 oscuro / 7:1 claro), y su estado
  deshabilitado lo pone `.btn:disabled` (opacity), no el gris a mano
  `--s3/--text3` que traía.
- **Dos idiomas de formulario en la misma puerta**: /login hablaba
  `.form-group/.label/.input` y /registro lo re-dibujaba TODO a mano, con un
  hack onFocus/onBlur que mutaba `borderColor` por JavaScript y NO daba
  anillo de foco visible con teclado. Ahora habla las clases del sistema y
  el anillo lo pone `.input:focus` — medido: `hayAnillo: true`.
- **Tema**: el aviso de restablecer de /login pintaba `rgba(20,184,166,…)`
  (el teal CRUDO del oscuro) con teal-como-texto → `color-mix` sobre
  `var(--teal)` + texto `var(--text)` (lección TrialBanner). El borde de la
  caja de prueba de /registro era `rgba(61,90,254,0.22)` — el ÍNDIGO VIEJO,
  un acento que ya ni existe como token → `color-mix` sobre `var(--nexus)`.
- **§24 táctil**: «¿Olvidaste tu contraseña?» y «← Volver» eran texto de
  ~18px de alto; las CTA (submit, Google, MFA) quedaban en los 36 fijos de
  `.btn`. Ahora: enlaces `minHeight 44`, CTA `minHeight 48` (min-height gana
  al height fijo de la clase).
- **WCAG 1.4.1**: los enlaces DENTRO de frase («Inicia sesión», términos,
  privacidad, «Crea una gratis →») llevaban `textDecoration: 'none'` — sólo
  color los distinguía. Subrayados los cuatro.
- **`<main>` landmark en las dos páginas** — la primera medición axe de la
  puerta encontró `landmark-one-main` + `region` (moderate) y se pagó en la
  misma rebanada en vez de anotarse: el contenido entero vive en `<main>`.
- **Roles §2**: pies de página en `.nx-meta` (12.5px medidos). Código
  muerto: el estado `<'form' | 'verifying'>` que nunca se leía y los import
  de `Stethoscope` murieron.
- **Freeze funcional intacto**: mismos flujos de Firebase Auth (password,
  MFA/TOTP, Google por redirección con selector de cuenta, reset que no
  revela si el correo existe), misma redirección por invite, mismo
  `sendEmailVerification` + `trackConversion` ×2, precio desde `PLANES`
  (nunca un número a mano). El botón blanco de Google conserva sus hex de
  marca A PROPÓSITO (lineamientos de Google).

### Guardián nuevo, probado al revés

`src/__tests__/v15-login-registro-cromo-habla-el-sistema.test.ts` (23
casos): CTA btn-primary sin `#000`, deshabilitado del sistema, una primaria
por página, `.input/.label` ×3 con htmlFor/id, muerte del hack de foco JS,
tokens por tema (teal crudo e índigo viejo vetados), táctiles 44/48,
subrayados 1.4.1, `<main>`, roles §2, y el freeze funcional completo (auth,
invite, reset privado, alta + verificación + conversión, precio del
catálogo, ojos con aria-label, layout móvil). **14 de 22 fallan contra el
árbol previo** (verificado con `git stash` antes del caso 23 de `<main>`);
los 8 que pasan protegen invariantes funcionales preexistentes.

### Verificado en navegador real (12-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start` vía
`arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-login-registro-v15.mjs` — no siembra nada propio
(páginas públicas); el alta de prueba crea SU cuenta sintética en el
emulador. Resultado y 6 capturas en
`docs/design/capturas/v15-login-registro/`:

- **La CTA cambia de tema de verdad**: `rgb(23,120,134)` oscuro /
  `rgb(18,98,110)` claro con texto BLANCO en los dos
  (`ctaCambiaDeTema: true`), 48px de alto, deshabilitada = opacity 0.45.
- **Foco real**: enfocar el correo pinta el anillo de `.input:focus`
  (box-shadow del token, `hayAnillo: true`) — el hack JS no pintaba ninguno.
- **El aviso de restablecer cambia de tema** (clic real contra el emulador
  de auth): texto `rgb(242,239,233)` oscuro / `rgb(11,12,14)` claro
  (`avisoCambiaDeTema: true`).
- **Táctiles medidos**: olvidaste 44, Google 48, submit 48, ojo 44×44.
- **Campos con nombre**: `sinNombre: []` en las DOS páginas.
- **Equivalencia funcional con clic real**: login REAL → `/dashboard`
  (`llega: true`), **alta REAL → `/setup`** (`llega: true` — cuenta
  sintética nueva contra el emulador; el CTA convertido a btn-primary sigue
  dando de alta de verdad), cruce login↔registro navega.
- **Móvil 390**: sin desborde en ninguna (`anchoDocumento: 390`), CTA a
  fila completa, 44px de alto.
- **Axe: 0 violaciones en las SEIS mediciones** (registro y login × oscuro,
  claro y móvil) — las primeras superficies de V15 que miden limpio del
  todo; `landmark-one-main`/`region` de la primera pasada se pagaron con
  `<main>` en la misma corrida.
- **Consola**: limpia (0 errores, desktop y móvil — página pública, sin el
  aviso del emulador de Firestore).
- Nota operativa del contenedor: `pkill -f "next-server"` desde la shell
  que lanza el arnés SE MATA A SÍ MISMA (el patrón matchea su propia línea
  de comando). Usar `pkill -f 'next[-]server'`.

### Compuertas de esta corrida

- `npx vitest run`: ver el reporte de la corrida (guardián nuevo 23/23).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: BAJÓ de verdad
  (`tamanosFueraDeEscala` 1978→1975), resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio ×2 (build de producción para el arnés)
  con `.env.local` demo (recreado en este contenedor: 7 variables +
  emuladores + `PORTAL_PACIENTE_SECRET` demo).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/login y /registro
  cambiaron de líneas).

**Siguiente tarea exacta:** (superada — ver la sección siguiente: la quinta
rebanada /configuracion + /operaciones se pagó en la corrida del
12-ago-2026.)

## `V15-REMAINING-SCREENS-001` — quinta rebanada: /configuracion + /operaciones, la familia de Operaciones habla el sistema (12-ago-2026)

La familia de §11 (Operations), el final del barrido de CROMO de §32.
/configuracion era la superficie MÁS endeudada del inventario (172
`fontSize` inline, 0 roles §2); /operaciones — el índice que V15-IA-001
creó — hablaba su propio dialecto. Leídas enteras antes de rebanar. La
rebanada pagó el CROMO de /configuracion + /operaciones entero y el índigo
muerto de TODA la familia; el contenido de las 16 pestañas queda como deuda
declarada (abajo).

- **El riel de secciones habla el idioma del shell**: los 16 botones dejan
  su dialecto (activo con teal-COMO-TEXTO — lección TrialBanner — sobre
  `var(--nexus-soft)` con borde `rgba(61,90,254,0.3)`, el ÍNDIGO VIEJO que
  ya ni existe como token) por `.nav-item` + `.active` — la MISMA palabra
  que habla el FlowRail: fondo `var(--s2)`, texto `var(--text)`, barra de
  acento `::before` de 3px en `var(--nexus)`. `aria-current` en el activo,
  `aria-label` en el `<nav>`, títulos de grupo en `.nav-section-title`.
- **El índigo muerto murió en toda la familia**: 20 sitios entre page.tsx,
  secciones-comunicacion.tsx y secciones-cuenta.tsx (tintes y bordes de
  tarjetas informativas, badges de plan, cajas de aviso) →
  `color-mix(in srgb, var(--nexus) N%, transparent)`. Ninguno cambiaba de
  tema; ahora todos. El morado fijo del enlace superadmin
  (`#7c3aed12`/`#7c3aed44` — 8 dígitos que el trinquete de color NI VE) →
  `color-mix` sobre `var(--purple)`. El badge Activo/Inactivo de médicos
  dejó el teal-como-texto y el lavado blanco `rgba(255,255,255,0.05)` (que
  en claro no existe) por `var(--text)` + tinte/borde de estado y
  `var(--s2)`.
- **§24 en el cromo**: el `<select>` móvil de secciones NO tenía nombre
  accesible → `aria-label="Sección de configuración"` + minHeight 44
  (medido: 48). El estado de carga anuncia (`role="status"`). El encabezado
  del tab habla `t-h2`.
- **El horario semanal pagó sus 17 campos sin nombre** (hallazgo del PRIMER
  axe de esta pantalla, en esta misma corrida — precedente de la 4ª
  rebanada: lo que el primer axe encuentra en la pantalla de la rebanada se
  paga en la corrida): checkbox de cada día + inicio/fin →
  `aria-label` por día («Atender los lunes», «Hora de inicio del lunes»…).
  Los descansos YA los tenían.
- **Roles §2 en /operaciones**: título `t-h1` (antes 20/700 inline), grupos
  `t-overline` (antes 12/700), introducción `t-body`, tiles y Cerrar sesión
  con minHeight 44, iconos decorativos `aria-hidden`, y CERO `btn-primary`
  (es un índice, no un lienzo de acción — medido:
  `primarias: []`).

### Guardián nuevo, probado al revés

`src/__tests__/v15-operaciones-configuracion-cromo-habla-el-sistema.test.ts`
(29 casos): riel en `.nav-item` + `aria-current`, veto del teal-como-texto
y del fondo de acento a mano, veto del índigo muerto en los 4 archivos de
la familia, `color-mix` sobre `--nexus` y `--purple`, nombres accesibles
(select móvil, nav, horario semanal ×3), roles §2 de /operaciones, y el
freeze funcional completo (guardado por DIFF + `saveConfigPartial` merge,
guarda P1 de configError, tab por query param, catálogo de 16 pestañas,
lista de pestañas auto-persistidas sin Guardar global, los 20 destinos de
/operaciones con filtro por modo + `rutaPermitida`, `salirSeguro('/login')`).
**19 de 28 fallan contra el árbol previo** (verificado con `git stash`,
antes del caso 29 del horario); los 9 que pasan protegen invariantes
funcionales preexistentes.

### Verificado en navegador real (12-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start` vía
`arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-operaciones-configuracion-v15.mjs` — login real,
tour de bienvenida descartado con «Saltar» (lección de los hermanos).
Resultado y 6 capturas en
`docs/design/capturas/v15-operaciones-configuracion/`:

- **El riel en los DOS temas**: 16/16 botones `.nav-item`
  (`todosNavItem: true`), activo con texto `rgb(242,239,233)` oscuro /
  `rgb(11,12,14)` claro (var(--text), NO teal), barra de 3px
  `rgb(42,165,181)` oscuro / `rgb(18,98,110)` claro
  (`barraCambiaDeTema: true`), `botonesConIndigoMuerto: []`,
  `aria-current: "true"`, 5 títulos de grupo.
- **Cambio de sección con clic real**: pulsar «Horario de atención» pinta
  ese encabezado en el `t-h2` del lienzo (16px medidos) y mueve el activo
  y su `aria-current` (equivalencia funcional del riel).
- **Clic real desde /operaciones**: el tile «Configuración» aterriza en
  /configuracion (`llega: true`).
- **/operaciones habla los roles medidos**: h1 `20px/600`, grupos
  `10.5px/600` uppercase, 18 tiles TODOS ≥44 de alto, `primarias: []`.
- **Móvil 390**: riel oculto, select visible de 48px con su nombre
  accesible, sin desborde en ninguna de las dos
  (`anchoDocumento: 390`).
- **Axe (primera medición de /configuracion y /operaciones en V15)**: el
  hallazgo `label` ×17 del horario semanal se encontró en la primera pasada
  y SE PAGÓ en la misma corrida — segunda pasada: **sólo `region` ×2**
  (banner de prueba, PREEXISTENTE y ya anotado) en las SEIS mediciones
  (2 pantallas × oscuro/claro/móvil).
- **Consola**: sólo el aviso ambiental de reconexión de Firestore del
  emulador.

### Compuertas de esta corrida

- `npx vitest run`: **9150 pasan (627 archivos), 1 fallo** — el AMBIENTAL
  conocido `ops-timeout-y-punto-ciego` (el proxy del contenedor responde en
  vez de agotar — mismo fingerprint documentado). El guardián nuevo 29/29.
  Lección pagada a medio camino: el badge Activo/Inactivo salió primero con
  `borderRadius: 9999` crudo y `escala-visual-trinquete` («LA PÍLDORA SE
  ESCRIBE DE UNA SOLA FORMA») lo cazó → `var(--r-pill)`. El guardián de la
  casa funciona.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: BAJÓ de verdad
  (`tamanosFueraDeEscala` 1975→1971, `radiosFueraDeEscala` 633→629),
  resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio ×2 (build de producción para el arnés)
  con `.env.local` demo (recreado en este contenedor: 7 variables +
  emuladores + `PORTAL_PACIENTE_SECRET` demo).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/configuracion cambió de
  líneas).

### Deuda declarada de la rebanada (no silenciosa — §35/§5 clinical-safety)

El CONTENIDO de las 16 pestañas de /configuracion conserva ≈150 `fontSize`
inline y `cfgInput`/`cfgLabel` (un dialecto de formulario propio en
`estilos.ts` que las secciones extraídas comparten). NO se tocó en esta
rebanada: es tab-por-tab y el cromo era la deuda estructural. Si el barrido
§32 se re-prioriza, las pestañas grandes (recetas 1428 líneas, cuenta 707)
son rebanadas naturales. La deuda de `V15-A11Y-001` NO cambia con esta
rebanada: el horario se pagó aquí mismo y el resto de las seis mediciones
axe salió `region` ×2 (preexistente, ya anotado).

**Siguiente tarea exacta:** el barrido de CROMO de §32 quedó cerrado con
esta rebanada. Toca decidir contra §43: la siguiente iteración del orden es
`V15-A11Y-001` (orden 13) — su backlog ya tiene anotados los hallazgos
acumulados (formulario de /referencia sin etiquetas: `label` ×3 crítico +
`select-name` ×2; el acento del papel del template del médico
DEBT-008/`.receta-sheet`; `region` ×2 del banner de prueba en TODAS las
superficies — el hallazgo axe más repetido de la rama, candidato natural a
primera rebanada). Antes de abrirla, correr el inventario de deuda a11y
completo (grep de los hallazgos anotados en este archivo) para dimensionar
las rebanadas.

## `V15-A11Y-001` — abierta, con su inventario; primera rebanada: los avisos del shell viven en un landmark (12-ago-2026)

El barrido de CROMO de §32 quedó cerrado la corrida anterior; ésta abre la
iteración 13 del orden de §43 como pidió el estado: PRIMERO el inventario de
deuda a11y (grep completo de este archivo), DESPUÉS la rebanada.

### Inventario de deuda a11y acumulada (de las anotaciones de toda la rama)

1. ~~`region` (moderate) — banners del shell fuera de todo landmark~~ —
   **PAGADA en esta rebanada** (abajo). Era el hallazgo MÁS repetido: presente
   en TODAS las mediciones de superficie de las fases 3-11.
2. ~~`landmark-unique` (cajón móvil de FlowRail)~~ — ya había muerto en
   `V15-MOBILE-001` (el cajón del médico se retiró); la medición de hoy lo
   confirma: axe 0 en /dashboard.
3. **/referencia: formulario sin etiquetas** — `label` ×3 (CRÍTICO) +
   `select-name` ×2. La única deuda de severidad crítica del backlog.
   **Candidata a segunda rebanada.**
4. ~~`color-contrast` — familia del botón «Editar»~~ — **RESUELTA en la 3ª
   rebanada como CONFLACIÓN**: los ~5 nodos del Editar siempre fueron
   `nested-interactive`; los nodos de contraste de aquella medición eran del
   TrialBanner (pagados en VISUAL-SYSTEM 6ª). El Editar mide ≈7.6:1 oscuro /
   ≈6.1:1 claro (medido con getComputedStyle en la 3ª rebanada) y axe da 0
   `color-contrast` en /pacientes.
5. ~~`nested-interactive` — línea base de /pacientes~~ — **PAGADA en la 3ª
   rebanada** (patrón de acción extendida `.nx-fila-abrir`; sección al
   FINAL). /pacientes mide **0 violaciones axe** en oscuro, claro y móvil.
6. Contrastes de /chat + colisiones de widgets flotantes (anotadas Fase 9).
7. DEBT-008 — el acento del papel del template del médico (`.receta-sheet`).
8. `heading-order` — familia moderada anotada en varias superficies.

### La rebanada: `role="status"` para los tres listones sin voz

La causa raíz, verificada en el FUENTE de axe-core instalado (no en docs):
`isRegion()` acepta `role="alert"|"log"|"status"` y `aria-live` además de los
landmarks. La mitad de los avisos del shell ya hablaba así
(`AvisoCobroPendiente`, `AvisoCorreoSinVerificar`, `AvisoIncidenteIA`,
`InstrumentStrip` → `role="status"`; `NotificacionesPushOptIn` →
`role="region"` con nombre); los tres mudos eran:

- **`TrialBanner`** — las DOS variantes (cuenta regresiva y vencida): el
  origen del fingerprint «banner de prueba gratuita» de 15 corridas.
- **`ModeBanner`** — el listón del modo asistente (nunca medido: los arneses
  entran como médico).
- **`OfflineBanner`** — sólo aparece sin red (nunca medido); además GANA
  semántica de verdad: al caerse la red el lector de pantalla ahora anuncia
  el cambio sin robar el foco, y su icono queda `aria-hidden`.

Freeze funcional intacto: mismos gates (`plan !== 'trial'`, `mode !==
'secretaria'`, `!offline`), mismos textos, mismos destinos.

### Guardián nuevo, probado al revés

`src/__tests__/v15-a11y-avisos-en-landmark.test.ts` (5 casos): las dos
variantes de TrialBanner con voz, ModeBanner, OfflineBanner + icono
decorativo, la familia que ya hablaba no retrocede, y el freeze funcional.
**3 de 5 fallan contra el árbol previo** (verificado con `git stash`); los 2
que pasan protegen invariantes preexistentes.

### Verificado en navegador real (12-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start` vía
`arnes-breakpoints-v15.sh`). Arnés nuevo:
`scripts/design/capturar-avisos-landmark-v15.mjs` — incluye la variante que
NINGUNA corrida había medido: la red se corta DE VERDAD
(`context.setOffline(true)`) para ver `OfflineBanner` en vivo. Resultado y 4
capturas en `docs/design/capturas/v15-avisos-landmark/`:

- **Axe: CERO violaciones — no sólo `region`: NINGUNA** — en las cuatro
  mediciones (escritorio oscuro, claro, sin red, móvil 390). Es la primera
  vez que /dashboard mide limpio del todo en la rama: la línea base traía
  `region` ×2-3 + `landmark-unique` ×2 en cada corrida desde la Fase 3.
- Banner de prueba en DOM con `role="status"` en los dos temas y en móvil;
  `OfflineBanner` aparece al cortar la red con `role="status"`.
- **Equivalencia funcional con clic real**: «Activar plan →» aterriza en
  `/configuracion?tab=suscripcion` (`llega: true`).
- **Consola**: los únicos 6 errores son `ERR_INTERNET_DISCONNECTED` — del
  corte de red DELIBERADO del paso 3. Cero errores propios.

### Compuertas de esta corrida

- `npx vitest run`: **9155 pasan (629 archivos), 1 fallo AMBIENTAL** —
  `la-agenda-es-un-riel` agotó los 5s de import bajo la carga de la suite
  completa (el import total de esta corrida tardó 334s en el contenedor);
  re-corrido en aislamiento: **12/12 pasa**. No toca este diff (citas vs
  layout/OfflineBanner). El guardián nuevo 5/5.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (1971/629
  se mantienen — esta rebanada es de semántica, no de estilos).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (build de producción para el arnés) con
  `.env.local` demo (recreado en este contenedor: 7 variables + emuladores +
  `PORTAL_PACIENTE_SECRET` demo).
- `docs/design/SCREEN_INVENTORY.md`: regenerado, sin cambios (layout no es
  pantalla del inventario).

**Siguiente tarea exacta:** `V15-A11Y-001`, segunda rebanada: **el
formulario de /referencia paga sus etiquetas** (`label` ×3 CRÍTICO +
`select-name` ×2 — la única deuda crítica del inventario). Método de la
casa: leer la pantalla entera, arreglar con las clases del sistema
(`.label`/`.input` + htmlFor/id, como /login y /registro), guardián probado
al revés, y arnés en navegador real con axe en los dos temas y móvil.
Después: rebanada 3 = familia `color-contrast` del botón «Editar»; luego
`nested-interactive` de /pacientes y los contrastes de /chat.

## `V15-A11Y-001` — segunda rebanada: el formulario de /referencia tiene nombre — la única deuda CRÍTICA muere (12-ago-2026)

La misma corrida que abrió la iteración pagó también la candidata crítica del
inventario. Leída entera antes de rebanar (275 líneas). La carta de
referencia/contrarreferencia — una hoja que viaja a OTRO médico — se componía
en un formulario donde NINGUNO de los nueve controles (2 selects, 2 inputs,
5 textareas) tenía nombre accesible: `<label>` visuales sin `htmlFor`,
controles sin `id`, y un dialecto local de formulario (dos
`React.CSSProperties` a mano, anteriores al sistema).

- **Los nueve controles hablan `.label`/`.input` con su pareja htmlFor/id**
  (`ref-tipo` … `ref-estudios`) — las mismas clases que /login y /registro
  pagaron en su rebanada. El dialecto local murió (y el trinquete de diseño
  BAJÓ de verdad: tamaños 1971→1970, radios 629→628, resellado).
- **`page-has-heading-one` se pagó en la misma corrida** (precedente 4ª
  rebanada: lo que el primer axe propio de la pantalla encuentra, se paga):
  el título de la carta (`CARTA DE REFERENCIA` / `CONTRARREFERENCIA`) es
  ahora el `<h1>` de la pantalla, con los estilos en línea que dejan el
  papel IDÉNTICO.
- **§24**: «Atrás» gana minHeight 44 (medido: 44). El import muerto `Send`
  murió.
- **Freeze funcional intacto**: mismo prellenado desde la última nota
  (preferir firmada, `?nota=` manda), alergias SIEMPRE de
  `alergiasParaImpreso` (campo estructurado), cédula ausente se DECLARA,
  mismas dos salidas (PDF + imprimir del mismo `#doc`), guarda de
  `configError` en las dos.

### Guardián nuevo, probado al revés

`src/__tests__/v15-a11y-referencia-formulario-con-nombre.test.ts` (5 casos):
htmlFor/id ×9, clases del sistema + muerte del dialecto, h1, §24, y el
freeze funcional completo. **3 de 4 fallaban contra el árbol previo**
(verificado con `git stash`, antes del caso del h1); el que pasa protege
invariantes funcionales preexistentes.

### Verificado en navegador real (12-ago-2026)

Arnés nuevo: `scripts/design/capturar-referencia-formulario-v15.mjs` —
siembra su nota firmada sintética y mide la asociación label↔control DE
VERDAD (`el.labels.length`), no el JSX. Resultado y 3 capturas en
`docs/design/capturas/v15-referencia-formulario/`:

- **`sinNombre: []` en escritorio Y móvil** — los nueve controles con
  exactamente 1 etiqueta asociada cada uno.
- **Axe: 0 violaciones en las TRES mediciones** (oscuro, claro, móvil 390)
  tras pagar el h1 — la tercera superficie de la rama que mide limpio del
  todo (tras /login y /registro), y la primera CON el shell del dashboard
  (la 1ª rebanada de esta corrida mató el `region` que lo impedía).
- **Equivalencia funcional medida**: el prellenado de la nota firmada LLEGA
  (resumen, diagnóstico con CIE-10, tratamiento con dosis/vía/frecuencia);
  teclear «Motivo» aparece en la hoja `#doc`; móvil 390 sin desborde.
- **Consola**: sólo el aviso ambiental de reconexión del emulador ×2.

### Compuertas de esta corrida (rebanada 2)

- `npx vitest run`: ver reporte de la corrida (guardián nuevo 5/5).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: BAJÓ (1970/628), resellado
  con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio ×2 (builds de producción para el arnés).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/referencia cambió).

**Siguiente tarea exacta:** `V15-A11Y-001`, tercera rebanada: la familia
`color-contrast` del botón «Editar» (~5 nodos, anotada en Fase 10). Después:
`nested-interactive` de /pacientes, contrastes de /chat + colisiones de
widgets flotantes, `heading-order`, y DEBT-008 (`.receta-sheet`). El método
queda demostrado por las dos rebanadas de hoy: inventario → pantalla entera
→ clases del sistema → guardián al revés → arnés real con axe hasta 0.

## `V15-A11Y-001` — tercera rebanada: las filas de /pacientes ya no anidan un control dentro de otro (12-ago-2026)

La tarea exacta que dejó la segunda rebanada decía «familia `color-contrast`
del botón Editar». La primera medición de esta corrida cerró esa etiqueta
como **conflación del inventario**: los ~5 nodos del Editar siempre fueron
`nested-interactive` (así lo midió la Fase 10, 4ª y 6ª rebanadas); los nodos
de contraste de aquellas corridas eran del TrialBanner, pagados en
VISUAL-SYSTEM 6ª. El Editar mide ≈7.6:1 oscuro / ≈6.1:1 claro — computado
en vivo: `rgb(168,172,174)` sobre `rgb(26,29,33)` y `rgb(86,90,96)` sobre
`rgb(245,243,238)`. Lo que sí había — en TODAS las mediciones de /pacientes
de la rama — era el defecto estructural: cada fila del directorio era
`role="button"` (activable) con el `<button>` Editar DENTRO. Un control
dentro de otro control: árbol ilegible para el lector de pantalla, y el
interior colgando de un stopPropagation.

### La rebanada: patrón de acción extendida (`.nx-fila-abrir`)

La salida NO fue quitarle el clic a la fila, fue quitarle el ROL a la caja:

- **La identidad del paciente es ahora un `<button>` nativo** con la misma
  etiqueta de siempre («Abrir el expediente de X») y su área de golpe se
  ESTIRA sobre la fila entera con un `::after` (inset 0) — el gesto del
  ratón no cambia: clic en cualquier punto de la fila abre el expediente.
- **Editar es su HERMANO por encima del velo** (`position:relative` +
  `zIndex:1`) — el DOM queda plano: dos botones hermanos, cero anidamiento.
- **El teclado gana un orden honesto**: identidad → Editar, foco nativo,
  Enter navega sin `onKeyDown` sintético; el anillo de foco se pinta sobre
  la fila completa (`:focus-visible::after`).
- El patrón vive en `globals.css` con su porqué (incluida la decisión de NO
  subrayar: el control percibido sigue siendo la fila — velo + hover —, no
  una palabra dentro de prosa; WCAG 1.4.1 no pide subrayar lo que no vive
  en prosa). `activable` salió de la página (era su único uso ahí); las
  otras superficies con `activable` (calendario, camas, UCI, Table.tsx) no
  tienen controles dentro — no son este defecto.
- **Freeze funcional intacto**: mismo `onAbrir` (médico → expediente,
  secretaria → modal), mismo Editar con stopPropagation sólo-médico, mismas
  píldoras, mismo marcador de internado, mismo hover de fondo.

### Guardianes, probados al revés

`src/__tests__/v15-a11y-pacientes-sin-nested-interactive.test.ts` (8 casos):
activable fuera de la fila, botón de identidad estirado, Editar hermano
sobre el velo, patrón en globals.css, y el freeze funcional. **5 de 8
fallan contra el árbol previo** (verificado con `git stash`); los 3 que
pasan protegen invariantes preexistentes. El guardián de la Fase 10
(`v15-roles-tipograficos-en-pacientes.test.ts`) SIGUIÓ al mecanismo nuevo
(precedente: el guardián del alto táctil de la franja): sus casos de
etiqueta accesible y de «span, no enlace» ahora nombran al botón de la
identidad, con la nota histórica escrita en su cabecera. 18/18 en verde.

### Verificado en navegador real (12-ago-2026)

Arnés nuevo: `scripts/design/capturar-fila-sin-anidado-v15.mjs` (emuladores
+ siembra + build de producción + `npm start` vía
`arnes-breakpoints-v15.sh`). Resultado y 3 capturas en
`docs/design/capturas/v15-fila-sin-anidado/`:

- **Axe: CERO violaciones — en las tres mediciones** (oscuro, claro, móvil
  390). `nested-interactive` pasó de ×5 en cada medición histórica de
  /pacientes a 0; /pacientes es la cuarta superficie de la rama que mide
  limpio del todo (tras /dashboard, /login+/registro y /referencia).
- **Estructura viva medida**: `interactivosAnidados: 0`,
  `filasConRoleButton: 0`, `esBotonNativo: true`, velo
  `absolute/inset 0px`, Editar `zIndex 1` — en los dos temas.
- **El velo navega**: clic POSICIONAL en el metadato (page.mouse, lejos del
  texto de la identidad) aterriza en `/expediente/pac-luzmaria-cervantes`
  (`llega: true`). Nota de método: `locator.click()` de Playwright se NIEGA
  a ese clic — reporta que `.nx-fila-abrir` «intercepts pointer events» —
  que es exactamente el velo funcionando; el arnés documenta por qué usa
  coordenadas.
- **Editar sigue siendo Editar**: su clic abre el modal «Editar paciente» y
  la URL no cambia (`noNavego: true`).
- **Teclado**: `focoEnBoton: true`, `tag: BUTTON`, Enter navega al
  expediente.
- **Móvil 390**: sin desborde (`anchoDocumento: 390`), tap posicional en el
  metadato navega (`veloNavega: true`).
- **Consola**: sólo el aviso ambiental de reconexión del emulador ×2 (los
  datos llegaron: 5 filas pintadas y navegación real).

### Compuertas de esta corrida

- `npx vitest run`: ver reporte de la corrida (guardián nuevo 8/8; el de la
  Fase 10 actualizado 10/10).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (496/1970/
  628/22 se mantienen — la rebanada es de estructura, no de estilos).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (build de producción para el arnés) con
  `.env.local` demo (recreado en este contenedor: 7 variables + emuladores
  + `PORTAL_PACIENTE_SECRET` demo).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/pacientes cambió de
  líneas).

**Siguiente tarea exacta:** `V15-A11Y-001`, cuarta rebanada: **contrastes
de /chat + colisiones de widgets flotantes** (anotadas en Fase 9 — la
familia más antigua que queda en el inventario). Método de la casa:
inventariar los hallazgos exactos anotados (grep de este archivo +
re-medición axe de /chat en vivo), pantalla entera leída antes de rebanar,
tokens medidos con la fórmula WCAG (no adivinados), guardián probado al
revés, arnés real con axe hasta donde la deuda preexistente lo permita.
Después: `heading-order` (familia moderada multi-superficie) y DEBT-008
(`.receta-sheet`, decisión de diseño de plantilla pendiente).

## `V15-A11Y-001` — cuarta rebanada: los contrastes de /chat hablan tokens por tema, y los widgets flotantes dejan de tapar controles (12-ago-2026)

La tarea exacta que dejó la tercera rebanada. El método de la casa se cumplió
al pie: re-medición ANTES de tocar nada — y la re-medición encontró más de lo
anotado.

### La medición primero, y lo que enseñó

El arnés de diagnóstico (axe con fg/bg/ratio en oscuro/claro × 1440/390) **no
pudo ni terminar**: al intentar pulsar Enviar, Playwright reportó
«`.theme-toggle` subtree intercepts pointer events» — **en 1440 Y en 390**.
La colisión anotada por Fase 9 (toggle sobre el borde de la hoja del aviso
push) tenía una hermana peor que ningún arnés había visto: el composer del
lienzo ancla su acción primaria EXACTAMENTE en la esquina del widget
flotante. Los arneses anteriores no la vieron porque pulsaban Enviar con el
textarea aún ENFOCADO — y con foco el toggle ya se ocultaba (regla ≤900px).
El gesto real del médico (escribir, revisar la lista —blur—, pulsar Enviar)
se lo comía el toggle.

Además, el primer intento de re-medición cazó un fantasma de infraestructura
de la MISMA familia que nx-stat-grid: un `next-server` huérfano de una
corrida anterior seguía dueño del :3000 sirviendo el build VIEJO (chunks con
hash desconocido → 500 + `text/plain`). El `trap` del arnés mataba al
envoltorio de npx, no al hijo. Arreglado en `arnes-breakpoints-v15.sh`
(pkill preventivo + trap que mata a los dos), con su porqué en el script.

### Los contrastes: color fijo sobre relleno temático

Los 3 nodos anotados eran síntoma de una sola causa: /chat escribía COLOR
FIJO sobre RELLENO POR TEMA. `#a78bfa` (secretaria) sólo legible en oscuro
(2.7:1 sobre blanco); `#040b12` sobre `var(--teal)` que en claro es un
relleno PROFUNDO (#12626E → 2.8:1); alfas de negro (0.7/0.55/0.15) que
sobre el teal oscuro medían 3.4–4.7:1; `'#000'` en los avatares (3.0:1 en
claro). La salida NO inventó tokens: la pareja medida que ya existía —
`--sobre-aviso`, el token «texto encima de un relleno semántico» que
invierte su polaridad por tema — más `--purple` y `--badge-gris-t` para los
roles. La jerarquía interna de la burbuja propia la dan tamaño y peso, no
alfas que hunden el contraste. En oscuro la identidad visual queda IGUAL
(teal brillante + tinta); en claro por fin es legible (teal profundo +
blanco).

### Los widgets flotantes

- **El toggle cede al aviso push** — sumado al MISMO bloque `:has` del FAB
  (la colisión anotada por Fase 9).
- **En pantallas-lienzo el toggle sube** y libra el composer: 92px
  escritorio, 136px móvil (53 nav + ~70 composer + aire; el primer intento
  de 123px quedó ROZANDO — `tocaComposer:true` por ~2px — y lo cazó el
  arnés, no el ojo). Flota sobre la cola de la lista: contenido
  desplazable, ningún control.
- **§24**: el toggle sube a 44×44 en las dos hojas (era 38, y 34 en móvil —
  el «táctil chico» anotado por la radiografía de trabajos móviles).

### Guardianes, probados al revés

`src/__tests__/v15-a11y-chat-contraste-y-widgets.test.ts` (7 casos): tokens
de rol, --sobre-aviso sobre relleno, 44×44 en las dos hojas, cesión al
aviso, subida en lienzo, y freeze funcional (contrato de enviarMensaje,
burbuja por senderId, etiquetas de rol). **5 de 7 fallan contra el árbol
previo** (verificado con `git stash`); los 2 de freeze pasan antes y
después. El guardián del aviso push
(`v15-push-optin-no-tapa-el-pulgar.test.ts`) SIGUIÓ al mecanismo nuevo (el
FAB ya no cede solo: ceden los widgets), con la nota histórica en el caso —
tercer precedente de esta disciplina.

### Verificado en navegador real (12-ago-2026)

Arnés nuevo: `scripts/design/capturar-chat-contraste-v15.mjs` — axe CON
detalle en CUATRO mediciones (oscuro/claro × 1440/390), geometría del
toggle, click en Enviar SIN foco, y cesión al aviso. Resultado y 5 capturas
en `docs/design/capturas/v15-chat-contraste/`:

- **Axe: CERO violaciones en las CUATRO mediciones** — /chat es la quinta
  superficie de la rama que mide limpio del todo, y la primera medida
  también en tema claro a 390. (La familia `color-contrast` de 3 nodos
  anotada por Fase 9 muere; en claro habrían sido más nodos — nadie había
  medido claro.)
- **El gesto que antes se comía el toggle, medido de punta a punta**: en
  las cuatro combinaciones se escribió, se le QUITÓ el foco al textarea y
  se pulsó Enviar con click real → `enviarClickeableSinFoco: true` y el
  mensaje LLEGA a la lista (ida y vuelta por el emulador).
- **Geometría**: toggle 44×44 en las cuatro; `tocaComposer/tocaEnviar/
  tocaNav: false` en las cuatro.
- **Cesión al aviso**: con `.nx-push-optin` abierto, toggle
  `opacity: 0` + `pointer-events: none`; tras «Después», `opacity: 1`.
- **Consola**: 1 error ambiental en una sola medición (reconexión del
  emulador, fingerprint conocido); 0 en las otras tres.

### Compuertas de esta corrida

- `npx vitest run`: 9175/9176 en verde — el único fallo es el PRE-EXISTENTE
  ambiental de siempre (`ops-timeout-y-punto-ciego`, el proxy del contenedor
  responde en vez de agotar, mismo fingerprint documentado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: **BAJÓ** — hexEnLinea
  496 → 493 (los hex fijos del chat murieron), resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio ×3 (builds de producción para el arnés).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/chat cambió de líneas).

**Siguiente tarea exacta:** `V15-A11Y-001`, quinta rebanada:
**`heading-order`** (la familia moderada multi-superficie anotada en el
inventario de la 1ª rebanada) — inventariar los hallazgos exactos con grep
de este archivo + re-medición axe en vivo de las superficies anotadas,
pantalla entera leída antes de rebanar, guardián probado al revés, arnés
real hasta donde la deuda preexistente lo permita. Después: DEBT-008
(`.receta-sheet`, decisión de diseño de plantilla pendiente) y el enlace del
TrialBanner + enlace de paciente de /pendientes (táctiles chicos anotados
que esta rebanada no cubrió).

## `V15-A11Y-001` — quinta rebanada: el lienzo de /consulta tiene un esquema de encabezados honesto (12-ago-2026)

La tarea exacta que dejó la cuarta rebanada: la familia `heading-order`.
Método de la casa cumplido: inventario por grep de este archivo + grep del
código ANTES de tocar nada.

### El inventario primero, y lo que dimensionó

Las anotaciones de toda la rama señalan UN nodo axe (`<h4>Sus
medicamentos</h4>` de la hoja del paciente, presente en cada captura POBLADA
de `V15-ENCOUNTER-MODE-001`), y el grep de h4/h5/h6 sobre `src/app` +
`src/components` encontró la familia completa: **sólo dos componentes en
todo el producto** tenían h4+ (`HojaParaElPaciente`, `PlanPorProblema`), más
el defecto simétrico en `NerPanel` (h3 directo tras el h1 — sólo visible con
el panel de entidades abierto). La causa raíz compartida: los títulos de
sección eran `<span>` con peso (cromo visual) y los internos `<h4>` elegidos
por tamaño, no por posición — el esquema real era h1 → h4, con las secciones
mayores invisibles para quien navega por encabezados.

### La rebanada: toda sección mayor porta su h2

- `HojaParaElPaciente`: «Lo que se lleva el paciente» `<span>` → `<h2>`;
  bloques `<h4>` → `<h3>`.
- `PlanPorProblema`: «Qué es de qué» `<span>` → `<h2>`; problemas `<h4>` →
  `<h3>`.
- `NerPanel`: «Entidades clínicas» `<h3>` → `<h2>`.

Así CUALQUIER combinación de render (la hoja sola, el plan solo, entidades
abiertas o no) produce h1 → h2 → h3 sin saltos. El estilo viaja en línea en
los tres componentes, de modo que el cambio de etiqueta no mueve un píxel
(`margin: 0` explícito donde el user-agent metería margen). Freeze funcional
intacto: cero cambios de lógica, sólo etiquetas.

### Guardián, probado al revés

`src/__tests__/v15-a11y-consulta-esquema-de-encabezados.test.ts` (6 casos):
h2+h3 en los tres componentes, sin h4, margin: 0 en los h2 nuevos, y el
freeze (la consulta sigue montando las tres secciones; un solo h1). **4 de 6
fallan contra el árbol previo** (verificado con `git stash`); los 2 que
pasan protegen invariantes preexistentes.

### Verificado en navegador real (12-ago-2026)

Arnés nuevo: `scripts/design/capturar-esquema-encabezados-v15.mjs` — puebla
la consulta (dx + Metformina; la hoja del paciente no se pinta vacía, y el
hallazgo sólo existía poblado), lee el esquema REAL del DOM (todos los
h1..h6 en orden, con detección de saltos), corre axe con detalle y COMPUTA
el contraste vivo del botón de evidencia (color sobre fondo compuesto por
alfa). Resultado y 3 capturas en
`docs/design/capturas/v15-esquema-encabezados/`:

- **Esquema medido: h1 (paciente) → h2 (Lo que se lleva el paciente) → h3
  (Sus medicamentos), cero saltos** — en oscuro 1440, claro 1440 y
  oscuro 390.
- **Axe: CERO violaciones TOTALES en las tres mediciones** — /consulta
  POBLADA es la sexta superficie de la rama que mide limpio del todo, y es
  el lienzo del encuentro, la pantalla donde el médico vive. `heading-order`
  pasó de 1 nodo (cada captura poblada histórica) a 0.
- **El hallazgo hermano, cerrado con cifras y no por fe**: el
  `color-contrast` anotado del encabezado teal de evidencia (`#0f6e56`,
  3.03:1) era del ACENTO VIEJO. El botón vivo computa `rgb(42,165,181)`
  sobre `rgb(12,29,29)` = **5.9:1** en oscuro y `rgb(18,98,110)` sobre
  `rgb(227,243,239)` = **6.13:1** en claro — la Fase 10 (migración cobalto)
  lo había matado; esta rebanada lo CONFIRMA en vivo con la fórmula WCAG
  sobre el fondo compuesto. (El panel desplegado de evidencia requiere el
  API real de PubMed y no se puede poblar en este arnés; usa los mismos
  tokens `var(--teal)` que el botón medido.)
- **Consola**: sólo el aviso ambiental de reconexión del emulador ×1 por
  medición.

### Compuertas de esta corrida

- `npx vitest run`: ver reporte de la corrida (guardián nuevo 6/6).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (493/1970/
  628/22 se mantienen — la rebanada cambia etiquetas, no estilos).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (build de producción para el arnés) con
  `.env.local` demo (recreado en este contenedor: 8 variables + emuladores +
  `PORTAL_PACIENTE_SECRET` demo; `npm ci` también hizo falta — contenedor
  fresco).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (sin cambios de líneas — la
  rebanada vive en componentes, no en páginas).

**Siguiente tarea exacta:** `V15-A11Y-001`, sexta rebanada: **los táctiles
chicos anotados** — el enlace del TrialBanner y el enlace de paciente de
/pendientes (§24: objetivo táctil ≥44×44; anotados por la radiografía de
trabajos móviles de Fase 9 y re-anotados por la 4ª rebanada, que no los
cubrió). Método de la casa: grep de este archivo por los hallazgos exactos +
re-medición en vivo ANTES de tocar, pantalla entera leída, guardián al
revés, arnés real con axe. Después queda sólo DEBT-008 (`.receta-sheet`) —
que carga una decisión de diseño de plantilla del médico aún pendiente: si
al abrirla la decisión sigue sin dueño, documentar la opción segura y
consultar al dueño en vez de adivinar (regla 6 de seguridad clínica, dicha
en interfaz).

## `V15-A11Y-001` — sexta rebanada: los dos táctiles chicos que eran ENLACES ganan su golpe de 44 (13-ago-2026)

La tarea exacta que dejó la quinta rebanada. Método de la casa cumplido:
grep de este archivo por los hallazgos exactos + re-medición en vivo ANTES
de tocar, pantalla entera leída, guardián al revés, arnés real con axe.

### La causa raíz, dimensionada primero

Los dos hallazgos de la radiografía de Fase 9 («Activar plan →» del
TrialBanner a 100×24; el enlace de paciente de /pendientes, `a.nx-ident`, a
156×20) son UNA causa: el bloque `@media (pointer: coarse)` de globals.css
cubre `.btn`, `button`, `select`, `input` y `textarea` — pero **nunca cubrió
`<a>`**. Todo control que fuera un enlace quedaba sin mínimo táctil por
construcción.

### La rebanada: el golpe se estira, lo visible no se mueve

Un `min-height: 44px` NO servía: la píldora del banner pinta su fondo sobre
el padding (engordaría lo visible y el alto del shell) y la identidad vive
en una fila alineada por línea de base. La salida es el mecanismo que la 3ª
rebanada ya bendijo (`.nx-fila-abrir::after`): un pseudo `::before`
invisible centrado, `max(100%, 44px)` en los dos ejes, SÓLO en puntero
grueso — el hit-testing del navegador atribuye el pseudo a su elemento y el
tap de 44px llega al enlace sin mover un píxel del layout.

- `a.nx-ident` (globals.css): la regla cubre TODA identidad-enlace presente
  y futura — /pendientes (Tarjeta y TarjetaCerrada) sin tocar su JSX.
- `.nx-cta-aviso` (clase nueva): las DOS variantes del CTA del TrialBanner
  (cuenta regresiva y prueba vencida) en `layout.tsx`.
- Dos ajustes que el arnés MIDIÓ, no que se supusieron: el CTA del banner
  vive en un corredor de 41px — la topbar pegajosa (z-45) le come todo lo
  que asome por arriba, y ella DEBE ganar (tiene sus propios controles); la
  capa `page-transition` se comía el borde inferior. Por eso el estirón se
  sesga 2px hacia ABAJO (hacia el pulgar) y el enlace lleva `z-index: 1`.
  Sin los dos, el área efectiva medía 40, no 44 — lo cazó el arnés con el
  diagnóstico de elementFromPoint píxel a píxel, no el ojo.

### Guardián, probado al revés

`src/__tests__/v15-a11y-tactiles-de-enlace.test.ts` (6 casos): pseudo con
44/44 sesgado al pulgar + z-index, la regla VIVE dentro del bloque coarse
(el escritorio no se estira — guardia de alcance), las dos variantes del
banner llevan la clase, y el freeze (los Link de /pendientes siguen siendo
`a.nx-ident` al expediente; los mínimos de botones/inputs del bloque coarse
intactos). **Los casos 1, 2 y 4 fallan contra el árbol previo** (verificado
con `git stash`); el 3 y los de freeze pasan antes y después.

### Verificado en navegador real (13-ago-2026)

Arnés nuevo: `scripts/design/capturar-tactiles-de-enlace-v15.mjs` — y trae
una lección de MÉTODO: el pseudo NO aparece en `getBoundingClientRect`, así
que una radiografía futura que sólo lea rects volverá a ver 156×20 y DEBE
hit-testear. El arnés mide el área que el navegador de verdad atribuye al
enlace (búsqueda binaria del borde con elementFromPoint, precisión 0.25px —
el primer intento barría a 2px y perdía hasta 4px en los bordes) y luego
ENTREGA el tap (`touchscreen.tap` FUERA de lo visible). Resultado y 2
capturas en `docs/design/capturas/v15-tactiles-de-enlace/`:

- **Móvil 390 (hasTouch → `pointer: coarse` comprobado con matchMedia)**:
  enlace de paciente 174×20 visible → **45px de golpe**; CTA del banner
  100×24 visible → **44px de golpe** (pseudo computado 44px en los dos).
- **El tap LLEGA** («el dato tiene que llegar», dicho en táctil): tap 6px
  ENCIMA del texto del paciente → `/expediente/pac-aurelio-dominguez`
  (`llega: true`); tap 6px DEBAJO de la píldora → 
  `/configuracion?tab=suscripcion` (`llega: true`).
- **Escritorio 1440 (puntero fino)**: golpe 21.5/25px — la densidad NO se
  estiró; el alto del banner queda en 41px, idéntico.
- **Axe: CERO violaciones** en /pendientes móvil con el banner presente.
- **Consola**: sólo el aviso ambiental de reconexión del emulador ×1.

### Compuertas de esta corrida

- `npx vitest run`: 9187/9188 en verde ×2 corridas completas (guardián
  nuevo 6/6 en las dos). Primera corrida: el único fallo fue
  `la-agenda-es-un-riel` por carga del pool (import 332s en paralelo) y
  **pasa 12/12 en aislamiento**. Re-corrida completa: ese no se repitió y el
  único fallo fue el PRE-EXISTENTE ambiental de siempre
  (`ops-timeout-y-punto-ciego`, el proxy del contenedor responde en vez de
  agotar, mismo fingerprint documentado). Ninguno toca esta rebanada.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (493/1970/
  628/22 se mantienen — la rebanada estira golpes, no pinta).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio ×2 (builds de producción para el arnés)
  con `.env.local` demo (recreado en este contenedor: 8 variables +
  emuladores + `PORTAL_PACIENTE_SECRET` demo; `npm ci` también hizo falta —
  contenedor fresco).
- `docs/design/SCREEN_INVENTORY.md`: regenerado (sin cambios de líneas — la
  rebanada vive en CSS global y el shell, no en páginas).

**Siguiente tarea exacta:** `V15-A11Y-001`, última rebanada: **DEBT-008**
(`.receta-sheet`) — que carga una decisión de diseño de plantilla del médico
aún pendiente: si al abrirla la decisión sigue sin dueño, **documentar la
opción segura y dejarla consultada al dueño en vez de adivinar** (regla 6 de
seguridad clínica, dicha en interfaz), y cerrar la iteración `V15-A11Y-001`
con su resumen de deuda restante. Después, por §43: `V15-MOTION-001`.

## `V15-A11Y-001` — séptima entrega: DEBT-008 abierto, documentado y CONSULTADO al dueño; la iteración CIERRA (13-ago-2026)

La tarea exacta que dejó la sexta rebanada. DEBT-008 se abrió con la regla
6 de seguridad clínica en la mano: **la decisión seguía sin dueño, así que
no se adivinó** — se dimensionó, se escribió la opción segura y se dejó
consultada. Esto NO es una rebanada de código: es el cierre honesto de la
única deuda a11y que no puede pagarse de forma autónoma.

### DEBT-008, dimensionado con cifras

`.receta-sheet` es el PAPEL de la receta/orden — el documento que se imprime
con cédula profesional. Su acento (`recetaConfig.colorAccento`) es una
**decisión de plantilla del médico**: se elige con un `<input type="color">`
en `/configuracion?tab=recetas` («Color de acento — líneas, encabezado»).
El hallazgo axe `color-contrast` de las capturas de /receta y /orden vive
DENTRO del papel y nace del **valor por omisión del producto**, no de una
elección del médico:

- Default actual: `#14b8a6` → **2.49:1 sobre el blanco del papel**. Falla
  AA para texto normal (4.5:1) y hasta para texto grande (3:1). Se pinta
  como TEXTO en: el título «Receta Médica»/«Orden Médica», la especialidad
  del encabezado minimalista y el símbolo ℞; y como fondo de los chips
  numerados con texto blanco encima (blanco sobre `#14b8a6` = el mismo
  2.49:1). Las líneas/bordes de acento son decorativas y no cargan texto.
- Incoherencia hermana descubierta al dimensionar: la exportación a WORD
  (`src/lib/receta-word.ts`) tiene OTRO default — `#2845EA` (6.71:1, azul).
  El mismo médico sin configurar imprime un papel teal y exporta un Word
  azul. Dos voces para el mismo documento.

### La opción segura, documentada (pendiente de decisión del dueño)

1. **Cambiar sólo el DEFAULT** a un teal oscuro de la misma familia:
   `#0f766e` (5.47:1, AA) conserva la identidad teal; `#12626e` (7.0:1,
   AAA, el tono nexus del tema claro) es la opción más legible. Un color
   guardado explícitamente por un médico NUNCA se toca.
2. **Unificar el default de Word al mismo valor** — muere la incoherencia
   `#14b8a6`/`#2845EA`.
3. Opcional: aviso de legibilidad NO bloqueante junto al picker (computar
   el contraste en vivo y avisar por debajo de 4.5:1). Visible, no
   silencioso; el médico conserva libertad total.

**Por qué no se hizo de una vez**: el papel es el artefacto de identidad
profesional del médico (territorio del membrete). Cambiar el default cambia
lo que imprime todo consultorio que nunca configuró su acento — eso es una
decisión de plantilla del dueño, y la regla es preguntarle, no adivinar.
La consulta viaja en el reporte de esta corrida.

### `V15-A11Y-001` — CERRADA, con su resumen de deuda

Las ocho familias del inventario de apertura: 1 (`region`/landmark) PAGADA;
2 (`landmark-unique`) muerta antes; 3 (/referencia sin etiquetas, la única
CRÍTICA) PAGADA; 4 (`color-contrast` Editar) cerrada como conflación con
cifras; 5 (`nested-interactive`) PAGADA; 6 (contrastes de /chat + widgets)
PAGADA; 7 (DEBT-008) **documentada y consultada al dueño — única deuda
restante, bloqueada en decisión de plantilla, no en código**; 8
(`heading-order`) PAGADA. Seis superficies miden axe 0 TOTAL (dashboard,
referencia, pacientes, chat, consulta poblada, pendientes móvil).

## `V15-MOTION-001` — abierta; primera rebanada: las transiciones de globals.css hablan los tokens (13-ago-2026)

Por §43 orden 14, la iteración que la novena rebanada de Fase 10 dejó armada
con sus dos diferimientos escritos: (a) el sistema de tokens de movimiento
(«definidos… y usados CERO veces: las 22 transiciones escriben su duración a
mano y conviven dos curvas») y (b) la coreografía de continuidad de §20.
Esta rebanada paga (a) para la hoja global — la deuda mecánica primero, para
que (b), el trabajo de diseño real, se haga sobre un sistema con una voz.

### La rebanada: el token adopta la curva REAL, y la hoja entera la habla

- **La curva**: `--mov-curva` era `cubic-bezier(0.2,0,0,1)` con CERO usos;
  la de facto, `cubic-bezier(0.16,1,0.3,1)`, tenía 39. El token adopta la
  curva real — nada cambia visualmente donde ya se usaba — y la teórica
  muere.
- **`--mov-presion: 80ms` nuevo**: el estado `:active` del botón usaba 80ms
  a mano con razón (el feedback de presión debe responder <100ms). Con
  nombre, la excepción es sistema y el barrido puede exigir CERO duraciones
  a mano.
- **Las 22 transiciones** de `globals.css` dejan sus NUEVE duraciones
  distintas (80/100/120/140/150/180/200/240/280ms) por los papeles:
  rapido=feedback de color/fondo/opacidad (100→120, 140→120, 150→120),
  normal=énfasis/lift/cross-fade (180→200, 240→200), lento=movimiento
  espacial (280→320), presion=:active. Los `ease` sueltos adoptan la curva.
- **Dos declaraciones MUERTAS retiradas**: `.card-hover` y `.kpi-card`
  declaraban transition DOS veces (la temprana quedaba reemplazada entera
  por el shorthand del bloque de micro-interacciones). Una clase, una voz.

### Hallazgo de cascada, anotado para la siguiente rebanada (PREEXISTENTE)

El arnés midió la verdad que el texto no enseña: la regla agrupada del
cross-fade de tema (`html, body, .card, …, .btn, .nav-item, .tab, .input`)
viene DESPUÉS de las reglas base y las **reemplaza** — .btn/.nav-item/.tab/
.input computan normal ×3 (background-color/color/border-color) y pierden su
papel rapido y su transición de opacity; el fade del `.theme-toggle` sombrea
su propio shorthand. Ya era así con las duraciones a mano (200ms literal en
la regla agrupada): esta rebanada NO lo cambió — equivalencia funcional — y
decidir la política de una-voz-por-propiedad es trabajo de diseño de la
siguiente rebanada, no un arreglo silencioso de ésta.

### Guardián, probado al revés

`src/__tests__/v15-motion-tokens-una-sola-voz.test.ts` (11 casos): curva de
facto en el token, curva teórica muerta, escala completa con presion,
barrido por PARTES de toda declaración transition (cero duraciones/curvas a
mano — para la transición que aún no se escribió), transition-duration a
mano sólo en el apagador de §24, :active habla presion, una voz por clase
(.card-hover/.kpi-card), y el freeze (apagador §24 intacto, opt-out de
.cita-fila intacto, los :hover que la transición pinta siguen existiendo).
**8 de 11 fallan contra el árbol previo** (verificado con `git stash`); los
3 que pasan protegen invariantes preexistentes.

### Verificado en navegador real (13-ago-2026)

Arnés nuevo: `scripts/design/medir-motion-tokens-v15.mjs` — y trae una
lección de MÉTODO escrita en su cabecera: el CSS de producción minifica
(`120ms`→`.12s`, `0.16`→`.16`) y el apagador computa `1e-05s`, así que la
comparación es NUMÉRICA, no de cadenas; y las listas se parten por comas de
primer nivel (partir «cubic-bezier(0.16, 1, 0.3, 1)» por toda coma dio
falsos fallos en la primera corrida). Resultado y captura en
`docs/design/capturas/v15-motion-tokens/`:

- **Los tokens LLEGAN**: los cinco computan su valor en :root (80/120/200/
  320/0ms) y la curva computa `cubic-bezier(.16, 1, .3, 1)` — un `var()`
  roto habría computado 0s y el guardián de texto jamás lo habría visto.
- **Cada representante computa el papel que la cascada REAL le deja**:
  .theme-toggle svg 0.32s (lento), .cita-fila 0.12s (rapido), .theme-toggle
  0.12s (fade), .btn/.nav-item 0.2s ×3 (cross-fade de tema — el hallazgo de
  arriba), todos con la curva de facto.
- **Bajo `reducedMotion: 'reduce'` el apagador de §24 GANA a la escala
  entera**: .btn computa `1e-05s` (0.01ms).
- **Consola: cero errores.**

### Compuertas de esta corrida

- `npx vitest run`: ver reporte de la corrida (guardián nuevo 11/11).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (493/1970/
  628/22 se mantienen — la rebanada unifica tiempos, no pinta).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (build de producción para el arnés) con
  `.env.local` demo (recreado en este contenedor: 8 variables + emuladores +
  `PORTAL_PACIENTE_SECRET` demo; `npm ci` también hizo falta — contenedor
  fresco; el Chromium del sistema vive en `/opt/pw-browsers/chromium` y el
  arnés lo lanza por `executablePath`, patrón de
  `capturar-acento-en-el-shell-v15`).
- `docs/design/SCREEN_INVENTORY.md`: regenerado, sin cambios (la rebanada
  vive en la hoja global).

### Inventario para la segunda rebanada — las transiciones INLINE (28 sitios, 21 archivos)

Medido por grep (`transition:` en TSX, excluyendo `'none'`): asistente/page
×5, Sidebar ×2, BottomNav ×2, app/page ×2, (dashboard)/layout ×2,
calendario ×2, y ×1 en ValoracionInmuno, SelloProcedencia, PanelRazonamiento,
OnboardingTour, MientrasHablas, GuiaConfigurarReceta, superadmin, setup,
pacientes, orden, nota, guia, finanzas, consulta y secciones-cuenta. Los
`style` inline SÍ resuelven `var(--mov-*)` (custom properties se computan en
el elemento), así que la migración es mecánica; ojo con `MientrasHablas`
(«width 90ms linear» — medidor de nivel de micrófono: es INFORMACIÓN de
seguridad en tiempo real, decidir si es transición de interfaz o
instrumento antes de tocarla). No hay styled-jsx ni CSS modules en src/ —
`globals.css` era la única hoja.

**Siguiente tarea exacta:** `V15-MOTION-001`, segunda rebanada — dos
candidatas en orden: (1) la política de una-voz-por-propiedad para la
cascada del cross-fade de tema (el hallazgo medido de esta corrida: decidir
si .btn/.nav-item/.tab/.input recuperan su papel rapido en hover/focus sin
perder el fade de tema — p. ej. transicionando sólo las propiedades de tema
en la regla agrupada o moviéndola ANTES de las bases), con navegador antes/
después; (2) las 28 transiciones inline del inventario de arriba. Después
queda (b): la coreografía de continuidad de §20 (shared element
Hoy→Paciente→Encuentro), el diferimiento grande. DEBT-008 sigue CONSULTADO
al dueño (sección de cierre de A11Y-001) — si la decisión llega, pagarla es
una rebanada corta: default nuevo + default de Word unificado + aviso no
bloqueante en el picker.

## `V15-MOTION-001` — segunda rebanada: una voz POR ELEMENTO — la cascada del cross-fade de tema deja de pisar a los controles (13-ago-2026)

La candidata (1) que dejó anotada la primera rebanada, pagada entera. El
hallazgo medido era éste: la regla agrupada del tema (`html, body, .card, …,
.input, .btn, .nav-item, .tab`) venía DESPUÉS de las reglas base y — como
`transition` es shorthand — las REEMPLAZABA enteras. El botón perdía su fade
de opacity (disabled a golpe), el input perdía box-shadow (el halo de foco
aparecía a golpe), los cuatro controles respondían al hover a 200ms en vez
de su papel rapido, y el fade de los flotantes sombreaba el shorthand del
toggle entero (su hover no transicionaba NADA).

### La política, decidida y escrita en la hoja

CSS no distingue POR QUÉ cambió una propiedad: un elemento sólo puede tener
UNA velocidad por propiedad, gane el tema o gane el hover. Decisión:

- **El cross-fade de tema lo cargan las SUPERFICIES**: la regla agrupada
  queda en `html, body, .card, .modal, .topbar, .sidebar` (fondo/color/borde
  a normal). Son ellas las que hacen la percepción del cambio de tema.
- **Los CONTROLES conservan su voz base** (.btn ×4 con opacity, .input ×3
  con box-shadow, .nav-item ×2, .tab ×2 — todos rapido): sus propiedades de
  tema ya transicionan ahí, y un control de 36px fundiéndose a 120ms dentro
  de un lienzo a 200ms es imperceptible. El feedback que el médico toca todo
  el día gana la velocidad; el evento raro (cambiar tema) no la pierde —
  sólo la funde un pelo más rápido en los controles.
- **Una voz por clase con shorthand propio**: `.theme-toggle` absorbe su
  opacity (la regla del fade queda sólo para `.boton-ayuda-fab`, que no
  declara transición en ningún otro sitio — verificado por grep) con papeles
  mezclados a propósito (color/fondo/opacity rapido, transform normal);
  `.card-hover` y `.kpi-card` ganan `color` en su shorthand — su
  micro-interacción reemplazaba a la regla del tema y perdían el fade de
  color al cambiar tema.

### Guardián, probado al revés

`src/__tests__/v15-motion-cascada-una-voz-por-elemento.test.ts` (9 casos):
la regla del tema cubre EXACTAMENTE las superficies, ningún control vive en
ella, la voz base de cada control cubre sus propiedades de tema con rapido,
.theme-toggle tiene UNA voz con opacity dentro, el FAB conserva la suya,
.card-hover/.kpi-card incluyen color, y el freeze (superficies a normal,
apagador §24, opt-out de .cita-fila, :active con presion). **4 de 9 fallan
contra el árbol previo** (verificado con `git stash`); los 5 que pasan son
freeze. Lección de MÉTODO del propio reverso: la primera versión del caso de
color pasaba en falso contra el árbol viejo porque `/color var/` matchea
DENTRO de `border-color var` — el reverso lo cazó y el regex lleva
`(?<![\w-])`. El guardián hermano de los flotantes
(`nada-tapa-un-campo-que-se-llena`) siguió al mecanismo: ahora exige el fade
del FAB en su regla y el del toggle dentro de su shorthand.

### Verificado en navegador real (13-ago-2026)

`scripts/design/medir-motion-tokens-v15.mjs` actualizado a la cascada nueva
(before queda en `docs/design/capturas/v15-motion-tokens/resultado.json`;
after en `docs/design/capturas/v15-motion-cascada/` con captura):

- **.btn 0.12s ×4** (era 0.2s ×3 — opacity recuperada), **.nav-item 0.12s
  ×2** (era 0.2s ×3), **.theme-toggle 0.12/0.12/0.2/0.12** (era opacity-only
  0.12), .theme-toggle svg 0.32s, .cita-fila 0.12s, curva de facto en todos.
- **.input medido donde VIVE**: /login antes de entrar — 0.12s ×3 con
  box-shadow. Lección de método: el formulario hidrata en cliente y sin
  `waitForSelector` el evaluate corre antes de que React pinte — la primera
  corrida reportó AUSENTE en falso.
- **.tab no se mide a propósito**: `ui/Tabs.tsx` no lo importa NADIE hoy
  (primitivo dormido, verificado por grep) — anotado en el arnés; si algún
  día se monta, se añade.
- **Bajo reduce el apagador de §24 sigue ganando** (1e-05s) y **consola: 0
  errores**.

### Compuertas de esta corrida

- `npx vitest run`: **9204/9205 en verde, CERO fallos** (ni el ambiental de
  siempre — 636 archivos). Guardián nuevo 9/9.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio (162/162).
- `docs/design/SCREEN_INVENTORY.md`: regenerado, sin cambios (la rebanada
  vive en la hoja global y el arnés).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores), mismo patrón documentado por las corridas previas.

**Siguiente tarea exacta:** `V15-MOTION-001`, tercera rebanada — las **28
transiciones INLINE** del inventario de la primera rebanada (21 archivos:
asistente ×5, Sidebar ×2, BottomNav ×2, app/page ×2, (dashboard)/layout ×2,
calendario ×2, y ×1 en 15 más): migrarlas a `var(--mov-*)` — los style
inline SÍ resuelven custom properties. OJO con `MientrasHablas` («width 90ms
linear», medidor de nivel de micrófono): es INFORMACIÓN de seguridad en
tiempo real — decidir si es instrumento (se queda) o interfaz (migra) ANTES
de tocarla. Después queda (b): la coreografía de continuidad de §20 (shared
element Hoy→Paciente→Encuentro), el diferimiento grande. DEBT-008 sigue
CONSULTADO al dueño (cierre de A11Y-001).

## `V15-MOTION-001` — tercera rebanada: las transiciones INLINE hablan los tokens, y los instrumentos quedan declarados (13-ago-2026)

La tarea exacta que dejó la segunda rebanada: el inventario de ~28
transiciones inline en TSX. El barrido del guardián nuevo encontró DOS más
que el grep del inventario no vio (nota:653 y app/page:558 — sus líneas
contienen `'none'` en el ternario del transform y el filtro del grep las
excluía): 28 sitios reales, 26 migrados, 2 declarados instrumento.

### El mapa de papeles, aplicado sitio por sitio

- **rapido (feedback de control, 20 sitios)**: Sidebar ×2 y BottomNav
  (color) — la navegación; los botones de estado de calendario ×2,
  asistente ×5, finanzas, setup y las filas de /pacientes y celdas del mes;
  la tarjeta de la landing (border-color); y los OCHO chevrones de
  revelación (orden, nota, guia, GuiaConfigurarReceta, PanelRazonamiento,
  SelloProcedencia, ValoracionInmuno, app/page). Los CTA de setup/asistente
  que decían 0.2s adoptan rapido: son controles, y la voz de control del
  sistema (.btn, 2ª rebanada) es rapido — un botón inline no habla más
  lento que su hermano de clase.
- **normal (fundido de estado, 3 sitios)**: el atenuado del ícono del
  BottomNav (0.2s→200ms exacto), los puntos de progreso del OnboardingTour
  (0.25s→200ms, precedente 240→200 de la 1ª rebanada) y el velo del cajón
  móvil del layout.
- **lento (movimiento espacial, 3 sitios)**: el DESLIZAMIENTO del cajón
  móvil (transform 0.25s→320ms — el panel entero cruza la pantalla, el
  papel es espacial aunque el valor viejo quedara más cerca de normal;
  mismo criterio que 280→320 de la 1ª rebanada) y las dos barras de llenado
  (almacenamiento de cuenta y superadmin, width .3s→320ms).
- **INSTRUMENTOS, no migrados A PROPÓSITO (2 sitios)**: los medidores de
  nivel de micrófono de `MientrasHablas` (`width 90ms linear`) y de
  /consulta (`width 60ms linear, background 200ms`). Siguen la señal EN
  VIVO: `linear` a ~90ms está afinado al ritmo del feed — una curva con
  easing o un token más lento los haría MENTIR sobre lo que capta el
  micrófono (regla 3 de seguridad clínica dicha en movimiento). La decisión
  vive como comentario JUNTO al código, y el guardián exige el valor EXACTO:
  si alguien los «normaliza» al token, falla.
- El `transition: none` del papel imprimible de /nota queda como opt-out
  legítimo (el documento no anima).

### Guardián, probado al revés

`src/__tests__/v15-motion-inline-habla-tokens.test.ts` (9 casos): barrido
línea a línea de TODO `.tsx` de src/ (toda `transition:` habla
`var(--mov-*)` con `var(--mov-curva)`, o es `none`, o es instrumento de la
lista EXACTA), prohibición de mezclar token y milisegundos a mano, los dos
instrumentos con su valor y su razón escrita, la lista de instrumentos
congelada en 2, y representantes de cada papel congelados (Sidebar/BottomNav
rapido, velo normal, cajón/barras lento). **6 de 9 fallan contra el árbol
previo** (verificado con `git stash`; los 3 que pasan son sanidad del
barrido y freeze). El propio reverso pagó su lección: el barrido cazó los
dos sitios que el grep del inventario había perdido.

### Verificado en navegador real (13-ago-2026)

Arnés nuevo: `scripts/design/medir-motion-inline-v15.mjs` (dentro de
`arnes-breakpoints-v15.sh` + emuladores + siembra + build de producción).
Resultado y capturas en `docs/design/capturas/v15-motion-inline/`:

- **Los tokens LLEGAN al style inline**: en /pacientes 13/13 y en
  /calendario 11/11 elementos con token inline computan EXACTAMENTE su
  duración (0.12s/0.2s/0.32s) y la curva de facto — un `var()` roto habría
  computado 0s y el guardián de texto jamás lo habría visto.
- **Móvil 390**: los 4 enlaces del BottomNav computan 0.12s (color) y los
  4 íconos 0.2s (atenuado), con la curva.
- **La afirmación a11y-crítica de la rebanada, medida**: bajo
  `reducedMotion: 'reduce'`, el elemento inline computa `1e-05s` — el
  apagador `!important` de §24 le GANA al style inline. Sin esto, tokenizar
  inline habría dejado media app fuera del apagador.
- **Consola**: un único `ERR_TUNNEL_CONNECTION_FAILED` — el proxy de red
  del contenedor bloqueando un recurso externo, ambiental (la rebanada no
  toca red); cero errores de la app.

### Compuertas de esta corrida

- `npx vitest run`: 9211 pasan (9 nuevos del guardián), 2 fallos: el
  PRE-EXISTENTE ambiental de siempre (`ops-timeout-y-punto-ciego`, proxy del
  contenedor) y `el-inventario-de-pantallas-no-miente` por CARRERA con la
  regeneración del inventario en esta misma corrida — re-verificado 5/5 en
  verde tras regenerar.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen — la rebanada unifica tiempos, no pinta).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/consulta cambió de
  líneas por el comentario del instrumento).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores), mismo patrón documentado por las corridas previas.

**Siguiente tarea exacta:** `V15-MOTION-001`, cuarta rebanada — **(b), el
diferimiento grande: la coreografía de continuidad de §20** (Hoy→Paciente→
Encuentro como el mismo objeto ganando detalle; Result queue→Patient
result→Source preservando la relación espacial). Empezar releyendo §20
COMPLETO y la tabla de diferimientos de la novena rebanada de Fase 10 antes
de decidir el mecanismo (View Transitions API de Next 16 vs coreografía CSS
propia) — es trabajo de DISEÑO de interacción, no mecánica: transiciones
interrumpibles, sin animar por decorar, y el apagador de §24 las tiene que
apagar TODAS. Si la decisión del dueño sobre DEBT-008 llega, pagarla antes
(rebanada corta ya dimensionada en el cierre de A11Y-001).

## `V15-MOTION-001` — cuarta rebanada: la coreografía de continuidad de §20 EXISTE — el nombre del paciente viaja de Hoy al expediente y a la consulta (13-ago-2026)

El diferimiento grande de la novena rebanada de Fase 10, pagado: «Hoy →
Paciente → Encuentro debe sentirse como EL MISMO OBJETO ganando detalle». El
crossfade del template comunica cambio; ahora la cadena de continuidad de
paciente tiene movimiento de OBJETO: el nombre del paciente (su identidad,
R3 de VISUAL_DNA) morfea de la fila de Hoy al <h1> del Patient Anchor y de
ahí al <h1> de la consulta.

### La decisión de mecanismo, con su porqué escrito

**`document.startViewTransition` NATIVO, no `experimental.viewTransition` de
Next 16.** Se midió primero: la bandera de Next cambia TODO el runtime de
React al canal experimental empaquetado (`next/dist/compiled/react-experimental`
trae `unstable_ViewTransition`; el react estable NO) — un cambio de motor de
toda la app para pagar una coreografía viola el congelamiento funcional de
§1. El API nativo es mejora progresiva pura: sin API o bajo
`prefers-reduced-motion`, la navegación es EXACTAMENTE la de siempre (el
mismo `router.push`, el mismo crossfade del template como fallback).

### Cómo funciona (src/lib/ui/continuidad.ts, nuevo)

- `navegarConContinuidad(navegar, origen?)`: decide en JS ANTES de llamar al
  API (misma política matchMedia que `comportamientoScroll()`); pone
  `data-vt-continuidad` en <html> y `view-transition-name: nx-paciente`
  inline en el origen; la promesa del callback espera el COMMIT de la ruta;
  `finished` limpia SIEMPRE (gane, se interrumpa o falle).
- La señal de commit es el REMONTAJE de `template.tsx` (eso es lo que un
  template hace en cada navegación) → `rutaComprometida()`, con tope de
  1200ms para que una ruta lenta no congele la pantalla vieja.
- El DESTINO sólo tiene nombre DURANTE la coreografía:
  `html[data-vt-continuidad] .nx-vt-paciente { view-transition-name }` — cero
  view-transition-name en reposo (verificado por el guardián con la hoja
  descomentada), cero pares duplicados.
- Interrumpible por diseño (§20): `::view-transition { pointer-events: none }`
  — la pantalla viva sigue debajo y un segundo click navega encima.
- Papeles del sistema: raíz funde a `--mov-normal`; el objeto compartido
  VIAJA a `--mov-lento` con `--mov-curva` (papel espacial, mismo criterio que
  el cajón móvil de la 3ª rebanada).
- Encadenado gratis: en Expediente→Consulta el <h1> del ancla ya lleva
  `.nx-vt-paciente`, así que es el ORIGEN automático sin pasar `origen`.

### La cadena cableada

- **Hoy**: botón «Consulta» de la fila (origen = `.nx-ident` de ESA fila),
  CTA del héroe (click simple intercepta; Ctrl/Cmd/central conservan su
  pestaña — `esClickDeNavegacionSimple`), y la fila de continuidad («Sigue
  abierto de antes») SÓLO cuando hay paciente — sin objeto compartido no se
  coreografía (§20: no animar por decorar).
- **Expediente**: «continuar consulta sin cerrar», «Nueva consulta con IA»,
  «Crear primera nota» y abrir una nota — 4 saltos Paciente→Encuentro.
- **Destinos**: <h1> del PatientAnchor y <h1> de /consulta con
  `.nx-vt-paciente` (gancho sin una sola declaración tipográfica — los dos
  freeze de roles tipográficos se actualizaron con la razón escrita).

### §24, con dos candados

El apagador global usa `*`, que NO alcanza los pseudo-elementos de view
transition. Candado 1: JS (`puedeCoreografiar` consulta matchMedia y ni
llama al API — medido: 0 llamadas bajo reduce). Candado 2: CSS explícito
(`::view-transition-group(*)` etc. a 0.01ms bajo la preferencia).

### Guardián, probado al revés

`src/__tests__/v15-motion-continuidad-de-objeto.test.ts` (15 casos): mejora
progresiva (decide antes de llamar), el módulo NUNCA decide el destino (cero
router/href en su código), tope de espera, limpieza en finished, respeto de
modificadores, overlay sin puntero, gate del destino y cero nombres en
reposo, una voz por navegación (crossfade callado durante coreografía),
tokens en raíz/grupo, apagador §24 aparte, señal de commit en template, y la
cadena cableada de punta a punta. **Contra el árbol previo la suite entera
falla en colección** (continuidad.ts no existe — verificado con git stash).

### Verificado en navegador real (13-ago-2026)

Arnés nuevo: `scripts/design/medir-continuidad-v15.mjs` (emuladores +
siembra + build de producción). **14/14 en verde** en
`docs/design/capturas/v15-motion-continuidad/resultado.json` + capturas
antes/durante/después (1440 y 390):

- Las 4 reglas nuevas SOBREVIVEN el parseo (lección nx-stat-grid, barrido
  CSSOM; la primera versión del barrido tenía el bug de la era del nesting —
  toda CSSStyleRule tiene `cssRules`, un `if (r.cssRules) continue` se salta
  TODAS las reglas de nivel superior: 3 falsos negativos que el propio arnés
  cazó).
- Hoy→Paciente invoca el API exactamente 1 vez, el atributo está puesto al
  capturar y se LIMPIA al terminar; el objeto ATERRIZA (1 nodo
  .nx-vt-paciente en destino). Paciente→Encuentro: 1 llamada con el ancla de
  origen automático. Móvil 390: 1 llamada.
- Bajo `reducedMotion: 'reduce'`: 0 llamadas y la navegación LLEGA igual.
- Consola: 0 errores de la app.
- Lección de método del arnés: el tour de bienvenida (por uid, y el uid
  cambia con cada siembra) tapa TODA la pantalla — `login()` ahora lo
  descarta; y a las 16:29 MX no hay botón «Consulta» (citas de la mañana
  pasadas) — `saltoDesdeHoy()` cae a la fila de continuidad, que siempre
  está.

### Compuertas de esta corrida

- `npx vitest run`: **9229/9232** — el único fallo real es el PRE-EXISTENTE
  ambiental (`ops-timeout-y-punto-ciego`, proxy del contenedor); los 2
  freeze tipográficos que la rebanada movía de verdad se actualizaron con
  razón escrita y re-verificaron en verde (39/39 los tres guardianes).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (conteos de línea).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores), mismo patrón documentado.

**Siguiente tarea exacta:** `V15-MOTION-001`, quinta rebanada — **la segunda
cadena de §20: Result queue → Patient result → Source** («should preserve
spatial/contextual relationship») con el mismo mecanismo, y extender la
primera cadena a los saltos que esta rebanada declaró fuera: las filas de
/pacientes → expediente y el enlace de paciente de la franja (InstrumentStrip).
Decidir ahí si el objeto compartido de resultados es el título del resultado
o la identidad del paciente — leyendo §9 y §21 (Source Reveal) antes.
DEBT-008 sigue CONSULTADO al dueño (cierre de A11Y-001).

## `V15-MOTION-001` — quinta rebanada: la segunda cadena de §20 (Result queue → Patient result) y los saltos declarados fuera (13-ago-2026)

La tarea exacta de la cuarta rebanada, pagada entera: la cadena de
resultados coreografía, y los dos saltos que la cuarta declaró fuera
(/pacientes → expediente y el enlace de paciente de la franja) entraron a la
primera cadena.

### La decisión pedida: el objeto compartido de resultados es la IDENTIDAD

Leídos §9 y §21 antes de decidir, como pedía la nota. El objeto compartido
de Result queue → Patient result es la **identidad del paciente**, no el
título del resultado, por tres razones escritas en `continuidad.ts`: (1) el
modelo de producto (§4) — el médico piensa «el resultado de ESTE paciente
necesita mi decisión»; el QUIÉN es lo que cruza pantallas; (2) R3 ya hace de
la identidad el elemento dominante de la tarjeta de /pendientes (.nx-ident
encabeza la entrada): el objeto que viaja es el que el ojo ya tiene
agarrado; (3) el título del resultado NO tiene caja estable en el destino —
morfear hacia un elemento que puede no estar visible es animar hacia la
nada (§20: no animar por decorar). El tramo «→ Source» es Source Reveal
(§21): revelación EN el flujo, sin ruta que coreografiar.

### El fallo que la franja habría causado, cazado ANTES de cablearla

La franja (InstrumentStrip) **sobrevive a la navegación** — no se desmonta
como las filas de Hoy. Con el mecanismo de la 4ª rebanada tal cual, su
nombre inline seguiría puesto en la captura del estado NUEVO: dos elementos
llamados `nx-paciente` (franja y ancla del destino) y el navegador SALTA la
transición entera, en silencio. El arreglo vive en el callback de
`navegarConContinuidad`: tras el commit de ruta y ANTES de la captura nueva,
si el origen sigue conectado se le quita el nombre — la instantánea vieja ya
lo capturó, y el destino queda como único dueño del nombre.

Y la franja decide su origen con dos reglas escritas: si la pantalla actual
ya tiene ancla (.nx-vt-paciente: expediente o consulta), ELLA es el origen
automático — nombrar también la franja duplicaría el par en la captura
VIEJA; y ya en el expediente del paciente no se intercepta nada (misma URL →
el template no se remonta → el commit nunca llegaría y la pantalla vieja se
congelaría hasta el tope).

### La cadena cableada en esta rebanada

- **/pendientes**: la tarjeta viva Y la cerrada — el Link .nx-ident del
  paciente coreografía al expediente (click simple; Ctrl/Cmd/central
  conservan su pestaña).
- **/pacientes**: `PacienteRow` entrega el .nx-ident de la fila a `onAbrir`;
  sin origen (modal de duplicados, sin objeto compartido visible) se navega
  a secas.
- **Franja**: sus DOS variantes (topbar móvil y escritorio) coreografían el
  salto al expediente con las dos reglas de arriba.

### Guardián, probado al revés

`v15-motion-continuidad-de-objeto.test.ts` creció de 15 a 22 casos: la
limpieza del origen dentro del callback, la decisión del objeto compartido
escrita, /pendientes ×2, /pacientes (origen entregado + a-secas sin origen),
franja ×2 cableadas, cesión del origen al ancla, y el no-intercepto en la
misma ruta. **7 de 7 nuevos fallan contra el árbol previo** (verificado con
`git stash`). Tres freezes hermanos se actualizaron con la razón escrita
(el Link de /pendientes pasó a multilínea; `onAbrir` ahora recibe el
origen): `v15-a11y-pacientes-sin-nested-interactive`,
`v15-a11y-tactiles-de-enlace` y `v15-roles-tipograficos-en-pendientes` —
rol, destino y estructura accesible no cambian.

### Verificado en navegador real (13-ago-2026)

`medir-continuidad-v15.mjs` creció de 14 a 22 casos y ahora instrumenta
`ready`: un par duplicado NO truena — el navegador salta la transición en
silencio (`ready` rechaza, `finished` resuelve igual), así que «la
coreografía corre» y «se salta siempre» son indistinguibles sin medirlo.
**22/22 en verde** (`docs/design/capturas/v15-motion-continuidad/`):

- Result queue→Patient result invoca el API 1 vez y **el par SE FORMÓ**
  (readyOk=true) — escritorio 1440 y móvil 390.
- /pacientes→expediente: 1 llamada (la fila entrega su .nx-ident).
- Franja desde /referencia (ruta SIN ancla): 1 llamada, **el par se formó
  con la franja VIVA de origen** (la limpieza del callback funciona) y cero
  nombres inline residuales después.
- Ya en el expediente del paciente: 0 coreografías (el no-intercepto).
- Bajo reduce: 0 llamadas y la navegación llega. Consola: 0 errores.
- Lección de método de la primera corrida: `/receta/<pac>` a secas es 404 —
  receta exige `[notaId]`; el arnés usa `/referencia/<pac>`, la ruta con
  paciente y sin ancla que sí existe sola. El comentario quedó en el arnés.

### Compuertas de esta corrida

- `npx vitest run`: 9230 pasan; único fallo real el PRE-EXISTENTE ambiental
  (`ops-timeout-y-punto-ciego`, proxy del contenedor). Guardián 22/22.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/pendientes y /pacientes
  cambiaron de líneas).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores), mismo patrón documentado.

**Siguiente tarea exacta:** `V15-PERF-001` (§43, orden 15) — empezar por
medir: presupuesto de percepción del shell (First Contentful Paint del
lienzo, coste de hidratación de las pantallas grandes de la cadena
/consulta y /expediente, peso del JS por ruta con `next build` ya lo
imprime) ANTES de tocar nada, y decidir la primera rebanada con números.
Antes de eso, si la decisión del dueño sobre DEBT-008 llegó, pagarla
(rebanada corta dimensionada en el cierre de A11Y-001). MOTION-001 queda
CERRADA: tokens en hoja e inline, cascada una-voz, apagador §24 con dos
candados, y las DOS cadenas de §20 coreografiadas y medidas.

## `V15-PERF-001` — 1ª y 2ª rebanada: medir ANTES de tocar, y el primer hallazgo pagado — el opt-in de push era el LCP de toda la cadena (13-ago-2026)

La tarea exacta de la 5ª rebanada de MOTION-001, ejecutada como pedía: MEDIR
antes de tocar, y decidir la primera rebanada con números.

### El arnés (1ª rebanada) — `scripts/design/medir-perf-v15.mjs`

Por las 5 rutas de la cadena clínica (Hoy, /pacientes, expediente, consulta,
/pendientes) × escritorio 1440 CPU 1× / móvil 390 CPU 4× (CDP), contra build
de producción + emuladores + siembra sintética, caché apagada y SIN service
worker (el SW de la PWA responde desde caché y todo transferSize da 0 — el
frío honesto se mide con la red de verdad):

- TTFB / FCP / **LCP con la IDENTIDAD del elemento** (tag + clase + padre +
  arranque del texto — un «DIV» pelón no acusa a nadie);
- cascada de hitos por MutationObserver (spinner de auth/clinic fuera,
  shell presente, texto de datos presente);
- tráfico a los emuladores por resource timing (primera petición, última);
- long tasks (buffered), peso JS/CSS transferido, nodos DOM.

Tres lecciones de método que el arnés ya carga escritas: `Next.js-hydration`
NO existe en este build (se reporta null, no se inventa — §40); Next
16/Turbopack ya no imprime peso por ruta ni escribe app-build-manifest
(el peso se mide desde el navegador, que es donde importa); y un init
script NO puede observar `document.documentElement` (aún no existe — se
observa `document`; el throw silencioso se comió los hitos de la v3 del
arnés y costó una corrida entera).

### Lo que midió el baseline (2 muestras completas, congeladas en `antes-del-optin.json`)

- El producto es RÁPIDO debajo: TTFB ~5 ms, FCP 48–244 ms, spinner de
  auth/clinic fuera a los 283–850 ms, tráfico Firestore terminado a los
  0.3–1.5 s. Cero long tasks de escritorio en 4 de 5 rutas.
- **El LCP de las DIEZ mediciones era LA MISMA COSA**: la tarjeta de
  recordatorios push («Activa notificaciones del navegador para…») —
  `setTimeout(…, 3000)` armado en el layout, pintando sobre CUALQUIER
  pantalla de la primera sesión. LCP plano de 3.2–4.2 s con el contenido ya
  pintado desde ~0.5 s. En consulta viola §8 (lo administrativo no esencial
  DESAPARECE durante el encuentro); y la primera sesión ES la prueba de 14
  días que el dueño declaró prioridad comercial.
- /consulta además carga +240 KB de JS sobre sus hermanas (734 vs ~490 KB) y
  las long tasks móviles más altas de la cadena (591–766 ms) — reproducido
  en las dos muestras. La anomalía de /pendientes de la primera pasada
  (1311 ms de long tasks en ESCRITORIO) NO reprodujo: se anota como espuria.

### El arreglo (2ª rebanada) — la tarjeta sólo se pinta en HOY

`NotificacionesPushOptIn`: `usePathname()` leído **al render** (el
componente vive en el layout y sobrevive a la navegación — mirar la ruta al
armar el temporizador pintaría la tarjeta sobre la pantalla SIGUIENTE), gate
`if (!visible || !enHoy)` que conserva EXACTA la semántica del programador
de avisos (`ProgramadorNotificaciones` se monta con permiso en cualquier
ruta — la restricción es de la TARJETA, no de los recordatorios; §42), y el
cronómetro de cortesía de 3 s se queda (no molestar al cargar — ahora
esperando en la única pantalla donde la pregunta es contextual, §15).

### Guardián, probado al revés

`src/__tests__/v15-perf-el-optin-no-asalta-la-cadena.test.ts` (5 casos):
ruta al render y NO en el efecto, gate de Hoy en el return temprano,
semántica del programador congelada, cronómetro presente, y el ANTES
congelado (10/10 mediciones con la tarjeta de LCP en
`docs/design/capturas/v15-perf/antes-del-optin.json`, inmutable — el
baseline vivo se re-mide y cambia). **Contra el árbol previo fallan los
casos 1–3** (verificado con git stash).

### Verificado en navegador real (13-ago-2026)

- `medir-perf-v15.mjs` DESPUÉS del arreglo: el LCP de la cadena clínica ES
  el contenido — el **nombre del paciente** (.nx-ident en /pacientes,
  .nx-ancla-nombre en expediente, .nx-vt-paciente en consulta, .nx-meta en
  /pendientes): escritorio 3264→**300** ms, 3512→**548**, 3448→**624**,
  3268→**272**; móvil 3572→**772**, 3668→**888**, 4096→**1304**,
  3536→**828**. Hoy conserva la tarjeta como LCP (3.3/3.6 s) **a
  propósito**: es el único contexto de la pregunta. Que el objeto que pinta
  al final sea la identidad del paciente es coherencia gratis con la
  coreografía de §20 (el nombre ya es el objeto compartido de la cadena).
- `capturar-push-optin-v15.mjs` (extendido con el caso 2b): la tarjeta
  aparece en Hoy, **NO se pinta en /pendientes** (fuera de Hoy: false),
  **vuelve al regresar a Hoy** (true), «Después» la despide y persiste tras
  recarga, táctiles 64×44/66×44/44×44, geometría sobre el BottomNav sin
  intersección, axe [], consola 0.

### Compuertas de esta corrida

- `npx vitest run`: **9243/9244** — único fallo el PRE-EXISTENTE ambiental
  (`ops-timeout-y-punto-ciego`, proxy del contenedor). Guardián nuevo 5/5.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (80 pantallas, sin cambios).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores), mismo patrón documentado. Lección operativa nueva: detener
  un `emulators:exec` a la mitad deja HUÉRFANOS al emulador Java (:8080) y a
  next-server (:3000) — matarlos ANTES de relanzar, y un `pkill -f firebase`
  se mata a sí mismo (el patrón matchea la línea de comando propia).

**Siguiente tarea exacta:** `V15-PERF-001`, tercera rebanada — **/consulta:
atribuir y cortar el excedente de +240 KB** (734 vs ~490 KB de sus hermanas)
y sus long tasks móviles (591–766 ms, las más altas de la cadena). Empezar
con `ANALYZE=true npm run build` (el bundle analyzer ya está cableado en
next.config.ts) para atribuir el excedente ANTES de cortar; candidatos
obvios: los paneles condicionales aún estáticos del page.tsx de 6129 líneas
(RevisionPanel, AntesDeFirmar, HojaParaElPaciente, PanelRazonamiento,
Copiloto, PanelLaboratorios, CobrarModal, HistorialVersiones ya tienen
hermanos dynamic() en el mismo archivo — el patrón existe). Después
re-medir con `medir-perf-v15.mjs` y comparar contra el baseline vivo.
Curiosidad anotada, no bloqueante: movil/pacientes reporta a veces el LCP
con elemento null (entrada sin element — nodo removido). DEBT-008 sigue
CONSULTADO al dueño (cierre de A11Y-001).

## `V15-PERF-001` — 3ª rebanada: /consulta deja de pagar los paneles que no abre (13-ago-2026)

La tarea exacta de la 2ª rebanada, pagada con una lección de método antes de
empezar: **`ANALYZE=true npm run build` está muerto en este repositorio** —
@next/bundle-analyzer es un plugin de webpack y Next 16 compila con
Turbopack, que lo ignora EN SILENCIO (build verde, cero reporte, nada en
.next/analyze). La atribución honesta se hizo donde importa: en el navegador,
con `scripts/design/atribuir-js-consulta-v15.mjs` (nuevo) — se registran los
chunks que cada ruta de verdad transfiere y el excedente ES el diff de
/consulta contra /expediente.

### Lo que acusó la atribución (ANTES, congelado en `atribucion-consulta-antes.json`)

- 7 chunks exclusivos de /consulta, **746 KB de cuerpo** (734 KB de
  transferSize del baseline; hermanas 484–527).
- Dentro: código compilado de paneles con condición real de montaje que una
  consulta típica NUNCA monta — la valoración inmuno con todo
  `src/lib/inmuno` (~108 KB de fuente), las escalas preoperatorias, el modal
  de cobro, el panel de laboratorios plegado, y revisión/NER que sólo existen
  DESPUÉS de que la IA procesó un dictado. El archivo ya tenía el patrón
  (PanelPediatria y 7 más van con dynamic() desde antes): seis se quedaron
  fuera cuando se cablearon.

### El arreglo — seis paneles condicionales a `dynamic()`, y CUÁLES NO

`PreopAssessment` (sólo `esPreoperatoria`), `ValoracionInmuno` (sólo
`esInmuno`), `CobrarModal` (sólo con el modal abierto), `PanelLaboratorios`
(sólo con la herramienta desplegada — `Herramientas` monta `contenido` al
abrir), `RevisionPanel` y `NerPanel` (sólo tras extracción/NER). Los dos
casts `Parameters<typeof RevisionPanel>[0]` pasaron a
`ComponentProps<typeof RevisionPanel>` (Parameters no acepta ComponentType).

**La decisión escrita en el código**: los siempre-montados (Copiloto,
AntesDeFirmar, HojaParaElPaciente, HistorialVersiones) se quedan ESTÁTICOS a
propósito — diferirlos no ahorra transferencia, la mueve unos milisegundos
después y añade una petición en cascada.

### Guardián, probado al revés

`v15-perf-consulta-no-paga-paneles-que-no-abre.test.ts` (4 casos): los seis
con dynamic()+ssr:false, ningún import estático residual (de NerPanel sólo
tipos), los siempre-montados estáticos CON la razón escrita, y el ANTES
congelado e inmutable. **Contra el árbol previo fallan los casos 1–3**
(verificado con git stash). Lección pagada en la corrida: el archivo vivo
(`atribucion-consulta.json`) lo sobrescribe cada re-corrida — el ANTES vive
en `-antes.json`, reconstruido de la consola de la primera corrida.

### Verificado en navegador real (13-ago-2026)

- `medir-perf-v15.mjs` (baseline vivo re-medido): /consulta **734 → 691 KB**
  transferidos (−43 KB; el cuerpo del excedente exclusivo bajó 746 → 605 KB).
  El LCP de la cadena clínica sigue siendo la IDENTIDAD del paciente
  (escritorio 964 ms, móvil 2040 en esta muestra); Hoy conserva su tarjeta a
  propósito.
- `atribuir-js-consulta-v15.mjs` DESPUÉS: el chunk mayor bajó 324 → 219 KB.
- `verificar-paneles-diferidos-v15.mjs` (nuevo, equivalencia funcional §42 —
  «el dato tiene que LLEGAR» en versión UI): **PASA** — carga inicial con 0
  errores de consola, y al abrir «Laboratorios» el panel LLEGA (expandido,
  con contenido) con **+1 chunk pedido al abrir**, no al cargar.
- Long tasks móviles: 940 ms en esta muestra (baseline 591–766) — la
  varianza entre corridas es alta y UNA muestra no decide; queda anotado
  para la 4ª rebanada.

### Compuertas de esta corrida

- `npx vitest run`: **9246/9248** — el fallo real es el PRE-EXISTENTE
  ambiental (`ops-timeout-y-punto-ciego`, proxy del contenedor); el segundo
  (`el-inventario-de-pantallas-no-miente`) fue una carrera con la
  regeneración del inventario a mitad de suite y re-verificó **5/5 en
  verde**. Guardián nuevo 4/4.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio.
- `docs/design/SCREEN_INVENTORY.md`: regenerado (/consulta cambió de líneas).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores). Lección operativa REPETIDA y pagada: `pkill -f next-server`
  desde la línea de comandos del propio arnés SE MATA A SÍ MISMO (el patrón
  matchea la propia línea de comando; exit 144) — el patrón inmune es
  `pkill -f 'next-serve[r]'`.

**Siguiente tarea exacta:** `V15-PERF-001`, cuarta rebanada — **decidir el
cierre de PERF-001 con números, no con una muestra**: (a) re-medir el
baseline vivo 2 veces más para juzgar la varianza de las long tasks móviles
de /consulta (591–940 ms entre muestras); (b) si sostienen >500 ms, el
sospechoso es la hidratación del monolito (page.tsx de 6146 líneas — los
~200 KB de excedente restante que ya no son paneles condicionales):
candidatos con condición real, diferir la maquinaria de dictado hasta que
se pulse `EmpezarAGrabar` o partir la vista de nota YA FIRMADA (sólo
lectura); (c) si no sostienen, declarar PERF-001 CERRADA (opt-in fuera de
la cadena + 6 paneles diferidos + arnés de atribución permanente) y seguir
con `V15-ORIGINALITY-REDTEAM-001` (§43, orden 16). DEBT-008 sigue
CONSULTADO al dueño (cierre de A11Y-001).

## `V15-PERF-001` — 4ª rebanada: el veredicto de varianza, y el dictado que se carga al dictar (13-ago-2026)

La tarea exacta de la 3ª rebanada, pagada en su orden: primero los números,
después el corte.

### (a) La varianza, medida — las long tasks SÍ sostienen

Dos muestras más del baseline vivo (contenedor fresco, build de producción,
emuladores + siembra): /consulta móvil marcó **964** y **951 ms** de long
tasks. La serie completa queda 591 / 766 / 940 / 964 / 951 — sostenida MUY
por encima del umbral de 500 que fijó la 3ª, y consistentemente ~2× sus
hermanas (expediente 379–448 en las mismas corridas). El caso (b) del plan
era el vigente: cortar la hidratación del monolito por su candidato con
condición real.

### (b) El corte — la maquinaria de dictado carga cuando se dicta

La atribución señaló el chunk exclusivo de ~140 KB con `useGrabacionAudio` +
todo `lib/asr`. El grep confirmó DOS imports estáticos de
`@/lib/asr/pipeline` (léxico, normalización, corrector vigilado, guardián,
siglas): `useGrabacionAudio` y `useGrabacionVoz`. Ninguna de sus llamadas
ocurre al montar — todas viven después de que una transcripción volvió de la
red (o de un final del reconocedor). El import pasó a dinámico CACHEADO a
nivel de módulo en los dos hooks:

- **useGrabacionAudio**: `iniciar()` PRECALIENTA (`void cargarPipeline()`,
  sin retrasar el permiso de micrófono); `corregirUtterances` y `aplicar`
  son async y esperan el módulo; los dos caminos (detener y recuperación)
  y el parcial en vivo (flushChunks) esperan igual. Las cadenas exactas que
  vigilan los guardianes hermanos —
  `setCambiosCifras(cambiosVisibles(r.cambiosNormalizacion, r.cambiosSiglas))`
  ×2 y `dudaEnZonaCritica(utterancesRef.current, UNIDADES_CANONICAS)` —
  no se movieron un carácter.
- **useGrabacionVoz**: su `onresult` es SÍNCRONO y no puede esperar a nadie,
  así que `iniciar()` espera el módulo ANTES de `rec.start()`: ningún final
  se acumula sin corrector. Si el módulo no llega (sin red), la grabación no
  arranca — el reconocedor de Chrome tampoco vive sin red, y arrancar sin
  corrector escribiría texto que el pipeline nunca vigiló.

Se difiere el CUÁNDO se carga, jamás el SI se corre (REG-170).

### Guardián, probado al revés

`src/__tests__/v15-perf-el-dictado-no-carga-hasta-hablar.test.ts` (5 casos):
sin import estático en ninguno de los dos hooks, carga dinámica cacheada en
los dos, precalentado dentro de `iniciar()` (posición verificada), espera de
voz ANTES de `new SR()` con su catch de no-arrancar, y la pareja de
`corregirUtterances` + el corrector por final en vivo (el SI se corre).
**Contra el árbol previo fallan los 5** (verificado con git stash).

### Verificado en navegador real (13-ago-2026) — con micrófono sintético

`scripts/design/verificar-dictado-diferido-v15.mjs` (nuevo, hermano de
`verificar-paneles-diferidos`): en este contenedor
`--use-fake-device-for-media-capture` NO materializa dispositivo alguno
(`enumerateDevices()` VACÍO, NotFoundError; también con
`--use-file-for-fake-audio-capture` y con el headless shell — medido antes
de tocar nada). El arnés — sólo el arnés — sustituye `getUserMedia` por un
stream REAL de Web Audio (oscilador → MediaStreamDestination): MediaRecorder
graba de verdad y el medidor RMS analiza de verdad (tanto, que marca «El
micrófono está saturando» con el tono a 12 000 de amplitud — la maquinaria
entera corre). El veredicto (`dictado-diferido.json`): **PASA** —

- carga inicial de /consulta: 74 .js y el marcador del guardián
  («dicen cosas opuestas del paciente», literal de runtime que sólo vive en
  `guardian-sustituciones`) **AUSENTE** de todos;
- pulsar «Grabar la consulta» + consentimiento: la grabación **ARRANCA**
  (Escuchando, 00:02, Pausar/Terminar visibles) y llega **+1 chunk CON el
  marcador** — el precalentado pidió el pipeline en el momento pactado;
- 0 errores de consola.

Dos lecciones de método pagadas: el estado grabando no se anuncia con texto
(MientrasHablas es un instrumento de aria-labels — la sonda mira
Pausar/Terminar/Reanudar), y el diagnóstico de un arranque fallido se lee de
la PANTALLA (el hook pinta su error: «No se detectó micrófono…» fue la pista
que llevó al micrófono sintético).

### Lo que movió, medido — y lo que NO

- `atribuir-js-consulta-v15.mjs`: el chunk del dictado eager 140 → 103 KB
  (el pipeline, ~35-40 KB minificados, viaja ahora en su propio chunk al
  grabar); excedente exclusivo 605 → 590 KB de cuerpo.
- `medir-perf-v15.mjs` (baseline vivo): /consulta 691 → 686 KB transferidos;
  long tasks móviles **867 ms** en esta muestra — mejor que 951/964 pero
  dentro del ruido de la serie. **El corte es correcto y el contrato quedó
  sellado, pero NO resuelve el monolito**: los ~200 KB restantes del
  excedente (chunk de página de 219 KB + 103 KB del resto de la maquinaria
  de grabación eager + herramientas) son el sospechoso vigente.
- El LCP de la cadena sigue siendo la IDENTIDAD del paciente en todas las
  rutas (Hoy conserva su tarjeta a propósito).

### Compuertas de esta corrida

- `npx vitest run`: **9252/9253** — único fallo el PRE-EXISTENTE ambiental
  (`ops-timeout-y-punto-ciego`, proxy del contenedor). Guardián nuevo 5/5;
  hermanos del dictado 99/99 verificados aparte.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio. `npm run build`: compila limpio.
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (8 variables +
  emuladores). Lección operativa REPETIDA: el pkill inmune necesita el
  corchete en TODOS los patrones (`firestore-emulato[r]` — un patrón sin
  corchete en el MISMO comando se mata a sí mismo, exit 144).

**Siguiente tarea exacta:** `V15-PERF-001`, quinta rebanada — el monolito
mismo: (a) atribuir el chunk de página de 219 KB y el de 103 KB restante de
la maquinaria eager (`atribuir-js-consulta-v15.mjs` ya los separa; falta
nombrar qué módulos viven dentro — extender `acusarModulos` con marcadores
de runtime, los de path no sobreviven a Turbopack); (b) decidir con esos
nombres entre: extraer la maquinaria de grabación a un componente
mount-on-demand (los 226 usos de `audio.*`/`voz.*` entre las líneas
426–6130 hacen esto una rebanada GRANDE — dimensionarla antes), partir la
vista de nota YA FIRMADA, o declarar el excedente restante estructural del
monolito y cerrar PERF-001 con los números en la mano (opt-in + 6 paneles +
pipeline de dictado diferidos; serie de long tasks 591→867 con el corte
descrito y el resto anotado como deuda dimensionada de
`V15-NOTE-PLAN-CONTINUITY`/refactor del monolito). DEBT-008 sigue
CONSULTADO al dueño (cierre de A11Y-001).

## `V15-PERF-001` — 5ª rebanada: el excedente NOMBRADO, la hipótesis refutada, y el cierre con números (13-ago-2026)

La tarea exacta de la 4ª, pagada en su orden: (a) nombrar qué vive dentro
del chunk de página (219 KB) y del de «la maquinaria de grabación eager»
(103 KB); (b) decidir el cierre con esos nombres.

### (a) Marcadores de RUNTIME — el fingerprinting que sobrevive a la minificación

Los marcadores de path ("[project]/…") no sobreviven en esos dos chunks.
Lo que sí sobrevive son los LITERALES de cadena. La atribución ganó una
segunda pasada (`scripts/design/lib/marcadores-runtime.mjs`, importada por
`atribuir-js-consulta-v15.mjs`): cada candidato (62: la página + todos sus
imports de runtime) se fingerprintea con sus 12 literales más distintivos
leídos de su PROPIA fuente al correr, y un chunk lo acusa con ≥2 golpes
(≥1 si el candidato sólo tiene 1-2). Dos hoyos tapados con lección medida:

- **los comentarios no fingerprintean** — el top-12 de medical-vocabulary
  eran ejemplos de JSDoc que no viajan al build y el módulo salía «ausente»
  estando presente; los comentarios se quitan ANTES de extraer;
- **los pseudo-literales de JSX fuera** — fragmentos entre dos comillas con
  {}, =>, fontSize… jamás sobreviven y sólo queman presupuesto; y lo
  no-ASCII se busca crudo Y en su forma \uXXXX.

Caveat documentado en el módulo: Turbopack sacude exports no usados — un
MISS de marcador nombra lo que NO viaja, no exonera al módulo (los prompts
de sesgo de medical-vocabulary viajan con el pipeline diferido, no en el
chunk eager; la presencia del módulo se confirmó con 3 literales del corpus
grepeados en las dos direcciones).

### El excedente de /consulta, chunk por chunk (590 KB de cuerpo, TODO nombrado)

- **219 KB** — la PÁGINA misma (12/12) + sus compañeros siempre-necesarios:
  proa, nom004, HistorialVersiones, CierreAlPulgar, CorreccionesPanel,
  herramientas-por-especialidad, templates, duracion-cumplida,
  AntesDeFirmar, experienciador, reconciliación, useComandoVoz,
  usePorcupineComando, EmpezarAGrabar, MientrasHablas…
- **140 KB** — pediatria + calculadoras + integrity (12/12 cada uno) +
  CambiosCifrasPanel + Cie10Autocomplete + politica-critica +
  especialidad-del-medico + tareas-clinicas.
- **103 KB** — medical-dictionary (10/12) + medical-vocabulary
  (subconjunto vivo: catálogos, corrector conservador, expansiones de
  siglas — confirmado por grep bidireccional de su corpus). Es el cerebro
  de las validaciones EN RENDER: alergia×medicamento y PROA.
- **56 KB** — copiloto + razonamiento (12/12 cada uno) + Copiloto +
  PanelRazonamiento — estáticos A PROPÓSITO desde la 3ª rebanada.
- **32 KB** — cardiometabólico (masld/obesidad/dislipidemia — texto de guía
  confirmado por grep) + dosis.
- **19 KB** — farmacovigilancia (12/12) + alergias. **19 KB** —
  useGrabacionAudio (10/12). **3 KB** — misceláneo.

### (b) La hipótesis REFUTADA, y la decisión

La 4ª rebanada dejó escrito «103 KB del resto de la maquinaria de grabación
eager». **Falso**: el hook de grabación entero pesa 19 KB — el pipeline ya
se difirió y lo que queda es el cascarón. Los 103 KB son el DICCIONARIO.
Sin este nombramiento, la siguiente rebanada habría recortado el módulo
equivocado.

Con los nombres en la mano, el corte que queda no existe como rebanada PERF:

- el diccionario alimenta validaciones de seguridad que corren AL RENDER
  (alergia×medicamento, PROA, interacciones) — diferirlo cambia el CUÁNDO
  de un aviso clínico y un fallo de red lo dejaría sin correr (la regla es
  diferir el cuándo, JAMÁS el si — y aquí el cuándo ES clínico);
- pediatria/calculadoras/integrity corren al render (vacunas atrasadas,
  calculadoras sugeridas, huella de revisión);
- el copiloto es estático por decisión sellada de la 3ª.

**PERF-001 queda CERRADA** con la opción (c) del plan de la 4ª: opt-in
fuera de la cadena clínica (LCP = identidad del paciente en toda la
cadena), 6 paneles + pipeline de dictado diferidos (734→686 KB), arnés de
atribución permanente con dos pasadas (path + runtime), y el excedente
restante declarado ESTRUCTURAL del monolito de 6147 líneas — su partición
es deuda dimensionada del refactor del monolito (V15-NOTE-PLAN-CONTINUITY
o iteración propia), no una rebanada de PERF.

### Guardián, probado al revés ×3

`v15-perf-atribucion-marcadores-runtime.test.ts` (9 casos): comentarios no
fingerprintean, pseudo-literales fuera, variante \uXXXX encontrada, umbral
de 2 golpes, marcador compartido no acusa a nadie, candidato ilegible no
tumba la tabla, y el acta congelada certifica la refutación (diccionario en
chunk >80 KB, grabación en chunk <40 KB, la página nombrada en el mayor).
**Probado al revés tres veces**: sin quitar comentarios FALLA, sin variante
escapada FALLA, con umbral 1 FALLA (verificado con sabotajes temporales).

### Compuertas de esta corrida

- `npx vitest run`: ver cifra final del reporte de la corrida (guardián
  nuevo 9/9; suite completa lanzada tras las compuertas dirigidas).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva
  (493/1970/628/22 se mantienen).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compiló limpio ESTA corrida (mismo árbol de src/ — los
  cambios de la rebanada viven en scripts/, tests y docs).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (7 variables +
  emuladores).

**Siguiente tarea exacta:** `V15-ORIGINALITY-REDTEAM-001` (§43 orden 16,
§41) — equipo rojo de originalidad INDEPENDIENTE sobre las superficies V15
estructuradas: shell (franja + FlowRail), Hoy, Patient Workspace, Encounter
Mode, Resultados/Cierre, Pendientes, más móvil. Busca: genérico-SaaS,
almacén-sidebar, tarjetas-por-defecto, shadcn-demo, IA-template, imitación
de competidor (Abridge/Suki/Nabla/Huli — principios sí, trade dress no), IA
feature-first, motion inútil, novedad sin usabilidad, diferenciación
sólo-color. Cada hallazgo válido → defecto rastreado con severidad; el
GENERIC_AI_LOOK_SCORE por pantalla se documenta con razones ESTRUCTURALES
(§29). Método sugerido: capturas reales (los arneses ya existen) + panel de
agentes con roles de §26 + veredicto consolidado en
`docs/design/` y defectos en el estado V15. DEBT-008 sigue CONSULTADO al
dueño (cierre de A11Y-001).

## `V15-ORIGINALITY-REDTEAM-001` — 1ª rebanada: la auditoría, el veredicto y la P0 pagada (13-ago-2026)

### Método (§26/§41/§29, cumplido como manda §40)

- **Evidencia primero**: arnés nuevo `scripts/design/capturar-redteam-v15.mjs`
  (hermano de los capturadores existentes, mismo login sembrado) — 27 capturas
  de las 6 superficies estructuradas (hoy, pacientes, expediente, consulta,
  pendientes, operaciones) × escritorio 1440/móvil 390 × oscuro (+claro en la
  cadena clínica de escritorio) + **variante GRIS por superficie**
  (`filter: grayscale(1)` sobre la app corriendo): la prueba de §41
  «diferenciación sólo-color» se juzga sobre la pantalla sin color, no sobre
  una opinión. En `docs/design/capturas/v15-redteam/`.
- **Panel independiente de 3 revisores** con roles de §26: equipo rojo §41
  (10 categorías), Product Design Director (scores §29 + silueta §13 +
  logo-off §28 + jerarquía §16) y Clinical Workflow Architect + Human
  Factors + Content (§15/§20/§25). El orquestador NO auditó: verificó cada
  afirmación load-bearing contra la fuente (regla de la casa: los agentes
  auditan, el orquestador verifica y escribe).
- **Veredicto consolidado**:
  `docs/design/v15/ORIGINALITY-REDTEAM-001-veredicto.md` — scores por
  superficie con razones estructurales, 21 defectos ORT-01..21 con evidencia
  verificada, señales BUSCADAS Y NO ENCONTRADAS (morado 0, shadcn 0,
  imitación de competidor refutada 3×), y el hueco de evidencia declarado
  (el encuentro GRABANDO no está fotografiado — §40 obliga a decirlo, no a
  fingir el score).

### La P0 que el equipo rojo encontró — y esta corrida REPARÓ (REG-311)

El hallazgo más valioso de la iteración no fue estético.
`PatientAnchor.tsx:45` — componente que V15 ESCRIBIÓ en Fase 4 — traía la
**séptima copia** de la regla de negación de alergias, PEOR que la que
REG-279 condenó (perdió el `\b`): «Niega penicilina. Alérgico a sulfas» (la
cadena motivadora de REG-279) salía «sin alergias» EN GRIS en el ancla
siempre-visible del expediente; «Nolotil» empieza por «no» y también;
alergia sólo-estructurada → «no registradas». Y `/consulta` tenía DOS
criterios contradictorios en el mismo viewport (franja editable: rojo con
cualquier texto, «Niega alergias» → ROJO; píldora del encabezado: prefijo,
«Niega penicilina. Alérgico a sulfas» → NEUTRO).

Reparación (dentro del carril de §1 — cromo que consume el motor sellado,
cero cambio de lógica clínica):

- `PatientAnchor.tsx`: `alergenosDe` + `negacionesEnTexto` (módulo sellado
  por REG-279) deciden; TRES estados — ROJO con los ALÉRGENOS enseñados
  (`nx-critico`), GRIS sólo con negación explícita y nada restante, y el
  hueco «no registradas» en ÁMBAR (regla 4: ausencia de dato no es dato de
  ausencia).
- `/consulta`: la franja editable pinta rojo por `alergenosDe(...)length>0`
  (no por texto truthy) y la píldora deriva del mismo criterio, enseñando
  los alérgenos en rojo — no la frase cruda que los esconde. Una píldora
  que callaba la alergia sólo-estructurada ahora la enseña.
- **Guardián probado al revés ×1 con 3 rojos**:
  `src/__tests__/reg-311-el-ancla-no-decide-la-negacion.test.ts` (9 casos):
  la decisión del ancla con las cadenas de REG-279 + «Nolotil» +
  sólo-estructuradas + «no sobreavisa» + hueco-ámbar; guardas de fuente de
  las tres piezas; y el **BARRIDO de repositorio** (src/app +
  src/components) que impide la octava copia de la familia de regex de
  prefijo. Sin el arreglo fallan 3 (verificado con git stash).
- **Ledger**: REG-311 (familia `copia_local_de_regla_sellada`); **sello**:
  4560 → 4569 casos, gate de seguridad clínica en verde (54/54 con el
  golden de REG-279).

### Los defectos que quedan (la cola de reparación de la iteración)

7 P1 abiertos — en orden de dolor clínico/estructural: ORT-06 (banner de
cobro a peso íntegro DENTRO del encuentro; nada del layout se suscribe a
EVENTO_GRABANDO), ORT-03 (destino «Encuentro» que no es un lugar), ORT-04
(el pulgar móvil corona «Nueva cita»/admin), ORT-05 (dos CTA primarios
co-iguales en Hoy — el comentario del código dice «la ÚNICA» y no lo es),
ORT-02 (grupo «CLÍNICO» dentro de Operaciones; «Consultor IA»
feature-first), ORT-07 (expediente sin Clinical Spine, 3 KPI vacías), ORT-08
(identidad rota en pacientes-móvil). Después 8 P2 y 5 P3 — todos en el
veredicto con evidencia y archivo:línea.

### Compuertas de esta corrida

- `npx vitest run` (dirigidas): REG-311 9/9, y 54/54 con
  `clinical-safety-gate` + golden REG-279. Suite completa: ver cifra final
  del reporte de la corrida.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (corrida de captura previa al arreglo;
  el build final de la corrida se relanza tras los cambios de src/).
- Contenedor fresco: `npm ci` + `.env.local` demo recreados (7 variables +
  emuladores). Lección operativa NUEVA para el arnés: en este contenedor
  Playwright no encuentra su browser descargado — el patrón de los hermanos
  (`executablePath: '/opt/pw-browsers/chromium'` si
  `PLAYWRIGHT_BROWSERS_PATH` existe) va incluido en el capturador nuevo
  desde el inicio.

**Siguiente tarea exacta:** 2ª rebanada de `V15-ORIGINALITY-REDTEAM-001` —
pagar los P1 en su orden de dolor: (a) ORT-06, el banner de cobro y la pila
de avisos del layout se aquietan al grabar (suscribirse a EVENTO_GRABANDO
igual que FlowRail — §8.5; la decisión v972 pide prueba visible, no
presencia permanente sobre la superficie clínica); (b) ORT-05, Hoy con UNA
acción primaria (la clínica) y «Nueva cita» subordinada; (c) ORT-04, la
acción del pulgar móvil respeta el contexto clínico. Cada una con su captura
antes/después y su guardián. Después ORT-03/ORT-02 (IA del riel y de
Operaciones), y ORT-07/ORT-08 que son rebanadas grandes propias. DEBT-008
sigue CONSULTADO al dueño (cierre de A11Y-001).

## `V15-ORIGINALITY-REDTEAM-001` — el panel corrió, el veredicto existe, y la primera tanda está pagada (13-ago-2026)

La tarea exacta que dejó la corrida anterior, ejecutada en su orden: equipo
rojo INDEPENDIENTE sobre la evidencia ya capturada (27 PNGs reales), con
panel §26 y lentes §41.

### Método

Cuatro revisores en paralelo, cada uno con una lente y prohibido aprobarse
solo (§26): (1) rojo genérico-SaaS/shadcn/plantilla-admin; (2) panel de
jerarquía — silueta §13, logo-off §28, menú §14, diferenciación en gris;
(3) rojo de imitación de competidor + IA feature-first §25 + motion §20;
(4) revisor móvil §22-§23. El orquestador re-verificó cada afirmación
citada antes de escribirla (grep de conteos, relectura de archivos, mirada
propia de capturas): dos afirmaciones se REBAJARON en la consolidación (el
«en gris no queda jerarquía» del rojo se contradecía con la silueta medida
del panel 2 — quedó como hallazgos puntuales RT-11/RT-12, no como P0; y
«ningún guardián mide nada» se corrigió: el trinquete de diseño sí mide
adherencia a tokens — lo que NO tiene guardián es la genericidad).

### Lo que quedó escrito

`docs/design/V15_ORIGINALITY_REDTEAM_VEREDICTO.md` — scores §29 por
superficie con las dos opiniones y el desempate razonado, la columna de
refutaciones (imitación NO, motion decorativo NO en lo principal, §14 PASS,
diferenciación estructural PASS) y el registro RT-01…RT-22 con severidad,
evidencia archivo:línea y pago exacto. Los tres hallazgos que más pesan:

- **RT-08 (P1, seguridad)**: en `continuidad.ts`, durante
  `await esperarCambioDeRuta()` (tope 1200ms) la pantalla pinta la
  instantánea VIEJA y el clic aterriza en el DOM NUEVO → desde una worklist,
  un clic a ciegas puede abrir el encuentro de OTRO paciente. Nadie lo
  había mirado: el guardián de motion sólo verifica la regla CSS de los
  pseudo-elementos.
- **RT-01 (P0, método)**: los ceros del audit de estética genérica eran
  artefactos (contaba `className` Tailwind en código inline); la
  genericidad no tiene trinquete.
- **RT-02 (P1)**: el primer viewport del expediente no contiene un solo
  dato clínico (exportación + 3 KPI-cards, 2 vacías; la historia arranca
  en el borde).

### Primera tanda pagada (código, esta corrida)

- **RT-03**: `.prox-hero` gana su `@media ≤560px` (wrap; CTA a renglón
  completo) — la identidad del héroe recupera el ancho. Verificado en
  navegador real a 390px con `capturar-heroe-movil-v15.mjs` (nuevo, mide
  cajas renderizadas y FALLA si el héroe sigue partido):
  `acta-heroe-movil.json` + `hoy-movil-heroe-despues.png`.
- **RT-05 parcial (§25)**: «Nueva consulta con IA»→«Nueva consulta»
  (expediente:272, con su guardián `expediente-cta-primero-movil.test.ts` y
  el medidor de continuidad actualizados); «Razonar con IA (infectólogo —
  Claude + GPT)»→«Interpretar el cultivo» (antibiograma:462 — la
  atribución de modelo ya vive en el panel de resultados, donde debe);
  «Claude estructurando…»→«Estructurando la nota…» (consulta ×2).
- **RT-01 parcial**: el degradado morado literal de
  `secciones-recetas.tsx:417` murió (violet 124,58,237 + teal-500 crudo →
  `var(--nexus-soft)` + `color-mix` sobre `var(--nexus)`), y su radio 12
  entra a escala (10) — un literal menos para RT-14 y RT-19 también.

### Compuertas de esta corrida

- `npx vitest run` (baseline pre-cambios): 9258 pasan, 1 falla —
  `ops-timeout-y-punto-ciego.test.ts` «el error dice cuánto esperó»:
  **artefacto del CONTENEDOR, no de la rama** — el proxy de agente de este
  entorno contesta 403 en ~43ms al IP no ruteable 10.255.255.1 que el test
  usa como agujero negro, así que la carrera de 30ms a veces la gana la
  respuesta. Verificado con curl cronometrado. En CI (sin ese proxy) el
  agujero negro cuelga y el test pasa. No se toca el test ni el helper.
- Compuerta dirigida y suite completa tras los cambios: ver cifras del
  reporte de la corrida.
- `lint-trinquete` / `trinquete-de-diseno` / `build`: ver reporte.

**Siguiente tarea exacta:** RT-08 — candado de la ventana de clic ciego
(`inert` o `pointer-events:none` sobre `<main>` durante el callback de
`startViewTransition`, tope de espera ~400ms, guardián probado al revés
×2: sin candado FALLA, con tope viejo FALLA). Después RT-01: contadores de
genericidad (gradientes / backdrop-filter / halos `rgba` de color / FABs)
en `trinquete-de-diseno.mjs` con techo sellado sólo-baja, y corregir las
cifras rotas del audit doc. El registro completo con severidades vive en
el veredicto; RT-02 (expediente) es la rebanada estructural grande que
sigue a esas dos.

## `V15-ORIGINALITY-REDTEAM-001` — registros unificados, RT-08 pagado como REG-312, RT-01 pagado con trinquete (13-ago-2026)

La tarea exacta que dejó la consolidación, ejecutada en su orden (con la
seguridad primero, §43):

### RT-08 → REG-312 (RTC-03): el candado de la ventana de clic ciego

Durante el callback de `document.startViewTransition` el navegador pinta la
instantánea VIEJA congelada pero el hit-testing corre contra el DOM NUEVO
(`navegar()` es lo primero del callback). Con el tope en 1200ms, desde una
worklist un clic sobre lo que se VE podía aterrizar en el encuentro de OTRO
paciente. El arreglo, dentro del carril §1 (cero lógica clínica):

- `continuidad.ts`: el callback pone `data-vt-congelada` en `<html>` como
  primera sentencia y lo suelta en un `finally` (commit, tope o excepción);
  `limpiar()` lleva el cinturón. `TOPE_ESPERA_MS` 1200→400: una ruta más
  lenta pierde el morph (crossfade de siempre), no la seguridad.
- `globals.css`: `html[data-vt-congelada] body { pointer-events: none; }` —
  el candado dura lo que el callback; la fase de animación no lo lleva (ahí
  el overlay ya enseña el estado nuevo y §20 exige interrumpible).
- **Guardián** `rt-08-ventana-de-clic-ciego.test.ts` (6 casos): BEHAVIORAL
  — DOM de mentira con el contrato exacto del API (el stub ejecuta el
  callback como el navegador real), fake timers para el tope, y lectura de
  hoja/módulo. **Probado al revés ×2** (git stash / sed del tope): sin el
  candado fallan 5; con el tope viejo fallan 2 — incluido el caso de
  temporizador, que no es lectura de fuente.
- **Ledger REG-312** (familia `se_contradice` — lo que se pinta y lo que
  recibe el clic afirman cosas incompatibles); **sello** 4569→4575.
- **Navegador real** (§40): `medir-continuidad-v15.mjs` extendido — el
  wrapper del arnés envuelve el callback y mira el atributo JUSTO al
  arrancarlo (observa la ventana real, no una simulación) + regla parseada
  + candado suelto al terminar. **25/25 en verde** contra build de
  producción + emuladores + siembra: toda la cadena §20 (Hoy→Encuentro,
  Paciente→Encuentro, Result queue→Patient result, /pacientes, franja,
  reduced-motion, móvil 390) sigue coreografiando con el tope de 400ms —
  equivalencia funcional MEDIDA. Acta:
  `docs/design/capturas/v15-motion-continuidad/resultado.json`.

### RT-01 → contadores de genericidad (RTC-02)

La vara vieja contaba clases Tailwind en código 88,5 % inline: ceros de
método. Ahora `trinquete-de-diseno.mjs` mide el VALOR CSS viva donde viva
(TSX + `globals.css` — sólo para genericidad; la deuda de tokens sigue sin
mirar la hoja, que es donde los literales deben vivir):

- `gradientes` = 16 · `cristal` = 16 · `halosDeColor` = 9 (rgba con croma
  DENTRO de una declaración de sombra; las neutras las cuenta
  `sombrasEnLinea`). Techos sellados en `techos-de-diseno.json`, sólo-baja,
  sin holgura (el guardián de exactitud lo exige).
- **Probado al revés**: un TSX con degradado + halo violeta + backdrop pone
  en rojo los tres contadores (y exit 1); restaurado, verde.
- `GENERIC_AI_AESTHETIC_AUDIT.md`: corrección del 13-ago escrita encima de
  la tabla rota — que queda como acta del error de método, con las cifras
  honestas al lado.

### Unificación de registros (la rebanada 1 de la consolidación)

`docs/design/v15/V15-REDTEAM-REGISTRO-CANONICO.md` — RTC-01..28. El mapeo
fue por CONTENIDO: los paréntesis de los ORT (RT-xx/DS-xx/CW-xx) citaban los
informes internos del panel A, NO los RT del panel B — la coincidencia de
prefijo era una trampa. Fusiones principales: ORT-05+RT-11→RTC-06,
ORT-04+RT-11móvil→RTC-07, ORT-03+RT-04→RTC-08, ORT-02+RT-09→RTC-09,
ORT-07+RT-02→RTC-10, RT-10+ORT-11→RTC-14, ORT-13+RT-12→RTC-17. Severidad
reconciliada con el dolor clínico primero (ORT-14+RT-06 suben a P1 juntas
como RTC-05). Los dos veredictos quedan como actas con nota.

### Compuertas de esta corrida

- `npx vitest run` (suite completa): 9267 pasan; 7 fallos triados — 5 eran
  colaterales de REG-312/sello y quedaron PAGADOS (familias, tablero, sala
  de datos ×3, re-corridos en verde); `la-agenda-es-un-riel` fue timeout de
  carga de la suite completa (12/12 en corrida dirigida); y
  `ops-timeout-y-punto-ciego` es el artefacto CONOCIDO del proxy del
  contenedor (documentado la corrida anterior; en CI pasa).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: verde con los TRES
  contadores nuevos sellados (16/16/9).
- `npx tsc --noEmit`: limpio. `npm run build`: compila (162 páginas, con
  `.env.local` demo de 7 variables recreado — receta de la quinta rebanada).
- Contenedor fresco: `npm ci` recreado; Playwright vía
  `/opt/pw-browsers/chromium` (patrón de los hermanos).

**Siguiente tarea exacta:** pagar los P1 del registro canónico en su orden
de dolor: (a) RTC-04 — el banner de cobro y la pila de avisos del layout se
aquietan al grabar (suscripción a `EVENTO_GRABANDO` igual que FlowRail,
§8.5; la decisión v972 pide prueba visible, no presencia permanente sobre
la superficie clínica); (b) RTC-06 — Hoy con UNA acción primaria clínica
(«Nueva cita» subordinada, saludo a kicker, sólo la cita inminente con
relleno); (c) RTC-07 — la acción del pulgar móvil respeta el contexto
clínico. Cada una con captura antes/después y su guardián. El hueco de
evidencia (encuentro GRABANDO sin fotografiar) sigue declarado para el
siguiente paquete de capturas.

---

## V15-ORIGINALITY-REDTEAM-001 — RTC-07 + RTC-05 (13-ago-2026, 3ª corrida)

**Qué se pagó:** los dos P1 que la 2ª corrida dejó como siguiente rebanada.

### RTC-07 — la corona del pulgar es clínica

- `centralCoronada(kind)` en `BottomNav.tsx` (puro, exportado, testeado):
  la CORONA (círculo relleno elevado, §8.6) sólo con `kind === 'consulta'`
  — la consulta de ESE paciente. Sin corona, «Nueva cita» conserva
  posición, href y táctil ≥44 (equivalencia funcional: `accionContextual`
  intacta, byte a byte) pero pesa como destino normal y se aquieta al
  grabar con la MISMA función que los destinos:
  `iconoAtenuado(quieto, coronada)`.
- Alcance: `const coronada = navPrimaria ? centralCoronada(...) : true` —
  la barra heredada de Secretaria conserva su corona: para ella «Nueva
  cita» ES el trabajo primario, no un intruso admin (mismo alcance que ya
  tenía `quieto`).
- `.hoy-accion` con `display:none` ≤768px: el header de Hoy ya no duplica
  la acción del pulgar en el primer viewport móvil (era la mitad del
  hallazgo ORT-04: énfasis máximo 2×).

### RTC-05 — los FAB se aquietan y salen del arco del pulgar

- `useGrabando` consumido por `BotonAyuda` Y `ThemeToggle` (`if (grabando)
  return null`) — medido en navegador ida y vuelta: desaparecen al grabar,
  VUELVEN al detener, en los dos viewports.
- Móvil: FAB de ayuda muerto (`display:none !important` — el FAB declara
  `display:flex` EN LÍNEA y la primera pasada del arnés lo cazó flotando:
  una regla de hoja sin peso pierde contra un estilo en línea); el trigger
  es un botón estático de la topbar (44×44) que despacha
  `EVENTO_ABRIR_AYUDA` (exportado por BotonAyuda, importado por el layout;
  gateado por `useGrabando` en `AyudaTopbarTrigger` para no pintar un botón
  muerto). El panel cuelga bajo la topbar en móvil.
- Tema: `@/hooks/useTema` es la única casa de la llave `nexusmed.theme`
  (el guardián de marca `renombrar-la-marca-no-borra-el-audio` apunta a la
  casa nueva), con sincronía entre vistas por `nx:tema`. El toggle flotante
  queda sólo en escritorio (y fuera del shell en móvil — login/marketing lo
  conservan: ahí no hay columna clínica); en el shell móvil el tema vive en
  la fila «Apariencia» de /operaciones (`TemaSection`, 44px táctil).
- Genericidad a la baja: cristal 16→14 (el toggle era el único
  glassmorphism del cromo persistente), halosDeColor 9→8 (el halo teal del
  FAB → `var(--elev-2)`); techos re-sellados con `--actualizar`.
- Guardianes ajustados con intención (no callados): el caso 5 de
  `v15-a11y-chat-contraste-y-widgets` exigía el parche móvil de 136px —
  ahora exige la regla que hace IMPOSIBLE la colisión (el toggle no existe
  en el shell móvil); el caso 3 acepta ≥1 hoja con tamaño (todas 44).

### Compuertas de esta corrida

- Guardianes nuevos: `v15-rtc07-accion-del-pulgar-clinica.test.ts` (5
  casos, al revés: 4 rojos — el 5º es la equivalencia de accionContextual,
  que DEBE pasar en los dos árboles) y `v15-rtc05-fabs-quietos.test.ts`
  (6 casos, al revés: 6 rojos).
- `npx vitest run` completa: 9297 pasan, 2 fallos triados — el inventario
  de pantallas (regenerado: /operaciones creció 36 líneas; re-corrido en
  verde) y `ops-timeout-y-punto-ciego` (artefacto CONOCIDO del proxy del
  contenedor, confirmado pre-existente con `git stash`: falla igual en el
  árbol limpio).
- `node scripts/lint-trinquete.mjs`: 96 = techo. Trinquete de diseño:
  verde con techos 16/14/8.
- `npm run build`: compila (la 1ª pasada falló por el contenedor fresco sin
  `.env.local` demo — recreado con la receta de 7+2 variables, gitignorado).
- Navegador real (§40): `capturar-pulgar-y-fabs-v15.mjs` dentro de
  `emulators:exec` + siembra + `next start` con guardia de puerto — 24
  condiciones medidas con getComputedStyle y `nx:grabando` despachado de
  verdad; acta y 8 capturas en `docs/design/capturas/v15-pulgar-y-fabs/`.
  PASS con 0 errores de consola. El «antes» es el paquete del equipo rojo
  (v15-redteam/hoy-movil*.png).

---

## INS-01 — el gate del PR medía producción, no el PR (14-ago, 4ª corrida)

**No es una rebanada de V15: es el instrumento que juzga a V15.** El job
`e2e-publico` llevaba muchos commits en rojo por un caso —`/operaciones`
sin `X-Frame-Options`— que no dice nada de la rama.

- **Diagnóstico.** El grupo A3 de `e2e/seguridad.spec.ts` recorre
  `RUTAS_PRIVADAS`, que es una lista **del árbol de este checkout**, y
  comprobaba las cabeceras contra **producción**. V15 añadió `/operaciones`
  al dashboard (commit `526a893a`); desde entonces el caso le preguntaba al
  sitio vivo por una ruta que sólo existe en el código del PR. Instrumento y
  sujeto salían de sitios distintos.
- **Mirado por los dos lados antes de tocar nada**: el mismo job estaba rojo
  en el commit anterior (RTC-17, que no toca rutas), y
  `curl -I localhost:3000/operaciones` sobre el build de la rama devuelve
  `X-Frame-Options: DENY`. La cabecera está bien; lo que falta es el
  despliegue, que es decisión del dueño.
- **Arreglo.** El job construye el PR y mide **ese** build
  (`PLAYWRIGHT_LOCAL=1` + localhost, camino que ya existía en
  `playwright.config.ts` y en `npm run e2e:seguridad`). Medido ANTES de
  cambiar el YAML: los 67 casos —incluidos B1 (violaciones de CSP en
  navegador real), B2 y C1— pasan contra el build local **sin credenciales
  de Firebase**.
- **Lo que se pierde, declarado y mudado, no borrado**: entre despliegues
  nada en CI vigila ya las cabeceras del sitio vivo. `npm run
  e2e:seguridad:prod` pasa al ciclo de despliegue de
  `.claude/rules/deployment-and-flags.md`, justo después de publicar, que es
  donde ese rojo sí es accionable.
- **Guardián** `el-gate-mide-el-artefacto-que-revisa.test.ts` (4 casos,
  probado al revés ×3: sin `PLAYWRIGHT_LOCAL` cae el 1, sin el `npm run
  build` previo cae el 2, borrando la invocación de producción cae el 3).
- **Compuertas**: `npx tsc --noEmit` limpio · `npx vitest run` 9414/9414 en
  666 archivos · lint 96 = techo · trinquete de diseño sin deuda nueva ·
  `npm run build` compila.

Regla que deja: **un gate que sólo se puede poner en verde con una acción
que el agente no puede tomar —desplegar— deja de proteger.** Misma familia
que RTC-02 (la vara rota). Registrado como INS-01 en el registro canónico.

---

## RTC-21 — medir refutó la mitad del pago, y destapó REG-313 (14-ago)

**Lo que se midió antes de construir nada**
(`scripts/design/medir-rtc21-exportar-v15.mjs`, acta y capturas en
`docs/design/capturas/v15-rtc21-exportar/`):

|            | controles | bajo 44px | tras la historia | empieza en |
|---|---|---|---|---|
| escritorio | 3 | 0 | sí | 820px |
| móvil 390  | 3 | 0 | sí | 1105px |

- **La hoja «Compartir y exportar» NO se construyó, y es la decisión.** RTC-10
  ya había bajado el bloque al pie; los tres controles se apilan a ancho
  completo con 45px de táctil y cada exportación cuesta **un** gesto. La hoja
  habría costado **dos** y habría escondido al pie de una pantalla lo que ya
  estaba al pie de una pantalla. Tercera vez en la corrida que medir evita
  repintar (filtros de `/pacientes`, píldoras del expediente).
- **Lo que sí se pagó**: «FHIR» → **«Enviar a otro sistema»**, con `FHIR R4` en
  segunda línea. La sigla **no se borra**: cuando otro hospital la pide por su
  nombre, el médico tiene que encontrarla. Y la diferencia entre los dos
  archivos sube a una línea bajo el rótulo — se decía sólo en el aviso
  POSTERIOR a la descarga, y elegir es una decisión previa.
- **Defecto que encontró el propio arnés, después del cambio**: las dos líneas
  del botón se leían pegadas («Enviar a otro sistemaFHIR R4»). `aria-label`
  explícito. Noveno defecto de instrumento/accesibilidad cazado midiendo.

### REG-313 — el hallazgo que no era de diseño

Al consolidar el manejador aparecieron **dos `toast()` por una sola descarga
que se contradecían sobre el mismo archivo**: uno decía que los borradores
viajan «marcados como preliminares» y el otro que «NO van en FHIR — usa
Expediente completo». Mirado del otro lado (`src/lib/fhir-export.ts`, bucle
`notas.filter(n => n.estado !== 'firmada')`), **los borradores SÍ van**, como
`Composition.status: 'preliminary'`. El aviso falso era el último en pintarse
— el que se lee.

Coste real: el médico creía que el archivo que mandaba a otra institución no
llevaba nada sin firmar. Lo llevaba. Y de propina se le mandaba a exportar el
expediente completo para incluir algo que ya estaba dentro.

Y lo peor: **tres guardianes protegían la mentira** porque fijaban literales de
la frase (`'NO van en FHIR'`, el recuento a mano) en vez de la conducta. Los
tres se corrigieron con su porqué escrito dentro, conservando la intención.

### Compuertas

- Guardián `v15-rtc21-exportar-dice-el-trabajo.test.ts` (7 casos, probado al
  revés ×4), **sellado** en `invariantes-clinicos.json` (4575 → 4582). Su caso
  6 llama a `exportarPacienteAFhir` y ata la promesa de la pantalla a lo que el
  exportador hace.
- Colaterales del ledger: `familias-de-defecto.ts` (313 → `se_contradice`),
  `FAMILIAS-DE-DEFECTO.md` (31 de 161), sala de datos y tablero regenerados,
  inventario de pantallas regenerado.
- `npx tsc --noEmit` limpio · `npx vitest run` 9420/9421 (el único rojo es
  `ops-timeout-y-punto-ciego`, artefacto CONOCIDO del proxy del contenedor —
  reconfirmado con `git stash`: falla igual en el árbol limpio) · lint 96 =
  techo · trinquete de diseño sin deuda nueva · `npm run build` compila.
- Navegador real (§40), antes y después, escritorio + móvil, **0 errores de
  consola**.

---

## RTC-20 — la vara del riel medía mudanza (14-ago)

**El producto no se tocó, y ése es el resultado.** El riel ya cumplía §14; lo
que faltaba era poder demostrarlo. ORT-16 lo vio leyendo los guardianes en vez
de la pantalla.

**Medido, inyectando defectos a la vara vieja:**

| defecto inyectado | vara vieja | vara nueva |
|---|---|---|
| `/farmacia` sube al riel (6 enlaces) | ROJA (cuenta 6) | ROJA (casos 1 y 3) |
| 6 destinos en bucle, UN nodo JSX | **VERDE** | ROJA (caso 1) |

La segunda fila es el hallazgo: **el caso de conteo pasaba con seis destinos en
el riel**, porque contaba etiquetas. (La otra prueba se puso roja, pero por su
caso de reachability y por otra queja — dejaba de *ver* rutas literales —, que
se habría callado si esas rutas siguieran listadas en otro sitio.)

**Lo que mide el guardián nuevo** (`v15-rtc20-el-riel-redujo-no-solo-mudo.test.ts`, 5 casos):

- destinos por `href`, no por etiqueta;
- el cromo del **pulgar** también: si el riel adelgaza y la barra engorda, no se
  ha reducido nada, se ha movido el bulto de ancho;
- **lo único que distingue reducción de mudanza**: los 18 destinos
  administrativos tienen que quedarse FUERA del cromo persistente. Ése es el
  trato —cuestan un gesto más— y si alguno reasoma, la reachability seguiría en
  verde sin que nadie se entere.

**Punto ciego del propio instrumento, visto y cerrado**: contar `href` también
moriría ante un `.map(`. El caso 1 lleva **guarda de validez** y se declara
inválido antes que dar un número. Un instrumento que no sabe cuándo dejó de
medir es peor que ninguno — lección de RTC-02.

La vara vieja **no se borra** (precedente de guardián obsoleto): se le escribe
dentro qué no mide y adónde mudó la medición fina.

**Compuertas**: tsc limpio · vitest 9425/9426 (el rojo es el artefacto conocido
del proxy del contenedor) · lint 96 = techo · trinquete de diseño sin deuda
nueva · build compila. Sin arnés de navegador: esta rebanada no cambia píxeles.

---

## RTC-19 · 2ª tanda — `/configuracion` habla el token (14-ago)

**Recontado antes de tocar nada** (sin comentarios, sin pruebas): **83
literales vivos en 28 archivos**, y **31 en una sola superficie**. Ésa fue la
rebanada.

- **Pagados 20** de cromo de pantalla → `var(--nexus)` / `color-mix`. Dos
  degradados de dos paradas casi idénticas (`0.06 → 0.02`) pasan a tinte plano:
  nadie los percibía como degradado y el trinquete sí los contaba. **Techos
  bajados y re-sellados: `hexEnLinea` 493 → 489, `gradientes` 16 → 14.**
- **El hallazgo es lo que NO se toca.** Once literales se quedan porque
  barrerlos rompería cosas sin que ninguna prueba se pusiera roja:
  - `snippetBoton` / `snippetFlotante` se copian al **sitio web del
    consultorio**, donde no existe `globals.css`. Un `var(--nexus)` ahí pegaría
    un botón sin color en la página del médico. Y sus vistas previas llevan el
    mismo hex a propósito, o enseñarían un botón distinto del que se pega.
  - `colorAccento` no es cromo: es **dato**. Se edita en un
    `<input type="color">` —que sólo acepta `#rrggbb`—, se guarda en Firestore
    y acaba **impreso**.
- **El navegador encontró lo que el `grep` no podía.** Con los dos ficheros de
  la sección ya limpios, «Recetas, órdenes y notas» **seguía pintando
  teal-500**: venía de `GuiaConfigurarReceta`, un componente de otra carpeta que
  se pinta ahí dentro. Por fichero la superficie estaba limpia; en pantalla, no.
- **`color-mix` verificado, no supuesto**: si no resolviera, el elemento se
  queda sin fondo y el `git diff` se ve perfecto. Medido: soporte `true`, **0
  elementos sin fondo**, tono calculado `rgb(42, 165, 181)` = `--nexus`.
  Arnés nuevo `scripts/design/medir-rtc19-configuracion-v15.mjs`.
- Y la razón de fondo: `#14b8a6` (teal-500) **no es** `--nexus` (#2AA5B5). No
  era «un hex en línea»: era otro teal en la pantalla que más se abre después
  de las clínicas.

**Compuertas**: tsc limpio · vitest 9430/9432 → tras regenerar el inventario de
pantallas queda 1 rojo, el artefacto conocido del proxy del contenedor · lint
96 = techo · trinquete de diseño **con dos techos más bajos** · build compila ·
navegador real (axe sin hallazgos, sin desbordes, táctiles ≥44). El acta
registra 2 avisos de consola del emulador (Firestore no alcanzable desde el
contexto del arnés) y 1 `pageerror` de reglas del emulador — ambientales, no
del cambio.

**Quedan ~52 literales** en documentos de receta, superadmin, landing e
ilustraciones. Cada familia necesita la misma pregunta: **¿resuelve el token
donde ese color acaba?**

---

## RTC-28 — contestado midiendo, y refutado en su mayor parte (14-ago)

RT-21 lo dejó como **pregunta**, no como veredicto: «riel/topbar/FABs
permanecen oscuros — verificar si es decisión o resto». Un P3 así no se paga
escribiendo código.

**Luminancia relativa del fondo realmente pintado** (subiendo por los ancestros
cuando el elemento es translúcido — leer `rgba(0,0,0,0)` habría dado un falso
«negro»), tres rutas, los dos temas:

|                | claro | oscuro |
|---|---|---|
| superficie     | 0.9541 | 0.0037 |
| riel           | 0.9541 | 0.0037 |
| topbar         | 0.9541 | 0.0037 |
| botón de tema  | 1      | 0.0074 |
| botón de ayuda | 0.0999 | 0.1534 |

- **Riel y topbar siguen al tema, exactamente.** La observación no se reproduce
  hoy: entre medias, RTC-05 sacó los FABs del arco del pulgar y unificó el tema
  en `@/hooks/useTema`.
- **Lo único más oscuro que la superficie en claro es el botón de ayuda, y es
  decisión**: `var(--nexus-solido)` (#177886), el token de RELLENO del acento,
  documentado con su 5,16 : 1 con blanco encima y compartido con la corona del
  pulgar. Un botón de acción relleno **es** más oscuro que la página en tema
  claro — eso es lo que lo hace legible. Llamarlo «resto del tema oscuro» sería
  confundir un relleno de acento con un fondo sin migrar.

Cerrado **REFUTADO (riel, topbar) + DECISIÓN (FAB)**, no «arreglado» — un
registro que apunta un arreglo donde no hubo defecto envenena la siguiente
lectura. Guardián `v15-rtc28-el-cromo-sigue-al-tema.test.ts` (4 casos, probado
al revés ×2) para que nadie ancle el cromo a un color fijo, que es el defecto
que el panel creyó ver y el único que puede aparecer de verdad.

**Compuertas**: tsc limpio · vitest 9435/9436 (el rojo conocido del proxy) ·
lint 96 = techo · trinquete sin deuda nueva · navegador real, 0 errores de
página. Sin cambios de producto: esta rebanada es una medición y su guardián.

---

## RTC-22 — la marca se decía dos veces, y la peor copia no era la denunciada (14-ago)

Medido en navegador (`medir-rtc22-marca-duplicada-v15.mjs`), contando **nodos
hoja** con el texto exacto — buscar por «contiene» habría contado también a
cada ancestro y dado un número inventado:

|                     | antes | después |
|---|---|---|
| escritorio sin paciente | 2 (riel + franja) | 1 (riel) |
| escritorio con paciente | 2 (riel + franja) | 1 (riel) |
| móvil sin paciente      | 1 (franja)        | 1 · intacto a propósito |
| móvil con paciente      | 0                 | 0 |

**Dos fuentes, no una.** El panel denunció el respaldo de la topbar; midiendo
apareció la de escritorio, que era peor: pintaba el consultorio **siempre**,
incluso con un paciente delante («Ausculta · María del Refugio Alcántara»). El
elemento cuyo trabajo es el estado clínico (§5) empezaba diciendo la marca.

- **El respaldo de la topbar no se borra**: a ≤768px el riel no está en
  pantalla y ésa es la única identidad de la aplicación. Se oculta por ANCHO
  (media query a 769px): quién dice el nombre depende de qué cromo hay en
  pantalla, y eso lo sabe el CSS, no un `if`. Borrarlo habría sido el defecto
  contrario y más caro.
- **Sin paciente ni grabación, la franja de escritorio devuelve `null`.**
  Quitada la marca, habría quedado una banda de 30px con una línea de
  separación y nada dentro en todas las pantallas sin paciente.

**Dos guardianes de tipografía ajustados con su porqué dentro** (precedente de
guardián obsoleto: se muda al mismo invariante, no se borra): el respaldo pasó
a llevar dos clases y la comparación exacta dejó de verlo; y el separador «·»
dejó de tener trabajo al no haber nada que separar — se conserva la mitad que
importa, que nunca vuelva DENTRO del enlace.

**Compuertas**: tsc limpio · vitest 9440/9441 (el rojo conocido del proxy) ·
lint 96 = techo · trinquete sin deuda nueva · build compila · navegador real
antes/después, escritorio y móvil, **0 errores de consola**.

---

## RTC-23 (mitad de `/citas`) — la cascada es una entrada, no una respuesta al clic (14-ago)

**El hallazgo era cierto a medias**, y sólo midiendo se veía cuál mitad
(`medir-rtc23-cascada-citas-v15.mjs`, muestreo de opacidad cada 40ms tras
pulsar):

|                                   | antes | después |
|---|---|---|
| filtro de estado («2 por confirmar») | 0ms | 0ms |
| cambio de día («mañana: 1 cita»)     | ~320ms con una fila en opacidad 0 | 0ms |
| cascada al ENTRAR                    | sí | sí |

Los filtros de estado no re-animan —las filas que sobreviven conservan su
nodo—; cambiar de día trae citas distintas, se remontan, y la cascada vuelve a
correr con `fill: both`, que mantiene el estado inicial **durante** el retraso.
El médico pulsaba y esperaba un tercio de segundo para leer el resultado de su
propio clic.

Arreglo: la cascada se marca como ENTRADA y se apaga a los 700ms. Entrar merece
el escalonado (ordena la jerarquía de una lista que aparece de golpe, §20 — el
propio panel declaró buena la del dashboard por eso); filtrar no ordena nada.

**Comprobado explícitamente que la entrada sigue viva**: apagar de paso la
animación buena habría sido un mal arreglo, y el acta lo mide.

### El arnés se rompió con el arreglo, y eso se arregló primero

La primera versión contaba elementos `.nx-reveal`. En cuanto el arreglo quitó
esa clase, dejó de encontrar nada e informó **«0/0 filas · 0ms invisible»**: un
aprobado vacío que parecía la prueba del éxito. Ahora cuenta `.riel-entrada`
—la fila, exista o no la animación—. Mismo defecto que RTC-20 encontró en la
vara del riel, cometido aquí sobre el propio arreglo, y cazado porque el número
«0 de 0» no se parecía a un éxito.

**Compuertas**: tsc limpio · vitest 9443/9445 → tras regenerar el inventario
queda 1 rojo (el artefacto conocido del proxy) · lint 96 = techo · trinquete
sin deuda nueva · build compila · navegador real antes/después, 0 errores de
página.

**Siguen abiertas** las otras dos mitades de RTC-23: la cascada 520+120ms de
Hoy y la luna que rota al hover.

---

## RTC-27 — el radio de la caja hermana, y los 154 que no se barren (14-ago)

De los dos sitios que RT-19 señaló, **uno ya no existe**: `ResumenPaciente:104`
se lo llevó la reescritura del resumen (las tarjetas KPI que pasaron a prosa).

El que quedaba —«Datos del paciente» del expediente— se paga, y visto de cerca
el defecto es mejor que «12 no está en la escala»: **la caja hermana de la
misma pantalla** («Herramientas clínicas», unas líneas más abajo) usa 10. Dos
contenedores del mismo rango, en el mismo pliegue, con esquinas distintas por
2px. Techo `radiosFueraDeEscala` **627 → 626**, re-sellado.

**Lo que no se hace, y es la parte importante**: hay **154 apariciones de
`borderRadius: 12` en 79 archivos**. Eso no dice «154 defectos»: dice que 12 es
un valor de facto del producto que la escala {6,10,14,50,9999} no reconoce. Dos
salidas posibles, las dos de diseño — ampliar la escala, o migrar 154 sitios con
revisión visual. **Ninguna se decide barriendo**: un `sed` de 154 sitios sería
el cambio visual más grande de todo V15 y no lo habría mirado nadie. Declarado
para el dueño del diseño.

### Dos errores propios, y los dos del mismo tipo

1. Puse el comentario como **comentario de JSX delante del elemento raíz de un
   `return`**: son dos nodos hermanos y el archivo dejó de compilar. Ya había
   pasado en `secciones-recetas.tsx`, dentro de un ternario.
2. Al reescribirlo como comentario de JS, **cité dentro la sintaxis de cierre**
   de un comentario de bloque, que cerró el bloque a mitad de frase.

Los dos los cazó `npx tsc --noEmit` antes del commit, que es exactamente para
lo que se corre: `npm run build` no habría bastado en el primero y el segundo
ni siquiera es de tipos.

**Compuertas**: tsc limpio · vitest 9446/9448 → tras regenerar el inventario
queda 1 rojo (el artefacto conocido del proxy) · lint 96 = techo · trinquete
con un techo más bajo · build compila.

---

## RTC-25 — de cinco quejas de texto móvil, una se reproducía (14-ago)

Medido a 390×844 en cuatro rutas (`medir-rtc25-textos-moviles-v15.mjs`):

| | |
|---|---|
| la página desborda | no, en ninguna ruta |
| elementos que no caben en su caja | 0 (salvo un input de fecha de 1px) |
| truncados con ellipsis efectiva | 0 |
| placeholder de `/pacientes` | **327px de texto en 296px útiles** |

- **Rótulo del héroe: REFUTADO** — ningún título pasa de un renglón (lo pagó
  RT-03 con su breakpoint).
- **Píldoras sangrando: REFUTADO** — cero desbordes reales.
- **Descriptores bajo los FABs: SIN SUJETO** — ya no flotan (RTC-05) y el de
  ayuda se retiró entero (RTC-32).
- **«Urgente» como metadato gris: NO MEDIBLE con esta siembra.** Declarado, no
  refutado: no es lo mismo «no pasa» que «no se pudo mirar».

**Lo que sí, y con una ironía útil.** El placeholder de `/pacientes` no cabía,
y el propio equipo rojo lo transcribió como «…correo o **CUI**» — leyendo,
justamente, lo que le cabía en la pantalla. **La errata era la prueba.**

El arreglo quita «Buscar por» (la lupa ya dice que se busca) y **conserva los
cuatro campos**, que es la información que sólo puede dar el placeholder; el
`aria-label` sigue diciendo la frase entera. Medido después: 248px de 296.

**Compuertas**: tsc limpio · vitest 9456/9458 → tras regenerar el inventario
queda 1 rojo (el artefacto del proxy) · lint 96 = techo · trinquete sin deuda
nueva · build compila · navegador real antes/después, 0 errores de página.
