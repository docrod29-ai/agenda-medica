import { RespuestaExtraccion } from '@/lib/expediente/extraction-schema'

/** Reutiliza el contrato de nota. No repara texto clínico ni acepta objetos vacíos. */
export function validarNotaPropia(texto: string): RespuestaExtraccion | null {
  try {
    const resultado = RespuestaExtraccion.safeParse(JSON.parse(texto))
    if (!resultado.success) return null
    const nota = resultado.data
    if (!nota.resumenEjecutivo.trim() && !Object.values(nota.secciones).some(s => s.trim())) return null
    return nota
  } catch {
    // El texto del paciente y la respuesta del modelo nunca son un mensaje de log.
    return null
  }
}
