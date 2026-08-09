'use client'
/**
 * ESCUCHAR EL MOMENTO — REG-250.
 *
 * ── QUÉ ES ──────────────────────────────────────────────────────────────────
 *
 * El botón que cierra la cadena que pidió el médico: frase de la nota → trozo
 * del dictado → **segundo exacto del audio**. Es lo que Abridge llama *Linked
 * Evidence*, y lo que Nabla estructuralmente no puede tener porque borra el
 * audio original (AP, oct-2024).
 *
 * ── POR QUÉ LA URL SE PIDE AL PULSAR Y NO ANTES ─────────────────────────────
 *
 * En el expediente se guarda la RUTA del audio, nunca la URL — una URL de
 * Firebase Storage lleva un token de acceso dentro (REG-249).
 *
 * La URL se pide en el momento de reproducir, y eso no es sólo higiene: es
 * cuando las reglas de Storage se evalúan **otra vez**, con quien esté mirando
 * en ese momento. Si el permiso cambió, deja de sonar — que es lo correcto.
 *
 * Se pide UNA vez por sesión y se reutiliza: pedirla en cada clic sería una
 * llamada de red entre pulsar y oír.
 *
 * ── POR QUÉ UN SOLO `<audio>` Y NO UNO POR FRASE ────────────────────────────
 *
 * Una nota tiene decenas de frases. Decenas de elementos `<audio>` apuntando al
 * mismo archivo son decenas de descargas del mismo audio, y la posibilidad de
 * que dos suenen a la vez. Hay uno solo, y cada botón lo mueve al segundo suyo.
 */
import { useCallback, useEffect, useState } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'
import { comoReloj } from '@/lib/expediente/cuando-se-dijo'

export interface EscucharElMomentoProps {
  /** Ruta en Storage. Sin ella no hay botón. */
  audioPath?: string | null
  /** Milisegundo al que saltar. */
  inicioMs: number
  /** Resuelve la ruta a una URL reproducible. Se inyecta para poder probarlo. */
  resolverUrl: (path: string) => Promise<string>
  /** Etiqueta accesible con el contexto de la frase. */
  etiqueta?: string
}

/** Un único elemento de audio para toda la página. */
let compartido: HTMLAudioElement | null = null
let urlCargada: string | null = null

export function EscucharElMomento(p: EscucharElMomentoProps) {
  const [estado, setEstado] = useState<'listo' | 'cargando' | 'sonando' | 'error'>('listo')

  /* Al desmontar se para: dejar sonando el audio de un paciente después de
     cerrar su nota es exactamente lo que no puede pasar. */
  useEffect(() => () => { compartido?.pause() }, [])

  const alPulsar = useCallback(async () => {
    if (!p.audioPath) return
    if (estado === 'sonando') { compartido?.pause(); setEstado('listo'); return }
    setEstado('cargando')
    try {
      if (!compartido) compartido = new Audio()
      if (urlCargada !== p.audioPath) {
        compartido.src = await p.resolverUrl(p.audioPath)
        urlCargada = p.audioPath
      }
      compartido.currentTime = Math.max(0, p.inicioMs / 1000)
      compartido.onended = () => setEstado('listo')
      compartido.onpause = () => setEstado(e => (e === 'sonando' ? 'listo' : e))
      await compartido.play()
      setEstado('sonando')
    } catch {
      /* Sin audio no se inventa nada: se dice que no se puede reproducir. */
      urlCargada = null
      setEstado('error')
    }
  }, [p, estado])

  /* Sin ruta guardada no hay nada que oír, y un botón apagado sin explicación
     es peor que ningún botón. */
  if (!p.audioPath) return null

  return (
    <button
      onClick={alPulsar}
      disabled={estado === 'cargando'}
      aria-label={`Escuchar ${p.etiqueta ? `«${p.etiqueta}» ` : ''}en el minuto ${comoReloj(p.inicioMs)}`}
      title={estado === 'error' ? 'No se pudo abrir el audio de esta consulta' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', marginTop: 6, borderRadius: 'var(--r-pill)',
        background: 'var(--s3)', color: estado === 'error' ? 'var(--text3)' : 'var(--text)',
        border: '1px solid var(--border)', font: 'inherit', fontSize: 12,
        cursor: estado === 'cargando' ? 'wait' : 'pointer',
      }}
    >
      {estado === 'cargando'
        ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
        : estado === 'sonando' ? <Pause size={12} /> : <Play size={12} />}
      {estado === 'error' ? 'No se pudo abrir' : comoReloj(p.inicioMs)}
    </button>
  )
}

export const POR_QUE_LA_URL_AL_PULSAR =
  'La URL se pide al reproducir porque ahí es cuando las reglas de Storage se ' +
  'evalúan otra vez, con quien esté mirando. Si el permiso cambió, deja de ' +
  'sonar — que es lo correcto.'

export const POR_QUE_UN_SOLO_AUDIO =
  'Una nota tiene decenas de frases. Decenas de elementos <audio> al mismo ' +
  'archivo son decenas de descargas y la posibilidad de que dos suenen a la vez.'

export const POR_QUE_SE_PARA_AL_SALIR =
  'Dejar sonando el audio de un paciente después de cerrar su nota es ' +
  'exactamente lo que no puede pasar.'
