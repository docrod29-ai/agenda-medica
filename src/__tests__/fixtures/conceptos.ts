/**
 * Fixtures de E1-02 — términos de entrada para el vocabulario de conceptos.
 *
 * 100% SINTÉTICOS. No hay PHI, ni nombres de paciente, ni datos reales: son
 * cadenas de texto que un médico teclearía o que un OCR de panel de laboratorio
 * produciría.
 */

import type { ConceptoCanonico } from '@/lib/clinical-fact/vocabulario'

/** La aceptación literal del backlog, más sus variantes de normalización. */
export const TERMINOS_ACEPTACION: readonly string[] = [
  'creatinina',
  'Cr',
  'creatinina sérica',
  // variantes que la normalización debe absorber
  'CR',
  '  cr  ',
  'creatinina serica',
  'Creatinina Sérica',
]

/**
 * Falsos positivos MEDIDOS hoy contra `analitoDe()` (hallazgo E1-02-H1).
 * `analitoDe('vitamina K')` devuelve `potasio`; aquí NINGUNO debe resolver.
 */
export const FALSOS_POSITIVOS_MEDIDOS: readonly { readonly termino: string; readonly noDebeResolverA: string }[] = [
  { termino: 'vitamina K', noDebeResolverA: 'potasio' },
  { termino: 'PCR para influenza', noDebeResolverA: 'pcr' },
  { termino: 'no-HDL', noDebeResolverA: 'hdl' },
  { termino: 'depuración de Cl de creatinina', noDebeResolverA: 'cloro' },
  { termino: 'vitamina B12', noDebeResolverA: 'bilirrubinaTotal' },
]

/** Términos que el catálogo v1.0.0 sencillamente no conoce. */
export const TERMINOS_DESCONOCIDOS: readonly string[] = [
  '',
  '   ',
  // Esta lista lleva TRES mudanzas y las tres por la misma razón buena: el
  // catálogo creció. 'ferritina' salió en REG-553 (entró con los números de
  // D-041); 'procalcitonina' y 'haptoglobina' en REG-556, cuando entró el
  // catálogo ENTERO del dueño — 220 analitos.
  //
  // Ahora hacen falta términos que NO estén en el documento del dueño, y ya no
  // valen los analitos comunes. Éstos dos son reales, se piden en consulta, y su
  // catálogo no los trae: por eso siguen probando lo que este fixture prueba —
  // que lo que no está cargado NO se inventa.
  'homocisteina',
  'aldolasa',
  'un texto que no es un analito',
]

/**
 * Los tres términos RETIRADOS del catálogo por no tener fuente en el repo
 * (NEEDS_CLINICAL_REVIEW Q6/Q7). Ninguno debe resolver mientras el médico dueño
 * no decida su sentido: la salida correcta es `desconocido`, no una adivinanza.
 */
export const TERMINOS_RETIRADOS_SIN_FUENTE: readonly string[] = [
  'glucosa capilar',
  'dextrostix',
  'bmi',
  // variantes de escritura: la retirada no se esquiva con mayúsculas ni acentos
  'BMI',
  'Glucosa Capilar',
]

/**
 * Casos del FILTRO por dominio (antes era un desempate silencioso, hallazgo V-3).
 * `esperado` es el estado que debe devolver `resolverConcepto(termino, { dominio })`.
 */
export const CASOS_FILTRO_DOMINIO: readonly {
  readonly termino: string
  readonly dominio: 'laboratorio' | 'signo-vital' | 'diagnostico'
  readonly esperado: 'resuelto' | 'desconocido' | 'ambiguo'
  readonly porQue: string
}[] = [
  { termino: 'creatinina', dominio: 'laboratorio', esperado: 'resuelto', porQue: 'el dominio pedido es el suyo' },
  { termino: 'creatinina', dominio: 'signo-vital', esperado: 'desconocido', porQue: 'pedir otro dominio NO debe devolver el concepto de laboratorio (V-3)' },
  { termino: 'cr', dominio: 'signo-vital', esperado: 'desconocido', porQue: 'igual por sinónimo, no sólo por clave' },
  { termino: 'fc', dominio: 'signo-vital', esperado: 'resuelto', porQue: 'signo vital pedido como signo vital' },
  { termino: 'fc', dominio: 'laboratorio', esperado: 'desconocido', porQue: 'un signo vital no se cuela como analito' },
  { termino: 'creatinina', dominio: 'diagnostico', esperado: 'desconocido', porQue: 'el dominio `diagnostico` no tiene entradas propias (lib/cie10.ts es el catálogo)' },
]

/**
 * Catálogo SINTÉTICO con una colisión deliberada: `xx` pertenece a dos
 * conceptos de dominios distintos. Existe sólo para ejercitar la rama de
 * ambigüedad, que el catálogo real prohíbe por invariante.
 */
export const CATALOGO_CON_COLISION: readonly ConceptoCanonico[] = [
  {
    clave: 'concepto_lab_ficticio',
    etiqueta: 'Concepto de laboratorio ficticio',
    dominio: 'laboratorio',
    sinonimos: ['xx', 'solo lab'],
    codigos: [],
  },
  {
    clave: 'concepto_vital_ficticio',
    etiqueta: 'Concepto de signo vital ficticio',
    dominio: 'signo-vital',
    sinonimos: ['xx', 'solo vital'],
    codigos: [],
  },
  {
    clave: 'concepto_lab_ficticio_2',
    etiqueta: 'Segundo concepto de laboratorio ficticio',
    dominio: 'laboratorio',
    sinonimos: ['yy'],
    codigos: [],
  },
]
