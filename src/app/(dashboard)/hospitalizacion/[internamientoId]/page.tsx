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
  agregarSignos, getSignos, getRolUsuario, setRolUsuario,
  crearSolicitudLab, getSolicitudesLabDeEpisodio, cargarResultadosLab, crearAlerta, type AlertaHospital,
  trasladarInternamiento, cambiarTratante,
  suscribirInternamiento, suscribirSignos,
} from '@/lib/hospital/firestore'
import { ESTUDIOS_LAB_RAPIDOS, SERVICIOS_HOSPITAL, type SolicitudLab, type ResultadoLab } from '@/types/hospital'
import { fetchAutenticado } from '@/lib/auth-client'
import { getNotas } from '@/lib/expediente/firestore'
import { getPatients } from '@/lib/firestore'
import { cdsMedicamento, type AlertaCDS } from '@/lib/hospital/cds'
import { code39Svg } from '@/lib/hospital/barcode'
import { buscarMed } from '@/lib/hospital/medicamentos-catalogo'
import { esCriticoLab } from '@/lib/hospital/lab-criticos'
import { logAudit } from '@/lib/expediente/audit-log'
import { calcularNews2 } from '@/lib/hospital/news2'
import { GraficaSignos, type PuntoSigno } from '@/components/hospital/GraficaSignos'
import { PanelEnfermeria } from '@/components/hospital/PanelEnfermeria'
import {
  diasEstancia, TIPO_EGRESO_LABEL, TIPO_INDICACION_LABEL, ESPECIALIDADES_IC, ROL_HOSPITAL_LABEL,
  type Internamiento, type TipoEgreso, type TipoIndicacion, type RegistroSignos, type RolHospital, type Indicacion,
} from '@/types/hospital'
import { TIPO_NOTA_LABEL, type NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { Modal, Button, Spinner } from '@/components/ui'
import {
  ArrowLeft, BedDouble, Stethoscope, Clock, FileText, Plus, LogOut, Pill,
  Send, Check, Activity, Syringe, Ban, ShieldCheck, Printer, AlertTriangle, ScanLine, ClipboardCheck, HeartPulse,
} from 'lucide-react'

const TIPO_EGRESO_OPCIONES: TipoEgreso[] = ['mejoria', 'maximo_beneficio', 'voluntaria', 'traslado', 'defuncion', 'otro']
const TIPO_IND_OPCIONES: TipoIndicacion[] = ['medicamento', 'liquidos', 'dieta', 'cuidado', 'estudio', 'otro']
const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'
type Tab = 'resumen' | 'indicaciones' | 'signos' | 'laboratorio' | 'enfermeria' | 'interconsultas'

export default function EpisodioPage() {
  const { internamientoId } = useParams<{ internamientoId: string }>()
  const router = useRouter()
  const { clinicId, role: memberRole } = useClinic()
  // El rol del hospital DERIVA del rol real del usuario (clinic_members), no es
  // un botón libre. Médico/admin pueden cambiar de vista; el resto queda fijo.
  const rolReal: RolHospital = memberRole === 'enfermeria' ? 'enfermeria' : memberRole === 'farmacia' ? 'farmacia' : memberRole === 'laboratorio' ? 'laboratorio' : memberRole === 'admin' ? 'admin' : 'medico'
  const puedeCambiarRol = memberRole === 'medico' || memberRole === 'admin'
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
  const [indForm, setIndForm] = useState<{ tipo: TipoIndicacion; descripcion: string; dosis: string; via: string; frecuencia: string }>({ tipo: 'medicamento', descripcion: '', dosis: '', via: '', frecuencia: '' })
  const [medQuery, setMedQuery] = useState('')
  const [admNota, setAdmNota] = useState('')
  const [sg, setSg] = useState<{ ta: string; fc: string; fr: string; temp: string; spo2: string; glucosa: string; dolor: string; conciencia: 'alerta' | 'alterada'; oxigeno: boolean }>({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '', conciencia: 'alerta', oxigeno: false })
  const [patient, setPatient] = useState<Patient | null>(null)
  const [labs, setLabs] = useState<SolicitudLab[]>([])
  const [modalLab, setModalLab] = useState(false)
  const [labSel, setLabSel] = useState<string[]>([])
  const [labPrioridad, setLabPrioridad] = useState<'rutina' | 'urgente'>('rutina')
  const [labExtra, setLabExtra] = useState('')
  const [cargandoRes, setCargandoRes] = useState<SolicitudLab | null>(null)  // orden a la que se le cargan resultados
  const [resForm, setResForm] = useState<ResultadoLab[]>([])
  const [modalImport, setModalImport] = useState(false)
  const [importTxt, setImportTxt] = useState('')
  const [modalConcil, setModalConcil] = useState(false)
  const [medsCasa, setMedsCasa] = useState('')
  const [modalTraslado, setModalTraslado] = useState(false)
  const [trForm, setTrForm] = useState({ servicio: '', cama: '', tratante: '' })
  const [correctos, setCorrectos] = useState({ paciente: false, medicamento: false, dosis: false, via: false, hora: false })
  const [folioScan, setFolioScan] = useState('')

  const cargar = async () => {
    if (!clinicId || !internamientoId) return
    const i = await getInternamiento(clinicId, internamientoId)
    setInter(i)
    if (i) {
      const [todas, sgs, pacientes, labsE] = await Promise.all([
        getNotas(clinicId, i.pacienteId).catch(() => [] as NotaMedica[]),
        getSignos(clinicId, internamientoId).catch(() => [] as RegistroSignos[]),
        getPatients(clinicId).catch(() => [] as Patient[]),
        getSolicitudesLabDeEpisodio(clinicId, internamientoId).catch(() => [] as SolicitudLab[]),
      ])
      setLabs(labsE)
      setNotas(todas.filter(n => n.internamientoId === internamientoId))
      setSignos(sgs)
      setPatient(pacientes.find(p => p.id === i.pacienteId) ?? null)
      setMedsCasa((i.medicamentosCasa ?? []).join('\n'))
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [clinicId, internamientoId])
  // Refresco EN VIVO: indicaciones/MAR/interconsultas/traslados y signos que
  // registran OTROS usuarios (enfermería, farmacia, otro médico) aparecen solos,
  // sin recargar. Las notas/labs siguen refrescándose con cargar() tras acciones.
  useEffect(() => {
    if (!clinicId || !internamientoId) return
    const u1 = suscribirInternamiento(clinicId, internamientoId, i => { if (i) setInter(i) })
    const u2 = suscribirSignos(clinicId, internamientoId, setSignos)
    return () => { u1(); u2() }
  }, [clinicId, internamientoId])
  useEffect(() => {
    // Staff clínico (enfermería/farmacia/laboratorio): rol FIJO al del usuario.
    if (!puedeCambiarRol) { setRol(rolReal); return }
    // Médico/admin: pueden alternar de vista y se recuerda su preferencia.
    try { const r = localStorage.getItem('hospitalRol') as RolHospital | null; if (r) setRol(r) } catch { /* */ }
    const uid = auth.currentUser?.uid
    if (clinicId && uid) getRolUsuario(clinicId, uid).then(r => { if (r) setRol(r) }).catch(() => {})
  }, [clinicId, puedeCambiarRol, rolReal])
  const cambiarRol = (r: RolHospital) => {
    if (!puedeCambiarRol) return
    setRol(r)
    try { localStorage.setItem('hospitalRol', r) } catch { /* */ }
    const uid = auth.currentUser?.uid
    if (clinicId && uid) setRolUsuario(clinicId, uid, r).catch(() => {})
  }
  // Aterrizaje por rol: cada quien entra a lo suyo (laboratorio→su bandeja, enfermería/farmacia→MAR).
  useEffect(() => {
    if (rol === 'laboratorio') setTab('laboratorio')
    else if (rol === 'enfermeria' || rol === 'farmacia') setTab('indicaciones')
  }, [rol])

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

  // NEWS2 (deterioro) del último registro de signos + series para las gráficas
  const ultimoSignos = signos.length ? signos[signos.length - 1] : null
  const news2 = useMemo(
    () => ultimoSignos ? calcularNews2({ fr: ultimoSignos.fr, spo2: ultimoSignos.spo2, temp: ultimoSignos.temp, ta: ultimoSignos.ta, fc: ultimoSignos.fc, conciencia: ultimoSignos.conciencia, oxigeno: ultimoSignos.oxigeno }) : null,
    [ultimoSignos],
  )
  const serie = (k: 'fc' | 'fr' | 'temp' | 'spo2' | 'glucosa'): PuntoSigno[] =>
    signos.filter(s => s[k] != null).map(s => ({ fecha: s.fecha, valor: Number(s[k]) }))
  const serieSistolica: PuntoSigno[] = signos
    .filter(s => s.ta).map(s => ({ fecha: s.fecha!, valor: parseInt(String(s.ta).split('/')[0], 10) })).filter(p => !isNaN(p.valor))

  const nuevaNota = (tipo: string) => {
    if (!inter) return
    router.push(`/consulta/${inter.pacienteId}?tipo=${tipo}&internamiento=${internamientoId}`)
  }

  // Motor de alertas: guarda la alerta en-app y pide el envío WhatsApp. El
  // teléfono destino lo DERIVA el servidor (nunca el cliente): primero el
  // WhatsApp personal del MÉDICO TRATANTE (si lo registró), si no, el general
  // de la clínica. `destinatarioUid` es solo la clave de búsqueda server-side.
  const dispararAlerta = async (a: Omit<AlertaHospital, 'id' | 'leida' | 'fecha'>) => {
    if (!clinicId) return
    const conDest: Omit<AlertaHospital, 'id' | 'leida' | 'fecha'> = { ...a, destinatarioUid: inter?.medicoTratanteId, destinatarioNombre: inter?.medicoTratanteNombre }
    try { await crearAlerta(clinicId, conDest) } catch { /* */ }
    fetchAutenticado('/api/hospital/alerta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinicId, destinatarioUid: inter?.medicoTratanteId, mensaje: `🏥 ${a.titulo}\n${a.detalle}\nPaciente: ${a.pacienteNombre}` }) }).catch(() => {})
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
        {/* Rol — médico/admin alternan vista; el resto lo ve fijo a su usuario */}
        {puedeCambiarRol ? (
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: 'var(--text3)', marginRight: 2 }}>Ver como:</span>
            {(['medico', 'enfermeria', 'farmacia', 'laboratorio', 'admin'] as RolHospital[]).map(r => (
              <button key={r} onClick={() => cambiarRol(r)} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                border: '1px solid ' + (rol === r ? 'var(--nexus,#3d5afe)' : 'var(--border)'),
                background: rol === r ? 'rgba(61,90,254,.12)' : 'var(--s2)', color: rol === r ? 'var(--nexus,#3d5afe)' : 'var(--text3)',
              }}>{ROL_HOSPITAL_LABEL[r]}</button>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: 'rgba(61,90,254,.12)', color: 'var(--nexus,#3d5afe)', border: '1px solid var(--nexus,#3d5afe)' }}>{ROL_HOSPITAL_LABEL[rol]}</span>
          </div>
        )}
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
            {news2 && <button onClick={() => setTab('signos')} title={news2.recomendacion} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 100, border: `1px solid ${news2.color}`, background: news2.color + '1f', color: news2.color, cursor: 'pointer' }}><HeartPulse size={13} /> NEWS2 {news2.total}</button>}
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
        {([['resumen', 'Resumen / Notas'], ['indicaciones', `Indicaciones · MAR${indicaciones.filter(i => i.activa).length ? ' (' + indicaciones.filter(i => i.activa).length + ')' : ''}`], ['signos', 'Signos vitales'], ['laboratorio', `Laboratorio${labs.length ? ' (' + labs.length + ')' : ''}`], ['enfermeria', 'Enfermería'], ['interconsultas', `Interconsultas${interconsultas.length ? ' (' + interconsultas.length + ')' : ''}`]] as [Tab, string][]).map(([t, label]) => (
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
            <Button variant="secondary" icon={<BedDouble size={15} />} onClick={() => { setTrForm({ servicio: inter.servicio, cama: inter.cama, tratante: inter.medicoTratanteNombre }); setModalTraslado(true) }}>Trasladar</Button>
            <Button variant="secondary" icon={<LogOut size={15} />} onClick={() => setModalEgreso(true)}>Egresar</Button>
          </div>
        )}
        {/* Historial de movimientos */}
        {(inter.movimientos?.length ?? 0) > 0 && (
          <details style={{ marginBottom: 16, fontSize: 12.5, color: 'var(--text3)' }}>
            <summary style={{ cursor: 'pointer' }}>Movimientos del episodio ({inter.movimientos!.length})</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
              {[...inter.movimientos!].reverse().map((m, i) => (
                <div key={i}>{new Date(m.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {m.tipo === 'traslado' ? 'Traslado' : 'Cambio de tratante'}: {m.detalle}{m.por ? ` · ${m.por}` : ''}</div>
              ))}
            </div>
          </details>
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
        ) : (<>
          {/* NEWS2 — score de deterioro del último registro */}
          {news2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14, padding: '12px 14px', borderRadius: 12, border: `1px solid ${news2.color}55`, background: news2.color + '12' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: news2.color, lineHeight: 1 }}>{news2.total}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: news2.color }}>NEWS2 · {news2.riesgo}</span>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 4 }}>{news2.recomendacion}{news2.parcial ? ' (parcial: sin conciencia/O₂)' : ''}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {news2.detalle.filter(d => d.puntos > 0).map((d, i) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'var(--s2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>{d.param} {d.valor} · +{d.puntos}</span>)}
                </div>
              </div>
            </div>
          )}
          {/* Gráficas de tendencia */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
            <GraficaSignos titulo="Frecuencia cardiaca" unidad="lpm" puntos={serie('fc')} normalMin={60} normalMax={100} color="#dc2626" />
            <GraficaSignos titulo="TA sistólica" unidad="mmHg" puntos={serieSistolica} normalMin={90} normalMax={140} color="#3d5afe" />
            <GraficaSignos titulo="Frecuencia respiratoria" unidad="rpm" puntos={serie('fr')} normalMin={12} normalMax={20} color="#7c3aed" />
            <GraficaSignos titulo="Temperatura" unidad="°C" puntos={serie('temp')} normalMin={36} normalMax={38} color="#d97706" />
            <GraficaSignos titulo="SpO₂" unidad="%" puntos={serie('spo2')} normalMin={92} normalMax={100} color="#0d9488" />
            <GraficaSignos titulo="Glucosa" unidad="mg/dL" puntos={serie('glucosa')} normalMin={70} normalMax={180} color="#0ea5e9" />
          </div>
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
        </>)}
      </>)}

      {/* ── TAB: LABORATORIO ── */}
      {tab === 'laboratorio' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Solicitudes de laboratorio y resultados. Los valores críticos alertan al médico.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(rol === 'laboratorio' || rol === 'medico') && !egresado && <Button size="sm" variant="secondary" icon={<Send size={14} />} onClick={() => { setImportTxt(''); setModalImport(true) }}>Importar FHIR</Button>}
            {esMedico && !egresado && <Button size="sm" icon={<Plus size={14} />} onClick={() => { setLabSel([]); setLabExtra(''); setLabPrioridad('rutina'); setModalLab(true) }}>Solicitar laboratorio</Button>}
          </div>
        </div>
        {labs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Sin solicitudes de laboratorio.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {labs.map(l => (
              <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{l.estudios.join(', ')}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: l.estado === 'resultado' ? 'rgba(13,148,136,.15)' : l.prioridad === 'urgente' ? 'rgba(220,38,38,.12)' : 'rgba(217,119,6,.15)', color: l.estado === 'resultado' ? '#0d9488' : l.prioridad === 'urgente' ? '#dc2626' : '#d97706' }}>{l.estado === 'resultado' ? 'Resultado listo' : l.prioridad === 'urgente' ? 'Urgente · pendiente' : 'Pendiente'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Solicitó: {l.solicitadaPor || '—'} · {new Date(l.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                {l.resultados && l.resultados.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {l.resultados.map((r, i) => (
                      <div key={i} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 8, color: r.critico ? '#dc2626' : 'var(--text2)', fontWeight: r.critico ? 700 : 400 }}>
                        <span>{r.critico && '⚠ '}{r.estudio}</span>
                        <span>{r.valor} {r.unidad ?? ''}{r.referencia ? ` (${r.referencia})` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(rol === 'laboratorio' || rol === 'medico') && l.estado !== 'resultado' && (
                  <div style={{ marginTop: 10 }}>
                    <Button size="sm" variant="secondary" onClick={() => { setResForm(l.estudios.map(e => ({ estudio: e, valor: '', unidad: '', critico: false }))); setCargandoRes(l) }}>Cargar resultados</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ── TAB: ENFERMERÍA ── */}
      {tab === 'enfermeria' && clinicId && (
        <PanelEnfermeria clinicId={clinicId} internamiento={inter} por={config?.nombreMedico ?? ROL_HOSPITAL_LABEL[rol]} puedeEditar={puedeEnfermeria && !egresado} onSaved={cargar} />
      )}

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
          try { await egresarInternamiento(clinicId, internamientoId, { tipoEgreso: egr.tipo, resumenEgreso: egr.resumen.trim() || undefined }); logAudit({ evento: 'hosp_egreso', clinicId, patientId: inter?.pacienteId, medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined, meta: { internamientoId, tipoEgreso: egr.tipo } }); toast('Paciente egresado', 'success'); setModalEgreso(false); nuevaNota('egreso') }
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
          try { await agregarInterconsulta(clinicId, internamientoId, { especialidad: icForm.especialidad, motivo: icForm.motivo.trim(), solicitanteNombre: config?.nombreMedico ?? '' }); if (inter) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'interconsulta', titulo: `Nueva interconsulta a ${icForm.especialidad}`, detalle: icForm.motivo.trim() }); toast('Interconsulta solicitada', 'success'); setModalIC(false); setIcForm({ especialidad: ESPECIALIDADES_IC[0], motivo: '' }); cargar() }
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

      {/* Nueva indicación (medicamento con catálogo buscable = CPOE estructurado) */}
      <Modal open={modalInd} onClose={() => { setModalInd(false); setMedQuery('') }} title="Nueva indicación médica"
        footer={<><Button variant="secondary" onClick={() => { setModalInd(false); setMedQuery('') }}>Cancelar</Button><Button loading={busy} disabled={!indForm.descripcion.trim()} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          const desc = indForm.tipo === 'medicamento'
            ? [indForm.descripcion.trim(), indForm.dosis.trim(), indForm.via.trim()].filter(Boolean).join(' ')
            : indForm.descripcion.trim()
          try { await agregarIndicacion(clinicId, internamientoId, { tipo: indForm.tipo, descripcion: desc, frecuencia: indForm.frecuencia.trim() || undefined, creadaPor: config?.nombreMedico ?? '' }); toast('Indicación agregada', 'success'); setModalInd(false); setIndForm({ tipo: 'medicamento', descripcion: '', dosis: '', via: '', frecuencia: '' }); setMedQuery(''); cargar() }
          finally { setBusy(false) }
        }}>Agregar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Tipo</label>
            <select className={inputCls} value={indForm.tipo} onChange={e => setIndForm(f => ({ ...f, tipo: e.target.value as TipoIndicacion }))}>{TIPO_IND_OPCIONES.map(t => <option key={t} value={t}>{TIPO_INDICACION_LABEL[t]}</option>)}</select></div>

          {indForm.tipo === 'medicamento' ? (<>
            {/* Buscador del catálogo */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Medicamento (busca en el catálogo)</label>
              <input className={inputCls} placeholder="Escribe: ceftriaxona, omeprazol, insulina…" value={indForm.descripcion} onChange={e => { setIndForm(f => ({ ...f, descripcion: e.target.value, dosis: '', via: '' })); setMedQuery(e.target.value) }} />
              {medQuery.trim().length >= 2 && buscarMed(medQuery).length > 0 && (
                <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, marginTop: 2, maxHeight: 220, overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
                  {buscarMed(medQuery).map(m => (
                    <button key={m.nombre} type="button" onClick={() => { setIndForm(f => ({ ...f, descripcion: m.nombre, dosis: m.pres[0] ?? '', via: m.vias[0] ?? '' })); setMedQuery('') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                      <span style={{ fontWeight: 600 }}>{m.nombre}</span> <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {m.cat}{m.marcas?.length ? ' · ' + m.marcas[0] : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Dosis (presentaciones) + vía como chips rápidos */}
            {(() => { const sel = buscarMed(indForm.descripcion).find(m => m.nombre === indForm.descripcion); return sel ? (
              <>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text3)' }}>Dosis / presentación</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 3 }}>
                    {sel.pres.map(p => <button key={p} type="button" onClick={() => setIndForm(f => ({ ...f, dosis: p }))} className="rounded-full border px-2.5 py-1 text-xs" style={indForm.dosis === p ? { borderColor: '#3d5afe', background: 'rgba(61,90,254,.12)', color: '#3d5afe' } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{p}</button>)}
                    <input className="rounded-md border px-2 py-1 text-xs bg-transparent" style={{ width: 100 }} placeholder="otra" value={indForm.dosis} onChange={e => setIndForm(f => ({ ...f, dosis: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text3)' }}>Vía</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 3 }}>
                    {sel.vias.map(v2 => <button key={v2} type="button" onClick={() => setIndForm(f => ({ ...f, via: v2 }))} className="rounded-full border px-2.5 py-1 text-xs" style={indForm.via === v2 ? { borderColor: '#3d5afe', background: 'rgba(61,90,254,.12)', color: '#3d5afe' } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{v2}</button>)}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className={inputCls} placeholder="Dosis (ej. 1 g)" value={indForm.dosis} onChange={e => setIndForm(f => ({ ...f, dosis: e.target.value }))} />
                <input className={inputCls} placeholder="Vía (ej. IV)" value={indForm.via} onChange={e => setIndForm(f => ({ ...f, via: e.target.value }))} />
              </div>
            )})()}
          </>) : (
            <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Indicación</label>
              <input className={inputCls} placeholder="ej. Dieta blanda / Vigilar diuresis" value={indForm.descripcion} onChange={e => setIndForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
          )}

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
        // Identidad verificada solo con el folio COMPLETO del brazalete (8 chars), no un fragmento adivinable.
        const identidadOk = folioScan.trim().toUpperCase().endsWith(folioEsperado) && folioScan.trim().length >= 8
        const pacienteOk = correctos.paciente || identidadOk
        const todos = pacienteOk && correctos.medicamento && correctos.dosis && correctos.via && correctos.hora
        const faltan = [!pacienteOk && 'paciente', !correctos.medicamento && 'medicamento', !correctos.dosis && 'dosis', !correctos.via && 'vía', !correctos.hora && 'hora'].filter(Boolean) as string[]
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
              {/* NO se deshabilita en silencio: si faltan correctos, avisa cuáles (antes "no pasaba nada"). */}
              <Button loading={busy} onClick={() => { if (!todos) { toast(`Confirma antes de administrar: ${faltan.join(', ')}`, 'error'); return } registrar('administrado', true, pacienteOk) }}><Check size={14} /> Administrar</Button></>}>
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
              <div style={{ fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 8, color: todos ? '#0d9488' : '#d97706', background: todos ? 'rgba(13,148,136,.1)' : 'rgba(217,119,6,.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {todos ? <><Check size={14} /> Listo para administrar</> : <><AlertTriangle size={14} /> Falta confirmar: {faltan.join(', ')}</>}
              </div>
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

      {/* Traslado de servicio/cama + cambio de tratante */}
      <Modal open={modalTraslado} onClose={() => setModalTraslado(false)} title="Trasladar / reasignar"
        footer={<><Button variant="secondary" onClick={() => setModalTraslado(false)}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId || !inter) return; setBusy(true)
          const por = config?.nombreMedico ?? ROL_HOSPITAL_LABEL[rol]
          try {
            if (trForm.servicio !== inter.servicio || trForm.cama !== inter.cama) await trasladarInternamiento(clinicId, internamientoId, { servicio: trForm.servicio, cama: trForm.cama.trim(), por })
            if (trForm.tratante.trim() && trForm.tratante.trim() !== inter.medicoTratanteNombre) await cambiarTratante(clinicId, internamientoId, { medicoTratanteId: inter.medicoTratanteId, medicoTratanteNombre: trForm.tratante.trim(), por })
            toast('Movimiento registrado', 'success'); setModalTraslado(false); cargar()
          } finally { setBusy(false) }
        }}>Guardar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Servicio</label>
              <select className={inputCls} value={trForm.servicio} onChange={e => setTrForm(f => ({ ...f, servicio: e.target.value }))}>{SERVICIOS_HOSPITAL.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Cama</label>
              <input className={inputCls} value={trForm.cama} onChange={e => setTrForm(f => ({ ...f, cama: e.target.value }))} /></div>
          </div>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Médico tratante</label>
            <input className={inputCls} placeholder="Nombre del médico responsable" value={trForm.tratante} onChange={e => setTrForm(f => ({ ...f, tratante: e.target.value }))} /></div>
          <p style={{ fontSize: 11.5, color: 'var(--text3)' }}>Los cambios quedan registrados en el historial de movimientos del episodio.</p>
        </div>
      </Modal>

      {/* Solicitar laboratorio */}
      <Modal open={modalLab} onClose={() => setModalLab(false)} title="Solicitar laboratorio"
        footer={<><Button variant="secondary" onClick={() => setModalLab(false)}>Cancelar</Button><Button loading={busy} disabled={labSel.length === 0 && !labExtra.trim()} onClick={async () => {
          if (!clinicId || !inter) return; setBusy(true)
          const estudios = [...labSel, ...labExtra.split(/[,\n]/).map(s => s.trim()).filter(Boolean)]
          try { await crearSolicitudLab(clinicId, { clinicId, internamientoId, pacienteId: inter.pacienteId, pacienteNombre: inter.pacienteNombre, estudios, prioridad: labPrioridad, solicitadaPor: config?.nombreMedico ?? '', fecha: new Date().toISOString() }); toast('Laboratorio solicitado', 'success'); setModalLab(false); cargar() }
          finally { setBusy(false) }
        }}>Solicitar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Estudios</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {ESTUDIOS_LAB_RAPIDOS.map(e => { const on = labSel.includes(e); return (
                <button key={e} type="button" onClick={() => setLabSel(s => on ? s.filter(x => x !== e) : [...s, e])} className="rounded-full border px-2.5 py-1 text-xs" style={on ? { borderColor: '#3d5afe', background: 'rgba(61,90,254,.12)', color: '#3d5afe' } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{e}</button>
              )})}
            </div>
          </div>
          <input className={inputCls} placeholder="Otros estudios (separa con coma)" value={labExtra} onChange={e => setLabExtra(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            {(['rutina', 'urgente'] as const).map(p => <button key={p} type="button" onClick={() => setLabPrioridad(p)} className="rounded-full border px-3 py-1 text-xs" style={labPrioridad === p ? { borderColor: p === 'urgente' ? '#dc2626' : '#0d9488', background: (p === 'urgente' ? '#dc2626' : '#0d9488') + '18', color: p === 'urgente' ? '#dc2626' : '#0d9488', fontWeight: 700 } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{p === 'urgente' ? 'Urgente' : 'Rutina'}</button>)}
          </div>
        </div>
      </Modal>

      {/* Cargar resultados de laboratorio */}
      <Modal open={!!cargandoRes} onClose={() => setCargandoRes(null)} title="Cargar resultados"
        footer={<><Button variant="secondary" onClick={() => setCargandoRes(null)}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId || !cargandoRes || !inter) return; setBusy(true)
          // Respaldo determinista: marca crítico por rango aunque no se haya marcado a mano.
          const resultados = resForm.filter(r => r.valor.trim()).map(r => ({ ...r, critico: r.critico || esCriticoLab(r.estudio, r.valor) }))
          try {
            await cargarResultadosLab(clinicId, cargandoRes.id, resultados, ROL_HOSPITAL_LABEL[rol])
            const criticos = resultados.filter(r => r.critico)
            if (criticos.length) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'lab_critico', titulo: 'Valor de laboratorio CRÍTICO', detalle: criticos.map(c => `${c.estudio}: ${c.valor} ${c.unidad ?? ''}`).join('; ') })
            else await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'resultado', titulo: 'Resultado de laboratorio listo', detalle: cargandoRes.estudios.join(', ') })
            toast('Resultados cargados', 'success'); setCargandoRes(null); cargar()
          } finally { setBusy(false) }
        }}>Guardar resultados</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resForm.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr auto', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{r.estudio}</span>
              <input className="rounded-md border px-2 py-1 text-xs bg-transparent" placeholder="valor" value={r.valor} onChange={e => setResForm(f => f.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} />
              <input className="rounded-md border px-2 py-1 text-xs bg-transparent" placeholder="unidad" value={r.unidad ?? ''} onChange={e => setResForm(f => f.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x))} />
              <button type="button" title="Marcar crítico" onClick={() => setResForm(f => f.map((x, j) => j === i ? { ...x, critico: !x.critico } : x))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid ' + (r.critico ? '#dc2626' : 'var(--border)'), background: r.critico ? 'rgba(220,38,38,.12)' : 'transparent', color: r.critico ? '#dc2626' : 'var(--text3)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{r.critico ? '⚠ crítico' : 'crítico'}</button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Importar resultados de laboratorio desde FHIR */}
      <Modal open={modalImport} onClose={() => setModalImport(false)} title="Importar resultados (HL7 FHIR)"
        footer={<><Button variant="secondary" onClick={() => setModalImport(false)}>Cancelar</Button><Button loading={busy} disabled={!importTxt.trim()} onClick={async () => {
          if (!clinicId || !inter) return; setBusy(true)
          try {
            const { parsearLabsFhir } = await import('@/lib/hospital/fhir-import')
            const resultados = parsearLabsFhir(importTxt)
            if (!resultados.length) { toast('No se encontraron Observations en el FHIR', 'error'); return }
            await crearSolicitudLab(clinicId, { clinicId, internamientoId, pacienteId: inter.pacienteId, pacienteNombre: inter.pacienteNombre, estudios: resultados.map(r => r.estudio), prioridad: 'rutina', solicitadaPor: 'Importación FHIR', fecha: new Date().toISOString() })
              .then(async (id) => { await cargarResultadosLab(clinicId, id, resultados, 'FHIR'); const crit = resultados.filter(r => r.critico); if (crit.length) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'lab_critico', titulo: 'Valor de laboratorio CRÍTICO (FHIR)', detalle: crit.map(c => `${c.estudio}: ${c.valor} ${c.unidad ?? ''}`).join('; ') }) })
            toast(`Importados ${resultados.length} resultados`, 'success'); setModalImport(false); cargar()
          } catch { toast('FHIR inválido', 'error') } finally { setBusy(false) }
        }}>Importar</Button></>}>
        <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6 }}>Pega un Bundle FHIR R4 (o Observations) del laboratorio. Un LIS que hable FHIR (o HL7 v2 convertido) puede empujar aquí.</p>
        <textarea className={inputCls} rows={8} style={{ fontFamily: 'monospace', fontSize: 11 }} placeholder='{ "resourceType": "Bundle", "entry": [ ... ] }' value={importTxt} onChange={e => setImportTxt(e.target.value)} />
      </Modal>

      {/* Registrar signos */}
      <Modal open={modalSignos} onClose={() => setModalSignos(false)} title="Registrar signos vitales"
        footer={<><Button variant="secondary" onClick={() => setModalSignos(false)}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          const num = (x: string) => x.trim() ? Number(x) : undefined
          try {
            await agregarSignos(clinicId, internamientoId, { fecha: new Date().toISOString(), ta: sg.ta.trim() || undefined, fc: num(sg.fc), fr: num(sg.fr), temp: num(sg.temp), spo2: num(sg.spo2), glucosa: num(sg.glucosa), dolor: num(sg.dolor), conciencia: sg.conciencia, oxigeno: sg.oxigeno || undefined, por: config?.nombreMedico ?? '' })
            // Alerta por deterioro: NEWS2 alto O parámetro individual en rojo (criterio Royal College)
            const n2 = calcularNews2({ ta: sg.ta, fc: num(sg.fc), fr: num(sg.fr), temp: num(sg.temp), spo2: num(sg.spo2), conciencia: sg.conciencia, oxigeno: sg.oxigeno })
            if (n2 && (n2.riesgo === 'alto' || n2.parametroRojo) && inter) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'news2', titulo: `Deterioro clínico — NEWS2 ${n2.total} (${n2.riesgo})`, detalle: n2.recomendacion })
            toast('Signos registrados', 'success'); setModalSignos(false); setSg({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '', conciencia: 'alerta', oxigeno: false }); cargar()
          } finally { setBusy(false) }
        }}>Guardar</Button></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {([['ta', 'TA (120/80)'], ['fc', 'FC (lpm)'], ['fr', 'FR (rpm)'], ['temp', 'T° (°C)'], ['spo2', 'SpO₂ (%)'], ['glucosa', 'Glucosa'], ['dolor', 'Dolor (0-10)']] as ['ta' | 'fc' | 'fr' | 'temp' | 'spo2' | 'glucosa' | 'dolor', string][]).map(([k, label]) => (
            <div key={k}><label style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</label>
              <input className={inputCls} value={sg[k]} onChange={e => setSg(s => ({ ...s, [k]: e.target.value }))} /></div>
          ))}
        </div>
        {/* Conciencia (ACVPU) + O2 suplementario — completan el NEWS2 */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block' }}>Conciencia</label>
            <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
              {(['alerta', 'alterada'] as const).map(c => <button key={c} type="button" onClick={() => setSg(s => ({ ...s, conciencia: c }))} className="rounded-full border px-2.5 py-1 text-xs" style={sg.conciencia === c ? { borderColor: c === 'alterada' ? '#dc2626' : '#0d9488', background: (c === 'alterada' ? '#dc2626' : '#0d9488') + '18', color: c === 'alterada' ? '#dc2626' : '#0d9488', fontWeight: 700 } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{c === 'alerta' ? 'Alerta' : 'Alterada'}</button>)}
            </div>
          </div>
          <label style={{ fontSize: 12.5, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={sg.oxigeno} onChange={e => setSg(s => ({ ...s, oxigeno: e.target.checked }))} /> Recibe O₂ suplementario
          </label>
        </div>
      </Modal>
    </div>
  )

  // ── helpers de estado (declarados al final por claridad) ──
  function registrar(estado: 'administrado' | 'omitido', cincoCorrectos: boolean, identidadVerificada: boolean) {
    if (!clinicId || !administrando) return
    setBusy(true)
    registrarAdministracion(clinicId, internamientoId, administrando, { fecha: new Date().toISOString(), por: config?.nombreMedico ?? rolNombre(rol), estado, nota: admNota.trim() || undefined, cincoCorrectos, identidadVerificada })
      .then(() => { toast(estado === 'administrado' ? 'Administración registrada' : 'Omisión registrada', 'success'); logAudit({ evento: 'hosp_administracion', clinicId, patientId: inter?.pacienteId, medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined, meta: { internamientoId, estado, indId: administrando, cincoCorrectos } }); setAdministrando(null); setAdmNota(''); setFolioScan(''); setCorrectos({ paciente: false, medicamento: false, dosis: false, via: false, hora: false }); cargar() })
      .catch((e) => { console.error('[MAR] registrar', e); toast(e instanceof Error && e.message ? e.message : 'No se pudo registrar la administración. Intenta de nuevo.', 'error') })
      .finally(() => setBusy(false))
  }
}

function rolNombre(r: RolHospital) { return ROL_HOSPITAL_LABEL[r] }
