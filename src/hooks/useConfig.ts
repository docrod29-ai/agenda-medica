'use client'
import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ClinicConfig, DEFAULT_CONFIG } from '@/types'
import { useClinic } from '@/context/ClinicContext'

export function useConfig() {
  const { clinicId } = useClinic()
  const [config, setConfig] = useState<ClinicConfig>({ ...DEFAULT_CONFIG })
  const [loading, setLoading] = useState(true)
  /**
   * Por qué esto tiene que salir del hook y no quedarse en un console.error:
   *
   * cuando la lectura falla, `config` se queda en DEFAULT_CONFIG y la pantalla no
   * distingue "config cargada" de "no se pudo leer". En una pantalla cualquiera
   * eso es cosmético; en las de IMPRESIÓN es grave: la receta salía sin hoja
   * membretada, sin firma ni sello y sin cédula profesional — un documento
   * inválido para NOM-004 — y el médico se lo entregaba al paciente sin que nada
   * le avisara de que algo había fallado.
   */
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) { setLoading(false); return }
    setError(null)

    const unsub = onSnapshot(
      doc(db, 'clinics', clinicId, 'config', 'main'),
      (snap) => {
        if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as ClinicConfig)
        setError(null)
        setLoading(false)
      },
      // Sin este callback, un fallo de reglas/red/token dejaba loading=true para
      // siempre → spinner eterno. Se libera, pero AVISANDO.
      (err) => { console.error('useConfig onSnapshot:', err); setError(err.code || 'error'); setLoading(false) },
    )
    return () => unsub()
  }, [clinicId])

  return { config, loading, error }
}
