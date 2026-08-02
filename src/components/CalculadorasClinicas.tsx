'use client'
/**
 * Calculadoras clínicas CONTEXTUALES: se sugieren solas según el diagnóstico de la
 * nota, se llenan en dos clics y el resultado se puede pegar a la nota con su cita.
 * Apoyo a la decisión — no sustituye el juicio clínico.
 */
import { useMemo, useState } from 'react'
import { Calculator, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { calculadorasSugeridas, type Calculadora, type ResultadoCalc } from '@/lib/expediente/calculadoras'

interface Props {
  /** Texto de diagnósticos + motivo para decidir qué scores sugerir. */
  contexto: string
  /** Si se pasa, aparece el botón para pegar el resultado en la nota. */
  onAgregarANota?: (texto: string) => void
  /** Dentro de la barra de herramientas: sin marco ni título propios. */
  embebido?: boolean
}

export function CalculadorasClinicas({ contexto, onAgregarANota, embebido }: Props) {
  const sugeridas = useMemo(() => calculadorasSugeridas(contexto), [contexto])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, Record<string, number>>>({})

  if (sugeridas.length === 0) return null

  /**
   * `valor === undefined` BORRA el campo (el médico volvió a "—").
   * Antes se guardaba Number('') = 0, indistinguible de una opción legítima de
   * valor 0 (p. ej. troponina "Normal" en HEART), y el score se calculaba con
   * campos sin responder. Ver `camposSinResponder` en calculadoras.ts.
   */
  const setVal = (calcId: string, key: string, valor: number | undefined) =>
    setValores(v => {
      const actual = { ...(v[calcId] ?? {}) }
      if (valor === undefined) delete actual[key]
      else actual[key] = valor
      return { ...v, [calcId]: actual }
    })

  return (
    <div style={embebido ? {} : { border: '1px solid rgba(20,184,166,.3)', borderRadius: 12, background: 'rgba(20,184,166,.05)', padding: 14, marginBottom: 12 }}>
      {!embebido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <Calculator size={15} color="var(--teal)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>
            Calculadoras sugeridas por el diagnóstico
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>({sugeridas.length})</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sugeridas.map(c => {
          const v = valores[c.id] ?? {}
          const abierto = abierta === c.id
          const res: ResultadoCalc | null = abierto || Object.keys(v).length ? c.calcular(v) : null
          return (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s1)', overflow: 'hidden' }}>
              <button type="button" onClick={() => setAbierta(a => (a === c.id ? null : c.id))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                {abierto ? <ChevronUp size={15} color="var(--text3)" /> : <ChevronDown size={15} color="var(--text3)" />}
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{c.nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1, minWidth: 0 }}>{c.para}</span>
                {res && !res.incompleto && Object.keys(v).length > 0 && (
                  <span style={{ ...badge(res.nivel), whiteSpace: 'nowrap' }}>{res.puntaje} · {res.categoria}</span>
                )}
              </button>

              {abierto && (
                <div style={{ padding: '0 12px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {c.campos.map(campo => (
                      <div key={campo.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{campo.label}</span>
                        {campo.tipo === 'bool' && (
                          <button type="button" onClick={() => setVal(c.id, campo.key, v[campo.key] ? 0 : 1)}
                            style={toggle(!!v[campo.key])}>{v[campo.key] ? 'Sí' : 'No'}</button>
                        )}
                        {campo.tipo === 'opciones' && (
                          <select value={String(v[campo.key] ?? '')}
                            onChange={e => setVal(c.id, campo.key, e.target.value === '' ? undefined : Number(e.target.value))}
                            style={select}>
                            <option value="">—</option>
                            {campo.opciones?.map(o => <option key={o.label} value={o.valor}>{o.label}</option>)}
                          </select>
                        )}
                        {campo.tipo === 'num' && (
                          <input type="number" inputMode="decimal" value={String(v[campo.key] ?? '')}
                            onChange={e => setVal(c.id, campo.key, Number(e.target.value))}
                            style={{ ...select, width: 90, textAlign: 'right' }} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Score INCOMPLETO: se dice qué falta, sin puntaje ni botón de pegar.
                      Un puntaje parcial subestima la gravedad (ver calculadoras.ts). */}
                  {res?.incompleto && (
                    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--s2)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 2 }}>
                        {c.nombre}: {res.categoria}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>{res.interpretacion}</div>
                    </div>
                  )}

                  {res && !res.incompleto && (
                    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, ...caja(res.nivel) }}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>
                        {c.nombre}: {res.puntaje} — {res.categoria}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{res.interpretacion}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 5, fontStyle: 'italic' }}>{c.referencia}</div>
                      {onAgregarANota && (
                        <button type="button"
                          onClick={() => onAgregarANota(`${c.nombre}: ${res.puntaje} puntos — ${res.categoria}. ${res.interpretacion} (${c.referencia})`)}
                          style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                          <Plus size={13} /> Agregar a la nota
                        </button>
                      )}
                    </div>
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

const COLORES = {
  bajo: { fg: '#10b981', bg: 'rgba(16,185,129,.12)', bd: 'rgba(16,185,129,.35)' },
  medio: { fg: '#f59e0b', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)', bd: 'color-mix(in srgb, var(--amber) 35%, transparent)' },
  alto: { fg: '#f87171', bg: 'color-mix(in srgb, var(--red) 12%, transparent)', bd: 'color-mix(in srgb, var(--red) 40%, transparent)' },
} as const

const badge = (nivel: keyof typeof COLORES): React.CSSProperties => ({
  fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 100,
  background: COLORES[nivel].bg, color: COLORES[nivel].fg,
})
const caja = (nivel: keyof typeof COLORES): React.CSSProperties => ({
  border: `1px solid ${COLORES[nivel].bd}`, background: COLORES[nivel].bg, color: COLORES[nivel].fg,
})
const toggle = (on: boolean): React.CSSProperties => ({
  minWidth: 46, height: 28, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid ' + (on ? '#f59e0b' : 'var(--border)'),
  background: on ? '#f59e0b' : 'var(--s2)', color: on ? '#000' : 'var(--text3)',
})
const select: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none', maxWidth: 240,
}

export type { Calculadora }
