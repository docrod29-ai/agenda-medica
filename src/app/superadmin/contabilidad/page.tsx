'use client'
/**
 * Panel de CONTABILIDAD del dueño (solo superadmin). Ingresos, IVA, costos,
 * utilidad y margen — global, por mes, por plan y por cliente. Con exportación a
 * CSV para el contador. El gate real lo hace el servidor (/api/superadmin/*).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, Download, Loader2, TrendingUp } from 'lucide-react'

const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')
const nombreMes = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}
function ultimos12(): string[] {
  const out: string[] = []; const hoy = new Date()
  for (let i = 0; i < 12; i++) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return out
}

interface Cliente { id: string; nombre: string; plan: string; planLabel: string; activa: boolean; mrr: number; ingresoTotal: number; creditos: number; costoIA: number; margen: number | null }
interface Data {
  ok: boolean; mes: string
  resumen: { ingresoMes: number; ivaMes: number; ingresoSinIva: number; costoIA: number; costoStripe: number; costoInfra: number; costoTotal: number; utilidad: number; margen: number; mrr: number; activas: number; clinicas: number; creditosMes: number; ingresoTotalHist: number; numPagosMes: number }
  porMes: { mes: string; ingresos: number }[]
  porPlan: { plan: string; label: string; cantidad: number; mrr: number }[]
  clientes: Cliente[]
  supuestos: { costoPorCreditoMXN: number; infraMensualMXN: number; stripePct: number; iva: number }
}

export default function ContabilidadPage() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<Data | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const meses = useMemo(() => ultimos12(), [])

  useEffect(() => {
    setCargando(true); setError('')
    fetchAutenticado(`/api/superadmin/contabilidad?mes=${mes}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); else setError(d.error || 'No autorizado') })
      .catch(() => setError('Error de conexión'))
      .finally(() => setCargando(false))
  }, [mes])

  const exportarCSV = () => {
    if (!data) return
    const r = data.resumen
    const lineas: string[] = []
    lineas.push(`Contabilidad NexusMED,${data.mes}`)
    lineas.push('')
    lineas.push('RESUMEN DEL MES,MXN')
    lineas.push(`Ingresos (con IVA),${r.ingresoMes}`)
    lineas.push(`IVA contenido (16%),${r.ivaMes}`)
    lineas.push(`Ingreso sin IVA,${r.ingresoSinIva}`)
    lineas.push(`Costo IA,${r.costoIA}`)
    lineas.push(`Comisión Stripe,${r.costoStripe}`)
    lineas.push(`Infraestructura,${r.costoInfra}`)
    lineas.push(`Costo total,${r.costoTotal}`)
    lineas.push(`Utilidad neta,${r.utilidad}`)
    lineas.push(`Margen %,${r.margen}`)
    lineas.push('')
    lineas.push('POR CLIENTE,Plan,Activa,MRR,Ingreso histórico,Créditos mes,Costo IA,Margen %')
    data.clientes.forEach(c => lineas.push(
      `"${c.nombre.replace(/"/g, "'")}",${c.planLabel},${c.activa ? 'Sí' : 'No'},${c.mrr},${c.ingresoTotal},${c.creditos},${c.costoIA},${c.margen ?? ''}`,
    ))
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `contabilidad-nexusmed-${data.mes}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const maxIngreso = data ? Math.max(1, ...data.porMes.map(m => m.ingresos)) : 1

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
          <TrendingUp size={20} style={{ color: 'var(--teal)' }} /> Contabilidad
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={mes} onChange={e => setMes(e.target.value)}
            style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)' }}>
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportarCSV} disabled={!data}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 9, padding: '8px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 20px' }}>Solo tú ves esto. Ingresos, costos y utilidad para tu control y tu contador.</p>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 30 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Calculando…</div>
      ) : error ? (
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--red)', background: 'rgba(239,68,68,0.07)', color: 'var(--red)', fontSize: 13.5 }}>{error}</div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
            {[
              { lab: 'Ingresos del mes', val: mxn(data.resumen.ingresoMes), foot: `${data.resumen.numPagosMes} pagos · IVA ${mxn(data.resumen.ivaMes)}` },
              { lab: 'Costo total', val: mxn(data.resumen.costoTotal), foot: `IA ${mxn(data.resumen.costoIA)} · Stripe ${mxn(data.resumen.costoStripe)}` },
              { lab: 'Utilidad neta', val: mxn(data.resumen.utilidad), foot: 'sin IVA − costos', hero: true },
              { lab: 'Margen', val: data.resumen.margen + '%', foot: `MRR ${mxn(data.resumen.mrr)}` },
            ].map((k, i) => (
              <div key={i} style={{ background: k.hero ? 'linear-gradient(160deg,#0e1524,#182338)' : 'var(--s1)', border: '1px solid ' + (k.hero ? '#0e1524' : 'var(--border)'), borderRadius: 13, padding: '14px 15px' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, color: k.hero ? '#8ea0c0' : 'var(--text3)' }}>{k.lab}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: k.hero ? '#fff' : 'var(--text)' }}>{k.val}</div>
                <div style={{ fontSize: 11, marginTop: 3, color: k.hero ? '#aeb9cf' : 'var(--text3)' }}>{k.foot}</div>
              </div>
            ))}
          </div>

          {/* Ingresos por mes */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ingresos últimos 12 meses</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {data.porMes.map(m => (
                <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div title={mxn(m.ingresos)} style={{ width: '100%', height: `${(m.ingresos / maxIngreso) * 96}px`, minHeight: m.ingresos > 0 ? 3 : 0, background: m.mes === data.mes ? 'var(--teal)' : 'var(--s3)', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>{nombreMes(m.mes).split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Por plan */}
          {data.porPlan.length > 0 && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Suscripciones activas por plan</div>
              {data.porPlan.map(p => (
                <div key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line2, var(--border))' }}>
                  <span>{p.label} <span style={{ color: 'var(--text3)' }}>× {p.cantidad}</span></span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{mxn(p.mrr)}/mes</span>
                </div>
              ))}
            </div>
          )}

          {/* Por cliente */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16, overflowX: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Por cliente</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
              <thead><tr style={{ color: 'var(--text3)', textAlign: 'right', fontSize: 11 }}>
                <th style={{ textAlign: 'left', padding: '0 0 8px' }}>Consultorio</th><th>Plan</th><th>MRR</th><th>Créditos</th><th>Costo IA</th><th>Margen</th><th>Histórico</th>
              </tr></thead>
              <tbody>
                {data.clientes.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--line2, var(--border))', textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>{c.nombre}{!c.activa && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · inactivo</span>}</td>
                    <td>{c.planLabel}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.mrr ? mxn(c.mrr) : '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.creditos}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{mxn(c.costoIA)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: c.margen == null ? 'var(--text3)' : c.margen < 30 ? 'var(--amber)' : 'var(--teal)', fontWeight: 600 }}>{c.margen == null ? '—' : c.margen + '%'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text3)' }}>{mxn(c.ingresoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Supuestos: costo IA ≈ ${data.supuestos.costoPorCreditoMXN}/crédito · infra ${mxn(data.supuestos.infraMensualMXN)}/mes · Stripe {(data.supuestos.stripePct * 100).toFixed(1)}% + $3/pago.
            Ajústalos con <span style={{ fontFamily: 'monospace' }}>COSTO_CREDITO_MXN</span> / <span style={{ fontFamily: 'monospace' }}>INFRA_MENSUAL_MXN</span> en Vercel.
            El <b>IVA (16%)</b> se muestra por separado porque no es tuyo: lo trasladas al SAT. La utilidad se calcula sobre el ingreso sin IVA.
            Para la declaración del SAT, entrega este CSV a tu contador.
          </div>
        </>
      ) : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
