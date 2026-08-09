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
 */
import { useMemo, useState } from 'react'
import { ClipboardCheck, Copy, Printer, Send, Check, Loader2, Lock } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ¿Está firmada la nota de la que sale esta hoja? — `POSTVISIT-GATE-001`.
   *
   * **Por omisión, `false`.** Fallar cerrado no es prudencia genérica: esta
   * hoja se compone del estado VIVO de la consulta, así que mientras el médico
   * dicta contiene una dosis que todavía va a corregir. Copiar e imprimir **son
   * entrega** —el papel sale del consultorio con el membrete del médico— y por
   * eso van detrás de la firma, igual que la entrega al portal.
   *
   * La hoja se sigue viendo mientras se dicta, marcada como borrador: sirve
   * para saber qué se está construyendo. Lo que se cierra es la salida.
   */
  firmada?: boolean
  /** Ya se le entregó al paciente en su portal, con la hora de aprobación. */
  entregadoEn?: number | null
  /** Sin esto no hay botón de entrega: la pantalla que no sepa entregar, no ofrece. */
  onEntregar?: () => void | Promise<void>
  entregando?: boolean
  errorDeEntrega?: string
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const bloques = useMemo(() => comoSeLoExplico(p), [p])
  const firmada = p.firmada === true

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
    if (!firmada) return
    try {
      await navigator.clipboard.writeText(comoTexto(bloques))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* Sin portapapeles, el botón de imprimir sigue ahí. */ }
  }

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

        <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!firmada && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--text3)',
              }}
            >
              <Lock size={13} aria-hidden="true" /> Se entrega al firmar
            </span>
          )}
          <button
            onClick={copiar}
            disabled={!firmada}
            title={firmada ? undefined : 'Se habilita al firmar la nota'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)',
              cursor: firmada ? 'pointer' : 'not-allowed', opacity: firmada ? 1 : 0.5,
            }}
          >
            {copiado ? <ClipboardCheck size={14} /> : <Copy size={14} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={() => { if (firmada) window.print() }}
            disabled={!firmada}
            aria-label="Imprimir la hoja del paciente"
            title={firmada ? undefined : 'Se habilita al firmar la nota'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)',
              cursor: firmada ? 'pointer' : 'not-allowed', opacity: firmada ? 1 : 0.5,
            }}
          >
            <Printer size={14} /> Imprimir
          </button>
          {/*
            ENTREGAR AL PACIENTE — `POSTVISIT-ENTREGA-001`.

            Hasta hoy esta hoja no salía de la pantalla: copiar e imprimir eran
            las dos únicas puertas, y las dos exigen que el paciente esté
            enfrente y se lleve un papel.

            El botón es un acto EXPLÍCITO y aparte de firmar. No se dispara solo
            al firmar aunque se pudiera: firmar es hacia el expediente, liberar
            es hacia el paciente, y hay consultas que se firman y no se
            entregan todavía.
          */}
          {firmada && p.onEntregar && (
            p.entregadoEn ? (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: 'var(--success)', fontWeight: 600,
                }}
              >
                <Check size={14} aria-hidden="true" /> Entregado
              </span>
            ) : (
              /* `btn btn-primary`, el primitivo compartido, y no un botón
                 pintado a mano: se rellena con `--nexus-solido` —el azul de
                 RELLENO, que sí contrasta con el texto blanco— mientras que
                 `--nexus` es el azul de TEXTO. Escribirlo en línea es cómo se
                 coló ese defecto en 26 sitios (REG-223). */
              <button
                onClick={() => { void p.onEntregar?.() }}
                disabled={p.entregando === true}
                className="btn btn-primary btn-sm"
              >
                {p.entregando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                {p.entregando ? 'Entregando…' : 'Entregar al paciente'}
              </button>
            )
          )}
        </div>
      </header>

      <div style={{ padding: '4px 14px 14px' }}>
        {!firmada && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            Vista previa de la nota en curso. No se entrega hasta que la firme:
            lo que el paciente se lleva sale de la nota firmada.
          </p>
        )}
        {p.errorDeEntrega && (
          <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--red)', lineHeight: 1.6 }}>
            {p.errorDeEntrega}
          </p>
        )}
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
