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

  useEffect(() => {
    if (!clinicId) { setLoading(false); return }

    const unsub = onSnapshot(doc(db, 'clinics', clinicId, 'config', 'main'), (snap) => {
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as ClinicConfig)
      setLoading(false)
    })
    return () => unsub()
  }, [clinicId])

  return { config, loading }
}
