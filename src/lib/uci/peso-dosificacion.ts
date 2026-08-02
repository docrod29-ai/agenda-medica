/**
 * EL PESO CON EL QUE SE DOSIFICA — charter §16.
 *
 *   «Se fija explícitamente y queda con su autor: se prohíbe cambiarlo de forma
 *    automática.»
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `ICUStay.pesoDosificacion` está modelado con su valor, su tipo, quién lo fijó
 * y cuándo… y **no lo escribe nadie**. Cada calculadora del panel pide el peso
 * por su cuenta: la de infusiones lee `infPeso`, la de CKRT lee `ckrtPeso`, y la
 * de infusiones cae a la de CKRT si la suya está vacía.
 *
 * Eso significa que **dos pantallas del mismo paciente pueden estar dosificando
 * con pesos distintos** y nadie se entera: se teclea 70 en una, 80 en la otra, y
 * las dos enseñan un número que parece correcto. En una infusión de µg/kg/min,
 * un 14 % de diferencia en el peso es un 14 % de diferencia en la dosis.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Un solo peso por estancia, fijado a propósito, con su autor y su hora. Las
 * calculadoras lo usan como punto de partida y, si alguien lo cambia ahí, ese
 * cambio es una decisión con nombre — no un número que se movió solo.
 *
 * Y NO se toma del peso de la nota ni de la última toma. Ése cambia (edema,
 * balance, otra báscula) y arrastrarlo automáticamente movería todas las dosis
 * sin que nadie lo pidiera, que es exactamente lo que §16 prohíbe.
 *
 * ── ESTO NO DECIDE NADA CLÍNICO ──────────────────────────────────────────────
 *
 * No elige entre peso real, ideal o ajustado: eso es criterio del médico y lo
 * captura él. Aquí sólo se guarda cuál eligió, para que todas las pantallas usen
 * el mismo. Un peso plausible pero no fijado sigue siendo «sin fijar».
 *
 * Módulo PURO.
 */
import type { TipoPesoDosificacion } from '@/types/hospital'

export type { TipoPesoDosificacion }

/**
 * Qué peso eligió el médico.
 *
 * El vocabulario NO se inventa aquí: es el que ya declara `types/hospital.ts`,
 * decidido con el charter. La elección entre uno y otro es criterio del médico;
 * este módulo sólo registra cuál eligió.
 */
export const TIPOS_PESO: readonly TipoPesoDosificacion[] = ['actual', 'ingreso', 'seco', 'configurado']

export const ETIQUETA_TIPO_PESO: Record<TipoPesoDosificacion, string> = {
  actual: 'Peso actual',
  ingreso: 'Peso al ingreso',
  seco: 'Peso seco',
  configurado: 'Peso configurado',
}

export interface PesoFijado {
  valorKg: number
  tipo: TipoPesoDosificacion
  fijadoPor: string
  fijadoEn: string
}

/**
 * Tope de cordura, NO un rango clínico.
 *
 * No dice qué peso es normal ni sano: sólo descarta lo que no puede ser un peso
 * humano tecleado a propósito —un cero, un negativo, un 700— para que un dedazo
 * no se convierta en una dosis. Cualquier valor dentro del rango se acepta tal
 * cual: el criterio es del médico.
 */
export const MIN_KG = 0.3
export const MAX_KG = 400

export type MotivoInvalido = 'vacio' | 'no-numerico' | 'fuera-de-rango' | 'sin-autor' | 'tipo-desconocido'

export interface Validacion {
  ok: boolean
  motivo?: MotivoInvalido
  mensaje?: string
}

/** ¿Se puede fijar este peso? Valida FORMA, nunca criterio clínico. */
export function validarPeso(valor: unknown, tipo: unknown, autor: string): Validacion {
  if (String(autor ?? '').trim() === '') {
    return { ok: false, motivo: 'sin-autor', mensaje: 'El peso de dosificación queda con el nombre de quien lo fija (charter §16).' }
  }
  const bruto = String(valor ?? '').trim()
  if (!bruto) return { ok: false, motivo: 'vacio', mensaje: 'Escribe el peso en kilogramos.' }
  const n = Number(bruto)
  if (!Number.isFinite(n)) return { ok: false, motivo: 'no-numerico', mensaje: `«${bruto}» no es un número.` }
  if (n < MIN_KG || n > MAX_KG) {
    return { ok: false, motivo: 'fuera-de-rango', mensaje: `${n} kg está fuera de lo que puede ser un peso tecleado (${MIN_KG}–${MAX_KG} kg). Revísalo.` }
  }
  if (!(TIPOS_PESO as readonly string[]).includes(String(tipo))) {
    return { ok: false, motivo: 'tipo-desconocido', mensaje: 'Elige qué peso es: actual, al ingreso, seco o configurado.' }
  }
  return { ok: true }
}

/** Arma el registro. Sólo se llama tras `validarPeso`. */
export function fijarPeso(valorKg: number, tipo: TipoPesoDosificacion, autor: string, ahoraIso: string): PesoFijado {
  return { valorKg, tipo, fijadoPor: autor.trim(), fijadoEn: ahoraIso }
}

/**
 * El peso que deben usar las calculadoras.
 *
 * Devuelve `null` si no hay ninguno fijado: entonces cada pantalla sigue pidiendo
 * el suyo, **y lo dice**. Inventar aquí un peso «probable» a partir de la nota
 * sería mover todas las dosis sin que nadie lo decidiera.
 */
export function pesoParaCalcular(fijado: PesoFijado | null | undefined): number | null {
  const n = Number(fijado?.valorKg)
  return Number.isFinite(n) && n >= MIN_KG && n <= MAX_KG ? n : null
}

/** Qué enseñar junto a las calculadoras. Vacío cuando hay peso fijado. */
export function avisoSinPeso(fijado: PesoFijado | null | undefined): string {
  return pesoParaCalcular(fijado) === null
    ? 'No hay un peso de dosificación fijado para esta estancia: cada calculadora usa el que se teclee en ella, así que dos pantallas pueden estar dosificando con pesos distintos.'
    : ''
}

export const POR_QUE_NO_SE_TOMA_DE_LA_NOTA =
  'Porque el peso de la nota cambia —edema, balance, otra báscula— y arrastrarlo ' +
  'automáticamente movería todas las dosis sin que nadie lo pidiera. En una ' +
  'infusión de µg/kg/min, un 14 % de diferencia en el peso es un 14 % en la dosis.'
