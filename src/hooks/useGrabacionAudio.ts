'use client'
/**
 * Hook de grabación de audio cruda (MediaRecorder) para enviar a Whisper.
 *
 * Complementa a useGrabacionVoz (Web Speech). Si el médico activa "modo Whisper",
 * usamos este hook: graba el audio completo, al detener lo manda a /api/expediente/transcribir.
 * Si OPENAI_API_KEY no está configurada, el hook avisa y se cae graciosamente.
 */
import { useState, useRef, useCallback } from 'react'

type Estado = 'inactivo' | 'grabando' | 'subiendo' | 'listo' | 'error'

export interface UseGrabacionAudio {
  soportado: boolean
  estado: Estado
  duracion: number
  transcripcion: string
  error: string
  iniciar: () => Promise<void>
  detener: () => Promise<void>
  reset: () => void
  setTranscripcion: (t: string) => void
}

export function useGrabacionAudio(): UseGrabacionAudio {
  const [soportado] = useState(() => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined')
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [duracion, setDuracion] = useState(0)
  const [transcripcion, setTranscripcion] = useState('')
  const [error, setError] = useState('')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  const reset = useCallback(() => {
    setEstado('inactivo'); setDuracion(0); setTranscripcion(''); setError('')
    chunksRef.current = []
  }, [])

  const iniciar = useCallback(async () => {
    if (!soportado) { setError('Tu navegador no soporta grabación de audio'); setEstado('error'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      })
      streamRef.current = stream
      chunksRef.current = []
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.start(1000)
      mediaRef.current = rec
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setDuracion(Math.floor((Date.now() - startRef.current) / 1000))
      }, 500)
      setEstado('grabando')
      setError('')
    } catch (e) {
      setError('No se pudo acceder al micrófono: ' + String(e))
      setEstado('error')
    }
  }, [soportado])

  const detener = useCallback(async () => {
    const rec = mediaRef.current
    if (!rec) return
    setEstado('subiendo')

    await new Promise<void>(resolve => {
      rec.onstop = () => resolve()
      try { rec.stop() } catch { resolve() }
    })

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null

    const blob = new Blob(chunksRef.current, { type: rec.mimeType })
    if (blob.size === 0) { setEstado('error'); setError('Audio vacío'); return }

    try {
      const fd = new FormData()
      fd.append('audio', blob, 'consulta.webm')
      const res = await fetch('/api/expediente/transcribir', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) {
        setTranscripcion(data.text ?? '')
        setEstado('listo')
      } else {
        setError(data.error ?? 'Error transcribiendo')
        setEstado('error')
      }
    } catch (e) {
      setError('Error de red: ' + String(e))
      setEstado('error')
    }
  }, [])

  return {
    soportado,
    estado,
    duracion,
    transcripcion,
    error,
    iniciar,
    detener,
    reset,
    setTranscripcion,
  }
}
