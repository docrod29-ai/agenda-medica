'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { getNotas } from '@/lib/expediente/firestore'
import type { NotaMedica } from '@/types/expediente'

export function useExpediente(patientId: string | null) {
  const { clinicId } = useClinic()
  const [notas, setNotas] = useState<NotaMedica[]>([])
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!clinicId || !patientId) { setNotas([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      setNotas(await getNotas(clinicId, patientId))
    } catch (e) {
      console.error('[useExpediente] error cargando notas:', e)
      setError('No se pudieron cargar las notas')
      setNotas([])
    } finally {
      setLoading(false)
    }
  }, [clinicId, patientId])

  useEffect(() => { reload() }, [reload])

  return { notas, loading, error, reload }
}
