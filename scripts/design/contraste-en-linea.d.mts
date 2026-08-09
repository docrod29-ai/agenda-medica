/**
 * Tipos de la compuerta de contraste. El instrumento vive en `.mjs` porque se
 * ejecuta suelto (`npm run gate:contraste`, sin compilar); estas firmas son
 * para que la prueba que lo usa no pierda el tipado.
 */
export interface Rgb { r: number; g: number; b: number }

/** Mapa token → color resuelto, por tema. */
export type Tokens = Record<string, Rgb>

export interface Temas { oscuro: Tokens; claro: Tokens }

export interface HallazgoDeContraste {
  archivo: string
  linea: number
  tema: 'oscuro' | 'claro'
  /** Literal CSS del fondo, tal cual estaba escrito. */
  fondo: string
  /** Literal CSS del texto, tal cual estaba escrito. */
  texto: string
  /** Cociente de contraste WCAG 2.1, redondeado a dos decimales. */
  razon: number
}

/** Cociente de contraste WCAG 2.1 entre dos colores opacos. */
export function contraste(a: Rgb, b: Rgb): number

/** Literal CSS opaco (`#rgb`, `#rrggbb`, `rgb()`, `white`, `black`) → Rgb. */
export function aRgb(valor: string | null | undefined): Rgb | null

/** Lee los tokens de los dos temas declarados en un archivo CSS. */
export function leerTemas(rutaCss?: string): Temas

/** Parejas fondo/texto por debajo de AA en los archivos dados. */
export function analizar(archivos: string[], temas: Temas): HallazgoDeContraste[]
