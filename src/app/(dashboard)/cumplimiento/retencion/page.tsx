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
import { ArrowLeft, Loader2, FileSearch, AlertTriangle, Clock, Eye, HelpCircle } from 'lucide-react'
import { Spinner, EmptyState, Alert } from '@/components/ui'
import { conTiempoLimite } from '@/lib/fetch-con-timeout'

/**
 * Techos de espera. Ninguno es una política: son lo que separa «tarda» de «no
 * va a volver», y sin ellos el `finally` que apaga el «Evaluando expedientes…»
 * no llega a correr.
 */
const ESPERA_EXPEDIENTES_MS = 15000
const ESPERA_NOTAS_MS = 12000

export default function RetencionPage() {
  const router = useRouter()
  const { clinicId } = useClinic()
  const [evaluaciones, setEvaluaciones] = useState<PacienteRetencion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'por_revisar' | 'todos'>('por_revisar')
  const [falloCarga, setFalloCarga] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    setFalloCarga(null)
    ;(async () => {
      try {
        // CON TECHO: una lectura de Firestore sin red no rechaza, se queda
        // pendiente. Sin esto, `finally` no corre nunca y «Evaluando
        // expedientes…» se queda en pantalla para siempre.
        const pacientes = await conTiempoLimite(
          getPatients(clinicId), ESPERA_EXPEDIENTES_MS, 'la lista de pacientes',
        )
        // Cargar notas de cada paciente en paralelo (puede ser lento si hay muchos)
        const evals = await Promise.all(
          pacientes.map(async (p) => {
            try {
              const notas = await conTiempoLimite(
                getNotas(clinicId, p.id), ESPERA_NOTAS_MS, `las notas de un expediente`,
              )
              return evaluarRetencion(p, notas, p.ultimaCita)
            } catch {
              // `null`, NO `[]`. Que no se pudieran leer sus notas no significa
              // que no tenga. Con `[]` este paciente saldría fechado en su alta
              // y con cero notas firmadas: viejo y vacío, que son justo las dos
              // señales que invitan a archivar un expediente vivo.
              return evaluarRetencion(p, null, p.ultimaCita)
            }
          })
        )
        setEvaluaciones(evals)
      } catch {
        // Sin la lista de pacientes no hay pantalla que valga: cero expedientes
        // y «ningún paciente requiere acción» sería exactamente la respuesta
        // tranquilizadora que este fallo no puede dar.
        setEvaluaciones([])
        setFalloCarga('No se pudo leer la lista de pacientes.')
      } finally {
        setLoading(false)
      }
    })()
  }, [clinicId])

  const porRevisar = listarPacientesPorRevisar(evaluaciones)
  const vencidos = porRevisar.filter(e => e.estado === 'vencido')
  const cercanos = porRevisar.filter(e => e.estado === 'cercano')
  const noEvaluables = evaluaciones.filter(e => e.estado === 'no_evaluable')
  const lista = filtro === 'por_revisar' ? porRevisar : evaluaciones

  return (
    <div className="nx-canvas">
      <button onClick={() => router.push('/cumplimiento')} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text3)',
        fontSize: 13, cursor: 'pointer', marginBottom: 14,
      }}>
        <ArrowLeft size={14} /> Cumplimiento
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <FileSearch size={22} color="var(--teal)" />
        <h1 className="t-h1" style={{ margin: 0 }}>Política de retención</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
        NOM-004-SSA3-2012 numeral 5.7: el expediente clínico debe conservarse por un
        periodo mínimo de <strong>5 años</strong> desde la última anotación.
      </p>

      {falloCarga && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger" title="No se pudo evaluar la retención">
            {falloCarga} Los totales de abajo están vacíos <strong>porque falló la
            lectura</strong>, no porque no haya expedientes. Vuelve a cargar la
            pantalla antes de tomar cualquier decisión sobre un expediente.
          </Alert>
        </div>
      )}

      {!loading && noEvaluables.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning" title={`${noEvaluables.length} expediente${noEvaluables.length !== 1 ? 's' : ''} sin evaluar`}>
            No se pudieron leer sus notas, así que <strong>no se calculó</strong> su
            antigüedad: aparecen al principio de la lista, sin veredicto. Los
            totales de abajo <strong>no los incluyen</strong>.
          </Alert>
        </div>
      )}

      {/* Resumen rápido */}
      <div className="nx-stat-grid" style={{ gap: 12, marginBottom: 18 }}>
        <Tarjeta titulo="Total" valor={evaluaciones.length} color="var(--text)" />
        <Tarjeta titulo="Cerca del límite (4½ años)" valor={cercanos.length} color="var(--amber)" icon={<Clock size={14} />} />
        <Tarjeta titulo="Superan 5 años" valor={vencidos.length} color="var(--red)" icon={<AlertTriangle size={14} />} />
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
        <Spinner center label="Evaluando expedientes…" />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<FileSearch size={22} />}
          title={falloCarga
            ? 'No se pudo leer: esta lista no dice nada'
            : filtro === 'por_revisar' ? 'Ningún paciente requiere acción' : 'Sin pacientes registrados'}
        />
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
  const colores: Record<PacienteRetencion['estado'], { bg: string; border: string; badge: string; badgeBg: string }> = {
    vigente: { bg: 'var(--s)', border: 'var(--border)', badge: 'var(--text3)', badgeBg: 'var(--s2)' },
    cercano: { bg: 'color-mix(in srgb, var(--amber) 4%, transparent)', border: 'color-mix(in srgb, var(--amber) 25%, transparent)', badge: '#f59e0b', badgeBg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
    vencido: { bg: 'color-mix(in srgb, var(--red) 4%, transparent)', border: 'color-mix(in srgb, var(--red) 30%, transparent)', badge: '#ef4444', badgeBg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
    // Ni verde ni rojo: no es un grado intermedio de antigüedad, es la ausencia
    // de veredicto. Pintarlo con el color de un estado sería inventarle uno.
    no_evaluable: { bg: 'var(--s)', border: 'var(--border)', badge: 'var(--text2)', badgeBg: 'var(--s2)' },
  }
  const c = colores[estado]
  const label = estado === 'vencido' ? '>5 años'
    : estado === 'cercano' ? '~4.5 años'
    : estado === 'no_evaluable' ? 'Sin evaluar'
    : 'Vigente'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{p.nombre}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)',
            background: c.badgeBg, color: c.badge,
          }}>
            {estado === 'no_evaluable' && <HelpCircle size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />}
            {label}
          </span>
          {notasFirmadas !== null && notasFirmadas > 0 && (
            <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
              · {notasFirmadas} nota{notasFirmadas !== 1 ? 's' : ''} firmada{notasFirmadas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
          {estado === 'no_evaluable' || diasDesdeUltimoActo === null ? (
            // Se dice lo que pasó, no un número que no se tiene. Cero notas y
            // una fecha caída hasta el alta harían parecer archivable un
            // expediente vivo.
            <>No se pudieron leer sus notas: <strong>no se evaluó su antigüedad</strong></>
          ) : (
            <>Último acto médico hace <strong>{formatearAntiguedad(diasDesdeUltimoActo)}</strong></>
          )}
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
  background: activo ? 'color-mix(in srgb, var(--nexus) 12%, transparent)' : 'var(--s2)',
  color: activo ? 'var(--teal)' : 'var(--text2)',
  border: activo ? '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)' : '1px solid var(--border)',
})
