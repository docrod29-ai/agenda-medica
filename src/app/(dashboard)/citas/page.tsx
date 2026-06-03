'use client'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAppointments } from '@/hooks/useAppointments'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { StatusBadge } from '@/components/StatusBadge'
import { calcularRiesgoNoShow, NIVEL_LABEL, NIVEL_COLOR } from '@/lib/no-show-risk'
import { getPatients } from '@/lib/firestore'
import type { Patient } from '@/types'
import { AppointmentModal } from '@/components/AppointmentModal'
import { DoctorFilter, useFiltroMedico, colorMedico } from '@/components/DoctorFilter'
import { Appointment, AppointmentStatus, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { updateAppointment, deleteAppointment } from '@/lib/firestore'
import { useClinic } from '@/context/ClinicContext'
import { openWhatsApp, msgConfirmacion, msgCancelacion } from '@/lib/whatsapp'
import {
  Plus, Search, Filter, Trash2, Edit2, MessageSquare,
  ChevronLeft, ChevronRight, CalendarDays, MoreVertical,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_FILTERS: { label: string; value: AppointmentStatus | 'todas' }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Pendientes', value: 'pendiente-confirmar' },
  { label: 'Confirmadas', value: 'confirmada' },
  { label: 'En sala', value: 'en-sala' },
  { label: 'En consulta', value: 'en-consulta' },
  { label: 'Finalizadas', value: 'finalizada' },
  { label: 'Canceladas', value: 'cancelada' },
  { label: 'No asistió', value: 'no-asistio' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function prevDay(d: string) {
  const dt = new Date(d + 'T12:00'); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10)
}
function nextDay(d: string) {
  const dt = new Date(d + 'T12:00'); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10)
}

export default function CitasPage() {
  const params = useSearchParams()
  const router = useRouter()
  const { appointments, loading } = useAppointments()
  const { config } = useConfig()
  const [medicoFiltro, setMedicoFiltro] = useFiltroMedico()
  const { clinicId } = useClinic()
  const { toast } = useToast()
  const [pacientes, setPacientes] = useState<Patient[]>([])

  useEffect(() => {
    if (!clinicId) return
    getPatients(clinicId).then(setPacientes).catch(() => { /* ignore */ })
  }, [clinicId])

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'todas'>('todas')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Solo abrir modal cuando es para EDITAR (ya no auto-abre para crear)
  useEffect(() => {
    const id = params.get('id')
    if (id) {
      const found = appointments.find(a => a.id === id)
      if (found) { setEditAppt(found); setModalOpen(true) }
    }
  }, [params, appointments])

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      if (a.fechaHora.slice(0, 10) !== selectedDate) return false
      if (statusFilter !== 'todas' && a.estado !== statusFilter) return false
      if (search && !a.pacienteNombre.toLowerCase().includes(search.toLowerCase())) return false
      // Filtro multi-doctor: si hay médico seleccionado, solo sus citas
      if (medicoFiltro && a.medicoId !== medicoFiltro) return false
      return true
    }).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  }, [appointments, selectedDate, statusFilter, search, medicoFiltro])

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00')
    const today = todayStr()
    const tomorrow = nextDay(today)
    if (selectedDate === today) return 'Hoy'
    if (selectedDate === tomorrow) return 'Mañana'
    return format(d, "EEEE d 'de' MMMM", { locale: es })
  }, [selectedDate])

  const handleStatusChange = async (appt: Appointment, newStatus: AppointmentStatus) => {
    try {
      await updateAppointment(clinicId!, appt.id, { estado: newStatus })
      toast(`Estado actualizado: ${newStatus}`, 'success')
      setMenuId(null)
    } catch {
      toast('Error al actualizar', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cita permanentemente?')) return
    setDeletingId(id)
    try {
      await deleteAppointment(clinicId!, id)
      toast('Cita eliminada', 'info')
    } catch {
      toast('Error al eliminar', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Citas</h1>
          <DoctorFilter medicoId={medicoFiltro} onChange={setMedicoFiltro} />
        </div>
        <button className="btn btn-primary" onClick={() => router.push('/asistente')}>
          <Plus size={16} /> Nueva cita
        </button>
      </div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedDate(prevDay(selectedDate))}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{dateLabel}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{selectedDate}</span>
        </div>
        <input
          type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
        />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedDate(nextDay(selectedDate))}>
          <ChevronRight size={16} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(todayStr())}>
          Hoy
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar paciente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value as AppointmentStatus | 'todas')}
              className="btn btn-sm"
              style={{
                background: statusFilter === f.value ? 'var(--teal-glow)' : 'var(--s2)',
                color: statusFilter === f.value ? 'var(--teal)' : 'var(--text2)',
                border: `1px solid ${statusFilter === f.value ? 'rgba(0,212,168,0.3)' : 'var(--border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>
        {filtered.length} cita{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Cargando citas…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <CalendarDays size={40} color="var(--text3)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', fontSize: 14, margin: 0 }}>No hay citas para este filtro</p>
          </div>
        ) : (
          <div>
            {filtered.map((appt, i) => (
              <AppointmentRowFull
                key={appt.id}
                appt={appt}
                paciente={pacientes.find(p => p.id === appt.pacienteId) ?? null}
                config={config}
                isLast={i === filtered.length - 1}
                menuOpen={menuId === appt.id}
                onMenuToggle={() => setMenuId(menuId === appt.id ? null : appt.id)}
                onEdit={() => { setEditAppt(appt); setModalOpen(true); setMenuId(null) }}
                onDelete={() => { handleDelete(appt.id); setMenuId(null) }}
                onStatusChange={s => handleStatusChange(appt, s)}
                deleting={deletingId === appt.id}
              />
            ))}
          </div>
        )}
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAppt(null) }}
        appointment={editAppt}
        defaultDate={selectedDate}
        onSaved={() => {}}
      />

      {/* Close menu on outside click */}
      {menuId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuId(null)} />
      )}
    </div>
  )
}

function AppointmentRowFull({
  appt, paciente, config, isLast, menuOpen, onMenuToggle, onEdit, onDelete, onStatusChange, deleting,
}: {
  appt: Appointment
  paciente: Patient | null
  config: ReturnType<typeof useConfig>['config']
  isLast: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: AppointmentStatus) => void
  deleting: boolean
}) {
  const hora = appt.fechaHora.slice(11, 16)
  const typeCfg = APPOINTMENT_TYPE_CONFIG[appt.tipo]
  // Riesgo de no-show — solo mostrar para citas pendientes/confirmadas (no las ya atendidas)
  const mostrarRiesgo = !['atendida','finalizada','cancelada','no-asistio','pagada'].includes(appt.estado)
  const riesgo = mostrarRiesgo ? calcularRiesgoNoShow(appt, paciente) : null

  const handleWA = () => {
    if (!appt.pacienteTelefono) return
    const msg = msgConfirmacion(appt, config)
    openWhatsApp(appt.pacienteTelefono, msg)
  }

  const QUICK_STATUSES: AppointmentStatus[] = ['en-sala', 'en-consulta', 'atendida', 'finalizada', 'cancelada', 'no-asistio']

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      opacity: deleting ? 0.4 : 1, position: 'relative',
    }}>
      {/* Time */}
      <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{appt.duracion}min</div>
      </div>

      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600,
        color: 'var(--text2)', flexShrink: 0,
      }}>
        {appt.pacienteNombre.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{appt.pacienteNombre}</div>
          {/* Badge del médico — visible cuando hay multi-doctor */}
          {appt.medicoId && appt.medicoNombre && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 7px', borderRadius: 100, fontSize: 10.5, fontWeight: 600,
              background: `${colorMedico(appt.medicoId)}22`,
              color: colorMedico(appt.medicoId),
              border: `1px solid ${colorMedico(appt.medicoId)}40`,
            }}>
              {appt.medicoNombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').split(' ')[0]}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {typeCfg?.icon} {typeCfg?.label}
          {appt.motivo ? ` · ${appt.motivo}` : ''}
        </div>
        {appt.pacienteTelefono && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>📞 {appt.pacienteTelefono}</div>
        )}
      </div>

      {/* Status */}
      <StatusBadge status={appt.estado} size="sm" />

      {/* Riesgo de no-show (solo niveles alto/muy_alto) */}
      {riesgo && (riesgo.nivel === 'alto' || riesgo.nivel === 'muy_alto') && (
        <span
          title={`Riesgo: ${riesgo.score}/100. ${riesgo.recomendacion}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 700,
            background: `${NIVEL_COLOR[riesgo.nivel]}1A`, color: NIVEL_COLOR[riesgo.nivel],
            border: `1px solid ${NIVEL_COLOR[riesgo.nivel]}55`,
            padding: '2px 7px', borderRadius: 100, flexShrink: 0,
          }}>
          ⚠ {NIVEL_LABEL[riesgo.nivel]}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
        {/* Botón Unirse a videollamada para teleconsulta */}
        {appt.tipo === 'teleconsulta' && (
          <button
            onClick={() => window.open(`/teleconsulta/${appt.id}`, '_blank', 'noopener')}
            title="Unirse a videollamada"
            style={{
              background: 'rgba(20,184,166,0.15)', color: 'var(--teal)',
              border: '1px solid rgba(20,184,166,0.4)', borderRadius: 6,
              padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            🎥 Unirse
          </button>
        )}
        {appt.pacienteTelefono && (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={handleWA} title="WhatsApp">
            <MessageSquare size={15} />
          </button>
        )}
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="Editar">
          <Edit2 size={15} />
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onMenuToggle} title="Más opciones">
          <MoreVertical size={15} />
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', right: 8, top: '100%', zIndex: 20,
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 6, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cambiar estado
          </div>
          {QUICK_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--text2)', background: 'transparent', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
              padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#f87171', background: 'transparent',
            }}
          >
            <Trash2 size={13} /> Eliminar cita
          </button>
        </div>
      )}
    </div>
  )
}
