# Motores clínicos que no llegan al médico

**Medido el 8-ago-2026** por `node scripts/calidad/motores-conectados.mjs`.
De **771** funciones exportadas en los dominios clínicos y de seguridad,
**44** no se usan en ningún sitio fuera de su propia declaración.

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

## La lista completa

- `src/lib/asr/corrector-vigilado.ts::cambiosDescartados`
- `src/lib/asr/lexicon.ts::nombresDelModulo`
- `src/lib/clinical/safety-gate.ts::buscarDesactivaciones`
- `src/lib/clinical/safety-gate.ts::contarCasos`
- `src/lib/clinical/safety-gate.ts::invariantesProtegidos`
- `src/lib/expediente/antibiograma/intrinseca.ts::carbapenemIntrinsecoR`
- `src/lib/expediente/antibiograma/util.ts::fueEditado`
- `src/lib/expediente/antibiograma/validar-razonamiento.ts::omiteAlertasCriticas`
- `src/lib/expediente/bitacora-csv.ts::csvDeBitacora`
- `src/lib/expediente/cuadro-completo.ts::resumenDelCuadro`
- `src/lib/expediente/experienciador.ts::esAntecedenteFamiliar`
- `src/lib/expediente/exportacion.ts::clavesEsperadas`
- `src/lib/expediente/integrity.ts::verificarIntegridad`
- `src/lib/expediente/medical-dictionary.ts::validacionesGeneralesMedicamentos`
- `src/lib/expediente/ordenes-medicamento.ts::resumenVigentes`
- `src/lib/expediente/parser-clinico.ts::extraerAntibioticosYPatogenos`
- `src/lib/expediente/por-que-no-se-firma.ts::sePuedeFirmar`
- `src/lib/expediente/problemas-activos.ts::resumenProblemas`
- `src/lib/expediente/procedencia.ts::esDeMaquina`
- `src/lib/expediente/que-va-en-la-receta.ts::loQueYaTomaba`
- `src/lib/expediente/templates.ts::esHospitalaria`
- `src/lib/expediente/versioning.ts::obtenerVersion`
- `src/lib/hospital/estados-cama.ts::coherenteConElTipo`
- `src/lib/hospital/eventos.ts::contarAdministracionesVigentes`
- `src/lib/hospital/eventos.ts::serieSignosVigente`
- `src/lib/hospital/eventos.ts::validarCorreccion`
- `src/lib/hospital/firestore.ts::getBandejaLab`
- `src/lib/hospital/firestore.ts::getInternamientosDePaciente`
- `src/lib/hospital/firestore.ts::suscribirUnidades`
- `src/lib/hospital/oxigeno.ts::oxigenoSinDeclarar`
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
- `src/lib/uci/reparto-sistemas.ts::tuvoEstructura`
- `src/lib/uci/scores.ts::descripcionRASS`
- `src/lib/uci/scores.ts::esSedacionLigera`
