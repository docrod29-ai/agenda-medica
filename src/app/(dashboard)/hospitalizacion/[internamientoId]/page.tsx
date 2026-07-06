'use client'
// ══════════════════════════════════════════════════════════════
// Ficha del EPISODIO de internamiento — con pestañas:
//  · Resumen/Notas  · Indicaciones + MAR  · Signos vitales  · Interconsultas
// Rol (médico/enfermería/admin) filtra las acciones visibles (vista, no seguridad).
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import {
  getInternamiento, egresarInternamiento,
  agregarInterconsulta, responderInterconsulta,
  agregarIndicacion, suspenderIndicacion, registrarAdministracion,
  verificarIndicacionFarmacia, guardarMedicamentosCasa,
  agregarSignos, getSignos,
} from '@/lib/hospital/firestore'
import { getNotas } from '@/lib/expediente/firestore'
import { getPatients } from '@/lib/firestore'
import { cdsMedicamento, type AlertaCDS } from '@/lib/hospital/cds'
import { code39Svg } from '@/lib/hospital/barcode'
import {
  diasEstancia, TIPO_EGRESO_LABEL, TIPO_INDICACION_LABEL, ESPECIALIDADES_IC, ROL_HOSPITAL_LABEL,
  type Internamiento, type TipoEgreso, type TipoIndicacion, type RegistroSignos, type RolHospital, type Indicacion,
} from '@/types/hospital'
import { TIPO_NOTA_LABEL, type NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { Modal, Button, Spinner } from '@/components/ui'
import {
  ArrowLeft, BedDouble, Stethoscope, Clock, FileText, Plus, LogOut, Pill,
  Send, Check, Activity, Syringe, Ban, ShieldCheck, Printer, AlertTriangle, ScanLine, ClipboardCheck,
} from 'lucide-react'

const TIPO_EGRESO_OPCIONES: TipoEgreso[] = ['mejoria', 'maximo_beneficio', 'voluntaria', 'traslado', 'defuncion', 'otro']
const TIPO_IND_OPCIONES: TipoIndicacion[] = ['medicamento', 'liquidos', 'dieta', 'cuidado', 'estudio', 'otro']
const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'
type Tab = 'resumen' | 'indicaciones' | 'signos' | 'interconsultas'

export default function EpisodioPage() {
  const { internamientoId } = useParams<{ internamientoId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const { toast } = useToast()

  const [inter, setInter] = useState<Internamiento | null>(null)
  const [notas, setNotas] = useState<NotaMedica[]>([])
  const [signos, setSignos] = useState<RegistroSignos[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [rol, setRol] = useState<RolHospital>('medico')

  // modales
  const [modalEgreso, setModalEgreso] = useState(false)
  const [modalIC, setModalIC] = useState(false)
  const [modalInd, setModalInd] = useState(false)
  const [modalSignos, setModalSignos] = useState(false)
  const [respondiendo, setRespondiendo] = useState<string | null>(null)  // icId
  const [administrando, setAdministrando] = useState<string | null>(null) // indId
  const [busy, setBusy] = useState(false)

  // formularios de los modales
  const [egr, setEgr] = useState<{ tipo: TipoEgreso; resumen: string }>({ tipo: 'mejoria', resumen: '' })
  const [icForm, setIcForm] = useState({ especialidad: ESPECIALIDADES_IC[0], motivo: '' })
  const [respTxt, setRespTxt] = useState('')
  const [indForm, setIndForm] = useState<{ tipo: TipoIndicacion; descripcion: string; frecuencia: string }>({ tipo: 'medicamento', descripcion: '', frecuencia: '' })
  const [admNota, setAdmNota] = useState('')
  const [sg, setSg] = useState({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '' })
  const [patient, setPatient] = useState<Patient | null>(null)
  const [modalConcil, setModalConcil] = useState(false)
  const [medsCasa, setMedsCasa] = useState('')
  const [correctos, setCorrectos] = useState({ paciente: false, medicamento: false, dosis: false, via: false, hora: false })
  const [folioScan, setFolioScan] = useState('')

  const cargar = async () => {
    if (!clinicId || !internamientoId) return
    const i = await getInternamiento(clinicId, internamientoId)
    setInter(i)
    if (i) {
      const [todas, sgs, pacientes] = await Promise.all([
        getNotas(clinicId, i.pacienteId).catch(() => [] as NotaMedica[]),
        getSignos(clinicId, internamientoId).catch(() => [] as RegistroSignos[]),
        getPatients(clinicId).catch(() => [] as Patient[]),
      ])
      setNotas(todas.filter(n => n.internamientoId === internamientoId))
      setSignos(sgs)
      setPatient(pacientes.find(p => p.id === i.pacienteId) ?? null)
      setMedsCasa((i.medicamentosCasa ?? []).join('\n'))
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [clinicId, internamientoId])
  useEffect(() => { try { const r = localStorage.getItem('hospitalRol') as RolHospital | null; if (r) setRol(r) } catch { /* */ } }, [])
  const cambiarRol = (r: RolHospital) => { setRol(r); try { localStorage.setItem('hospitalRol', r) } catch { /* */ } }

  const notasEpisodio = useMemo(() => [...notas].sort((a, b) => (a.fechaConsulta < b.fechaConsulta ? 1 : -1)), [notas])
  const tieneIngreso = notas.some(n => n.tipo === 'ingreso')
  const esMedico = rol === 'medico'
  const puedeEnfermeria = rol === 'medico' || rol === 'enfermeria'
  const puedeFarmacia = rol === 'medico' || rol === 'farmacia'

  // Medicamentos activos (para el CDS de interacciones)
  const medsActivos = useMemo(
    () => (inter?.indicaciones ?? []).filter(x => x.tipo === 'medicamento' && x.activa).map(x => x.descripcion),
    [inter?.indicaciones],
  )
  // CDS EN VIVO para la indicación que se está capturando
  const alertasCDS: AlertaCDS[] = useMemo(() => {
    if (indForm.tipo !== 'medicamento' || !indForm.descripcion.trim()) return []
    return cdsMedicamento({ nombre: indForm.descripcion, alergias: patient?.alergias, medsActivos })
  }, [indForm.tipo, indForm.descripcion, patient?.alergias, medsActivos])

  const nuevaNota = (tipo: string) => {
    if (!inter) return
    router.push(`/consulta/${inter.pacienteId}?tipo=${tipo}&internamiento=${internamientoId}`)
  }

  // Imprimir brazalete con código de barras (BCMA)
  const imprimirBrazalete = () => {
    if (!inter) return
    const folio = internamientoId.slice(-8).toUpperCase()
    const svg = code39Svg(folio, { height: 60 })
    const w = window.open('', '_blank', 'width=520,height=300')
    if (!w) return
    w.document.write(`<html><head><title>Brazalete</title></head><body style="font-family:Arial,sans-serif;margin:0;padding:16px;">
      <div style="border:1px solid #000;border-radius:8px;padding:12px 16px;max-width:420px;">
        <div style="font-size:18px;font-weight:bold;">${(inter.pacienteNombre || '').replace(/</g, '')}</div>
        <div style="font-size:12px;color:#333;margin:2px 0 8px;">${inter.servicio}${inter.cama ? ' · Cama ' + inter.cama : ''} · Ingreso ${new Date(inter.fechaIngreso).toLocaleDateString('es-MX')}</div>
        ${svg}
        <div style="font-size:10px;color:#666;margin-top:6px;">Folio de internamiento — verificación de identidad (BCMA)</div>
      </div>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`)
    w.document.close()
  }

  // Exportar el episodio a HL7 FHIR R4 (interoperabilidad · NOM-024)
  const exportarFHIR = async () => {
    if (!inter || !patient) return
    const { exportarInternamientoAFhir } = await import('@/lib/fhir-export')
    const bundle = exportarInternamientoAFhir({ paciente: patient, internamiento: inter, notas, signos, config })
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `internamiento_${(inter.pacienteNombre || 'paciente').replace(/\s+/g, '_')}_FHIR_R4.json`
    document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 200)
    toast('Internamiento exportado en FHIR R4', 'success')
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
  if (!inter) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--text3)' }}>No se encontró el episodio.</p>
      <Button variant="secondary" onClick={() => router.push('/hospitalizacion')}>Volver al censo</Button>
    </div>
  )
  const egresado = inter.estado === 'egresado'
  const indicaciones = inter.indicaciones ?? []
  const interconsultas = inter.interconsultas ?? []

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/hospitalizacion')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
          <ArrowLeft size={15} /> Censo
        </button>
        {/* Rol */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['medico', 'enfermeria', 'farmacia', 'admin'] as RolHospital[]).map(r => (
            <button key={r} onClick={() => cambiarRol(r)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
              border: '1px solid ' + (rol === r ? 'var(--nexus,#3d5afe)' : 'var(--border)'),
              background: rol === r ? 'rgba(61,90,254,.12)' : 'var(--s2)', color: rol === r ? 'var(--nexus,#3d5afe)' : 'var(--text3)',
            }}>{ROL_HOSPITAL_LABEL[r]}</button>
          ))}
        </div>
      </div>

      {/* Cabecera */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--s1)', padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{inter.pacienteNombre}</h1>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 3 }}>{inter.diagnosticoIngreso}{inter.cie10 ? ` (${inter.cie10})` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={imprimirBrazalete} title="Imprimir brazalete con código de barras" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text2)', cursor: 'pointer' }}><Printer size={13} /> Brazalete</button>
            <button onClick={exportarFHIR} title="Exportar el internamiento en HL7 FHIR R4 (interoperabilidad)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text2)', cursor: 'pointer' }}><Send size={13} /> FHIR</button>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: egresado ? 'var(--s2)' : 'rgba(13,148,136,.15)', color: egresado ? 'var(--text3)' : '#0d9488', border: `1px solid ${egresado ? 'var(--border)' : 'rgba(13,148,136,.4)'}` }}>{egresado ? 'Egresado' : 'Internado'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BedDouble size={14} /> {inter.servicio}{inter.cama ? ` · Cama ${inter.cama}` : ''}</span>
          {inter.medicoTratanteNombre && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Stethoscope size={14} /> {inter.medicoTratanteNombre}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={14} /> {diasEstancia(inter)} días</span>
          <span>Ingreso: {new Date(inter.fechaIngreso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {egresado && inter.fechaEgreso && <span>Egreso: {new Date(inter.fechaEgreso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}{inter.tipoEgreso ? ` · ${TIPO_EGRESO_LABEL[inter.tipoEgreso]}` : ''}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {([['resumen', 'Resumen / Notas'], ['indicaciones', `Indicaciones · MAR${indicaciones.filter(i => i.activa).length ? ' (' + indicaciones.filter(i => i.activa).length + ')' : ''}`], ['signos', 'Signos vitales'], ['interconsultas', `Interconsultas${interconsultas.length ? ' (' + interconsultas.length + ')' : ''}`]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer', background: 'none', border: 'none',
            color: tab === t ? 'var(--nexus,#3d5afe)' : 'var(--text3)', borderBottom: '2px solid ' + (tab === t ? 'var(--nexus,#3d5afe)' : 'transparent'), marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* ── TAB: RESUMEN / NOTAS ── */}
      {tab === 'resumen' && (<>
        {inter.motivoIngreso && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}><strong>Motivo de ingreso:</strong> {inter.motivoIngreso}</div>}
        {egresado && inter.resumenEgreso && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14, padding: 12, background: 'var(--s2)', borderRadius: 10 }}><strong>Resumen de egreso:</strong> {inter.resumenEgreso}</div>}

        {esMedico && !egresado && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {!tieneIngreso && <Button icon={<Plus size={15} />} onClick={() => nuevaNota('ingreso')}>Nota de ingreso</Button>}
            <Button variant={tieneIngreso ? 'primary' : 'secondary'} icon={<Plus size={15} />} onClick={() => nuevaNota('evolucion')}>Evolución</Button>
            <Button variant="secondary" icon={<Activity size={15} />} onClick={() => nuevaNota('nota_postoperatoria')}>Postoperatoria</Button>
            <Button variant="secondary" icon={<FileText size={15} />} onClick={() => nuevaNota('consentimiento')}>Consentimiento</Button>
            <Button variant="secondary" icon={<LogOut size={15} />} onClick={() => setModalEgreso(true)}>Egresar</Button>
          </div>
        )}
        {egresado && esMedico && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => nuevaNota('egreso')}>Nota de egreso</Button>
            <Button variant="secondary" icon={<Clock size={15} />} onClick={() => router.push('/asistente')}>Programar cita de seguimiento</Button>
          </div>
        )}

        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 12px' }}>Notas del internamiento ({notasEpisodio.length})</div>
        {notasEpisodio.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Aún no hay notas. Empieza con la <strong>Nota de ingreso</strong>.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {notasEpisodio.map(n => (
              <button key={n.id} onClick={() => router.push(`/nota/${inter.pacienteId}/${n.id}`)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s1)', cursor: 'pointer' }}>
                <FileText size={16} style={{ color: 'var(--nexus,#3d5afe)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{TIPO_NOTA_LABEL[n.tipo] ?? n.tipo}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(n.fechaConsulta).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{n.estado === 'firmada' ? ' · firmada' : ' · borrador'}</div>
                </div>
                {n.medicamentos?.length > 0 && <Pill size={14} style={{ color: 'var(--text3)' }} />}
              </button>
            ))}
          </div>
        )}
      </>)}

      {/* ── TAB: INDICACIONES + MAR ── */}
      {tab === 'indicaciones' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Hoja de indicaciones médicas y registro de administración (MAR).</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {esMedico && !egresado && <Button size="sm" variant="secondary" icon={<ClipboardCheck size={14} />} onClick={() => setModalConcil(true)}>Conciliar medicamentos</Button>}
            {esMedico && !egresado && <Button size="sm" icon={<Plus size={14} />} onClick={() => setModalInd(true)}>Nueva indicación</Button>}
          </div>
        </div>
        {/* Conciliación: medicamentos del hogar vs indicaciones activas */}
        {(inter.medicamentosCasa?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)', marginBottom: 6 }}>Conciliación · medicamentos en casa</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(inter.medicamentosCasa ?? []).map((m, i) => {
                const continuado = medsActivos.some(a => a.toLowerCase().includes(m.toLowerCase().split(' ')[0]))
                return <span key={i} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 100, background: continuado ? 'rgba(13,148,136,.12)' : 'rgba(217,119,6,.12)', color: continuado ? '#0d9488' : '#d97706', border: `1px solid ${continuado ? 'rgba(13,148,136,.35)' : 'rgba(217,119,6,.35)'}` }}>{m}{continuado ? ' · continuado' : ' · revisar'}</span>
              })}
            </div>
          </div>
        )}
        {indicaciones.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Sin indicaciones. {esMedico ? 'Agrega la primera.' : 'El médico aún no registra indicaciones.'}</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {indicaciones.map(ind => (
              <div key={ind.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14, opacity: ind.activa ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)' }}>{TIPO_INDICACION_LABEL[ind.tipo]}{!ind.activa && ' · suspendida'}</span>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{ind.descripcion}</div>
                    {ind.frecuencia && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{ind.frecuencia}</div>}
                    {ind.tipo === 'medicamento' && ind.activa && (
                      ind.verificadaFarmacia
                        ? <div style={{ fontSize: 11, color: '#0d9488', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}><ShieldCheck size={12} /> Verificada por farmacia{ind.verificadaPor ? ` · ${ind.verificadaPor}` : ''}</div>
                        : <div style={{ fontSize: 11, color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}><AlertTriangle size={12} /> Pendiente de verificación farmacéutica</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {puedeFarmacia && ind.activa && ind.tipo === 'medicamento' && !ind.verificadaFarmacia && <Button size="sm" variant="secondary" icon={<ShieldCheck size={13} />} onClick={async () => { if (!clinicId) return; await verificarIndicacionFarmacia(clinicId, internamientoId, ind.id, config?.nombreMedico ?? ROL_HOSPITAL_LABEL[rol]); toast('Indicación verificada por farmacia', 'success'); cargar() }}>Verificar</Button>}
                    {puedeEnfermeria && ind.activa && ind.tipo === 'medicamento' && <Button size="sm" variant="secondary" icon={<Syringe size={13} />} onClick={() => { setCorrectos({ paciente: false, medicamento: false, dosis: false, via: false, hora: false }); setAdministrando(ind.id) }}>Administrar</Button>}
                    {esMedico && <button title={ind.activa ? 'Suspender' : 'Reactivar'} onClick={async () => { if (!clinicId) return; await suspenderIndicacion(clinicId, internamientoId, ind.id, !ind.activa); cargar() }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--text3)' }}><Ban size={13} /></button>}
                  </div>
                </div>
                {ind.administraciones.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ind.administraciones.slice(-6).map((a, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.estado === 'administrado' ? <Check size={12} style={{ color: '#0d9488' }} /> : <Ban size={12} style={{ color: '#d97706' }} />}
                        {new Date(a.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.estado === 'administrado' ? 'Administrado' : 'Omitido'}{a.por ? ' · ' + a.por : ''}{a.nota ? ` — ${a.nota}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ── TAB: SIGNOS VITALES ── */}
      {tab === 'signos' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Registro seriado de signos vitales.</div>
          {puedeEnfermeria && !egresado && <Button size="sm" icon={<Plus size={14} />} onClick={() => setModalSignos(true)}>Registrar signos</Button>}
        </div>
        {signos.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Sin registros de signos vitales.</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--s2)', color: 'var(--text3)', textAlign: 'left' }}>
                  {['Fecha', 'TA', 'FC', 'FR', 'T°', 'SpO₂', 'Gluc.', 'Dolor'].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...signos].reverse().map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{new Date(s.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '7px 10px' }}>{s.ta ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: (s.fc && (s.fc > 100 || s.fc < 50)) ? '#dc2626' : undefined }}>{s.fc ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>{s.fr ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: (s.temp && s.temp >= 38) ? '#dc2626' : undefined }}>{s.temp ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: (s.spo2 && s.spo2 < 92) ? '#dc2626' : undefined }}>{s.spo2 ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>{s.glucosa ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>{s.dolor != null ? `${s.dolor}/10` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>)}

      {/* ── TAB: INTERCONSULTAS ── */}
      {tab === 'interconsultas' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Solicitudes a otras especialidades y sus respuestas.</div>
          {esMedico && !egresado && <Button size="sm" icon={<Send size={14} />} onClick={() => setModalIC(true)}>Solicitar interconsulta</Button>}
        </div>
        {interconsultas.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Sin interconsultas.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {interconsultas.map(ic => (
              <div key={ic.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{ic.especialidad}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: ic.estado === 'respondida' ? 'rgba(13,148,136,.15)' : 'rgba(217,119,6,.15)', color: ic.estado === 'respondida' ? '#0d9488' : '#d97706' }}>{ic.estado === 'respondida' ? 'Respondida' : 'Pendiente'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{ic.motivo}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Solicitó: {ic.solicitanteNombre || '—'} · {new Date(ic.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</div>
                {ic.respuesta && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}><strong>Respuesta:</strong> {ic.respuesta}</div>}
                {esMedico && ic.estado === 'solicitada' && !egresado && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <Button size="sm" variant="secondary" onClick={() => setRespondiendo(ic.id)}>Responder (texto)</Button>
                    {ic.especialidad === 'Infectología' && <Button size="sm" variant="secondary" icon={<Activity size={13} />} onClick={() => nuevaNota('valoracion_inmuno')}>Valoración inmuno</Button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ══ MODALES ══ */}
      {/* Egreso */}
      <Modal open={modalEgreso} onClose={() => setModalEgreso(false)} title="Egresar paciente"
        footer={<><Button variant="secondary" onClick={() => setModalEgreso(false)}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          try { await egresarInternamiento(clinicId, internamientoId, { tipoEgreso: egr.tipo, resumenEgreso: egr.resumen.trim() || undefined }); toast('Paciente egresado', 'success'); setModalEgreso(false); nuevaNota('egreso') }
          catch { toast('No se pudo egresar', 'error'); setBusy(false) }
        }}>Egresar y escribir nota</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Tipo de egreso</label>
            <select className={inputCls} value={egr.tipo} onChange={e => setEgr(x => ({ ...x, tipo: e.target.value as TipoEgreso }))}>{TIPO_EGRESO_OPCIONES.map(t => <option key={t} value={t}>{TIPO_EGRESO_LABEL[t]}</option>)}</select></div>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Resumen del egreso (opcional)</label>
            <textarea className={inputCls} rows={3} placeholder="Evolución y condición al alta" value={egr.resumen} onChange={e => setEgr(x => ({ ...x, resumen: e.target.value }))} /></div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>Al confirmar, el paciente sale del censo y se abre la Nota de egreso (NOM-004).</p>
      </Modal>

      {/* Nueva interconsulta */}
      <Modal open={modalIC} onClose={() => setModalIC(false)} title="Solicitar interconsulta"
        footer={<><Button variant="secondary" onClick={() => setModalIC(false)}>Cancelar</Button><Button loading={busy} disabled={!icForm.motivo.trim()} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          try { await agregarInterconsulta(clinicId, internamientoId, { especialidad: icForm.especialidad, motivo: icForm.motivo.trim(), solicitanteNombre: config?.nombreMedico ?? '' }); toast('Interconsulta solicitada', 'success'); setModalIC(false); setIcForm({ especialidad: ESPECIALIDADES_IC[0], motivo: '' }); cargar() }
          finally { setBusy(false) }
        }}>Solicitar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Especialidad</label>
            <select className={inputCls} value={icForm.especialidad} onChange={e => setIcForm(f => ({ ...f, especialidad: e.target.value }))}>{ESPECIALIDADES_IC.map(e => <option key={e}>{e}</option>)}</select></div>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Motivo de la interconsulta</label>
            <textarea className={inputCls} rows={3} placeholder="Pregunta clínica concreta" value={icForm.motivo} onChange={e => setIcForm(f => ({ ...f, motivo: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Responder interconsulta */}
      <Modal open={!!respondiendo} onClose={() => setRespondiendo(null)} title="Responder interconsulta"
        footer={<><Button variant="secondary" onClick={() => setRespondiendo(null)}>Cancelar</Button><Button loading={busy} disabled={!respTxt.trim()} onClick={async () => {
          if (!clinicId || !respondiendo) return; setBusy(true)
          try { await responderInterconsulta(clinicId, internamientoId, respondiendo, { respuesta: respTxt.trim(), respondidaPor: config?.nombreMedico ?? '' }); toast('Interconsulta respondida', 'success'); setRespondiendo(null); setRespTxt(''); cargar() }
          finally { setBusy(false) }
        }}>Guardar respuesta</Button></>}>
        <textarea className={inputCls} rows={5} placeholder="Impresión y recomendaciones" value={respTxt} onChange={e => setRespTxt(e.target.value)} />
      </Modal>

      {/* Nueva indicación */}
      <Modal open={modalInd} onClose={() => setModalInd(false)} title="Nueva indicación médica"
        footer={<><Button variant="secondary" onClick={() => setModalInd(false)}>Cancelar</Button><Button loading={busy} disabled={!indForm.descripcion.trim()} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          try { await agregarIndicacion(clinicId, internamientoId, { tipo: indForm.tipo, descripcion: indForm.descripcion.trim(), frecuencia: indForm.frecuencia.trim() || undefined, creadaPor: config?.nombreMedico ?? '' }); toast('Indicación agregada', 'success'); setModalInd(false); setIndForm({ tipo: 'medicamento', descripcion: '', frecuencia: '' }); cargar() }
          finally { setBusy(false) }
        }}>Agregar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Tipo</label>
            <select className={inputCls} value={indForm.tipo} onChange={e => setIndForm(f => ({ ...f, tipo: e.target.value as TipoIndicacion }))}>{TIPO_IND_OPCIONES.map(t => <option key={t} value={t}>{TIPO_INDICACION_LABEL[t]}</option>)}</select></div>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Indicación</label>
            <input className={inputCls} placeholder="ej. Ceftriaxona 1 g IV" value={indForm.descripcion} onChange={e => setIndForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Frecuencia (opcional)</label>
            <input className={inputCls} placeholder="ej. cada 12 h" value={indForm.frecuencia} onChange={e => setIndForm(f => ({ ...f, frecuencia: e.target.value }))} /></div>
          {/* CDS en vivo — alertas de alta especificidad (alergias / interacciones / renal / controlados) */}
          {alertasCDS.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alertasCDS.map((a, i) => {
                const color = a.nivel === 'critica' ? '#dc2626' : a.nivel === 'alta' ? '#d97706' : '#0d9488'
                return (
                  <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, padding: '8px 10px', borderRadius: 8, background: color + '14', border: `1px solid ${color}44`, color }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{a.texto}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Registrar administración (MAR + BCMA "5 correctos") */}
      {(() => {
        const indAct = indicaciones.find(x => x.id === administrando)
        const folioEsperado = internamientoId.slice(-8).toUpperCase()
        const identidadOk = folioScan.trim().toUpperCase().endsWith(folioEsperado) && folioScan.trim().length >= 4
        const pacienteOk = correctos.paciente || identidadOk
        const todos = pacienteOk && correctos.medicamento && correctos.dosis && correctos.via && correctos.hora
        const chk = (on: boolean, toggle: () => void, label: string) => (
          <button type="button" onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid ' + (on ? 'rgba(13,148,136,.4)' : 'var(--border)'), background: on ? 'rgba(13,148,136,.1)' : 'var(--s1)', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text)' }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${on ? '#0d9488' : 'var(--border)'}`, background: on ? '#0d9488' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={12} color="#fff" strokeWidth={3} />}</span>
            <span style={{ fontSize: 13 }}>{label}</span>
          </button>
        )
        return (
          <Modal open={!!administrando} onClose={() => { setAdministrando(null); setFolioScan('') }} title="Administrar medicamento"
            footer={<><Button variant="secondary" onClick={() => { setAdministrando(null); setFolioScan('') }}>Cancelar</Button>
              <Button variant="secondary" loading={busy} onClick={() => registrar('omitido', false, false)}><Ban size={14} /> Omitido</Button>
              <Button loading={busy} disabled={!todos} onClick={() => registrar('administrado', true, pacienteOk)}><Check size={14} /> Administrar</Button></>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {indAct && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{indAct.descripcion}{indAct.frecuencia ? ` · ${indAct.frecuencia}` : ''}</div>}
              {indAct && !indAct.verificadaFarmacia && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, padding: '8px 10px', borderRadius: 8, background: 'rgba(217,119,6,.12)', border: '1px solid rgba(217,119,6,.4)', color: '#d97706' }}>
                  <AlertTriangle size={14} /> Esta indicación NO ha sido verificada por farmacia.
                </div>
              )}
              {/* Escaneo del brazalete (BCMA) */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}><ScanLine size={13} /> Escanea el brazalete del paciente (o teclea el folio)</label>
                <input className={inputCls} placeholder={`Folio: …${folioEsperado}`} value={folioScan} onChange={e => setFolioScan(e.target.value)} autoFocus />
                {folioScan && (identidadOk
                  ? <div style={{ fontSize: 11.5, color: '#0d9488', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={12} /> Identidad verificada</div>
                  : <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> El folio no coincide con este paciente</div>)}
              </div>
              {/* Los 5 correctos */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)' }}>Confirma los 5 correctos</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {chk(pacienteOk, () => setCorrectos(c => ({ ...c, paciente: !c.paciente })), 'Paciente correcto' + (identidadOk ? ' (verificado por brazalete)' : ''))}
                {chk(correctos.medicamento, () => setCorrectos(c => ({ ...c, medicamento: !c.medicamento })), 'Medicamento correcto')}
                {chk(correctos.dosis, () => setCorrectos(c => ({ ...c, dosis: !c.dosis })), 'Dosis correcta')}
                {chk(correctos.via, () => setCorrectos(c => ({ ...c, via: !c.via })), 'Vía correcta')}
                {chk(correctos.hora, () => setCorrectos(c => ({ ...c, hora: !c.hora })), 'Hora correcta')}
              </div>
              <input className={inputCls} placeholder="Nota (opcional): dosis, vía, motivo de omisión…" value={admNota} onChange={e => setAdmNota(e.target.value)} />
            </div>
          </Modal>
        )
      })()}

      {/* Conciliación de medicamentos */}
      <Modal open={modalConcil} onClose={() => setModalConcil(false)} title="Conciliación de medicamentos"
        footer={<><Button variant="secondary" onClick={() => setModalConcil(false)}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          const meds = medsCasa.split('\n').map(s => s.trim()).filter(Boolean)
          try { await guardarMedicamentosCasa(clinicId, internamientoId, meds); toast('Conciliación guardada', 'success'); setModalConcil(false); cargar() }
          finally { setBusy(false) }
        }}>Guardar</Button></>}>
        <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Medicamentos que el paciente tomaba en casa (uno por línea)</label>
        <textarea className={inputCls} rows={6} placeholder={'Metformina 850 mg c/12h\nLosartán 50 mg c/24h\n…'} value={medsCasa} onChange={e => setMedsCasa(e.target.value)} />
        <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>Al guardar, se comparan con las indicaciones activas para ver cuáles continuar, suspender o modificar (ingreso/traslado/egreso).</p>
      </Modal>

      {/* Registrar signos */}
      <Modal open={modalSignos} onClose={() => setModalSignos(false)} title="Registrar signos vitales"
        footer={<><Button variant="secondary" onClick={() => setModalSignos(false)}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          const num = (x: string) => x.trim() ? Number(x) : undefined
          try {
            await agregarSignos(clinicId, internamientoId, { fecha: new Date().toISOString(), ta: sg.ta.trim() || undefined, fc: num(sg.fc), fr: num(sg.fr), temp: num(sg.temp), spo2: num(sg.spo2), glucosa: num(sg.glucosa), dolor: num(sg.dolor), por: config?.nombreMedico ?? '' })
            toast('Signos registrados', 'success'); setModalSignos(false); setSg({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '' }); cargar()
          } finally { setBusy(false) }
        }}>Guardar</Button></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {([['ta', 'TA (120/80)'], ['fc', 'FC (lpm)'], ['fr', 'FR (rpm)'], ['temp', 'T° (°C)'], ['spo2', 'SpO₂ (%)'], ['glucosa', 'Glucosa'], ['dolor', 'Dolor (0-10)']] as [keyof typeof sg, string][]).map(([k, label]) => (
            <div key={k}><label style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</label>
              <input className={inputCls} value={sg[k]} onChange={e => setSg(s => ({ ...s, [k]: e.target.value }))} /></div>
          ))}
        </div>
      </Modal>
    </div>
  )

  // ── helpers de estado (declarados al final por claridad) ──
  function registrar(estado: 'administrado' | 'omitido', cincoCorrectos: boolean, identidadVerificada: boolean) {
    if (!clinicId || !administrando) return
    setBusy(true)
    registrarAdministracion(clinicId, internamientoId, administrando, { fecha: new Date().toISOString(), por: config?.nombreMedico ?? rolNombre(rol), estado, nota: admNota.trim() || undefined, cincoCorrectos, identidadVerificada })
      .then(() => { toast(estado === 'administrado' ? 'Administración registrada' : 'Omisión registrada', 'success'); setAdministrando(null); setAdmNota(''); setFolioScan(''); setCorrectos({ paciente: false, medicamento: false, dosis: false, via: false, hora: false }); cargar() })
      .catch((e) => { console.error('[MAR] registrar', e); toast('No se pudo registrar la administración. Intenta de nuevo.', 'error') })
      .finally(() => setBusy(false))
  }
}

function rolNombre(r: RolHospital) { return ROL_HOSPITAL_LABEL[r] }
