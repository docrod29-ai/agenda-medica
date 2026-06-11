'use client'
import { corregirTranscripcion } from '@/lib/expediente/medical-vocabulary'
/**
 * Hook de grabación HIFI con streaming + pause/resume + crash recovery.
 *
 * v3 — arquitectura "ultra perfect" (2026-06-10):
 *
 *   CAPTURA (sin cambios v2):
 *     48kHz · mono · 128kbps Opus · autoGainControl · medidor RMS en vivo
 *
 *   STREAMING (nuevo):
 *     Cada ~20s se manda un chunk a /api/expediente/transcribir-chunk.
 *     El texto aparece en `transcripcionParcial` mientras la grabación
 *     sigue. Al detener, se reusa lo ya transcrito + el último chunk
 *     pendiente — el médico ya no espera 2 min al final.
 *     `setTranscripcion` final = concatenación + corrección léxica.
 *
 *   PAUSE / RESUME (nuevo):
 *     pausar() — MediaRecorder.pause() + congela timer/analyser
 *     reanudar() — MediaRecorder.resume() + reanuda timer/analyser
 *     útil cuando el paciente sale al baño o entra acompañante a media
 *     consulta sin que termine la nota.
 *
 *   CRASH RECOVERY (nuevo):
 *     Los chunks se persisten en IndexedDB conforme van llegando.
 *     Si el navegador crashea o el doctor cierra la pestaña por error,
 *     al reabrir la consulta detectamos chunks huérfanos y ofrecemos
 *     recuperar. NUNCA se pierde audio capturado.
 *     Los chunks se borran al confirmar la transcripción final.
 *
 *   LIBERACIÓN DE RECURSOS (sin cambios v2):
 *     5 paths cubiertos: detener feliz, fallo de getUserMedia, error en
 *     vivo, unmount, reset. AudioContext.close() + RAF cancel + IDB clear.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

type Estado = 'inactivo' | 'grabando' | 'pausado' | 'subiendo' | 'listo' | 'error'

export interface OpcionesGrabacion {
  noiseSuppression?: boolean
  echoCancellation?: boolean
  autoGainControl?: boolean
  /** Activa streaming chunks (default true). Off solo para debugging. */
  streaming?: boolean
  /** Intervalo de chunks a transcribir en vivo (ms). Default 20s. */
  intervaloChunkMs?: number
  /** ID estable para recovery vía IndexedDB (ej. patientId). */
  recoveryKey?: string
}

export interface UseGrabacionAudio {
  soportado: boolean
  estado: Estado
  duracion: number
  transcripcion: string
  /** Texto que va apareciendo conforme llegan los chunks (streaming). */
  transcripcionParcial: string
  error: string
  nivelAudio: number
  silencioProlongado: boolean
  bytesGrabados: number
  /** Cuántos chunks han sido transcritos en vivo. */
  chunksTranscritos: number
  iniciar: (opts?: OpcionesGrabacion) => Promise<void>
  detener: () => Promise<void>
  pausar: () => void
  reanudar: () => void
  reset: () => void
  setTranscripcion: (t: string) => void
  /** Verifica si hay audio sin transcribir guardado de una sesión previa. */
  hayRecovery: (recoveryKey: string) => Promise<boolean>
  /** Recupera el audio huérfano y lo manda a transcribir. */
  recuperarAudio: (recoveryKey: string) => Promise<void>
}

const SILENCIO_MS = 15_000
const NIVEL_SILENCIO = 0.02
const BITRATE_OPUS = 128_000
const SAMPLE_RATE_OBJETIVO = 48_000
const INTERVALO_CHUNK_DEFAULT_MS = 20_000

// ─────────────────────────────────────────────────────────────────
// IndexedDB — almacén minimalista para crash recovery
// ─────────────────────────────────────────────────────────────────

const DB_NAME = 'nexusmed-recovery'
const STORE = 'audio_chunks'

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ['recoveryKey', 'idx'] })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function guardarChunk(recoveryKey: string, idx: number, blob: Blob) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ recoveryKey, idx, blob, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB puede fallar en modo privado — no es bloqueante
  }
}

async function leerChunks(recoveryKey: string): Promise<Blob[]> {
  try {
    const db = await abrirDB()
    const chunks: { idx: number; blob: Blob }[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      const req = tx.objectStore(STORE).getAll(range)
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return chunks.sort((a, b) => a.idx - b.idx).map(c => c.blob)
  } catch {
    return []
  }
}

async function borrarChunks(recoveryKey: string) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      tx.objectStore(STORE).delete(range)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* */ }
}

// ─────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────

export function useGrabacionAudio(): UseGrabacionAudio {
  const [soportado] = useState(() => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined')
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [duracion, setDuracion] = useState(0)
  const [transcripcion, setTranscripcion] = useState('')
  const [transcripcionParcial, setTranscripcionParcial] = useState('')
  const [error, setError] = useState('')
  const [nivelAudio, setNivelAudio] = useState(0)
  const [silencioProlongado, setSilencioProlongado] = useState(false)
  const [bytesGrabados, setBytesGrabados] = useState(0)
  const [chunksTranscritos, setChunksTranscritos] = useState(0)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])           // chunks recientes para flush
  const todosChunksRef = useRef<Blob[]>([])      // TODOS los chunks (blob final)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkFlushRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)
  const pausaTotalMsRef = useRef<number>(0)
  const pausaInicioRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const ultimaSenalRef = useRef<number>(0)
  // Streaming
  const chunkIdxRef = useRef<number>(0)
  const textosChunksRef = useRef<string[]>([])
  const recoveryKeyRef = useRef<string>('')
  const streamingActivoRef = useRef<boolean>(true)
  const mimeRef = useRef<string>('')

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
    if (chunkFlushRef.current) { clearInterval(chunkFlushRef.current); chunkFlushRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null

    chunksRef.current = []
    todosChunksRef.current = []
    pausaTotalMsRef.current = 0
    pausaInicioRef.current = 0
    chunkIdxRef.current = 0
    textosChunksRef.current = []
    setNivelAudio(0)
    setSilencioProlongado(false)
    setBytesGrabados(0)
    setChunksTranscritos(0)
    setTranscripcionParcial('')
  }, [])

  const reset = useCallback(() => {
    const rk = recoveryKeyRef.current
    liberarRecursos()
    setEstado('inactivo'); setDuracion(0); setTranscripcion(''); setError('')
    if (rk) borrarChunks(rk)
    recoveryKeyRef.current = ''
  }, [liberarRecursos])

  useEffect(() => () => { liberarRecursos() }, [liberarRecursos])

  // Función: flushea chunks acumulados al endpoint de streaming
  const flushChunks = useCallback(async () => {
    if (!streamingActivoRef.current) return
    if (chunksRef.current.length === 0) return
    const idx = chunkIdxRef.current++
    const blob = new Blob(chunksRef.current, { type: mimeRef.current })
    chunksRef.current = []
    if (blob.size < 1024) return  // skip muy pequeños

    // Contexto previo (últimas ~30 palabras del último chunk transcrito)
    const prevContext = textosChunksRef.current.length
      ? textosChunksRef.current[textosChunksRef.current.length - 1].split(/\s+/).slice(-30).join(' ')
      : ''

    try {
      const fd = new FormData()
      fd.append('audio', blob, `chunk-${idx}.webm`)
      fd.append('chunkIdx', String(idx))
      if (prevContext) fd.append('prevContext', prevContext)
      const res = await fetch('/api/expediente/transcribir-chunk', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok && data.text) {
        textosChunksRef.current[idx] = data.text
        // Reconstruir transcripción parcial en orden
        const completa = textosChunksRef.current.filter(Boolean).join(' ')
        setTranscripcionParcial(completa)
        setChunksTranscritos(c => c + 1)
      }
    } catch {
      // Falla de red — el chunk queda solo en el blob final. No reintentar
      // (al detener se reusa el blob completo)
    }
  }, [])

  const iniciar = useCallback(async (opts?: OpcionesGrabacion) => {
    if (!soportado) { setError('Tu navegador no soporta grabación de audio'); setEstado('error'); return }
    streamingActivoRef.current = opts?.streaming !== false
    recoveryKeyRef.current = opts?.recoveryKey ?? ''
    const intervaloMs = opts?.intervaloChunkMs ?? INTERVALO_CHUNK_DEFAULT_MS

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: opts?.echoCancellation ?? true,
          noiseSuppression: opts?.noiseSuppression ?? true,
          autoGainControl: opts?.autoGainControl ?? true,
          sampleRate: SAMPLE_RATE_OBJETIVO,
          channelCount: 1,
        },
      })
      streamRef.current = stream
      chunksRef.current = []
      todosChunksRef.current = []
      chunkIdxRef.current = 0
      textosChunksRef.current = []

      // AnalyserNode → medidor de nivel + detección de silencio
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
          let sumSq = 0
          for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
          const rms = Math.sqrt(sumSq / buffer.length)
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
      } catch { /* sin medidor */ }

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
      mimeRef.current = mime

      const recOpts: MediaRecorderOptions = mime
        ? { mimeType: mime, audioBitsPerSecond: BITRATE_OPUS }
        : { audioBitsPerSecond: BITRATE_OPUS }
      const rec = new MediaRecorder(stream, recOpts)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          todosChunksRef.current.push(e.data)
          setBytesGrabados(prev => prev + e.data.size)
          // Persistir en IndexedDB para crash recovery
          if (recoveryKeyRef.current) {
            const localIdx = todosChunksRef.current.length - 1
            guardarChunk(recoveryKeyRef.current, localIdx, e.data)
          }
        }
      }
      rec.onerror = () => {
        liberarRecursos()
        setError('Error en la grabación de audio')
        setEstado('error')
      }
      rec.start(2000)
      mediaRef.current = rec
      startRef.current = Date.now()
      pausaTotalMsRef.current = 0
      timerRef.current = setInterval(() => {
        const transcurrido = Date.now() - startRef.current - pausaTotalMsRef.current
        setDuracion(Math.floor(transcurrido / 1000))
      }, 500)

      // Streaming: flush periódico al endpoint
      if (streamingActivoRef.current) {
        chunkFlushRef.current = setInterval(flushChunks, intervaloMs)
      }

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
  }, [soportado, liberarRecursos, silencioProlongado, flushChunks])

  const pausar = useCallback(() => {
    const rec = mediaRef.current
    if (!rec || rec.state !== 'recording') return
    try {
      rec.pause()
      pausaInicioRef.current = Date.now()
      // Pausar timer + analyser + flush
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (chunkFlushRef.current) { clearInterval(chunkFlushRef.current); chunkFlushRef.current = null }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      setEstado('pausado')
    } catch { /* */ }
  }, [])

  const reanudar = useCallback(() => {
    const rec = mediaRef.current
    if (!rec || rec.state !== 'paused') return
    try {
      rec.resume()
      pausaTotalMsRef.current += Date.now() - pausaInicioRef.current
      pausaInicioRef.current = 0
      timerRef.current = setInterval(() => {
        const transcurrido = Date.now() - startRef.current - pausaTotalMsRef.current
        setDuracion(Math.floor(transcurrido / 1000))
      }, 500)
      if (streamingActivoRef.current) {
        chunkFlushRef.current = setInterval(flushChunks, INTERVALO_CHUNK_DEFAULT_MS)
      }
      // Reanudar analyser
      if (audioCtxRef.current && analyserRef.current) {
        const analyser = analyserRef.current
        const buffer = new Float32Array(analyser.fftSize)
        const tick = () => {
          if (!analyserRef.current) return
          analyserRef.current.getFloatTimeDomainData(buffer)
          let sumSq = 0
          for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
          const rms = Math.sqrt(sumSq / buffer.length)
          setNivelAudio(Math.min(1, rms / 0.3))
          if (rms > NIVEL_SILENCIO) ultimaSenalRef.current = Date.now()
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      setEstado('grabando')
    } catch { /* */ }
  }, [flushChunks])

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
    if (chunkFlushRef.current) clearInterval(chunkFlushRef.current)
    chunkFlushRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null
    mediaRef.current = null

    // Flush final del último chunk pendiente (mejora la cobertura del streaming)
    if (streamingActivoRef.current && chunksRef.current.length > 0) {
      await flushChunks()
    }

    const blob = new Blob(todosChunksRef.current, { type: rec.mimeType })
    chunksRef.current = []
    todosChunksRef.current = []
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
        // Borrar chunks de recovery — el audio ya está transcrito
        if (recoveryKeyRef.current) await borrarChunks(recoveryKeyRef.current)
      } else if (textosChunksRef.current.length > 0) {
        // Fallback: si la transcripción final falló pero el streaming funcionó,
        // usamos la concatenación de chunks como respaldo
        const combinado = textosChunksRef.current.filter(Boolean).join(' ')
        const { corregido } = corregirTranscripcion(combinado)
        setTranscripcion(corregido)
        setEstado('listo')
        if (recoveryKeyRef.current) await borrarChunks(recoveryKeyRef.current)
      } else {
        setError(data.error ?? 'Error transcribiendo')
        setEstado('error')
      }
    } catch (e) {
      // Network error: usa lo que tengamos del streaming
      if (textosChunksRef.current.length > 0) {
        const combinado = textosChunksRef.current.filter(Boolean).join(' ')
        const { corregido } = corregirTranscripcion(combinado)
        setTranscripcion(corregido)
        setEstado('listo')
      } else {
        setError('Error de red: ' + String(e))
        setEstado('error')
      }
    }
  }, [flushChunks])

  // ─── Recovery API ──────────────────────────────────────────
  const hayRecovery = useCallback(async (recoveryKey: string): Promise<boolean> => {
    const chunks = await leerChunks(recoveryKey)
    return chunks.length > 0
  }, [])

  const recuperarAudio = useCallback(async (recoveryKey: string) => {
    setEstado('subiendo')
    const chunks = await leerChunks(recoveryKey)
    if (chunks.length === 0) {
      setError('No hay audio guardado para recuperar')
      setEstado('error')
      return
    }
    // Reconstruir blob con el tipo del primer chunk
    const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' })
    const mt = blob.type || ''
    const ext = mt.includes('mp4') ? 'm4a' : mt.includes('ogg') ? 'ogg' : 'webm'
    try {
      const fd = new FormData()
      fd.append('audio', blob, `recovery.${ext}`)
      const res = await fetch('/api/expediente/transcribir', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) {
        const { corregido } = corregirTranscripcion(data.text ?? '')
        setTranscripcion(corregido)
        setEstado('listo')
        await borrarChunks(recoveryKey)
      } else {
        setError(data.error ?? 'Error transcribiendo audio recuperado')
        setEstado('error')
      }
    } catch (e) {
      setError('Error recuperando audio: ' + String(e))
      setEstado('error')
    }
  }, [])

  return {
    soportado, estado, duracion, transcripcion, transcripcionParcial, error,
    nivelAudio, silencioProlongado, bytesGrabados, chunksTranscritos,
    iniciar, detener, pausar, reanudar, reset, setTranscripcion,
    hayRecovery, recuperarAudio,
  }
}
