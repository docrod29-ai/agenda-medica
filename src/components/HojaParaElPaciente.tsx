'use client'
/**
 * LO QUE SE LLEVA EL PACIENTE — REG-242.
 *
 * ── EL HUECO, DE LA INVESTIGACIÓN DEL MERCADO ───────────────────────────────
 *
 * Suki y Nabla tienen instrucciones para el paciente. NexusMED no. El paciente
 * salía con una receta y con lo que hubiera retenido de la conversación.
 *
 * ── LA DIFERENCIA CON ELLOS ─────────────────────────────────────────────────
 *
 * Ellos las **generan** con un modelo. Aquí se **componen** de lo que el médico
 * ya revisó y firmó — el motor está en `lib/paciente/como-se-lo-explico.ts` y
 * es determinista.
 *
 * Un modelo redactando instrucciones puede añadir «tome mucha agua» o «si
 * empeora acuda a urgencias». En un papel que sale con el membrete del médico,
 * eso es una indicación médica que nadie firmó.
 *
 * ── POR QUÉ SE PUEDE COPIAR Y NO SÓLO IMPRIMIR ──────────────────────────────
 *
 * Porque el paciente mexicano lleva WhatsApp, no siempre impresora. Copiar el
 * texto es la vía más corta entre la consulta y el teléfono del paciente — y no
 * inventa un canal nuevo que haya que mantener.
 *
 * ── LA COMPUERTA DE FIRMA (V9 · POSTVISIT-GATE-001) ─────────────────────────
 *
 * Hasta hoy esta hoja se componía del **borrador en curso** —el estado vivo de
 * medicamentos y estudios— y se podía copiar, imprimir y entregar a mitad del
 * dictado. La cabecera del módulo decía que salía de lo «ya revisado y
 * firmado»: era intención de diseño, no precondición.
 *
 * Ahora hay dos estados, y se distinguen a la vista:
 *
 *   · **sin firmar** → vista previa. Se VE (le sirve al médico saber qué se va
 *     a llevar el paciente mientras todavía puede cambiarlo) pero **no se
 *     entrega**: copiar, imprimir y entregar quedan cerrados, y se dice por qué.
 *   · **firmada** → se entrega, y además se puede mandar al portal del paciente.
 *
 * Se cierra la ENTREGA, no la vista. Esconder la hoja hasta firmar le quitaría
 * al médico la única forma de ver, antes de sellar, si lo que se lleva el
 * paciente tiene sentido — y ese repaso es justo lo que evita la corrección.
 */
import { useMemo, useState } from 'react'
import { ClipboardCheck, Copy, Printer, Send, CheckCircle2, Loader2, Lock } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

/** En qué punto está la entrega al portal del paciente. */
export type EstadoEntrega =
  | { fase: 'ninguna' }
  | { fase: 'enviando' }
  | { fase: 'entregada'; version: number }
  | { fase: 'error'; mensaje: string }

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ¿La nota está firmada? Sin esto no se entrega nada.
   *
   * Opcional y con `false` por defecto **a propósito**: si un llamador nuevo se
   * olvida de pasarlo, la hoja queda en vista previa. La compuerta falla
   * cerrada.
   */
  firmada?: boolean
  /** Manda el resumen al portal del paciente. Sin esto, el botón no existe. */
  alEntregar?: () => void
  entrega?: EstadoEntrega
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const bloques = useMemo(() => comoSeLoExplico(p), [p])
  const firmada = p.firmada === true
  const entrega = p.entrega ?? { fase: 'ninguna' as const }

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
    /* La compuerta también aquí, y no sólo en el `disabled`: un botón
       deshabilitado es una pantalla, y esto es lo que de verdad copia. */
    if (!firmada) return
    try {
      await navigator.clipboard.writeText(comoTexto(bloques))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* Sin portapapeles, el botón de imprimir sigue ahí. */ }
  }

  const botonBase = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    background: 'var(--s3)', color: 'var(--text)',
    border: '1px solid var(--border)',
  } as const
  const cerrado = { ...botonBase, opacity: 0.5, cursor: 'not-allowed' } as const

  return (
    <section
      className="hoja-paciente"
      style={{
        border: '1px solid var(--border)', borderRadius: 11,
        background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Lo que se lleva el paciente
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          en sus palabras, sin nada que usted no haya escrito
        </span>

        <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={copiar}
            disabled={!firmada}
            title={firmada ? undefined : 'Se puede copiar cuando la nota esté firmada'}
            style={firmada ? { ...botonBase, cursor: 'pointer' } : cerrado}
          >
            {copiado ? <ClipboardCheck size={14} /> : <Copy size={14} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={() => { if (firmada) window.print() }}
            disabled={!firmada}
            aria-label="Imprimir la hoja del paciente"
            title={firmada ? undefined : 'Se puede imprimir cuando la nota esté firmada'}
            style={firmada ? { ...botonBase, cursor: 'pointer' } : cerrado}
          >
            <Printer size={14} /> Imprimir
          </button>
          {/*
            ENTREGAR AL PORTAL — POSTVISIT-ENTREGA-001.
            El contenido de esta hoja estaba resuelto desde REG-242 y el
            producto no lo entregaba: dos botones, portapapeles e impresora, y
            ni una línea en /mi/[token]. Lo que se manda NO es lo que se ve
            aquí: el servidor recompone desde la nota firmada (ver la ruta).
          */}
          {firmada && p.alEntregar && (
            <button
              onClick={() => { if (entrega.fase !== 'enviando') p.alEntregar?.() }}
              disabled={entrega.fase === 'enviando'}
              style={{
                ...botonBase,
                cursor: entrega.fase === 'enviando' ? 'progress' : 'pointer',
                background: entrega.fase === 'entregada' ? 'var(--s3)' : 'var(--nexus-solido)',
                color: entrega.fase === 'entregada' ? 'var(--text)' : '#fff',
                borderColor: entrega.fase === 'entregada' ? 'var(--border)' : 'transparent',
              }}
            >
              {entrega.fase === 'enviando' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : entrega.fase === 'entregada' ? <CheckCircle2 size={14} />
                : <Send size={14} />}
              {entrega.fase === 'enviando' ? 'Entregando…'
                : entrega.fase === 'entregada' ? `Entregar de nuevo (v${entrega.version})`
                : 'Entregar al paciente'}
            </button>
          )}
        </div>
      </header>

      {/*
        LO QUE ESTA HOJA ES AHORA MISMO, DICHO EN VOZ ALTA.
        No con un color: con una frase. Un médico daltónico y un médico con la
        vista cansada a las nueve de la noche leen lo mismo.
      */}
      {!firmada && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--s1)', fontSize: 'var(--t-caption)', color: 'var(--text2)', lineHeight: 1.5,
        }}>
          <Lock size={14} className="ds-icon" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <span>
            <strong>Vista previa.</strong> Esto se compone de lo que lleva escrito
            ahora, que todavía puede cambiar. Se podrá copiar, imprimir y entregar
            cuando firme la nota.
          </span>
        </div>
      )}
      {entrega.fase === 'entregada' && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          fontSize: 'var(--t-caption)', color: 'var(--text2)',
        }}>
          <CheckCircle2 size={14} className="ds-icon" style={{ flexShrink: 0 }} aria-hidden />
          Entregado al portal del paciente (versión {entrega.version}). Lo que se le
          entregó queda guardado tal cual; una corrección se entrega como una versión nueva.
        </div>
      )}
      {entrega.fase === 'error' && (
        <div role="alert" style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          fontSize: 'var(--t-caption)', color: 'var(--red)', lineHeight: 1.5,
        }}>
          {entrega.mensaje}
        </div>
      )}

      <div style={{ padding: '4px 14px 14px' }}>
        {p.nombreDelPaciente && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Para {p.nombreDelPaciente}
          </p>
        )}

        {bloques.map(b => (
          <div key={b.titulo} style={{ marginTop: 14 }}>
            <h4 style={{
              margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--text3)',
            }}>
              {b.titulo}
            </h4>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {b.lineas.map((l, i) => (
                <li key={i} style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.6 }}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export const POR_QUE_SE_PUEDE_COPIAR =
  'El paciente mexicano lleva WhatsApp, no siempre impresora. Copiar es la vía ' +
  'más corta entre la consulta y su teléfono, y no inventa un canal nuevo que ' +
  'haya que mantener.'

export const POR_QUE_NO_SE_ENSENA_VACIA =
  'Una hoja que dice «Estudios: —» le hace leer al paciente una línea que no le ' +
  'dice nada.'
