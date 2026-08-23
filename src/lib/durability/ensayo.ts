/**
 * EL ENSAYO COMPLETO — respaldar, romper, restaurar, conciliar y decirlo.
 *
 * ── QUÉ AÑADE SOBRE `clinica/simulacro.ts` ───────────────────────────────────
 *
 * `simularRestauracion` ya responde «¿el archivo vuelve a leerse entero?». Se
 * REUTILIZA tal cual: esta función lo llama y conserva su resultado íntegro,
 * porque es la comprobación que ya está probada y porque duplicarla sería tener
 * dos opiniones sobre si un archivo es legible.
 *
 * Lo que añade es lo que #312 pide y aquello no puede responder, porque sólo ve
 * un lado del viaje:
 *
 *   · ¿está el archivo COMPLETO, conciliado contra su propio pie?
 *   · ¿encajan las referencias entre sí?
 *   · ¿alguna nota FIRMADA vuelve distinta?
 *   · ¿queda algún documento declarando pertenecer a otro consultorio?
 *   · ¿reintentar escribiría dos veces?
 *   · ¿qué falta, qué sobra, qué volvió rancio?
 *   · y con todo eso: ¿COMPLETA, PARCIAL, REVISION_HUMANA o FALLIDA?
 *
 * ── NO ESCRIBE EN NINGUNA PARTE ──────────────────────────────────────────────
 *
 * Ni Firestore, ni disco, ni red. Se le entrega el archivo y una fotografía del
 * destino; devuelve un objeto. Quien guarde el acta es el arnés. Así el ensayo
 * se puede correr en el CI, en una prueba y en la máquina de cualquiera, y
 * ninguna de las tres puede tocar datos de nadie.
 */
import { simularRestauracion, type ResultadoSimulacro } from '@/lib/clinica/simulacro'
import { leerLinea, reenraizar, admitir } from '@/lib/clinica/restaurar'
import { COLECCIONES, rutasDelArbol } from '@/lib/clinica/respaldo'
import { evaluarCompletitud, type VeredictoCompletitud, type ObservadoAlReleer } from '@/lib/durability/manifiesto'
import { huellaDeDocumento, huellaDeEntrada, huellaDelConjunto } from '@/lib/durability/huellas'
import { referenciasForasteras, evaluarAislamiento, type HallazgoDeAislamiento } from '@/lib/durability/aislamiento'
import {
  comprobarReferencias, indexar, hayBloqueantes,
  type DocumentoDelRespaldo, type HallazgoReferencial, type IndiceDeExistencia,
} from '@/lib/durability/integridad-referencial'
import { compararNotaFirmada, estaFirmada, type ComparacionFirmada } from '@/lib/durability/verdad-firmada'
import { decidirEscritura, loteDe, type Decision, type DecisionDeEscritura } from '@/lib/durability/idempotencia'
import { reconciliar, type FotoDeDocumento, type Reconciliacion } from '@/lib/durability/reconciliacion'
import {
  derivarSupresiones, evaluarSupresion, SIN_SUPRESIONES,
  type AsientoDeBitacora, type SupresionesVigentes,
} from '@/lib/durability/supresion-arco'
import { verificarRecuperacion, type VerificacionDeRecuperacion } from '@/lib/durability/verificacion-recuperacion'
import { dictaminar, CONTEOS_EN_CERO, type Dictamen, type ConteosDeRestauracion } from '@/lib/durability/veredicto'
import { generarHashIntegridad } from '@/lib/expediente/integrity'
import type { NotaMedica } from '@/types/expediente'

/** La fotografía del consultorio destino ANTES de restaurar. */
export interface FotoDelDestino {
  /** Ruta completa → documento. Vacío = consultorio vacío. */
  documentos: Map<string, Record<string, unknown>>
}

export const DESTINO_VACIO: FotoDelDestino = { documentos: new Map() }

/** Colecciones que el manifiesto conoce, aplanadas. Igual que en la ruta real. */
function coleccionesConocidas(): Set<string> {
  const out = new Set<string>()
  for (const c of COLECCIONES) for (const r of rutasDelArbol(c)) out.add(r)
  return out
}

/** ¿Un documento de esta colección es inmutable? */
export function esColeccionInmutable(coleccion: string, datos: Record<string, unknown>): boolean {
  if (coleccion === 'patients.notas.adendas') return true
  if (coleccion === 'patients.notas.versions') return true
  if (coleccion === 'audit_log') return true
  if (coleccion === 'notification_logs') return true
  if (coleccion === 'dosing_validations') return true
  if (coleccion === 'patients.notas') return estaFirmada(datos)
  return false
}

/** La marca de tiempo de un documento, buscada en los campos que este producto usa. */
export function fechaDelDocumento(d: Record<string, unknown>): string | null {
  for (const c of ['updatedAt', 'versionadoEn', 'fechaModificacion', 'createdAt', 'timestamp', 'fecha']) {
    const v = d[c]
    if (typeof v === 'string' && v) return v
  }
  const m = d.metadata
  if (m && typeof m === 'object') {
    const v = (m as Record<string, unknown>).fechaModificacion
    if (typeof v === 'string' && v) return v
  }
  return null
}

export interface DocumentoEvaluado {
  ruta: string
  coleccion: string
  decision: DecisionDeEscritura
  porQue: string
  lote: number
}

/** Un documento detenido por la compuerta de supresión ARCO. */
export interface DetenidoPorSupresion {
  ruta: string
  coleccion: string
  motivo: string
  patientId: string | null
  porQue: string
}

export interface ResultadoDelEnsayo {
  /** El resultado del simulacro que ya existía, íntegro. */
  simulacroBase: ResultadoSimulacro
  completitud: VeredictoCompletitud
  referenciales: HallazgoReferencial[]
  aislamiento: HallazgoDeAislamiento[]
  /** Notas firmadas que no se pudieron escribir, con su razón. */
  verdadFirmada: { ruta: string; comparacion: ComparacionFirmada }[]
  /** Documentos detenidos por una supresión ARCO vigente en el destino. */
  supresionArco: DetenidoPorSupresion[]
  /** El conjunto de supresiones que se aplicó, y qué asientos se descartaron. */
  supresionesVigentes: SupresionesVigentes
  decisiones: DocumentoEvaluado[]
  conteos: ConteosDeRestauracion
  dictamen: Dictamen
  /** La fotografía resultante, para poder conciliar contra la base. */
  fotoResultante: FotoDeDocumento[]
  reconciliacion: Reconciliacion | null
  /**
   * El veredicto de pérdida clínica sobre la conciliación. `null` cuando no se
   * dio una base contra la que conciliar: sin las dos fotografías no hay nada
   * que verificar, y decirlo es más honesto que devolver «limpia».
   */
  verificacion: VerificacionDeRecuperacion | null
}

export interface OpcionesDelEnsayo {
  clinicIdDestino: string
  destino?: FotoDelDestino
  /** La fotografía de la base ANTES del incidente, para conciliar. */
  base?: FotoDeDocumento[]
  /**
   * Los asientos de `audit_log` del consultorio DESTINO, tal cual salen de la
   * base. De aquí se derivan las supresiones ARCO vigentes, con la misma
   * función que usa la restauración de verdad.
   */
  bitacoraDelDestino?: readonly AsientoDeBitacora[]
  /** Identidad del trabajo, para el aviso de incidente. Opaca. */
  trabajoId?: string
}

/**
 * Corre el ensayo entero sobre un archivo NDJSON.
 *
 * El orden es el de la restauración de verdad, y no es casual: primero se juzga
 * el ARCHIVO (¿está completo?), luego cada documento (¿se puede escribir?), y
 * sólo al final se concilia. Juzgar el archivo al final dejaría escrito medio
 * consultorio antes de descubrir que estaba cortado.
 */
export async function correrEnsayo(
  ndjson: string, op: OpcionesDelEnsayo,
): Promise<ResultadoDelEnsayo> {
  const destino = op.destino ?? DESTINO_VACIO
  const conocidas = coleccionesConocidas()

  // 1. El camino de vuelta que ya estaba probado, sin tocarlo.
  const simulacroBase = simularRestauracion(ndjson, op.clinicIdDestino)

  // 2. Releer el archivo para poder conciliarlo contra su propio pie.
  let cabecera: Record<string, unknown> | null = null
  let pie: Record<string, unknown> | null = null
  const documentos: DocumentoDelRespaldo[] = []
  const conteosObservados: Record<string, number> = {}
  const huellasObservadas: string[] = []

  for (const crudo of ndjson.split(String.fromCharCode(10))) {
    const l = leerLinea(crudo)
    if (!l) continue
    if (l.clase === 'cabecera') { cabecera = l.datos; continue }
    if (l.clase === 'pie') { pie = l.datos; continue }
    if (l.clase === 'rechazada') continue
    conteosObservados[l.coleccion] = (conteosObservados[l.coleccion] ?? 0) + 1
    huellasObservadas.push(await huellaDeEntrada(l.ruta, l.datos))
    documentos.push({ ruta: l.ruta, coleccion: l.coleccion, datos: l.datos })
  }

  const observado: ObservadoAlReleer = {
    documentos: documentos.length,
    conteos: conteosObservados,
    huella: await huellaDelConjunto(huellasObservadas),
  }
  const completitud = evaluarCompletitud(cabecera, pie, observado)

  // 3. Re-enraizar y decidir documento a documento.
  const conteos: ConteosDeRestauracion = { ...CONTEOS_EN_CERO }
  const decisiones: DocumentoEvaluado[] = []
  const aislamiento: HallazgoDeAislamiento[] = []
  const verdadFirmada: { ruta: string; comparacion: ComparacionFirmada }[] = []
  const supresionArco: DetenidoPorSupresion[] = []
  const rutasForasteras = new Set<string>()
  const reenraizados: DocumentoDelRespaldo[] = []
  const fotoResultante: FotoDeDocumento[] = []
  let indice = 0

  /**
   * ── EL CONSULTORIO QUE DECLARA LA CABECERA ES EL ÚNICO QUE PUEDE VENIR ────
   *
   * `reenraizar` reescribe la raíz de CUALQUIER ruta al destino. Eso es lo
   * correcto para el consultorio de origen —es justo lo que hace posible
   * restaurar en otro sitio— pero significa que una línea de un TERCER
   * consultorio, metida a mano en el archivo, también se re-enraíza y aterriza
   * en el destino como si fuera suya. La ruta queda bien; la procedencia, no.
   *
   * Comparando cada raíz original contra el `clinicId` de la cabecera, un
   * archivo con dos historias deja de poder pasar por una.
   */
  const origenDeclarado = typeof cabecera?.clinicId === 'string' ? cabecera.clinicId : null

  /**
   * ── LAS SUPRESIONES SE DERIVAN UNA VEZ, ANTES DE ADMITIR NADA ─────────────
   *
   * Con la MISMA función que la ruta de importación. El ensayo tiene que poder
   * prometer «este paciente no vuelve» y que la restauración de verdad cumpla
   * exactamente esa promesa; dos derivaciones distintas del mismo conjunto son
   * dos promesas que pueden separarse sin que nadie lo note.
   */
  const supresiones = op.bitacoraDelDestino
    ? derivarSupresiones(op.bitacoraDelDestino)
    : SIN_SUPRESIONES

  for (const d of documentos) {
    /**
     * `admitir` va PRIMERO, y no es cosmético: `secretos` no está entre las
     * conocidas (está en `EXCLUIDAS`), así que preguntando antes por las
     * conocidas se rechazaba con «colección desconocida» — cierto, fail-closed,
     * y una razón equivocada. Quien lea el informe tiene que ver que las llaves
     * de API se dejaron fuera A PROPÓSITO, no que el archivo traía basura.
     */
    const v = admitir(d.coleccion)
    if (!v.escribir) { conteos.excluidosPorPolitica++; continue }
    if (!conocidas.has(d.coleccion)) { conteos.rechazadas++; continue }

    const raizOriginal = d.ruta.split('/')[1]
    if (origenDeclarado && raizOriginal && raizOriginal !== origenDeclarado) {
      conteos.esperados++
      conteos.contaminacionEntreConsultorios++
      conteos.enRevisionHumana++
      const rutaMezclada = reenraizar(d.ruta, op.clinicIdDestino)
      rutasForasteras.add(rutaMezclada)
      aislamiento.push({
        clase: 'ruta-forastera', ruta: d.ruta, campo: '_ruta', valor: d.ruta,
        clinicIdVisto: raizOriginal,
        porQue: `la cabecera dice que este respaldo es de «${origenDeclarado}» y esta línea viene de «${raizOriginal}». Re-enraizarla la metería en el destino como si fuera suya.`,
      })
      decisiones.push({
        ruta: rutaMezclada, coleccion: d.coleccion, decision: 'revision-humana',
        porQue: `procedencia distinta de la que declara la cabecera: «${raizOriginal}» ≠ «${origenDeclarado}».`,
        lote: loteDe(indice++),
      })
      continue
    }

    const ruta = reenraizar(d.ruta, op.clinicIdDestino)
    conteos.esperados++
    const lote = loteDe(indice++)

    /**
     * ── COMPUERTA DE SUPRESIÓN ARCO — VA ANTES QUE TODO LO DEMÁS ────────────
     *
     * Antes del aislamiento, antes de la verdad firmada y antes de la
     * frescura. No es orden estético: las otras tres compuertas deciden entre
     * versiones de un documento que SÍ puede volver. Ésta decide si el
     * documento puede volver siquiera, y preguntarlo después sería haber
     * comparado el contenido de un expediente que el titular pidió cancelar.
     */
    const arco = evaluarSupresion(ruta, d.coleccion, d.datos, supresiones)
    if (!arco.admite) {
      conteos.supresionesArcoVigentes++
      conteos.enRevisionHumana++
      supresionArco.push({
        ruta, coleccion: d.coleccion, motivo: arco.motivo,
        patientId: arco.patientId, porQue: arco.porQue,
      })
      decisiones.push({ ruta, coleccion: d.coleccion, decision: 'revision-humana', porQue: arco.porQue, lote })
      continue
    }

    const inmutable = esColeccionInmutable(d.coleccion, d.datos)
    reenraizados.push({ ruta, coleccion: d.coleccion, datos: d.datos })

    // 3a. Aislamiento: ¿arrastra referencias al consultorio de origen?
    const hallazgos = referenciasForasteras(ruta, d.datos, op.clinicIdDestino)
    const ev = evaluarAislamiento(hallazgos, inmutable)
    if (ev.veredicto === 'contaminado' || ev.veredicto === 'revision-humana') {
      aislamiento.push(...hallazgos.filter(h => h.clase !== 'referencia-no-verificable'))
      rutasForasteras.add(ruta)
      conteos.contaminacionEntreConsultorios++
      if (ev.veredicto === 'revision-humana') conteos.enRevisionHumana++
      /**
       * Contaminado NO se escribe en el ensayo: escribirlo dejaría la
       * fotografía resultante con un documento que declara pertenecer a otro,
       * y la conciliación lo daría por restaurado.
       */
      decisiones.push({ ruta, coleccion: d.coleccion, decision: 'revision-humana', porQue: ev.porQue, lote })
      continue
    }
    if (hallazgos.length) aislamiento.push(...hallazgos)

    // 3b. Verdad firmada.
    const enDestino = destino.documentos.get(ruta) ?? null
    if (d.coleccion === 'patients.notas' && (estaFirmada(d.datos) || (enDestino && estaFirmada(enDestino)))) {
      const cmp = await compararNotaFirmada(
        d.datos, enDestino,
        (n, ver) => generarHashIntegridad(n as unknown as NotaMedica, ver as 2 | 3),
      )
      if (cmp.veredicto === 'revision-humana' || cmp.veredicto === 'archivo-alterado' || cmp.veredicto === 'sin-sello-no-juzgable') {
        verdadFirmada.push({ ruta, comparacion: cmp })
        conteos.verdadFirmadaEnConflicto++
        conteos.enRevisionHumana++
        decisiones.push({ ruta, coleccion: d.coleccion, decision: 'revision-humana', porQue: cmp.porQue, lote })
        continue
      }
      if (cmp.veredicto === 'ya-esta') {
        conteos.yaEstaban++
        decisiones.push({ ruta, coleccion: d.coleccion, decision: 'omitir-identico', porQue: cmp.porQue, lote })
        fotoResultante.push(await aFoto(ruta, d.coleccion, enDestino as Record<string, unknown>, inmutable))
        continue
      }
    }

    // 3c. Idempotencia y frescura.
    const decision: Decision = decidirEscritura({
      huellaDelArchivo: await huellaDeDocumento(d.datos),
      huellaDelDestino: enDestino ? await huellaDeDocumento(enDestino) : null,
      esInmutable: inmutable,
      fechaDelArchivo: fechaDelDocumento(d.datos),
      fechaDelDestino: enDestino ? fechaDelDocumento(enDestino) : null,
    })
    decisiones.push({ ruta, coleccion: d.coleccion, decision: decision.decision, porQue: decision.porQue, lote })

    switch (decision.decision) {
      case 'escribir':
      case 'sobrescribir-declarando':
        conteos.escritos++
        fotoResultante.push(await aFoto(ruta, d.coleccion, d.datos, inmutable))
        break
      case 'omitir-identico':
        conteos.yaEstaban++
        fotoResultante.push(await aFoto(ruta, d.coleccion, enDestino as Record<string, unknown>, inmutable))
        break
      case 'no-pisar-lo-mas-nuevo':
        fotoResultante.push(await aFoto(ruta, d.coleccion, enDestino as Record<string, unknown>, inmutable))
        break
      case 'revision-humana':
        conteos.enRevisionHumana++
        if (enDestino) fotoResultante.push(await aFoto(ruta, d.coleccion, enDestino, inmutable))
        break
    }
  }

  /** Lo que ya había en el destino y el archivo no menciona sigue estando. */
  for (const [ruta, datos] of destino.documentos) {
    if (fotoResultante.some(f => f.ruta === ruta)) continue
    if (reenraizados.some(d => d.ruta === ruta)) continue
    fotoResultante.push(await aFoto(ruta, '(del destino)', datos, false))
  }

  // 4. Integridad referencial, sobre lo re-enraizado más lo que ya había.
  const indiceDestino: IndiceDeExistencia = {
    rutas: new Set(destino.documentos.keys()),
    pacientes: new Set(
      [...destino.documentos.keys()]
        .map(r => /^clinics\/[^/]+\/patients\/([^/]+)$/.exec(r)?.[1])
        .filter((x): x is string => !!x),
    ),
  }
  const referenciales = comprobarReferencias(
    reenraizados, indexar(reenraizados, indiceDestino), op.clinicIdDestino,
  )
  conteos.bloqueantesReferenciales = referenciales.filter(h => h.severidad === 'P0').length
  conteos.rechazadas += simulacroBase.rechazadas.length

  // 5. Conciliar, si hay contra qué.
  const reconciliacion = op.base
    ? reconciliar(op.base, fotoResultante, [...rutasForasteras])
    : null

  /**
   * 6. Y sobre esa conciliación —la única que hay— el veredicto de pérdida
   *    clínica, que es lo que responde «¿se puede abrir el consultorio?».
   */
  const verificacion = reconciliacion
    ? verificarRecuperacion(reconciliacion, fotoResultante, {
      clinicId: op.clinicIdDestino, trabajoId: op.trabajoId ?? '(ensayo)',
    })
    : null

  const dictamen = dictaminar(conteos, simulacroBase.pie, completitud.estado)
  return {
    simulacroBase, completitud, referenciales, aislamiento, verdadFirmada,
    supresionArco, supresionesVigentes: supresiones,
    decisiones, conteos, dictamen, fotoResultante, reconciliacion, verificacion,
  }
}

async function aFoto(
  ruta: string, coleccion: string, datos: Record<string, unknown>, esInmutable: boolean,
): Promise<FotoDeDocumento> {
  return {
    ruta, coleccion, esInmutable,
    huella: await huellaDeDocumento(datos),
    fecha: fechaDelDocumento(datos),
  }
}

/** La fotografía de un consultorio a partir de las líneas de su respaldo. */
export async function fotoDeLineas(
  lineas: readonly { _ruta: string; _coleccion: string; [k: string]: unknown }[],
): Promise<FotoDeDocumento[]> {
  const out: FotoDeDocumento[] = []
  for (const l of lineas) {
    const { _ruta, _coleccion, ...datos } = l
    out.push(await aFoto(_ruta, _coleccion, datos, esColeccionInmutable(_coleccion, datos)))
  }
  return out
}

/** `true` si el ensayo salió sin nada que revisar. Más estricto que `ensayoLimpio`. */
export function ensayoImpecable(r: ResultadoDelEnsayo): boolean {
  return r.dictamen.veredicto === 'COMPLETA'
    && !hayBloqueantes(r.referenciales)
    && r.aislamiento.filter(h => h.clase !== 'referencia-no-verificable').length === 0
    && r.verdadFirmada.length === 0
    && r.supresionArco.length === 0
    && (r.reconciliacion === null || r.reconciliacion.limpia)
    /**
     * La verificación de pérdida clínica ve un caso que la conciliación por sí
     * sola no marca: dos documentos con identidades legítimas distintas y el
     * mismo contenido. Sin esta línea, una cita duplicada por un reintento
     * pasaba por «impecable».
     */
    && (r.verificacion === null || r.verificacion.limpia)
}

export const POR_QUE_ESTE_ENSAYO_SIGUE_SIN_SER_EL_RTO =
  'Igual que el simulacro que reutiliza: mide nuestra mitad. No mide el ' +
  '`gcloud firestore databases restore`, que es de Google, ni la escritura ' +
  'real contra un proyecto, ni el tiempo de darse cuenta de que hubo un ' +
  'incidente. Lo que añade es el VEREDICTO, que antes no existía: ahora se ' +
  'puede decir «el archivo vuelve entero Y nada de lo que vuelve está roto», ' +
  'que es una afirmación distinta y más fuerte.'
