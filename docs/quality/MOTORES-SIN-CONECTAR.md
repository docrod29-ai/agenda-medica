# Motores clínicos que no llegan al médico

**Medido el 8-ago-2026** por `node scripts/calidad/motores-conectados.mjs`.
De **771** funciones exportadas en los dominios clínicos y de seguridad,
**38** no se usan en ningún sitio fuera de su propia declaración.

El trinquete `los-motores-llegan-al-medico` congela ese número: **sólo puede bajar**.

## Por qué esta lista existe

La familia de defectos más grande del repositorio es **«escrito, probado y sin
conectar»** — 21 de 102 REG. Los veintiuno se encontraron de uno en uno, por
casualidad. `tareaDeResultado()` fue el último: existía, estaba probada, y el
bucle de laboratorio **nunca empezaba** (REG-252).

## Dos cosas distintas, y la segunda es la cara

**Código muerto**: nadie lo usa, ni siquiera una prueba. Molesta, no engaña.
Ejemplo medido: `verificarIntegridad` — **cero archivos de prueba**.

**Probado y sin conectar**: tiene su prueba en verde y aun así no corre en el
camino del médico. **Éste es el caro**, porque el verde de la prueba hace creer
que está en marcha. Ejemplos medidos, con su número de archivos de prueba:

| Símbolo | Pruebas | Qué es |
|---|---|---|
| `sePuedeFirmar` | 1 | decide si la nota se puede firmar |
| `resumenVigentes` | 1 | resumen de órdenes de medicamento vigentes |
| `esAntecedenteFamiliar` | 1 | distingue al paciente de su familia |
| `csvDeBitacora` | 1 | exportación de la bitácora |
| `verificarIntegridad` | **0** | código muerto, no engaña |

### Cerradas ya

| Símbolo | Cómo se cerró |
|---|---|
| `getAlertas` · `marcarAlertaLeida` | REG-256 · las alertas del episodio se escribían y nadie las leía; ahora hay bandeja en la ficha |
| `camIcu` | REG-257 · el cribado de delirium no corría; ahora está junto al RASS, y el rasgo 3 sale del RASS en vez de preguntarse dos veces |
| `obstruccionTSVI` | REG-257 · decía «NO escalar inotrópicos» y no llegaba a ninguna pantalla; ahora se enseña SIN filtro de modo avanzado |
| `signo6060` · `pulsatilidadPorta` | REG-257 · conectados en el bloque POCUS; la pulsatilidad se calcula de Vmáx/Vmín en vez de clasificarse a ojo |
| `oxigenoSinDeclarar` | REG-258 · detecta flujo/FiO₂ sin la casilla de «recibe O₂»; NEWS2 suma 2 puntos por oxígeno y sin ella la puntuación sale baja |
| `omiteAlertasCriticas` | REG-259 · el texto de la IA podía CALLARSE una carbapenemasa detectada por el motor; contradecir era ruidoso, omitir no chocaba con nada |
| `sePuedeFirmar` · `esAntecedenteFamiliar` · y 32 más | REG-260 · **no son defectos**: envoltorios de ≤3 líneas sobre funciones que sí corren |
| `getInternamientosDePaciente` | REG-261 · su comentario decía «para mostrarlos en su expediente» y el expediente no los mostraba |
| `resumenProblemas` · `resumenVigentes` | REG-262 · pedían «el encabezado de la consulta», pero ahí las listas ya salen enteras; su sitio era el expediente, que no resumía nada |
| `tuvoEstructura` | REG-264 · decía si el pase de UCI traía encabezados por aparato, y nadie preguntaba |

## Lo que NO significa estar en esta lista

No todo lo de aquí es un defecto. Puede ser API pública legítima, o un símbolo
que se exporta para poder probarlo aparte. Por eso el guardián **no exige
cero**: congela la cuenta para que no crezca, y cada iteración del loop cierra
una o dos con criterio.

## Un falso positivo que casi cuesta caro

La primera versión del medidor daba **152**, no 50, porque preguntaba «¿lo usa
algún archivo que no sea el suyo?». La primera que fui a reparar era falsa:
`crossResistenciaFQ` (EUCAST T13, cross-resistencia de fluoroquinolonas) la
llama su vecina de archivo `analizarSeguridad`, y ésa sí corre.
Casi «reparo» algo que funcionaba, en el módulo de antibiogramas — el que más
le importa al médico dueño. Un medidor que grita de más enseña a ignorarlo,
que es el mismo fallo que se repara en los avisos clínicos.

## El número, desglosado (REG-260)

Decir «42 motores sin conectar» era inflar. Medido:

| | Cuántos | Qué son |
|---|---|---|
| **Envoltorios** | 34 | ≤3 líneas sobre una función que **sí corre**. `sePuedeFirmar` es `motivosParaNoFirmar().length === 0`. No son defectos: son comodidad que nadie usó. |
| **Con cuerpo real** | 9 | Los que merecen mirarse uno a uno. |

**Un número que mezcla las tres cosas no sirve para decidir nada.**

### Los nueve con cuerpo real

- `src/lib/clinical/safety-gate.ts::invariantesProtegidos`
- `src/lib/expediente/ordenes-medicamento.ts::resumenVigentes`
- `src/lib/expediente/problemas-activos.ts::resumenProblemas`
- `src/lib/expediente/versioning.ts::obtenerVersion`
- `src/lib/hospital/estados-cama.ts::coherenteConElTipo`
- `src/lib/hospital/eventos.ts::validarCorreccion`
- `src/lib/hospital/firestore.ts::getInternamientosDePaciente`
- `src/lib/uci/benchmark.ts::correrBenchmark`
- `src/lib/asr/lo-que-pesa-de-un-error.ts::leerConsulta`

De esos nueve, **`validarCorreccion` está bloqueado en el dueño, no en el
código**: exige una política como parámetro obligatorio y `POLITICA_CORRECCION`
nace en `null` a propósito. Quién puede corregir, en qué ventana y si el motivo
es obligatorio son decisiones de política de registro clínico con peso NOM-004.
Está en `agent-state/OWNER_DECISIONS_REQUIRED.md`.

## El barrido, cerrado: los cinco que quedan (REG-263)

Empezó en **50**. Once motores se conectaron de verdad. De los **39** que
quedan, **34 son envoltorios** y **seis tienen cuerpo real** — y **ninguno de
los seis es un defecto**. Verificado uno a uno, leyendo el código:

| Símbolo | Por qué no tiene llamador |
|---|---|
| `validarCorreccion` | **Bloqueado en el dueño.** Exige una política como parámetro obligatorio y `POLITICA_CORRECCION` nace en `null` a propósito |
| `coherenteConElTipo` | Su comentario dice que se exporta «para que un caso del **golden** la ejecute», y el golden la ejecuta |
| `invariantesProtegidos` | Deriva el conjunto protegido para la **compuerta clínica**; su consumidor es esa compuerta |
| `correrBenchmark` | Arranque de un banco de pruebas que **se corre a mano** y se paga |
| `obtenerVersion` | **Redundante**: `listarVersiones` ya devuelve las versiones enteras, así que restaurar no necesita una segunda lectura |
| `leerConsulta` | **Evaluación, no camino del médico.** Compara una transcripción contra su GOLD, y en una consulta de verdad no hay gold — si lo hubiera, no haría falta transcribir. Su consumidor es `scripts/medir-wer-limpio.ts`, que necesita el corpus de 6 000 audios del dueño y por eso no vive en el CI. Misma categoría que `correrBenchmark` |

**Un residuo explicado no es deuda: es una decisión.** Conectar `obtenerVersion`
añadiría una lectura de Firestore para traer lo que ya está en memoria; conectar
`validarCorreccion` exigiría inventarse la política.

`el-barrido-de-motores-esta-explicado` falla si aparece un motor con cuerpo real
sin explicación **y también** si una explicación sobrevive a lo que explicaba.

## Lo que se decidió NO conectar, y por qué

Es una **decisión, no un olvido**. El trinquete no exige cero: exige que no
crezca.

| Símbolo | Por qué se deja |
|---|---|
| `negacionesEnTexto` | Su único sitio natural sería otro aviso —«el campo de alergias dice que se interrogó y se negó»—, información de bajo valor compitiendo por el mismo espacio que las alertas que **sí bloquean**. Añadir ruido es el defecto que este loop lleva reparando (REG-245, REG-247). |

## La lista completa

- `src/lib/asr/corrector-vigilado.ts::cambiosDescartados`
- `src/lib/asr/lexicon.ts::nombresDelModulo`
- `src/lib/clinical/safety-gate.ts::buscarDesactivaciones`
- `src/lib/clinical/safety-gate.ts::contarCasos`
- `src/lib/clinical/safety-gate.ts::invariantesProtegidos`
- `src/lib/expediente/antibiograma/intrinseca.ts::carbapenemIntrinsecoR`
- `src/lib/expediente/antibiograma/util.ts::fueEditado`
- `src/lib/expediente/bitacora-csv.ts::csvDeBitacora`
- `src/lib/expediente/cuadro-completo.ts::resumenDelCuadro`
- `src/lib/expediente/experienciador.ts::esAntecedenteFamiliar`
- `src/lib/expediente/exportacion.ts::clavesEsperadas`
- `src/lib/expediente/integrity.ts::verificarIntegridad`
- `src/lib/expediente/medical-dictionary.ts::validacionesGeneralesMedicamentos`
- `src/lib/expediente/parser-clinico.ts::extraerAntibioticosYPatogenos`
- `src/lib/expediente/por-que-no-se-firma.ts::sePuedeFirmar`
- `src/lib/expediente/procedencia.ts::esDeMaquina`
- `src/lib/expediente/que-va-en-la-receta.ts::loQueYaTomaba`
- `src/lib/expediente/templates.ts::esHospitalaria`
- `src/lib/expediente/versioning.ts::obtenerVersion`
- `src/lib/hospital/estados-cama.ts::coherenteConElTipo`
- `src/lib/hospital/eventos.ts::contarAdministracionesVigentes`
- `src/lib/hospital/eventos.ts::serieSignosVigente`
- `src/lib/hospital/eventos.ts::validarCorreccion`
- `src/lib/hospital/firestore.ts::getBandejaLab`
- `src/lib/hospital/firestore.ts::suscribirUnidades`
- `src/lib/seguridad/alergias.ts::negacionesEnTexto`
- `src/lib/seguridad/ofuscar-local.ts::estaOfuscado`
- `src/lib/tareas-clinicas/modelo.ts::estaViva`
- `src/lib/uci/benchmark.ts::correrBenchmark`
- `src/lib/uci/evidencia.ts::evidenciaDe`
- `src/lib/uci/evidencia.ts::reglasDe`
- `src/lib/uci/extraccion.ts::canonizarFarmaco`
- `src/lib/uci/extraccion.ts::extraerValoresUCI`
- `src/lib/uci/formato-nota.ts::renglonesAhorrados`
- `src/lib/uci/labs-nota.ts::analitosConAbreviatura`
- `src/lib/uci/observaciones.ts::tomaVigenteEn`
- `src/lib/uci/scores.ts::descripcionRASS`
- `src/lib/uci/scores.ts::esSedacionLigera`
