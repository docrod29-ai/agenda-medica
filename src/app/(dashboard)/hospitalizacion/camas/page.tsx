'use client'
// ══════════════════════════════════════════════════════════════
// Tablero de camas — ocupación agrupada por servicio (derivada del censo).
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getCenso } from '@/lib/hospital/firestore'
import { diasEstancia, type Internamiento } from '@/types/hospital'
import { Spinner } from '@/components/ui'
import { ArrowLeft, BedDouble } from 'lucide-react'

export default function CamasPage() {
  const router = useRouter()
  const { clinicId } = useClinic()
  const [censo, setCenso] = useState<Internamiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    getCenso(clinicId).then(setCenso).catch(() => {}).finally(() => setLoading(false))
  }, [clinicId])

  const porServicio = useMemo(() => {
    const m = new Map<string, Internamiento[]>()
    for (const i of censo) {
      const k = i.servicio || 'Sin servicio'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(i)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [censo])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 40px' }}>
      <button onClick={() => router.push('/hospitalizacion')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
        <ArrowLeft size={15} /> Censo
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BedDouble size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Tablero de camas
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>Camas ocupadas ahora mismo, por servicio. {censo.length} paciente(s) internado(s).</p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : porServicio.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>No hay camas ocupadas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {porServicio.map(([servicio, lista]) => (
            <div key={servicio}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{servicio} · {lista.length}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {lista.map(i => (
                  <button key={i.id} onClick={() => router.push(`/hospitalizacion/${i.id}`)} style={{
                    textAlign: 'left', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--s1)', cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--nexus,#3d5afe)' }}>
                      <BedDouble size={13} /> {i.cama ? `Cama ${i.cama}` : 'Sin cama'}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.pacienteNombre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.diagnosticoIngreso}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{diasEstancia(i)} días</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
