/**
 * Definiciones de tamaños de papel y estilos para impresos médicos (recetas y órdenes).
 *
 * Tamaños comunes en México:
 * - media-carta:  140 x 215 mm  (la receta clásica vertical)
 * - carta:        216 x 279 mm  (US Letter)
 * - oficio:       216 x 330 mm  (legal mexicano)
 * - a4:           210 x 297 mm  (internacional)
 * - a5:           148 x 210 mm  (mitad de A4)
 */

export type PaperSize = 'media-carta' | 'carta' | 'oficio' | 'a4' | 'a5'

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
