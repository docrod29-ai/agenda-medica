'use client'
/**
 * SELLO DE PROCEDENCIA — trazabilidad medicolegal de la nota, en una sola tira.
 *
 * Responde de un vistazo "¿de dónde salió cada dato de esta nota?": cuántos del
 * dictado (con cita textual), cuántos de inferencia de IA, cuántos capturados a
 * mano. Se puede desplegar para ver campo por campo, con la frase exacta del
 * dictado cuando existe. Es solo lectura: no cambia ningún valor clínico.
 */
import { useMemo, useState } from 'react'
import { Fingerprint, Mic, Sparkles, PenLine, ChevronDown, Quote, CheckCircle2, Calculator, Activity } from 'lucide-react'
import { construirManifiesto, resumenProcedencia, etiquetaOrigen, type OrigenCampo } from '@/lib/expediente/procedencia'

interface FinalNota {
  diagnosticos?: { descripcion?: string }[]
  medicamentos?: { nombre?: string; dosis?: string }[]
  alergias?: (string | { alergeno?: string })[]
  signosVitales?: Record<string, unknown>
}

interface Props {
  final: FinalNota
  extraction?: unknown
  /**
   * Los vistos buenos del panel de revisión, para poder distinguir «la IA lo
   * propuso» de «la IA lo propuso Y el médico lo aceptó». Opcional: sin él, el
   * sello es exactamente el de antes.
   */
  aprobados?: ReadonlySet<string>
  /** La transcripción del dictado, para comprobar que las citas textuales existen. */
  transcripcion?: string
}

/**
 * Los dos orígenes SIN AUTOR HUMANO van con su propio icono a propósito: quien
 * mira el sello tiene que distinguir de un vistazo lo que afirmó una persona de
 * lo que midió un aparato o dedujo una fórmula. Meterlos en el icono de «a
 * mano» sería decir que el médico lo escribió.
 */
const ESTILO: Record<OrigenCampo, { color: string; Icon: typeof Mic }> = {
  dictado:   { color: 'var(--teal, #2DD4BF)', Icon: Mic },
  ia:        { color: 'var(--nexus, #3D5AFE)', Icon: Sparkles },
  manual:    { color: 'var(--text3)', Icon: PenLine },
  calculado: { color: 'var(--blue)', Icon: Calculator },
  importado: { color: 'var(--purple)', Icon: Activity },
}

export function SelloProcedencia({ final, extraction, aprobados, transcripcion }: Props) {
  const [abierto, setAbierto] = useState(false)
  const manifiesto = useMemo(
    // La transcripción permite verificar que la cita textual EXISTE. Si no se
    // pasa, el sello se comporta como antes en vez de degradar lo que quizá
    // estaba bien.
    () => construirManifiesto(final, extraction as never, aprobados, { transcripcion }),
    [final, extraction, aprobados, transcripcion],
  )
  if (manifiesto.resumen.total === 0) return null
  const { resumen, campos } = manifiesto

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1, rgba(127,127,127,0.04))', marginTop: 8 }}>
      <button
        onClick={() => setAbierto(a => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}
      >
        <Fingerprint size={15} style={{ color: 'var(--nexus, #3D5AFE)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Procedencia de la nota</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{resumenProcedencia(resumen)}</span>
        <ChevronDown size={15} style={{ marginLeft: 'auto', color: 'var(--text3)', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {abierto && (
        <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 4 }}>
            Cada dato estructurado de la nota, con su origen. Lo <strong style={{ color: 'var(--teal, #2DD4BF)' }}>del dictado</strong> conserva la frase exacta; lo <strong style={{ color: 'var(--nexus, #3D5AFE)' }}>de IA</strong> es inferencia sin cita literal; lo <strong>a mano</strong> lo capturaste tú.
          </div>
          {campos.map(c => {
            const { color, Icon } = ESTILO[c.origen]
            return (
              <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Icon size={13} style={{ color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1, minWidth: 120 }}>
                    <span style={{ color: 'var(--text3)' }}>{c.etiqueta}:</span> {c.valor}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color, background: 'color-mix(in srgb, currentColor 12%, transparent)', padding: '2px 7px', borderRadius: 'var(--r-pill)' }}>
                    {etiquetaOrigen(c.origen)}
                  </span>
                  {/*
                    El distintivo del médico va APARTE del de origen, no en su
                    lugar: de dónde salió un dato y si un humano lo hizo suyo son
                    dos cosas distintas, y en una revisión la segunda pesa más.
                  */}
                  {c.confirmado === true && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal, #2DD4BF)', display: 'inline-flex', alignItems: 'center', gap: 3, background: 'color-mix(in srgb, currentColor 12%, transparent)', padding: '2px 7px', borderRadius: 'var(--r-pill)' }}>
                      <CheckCircle2 size={10} /> lo aceptaste
                    </span>
                  )}
                </div>
                {c.cita && (
                  <div style={{ marginTop: 5, display: 'flex', gap: 5, fontSize: 11.5, color: 'var(--text2)', fontStyle: 'italic' }}>
                    <Quote size={11} style={{ flexShrink: 0, marginTop: 2, opacity: 0.6 }} />
                    <span>
                      “{c.cita}”
                      {/*
                        QUIÉN LO DIJO, cuando no fue el paciente. La regla V3
                        aceptaba a cualquiera que no fuera el médico, así que un
                        antecedente que sostiene la hija —«sí, es diabética»— se
                        sellaba igual que si lo hubiera dicho la paciente. No se
                        degrada: se dice quién, que es un hecho.
                      */}
                      {c.dichoPor && (
                        <span style={{ fontStyle: 'normal', color: 'var(--text3)' }}> — lo dijo: {c.dichoPor}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
