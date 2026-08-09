'use client'
/**
 * ¿ESTE PLAN GANA O PIERDE DINERO?
 *
 * Lo que se busca no es el margen bonito: es el PUNTO DE PÉRDIDA — a partir de
 * cuántas notas al mes ese cliente cuesta más de lo que paga.
 *
 * La pantalla enseña lo que falta con la misma prominencia que los números.
 * Un margen calculado sobre la mitad de los costos se ve exactamente igual que
 * uno completo, y de él sale la decisión de a cuánto vender.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, Calculator, Loader2, AlertTriangle } from 'lucide-react'
import type { Simulacion } from '@/lib/finanzas/simulador'

interface PorPerfil { perfil: string; etiqueta: string; unitario: Simulacion }
interface FilaPlan { clave: string; nombre: string; precioMXN: number; porPerfil: PorPerfil[] }
interface Datos {
  medido: { rapida: number | null; estandar: number | null; maxima: number | null; muestras: Record<string, number> }
  otros: Record<string, number | null>
  usdMxn: number | null
  matriz: FilaPlan[]
}

const CAMPOS: { k: string; etiqueta: string; sufijo: string }[] = [
  { k: 'usdMxn', etiqueta: 'Tipo de cambio USD→MXN', sufijo: '' },
  { k: 'comisionPagoPct', etiqueta: 'Comisión del procesador', sufijo: '%' },
  { k: 'infraPorUsuario', etiqueta: 'Infraestructura / usuario', sufijo: 'MXN' },
  { k: 'soportePorUsuario', etiqueta: 'Soporte / usuario', sufijo: 'MXN' },
  { k: 'mensajeriaPorUsuario', etiqueta: 'Mensajería / usuario', sufijo: 'MXN' },
]

export default function SimuladorSuperadmin() {
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [borrador, setBorrador] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    fetchAutenticado('/api/superadmin/simulador')
      .then(r => r.json())
      .then(x => { if (!vivo) return; if (x.ok) { setD(x); setError('') } else setError(x.error || 'No se pudo leer.') })
      .catch(() => { if (vivo) setError('No se pudo calcular la simulación.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [recarga])

  const valor = (k: string) => borrador[k] ?? String((k === 'usdMxn' ? d?.usdMxn : d?.otros?.[k]) ?? '')

  const guardar = async () => {
    setGuardando(true)
    const cuerpo: Record<string, number> = {}
    for (const { k } of CAMPOS) {
      const v = Number(valor(k))
      if (Number.isFinite(v) && v > 0) cuerpo[k] = v
    }
    try {
      await fetchAutenticado('/api/superadmin/simulador', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      setBorrador({}); setRecarga(n => n + 1)
    } catch { setError('No se pudo guardar.') } finally { setGuardando(false) }
  }

  const mxn = (n: number | null) =>
    n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <Calculator size={20} style={{ color: 'var(--teal)' }} /> ¿Gana o pierde cada plan?
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 720 }}>
        El costo de IA por nota está <strong>medido de tu libro de costos</strong> — es lo que ya se
        gastó, no una estimación. Lo que este sistema no puede medir lo cargas tú abajo:
        mientras falte, <strong>el margen sale vacío a propósito</strong>. Un margen calculado sobre la
        mitad de los costos se ve igual que uno completo.
      </p>

      {cargando && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 20 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Calculando…</div>}
      {error && <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13 }}>{error}</div>}

      {d && !cargando && (
        <>
          {/* Lo medido, con su muestra: sin cuántas llamadas lo sostienen, un promedio no se puede creer. */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '13px 15px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Costo real por nota (medido)</div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {(['rapida', 'estandar', 'maxima'] as const).map(m => (
                <div key={m}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{m}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {d.medido[m] == null ? '—' : `$${d.medido[m]!.toFixed(3)} USD`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.medido.muestras?.[m] ?? 0} llamadas</div>
                </div>
              ))}
            </div>
          </div>

          {/* Lo que falta cargar: con la misma prominencia que los números. */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '13px 15px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Lo que este sistema no puede medir</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
              Cárgalo con su fuente. Nace vacío a propósito: una cifra de memoria produce un margen que
              parece exacto y miente.
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {CAMPOS.map(c => (
                <div key={c.k}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>{c.etiqueta} {c.sufijo}</label>
                  <input
                    type="number" min={0} step="any" inputMode="decimal"
                    value={valor(c.k)}
                    onChange={e => setBorrador(p => ({ ...p, [c.k]: e.target.value }))}
                    placeholder="—"
                    style={{ width: 130, padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
            <button onClick={guardar} disabled={guardando} style={{ marginTop: 12, background: 'var(--nexus-solido)', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar y recalcular'}
            </button>
          </div>

          {d.matriz.map(plan => (
            <div key={plan.clave} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 7 }}>
                {plan.nombre} · {mxn(plan.precioMXN)}/mes
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: 'var(--s2)', textAlign: 'left' }}>
                      <th style={th}>Perfil de uso</th>
                      <th style={th}>Costo de IA</th>
                      <th style={th}>Margen</th>
                      <th style={th}>Pierde a partir de</th>
                      <th style={th}>Falta cargar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.porPerfil.map(p => {
                      const s = p.unitario
                      const pierde = s.margenMXN != null && s.margenMXN < 0
                      return (
                        <tr key={p.perfil} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...td, fontWeight: 600 }}>{p.etiqueta}</td>
                          <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{mxn(s.costoIaMXN)}</td>
                          <td style={{ ...td, fontVariantNumeric: 'tabular-nums', color: pierde ? 'var(--red)' : undefined, fontWeight: pierde ? 700 : 400 }}>
                            {s.margenMXN == null ? '—' : `${mxn(s.margenMXN)}${s.margenPct != null ? ` · ${s.margenPct}%` : ''}`}
                          </td>
                          <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                            {s.puntoDePerdidaNotas == null ? '—' : `${s.puntoDePerdidaNotas} notas/mes`}
                          </td>
                          <td style={{ ...td, fontSize: 11.5, color: 'var(--text3)' }}>
                            {s.faltan.length === 0 ? '✓ nada' : s.faltan.join(' · ')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              «Pierde a partir de» se calcula sólo con el costo de IA, así que es un <strong>techo
              optimista</strong>: con la comisión y la infraestructura el punto real llega antes. Se
              enseña igual porque aproximado vale más que nada — pero no entra en el margen.
            </span>
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 11px', fontWeight: 700, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '9px 11px' }
