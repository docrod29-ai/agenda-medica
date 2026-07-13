/**
 * Memoria del médico — el Consultor de IA "aprende" de cada médico con el tiempo
 * (como la memoria de ChatGPT/Claude) para personalizar sus respuestas.
 *
 * Guarda SOLO preferencias/práctica del MÉDICO (especialidad, fármacos que
 * prefiere, población de pacientes, estilo de respuesta). NUNCA datos de
 * pacientes. Vive server-side en clinics/{clinicId}/memoria_medico/{uid};
 * las rules la niegan a clientes por defecto (solo Admin SDK).
 */
import { adminDb } from '@/lib/firebase-admin'

export interface MemoriaMedico {
  especialidad?: string
  instrucciones?: string   // instrucciones que el médico fija a mano (UI futura)
  notas: string[]          // hechos durables aprendidos, tope ~40
  actualizado?: string
}

const TOPE_NOTAS = 40

function ref(clinicId: string, uid: string) {
  return adminDb.collection('clinics').doc(clinicId).collection('memoria_medico').doc(uid)
}

/** Lee la memoria del médico (o null si no existe / falla). Nunca lanza. */
export async function leerMemoriaMedico(clinicId: string | null, uid: string): Promise<MemoriaMedico | null> {
  if (!clinicId || !uid) return null
  try {
    const snap = await ref(clinicId, uid).get()
    if (!snap.exists) return null
    const d = snap.data() || {}
    return {
      especialidad: typeof d.especialidad === 'string' ? d.especialidad : undefined,
      instrucciones: typeof d.instrucciones === 'string' ? d.instrucciones : undefined,
      notas: Array.isArray(d.notas) ? d.notas.filter((n: unknown) => typeof n === 'string') : [],
      actualizado: d.actualizado,
    }
  } catch { return null }
}

/** Arma el bloque de texto que se inyecta al prompt del Consultor. '' si no hay nada. */
export function textoMemoria(m: MemoriaMedico | null): string {
  if (!m) return ''
  const partes: string[] = []
  if (m.especialidad) partes.push(`Especialidad: ${m.especialidad}`)
  if (m.instrucciones) partes.push(`Instrucciones fijas del médico: ${m.instrucciones}`)
  if (m.notas?.length) partes.push('Lo aprendido de este médico:\n- ' + m.notas.slice(-25).join('\n- '))
  return partes.join('\n')
}

/** Agrega hechos aprendidos (deduplicados, con tope). Nunca lanza ni bloquea. */
export async function aprenderDeMedico(clinicId: string | null, uid: string, nuevos: string[]): Promise<void> {
  if (!clinicId || !uid || !nuevos?.length) return
  try {
    const actual = await leerMemoriaMedico(clinicId, uid)
    const vistos = new Set((actual?.notas ?? []).map(s => s.toLowerCase().trim()))
    const limpios = nuevos
      .map(s => String(s).trim())
      .filter(s => s.length > 3 && s.length < 200 && !vistos.has(s.toLowerCase()))
    if (!limpios.length) return
    const notas = [...(actual?.notas ?? []), ...limpios].slice(-TOPE_NOTAS)
    await ref(clinicId, uid).set({ notas, actualizado: new Date().toISOString() }, { merge: true })
  } catch { /* no-bloqueante: la memoria es un extra, nunca rompe la respuesta */ }
}
