import { analitoDe, type Analito } from './analitos'
import { dictaminar, type EstadoDeValidacion, type DecimalCorrido } from './unidades'
import { evaluarCriticoLab, censuraDe, type Censura } from '@/lib/hospital/lab-criticos'
import { sujetosLeidos, type SujetoLeido } from './sujeto'

/**
 * VALIDACIÓN DE LO QUE LA IA EXTRAE DE UN PDF/FOTO DE LABORATORIO.
 *
 * La IA de visión solo TRANSCRIBE lo legible (mismo foso que el antibiograma): no
 * interpreta ni inventa. Aquí, en código determinista, se limpia y estructura lo
 * que devolvió, se agrupa por analito canónico y se marca la criticidad con el
 * motor ya auditado. Nada de esto confía en la IA para decidir criticidad.
 *
 * PRIVACIDAD: esta función NO conserva identificadores del paciente. El nombre
 * que aparezca en la hoja es la excepción y viaja aparte, en `sujetos`: sirve
 * para verificar de QUIÉN es la evidencia antes de escribirla (REG-323) y
 * muere ahí — no entra en `resultados` ni se persiste. El folio, la CURP, la
 * dirección y el resto siguen descartados a propósito.
 *
 * Puro y determinista → testeable.
 */

/** Una fila cruda como la devuelve la IA de visión. */
export interface FilaCruda {
  estudio?: string
  valor?: string | number
  unidad?: string
  referencia?: string
}

/** Un resultado ya validado y listo para graficar. */
export interface ResultadoValidado {
  clave: string
  etiqueta: string
  valor: number
  /**
   * El reporte no dio el número exacto sino un límite: «>400», «<50». El campo
   * `valor` guarda el número pelado (las gráficas necesitan un número), así que
   * SIN esto el expediente afirmaría una glucosa de 400 donde el laboratorio
   * sólo dijo «más de 400». El prompt de visión ordena conservar el signo; aquí
   * es donde tiene que llegar (REG-204).
   */
  censurada?: Censura
  unidad: string
  referencia?: string
  critico: boolean
  /**
   * NO se pudo juzgar la criticidad (unidad reportada distinta de la del umbral).
   * Auditoría 2026-07 (P1): antes esto se guardaba como «no crítico» = normal, y un
   * valor de pánico en una unidad rara (troponina en ng/L, lactato en mg/dL) pasaba
   * como bueno. Ahora se marca para que la UI diga «verificar», no «normal».
   */
  noEvaluable?: boolean
  motivoNoEvaluable?: string
  /** Se puso en una serie temporal (analito reconocido y valor plausible). */
  graficable: boolean
  /**
   * ── LO QUE D-032 §27.1 EXIGE CONSERVAR (REG-451) ──────────────────────────
   *
   * «Nunca eliminar la unidad original después de normalizar.» Si sólo se
   * guardara el valor canónico, nadie podría discutir una conversión ni auditar
   * de dónde salió el número que está en el expediente.
   */
  estado?: EstadoDeValidacion
  /** El valor tal como lo imprimió el laboratorio. */
  valorOriginal?: number
  /**
   * La unidad tal como la imprimió el laboratorio. AUSENTE cuando la hoja no la
   * dijo (REG-454): antes se rellenaba con la canónica, y entonces el campo que
   * conserva lo que dijo el laboratorio decía lo que asumimos nosotros.
   */
  unidadOriginal?: string
  /** La unidad con la que se juzgó cuando la hoja no traía ninguna. */
  unidadAsumida?: string
  /** Con qué factor se convirtió y de dónde sale ese factor. */
  convertidoCon?: string
  /** Por qué este resultado está en el estado en que está. */
  porQueDelEstado?: string
  /**
   * §29 — lo que el valor PODRÍA ser si se corrió un decimal. Es una sugerencia
   * para el médico, no una corrección: `valor` sigue siendo lo que dice la hoja.
   */
  decimalCorrido?: DecimalCorrido
}

/** El panel completo tras validar. */
export interface PanelValidado {
  /** Fecha del estudio (YYYY-MM-DD) tal como la extrajo la IA, o '' si no la halló. */
  fecha: string
  resultados: ResultadoValidado[]
  /** Filas que la IA leyó pero no se reconocieron: se conservan como texto, sin graficar. */
  noReconocidas: { estudio: string; valor: string; unidad?: string }[]
  /**
   * A quién dice pertenecer la hoja. TRANSITORIO: se compara contra el paciente
   * de destino y se descarta. Sin esto, el panel se archivaba bajo el paciente
   * que estuviera abierto en la pantalla (REG-323).
   */
  sujetos: SujetoLeido[]
}

/** Lee un número aceptando coma decimal y signos de desigualdad; null si ambiguo. */
export function aNumero(v: string | number | undefined | null): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (!v) return null
  const limpio = String(v).replace(',', '.').replace(/[<>≤≥~]/g, '').trim()
  // Rechaza cadenas con más de un número (p. ej. "120/80"): no se sabe cuál es.
  const nums = limpio.match(/-?\d+(\.\d+)?/g)
  if (!nums || nums.length !== 1) return null
  const n = parseFloat(nums[0])
  return Number.isFinite(n) ? n : null
}

/** Fecha en formato YYYY-MM-DD si es válida y razonable; '' si no. */
export function fechaValida(f: string | undefined | null): string {
  if (!f) return ''
  const m = String(f).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  const año = Number(y)
  // Un laboratorio no es del año 1900 ni del 2100: rango sano.
  if (año < 1990 || año > 2100) return ''
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return ''
  return `${y}-${mo}-${d}`
}

/**
 * Valida y estructura el resultado crudo de la IA.
 *
 * @param crudo  lo que devolvió la IA de visión (sin confiar en su criticidad)
 */
export function validarPanel(crudo: { fecha?: string; filas?: FilaCruda[]; pacientes?: unknown }): PanelValidado {
  const resultados: ResultadoValidado[] = []
  const noReconocidas: PanelValidado['noReconocidas'] = []
  const vistos = new Set<string>()

  for (const fila of crudo.filas ?? []) {
    const estudio = (fila.estudio ?? '').trim()
    const num = aNumero(fila.valor)
    if (!estudio) continue

    const a: Analito | null = analitoDe(estudio, fila.unidad?.trim())
    /**
     * ── EL ORDEN DEL §28, Y POR QUÉ IMPORTA (REG-451) ────────────────────────
     *
     * Antes esta condición metía TRES cosas en el mismo saco: analito no
     * reconocido, número ilegible y valor no plausible. Las dos primeras siguen
     * cayendo a `noReconocidas`, que es donde les toca.
     *
     * La tercera **ya no**. Un valor «no plausible» en la unidad convencional a
     * menudo es un valor CORRECTO en otra unidad —glucosa 7,2 mmol/L— y tirarlo
     * dejaba al paciente sin serie y sin aviso. El §1 del catálogo del dueño lo
     * ordena al revés: aceptar provisionalmente y marcar para verificar.
     *
     * Y el §28 fija el orden: primero se normaliza la unidad, DESPUÉS se
     * comprueba la plausibilidad. Al revés, un valor correcto en otra unidad
     * parece imposible.
     */
    if (!a || num === null) {
      // Reconocible como texto pero no graficable: se conserva sin inventar serie.
      noReconocidas.push({ estudio, valor: String(fila.valor ?? ''), unidad: fila.unidad?.trim() || undefined })
      continue
    }
    const dictamen = dictaminar(a, num, fila.unidad)
    // Un mismo analito repetido en la hoja: se queda el primero (evita duplicar el punto).
    if (vistos.has(a.clave)) continue
    vistos.add(a.clave)

    const unidad = dictamen.unidad
    // Se evalúa con la unidad TAL COMO la reportó el laboratorio (no la del analito):
    // si difiere del umbral, evaluable=false y se marca «verificar» en vez de normal.
    // Y con el comparador, que `aNumero` acaba de pelar: sin él, «>400» se
    // comparaba como 400 y una hiperglucemia de pánico se archivaba como normal.
    const censurada = censuraDe(fila.valor)
    const ev = evaluarCriticoLab(a.clave, num, fila.unidad?.trim() || undefined, censurada)
    /**
     * «Verificar» sólo cuando la duda se puede resolver mirando: la unidad no
     * cuadra con la del umbral, o el intervalo de un valor censurado cruza el
     * corte. «Sin rango crítico definido» no es un aviso —ese analito no tiene
     * valor de pánico y no lo va a tener— y llenaría la pantalla de ámbar.
     */
    const noEvaluable = !ev.evaluable && (!!fila.unidad?.trim() || !!censurada)
    resultados.push({
      clave: a.clave, etiqueta: a.etiqueta, valor: dictamen.valor, censurada, unidad,
      referencia: fila.referencia?.trim() || undefined,
      critico: ev.critico,
      noEvaluable: noEvaluable || undefined,
      motivoNoEvaluable: noEvaluable ? ev.motivo : undefined,
      /** Sólo entra a la serie temporal lo que se puede creer tal como está. */
      graficable: dictamen.graficable,
      estado: dictamen.estado,
      valorOriginal: dictamen.valorOriginal,
      unidadOriginal: dictamen.unidadOriginal,
      unidadAsumida: dictamen.unidadAsumida,
      convertidoCon: dictamen.conversion?.fuente,
      porQueDelEstado: dictamen.porQue,
      decimalCorrido: dictamen.decimalCorrido,
    })
  }

  return { fecha: fechaValida(crudo.fecha), resultados, noReconocidas, sujetos: sujetosLeidos(crudo.pacientes) }
}

/**
 * Construye las SERIES temporales a partir de varios paneles (para las gráficas).
 * Cada serie = un analito con sus puntos {fecha, valor} ordenados en el tiempo.
 */
export interface SerieAnalito {
  clave: string
  etiqueta: string
  unidad: string
  grupo: string
  refMin?: number
  refMax?: number
  /** El comparador viaja con el punto: la franja de críticos lo imprime (REG-204). */
  puntos: { fecha: string; valor: number; critico: boolean; censurada?: Censura }[]
}

export function seriesDesdeHistorial(
  paneles: { fecha: string; resultados: ResultadoValidado[] }[],
): SerieAnalito[] {
  const porClave = new Map<string, SerieAnalito>()
  // Paneles ordenados por fecha ascendente para que la línea vaya en el tiempo.
  const ordenados = [...paneles].filter(p => p.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const panel of ordenados) {
    for (const r of panel.resultados) {
      if (!r.graficable) continue
      let s = porClave.get(r.clave)
      if (!s) {
        const meta = analitoDe(r.etiqueta, r.unidad)
        s = { clave: r.clave, etiqueta: r.etiqueta, unidad: r.unidad, grupo: meta?.grupo ?? 'otro', refMin: meta?.refMin, refMax: meta?.refMax, puntos: [] }
        porClave.set(r.clave, s)
      }
      s.puntos.push({ fecha: panel.fecha, valor: r.valor, critico: r.critico, censurada: r.censurada })
    }
  }
  // Solo series con ≥1 punto (las de ≥2 se dibujan como línea; 1 punto = marcador).
  return [...porClave.values()]
}
