'use client'
/**
 * DÓNDE SE ATORA UN MÉDICO NUEVO.
 *
 * El charter pide «nuevo médico funcional sin asistencia humana». Eso no se
 * puede afirmar ni desmentir sin mirar el camino real, y lo que importa no es el
 * promedio —lo dominan los que llegaron al final— sino el paso donde se quedan
 * los que no llegaron: ésa es la pantalla que hay que arreglar.
 *
 * Los hitos que NO se pueden medir sin entrar al expediente se declaran como
 * huecos. Un hueco honesto vale más que un número sacado de donde no se debe
 * mirar.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, Route as RouteIcon, Loader2, AlertTriangle } from 'lucide-react'
import { duracionCorta, type ClaveHito, type Hito } from '@/lib/onboarding/embudo'

interface Paso { clave: ClaveHito; alcanzado: boolean; desdeCuentaMs: number | null }
interface Fila {
  clinicId: string; nombre: string; plan: string; estado: string; creada: string | null
  atoradoEn: ClaveHito | null; queHacer: string | null; pasos: Paso[]
}
interface Datos {
  hitos: Hito[]
  hitosSinSeñal: ClaveHito[]
  consultorios: Fila[]
  resumen: { total: number; atorados: Record<string, number>; medianaHasta: Record<string, number | null> }
}

export default function OnboardingSuperadmin() {
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    fetchAutenticado('/api/superadmin/onboarding')
      .then(r => r.json())
      .then(x => { if (!vivo) return; if (x.ok) setD(x); else setError(x.error || 'No se pudo leer.') })
      .catch(() => { if (vivo) setError('No se pudo leer el embudo.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [])

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <RouteIcon size={20} style={{ color: 'var(--teal)' }} /> Dónde se atoran
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 720 }}>
        El camino de cada consultorio nuevo. Lo que importa no es el promedio —lo dominan los que
        llegaron al final— sino <strong>el paso donde se quedan los que no llegaron</strong>.
        <br />
        Se deriva de tu libro de costos, que es registro tuyo: <strong>no se entra a ningún expediente</strong>.
        Por eso hay hitos sin señal, y se marcan como tales en vez de rellenarlos.
      </p>

      {cargando && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 20 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Calculando…</div>}
      {error && <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13 }}>{error}</div>}

      {d && !cargando && (
        <>
          {/* Dónde se quedan — es lo único accionable de la pantalla. */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Se quedan aquí</div>
            {Object.entries(d.resumen.atorados).sort((a, b) => b[1] - a[1]).map(([clave, n]) => {
              const hito = d.hitos.find(h => h.clave === clave)
              return (
                <div key={clave} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 17, fontWeight: 800, minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{hito ? hito.etiqueta : 'Completaron todo'}</div>
                    {hito && <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>{hito.siSeAtora}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {d.hitosSinSeñal.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 13px', borderRadius: 9, background: 'var(--s1)', border: '1px solid var(--border)', marginBottom: 18 }}>
              <AlertTriangle size={15} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.55 }}>
                Sin señal medible desde fuera del expediente:{' '}
                <strong>{d.hitosSinSeñal.map(c => d.hitos.find(h => h.clave === c)?.etiqueta ?? c).join(' · ')}</strong>.
                Aparecen siempre como no alcanzados — no significa que el médico no los haya hecho.
              </div>
            </div>
          )}

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr style={{ background: 'var(--s2)', textAlign: 'left' }}>
                  <th style={th}>Consultorio</th>
                  <th style={th}>Alta</th>
                  {d.hitos.map(h => <th key={h.clave} style={th}>{h.etiqueta}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.consultorios.map(c => (
                  <tr key={c.clinicId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {c.nombre}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.plan} · {c.estado}</div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text3)' }}>{c.creada ?? '—'}</td>
                    {c.pasos.map(p => (
                      <td key={p.clave} style={{ ...td, whiteSpace: 'nowrap', color: p.alcanzado ? 'var(--text)' : 'var(--text3)' }}>
                        {p.alcanzado ? duracionCorta(p.desdeCuentaMs) : '·'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 11px', fontWeight: 700, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '9px 11px' }
