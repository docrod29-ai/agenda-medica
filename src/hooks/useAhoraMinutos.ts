'use client'
/**
 * EL RELOJ DEL CONSULTORIO — uno solo, para todas las vistas de la agenda.
 *
 * `/citas` ya llevaba este reloj escrito a mano desde v9xx y el calendario no
 * llevaba ninguno: la rejilla semanal no dibujaba la hora actual en absoluto.
 * Dos vistas de la MISMA agenda, y sólo una sabía qué hora era.
 *
 * Se saca aquí en vez de copiarlo por segunda vez. Una copia más y las dos
 * vistas acabarían refrescando a ritmos distintos, que es exactamente cómo
 * empiezan los relojes que se contradicen.
 *
 * DOS CAUTELAS, las dos aprendidas en este repositorio:
 *
 *  · Nace `null`. Si devolviera la hora en el primer render, el HTML del
 *    servidor y el del cliente diferirían y React rehidrataría mal — la
 *    familia V10-HARNESS-OBS-001. Quien lo usa dibuja el marcador sólo cuando
 *    deja de ser `null`.
 *  · La hora es la del CONSULTORIO (`ahoraMinutosDelDia`), no la del proceso.
 *    En Vercel el proceso corre en UTC y a partir de las 18:00 en México ya
 *    está en el día siguiente.
 *
 * Devuelve los minutos transcurridos del día local, o `null` antes de montar.
 */
import { useEffect, useState } from 'react'
import { ahoraMinutosDelDia } from '@/lib/timezone'

export function useAhoraMinutos(): number | null {
  const [min, setMin] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setMin(ahoraMinutosDelDia())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
  return min
}

/** `HH:MM` a partir de los minutos del día. `null` entra, `null` sale. */
export function comoHHMM(min: number | null): string | null {
  if (min === null) return null
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
