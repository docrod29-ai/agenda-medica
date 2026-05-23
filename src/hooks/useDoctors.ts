'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Doctor } from '@/types'

export function useDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'doctors'), orderBy('nombre', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor)))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const activeDoctors = doctors.filter(d => d.activo)

  return { doctors, activeDoctors, loading }
}
