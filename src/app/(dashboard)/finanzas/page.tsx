'use client'
/**
 * Reportes financieros del consultorio — contabilidad por DÍA / SEMANA / MES.
 *
 * Dashboard con:
 *  - Selector de periodo (Hoy · Semana · Mes) con navegación por esa unidad
 *  - Total cobrado del periodo + comparación con el periodo anterior
 *  - Desglose PROMINENTE Efectivo vs Transferencia (lo que más se consulta)
 *  - Gráfica de barras de ingresos por día (semana/mes)
 *  - Breakdown por método de pago, concepto y médico
 *  - Top 10 pacientes que más han pagado
 *  - Tabla de movimientos
 *  - Export a CSV / Excel para el contador
 *
 * Solo capa de presentación/agregación: el modelo de datos (cobros.ts) no cambia.
 */
import { useEffect, useState, useMemo } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import {
  listarCobros, agregarResumen, cobrosACSV, fmtMXN,
  METODO_LABEL, CONCEPTO_LABEL,
  type Cobro, type MetodoPago, type ConceptoCobro, type ResumenMes,
} from '@/lib/cobros'
import { CobrarModal } from '@/components/CobrarModal'
import {
  TrendingUp, Download, Plus, ChevronLeft, ChevronRight, Loader2,
  DollarSign, Receipt, Activity, Users, Banknote, Landmark, CreditCard,
} from 'lucide-react'

type Periodo = 'dia' | 'semana' | 'mes'

// ───────────── Helpers de fechas (UTC, para casar con cobro.dia) ─────────────
// cobro.dia se guarda como toISOString().slice(0,10) (día UTC); todo el cálculo
// de rangos se hace en UTC para que los buckets coincidan exactamente.
function hoyISO(): string { return new Date().toISOString().slice(0, 10) }

function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana que contiene `iso` */
function inicioSemana(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay()             // 0=Dom … 6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow // retrocede al lunes
  return addDias(iso, diff)
}

function inicioMes(iso: string): string { return iso.slice(0, 7) + '-01' }
function finMes(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** Rango [desde, hasta] (inclusivo, YYYY-MM-DD) del periodo anclado en `ancla` */
function rangoDe(periodo: Periodo, ancla: string): { desde: string; hasta: string } {
  if (periodo === 'dia') return { desde: ancla, hasta: ancla }
  if (periodo === 'semana') {
    const d = inicioSemana(ancla)
    return { desde: d, hasta: addDias(d, 6) }
  }
  return { desde: inicioMes(ancla), hasta: finMes(ancla) }
}

/** Mueve el ancla una unidad del periodo hacia atrás (-1) o adelante (+1) */
function moverAncla(periodo: Periodo, ancla: string, dir: -1 | 1): string {
  if (periodo === 'dia') return addDias(ancla, dir)
  if (periodo === 'semana') return addDias(inicioSemana(ancla), dir * 7)
  // mes: del primer día del mes vecino
  const base = inicioMes(ancla)
  return dir < 0 ? inicioMes(addDias(base, -1)) : inicioMes(addDias(finMes(ancla), 1))
}

/** Lista de días YYYY-MM-DD entre desde y hasta (inclusivo) */
function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let d = desde; d <= hasta; d = addDias(d, 1)) out.push(d)
  return out
}

function etiquetaPeriodo(periodo: Periodo, ancla: string): string {
  const { desde, hasta } = rangoDe(periodo, ancla)
  if (periodo === 'dia') {
    return new Date(desde + 'T00:00:00Z').toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })
  }
  if (periodo === 'semana') {
    const a = new Date(desde + 'T00:00:00Z')
    const b = new Date(hasta + 'T00:00:00Z')
    const mismoMes = a.getUTCMonth() === b.getUTCMonth()
    const dA = a.toLocaleDateString('es-MX', mismoMes
      ? { day: 'numeric', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', timeZone: 'UTC' })
    const dB = b.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    return `${dA} – ${dB}`
  }
  return new Date(desde + 'T00:00:00Z').toLocaleDateString('es-MX', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

const PERIODO_LABEL: Record<Periodo, string> = { dia: 'Hoy', semana: 'Semana', mes: 'Mes' }

export default function FinanzasPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [ancla, setAncla] = useState(hoyISO())
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [resumenAnterior, setResumenAnterior] = useState<ResumenMes | null>(null)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)

  const { desde, hasta } = useMemo(() => rangoDe(periodo, ancla), [periodo, ancla])

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    const anclaPrev = moverAncla(periodo, ancla, -1)
    const { desde: pDesde, hasta: pHasta } = rangoDe(periodo, anclaPrev)
    Promise.all([
      listarCobros(clinicId, desde, hasta),
      listarCobros(clinicId, pDesde, pHasta),
    ]).then(([actual, anterior]) => {
      setCobros(actual)
      setResumenAnterior(agregarResumen(anterior))
    }).finally(() => setLoading(false))
  }, [clinicId, periodo, ancla, desde, hasta])

  const resumen = useMemo(() => agregarResumen(cobros), [cobros])
  const cambio = resumenAnterior
    ? ((resumen.totalIngresos - resumenAnterior.totalIngresos) / Math.max(1, resumenAnterior.totalIngresos)) * 100
    : 0

  // Cambiar de periodo siempre aterriza en el periodo ACTUAL (hoy)
  const cambiarPeriodo = (p: Periodo) => { setPeriodo(p); setAncla(hoyISO()) }
  const esActual = hasta >= hoyISO() && desde <= hoyISO()
  // Deshabilita "siguiente" cuando el próximo periodo empieza después de hoy
  const noFuturo = rangoDe(periodo, moverAncla(periodo, ancla, 1)).desde > hoyISO()

  const descargarCSV = () => {
    const csv = cobrosACSV(cobros)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cobros_${desde}_a_${hasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Descargados ${cobros.length} cobros`, 'success')
  }

  const recargar = async () => {
    if (!clinicId) return
    const c = await listarCobros(clinicId, desde, hasta)
    setCobros(c)
  }

  // Desglose Efectivo vs Transferencia (lo que el médico más consulta)
  const efectivo = resumen.porMetodo['efectivo'] ?? { monto: 0, n: 0 }
  const transferencia = resumen.porMetodo['transferencia'] ?? { monto: 0, n: 0 }
  const otrosMonto = resumen.totalIngresos - efectivo.monto - transferencia.monto
  const otrosN = resumen.totalCobros - efectivo.n - transferencia.n

  // Gráfica por día (solo en semana/mes; un día suelto no aporta barra)
  const dias = diasEntre(desde, hasta)
  const maxDia = Math.max(1, ...resumen.porDia.map(d => d.monto))
  const serieDias = dias.map(d => {
    const found = resumen.porDia.find(x => x.dia === d)
    return { dia: d, monto: found?.monto ?? 0, n: found?.n ?? 0 }
  })

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={22} color="var(--nexus)" />
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

      {/* Selector de periodo (Hoy · Semana · Mes) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
        {(['dia', 'semana', 'mes'] as Periodo[]).map(p => {
          const activo = periodo === p
          return (
            <button
              key={p}
              onClick={() => cambiarPeriodo(p)}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: '1px solid ' + (activo ? 'var(--nexus)' : 'var(--border)'),
                background: activo ? 'rgba(61,90,254,0.12)' : 'var(--s)',
                color: activo ? 'var(--nexus)' : 'var(--text2)',
                transition: 'all 120ms',
              }}
            >
              {PERIODO_LABEL[p]}
            </button>
          )
        })}
      </div>

      {/* Navegación dentro del periodo */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18,
        padding: '10px 16px', background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        <button onClick={() => setAncla(moverAncla(periodo, ancla, -1))} style={navBtn} aria-label="Periodo anterior">
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', minWidth: 220, textAlign: 'center' }}>
          {etiquetaPeriodo(periodo, ancla)}
        </div>
        <button
          onClick={() => setAncla(moverAncla(periodo, ancla, 1))}
          disabled={noFuturo}
          style={{ ...navBtn, opacity: noFuturo ? 0.4 : 1, cursor: noFuturo ? 'default' : 'pointer' }}
          aria-label="Periodo siguiente"
        >
          <ChevronRight size={16} />
        </button>
        {!esActual && (
          <button onClick={() => setAncla(hoyISO())} style={{ ...navBtn, padding: '4px 10px', fontSize: 11.5 }}>
            Ahora
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Calculando…
        </div>
      ) : (
        <>
          {/* Hero: total + Efectivo vs Transferencia */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{
              padding: 18, borderRadius: 14, border: '1px solid var(--border)',
              background: 'linear-gradient(135deg, rgba(61,90,254,0.14), rgba(61,90,254,0.04))',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <DollarSign size={13} /> Ingresos del periodo
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {fmtMXN(resumen.totalIngresos)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
                {resumen.totalCobros} cobro{resumen.totalCobros !== 1 ? 's' : ''}
                {resumenAnterior && resumenAnterior.totalIngresos > 0 && (
                  <span style={{ marginLeft: 8, fontWeight: 700, color: cambio > 0 ? '#10b981' : cambio < 0 ? '#ef4444' : 'var(--text3)' }}>
                    {cambio > 0 ? '↑' : cambio < 0 ? '↓' : ''} {Math.abs(cambio).toFixed(0)}% vs anterior
                  </span>
                )}
              </div>
            </div>
            <MetodoCard
              titulo="Efectivo"
              icon={<Banknote size={15} />}
              monto={efectivo.monto}
              n={efectivo.n}
              total={resumen.totalIngresos}
              tint="#10b981"
              tintBg="rgba(16,185,129,0.10)"
            />
            <MetodoCard
              titulo="Transferencia"
              icon={<Landmark size={15} />}
              monto={transferencia.monto}
              n={transferencia.n}
              total={resumen.totalIngresos}
              tint="var(--nexus)"
              tintBg="rgba(61,90,254,0.10)"
            />
          </div>

          {/* Otros métodos (tarjeta, cheque, etc.) si los hay */}
          {otrosMonto !== 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
              padding: '8px 14px', background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 12, color: 'var(--text2)',
            }}>
              <CreditCard size={13} style={{ color: 'var(--text3)' }} />
              <span>Otros métodos (tarjeta, cheque, etc.)</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
                {fmtMXN(otrosMonto)}
              </span>
              <span style={{ color: 'var(--text3)' }}>· {otrosN} cobro{otrosN !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* KPIs secundarios */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            <Kpi titulo="Cobros" valor={String(resumen.totalCobros)} icon={<Receipt size={14} />} />
            <Kpi titulo="Ticket promedio" valor={fmtMXN(resumen.ticketPromedio)} icon={<Activity size={14} />} />
            <Kpi titulo="Pacientes únicos" valor={String(resumen.pacientesUnicos)} icon={<Users size={14} />} />
          </div>

          {/* Gráfica de ingresos por día (semana/mes) */}
          {periodo !== 'dia' && (
            <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                Ingresos por día
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: periodo === 'semana' ? 8 : 2, height: 140 }}>
                {serieDias.map(d => {
                  const altura = d.monto > 0 ? Math.max(2, (d.monto / maxDia) * 100) : 1
                  const etiqueta = new Date(d.dia + 'T00:00:00Z').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
                  return (
                    <div
                      key={d.dia}
                      title={`${etiqueta}: ${fmtMXN(d.monto)} · ${d.n} cobro(s)`}
                      style={{
                        flex: 1, height: `${altura}%`,
                        background: d.monto > 0 ? 'var(--nexus)' : 'var(--s2)',
                        borderRadius: '3px 3px 0 0', minHeight: 2,
                      }}
                    />
                  )
                })}
              </div>
              {periodo === 'semana' ? (
                <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                  {serieDias.map(d => (
                    <span key={d.dia} style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
                      {new Date(d.dia + 'T00:00:00Z').toLocaleDateString('es-MX', { weekday: 'short', timeZone: 'UTC' })}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                  <span>{dias.length > 0 ? dias[0].slice(-2) : ''}</span>
                  <span>{dias.length > 0 ? dias[Math.floor(dias.length / 2)].slice(-2) : ''}</span>
                  <span>{dias.length > 0 ? dias[dias.length - 1].slice(-2) : ''}</span>
                </div>
              )}
            </div>
          )}

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
                  Sin cobros en este periodo
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
                          background: 'rgba(61,90,254,0.12)', color: 'var(--nexus)',
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

function MetodoCard({ titulo, icon, monto, n, total, tint, tintBg }: {
  titulo: string; icon: React.ReactNode; monto: number; n: number; total: number; tint: string; tintBg: string
}) {
  const pct = total > 0 ? (monto / total) * 100 : 0
  return (
    <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--s)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: tintBg, color: tint }}>
          {icon}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>{titulo}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
        {fmtMXN(monto)}
      </div>
      <div style={{ height: 4, background: 'var(--s2)', borderRadius: 2, overflow: 'hidden', margin: '8px 0 5px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tint }} />
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>
        {n} cobro{n !== 1 ? 's' : ''} · {pct.toFixed(0)}% del total
      </div>
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
          {cambio > 0 ? '↑' : cambio < 0 ? '↓' : ''} {Math.abs(cambio).toFixed(1)}% vs periodo anterior
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
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--nexus)' }} />
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
