/**
 * FUNDIR DOS EXPEDIENTES QUE SON LA MISMA PERSONA.
 *
 * ── EL FALLO QUE ESTO REPARA (ASE-009) ───────────────────────────────────────
 *
 * El barrido de `/pacientes` encuentra las parejas repetidas, el diálogo dice
 * «nada se junta ni se borra solo», y **no había forma de juntarlos**:
 * `firestore.rules` cierra el borrado de pacientes desde el navegador (`allow
 * delete: if false`, y con razón), y el único borrado real del producto vive en
 * `/api/arco/cancelar`. O sea: el único camino para deshacer un duplicado era
 * fingir una solicitud ARCO de cancelación sobre un paciente que nunca la pidió
 * — falsificar un registro legal para arreglar un problema de datos.
 *
 * Mientras tanto el historial sigue partido: las alergias en un expediente y
 * las notas recientes en el otro. El médico abre uno, lee «sin alergias
 * conocidas» porque la penicilina quedó en el otro, y prescribe.
 *
 * ── LAS TRES REGLAS DE LA FUSIÓN ─────────────────────────────────────────────
 *
 *  1. **No se borra nada.** El expediente absorbido se marca `fusionadoEn` y
 *     deja de aparecer en listas y búsquedas, pero sigue existiendo. Fundir a
 *     dos personas distintas por error es el daño caro; si no queda rastro, es
 *     además irreparable.
 *  2. **El superviviente no pierde lo suyo.** Los campos del absorbido sólo
 *     rellenan HUECOS. Un dato que ya existe en el superviviente no se pisa: eso
 *     sería una corrección invisible sobre un expediente clínico.
 *  3. **Lo que no se puede juntar se DECLARA.** Cuando los dos traen valores
 *     distintos del mismo campo, el del absorbido no se tira en silencio: sale
 *     en el plan como conflicto para que el médico lo vea ANTES, y se guarda en
 *     la bitácora de la fusión.
 *
 * ── POR QUÉ EL PLAN ES UNA FUNCIÓN PURA ──────────────────────────────────────
 *
 * Porque «qué va a pasar» tiene que poder enseñarse antes de que pase, y
 * probarse sin base de datos. La ESCRITURA vive en `/api/pacientes/fundir`, que
 * necesita el SDK admin para mover subcolecciones sin depender de que las reglas
 * permitan cada documento.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore.
 */
import type { Patient } from '@/types'

/** Los campos demográficos que se pueden rellenar desde el absorbido. */
const CAMPOS_QUE_SE_RELLENAN = [
  'telefono', 'whatsapp', 'email', 'fechaNacimiento', 'sexo', 'curp',
  'seguroMedico', 'alergias', 'notas',
] as const

type CampoRellenable = (typeof CAMPOS_QUE_SE_RELLENAN)[number]

export interface ConflictoDeFusion {
  campo: CampoRellenable
  /** Lo que se queda (el del superviviente). */
  seQueda: string
  /** Lo que NO se copia. No se pierde: se declara y se guarda en la bitácora. */
  noSeCopia: string
}

export interface PlanDeFusion {
  /** El expediente que sobrevive y absorbe. */
  sobreviveId: string
  /** El que se marca como fusionado y sale de las listas. */
  absorbidoId: string
  /** Por qué sobrevive ése y no el otro, en español llano. */
  porQueSobreviveEse: string
  /** Campos del absorbido que rellenan huecos del superviviente. */
  rellena: Partial<Record<CampoRellenable, string>>
  /** Valores distintos del mismo campo. Se enseñan ANTES de fundir. */
  conflictos: ConflictoDeFusion[]
  /** Por qué NO se puede fundir. `null` = se puede. */
  impedimento: string | null
}

/** El valor de un campo como texto comparable. Vacío = no hay dato. */
function texto(p: Patient, campo: CampoRellenable): string {
  const v = (p as unknown as Record<string, unknown>)[campo]
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Cuánta historia clínica cuelga de este expediente.
 *
 * Se pasa por parámetro y no se lee aquí: contar notas es una consulta a la
 * base, y este módulo es puro. La pantalla o la ruta lo aportan.
 */
export interface PesoDelExpediente {
  /** Cuántas notas tiene (firmadas o no). Decide quién sobrevive. */
  notas: number
}

/**
 * Quién absorbe a quién, y qué pasa con cada campo.
 *
 * SOBREVIVE EL QUE TIENE MÁS HISTORIA CLÍNICA, no el más antiguo ni el primero
 * de la lista: mover una nota firmada de sitio es tocar un documento
 * medicolegal, y el criterio que menos documentos mueve es el que menos puede
 * romper. Con las dos igualadas, sobrevive el más viejo, que es el que lleva
 * más tiempo referenciado por citas y cobros.
 */
export function planDeFusion(
  a: Patient, pesoA: PesoDelExpediente,
  b: Patient, pesoB: PesoDelExpediente,
): PlanDeFusion {
  const impedimento =
    !a?.id || !b?.id ? 'Falta el identificador de alguno de los dos expedientes.'
    : a.id === b.id ? 'Son el mismo expediente.'
    : (a as { fusionadoEn?: string }).fusionadoEn || (b as { fusionadoEn?: string }).fusionadoEn
      ? 'Uno de los dos ya se fundió con otro expediente.'
    /**
     * DOS CURP DISTINTOS SON DOS PERSONAS. Es el único dato de la ficha que
     * identifica a una y sólo a una, y el motor de duplicados ya lo trata así
     * (`compararPacientes` devuelve `null` sin mirar el nombre). Aquí pesa más:
     * allí se decide si AVISAR y aquí se decide si JUNTAR dos historias.
     */
    : curp(a) && curp(b) && curp(a) !== curp(b)
      ? 'Tienen CURP distintos: son dos personas, por mucho que se llamen igual.'
    : null

  const aGana =
    pesoA.notas !== pesoB.notas
      ? pesoA.notas > pesoB.notas
      : String(a.createdAt ?? '') <= String(b.createdAt ?? '')

  const sobrevive = aGana ? a : b
  const absorbido = aGana ? b : a
  const porQueSobreviveEse =
    (aGana ? pesoA.notas : pesoB.notas) > (aGana ? pesoB.notas : pesoA.notas)
      ? `Se queda el expediente con más notas (${aGana ? pesoA.notas : pesoB.notas} contra ${aGana ? pesoB.notas : pesoA.notas}): así se mueven menos documentos firmados.`
      : 'Los dos tienen las mismas notas, así que se queda el más antiguo: es el que llevan más tiempo señalando las citas y los cobros.'

  const rellena: Partial<Record<CampoRellenable, string>> = {}
  const conflictos: ConflictoDeFusion[] = []
  for (const campo of CAMPOS_QUE_SE_RELLENAN) {
    const suyo = texto(sobrevive, campo)
    const otro = texto(absorbido, campo)
    if (!otro) continue
    if (!suyo) { rellena[campo] = otro; continue }
    if (suyo !== otro) conflictos.push({ campo, seQueda: suyo, noSeCopia: otro })
  }

  return {
    sobreviveId: String(sobrevive.id ?? ''),
    absorbidoId: String(absorbido.id ?? ''),
    porQueSobreviveEse,
    rellena,
    conflictos,
    impedimento,
  }
}

function curp(p: Patient): string {
  const c = String(p.curp ?? '').trim().toUpperCase()
  return c.length === 18 ? c : ''
}

/**
 * QUÉ SE PIERDE AL FUNDIR, dicho en la pantalla antes de pulsar.
 *
 * No es una advertencia genérica: es la lista de lo que este par concreto va a
 * dejar por el camino. Una fusión que promete «no se pierde nada» y pierde el
 * segundo teléfono es peor que una que lo dice.
 */
export function loQueSePierde(plan: PlanDeFusion): string[] {
  const salida = plan.conflictos.map(c =>
    `${etiqueta(c.campo)}: se queda «${c.seQueda}» y NO se copia «${c.noSeCopia}» (queda en la bitácora de la fusión).`,
  )
  salida.push(
    'El expediente absorbido no se borra: se marca como fusionado y deja de salir en listas y búsquedas. Si esto fue un error, sigue ahí.',
  )
  return salida
}

const ETIQUETAS: Record<CampoRellenable, string> = {
  telefono: 'Teléfono', whatsapp: 'WhatsApp', email: 'Correo',
  fechaNacimiento: 'Fecha de nacimiento', sexo: 'Sexo', curp: 'CURP',
  seguroMedico: 'Servicio médico', alergias: 'Alergias', notas: 'Notas',
}
function etiqueta(c: CampoRellenable): string { return ETIQUETAS[c] }
