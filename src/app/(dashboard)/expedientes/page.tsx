'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getPatients, createPatient, getAppointments } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { Patient } from '@/types'
import { FileText, Search, Loader2, ChevronRight, AlertTriangle, CalendarClock } from 'lucide-react'

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
  const router = useRouter()
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [abriendo, setAbriendo] = useState<string | null>(null)

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

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <FileText size={22} color="var(--teal)" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Expedientes clínicos</h1>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>
        Selecciona un paciente para ver su expediente o iniciar una consulta asistida por IA.
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
