'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Appointment } from '@/types'

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'appointments'))
    const unsub = onSnapshot(q,
      (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        setLoading(false)
      },
      (err) => { setError(err.message); setLoading(false) }
    )
    return () => unsub()
  }, [])

  return { appointments, loading, error }
}

export function usePatientAppointments(patientId: string) {
  const { appointments, loading, error } = useAppointments()
  return {
    appointments: appointments.filter(a => a.pacienteId === patientId),
    loading,
    error,
  }
}
