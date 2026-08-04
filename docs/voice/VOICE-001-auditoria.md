# VOICE-001 · AUDIT_AND_BENCHMARK_DESIGN

**Charter:** NexusMED Clinical Conversation Intelligence — Master Voice, Ambient
Scribe & Medical Understanding Loop V1.
**Modo:** auditoría. `productionWrites: false`, `destructiveChanges: false`.
**Fecha:** 4-ago-2026. **Base:** `nexusmed-v995`, 5 950 pruebas en verde.

> **Convención de honestidad.** `VERIFICADO` = leído por mí en el código de este
> repositorio, con `archivo:línea` o con una medición que ejecuté. `PROPUESTO` =
> diseño, no existe todavía. `NO VERIFICADO` = no lo comprobé, y lo digo en vez
> de suponerlo.
>
> Ninguna cifra clínica de este documento es inventada. Los umbrales técnicos que
> se proponen nacen marcados `NEEDS_CALIBRATION`, igual que `UMBRAL_DUDA`.

---

## A · CURRENT ARCHITECTURE

El camino real del audio, tal como está hoy.

```
MICRÓFONO  (useGrabacionAudio.ts — ÚNICO getUserMedia de todo src/)
   │  NS/AEC/AGC apagados por omisión (v980) · sampleRate 16k solicitado
   │  y VERIFICADO al abrir con getSettings()
   ▼
MEDIRECORDER  timeslice TROZO_MS = 2 s · Opus 64 kbps
   │  medidor RMS + pico (recorte) + silencio · un solo bucle (v982)
   ├──────────────── cada 20 s, con SOLAPE de 1 trozo (v995) ───────────┐
   │                                                                     ▼
   │                                            /api/expediente/transcribir-chunk
   │                                            cascada gpt-4o-mini → gpt-4o → whisper-1
   │                                            prompt = léxico del paciente (v994)
   │                                            presupuestado por modelo (v993)
   │                                                     │
   │                                                     ▼  TEXTO EN VIVO
   │                                            (nota preliminar + último recurso)
   ▼  al detener
CAMINO PRIMARIO: /api/expediente/transcribir-diarizado
   AssemblyAI  speech_model 'best' · speaker_labels · language_code 'es'
   word_boost = componerSesgo(expediente del paciente + catálogo)  (v981)
   devuelve utterances con words → {texto, inicioMs, confianza}     (v975)
   │
   ├── falla → MOTIVO explícito (sin_llave | error_proveedor | tiempo_agotado |
   │            red | sin_texto) y se DICE en pantalla                (v973)
   ▼
CAMINO DE RESPALDO: /api/expediente/transcribir  (OpenAI, léxico por paciente)
   audio > 3.6 MB → troceado por lotes, con eco de cabecera removido  (v995)
   │
   ▼
PIPELINE DE 5 ETAPAS  (asr/pipeline.ts)
   1 corrector vigilado  → guardián de sustituciones, reversión POR FRASE (v992)
   2 cifras y unidades   (normalizacion.ts)
   3 siglas              (siglas.ts)
   4 re-verificación del guardián
   5 gate de ambigüedad  → motivos, EXPUESTO y visible desde (v990)
   │
   ▼
TEXTO PARA LA IA   (una sola función, redactor y revisor leen lo mismo) (v984)
   con turnos + marcas ⟦palabra?⟧ + INSTRUCCION_MARCAS
   sin turnos → texto plano + ANEXO de dudas                            (v991)
   │
   ▼
/api/expediente/procesar   Claude + ensamble · GUARDA_INYECCION + delimitar (v984)
   │
   ├─→ /api/expediente/atribuir-roles     (Médico/Paciente/Acompañante)
   ├─→ /api/expediente/extraer-entidades  (NER + corrección por negación v977)
   └─→ /api/expediente/verificar-nota     (segunda opinión, no bloquea)
   │
   ▼
DEFENSAS DETERMINISTAS SOBRE LA NOTA
   negaciones.ts        contradicción dictado↔nota                      (v976)
   procedencia.ts       sello dictado/ia/manual · V2 cita existe ·
                        V3 de quién es la cita · falla cerrado     (v984, v986)
   sanitizar-prosa.ts   meta-texto fuera                                (v984)
   camposSinEvidencia   compuerta de firma                              (v987)
   sugerencias-ia.ts    compuerta de firma para prosa [IA — no dictado]
   nom004.ts            validación normativa
   │
   ▼
FIRMA  →  sello de integridad + provenance (modelo, promptVersion, API)
```

**Cobertura por módulo (VERIFICADO).** Hospitalización **no tiene pantalla de
dictado propia**: empuja a la de consulta, así que hereda las defensas por
construcción. UCI **sí** tiene camino propio y se niveló en v983/v988/v989.

**Corpus en disco (VERIFICADO).** `~/Desktop/AUDIO/` contiene
`NexusMED_UCI_498_AUDIOS_GENERADOR_MAC` (498 MP3 con manifiesto),
`NexusMED_CLINICAL_V3_MASTER` (6 000 frases de texto; **audio no generado**),
`NexusMED_CLINICAL_ASR_PIPELINE_V1` y `NexusMED_UCI_V2_MASTER`. El informe
medido vive en `docs/maintenance/benchmark-voz-uci-498.json`.

---

## B · CURRENT FAILURE MODES

Estado **después** de las dieciocho versiones de esta sesión. Lo cerrado se lista
para que no se vuelva a abrir; lo abierto es la cola real.

### B.1 · P0 — cerrados en esta sesión (con su versión)

| # | Fallo | Cerrado en |
|---|---|---|
| 1 | La transcripción **en vivo se congelaba a los ~20 s**: los trozos posteriores al primero iban sin cabecera de contenedor y el error se tragaba. La nota preliminar se armaba con los primeros 20 s, y el último recurso los presentaba como la consulta entera | v979 |
| 2 | «¿diabetes o presión alta? **No**» → «Paciente con HTA, DM2». Antecedente crónico inventado que **se arrastra** a todas las notas siguientes | v976 (prompt + motor) · v977 (extractor) · v986 (V3) |
| 3 | «la de la **docencia**» → **«vesícula»**. La confianza por palabra existía y se tiraba | v975 |
| 4 | El vocabulario del paciente alimentaba **sólo al motor de repuesto**; el motor que de verdad transcribe recibía una lista genérica | v981 · v994 (en vivo) |
| 5 | UCI y el **banco de voz** grababan con supresión de ruido y cancelación de eco encendidas: medíamos en condiciones distintas a las reales | v980 |
| 6 | La nota de UCI nacía **huérfana**: sin dictado, se firmaba como `manual` y se apagaban las siete defensas a la vez | v988 |
| 7 | Una cifra perdida descartaba **todas** las correcciones del dictado, y el daño crecía con la duración | v992 |
| 8 | El prompt del trozo se pasaba del límite y **se cortaba solo**, tirando el vocabulario (REG-064 reintroducido) | v993 |
| 9 | La cabecera de 2 s se re-transcribía en cada lote: **una orden médica duplicada** en puntos distintos de la consulta | v979 · v995 |
| 10 | El corte de 20 s **partía palabras sin solape**: una cifra en la frontera no queda mal escrita, queda **cambiada** | v995 |

### B.2 · P0/P1 — RE-VERIFICADOS EL 4-AGO-2026 CONTRA EL CÓDIGO

**Los doce están cerrados.** Esta tabla se escribió el 2 de agosto y siguió
diciendo «ABIERTOS» durante veinte versiones que los fueron cerrando uno a uno.
Un documento de auditoría que se queda quieto **no falla: certifica** — y aquí
certificaba dos P0 que ya no existen, que es la misma clase de daño que el
registro clínico con puertas inexistentes (REG-131), sólo que al revés.

Cada fila se comprobó abriendo el archivo, no leyendo la bitácora.

| # | Sev | Fallo | Cerrado en | Cómo se comprobó hoy |
|---|---|---|---|---|
| B-1 | P0 | `transcripcionCruda` no es cruda | v996 | La nota guarda **las dos**: `transcripcionCruda` es el texto de trabajo y `transcripcionMotor` lo que el reconocedor oyó (`types/expediente.ts:293-304`, escritas en `construirNota`). De esa pareja cuelga LEARN (REG-133) |
| B-2 | P0 | `dialogoDiarizado` se persiste con `palabras` dentro | — | Se guarda `{speaker, text, rol}`, sin `palabras` (`types/expediente.ts:326`; guardián en `origen-del-dictado.test.ts`) |
| B-3 | P1 | `rolesHablante` no se persiste | — | El rol viaja **dentro de cada turno** (`rol?: string`) y va sellado en el V3, que era el objetivo: quién dijo qué queda en el expediente (`quien-hablo-se-archiva.test.ts`) |
| B-4 | P1 | `speaker_options` no se pide | — | `speaker_options: { min_speakers_expected: 1, max_speakers_expected: MAX_VOCES }` en las dos llamadas |
| B-5 | P1 | Sin Medical Mode | v1022 | `domain: DOMINIO_MEDICO` (`'medical-v1'`) dentro de `armar()`, así que va en el intento principal **y** en el reintento |
| B-6 | P1 | `'best'` no está documentado | v1022 | Se pide `universal-3.5-pro` por su nombre y el tope de sesgo se presupuesta para ÉL (1 000 vs 200); si el proveedor lo rechaza, se reintenta con el alias |
| B-7 | P1 | Roles limitados a 3 | — | `roles-hablante.ts`: catálogo por módulo (consulta / hospitalización / UCI) y **«Hablante no identificado»**, para que «no lo sé» sea una respuesta posible |
| B-8 | P1 | La segunda opinión se rinde con la consulta larga | — | La transcripción se parte en **tramos solapados** y la nota entera se revisa contra cada uno; si algo queda fuera se devuelve `incompleto` diciendo cuántos caracteres se cubrieron |
| B-9 | P1 | El ensamble no revalida citas | — | Tras fusionar se comprueba que las `source_quote` sigan existiendo en la transcripción (`procesar/route.ts:550`) |
| B-10 | P2 | La procedencia sólo cubre datos estructurados | — | El manifiesto incluye las **secciones redactadas** y el resumen, con la regla V3 sobre las de antecedentes — que es donde ocurrió el fallo real |
| B-11 | P2 | `cambiosNormalizacion` y `cambiosSiglas` no se enseñan | v1000 | Panel de cambios de cifras en la consulta, con su prueba |
| B-12 | P2 | `especialidades` es un parámetro muerto | v1022 · v1025 | La consulta y UCI lo mandan, y desde la v1025 lo lee también **la ruta que de verdad transcribe** (REG-135) |

## C · CURRENT BENCHMARKS

### Lo que SÍ se mide (VERIFICADO)

| Qué | Dónde | Estado |
|---|---|---|
| WER, Clinical Term Recall, Acronym Recall, Number/Unit Accuracy, Critical Semantic Error Rate | `uci/benchmark-metricas.ts` | Implementado, con capa de equivalencia hablado↔escrito |
| Informe medido sobre 498 audios de UCI | `docs/maintenance/benchmark-voz-uci-498.json` | WER 11.25 %, término clínico 99.73 %, número 100 %, unidad 100 %, error semántico crítico 0.20 % — **corpus de UCI, no de consulta** |
| Regresión de TEXTO, gratis | `scripts/asr-regresion-texto.ts` | Un texto ya correcto debe salir intacto |
| Benchmark con audio, crudo vs pipeline | `scripts/asr-benchmark-audio.ts` | Con caché; mide si el pipeline **daña** |
| Corpus oro de alucinación, 4 casos | `src/lib/ia/casos-oro.ts` + su prueba | Criterio CERO, corre en CI (v985). Tres salieron de producción; el cuarto de un criterio del charter (rol del acompañante) |
| Trinquete de lint, color, escala visual, huérfanos | `scripts/lint-trinquete.mjs`, tests | En CI |
| Lo que el médico corrige a mano (LEARN) | `src/lib/asr/aprendizaje.ts` + `aprendizaje-firestore.ts` | v1023-v1025. **No es una métrica**: es evidencia sobre este médico. Se cuenta cuántas veces se repitió cada corrección, y por eso hay un número que sube |

### Lo que NO se mide (VERIFICADO por ausencia)

1. **Nada de consulta con audio.** Los 498 son de UCI. La queja del Dr. es de
   consulta: **se mide un dominio y se falla en otro.**
2. **Atribución de rol.** `atribuir-roles` decide con un modelo y **nada mide si
   acierta**.
3. **Diarización.** Ni DER, ni error de atribución, ni recuperación de
   solapamiento.
4. **Temporalidad.** La negación **sí** tiene un caso oro desde la v985
   (`oro-negacion-cronicas`, el fallo real del Dr.), y el motor corre en CI con
   criterio cero; lo que sigue sin medirse es *cuándo* pasó lo que se dice —
   «tuvo neumonía hace 3 años» ≠ «tiene neumonía».
5. **Nota**: ni PDQI-9, ni distancia de edición del médico, ni omisión.
6. **Latencia** de primer parcial y estabilidad del parcial.
7. **Equidad**: nada por acento, sexo de voz, edad, dispositivo ni ruido.
8. **Los trinquetes de voz que no necesitan corpus SÍ corren en CI** (léxico,
   normalización, siglas, guardián de sustituciones, pipeline, corpus oro,
   aprendizaje…). Los **tres scripts de corpus** siguen fuera, y por una razón
   que no es pereza: **el corpus no está en el repositorio** —vive en el disco
   del Dr.— y un trinquete que en CI no encuentra sus datos pasaría en verde sin
   medir nada, que es peor que no tenerlo. Corregido el 4-ago: la frase anterior
   («ninguno corre en CI») dejó de ser cierta hace versiones.
9. **`UMBRAL_DUDA = 0.6` sigue sin calibrar**, declarado así en el propio código
   (`confianza-audio.ts:76`, con sobreescritura por variable de entorno).

> **Nota de método (4-ago-2026).** Esta sección se re-verificó archivo por
> archivo. Lo que no pude comprobar yo mismo no se movió.

---

## D · MISSING DATA

| Necesidad | Estado hoy | Qué falta |
|---|---|---|
| **Consulta ambulatoria, español MX, médico+paciente, con audio** | **No existe** | Es el hueco número uno. Sin él no se puede medir el dominio que falla |
| Etiqueta de **hablante por turno** | No existe | Imprescindible para DER y para exactitud de rol |
| **Solapamiento real** | No existe | El TTS no lo produce: exige audio **actuado**, dos personas, guion |
| **Tercer hablante** (acompañante) | No existe | Cada aserción anotada con su rol |
| **Negación anotada** | No existe | El caso del Dr. no tiene gold |
| **Temporalidad anotada** | No existe | «tuvo neumonía hace 3 años» ≠ «tiene neumonía» |
| Audio del corpus de 6 000 frases | **Texto sí, audio no** (48 de ~6 000) | Generación TTS pendiente |
| Transcripciones cacheadas | **Ninguna guardada** | Sin caché, cada medición se vuelve a pagar |
| Variación de dispositivo/ruido/distancia | No existe | Para las métricas de equidad |

**Regla dura que asumo:** ningún audio de paciente real entra al conjunto de
evaluación. La voz es biométrica; un audio «desidentificado» sigue identificando
a quien habla. El gold nace sintético o actuado. Reinyectar texto de producción
desidentificado es **decisión del Dr.**, y **nada de este plan depende de ella**.

---

## E · COMPETITIVE GAP

Investigado con fuentes primarias. Lo que sigue está **citado**, no supuesto.

### Lo que ellos hacen mejor

| Capacidad | Quién | Nosotros |
|---|---|---|
| **WER publicado** | Abridge 12.7 % / MTR 97 % (interno) · Corti 2.1 % MedTerm (paper) · Speechmatics 7.3 % español médico (interno) | Medimos, pero **sólo UCI** y no publicamos |
| **Evidencia enlazada por frase** con audio | Abridge «Linked Evidence» (span + timestamp) | Sólo datos estructurados; **la prosa no** (B-10) |
| **Detector+corrector entrenado** como etapa separada | Abridge (>50 000 ejemplos) · DeepScribe (Evaluator+Fixer) · Corti (FactsR: extract→refine→compose) | Segunda opinión con LLM generalista, **no bloquea** |
| **Taxonomía soporte × severidad** | Abridge (5×3) | No formalizada |
| **Modo médico en español** | AssemblyAI `domain: medical-v1` · Speechmatics `domain: medical` | **No usado** (B-5) |
| **Rol declarado, no inferido** | Corti: `participants[] {channel, role}` | Se infiere con un modelo, sin medir (B-3, B-7) |
| **Confianza de hablante** | Deepgram `speaker_confidence` por palabra | No disponible en nuestro proveedor |
| Estudio peer-reviewed propio | Abridge, Suki, Corti, Nabla | Ninguno |

### Lo que ellos NO hacen, y es nuestro foso

1. **Nadie sesga el motor de voz con el expediente del paciente que está
   enfrente.** El líder del mercado **ni siquiera aplica su diccionario
   personalizado a la ruta ambiental** — está en su documentación. Nosotros ya lo
   hacemos en los tres caminos (v981, v994, v989).
2. **Nadie enseña al médico la confianza por palabra.** Ninguno de los diez. La
   industria verifica por trazabilidad, no por duda. Nosotros la mostramos con
   minuto y porcentaje (v975).
3. **Motores deterministas sellados** que el LLM no puede recalcular (110 en el
   registro clínico). El patrón «el modelo sintetiza sobre hechos ya
   establecidos» es replicable y **caro de copiar**.
4. **Español mexicano de verdad**: la regla de la «y» entre decena y unidad, las
   marcas comerciales MX, el interrogatorio que nombra la enfermedad en la
   pregunta. Eso no sale de un modelo genérico.

### Dato honesto sobre el listón

El único ECA de tres brazos publicado (NEJM AI, 238 médicos) midió **−1.7 % de
tiempo en nota para DAX, no significativo**, y −9.5 % para Nabla. Y un
competidor publicó que sus notas alucinan **31 %** frente a **20 % de las notas
escritas por médicos**. **El listón real del mercado es mucho más bajo que su
marketing.** El claim defendible no es «minutos ahorrados»: es carga cognitiva y
fidelidad al hecho clínico.

---

## F · TARGET ARCHITECTURE

Cambios sobre lo que ya existe. **Cada etapa reemplazable, ningún proveedor
permanente.**

```
CAPTURA
  + PRE-CHEQUEO de 5 s antes de grabar (dispositivo, suelo de ruido, SNR,
    recorte, prueba del paciente)                                   [nuevo]
  + AudioQualityReport persistido con la nota                       [nuevo]

DIARIZACIÓN
  + speaker_options {min:2, max:N}                                  [B-4]
  + rol DECLARADO donde se pueda + inferido como contraste          [B-7]
  + riesgoTurno derivado de start/end/confidence/word.speaker       [nuevo]
  + los 4 niveles de degradación N0–N3                              [nuevo]

ASR ROUTER  (SpeechProviderInterface)                               [nuevo]
  + shadow mode sobre muestra controlada, NUNCA dos textos al médico
  + selección por idioma/ambiente/latencia/coste/desempeño histórico

COMPRENSIÓN
  + ClinicalAssertion {concept, status, experiencer, speaker,
    temporalContext, certainty, sourceSpan}                         [nuevo]
  + ClinicalIntent (ORDER_INTENT ≠ ORDER)                           [nuevo]
  + MedicationMention con action (inicia/suspende/cambia)           [nuevo]
  + correcciones habladas: 72 → SUPERSEDED, 82 → CURRENT            [nuevo]

EVIDENCIA
  + TramoFuente {id, texto, inicioMs, finMs, hablante, confianzaMin} [nuevo]
  + Afirmacion {texto, soporte, severidad, evidencia[], base}        [nuevo]
  + V1/V2/V3 deterministas (V2 y V3 ya existen)                      [parcial]

VERIFICACIÓN
  D · determinista: evidencia + negaciones + GUARDIÁN transcript→nota
      + meta-texto + rangos                                          [D3 nuevo]
  E · entailment entrenado sobre (afirmación, tramos citados)        [nuevo]
  L · LLM clínico: sólo coherencia y omisión relevante               [existe]
  Veredicto {accion: corregir|eliminar|falsa_alarma, evidencia, porQué}

MEDICIÓN
  + gold estratificado A(UCI)/B(consulta)/C(trampas)/D(ciego)        [nuevo]
  + caché de transcripciones EN EL REPOSITORIO → medir gratis        [nuevo]
  + job `voz-oro` en CI con trinquete                                [nuevo]
```

**El hueco arquitectónico más grande, dicho claro:** el guardián vigila al
corrector léxico de 200 líneas y **no vigila al modelo que redacta la nota**. Si
el LLM voltea una negación al redactar, ninguna de las 14 clases críticas lo ve.
Es la asimetría más cara del sistema (D3).

---

## G · BENCHMARK PLAN

### Métricas, con la que manda

El WER **no manda**. Manda el **vector de daño con orden lexicográfico**:

```
(N0, N1, N2)
  N0  errores críticos (las 14 clases de politica-critica.ts) → CERO, sin trinquete
  N1  entidad clínica perdida o alterada sin cruzar par prohibido → no puede subir
  N2  prosa, muletillas, puntuación → informativo
```

Un promedio ponderado tiene el mismo defecto que el WER: mil errores de prosa
«pagarían» un error de dosis. Por eso **la puerta se decide por niveles**.

Métricas por familia: exactitud de fármaco (con la sustitución por **otro fármaco
real** como N0, porque es legible y falsa), de dosis (magnitud ligada, no el
número suelto), de unidad, de frecuencia, de organismo, **de negación**
(asimétrica: `negada→afirmada` se cuenta aparte), **de atribución de rol** (con
matriz 3×3), **temporal**, y las del comportamiento defensivo (cobertura de duda,
precisión de duda, carga de duda, tasa de pregunta).

### Gold standard

Cuatro estratos: **A** UCI (498 ya existentes), **B** consulta (nuevo, sintético
sobre el vocabulario del Dr.), **C** trampas (un caso por modo de fallo conocido,
incluidos los tres de producción), **D** ciego (nunca visto por quien toca el
pipeline).

Anotación por **dos anotadores + adjudicador clínico**, con acuerdo reportado. El
`nivel_si_falla` va escrito **en el oro**, no calculado por el medidor: un juicio
de daño lo fija el Dr., no un `if`.

### Cómo medir gratis

```
audio ──(caro, se paga UNA vez)──► transcripción CRUDA ──(gratis)──► texto final
                                          ▲
                        docs/oro/transcripciones/<motor>/<modelo>/<prompt_sha>/
                                  commiteada al repositorio
```

Que las transcripciones puedan vivir en el repositorio es **consecuencia directa**
de que el oro sea sintético. Es la razón práctica —además de la legal— de no
meter jamás audio de paciente.

---

## H · FIRST VERTICAL SLICE

**Consulta ambulatoria en español mexicano · médico/paciente · números ·
medicamentos · negación · nota vinculada a fuente.**

Contenido mínimo:

1. **20 diálogos** de consulta (estrato B) + **los 3 casos de producción**
   (estrato C), con turnos, tiempos y aserciones anotadas.
2. **Audio TTS** multivoz para los 23; **audio actuado** sólo para solapamiento y
   tercer hablante.
3. Medición de: exactitud de fármaco, de dosis, de unidad, **de negación**, **de
   rol**, y `FidelidadEntrega` (que el string medido sea el que sale hacia la IA).
4. **Evidencia enlazada de prosa** (B-10) sobre esos 23 casos.
5. Job `voz-oro` en CI con el trinquete.

---

## I · ACCEPTANCE CRITERIA

Numéricos, sobre el vertical slice.

| Criterio | Valor | Justificación |
|---|---|---|
| `N0` sobre el gold | **= 0** | Sobre un corpus que controlamos entero, una dosis o una negación invertida no es un porcentaje aceptable |
| Fugas de negación (`negada→afirmada`) | **= 0** | Es el caso del Dr., y se arrastra |
| Órdenes activas sin confirmar | **= 0** | `ORDER_INTENT ≠ ORDER` |
| Atribución de rol crítica errónea | **= 0** | Un síntoma del acompañante como del paciente es un hecho falso |
| Afirmación G3/G4 sin evidencia que entre a la nota | **= 0** | Ya hay compuerta (v987); el gold lo fija |
| `FidelidadEntrega` | **= 1** | El string medido debe ser el que sale hacia la IA |
| Exactitud de fármaco / dosis / unidad | **no puede empeorar** vs. línea base | Trinquete, no valor absoluto |
| `N1` y `N2` | **no pueden empeorar** | ídem |
| Cobertura de duda sobre errores N0 | a fijar con la curva | `NEEDS_CALIBRATION` |
| Marcas por consulta aceptables (`N`) | **decisión del Dr.**, mirando 3 casos renderizados | No la fijo yo |

**Y una condición de proceso:** el corpus oro **no puede encoger**. Un caso que
sale exige entrada en `regression-ledger.md`.

---

## J · ONE NEXT ITERATION

```yaml
iteration:
  id: VOICE-002
  name: AUDIO CAPTURE RELIABILITY + PROVENANCE INTEGRITY
  environment: staging
  productionWrites: false
  destructiveChanges: false
```

**Por qué ésta y no otra.** El charter ordena VOICE-002 = *audio capture
reliability*, y ahí caen además los **dos P0 abiertos**, que son de integridad de
la fuente:

1. **B-1 · `transcripcionCruda` no es cruda.** Persistir `ResultadoPipeline.crudo`
   en una **subcolección** `notas/{id}/dictado/`, y renombrar o documentar el
   campo actual. Sin esto, el principio nº 1 del charter —*el audio no es la
   nota, no sobrescribir una capa con otra*— está roto en el sitio que más
   importa: el archivo medicolegal.
2. **B-2 · el documento de la nota se está llenando de confianzas por palabra**,
   con historial previo de reventar el tope de 1 MB. La misma subcolección lo
   resuelve, y es **exactamente lo que el propio código ya declaró como solución
   de fondo**.
3. **Pre-chequeo de audio de 5 s** y `AudioQualityReport` persistido: la sección 7
   del charter, y la única forma de dejar de descubrir en la nota que el audio
   era inutilizable.

**Alcance explícitamente fuera de VOICE-002:** el ASR router, el modo médico y
`speaker_options` (van en VOICE-003/004), y cualquier cambio de proveedor.

---

## LO QUE NO PUDE VERIFICAR, Y NO VOY A SUPONER

1. **A qué modelo enruta `'best'`.** De eso depende si `word_boost` está vivo o
   muerto — y si está muerto, todo el trabajo de vocabulario no cambia nada de lo
   que el motor oye. **Se resuelve con una llamada** que lea `speech_model` en la
   respuesta. Es el primer experimento de VOICE-003 y cuesta minutos.
2. **Si el Medical Mode de AssemblyAI está disponible en pre-grabado.** Su
   documentación lo describe para streaming.
3. **Si el navegador concede de verdad 16 kHz** en el equipo del Dr. Ya se lee y
   se enseña (v980), pero **no tengo la lectura de su máquina**.
4. **Ninguna cifra de DER sobre consulta médica en español.** No encontré ni una
   publicada. Cualquier decisión de proveedor basada en las tablas que circulan
   sería fe.
5. **El número defendible de alucinación** ante un hospital. El instrumento está;
   el estudio necesita transcripciones desidentificadas y anotación clínica, y
   **lo corre el Dr.**

---

**STOP.**
