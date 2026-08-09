'use client'
/**
 * EMPEZAR A GRABAR — la tarjeta que estaba en la maqueta y no se había hecho.
 *
 * ── LO QUE PASÓ, Y ES CULPA MÍA ─────────────────────────────────────────────
 *
 * Se le enseñó al médico una maqueta con dos mitades: arriba, los diez botones
 * de tipo de nota reducidos a **una línea**; abajo, un **botón grande y
 * centrado** para grabar, con una frase debajo y nada más.
 *
 * La mitad de arriba se construyó y se desplegó (`QueNotaEs`). **La de abajo se
 * quedó en dibujo.** Él lo notó mirando su iPhone: «¿y por qué no se ve así? no
 * has desplegado».
 *
 * Tenía razón. Enseñar un diseño y entregar la mitad es peor que no enseñarlo.
 *
 * ── LO QUE HABÍA ANTES DE PODER HABLAR ──────────────────────────────────────
 *
 * Contado sobre su captura, en este orden:
 *
 *   1. «Modo: Conversación completa (médico + paciente) — se graba y separa…»
 *   2. Un botón «Manos libres OFF»
 *   3. El micrófono, a un lado
 *   4. Un título: «Grabar la conversación completa (médico + paciente)»
 *   5. Una descripción: «Capta a los dos · separación de voces con AssemblyAI ·
 *      vocabulario médico ampliado»
 *   6. Un botón «Procesar con IA», apagado
 *
 * Seis cosas para pulsar una. Y tres de ellas dicen lo MISMO —que graba a los
 * dos y separa las voces— con distintas palabras.
 *
 * ── LO QUE QUEDA ────────────────────────────────────────────────────────────
 *
 * El botón, y una línea. La explicación de qué hace vive dentro del propio
 * botón: se lee al mirarlo, no antes de encontrarlo.
 *
 * «Manos libres» y «Procesar con IA» no desaparecen: bajan a donde se necesitan
 * —el primero es una preferencia que se pone una vez, el segundo sólo tiene
 * sentido cuando YA hay algo que procesar—. Nada se pierde; lo que cambia es
 * **cuándo aparece cada cosa**.
 *
 * ── POR QUÉ EL BOTÓN ES TAN GRANDE ──────────────────────────────────────────
 *
 * Porque es lo único que se pulsa con el paciente ya sentado enfrente, muchas
 * veces al día, a veces sin mirar. 96 px no es decoración: es no fallar el toque
 * mientras se saluda a alguien.
 */
import { Mic, Loader2 } from 'lucide-react'

export interface EmpezarAGrabarProps {
  /** `procesando` cubre el rato entre pulsar y que el micrófono esté listo. */
  estado: 'listo' | 'procesando'
  alPulsar: () => void
  /** Se enseña sólo si el aparato no puede grabar. */
  noSoportado?: boolean
}

export function EmpezarAGrabar(p: EmpezarAGrabarProps) {
  if (p.noSoportado) return null

  return (
    <button
      onClick={p.alPulsar}
      disabled={p.estado === 'procesando'}
      aria-label="Grabar la consulta: capta al médico y al paciente y separa las voces"
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, padding: '30px 20px', borderRadius: 16,
        background: 'var(--s2)', border: '1px solid var(--border)',
        cursor: p.estado === 'procesando' ? 'wait' : 'pointer',
        textAlign: 'center',
      }}
    >
      <span
        aria-hidden
        style={{
          /*
            96 px. Es lo único que se pulsa con el paciente enfrente, muchas
            veces al día y a veces sin mirar.

            `--r-pill` y no `--r-circulo`: en un elemento CUADRADO el navegador
            recorta el radio a la mitad del lado, así que 9999px da el mismo
            círculo sin añadir un valor más a la escala visual.
          */
          width: 96, height: 96, borderRadius: 'var(--r-pill)',
          background: 'var(--nexus-solido)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {p.estado === 'procesando'
          ? <Loader2 size={38} style={{ animation: 'spin 1s linear infinite' }} />
          : <Mic size={38} />}
      </span>

      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
        {p.estado === 'procesando' ? 'Preparando el micrófono…' : 'Grabar la consulta'}
      </span>

      {/*
        UNA línea, no tres. Antes esto mismo se decía en el rótulo de modo, en el
        título y en la descripción, con distintas palabras cada vez.
      */}
      <span style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 380 }}>
        Capta a los dos y separa las voces
      </span>
    </button>
  )
}

export const POR_QUE_UN_SOLO_BOTON =
  'Antes había seis cosas antes de poder hablar, y tres decían lo mismo con ' +
  'distintas palabras. Queda el botón y una línea; lo demás no desaparece, ' +
  'aparece cuando se necesita.'

export const POR_QUE_96_PX =
  'Es lo único que se pulsa con el paciente ya sentado enfrente, muchas veces ' +
  'al día y a veces sin mirar. No es decoración: es no fallar el toque.'

export const LO_QUE_PASO =
  'Se enseñó una maqueta de dos mitades y sólo se construyó la de arriba. ' +
  'Enseñar un diseño y entregar la mitad es peor que no enseñarlo.'
