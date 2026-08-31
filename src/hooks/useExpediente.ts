'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { listarNotasCompat } from '@/lib/expediente/firestore'
import type { NotaMedica } from '@/types/expediente'

/**
 * EL HISTORIAL DE UN PACIENTE — Y SI VINO ENTERO (REG-350).
 *
 * Este hook pedía `getNotas`, que se bajaba TODAS las notas del paciente. Desde
 * REG-350 esa lectura tiene techo, así que el hook llama a `listarNotasCompat` y
 * **saca el recorte a la superficie**: quien pinta un expediente tiene que poder
 * decir que está viendo una parte.
 *
 * No es una preferencia de estilo. De estas notas cuelgan los problemas activos,
 * la medicación vigente y el resumen del paciente. Un historial recortado en
 * silencio no da una lista incompleta: da una **conclusión clínica equivocada**,
 * y del lado en que un médico no la cuestiona («no tiene ese antecedente»).
 * Regla 4 de seguridad clínica.
 */
export function useExpediente(patientId: string | null) {
  const { clinicId } = useClinic()
  const [notas, setNotas] = useState<NotaMedica[]>([])
  const [loading, setLoading] = useState(true)
  /** true = hay notas de este paciente que NO están en `notas`. */
  const [truncada, setTruncada] = useState(false)
  const [techo, setTecho] = useState(0)

  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!clinicId || !patientId) { setNotas([]); setTruncada(false); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const lista = await listarNotasCompat(clinicId, patientId)
      setNotas(lista.notas)
      setTruncada(lista.truncada)
      setTecho(lista.techo)
    } catch (e) {
      console.error('[useExpediente] error cargando notas:', e)
      setError('No se pudieron cargar las notas')
      setNotas([])
      /**
       * Un fallo de carga NO es un historial recortado: son dos cosas distintas
       * y el médico tiene que poder distinguirlas. `error` ya lo dice; marcar
       * `truncada` aquí mezclaría «faltan notas» con «no se pudo preguntar».
       */
      setTruncada(false)
    } finally {
      setLoading(false)
    }
  }, [clinicId, patientId])

  useEffect(() => { reload() }, [reload])

  return { notas, loading, error, reload, truncada, techo }
}
