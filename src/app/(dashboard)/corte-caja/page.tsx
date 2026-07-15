'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { PageHeader, Button, Spinner, Input } from '@/components/ui'
import { useClinic } from '@/context/ClinicContext'
import { listarCobros, fmtMXN } from '@/lib/cobros'
import { getAppointments } from '@/lib/firestore'
import { where } from 'firebase/firestore'
import type { Cobro } from '@/lib/cobros'
import type { Appointment } from '@/types'
import { corteDeCaja, embudoCobro, cuentasPorCobrar } from '@/lib/corte-caja'
import { Printer, Wallet, TrendingDown, Users, AlertCircle, Calendar } from 'lucide-react'

// IMPORTANTE: cobro.dia se ALMACENA como día UTC (toISOString().slice(0,10)),
// igual que Finanzas. El corte usa la MISMA convención para que el efectivo
// reconcilie con lo guardado; usar día LOCAL silenciaba los cobros de la
// tarde/noche (cuando la fecha UTC ya avanzó), justo al cerrar caja.
const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function CorteCajaPage() {
  return <CorteCajaContenido />
}

/** Contenido del corte de caja. `embedded` lo usa la pestaña dentro de Finanzas
 * (sin su propio header/padding, para no duplicar el marco). */
export function CorteCajaContenido({ embedded = false }: { embedded?: boolean }) {
  const { clinicId } = useClinic()
  const [dia, setDia] = useState(hoyISO())
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [citas, setCitas] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const [cb, ct] = await Promise.all([
        listarCobros(clinicId, dia, dia),
        getAppointments(clinicId, [
          where('fechaHora', '>=', dia + ' 00:00'),
          where('fechaHora', '<=', dia + ' 23:59'),
        ]),
      ])
      setCobros(cb); setCitas(ct)
    } finally {
      setLoading(false)
    }
  }, [clinicId, dia])

  useEffect(() => { cargar() }, [cargar])

  const corte = useMemo(() => corteDeCaja(cobros), [cobros])
  const embudo = useMemo(() => embudoCobro(citas, cobros), [citas, cobros])
  const porCobrar = useMemo(() => cuentasPorCobrar(citas, cobros), [citas, cobros])

  return (
    <div style={{ padding: embedded ? 0 : 24, maxWidth: 920, margin: '0 auto' }}>
      {!embedded && (
        <PageHeader
          title="Corte de caja"
          subtitle="Cierra el día: cuánto entró, en qué forma de pago, y quién quedó pendiente de cobro."
          actions={
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimir</Button>
          }
        />
      )}

      {/* Selector de día */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Calendar size={16} style={{ color: 'var(--text3)' }} />
        <Input type="date" value={dia} onChange={e => setDia(e.target.value)} style={{ width: 180 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setDia(hoyISO())}>Hoy</button>
      </div>

      {loading ? <Spinner center label="Cargando corte…" /> : (
        <div id="corte-print">
          {/* Encabezado imprimible */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Corte del día</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{dia}</div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Kpi icon={<Wallet size={16} />} titulo="Total neto" valor={fmtMXN(corte.neto)} color="var(--nexus)" />
            <Kpi icon={<span style={{ fontSize: 15 }}>💵</span>} titulo="Efectivo en caja" valor={fmtMXN(corte.efectivo)} color="#16a34a" />
            <Kpi icon={<TrendingDown size={16} />} titulo="Reembolsos" valor={fmtMXN(corte.reembolsos)} color="#dc2626" />
            <Kpi icon={<Users size={16} />} titulo="Movimientos" valor={String(corte.nCobros)} />
          </div>

          {/* Por método */}
          <Panel titulo="Desglose por forma de pago">
            {corte.porMetodo.length === 0
              ? <Vacio texto="Sin cobros este día." />
              : corte.porMetodo.map(m => (
                <Fila key={m.metodo} izq={m.label} der={fmtMXN(m.monto)} sub={`${m.n} mov.`} />
              ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text)' }}>
              <span>Total</span><span>{fmtMXN(corte.neto)}</span>
            </div>
          </Panel>

          {/* Embudo */}
          <Panel titulo="Agendadas → Atendidas → Cobradas">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, textAlign: 'center' }}>
              <Etapa n={embudo.agendadas} label="Agendadas" />
              <Etapa n={embudo.atendidas} label="Atendidas" sub={`${Math.round(embudo.tasaAsistencia * 100)}% asistencia`} />
              <Etapa n={embudo.cobradas} label="Cobradas" sub={`${Math.round(embudo.tasaCobro * 100)}% cobro`} />
            </div>
            {embudo.noAsistio > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 12, textAlign: 'center' }}>
                {embudo.noAsistio} no asistió · Cobrado hoy en consultas: {fmtMXN(embudo.montoCobrado)}
              </div>
            )}
          </Panel>

          {/* Cuentas por cobrar */}
          <Panel titulo={`Cuentas por cobrar (${porCobrar.length})`}>
            {porCobrar.length === 0
              ? <Vacio texto="Todas las consultas atendidas de este día están cobradas. 🎉" />
              : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#d97706', marginBottom: 10 }}>
                    <AlertCircle size={14} /> Consultas atendidas sin cobro registrado.
                  </div>
                  {porCobrar.map(c => (
                    <Fila key={c.citaId}
                      izq={c.paciente}
                      der={c.fechaHora.slice(11)}
                      sub={c.medico} />
                  ))}
                </>
              )}
          </Panel>
        </div>
      )}

      <style>{`
        @media print {
          .no-print, .mobile-topbar, .bottom-nav-wrap, aside, nav { display: none !important; }
          #corte-print { color: #000; }
        }
      `}</style>
    </div>
  )
}

/* ─── Sub-componentes ─── */
function Kpi({ titulo, valor, icon, color }: { titulo: string; valor: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
        {icon} {titulo}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text)' }}>{valor}</div>
    </div>
  )
}
function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Fila({ izq, der, sub }: { izq: string; der: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{izq}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{der}</div>
    </div>
  )
}
function Etapa({ n, label, sub }: { n: number; label: string; sub?: string }) {
  return (
    <div style={{ padding: '14px 8px', borderRadius: 10, background: 'var(--s2)' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--nexus)' }}>{n}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function Vacio({ texto }: { texto: string }) {
  return <div style={{ fontSize: 13, color: 'var(--text3)', padding: '6px 0' }}>{texto}</div>
}
