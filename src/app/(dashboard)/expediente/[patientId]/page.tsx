'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useExpediente } from '@/hooks/useExpediente'
import { getPatients } from '@/lib/firestore'
import { deleteNota } from '@/lib/expediente/firestore'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import type { Patient } from '@/types'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { NotaMedica, TipoNota } from '@/types/expediente'
import {
  ArrowLeft, Mic, FileText, Loader2, AlertTriangle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Plus, Printer, Trash2, Send, Pill, ClipboardList, Pencil, Upload,
  Stethoscope, Activity, LogIn, LogOut, UserPlus, ClipboardCheck, type LucideIcon,
} from 'lucide-react'
import { Button, EmptyState, Spinner, Badge } from '@/components/ui'

/** Icono lineal por tipo de nota — nodo del timeline clínico. */
const ICONO_TIPO_NOTA: Record<TipoNota, LucideIcon> = {
  historia_clinica: FileText,
  primera_vez: UserPlus,
  seguimiento: Stethoscope,
  alta_consulta: LogOut,
  ingreso: LogIn,
  evolucion: Activity,
  egreso: LogOut,
  valoracion_preoperatoria: ClipboardCheck,
}

export default function ExpedientePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()
  const { notas, loading, reload } = useExpediente(patientId)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'consulta' | 'hospital'>('todas')
  const [expandida, setExpandida] = useState<string | null>(null)

  const borrarNota = async (notaId: string) => {
    if (!clinicId) return
    if (!window.confirm('¿Eliminar este borrador? No podrás recuperarlo.')) return
    try {
      await deleteNota(clinicId, patientId, notaId)
      toast('Borrador eliminado', 'info')
      reload()
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  useEffect(() => {
    if (!clinicId || !patientId) return
    getPatients(clinicId).then(ps => setPatient(ps.find(p => p.id === patientId) ?? null))
    // NOM-024 Art. 6.5: bitácora de accesos — registrar lectura del expediente
    import('@/lib/expediente/audit-log').then(({ logAudit }) => {
      logAudit({
        evento: 'expediente_lectura', clinicId, patientId,
        medicoUid: user?.uid, medicoEmail: user?.email ?? undefined,
      })
    })
  }, [clinicId, patientId, user?.uid, user?.email])

  const notasFiltradas = notas.filter(n => {
    if (filtro === 'todas') return true
    const hosp = ['ingreso', 'evolucion', 'egreso'].includes(n.tipo)
    return filtro === 'hospital' ? hosp : !hosp
  })

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => router.push('/pacientes')} style={backBtn}>
        <ArrowLeft size={15} /> Pacientes
      </button>

      {/* Alergias banner — SIEMPRE rojo y visible */}
      {patient?.alergias && (
        <div style={alergiaBanner}>
          <AlertTriangle size={16} />
          <strong>ALERGIAS:</strong> {patient.alergias}
        </div>
      )}

      {/* Patient header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: 0 }}>
            {patient?.nombre ?? 'Paciente'}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}
            {patient?.telefono ? ` · ${patient.telefono}` : ''}
          </div>
        </div>
        <div className="actions-row">
          <button onClick={() => router.push(`/referencia/${patientId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Send size={15} /> Carta de referencia
          </button>
          <button onClick={async () => {
            if (!clinicId || !patient) return
            const { exportarPacienteAFhir } = await import('@/lib/fhir-export')
            const { logAudit } = await import('@/lib/expediente/audit-log')
            const { config } = await (async () => {
              const { getConfig } = await import('@/lib/firestore')
              return { config: await getConfig(clinicId) }
            })()
            const bundle = exportarPacienteAFhir({ paciente: patient, notas, config })
            const json = JSON.stringify(bundle, null, 2)
            const nombre = patient.nombre.replace(/[^\w]/g, '_').slice(0, 30)
            const blob = new Blob([json], { type: 'application/fhir+json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `expediente_${nombre}_FHIR_R4.json`
            a.click()
            URL.revokeObjectURL(url)
            logAudit({ evento: 'export_datos', clinicId, patientId, medicoUid: user?.uid, medicoEmail: user?.email ?? undefined, meta: { formato: 'FHIR-R4', notas: notas.length } })
            toast('Expediente exportado en FHIR R4', 'success')
          }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Upload size={15} /> FHIR
          </button>
          <button onClick={() => router.push(`/consulta/${patientId}`)} style={primaryBtn}>
            <Mic size={16} /> Nueva consulta con IA
          </button>
        </div>
      </div>

      {/* Datos del paciente — vista unificada (antes estaba en "Pacientes") */}
      <DatosPaciente patient={patient} onEditar={() => router.push('/pacientes')} />

      {/* Historia clínica */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 12px' }}>
        Historia clínica
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['todas', 'Todas'], ['consulta', 'Consulta'], ['hospital', 'Hospital']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} style={chip(filtro === k)}>{l}</button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <Spinner center label="Cargando expediente…" />
      ) : notasFiltradas.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="Sin notas todavía"
          description="Inicia una consulta para crear la primera nota clínica de este paciente."
          action={<Button icon={<Plus size={16} />} onClick={() => router.push(`/consulta/${patientId}`)}>Crear primera nota</Button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="t-overline" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={12} className="ds-icon" />
            {notasFiltradas.length} {notasFiltradas.length === 1 ? 'consulta' : 'consultas'}
            {(() => {
              const fechas = notasFiltradas.map(n => n.fechaConsulta).filter(Boolean).sort()
              const primera = fechas[0]
              return primera ? <span style={{ color: 'var(--text3)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· desde {new Date(primera).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</span> : null
            })()}
          </div>
          {notasFiltradas.map((n, i) => (
            <NotaCard
              key={n.id}
              nota={n}
              esUltima={i === notasFiltradas.length - 1}
              abierta={expandida === n.id}
              onToggle={() => setExpandida(expandida === n.id ? null : n.id)}
              // Triple fuente para el patientId: 1) nota.pacienteId (legacy puede no tenerlo),
              // 2) param de la URL via useParams, 3) extraído de window.location.pathname.
              // Si TODO falla, navegamos solo con notaId y dejamos que la ruta de rescate lo resuelva.
              onEditar={() => {
                const pid = n.pacienteId || patientId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : '')
                if (pid && n.id) router.push(`/consulta/${pid}?nota=${n.id}`)
                else if (n.id) router.push(`/nota/${n.id}`)  // rescate buscará el paciente
                else alert('No se pudo abrir la nota.')
              }}
              onImprimir={() => {
                const pidParam = patientId
                const pidNota = n.pacienteId
                const pidPath = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : ''
                const pid = pidNota || pidParam || pidPath
                if (!n.id) { alert('Esta nota no tiene ID. Recarga el expediente.'); return }
                // Si no tenemos pid de ninguna fuente, vamos a la ruta de rescate (busca en la clínica)
                if (!pid) { router.push(`/nota/${n.id}`); return }
                router.push(`/nota/${pid}/${n.id}`)
              }}
              onGenerarReceta={() => {
                const pid = n.pacienteId || patientId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : '')
                if (pid && n.id) router.push(`/receta/${pid}/${n.id}`)
              }}
              onGenerarOrden={() => {
                const pid = n.pacienteId || patientId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] : '')
                if (pid && n.id) router.push(`/orden/${pid}/${n.id}`)
              }}
              onBorrar={() => borrarNota(n.id)}
            />
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/** Tarjeta colapsable con los datos de contacto del paciente (unificación
 *  de Pacientes + Expedientes en una sola pantalla). */
function DatosPaciente({ patient, onEditar }: { patient: Patient | null; onEditar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  if (!patient) return null
  const campos: Array<[string, string | undefined]> = [
    ['Edad', patient.edad ? `${patient.edad} años` : undefined],
    ['Sexo', patient.sexo],
    ['Fecha de nacimiento', patient.fechaNacimiento],
    ['Teléfono', patient.telefono],
    ['WhatsApp', patient.whatsapp],
    ['Correo', patient.email],
    ['CURP', patient.curp],
    ['Seguro', patient.seguroMedico],
    ['Alergias', patient.alergias],
    ['Notas', patient.notas],
  ]
  const conValor = campos.filter(([, v]) => v && String(v).trim())
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', marginBottom: 16, overflow: 'hidden' }}>
      <button onClick={() => setAbierto(a => !a)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
      }}>
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span style={{ fontSize: 14, fontWeight: 700 }}>Datos del paciente</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{abierto ? 'ocultar' : 'ver / editar'}</span>
      </button>
      {abierto && (
        <div style={{ padding: '4px 16px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
            {conValor.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 1 }}>{v}</div>
              </div>
            ))}
            {conValor.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sin datos de contacto capturados.</div>
            )}
          </div>
          <button onClick={onEditar} className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
            <Pencil size={13} /> Editar datos
          </button>
        </div>
      )}
    </div>
  )
}

function NotaCard({ nota, esUltima, abierta, onToggle, onEditar, onImprimir, onGenerarReceta, onGenerarOrden, onBorrar }: {
  nota: NotaMedica; esUltima: boolean; abierta: boolean; onToggle: () => void; onEditar: () => void; onImprimir: () => void; onGenerarReceta: () => void; onGenerarOrden: () => void; onBorrar: () => void
}) {
  const firmada = nota.estado === 'firmada'
  const IconoTipo = ICONO_TIPO_NOTA[nota.tipo] ?? FileText
  const acento = firmada ? 'var(--nexus)' : 'var(--amber)'
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {/* Riel del timeline — nodo con icono del tipo de nota */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 34, flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', marginTop: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: firmada ? 'var(--nexus-soft)' : 'rgba(245,158,11,0.12)',
          border: `1.5px solid ${acento}`, color: acento,
          zIndex: 1, flexShrink: 0,
        }}>
          <IconoTipo size={16} />
        </div>
        {!esUltima && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 2 }} />}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginBottom: 14, background: 'var(--s1)',
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
      }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{TIPO_NOTA_LABEL[nota.tipo]}</span>
              <Badge tone={firmada ? 'cobalt' : 'amber'} dot>{firmada ? 'Firmada' : 'Borrador'}</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              {nota.resumenEjecutivo || nota.diagnosticos.map(d => d.descripcion).join(', ') || 'Sin resumen'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {new Date(nota.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          {abierta ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
        </button>

        {abierta && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
            {nota.signosVitales && Object.values(nota.signosVitales).some(Boolean) && (
              <div style={{ fontSize: 12, color: 'var(--text2)', margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {nota.signosVitales.ta && <span>TA {nota.signosVitales.ta}</span>}
                {nota.signosVitales.fc && <span>FC {nota.signosVitales.fc}</span>}
                {nota.signosVitales.fr && <span>FR {nota.signosVitales.fr}</span>}
                {nota.signosVitales.temperatura && <span>T° {nota.signosVitales.temperatura}</span>}
                {nota.signosVitales.spo2 && <span>SpO₂ {nota.signosVitales.spo2}%</span>}
              </div>
            )}
            {nota.secciones.filter(s => s.value.trim()).map(s => (
              <div key={s.key} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 3 }}>{s.value}</div>
              </div>
            ))}
            {nota.diagnosticos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase' }}>Diagnósticos</div>
                {nota.diagnosticos.map((d, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
                    • {d.descripcion} {d.codigoCIE10 && <span style={{ color: 'var(--text3)' }}>({d.codigoCIE10})</span>}
                  </div>
                ))}
              </div>
            )}
            {nota.medicamentos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase' }}>Medicamentos</div>
                {nota.medicamentos.map((m, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
                    • {m.nombre} {m.dosis} · {m.via} · {m.frecuencia} · {m.duracion}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {!firmada && (
                <button onClick={onEditar} style={ghostBtn}>Continuar edición</button>
              )}
              <button onClick={onImprimir} style={ghostBtn}><Printer size={13} /> Imprimir / PDF</button>
              {/* Receta y Orden — solo cuando la nota está firmada (datos confiables) */}
              {firmada && (
                <>
                  <button onClick={onGenerarReceta} style={{ ...ghostBtn, color: 'var(--teal)', borderColor: 'rgba(20,184,166,0.4)', background: 'rgba(20,184,166,0.08)' }}>
                    <Pill size={13} /> Generar receta
                  </button>
                  <button onClick={onGenerarOrden} style={{ ...ghostBtn, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.08)' }}>
                    <ClipboardList size={13} /> Orden médica
                  </button>
                </>
              )}
              {!firmada && (
                <button onClick={onBorrar} style={{ ...ghostBtn, color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <Trash2 size={13} /> Eliminar borrador
                </button>
              )}
            </div>
            {firmada && nota.firma && (
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={12} color="var(--teal)" />
                Firmada por {nota.firma.nombreMedico} · Céd. {nota.firma.cedulaProfesional} · Sello {nota.metadata.hashIntegridad.slice(0, 12)}…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const backBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }
const alergiaBanner: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }
const chip = (active: boolean): React.CSSProperties => ({ background: active ? 'var(--teal)' : 'var(--s2)', color: active ? '#000' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
