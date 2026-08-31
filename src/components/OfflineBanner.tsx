'use client'
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Franja de «sin conexión».
 *
 * ── LO QUE DECÍA, Y POR QUÉ ERA UNA PROMESA QUE NO SE PUEDE CUMPLIR ─────────
 *
 * Decía: «Los cambios se sincronizarán al reconectar.»
 *
 * Eso es cierto de las escrituras que van por el SDK de Firestore, que tiene
 * persistencia offline. **No es cierto de nada que pase por una ruta de API**
 * —y por ahí pasa el alta de una cita, entre otras cosas: `fetchAutenticado` lo
 * usan 53 archivos—. Esas peticiones no se encolan: fallan y se pierden.
 *
 * Se vio agendando una cita con la red cortada: la franja prometía sincronizar
 * mientras la petición moría. La asistente que lee eso cierra el portátil
 * tranquila y la cita no existe.
 *
 * Es la regla 3 de `clinical-safety` —nada cambia en silencio— con el signo al
 * revés: aquí se anunciaba un cambio que no iba a ocurrir. Y la regla 4:
 * ausencia de confirmación no es confirmación.
 *
 * ── Y POR QUÉ NO SE PASA AL EXTREMO CONTRARIO ───────────────────────────────
 *
 * La primera corrección decía «lo que guardes ahora puede no registrarse», a
 * secas. Midiendo salió que eso también es impreciso, y en la dirección que
 * hace daño: **las escrituras del SDK sí se guardan.** Comprobado en el
 * navegador — el registro de un cobro, sin red, vuelve en 1,5 s y queda
 * encolado, mientras el alta de una cita (que va por una ruta de API) se
 * pierde. La asimetría no es entre acciones: es entre **leer** —que sin red se
 * queda esperando al servidor— y **escribir por el SDK** —que resuelve en local.
 *
 * Decirle a la asistente que su cobro «puede no registrarse» cuando sí se
 * registra la empuja a repetirlo. Ese es el otro daño, el simétrico.
 *
 * Una franja global no sabe qué va a hacer quien la lee, así que dice lo único
 * cierto de las dos familias a la vez: que ALGUNAS acciones no se guardarán. Ni
 * promete una cola que no cubre todo, ni niega la que sí existe.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null
  return (
    /* `role="status"`: aparece en caliente al perder la red, así que además de
       sacar la franja de la violación `region` de axe (contenido fuera de todo
       landmark — V15-A11Y-001, 1ª rebanada), el lector de pantalla anuncia el
       cambio de conectividad sin robar el foco. */
    <div className="offline-banner" role="status">
      <WifiOff size={14} aria-hidden="true" /> Sin conexión — puedes seguir consultando. Algunas acciones no se guardarán hasta recuperar la señal.
    </div>
  )
}
