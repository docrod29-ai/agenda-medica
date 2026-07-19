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
  /**
   * Motivo por el que NO se pudo resolver el consultorio (red caída, permisos,
   * token vencido, o los 8s de espera agotados).
   *
   * Antes los callbacks de error hacían `() => marcarListo()` y tiraban el error
   * a la basura, así que "falló Firestore" y "este usuario no tiene consultorio"
   * terminaban en el MISMO estado (clinicId=null, needsSetup=false). El layout
   * hacía `return null` y el médico veía una pantalla en blanco sin spinner, sin
   * error y sin forma de salir salvo recargar — y al recargar, lo mismo.
   */
  error: string | null
}

const Ctx = createContext<ClinicCtx>({
  clinicId: null,
  clinic: null,
  role: null,
  loading: true,
  needsSetup: false,
  error: null,
})

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [role, setRole] = useState<ClinicMember['role'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setClinicId(null)
      setClinic(null)
      setRole(null)
      setLoading(false)
      setNeedsSetup(false)
      setError(null)
      return
    }
    setError(null)

    // Load clinic membership for this user
    let unsubClinic: (() => void) | null = null
    let resuelto = false
    const marcarListo = () => { resuelto = true; setLoading(false) }
    // RED DE SEGURIDAD: si Firestore no responde (red/permiso/token), NUNCA dejes la
    // app colgada en el spinner. A los 8s se libera (verás login/setup, no eterno).
    const timeout = setTimeout(() => {
      if (resuelto) return
      setError('Tu consultorio tardó demasiado en responder. Puede ser la conexión.')
      setLoading(false)
    }, 8000)

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
      }, (err) => { setError(`No pudimos leer los datos de tu consultorio (${err.code}).`); marcarListo() })
    }, (err) => { setError(`No pudimos verificar a qué consultorio perteneces (${err.code}).`); marcarListo() })

    return () => { clearTimeout(timeout); if (unsubClinic) unsubClinic(); unsub() }
  }, [user, authLoading])

  return (
    <Ctx.Provider value={{ clinicId, clinic, role, loading, needsSetup, error }}>
      {children}
    </Ctx.Provider>
  )
}

export const useClinic = () => useContext(Ctx)
