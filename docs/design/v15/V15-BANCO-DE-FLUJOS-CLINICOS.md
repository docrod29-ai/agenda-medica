# V15-WORKFLOW-BENCHMARK-001 — el banco de flujos clínicos

**Rama:** `v15/structural-uiux` (desarrollado en
`claude/ausculta-v15-workflow-benchmark-ssmu8u`, mismo árbol) ·
**SHA de partida:** `a9e8ae4f` — el árbol que Codex cerró con PASS en
`V15-ITERATION16-INDEPENDENT-CLOSURE-AUDIT-003`.

## La pregunta

> ¿El modelo de producto de V15 hace los flujos clínicos reales más rápidos,
> más claros, más seguros y más continuos **sin regresar conducta validada**?

No se contesta mirando pantallas. Se contesta **haciendo el trabajo**: diez
flujos de principio a cierre, en navegador de verdad, a 1440×900 y a 390×844,
sobre datos sintéticos sembrados, con el reloj del dispositivo puesto en la
zona del consultorio.

Instrumento: `scripts/design/medir-flujos-clinicos-v15.mjs`.
Arnés: `scripts/design/arnes-flujos-v15.sh`.
Acta cruda: `docs/design/capturas/v15-flujos/acta-flujos.json` (+ 60 capturas).

---

## Lo primero, porque cambia cómo se lee todo lo demás

**La primera corrida del banco dio 8 flujos completos de 20 y 21 callejones.
Diecinueve de esos veintiún rojos eran del INSTRUMENTO, no del producto.**

Se cazaron uno a uno, mirando el DOM real y las capturas, antes de atribuirle
nada a la aplicación. La lista, porque un banco que no publica sus propios
errores no es un banco:

| lo que el instrumento publicó | la verdad |
|---|---|
| «la lente sólo contesta 1 de 4 preguntas» | la lente se pinta por **portal fuera de `<main>`** (`#nx-lente-hueco`); contesta las cuatro |
| «ningún pendiente ofrece traza a su fuente» | la traza vive en `.nx-lente`, no en `<main>`; **2 de 7** la ofrecen, y son exactamente los 2 que tienen `notaId` |
| «resultados con Cervantes: 0» | las filas de `/pacientes` son `button.nx-fila-abrir`, **no enlaces**; hay 1 resultado y es el correcto |
| «el expediente no tiene ninguna nota abrible» | las notas son **botones**, no `a[href]`; hay 2 |
| «sin control de reanudar» | pausar y reanudar son **botones de icono**: su rótulo vive en `aria-label`, que `:has-text()` no ve |
| «la vuelta del expediente aterriza en `/login`» | `button:has-text("Cerrar")` casó con **«Cerrar sesión»**: el medidor cerró la sesión y culpó al expediente |
| «la acción de avance se llama *Ver sólo los míos*» | ése es el filtro de la pantalla; la acción vive dentro de la tarjeta y se llama «Tomarla» / «Ya se hizo» |
| «la franja de Operaciones: 0 entradas con dato concreto» | se estaba leyendo el **enlace de destino**; la excepción es la FILA, y trae recuento, detalle y dueño |
| «ancla de paciente ausente en la receta» | la identidad la sostiene `.nx-ident-franja`, en el shell, **fuera de `<main>`** |
| «sin salida a receta desde el encuentro» | se midió sobre un **borrador**; esa salida sólo existe —y sólo debe existir— sobre una nota firmada |
| «el teléfono graba sin pedir consentimiento» | el banco se pisaba a sí mismo: `yaConsintio` lee el **expediente**, y la corrida de escritorio ya había consentido a ese paciente |

Esa última fila es la más instructiva. Corregida —un paciente por ancho— el
teléfono **sí** llegó a la compuerta, y ahí apareció el defecto de verdad.

---

## El defecto que el banco encontró, y que estaba tapado por un defecto del banco

### P1 BLOQUEANTE · la barra del pulgar tapaba la compuerta de consentimiento

Reproducción: teléfono 390×844, `/consulta/<paciente que no ha consentido
nunca>`, pulsar «Grabar la consulta».

Medido con el modal abierto, **antes**:

```
botón «Confirmo el consentimiento e iniciar»   779 → 823
.bottom-nav empieza en                         791
document.elementFromPoint(centro del botón)    <a> de la barra
tapado                                         true
```

El clic agotaba 30 s sin llegar nunca. **En el teléfono no se podía empezar a
grabar a un paciente que no hubiera consentido antes**, y no había salida:
«Cancelar» estaba igual de tapado. Es la compuerta legal del instrumento
principal del producto, sin salida, en el ancho en el que más se usa.

**Causa raíz.** Por debajo de 768px el modal es una hoja inferior
(`.modal-overlay { align-items: flex-end; padding: 0 }`), así que se pega al
borde de abajo — donde vive la barra del pulgar. `<main>` ya reservaba esa banda
desde V15-MOBILE-001, con su comentario explicando que «si solo dejáramos 70px,
esos botones quedaban debajo y no se podían tocar». **La hoja inferior nunca
recibió la misma reserva.** Un contenedor aprendió la lección y el otro no.

**Reparación mínima.** El pie de la hoja reserva la MISMA banda que `<main>`,
con la misma constante (`72px + env(safe-area-inset-bottom)`) — la misma a
propósito: dos reservas distintas de la misma barra divergen la primera vez que
la barra cambie de alto. La reserva va en el PIE y no en el overlay para que la
hoja siga pegada al borde.

**Después**, mismo ancho, mismo modal:

```
botón                                          707 → 751
document.elementFromPoint(centro del botón)    button.btn.btn-primary
tapado                                         false
```

Guardián: `v15-la-hoja-inferior-no-la-tapa-la-barra.test.ts` (4 casos),
**probado al revés ×3** — quitar la reserva, cambiarle el número, olvidar el
área segura: cada reversión muerde los casos que le tocan.

**Lo que el guardián NO cubre, dicho:** el overlay declara `z-index: 100` y la
barra `45`, y aun así la barra ganaba el `elementFromPoint`. **Por qué
exactamente, sigue sin explicar**, y se deja escrito en vez de inventar una
razón. La reserva es cierta gane quien gane el apilado; si alguien arregla el
apilado, deja de ser lo único que sostiene el caso.

### P1 BLOQUEANTE · el respaldo local se escribía, se conservaba y no llegaba

Reproducción: `/consulta/<paciente>?nota=<nota>`, teclear, esperar a que pase el
debounce de 1 500 ms, recargar (el teléfono que se queda sin memoria).

Medido **antes**:

```
claves de respaldo tras teclear   ["nx.consulta.bkp.pac-luzmaria-cervantes"]
¿el texto sobrevive?              false
¿se ofrece restaurar?             false
claves tras recargar              ["nx.consulta.bkp.pac-luzmaria-cervantes"]
```

El respaldo estaba en disco, intacto, las dos veces. La pantalla no lo ofrecía.
Y el autoguardado a Firestore corre cada 30 s: la ventana de pérdida silenciosa
era de hasta medio minuto de nota. Control negativo de la misma corrida: el
mismo gesto **sin** `?nota=` sí conserva lo escrito.

**Causa raíz: una condición haciendo dos trabajos.** «Aplicarlo solo» y
«ofrecerlo» estaban gobernados por la misma prueba —que el formulario estuviera
vacío—. Para aplicar solo es la prueba correcta y no se toca. Para ofrecer es la
prueba equivocada: al reabrir una nota concreta el formulario **nunca** está
vacío, porque trae la nota. La única rama capaz de enseñar el respaldo se
apagaba justo en el caso para el que existe. Familia
`.claude/rules/el-dato-tiene-que-llegar.md`.

**Reparación mínima.** `queHacerConElRespaldoLocal` en
`@/lib/mobile/local-drafts` —que ya era dueño de la clave y del pestillo
anti-resurrección; **no se creó módulo nuevo**— devuelve `APLICAR_SOLO`,
`OFRECER` o `CALLAR`, y las dos ramas de la pantalla la comparten para que no
puedan divergir. Calla si el respaldo es de otro encuentro, si no puede
demostrar de cuál es, o si la nota está firmada (inmutable, NOM-024).

**Después**: `se ofrece restaurar: true`, en los dos anchos.

Guardián: `v15-el-respaldo-local-llega-al-medico.test.ts` (13 casos), **probado
al revés ×3**.

---

## La matriz, corrida final (20/20)

Todas las cifras salen de `acta-flujos.json`. «Pantallas» = alto de `<main>`
dividido por su viewport: lo que le cuesta al médico recorrerla.

| | escritorio 1440×900 | móvil 390×844 | pasos | clics | nav | atrás | pérdidas | callejones | scroll (máx) |
|---|---|---|---|---|---|---|---|---|---|
| **WF-01** Hoy → quién sigue → encuentro | COMPLETA | COMPLETA | 3 | 1 | 1 | 0 | 0 | 0 | 3.6 / 5.1 |
| **WF-02** buscar → identificar → estado → seguir | COMPLETA | COMPLETA | 4 | 1 | 1 | 0 | 0 | 0 | 1.9 / 3.0 |
| **WF-03** expediente → nota → procedencia → vuelta | COMPLETA | COMPLETA | 4 | 2 | 0 | 0 | 0 | 0 | 2.5 / **15.9** |
| **WF-04** encuentro → grabar → pausa/reanudar → cierre | COMPLETA | COMPLETA | 6 | 5 | 0 | 0 | 0 | 0 | 3.6 / 4.6 |
| **WF-05** encuentro → receta → vuelta | COMPLETA | COMPLETA | 4 | 1 | 2 | 1 | 0 | 0 | 2.9 / 4.9 |
| **WF-06** asunto → revisar → decidir → actuar | COMPLETA | COMPLETA | 3 | 2 | 0 | 0 | 0 | 0 | 2.1 / 7.8 |
| **WF-07** pendientes → por qué → fuente → vuelta exacta | COMPLETA | COMPLETA | 4 | 2 | 2 | 0 | 0 | 0 | 2.5 / 7.8 |
| **WF-08** Hoy → continuidad → fuente → vuelta exacta | COMPLETA | COMPLETA | 4 | 2 | 2 | 0 | 0 | 0 | 2.5 / 7.7 |
| **WF-09** operaciones → excepción → destino | COMPLETA | COMPLETA | 2 | 1 | 1 | 0 | 0 | 0 | 2.4 / 3.2 |
| **WF-10** interrupción móvil → regreso | COMPLETA | COMPLETA | 4 | 0 | 0 | 0 | 0 | 0 | 3.1 / 4.8 |

**20 corridas · 20 completas · 0 pérdidas de contexto · 0 callejones.**

### Lo que cada flujo demostró, con su dato

- **WF-01** — Hoy nombra a quien sigue y el encuentro que abre es **el mismo
  paciente**, comprobado contra el nombre leído en Hoy antes de pulsar. Un clic.
- **WF-02** — «Cervantes» **discrimina**: 8 pacientes → 1. Al aterrizar, el
  momento del paciente es legible sin abrir nada (`Borrador · Firmada`).
- **WF-03** — 2 notas abribles, la procedencia se inspecciona **sin salir del
  expediente**, y la vuelta aterriza en la misma ruta. En el teléfono el
  expediente mide **15.9 pantallas**: el número más alto del banco (deuda P2).
- **WF-04** — el ciclo entero, **intentado, no leído**:
  `consentimiento → grabando → enPausa → reanudada → cerrada`, comprobado por
  transición de estado, no por presencia de botón.
- **WF-05** — se sale a la receta desde el cierre del encuentro firmado y se
  vuelve **a la misma nota** (`?nota=` incluida).
- **WF-06** — la lente contesta **las cuatro** preguntas de §10, y la acción de
  avance vive junto al asunto.
- **WF-07 / WF-08** — el contrato de regreso de §21 funciona **entero**: testigo
  opaco en la URL, regreso rotulado con el sitio («Volver a Pendientes»,
  «Volver a Hoy»), scroll restaurado al píxel (120 → 120) y **el foco de vuelta
  al control que abrió la inspección**.
- **WF-09** — la franja no es un índice: `Pide atención (2)`, cada excepción con
  su recuento, su detalle, su dueño y su destino («2 · Citas sin responder — 2
  sin confirmar… — Responde: el consultorio → /citas»), y respalda lo que **sí**
  comprobó («Sin novedad: lista de espera»).
- **WF-10** — vuelve al mismo paciente y al mismo encuentro, y ahora **ofrece**
  el trabajo a medias.

---

## Veredicto contra la intención de V15

| | veredicto | con qué dato |
|---|---|---|
| UN PACIENTE | **PASS** | 0 pérdidas de ancla en 20 corridas; 0 casos de dos identidades a la vez; WF-01 comprueba que el encuentro abre el paciente que Hoy nombró |
| UN ESPACIO CLÍNICO | **PASS** | ningún flujo clínico obliga a pasar por administración; Operaciones queda fuera del camino clínico a propósito |
| UN MOMENTO ACTUAL | **PASS** | el estado es legible al aterrizar en las superficies medidas (WF-02, WF-04 firmada/sin firmar, WF-09 franja) |
| UNA SIGUIENTE ACCIÓN SEGURA | **PASS** | recuento de rellenos primarios por paso en el acta; la compuerta de consentimiento **ya no se puede saltar ni quedar fuera de alcance** |
| CONTEXTO PRESERVADO | **PASS** | ruta, scroll y foco restaurados en WF-07/08; WF-05 vuelve a la misma nota; WF-10 vuelve al mismo encuentro |
| EQUIVALENCIA FUNCIONAL | **UNVERIFIABLE (antes) / PASS (después)** | no hay evidencia pre-V15 en términos de flujo y **no se reconstruye de memoria**; lo que sí se afirma es que nada del banco regresó: suite completa en verde |
| SEGURIDAD CLÍNICA PRESERVADA | **PASS, y mejorada en dos puntos** | consentimiento alcanzable en el teléfono; el respaldo de una nota deja de perderse en silencio |

**BEFORE = UNVERIFIABLE** en clics, pasos y tiempos. No existe medición pre-V15
de estos flujos en este repositorio, y fabricar un «antes» de memoria sería peor
que no tenerlo. Los flujos se miden **en absoluto**.

**Competidores: no se compara.** No hay evidencia comparable de Abridge, Suki,
Nabla ni Huli en este árbol, y afirmar que Ausculta es más rápido sin ella sería
inventarlo.

---

## Deuda registrada, NO pagada

Se registra; no se repara. Esta iteración es de banco, no de pulido.

1. **P2 · Hoy mezcla el reloj del consultorio con el del dispositivo.**
   `stats.prox` filtra por la FECHA del consultorio (`hoyISO()`, zona MX) pero
   compara la hora con `new Date().toTimeString()`, que es la del **navegador**.
   Medido: con el contenedor en UTC y una cita sembrada 40 min por delante en
   hora de México, **el héroe NOW no se pinta**. Al médico con su teléfono en
   hora de México no le pasa; al que viaja, o al que tiene el reloj mal, sí. El
   banco lo esquiva fijando `timezoneId: 'America/Mexico_City'`, que es lo que
   vive el usuario real — pero la mezcla sigue ahí.
2. **P2 · el expediente mide 15.9 pantallas en el teléfono.** El número más alto
   del banco, con diferencia (el segundo es 7.8). No bloquea WF-03, que se
   completa; es carga de lectura.
3. **P3 · el `<h1>` de la receta nombra la herramienta, no al paciente**
   («Generador de Receta»). La identidad la sostiene la franja del shell, que es
   persistente y **se ve en los dos anchos** — por eso no es defecto de
   seguridad. Pero es la única superficie clínica medida cuyo encabezado
   dominante no es el paciente.
4. **P3 · el cierre del encuentro no acusó lo hecho al volver de la receta**
   (`el cierre recuerda lo hecho: false`). `marcarHechoDeCierre` se llama al
   salir; que no se refleje al volver por esta vía queda anotado sin diagnosticar
   — está fuera del alcance del banco y no rompe WF-05.
5. **Deuda heredada, intacta:** el aviso de notificaciones sobre la Capa 4 en el
   teléfono · `alergiasDe` partiendo dentro del paréntesis · la divergencia de
   `mostrarAlergias` entre `/orden` y `/receta` · RTC-12(a) · la compuerta de
   firma que no mira la prosa. Ninguna se tocó.

## No comprobable, con la dependencia dicha por su nombre

- **La transcripción y la nota que nace de ella** (WF-04): sin llaves del
  proveedor en este contenedor — `503` en `transcribir-chunk`, los mismos que ya
  registró la Iteración 16. Un paso no comprobable **no se cuenta como PASA**.
- **La comunicación real al paciente** (WF-06): no hay mensajería en el
  contenedor, y mandar mensajes reales está prohibido sin autorización del dueño.
- **`PORTAL_PACIENTE_SECRET no configurada`** (WF-05): los dos `500` de la
  receta son ese secreto ausente, no un defecto del producto.

Los 10 errores de consola del acta son **exactamente** esos dos grupos: 6×503
del proveedor de transcripción y 4×500 del secreto del portal. **Los ocho flujos
restantes corrieron con 0 errores de consola en los dos anchos.**

## Qué NO cubre este banco

- No mide tiempo de percepción humana: los ms son de máquina en un contenedor
  sin carga, sirven para comparar pasos entre sí dentro de una corrida.
- No sustituye a axe; sólo comprueba lo que el propio flujo necesita.
- No prueba el multi-consultorio: una sola identidad sembrada.
- WF-05 necesita una **siembra aditiva**
  (`sembrar-receta-en-nota-firmada-v15.mjs`): ninguna nota de la siembra base
  lleva medicamentos, así que sin ella el camino a la receta no existe — por el
  corpus, no por el producto.
