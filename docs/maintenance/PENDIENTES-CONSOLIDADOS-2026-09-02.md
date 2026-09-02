# Todos los pendientes de NexusMED — consolidado del 2-sep-2026

> **Para qué existe.** El dueño pidió: «ve todas las conversaciones y en una sola
> ponme todos los pendientes». Los pendientes de este proyecto no viven en el
> chat: viven en el estado persistente que cada sesión deja escrito. Este
> documento los reúne **todos en un sitio**, sin resumirlos hasta volverlos
> inútiles y sin inventar ninguno.

## ACTUALIZACIÓN — más tarde el mismo día

Tres cosas de esta lista **se cerraron después de escribirla**, y se dicen aquí
arriba para que nadie las trabaje dos veces:

1. **Los doce índices de Firestore están CONSTRUIDOS.** El dueño abrió la consola
   de `nexomed-agenda` → Índices → Manuales y mandó las dos páginas: los doce
   dicen «Habilitado», ninguno compilando ni en error, y coinciden campo por
   campo con lo declarado. Cierra REG-431 y REG-433. Era el renglón que llevaba
   abierto desde el 31-ago y el único punto abierto de **tres** conversaciones
   distintas.
2. **El permiso que faltaba está concedido.** `roles/datastore.indexAdmin` — lo
   puso el dueño en IAM. Era la mitad que hacía que el despliegue contestara
   `success` sin publicar nada.
3. **Los cuatro PRs que se solapaban (#433, #434, #435, #436) se unificaron en
   uno y se fusionaron.** Ya no hay tres versiones del mismo hecho en el ledger.

**Y aparece un pendiente nuevo, que ya no es una decisión sino un botón**: el
backfill de `pesoUrgencia` (REG-436). Pedía una credencial de cuenta de servicio
que sólo vive en los secretos del repositorio: nadie podía reunir las dos mitades,
y llevaba meses etiquetado «pendiente de decisión del dueño», que es la etiqueta
que nadie vuelve a mirar. Ahora es
`.github/workflows/backfill-peso-de-urgencia.yml`, con `escribir` en `false` por
omisión: pulsarlo sin tocar nada **sólo lee y cuenta**.

---

## SEGUNDA ACTUALIZACIÓN — cinco conversaciones más

El dueño enseñó otras cinco. Traen **tres pendientes que no estaban** en este
documento, y uno de los tres es trabajo terminado que no llegó al producto.

### 1 · ~~Un arreglo del teléfono está escrito, probado, subido — y NO está en el producto~~ **CERRADO**

> **Rescatado y en producción el 2-sep-2026** como **REG-437**, PR #439 (CI 5/5),
> fusionado con autorización del dueño. **Y confirmado en un iPhone real**: abrió
> la consulta y la franja de alergias se lee entera.
>
> **No cierra WS-05.** El rebote elástico es otra prueba y sigue sin correrse.
> Que el ancho esté bien no dice nada del rebote.

Lo que decía este apartado, conservado:

`5ce5da80` · **«la lista de alergias no cabía en el teléfono»** — se salía 182 px
en `/consulta`. Vive en la rama `claude/ausculta-product-transformation-mckih5`.
**Su PR (#433) se cerró antes de que el commit llegara**, así que el commit quedó
huérfano: verificado hoy contra `main`, su golden (252 líneas) y sus cambios a
`consulta-ui.tsx`, `page.tsx` y `globals.css` **no están** en `main`.

Su gemelo sí entró: **REG-434**, la cita de la portada que se pintaba a una
palabra por renglón, está en el ledger de `main`.

**Qué hace falta**: renumerar ese commit a **REG-437**, traer `main` dentro (la
rama va **9 commits por detrás**) y abrirlo en un PR nuevo. Nadie lo ha hecho
porque cada sesión lo ve como trabajo de otra.

### 2 · Y el número con el que se subió ya estaba dado — tercera colisión del mismo día

El commit usa **REG-436**, y `main` le dio ese número al backfill a las 04:35;
el commit llegó a las 04:47. Doce minutos.

**La causa no es descuido, y va a repetirse**: el contador de regresiones es
global, se asigna a mano, y **el guardián comprueba que cada número tenga ficha,
no que sea único frente a lo que otra rama abierta ya reclamó**. Es la misma
colisión que enseña REG-267. Hoy pasó tres veces.

**Pendiente de verdad**: un guardián que mire **todas las ramas vivas**, no sólo
el árbol propio. La herramienta existe a medias
(`scripts/estado-de-las-ramas.mjs`, del 8-ago) y nadie la ató al guardián.

### 3 · NUEVO · Seis analitos esperan una cifra que sólo el médico puede dar

No es el rango de referencia y **no es «lo normal»**. Es el **rango plausible**:
*fuera de esto, casi seguro que el número viene en otra unidad*. Sirve para tirar
un valor que ensuciaría la gráfica, no para decir si el paciente está sano.

La pregunta, que se contesta de memoria: **¿cuál es el valor más bajo y el más
alto de este analito que has visto —o que podrías creerte— en un paciente vivo?**

| Analito | Unidad esperada |
|---|---|
| ácido úrico | mg/dL |
| ferritina | ng/mL |
| vitamina D | ng/mL |
| VCM | fL |
| neutrófilos | % |
| linfocitos | % |

Ejemplo del que ya está: la glucosa va de **20 a 1500 mg/dL** — no porque 1500
sea normal, sino porque 1600 sería un error de captura y 7,2 sería mmol/L.

**Alternativa si prefiere no dar números**: una fuente citable (el catálogo de su
laboratorio de referencia, una edición concreta de un texto) y se cita en el
módulo. Lo que no se puede es rellenarlas: son cifras clínicas y salen impresas
al lado de su cédula (regla 1 de seguridad clínica).

**Aparte, y es otra decisión**: la glucosa que llega **en mmol/L**. Ahí el analito
ya existe y el problema es la unidad del SI — pide convertir o marcar, no un rango.

### 4 · Dos botones que son suyos, y ya existen

- **Backfill de urgencias** — Actions → «Backfill de pesoUrgencia (manual)» → *Run
  workflow*, **sin marcar nada**: cuenta y no escribe, y los recuentos salen en el
  resumen de la ejecución, no en el log. Dice el número y se decide si vale la
  pena marcar `escribir`. Nunca imprime contenido, sólo números: esas tareas
  llevan datos de pacientes.
- **Botón de producción**, cuando quiera certificar. El pin va en `59a11d6b`
  (v1179) y `main` ya va por delante — conviene comprobar la Compuerta 0 antes de
  apretarlo, o repuntarlo.

---

## Qué se leyó para escribirlo, y qué NO

**Se leyó** (todo el estado durable del repositorio, al día de hoy):

`agent-state/` completo — `MASTER_STATE.json`, `BLOCKERS.md`,
`OWNER_DECISIONS_REQUIRED.md`, `RISK_REGISTER.md`, `ASSUMPTIONS.md`,
`BACKLOG.json`, `V10_BACKLOG.json`, `V10_BLOCKERS.md`,
`V10_OWNER_DECISIONS_REQUIRED.md`, `AUSCULTA_LAST_SAFE_CHECKPOINT.md`,
`LAST_SAFE_CHECKPOINT.md`, `CURRENT_ITERATION.md`, `V15_CURRENT_ITERATION.md` ·
`docs/product/AUSCULTA-CONSULTORIO-FINAL-READINESS.md` y
`AUSCULTA-MASTER-BOARD.md` · `docs/maintenance/ESTADO-DE-PRODUCCION-2026-09-01.md`
y `PRS-SIN-ABSORBER-2026-08-30.md` · `docs/roadmap/nexus-os/` · y los 10 PRs
abiertos en GitHub.

**No se leyó, porque no es legible desde aquí**: el texto literal de las
conversaciones anteriores. Un pendiente que sólo se dijo de viva voz y que nadie
escribió en el repositorio **no está aquí**, y no hay forma de saber cuántos son.
Si el dueño recuerda alguno, se añade.

**Nada de este documento es trabajo nuevo**: es inventario. No se cerró ni se
abrió ningún pendiente al escribirlo.

---

# A · LO QUE ESPERA UNA DECISIÓN DEL DUEÑO

Ninguno de estos lo puede decidir un agente. Todos están frenados hasta que haya
una respuesta, y **ninguno bloquea al resto del trabajo**.

## A.1 Clínicas

| # | Qué se pregunta | Recomendación por omisión | Qué sigue sin la respuesta |
|---|---|---|---|
| C-1 | Validar los **23 motores clínicos** marcados `pendiente_validacion` (+1 experimental) | Revisarlos por lotes, empezando por los que tocan dosis | Todo lo demás; la marca de «no validado» es honesta |
| C-2 | Las **~39 recomendaciones de inmunología sin fuente** (`docs/maintenance/INMUNO-RECOMENDACIONES-SIN-FUENTE.md`) | Citarlas o retirarlas de pantalla | Se muestran declarando que no tienen fuente |
| C-3 | **Clasificación de seguridad por fármaco** (alto riesgo) | Empezar por insulina, anticoagulantes, opioides y vasopresores | El cruce alergia↔fármaco y el motor de dosis ya corren |
| C-4 | ¿Un flujo de O₂ registrado implica «recibe O₂ suplementario» para **NEWS2**? | **No deducirlo** | NEWS2 corre y declara la duda con ⚠ |
| C-5 | ¿El **motivo** de una corrección de signos es obligatorio? | Pedirlo y enseñarlo, sin bloquear | Se pide y se declara en ámbar |
| C-6 | ¿Un CrCl a menos de 1 mL/min del umbral merece aviso de «estás en la frontera»? | **No por omisión** — sería fatiga de alerta en 18 umbrales | El umbral funciona; REG-214 ya devolvió las alertas del borde |

## A.2 Política de registro clínico — cuatro preguntas, cuatro frases

**Estado: sin responder. Mientras tanto, corregir una toma de signos o una
administración ya registrada NO está habilitado en el producto.** El motor
(`validarCorreccion`) está escrito y probado; `POLITICA_CORRECCION` nace en `null`
a propósito, para que el valor sea del dueño y no un supuesto enterrado.

1. **¿Quién puede corregir?** (médico, enfermería, farmacia, laboratorio, administración)
2. **¿Quién puede ANULAR una administración de medicamento?** — va aparte: anular borra la constancia de que algo se dio.
3. **¿Cuántas horas después se admite corregir?** ¿Y en un episodio ya egresado?
4. **¿El motivo escrito es obligatorio?**

## A.3 Retención del audio de la consulta

El dueño ya autorizó **conservarlo** (8-ago-2026). Falta **el periodo**.
Recomendación por omisión: alinearlo con el expediente de NOM-004 y borrar al
vencer (exige una tarea de limpieza). Alternativas: indefinido · borrar al firmar
—se pierde el clic-a-audio— · un plazo fijo.
**Bloquea sólo el borrado automático**; el clic-a-audio funciona igual.

## A.4 D-08 · ¿Se sube el sello a v4 para cubrir la transcripción de origen?

> **Ojo — esto está desactualizado en el archivo original.** El sello **v4 ya se
> hizo** (REG-377): `transcripcionMotor` entra al sello sin volver «alterada» ni
> una nota firmada. Lo que sigue abierto NO es el sello, es **el acto**: un sitio
> donde el médico confirme lo que el extractor oyó, porque documentar un
> procedimiento es suyo (REG-370). Cuando exista quien lo escriba, entra con su
> propio v5.

## A.5 D-09 · ¿Qué puede decidir un router de coste/calidad de IA? — `BLOCKED_BY_OWNER`

El PR **#345** trae un router de coste/calidad con modo sombra (16 archivos que
`main` no tiene). Choca de frente con una decisión vigente del dueño: *«la nota
usa el razonamiento premium —no escatimar—; no bajar de modelo por velocidad sin
avisar»*. Tres respuestas cortas lo desbloquean:

1. ¿El router puede elegir modelo **en la nota clínica**, o ahí manda siempre el premium y el router sólo actúa en lo demás (resúmenes, extracción, búsquedas)?
2. Si puede bajar de modelo en algún camino, **¿el médico se entera?** ¿Dónde?
3. ¿Vale con **modo sombra** primero —decide y se registra, pero no manda— hasta ver sus números?

## A.6 Evaluación

| # | Qué | Recomendación |
|---|---|---|
| E-1 | ¿Se pueden reinyectar transcripciones de producción **desidentificadas** al corpus? | **No, por omisión.** La voz es biométrica |
| E-2 | Corpus **oro** de temporalidad (EVAL-002): ¿quién etiqueta? | **Usted, sobre frases sintéticas.** Un oro etiquetado por quien escribió el motor mide su propia opinión |

## A.7 Comerciales

| # | Qué | Recomendación |
|---|---|---|
| N-1 | ¿Se puede repetir la prueba de 14 días? | Una por cuenta, comprobada contra Stripe |
| N-2 | Verificación de correo al registrarse | Activarla: un correo mal tecleado deja la cuenta irrecuperable |

## A.8 Otras decisiones nombradas en el estado V15

- **`TOPE_VISIBLE` de 5** en las filas de continuidad de «Hoy» (en el teléfono la pantalla crece de 887 a 1124 px). La palanca es del dueño.
- **Divergencia de `mostrarAlergias` entre `/orden` y `/receta`** — congelada por su guardián, esperando decisión.
- **La compuerta de firma no mira la prosa** — decisión del dueño, no trabajo de agente.
- **P1-6 / E0-06 · alergias fuera de `Patient`** — necesita (1) autorización para correr el backfill contra producción, (2) decisión sobre si recepción conserva algún acceso, (3) despliegue de reglas.
- **Subconjunto reproducible de evidencia** (qué licencias de PMC se consideran reproducibles) — el catálogo lo declara así.

---

# B · BLOQUEADO POR ALGO DE FUERA — credenciales, consolas, aparatos, terceros

El trabajo interno está hecho. Falta una acción que **no se puede ejecutar desde
el repositorio**.

## B.1 Credenciales y variables de entorno

| Qué falta | Dónde | Qué no funciona mientras tanto |
|---|---|---|
| `OPS_ALERTA_WEBHOOK` | Vercel | Las alertas de operación no llegan a un humano (la franja dentro de la app ya avisa) |
| `TIPO_CAMBIO_USD_MXN` | Vercel | La contabilidad no convierte el costo de IA a pesos; lo declara como supuesto |
| `STRIPE_WEBHOOK_SECRET` | Vercel | Nombrado en `MASTER_STATE.json` como bloqueo vivo |
| Llave de **AssemblyAI** en la máquina local | `vercel env pull` la devuelve `[SENSITIVE]` | **B-11**: el corpus actuado (12 diálogos, 72 turnos, 5m12s, con el milisegundo de cada turno) está generado y **sin medir**. Corpus y medidor ya hechos y probados: en cuanto haya llave, es **un comando** |
| Cuenta de prueba en los **secretos de CI** | GitHub | El E2E sólo cubre lo público |
| **App Check** activo | Consola Firebase | Implementado; que esté activo es externo |

## B.2 Consolas de Google Cloud / Firebase

| Qué falta | Comando / acción exacta |
|---|---|
| ~~Ver los DOCE índices `Enabled`~~ | **CERRADO el 2-sep-2026.** Verificado en la consola por el dueño: los doce «Habilitado», y coinciden campo por campo con `firestore.indexes.json` — ninguno de más (sería un índice huérfano pagándose sin usarse) ni de menos |
| **PITR** | `gcloud firestore databases update --database='(default)' --enable-pitr --project nexomed-agenda` |
| **Ensayo de restauración real** (B-05 / O-2) | `gcloud firestore databases restore --source-backup=<backup> --destination-database=<base-de-ensayo>` — **sobre una base de PRUEBA, nunca producción**. De ahí sale el **RTO real**, que es lo que responde un hospital |
| **Backfill de `pesoUrgencia`** contra datos vivos | **Ya no necesita terminal ni credencial en mano** (REG-436): Actions → «Backfill peso de urgencia». `escribir` nace en `false`, así que pulsarlo sin tocar nada **lee y cuenta**; el script sólo añade un campo derivado y es idempotente. Sin esto, `/pendientes` ordena por antigüedad y lo dice en pantalla |

> Reglas de Firestore: **desplegadas y selladas el 31-ago-2026**. Índices:
> **enviados**, los doce; falta verlos construidos.

## B.3 Aparatos

**Un iPhone real — WS-05, el rebote elástico.** Es lo único que no tiene mitad
automatizable en este frente. Lo automatizable ya corre en CI (REG-380).

Dos caminos, cualquiera vale:

1. Abrir la política de red del entorno a `cdn.playwright.dev` y
   `playwright.download.prss.microsoft.com` → `npx playwright install webkit` y
   corre el proyecto `iphone-safari` que `playwright.config.ts` ya declara
   (hoy: **403 por política**, confirmado por el proxy como `connect_rejected`).
   Eso da **la mitad**.
2. Un iPhone en la mano, en `/consulta` con una nota larga:
   - arrastrar hasta el final y **seguir arrastrando** — no debe aparecer el rebote del documento entero;
   - dictar mientras se lee una parte de arriba — la pantalla **no** debe saltar al llegar la transcripción;
   - abrir la consulta de un paciente hospitalizado y esperar sin tocar — es cuando llega `internamientoActivo` y el restaurador podría escribir la posición tarde.

Queda además abierto **el cuarto mecanismo**: los banners asíncronos que cambian
la altura por encima de `<main>` (41 px medidos por `PorQueEstaAqui`). Sacarlos
del flujo es un cambio de layout y no se hace a ciegas.

## B.4 Terceros

| Qué | Estado |
|---|---|
| **Pentest externo** | La única de la lista **sin mitad automatizable**. WS-13 queda `PARTIAL` hasta entonces, con las 99 rutas revisadas y el analizador estático como lo que son: trabajo propio, no una auditoría |
| **Licencias comerciales de evidencia** | UpToDate, Cochrane, Scopus, DynaMed, OpenEvidence. Sin acuerdo se quedan en `not_configured`; el código ya **falla cerrado** |
| **Titularidad del código a nombre de una sociedad** | Bloqueo nº1 de la sala de datos |
| **Requisitos legales de la receta impresa** | Sin resolver |
| **B-01 · Medir el reconocedor sobre los 6 000 audios del corpus V3** | Autorización para gastar en la API de transcripción. Hay caché: se paga **una sola vez**. Los audios (429 MB) están en disco y **no hay una sola transcripción cacheada** |
| **B-02 · Corpus de consulta ambulatoria con diálogo** | Decisión: grabaciones reales desidentificadas **con consentimiento**, o audio actuado/sintético con guion. Sin él no se mide diarización, atribución de rol ni solapamiento |

---

# C · TRABAJO TÉCNICO PENDIENTE — no necesita al dueño

## C.1 Ausculta · los workstreams que no están cerrados

| WS | Estado | Qué falta de verdad |
|---|---|---|
| **02** Escala / 100 k | `PARTIAL` | La corrida del 1-sep dio 3 120 peticiones, 0 errores, 317,1 pet/s, p95 476 ms, 0 fugas en 156 sondas. **Once campos van en `null` con su razón y el validador RECHAZA el informe** — que es lo correcto. No es producción y no son 100 k. Escalones 10 k y 100 k: `PARTIAL`/`NOT_STARTED` |
| **03** Consultorio grande | `PARTIAL` | Quedan **28 lecturas de Consultorio y 9 de Hospital** inventariadas, con techo que sólo baja |
| **04** Resiliencia | `PROVEN` (interruptor) | **Colas y contrapresión: `NOT_DONE`.** Y **WhatsApp y Evidence siguen sin interruptor** (tienen timeout y el outbox backoff, pero no pasan por la puerta de REG-353). El estado del interruptor es **por instancia**, no global |
| **05** Móvil / iPhone | `BLOCKED_EXTERNAL` | Ver B.3 |
| **06/07/08** Evidencia | `PARTIAL` | Licencias comerciales, `BLOCKED_EXTERNAL` |
| **09** Aplicabilidad | **`NOT_DONE`** | **No hay motor que diga si una evidencia aplica a ESTE paciente.** Es el workstream entero sin empezar |
| **10** Patient State | `PARTIAL` | Falta: **registro estructurado de procedimientos y dispositivos** (necesita el ACTO: una pantalla donde el médico confirme lo que el extractor oyó) · **persistir las proyecciones** (arrastra los tres sitios de declaración de una colección) · **pantalla donde el médico elija el tipo de un diagnóstico** |
| **11** Ciclo cerrado | `PARTIAL` | Falta `scheduled` como estado, el cierre desde otras pantallas, y **interconsultas, referencias e imagen**, que siguen fuera del ciclo |
| **12** Evaluación | `PARTIAL` | Falta **evaluar lo que el modelo REDACTA** (corpus, jueces) y las **otras cuatro clases de respuesta**, que están en el tipo y no tienen clasificador. El *entailment* sigue siendo requisito |
| **13** Seguridad · DR | `PARTIAL` | Pentest, PITR, restore real, ver índices `Enabled`. **Y MFA: TOTP implementado y funcionando, pero `security-controls.ts:75` sigue diciendo `planned`, y NO se exige en el servidor en ningún sitio — una sesión sin segundo factor tiene privilegios idénticos** |
| **22/23/24** Especialidad | `PARTIAL` | — |

**Además, sin ejecutar**: las fases de prueba final — carga real, inyección de
fallos, restauración, benchmarks y equipo rojo.

**Abierto y nombrado**: `P1-19` — la ruta de evidencia de la consulta y su
producción de `Source` con procedencia estructurada (#314) se cerró con REG-359,
pero el *entailment* (que la cita **diga** eso, no sólo que exista) sigue siendo
requisito de WS-12. Anclar no es entender, y el aviso lo dice: «no se pudo
comprobar», no «es falso».

## C.2 Backlog V7/V9 — 8 ítems abiertos

| Id | Qué | Score |
|---|---|---|
| `PATIENT-TELE-002` | El **enlace de videoconsulta que viaja por WhatsApp sigue sin token**. Desde REG-265 manda «recibirás el enlace» en vez de un 404 — honesto, pero el paciente sigue sin enlace | 55 |
| `EVAL-001` | Medir el reconocedor sobre los 6 000 audios (bloqueado B-01) | 58 |
| `EVAL-003` | **Trinquete de voz en CI con el corpus en el repositorio.** Hoy los tres scripts no corren en CI porque el corpus vive en el disco del dueño: pasan en verde sin medir nada | 48 |
| `NAV-NAVEGADOR-001` | **Seis comprobaciones que sólo un navegador resuelve; dos pueden ser P0** — sobre todo si el botón central de `BottomNav` **remonta la consulta** estando en ella (mataría una grabación vía PATIENT-AUDIO-002) | 44 |
| `SAFE-003` | «Sin referencia de dosis» se descarta **también en niños**. En pediatría la dosis va por kilo: callar que no hay referencia se lee como que la dosis está comprobada | 41 |
| `DESIGN-MIGRAR-001` | Nadie usa todavía las utilidades `nx-`. El trinquete mide lo que falta: **565 hex en línea, 2 029 tamaños fuera de escala, 638 radios, 24 sombras** | 30 |
| `PATIENT-PREVIO-001` | **No se comprobó dónde se pinta el formulario previo del paciente.** Es lo ÚNICO que el paciente escribe hoy; si no se pinta en ninguna pantalla, está rellenando un formulario que nadie lee | 24 |
| `DESIGN-TABLAS-001` | Nueve tablas con `minWidth` 520-720 y tres sin envoltorio: se desbordan a 375 px (7 de 9 son superadmin) | 22 |
| `PATIENT-I18N-001` | `src/lib/i18n.ts` existe, está escrito y **no lo importa nadie**. La superficie del paciente son ~180 cadenas | 18 |

## C.3 Backlog V10 — 23 abiertos + 3 parcialmente cerrados

**Accesibilidad (lo más grave, y lo más barato):**

- `V10-A11Y-BOTONES-SIN-NOMBRE` — **P1, axe CRÍTICO**, parcialmente cerrado: botones sin nombre accesible (FAB de tema en TODAS las pantallas + iconos chat/lápiz/kebab). Un lector anuncia «botón» y nada más. `aria-label` es reversible y no toca lógica.
- `V10-A11Y-CONTRASTE-CTA` — contraste <4.5:1 en el **CTA primario** del dashboard, «Registrar cobro» y ranuras del calendario.
- `V10-A11Y-CALENDARIO-ANIDADO` — `role=button` dentro de `role=button`: el interno no es alcanzable por teclado; ranuras bajo el mínimo táctil.
- `V10-LOGIN-A11Y` — contraste en secundarios; luna ~40 px, bajo el mínimo táctil.

**Riesgo de lectura real (no cosmético):**

- `V10-FECHAS-INCONSISTENTES` — «Hoy 2026-08-09» (ISO) junto a `08/09/2026` (formato US), que en es-MX se lee **8 de septiembre**. Elevado a P2 por el revisor independiente.
- `V10-EXPEDIENTE-EDAD` — separador «·» huérfano cuando falta edad; la edad sólo sale del campo `edad`, no se deriva de `fechaNacimiento`.
- `V10-E006-LECTURA-LEGADA` — el expediente lee alergias **sólo** del campo legado `patient.alergias`; cuando E0-06 termine la migración, **la página mentirá** si no se cambia. Coordinar con E0-06.
- `V10-CONSULTA-001` — la alergia sale **dos veces a 40 px** en `/consulta` (franja + píldora); en móvil la franja trunca sin envolver. Señal de seguridad: revisar con `clinical-safety` antes de tocar.

**Estructura y sistema de diseño:**

- `V10-DEBT-001` / `V10-DEBT-002` — **desbloqueados** (V9 ya se fusionó): la aplicación no obedece al sistema de diseño — **6 065 `style={{` en 177/200 archivos, 1 205 hex a mano, ~60 tamaños de fuente contra 6 declarados**. Causa raíz mecánica: `@theme inline` sólo exponía 4 tokens.
- `V10-SHELL-ALMACEN` / `V10-DEBT-004` / `V10-DEBT-007` — barra lateral con ~20 destinos del mismo peso; el shell móvil dice **«Agenda Médica»**, que no es la marca; la barra resalta «Consulta» estando en `/pacientes`.
- `V10-FABS-DOBLES` — dos FABs en la esquina de 5 pantallas; en móvil tapan contenido. El halo hace de la **ayuda** lo más brillante de la pantalla: jerarquía invertida.
- `V10-MOBILE-CALENDARIO-SEMANA` — **P1**: el calendario móvil muestra 7 columnas en 390 px, bloques ilegibles. Debe abrir en vista día.
- `V10-CITAS-ARCOIRIS` · `V10-CALENDARIO-002` — 3-4 botones de colores distintos por fila sin acción primaria; todos los eventos del mismo naranja sin distinguir confirmada de pendiente.
- `V10-DEBT-010` — **P2 móvil**: los nombres de paciente se truncan («María Fernanda…») mientras «Editar» conserva su ancho. **La identidad es el dato de seguridad primario.**
- `V10-DASHBOARD-002` · `V10-EXPEDIENTE-001` · `V10-PACIENTES-VACIO-PASIVO` · `V10-PACIENTES-RECIENTES-VACIO` · `V10-HOME-004` — estados vacíos y jerarquía.
- `V10-HOME-002` — **«¿Qué puedo continuar?»**: cola de notas en borrador sin firmar en la pantalla de inicio. Declarada al cerrar HOME-001 en vez de rellenarse con algo que lo pareciera.
- `V10-HOME-003` — **«¿Qué preparó NexusMED?»**: lo que la aplicación dejó listo desde la última sesión.
- `AGENDA-IDENTITY-002` — **P1**, segunda pasada de identidad del riel (IDENTITY 7,5 → ≥9): forma propia de CTA, fusionar tabs+selector en UN control, «Nueva cita» duplicada a 768 px, capturas con `next start`.

**Deuda del instrumental:**

- `V10-HARNESS-CONSOLIDAR` — **TRES arneses de captura para lo mismo** (`tests/visual/*`, `scripts/design/arnes-capturas-v10.sh`, `scripts/design/capturar-golden-flow.mjs`). Cada corrida paralela del 9-ago construyó el suyo sin ver a las otras. Va contra la regla del repo: nunca duplicar la fuente de verdad.
- `V10-HARNESS-OBS-001` — aviso de hidratación en dev en `/dashboard` (saludo por hora local del servidor vs. cliente) y un intento de conexión a Firestore antes del login.

## C.4 V15 — iteración en curso y deuda declarada

**Iteración en curso**: `V15-RELEASE-GATE-001` (§43 orden 19) sobre el árbol
`7e593451`. Es la **última** iteración de implementación del programa; después
sólo quedan la Auditoría Final de Verdad independiente y la aceptación del dueño.

**La siguiente tarea exacta** que el estado V15 nombra: la **lectura
INDEPENDIENTE de §26/§29**, que sigue pendiente y **sigue siendo de Codex** —
quien implementa no puede ser el juez.

**Deuda declarada y NO pagada** (no se borra, no se asciende de severidad):

1. `.hoy-accion` declara `text-decoration: none` por su cuenta aunque `.btn` ya lo trae — inerte, no incorrecto.
2. **El alcance de §21 sigue en 3 de 6.** Faltan `/pacientes` y `/operaciones` sin ninguna fuente que inspeccionar, y `/expediente` sólo la enseña tras abrir una nota firmada. **Antes de construir hay que MEDIR si esas pantallas tienen siquiera un hecho con procedencia**: puede acabar refutado.
3. En el teléfono, «Hoy» crece **887 → 1 124 px** por las cinco filas de continuidad. La palanca (`TOPE_VISIBLE`) es del dueño.
4. **El aviso de notificaciones tapa la hoja inferior en el teléfono** (`NotificacionesPushOptIn` sobre la Capa 4 a 390 px). Preexistente, de otra pieza.
5. `alergiasDe` parte dentro del paréntesis — `src/lib/seguridad/alergias.ts`, que §1 congela.
6. `RTC-12(a)` — lienzo multicolumna, con el refactor del monolito.

**Propiedades `UNVERIFIABLE` que NO se convierten a PASS**: proveedor de
transcripción, nota nacida de la transcripción, comunicación real al paciente,
`PORTAL_PACIENTE_SECRET`, y el `ops-timeout` ambiental.

## C.5 Nexus OS

Programa con 68 unidades en 10 etapas. En disco hay **18 unidades** con carpeta
(`E0-01…E0-15`, `E1-01`, `E1-02`, `E2-01`, `E2-02`). Estado durable en
`docs/roadmap/nexus-os/estado.json`, punto de reanudación en `RETOMAR-AQUI.md`.
**E0-06 (alergias fuera de `Patient`) es el que atraviesa media lista de arriba.**

---

# D · PRs ABIERTOS Y RAMAS SIN ABSORBER

## D.1 Los PRs abiertos — **6**, todos en borrador

**Los cuatro recientes (#433, #434, #435, #436) ya se unificaron en uno y se
fusionaron** el 2-sep. Quedan **seis**, todos en borrador.

**Seis en borrador, de la semana del 23-ago, entre 130 y 145 commits por detrás.
Ninguno se fusiona tal cual** — traerlos por merge es reaplicar un árbol viejo
sobre un producto que ya cambió debajo:

| PR | Qué aporta que `main` no tiene | Decisión pendiente |
|---|---|---|
| #401 | Carril del bucle autónomo abierto sobre main al día (30-ago) | |
| #353 · #351 | Contrato de migración, aislamiento, reversión e idempotencia (27 y 29 archivos). **Son dos versiones del mismo trabajo: sobra una** | `RESCATE-MIGRACION` — decidir cuál |
| #348 | Runbooks y simulacro de incidencias (35 archivos). Solapa con REG-396 | `RESCATE-348` — portar sólo lo que no cubra |
| #345 | Router de coste/calidad de IA y su modo sombra (16 archivos) | **`BLOCKED_BY_OWNER`** — ver A.5 |
| #342 | Banco de carga y evidencia de «sin pantalla en blanco» (30 archivos) | `RESCATE-342` |

**Cerrables ya** (no están en la lista de abiertos, quedan anotados por si
reaparecen): #357 (sólo falta su documento de rebanada) y #332 (autopiloto n8n
que Codex dejó de gobernar el 29-ago).

**`RESCATE-355`** (#355) es **el más barato de toda la lista**: la ruta y el
token de la capacidad de diseño de receta YA están en `main`; falta sólo la
prueba — los dos guardianes.

## D.2 Trabajo local sin subir

`MASTER_STATE.json` declara **21 archivos** sin subir en la rama
`claude/ausculta-product-transformation-mckih5` (el workflow de despliegue, el
checkpoint de Ausculta y las 19 capturas de `docs/audit/ausculta-transformacion/antes/`).

## D.3 Ramas de la rutina sin revisar

`agent/expediente/REG-192` (negación) · `agent/voice/VOICE-005` (negación,
muletilla en medio) · `agent/eval/EVAL-002-corpus-temporalidad` (temporalidad).

---

# E · RIESGOS ABIERTOS — del registro de riesgos

| # | Peligro | Sev | Estado |
|---|---|---|---|
| **R-02** | **Fatiga de alerta**: la compuerta pregunta donde no debe (balance hídrico negativo). Riesgo residual **ALTO** — un aviso que salta de más se acaba ignorando, y con él los que importan | 3 | **En reparación (VOICE-004)** |
| **R-05** | Un alérgeno mal transcrito hace que el cruce alergia↔fármaco nunca salte. Riesgo residual **medio-alto**: cuatro parsers distintos del campo; «Penicilina y sulfas» viaja como un solo término | 5 | En reparación (v1031) |
| **R-04** | Un padecimiento pasado se escribe como actual y se arrastra | 3 | Controlado, **sin corpus oro → no medido** |
| **R-07** | Pérdida de datos sin poder restaurar | 5 | **Parcial** — la restauración real no se ha cronometrado (B-05) |
| **R-08** | El sistema afirma una cifra clínica que nadie validó | 5 | **Declarado** — depende de C-1 |

R-01, R-03 y R-06 están controlados.

---

# F · SUPUESTOS SIN CONFIRMAR QUE PUEDEN COSTAR DINERO O DATOS

Del registro de supuestos. Los que tienen consecuencia práctica hoy:

| # | Supuesto | Cómo se cierra |
|---|---|---|
| **S-07** | **No se comprobó que `nexusmed.mx` tenga catch-all activo.** Si lo tiene, **un incidente de datos personales pasa de potencial a ocurrido** | Enviar un correo a una dirección inventada de ese dominio y ver si rebota |
| **S-11** | Se asume que el `appId` `mx.nexusmed.app` **aún no está publicado**. Si ya lo está, cambiar el appId cuesta la base instalada | Revisar App Store Connect y Play Console **antes** de tocar `capacitor.config.ts` |
| **S-06** | TMview refleja el IMPI con un desfase que no se midió | Repetir cada finalista en MARCANET con **búsqueda fonética** antes de pagar |
| **S-08 · S-09 · S-10** | Tarifa del IMPI no citada; régimen de la LFPPI enunciado de memoria; los candidatos se declararon libres de colisión **registral**, no de **uso comercial no registrado** | Abogado de PI + búsqueda de antecedentes formal |
| **S-03** | La medición de texto sobre el corpus V3 **no** predice el WER del reconocedor | Sólo se resuelve gastando audio (B-01) |
| **S-04** | El médico revisa la nota antes de firmar | Medible con distancia de edición — **no medido** |

---

# G · PUNTOS CIEGOS Y CONTRADICCIONES QUE HAY QUE ARREGLAR EN EL PROPIO ESTADO

Esto no es producto: es que **el tablero se desfasa y ya ha mentido varias veces**.

1. **`public/version.txt` es una copia del propio repositorio**, así que la
   cadena de versión **no puede detectar una deriva** entre dos árboles que
   declaran lo mismo. REG-504 quitó una fuente de verdad duplicada; **no cierra
   ésta**. Punto ciego abierto desde el 31-ago.
2. **`MASTER_STATE.json` está internamente desfasado**: su
   `resumenDesdeElUltimoEstado` habla de v1085→v1096 y 7 383 pruebas, mientras
   `derivado` dice REG-505, 914 archivos y **11 144 casos**, y producción va en
   **v1179**. Su propia nota lo admite: *«mientras no lo derive un script, va a
   volver a pasar»*.
3. **`OWNER_DECISIONS_REQUIRED.md` contiene entradas ya superadas** — D-08 (el
   sello v4 ya se hizo, REG-377) y T-1 (los 22 PRs: quedan 10, y 42 se cerraron
   el 30-ago). Se anotan aquí corregidas; el archivo original merece una pasada.
4. **`V10_BLOCKERS.md` y `V10_OWNER_DECISIONS_REQUIRED.md` están cerrados** pero
   el `V10_BACKLOG.json` sigue con 23 ítems abiertos: el programa V10 no está
   bloqueado, está **parado**.
5. **Un fallo de prueba conocido y ambiental**:
   `ops-timeout-y-punto-ciego.test.ts` exige que `10.255.255.1` trague paquetes;
   el proxy del contenedor le devuelve **403 en ~30 ms** y le gana la carrera al
   timeout. **Comprobado en rojo también contra HEAD limpio.** No se toca la
   aserción.
6. **Dos defectos del arnés que hacían pasar pruebas vacías** (hallados al
   escribir REG-352): el `writeBatch` del doble de cliente era un muñeco, y el
   `ref` de un documento de consulta sólo tenía `path`, así que `batch.delete()`
   no borraba nada en silencio. **Cualquier prueba anterior que afirmara sobre
   escrituras con ese doble hay que mirarla de nuevo: pudo estar en verde por
   esto.**
7. **El contador de regresiones no impide colisiones entre ramas.** Tres el
   2-sep. El guardián verifica que cada número tenga ficha, no que sea único
   frente a lo que otra rama abierta reclamó. Defecto con nombre propio, de la
   familia «depende de que alguien se acuerde».
8. **Varias casillas `PARTIAL` del tablero descansan todavía sobre substrings**
   —se prueban leyendo el código fuente como texto—. Con el arnés de Firestore
   en memoria ya se pueden convertir en medición real.

---

# H · SI HUBIERA QUE ELEGIR — el orden que más desbloquea

Esto es una recomendación, no una decisión tomada.

**Lo que sólo cuesta una frase suya** (y desbloquea lo más caro):

1. Las **cuatro preguntas de la política de correcciones** (A.2) — hoy corregir un registro clínico no está habilitado.
2. **D-09**, el router de IA (A.5) — libera o entierra el PR #345 de una vez.
3. El **periodo de retención del audio** (A.3).
4. **C-1 y C-2** — los 23 motores y las 39 recomendaciones sin fuente son lo único que hace que el producto se muestre a sí mismo como «no validado».

**Lo que sólo cuesta un rato en una consola:**

5. ~~Ver los doce índices `Enabled`~~ **hecho el 2-sep**. Queda: activar **PITR**
   y ensayar una restauración; poner `OPS_ALERTA_WEBHOOK` y
   `TIPO_CAMBIO_USD_MXN`; y la **llave de AssemblyAI en la máquina local** — el
   corpus y el medidor ya están hechos, es un comando. Y **pulsar el botón del
   backfill**, que ahora existe.

**Lo que un agente puede hacer mañana sin preguntar nada:**

6. Los **cuatro ítems de accesibilidad de V10** — `aria-label` es reversible y no toca lógica; hay nodos **críticos** de axe hoy.
7. **`V10-FECHAS-INCONSISTENTES`** — riesgo de lectura real, no cosmético.
8. **`NAV-NAVEGADOR-001`** — si el botón central de `BottomNav` remonta la consulta, es un P0 que mata grabaciones, y hoy nadie lo ha comprobado.
9. **`RESCATE-355`** — el más barato de la lista de PRs.
10. ~~Reconciliar #433/#434/#435~~ **hecho el 2-sep**: unificados en uno y fusionados.
