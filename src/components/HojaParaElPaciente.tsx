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
 * ── Y «FIRMÓ» ES AHORA UNA PRECONDICIÓN, NO UNA INTENCIÓN (REG-294) ─────────
 *
 * Esa frase de arriba llevaba desde REG-242 siendo una declaración de propósito
 * que nada comprobaba: la hoja se componía del borrador EN CURSO y se podía
 * copiar al portapapeles a medio dictar. `notaFirmada` es obligatoria y de ella
 * sale el estado DRAFT/RELEASED; sin RELEASED no se entrega.
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
import { ClipboardCheck, Copy, Printer, Lock } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto, estadoDeLaHoja, sePuedeEntregar, AVISO_BORRADOR,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ¿Está firmada la nota de la que sale esta hoja? — REG-294.
   *
   * OBLIGATORIA a propósito. Si fuera opcional, un sitio de llamada nuevo la
   * olvidaría y la hoja volvería a ser entregable desde un borrador sin que
   * nadie lo notara. Así el compilador obliga a decidirlo en cada pantalla.
   */
  notaFirmada: boolean
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const bloques = useMemo(() => comoSeLoExplico(p), [p])

  const estado = estadoDeLaHoja(p.notaFirmada)
  const entregable = sePuedeEntregar(estado)

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
    /*
      LA COMPUERTA VA AQUÍ, NO SÓLO EN EL `disabled` DEL BOTÓN.
      Un `disabled` se quita desde las herramientas del navegador; y de todos
      modos deshabilitar un control es decorar, no impedir. La puerta tiene que
      estar en el camino que mueve el dato.
    */
    if (!entregable) return
    try {
      await navigator.clipboard.writeText(comoTexto(bloques))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* Sin portapapeles, el botón de imprimir sigue ahí. */ }
  }

  const imprimir = () => {
    if (!entregable) return
    window.print()
  }

  const botonDeshabilitado = {
    opacity: 0.5, cursor: 'not-allowed' as const,
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
          <button
            onClick={copiar}
            disabled={!entregable}
            title={entregable ? undefined : AVISO_BORRADOR}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
              ...(entregable ? {} : botonDeshabilitado),
            }}
          >
            {copiado ? <ClipboardCheck size={14} /> : <Copy size={14} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={imprimir}
            disabled={!entregable}
            title={entregable ? undefined : AVISO_BORRADOR}
            aria-label="Imprimir la hoja del paciente"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
              ...(entregable ? {} : botonDeshabilitado),
            }}
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </header>

      {/*
        EL AVISO DE BORRADOR SE IMPRIME — y ésa es la mitad que importa.

        Deshabilitar los botones sólo cierra el camino de ESTA pantalla. El
        médico puede darle a Ctrl+P del navegador, y la página de consulta
        esconde los `button` al imprimir (`@media print`), así que el papel
        saldría idéntico a uno entregable: sin un solo rastro de que la nota no
        estaba firmada.

        Por eso este aviso NO lleva `no-print`. Si la hoja acaba en papel
        estando en borrador, el papel lo dice.
      */}
      {!entregable && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
            color: 'var(--amber)', fontSize: 13, fontWeight: 600,
          }}
        >
          <Lock size={14} aria-hidden />
          {AVISO_BORRADOR}
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
