'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Doctor } from '@/types'
import { useClinic } from '@/context/ClinicContext'

export function useDoctors() {
  const { clinicId } = useClinic()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) { setLoading(false); return }

    const q = query(collection(db, 'clinics', clinicId, 'doctors'), orderBy('nombre', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor)))
      setLoading(false)
    })
    return () => unsub()
  }, [clinicId])

  const activeDoctors = doctors.filter(d => d.activo)

  return { doctors, activeDoctors, loading }
}
