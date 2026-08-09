'use client'
/**
 * UNA BARRA, TRES RENGLONES — la que sustituye a los ocho recuadros.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * El 5-ago-2026 el Dr. mandó la captura de su consulta: ocho bloques de aviso
 * apilados encima de la nota, ~40 elementos, y sólo uno le impedía firmar. Tres
 * de esos bloques eran rojos y dos de los tres no bloqueaban nada.
 *
 * ── LO QUE HACE, Y LO QUE DELIBERADAMENTE NO HACE ────────────────────────────
 *
 * **Ningún aviso desaparece.** Se recolocan y se pliegan. Un aviso escondido y
 * un aviso ahogado entre cuarenta fallan igual, así que aquí no se cambia uno
 * por otro: lo que bloquea queda MÁS visible que antes, no menos.
 *
 * **La barra no se puede cerrar.** Se pliegan niveles; la barra no. Si
 * desapareciera entera, el médico se quedaría sin dónde enterarse.
 *
 * **No es `Alert`.** `Alert` es justamente el banner de ancho completo con marco
 * propio que se está quitando: usar ocho de ellos fue como se llegó aquí.
 *
 * ── EL RIESGO QUE ASUME, DICHO EN VOZ ALTA ───────────────────────────────────
 *
 * Plegar es esconder. «Otros 4 avisos» a un clic puede acabar en «nunca se
 * abre», y la vía asumida se va a leer menos que antes. Es el precio consciente
 * de que el rojo vuelva a significar algo. Se acota con lo que NO se pliega
 * nunca (`NO_SE_PLIEGAN`), con el contador siempre a la vista, y con que el
 * grupo nazca abierto cuando cabe.
 */
import { useState, type ReactNode } from 'react'
import { ShieldAlert, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  resumirAvisos, fijos, plegables, naceAbierto,
  type AvisoConsulta,
} from '@/lib/expediente/avisos-consulta'

interface Props {
  avisos: readonly AvisoConsulta[]
  /** Cuántos datos del dictado ya están escritos en la nota. 0 = no hubo dictado. */
  extraidos: number
  /** Nota firmada: sólo se enseñan los fijos, sin botones. */
  soloLectura?: boolean
  onIr?: (ancla: NonNullable<AvisoConsulta['ancla']>) => void
  onRevisado?: (id: string) => void
  /** El panel de «ya en la nota», embebido sin su marco. */
  children?: ReactNode
}

const R = 'var(--red)'
const A = 'var(--amber)'

function Renglon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 12px', borderTop: '1px solid rgba(128,128,128,.18))',
      color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.5,
    }}>
      <span style={{ color, flexShrink: 0, marginTop: 1, display: 'flex' }}>{children}</span>
    </div>
  )
}

const chip = (color: string) => ({
  flexShrink: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: .4,
  padding: '2px 7px', borderRadius: 5, color,
  background: `color-mix(in srgb, ${color} 14%, transparent)`,
  border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
})

const botonTexto = {
  background: 'none', border: '1px solid currentColor', borderRadius: 6,
  color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: 11.5,
  padding: '1px 8px', marginLeft: 6,
} as const

export function AntesDeFirmar({ avisos, extraidos, soloLectura, onIr, onRevisado, children }: Props) {
  /**
   * Un solo acordeón: nunca hay dos niveles abiertos a la vez, para que la barra
   * no vuelva a crecer hasta empujar la nota fuera de la pantalla.
   */
  const dobles = plegables(avisos)
  const [abierto, setAbierto] = useState<'revisa' | 'nota' | null>(
    naceAbierto(dobles.length) ? 'revisa' : null,
  )

  const { bloquean, revisar } = resumirAvisos(avisos)
  const bloqueos = avisos.filter(a => a.nivel === 'bloquea')
  const alaVista = fijos(avisos)

  if (avisos.length === 0 && extraidos === 0) return null

  const encabezado = soloLectura
    ? 'Avisos vigentes de esta nota'
    : bloquean === 0 && revisar === 0
      ? 'Listo para firmar'
      : 'Antes de firmar'

  return (
    <div
      role={bloquean > 0 ? 'alert' : 'status'}
      style={{
        marginBottom: 12, borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${bloquean > 0 ? `color-mix(in srgb, ${R} 38%, transparent)` : 'rgba(128,128,128,.22))'}`,
        background: 'var(--panel, transparent)',
      }}
    >
      {/* ── Encabezado: el conteo real, siempre visible ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap', padding: '9px 12px', fontSize: 12.5,
      }}>
        <strong style={{ color: 'var(--text)' }}>{encabezado}</strong>
        <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>
          {bloquean > 0
            ? `${bloquean} ${bloquean === 1 ? 'bloquea' : 'bloquean'}`
            : 'nada te impide firmar'}
          {revisar > 0 && ` · ${revisar} por revisar`}
        </span>
      </div>

      {/* ── 1. BLOQUEA — nace abierto y no se pliega: es por lo que Firmar no responde ── */}
      {bloqueos.length > 0 && !soloLectura && (
        <Renglon color={R}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={chip(R)}>BLOQUEA</span>
                <strong style={{ color: 'var(--text)' }}>
                  {bloqueos.length === 1
                    ? `Falta la dosis de ${bloqueos[0].texto}.`
                    : `Falta la dosis de ${bloqueos.length} medicamentos.`}
                </strong>
              </span>
              {bloqueos.map(b => (
                <span key={b.id} style={{ display: 'block', marginBottom: 3 }}>
                  {/* El mensaje LITERAL del motor: explica el riesgo concreto. */}
                  {b.detalle}
                  {onIr && b.ancla && (
                    <button onClick={() => onIr(b.ancla!)} style={botonTexto}>
                      Escribir la dosis
                    </button>
                  )}
                </span>
              ))}
            </span>
          </span>
        </Renglon>
      )}

      {/* ── 2a. REVISA fijos — nunca se pliegan (ver NO_SE_PLIEGAN) ── */}
      {alaVista.map(a => (
        <Renglon key={a.id} color={A}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, minWidth: 0, color: 'var(--text2)' }}>
              <span style={{ ...chip(A), marginRight: 7 }}>REVISA</span>
              {a.texto}
              {!soloLectura && a.descartable && onRevisado && (
                <button onClick={() => onRevisado(a.id)} style={botonTexto}>Ya lo revisé</button>
              )}
            </span>
          </span>
        </Renglon>
      ))}

      {/* ── 2b. REVISA plegables ── */}
      {dobles.length > 0 && !soloLectura && (
        <div style={{ borderTop: '1px solid rgba(128,128,128,.18))' }}>
          <button
            onClick={() => setAbierto(x => (x === 'revisa' ? null : 'revisa'))}
            aria-expanded={abierto === 'revisa'}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text2)', font: 'inherit', fontSize: 12.5, textAlign: 'left',
            }}
          >
            {abierto === 'revisa' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            Otros {dobles.length} {dobles.length === 1 ? 'aviso' : 'avisos'} que no impiden firmar
          </button>
          {abierto === 'revisa' && (
            <div style={{ padding: '0 12px 10px 34px' }}>
              {dobles.map(a => (
                <div key={a.id} style={{ marginBottom: 6, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {a.texto}
                  {a.descartable && onRevisado && (
                    <button onClick={() => onRevisado(a.id)} style={botonTexto}>Ya lo revisé</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3. YA EN LA NOTA — siempre plegado: es contenido, no alerta ── */}
      {extraidos > 0 && !soloLectura && (
        <div style={{ borderTop: '1px solid rgba(128,128,128,.18))' }}>
          <button
            onClick={() => setAbierto(x => (x === 'nota' ? null : 'nota'))}
            aria-expanded={abierto === 'nota'}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text2)', font: 'inherit', fontSize: 12.5, textAlign: 'left',
            }}
          >
            {abierto === 'nota' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <Check size={15} style={{ color: 'var(--green)' }} />
            {extraidos} {extraidos === 1 ? 'dato' : 'datos'} de tu dictado ya {extraidos === 1 ? 'está escrito' : 'están escritos'} en la nota
          </button>
          {abierto === 'nota' && <div style={{ padding: '0 12px 10px' }}>{children}</div>}
        </div>
      )}
    </div>
  )
}

export const POR_QUE_NO_SE_PUEDE_CERRAR =
  'Se pliegan niveles; la barra no. Si desapareciera entera, el médico se ' +
  'quedaría sin dónde enterarse — que es peor que el ruido que se está quitando.'

export const POR_QUE_UN_SOLO_ACORDEON =
  'Nunca hay dos niveles abiertos a la vez. Es lo que impide que la barra vuelva ' +
  'a crecer hasta empujar la nota fuera de la pantalla, que es de donde venimos.'

export const EL_PRECIO_QUE_SE_PAGA =
  'Plegar es esconder: la vía asumida y el desajuste temporal se van a leer menos ' +
  'que antes. Es el precio consciente de que el rojo vuelva a significar algo, y ' +
  'por eso lo que puede matar hoy —alergia ↔ medicamento— no se pliega nunca.'
