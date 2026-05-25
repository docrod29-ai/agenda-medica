'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Grabación de voz con Web Speech API (sin costo, en el navegador).
 * Configurado para español de México (es-MX), reconocimiento continuo.
 * Acumula TODA la transcripción de la consulta (no divide por silencios).
 *
 * Soporte: Chrome, Edge, Safari (webkit). Firefox no soporta SpeechRecognition.
 */

// Tipos mínimos del API (no están en lib.dom por defecto)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: {
    length: number
    item: (i: number) => { 0: { transcript: string }; isFinal: boolean }
    [i: number]: { 0: { transcript: string }; isFinal: boolean }
  }
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: Event) => void) | null
  onend: (() => void) | null
}

type SRConstructor = new () => SpeechRecognitionInstance

function getSR(): SRConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface UseGrabacionVoz {
  soportado: boolean
  grabando: boolean
  transcripcion: string
  interim: string
  duracion: number          // segundos
  iniciar: () => void
  detener: () => void
  reiniciar: () => void
  setTranscripcion: (t: string) => void
}

export function useGrabacionVoz(): UseGrabacionVoz {
  const [soportado] = useState(() => getSR() !== null)
  const [grabando, setGrabando] = useState(false)
  const [transcripcion, setTranscripcion] = useState('')
  const [interim, setInterim] = useState('')
  const [duracion, setDuracion] = useState(0)

  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deseaGrabar = useRef(false)

  const iniciar = useCallback(() => {
    const SR = getSR()
    if (!SR) return

    const rec = new SR()
    rec.lang = 'es-MX'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimTxt = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const txt = r[0].transcript
        if (r.isFinal) {
          finalRef.current += txt + ' '
        } else {
          interimTxt += txt
        }
      }
      setTranscripcion(finalRef.current)
      setInterim(interimTxt)
    }

    rec.onerror = () => { /* errores transitorios — el onend reintenta */ }

    rec.onend = () => {
      // El reconocimiento se corta solo cada cierto tiempo; reiniciar si seguimos grabando
      if (deseaGrabar.current) {
        try { rec.start() } catch { /* ya iniciado */ }
      }
    }

    recRef.current = rec
    deseaGrabar.current = true
    try { rec.start() } catch { /* ignore */ }

    setGrabando(true)
    setDuracion(0)
    timerRef.current = setInterval(() => setDuracion(d => d + 1), 1000)
  }, [])

  const detener = useCallback(() => {
    deseaGrabar.current = false
    recRef.current?.stop()
    setGrabando(false)
    setInterim('')
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const reiniciar = useCallback(() => {
    deseaGrabar.current = false
    recRef.current?.abort()
    finalRef.current = ''
    setTranscripcion('')
    setInterim('')
    setDuracion(0)
    setGrabando(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  // Permite edición manual de la transcripción
  const setTransc = useCallback((t: string) => {
    finalRef.current = t.endsWith(' ') ? t : t + ' '
    setTranscripcion(t)
  }, [])

  useEffect(() => () => {
    deseaGrabar.current = false
    recRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  return {
    soportado, grabando, transcripcion, interim, duracion,
    iniciar, detener, reiniciar, setTranscripcion: setTransc,
  }
}
