/**
 * Motor de paginación para impresos médicos (recetas y órdenes).
 *
 * Problema que resuelve: el sistema anterior metía TODO el contenido en una
 * sola hoja con overflow:hidden — si había muchos estudios o medicamentos,
 * simplemente se CORTABAN sin aviso. Las apps de referencia (Doctoralia Pro,
 * Medesk, Saludtools) paginan automáticamente: el fondo del médico se repite
 * en cada hoja y el contenido fluye "Hoja 1 de 2", "Hoja 2 de 2".
 *
 * Diseño:
 *   - Funciones puras (sin DOM) → testeables con Vitest
 *   - Estimación de alturas en mm a partir del tamaño de fuente en px
 *     (96 DPI: 1 mm ≈ 3.7795 px)
 *   - Algoritmo greedy: llena hoja 1 (reserva encabezado de paciente),
 *     luego hojas N (reserva línea de continuación). Indicaciones, nota y
 *     firma viven SIEMPRE en la última hoja (estándar clínico: la firma
 *     valida todo lo anterior).
 *   - Estudios en modo 2 columnas: se empaquetan por FILAS (2 por fila),
 *     duplicando la capacidad por hoja — formato checklist de laboratorio.
 */

import type { Medicamento } from '@/types/expediente'

const PX_POR_MM = 96 / 25.4  // ≈ 3.7795

/** Página resultante de la paginación. */
export interface PaginaReceta {
  medicamentos: Medicamento[]
  estudios: string[]
  /** Solo presentes en la última página */
  indicaciones?: string
  notaParaPaciente?: string
  numero: number   // 1-based
  total: number
  esPrimera: boolean
  esUltima: boolean
}

export interface OpcionesPaginacion {
  medicamentos: Medicamento[]
  estudios: string[]
  indicaciones?: string
  notaParaPaciente?: string
  /** Tamaño de fuente del contenido en px */
  fontSizePx: number
  /** Alto útil del área de contenido en mm (papel - márgenes top/bottom) */
  areaAltoMm: number
  /** Ancho útil del área de contenido en mm (papel - márgenes left/right) */
  areaAnchoMm: number
  /** mm reservados en hoja 1 para el bloque de paciente/folio/dx/alergias */
  headerPrimeraMm: number
  /** mm reservados en hojas 2+ para la línea "Continuación…" */
  headerContinuacionMm: number
  /** mm reservados para la firma (solo última hoja) */
  firmaMm: number
  /** Estudios en checklist de 2 columnas (recomendado si > 6) */
  estudiosDosColumnas?: boolean
}

/** Caracteres que caben por línea dado el ancho en mm y el font-size en px. */
function charsPorLinea(anchoMm: number, fontSizePx: number): number {
  // Promedio empírico: un carácter ocupa ~0.52 × fontSize px en fuentes sans
  const anchoPx = anchoMm * PX_POR_MM
  return Math.max(10, Math.floor(anchoPx / (fontSizePx * 0.52)))
}

/** Altura en mm de N líneas de texto al font-size dado (line-height 1.5). */
function alturaLineasMm(lineas: number, fontSizePx: number): number {
  return (lineas * fontSizePx * 1.5) / PX_POR_MM
}

/** Líneas que ocupa un texto con wrapping estimado. */
function lineasDeTexto(texto: string, anchoMm: number, fontSizePx: number): number {
  if (!texto) return 0
  const cpl = charsPorLinea(anchoMm, fontSizePx)
  return texto.split('\n').reduce((acc, linea) => acc + Math.max(1, Math.ceil(linea.length / cpl)), 0)
}

/** Altura estimada de UN medicamento (nombre + posología, con wrapping). */
export function alturaMedicamentoMm(m: Medicamento, anchoMm: number, fontSizePx: number): number {
  const linea1 = `${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}${m.via ? ` · ${m.via}` : ''}`
  const linea2 = [m.frecuencia, m.duracion && `por ${m.duracion}`, m.indicacion && `— ${m.indicacion}`]
    .filter(Boolean).join(' ')
  const lineas = lineasDeTexto(linea1, anchoMm - 6, fontSizePx) + lineasDeTexto(linea2, anchoMm - 6, fontSizePx - 0.5)
  return alturaLineasMm(lineas, fontSizePx) + 1.6  // margen entre items
}

/** Altura estimada de UN estudio en 1 columna. */
export function alturaEstudioMm(estudio: string, anchoMm: number, fontSizePx: number): number {
  const lineas = lineasDeTexto(estudio, anchoMm - 8, fontSizePx)
  return alturaLineasMm(lineas, fontSizePx) + 0.8
}

/** Altura del bloque de indicaciones (encabezado + texto con wrapping). */
export function alturaIndicacionesMm(texto: string, anchoMm: number, fontSizePx: number): number {
  if (!texto?.trim()) return 0
  const lineas = lineasDeTexto(texto, anchoMm, fontSizePx)
  return alturaLineasMm(lineas + 1, fontSizePx) + 3  // +1 línea por el título "Indicaciones:"
}

/**
 * Pagina el contenido en N hojas.
 * Garantías:
 *   - NINGÚN ítem se corta (cada medicamento/estudio cae completo en una hoja)
 *   - Indicaciones + nota + firma SIEMPRE en la última hoja
 *   - Siempre devuelve ≥ 1 página (aunque esté vacía)
 */
export function paginarReceta(opts: OpcionesPaginacion): PaginaReceta[] {
  const {
    medicamentos, estudios, indicaciones, notaParaPaciente,
    fontSizePx, areaAltoMm, areaAnchoMm,
    headerPrimeraMm, headerContinuacionMm, firmaMm,
    estudiosDosColumnas = false,
  } = opts

  const disponiblePrimera = Math.max(20, areaAltoMm - headerPrimeraMm)
  const disponibleContinuacion = Math.max(20, areaAltoMm - headerContinuacionMm)

  // ── 1. Construir bloques con alturas ──────────────────────────
  interface Bloque { tipo: 'med' | 'est' | 'estFila'; alturaMm: number; meds?: Medicamento[]; ests?: string[] }
  const bloques: Bloque[] = []

  for (const m of medicamentos) {
    bloques.push({ tipo: 'med', alturaMm: alturaMedicamentoMm(m, areaAnchoMm, fontSizePx), meds: [m] })
  }

  if (estudiosDosColumnas) {
    // Empaquetar por filas de 2 — la altura de la fila es el máximo de las 2 celdas
    const anchoCol = areaAnchoMm / 2 - 3
    for (let i = 0; i < estudios.length; i += 2) {
      const fila = estudios.slice(i, i + 2)
      const altura = Math.max(...fila.map(e => alturaEstudioMm(e, anchoCol, fontSizePx)))
      bloques.push({ tipo: 'estFila', alturaMm: altura, ests: fila })
    }
  } else {
    for (const e of estudios) {
      bloques.push({ tipo: 'est', alturaMm: alturaEstudioMm(e, areaAnchoMm, fontSizePx), ests: [e] })
    }
  }

  const alturaIndic = alturaIndicacionesMm(indicaciones ?? '', areaAnchoMm, fontSizePx)
  const alturaNota = notaParaPaciente?.trim()
    ? alturaLineasMm(lineasDeTexto(notaParaPaciente, areaAnchoMm - 4, fontSizePx - 0.5) + 0.5, fontSizePx) + 3
    : 0
  const colaFinalMm = alturaIndic + alturaNota + firmaMm

  // ── 2. Greedy fill ─────────────────────────────────────────────
  const paginas: Array<{ meds: Medicamento[]; ests: string[] }> = [{ meds: [], ests: [] }]
  let usado = 0

  const capacidadDe = (idx: number) => idx === 0 ? disponiblePrimera : disponibleContinuacion

  for (const b of bloques) {
    const idx = paginas.length - 1
    if (usado + b.alturaMm > capacidadDe(idx) && (paginas[idx].meds.length > 0 || paginas[idx].ests.length > 0)) {
      paginas.push({ meds: [], ests: [] })
      usado = 0
    }
    const pagina = paginas[paginas.length - 1]
    if (b.meds) pagina.meds.push(...b.meds)
    if (b.ests) pagina.ests.push(...b.ests)
    usado += b.alturaMm
  }

  // ── 3. La cola (indicaciones + nota + firma) debe caber en la última ──
  const idxUltima = paginas.length - 1
  if (usado + colaFinalMm > capacidadDe(idxUltima) && (paginas[idxUltima].meds.length > 0 || paginas[idxUltima].ests.length > 0)) {
    paginas.push({ meds: [], ests: [] })
  }

  // ── 4. Materializar ───────────────────────────────────────────
  const total = paginas.length
  return paginas.map((p, i) => ({
    medicamentos: p.meds,
    estudios: p.ests,
    indicaciones: i === total - 1 ? indicaciones : undefined,
    notaParaPaciente: i === total - 1 ? notaParaPaciente : undefined,
    numero: i + 1,
    total,
    esPrimera: i === 0,
    esUltima: i === total - 1,
  }))
}

/**
 * Helper de alto nivel: calcula las páginas para un RecetaData + RecetaConfig.
 * Lo usan RecetaDocumento (para render) y las páginas (para el wrapper de preview).
 */
export function paginarParaDocumento(opts: {
  medicamentos?: Medicamento[]
  estudios?: string[]
  indicaciones?: string
  notaParaPaciente?: string
  paperWidthMm: number
  paperHeightMm: number
  margenes: { top: number; right: number; bottom: number; left: number }
  fontSizePx: number
  soloRx?: boolean
  tieneFirmaImagen?: boolean
  /** Override del espacio reservado en hoja 1 (ej. plantilla auto-generada con membrete ≈ 52mm) */
  headerPrimeraMm?: number
}): PaginaReceta[] {
  const areaAnchoMm = Math.max(40, opts.paperWidthMm - opts.margenes.left - opts.margenes.right)
  const areaAltoMm = Math.max(40, opts.paperHeightMm - opts.margenes.top - opts.margenes.bottom)
  const estudios = opts.estudios ?? []
  return paginarReceta({
    medicamentos: opts.medicamentos ?? [],
    estudios,
    indicaciones: opts.indicaciones,
    notaParaPaciente: opts.notaParaPaciente,
    fontSizePx: opts.fontSizePx,
    areaAltoMm,
    areaAnchoMm,
    // Hoja 1: folio+paciente+dx+alergias ≈ 24 mm (≈2 si el papel ya los trae impresos)
    headerPrimeraMm: opts.headerPrimeraMm ?? (opts.soloRx ? 2 : 24),
    headerContinuacionMm: 8,
    // Firma con imagen ocupa más que solo la línea
    firmaMm: opts.tieneFirmaImagen ? 26 : 14,
    estudiosDosColumnas: estudios.length > 6,
  })
}
