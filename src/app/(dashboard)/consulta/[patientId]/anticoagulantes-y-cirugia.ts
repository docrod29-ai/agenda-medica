/**
 * «PROGRAMADO PARA CIRUGÍA» + ANTICOAGULANTE — EL CRUCE QUE NADIE HACÍA (MC-015).
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * La valoración preoperatoria sabe qué hacer con un anticoagulante antes de una
 * cirugía —los intervalos viven en `src/lib/expediente/preop.ts` con su fuente—
 * pero sólo se enteraba si el médico marcaba la casilla a mano. Fuera de ese
 * tipo de nota no había NADA: en `avisos-consulta.ts` la palabra «warfarina»
 * aparece únicamente en comentarios de otros avisos, y en `src/lib/seguridad/`
 * no hay nada quirúrgico.
 *
 * O sea: el sistema tenía los dos datos —la lista de fármacos vigente y el texto
 * que dice que hay cirugía programada— y no los cruzaba.
 *
 * ── QUÉ HACE ESTE MÓDULO, Y QUÉ NO ──────────────────────────────────────────
 *
 * Reconoce vocabulario y avisa. **No propone conducta**: no dice cuántos días
 * suspender, ni si hay que hacer puente. Eso lo dice el motor de la valoración
 * preoperatoria, con su fuente citada, y lo firma el médico. Aquí sólo se
 * enciende la luz y se señala hacia allá.
 *
 * ── VOCABULARIO, NO CRITERIO (clinical-safety §5) ───────────────────────────
 *
 * Las listas de abajo son vocabulario: lo que NO esté en ellas **no se vigila**,
 * y eso no significa que sea seguro. Ampliarlas es el lado correcto del error
 * (avisar de más), pero cada término nuevo entra por su nombre, no por regex
 * suelta.
 *
 * Módulo PURO.
 */

/** Anticoagulantes orales directos. Vocabulario declarado; ausencia ≠ seguridad. */
export const DOAC = [
  'apixaban', 'apixabán', 'rivaroxaban', 'rivaroxabán', 'edoxaban', 'edoxabán',
  'dabigatran', 'dabigatrán', 'eliquis', 'xarelto', 'pradaxa', 'lixiana',
] as const

/** Antagonistas de la vitamina K. */
export const CUMARINICOS = ['warfarina', 'coumadin', 'acenocumarol', 'sintrom'] as const

/** Heparinas y afines: no son «warfarina» ni DOAC, pero también sangran. */
export const HEPARINAS = ['enoxaparina', 'clexane', 'heparina', 'fondaparinux', 'dalteparina'] as const

/** Antiagregantes. La aspirina va aparte porque la valoración la pregunta aparte. */
export const ASPIRINA = ['aspirina', 'acido acetilsalicilico', 'ácido acetilsalicílico', 'aas', 'asa 100'] as const
export const OTROS_ANTIAGREGANTES = ['clopidogrel', 'plavix', 'prasugrel', 'ticagrelor', 'brilinta'] as const

/** Palabras con las que una nota dice que hay una cirugía por delante. */
export const DICE_CIRUGIA_PROGRAMADA = [
  'programado para cirugia', 'programada para cirugia', 'programado para cirugía', 'programada para cirugía',
  'cirugia programada', 'cirugía programada', 'se programa cirugia', 'se programa cirugía',
  'pendiente de cirugia', 'pendiente de cirugía', 'preoperatorio', 'preoperatoria',
  'valoracion prequirurgica', 'valoración prequirúrgica', 'para quirofano', 'para quirófano',
  'se enviara a cirugia', 'se enviará a cirugía',
] as const

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export interface Anticoagulacion {
  /** Anticoagulante propiamente dicho (DOAC, cumarínico o heparina). */
  toma: boolean
  /** Sólo cuando se puede decir cuál: la valoración pregunta por tipo. */
  tipo?: 'DOAC' | 'warfarina'
  aspirina: boolean
  otroAntiagregante: boolean
  /** Los nombres tal como aparecen en la lista, para poder decirlos. */
  nombres: string[]
}

/** ¿La lista de fármacos del paciente trae algo que sangre? */
export function detectarAnticoagulacion(medicamentos: readonly { nombre?: string }[]): Anticoagulacion {
  const nombres: string[] = []
  let doac = false, cumarinico = false, heparina = false, aspirina = false, otro = false
  for (const m of medicamentos) {
    const n = norm(String(m?.nombre ?? ''))
    if (!n.trim()) continue
    const hit = (lista: readonly string[]) => lista.some(t => n.includes(norm(t)))
    if (hit(DOAC)) { doac = true; nombres.push(String(m.nombre)) }
    else if (hit(CUMARINICOS)) { cumarinico = true; nombres.push(String(m.nombre)) }
    else if (hit(HEPARINAS)) { heparina = true; nombres.push(String(m.nombre)) }
    else if (hit(ASPIRINA)) { aspirina = true; nombres.push(String(m.nombre)) }
    else if (hit(OTROS_ANTIAGREGANTES)) { otro = true; nombres.push(String(m.nombre)) }
  }
  return {
    toma: doac || cumarinico || heparina,
    tipo: doac ? 'DOAC' : cumarinico ? 'warfarina' : undefined,
    aspirina,
    otroAntiagregante: otro,
    nombres,
  }
}

/** ¿El texto de la nota dice que hay cirugía por delante? */
export function mencionaCirugiaProgramada(texto: string): boolean {
  const t = norm(texto)
  return DICE_CIRUGIA_PROGRAMADA.some(f => t.includes(norm(f)))
}

/**
 * El aviso, o `null` si no hay nada que decir. No propone conducta: nombra el
 * fármaco, dice que hay cirugía de por medio y manda a la valoración
 * preoperatoria, que es quien tiene los intervalos con su fuente.
 */
export function avisoDeCirugiaYAnticoagulante(
  medicamentos: readonly { nombre?: string }[],
  textoDeLaNota: string,
): string | null {
  if (!mencionaCirugiaProgramada(textoDeLaNota)) return null
  const a = detectarAnticoagulacion(medicamentos)
  if (!a.toma && !a.aspirina && !a.otroAntiagregante) return null
  const que = a.nombres.join(', ')
  return `La nota habla de cirugía y la lista incluye ${que}. `
    + 'Abre la valoración preoperatoria antes de firmar: ahí están los tiempos de suspensión '
    + 'con su fuente. Aquí no se propone ninguno.'
}

/**
 * Lo que la valoración preoperatoria puede dar por PRE-marcado a partir de la
 * lista de fármacos. Sigue siendo del médico: se prellena, no se decide, y lo
 * que él haya guardado antes manda sobre esto.
 */
export function prellenadoPreoperatorio(medicamentos: readonly { nombre?: string }[]): Record<string, unknown> {
  const a = detectarAnticoagulacion(medicamentos)
  const out: Record<string, unknown> = {}
  if (a.toma) out.tomaAnticoagulante = true
  if (a.tipo) out.tipoAnticoagulante = a.tipo
  if (a.aspirina) out.tomaAspirina = true
  return out
}
