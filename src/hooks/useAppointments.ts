'use client'
import { useState, useEffect } from 'react'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Appointment } from '@/types'
import { useClinic } from '@/context/ClinicContext'

export function useAppointments() {
  const { clinicId } = useClinic()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) { setLoading(false); return }

    const q = query(collection(db, 'clinics', clinicId, 'appointments'))
    const unsub = onSnapshot(q,
      (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        setLoading(false)
      },
      (err) => { setError(err.message); setLoading(false) }
    )
    return () => unsub()
  }, [clinicId])

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
