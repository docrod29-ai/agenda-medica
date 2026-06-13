'use client'
/**
 * /expedientes — UNIFICADO con /pacientes.
 *
 * Antes había DOS entradas en el menú (Pacientes y Expedientes) para la misma
 * persona, lo que confundía. Ahora hay una sola entrada "Pacientes"; el médico
 * abre el expediente clínico de cada paciente desde ahí. Esta ruta solo
 * redirige por si quedó algún enlace o marcador viejo.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ExpedientesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/pacientes') }, [router])
  return null
}
