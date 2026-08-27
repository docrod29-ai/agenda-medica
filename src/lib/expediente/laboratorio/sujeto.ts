import { verificaSujeto, type SujetoFhir } from '@/lib/hospital/fhir-import'
import { similitudNombre, UMBRAL_NOMBRE } from '@/lib/pacientes/duplicados'

/**
 * ¿DE QUIÉN ES ESTA HOJA DE LABORATORIO?
 *
 * ── EL AGUJERO QUE CIERRA (REG-324) ──────────────────────────────────────────
 *
 * El camino cotidiano de Practice —adjuntar un PDF o una foto de resultados—
 * archivaba el panel bajo el `patientId` de la pantalla que estaba abierta. Nada
 * en ese camino miraba a quién pertenecía la evidencia, y no podía mirarlo: el
 * prompt de visión ordenaba DESCARTAR el nombre antes de que nadie pudiera
 * compararlo. Una regla de privacidad —«no se persisten identificadores»— se
 * había implementado como «no se extraen», y de paso destruyó la única prueba
 * con la que se podía verificar el sujeto.
 *
 * El resultado: la identidad del documento nacía del CONTEXTO DE PANTALLA. Subir
 * la hoja del paciente anterior con la ficha del siguiente abierta la archivaba
 * bajo el equivocado, con mensaje de éxito. De ahí salen las gráficas de
 * tendencia y el texto que el médico pega en la nota.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Ningún resultado se asocia a un paciente porque ese paciente esté abierto. O
 * la evidencia dice de quién es y coincide, o una persona lo confirma viendo el
 * nombre de a quién se le va a archivar. No hay tercera puerta.
 *
 * ── POR QUÉ NO SE REUSA `verificaSujeto` TAL CUAL ────────────────────────────
 *
 * Sí se reusa —es la frontera canónica y aquí se la llama primero—, pero no
 * basta sola: nació para un Bundle FHIR, donde el nombre viene escrito por una
 * máquina y la igualdad exacta es razonable. Aquí el nombre lo lee un OCR de una
 * hoja impresa, donde «RODRIGUEZ LUNA DAVID» y «David Rodríguez Luna» son la
 * misma persona y un acento perdido no es otro paciente. Comparar por igualdad
 * exacta bloquearía el caso normal, y un bloqueo que salta siempre se aprende a
 * esquivar. Por eso el desempate lo hace `similitudNombre`, que es el comparador
 * de identidad de personas que este producto ya tiene (el mismo que decide si
 * dos expedientes son el mismo paciente), y no uno nuevo inventado aquí.
 *
 * ── PRIVACIDAD ───────────────────────────────────────────────────────────────
 *
 * El nombre leído se usa para COMPARAR y se tira. Lo único que se persiste es el
 * veredicto y a qué paciente/consultorio quedó atado el panel. Un nombre ajeno
 * nunca llega al expediente: cuando no coincide, no se escribe nada.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore. El instante se recibe como
 * argumento para que sea determinista en navegador y en Node.
 */

/** Un paciente nombrado por la hoja, tal como lo leyó la visión. */
export interface SujetoLeido {
  nombre: string
}

/** A quién se le va a archivar: el destino REAL de la escritura. */
export interface DestinoPaciente {
  clinicId: string
  patientId: string
  nombre: string
}

/**
 * `ambiguo` y `no-coincide` bloquean igual; se distinguen porque lo que hay que
 * decirle al médico es distinto («esto es de otra persona» ≠ «no puedo asegurar
 * que sea de esta»), y porque mezclarlos escondería cuál de los dos está
 * frenando el flujo cotidiano.
 */
export type VeredictoSujeto = 'coincide' | 'ambiguo' | 'no-coincide' | 'sin-identificar'

export interface DictamenSujeto {
  veredicto: VeredictoSujeto
  /** Puede guardarse sin más. Sólo `coincide`. */
  puedeGuardar: boolean
  /** Puede guardarse SÓLO si el médico lo confirma. Sólo `sin-identificar`. */
  requiereConfirmacion: boolean
  /** En español llano, para pintarlo tal cual. */
  motivo: string
  /** Lo que decía la hoja, para que el médico lo VEA. NO se persiste. */
  leido?: string
}

/**
 * Lo que queda escrito en el panel: a qué paciente y a qué consultorio quedó
 * atada esta evidencia, y con qué autoridad. Sin nombres.
 */
export interface VinculoSujeto {
  clinicId: string
  patientId: string
  veredicto: VeredictoSujeto
  /** El médico confirmó explícitamente el destino (sólo aplica a `sin-identificar`). */
  confirmadoPorMedico: boolean
  verificadoEn: string
}

/**
 * Por debajo de esto ya no es «el mismo nombre escrito distinto»: es otra
 * persona. Entre este umbral y `UMBRAL_NOMBRE` viven los parecidos de familia
 * —mismo par de apellidos, otro nombre de pila—, que son justo el caso en que
 * el sistema NO debe decidir solo.
 */
export const UMBRAL_AMBIGUO = 0.5

/** Cuántos nombres distintos se aceptan de la IA antes de considerarlo ruido. */
const MAX_SUJETOS = 8
/** Un nombre más largo que esto no es un nombre: es un párrafo mal recortado. */
const MAX_LARGO_NOMBRE = 120

/**
 * Sanea lo que devolvió la visión. Nunca confía en la forma: la IA puede mandar
 * números, nulos, objetos o cuarenta renglones de encabezado.
 */
export function sujetosLeidos(crudo: unknown): SujetoLeido[] {
  if (!Array.isArray(crudo)) return []
  const vistos = new Set<string>()
  const out: SujetoLeido[] = []
  for (const x of crudo) {
    if (typeof x !== 'string') continue
    const nombre = x.replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_NOMBRE)
    // Una sola palabra no identifica a nadie («Paciente», «Hospital», un apellido
    // suelto). Tratarla como sujeto daría veredictos con cara de certeza.
    if (nombre.split(' ').filter(Boolean).length < 2) continue
    const clave = nombre.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    out.push({ nombre })
    if (out.length >= MAX_SUJETOS) break
  }
  return out
}

/** ¿Los resultados de esta hoja son de este paciente? */
export function dictaminarSujeto(sujetos: readonly SujetoLeido[], destino: DestinoPaciente): DictamenSujeto {
  const leido = sujetos.map(s => s.nombre).join(', ') || undefined

  if (sujetos.length === 0) {
    return {
      veredicto: 'sin-identificar', puedeGuardar: false, requiereConfirmacion: true,
      motivo: `La hoja no dice de quién es. Nadie puede verificarlo por ti: confirma que estos resultados son de ${destino.nombre}.`,
    }
  }

  /**
   * Varias personas en el mismo archivo. No se acepta aunque una de ellas sea la
   * de la pantalla: no hay forma de saber qué renglón es de quién sin partirlo.
   * Es la misma decisión que toma `verificaSujeto` en el camino FHIR.
   */
  if (sujetos.length > 1) {
    return {
      veredicto: 'ambiguo', puedeGuardar: false, requiereConfirmacion: false, leido,
      motivo: `El archivo nombra a más de un paciente (${leido}). Súbelo separado, uno por paciente.`,
    }
  }

  /**
   * Primero la frontera canónica, tal cual. Si el nombre coincide exacto o la
   * referencia es el propio id del paciente, no hace falta nada más.
   */
  const comoFhir: SujetoFhir[] = sujetos.map(s => ({ nombre: s.nombre }))
  if (verificaSujeto(comoFhir, { id: destino.patientId, nombre: destino.nombre }).veredicto === 'coincide') {
    return { veredicto: 'coincide', puedeGuardar: true, requiereConfirmacion: false, leido, motivo: `La hoja es de ${destino.nombre}.` }
  }

  // Desempate tolerante al OCR y al orden de los apellidos, no a la identidad.
  const sim = similitudNombre(sujetos[0].nombre, destino.nombre)
  if (sim >= UMBRAL_NOMBRE) {
    return { veredicto: 'coincide', puedeGuardar: true, requiereConfirmacion: false, leido, motivo: `La hoja es de ${destino.nombre}.` }
  }
  if (sim >= UMBRAL_AMBIGUO) {
    return {
      veredicto: 'ambiguo', puedeGuardar: false, requiereConfirmacion: false, leido,
      motivo: `La hoja dice «${leido}» y el expediente abierto es de ${destino.nombre}. Se parecen, pero no lo bastante para archivarlo aquí: ábrelo en el expediente que corresponda.`,
    }
  }
  return {
    veredicto: 'no-coincide', puedeGuardar: false, requiereConfirmacion: false, leido,
    motivo: `BLOQUEADO: estos resultados son de «${leido}», no de ${destino.nombre}. Ábrelos en el expediente correcto.`,
  }
}

/**
 * Acuña el vínculo que autoriza la escritura. Devuelve `null` cuando no hay
 * autoridad para escribir — que es la respuesta correcta, no un error.
 *
 * `confirmadoPorMedico` sólo tiene efecto sobre `sin-identificar`: una
 * confirmación no convierte a otra persona en ésta.
 */
export function vinculoDeSujeto(
  dictamen: DictamenSujeto, destino: DestinoPaciente,
  confirmadoPorMedico: boolean, verificadoEn: string,
): VinculoSujeto | null {
  const base = { clinicId: destino.clinicId, patientId: destino.patientId, verificadoEn }
  if (dictamen.veredicto === 'coincide') return { ...base, veredicto: 'coincide', confirmadoPorMedico: false }
  if (dictamen.veredicto === 'sin-identificar' && confirmadoPorMedico) {
    return { ...base, veredicto: 'sin-identificar', confirmadoPorMedico: true }
  }
  return null
}

/**
 * LA FRONTERA. Lo último que se pregunta antes de escribir, y lo único que
 * `guardarPanelLab` obedece.
 *
 * Se vuelve a comprobar el destino contra el vínculo —no basta con que el
 * vínculo exista— porque entre la revisión y el «Guardar» el médico pudo cambiar
 * de paciente o de consultorio en otra pestaña. Un vínculo NO se re-apunta: si
 * el destino cambió, caduca.
 */
export function autorizaGuardar(
  vinculo: VinculoSujeto | null | undefined,
  destino: { clinicId: string; patientId: string },
): { ok: boolean; motivo: string } {
  if (!vinculo) {
    return { ok: false, motivo: 'No se verificó de quién son estos resultados. Un laboratorio no se archiva por tener un expediente abierto.' }
  }
  if (!vinculo.clinicId || vinculo.clinicId !== destino.clinicId) {
    return { ok: false, motivo: 'La verificación pertenece a otro consultorio.' }
  }
  if (!vinculo.patientId || vinculo.patientId !== destino.patientId) {
    return { ok: false, motivo: 'La verificación se hizo sobre otro paciente. Vuelve a subir la hoja en el expediente que corresponda.' }
  }
  if (vinculo.veredicto === 'coincide') return { ok: true, motivo: '' }
  if (vinculo.veredicto === 'sin-identificar' && vinculo.confirmadoPorMedico) return { ok: true, motivo: '' }
  return { ok: false, motivo: 'El sujeto de la hoja no quedó verificado para este paciente.' }
}
