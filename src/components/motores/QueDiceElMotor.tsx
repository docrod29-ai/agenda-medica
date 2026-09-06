'use client'
/**
 * QUÉ DICE EL MOTOR — UNA CAJA POR DEFENSA, CORRIENDO DE VERDAD.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El 9-ago-2026 el dueño dijo esto, y tenía razón:
 *
 *   *«no he visto ningún cambio en la aplicación»*
 *
 * Quince versiones de reparaciones **invisibles por naturaleza**: una alergia
 * que ya no se inventa, un VIH que ya no se descarta solo, una CMI censurada que
 * ya no se lee como exacta. Todas hacen que **no** pase algo malo, y eso es lo
 * más difícil de ver que existe.
 *
 * ── LO QUE ESTA CAJA NO ES ──────────────────────────────────────────────────
 *
 * No es una captura, ni un ejemplo escrito, ni una promesa. **El motor corre
 * aquí**, en el navegador, sobre lo que se escriba en el campo. Si el motor se
 * rompe mañana, esta caja lo enseña roto.
 *
 * Es la diferencia entre una demo y una prueba: una demo se prepara, esto se
 * ejecuta.
 *
 * ── EL «ANTES» ES HISTORIA, Y SE DICE ───────────────────────────────────────
 *
 * El código viejo ya no existe, así que el «antes» **no se calcula**: se cita,
 * con su número de reparación. Lo que se calcula es lo de ahora. Presentar como
 * medido algo que sólo está recordado sería exactamente el defecto que la mitad
 * de estos motores existen para evitar.
 */
import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'

export interface QueDiceElMotorProps {
  /** Cómo se llama la defensa, en lenguaje de consultorio. */
  titulo: string
  /** El número de reparación, para poder rastrearla. */
  reg: string
  /** Qué se escribe: la frase, el campo, el resultado de laboratorio. */
  etiqueta: string
  /** El caso REAL que falló, tal cual. */
  ejemplo: string
  /** Qué hacía antes. Historia citada, NO calculada — y así se dice. */
  antes: string
  /** El motor. Puro: entra texto, sale lo que el motor concluye. */
  motor: (entrada: string) => string
  /** Por qué importaba, en una frase de consultorio. */
  porQue: string
}

export function QueDiceElMotor(p: QueDiceElMotorProps) {
  const [texto, setTexto] = useState(p.ejemplo)

  /**
   * Se corre en el render y no en un efecto: el motor es PURO y síncrono, así
   * que no hay nada que sincronizar. Un `useEffect` aquí sólo añadiría un
   * fotograma en el que la respuesta y el texto no coinciden — y esta caja
   * existe precisamente para que se pueda confiar en lo que enseña.
   */
  /**
   * UN MOTOR QUE REVIENTA NO SE PINTA CON UNA PALOMITA — Panel de Lujo ZC-020.
   *
   * Antes, la excepción se guardaba en `dice` como si fuera la respuesta del
   * motor: mismo icono `Check`, mismo rótulo «AHORA · el motor, corriendo sobre
   * lo de arriba», y debajo `TypeError: …`. Sólo cambiaba el color, y el color
   * solo nunca es la señal (es la misma regla que ya sigue el resto del
   * producto). Esta pantalla existe para que el dueño VEA sus defensas
   * funcionando; una defensa caída pintada como defensa viva es peor que no
   * tener la pantalla.
   */
  let dice: string
  let reventó = false
  let detalleTecnico = ''
  try {
    dice = p.motor(texto)
  } catch (e) {
    reventó = true
    dice = 'El motor no pudo con esta entrada. No es una respuesta suya: es un fallo, y por eso no se enseña como resultado.'
    detalleTecnico = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }

  return (
    <section style={{
      border: '1px solid var(--border)', borderRadius: 14,
      background: 'var(--s2)', overflow: 'hidden',
    }}>
      <header style={{ padding: '13px 15px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{p.titulo}</h3>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--text3)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '1px 7px',
          }}>{p.reg}</span>
        </div>
        <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>
          {p.porQue}
        </p>
      </header>

      <div style={{ padding: 15, display: 'grid', gap: 11 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{p.etiqueta}</span>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={2}
            spellCheck={false}
            style={{
              width: '100%', maxWidth: '100%', boxSizing: 'border-box',
              padding: '9px 11px', borderRadius: 10, resize: 'vertical',
              border: '1px solid var(--border)', background: 'var(--s1)',
              color: 'var(--text)', font: 'inherit', fontSize: 14, lineHeight: 1.5,
            }}
          />
        </label>

        {/* ANTES — citado, no calculado. La distinción va escrita en la etiqueta. */}
        <div style={{
          display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px',
          borderRadius: 10, border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          background: 'color-mix(in srgb, var(--red) 8%, transparent)',
        }}>
          <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--red)', letterSpacing: '.03em' }}>
              ANTES · lo que hacía, según el registro
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 3, lineHeight: 1.5 }}>{p.antes}</div>
          </div>
        </div>

        {/* AHORA — calculado en este instante, con lo que haya en el campo. */}
        <div style={{
          display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px',
          borderRadius: 10,
          border: `1px solid color-mix(in srgb, ${reventó ? 'var(--amber)' : 'var(--teal)'} 35%, transparent)`,
          background: `color-mix(in srgb, ${reventó ? 'var(--amber)' : 'var(--teal)'} 9%, transparent)`,
        }}>
          {reventó
            ? <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            : <Check size={15} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em',
              color: reventó ? 'var(--amber)' : 'var(--teal)',
            }}>
              {reventó
                ? 'AHORA · el motor no pudo con esta entrada'
                : 'AHORA · el motor, corriendo sobre lo de arriba'}
            </div>
            {/*
              `pre-line` NO es cosmético: varios motores contestan en VARIAS
              líneas —qué tiene y qué niega, qué ve la consulta y qué el
              hospital, el pase repartido por aparatos— y sin esto se aplastan
              en una sola. Encontrado mirando la pantalla en producción, que es
              donde se ven las cosas que ninguna prueba mira.
            */}
            <div style={{
              fontSize: 14, color: 'var(--text)', marginTop: 3, lineHeight: 1.55,
              fontFamily: 'var(--font-mono, ui-monospace, monospace)', wordBreak: 'break-word',
              whiteSpace: 'pre-line',
            }}>{dice}</div>
            {reventó && (
              /* El detalle técnico existe —es lo único que sirve para
                 arreglarlo— pero plegado: quien mira esta pantalla mira si la
                 defensa funciona, no una traza. */
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>Detalle técnico</summary>
                <div style={{
                  fontSize: 12, color: 'var(--text3)', marginTop: 4, wordBreak: 'break-word',
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                }}>{detalleTecnico}</div>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export const POR_QUE_EL_ANTES_NO_SE_CALCULA =
  'El código viejo ya no existe. Presentar como medido algo que sólo está ' +
  'recordado sería el defecto que la mitad de estos motores existen para evitar.'
