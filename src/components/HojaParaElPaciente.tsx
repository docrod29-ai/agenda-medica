'use client'
/**
 * LO QUE SE LLEVA EL PACIENTE — REG-242.
 *
 * ── EL HUECO, DE LA INVESTIGACIÓN DEL MERCADO ───────────────────────────────
 *
 * Suki y Nabla tienen instrucciones para el paciente. Ausculta no. El paciente
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
   * Avisa que el médico REALMENTE usó la hoja (copió o imprimió) — no que
   * sólo la vio. `ComoCerrarLaConsulta` (V15-NOTE-PLAN-CONTINUITY-001) la
   * usa para marcar «Darle sus instrucciones» como hecho; sin este aviso
   * ese paso del cierre nunca se podía completar.
   */
  onInteraccion?: () => void
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const bloques = useMemo(() => comoSeLoExplico(p), [p])

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comoTexto(bloques))
      setCopiado(true)
      p.onInteraccion?.()
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* Sin portapapeles, el botón de imprimir sigue ahí. */ }
  }

  const imprimir = () => {
    p.onInteraccion?.()
    window.print()
  }

  return (
    <section
      id="hoja-para-el-paciente"
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
        {/* h2, no span: la hoja es una sección mayor del lienzo de consulta y
            su título entra al esquema de encabezados (h1 paciente → h2 sección
            → h3 bloque). Con el título en <span>, los bloques de abajo eran
            h4 huérfanos tras el h1 — el `heading-order` de axe que apareció
            en cada captura poblada de V15-ENCOUNTER-MODE-001. */}
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Lo que se lleva el paciente
        </h2>
        <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          en sus palabras, sin nada que usted no haya escrito
        </span>

        <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
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
            onClick={imprimir}
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
            <h3 style={{
              margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--text3)',
            }}>
              {b.titulo}
            </h3>
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
