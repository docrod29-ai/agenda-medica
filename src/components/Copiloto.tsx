'use client'
/**
 * COPILOTO — la única superficie del motor contextual.
 *
 * Reglas que sigue, a propósito:
 *  · Si no hay nada que decir, NO se pinta. El silencio es la condición normal.
 *  · No pide datos con formularios: lo que ya está capturado se usa, y lo que
 *    falta se menciona en una línea.
 *  · Un toque para pasar algo a la nota. Sin confirmaciones ni diálogos.
 *  · Lo que puede dañar al paciente va primero y se ve distinto.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Plus, Sparkles } from 'lucide-react'
import {
  copiloto, textoParaNota,
  type EntradaCopiloto, type Sugerencia, type NivelSugerencia,
} from '@/lib/expediente/copiloto'
import { ordenarPorPreferencia, categoriaDe, type Preferencias } from '@/lib/learning'

interface Props {
  entrada: EntradaCopiloto
  onAgregarANota?: (texto: string) => boolean | void
  /** Learning Engine: frecuencias por categoría de ESTE médico (reordena no-críticas). */
  prefs?: Preferencias
  /** Se llama cuando el médico ACEPTA una sugerencia (para aprender su estilo). */
  onAceptar?: (categoria: string) => void
}

const COLOR: Record<NivelSugerencia, { fg: string; bg: string; bd: string }> = {
  critico: { fg: '#F87171', bg: 'color-mix(in srgb, var(--red) 8%, transparent)', bd: 'color-mix(in srgb, var(--red) 35%, transparent)' },
  accion:  { fg: '#F59E0B', bg: 'color-mix(in srgb, var(--amber) 7%, transparent)', bd: 'color-mix(in srgb, var(--amber) 30%, transparent)' },
  info:    { fg: 'var(--text2)', bg: 'var(--s1)', bd: 'var(--border)' },
}

export function Copiloto({ entrada, onAgregarANota, prefs, onAceptar }: Props) {
  // Learning Engine: reordena las NO críticas por lo que este médico suele usar
  // (las críticas quedan pinneadas arriba por seguridad).
  const sugerencias = useMemo(() => ordenarPorPreferencia(copiloto(entrada), prefs ?? {}), [entrada, prefs])
  const [puestas, setPuestas] = useState<Set<string>>(new Set())
  const [abierto, setAbierto] = useState<string | null>(null)

  // Silencio: sin hallazgos no existe el bloque.
  if (sugerencias.length === 0) return null

  const criticos = sugerencias.filter(s => s.nivel === 'critico')
  const documentables = sugerencias.filter(s => s.textoNota && !puestas.has(s.id))

  const poner = (s: Sugerencia) => {
    if (!onAgregarANota || !s.textoNota) return
    // Solo se marca como "puesta" si REALMENTE se agregó. Con la nota firmada,
    // onAgregarANota devuelve false (no se puede enmendar sin adenda) y antes el
    // Copiloto igual pintaba el check verde: un falso éxito medicolegal.
    if (onAgregarANota(s.textoNota) !== false) {
      setPuestas(p => new Set(p).add(s.id))
      onAceptar?.(categoriaDe(s.id))   // aprende del estilo del médico
    }
  }
  const ponerTodo = () => {
    if (!onAgregarANota || documentables.length === 0) return
    if (onAgregarANota(textoParaNota(documentables)) !== false) {
      setPuestas(p => { const n = new Set(p); documentables.forEach(s => n.add(s.id)); return n })
      documentables.forEach(s => onAceptar?.(categoriaDe(s.id)))
    }
  }

  return (
    <div style={{
      border: `1px solid ${criticos.length ? COLOR.critico.bd : 'rgba(96,165,250,.28)'}`,
      background: criticos.length ? COLOR.critico.bg : 'rgba(96,165,250,.05)',
      borderRadius: 14, padding: 14, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {criticos.length
          ? <AlertTriangle size={16} color={COLOR.critico.fg} />
          : <Sparkles size={16} color="var(--blue)" />}
        <strong style={{ fontSize: 13.5, color: 'var(--text)' }}>
          {criticos.length
            ? `${criticos.length} ${criticos.length === 1 ? 'cosa que revisar' : 'cosas que revisar'} antes de firmar`
            : 'Para este paciente'}
        </strong>
        {documentables.length > 0 && onAgregarANota && (
          <button type="button" onClick={ponerTodo} style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--nexus-solido)', color: '#FFF', border: 'none', borderRadius: 8,
            padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 36,
          }}>
            <Plus size={13} /> Todo a la nota
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {sugerencias.map(s => {
          const c = COLOR[s.nivel]
          const puesta = puestas.has(s.id)
          const abierta = abierto === s.id
          return (
            <div key={s.id} style={{
              border: `1px solid ${c.bd}`, background: c.bg, borderRadius: 10, overflow: 'hidden',
            }}>
              <button type="button" onClick={() => setAbierto(a => (a === s.id ? null : s.id))}
                aria-expanded={abierta}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', minHeight: 44,
                }}>
                {s.nivel === 'critico' && <AlertTriangle size={14} color={c.fg} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: s.nivel === 'critico' ? 700 : 600, color: s.nivel === 'info' ? 'var(--text)' : c.fg }}>
                  {s.titulo}
                </span>
                {puesta && <Check size={14} color="var(--green)" style={{ flexShrink: 0 }} />}
                {abierta ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
              </button>

              {abierta && (
                <div style={{ padding: '0 12px 12px' }}>
                  <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0, lineHeight: 1.55 }}>{s.detalle}</p>
                  {s.pide && (
                    <p style={{ fontSize: 11.5, color: 'var(--amber)', margin: '6px 0 0' }}>
                      Captura {s.pide} arriba y esto se calcula solo.
                    </p>
                  )}
                  {s.textoNota && onAgregarANota && !puesta && (
                    <button type="button" onClick={() => poner(s)} style={{
                      marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'rgba(20,184,166,.15)', color: 'var(--teal)',
                      border: '1px solid rgba(20,184,166,.35)', borderRadius: 8,
                      padding: '7px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minHeight: 36,
                    }}>
                      <Plus size={13} /> Agregar a la nota
                    </button>
                  )}
                  {puesta && (
                    <p style={{ fontSize: 11.5, color: 'var(--green)', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} /> Ya está en la nota
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
