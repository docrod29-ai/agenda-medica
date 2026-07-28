/**
 * Definiciones de tamaños de papel y estilos para impresos médicos (recetas y órdenes).
 *
 * Tamaños comunes en México:
 * - media-carta:  140 x 215 mm  (la receta clásica vertical)
 * - carta:        216 x 279 mm  (US Letter)
 * - oficio:       216 x 330 mm  (legal mexicano)
 * - a4:           210 x 297 mm  (internacional)
 * - a5:           148 x 210 mm  (mitad de A4)
 * - receta-13x23: 130 x 230 mm  (VERTICAL — hoja cortada a tamaño de receta, la
 *                                más común en consultorio. CABE en carta, así que
 *                                admite el modo "hoja carta + línea de corte".)
 * - receta-23x13: 230 x 130 mm  (la MISMA medida pero apaisada, para quien tiene
 *                                el formato acostado)
 * - receta-25x15: 250 x 150 mm  (APAISADO — forma continua de matriz de puntos,
 *                                p. ej. Epson)
 * - personalizado:               el médico escribe ancho × alto en mm
 *                                (`paperCustomWidthMm` / `paperCustomHeightMm`)
 *
 * Los apaisados son MÁS ANCHOS que la carta, así que nunca se pueden "hospedar"
 * en una hoja carta: se imprimen a su tamaño real, al 100 %.
 */

export type PaperSize =
  | 'media-carta' | 'carta' | 'oficio' | 'a4' | 'a5'
  | 'receta-13x23' | 'receta-23x13' | 'receta-25x15' | 'personalizado'

export interface PaperDimensions {
  /** Ancho en mm */
  widthMm: number
  /** Alto en mm */
  heightMm: number
  /** Etiqueta legible */
  label: string
  /** Valor CSS @page (e.g. "letter" o "5.5in 8.5in") */
  cssPage: string
}

export const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  'media-carta': { widthMm: 140, heightMm: 215, label: 'Media carta (14 × 21.5 cm)', cssPage: '140mm 215mm' },
  'carta':       { widthMm: 216, heightMm: 279, label: 'Carta (21.6 × 27.9 cm)', cssPage: 'letter' },
  'oficio':      { widthMm: 216, heightMm: 330, label: 'Oficio (21.6 × 33 cm)',  cssPage: '216mm 330mm' },
  'a4':          { widthMm: 210, heightMm: 297, label: 'A4 (21 × 29.7 cm)',       cssPage: 'A4' },
  'a5':          { widthMm: 148, heightMm: 210, label: 'A5 (14.8 × 21 cm)',       cssPage: 'A5' },
  'receta-13x23': { widthMm: 130, heightMm: 230, label: 'Receta vertical (13 × 23 cm)', cssPage: '130mm 230mm' },
  'receta-23x13': { widthMm: 230, heightMm: 130, label: 'Receta acostada (23 × 13 cm)', cssPage: '230mm 130mm' },
  'receta-25x15': { widthMm: 250, heightMm: 150, label: 'Receta continua apaisada (25 × 15 cm)', cssPage: '250mm 150mm' },
  // Placeholder: las medidas REALES salen de paperCustomWidthMm/HeightMm.
  'personalizado': { widthMm: 230, heightMm: 130, label: 'Personalizado (escribe las medidas)', cssPage: '230mm 130mm' },
}

/** Límites sanos para una medida escrita a mano (mm). */
export const PAPEL_MIN_MM = 50
export const PAPEL_MAX_MM = 500

/**
 * Medidas de un papel PERSONALIZADO. Devuelve null si no son utilizables, para
 * que quien llame caiga a un tamaño conocido en vez de imprimir en 0 × 0 (una
 * hoja de tamaño inválido sale en blanco, sin ningún aviso).
 */
export function papelPersonalizado(w?: number, h?: number): PaperDimensions | null {
  const ok = (v?: number) => typeof v === 'number' && Number.isFinite(v) && v >= PAPEL_MIN_MM && v <= PAPEL_MAX_MM
  if (!ok(w) || !ok(h)) return null
  const width = Math.round(w as number), height = Math.round(h as number)
  return {
    widthMm: width,
    heightMm: height,
    label: `Personalizado (${(width / 10).toFixed(1)} × ${(height / 10).toFixed(1)} cm)`,
    cssPage: `${width}mm ${height}mm`,
  }
}

/**
 * Área SEGURA de impresión: la zona donde la impresora garantiza tinta. Las de
 * matriz de puntos con forma continua (Epson y similares) no imprimen hasta el
 * borde físico: hay que dejar un margen muerto en los cuatro lados.
 *
 * Para 250 × 150 mm con 3 mm de guarda: 244 × 144 mm útiles.
 */
export const GUARDA_IMPRESION_MM = 3

/**
 * Papel POR DEFECTO de las NOTAS clínicas (evolución, ingreso, egreso): carta.
 *
 * Son dos ajustes INDEPENDIENTES y no deben interferir:
 *   · receta y orden médica → `RecetaConfig.paperSize` (p. ej. la forma continua
 *     apaisada de 25 × 15 cm).
 *   · notas                 → `RecetaConfig.notaPaperSize`, que arranca en carta.
 *
 * Cambiar el papel de la receta NUNCA mueve el de la nota, ni al revés.
 */
export const PAPEL_NOTA: PaperDimensions = PAPER_SIZES['carta']

/** Tamaños ofrecidos para NOTAS: solo verticales de texto (la nota pagina). */
export type NotaPaperSize = 'carta' | 'oficio' | 'a4' | 'media-carta' | 'a5'
export const NOTA_PAPER_SIZES: NotaPaperSize[] = ['carta', 'oficio', 'a4', 'media-carta', 'a5']

/** Dimensiones del papel de la NOTA. Sin ajuste (o inválido) → carta. */
export function papelNota(size?: string): PaperDimensions {
  if (size && (NOTA_PAPER_SIZES as string[]).includes(size)) {
    return PAPER_SIZES[size as PaperSize]
  }
  return PAPEL_NOTA
}

export function areaSegura(p: PaperDimensions): { widthMm: number; heightMm: number } {
  return {
    widthMm: p.widthMm - GUARDA_IMPRESION_MM * 2,
    heightMm: p.heightMm - GUARDA_IMPRESION_MM * 2,
  }
}

/** Convierte mm a px asumiendo 96 DPI (estándar web). */
export function mmToPx(mm: number): number {
  return Math.round((mm * 96) / 25.4)
}

export type EstiloReceta = 'minimalista' | 'clasico' | 'moderno'

export const ESTILOS_RECETA: Record<EstiloReceta, { label: string; descripcion: string }> = {
  minimalista: { label: 'Minimalista', descripcion: 'Tipografía limpia, mucho espacio en blanco, ideal para clínicas modernas' },
  clasico:     { label: 'Clásico',     descripcion: 'Serif tradicional, tabla con bordes, estilo de receta de toda la vida' },
  moderno:     { label: 'Moderno',     descripcion: 'Sans-serif geométrico, acentos de color, encabezado con franja' },
}

/**
 * Dado un ancho × alto en mm, devuelve el PaperSize más cercano.
 * Tolerancia: ±5mm en cada dimensión (los PDFs a veces tienen 1-2mm de diferencia
 * por márgenes de impresora; media-carta 140 vs A5 148 distan 8mm, así que ±5 no
 * los confunde). Si hay empate, gana el de menor diferencia total.
 */
export function detectarPaperSize(widthMm: number, heightMm: number): PaperSize | null {
  // Normalizar: el PDF puede venir horizontal — usamos ancho ≤ alto siempre.
  // El CATÁLOGO también se normaliza: 'receta-25x15' está declarado apaisado
  // (250 × 150), así que sin normalizarlo su propio PDF jamás se detectaría.
  const w = Math.min(widthMm, heightMm)
  const h = Math.max(widthMm, heightMm)
  let mejor: { size: PaperSize; diff: number } | null = null
  for (const [key, p] of Object.entries(PAPER_SIZES)) {
    // 'personalizado' no es un tamaño detectable: sus medidas del catálogo son un
    // placeholder que coincide con 'receta-23x13' y lo eclipsaría.
    if (key === 'personalizado') continue
    const pw = Math.min(p.widthMm, p.heightMm)
    const ph = Math.max(p.widthMm, p.heightMm)
    const diffW = Math.abs(pw - w)
    const diffH = Math.abs(ph - h)
    const total = diffW + diffH
    if (diffW <= 5 && diffH <= 5) {
      if (!mejor || total < mejor.diff) mejor = { size: key as PaperSize, diff: total }
    }
  }
  return mejor?.size ?? null
}
