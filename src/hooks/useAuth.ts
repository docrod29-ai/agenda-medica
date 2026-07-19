'use client'
import { useState, useEffect } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { permitirBorradores } from '@/lib/mobile/local-drafts'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Red de seguridad: si Firebase no resuelve el estado (red lenta), libera el
    // spinner a los 8s para que la pantalla de login aparezca igual.
    const timeout = setTimeout(() => setLoading(false), 8000)
    const unsub = onAuthStateChanged(auth, (u) => {
      // Sesión viva otra vez → se reabre la escritura de borradores locales, que
      // el cierre de sesión había cerrado con pestillo para no resucitar PHI.
      if (u) permitirBorradores()
      setUser(u)
      setLoading(false)
      clearTimeout(timeout)
    })
    return () => { clearTimeout(timeout); unsub() }
  }, [])

  return { user, loading }
}
