'use client'
/**
 * Política de retención NOM-004 numeral 5.7
 * Lista los pacientes que están cerca o han superado los 5 años desde su
 * último acto médico, con acciones disponibles.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { listarPacientesPagina, TECHO_COMPAT_PACIENTES, LIMITE_MAX_PAGINA_PACIENTES, type CursorPacientes } from '@/lib/firestore'
import { resumenRetencionDeNotas } from '@/lib/expediente/firestore'
import { evaluarRetencion, formatearAntiguedad, listarPacientesPorRevisar, type PacienteRetencion } from '@/lib/retencion'
import { ArrowLeft, Loader2, FileSearch, AlertTriangle, Clock, Eye } from 'lucide-react'
import { Spinner, EmptyState } from '@/components/ui'

export default function RetencionPage() {
  const router = useRouter()
  const { clinicId } = useClinic()
  const [evaluaciones, setEvaluaciones] = useState<PacienteRetencion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'por_revisar' | 'todos'>('por_revisar')
  /** true = se llegó al techo: HAY pacientes que esta pantalla no evaluó. */
  const [truncada, setTruncada] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    ;(async () => {
      /**
       * A3 — EL PEOR ABANICO DEL REPOSITORIO, ACOTADO.
       *
       * Antes: `getPatients` sin cota y después un `Promise.all` sobre TODOS
       * los pacientes, cada uno con su `getNotas()`. Con 50 000 pacientes eso
       * son 50 000 consultas de colección disparadas A LA VEZ desde una pestaña
       * del navegador. El comentario que había lo admitía a medias —«puede ser
       * lento si hay muchos»—: no era lento, era insostenible.
       *
       * Ahora: se recorren páginas hasta un TECHO, y las notas se piden en
       * TANDAS. El paralelismo sigue existiendo (en serie serían minutos), pero
       * acotado: como mucho una tanda en vuelo.
       *
       * Y cuando se llega al techo **se dice**. Una lista de retención que se
       * queda corta en silencio es peor que no tenerla: enseña «ningún paciente
       * por revisar» de un consultorio que sí los tiene, y esto existe para
       * cumplir la NOM-004.
       *
       * LO QUE ESTO NO ES: el arreglo definitivo. Evaluar la retención de un
       * consultorio entero es trabajo de servidor —ya hay un cron que lo hace
       * paginado (`/api/cron/retencion`)— y esta pantalla debería leer ese
       * resultado en vez de recalcularlo en el navegador. Queda declarado.
       */
      const TANDA = 10
      const evals: PacienteRetencion[] = []
      let cursor: CursorPacientes | null = null
      let alcanzoElTecho = false

      const vueltasMax = Math.ceil(TECHO_COMPAT_PACIENTES / LIMITE_MAX_PAGINA_PACIENTES)
      for (let vuelta = 0; vuelta < vueltasMax; vuelta++) {
        const restante = TECHO_COMPAT_PACIENTES - evals.length
        if (restante <= 0) { alcanzoElTecho = true; break }
        const pagina = await listarPacientesPagina(clinicId, {
          limite: Math.min(restante, LIMITE_MAX_PAGINA_PACIENTES),
          cursor,
        })
        for (let i = 0; i < pagina.pacientes.length; i += TANDA) {
          const tanda = pagina.pacientes.slice(i, i + TANDA)
          evals.push(...await Promise.all(tanda.map(async (p) => {
            try {
              /**
               * REG-350 — esto llamaba a `getNotas` por CADA uno de hasta 500
               * pacientes: hasta 500 historiales completos, con transcripción y
               * diálogo diarizado dentro, para calcular una fecha y un conteo.
               *
               * Ahora son dos consultas baratas por paciente: la nota más
               * reciente (`limit(1)`) y el conteo de firmadas hecho **en el
               * servidor**. El conteo así tampoco depende de ningún techo, que
               * importa porque se enseña al lado de un veredicto NOM-004.
               */
              const { ultimaFecha, notasFirmadas } = await resumenRetencionDeNotas(clinicId, p.id)
              return { ...evaluarRetencion(p, [], ultimaFecha ?? p.ultimaCita), notasFirmadas }
            } catch {
              // Sin notas se evalúa igual: la cita y el alta ya dan una fecha.
              return evaluarRetencion(p, [], p.ultimaCita)
            }
          })))
        }
        cursor = pagina.cursor
        if (!pagina.hayMas) break
        if (evals.length >= TECHO_COMPAT_PACIENTES) { alcanzoElTecho = true; break }
      }

      setEvaluaciones(evals)
      setTruncada(alcanzoElTecho)
      setLoading(false)
    })()
  }, [clinicId])

  const porRevisar = listarPacientesPorRevisar(evaluaciones)
  const vencidos = porRevisar.filter(e => e.estado === 'vencido')
  const cercanos = porRevisar.filter(e => e.estado === 'cercano')
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

      {/**
        * A3 — una lista de cumplimiento que se queda corta EN SILENCIO enseña
        * «ningún paciente por revisar» de un consultorio que sí los tiene. Y
        * esta pantalla existe para la NOM-004, así que el hueco se declara.
        */}
      {truncada && (
        <div role="status" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 14,
          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
          border: '1px solid var(--amber)', borderRadius: 10, color: 'var(--text2)', fontSize: 14,
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <span>
            Se evaluaron los primeros <strong>{TECHO_COMPAT_PACIENTES}</strong> pacientes.
            Hay más en el consultorio que <strong>esta pantalla no ha revisado</strong>:
            lo que ves abajo no es la lista completa.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <FileSearch size={22} color="var(--teal)" />
        <h1 className="t-h1" style={{ margin: 0 }}>Política de retención</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
        NOM-004-SSA3-2012 numeral 5.7: el expediente clínico debe conservarse por un
        periodo mínimo de <strong>5 años</strong> desde la última anotación.
      </p>

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
          title={filtro === 'por_revisar' ? 'Ningún paciente requiere acción' : 'Sin pacientes registrados'}
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
  const colores = {
    vigente: { bg: 'var(--s)', border: 'var(--border)', badge: 'var(--text3)', badgeBg: 'var(--s2)' },
    cercano: { bg: 'color-mix(in srgb, var(--amber) 4%, transparent)', border: 'color-mix(in srgb, var(--amber) 25%, transparent)', badge: '#f59e0b', badgeBg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
    vencido: { bg: 'color-mix(in srgb, var(--red) 4%, transparent)', border: 'color-mix(in srgb, var(--red) 30%, transparent)', badge: '#ef4444', badgeBg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
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
            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)',
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
  background: activo ? 'color-mix(in srgb, var(--nexus) 12%, transparent)' : 'var(--s2)',
  color: activo ? 'var(--teal)' : 'var(--text2)',
  border: activo ? '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)' : '1px solid var(--border)',
})
