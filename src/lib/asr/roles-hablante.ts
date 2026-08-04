/**
 * QUIÉN PUEDE SER CADA HABLANTE — Y QUE PUEDA NO SABERSE.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `atribuir-roles` ofrecía **tres** roles: Médico, Paciente y Acompañante. Y el
 * modelo tenía que elegir uno: no había forma de contestar «no lo sé».
 *
 * En consultorio se sostiene. En hospital y en UCI no: allí hablan el adscrito,
 * el residente, enfermería, el terapeuta respiratorio, el interconsultante. Con
 * tres casillas, **enfermería sale como “Paciente”** — y desde la versión que
 * empezó a archivar el rol, esa suposición se guarda en el expediente.
 *
 * ── POR QUÉ ES GRAVE ─────────────────────────────────────────────────────────
 *
 * De «quién dijo qué» cuelgan el motor de negaciones y la procedencia V3: la
 * diferencia entre *el paciente afirmó* y *la pregunta lo nombró*. Si el rol es
 * inventado, esas dos defensas razonan sobre una atribución falsa — y responden
 * con la misma seguridad que si fuera verdad.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * El catálogo depende del módulo, y **siempre** incluye «Hablante no
 * identificado». Un rol que el modelo no sepa se queda sin asignar y la pantalla
 * enseña «Hablante A», que es la verdad.
 *
 * Módulo PURO.
 */

export type ModuloRoles = 'consulta' | 'hospitalizacion' | 'uci'

/** La salida honesta: existe para que «no lo sé» sea una respuesta posible. */
export const NO_IDENTIFICADO = 'Hablante no identificado'

const CONSULTA = ['Médico', 'Paciente', 'Acompañante'] as const

/**
 * En planta y en UCI la nota nace de una discusión, no de un diálogo de dos.
 *
 * Las etiquetas coinciden con las que ya usa el módulo de discusión de UCI
 * (`ROL_UCI_LABEL`), para que un mismo turno no se llame de dos maneras según
 * qué pantalla lo mire.
 */
const HOSPITAL = [
  'Médico adscrito', 'Médico residente', 'Enfermería',
  'Paciente', 'Familiar', 'Terapeuta respiratorio', 'Interconsultante',
] as const

export const ROLES_POR_MODULO: Readonly<Record<ModuloRoles, readonly string[]>> = {
  consulta: [...CONSULTA, NO_IDENTIFICADO],
  hospitalizacion: [...HOSPITAL, NO_IDENTIFICADO],
  uci: [...HOSPITAL, NO_IDENTIFICADO],
}

/** Los roles válidos para un módulo. Un módulo desconocido cae a consulta. */
export function rolesDe(modulo: string | undefined | null): readonly string[] {
  return ROLES_POR_MODULO[(modulo ?? '') as ModuloRoles] ?? ROLES_POR_MODULO.consulta
}

/**
 * ¿Este rol se puede archivar?
 *
 * `NO_IDENTIFICADO` **no**: es la forma de decir que no se sabe, y guardarlo
 * como si fuera una atribución lo convertiría en un dato. Se queda fuera, y la
 * pantalla enseña «Hablante A».
 */
export function esRolAtribuible(rol: string, modulo?: string): boolean {
  return rol !== NO_IDENTIFICADO && rolesDe(modulo).includes(rol)
}

/** La lista para el prompt, en el orden en que se le ofrece al modelo. */
export function catalogoParaPrompt(modulo?: string): string {
  return rolesDe(modulo).map(r => `"${r}"`).join(', ')
}

export const POR_QUE_EXISTE_NO_IDENTIFICADO =
  'Sin una salida honesta, el modelo tiene que elegir igual, y en un pase de ' +
  'hospital enfermería acaba etiquetada como «Paciente». De quién dijo qué ' +
  'cuelgan el motor de negaciones y la procedencia: con un rol inventado, esas ' +
  'defensas razonan sobre una atribución falsa y responden igual de seguras.'
