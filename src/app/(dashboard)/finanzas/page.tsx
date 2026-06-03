'use client'
/**
 * Reportes financieros mensuales del consultorio.
 *
 * Dashboard con:
 *  - Total cobrado del mes + comparación con mes anterior
 *  - Gráfica de barras de ingresos por día
 *  - Breakdown por método de pago, concepto y médico
 *  - Top 10 pacientes que más han pagado
 *  - Tabla de movimientos con búsqueda
 *  - Export a CSV / Excel para el contador
 */
import { useEffect, useState, useMemo } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import {
  cobrosDelMes, agregarResumen, cobrosACSV, fmtMXN,
  METODO_LABEL, CONCEPTO_LABEL,
  type Cobro, type MetodoPago, type ConceptoCobro, type ResumenMes,
} from '@/lib/cobros'
import { CobrarModal } from '@/components/CobrarModal'
import {
  TrendingUp, Download, Plus, ChevronLeft, ChevronRight, Loader2,
  DollarSign, Receipt, Activity, Users,
} from 'lucide-react'

function mesActual(): string { return new Date().toISOString().slice(0, 7) }
function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return d.toISOString().slice(0, 7)
}
function mesSiguiente(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m, 1)
  return d.toISOString().slice(0, 7)
}
function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export default function FinanzasPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()
  const [mes, setMes] = useState(mesActual())
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [resumenAnterior, setResumenAnterior] = useState<ResumenMes | null>(null)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    Promise.all([
      cobrosDelMes(clinicId, mes),
      cobrosDelMes(clinicId, mesAnterior(mes)),
    ]).then(([actual, anterior]) => {
      setCobros(actual)
      setResumenAnterior(agregarResumen(anterior))
    }).finally(() => setLoading(false))
  }, [clinicId, mes])

  const resumen = useMemo(() => agregarResumen(cobros), [cobros])
  const cambio = resumenAnterior
    ? ((resumen.totalIngresos - resumenAnterior.totalIngresos) / Math.max(1, resumenAnterior.totalIngresos)) * 100
    : 0

  const descargarCSV = () => {
    const csv = cobrosACSV(cobros)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cobros_${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Descargados ${cobros.length} cobros`, 'success')
  }

  const recargar = async () => {
    if (!clinicId) return
    const c = await cobrosDelMes(clinicId, mes)
    setCobros(c)
  }

  // Máximo del eje Y para la gráfica
  const maxDia = Math.max(1, ...resumen.porDia.map(d => d.monto))
  const diasDelMes = (() => {
    const [y, m] = mes.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  })()
  const todosDias = Array.from({ length: diasDelMes }, (_, i) => {
    const dia = `${mes}-${String(i + 1).padStart(2, '0')}`
    const found = resumen.porDia.find(d => d.dia === dia)
    return { dia, monto: found?.monto ?? 0, n: found?.n ?? 0 }
  })

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={22} color="var(--teal)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Finanzas</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={descargarCSV} disabled={cobros.length === 0} className="btn btn-secondary">
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={() => setCreando(true)} className="btn btn-primary">
            <Plus size={14} /> Cobro
          </button>
        </div>
      </div>

      {/* Selector de mes */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18,
        padding: '10px 16px', background: 'var(--s)', border: '1px solid var(--border)',
        borderRadius: 10,
      }}>
        <button onClick={() => setMes(mesAnterior(mes))} style={navBtn}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', minWidth: 180, textAlign: 'center' }}>
          {nombreMes(mes)}
        </div>
        <button
          onClick={() => setMes(mesSiguiente(mes))}
          disabled={mes >= mesActual()}
          style={{ ...navBtn, opacity: mes >= mesActual() ? 0.4 : 1, cursor: mes >= mesActual() ? 'default' : 'pointer' }}
        >
          <ChevronRight size={16} />
        </button>
        {mes !== mesActual() && (
          <button onClick={() => setMes(mesActual())} style={{ ...navBtn, padding: '4px 10px', fontSize: 11.5 }}>
            Hoy
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Calculando…
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            <Kpi
              titulo="Ingresos totales"
              valor={fmtMXN(resumen.totalIngresos)}
              icon={<DollarSign size={14} />}
              cambio={resumenAnterior && resumenAnterior.totalIngresos > 0 ? cambio : null}
              color="var(--teal)"
            />
            <Kpi titulo="Cobros" valor={String(resumen.totalCobros)} icon={<Receipt size={14} />} />
            <Kpi titulo="Ticket promedio" valor={fmtMXN(resumen.ticketPromedio)} icon={<Activity size={14} />} />
            <Kpi titulo="Pacientes únicos" valor={String(resumen.topPacientes.length)} icon={<Users size={14} />} />
          </div>

          {/* Gráfica de ingresos por día */}
          <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Ingresos por día
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
              {todosDias.map(d => {
                const dia = parseInt(d.dia.slice(-2))
                const altura = d.monto > 0 ? Math.max(2, (d.monto / maxDia) * 100) : 1
                return (
                  <div
                    key={d.dia}
                    title={`Día ${dia}: ${fmtMXN(d.monto)} · ${d.n} cobro(s)`}
                    style={{
                      flex: 1, height: `${altura}%`,
                      background: d.monto > 0 ? 'var(--teal)' : 'var(--s2)',
                      borderRadius: '3px 3px 0 0',
                      minHeight: 2,
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
              <span>1</span><span>{Math.ceil(diasDelMes / 4)}</span><span>{Math.ceil(diasDelMes / 2)}</span>
              <span>{Math.ceil(3 * diasDelMes / 4)}</span><span>{diasDelMes}</span>
            </div>
          </div>

          {/* Breakdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <Breakdown
              titulo="Por método de pago"
              items={(Object.entries(resumen.porMetodo) as [MetodoPago, { monto: number; n: number }][])
                .filter(([, v]) => v.monto !== 0)
                .sort((a, b) => b[1].monto - a[1].monto)
                .map(([k, v]) => ({ label: METODO_LABEL[k], monto: v.monto, n: v.n }))}
              total={resumen.totalIngresos}
            />
            <Breakdown
              titulo="Por concepto"
              items={(Object.entries(resumen.porConcepto) as [ConceptoCobro, { monto: number; n: number }][])
                .filter(([, v]) => v.monto !== 0)
                .sort((a, b) => b[1].monto - a[1].monto)
                .map(([k, v]) => ({ label: CONCEPTO_LABEL[k], monto: v.monto, n: v.n }))}
              total={resumen.totalIngresos}
            />
          </div>

          {/* Top pacientes + por médico */}
          {(resumen.topPacientes.length > 0 || Object.keys(resumen.porMedico).length > 1) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              {resumen.topPacientes.length > 0 && (
                <Breakdown
                  titulo="Top pacientes"
                  items={resumen.topPacientes.map(p => ({ label: p.nombre, monto: p.monto, n: p.n }))}
                  total={resumen.totalIngresos}
                />
              )}
              {Object.keys(resumen.porMedico).length > 0 && (
                <Breakdown
                  titulo="Por médico"
                  items={Object.values(resumen.porMedico)
                    .sort((a, b) => b.monto - a.monto)
                    .map(m => ({ label: m.nombre, monto: m.monto, n: m.n }))}
                  total={resumen.totalIngresos}
                />
              )}
            </div>
          )}

          {/* Tabla de cobros */}
          <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
              Detalle de movimientos ({cobros.length})
            </div>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
              {cobros.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  Sin cobros este mes
                </div>
              ) : (
                cobros.map(c => (
                  <div key={c.id} style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {c.patientNombre ?? 'Sin paciente'}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 100,
                          background: 'rgba(20,184,166,0.12)', color: 'var(--teal)',
                        }}>
                          {CONCEPTO_LABEL[c.concepto]}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {METODO_LABEL[c.metodo]}
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>
                        {c.folio} · {new Date(c.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        {c.medicoNombre && <> · {c.medicoNombre}</>}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.monto >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {fmtMXN(c.monto)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {creando && clinicId && user && (
        <CobrarModal
          clinicId={clinicId}
          creadoPor={user.uid}
          onClose={() => setCreando(false)}
          onCobrado={() => { recargar() }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Kpi({ titulo, valor, icon, cambio, color }: { titulo: string; valor: string; icon?: React.ReactNode; cambio?: number | null; color?: string }) {
  return (
    <div style={{ padding: 14, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {icon}{titulo}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? 'var(--text)' }}>{valor}</div>
      {cambio !== null && cambio !== undefined && (
        <div style={{
          fontSize: 11, fontWeight: 600, marginTop: 4,
          color: cambio > 0 ? '#10b981' : cambio < 0 ? '#ef4444' : 'var(--text3)',
        }}>
          {cambio > 0 ? '↑' : cambio < 0 ? '↓' : ''} {Math.abs(cambio).toFixed(1)}% vs mes anterior
        </div>
      )}
    </div>
  )
}

function Breakdown({ titulo, items, total }: { titulo: string; items: { label: string; monto: number; n: number }[]; total: number }) {
  return (
    <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>{titulo}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Sin datos</div>
        ) : (
          items.slice(0, 10).map(it => {
            const pct = total > 0 ? (it.monto / total) * 100 : 0
            return (
              <div key={it.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                    {it.label}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{fmtMXN(it.monto)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--s2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', marginTop: 2 }}>
                  {it.n} cobro{it.n !== 1 ? 's' : ''} · {pct.toFixed(1)}%
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)',
  borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
