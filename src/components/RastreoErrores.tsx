'use client'
import { useEffect } from 'react'
import { iniciarRastreoErrores } from '@/lib/reportar-error'

/** Monta el rastreo global de errores del cliente (una vez). Renderiza nada. */
export function RastreoErrores() {
  useEffect(() => { iniciarRastreoErrores() }, [])
  return null
}
