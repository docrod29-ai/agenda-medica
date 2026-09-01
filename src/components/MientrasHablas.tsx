'use client'
/**
 * MIENTRAS HABLAS — la barra que no se va de la pantalla.
 *
 * ── LAS DOS COSAS QUE EL MÉDICO PIDIÓ, CON SUS PALABRAS ─────────────────────
 *
 * 1. «el micrófono es en el celular, EN LA COMPUTADORA» — a la mano en los dos,
 *    no en uno.
 * 2. «así como cuando te dictan a ti, que se vaya escribiendo».
 *
 * ── POR QUÉ ESTO Y NO UN BOTÓN MÁS BONITO ──────────────────────────────────
 *
 * Grabar una consulta dura veinte minutos, y en ese rato el médico se desplaza
 * por la nota, abre herramientas, mira los antecedentes. El micrófono quedaba
 * arriba del todo: para pausar había que buscarlo.
 *
 * Y sobre todo: **no había forma de saber si te estaba oyendo**. Un micrófono
 * encendido que no da señal es indistinguible de uno apagado — hasta que
 * terminas la consulta y no hay nada.
 *
 * ── LO QUE SE ENSEÑA, Y POR QUÉ CADA COSA ──────────────────────────────────
 *
 * · **El nivel de voz**, moviéndose. Es la única prueba en vivo de que el
 *   micrófono capta. Un contador de tiempo sigue corriendo aunque el
 *   micrófono esté silenciado; una barra que se mueve, no.
 * · **El tiempo**, para saber cuánto llevas.
 * · **Las últimas palabras que oyó.** Esto es lo que el médico pidió: ver que
 *   se va escribiendo, como cuando le dictas a alguien y ves su mano moverse.
 *   No es adorno — es la señal de que el reconocedor entiende, y deja corregir
 *   la pronunciación en el momento en vez de descubrirlo al final.
 * · **Qué sección se acaba de llenar.** La nota se arma sola cada 15 segundos y
 *   eso era invisible. Verlo convierte una espera en un progreso.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────
 *
 * No tapa la nota. En el teléfono se pega abajo, donde llega el pulgar; en la
 * computadora se queda pegada arriba al desplazarse. En los dos casos ocupa una
 * franja, no una pantalla.
 */
import { Mic, Pause, Play, Square, Loader2 } from 'lucide-react'
import { PALABRA, reloj } from '@/lib/encuentro/vocabulario-de-la-escucha'

export type EstadoDeLaBarra = 'listo' | 'grabando' | 'pausado' | 'procesando'

export interface MientrasHablasProps {
  estado: EstadoDeLaBarra
  /** Segundos grabados. */
  duracion: number
  /** 0 a 1. La prueba en vivo de que el micrófono capta. */
  nivelAudio: number
  /** Lo último que se oyó, aunque todavía no esté confirmado. */
  ultimasPalabras?: string
  /** La sección que la IA acaba de rellenar, si alguna. */
  seccionRecienEscrita?: string
  /** La nota se está armando ahora mismo. */
  escribiendo?: boolean

  alGrabar: () => void
  alPausar: () => void
  alReanudar: () => void
  alDetener: () => void
}

/** El botón principal. 64 px: el pulgar no falla y el ratón tampoco. */
function botonPrincipal(p: MientrasHablasProps) {
  const comun = {
    /*
     * `--r-pill` y no `--r-circulo`: en un elemento CUADRADO el navegador
     * recorta el radio a la mitad del lado, así que 9999px da el mismo círculo
     * exacto. Usar el token que ya está en uso evita añadir un valor más a la
     * escala visual — que es justo lo que el trinquete vigila.
     */
    width: 64, height: 64, borderRadius: 'var(--r-pill)', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  } as const

  if (p.estado === 'listo') {
    return (
      <button onClick={p.alGrabar} aria-label="Grabar la consulta"
        style={{ ...comun, background: 'var(--nexus-solido)', color: '#fff' }}>
        <Mic size={26} />
      </button>
    )
  }
  if (p.estado === 'procesando') {
    return (
      <div aria-label="Procesando" style={{ ...comun, background: 'var(--s2)', color: 'var(--text3)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }
  const pausado = p.estado === 'pausado'
  return (
    <button
      onClick={pausado ? p.alReanudar : p.alPausar}
      aria-label={pausado ? 'Reanudar la grabación' : 'Pausar la grabación'}
      style={{ ...comun, background: pausado ? 'var(--nexus-solido)' : 'var(--s2)', color: pausado ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
    >
      {pausado ? <Play size={24} /> : <Pause size={24} />}
    </button>
  )
}

export function MientrasHablas(p: MientrasHablasProps) {
  const grabando = p.estado === 'grabando'
  const activo = grabando || p.estado === 'pausado'

  return (
    <div
      role="region"
      aria-label="Grabación de la consulta"
      style={{
        /*
          `sticky` sirve para los dos: en el teléfono se queda abajo al alcance
          del pulgar, y en la computadora se pega al borde inferior de la
          ventana al desplazarse. Un solo comportamiento, dos dispositivos.
        */
        position: 'sticky', bottom: 0, zIndex: 30,
        marginTop: 12, padding: '12px 14px',
        borderRadius: 14,
        background: 'var(--s1)',
        border: `1px solid ${grabando ? 'var(--nexus)' : 'var(--border)'}`,
        boxShadow: '0 -6px 24px rgba(0,0,0,0.28)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/*
        ── EL ANUNCIO DICE EL ESTADO, NO LA HORA ────────────────────────────
        Este contenedor llevaba `aria-live="polite"` y DENTRO lleva el reloj de
        la grabación. Medido el 1-sep con la consulta grabando: SEIS regiones
        vivas en pantalla, y ésta releía la duración entera cada segundo. Para
        quien usa lector de pantalla eso no es información: es un goteo continuo
        de cifras encima de todo lo demás, en la pantalla donde está hablando
        con un paciente.

        Lo que hay que anunciar es el CAMBIO —empezó, se pausó, se está armando
        la nota, falló—, no el paso del tiempo. Así que el `aria-live` baja del
        contenedor a este renglón invisible, que sólo cambia cuando cambia el
        estado, y `SE_ANUNCIA` deja fuera `grabando` justo por el reloj.
      */}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
          overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
        }}
      >
        {p.estado === 'pausado' ? PALABRA.pausado
          : p.estado === 'procesando' ? PALABRA.estructurando
            : p.estado === 'listo' ? '' : ''}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {botonPrincipal(p)}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/*
              LA PALABRA SALE DEL VOCABULARIO COMÚN. Ésta decía «Escuchando»
              mientras la barra superior, la banda de transporte y el control
              flotante decían «Grabando» — del mismo segundo, en la misma
              pantalla. No son cuatro fuentes de verdad (todas escuchan el mismo
              `EVENTO_GRABANDO`): era la PRESENTACIÓN la que estaba duplicada, y
              cada copia había elegido su palabra.

              Y es «Grabando» y no «Escuchando» a propósito: el paciente firmó un
              consentimiento para que la conversación SE GRABE, el audio se
              guarda, y `data-privacy` declara que la voz es biométrica. La
              palabra suave es la palabra equivocada justo aquí.
            */}
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {p.estado === 'listo' ? 'Grabar la consulta'
                : p.estado === 'pausado' ? PALABRA.pausado
                  : p.estado === 'procesando' ? PALABRA.estructurando
                    : PALABRA.grabando}
            </span>
            {activo && (
              <span style={{ fontSize: 14, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                {reloj(p.duracion)}
              </span>
            )}
          </div>

          {/*
            EL NIVEL DE VOZ. Es la única prueba en vivo de que el micrófono
            capta: un contador sigue corriendo con el micrófono silenciado, una
            barra que se mueve no.
          */}
          {grabando ? (
            <div aria-hidden style={{ marginTop: 6, height: 6, borderRadius: 'var(--r-pill)', background: 'var(--s2)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', borderRadius: 'var(--r-pill)', background: 'var(--nexus)',
                  width: `${Math.round(Math.min(1, Math.max(0.02, p.nivelAudio)) * 100)}%`,
                  // INSTRUMENTO, no interfaz (V15-MOTION-001): la barra sigue el
                  // nivel del micrófono en vivo. `linear` a 90ms está afinado al
                  // ritmo de la señal; una curva con easing o un token más lento
                  // la haría MENTIR sobre lo que capta. No migrar a var(--mov-*).
                  transition: 'width 90ms linear',
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text3)' }}>
              {p.estado === 'listo' ? 'Capta a los dos y separa las voces' : ''}
            </div>
          )}
        </div>

        {activo && (
          <button
            onClick={p.alDetener}
            aria-label="Terminar la grabación"
            style={{
              minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-pill)',
              background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center', gap: 8, flexShrink: 0,
            }}
          >
            <Square size={14} /> Terminar
          </button>
        )}
      </div>

      {/*
        LO QUE SE VA ESCRIBIENDO — lo que el médico pidió con estas palabras:
        «así como cuando te dictan a ti, que se vaya escribiendo».

        No es adorno. Ver las palabras salir es lo que permite corregir una
        pronunciación en el momento, en vez de descubrir al final que el
        reconocedor entendió otra cosa.
      */}
      {grabando && p.ultimasPalabras?.trim() && (
        <div
          style={{
            fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.5,
            maxHeight: 44, overflow: 'hidden',
            borderTop: '1px solid var(--border)', paddingTop: 8,
          }}
        >
          <span style={{ color: 'var(--text3)' }}>…</span> {p.ultimasPalabras.trim().slice(-160)}
        </div>
      )}

      {/*
        Y la nota armándose: pasaba cada 15 segundos y era invisible. Verlo
        convierte una espera en un progreso.
      */}
      {(p.escribiendo || p.seccionRecienEscrita) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--nexus)' }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          {p.seccionRecienEscrita
            ? <span>Escribiendo <strong>{p.seccionRecienEscrita}</strong>…</span>
            : <span>Armando la nota…</span>}
        </div>
      )}
    </div>
  )
}

export const POR_QUE_EL_NIVEL_DE_VOZ =
  'Es la única prueba en vivo de que el micrófono capta. Un contador de tiempo ' +
  'sigue corriendo aunque el micrófono esté silenciado; una barra que se mueve, no.'

export const POR_QUE_SE_VEN_LAS_PALABRAS =
  'Permite corregir una pronunciación en el momento, en vez de descubrir al ' +
  'final que el reconocedor entendió otra cosa. El médico lo pidió así: «como ' +
  'cuando te dictan a ti, que se vaya escribiendo».'

export const POR_QUE_STICKY_Y_NO_FIXED =
  'Sirve para los dos dispositivos con un solo comportamiento: en el teléfono ' +
  'queda al alcance del pulgar y en la computadora se pega al borde inferior al ' +
  'desplazarse, sin tapar la nota.'
