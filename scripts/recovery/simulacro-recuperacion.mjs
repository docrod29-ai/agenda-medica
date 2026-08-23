#!/usr/bin/env node
/**
 * ARNÉS DE SIMULACRO DE RECUPERACIÓN — #312 / evidencia de #325.
 *
 *   npm run simulacro:recuperacion
 *   npm run simulacro:recuperacion -- --pacientes=600      # ~10 000 documentos
 *   npm run simulacro:recuperacion -- --solo=nota-firmada-alterada
 *   npm run simulacro:recuperacion -- --sin-evidencia      # no escribe el acta
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 *  1. genera DOS consultorios sintéticos (A y B) con la misma semilla;
 *  2. respalda A en NDJSON del formato v2, con recuentos y huella;
 *  3. guarda la fotografía de A como línea base;
 *  4. inyecta cada avería, una a una, sobre una copia del archivo;
 *  5. corre la restauración simulada contra un consultorio destino;
 *  6. concilia contra la línea base;
 *  7. comprueba que la avería SE DETECTA (si no, el caso sale en rojo);
 *  8. escribe el acta en JSON y en Markdown, sin pisar ninguna anterior.
 *
 * ── LO QUE NO HACE, Y NO ES UN DESCUIDO ──────────────────────────────────────
 *
 *  · No toca Firestore, ni Storage, ni la red. No puede: no importa el SDK.
 *  · No usa datos reales. El fixture es sintético y sin cifras clínicas.
 *  · **No mide el RTO.** Mide nuestra mitad —leer, re-enraizar, decidir y
 *    conciliar— exactamente igual que `npm run simulacro:respaldo`, y lo dice
 *    en su propia salida. El `gcloud firestore databases restore` sigue siendo
 *    del ensayo con consola.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { execSync } from 'node:child_process'

const { generarConsultorio, aRespaldoNdjson, objetosDelFixture, inyectar, AVERIAS, averiasSinDetector, VERSION_FIXTURE } =
  await import('../../src/lib/durability/fixtures.ts')
const { correrEnsayo, fotoDeLineas, ensayoImpecable, DESTINO_VACIO } =
  await import('../../src/lib/durability/ensayo.ts')
const { cruzarObjetos, rutaDelObjetoDeLaUrl } =
  await import('../../src/lib/durability/adjuntos.ts')
const { calcularPuntoSeguro, huecosDeContinuidad, FALLOS_ANTES_DE_AVISAR } =
  await import('../../src/lib/durability/autosave-contrato.ts')
const { tramosDeHoy, descargoDeAlcance, rtoPublicable, sumarTramosMedidos } =
  await import('../../src/lib/durability/rpo-rto.ts')
const { decidirEscritura, loteDe, confirmarLote, esElMismoTrabajo, loteYaConfirmado, DOCUMENTOS_POR_LOTE } =
  await import('../../src/lib/durability/idempotencia.ts')
const { huellaDelArchivo, huellaDeTrabajo } =
  await import('../../src/lib/durability/huellas.ts')
const { reconciliar } = await import('../../src/lib/durability/reconciliacion.ts')
const { planearTodo } = await import('../../src/lib/durability/rollback.ts')
const { clasificar, permisoDeBorrado, retencionLegalPuedeCaducar } =
  await import('../../src/lib/durability/archivado.ts')

const SALTO = String.fromCharCode(10)
const arg = (n, pordefecto) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`))
  return m ? m.slice(n.length + 3) : pordefecto
}
const bandera = n => process.argv.includes(`--${n}`)

const PACIENTES = Number(arg('pacientes', '40')) || 40
const SOLO = arg('solo', null)
const CLINICA_A = 'clinica-sintetica-a'
const CLINICA_B = 'clinica-sintetica-b'
const DESTINO = 'clinica-destino-de-ensayo'
const GENERADO_EN = '2026-01-05T09:00:00.000Z'   // fijo: el acta tiene que ser repetible

function sha() {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { return 'sin-git' }
}

const OPCIONES_A = { clinicId: CLINICA_A, pacientes: PACIENTES, notasPorPaciente: 3, citasPorPaciente: 2, semilla: 20260823 }
const OPCIONES_B = { clinicId: CLINICA_B, pacientes: Math.max(2, Math.floor(PACIENTES / 10)), notasPorPaciente: 2, citasPorPaciente: 1, semilla: 20260824 }

console.log('')
console.log('  SIMULACRO DE RECUPERACIÓN — #312')
console.log(`  fixture ${VERSION_FIXTURE} · ${PACIENTES} pacientes sintéticos · commit ${sha().slice(0, 10)}`)
console.log('')

const t0 = performance.now()
const docsA = await generarConsultorio(OPCIONES_A)
const docsB = await generarConsultorio(OPCIONES_B)
const msGenerar = performance.now() - t0

const t1 = performance.now()
const respaldoA = await aRespaldoNdjson(docsA, CLINICA_A, GENERADO_EN)
const msRespaldar = performance.now() - t1

const baseA = await fotoDeLineas(docsA)
console.log(`  Consultorio A: ${docsA.length} documentos · respaldo de ${(respaldoA.length / 1024).toFixed(0)} KiB`)
console.log(`  Consultorio B: ${docsB.length} documentos (para las averías de aislamiento)`)
console.log('')

/**
 * ── LOS DOS ÚNICOS TRAMOS QUE ESTE ARNÉS PUEDE CRONOMETRAR ──────────────────
 *
 * Se miden aparte del bucle de escenarios, sobre el archivo LIMPIO y sin
 * inyectar nada, porque lo que interesa es cuánto tarda el camino de vuelta
 * cuando todo va bien. Todo lo demás sigue en NOT_MEASURED, y así se publica.
 */
const tParse = performance.now()
const ensayoLimpioParaMedir = await correrEnsayo(respaldoA, { clinicIdDestino: CLINICA_A, destino: DESTINO_VACIO })
const msParseoYReenraizado = performance.now() - tParse

const tVerif = performance.now()
reconciliar(baseA, ensayoLimpioParaMedir.fotoResultante, [])
const msVerificacion = performance.now() - tVerif

const escenarios = []

/** Corre un escenario y lo apunta. */
async function escenario(nombre, fn) {
  if (SOLO && SOLO !== nombre) return
  const t = performance.now()
  let r
  try {
    r = await fn()
  } catch (e) {
    r = { detectada: false, comoSeDetecto: `EXCEPCIÓN: ${e instanceof Error ? e.message : String(e)}` }
  }
  const ms = performance.now() - t
  escenarios.push({ nombre, ms: Math.round(ms * 100) / 100, ...r })
  const marca = r.detectada ? '✅' : '❌'
  console.log(`  ${marca} ${nombre.padEnd(34)} ${r.comoSeDetecto}`)
}

// ── 0. El caso feliz: la ida y vuelta limpia ────────────────────────────────
await escenario('ida-y-vuelta-limpia', async () => {
  const r = await correrEnsayo(respaldoA, { clinicIdDestino: CLINICA_A, destino: DESTINO_VACIO, base: baseA })
  const ok = ensayoImpecable(r)
  return {
    detectada: ok,
    comoSeDetecto: ok
      ? `veredicto ${r.dictamen.veredicto}, ${r.conteos.escritos} escritos, reconciliación limpia`
      : `NO salió limpia: ${r.dictamen.veredicto} · ${r.dictamen.porQue.join(' · ')}`,
    veredicto: r.dictamen.veredicto,
    conteos: r.conteos,
    reconciliacion: r.reconciliacion?.porClase ?? null,
  }
})

// ── 1..12. Las averías de ARCHIVO ───────────────────────────────────────────
for (const av of AVERIAS.filter(a => a.ambito === 'archivo')) {
  await escenario(av.codigo, async () => {
    const { ndjson, queSeToco } = inyectar(respaldoA, av.codigo)

    /**
     * `metadato-sin-adjunto` no toca el archivo: se comprueba cruzando el
     * listado del bucket destino, del que se quita un objeto a propósito.
     */
    if (av.codigo === 'metadato-sin-adjunto') {
      const objetos = objetosDelFixture(OPCIONES_A).slice(1)   // falta el primero
      const metadatos = docsA
        .filter(d => d._coleccion === 'patients.fotos' || d._coleccion === 'config')
        .map(d => ({
          ruta: d._ruta, coleccion: d._coleccion,
          url: String(d.url ?? d.membrete ?? ''),
          rutaDelObjeto: rutaDelObjetoDeLaUrl(String(d.url ?? d.membrete ?? '')),
          huellaDeclarada: null,
        }))
      const roturas = cruzarObjetos(metadatos, objetos, [`med-${CLINICA_A}-1`])
      const vistas = roturas.filter(x => x.clase === 'metadato-sin-objeto')
      return {
        detectada: vistas.length > 0,
        comoSeDetecto: vistas.length ? `${vistas.length} metadato(s) sin objeto en el bucket destino` : 'NO se detectó',
        queSeToco, roturas: roturas.map(x => x.clase),
      }
    }

    if (av.codigo === 'adjunto-sin-metadato') {
      const objetos = objetosDelFixture(OPCIONES_A)
      const metadatos = docsA
        .filter(d => d._coleccion === 'patients.fotos')
        .slice(1)                                            // falta el metadato del primero
        .map(d => ({
          ruta: d._ruta, coleccion: d._coleccion, url: String(d.url ?? ''),
          rutaDelObjeto: rutaDelObjetoDeLaUrl(String(d.url ?? '')), huellaDeclarada: null,
        }))
      const roturas = cruzarObjetos(metadatos, objetos, [`med-${CLINICA_A}-1`])
      const vistas = roturas.filter(x => x.clase === 'objeto-sin-metadato')
      return {
        detectada: vistas.length > 0,
        comoSeDetecto: vistas.length ? `${vistas.length} objeto(s) que ningún documento referencia` : 'NO se detectó',
        queSeToco, roturas: roturas.map(x => x.clase),
      }
    }

    /** `version-rancia` necesita un destino que ya tenga la versión nueva. */
    const destino = { documentos: new Map() }
    if (av.codigo === 'version-rancia') {
      for (const d of docsA) {
        if (d._coleccion !== 'patients.notas') continue
        const { _ruta, _coleccion, ...datos } = d
        destino.documentos.set(_ruta, { ...datos, updatedAt: '2026-06-01T00:00:00.000Z' })
      }
    }

    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA_A, destino, base: baseA })
    const señales = {
      'respaldo-truncado-sin-pie': () => !r.simulacroBase.pie && r.completitud.estado !== 'completo',
      'linea-json-corrupta': () => r.simulacroBase.rechazadas.length > 0,
      'documento-ausente': () => (r.reconciliacion?.porClase.FALTA ?? 0) > 0,
      'documento-duplicado': () => (r.reconciliacion?.porClase.SOBRA ?? 0) > 0,
      'version-rancia': () => r.decisiones.some(d => d.decision === 'no-pisar-lo-mas-nuevo'),
      'ruta-de-otro-consultorio': () => r.aislamiento.some(h => h.campo === '_ruta' && h.clinicIdVisto === 'consultorio-ajeno'),
      'referencia-interna-forastera': () => r.conteos.contaminacionEntreConsultorios > 0,
      'nota-firmada-alterada': () => r.verdadFirmada.some(v => v.comparacion.veredicto === 'archivo-alterado'),
      'adenda-sin-nota': () => r.referenciales.some(h => h.codigo === 'adenda-sin-nota'),
      'huella-corrompida': () => r.completitud.motivos.some(m => m.includes('huella')),
    }
    const detectada = (señales[av.codigo] ?? (() => false))()
    return {
      detectada,
      comoSeDetecto: detectada
        ? `veredicto ${r.dictamen.veredicto} · ${av.detectadaPor}`
        : `NO se detectó · veredicto ${r.dictamen.veredicto}`,
      queSeToco,
      veredicto: r.dictamen.veredicto,
      completitud: r.completitud.estado,
      reconciliacion: r.reconciliacion?.porClase ?? null,
    }
  })
}

// ── 13. Mezcla de dos consultorios en el mismo archivo ──────────────────────
await escenario('archivo-con-dos-consultorios', async () => {
  const mezclado = await aRespaldoNdjson([...docsA, ...docsB], CLINICA_A, GENERADO_EN)
  const r = await correrEnsayo(mezclado, { clinicIdDestino: CLINICA_A, destino: DESTINO_VACIO })
  const detectada = r.conteos.contaminacionEntreConsultorios > 0 && r.dictamen.veredicto === 'REVISION_HUMANA'
  return {
    detectada,
    comoSeDetecto: detectada
      ? `${r.conteos.contaminacionEntreConsultorios} documento(s) del consultorio B detectados, veredicto ${r.dictamen.veredicto}`
      : `NO se detectó la mezcla · veredicto ${r.dictamen.veredicto}`,
    veredicto: r.dictamen.veredicto,
  }
})

// ── 14. Restaurar A en un consultorio DISTINTO (re-enraizado autorizado) ────
await escenario('re-enraizado-a-otro-consultorio', async () => {
  const r = await correrEnsayo(respaldoA, { clinicIdDestino: DESTINO, destino: DESTINO_VACIO })
  /**
   * Lo esperado NO es que salga limpio: las notas firmadas llevan `clinicId`
   * DENTRO del sello, así que re-enraizarlas es alterarlas. Lo que se comprueba
   * es que el sistema lo VEA y pare, en vez de escribirlas contaminadas.
   */
  const detectada = r.dictamen.veredicto === 'REVISION_HUMANA' && r.conteos.contaminacionEntreConsultorios > 0
  return {
    detectada,
    comoSeDetecto: detectada
      ? `${r.conteos.contaminacionEntreConsultorios} documento(s) declaran pertenecer a «${CLINICA_A}»; veredicto ${r.dictamen.veredicto} (correcto: no se escribe)`
      : `esperaba REVISION_HUMANA y salió ${r.dictamen.veredicto}`,
    veredicto: r.dictamen.veredicto,
    conteos: r.conteos,
  }
})

// ── 15..18. Las averías de PROCESO ─────────────────────────────────────────
await escenario('peticion-repetida', async () => {
  const primera = await correrEnsayo(respaldoA, { clinicIdDestino: CLINICA_A, destino: DESTINO_VACIO, base: baseA })
  const destinoTrasLaPrimera = { documentos: new Map() }
  for (const d of docsA) {
    const { _ruta, _coleccion, ...datos } = d
    destinoTrasLaPrimera.documentos.set(_ruta, datos)
  }
  const segunda = await correrEnsayo(respaldoA, { clinicIdDestino: CLINICA_A, destino: destinoTrasLaPrimera, base: baseA })
  const detectada = segunda.conteos.escritos === 0
    && segunda.conteos.yaEstaban === primera.conteos.escritos
    && (segunda.reconciliacion?.limpia ?? false)
  return {
    detectada,
    comoSeDetecto: detectada
      ? `la segunda pasada escribe 0 y reconoce ${segunda.conteos.yaEstaban} idénticos; el estado final no cambia`
      : `la segunda pasada escribió ${segunda.conteos.escritos} (esperaba 0)`,
    primera: primera.conteos, segunda: segunda.conteos,
  }
})

await escenario('timeout-despues-de-escribir', async () => {
  /** Igual que el reintento, pero con sólo la MITAD escrita antes del corte. */
  const mitad = Math.floor(docsA.length / 2)
  const destino = { documentos: new Map() }
  for (const d of docsA.slice(0, mitad)) {
    const { _ruta, _coleccion, ...datos } = d
    destino.documentos.set(_ruta, datos)
  }
  const r = await correrEnsayo(respaldoA, { clinicIdDestino: CLINICA_A, destino, base: baseA })
  const detectada = r.conteos.yaEstaban >= mitad - 5 && (r.reconciliacion?.limpia ?? false)
  return {
    detectada,
    comoSeDetecto: detectada
      ? `${r.conteos.yaEstaban} reconocidos como ya escritos, ${r.conteos.escritos} completados; sin duplicados`
      : `esperaba ~${mitad} ya escritos y hubo ${r.conteos.yaEstaban}`,
    conteos: r.conteos,
  }
})

await escenario('reinicio-del-proceso', async () => {
  const huella = await huellaDelArchivo(respaldoA)
  const trabajoId = await huellaDeTrabajo(CLINICA_A, CLINICA_A, huella)
  let trabajo = {
    trabajoId, origen: CLINICA_A, destino: CLINICA_A, huellaDelArchivo: huella,
    esperados: docsA.length, ultimoLoteConfirmado: -1, escritosConfirmados: 0,
    iniciadoEn: GENERADO_EN, actualizadoEn: GENERADO_EN, estado: 'en-curso',
  }
  /**
   * Lote pequeño A PROPÓSITO: con el tamaño de producción (400) un fixture de
   * ensayo cabe en un solo lote, y un escenario de reanudación con un solo lote
   * no reanuda nada — pasaría en verde sin ejercitar el corte. Se parte en
   * cuatro para que haya de verdad un «antes» y un «después» del reinicio.
   */
  const PORLOTE = Math.max(1, Math.ceil(docsA.length / 4))
  const totalLotes = Math.ceil(docsA.length / PORLOTE)
  const hastaDondeLlegoAntesDeMorir = Math.max(0, Math.floor(totalLotes / 2) - 1)
  for (let l = 0; l <= hastaDondeLlegoAntesDeMorir; l++) {
    trabajo = confirmarLote(trabajo, l, PORLOTE, GENERADO_EN)
  }
  // El proceso se reinicia: misma terna, se reanuda.
  const mismo = esElMismoTrabajo(trabajo, { trabajoId, origen: CLINICA_A, destino: CLINICA_A, huellaDelArchivo: huella })
  let saltados = 0, rehechos = 0
  for (let i = 0; i < docsA.length; i++) {
    if (loteYaConfirmado(trabajo, loteDe(i, PORLOTE))) saltados++
    else rehechos++
  }
  // Y un trabajo con OTRO archivo no se reanuda encima de éste.
  const otro = esElMismoTrabajo(trabajo, { trabajoId, origen: CLINICA_A, destino: CLINICA_A, huellaDelArchivo: 'otra-huella' })
  const detectada = mismo && !otro && saltados > 0 && rehechos > 0 && totalLotes > 1
  return {
    detectada,
    comoSeDetecto: detectada
      ? `se reanuda tras el lote ${trabajo.ultimoLoteConfirmado}: ${saltados} saltados, ${rehechos} rehechos; un archivo distinto NO reanuda encima`
      : `mismo=${mismo} otro=${otro} saltados=${saltados} rehechos=${rehechos}`,
    ultimoLoteConfirmado: trabajo.ultimoLoteConfirmado,
  }
})

await escenario('restauracion-interrumpida', async () => {
  /**
   * El punto de control sólo avanza tras CONFIRMAR. Si el proceso muere a mitad
   * de un lote, ese lote no consta y el reintento lo rehace entero — que es
   * inocuo, porque escribir el mismo documento dos veces deja el mismo
   * documento. Lo que NO puede pasar es que conste un lote que no se escribió.
   */
  let trabajo = {
    trabajoId: 't', origen: CLINICA_A, destino: CLINICA_A, huellaDelArchivo: 'h',
    esperados: 1000, ultimoLoteConfirmado: -1, escritosConfirmados: 0,
    iniciadoEn: GENERADO_EN, actualizadoEn: GENERADO_EN, estado: 'en-curso',
  }
  trabajo = confirmarLote(trabajo, 0, DOCUMENTOS_POR_LOTE, GENERADO_EN)
  // El lote 1 muere a mitad: NO se confirma.
  const loteMuertoConsta = loteYaConfirmado(trabajo, 1)
  const detectada = loteMuertoConsta === false && trabajo.ultimoLoteConfirmado === 0
  return {
    detectada,
    comoSeDetecto: detectada
      ? 'el lote que murió a mitad no consta; el reintento lo rehace entero'
      : `el lote muerto consta como hecho (ultimoLoteConfirmado=${trabajo.ultimoLoteConfirmado})`,
  }
})

// ── 19. Deshacer sin borrar trabajo posterior ──────────────────────────────
await escenario('rollback-no-borra-lo-posterior', async () => {
  const asientos = docsA.slice(0, 20).map(d => ({
    ruta: d._ruta, huellaPrevia: null, huellaEscrita: 'H',
    esInmutable: d._coleccion === 'patients.notas.adendas',
  }))
  const actuales = asientos.map((a, i) => ({
    ruta: a.ruta,
    // El médico tocó dos documentos después de la restauración.
    huellaActual: i < 2 ? 'H-EDITADA-POR-EL-MEDICO' : 'H',
  }))
  const plan = planearTodo(asientos, actuales)
  const tocados = plan.reversiones.filter(r => r.accion === 'revision-humana')
  const detectada = tocados.length >= 2 && !plan.aplicableSinPersona
  return {
    detectada,
    comoSeDetecto: detectada
      ? `${tocados.length} documento(s) modificados después quedan para revisión; la reversión NO se aplica sola`
      : `esperaba al menos 2 en revisión y hubo ${tocados.length}`,
    resumen: plan.resumen,
  }
})

// ── 20. Retención: elegible no es borrar, y la retención legal no caduca ────
await escenario('retencion-no-borra-nada-clinico', async () => {
  const hace30anos = Date.parse(GENERADO_EN) - 30 * 365 * 86_400_000
  const viejo = clasificar({
    ultimaActividad: new Date(hace30anos).toISOString(),
    ultimaNotaFirmada: new Date(hace30anos).toISOString(),
    retencionLegal: false, retencionClinica: null, arcoAbierta: false,
    archivadoPorElConsultorio: true,
  }, Date.parse(GENERADO_EN), 365 * 5)
  const conRetencion = clasificar({
    ultimaActividad: new Date(hace30anos).toISOString(),
    ultimaNotaFirmada: new Date(hace30anos).toISOString(),
    retencionLegal: true, retencionClinica: null, arcoAbierta: false,
    archivadoPorElConsultorio: false,
  }, Date.parse(GENERADO_EN), 365 * 5)
  const permiso = permisoDeBorrado(viejo.estado)
  const caduca = retencionLegalPuedeCaducar()
  const detectada = viejo.estado === 'ELEGIBLE_PARA_BORRADO'
    && permiso.autorizadoAborrar === false
    && conRetencion.estado === 'RETENCION_LEGAL'
    && caduca.puede === false
  return {
    detectada,
    comoSeDetecto: detectada
      ? 'expediente de 30 años → ELEGIBLE_PARA_BORRADO, y aun así autorizadoAborrar=false; con retención legal gana la retención y no caduca'
      : `viejo=${viejo.estado} permiso=${permiso.autorizadoAborrar} conRetencion=${conRetencion.estado}`,
    estados: { viejo: viejo.estado, conRetencion: conRetencion.estado },
  }
})

// ── 21. Continuidad de la consulta: el punto seguro se ve o no se ve ───────
await escenario('punto-seguro-de-la-consulta', async () => {
  const ahora = Date.parse(GENERADO_EN)
  const bien = calcularPuntoSeguro({
    ultimoConfirmadoEnServidorMs: ahora - 20_000, ultimaCopiaLocalMs: ahora - 2_000,
    ultimoCambioMs: ahora - 25_000, guardandoAhora: false, fallosSeguidos: 0,
    conflictoDeVersion: false, firmada: false,
  }, ahora)
  const caido = calcularPuntoSeguro({
    ultimoConfirmadoEnServidorMs: ahora - 240_000, ultimaCopiaLocalMs: ahora - 1_000,
    ultimoCambioMs: ahora - 1_000, guardandoAhora: false, fallosSeguidos: FALLOS_ANTES_DE_AVISAR,
    conflictoDeVersion: false, firmada: false,
  }, ahora)
  const conflicto = calcularPuntoSeguro({
    ultimoConfirmadoEnServidorMs: ahora - 60_000, ultimaCopiaLocalMs: ahora - 1_000,
    ultimoCambioMs: ahora - 1_000, guardandoAhora: false, fallosSeguidos: 0,
    conflictoDeVersion: true, firmada: false,
  }, ahora)
  const detectada = bien.estado === 'al-dia' && !bien.exigeAtencion
    && caido.estado === 'en-riesgo' && caido.exigeAtencion
    && conflicto.estado === 'conflicto' && conflicto.exigeAtencion
  return {
    detectada,
    comoSeDetecto: detectada
      ? `al-dia / en-riesgo / conflicto se distinguen; ${huecosDeContinuidad().length} hueco(s) de continuidad declarados para #306`
      : `bien=${bien.estado} caido=${caido.estado} conflicto=${conflicto.estado}`,
    huecos: huecosDeContinuidad().map(h => h.suceso),
    frases: { bien: bien.frase, caido: caido.frase, conflicto: conflicto.frase },
  }
})

const msTotal = performance.now() - t0

// ── El acta ─────────────────────────────────────────────────────────────────
const sinDetector = averiasSinDetector()
const fallidos = escenarios.filter(e => !e.detectada)
const tramos = tramosDeHoy()
/**
 * Sólo estos dos pasan de NOT_MEASURED a OBSERVED, y con el alcance pegado. El
 * resto se queda sin medir a propósito: rellenarlos con «lo que suele tardar»
 * es exactamente lo que convierte una tabla honesta en una diapositiva.
 */
tramos.parseoYReenraizado = {
  procedencia: process.env.CI ? 'OBSERVED_CI' : 'OBSERVED_LOCAL',
  ms: Math.round(msParseoYReenraizado),
  alcance: `leer las ${docsA.length} líneas del NDJSON, re-enraizar cada ruta al destino y decidir documento a documento (aislamiento, verdad firmada, frescura, idempotencia) sobre el fixture ${VERSION_FIXTURE}`,
  noCubre: 'ni una escritura en Firestore: este arnés no importa el SDK. Tampoco el restore de Google.',
}
tramos.verificacion = {
  procedencia: process.env.CI ? 'OBSERVED_CI' : 'OBSERVED_LOCAL',
  ms: Math.round(msVerificacion),
  alcance: `conciliar ${docsA.length} documentos contra la línea base: faltantes, sobrantes, distintos, rancios y forasteros`,
  noCubre: 'la comprobación referencial y de aislamiento, que van dentro del tramo anterior; y cualquier verificación contra un consultorio real.',
}
const publicable = rtoPublicable(tramos)
const medidos = sumarTramosMedidos(tramos)

const acta = {
  drillId: `simulacro-recuperacion-${GENERADO_EN.slice(0, 10)}-${PACIENTES}p`,
  environment: process.env.CI ? 'ci' : 'local',
  commitSha: sha(),
  backupVersion: 'nexusmed-respaldo-2',
  fixtureVersion: VERSION_FIXTURE,
  lossInjectedAt: null,
  backupTimestamp: GENERADO_EN,
  restoreStartedAt: GENERADO_EN,
  restoreCompletedAt: GENERADO_EN,
  verifiedAt: GENERADO_EN,
  /**
   * NULL A PROPÓSITO. No se ha simulado una pérdida contra un reloj real, así
   * que no hay ventana de pérdida que medir; y el RTO no se publica mientras
   * queden tramos sin medir — ver `rpoRto.tramosSinMedir`.
   */
  observedRpoMs: null,
  observedRtoMs: null,
  sumaDeTramosMedidosMs: medidos.ms,
  tramosMedidos: medidos.tramos,
  scopeMeasured: [
    'generar el fixture sintético',
    'serializar el respaldo NDJSON v2 con recuentos y huella',
    'releer el archivo, re-enraizar y decidir documento a documento',
    'conciliar la fotografía resultante contra la línea base',
  ],
  exclusions: [
    'gcloud firestore databases restore — es de Google y se cronometra con consola',
    'escritura real contra un proyecto de Firestore — este arnés no importa el SDK',
    'tiempo de detección del incidente — no hay vigilancia que dispare sobre pérdida de datos clínicos',
    'descarga de objetos de Cloud Storage — se comprueban nombres y tamaños, nunca contenido',
  ],
  medidoEnMs: {
    generarFixture: Math.round(msGenerar),
    serializarRespaldo: Math.round(msRespaldar),
    totalDelArnes: Math.round(msTotal),
  },
  fixture: {
    consultorioA: { ...OPCIONES_A, documentos: docsA.length },
    consultorioB: { ...OPCIONES_B, documentos: docsB.length },
    bytesDelRespaldo: respaldoA.length,
  },
  escenarios,
  averiasSinDetector: sinDetector,
  rpoRto: {
    tramos,
    publicable: publicable.publicable,
    tramosSinMedir: publicable.faltan,
    sumaDeTramosMedidosMs: medidos.ms,
    descargo: descargoDeAlcance(tramos),
  },
  verdict: fallidos.length === 0 && sinDetector.length === 0 ? 'PASS' : 'FAIL',
  unresolvedIssues: [
    ...fallidos.map(f => `escenario sin detectar: ${f.nombre} — ${f.comoSeDetecto}`),
    ...sinDetector.map(c => `avería declarada sin detector: ${c}`),
    'El ensayo con consola (`gcloud firestore databases restore`) sigue sin correrse nunca. Ver docs/SIMULACRO_RESTAURACION.md.',
    'Los objetos de Cloud Storage (fotografía clínica, membrete, firma) NO viajan en el respaldo NDJSON. Restaurar deja el metadato apuntando a un objeto del consultorio de origen.',
  ],
}

console.log('')
console.log(`  Veredicto del arnés: ${acta.verdict}  (${escenarios.length} escenarios, ${fallidos.length} sin detectar)`)
console.log(`  ${descargoDeAlcance(tramos)}`)
console.log('')
console.log('  ESTO NO ES EL RTO. Mide nuestra mitad, igual que `npm run simulacro:respaldo`.')
console.log('')

if (!bandera('sin-evidencia')) {
  const dir = join(process.cwd(), 'docs', 'recovery', 'evidencia')
  mkdirSync(dir, { recursive: true })
  const nombre = `${acta.drillId}-${acta.commitSha.slice(0, 10)}`
  const rutaJson = join(dir, `${nombre}.json`)
  const rutaMd = join(dir, `${nombre}.md`)

  /**
   * NUNCA se pisa un acta anterior. Una evidencia que se sobrescribe deja de
   * ser evidencia: pasa a ser el último intento, y el histórico —que es donde
   * se ve si algo empeoró— desaparece sin que nadie lo note.
   */
  if (existsSync(rutaJson)) {
    console.log(`  ⚠️  Ya existe ${rutaJson}. NO se sobrescribe: borra el anterior a mano si de verdad quieres repetir el mismo acta.`)
  } else {
    writeFileSync(rutaJson, `${JSON.stringify(acta, null, 2)}${SALTO}`)
    writeFileSync(rutaMd, aMarkdown(acta))
    console.log(`  Acta: ${rutaJson}`)
    console.log(`        ${rutaMd}`)
    console.log('')
  }
}

process.exit(acta.verdict === 'PASS' ? 0 : 1)

function aMarkdown(a) {
  const l = []
  l.push(`# Simulacro de recuperación — ${a.drillId}`)
  l.push('')
  l.push(`> Veredicto del arnés: **${a.verdict}** · ${a.escenarios.length} escenarios`)
  l.push('>')
  l.push('> **Esto NO es el RTO.** Mide nuestra mitad del camino de vuelta.')
  l.push('')
  l.push('## Qué corrió')
  l.push('')
  l.push(`- commit: \`${a.commitSha}\``)
  l.push(`- entorno: ${a.environment}`)
  l.push(`- formato del respaldo: ${a.backupVersion}`)
  l.push(`- fixture: ${a.fixtureVersion} — A: ${a.fixture.consultorioA.documentos} documentos, B: ${a.fixture.consultorioB.documentos}`)
  l.push(`- tamaño del respaldo: ${(a.fixture.bytesDelRespaldo / 1024).toFixed(0)} KiB`)
  l.push('')
  l.push('## Escenarios')
  l.push('')
  l.push('| escenario | detectado | cómo | ms |')
  l.push('|---|---|---|---|')
  for (const e of a.escenarios) {
    l.push(`| \`${e.nombre}\` | ${e.detectada ? '✅' : '❌'} | ${e.comoSeDetecto} | ${e.ms} |`)
  }
  l.push('')
  l.push('## RPO / RTO')
  l.push('')
  l.push(`\`observedRpoMs\`: ${a.observedRpoMs ?? '**NOT_MEASURED**'}`)
  l.push('')
  l.push(`\`observedRtoMs\`: ${a.observedRtoMs ?? '**NOT_MEASURED**'} — no se publica mientras queden tramos sin medir: ${a.rpoRto.tramosSinMedir.join(', ')}`)
  l.push('')
  l.push(`Suma de los tramos que SÍ se midieron: **${a.rpoRto.sumaDeTramosMedidosMs} ms** (${a.tramosMedidos.join(', ')}). Esto no es el RTO.`)
  l.push('')
  l.push('| tramo | procedencia | ms | alcance |')
  l.push('|---|---|---|---|')
  for (const [n, c] of Object.entries(a.rpoRto.tramos)) {
    l.push(`| ${n} | \`${c.procedencia}\` | ${c.ms ?? '—'} | ${c.alcance} |`)
  }
  l.push('')
  l.push(`> ${a.rpoRto.descargo}`)
  l.push('')
  l.push('## Qué se midió')
  l.push('')
  for (const s of a.scopeMeasured) l.push(`- ${s}`)
  l.push('')
  l.push('## Qué NO se midió')
  l.push('')
  for (const s of a.exclusions) l.push(`- ${s}`)
  l.push('')
  l.push('## Sin resolver')
  l.push('')
  for (const s of a.unresolvedIssues) l.push(`- ${s}`)
  l.push('')
  return l.join(SALTO)
}
