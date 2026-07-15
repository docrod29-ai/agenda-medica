/**
 * useComandoVoz — escucha manos libres de comandos de voz para la consulta.
 *
 * Cuando está `activo`, escucha el micrófono con la Web Speech API buscando
 * "iniciar consulta" / "cerrar consulta" y llama a los callbacks. Se reinicia
 * solo (Chrome corta la sesión periódicamente) y evita disparar el mismo comando
 * dos veces seguidas.
 *
 * Privacidad: la Web Speech API de Chrome procesa el audio en los servidores del
 * navegador mientras escucha. Por eso es OPT-IN, solo corre en la pantalla de
 * consulta cuando el médico lo activa, y con aviso visible. (Un motor de palabra
 * clave 100% en el dispositivo —tipo Picovoice— es la mejora natural siguiente.)
 */

import { useEffect, useRef, useState } from 'react'
import { detectarComando, type ComandoVoz } from '@/lib/voz/comandos'

interface Opciones {
  activo: boolean
  onIniciar: () => void
  onCerrar: () => void
  /** ms para ignorar un comando repetido. Default 4000. */
  antirreboteMs?: number
}

interface Estado {
  soportado: boolean
  escuchando: boolean
  ultimo: ComandoVoz
  error: string | null
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
}

function crearReconocedor(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const Ctor = (window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor()
}

export function useComandoVoz({ activo, onIniciar, onCerrar, antirreboteMs = 4000 }: Opciones): Estado {
  const [soportado, setSoportado] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [ultimo, setUltimo] = useState<ComandoVoz>(null)
  const [error, setError] = useState<string | null>(null)

  // Callbacks vivos sin re-suscribir el reconocedor en cada render.
  const cbIniciar = useRef(onIniciar); cbIniciar.current = onIniciar
  const cbCerrar = useRef(onCerrar); cbCerrar.current = onCerrar
  const ultimoDisparoRef = useRef<{ cmd: ComandoVoz; t: number }>({ cmd: null, t: 0 })

  useEffect(() => {
    setSoportado(crearReconocedor() !== null)
  }, [])

  useEffect(() => {
    if (!activo) return
    const rec = crearReconocedor()
    if (!rec) { setError('Tu navegador no permite comandos de voz.'); return }

    let cerrado = false
    rec.lang = 'es-MX'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      const res = e.results
      for (let i = 0; i < res.length; i++) {
        const texto = res[i]?.[0]?.transcript ?? ''
        const cmd = detectarComando(texto)
        if (!cmd) continue
        const ahora = Date.now()
        const prev = ultimoDisparoRef.current
        // Antirrebote: no repetir el MISMO comando en la ventana.
        if (prev.cmd === cmd && ahora - prev.t < antirreboteMs) continue
        ultimoDisparoRef.current = { cmd, t: ahora }
        setUltimo(cmd)
        if (cmd === 'iniciar') cbIniciar.current()
        else cbCerrar.current()
      }
    }

    rec.onerror = (ev) => {
      // 'no-speech' y 'aborted' son normales; solo reportamos permisos.
      if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
        setError('Permiso de micrófono denegado para comandos de voz.')
        cerrado = true
      }
    }

    rec.onend = () => {
      setEscuchando(false)
      // Chrome corta solo; reiniciamos mientras siga activo.
      if (!cerrado) {
        try { rec.start(); setEscuchando(true) } catch { /* ya arrancando */ }
      }
    }

    try { rec.start(); setEscuchando(true); setError(null) }
    catch { /* start dobles lanzan; se ignora */ }

    return () => {
      cerrado = true
      setEscuchando(false)
      try { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.abort() } catch { /* noop */ }
    }
  }, [activo, antirreboteMs])

  return { soportado, escuchando, ultimo, error }
}
