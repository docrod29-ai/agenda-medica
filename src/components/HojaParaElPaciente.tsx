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
import { ClipboardCheck, Copy, Printer } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ¿SE PUEDE ENTREGAR YA? — la compuerta de `POSTVISIT-GATE-001`.
   *
   * Copiar e imprimir son los dos actos de ENTREGA que tiene esta hoja, y hasta
   * hoy no tenían compuerta: la hoja se compone del estado vivo de la pantalla,
   * así que el médico podía copiar una hoja hecha de un borrador a medio dictar
   * y mandarla por WhatsApp. La cabecera del módulo afirmaba que el contenido
   * salía de lo «ya revisado y firmado» — era intención de diseño, no
   * precondición.
   *
   * La hoja **se sigue viendo** sin firmar, y eso es a propósito: el médico
   * necesita ver qué se va a llevar el paciente mientras todavía puede
   * cambiarlo. Lo que se cierra es la salida, no la vista.
   *
   * Por defecto `false`: una compuerta que hay que acordarse de activar no es una
   * compuerta. Quien pueda entregar tiene que decirlo.
   */
  entregable?: boolean
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const bloques = useMemo(() => comoSeLoExplico(p), [p])
  const entregable = p.entregable === true

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
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

        <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!entregable && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Se entrega cuando firmes la nota
            </span>
          )}
          {entregable && (<>
          <button
            onClick={copiar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
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
              padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            <Printer size={14} /> Imprimir
          </button>
          </>)}
        </div>
      </header>

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

export const POR_QUE_LA_HOJA_SE_VE_ANTES_DE_FIRMAR =
  'El médico necesita ver qué se va a llevar el paciente mientras todavía puede ' +
  'cambiarlo. Lo que la firma abre no es la vista: es la salida — copiar e ' +
  'imprimir, que son los dos actos de entrega que tiene esta hoja.'

export const POR_QUE_SE_PUEDE_COPIAR =
  'El paciente mexicano lleva WhatsApp, no siempre impresora. Copiar es la vía ' +
  'más corta entre la consulta y su teléfono, y no inventa un canal nuevo que ' +
  'haya que mantener.'

export const POR_QUE_NO_SE_ENSENA_VACIA =
  'Una hoja que dice «Estudios: —» le hace leer al paciente una línea que no le ' +
  'dice nada.'
