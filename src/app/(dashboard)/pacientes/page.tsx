'use client'
import { useState, useEffect, useMemo } from 'react'
import { Patient } from '@/types'
import { getPatients, createPatient, updatePatient } from '@/lib/firestore'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useMode } from '@/context/ModeContext'
import { Plus, Search, X, Loader2, Users, Phone, AlertCircle, FileText, Calendar, Pencil, Cake } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PacientesPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { clinicId } = useClinic()
  const { mode } = useMode()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'recientes' | 'todos' | 'alerta'>('recientes')
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

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Búsqueda: aplana resultados sobre TODOS los pacientes (ignora el chip).
  const resultadosBusqueda = useMemo(() => {
    const q = norm(search.trim())
    if (!q) return null
    return patients
      .filter(p => norm(p.nombre).includes(q) || p.telefono.includes(search) || norm(p.email ?? '').includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [patients, search])

  // Recientes: por última cita (desc), top 15. "No se ve toda la lista".
  const recientes = useMemo(() =>
    [...patients]
      .filter(p => p.ultimaCita)
      .sort((a, b) => (b.ultimaCita ?? '').localeCompare(a.ultimaCita ?? ''))
      .slice(0, 15),
    [patients]
  )

  // Con alerta: no-show o cancelaciones.
  const conAlerta = useMemo(() =>
    [...patients]
      .filter(p => (p.noShowCount ?? 0) > 0 || (p.cancelacionCount ?? 0) > 0)
      .sort((a, b) => (b.noShowCount + b.cancelacionCount) - (a.noShowCount + a.cancelacionCount)),
    [patients]
  )

  // Todos agrupados por inicial (A, B, C…) con orden alfabético español.
  const grupos = useMemo(() => {
    const ordenados = [...patients].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const map = new Map<string, Patient[]>()
    for (const p of ordenados) {
      const ch = (p.nombre.trim()[0] ?? '#').toUpperCase()
      const letra = /[A-ZÑ]/.test(ch) ? ch : '#'
      if (!map.has(letra)) map.set(letra, [])
      map.get(letra)!.push(p)
    }
    return Array.from(map.entries())
  }, [patients])

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
        {/* Modo Secretaria: solo botón de Agendar (unifica flujo). Modo Médico: botón completo + atajo a Agendar. */}
        {mode === 'secretaria' ? (
          <Link href="/asistente">
            <button className="btn btn-primary">
              <Calendar size={16} /> Agendar (registra paciente)
            </button>
          </Link>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/asistente">
              <button className="btn btn-secondary">
                <Calendar size={16} /> Agendar
              </button>
            </Link>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo paciente</button>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12, maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input className="input" style={{ paddingLeft: 32 }} placeholder="Buscar por nombre, teléfono o correo…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Chips de organización — solo cuando NO hay búsqueda activa */}
      {!search.trim() && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {([
            ['recientes', `Recientes${recientes.length ? ` (${recientes.length})` : ''}`],
            ['todos', `Todos A-Z (${patients.length})`],
            ['alerta', `Con alerta${conAlerta.length ? ` (${conAlerta.length})` : ''}`],
          ] as const).map(([k, label]) => {
            const activo = filtro === k
            return (
              <button key={k} onClick={() => setFiltro(k)} style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: activo ? 'var(--teal)' : 'var(--s2)',
                color: activo ? '#000' : 'var(--text2)',
                border: `1px solid ${activo ? 'var(--teal)' : 'var(--border)'}`,
              }}>{label}</button>
            )
          })}
        </div>
      )}

      {/* Lista */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>Cargando pacientes…</div>
        ) : patients.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Users size={40} color="var(--text3)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', fontSize: 14, margin: 0 }}>No hay pacientes registrados</p>
          </div>
        ) : resultadosBusqueda ? (
          // Búsqueda activa → resultados aplanados
          resultadosBusqueda.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Sin resultados para “{search}”.
            </div>
          ) : (
            <>
              <ListaEncabezado texto={`${resultadosBusqueda.length} resultado${resultadosBusqueda.length !== 1 ? 's' : ''}`} />
              {resultadosBusqueda.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} onAbrir={() => mode === 'medico' ? router.push(`/expediente/${p.id}`) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </>
          )
        ) : filtro === 'recientes' ? (
          recientes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Aún no hay pacientes con citas recientes. Usa <strong>Todos A-Z</strong> o busca por nombre.
            </div>
          ) : (
            <>
              <ListaEncabezado texto="Vistos recientemente" />
              {recientes.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} onAbrir={() => mode === 'medico' ? router.push(`/expediente/${p.id}`) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </>
          )
        ) : filtro === 'alerta' ? (
          conAlerta.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Ningún paciente con inasistencias o cancelaciones.
            </div>
          ) : (
            <>
              <ListaEncabezado texto={`${conAlerta.length} con inasistencias / cancelaciones`} />
              {conAlerta.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} onAbrir={() => mode === 'medico' ? router.push(`/expediente/${p.id}`) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </>
          )
        ) : (
          // Todos A-Z agrupados por inicial
          grupos.map(([letra, lista]) => (
            <div key={letra}>
              <div style={{
                position: 'sticky', top: 0, zIndex: 1,
                background: 'var(--s2)', padding: '5px 16px', fontSize: 12, fontWeight: 700,
                color: 'var(--text3)', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)',
              }}>{letra}</div>
              {lista.map(p => (
                <PacienteRow key={p.id} p={p} mode={mode} onAbrir={() => mode === 'medico' ? router.push(`/expediente/${p.id}`) : openEdit(p)} onEditar={() => openEdit(p)} />
              ))}
            </div>
          ))
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

/** Encabezado gris de una sección de la lista. */
function ListaEncabezado({ texto }: { texto: string }) {
  return (
    <div style={{ padding: '8px 16px', fontSize: 11.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--s1)' }}>
      {texto}
    </div>
  )
}

/** Fila de paciente reutilizable (búsqueda, recientes, alerta, A-Z). */
function PacienteRow({ p, mode, onAbrir, onEditar }: {
  p: Patient
  mode: string
  onAbrir: () => void
  onEditar: () => void
}) {
  return (
    <div
      onClick={onAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: 'var(--text2)', flexShrink: 0,
      }}>
        {p.nombre.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {p.telefono && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} className="ds-icon" /> {p.telefono}</span>}
          {p.edad && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cake size={11} className="ds-icon" /> {p.edad} años</span>}
        </div>
      </div>
      {(p.noShowCount > 0 || p.cancelacionCount > 0) && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {p.noShowCount > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{p.noShowCount} no-show{p.noShowCount > 1 ? 's' : ''}</span>
          )}
          {p.cancelacionCount > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>{p.cancelacionCount} cancel.</span>
          )}
        </div>
      )}
      {mode === 'medico' && (
        <button
          onClick={e => { e.stopPropagation(); onEditar() }}
          title="Editar datos de contacto"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: 'var(--s2)', border: '1px solid var(--border)',
            color: 'var(--text2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Pencil size={12} /> Editar
        </button>
      )}
      {mode === 'medico' && <FileText size={14} color="var(--text3)" style={{ flexShrink: 0 }} />}
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
  const { mode } = useMode()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    nombre: patient?.nombre ?? '',
    telefono: patient?.telefono ?? '',
    whatsapp: patient?.whatsapp ?? '',
    email: patient?.email ?? '',
    fechaNacimiento: patient?.fechaNacimiento ?? '',
    edad: String(patient?.edad ?? ''),
    sexo: patient?.sexo ?? '',
    curp: patient?.curp ?? '',
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
        curp: f.curp.trim().toUpperCase() || undefined,
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
              <label className="label">CURP (NOM-024) <span style={{ color: 'var(--text3)', fontSize: 11 }}>opcional</span></label>
              <input
                className="input"
                value={f.curp}
                onChange={(e) => setF({ ...f, curp: e.target.value.toUpperCase() })}
                maxLength={18}
                placeholder="GARC890101HCHRZN09"
                style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label className="label">Seguro médico</label>
              <input className="input" value={f.seguroMedico} onChange={upd('seguroMedico')} placeholder="IMSS, ISSSTE, Gastos mayores…" />
            </div>
            {/* Datos CLÍNICOS — solo médicos/admin pueden verlos y editarlos.
                La asistente solo administra datos demográficos del paciente. */}
            {mode === 'medico' && (
              <>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Alergias</label>
                  <input className="input" value={f.alergias} onChange={upd('alergias')} placeholder="Penicilina, AINES, …" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Notas clínicas</label>
                  <textarea className="input" value={f.notas} onChange={upd('notas')} rows={2} placeholder="Información adicional" />
                </div>
              </>
            )}
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
