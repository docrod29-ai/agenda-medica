'use client'
import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ClinicConfig, DEFAULT_CONFIG } from '@/types'

export function useConfig() {
  const [config, setConfig] = useState<ClinicConfig>({ ...DEFAULT_CONFIG })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as ClinicConfig)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return { config, loading }
}
