'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getPatients } from '@/lib/firestore'
import type { Patient } from '@/types'
import { FileText, Search, Loader2, ChevronRight, AlertTriangle } from 'lucide-react'

export default function ExpedientesPage() {
  const { clinicId } = useClinic()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!clinicId) return
    getPatients(clinicId).then(p => { setPatients(p); setLoading(false) })
  }, [clinicId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return patients
    return patients.filter(p => p.nombre.toLowerCase().includes(q) || p.telefono.includes(q))
  }, [patients, search])

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <FileText size={22} color="var(--teal)" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Expedientes clínicos</h1>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>
        Selecciona un paciente para ver su expediente o iniciar una consulta asistida por IA.
      </p>

      {/* Search */}
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
          No hay pacientes. Agrega pacientes desde la sección Pacientes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => router.push(`/expediente/${p.id}`)}
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
                  {p.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.edad ? `${p.edad} años` : ''}{p.sexo ? ` · ${p.sexo}` : ''}
                    {p.alergias && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#f87171' }}>
                        <AlertTriangle size={11} /> {p.alergias}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text3)" />
            </button>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
