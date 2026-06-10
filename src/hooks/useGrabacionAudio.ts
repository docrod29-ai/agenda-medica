'use client'
import { corregirTranscripcion } from '@/lib/expediente/medical-vocabulary'
/**
 * Hook de grabación de audio cruda (MediaRecorder) para enviar a Whisper.
 *
 * Complementa a useGrabacionVoz (Web Speech). Si el médico activa "modo Whisper",
 * usamos este hook: graba el audio completo, al detener lo manda a /api/expediente/transcribir.
 * Si OPENAI_API_KEY no está configurada, el hook avisa y se cae graciosamente.
 *
 * ─────────────────────────────────────────────────────────────────────
 * AUDITORÍA ISO 27001 — Manejo seguro de recursos sensibles:
 *
 * Recursos críticos que DEBEN liberarse SIEMPRE:
 *   1. MediaStream del micrófono (sino el LED rojo del mic queda activo)
 *   2. MediaRecorder activo
 *   3. setInterval del timer
 *   4. Blobs de audio en memoria (chunksRef)
 *
 * Cleanup completo en 5 escenarios:
 *   a) Usuario detiene (camino feliz) → detener()
 *   b) iniciar() falla después de getUserMedia → catch limpia stream
 *   c) MediaRecorder error en tiempo real → onerror limpia
 *   d) Usuario navega/desmonta mientras graba → useEffect cleanup
 *   e) Usuario llama reset() con grabación activa → reset detiene todo
 *
 * NO almacenamos el audio crudo más allá del envío a Whisper.
 * NO loggeamos el contenido del audio en consola.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useState, useRef, useCallback, useEffect } from 'react'

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

  /** Libera TODOS los recursos: stream, recorder, timer, blobs. Idempotente. */
  const liberarRecursos = useCallback(() => {
    // 1. Detener MediaRecorder si está activo
    const rec = mediaRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* ya detenido */ }
    }
    mediaRef.current = null

    // 2. Detener TODOS los tracks del stream (libera el micrófono físico)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop() } catch { /* ya detenido */ }
      })
      streamRef.current = null
    }

    // 3. Limpiar timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // 4. Liberar referencias a blobs (GC los recoge)
    chunksRef.current = []
  }, [])

  const reset = useCallback(() => {
    liberarRecursos()
    setEstado('inactivo'); setDuracion(0); setTranscripcion(''); setError('')
  }, [liberarRecursos])

  // Cleanup al desmontar: detiene grabación + libera mic si el usuario
  // navega/cierra la consulta sin haber detenido. Sin esto el LED rojo
  // del micrófono queda activo hasta cerrar el navegador.
  useEffect(() => {
    return () => { liberarRecursos() }
  }, [liberarRecursos])

  const iniciar = useCallback(async () => {
    if (!soportado) { setError('Tu navegador no soporta grabación de audio'); setEstado('error'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      chunksRef.current = []

      // iOS Safari NO soporta webm. Probar varios mime types en orden de preferencia.
      const candidates = [
        'audio/webm;codecs=opus',  // Chrome/Edge/Firefox desktop
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2', // iOS Safari moderno
        'audio/mp4',
        'audio/ogg;codecs=opus',
        '',                         // último recurso: dejar al navegador elegir
      ]
      let mime = ''
      for (const m of candidates) {
        if (m === '' || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))) {
          mime = m
          break
        }
      }
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      // Cleanup automático si el navegador aborta la grabación (mic desconectado,
      // permisos revocados en vivo, etc.). Sin esto el stream queda zombi.
      rec.onerror = () => {
        liberarRecursos()
        setError('Error en la grabación de audio')
        setEstado('error')
      }
      rec.start(1000)
      mediaRef.current = rec
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setDuracion(Math.floor((Date.now() - startRef.current) / 1000))
      }, 500)
      setEstado('grabando')
      setError('')
    } catch (e) {
      // CRÍTICO: si getUserMedia tuvo éxito pero MediaRecorder revienta,
      // el stream queda vivo (micrófono activo) si no liberamos. Hacerlo
      // aquí garantiza que TODOS los paths de error liberen recursos.
      liberarRecursos()
      const err = e as Error
      if (err.name === 'NotAllowedError' || err.message.includes('denied')) {
        setError('Permiso de micrófono denegado. Permítelo en los ajustes del navegador.')
      } else if (err.name === 'NotFoundError') {
        setError('No se detectó micrófono en este dispositivo.')
      } else {
        setError('No se pudo iniciar la grabación: ' + err.message)
      }
      setEstado('error')
    }
  }, [soportado, liberarRecursos])

  const detener = useCallback(async () => {
    const rec = mediaRef.current
    if (!rec) return
    setEstado('subiendo')

    await new Promise<void>(resolve => {
      rec.onstop = () => resolve()
      try { rec.stop() } catch { resolve() }
    })

    // Libera mic + timer + recorder; conserva chunks para construir el blob
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    mediaRef.current = null

    const blob = new Blob(chunksRef.current, { type: rec.mimeType })
    // Los chunks ya no se necesitan tras construir el blob — liberar memoria
    chunksRef.current = []
    if (blob.size === 0) { setEstado('error'); setError('Audio vacío'); return }

    // Whisper acepta mp3/mp4/m4a/wav/webm — extensión correcta según mime
    const mt = rec.mimeType || ''
    const ext = mt.includes('mp4') ? 'm4a' : mt.includes('ogg') ? 'ogg' : mt.includes('wav') ? 'wav' : 'webm'

    try {
      const fd = new FormData()
      fd.append('audio', blob, `consulta.${ext}`)
      const res = await fetch('/api/expediente/transcribir', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) {
        const { corregido } = corregirTranscripcion(data.text ?? '')
        setTranscripcion(corregido)
        setEstado('listo')
      } else {
        setError(data.error ?? 'Error transcribiendo')
        setEstado('error')
      }
    } catch (e) {
      setError('Error de red: ' + String(e))
      setEstado('error')
    }
    // El blob queda fuera de scope y el GC lo recoge; no se persiste en memoria.
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
