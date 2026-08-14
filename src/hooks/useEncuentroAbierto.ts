'use client'
/**
 * EL ENCUENTRO ABIERTO, PARA LA NAVEGACIÓN — RTC-08.
 *
 * Envoltorio de `@/lib/nav/encuentro-abierto` para el shell. Tres decisiones
 * que valen más que el código:
 *
 * 1. **Se lee después de montar, nunca en el render del servidor.** El dato
 *    vive en `localStorage`: leerlo durante el render daría una hidratación
 *    distinta del HTML servido y React lo cazaría (o peor, no lo cazaría y el
 *    riel parpadearía). Mientras no ha leído devuelve `null`, que es la misma
 *    respuesta que «no hay ninguno» — y el riel ya sabe comportarse con eso.
 *
 * 2. **Se relee al cambiar de ruta.** El médico abre una consulta, escribe, y
 *    sale a Hoy: el respaldo se acaba de crear y el riel tiene que enterarse
 *    sin recargar. `pathname` como dependencia basta y es barato (una vuelta
 *    por las claves de localStorage, sin red).
 *
 * 3. **Se relee al volver a la pestaña.** Si la consulta se firmó en otra
 *    pestaña, su respaldo desapareció; volver aquí y seguir viendo «retomar»
 *    sería prometer una nota que ya no existe.
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { encuentroAbierto, type EncuentroAbierto } from '@/lib/nav/encuentro-abierto'

export function useEncuentroAbierto(): EncuentroAbierto | null {
  const pathname = usePathname()
  const { user } = useAuth()
  const [abierto, setAbierto] = useState<EncuentroAbierto | null>(null)

  useEffect(() => {
    const releer = () => setAbierto(encuentroAbierto(user?.uid))
    releer()
    const alVolver = () => { if (document.visibilityState === 'visible') releer() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [pathname, user?.uid])

  return abierto
}
