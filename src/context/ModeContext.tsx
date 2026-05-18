'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type AppMode = 'medico' | 'secretaria'

interface ModeCtx {
  mode: AppMode
  setMode: (m: AppMode) => void
  isDoctor: boolean
}

const Ctx = createContext<ModeCtx>({ mode: 'medico', setMode: () => {}, isDoctor: true })

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('medico')

  useEffect(() => {
    const saved = localStorage.getItem('agenda_mode') as AppMode | null
    if (saved === 'medico' || saved === 'secretaria') setModeState(saved)
  }, [])

  const setMode = (m: AppMode) => {
    setModeState(m)
    localStorage.setItem('agenda_mode', m)
  }

  return (
    <Ctx.Provider value={{ mode, setMode, isDoctor: mode === 'medico' }}>
      {children}
    </Ctx.Provider>
  )
}

export const useMode = () => useContext(Ctx)
