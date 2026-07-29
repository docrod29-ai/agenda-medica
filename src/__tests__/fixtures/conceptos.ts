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
  'procalcitonina',
  'ferritina',
  'un texto que no es un analito',
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
