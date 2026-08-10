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
 * Esta hoja se compone del borrador **en curso**: el médico dicta y ella se
 * actualiza en vivo. Eso es lo que la hace útil durante la consulta, y era
 * también su defecto — «Copiar» estaba disponible desde el primer minuto, así
 * que lo que salía al WhatsApp del paciente podía ser una dosis a medio
 * corregir. La hoja no mentía: enseñaba lo que había. Nadie decía que lo que
 * había todavía no estaba firmado.
 *
 * Ahora **mirar sigue siendo libre y salir no**. Mientras la nota es borrador la
 * hoja se ve, marcada como borrador, y las dos salidas al mundo —copiar e
 * imprimir— están cerradas. Es la misma frase de la especificación aplicada un
 * paso antes del portal: «never expose a clinical draft to the patient as
 * final».
 *
 * El estado llega por `prop` y no se adivina aquí: quien sabe si la nota está
 * firmada es la pantalla que la tiene, y una segunda fuente de verdad sobre lo
 * mismo es exactamente lo que el invariante nº1 prohíbe.
 */
import { useMemo, useState } from 'react'
import { ClipboardCheck, Copy, Printer, FileClock } from 'lucide-react'
import {
  comoSeLoExplico, comoTexto,
  type EntradaInstrucciones,
} from '@/lib/paciente/como-se-lo-explico'

export interface HojaParaElPacienteProps extends EntradaInstrucciones {
  /** Se imprime en la hoja; no se usa para nada más. */
  nombreDelPaciente?: string
  /**
   * ¿La nota de la que sale esta hoja está firmada?
   *
   * Sin `true`, la hoja se ve pero **no sale**: nada de copiar ni de imprimir.
   * El valor por omisión es `false` a propósito — una compuerta cuyo estado
   * seguro depende de que alguien se acuerde de pasarlo no es una compuerta.
   */
  firmada?: boolean
}

export function HojaParaElPaciente(p: HojaParaElPacienteProps) {
  const [copiado, setCopiado] = useState(false)
  const bloques = useMemo(() => comoSeLoExplico(p), [p])
  const firmada = p.firmada === true

  /* Sin nada que decirle al paciente no se enseña una hoja vacía. */
  if (!bloques.length) return null

  const copiar = async () => {
    /* Cinturón además de los tirantes: el botón no se pinta sin firma, pero la
       comprobación vive también aquí porque un botón escondido no cierra nada. */
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

        <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {firmada ? (
            <>
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
            </>
          ) : (
            /*
              BORRADOR: se ve, no sale. Se dice con palabras y con un icono, no
              sólo con un botón gris — un control deshabilitado sin explicación
              se lee como un fallo de la aplicación.
            */
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
              <FileClock size={14} aria-hidden />
              Borrador — se podrá copiar e imprimir cuando firme la nota
            </span>
          )}
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

export const POR_QUE_SE_PUEDE_COPIAR =
  'El paciente mexicano lleva WhatsApp, no siempre impresora. Copiar es la vía ' +
  'más corta entre la consulta y su teléfono, y no inventa un canal nuevo que ' +
  'haya que mantener.'

export const POR_QUE_EL_BORRADOR_NO_SALE =
  'Mirar es libre; salir no. Mientras la nota es borrador la hoja se ve marcada ' +
  'como tal y las dos salidas al mundo —copiar e imprimir— están cerradas. Lo ' +
  'que se copia al WhatsApp del paciente ya no puede ser una dosis a medio ' +
  'corregir.'

export const POR_QUE_NO_SE_ENSENA_VACIA =
  'Una hoja que dice «Estudios: —» le hace leer al paciente una línea que no le ' +
  'dice nada.'
