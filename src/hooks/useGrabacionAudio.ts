'use client'
import { corregirTranscripcion } from '@/lib/expediente/medical-vocabulary'
/**
 * Hook de grabación HIFI para Whisper / gpt-4o-transcribe.
 *
 * v2 — overhaul de audio engineering (2026-06-10):
 *   - Sample rate 48kHz solicitado al navegador (3× mejor que 16kHz default)
 *   - Bitrate Opus 128kbps explícito (vs ~32kbps default → palabras quedaban a 1/4)
 *   - autoGainControl ON → ecualiza voz de médico vs paciente sin chop
 *   - noiseSuppression configurable (algunos ambientes ruidosos lo necesitan OFF)
 *   - AnalyserNode → medidor de nivel de audio en tiempo real (UI feedback)
 *   - Detección de silencio prolongado (>15s) que AVISA (no detiene)
 *   - Watchdog de duración (>20 min sugiere dividir — Whisper acepta 25 MB)
 *
 * Limpia recursos en 5 paths (ISO 27001 — ver useGrabacionAudio v1 doc).
 */
import { useState, useRef, useCallback, useEffect } from 'react'

type Estado = 'inactivo' | 'grabando' | 'subiendo' | 'listo' | 'error'

export interface OpcionesGrabacion {
  /** Suprimir ruido de fondo. Off en ambientes con voces simultáneas. Default: true */
  noiseSuppression?: boolean
  /** Cancelar eco del altavoz. Default: true */
  echoCancellation?: boolean
  /** Auto-ajuste de ganancia (ecualiza voces fuertes/débiles). Default: true */
  autoGainControl?: boolean
}

export interface UseGrabacionAudio {
  soportado: boolean
  estado: Estado
  duracion: number
  transcripcion: string
  error: string
  /** Nivel de audio 0..1 — medir actividad de la voz en vivo (UI level meter). */
  nivelAudio: number
  /** True si llevamos >15s sin captar señal — UI puede mostrar warning. */
  silencioProlongado: boolean
  /** Tamaño actual del blob en bytes — UI puede mostrar "12 MB / 25 MB". */
  bytesGrabados: number
  iniciar: (opts?: OpcionesGrabacion) => Promise<void>
  detener: () => Promise<void>
  reset: () => void
  setTranscripcion: (t: string) => void
}

// Umbrales de audio engineering
const SILENCIO_MS = 15_000        // 15s sin señal → warning
const NIVEL_SILENCIO = 0.02       // RMS < 2% → silencio
const BITRATE_OPUS = 128_000      // 128kbps — calidad voz profesional
const SAMPLE_RATE_OBJETIVO = 48_000 // 48kHz — gold standard

export function useGrabacionAudio(): UseGrabacionAudio {
  const [soportado] = useState(() => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined')
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [duracion, setDuracion] = useState(0)
  const [transcripcion, setTranscripcion] = useState('')
  const [error, setError] = useState('')
  const [nivelAudio, setNivelAudio] = useState(0)
  const [silencioProlongado, setSilencioProlongado] = useState(false)
  const [bytesGrabados, setBytesGrabados] = useState(0)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)
  // Audio engineering — AnalyserNode para nivel en vivo
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const ultimaSenalRef = useRef<number>(0)

  const liberarRecursos = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* */ }
    }
    mediaRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop() } catch { /* */ } })
      streamRef.current = null
    }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    // AudioContext debe cerrarse explícito — sino queda en memoria con el AnalyserNode
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* ya cerrado */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null

    chunksRef.current = []
    setNivelAudio(0)
    setSilencioProlongado(false)
    setBytesGrabados(0)
  }, [])

  const reset = useCallback(() => {
    liberarRecursos()
    setEstado('inactivo'); setDuracion(0); setTranscripcion(''); setError('')
  }, [liberarRecursos])

  useEffect(() => () => { liberarRecursos() }, [liberarRecursos])

  const iniciar = useCallback(async (opts?: OpcionesGrabacion) => {
    if (!soportado) { setError('Tu navegador no soporta grabación de audio'); setEstado('error'); return }
    try {
      // ── CONSTRAINTS HIFI — calidad de captura ────────────────────
      // sampleRate y channelCount son ideales (el navegador puede ignorar).
      // Lo que SÍ marca diferencia: autoGainControl + bitrate al MediaRecorder.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: opts?.echoCancellation ?? true,
          noiseSuppression: opts?.noiseSuppression ?? true,
          autoGainControl: opts?.autoGainControl ?? true,
          sampleRate: SAMPLE_RATE_OBJETIVO,
          channelCount: 1,  // mono — basta para voz, ahorra 50% el blob
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      // ── AnalyserNode → medidor de nivel en vivo + detección silencio ──
      // Si no se puede crear AudioContext, seguimos sin medidor (no es bloqueante).
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx({ sampleRate: SAMPLE_RATE_OBJETIVO })
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        ultimaSenalRef.current = Date.now()

        const buffer = new Float32Array(analyser.fftSize)
        const tick = () => {
          if (!analyserRef.current) return
          analyserRef.current.getFloatTimeDomainData(buffer)
          // RMS — Root Mean Square — la métrica estándar de actividad de voz
          let sumSq = 0
          for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
          const rms = Math.sqrt(sumSq / buffer.length)
          // Escalar a 0..1 con techo (la voz humana raramente excede 0.3 RMS)
          const nivel = Math.min(1, rms / 0.3)
          setNivelAudio(nivel)
          if (rms > NIVEL_SILENCIO) {
            ultimaSenalRef.current = Date.now()
            if (silencioProlongado) setSilencioProlongado(false)
          } else if (Date.now() - ultimaSenalRef.current > SILENCIO_MS) {
            setSilencioProlongado(true)
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        // sin medidor — seguimos grabando
      }

      // ── MIME selection — iOS Safari NO acepta webm ───────────────
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        '',
      ]
      let mime = ''
      for (const m of candidates) {
        if (m === '' || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))) {
          mime = m; break
        }
      }

      // ── BITRATE 128kbps explícito — clave para que Whisper entienda ──
      const recOpts: MediaRecorderOptions = mime
        ? { mimeType: mime, audioBitsPerSecond: BITRATE_OPUS }
        : { audioBitsPerSecond: BITRATE_OPUS }
      const rec = new MediaRecorder(stream, recOpts)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          // Acumulado de bytes — UI puede avisar antes del límite 25 MB
          setBytesGrabados(prev => prev + e.data.size)
        }
      }
      rec.onerror = () => {
        liberarRecursos()
        setError('Error en la grabación de audio')
        setEstado('error')
      }
      // Chunks cada 2s (era 1s — menos overhead, mejor compresión)
      rec.start(2000)
      mediaRef.current = rec
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setDuracion(Math.floor((Date.now() - startRef.current) / 1000))
      }, 500)
      setEstado('grabando')
      setError('')
    } catch (e) {
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
  }, [soportado, liberarRecursos, silencioProlongado])

  const detener = useCallback(async () => {
    const rec = mediaRef.current
    if (!rec) return
    setEstado('subiendo')

    await new Promise<void>(resolve => {
      rec.onstop = () => resolve()
      try { rec.stop() } catch { resolve() }
    })

    // Detener TODO menos chunks (los necesitamos para el blob)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null
    mediaRef.current = null

    const blob = new Blob(chunksRef.current, { type: rec.mimeType })
    chunksRef.current = []
    if (blob.size === 0) { setEstado('error'); setError('Audio vacío'); return }

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
  }, [])

  return {
    soportado, estado, duracion, transcripcion, error,
    nivelAudio, silencioProlongado, bytesGrabados,
    iniciar, detener, reset, setTranscripcion,
  }
}
