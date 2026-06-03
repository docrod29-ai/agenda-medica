'use client'
/**
 * Política de retención NOM-004 numeral 5.7
 * Lista los pacientes que están cerca o han superado los 5 años desde su
 * último acto médico, con acciones disponibles.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getPatients } from '@/lib/firestore'
import { getNotas } from '@/lib/expediente/firestore'
import { evaluarRetencion, formatearAntiguedad, listarPacientesPorRevisar, type PacienteRetencion } from '@/lib/retencion'
import { ArrowLeft, Loader2, FileSearch, AlertTriangle, Clock, Eye } from 'lucide-react'

export default function RetencionPage() {
  const router = useRouter()
  const { clinicId } = useClinic()
  const [evaluaciones, setEvaluaciones] = useState<PacienteRetencion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'por_revisar' | 'todos'>('por_revisar')

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    ;(async () => {
      const pacientes = await getPatients(clinicId)
      // Cargar notas de cada paciente en paralelo (puede ser lento si hay muchos)
      const evals = await Promise.all(
        pacientes.map(async (p) => {
          try {
            const notas = await getNotas(clinicId, p.id)
            return evaluarRetencion(p, notas, p.ultimaCita)
          } catch {
            return evaluarRetencion(p, [], p.ultimaCita)
          }
        })
      )
      setEvaluaciones(evals)
      setLoading(false)
    })()
  }, [clinicId])

  const porRevisar = listarPacientesPorRevisar(evaluaciones)
  const vencidos = porRevisar.filter(e => e.estado === 'vencido')
  const cercanos = porRevisar.filter(e => e.estado === 'cercano')
  const lista = filtro === 'por_revisar' ? porRevisar : evaluaciones

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <button onClick={() => router.push('/cumplimiento')} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text3)',
        fontSize: 13, cursor: 'pointer', marginBottom: 14,
      }}>
        <ArrowLeft size={14} /> Cumplimiento
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <FileSearch size={22} color="var(--teal)" />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Política de retención</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
        NOM-004-SSA3-2012 numeral 5.7: el expediente clínico debe conservarse por un
        periodo mínimo de <strong>5 años</strong> desde la última anotación.
      </p>

      {/* Resumen rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <Tarjeta titulo="Total" valor={evaluaciones.length} color="var(--text)" />
        <Tarjeta titulo="Cerca del límite (4½ años)" valor={cercanos.length} color="#f59e0b" icon={<Clock size={14} />} />
        <Tarjeta titulo="Superan 5 años" valor={vencidos.length} color="#ef4444" icon={<AlertTriangle size={14} />} />
      </div>

      {/* Toggle filtro */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setFiltro('por_revisar')}
          style={tabStyle(filtro === 'por_revisar')}
        >
          Por revisar ({porRevisar.length})
        </button>
        <button
          onClick={() => setFiltro('todos')}
          style={tabStyle(filtro === 'todos')}
        >
          Todos ({evaluaciones.length})
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Evaluando expedientes…
        </div>
      ) : lista.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          {filtro === 'por_revisar' ? '✅ Ningún paciente requiere acción' : 'Sin pacientes registrados'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {lista.map(e => (
            <FilaPaciente key={e.patient.id} evaluacion={e} onAbrir={() => router.push(`/expediente/${e.patient.id}`)} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Tarjeta({ titulo, valor, color, icon }: { titulo: string; valor: number; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: 14, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}{titulo}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</div>
    </div>
  )
}

function FilaPaciente({ evaluacion, onAbrir }: { evaluacion: PacienteRetencion; onAbrir: () => void }) {
  const { patient: p, estado, diasDesdeUltimoActo, notasFirmadas } = evaluacion
  const colores = {
    vigente: { bg: 'var(--s)', border: 'var(--border)', badge: 'var(--text3)', badgeBg: 'var(--s2)' },
    cercano: { bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.25)', badge: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)' },
    vencido: { bg: 'rgba(239,68,68,0.04)', border: 'rgba(239,68,68,0.3)', badge: '#ef4444', badgeBg: 'rgba(239,68,68,0.12)' },
  }
  const c = colores[estado]
  const label = estado === 'vencido' ? '>5 años' : estado === 'cercano' ? '~4.5 años' : 'Vigente'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{p.nombre}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
            background: c.badgeBg, color: c.badge,
          }}>{label}</span>
          {notasFirmadas > 0 && (
            <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
              · {notasFirmadas} nota{notasFirmadas !== 1 ? 's' : ''} firmada{notasFirmadas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
          Último acto médico hace <strong>{formatearAntiguedad(diasDesdeUltimoActo)}</strong>
          {p.telefono && <> · {p.telefono}</>}
        </div>
      </div>
      <button
        onClick={onAbrir}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'var(--s2)', border: '1px solid var(--border)',
          color: 'var(--text2)', borderRadius: 8, padding: '6px 12px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <Eye size={12} /> Revisar
      </button>
    </div>
  )
}

const tabStyle = (activo: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  background: activo ? 'rgba(20,184,166,0.12)' : 'var(--s2)',
  color: activo ? 'var(--teal)' : 'var(--text2)',
  border: activo ? '1px solid rgba(20,184,166,0.3)' : '1px solid var(--border)',
})
