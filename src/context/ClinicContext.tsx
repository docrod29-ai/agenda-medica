'use client'
/**
 * ClinicContext
 *
 * Provides clinicId + clinic metadata to all components.
 * After Firebase Auth resolves, looks up clinic_members/{uid}
 * to find which clinic this user belongs to.
 *
 * If no membership found → user needs onboarding (/setup)
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Clinic, ClinicMember } from '@/types'

interface ClinicCtx {
  clinicId: string | null
  clinic: Clinic | null
  role: ClinicMember['role'] | null
  loading: boolean
  /** true = user is authenticated but has no clinic → show /setup */
  needsSetup: boolean
}

const Ctx = createContext<ClinicCtx>({
  clinicId: null,
  clinic: null,
  role: null,
  loading: true,
  needsSetup: false,
})

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [role, setRole] = useState<ClinicMember['role'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setClinicId(null)
      setClinic(null)
      setRole(null)
      setLoading(false)
      setNeedsSetup(false)
      return
    }

    // Load clinic membership for this user
    let unsubClinic: (() => void) | null = null
    let resuelto = false
    const marcarListo = () => { resuelto = true; setLoading(false) }
    // RED DE SEGURIDAD: si Firestore no responde (red/permiso/token), NUNCA dejes la
    // app colgada en el spinner. A los 8s se libera (verás login/setup, no eterno).
    const timeout = setTimeout(() => { if (!resuelto) setLoading(false) }, 8000)

    const memberRef = doc(db, 'clinic_members', user.uid)
    const unsub = onSnapshot(memberRef, (snap) => {
      // Limpiar el listener de la clínica anterior (cambio de membresía)
      if (unsubClinic) { unsubClinic(); unsubClinic = null }

      if (!snap.exists()) {
        // No clinic yet — needs setup
        setClinicId(null)
        setClinic(null)
        setRole(null)
        setNeedsSetup(true)
        marcarListo()
        return
      }

      const member = snap.data() as ClinicMember
      setRole(member.role)
      setClinicId(member.clinicId)
      setNeedsSetup(false)

      // Clínica EN VIVO: si Stripe activa la suscripción (webhook), el plan/estado
      // se refleja al instante → el gate de pago se desbloquea solo, sin recargar.
      unsubClinic = onSnapshot(doc(db, 'clinics', member.clinicId), (clinicSnap) => {
        if (clinicSnap.exists()) {
          setClinic({ id: clinicSnap.id, ...clinicSnap.data() } as Clinic)
        }
        marcarListo()
      }, () => marcarListo())   // error leyendo la clínica → no colgar
    }, () => marcarListo())     // error leyendo la membresía → no colgar

    return () => { clearTimeout(timeout); if (unsubClinic) unsubClinic(); unsub() }
  }, [user, authLoading])

  return (
    <Ctx.Provider value={{ clinicId, clinic, role, loading, needsSetup }}>
      {children}
    </Ctx.Provider>
  )
}

export const useClinic = () => useContext(Ctx)
