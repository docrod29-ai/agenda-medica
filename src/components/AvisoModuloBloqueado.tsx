'use client'
/**
 * «Tu plan no incluye esa pantalla», dicho en voz alta.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El guard de módulos hacía `router.replace('/dashboard')` y nada más. Sin
 * toast, sin modal, sin una palabra.
 *
 * Con el plan Agenda —que es el PRIMERO que se ofrece, el más barato— eso
 * significaba: pulsar «Consulta» en el menú (la entrada existe, porque
 * `/pacientes` es ruta core), ver la lista de pacientes, hacer clic en uno… y la
 * pantalla parpadea de vuelta al inicio. Repetir. Volver a rebotar.
 *
 * Un médico nuevo no lee eso como «mi plan no incluye expediente». Lo lee como
 * una aplicación rota, y cierra la pestaña.
 *
 * ── POR QUÉ UN EVENTO Y NO ESTADO ────────────────────────────────────────────
 *
 * El aviso tiene que sobrevivir al `router.replace` que ocurre en el mismo
 * suspiro, y quien lo pinta —el sistema de avisos— se monta por debajo del
 * componente que detecta el bloqueo. Un evento de ventana cruza esa frontera sin
 * subir estado ni mover el proveedor de sitio.
 */
import { useEffect } from 'react'
import { useToast } from '@/context/ToastContext'

export const EVENTO_MODULO_BLOQUEADO = 'nexus:modulo-bloqueado'

export function AvisoModuloBloqueado() {
  const { toast } = useToast()

  useEffect(() => {
    const alBloquear = (ev: Event) => {
      const modulo = String((ev as CustomEvent<{ modulo?: string }>).detail?.modulo ?? '').trim()
      toast(
        modulo
          ? `Tu plan no incluye ${modulo}. Puedes ampliarlo desde Configuración.`
          : 'Esa pantalla no está incluida en tu plan. Puedes ampliarlo desde Configuración.',
        'info',
      )
    }
    window.addEventListener(EVENTO_MODULO_BLOQUEADO, alBloquear)
    return () => window.removeEventListener(EVENTO_MODULO_BLOQUEADO, alBloquear)
  }, [toast])

  return null
}
