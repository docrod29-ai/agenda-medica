'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useExpediente } from '@/hooks/useExpediente'
import { getPatients } from '@/lib/firestore'
import type { Patient } from '@/types'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { NotaMedica } from '@/types/expediente'
import {
  ArrowLeft, Mic, FileText, Loader2, AlertTriangle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Plus, Printer,
} from 'lucide-react'

export default function ExpedientePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const { notas, loading } = useExpediente(patientId)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'consulta' | 'hospital'>('todas')
  const [expandida, setExpandida] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId || !patientId) return
    getPatients(clinicId).then(ps => setPatient(ps.find(p => p.id === patientId) ?? null))
  }, [clinicId, patientId])

  const notasFiltradas = notas.filter(n => {
    if (filtro === 'todas') return true
    const hosp = ['ingreso', 'evolucion', 'egreso'].includes(n.tipo)
    return filtro === 'hospital' ? hosp : !hosp
  })

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => router.push('/expedientes')} style={backBtn}>
        <ArrowLeft size={15} /> Expedientes
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {patient?.nombre ?? 'Paciente'}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}
            {patient?.telefono ? ` · ${patient.telefono}` : ''}
          </div>
        </div>
        <button onClick={() => router.push(`/consulta/${patientId}`)} style={primaryBtn}>
          <Mic size={16} /> Nueva consulta con IA
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['todas', 'Todas'], ['consulta', 'Consulta'], ['hospital', 'Hospital']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} style={chip(filtro === k)}>{l}</button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', padding: 40 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando expediente…
        </div>
      ) : notasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <FileText size={32} color="var(--text3)" style={{ opacity: 0.5 }} />
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>Sin notas todavía.</p>
          <button onClick={() => router.push(`/consulta/${patientId}`)} style={{ ...primaryBtn, margin: '12px auto 0' }}>
            <Plus size={16} /> Crear primera nota
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {notasFiltradas.map((n, i) => (
            <NotaCard
              key={n.id}
              nota={n}
              esUltima={i === notasFiltradas.length - 1}
              abierta={expandida === n.id}
              onToggle={() => setExpandida(expandida === n.id ? null : n.id)}
              onEditar={() => router.push(`/consulta/${patientId}?nota=${n.id}`)}
            />
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function NotaCard({ nota, esUltima, abierta, onToggle, onEditar }: {
  nota: NotaMedica; esUltima: boolean; abierta: boolean; onToggle: () => void; onEditar: () => void
}) {
  const firmada = nota.estado === 'firmada'
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {/* Timeline rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', marginTop: 18,
          background: firmada ? 'var(--teal)' : '#f59e0b',
          border: '2px solid var(--bg)', zIndex: 1,
        }} />
        {!esUltima && <div style={{ width: 2, flex: 1, background: 'var(--border)' }} />}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginBottom: 12, background: 'var(--s1)',
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
      }}>
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{TIPO_NOTA_LABEL[nota.tipo]}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                background: firmada ? 'rgba(0,212,168,0.12)' : 'rgba(245,158,11,0.12)',
                color: firmada ? 'var(--teal)' : '#f59e0b',
              }}>
                {firmada ? 'FIRMADA' : 'BORRADOR'}
              </span>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {!firmada && (
                <button onClick={onEditar} style={ghostBtn}>Continuar edición</button>
              )}
              <button onClick={() => window.print()} style={ghostBtn}><Printer size={13} /> Imprimir</button>
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
