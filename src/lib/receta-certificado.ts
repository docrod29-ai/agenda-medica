import type { NotaMedica } from '@/types/expediente'
import { resumirMedicamentos, huellaContenido } from '@/lib/expediente/huella-impreso'
import { folioDeNota } from '@/lib/receta-folio'

/**
 * Qué AFIRMA el certificado de verificación de una receta (el QR), derivado
 * exclusivamente de la nota autoritativa del servidor.
 *
 * EL HUECO QUE CIERRA (residual de REG-025): `/api/receta/verificacion-url`
 * firmaba `folio`, `doctorNombre` y `cedula` tal como llegaban en el body. Un
 * miembro con rol médico podía POSTear cualquier cédula y cualquier folio y
 * obtener una URL que la página pública `/verificar` presenta como
 * "Integridad verificada". Ausculta certificaba un documento inexistente con la
 * cédula de un tercero.
 *
 * Además había un caso NO malicioso que ya producía el dato incorrecto: el
 * cliente enviaba `config.nombreMedico` / `config.cedulaProfesional`, que son de
 * la CLÍNICA (un solo par en `config/main`). En un consultorio con dos médicos,
 * si el médico B imprimía la receta de una nota firmada por A, el QR salía con
 * la identidad de B.
 *
 * PRINCIPIO: la ruta deja de creerle al body. Del body solo se aceptan
 * LOCALIZADORES (clinicId, patientId, notaId); todo lo que el certificado
 * afirma sale de aquí. El contrato de estas funciones —`(notaId, nota)` y nada
 * más— hace la inyección imposible por construcción, no por validación.
 *
 * Módulo PURO: sin Firestore, sin HMAC, sin red → 100% testeable.
 */

export type OrigenEmisor = 'firma' | 'metadata' | 'ninguno'

export interface EmisorCertificado {
  doctorNombre: string
  cedula: string
  /** De dónde salió la identidad. 'ninguno' = la nota no la trae; NO se inventa. */
  origen: OrigenEmisor
}

/**
 * Identidad del prescriptor SEGÚN LA NOTA. Prioridad:
 *  1) `nota.firma` — snapshot inmutable del momento de firmar (NOM-024) → 'firma'
 *  2) `nota.metadata.cedulaProfesional` — notas legadas sin bloque de firma → 'metadata'
 *  3) vacío → 'ninguno'
 *
 * En el caso 2 el NOMBRE queda vacío a propósito: `metadata` solo guarda
 * `medicoId` (un uid), que no es un nombre. Rellenarlo con lo que fuera sería
 * inventar al emisor de un documento médico-legal. Fail-safe, nunca
 * fail-inventado: la página pública ya pinta '—' cuando falta.
 */
export function emisorDeNota(nota: NotaMedica | null | undefined): EmisorCertificado {
  const nombreFirma = (nota?.firma?.nombreMedico ?? '').trim()
  const cedulaFirma = (nota?.firma?.cedulaProfesional ?? '').trim()
  if (nombreFirma || cedulaFirma) {
    return { doctorNombre: nombreFirma, cedula: cedulaFirma, origen: 'firma' }
  }
  const cedulaMeta = (nota?.metadata?.cedulaProfesional ?? '').trim()
  if (cedulaMeta) return { doctorNombre: '', cedula: cedulaMeta, origen: 'metadata' }
  return { doctorNombre: '', cedula: '', origen: 'ninguno' }
}

export interface DatosCertificado {
  folio: string
  doctorNombre: string
  cedula: string
  origenEmisor: OrigenEmisor
  /**
   * Huella de los medicamentos que la NOTA FIRMADA tiene guardados.
   *
   * OJO: NO es comparable con el `contenidoHash` que manda el cliente. Ese se
   * calcula sobre lo que se está imprimiendo e incluye folio, indicaciones y
   * diagnóstico; este solo sobre los fármacos de la nota. Que difieran NO
   * implica que se editó la receta, así que la página pública los muestra como
   * dos hechos independientes y no afirma nada sobre su diferencia.
   *
   * Ausente si la nota no tiene medicamentos (no se acuña un hash de la nada).
   */
  huellaNota?: string
}

/**
 * Todo lo que el certificado afirmará, derivado únicamente de `(notaId, nota)`.
 * No recibe —ni puede recibir— nada del body de la petición.
 */
export function datosCertificado(notaId: string, nota: NotaMedica): DatosCertificado {
  const emisor = emisorDeNota(nota)
  const lineas = resumirMedicamentos(Array.isArray(nota?.medicamentos) ? nota.medicamentos : [])
  return {
    folio: folioDeNota(notaId),
    doctorNombre: emisor.doctorNombre,
    cedula: emisor.cedula,
    origenEmisor: emisor.origen,
    huellaNota: lineas.length ? huellaContenido(lineas) : undefined,
  }
}
