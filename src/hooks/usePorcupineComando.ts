/**
 * usePorcupineComando — comandos de voz 100% EN EL DISPOSITIVO.
 *
 * Usa Picovoice Porcupine (WebAssembly): el reconocimiento de "iniciar consulta" /
 * "cerrar consulta" corre dentro del navegador, el audio NUNCA sale del equipo.
 * Import dinámico (solo cliente) y todo protegido con try/catch: si algo falla, el
 * hook simplemente no arranca y la consulta puede caer al modo Web Speech.
 *
 * Requiere (paso externo del médico, una sola vez):
 *  - accessKey de Picovoice (cuenta gratis)
 *  - dos archivos .ppn entrenados: "iniciar consulta" y "cerrar consulta"
 *  - el modelo de español porcupine_params_es.pv (lo aloja la app en /porcupine)
 */

import { useEffect, useRef, useState } from 'react'
import type { ComandoVoz } from '@/lib/voz/comandos'

export interface PicovoiceConfig {
  accessKey: string
  /** URL/publicPath del .ppn de "iniciar consulta". */
  keywordIniciarUrl: string
  /** URL/publicPath del .ppn de "cerrar consulta". */
  keywordCerrarUrl: string
  /** URL/publicPath del modelo de español. Default /porcupine/porcupine_params_es.pv */
  modeloEsUrl?: string
  /** Sensibilidad 0..1 (mayor = más detecciones, más falsos). Default 0.6 */
  sensibilidad?: number
}

interface Opciones {
  activo: boolean
  config: PicovoiceConfig | null
  onIniciar: () => void
  onCerrar: () => void
}

interface Estado {
  disponible: boolean   // hay config para intentar el modo on-device
  cargando: boolean
  escuchando: boolean
  ultimo: ComandoVoz
  error: string | null
}

const MODELO_ES_DEFAULT = '/porcupine/porcupine_params_es.pv'

export function usePorcupineComando({ activo, config, onIniciar, onCerrar }: Opciones): Estado {
  const [cargando, setCargando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [ultimo, setUltimo] = useState<ComandoVoz>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Los callbacks se refrescan DESPUÉS del render, no durante.
   *
   * Estaban como `useRef(cb); ref.current = cb` en el cuerpo del componente, o
   * sea escribiendo un ref MIENTRAS se renderiza. React lo prohíbe: con render
   * concurrente el trabajo puede empezarse y tirarse, y el ref se queda con el
   * valor de un render que nunca llegó a pantalla. Aquí eso sería el
   * reconocedor de voz llamando al callback de una consulta anterior.
   *
   * En un efecto se asigna tras confirmar el render, que es cuando ya se sabe
   * cuál es el bueno. El reconocedor NO se re-suscribe: sigue leyendo
   * `ref.current`, que era el motivo de usar refs.
   */
  const cbIniciar = useRef(onIniciar)
  const cbCerrar = useRef(onCerrar)
  useEffect(() => {
    cbIniciar.current = onIniciar
    cbCerrar.current = onCerrar
  })

  const disponible = !!(config?.accessKey && config?.keywordIniciarUrl && config?.keywordCerrarUrl)

  useEffect(() => {
    if (!activo || !config || !disponible) return
    let worker: { release: () => void } | null = null
    let wvp: { unsubscribe: (w: unknown) => Promise<void> } | null = null
    let cancelado = false

    ;(async () => {
      setCargando(true); setError(null)
      try {
        const [{ PorcupineWorker }, { WebVoiceProcessor }] = await Promise.all([
          import('@picovoice/porcupine-web'),
          import('@picovoice/web-voice-processor'),
        ])
        wvp = WebVoiceProcessor as unknown as { unsubscribe: (w: unknown) => Promise<void> }

        const w = await PorcupineWorker.create(
          config.accessKey,
          [
            { label: 'iniciar', publicPath: config.keywordIniciarUrl, sensitivity: config.sensibilidad ?? 0.6 },
            { label: 'cerrar', publicPath: config.keywordCerrarUrl, sensitivity: config.sensibilidad ?? 0.6 },
          ],
          (deteccion: { label: string }) => {
            if (cancelado) return
            if (deteccion.label === 'iniciar') { setUltimo('iniciar'); cbIniciar.current() }
            else if (deteccion.label === 'cerrar') { setUltimo('cerrar'); cbCerrar.current() }
          },
          { publicPath: config.modeloEsUrl || MODELO_ES_DEFAULT },
        )
        if (cancelado) { w.release(); return }
        worker = w as unknown as { release: () => void }
        await (WebVoiceProcessor as unknown as { subscribe: (w: unknown) => Promise<void> }).subscribe(w)
        setEscuchando(true)
      } catch (e) {
        setError('No se pudo iniciar el reconocimiento en el dispositivo. Revisa la clave y los archivos de palabra clave.')
        console.warn('[porcupine] fallo al iniciar (cae a modo estándar):', String(e))
      } finally {
        setCargando(false)
      }
    })()

    return () => {
      cancelado = true
      setEscuchando(false)
      ;(async () => {
        try { if (worker && wvp) await wvp.unsubscribe(worker) } catch { /* noop */ }
        try { worker?.release() } catch { /* noop */ }
      })()
    }
  }, [activo, disponible, config])

  return { disponible, cargando, escuchando, ultimo, error }
}
