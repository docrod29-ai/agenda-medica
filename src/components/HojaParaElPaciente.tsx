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
import { ClipboardCheck, Copy, Printer, Send, Check, Loader2 } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ENTREGARLA AL PACIENTE — V9 · `POSTVISIT-001`, `POSTVISIT-ENTREGA-001`.
   *
   * Sin este manejador la hoja se comporta como siempre (copiar e imprimir). Con
   * él aparece el tercer botón, el que la deja visible en el portal del paciente.
   *
   * La compuerta de firma **no vive aquí**: quien monta la hoja decide si la
   * enseña, y el servidor vuelve a comprobarlo al liberar. Un botón escondido no
   * cierra una ruta HTTP.
   */
  alEntregar?: () => Promise<void>
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const [entrega, setEntrega] = useState<'inicial' | 'enviando' | 'hecho'>('inicial')
  const [errorEntrega, setErrorEntrega] = useState('')
  const bloques = useMemo(() => comoSeLoExplico(p), [p])

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comoTexto(bloques))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* Sin portapapeles, el botón de imprimir sigue ahí. */ }
  }

  /**
   * El error se ENSEÑA, no se traga. Si la liberación falla —la nota no está
   * firmada, el rol no puede aprobar, la red se cayó— el médico tiene que
   * enterarse: creer que el paciente ya tiene su hoja cuando no la tiene es
   * peor que no haber pulsado.
   */
  const entregar = async () => {
    if (!p.alEntregar || entrega !== 'inicial') return
    setEntrega('enviando'); setErrorEntrega('')
    try {
      await p.alEntregar()
      setEntrega('hecho')
    } catch (e) {
      setEntrega('inicial')
      setErrorEntrega(e instanceof Error ? e.message : 'No se pudo entregar la hoja.')
    }
  }

  return (
    <section
      className="hoja-paciente"
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
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
        <span style={{ fontSize: 'var(--t-caption)', color: 'var(--text3)' }}>
          en sus palabras, sin nada que usted no haya escrito
        </span>

        <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={copiar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-body)', fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            {copiado ? <ClipboardCheck size={14} /> : <Copy size={14} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={() => window.print()}
            aria-label="Imprimir la hoja del paciente"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-body)', fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            <Printer size={14} /> Imprimir
          </button>
          {p.alEntregar && (
            <button
              onClick={entregar}
              disabled={entrega !== 'inicial'}
              aria-label="Entregar la hoja al paciente en su portal"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-body)', fontWeight: 600,
                background: entrega === 'hecho' ? 'var(--s3)' : 'var(--nexus)',
                color: entrega === 'hecho' ? 'var(--text)' : '#fff',
                border: '1px solid ' + (entrega === 'hecho' ? 'var(--border)' : 'var(--nexus)'),
                cursor: entrega === 'inicial' ? 'pointer' : 'default',
                minHeight: 44,
              }}
            >
              {entrega === 'enviando' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : entrega === 'hecho' ? <Check size={14} /> : <Send size={14} />}
              {entrega === 'enviando' ? 'Entregando…' : entrega === 'hecho' ? 'Entregada' : 'Entregar al paciente'}
            </button>
          )}
        </div>
      </header>

      {errorEntrega && (
        <p role="alert" style={{
          margin: 0, padding: '10px 14px', fontSize: 'var(--t-body)', lineHeight: 1.5,
          color: 'var(--red)', borderBottom: '1px solid var(--border)',
        }}>
          {errorEntrega}
        </p>
      )}

      <div style={{ padding: '4px 14px 14px' }}>
        {p.nombreDelPaciente && (
          <p style={{ margin: '10px 0 0', fontSize: 'var(--t-body)', color: 'var(--text3)' }}>
            Para {p.nombreDelPaciente}
          </p>
        )}

        {bloques.map(b => (
          <div key={b.titulo} style={{ marginTop: 14 }}>
            <h4 style={{
              margin: 0, fontSize: 'var(--t-caption)', fontWeight: 700, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--text3)',
            }}>
              {b.titulo}
            </h4>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {b.lineas.map((l, i) => (
                <li key={i} style={{ fontSize: 'var(--t-body)', color: 'var(--text)', lineHeight: 1.6 }}>
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
