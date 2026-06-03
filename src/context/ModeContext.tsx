'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useClinic } from '@/context/ClinicContext'

type AppMode = 'medico' | 'secretaria'

interface ModeCtx {
  mode: AppMode
  setMode: (m: AppMode) => void
  isDoctor: boolean
  /** True si el usuario está CONFIGURADO como médico/admin (no se puede bypassear desde UI) */
  esMedicoReal: boolean
}

const Ctx = createContext<ModeCtx>({ mode: 'medico', setMode: () => {}, isDoctor: true, esMedicoReal: true })

export function ModeProvider({ children }: { children: ReactNode }) {
  const { role } = useClinic()

  // El rol REAL viene de Firestore (clinic_members/{uid}/role).
  // Si la asistente intenta tocar localStorage, no la creemos: el rol manda.
  const esMedicoReal = role === 'medico' || role === 'admin'

  const [modePersistido, setModePersistido] = useState<AppMode>('medico')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('agenda_mode') as AppMode | null
    if (saved === 'medico' || saved === 'secretaria') setModePersistido(saved)
  }, [])

  // CLAMP de seguridad: si no eres médico real, FORZAMOS modo secretaria
  // sin importar lo que digan ni el localStorage ni el state.
  const mode: AppMode = esMedicoReal ? modePersistido : 'secretaria'

  const setMode = (m: AppMode) => {
    // Si el usuario no es médico real, ignoramos la petición de cambiar a "medico"
    if (m === 'medico' && !esMedicoReal) return
    setModePersistido(m)
    if (typeof window !== 'undefined') localStorage.setItem('agenda_mode', m)
  }

  return (
    <Ctx.Provider value={{ mode, setMode, isDoctor: mode === 'medico', esMedicoReal }}>
      {children}
    </Ctx.Provider>
  )
}

export const useMode = () => useContext(Ctx)
