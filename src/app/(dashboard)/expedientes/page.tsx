'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getPatients, createPatient, getAppointments } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { Patient } from '@/types'
import { FileText, Search, Loader2, ChevronRight, AlertTriangle, CalendarClock, Plus, X } from 'lucide-react'
import { useToast } from '@/context/ToastContext'

/** Entrada unificada: paciente del directorio o derivado de citas */
interface Entrada {
  id: string | null          // null = solo tiene citas, se crea al abrir
  nombre: string
  telefono: string
  edad?: number
  sexo?: string
  alergias?: string
  soloCitas: boolean
}

export default function ExpedientesPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [modalNuevo, setModalNuevo] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    Promise.all([getPatients(clinicId), getAppointments(clinicId)]).then(([patients, appts]) => {
      const norm = (s: string) => s.toLowerCase().trim()
      const normTel = (s: string) => s.replace(/\D/g, '')

      // Índices del directorio para no duplicar
      const idsDirectorio = new Set(patients.map(p => p.id))
      const telDirectorio = new Set(patients.map(p => normTel(p.telefono)).filter(Boolean))
      const nomDirectorio = new Set(patients.map(p => norm(p.nombre)))

      const lista: Entrada[] = patients.map(p => ({
        id: p.id, nombre: p.nombre, telefono: p.telefono,
        edad: p.edad, sexo: p.sexo, alergias: p.alergias, soloCitas: false,
      }))

      // Pacientes que solo existen como citas
      const vistos = new Set<string>()
      for (const a of appts) {
        const tel = normTel(a.pacienteTelefono || '')
        const nom = norm(a.pacienteNombre || '')
        if (!nom) continue
        // ¿ya está en el directorio?
        if (a.pacienteId && idsDirectorio.has(a.pacienteId)) continue
        if (tel && telDirectorio.has(tel)) continue
        if (nomDirectorio.has(nom)) continue
        // ¿ya lo agregamos como huérfano?
        const clave = tel || nom
        if (vistos.has(clave)) continue
        vistos.add(clave)
        lista.push({
          id: null, nombre: a.pacienteNombre, telefono: a.pacienteTelefono || '',
          soloCitas: true,
        })
      }

      lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setEntradas(lista)
      setLoading(false)
    })
  }, [clinicId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entradas
    return entradas.filter(e => e.nombre.toLowerCase().includes(q) || e.telefono.includes(q))
  }, [entradas, search])

  const abrir = async (e: Entrada) => {
    if (e.id) { router.push(`/expediente/${e.id}`); return }
    // Crear el paciente al vuelo y navegar
    if (!clinicId) return
    setAbriendo(e.nombre + e.telefono)
    try {
      const id = await createPatient(clinicId, {
        nombre: e.nombre,
        telefono: e.telefono.replace(/\D/g, ''),
        noShowCount: 0,
        cancelacionCount: 0,
        createdAt: '',
        updatedAt: '',
        creadoPor: user?.email || 'sistema',
      })
      router.push(`/expediente/${id}`)
    } catch {
      setAbriendo(null)
    }
  }

  const crearYAbrir = async (datos: { nombre: string; telefono: string; edad?: number; sexo?: Patient['sexo']; alergias?: string; notas?: string }) => {
    if (!clinicId) return
    const id = await createPatient(clinicId, {
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.replace(/\D/g, ''),
      edad: datos.edad,
      sexo: datos.sexo,
      alergias: datos.alergias?.trim() || undefined,
      notas: datos.notas?.trim() || undefined,
      noShowCount: 0,
      cancelacionCount: 0,
      createdAt: '',
      updatedAt: '',
      creadoPor: user?.email || 'medico',
    })
    toast('Paciente creado', 'success')
    router.push(`/expediente/${id}`)
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={22} color="var(--teal)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Expedientes clínicos</h1>
        </div>
        <button onClick={() => setModalNuevo(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'var(--teal)', color: '#000',
          border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={16} /> Nuevo paciente
        </button>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>
        Selecciona un paciente para ver su expediente, o crea uno nuevo aunque no tenga cita.
      </p>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} color="var(--text3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar paciente por nombre o teléfono…"
          style={{
            width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 16px 12px 42px', fontSize: 14, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', padding: 40 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando pacientes…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 14 }}>
          No hay pacientes. Agrega pacientes o agenda una cita.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((e, i) => {
            const cargando = abriendo === e.nombre + e.telefono
            return (
              <button
                key={(e.id ?? 'orphan') + i}
                onClick={() => abrir(e)}
                disabled={cargando}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '14px 18px', cursor: 'pointer', textAlign: 'left', gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: 'var(--s3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: 'var(--teal)', flexShrink: 0,
                  }}>
                    {e.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {e.nombre}
                      {e.soloCitas && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: 'var(--text3)', background: 'var(--s2)', padding: '2px 7px', borderRadius: 100 }}>
                          <CalendarClock size={10} /> de cita
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {e.edad ? `${e.edad} años` : ''}{e.sexo ? ` · ${e.sexo}` : ''}{e.telefono ? ` · ${e.telefono}` : ''}
                      {e.alergias && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#f87171' }}>
                          <AlertTriangle size={11} /> {e.alergias}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {cargando
                  ? <Loader2 size={16} color="var(--text3)" style={{ animation: 'spin 1s linear infinite' }} />
                  : <ChevronRight size={18} color="var(--text3)" />}
              </button>
            )
          })}
        </div>
      )}
      {modalNuevo && (
        <NuevoPacienteModal
          onClose={() => setModalNuevo(false)}
          onGuardar={async d => { await crearYAbrir(d) }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function NuevoPacienteModal({ onClose, onGuardar }: {
  onClose: () => void
  onGuardar: (d: { nombre: string; telefono: string; edad?: number; sexo?: Patient['sexo']; alergias?: string; notas?: string }) => Promise<void>
}) {
  const [f, setF] = useState({ nombre: '', telefono: '', edad: '', sexo: '' as '' | Patient['sexo'], alergias: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const valido = f.nombre.trim().length > 2

  const guardar = async () => {
    if (!valido) return
    setSaving(true)
    try {
      await onGuardar({
        nombre: f.nombre, telefono: f.telefono,
        edad: f.edad ? Number(f.edad) : undefined,
        sexo: f.sexo || undefined,
        alergias: f.alergias, notas: f.notas,
      })
    } finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Nuevo paciente</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nombre completo *</label>
            <input autoFocus value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Juan García López" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Teléfono</label>
              <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} placeholder="614-123-4567" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Edad</label>
              <input type="number" value={f.edad} onChange={e => setF({ ...f, edad: e.target.value })} placeholder="años" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Sexo</label>
            <select value={f.sexo} onChange={e => setF({ ...f, sexo: e.target.value as '' | Patient['sexo'] })} style={inputStyle}>
              <option value="">—</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Alergias</label>
            <input value={f.alergias} onChange={e => setF({ ...f, alergias: e.target.value })} placeholder="Penicilina, sulfas… (o 'Negadas')" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Notas</label>
            <textarea value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} placeholder="Comorbilidades, observaciones…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={!valido || saving} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: valido ? 'var(--teal)' : 'var(--s3)', color: valido ? '#000' : 'var(--text3)',
            border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: valido && !saving ? 'pointer' : 'default',
          }}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creando…</> : 'Crear y abrir expediente'}
          </button>
        </div>
      </div>
    </div>
  )
}
