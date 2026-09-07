/**
 * LA RECETA SE ARMA DEL PLAN. LO DEMÁS ES HISTORIA.
 *
 * ── LA QUEJA, POR TERCERA VEZ, CON SUS PALABRAS (7-sep-2026) ────────────────
 *
 *   «Si yo te digo los antecedentes —paciente hipertenso, toma sartán— me lo
 *    pones en la pinche receta, y te dije que no: tú vas a poner ahí el plan de
 *    lo que te diga el doctor.»
 *
 * Ya se reparó dos veces. REG-183 declaró el eje `procedenciaClinica` en el
 * esquema plano —hasta entonces `z.object` borraba la clave y el antecedente
 * bajaba al papel—. REG-515 añadió `speaker`, porque un antecedente lo dice el
 * paciente y un plan lo dice el médico.
 *
 * ── POR QUÉ SEGUÍA PASANDO ──────────────────────────────────────────────────
 *
 * Porque las dos defensas anteriores fallan JUNTAS en el caso más común de
 * este consultorio:
 *
 *   1. `procedenciaClinica` es **lo que el modelo opina**. Cuando etiqueta
 *      «paciente hipertenso, toma losartán» como `se_prescribe_hoy`, se acabó
 *      la defensa: es la palabra del propio modelo contra sí mismo.
 *   2. `speaker` es un hecho del audio… **cuando hay diarización**. Sin ella
 *      —dictado por Web Speech, consulta de un solo micrófono, o cualquiera de
 *      los caminos en los que la separación de voces no llega— el campo viene
 *      ausente, y la ausencia NO se castiga a propósito (`loDijoElMedico`),
 *      porque castigarla borraría del papel los renglones que el médico
 *      escribió a mano.
 *
 * Con el modelo equivocado y sin voces separadas, nada quedaba en pie. El
 * losartán del minuto dos salía impreso con cédula profesional.
 *
 * ── LA TERCERA DEFENSA, QUE ES LA QUE ÉL PIDIÓ ──────────────────────────────
 *
 * No es una heurística nueva: es su frase, ejecutada. **La receta se arma del
 * PLAN.** Y el plan no hay que adivinarlo — es un apartado de la nota, con su
 * clave, que el propio modelo acaba de redactar leyendo el dictado entero:
 * `planTratamiento`, `plan`, `planIngreso`, `indicacionesAlta`…
 *
 *   · el fármaco aparece en el apartado del PLAN        → se prescribe hoy
 *   · aparece sólo en antecedentes / padecimiento       → ya lo toma
 *   · no aparece en ninguno de los dos                  → no se toca
 *
 * Esto no depende de que la diarización llegue ni de que el modelo se etiquete
 * bien a sí mismo: depende de DÓNDE quedó escrito el fármaco en la nota, que es
 * exactamente el criterio que el médico enunció.
 *
 * ── LO QUE ESTE MÓDULO NO HACE, Y ES DELIBERADO ─────────────────────────────
 *
 * **No borra ningún renglón.** De la lista de medicamentos cuelgan el cruce de
 * alergias, el de interacciones y el motor de dosis, y tienen que ver TODO lo
 * que el paciente toma — sobre todo lo que ya tomaba, que es justo donde viven
 * las interacciones. Lo único que cambia es `procedenciaClinica`, que es el
 * campo del que depende qué baja al papel (`que-va-en-la-receta.ts`).
 *
 * **No decide con la nota vacía.** Si no hay apartado de plan con texto —el
 * pase en vivo, un dictado que aún no llegó al tratamiento— este módulo se
 * abstiene entero y devuelve la lista intacta. Marcar todo como «ya lo toma»
 * porque el plan todavía no existe borraría del papel una prescripción real.
 *
 * **No inventa la etiqueta que falta cuando el fármaco no está en ningún
 * apartado.** Ausencia de dato no es dato de ausencia (regla 4).
 *
 * Módulo PURO.
 */
import { comoPalabra } from '@/lib/expediente/negaciones'

/**
 * Los apartados donde vive el PLAN, por tipo de nota.
 *
 * Salen de `templates.ts`, que es la fuente de verdad de las secciones. Se
 * listan por clave y no por heurística sobre el nombre, para que añadir un tipo
 * de nota nuevo sin tocar esto se note como «no se vigila» y no como «se
 * vigila mal».
 */
export const APARTADOS_DE_PLAN: readonly string[] = [
  'planTratamiento', 'plan', 'planIngreso', 'planAbordajeDx',
  'indicacionesAlta', 'planProfilaxis', 'impresionPlan', 'planEgreso',
  'tratamiento', 'indicaciones',
]

/**
 * Los apartados donde vive lo que el paciente YA traía.
 *
 * Un fármaco que sólo aparece aquí es historia clínica: lo dijo el paciente al
 * recabar antecedentes, o venía del expediente.
 */
export const APARTADOS_DE_HISTORIA: readonly string[] = [
  'antecedentesPat', 'antecedentesRelevantes', 'antecedentes',
  'antecedentesHeredo', 'antecedentesNoPat', 'padecimientoActual',
  'interrogatorioSistemas', 'estudiosPrevios', 'subjetivo',
  'motivoConsulta', 'motivoIngreso', 'resumenEvolucion', 'resumenCaso',
]

/** Longitud mínima del nombre para buscarlo. El mismo criterio del repositorio. */
export const MINIMO_NOMBRE = 5

/** Sin acentos, en minúsculas. Lo mismo que hace `comoPalabra` con la aguja. */
function normalizar(t: unknown): string {
  return String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Las palabras buscables de un nombre de fármaco.
 *
 * «Amoxicilina con ácido clavulánico» se dicta de diez maneras y se escribe de
 * otras diez. Se busca el nombre completo y, si no está, cada palabra suya que
 * sea suficientemente larga para no casar con cualquier cosa. «con», «de» y
 * «ácido» se caen solas por longitud, que es más honesto que una lista de
 * palabras vacías que habría que mantener.
 */
export function formasBuscables(nombre: unknown): string[] {
  const n = normalizar(nombre).replace(/\s+/g, ' ').trim()
  if (!n) return []
  const formas = n.length >= MINIMO_NOMBRE ? [n] : []
  for (const p of n.split(/[^a-z0-9]+/)) if (p.length >= MINIMO_NOMBRE) formas.push(p)
  return [...new Set(formas)]
}

/** ¿Este texto nombra este fármaco, como palabra y no como trozo de otra? */
export function loNombra(texto: string, nombre: unknown): boolean {
  const t = normalizar(texto)
  if (!t) return false
  return formasBuscables(nombre).some(f => comoPalabra(f).test(t))
}

/** Junta el texto de los apartados pedidos. `secciones` es `{clave: texto}`. */
function textoDe(
  secciones: Readonly<Record<string, unknown>> | null | undefined,
  claves: readonly string[],
): string {
  if (!secciones) return ''
  return claves.map(k => String(secciones[k] ?? '')).filter(Boolean).join('\n')
}

export interface DondeQuedoEscrito {
  enElPlan: boolean
  enLaHistoria: boolean
}

/** Dónde quedó escrito este fármaco dentro de la nota. */
export function dondeQuedoEscrito(
  nombre: unknown,
  secciones: Readonly<Record<string, unknown>> | null | undefined,
): DondeQuedoEscrito {
  return {
    enElPlan: loNombra(textoDe(secciones, APARTADOS_DE_PLAN), nombre),
    enLaHistoria: loNombra(textoDe(secciones, APARTADOS_DE_HISTORIA), nombre),
  }
}

/** ¿Hay plan escrito? Si no lo hay, este módulo no opina. */
export function hayPlanEscrito(
  secciones: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  return textoDe(secciones, APARTADOS_DE_PLAN).trim().length > 0
}

interface ConProcedencia {
  nombre?: unknown
  procedenciaClinica?: 'ya_lo_toma' | 'se_prescribe_hoy'
}

/**
 * Corrige `procedenciaClinica` con lo que dice la NOTA, no con lo que opina el
 * modelo de sí mismo.
 *
 * Sólo escribe la etiqueta cuando la nota lo dice sin ambigüedad:
 *
 *   · en el plan y no en la historia  → `se_prescribe_hoy`
 *   · en la historia y no en el plan  → `ya_lo_toma`
 *   · en los dos, o en ninguno        → se deja lo que hubiera
 *
 * «En los dos» es el caso de la renovación —«sigue con su losartán»— y ahí la
 * etiqueta del modelo es mejor que cualquier regla de texto: renovar hoy lo que
 * ya tomaba es una receta perfectamente normal, y decidirlo aquí borraría del
 * papel un tratamiento que el médico acaba de confirmar.
 */
export function laRecetaSeArmaDelPlan<T extends ConProcedencia>(
  medicamentos: readonly T[],
  secciones: Readonly<Record<string, unknown>> | null | undefined,
): T[] {
  const meds = medicamentos ?? []
  if (!hayPlanEscrito(secciones)) return [...meds]
  return meds.map(m => {
    const d = dondeQuedoEscrito(m?.nombre, secciones)
    if (d.enElPlan && !d.enLaHistoria) return { ...m, procedenciaClinica: 'se_prescribe_hoy' as const }
    if (d.enLaHistoria && !d.enElPlan) return { ...m, procedenciaClinica: 'ya_lo_toma' as const }
    return m
  })
}

export const POR_QUE_NO_BASTABAN_LAS_DOS_DEFENSAS_ANTERIORES =
  'Porque fallan juntas en el caso común: `procedenciaClinica` es la opinión '
  + 'del modelo —y cuando se equivoca no queda nada—, y `speaker` sólo existe '
  + 'si hubo diarización, cuya ausencia no se castiga para no borrar del papel '
  + 'lo que el médico escribió a mano. Sin voces separadas y con el modelo '
  + 'equivocado, el antecedente bajaba al papel.'

export const POR_QUE_NO_SE_BORRA_NINGUN_RENGLON =
  'Porque de la lista cuelgan el cruce de alergias, el de interacciones y el '
  + 'motor de dosis, y necesitan ver TODO lo que el paciente toma —sobre todo '
  + 'lo que ya tomaba, que es donde viven las interacciones—. Lo que cambia es '
  + 'la etiqueta que decide qué baja al papel, no la lista.'

export const LO_QUE_ESTE_MODULO_NO_VIGILA: readonly string[] = [
  'Que el modelo escriba el plan en su apartado. Si redacta el tratamiento dentro del padecimiento actual, esto lo lee como historia.',
  'Los fármacos que el médico añade a mano en la lista: no pasan por la nota, y por eso siguen imprimiéndose como siempre.',
  'Un apartado de plan de un tipo de nota que no esté en APARTADOS_DE_PLAN: no se vigila, y el módulo se abstiene.',
]
