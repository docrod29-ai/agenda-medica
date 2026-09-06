# AUSCULTA — último punto seguro

## Checkpoint · 6-sep-2026 — **v1184 EN PRODUCCIÓN** (PR #459 → `8fe45415`, pin #463 → `c49c3a25`, botón #24 SUCCESS 02:04 UTC; actas v1180…v1184 cerradas)

## Checkpoint · 6-sep-2026 — **fusionado con `main`: 155 commits de distancia, 12 archivos en conflicto, resueltos**

```
CURRENT_BRANCH=claude/ausculta-product-excellence-52rqck
CURRENT_HEAD=(este commit)
CURRENT_PR=(sin PR — la rama está empujada, no fusionada)
LAST_COMPLETED_UNIT=103 · la fusión con main
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=La rama ya está al día con main y en verde. Lo que queda es del dueño: (1) abrir el PR y fusionar; (2) desplegar reglas e índices de Firestore; (3) la clave de IA, que destraba Evidencia y la transcripción de verdad; (4) un iPhone real — sin WebKit NADA de este carril prueba iPhone; (5) pentest y PITR.
TESTS_PASSED=12695
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes y el proxy del contenedor rechaza al instante. Es intermitente: en una corrida de la suite entera pasó. NO tocar la aserción.
BUILD=compila
BLOCKED_EXTERNAL=iPhone/WebKit real · clave de IA · PubMed · despliegue de firestore.rules · PITR · pentest
DO_NOT_REGRESS=REG-542…REG-555
```

### La fusión, y lo que enseñó

`main` había avanzado **155 commits**. Al fusionar aparecieron 12 archivos en
conflicto y, más interesante, **tres decisiones de producto tomadas dos veces
por separado**: la agenda que abre en Día en el teléfono, `minmax(0, 1fr)` en la
rejilla del mes, y derivar `ultimaCita` de las citas en la siembra.

En las tres **gana `main`**, y no por ser el tronco: por estar selladas con
guardianes que no son de este carril. Concretamente:

- La **píldora flotante de grabación**: este carril la había retirado haciendo
  `fixed` la barra de voz. `main` la conserva y la esconde cuando el panel está
  a la vista, y lo tiene sellado en
  `grabar-nunca-es-rojo-y-se-manda-desde-un-sitio.test.ts` junto con otras cinco
  reglas (grabar nunca es rojo, un solo cronómetro, un solo botón de pausa). Las
  dos soluciones son incompatibles. Se revierte la de aquí entera.
- La **vista del calendario**: `main` la elige al montar y NO la re-impone al
  girar, y lo tiene sellado. Este carril la derivaba con `useSyncExternalStore`.
  Se revierte.

De este lado se conserva lo que valía por su cuenta y no chocaba: la píldora y
la barra usan ahora el **vocabulario común** (`rotulo`, `reloj`) en vez de dos
`padStart` propios — la regla de REG-544, que aquel cambio no había alcanzado.

**Los REG de este carril se renumeraron 417→513 … 430→526**: `main` había usado
417-430 para regresiones distintas. Se renumeró sólo lo que no existía en
`origin/main`, línea por línea.

### Dos defectos que salieron DE la fusión

- El observador de la píldora quedó vigilando **otro elemento** (`ref` en el
  `<div>` equivocado). Lo cazó el guardián de `main`.
- `nada-flotante-tapa-un-control` buscaba el botón del tour con
  `hasText: /^saltar$/i`. Con expresión regular, `hasText` mira el texto CRUDO,
  y el del botón lleva saltos de línea: **el tour no se cerraba nunca**, y el
  guardián llevaba midiendo la pantalla del tour —una capa `fixed` con z-index
  200— y diciendo «ok». Ahora se busca por nombre accesible y **se comprueba que
  la capa se fue**; si sigue ahí, se para.

### Los arneses de este carril

| Comando | Qué mide |
|---|---|
| `npm run arnes:telefono-navegador` | Las 28 pantallas a 390 px: arrastre lateral y recorte mudo. |
| `npm run arnes:confirmacion` | El teclado del diálogo destructivo: 9 comprobaciones. |
| `npm run arnes:regresion-visual` | 14 capturas contra línea base. `--estabilidad` mide su propio ruido. |
| `npm run arnes:dia-del-medico` | El día entero: entrar, ver, abrir, consentir, grabar, detener, firmar, cobrar, recuperar el audio. |

### La lección que se repitió

Un guardián puede estar escrito, correr y salir verde sin vigilar nada: porque
pregunta del lado equivocado de la frontera (REG-550), porque mira una carpeta
de menos (REG-553), porque prueba una forma del dato que nadie envía y a una
hora en la que el defecto no se asoma (REG-554), porque mide la pantalla en un
estado en el que nadie trabaja (REG-555), o porque su localizador nunca casa y
mide la pantalla de otra cosa (el tour, arriba). **Visitar la ruta no es
medirla.**

---

## Checkpoint · 5-sep-2026 — **Preservation, Audit & Intelligence Transformation · cuatro P1 cerrados y la receta cerrada en lo verificado, #442 absorbido el test-the-test y la seguridad reportada cerrados (REG-519…535) · tres decisiones del dueño escritas (D-033…034)**

```
CURRENT_BRANCH=claude/ausculta-preservation-improvement-44lutz
CURRENT_HEAD=(este commit)
CURRENT_PR=#459 FUSIONADO (8fe45415) y #463 FUSIONADO (c49c3a25); producción sirve nexusmed-v1184 (ejecución #24, SUCCESS). Este commit: contabilidad posterior al despliegue, va en un PR sólo de documentación
CURRENT_WORKSTREAM=Programa del pliego del 5-sep: UNDERSTAND → MEASURE → PRESERVE → IMPROVE. Fase 0 (reconciliación) y Fase 2 (P0/P1) — sin P0; los cuatro P1 confirmados, cerrados
LAST_COMPLETED_UNIT=Cierre del ciclo v1184: actas v1180…v1184 con SUPERADO + URL de ejecución, MASTER_STATE.ultimaVersionEnProduccion=nexusmed-v1184, changelog del SW con «Publicado», B-13 asentado. Antes: REG-535 — verificación en navegador con el arnés (sonda nueva, pac-006 sembrado): los avisos de REG-524/520/521 se ven a 390 y 1440 sin errores de consola; y destapó que la receta contaba su propia nota como «ya lo toma» — arreglado en receta y consulta. Antes: REG-534 — el error crudo ya no sale al cliente: helper sin acceso al error, 40 rutas migradas, barrido de todas las rutas como guardián. Antes: REG-532 y 528 — sanitize redacta lo que su cabecera prometía (nombres por llave, Stripe por patrón); reclamarCanal en transacción con la carrera provocada. D-E escrita (360dialog: la llave como id de documento exige migración). Antes: REG-529, 525 y 526 — test-the-test: csp-manifest corre tras el build; el prompt se vigila por frases sobre lo emitido; la membresía del servidor tiene por fin una prueba ejecutada contra un doble con id. Antes: REG-513 y REG-514 — port de PR #442 con número nuevo (vista previa medida, captura completa de la sonda); sus pruebas pasan aquí. Antes: REG-528 — terapia duplicada: la misma sustancia en dos renglones (catálogo de dosis: Tempra = paracetamol) o ya vigente, con la suma diaria contra el techo que ya existía; en consulta y receta. Antes: REG-527 (la receta ve el expediente completo), REG-526 (bloqueo ARCO revoca el portal, D-035); D-033 y D-034 escritas en el código que gobiernan
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=Mirar la consulta con `pac-006` (`/consulta/pac-006`: barra de avisos con yaToma, tema claro, teclado) con una sonda como `mirar-la-receta-con-expediente.mjs`, y anotar en readiness §8. Emuladores aquí: `npx firebase emulators:start --only auth,firestore --project demo-nexusmed-v10` (el script `arnes:emuladores` asume brew); luego `node scripts/design/sembrar-emulador.mjs` y `npm run arnes:dev`. Después: guardianes de texto sellados del test-the-test, uno por uno. Decisiones del dueño pendientes: D-D (validadores sin llamador) y D-E (360dialog). Todo en docs/product/AUSCULTA-ULTRA-READINESS.md §3 y §11.
FILES_IN_SCOPE=scripts/ausculta-transformacion/*.mjs · scripts/design/sembrar-emulador.mjs · docs/product/AUSCULTA-ULTRA-READINESS.md §8
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=12634
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — el proxy del contenedor rechaza 10.255.255.1 al instante. NO tocar la aserción.
BUILD=163/163 con los placeholders NEXT_PUBLIC_FIREBASE_* del CI
LINT=93 (techo apretado en REG-524)
P0_OPEN=(ninguno; cross-tenant refutado en las 99 rutas)
P1_OPEN=(ninguno confirmado). Receta: los cinco hallazgos de medication-safety verificados; cuatro cerrados (REG-524, 518, 520, 521) y el quinto (validadores sin llamador) es decisión del dueño (D-D)
BLOCKED_EXTERNAL=reglas de Firestore sin desplegar · WebKit/iPhone · PITR y restore real · pentest · licencias de evidencia · llave AssemblyAI local. B-12 YA NO: el emulador de Firebase arranca en este contenedor (comprobado el 5-sep)
DO_NOT_REGRESS=REG-519 (revocación en telesalud/sala) · REG-520 (una lista de sesgo para los cuatro puntos de envío) · REG-521 (la pregunta escalada abre tarea sin depender del teléfono) · REG-522 (guardián con autotest) · REG-523 (cerrar la tarea marca la pregunta atendida) · REG-524 (sin edad no se supone adulto) · REG-525 (la huella de la receta larga no se pierde) · REG-526 (el bloqueo ARCO apaga el portal) · REG-527 (la receta ve la medicación vigente y la creatinina del expediente) · REG-528 (la misma sustancia dos veces se dice, con la suma contra el techo del catálogo) · REG-513/523 (port de #442: la vista previa mide su sitio; la sonda recorre el scroller de dentro) · REG-529 (csp-manifest corre tras el build) · REG-530 (el prompt se vigila por frases, sobre lo emitido) · REG-531 (la membresía del servidor se ejecuta contra un doble con id) · REG-532 (sanitize redacta nombres y Stripe) · REG-533 (reclamarCanal en transacción) · REG-534 (el error crudo no sale al cliente) · REG-535 (la receta no se cruza consigo misma)
```

### Qué se hizo en esta sesión, en orden

1. **Reconciliación** medida, no citada: main `e78e1242` (v1181), un solo PR
   abierto (#442, con dos REG que main ya gastó), bucle de Actions muerto,
   baseline 12 598/1/1, tsc limpio, lint 94.
2. **Seis auditorías read-only en paralelo** (equipo rojo de API, voz,
   medicación, test-the-test, seguridad, experiencia del paciente). El
   orquestador verificó cada P1 en el código antes de tocarlo.
3. **REG-519** — la sala de video aceptaba un enlace revocado.
4. **REG-520** — los alérgenos no llegaban a Whisper; ahora una lista para los
   cuatro puntos de envío.
5. **REG-521** — la pregunta escalada del paciente abre una tarea en
   `/pendientes` aunque no haya teléfono.
6. **REG-522** — el guardián del paciente equivocado se probaba contra un
   comentario; ahora contra sus mutantes.
7. **REG-523** — cerrar la tarea de una pregunta marca la pregunta atendida:
   el portal del paciente deja de decir «pendiente» para siempre.
8. **REG-524** — sin edad en el expediente, la receta ya no aplica topes de
   adulto a un niño en silencio: lo dice, y usa la fecha de nacimiento.
9. **REG-525** — la bitácora ya no pierde entera la huella de una receta
   larga: se acota por campo y lo omitido se declara.
10. **D-033, D-034, D-035** — el dueño decidió: la alergia crítica sólo avisa,
    la pregunta del paciente viaja completa por WhatsApp, y la cancelación
    ARCO apaga el portal. La tercera es código: **REG-526**.
11. **REG-527** — la receta ve el expediente completo, como la consulta: la
    warfarina de marzo con el ketorolaco de hoy ya dispara, y la creatinina
    del último panel llega al ajuste renal con su fecha y su vigencia.
12. **REG-528** — «Paracetamol 500 mg» + «Tempra 1 g» pasaban renglón a
    renglón. Ahora la misma sustancia en dos renglones se dice, con la suma
    diaria contra el techo que ya estaba en el catálogo, y también cuando ya
    está vigente en el expediente. Sin cifras nuevas.
13. **REG-513 y REG-514** — port de PR #442, cuyos números ya había gastado
    `main`: dos commits traídos tal cual y renumerados. El PR queda para que
    el dueño lo cierre.
14. **REG-529, 525, 526** — test-the-test: una prueba que el CI dejaba
    siempre saltada, un guardián que sellaba una redacción y no la regla, y la
    guardia de membresía de las 99 rutas sin una sola prueba que la ejecutara.
15. **REG-532 y REG-533** — seguridad: `sanitize` cumple lo que su cabecera
    prometía; el candado del canal de WhatsApp resiste una carrera. D-E para
    el dueño: la llave de 360dialog como id de documento exige migración.
16. **REG-534** — cuarenta rutas devolvían `String(err)` al cliente; ahora un
    helper que no recibe el error, y un barrido de todas las rutas.
17. **REG-535** — la primera verificación en navegador de esta rama (arnés
    de emuladores, Chromium 390/1440) confirmó los avisos nuevos de la receta
    y destapó que la receta se cruzaba consigo misma. Arreglado en receta y
    consulta. Sonda y paciente sintético quedan en el repositorio.
18. `docs/product/AUSCULTA-ULTRA-READINESS.md` nace con el KEEP LIST verificado
   en código y todo lo abierto con archivo y línea.

---

## Checkpoint · 29-ago-2026 — **P0 = 0 y P1 internos = 0. Empieza el trabajo de los workstreams sin cola**

```
CURRENT_BRANCH=claude/ausculta-master-completion-4clx9v
CURRENT_HEAD=(este commit)
CURRENT_PR=#389
CURRENT_WORKSTREAM=WS-10 (Patient State longitudinal) — cerradas alergias, certeza del médico, conservación y relectura de los avisos, y los laboratorios en los motores; faltan procedimientos, dispositivos, la tendencia en la consulta y la persistencia
LAST_COMPLETED_UNIT=Cierre del tramo · REG-375 y REG-376 implementados y conectados + `docs/product/AUSCULTA-CONSULTORIO-FINAL-READINESS.md` generado
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=El tramo está cerrado y el PR abierto. Lo que queda NO depende de escribir más código: (1) desplegar índices y reglas de Firestore —una acción del dueño que desbloquea dos filas de la tabla de bloqueos—; (2) WS-02, el arnés que PRODUZCA el JSON de carga que el validador ya sabe leer; (3) un iPhone real para cerrar WS-05; (4) el SELLO v4, que desbloquea el registro estructurado de procedimientos y dispositivos; (5) pentest y PITR, que ningún trabajo interno sustituye. El estado completo, con qué está PROVEN, qué BLOCKED_EXTERNAL y qué NOT_DONE, vive en docs/product/AUSCULTA-CONSULTORIO-FINAL-READINESS.md.
FILES_IN_SCOPE=src/lib/expediente/alergias-longitudinales.ts · src/lib/expediente/lo-que-se-aviso-al-firmar.ts · src/lib/expediente/la-duda-de-la-otra-vez.ts · src/lib/expediente/laboratorio/lo-que-ya-esta-medido.ts · src/lib/expediente/problemas-activos.ts · src/lib/expediente/cuadro-completo.ts
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=11080
FINAL_READINESS=docs/product/AUSCULTA-CONSULTORIO-FINAL-READINESS.md
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
BUILD=compila con los placeholders NEXT_PUBLIC_FIREBASE_* del CI; sin ellos falla en «collect page data» (auth/invalid-api-key), que es del entorno
P0_OPEN=(ninguno interno)
P1_OPEN=(ninguno interno — P1-20 abierto y cerrado con REG-364)
BLOCKED_EXTERNAL=P1-6 E0-06 alergias · iPhone/WebKit real · despliegue de firestore.rules · PITR/restore real · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 · REG-501…REG-376
```

### Cerrado en esta tanda

| REG | Qué |
|---|---|
| 348 | El respaldo se llevaba las colecciones de nivel raíz y el importador las rechazaba todas |
| 349 | Esa restauración podía **quitarle la cuenta a otro consultorio**: miraba de quién era el documento fuera de transacción |
| 350 | El historial completo de un paciente se bajaba en cada pantalla — y con él caían dos amplificaciones peores y una salvaguarda que habría quedado colgando del techo |
| 351 | Nueve pantallas trataban el recorte del directorio como el censo completo: typeahead que decía «no está», importador que duplicaba el consultorio, panel NOM-004 que afirmaba «al día», libro de controlados sin el nombre de a quién se le dio |
| 352 | La baja de un paciente leía la agenda ENTERA y se tragaba el fallo: por ese camino pasa la cancelación ARCO, y podía borrar el expediente dejando citas con su nombre y su teléfono |
| 353 | Un proveedor caído se seguía reintentando en cada petición, pagando el timeout entero. Interruptor por proveedor **y por llave**: una llave revocada de un consultorio no puede apagar a los demás |
| 354 | El repositorio no sabía si sus reglas rigen en producción. `vercel --prod` no las publica, y la nota viajaba en prosa desde E0-06. Ahora se deriva del sha256 y una compuerta exige declarar qué se rompe mientras tanto |
| 355 | Quedaban escritores de scroll que no preguntaban. La regla correcta existía **dentro de un componente**; ahora es del sistema. Y `overscroll-behavior` no aparecía en todo el repositorio |
| 356 | La evidencia de la consulta no decía dónde NO había mirado. La maquinaria estaba escrita y probada desde REG-345, y esta ruta no la tenía cableada |
| 357 | Se reproducía texto completo de PMC sin leer la licencia del artículo. «Acceso abierto» dice que se puede LEER, no que se pueda COPIAR en un producto de pago. Ahora falla cerrado |
| 358 | Un duplicado con los nombres al revés no aparecía: el buscador decía «no está» y el antiduplicado no saltaba, así que la historia quedaba partida en dos expedientes |
| 359 | Se comprobaba que la cita estuviera en RANGO, no que el artículo dijera eso. Un `[2]` que apuntara a un artículo que dice lo contrario pasaba, con la apariencia de estar respaldado |
| 360 | «Cerrar» abarcaba de golpe decisión, acción y aviso al paciente: un resultado crítico cerrado sin que nadie llamara se veía igual que uno donde sí se llamó. **Primera unidad de WS-11 sin P1 detrás** |
| 361 | Esos campos existían y **ninguna pantalla los llenaba**. Se conectó en la unidad siguiente, antes de que el hueco se volviera el defecto de siempre |
| 362 | `evals/patient-ai/` no existía: la única regla del repositorio que no se podía correr. La primera vez que se pudo, **encontró un defecto vivo** — la ingesta accidental sólo se detectaba en tercera persona |
| 363 | La alergia estaba **sellada en cada nota firmada** y nadie la volvía a leer. Vaciado el campo mutable de `Patient`, el producto se comportaba como si dos notas inmutables que dicen «anafilaxia por penicilina» no existieran. Primera unidad de WS-10 sin P1 detrás |
| 364 | Lo que el médico **descartó** entraba al cuadro que ven el copiloto y el prompt de evidencia. Medido: «embarazo descartado» → «La paciente cursa embarazo», en un texto que se inserta en la nota firmada. **P1-20, abierto y cerrado en esta unidad** |
| 365 | La otra mitad de REG-364 **estaba mal**: etiquetar «(presuntivo)» afirmaba una duda que nadie expresó, porque `presuntivo` es el valor de FÁBRICA del esquema y ninguna pantalla deja elegir el tipo. Corregido el mismo día, con un caso que vigila que siga siendo el default |
| 366 | Los avisos que el médico confirma haber revisado —la duda del paciente, la contradicción, el antecedente del familiar— **se descartaban al firmar**. «Creo que me dijeron que tenía anemia» quedaba como «Anemia» y la duda duraba lo que la sesión del navegador. Se sellan ANTES del hash, o la nota se reabre «alterada» |
| 367 | Y esa duda **no llegaba a la consulta siguiente**, que es donde `certeza.ts` decía que se perdía. El par de REG-366, cerrado en la unidad siguiente para que su «qué no cubre» no fuera el defecto de dentro de seis meses |
| 368 | **REG-188 en el eje que faltaba**: los paneles de laboratorio del paciente los leía un solo componente —el de la pestaña de la MISMA pantalla— y no los motores. Creatinina 2.4 del mes pasado + metformina hoy = ningún aviso. Con su fecha, y sin inventar un umbral de antigüedad |
| 369 | Y la TRAYECTORIA sólo se veía saliendo de la consulta. 0.9 → 1.3 → 1.7 no dispara nada por punto y es un deterioro renal. Dice aritmética, no clínica: un guardián falla si aparece cualquier cifra en el código del módulo |
| 370 | `entidades.procedures` se reconocía con fecha y LATERALIDAD, se pintaba en el panel y **no tenía un solo consumidor más**. Ahora lo que la nota no recoge se señala antes de firmar — sellado y con relectura. El registro estructurado exige **sello v4**, declarado |
| 371 | Los DISPOSITIVOS invasivos (prótesis valvular, marcapaso/DAI, CVC) se capturaban y **su único lector era el texto de su propia valoración**. Ya salen en la línea clínica de la consulta, con fecha y sin afirmar el vacío. No alimentan ningún motor: no hay reglas de dispositivos y escribirlas sería inventar criterio |
| 372 | El expediente **interoperable** afirmaba una confirmación que nadie hizo (`definitivo` del MODELO → `confirmed`), daba por **resuelta** una enfermedad crónica, y convertía un **descarte** en sospecha. `tipoOrigen` registra quién puso `tipo`, dentro del objeto que el sello v3 ya cubre |
| 373 | Una MENCIÓN HISTÓRICA se volvía medicación vigente: el extractor nunca pone `estado` y la ausencia se lee como `activa`, así que «le dieron warfarina cuando la operaron» disparaba la regla de sangrado. Se señala mientras receta; **no se reclasifica** |
| 374 | Y ese arreglo, el mismo día, avisaba sobre **todos los antibióticos recién iniciados**: usaba el criterio de PADECIMIENTOS (`esFrasePasada`) y «le receté amoxicilina hace tres días» es pasado gramatical con el paciente tomándola. Ahora exige cesación dicha o pasado remoto, **sin umbral de días** |
| 375 | **Política del dueño**: vigencia de la función renal para dosificar (≤24 h inestable · ≤30 d ambulatorio estable · ≤7 d conservador). Fuera de ventana marca `STALE_RENAL_FUNCTION` **sin bloquear ni retirar la recomendación**. La estabilidad NO se deduce: hoy nada la declara, así que rige la conservadora |
| 376 | **Política del dueño**: no hay porcentaje universal. Se usan los umbrales YA definidos (referencia de `ANALITOS`, pánico de `lab-criticos`); cruzar un límite importa aunque el % sea pequeño; sin regla validada salen los deltas **sin etiquetar**. `RELEVANCIA_POR_RCV` vacía y declarada |

### El saldo, escrito

`cerrado −1 (P1-16)` · `nuevo +1 (P1-18)` · `cerrado −1 (P1-18)` ·
`cerrado −1 (P1-12)` · `cerrado −1 (P1-11)` · `cerrado −1 (P1-15)` ·
`cerrado −1 (P1-2)` · `cerrado −1 (P1-13)` · `cerrado −1 (P1-9)` ·
`cerrado −1 (P1-10)` · `cerrado −1 (P1-17)` · **`nuevo +1 (P1-19)`** ·
`cerrado −1 (P1-19)` · **`nuevo +1 (P1-20)`** · `cerrado −1 (P1-20)`
→ **9 → 0 P1 internos abiertos**.

**Cerrados 12, nuevos 3** (P1-18, P1-19 y P1-20, los tres abiertos y cerrados
dentro de esta tanda). Ninguno se escondió: los tres salieron de revisar lo que
se acababa de cerrar, que es de donde salen los defectos que importan.

**P1-20** salió de recorrer WS-10 después de REG-363: lo que el médico descartó
llegaba a los motores clínicos y al modelo como diagnóstico del paciente, y el
copiloto llegaba a escribir «La paciente cursa embarazo» sobre un embarazo
descartado, en un texto que se inserta en la nota firmada. Se abrió y se cerró en
la misma unidad (REG-364), con la reproducción medida antes del arreglo.

El nuevo sale de cerrar P1-9: la otra mitad de ese requisito —que la ruta
produzca `Source` con procedencia estructurada (#314), y que la verificación de
citas (`mapaDeSoporte`, `esRespuestaRespaldada`, `tasaSinRespaldo`) **tenga algún
llamador fuera de pruebas**— no se cerró y no se esconde.
Un P1 nuevo no borra uno cerrado; se enseñan los dos movimientos.

### La cola está vacía. Lo que NO significa

`P0 = 0` y `P1 = 0` **no** quiere decir que el producto esté terminado: quiere
decir que la cola prioritaria del tablero está vacía y que el trabajo pasa a ser
**por workstream**. Sigue faltando, y está escrito en el tablero:

| Workstream | Qué falta de verdad |
|---|---|
| WS-02 escala | El **arnés que produzca** el JSON de carga. Hay validador de forma; no hay medición. 2k…100k son `NOT_STARTED` |
| WS-09 aplicabilidad | `NOT_STARTED`: no hay motor que diga si una evidencia aplica a ESTE paciente |
| WS-10 Patient State | **REG-363 cerró las alergias** — tercera proyección longitudinal, con `asOf` y versión. Faltan procedimientos, dispositivos, laboratorios, tendencias, banderas de riesgo y compromisos; y **ninguna de las tres se persiste** |
| WS-11 ciclo cerrado | **REG-360/361 cerraron el cierre**: las tres etapas tienen campo, hay registro de transiciones y `/pendientes` las llena por formulario. Falta `scheduled` como estado, el cierre desde otras pantallas, y las **interconsultas, referencias e imagen**, que siguen fuera del ciclo |
| WS-12 evaluación | **REG-362 creó la puerta que la regla exigía** y encontró un defecto vivo al correrla. Falta lo demás: evaluar lo que el modelo REDACTA (corpus, jueces), y las otras cuatro clases de respuesta, que están en el tipo y no tienen clasificador |
| WS-13 observabilidad | Sin correlation ID de punta a punta; un solo llamador de alertas |

Y las fases de prueba final (carga, inyección de fallos, restauración,
benchmarks, equipo rojo, Final Readiness) siguen sin ejecutarse.

### WS-05 sigue SIN ser `PROVEN`, y es a propósito

Tres de los cuatro mecanismos candidatos del rebote de iPhone están cerrados en
código (REG-342 ×2, REG-355), y `overscroll-behavior` ya existe. **Nada de eso
es una observación**: sólo hay Chromium en el entorno. Falta lo que §38 exige —
WebKit, 390 px, diez repeticiones, `scrollTop` que nunca baje solo— y hasta
entonces no se marca verde. El CSS lleva escrito dentro que no está verificado,
con una prueba que falla si alguien borra esa advertencia.

Queda abierto el cuarto mecanismo: los banners asíncronos que cambian la altura
por encima de `<main>` (41 px medidos por `PorQueEstaAqui`). Sacarlos del flujo
es un cambio de layout del panel y no se hace a ciegas.

### Lo bloqueado por fuera ya no es invisible

Dos huecos que vivían en comentarios sueltos pasan a ser artefactos con lista:

| Qué | Dónde | Comando del dueño |
|---|---|---|
| Índices compuestos — las 4 consultas YA los usan (REG-421), así que el despliegue va **ANTES** de fusionar | `firestore.indexes.json` (9 índices) + `docs/ops/INDICES-DE-FIRESTORE.md` | `npx firebase deploy --only firestore:indexes` y **verlos `Enabled` en la consola** |
| Reglas escritas y sin desplegar (`members`, bloque `clinico`, los `match` de REG-340) | `firestore.rules.estado.json` + `docs/ops/REGLAS-DE-FIRESTORE.md` | `npx firebase deploy --only firestore:rules` |

Los dos siguen `BLOCKED_EXTERNAL`. La diferencia es que ahora se puede pedir de
una vez y se sabe qué se rompe mientras tanto. **Conviene pedir las dos juntas.**

> **Al día del 2-sep-2026 — el primero está CERRADO.** No se corrige el renglón
> de arriba, se le añade éste: lo que decía era cierto cuando se escribió.
>
> Los índices son **doce**, no nueve —REG-422 y REG-423 encontraron tres más—, y
> el comando de la tabla **no habría funcionado por DOS motivos**, no uno:
>
> 1. `firebase.json` nunca declaró `firestore.indexes.json`, así que devolvía
>    `success` sin publicar nada (REG-431);
> 2. arreglado eso, la cuenta de servicio contestó **403**: le faltaba
>    `roles/datastore.indexAdmin`. Publicar reglas y crear índices son permisos
>    distintos, y tenía sólo el primero.
>
> El dueño concedió el rol, la ejecución #15 del botón los publicó el 1-sep 23:51
> UTC, y él los vio `Enabled` en la consola el 2-sep. El detalle vive en
> `docs/ops/INDICES-DE-FIRESTORE.md`.
>
> El segundo —las reglas escritas y sin desplegar— **sigue abierto**.

### Lo que el tablero decía y el código desmentía

- `PaletteBusqueda` figuraba como «descarga 50 000 pacientes para enseñar 6».
  **REG-341 ya lo había cerrado**; el tablero estaba atrasado y queda corregido.
- `pacientes/page.tsx:934` (segunda descarga sin caché para deduplicar) también
  estaba cerrado desde REG-347.
- **P1-2 figuraba abierto con «ninguna prueba recorre `src/` buscando
  `.collection('…')`»** — y REG-340 había construido exactamente esa prueba. Las
  siete colecciones de consultorio que citaba están en los tres sitios;
  verificado el 29-ago. Lo único vivo era el despliegue de las reglas, que cierra
  REG-354.

### Dos defectos del ARNÉS que salieron al escribir REG-352

Los dos hacían **pasar pruebas vacías**, así que quedan anotados:

1. **`writeBatch` del doble de cliente era un muñeco.** Cualquier prueba que
   afirmara sobre una escritura pasaba sin que la escritura ocurriera.
2. **El `ref` de un documento de consulta sólo tenía `path`**, y media aplicación
   pasa ese `d.ref` a `batch.delete(...)`: el lote no sabía qué borrar y no
   borraba, en silencio.

Cualquier prueba anterior que afirmara sobre escrituras con este doble hay que
mirarla de nuevo: pudo estar en verde por esto.

### Los índices: declarados, usados, y esperando el despliegue (REG-421)

Los cuatro sacrificios que vivían en comentarios están **reparados**: worklist,
lista de espera, citas del paciente y resumen de notas ya piden orden y cota.

Y al comprobar el guardián **al revés** antes de tocar nada, se descubrió que no
fallaba: se saltaba en silencio las consultas cuya colección no sabía leer, y
comparaba presencia de campos en vez de orden. Debajo había **dos consultas vivas
sin índice** — `getWaitlist` y `listarInvitaciones`. Son nueve índices ahora.

**EL ORDEN DE DESPLIEGUE ES LO ÚNICO PELIGROSO QUE QUEDA AQUÍ.** Los índices van
**antes** que el código: una consulta sin su índice no devuelve lista vacía, falla
entera. Y el botón de producción no protege de esto —su compuerta 3 exige que el
sitio ya sirva la versión antes de publicar los índices—, así que se despliegan
aparte, se ven `Enabled` en la consola, y sólo entonces se fusiona.

El detalle operativo, con los nueve índices y quién los usa, en
`docs/ops/INDICES-DE-FIRESTORE.md`.

### Herramientas que el resto del programa puede usar

1. **`_harness/firestore-admin-en-memoria.ts`** — `doc`, `getAll`, `batch`,
   `tx.getAll`, un gancho de interceptación **en la lectura** y, desde REG-421,
   `orderBy` con las DOS mitades de lo que Firestore hace: ordenar **y excluir
   los documentos a los que les falta el campo del orden**. La segunda es la que
   convierte «una entrada sin `prioridad`» en «una entrada que desaparece».
2. **`_harness/firestore-cliente-en-memoria.ts`** — cuenta documentos leídos,
   entiende `getCountFromServer`, `startAfter` **en la dirección del orden**, y
   sabe simular una **lectura caída** —global (`fallos.lectura`) o en una
   colección concreta (`fallos.lecturaEn`)—, que es como se prueba que alguien
   distingue «no hay» de «no se pudo preguntar»; y **escribe de verdad**
   (`writeBatch`, `setDoc`, `deleteDoc`), que antes no.
3. **`src/lib/pacientes/candidatos.ts`** + `useBusquedaDePacientes` +
   `usePacientesPorId` — la forma canónica de preguntar por un paciente.

Una ruta de `/api` o una pantalla **ya no tiene que probarse leyendo su fuente
como texto**. Varias casillas `PARTIAL` del tablero descansan todavía sobre
substrings; ésta es la vía para convertirlas en medición.

---

## Checkpoint anterior · REG-501–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
