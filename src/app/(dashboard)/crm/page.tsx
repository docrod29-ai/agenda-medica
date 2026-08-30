'use client'
/**
 * CRM / Revenue Dashboard
 *
 * Métricas de conversión, retención e ingresos.
 * Lee citas y pacientes de Firestore (read-only, no modifica nada).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClinic } from '@/context/ClinicContext'
import { getAppointments, listarPacientesCompat, TECHO_COMPAT_PACIENTES } from '@/lib/firestore'
import type { Appointment, Patient } from '@/types'
import {
  TrendingUp, TrendingDown, Users, CalendarCheck2, UserX,
  DollarSign, ArrowUpRight, Loader2, Lightbulb, AlertTriangle,
} from 'lucide-react'
import { PageHeader, Spinner, Select } from '@/components/ui'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'

type Periodo = 'hoy' | 'semana' | 'mes' | '3meses'

// Días atrás en hora de MÉXICO (no UTC): con `toISOString` el borde del día saltaba
// ~un día pasadas las 18:00 MX, corriendo "hoy" y las tasas del CRM. Finanzas y el
// dashboard ya usan estos helpers; el CRM se había quedado con la aritmética UTC.
function isoDaysAgo(d: number): string {
  return sumarDiasISO(hoyISO(), -d)
}

export default function CRMPage() {
  const { clinicId } = useClinic()
  const [appts, setAppts] = useState<Appointment[]>([])
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [listaTruncada, setListaTruncada] = useState(false)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  useEffect(() => {
    if (!clinicId) return
    // PERF: el CRM solo usa citas de los últimos ≤90 días (ver `enPeriodo`). Cargar
    // TODO el histórico era una lectura sin cota que crece sin límite. Acotamos a
    // 120 días (margen sobre los 90) → métricas idénticas, muchas menos lecturas.
    const ventana = isoDaysAgo(120) + ' 00:00'
    Promise.all([
      getAppointments(clinicId, { desde: ventana }),
      listarPacientesCompat(clinicId),
    ]).then(([a, p]) => {
      setAppts(a)
      setPacientes(p.pacientes)
      /**
       * REG-351 — ESTAS CIFRAS SALEN DE UNA LISTA QUE PUEDE VENIR RECORTADA.
       *
       * «Pacientes activos», «inactivos», «en riesgo de no-show»: todas se
       * cuentan sobre `pacientes`, que desde REG-341 tiene techo. Un porcentaje
       * de retención calculado sobre 500 de N no está poco afinado: **es otro
       * número**, y se lee como un hecho del consultorio.
       */
      setListaTruncada(p.truncada)
    }).catch(e => {
      // Sin esto, un error de lectura (permiso/offline/token) dejaba el spinner
      // "Cargando datos…" para siempre, sin error ni reintento.
      console.error('[crm] error al cargar:', e)
    }).finally(() => setLoading(false))
  }, [clinicId])

  const desde = useMemo(() => {
    return periodo === 'hoy' ? isoDaysAgo(0)
      : periodo === 'semana' ? isoDaysAgo(7)
      : periodo === 'mes' ? isoDaysAgo(30)
      : isoDaysAgo(90)
  }, [periodo])

  // Cota superior = HOY: las citas FUTURAS aún no ocurren; contarlas falseaba las
  // tasas de no-show/confirmación/atención (denominador inflado).
  const enPeriodo = useMemo(() => {
    const hasta = isoDaysAgo(0)
    return appts.filter(a => { const d = a.fechaHora.slice(0, 10); return d >= desde && d <= hasta })
  }, [appts, desde])

  // Métricas operativas
  const total = enPeriodo.length
  const confirmadas = enPeriodo.filter(a => ['confirmada', 'recordatorio-enviado', 'en-sala', 'en-consulta', 'atendida', 'finalizada', 'pagada'].includes(a.estado)).length
  const noShows = enPeriodo.filter(a => a.estado === 'no-asistio').length
  const canceladas = enPeriodo.filter(a => a.estado === 'cancelada').length
  const reagendadas = enPeriodo.filter(a => a.estado === 'reagendada').length
  const atendidas = enPeriodo.filter(a => ['atendida', 'finalizada', 'pagada'].includes(a.estado)).length
  const tasaConfirm = total > 0 ? (confirmadas / total) * 100 : 0
  const tasaNoShow = total > 0 ? (noShows / total) * 100 : 0
  const tasaCancel = total > 0 ? (canceladas / total) * 100 : 0
  const tasaAtencion = total > 0 ? (atendidas / total) * 100 : 0

  // Retención
  const corte90 = isoDaysAgo(90)
  const pacientesActivos = pacientes.filter(p => p.ultimaCita && p.ultimaCita >= corte90).length
  // "Inactivo" = tuvo cita y no vuelve, O nunca tuvo cita PERO se registró hace ya
  // más de 90 días (tuvo oportunidad de volver). No se cuenta a un paciente recién
  // dado de alta que aún no ha tenido su primera cita: no es "inactivo", es nuevo.
  const pacientesInactivos = pacientes.filter(p => {
    if (p.ultimaCita) return p.ultimaCita < corte90
    return p.createdAt ? p.createdAt.slice(0, 10) < corte90 : false
  }).length
  const requierenSeguimiento = pacientes.filter(p => p.proximoSeguimiento && p.proximoSeguimiento <= isoDaysAgo(0)).length
  const enRiesgoNoShow = pacientes.filter(p => p.noShowCount >= 2).length

  // Pipeline (estados como columnas)
  const pipeline = {
    solicitada:           enPeriodo.filter(a => a.estado === 'solicitada').length,
    'pendiente-confirmar':enPeriodo.filter(a => a.estado === 'pendiente-confirmar').length,
    confirmada:           enPeriodo.filter(a => a.estado === 'confirmada' || a.estado === 'recordatorio-enviado').length,
    'en-consulta':        enPeriodo.filter(a => a.estado === 'en-sala' || a.estado === 'en-consulta').length,
    finalizada:           atendidas,
  }

  return (
    <div className="nx-canvas">
      <PageHeader
        title="CRM & Revenue"
        subtitle="Pipeline, conversión, retención y oportunidades."
        actions={(
          <Select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)} style={{ width: 'auto' }}>
            <option value="hoy">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Últimos 30 días</option>
            <option value="3meses">Últimos 90 días</option>
          </Select>
        )}
      />

      {/**
        * REG-351 — un tablero de cifras que salen de una lista recortada no está
        * «poco afinado»: dice otra cosa. Y una cifra se lee como un hecho.
        */}
      {listaTruncada && (
        <div role="status" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 14,
          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
          border: '1px solid var(--amber)', borderRadius: 10, color: 'var(--text2)', fontSize: 14,
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <span>
            Estas cifras se calcularon sobre los primeros <strong>{TECHO_COMPAT_PACIENTES}</strong> pacientes.
            Tu consultorio tiene más, así que <strong>no son el total</strong>: sirven para ver la tendencia, no para reportar.
          </span>
        </div>
      )}

      {loading ? (
        <Spinner center label="Cargando datos…" />
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14, marginBottom: 24 }}>
            <KPI icon={<CalendarCheck2 size={18} />} label="Tasa de confirmación" valor={`${tasaConfirm.toFixed(0)}%`} sub={`${confirmadas} de ${total} citas`} color="var(--green)" />
            <KPI icon={<UserX size={18} />} label="Tasa de no-show" valor={`${tasaNoShow.toFixed(0)}%`} sub={`${noShows} ausencias`} color={tasaNoShow > 10 ? '#ef4444' : '#94a3b8'} trend={tasaNoShow > 15 ? 'down' : 'neutral'} />
            <KPI icon={<TrendingDown size={18} />} label="Cancelaciones" valor={`${tasaCancel.toFixed(0)}%`} sub={`${canceladas} canceladas · ${reagendadas} reagendadas`} color="#f97316" />
            <KPI icon={<TrendingUp size={18} />} label="Tasa de atención" valor={`${tasaAtencion.toFixed(0)}%`} sub={`${atendidas} consultas completadas`} color="var(--teal)" />
          </div>

          {/* Pipeline */}
          <Section title="Pipeline de citas">
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10 }}>
              <PipeStep label="Solicitadas"           count={pipeline.solicitada}             color="var(--amber)" />
              <PipeStep label="Pendientes confirmar"  count={pipeline['pendiente-confirmar']} color="var(--amber)" />
              <PipeStep label="Confirmadas"           count={pipeline.confirmada}             color="var(--green)" />
              <PipeStep label="En sala / consulta"    count={pipeline['en-consulta']}         color="#a855f7" />
              <PipeStep label="Finalizadas"           count={pipeline.finalizada}             color="var(--teal)" />
            </div>
          </Section>

          {/* Retención */}
          <Section title="Retención de pacientes">
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
              <Retencion label="Pacientes activos (≤90d)"      count={pacientesActivos}     color="var(--green)" icon={<Users size={16} />} />
              <Retencion label="Pacientes inactivos"           count={pacientesInactivos}   color="#94a3b8" icon={<Users size={16} />} />
              <Retencion label="Seguimientos vencidos"         count={requierenSeguimiento} color="var(--amber)" icon={<ArrowUpRight size={16} />} />
              <Retencion label="Riesgo de no-show (≥2 ausencias)" count={enRiesgoNoShow}    color="var(--red)" icon={<UserX size={16} />} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text2)' }}>Recomendación:</strong> Para pacientes en riesgo de no-show,
              activa doble confirmación 48 h y 2 h antes. Para inactivos, considera una campaña de reactivación con
              mensaje empático y opción de teleconsulta.
            </p>
          </Section>

          {/* Acciones rápidas */}
          <Section title="Próximos pasos sugeridos">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Sugerencia text={`Confirma manualmente ${pipeline['pendiente-confirmar']} citas pendientes para reducir no-shows.`} link="/citas" linkLabel="Ir a citas" />
              {requierenSeguimiento > 0 && <Sugerencia text={`${requierenSeguimiento} pacientes con seguimiento vencido.`} link="/pacientes" linkLabel="Revisar pacientes" />}
              {pacientesInactivos > 5 && <Sugerencia text={`Tienes ${pacientesInactivos} pacientes inactivos. Considera reactivación.`} link="/pacientes" linkLabel="Ver lista" />}
              <Sugerencia text="Configura el bot de WhatsApp para reducir trabajo administrativo y captar citas 24/7." link="/configuracion?tab=integraciones" linkLabel="Configurar" />
            </div>
          </Section>
        </>
      )}

      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 24, fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <Lightbulb size={13} className="ds-icon" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Los ingresos se calcularán automáticamente cuando configures precios por tipo de consulta y pagos.
        Este dashboard se enriquecerá conforme uses la app.</span>
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* Subcomponentes */
function KPI({ icon, label, valor, sub, color, trend }: { icon: React.ReactNode; label: string; valor: string; sub: string; color: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)' }}>
        <span style={{ color }}>{icon}</span> {label}
        {trend === 'down' && <TrendingDown size={12} color="var(--red)" />}
        {trend === 'up' && <TrendingUp size={12} color="var(--green)" />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  )
}
function PipeStep({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{count}</div>
    </div>
  )
}
function Retencion({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `color-mix(in srgb, ${color} 10%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{count}</div>
      </div>
    </div>
  )
}
function Sugerencia({ text, link, linkLabel }: { text: string; link: string; linkLabel: string }) {
  return (
    <Link href={link} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none' }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{text}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', whiteSpace: 'nowrap' }}>{linkLabel} →</span>
    </Link>
  )
}
