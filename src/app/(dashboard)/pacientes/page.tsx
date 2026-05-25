'use client'
import { useState, useEffect, useMemo } from 'react'
import { Patient } from '@/types'
import { getPatients, createPatient, updatePatient } from '@/lib/firestore'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { Plus, Search, X, Loader2, Users, Phone, AlertCircle, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PacientesPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)

  const load = async () => {
    if (!clinicId) return
    try {
      const data = await getPatients(clinicId)
      setPatients(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clinicId])

  const filtered = useMemo(() =>
    patients.filter(p =>
      !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.telefono.includes(search) ||
      (p.email ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [patients, search]
  )

  const openEdit = (p: Patient) => { setEditPatient(p); setModalOpen(true) }
  const openNew = () => { setEditPatient(null); setModalOpen(true) }

  const onSaved = () => {
    setModalOpen(false); setEditPatient(null)
    load()
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Pacientes</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo paciente</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input className="input" style={{ paddingLeft: 32 }} placeholder="Buscar por nombre, teléfono…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>{filtered.length} paciente{filtered.length !== 1 ? 's' : ''}</div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>Cargando pacientes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Users size={40} color="var(--text3)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', fontSize: 14, margin: 0 }}>No hay pacientes registrados</p>
          </div>
        ) : (
          <div>
            {filtered.map((p, i) => (
              <div
                key={p.id}
                onClick={() => openEdit(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                  borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: 'var(--text2)', flexShrink: 0,
                }}>
                  {p.nombre.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                    {p.telefono && <span>📞 {p.telefono}</span>}
                    {p.email && <span>✉️ {p.email}</span>}
                    {p.edad && <span>🎂 {p.edad} años</span>}
                  </div>
                </div>

                {(p.noShowCount > 0 || p.cancelacionCount > 0) && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {p.noShowCount > 0 && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        {p.noShowCount} no-show{p.noShowCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {p.cancelacionCount > 0 && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
                        {p.cancelacionCount} cancel.
                      </span>
                    )}
                  </div>
                )}

                {/* Expediente */}
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/expediente/${p.id}`) }}
                  title="Ver expediente clínico"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    background: 'rgba(0,212,168,0.08)', border: '1px solid rgba(0,212,168,0.25)',
                    color: 'var(--teal)', borderRadius: 8, padding: '6px 12px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <FileText size={13} /> Expediente
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <PatientModal
          patient={editPatient}
          onClose={() => { setModalOpen(false); setEditPatient(null) }}
          onSaved={onSaved}
          userEmail={user?.email ?? ''}
        />
      )}
    </div>
  )
}

function PatientModal({ patient, onClose, onSaved, userEmail }: {
  patient: Patient | null
  onClose: () => void
  onSaved: () => void
  userEmail: string
}) {
  const { toast } = useToast()
  const { clinicId } = useClinic()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    nombre: patient?.nombre ?? '',
    telefono: patient?.telefono ?? '',
    whatsapp: patient?.whatsapp ?? '',
    email: patient?.email ?? '',
    fechaNacimiento: patient?.fechaNacimiento ?? '',
    edad: String(patient?.edad ?? ''),
    sexo: patient?.sexo ?? '',
    seguroMedico: patient?.seguroMedico ?? '',
    alergias: patient?.alergias ?? '',
    notas: patient?.notas ?? '',
  })

  const upd = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [key]: e.target.value }))

  const handleSave = async () => {
    if (!f.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        nombre: f.nombre.trim(),
        telefono: f.telefono.replace(/\D/g, ''),
        whatsapp: f.whatsapp.replace(/\D/g, ''),
        email: f.email.trim(),
        fechaNacimiento: f.fechaNacimiento,
        edad: f.edad ? Number(f.edad) : undefined,
        sexo: f.sexo as Patient['sexo'],
        seguroMedico: f.seguroMedico.trim(),
        alergias: f.alergias.trim(),
        notas: f.notas.trim(),
        noShowCount: patient?.noShowCount ?? 0,
        cancelacionCount: patient?.cancelacionCount ?? 0,
        creadoPor: patient?.creadoPor ?? userEmail,
        updatedAt: new Date().toISOString(),
        createdAt: patient?.createdAt ?? new Date().toISOString(),
      }
      if (patient) {
        await updatePatient(clinicId!, patient.id, payload)
        toast('Paciente actualizado', 'success')
      } else {
        await createPatient(clinicId!, payload)
        toast('Paciente registrado', 'success')
      }
      onSaved()
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {patient ? 'Editar paciente' : 'Nuevo paciente'}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Nombre completo *</label>
              <input className="input" value={f.nombre} onChange={upd('nombre')} placeholder="Apellido Apellido, Nombre" />
            </div>
            <div className="form-group">
              <label className="label">Teléfono</label>
              <input className="input" type="tel" value={f.telefono} onChange={upd('telefono')} placeholder="6641234567" />
            </div>
            <div className="form-group">
              <label className="label">WhatsApp</label>
              <input className="input" type="tel" value={f.whatsapp} onChange={upd('whatsapp')} placeholder="6641234567" />
            </div>
            <div className="form-group">
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" value={f.email} onChange={upd('email')} placeholder="paciente@email.com" />
            </div>
            <div className="form-group">
              <label className="label">Fecha de nacimiento</label>
              <input className="input" type="date" value={f.fechaNacimiento} onChange={upd('fechaNacimiento')} />
            </div>
            <div className="form-group">
              <label className="label">Edad</label>
              <input className="input" type="number" value={f.edad} onChange={upd('edad')} min={0} max={130} />
            </div>
            <div className="form-group">
              <label className="label">Sexo</label>
              <select className="input" value={f.sexo} onChange={upd('sexo')}>
                <option value="">Seleccionar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Seguro médico</label>
              <input className="input" value={f.seguroMedico} onChange={upd('seguroMedico')} placeholder="IMSS, ISSSTE, Gastos mayores…" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Alergias</label>
              <input className="input" value={f.alergias} onChange={upd('alergias')} placeholder="Penicilina, AINES, …" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Notas</label>
              <textarea className="input" value={f.notas} onChange={upd('notas')} rows={2} placeholder="Información adicional" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : (patient ? 'Guardar cambios' : 'Registrar')}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
