/**
 * LA COMPUERTA DE CALIDAD — un modelo no es elegible por existir.
 *
 * #313 §D. Contrato: MODELO + CLASE DE TAREA + VERSIÓN DE BENCHMARK → resultado.
 *
 * ── POR QUÉ ESTE MÓDULO NO TRAE NI UN DATO ───────────────────────────────────
 *
 * Porque no se ha medido. `casos-oro.ts` tiene cuatro casos sintéticos y lo dice
 * de sí mismo: «no es una medición de producción». Cargar aquí una tabla con
 * `claude-sonnet-5: exactitud 0.94` sería exactamente el fallo que
 * `precios-modelo.ts` evita naciendo vacío — una cifra plausible que se cita,
 * se copia a una proyección y acaba decidiendo a qué modelo se baja la nota.
 *
 * Así que la evidencia es un **dato de entrada** del router. Hoy no hay ninguna,
 * y la consecuencia está implementada, no comentada: sin evidencia vigente, un
 * modelo no se promueve. El harness de sombra corre con fixtures SINTÉTICAS que
 * viven en la prueba, no aquí, para que nadie las confunda con una medición.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * SIN BENCHMARK · BENCHMARK CADUCADO · BENCHMARK FALLIDO
 *   → no se promueve automáticamente a una tarea de mayor riesgo.
 *
 * Y «caducado» tiene dos formas. Por VERSIÓN es siempre obligatoria: una
 * evidencia medida con otro corpus no vale, tenga la edad que tenga, porque no
 * midió lo mismo. Por TIEMPO sólo cuando alguien declaró cuántos días — no se
 * inventa una caducidad.
 *
 * Módulo PURO. Reutiliza `ResumenEvaluacion` de `evaluacion.ts` sin copiarlo.
 */
import type { ClaseTarea, EvidenciaCalidad, NivelRiesgo, PisoCalidad } from '@/lib/ia/router/tareas'
import { pisoEsMedible } from '@/lib/ia/router/tareas'

/** Veredicto de la compuerta. Sólo uno deja pasar. */
export type EstadoCalidad =
  /** Cumple el piso con evidencia vigente. Único estado que promueve. */
  | 'pasa'
  /** Nadie ha medido este modelo en esta clase de tarea. */
  | 'sin_evidencia'
  /** Se midió con otra versión del benchmark. No mide lo mismo. */
  | 'version_distinta'
  /** Se midió hace más de lo que el piso admite. */
  | 'caducada'
  /** Se midió con menos casos de los que el piso exige. */
  | 'muestra_insuficiente'
  /** Se midió y NO llega. */
  | 'no_pasa'
  /** Hay evidencia vigente pero el piso no tiene vara numérica con que juzgar. */
  | 'piso_no_medible'

export interface VeredictoCalidad {
  estado: EstadoCalidad
  /** `true` sólo con `estado === 'pasa'`. Se expone para no repetir la comparación. */
  elegible: boolean
  /** Qué falló, en una frase por motivo. Vacío cuando pasa. */
  motivos: string[]
  /** La evidencia que se usó, si la había. Para poder citarla en la decisión. */
  evidencia: EvidenciaCalidad | null
  /** Referencia citable: modelo@versión·fecha. `null` si no hubo evidencia. */
  referencia: string | null
}

/** Referencia corta y estable de una evidencia. Lo que viaja en la telemetría. */
export function referenciaDe(e: EvidenciaCalidad): string {
  return `${e.proveedor}/${e.modeloId}@${e.claseTarea}·${e.versionBenchmark}·${e.evaluadoEn.slice(0, 10)}`
}

/** Busca la evidencia más reciente para un modelo en una clase de tarea. */
export function buscarEvidencia(
  evidencias: readonly EvidenciaCalidad[],
  proveedor: string, modeloId: string, clase: ClaseTarea,
): EvidenciaCalidad | null {
  const suyas = evidencias.filter(
    e => e.proveedor === proveedor && e.modeloId === modeloId && e.claseTarea === clase,
  )
  if (suyas.length === 0) return null
  // La más reciente. Comparación de cadenas ISO: ordena bien sin construir fechas.
  return suyas.reduce((a, b) => (b.evaluadoEn > a.evaluadoEn ? b : a))
}

/** Días enteros entre dos ISO. Ambas fechas se pasan: nada de relojes escondidos. */
export function diasEntre(desdeISO: string, hastaISO: string): number | null {
  const a = Date.parse(desdeISO), b = Date.parse(hastaISO)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.floor((b - a) / 86_400_000)
}

export interface EntradaCompuerta {
  evidencia: EvidenciaCalidad | null
  piso: PisoCalidad
  /** Versión del benchmark vigente. Una evidencia de otra versión no cuenta. */
  versionVigente: string
  /** ISO. La fecha contra la que se mide la frescura. Se pasa siempre. */
  hoyISO: string
  /**
   * Riesgo de la tarea.
   *
   * Sólo entra en la compuerta para una cosa: en riesgo `bajo`, un piso sin
   * vara numérica se admite si hay evidencia vigente y cero alucinaciones. En
   * `material` y `alta_consecuencia` no — ahí «no hay con qué medirlo» es un
   * fallo, no un permiso.
   */
  riesgo: NivelRiesgo
}

/**
 * Juzga un modelo contra el piso.
 *
 * El orden de las comprobaciones no es cosmético: se pregunta primero si la
 * evidencia SIRVE (existe, es de esta versión, es fresca, tiene muestra) y sólo
 * después si los números llegan. Un «no pasa» sobre una evidencia caducada
 * mandaría a mejorar el modelo cuando lo que hay que hacer es volver a medir.
 */
export function compuertaCalidad(e: EntradaCompuerta): VeredictoCalidad {
  const { evidencia, piso, versionVigente, hoyISO, riesgo } = e
  const fallo = (estado: EstadoCalidad, ...motivos: string[]): VeredictoCalidad => ({
    estado, elegible: false, motivos, evidencia,
    referencia: evidencia ? referenciaDe(evidencia) : null,
  })

  if (!evidencia) {
    return fallo('sin_evidencia', 'No hay evidencia de calidad de este modelo para esta clase de tarea.')
  }
  if (evidencia.versionBenchmark !== versionVigente) {
    return fallo('version_distinta',
      `La evidencia se midió con el benchmark ${evidencia.versionBenchmark} y el vigente es ${versionVigente}.`)
  }
  if (piso.frescuraMaxDias != null) {
    const d = diasEntre(evidencia.evaluadoEn, hoyISO)
    if (d == null) return fallo('caducada', 'La fecha de la evidencia no se puede leer.')
    if (d > piso.frescuraMaxDias) {
      return fallo('caducada', `La evidencia tiene ${d} días y el piso admite ${piso.frescuraMaxDias}.`)
    }
  }
  if (piso.muestraMin != null && evidencia.resumen.casos < piso.muestraMin) {
    return fallo('muestra_insuficiente',
      `Se midió con ${evidencia.resumen.casos} casos y el piso exige ${piso.muestraMin}.`)
  }

  const motivos: string[] = []
  const r = evidencia.resumen
  /**
   * Las alucinaciones se comprueban SIEMPRE, con o sin vara numérica.
   *
   * Es la parte estructural del piso, y viene de `POR_QUE_EL_CRITERIO_ES_CERO`:
   * sobre un corpus que controlamos entero, una enfermedad inventada no es una
   * tasa aceptable.
   */
  if (r.alucinacionesPorCaso > piso.alucinacionesPorCasoMax) {
    motivos.push(`Alucinaciones por caso ${r.alucinacionesPorCaso} > ${piso.alucinacionesPorCasoMax}.`)
  }
  if (piso.exactitudMin != null && r.exactitudCampo < piso.exactitudMin) {
    motivos.push(`Exactitud por campo ${r.exactitudCampo} < ${piso.exactitudMin}.`)
  }
  if (piso.tasaErrorMax != null && r.tasaError > piso.tasaErrorMax) {
    motivos.push(`Tasa de error ${r.tasaError} > ${piso.tasaErrorMax}.`)
  }
  if (motivos.length > 0) return fallo('no_pasa', ...motivos)

  /**
   * ── EL CASO EN QUE HAY EVIDENCIA Y NO HAY VARA ───────────────────────────
   *
   * Pasa hoy con todas las tareas de `material` para arriba, porque el piso
   * numérico está en `NEEDS_CLINICAL_REVIEW`. Y tiene que FALLAR: si «sin vara»
   * se admitiera, el riel entero se volvería decorativo — cualquier modelo
   * pasaría cualquier tarea con sólo no alucinar en cuatro casos sintéticos.
   *
   * En riesgo `bajo` sí se admite: ahí el error lo ve el médico antes de que
   * llegue a ningún sitio, y exigir una vara que nadie ha decidido dejaría sin
   * IA la limpieza de transcripción, que es donde el determinismo ya manda.
   */
  if (!pisoEsMedible(piso)) {
    if (riesgo === 'bajo') {
      return {
        estado: 'pasa', elegible: true, evidencia, referencia: referenciaDe(evidencia),
        motivos: [],
      }
    }
    return fallo('piso_no_medible',
      'El piso no declara exactitud ni tasa de error, así que no hay con qué juzgar este modelo ' +
      `en una tarea de riesgo ${riesgo}. NEEDS_CLINICAL_REVIEW.`)
  }

  return { estado: 'pasa', elegible: true, motivos: [], evidencia, referencia: referenciaDe(evidencia) }
}

/**
 * NINGUNA EVIDENCIA CARGADA. A propósito, y es el estado honesto de hoy.
 *
 * Se exporta como constante con nombre en vez de dejar que cada llamador pase
 * `[]`, para que el hueco tenga un sitio donde estar declarado y para que el
 * día que se mida algo haya UN lugar donde ponerlo.
 */
export const EVIDENCIA_CARGADA: readonly EvidenciaCalidad[] = []

/**
 * Versión del benchmark vigente.
 *
 * Atada al corpus de `casos-oro.ts`. Cambiar el corpus obliga a subir esto, y
 * subirlo caduca toda la evidencia anterior — que es exactamente lo que tiene
 * que pasar: medido con otro corpus no es medido.
 */
export const VERSION_BENCHMARK = 'casos-oro-v1'

export const POR_QUE_ESTE_MODULO_NACE_SIN_DATOS =
  'Porque no se ha medido. El corpus oro tiene cuatro casos sintéticos y lo ' +
  'dice de sí mismo. Cargar aquí «Sonnet 5: exactitud 0.94» sería una cifra ' +
  'plausible que se cita, se copia a una proyección y acaba decidiendo a qué ' +
  'modelo se le baja la nota que el médico firma. El hueco declarado se llena; ' +
  'la cifra inventada se hereda.'

export const POR_QUE_CADUCA_POR_VERSION_Y_NO_SOLO_POR_TIEMPO =
  'Porque una evidencia medida con otro corpus no midió lo mismo, y eso no ' +
  'mejora con el tiempo ni empeora con él. La caducidad por días exige un ' +
  'número que nadie ha decidido; la caducidad por versión no exige ninguno.'
