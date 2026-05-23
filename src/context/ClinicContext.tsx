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
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
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
    const memberRef = doc(db, 'clinic_members', user.uid)
    const unsub = onSnapshot(memberRef, async (snap) => {
      if (!snap.exists()) {
        // No clinic yet — needs setup
        setClinicId(null)
        setClinic(null)
        setRole(null)
        setNeedsSetup(true)
        setLoading(false)
        return
      }

      const member = snap.data() as ClinicMember
      setRole(member.role)
      setClinicId(member.clinicId)
      setNeedsSetup(false)

      // Load clinic metadata
      const clinicSnap = await getDoc(doc(db, 'clinics', member.clinicId))
      if (clinicSnap.exists()) {
        setClinic({ id: clinicSnap.id, ...clinicSnap.data() } as Clinic)
      }
      setLoading(false)
    })

    return () => unsub()
  }, [user, authLoading])

  return (
    <Ctx.Provider value={{ clinicId, clinic, role, loading, needsSetup }}>
      {children}
    </Ctx.Provider>
  )
}

export const useClinic = () => useContext(Ctx)
