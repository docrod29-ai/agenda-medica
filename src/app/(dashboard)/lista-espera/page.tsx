'use client'
import { useState, useEffect } from 'react'
import { WaitlistEntry, AppointmentType, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { PageHeader, Button, EmptyState, Spinner, Modal, Input, Select, Textarea } from '@/components/ui'
import { AgendaVacia } from '@/components/brand/EmptyArt'
import { getWaitlist, createWaitlistEntry, updateWaitlistEntry } from '@/lib/firestore'
import { useToast } from '@/context/ToastContext'
import { useConfig } from '@/hooks/useConfig'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { openWhatsApp, msgListaEsperaAviso } from '@/lib/whatsapp'
import { Plus, X, MessageSquare, CheckCircle2, Clock, Phone, Calendar } from 'lucide-react'

export default function ListaEsperaPage() {
  const { toast } = useToast()
  const { config } = useConfig()
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    if (!clinicId) return
    try {
      const data = await getWaitlist(clinicId)
      setEntries(data)
    } catch (e) {
      // Un fallo de lectura NO puede verse igual que una lista vacía: para un
      // médico con cientos de registros, eso se lee como pérdida total de datos.
      console.error('[lista de espera] no se pudo cargar', e)
      setErrorCarga('No se pudo cargar la información. Revisa tu conexión y reintenta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clinicId])

  const handleRemove = async (id: string) => {
    try {
      await updateWaitlistEntry(clinicId!, id, { estado: 'eliminado' })
      toast('Eliminado de la lista', 'info')
      load()
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  const handleNotify = (entry: WaitlistEntry) => {
    const fecha = new Date().toISOString().slice(0, 10)
    const hora = '10:00'
    const msg = msgListaEsperaAviso(entry, config, fecha, hora)
    openWhatsApp(entry.pacienteTelefono, msg)
  }

  const handleConverted = async (id: string) => {
    try {
      await updateWaitlistEntry(clinicId!, id, { estado: 'convertido' })
      toast('Marcado como convertido', 'success')
      load()
    } catch {
      toast('Error', 'error')
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title="Lista de espera"
        subtitle="Pacientes esperando disponibilidad"
        actions={<Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>Agregar</Button>}
      />

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Spinner center label="Cargando lista de espera…" />
        ) : errorCarga ? (
          <EmptyState
            title="No se pudo cargar"
            description={errorCarga}
            action={<Button onClick={() => window.location.reload()}>Reintentar</Button>}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            illustration={<AgendaVacia />}
            title="La lista de espera está vacía"
            description="Agrega pacientes que esperan un hueco; te avisamos cuando se libere una cita."
            action={<Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>Agregar</Button>}
          />
        ) : (
          <div>
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                {/* Priority badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: entry.prioridad <= 1 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                  color: entry.prioridad <= 1 ? '#f87171' : '#60a5fa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {entry.prioridad}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{entry.pacienteNombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {entry.pacienteTelefono && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} className="ds-icon" /> {entry.pacienteTelefono}</span>}
                    {entry.tipo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TipoCitaIcon tipo={entry.tipo} size={11} /> {APPOINTMENT_TYPE_CONFIG[entry.tipo]?.label}</span>}
                    {entry.fechaDeseada && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11} className="ds-icon" /> A partir de: {entry.fechaDeseada}</span>}
                    {entry.rangoHorario && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} className="ds-icon" /> {entry.rangoHorario}</span>}
                  </div>
                  {entry.notas && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, fontStyle: 'italic' }}>"{entry.notas}"</div>
                  )}
                </div>

                {/* Estado */}
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500,
                  background: entry.estado === 'activo' ? 'rgba(59,130,246,0.15)' : entry.estado === 'contactado' ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
                  color: entry.estado === 'activo' ? '#60a5fa' : entry.estado === 'contactado' ? '#fbbf24' : '#4ade80',
                }}>
                  {entry.estado}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {entry.pacienteTelefono && (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleNotify(entry)} title="Notificar por WhatsApp">
                      <MessageSquare size={15} />
                    </button>
                  )}
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleConverted(entry.id)} title="Marcar como convertido" style={{ color: '#4ade80' }}>
                    <CheckCircle2 size={15} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleRemove(entry.id)} title="Eliminar" style={{ color: '#f87171' }}>
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <AddWaitlistModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
          userEmail={user?.email ?? ''}
        />
      )}
    </div>
  )
}

function AddWaitlistModal({ onClose, onSaved, userEmail }: { onClose: () => void; onSaved: () => void; userEmail: string }) {
  const { toast } = useToast()
  const { clinicId } = useClinic()
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [tipo, setTipo] = useState<AppointmentType>('seguimiento')
  const [fechaDeseada, setFechaDeseada] = useState('')
  const [rangoHorario, setRangoHorario] = useState('')
  const [prioridad, setPrioridad] = useState(3)
  const [notas, setNotas] = useState('')

  const handleSave = async () => {
    if (!nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    setSaving(true)
    try {
      await createWaitlistEntry(clinicId!, {
        pacienteNombre: nombre.trim(),
        pacienteTelefono: telefono.replace(/\D/g, ''),
        tipo, fechaDeseada, rangoHorario, prioridad,
        notas: notas.trim(),
        estado: 'activo',
        createdAt: new Date().toISOString(),
        creadoPor: userEmail,
      })
      toast('Agregado a la lista de espera', 'success')
      onSaved()
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Agregar a lista de espera"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>Agregar</Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Nombre" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" autoFocus />
        <Input label="Teléfono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="6641234567" />
        <Select label="Tipo de consulta" value={tipo} onChange={e => setTipo(e.target.value as AppointmentType)}>
          {Object.entries(APPOINTMENT_TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Fecha disponible a partir de" type="date" value={fechaDeseada} onChange={e => setFechaDeseada(e.target.value)} />
          <Input label="Rango horario preferido" value={rangoHorario} onChange={e => setRangoHorario(e.target.value)} placeholder="Ej. Mañana, 9-12" />
        </div>
        <Input label="Prioridad (1 = mayor prioridad)" type="number" min={1} max={10} value={prioridad} onChange={e => setPrioridad(Number(e.target.value))} />
        <Textarea label="Notas" value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Observaciones adicionales" />
      </div>
    </Modal>
  )
}
