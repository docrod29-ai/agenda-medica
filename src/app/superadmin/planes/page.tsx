'use client'
/**
 * PRECIOS — la pantalla que quita la dependencia de un programador.
 *
 * Subir el plan Clínica de $899 a $949 exigía editar un archivo, compilar y
 * desplegar. Aquí se hace en treinta segundos, que es lo que tarda la decisión.
 *
 * Sólo dinero: el precio y los créditos incluidos. Lo que INCLUYE cada plan no
 * se edita desde aquí —es permiso de acceso, y se abriría un módulo que nadie
 * pagó con un dedazo—.
 *
 * Y lo que se rechaza SE DICE. Guardar «con éxito» ignorando en silencio la
 * mitad de lo escrito es la peor combinación: el dueño se va convencido de que
 * subió el precio y sigue cobrando el viejo hasta que cuadra el mes.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, Tag, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PLANES_ORDEN, type ClavePlan, type PlanCreditos } from '@/lib/planes-ia'

interface Estado {
  planes: Record<ClavePlan, PlanCreditos>
  version: number
  deFabrica: boolean
  avisos: string[]
  actualizadoEn: string | null
  actualizadoPor: string | null
}

type Borrador = Partial<Record<ClavePlan, { precioMXN?: string; creditos?: string }>>

export default function PreciosSuperadmin() {
  const [d, setD] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [rechazos, setRechazos] = useState<string[]>([])
  const [guardado, setGuardado] = useState(false)
  const [borrador, setBorrador] = useState<Borrador>({})
  const [recarga, setRecarga] = useState(0)

  // Todo el `setState` en la devolución de llamada, nunca en el cuerpo del efecto.
  useEffect(() => {
    let vivo = true
    fetchAutenticado('/api/superadmin/planes')
      .then(r => r.json())
      .then(x => {
        if (!vivo) return
        if (x.ok) { setD(x); setError('') } else setError(x.error || 'No se pudo leer.')
      })
      .catch(() => { if (vivo) setError('No se pudo leer el catálogo.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [recarga])

  const campo = (c: ClavePlan, k: 'precioMXN' | 'creditos') =>
    borrador[c]?.[k] ?? String(d?.planes[c]?.[k] ?? '')

  const editar = (c: ClavePlan, k: 'precioMXN' | 'creditos', v: string) => {
    setGuardado(false)
    setBorrador(prev => ({ ...prev, [c]: { ...prev[c], [k]: v } }))
  }

  const guardar = async () => {
    setGuardando(true); setRechazos([]); setGuardado(false)
    /**
     * Sólo viaja lo que se TOCÓ. Mandar todos los campos convertiría cualquier
     * guardado en un ajuste explícito de los cuatro planes, y entonces los que
     * nadie cambió dejarían de seguir al código: un cambio de tarifa de fábrica
     * ya no llegaría nunca a ese consultorio.
     */
    const ajustes: Record<string, { precioMXN?: number; creditos?: number }> = {}
    for (const c of PLANES_ORDEN) {
      const b = borrador[c]
      if (!b) continue
      const a: { precioMXN?: number; creditos?: number } = {}
      if (b.precioMXN !== undefined && b.precioMXN !== '') a.precioMXN = Number(b.precioMXN)
      if (b.creditos !== undefined && b.creditos !== '') a.creditos = Number(b.creditos)
      if (Object.keys(a).length) ajustes[c] = a
    }
    try {
      const r = await fetchAutenticado('/api/superadmin/planes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ajustes }),
      })
      const x = await r.json()
      if (x.ok) {
        setD(prev => prev ? { ...prev, planes: x.planes, version: x.version, deFabrica: false } : prev)
        setRechazos(x.rechazos ?? [])
        setBorrador({})
        setGuardado(true)
        setRecarga(n => n + 1)
      } else setError(x.error || 'No se pudo guardar.')
    } catch {
      setError('No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const hayCambios = Object.keys(borrador).length > 0

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <Tag size={20} style={{ color: 'var(--teal)' }} /> Precios
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 700 }}>
        Cambiar un precio ya no necesita programador. Aquí se edita el <strong>importe</strong> y los
        <strong> créditos incluidos</strong>; lo que trae cada plan no se toca desde esta pantalla —eso es
        acceso, y se abriría un módulo sin pagar con un dedazo—.
        <br />
        <strong>Quien ya está suscrito conserva su precio.</strong> Un cambio vale para quien contrate después.
      </p>

      {cargando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 20 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </div>
      )}

      {error && (
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
          {error} — <button onClick={() => { setError(''); setRecarga(n => n + 1) }} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>reintentar</button>
        </div>
      )}

      {/* Lo rechazado se enseña SIEMPRE, aunque el guardado saliera bien. */}
      {rechazos.length > 0 && (
        <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--amber, #F59E0B)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, marginBottom: 5 }}>
            <AlertTriangle size={15} style={{ color: 'var(--amber, #F59E0B)' }} /> Esto NO se guardó
          </div>
          {rechazos.map((r, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>· {r}</div>)}
        </div>
      )}

      {guardado && rechazos.length === 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--teal)', background: 'rgba(20,184,166,0.08)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <CheckCircle2 size={15} style={{ color: 'var(--teal)' }} /> Guardado. Los precios nuevos ya salen en toda la aplicación.
        </div>
      )}

      {d && !cargando && (
        <>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
              <thead>
                <tr style={{ background: 'var(--s2)', textAlign: 'left' }}>
                  <th style={th}>Plan</th>
                  <th style={th}>Precio MXN / mes</th>
                  <th style={th}>Créditos de IA / mes</th>
                </tr>
              </thead>
              <tbody>
                {PLANES_ORDEN.map(c => (
                  <tr key={c} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{d.planes[c].nombre}</td>
                    <td style={td}>
                      <input
                        type="number" min={1} step={1} inputMode="numeric"
                        value={campo(c, 'precioMXN')}
                        onChange={e => editar(c, 'precioMXN', e.target.value)}
                        style={inp}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number" min={0} step={1} inputMode="numeric"
                        value={campo(c, 'creditos')}
                        onChange={e => editar(c, 'creditos', e.target.value)}
                        style={inp}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              onClick={guardar}
              disabled={!hayCambios || guardando}
              style={{
                background: hayCambios ? 'var(--teal)' : 'var(--s2)',
                color: hayCambios ? '#000' : 'var(--text3)',
                border: 'none', borderRadius: 8, padding: '9px 18px',
                fontSize: 13.5, fontWeight: 700, cursor: hayCambios ? 'pointer' : 'default',
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar precios'}
            </button>
            {hayCambios && (
              <button onClick={() => { setBorrador({}); setGuardado(false) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>
                Descartar cambios
              </button>
            )}
            <span style={{ fontSize: 11.5, color: 'var(--text3)', marginLeft: 'auto' }}>
              {d.deFabrica
                ? 'Ahora mismo se usan los precios de fábrica.'
                : `Versión ${d.version}${d.actualizadoPor ? ` · ${d.actualizadoPor}` : ''}${d.actualizadoEn ? ` · ${d.actualizadoEn.slice(0, 10)}` : ''}`}
            </span>
          </div>

          {d.avisos.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              {d.avisos.map((a, i) => <div key={i}>· {a}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 700, color: 'var(--text3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '9px 12px' }
const inp: React.CSSProperties = {
  width: 130, padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontVariantNumeric: 'tabular-nums',
}
