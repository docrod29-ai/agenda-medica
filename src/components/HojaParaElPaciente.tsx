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
import { ClipboardCheck, Copy, Printer, Lock, Send, Check } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ── LA COMPUERTA DE FIRMA (V9 `POSTVISIT-GATE-001`, REG-307) ──────────────
   *
   * Obligatoria, y sin valor por defecto a propósito. La hoja se componía del
   * **borrador en curso** —el estado vivo de medicamentos y estudios— y la única
   * guarda era «no es paciente internado». Justo encima, `ComoCerrarLaConsulta`
   * sí exigía `firmada`. El médico podía copiar y entregar una hoja hecha de una
   * nota a medio dictar, y el paciente no tiene cómo saberlo.
   *
   * Un valor por defecto (`= true`) habría dejado la puerta abierta al segundo
   * llamador que se olvide de pasarlo, que es como se pierden estas compuertas.
   */
  notaFirmada: boolean
  /**
   * Liberar el paquete hacia el portal del paciente. Ausente = esta pantalla no
   * tiene por dónde entregarlo (p. ej. una vista de sólo lectura).
   *
   * El componente no habla con la red: la compone quien la monta, que es quien
   * sabe de qué consultorio, paciente y nota se trata.
   */
  onLiberar?: () => void | Promise<void>
  /** Estado de la entrega, para que el botón diga la verdad mientras trabaja. */
  entrega?: 'inactiva' | 'enviando' | 'liberada'
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

        {/*
          SIN FIRMA NO HAY ENTREGA. Los botones que sacan la hoja del consultorio
          —copiar, imprimir y liberar— no se renderizan mientras la nota es un
          borrador. Deshabilitarlos habría dejado tres controles apagados sin
          decir por qué; se dice.
        */}
        {p.notaFirmada ? (
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
            {p.onLiberar && (
              /* Primitivo compartido (`btn`), no un botón repintado a mano: es la
                 acción principal de esta cabecera y el sistema de diseño ya la
                 tiene resuelta, estados de foco incluidos. */
              <button
                className={`btn btn-sm ${p.entrega === 'liberada' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => { void p.onLiberar?.() }}
                disabled={p.entrega === 'enviando' || p.entrega === 'liberada'}
                aria-label="Liberar esta hoja al portal del paciente"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {p.entrega === 'liberada' ? <Check size={14} /> : <Send size={14} />}
                {p.entrega === 'liberada' ? 'En su portal'
                  : p.entrega === 'enviando' ? 'Liberando…' : 'Liberar al paciente'}
              </button>
            )}
          </div>
        ) : (
          <div
            className="no-print t-caption"
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--text3)',
            }}
          >
            <Lock size={13} aria-hidden="true" />
            Firma la nota para poder entregarla
          </div>
        )}
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

export const POR_QUE_SE_PUEDE_COPIAR =
  'El paciente mexicano lleva WhatsApp, no siempre impresora. Copiar es la vía ' +
  'más corta entre la consulta y su teléfono, y no inventa un canal nuevo que ' +
  'haya que mantener.'

export const POR_QUE_SIN_FIRMA_NO_SE_ENTREGA =
  'Porque la hoja se compone del estado VIVO de la consulta. Sin firma, lo que ' +
  'se copia o se imprime es un borrador a medio dictar con el membrete del ' +
  'médico, y el paciente no tiene cómo saber que aún no estaba revisado.'

export const POR_QUE_NO_SE_ENSENA_VACIA =
  'Una hoja que dice «Estudios: —» le hace leer al paciente una línea que no le ' +
  'dice nada.'
