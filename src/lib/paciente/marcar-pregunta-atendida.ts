'use client'
/**
 * Avisar al servidor de que la pregunta del paciente ya fue atendida — REG-516.
 *
 * Lo llama `/pendientes` al cerrar una tarea `pregunta_paciente`. Es la mitad
 * del navegador de lo que la ruta `expediente/pregunta-atendida` hace del otro
 * lado: sin esto el portal del paciente dice «pendiente de revisar» para
 * siempre, aunque el médico ya la haya contestado.
 *
 * NO lanza: devuelve `ok:false` con un motivo legible. La tarea ya se cerró
 * cuando esto corre, y un fallo aquí no puede deshacer ese cierre ni pasar
 * inadvertido — la pantalla lo enseña.
 */
import { fetchAutenticado } from '@/lib/auth-client'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'

export const RUTA_PREGUNTA_ATENDIDA = '/api/expediente/pregunta-atendida'

export const MENSAJE_NO_MARCADA =
  'La tarea se cerró, pero el portal del paciente seguirá diciendo «pendiente de revisar». Reintenta desde los cerrados recientes.'

/** ¿Cerrar ESTA tarea tiene que marcar una pregunta? Sólo las que nacieron de una. */
export function tareaConPregunta(t: Pick<TareaClinica, 'tipo' | 'preguntaId'>): t is Pick<TareaClinica, 'tipo' | 'preguntaId'> & { preguntaId: string } {
  return t.tipo === 'pregunta_paciente' && typeof t.preguntaId === 'string' && t.preguntaId.length > 0
}

export async function marcarPreguntaAtendida(
  clinicId: string, patientId: string, preguntaId: string,
): Promise<{ ok: true; yaEstaba: boolean } | { ok: false; motivo: string }> {
  try {
    const res = await fetchAutenticado(RUTA_PREGUNTA_ATENDIDA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, patientId, preguntaId }),
    })
    const d = await res.json().catch(() => null) as { ok?: boolean; yaEstaba?: boolean } | null
    if (res.ok && d?.ok) return { ok: true, yaEstaba: Boolean(d.yaEstaba) }
    return { ok: false, motivo: MENSAJE_NO_MARCADA }
  } catch {
    return { ok: false, motivo: MENSAJE_NO_MARCADA }
  }
}
