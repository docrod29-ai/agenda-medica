'use client'
// ══════════════════════════════════════════════════════════════
// Ficha del EPISODIO de internamiento — con pestañas:
//  · Resumen/Notas  · Indicaciones + MAR  · Signos vitales  · Interconsultas
// Rol (médico/enfermería/admin) filtra las acciones visibles (vista, no seguridad).
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef } from 'react'
import { proyectarSignos, acvpu, concienciaExigeReSeleccion } from '@/lib/hospital/eventos'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { getUnidades } from '@/lib/hospital/firestore'
import { TIPO_UNIDAD_LABEL, type Unidad } from '@/lib/hospital/unidades'
import { tramosDeEpisodio, indicadoresEpisodio, reingresosACritica, enDias } from '@/lib/hospital/indicadores-episodio'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import {
  getInternamiento, egresarInternamiento,
  agregarInterconsulta, responderInterconsulta, editarInterconsulta, borrarInterconsulta,
  agregarIndicacion, suspenderIndicacion, editarIndicacion, borrarIndicacion, registrarAdministracion,
  verificarIndicacionFarmacia, guardarMedicamentosCasa,
  agregarSignos, corregirSignos, getSignos, getRolUsuario, setRolUsuario,
  crearSolicitudLab, getSolicitudesLabDeEpisodio, cargarResultadosLab, borrarSolicitudLab, crearAlerta, type AlertaHospital,
  trasladarInternamiento, cambiarTratante,
  suscribirInternamiento, suscribirSignos, getAsignacionesCama,
} from '@/lib/hospital/firestore'
import { historialCamas } from '@/lib/hospital/bed-assignment'
import { ESTUDIOS_LAB_RAPIDOS, SERVICIOS_HOSPITAL, type SolicitudLab, type ResultadoLab, type BedAssignment } from '@/types/hospital'
import { fetchAutenticado } from '@/lib/auth-client'
import { getNotas } from '@/lib/expediente/firestore'
import { getPatient, getDoctors } from '@/lib/firestore'
import { cdsMedicamento, type AlertaCDS } from '@/lib/hospital/cds'
import { code39Svg } from '@/lib/hospital/barcode'
import { buscarMed } from '@/lib/hospital/medicamentos-catalogo'
import { esCriticoLab } from '@/lib/hospital/lab-criticos'
import { logAudit } from '@/lib/expediente/audit-log'
import { nivelDeSigno, calcularNews2 } from '@/lib/hospital/news2'
import { encuadrarNews2 } from '@/lib/hospital/news2-encuadre'
import { textoOxigeno } from '@/lib/hospital/oxigeno'
import { GraficaSignos, type PuntoSigno } from '@/components/hospital/GraficaSignos'
import { PanelEnfermeria } from '@/components/hospital/PanelEnfermeria'
import {
  diasEstancia, TIPO_EGRESO_LABEL, TIPO_INDICACION_LABEL, ESPECIALIDADES_IC, ROL_HOSPITAL_LABEL,
  type Internamiento, type TipoEgreso, type TipoIndicacion, type RegistroSignos, type RolHospital, type Indicacion,
} from '@/types/hospital'
import { TIPO_NOTA_LABEL, type NotaMedica } from '@/types/expediente'
import type { Patient, Doctor } from '@/types'
import { Modal, Button, Spinner } from '@/components/ui'
import {
  ArrowLeft, BedDouble, Stethoscope, Clock, FileText, Plus, LogOut, Pill,
  Send, Check, Activity, Syringe, Ban, ShieldCheck, Printer, AlertTriangle, ScanLine, ClipboardCheck, HeartPulse,
  Pencil, PencilLine, Trash2,
} from 'lucide-react'

const TIPO_EGRESO_OPCIONES: TipoEgreso[] = ['mejoria', 'maximo_beneficio', 'voluntaria', 'traslado', 'defuncion', 'otro']
const TIPO_IND_OPCIONES: TipoIndicacion[] = ['medicamento', 'liquidos', 'dieta', 'cuidado', 'estudio', 'otro']
const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'
type Tab = 'resumen' | 'indicaciones' | 'signos' | 'laboratorio' | 'enfermeria' | 'interconsultas'

/**
 * El color de un signo sale del MOTOR NEWS2, no de umbrales escritos aquí.
 *
 * Esta tabla pintaba con los suyos —`spo2 < 92`, `temp >= 38`, `fc > 100`—
 * mientras el score de arriba usaba los del Royal College. **Decían cosas
 * distintas del mismo número en la misma pantalla:** una SpO₂ de 92 salía en
 * negro y sumaba dos puntos, y una temperatura de 35 salía en negro cuando NEWS2
 * le da TRES — una hipotermia invisible en la tabla.
 *
 * Ahora los dos leen la misma tabla. Naranja para lo que suma 1-2 puntos y rojo
 * para lo que suma 3, que es el criterio de escalamiento del propio score.
 */
function colorSigno(
  campo: 'fr' | 'spo2' | 'temp' | 'fc' | 'sys',
  valor: unknown,
  ctx?: { oxigeno?: boolean },
): { color?: string; fontWeight?: number } {
  const n = nivelDeSigno(campo, valor, ctx)
  if (n === 'critico') return { color: 'var(--red)', fontWeight: 700 }
  if (n === 'aviso') return { color: 'var(--amber)' }
  return {}
}

/** La sistólica de un «120/80». Sin ella no se puede colorear la tensión. */
function sistolicaDe(ta?: string): number | undefined {
  if (!ta) return undefined
  const n = parseInt(String(ta).split('/')[0], 10)
  return Number.isFinite(n) ? n : undefined
}

export default function EpisodioPage() {
  const { internamientoId } = useParams<{ internamientoId: string }>()
  const router = useRouter()
  const volver = useSmartBack('/hospitalizacion')
  const { clinicId, role: memberRole } = useClinic()
  // El rol del hospital DERIVA del rol real del usuario (clinic_members), no es
  // un botón libre. Médico/admin pueden cambiar de vista; el resto queda fijo.
  const rolReal: RolHospital = memberRole === 'enfermeria' ? 'enfermeria' : memberRole === 'farmacia' ? 'farmacia' : memberRole === 'laboratorio' ? 'laboratorio' : memberRole === 'admin' ? 'admin' : 'medico'
  const puedeCambiarRol = memberRole === 'medico' || memberRole === 'admin'
  const { config } = useConfig()
  const { toast, confirm } = useToast()

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
  /** Importar signos del monitor por HL7 (v891/v893). Con el clínico en medio. */
  const [modalHl7, setModalHl7] = useState(false)
  const [hl7Texto, setHl7Texto] = useState('')
  const [hl7Previo, setHl7Previo] = useState<{
    signos: Record<string, unknown>; medidoEn: string | null
    descartados: { codigo: string; motivo: string }[]
  } | null>(null)
  const [hl7Cargando, setHl7Cargando] = useState(false)
  const [respondiendo, setRespondiendo] = useState<string | null>(null)  // icId
  const [icEditId, setIcEditId] = useState<string | null>(null)          // interconsulta en edición
  const [indEditId, setIndEditId] = useState<string | null>(null)        // indicación en edición
  const [administrando, setAdministrando] = useState<string | null>(null) // indId
  const [busy, setBusy] = useState(false)

  // formularios de los modales
  const [egr, setEgr] = useState<{ tipo: TipoEgreso; resumen: string }>({ tipo: 'mejoria', resumen: '' })
  const [icForm, setIcForm] = useState({ especialidad: ESPECIALIDADES_IC[0], motivo: '', medicoSolicitadoId: '' })
  const [doctores, setDoctores] = useState<Doctor[]>([])
  const [respTxt, setRespTxt] = useState('')
  const [indForm, setIndForm] = useState<{ tipo: TipoIndicacion; descripcion: string; dosis: string; via: string; frecuencia: string }>({ tipo: 'medicamento', descripcion: '', dosis: '', via: '', frecuencia: '' })
  const [medQuery, setMedQuery] = useState('')
  const [admNota, setAdmNota] = useState('')
  const [sg, setSg] = useState<{ ta: string; fc: string; fr: string; temp: string; spo2: string; glucosa: string; dolor: string; conciencia: 'A' | 'C' | 'V' | 'P' | 'U'; oxigeno: boolean; o2Flujo: string; o2FiO2: string }>({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '', conciencia: 'A', oxigeno: false, o2Flujo: '', o2FiO2: '' })
  /**
   * id del registro que se está CORRIGIENDO (null = captura nueva).
   *
   * Decisión del médico dueño (29-jul-2026): un signo vital se corrige siempre,
   * sin ventana de tiempo, pero conservando el historial. Por eso corregir no
   * edita ni borra: anexa un registro con `corrigeA` y `proyectarSignos` resuelve
   * la cadena al pintar. Antes el único camino que ofrecía la pantalla era un
   * bote de basura que las reglas de Firestore rechazan siempre.
   */
  const [corrigiendoId, setCorrigiendoId] = useState<string | null>(null)
  /**
   * POR QUÉ SE CORRIGE, Y CUÁNDO SE MIDIÓ DE VERDAD.
   *
   * `RegistroSignos` declara `motivoCorreccion` («por qué se corrigió») y
   * `fechaEfectiva` («cuándo OCURRIÓ la medición; una corrección hereda la del
   * original»), los dos con su decisión escrita detrás — E0-09/Q4 e ICU-Q3. Y
   * este formulario **no escribía ninguno de los dos**.
   *
   * Consecuencias, las dos reales:
   *
   *  · el expediente registraba que un signo vital cambió y NUNCA por qué. En
   *    una revisión —o en un juicio— un valor corregido sin justificación es
   *    exactamente lo que se pregunta;
   *  · y la corrección de las 08:03 de un signo tomado a las 08:00 se guardaba
   *    con la hora de la corrección, así que un NEWS2 retrospectivo de las 08:00
   *    no la encontraba. Es, palabra por palabra, el fallo que ICU-002b añadió
   *    esos campos para reparar: se añadieron al tipo y nadie los escribió.
   */
  const [motivoCorr, setMotivoCorr] = useState('')
  /** Hora de medición del registro que se corrige, para heredarla. */
  const [medidoOriginal, setMedidoOriginal] = useState<string | null>(null)
  /**
   * true cuando el registro que se corrige guardaba la conciencia en el formato
   * heredado 'alterada', que NO equivale a un solo nivel ACVPU: puede ser C, V, P
   * o U. Elegir uno por el clínico sería inventar un dato clínico, así que el
   * formulario avisa y obliga a re-seleccionarlo. ('alerta' sí es sinónimo exacto
   * de 'A' y se traduce sin preguntar.)
   */
  const [concienciaSinMapeo, setConcienciaSinMapeo] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [labs, setLabs] = useState<SolicitudLab[]>([])
  const [modalLab, setModalLab] = useState(false)
  const [labSel, setLabSel] = useState<string[]>([])
  const [labPrioridad, setLabPrioridad] = useState<'rutina' | 'urgente'>('rutina')
  const [labExtra, setLabExtra] = useState('')
  const [cargandoRes, setCargandoRes] = useState<SolicitudLab | null>(null)  // orden a la que se le cargan resultados
  const [resForm, setResForm] = useState<ResultadoLab[]>([])
  /** De qué solicitud son los valores que hay en `resForm` ahora mismo. */
  const resSolicitudRef = useRef<string | null>(null)
  const [modalImport, setModalImport] = useState(false)
  const [importTxt, setImportTxt] = useState('')
  const [modalConcil, setModalConcil] = useState(false)
  const [medsCasa, setMedsCasa] = useState('')
  // Sello de la conciliación tal como se cargó: se manda al guardar para que el
  // servidor rechace si alguien más la actualizó en medio (bloqueo optimista).
  const [conciliadoAlVisto, setConciliadoAlVisto] = useState<string | null>(null)
  const [modalTraslado, setModalTraslado] = useState(false)
  /**
   * La historia de camas del episodio. Se lee al abrir el traslado, que es
   * cuando importa: si falla, el modal sigue siendo usable y simplemente no se
   * enseña —no se afirma que el paciente no haya estado en ninguna otra cama—.
   */
  const [camas, setCamas] = useState<BedAssignment[]>([])
  useEffect(() => {
    if (!modalTraslado || !clinicId || !internamientoId) return
    let vivo = true
    getAsignacionesCama(clinicId, internamientoId)
      .then(a => { if (vivo) setCamas(a) })
      .catch(() => { /* sin historia visible, no una historia inventada */ })
    return () => { vivo = false }
  }, [modalTraslado, clinicId, internamientoId])
  // Los indicadores del episodio necesitan el TIPO de cada unidad. Sin unidades
  // configuradas se usa el catálogo de fábrica y el tiempo sin clasificar se
  // declara aparte: nunca se reparte entre los demás tipos.
  const [unidades, setUnidades] = useState<Unidad[]>([])
  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    getUnidades(clinicId).then(u => { if (vivo) setUnidades(u) }).catch(() => { /* catálogo */ })
    return () => { vivo = false }
  }, [clinicId])
  const [trForm, setTrForm] = useState({ servicio: '', cama: '', tratante: '' })
  const [correctos, setCorrectos] = useState({ paciente: false, medicamento: false, dosis: false, via: false, hora: false })
  const [folioScan, setFolioScan] = useState('')

  const cargar = async () => {
    if (!clinicId || !internamientoId) return
    const i = await getInternamiento(clinicId, internamientoId)
    setInter(i)
    if (i) {
      // getPatient (una lectura) en vez de getPatients (colección entera) solo para
      // resolver el nombre del paciente internado — mismo anti-patrón que la consulta corrigió.
      const [todas, sgs, pac, labsE] = await Promise.all([
        getNotas(clinicId, i.pacienteId).catch(() => [] as NotaMedica[]),
        getSignos(clinicId, internamientoId).catch(() => [] as RegistroSignos[]),
        getPatient(clinicId, i.pacienteId).catch(() => null),
        getSolicitudesLabDeEpisodio(clinicId, internamientoId).catch(() => [] as SolicitudLab[]),
      ])
      setLabs(labsE)
      setNotas(todas.filter(n => n.internamientoId === internamientoId))
      setSignos(sgs)
      setPatient(pac ?? null)
      setMedsCasa((i.medicamentosCasa ?? []).join('\n'))
      setConciliadoAlVisto(i.conciliadoAl ?? null)
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [clinicId, internamientoId])
  // Catálogo de médicos del consultorio → para dirigir la interconsulta a uno
  // concreto y que le llegue el WhatsApp a su teléfono.
  useEffect(() => {
    if (!clinicId) return
    getDoctors(clinicId).then(ds => setDoctores(ds.filter(d => d.activo !== false))).catch(() => {})
  }, [clinicId])
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
  /**
   * Signos con la cadena de correcciones resuelta. `proyectarSignos` no descarta
   * ni un registro: devuelve todos marcando cuál quedó corregido por cuál, para
   * que la tabla pueda tachar el erróneo sin borrarlo del expediente.
   */
  const proyeccionSignos = useMemo(() => proyectarSignos(signos), [signos])
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

  /**
   * NEWS2 — QUÉ SE PUNTÚA Y CÓMO SE LLAMA (decisión ICU-Q4.1 del Dr).
   *
   * Antes se tomaba el último registro, se puntuaba y se enseñaba el número. Si
   * esa toma estaba a medias, la cabecera decía «NEWS2 2» en verde: el aviso de
   * score incompleto viajaba sólo en el `title`, que en un teléfono nadie ve. Es
   * la subestimación del deterioro que el score existe para evitar.
   *
   * `encuadrarNews2` decide cuál registro se puntúa y con qué encuadre —«NEWS2»
   * cuando la toma está completa, «Último NEWS2 válido · 08:00» cuando no— sin
   * rellenar nunca una variable ausente con historia. La fórmula no cambia.
   */
  const ultimoSignos = signos.length ? signos[signos.length - 1] : null
  const encuadre = useMemo(
    () => encuadrarNews2(signos, new Date().toISOString()),
    [signos],
  )
  const news2 = useMemo(() => {
    const r = encuadre.registro
    return r ? calcularNews2({ fr: r.fr, spo2: r.spo2, temp: r.temp, ta: r.ta, fc: r.fc, conciencia: r.conciencia, oxigeno: r.oxigeno }) : null
  }, [encuadre])
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
  const dispararAlerta = async (
    a: Omit<AlertaHospital, 'id' | 'leida' | 'fecha'>,
    // Destino opcional: por defecto el médico tratante. En interconsultas se
    // dirige al médico SOLICITADO (doctorId → su teléfono en el catálogo) o, al
    // responder, al médico SOLICITANTE (destinatarioUid → hospital_roles).
    target?: { destinatarioUid?: string; doctorId?: string; destinatarioNombre?: string },
  ) => {
    if (!clinicId) return
    const destinatarioUid = target?.destinatarioUid ?? inter?.medicoTratanteId
    const destinatarioNombre = target?.destinatarioNombre ?? inter?.medicoTratanteNombre
    const conDest: Omit<AlertaHospital, 'id' | 'leida' | 'fecha'> = { ...a, destinatarioUid, destinatarioNombre }
    /**
     * UNA ALERTA CRÍTICA QUE NO SALE TIENE QUE DECIRLO.
     *
     * Antes: `catch { }` vacío al registrarla, y `.catch(() => {})` descartando la
     * respuesta ENTERA del envío. El endpoint contesta `{ ok:true, enviado:false,
     * motivo:'sin-telefono' }` cuando nadie tiene teléfono registrado —que es el
     * estado por defecto de una clínica recién configurada— y la pantalla mostraba
     * igual su toast verde de éxito.
     *
     * Traducido: laboratorio carga un potasio de 7.2, se marca crítico, sale
     * "Resultados cargados" en verde, no se manda ningún WhatsApp y el médico
     * tratante nunca se entera. El fallo del canal de alertas es justo el que no
     * puede ser silencioso.
     */
    try {
      await crearAlerta(clinicId, conDest)
    } catch (e) {
      console.error('[hospital] no se pudo registrar la alerta:', e)
      toast('La alerta NO se pudo registrar en el expediente. Avisa al médico tratante por otra vía.', 'error')
    }
    try {
      const res = await fetchAutenticado('/api/hospital/alerta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, destinatarioUid, doctorId: target?.doctorId, mensaje: `🏥 ${a.titulo}\n${a.detalle}\nPaciente: ${a.pacienteNombre}` }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || j?.enviado === false) {
        const motivo = j?.motivo === 'sin-telefono'
          ? 'nadie tiene teléfono registrado para recibirlas'
          : j?.motivo === 'whatsapp-no-disponible'
            ? 'WhatsApp no está configurado en el consultorio'
            : (j?.motivo ?? 'error de envío')
        toast(`Alerta registrada, pero NO se envió el aviso: ${motivo}. Avisa al médico por otra vía.`, 'error')
      }
    } catch (e) {
      console.error('[hospital] no se pudo enviar la alerta:', e)
      toast('No se pudo enviar el aviso de la alerta. Avisa al médico tratante por otra vía.', 'error')
    }
  }

  // Imprimir brazalete con código de barras (BCMA)
  const imprimirBrazalete = () => {
    if (!inter) return
    // XSS almacenado (auditoría P2): servicio/cama/nombre son texto libre y se
    // inyectan en document.write. Escapar TODO el HTML, no solo '<' del nombre.
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
    const folio = internamientoId.slice(-8).toUpperCase()
    const svg = code39Svg(folio, { height: 60 })
    const w = window.open('', '_blank', 'width=520,height=300')
    if (!w) return
    w.document.write(`<html><head><title>Brazalete</title></head><body style="font-family:Arial,sans-serif;margin:0;padding:16px;">
      <div style="border:1px solid #000;border-radius:8px;padding:12px 16px;max-width:420px;">
        <div style="font-size:18px;font-weight:bold;">${esc(inter.pacienteNombre)}</div>
        <div style="font-size:12px;color:#333;margin:2px 0 8px;">${esc(inter.servicio)}${inter.cama ? ' · Cama ' + esc(inter.cama) : ''} · Ingreso ${new Date(inter.fechaIngreso).toLocaleDateString('es-MX')}</div>
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
      <Button variant="secondary" onClick={volver}>Volver al censo</Button>
    </div>
  )
  const egresado = inter.estado === 'egresado'
  const indicaciones = inter.indicaciones ?? []
  const interconsultas = inter.interconsultas ?? []

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
          <ArrowLeft size={15} /> Atrás
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
            {news2 && <button onClick={() => setTab('signos')} title={encuadre.aviso || news2.recomendacion} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 100, border: `1px solid ${news2.color}`, background: news2.color + '1f', color: news2.color, cursor: 'pointer' }}><HeartPulse size={13} /> {encuadre.etiqueta} {news2.total}{encuadre.encuadre !== 'actual' && <AlertTriangle size={12} className="ds-icon" />}</button>}
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

      {/* Banner de ALERGIAS — visible en TODO momento del internamiento (seguridad
          del paciente). Antes las alergias solo entraban al CDS al PRESCRIBIR; el
          resto del equipo (enfermería que administra, quien prescribe a mano) no
          las veía. Rojo si hay; ámbar si no hay registro (no asumir "sin alergias"). */}
      {(() => {
        const raw = patient?.alergias
        const lista = Array.isArray(raw)
          ? raw.map(a => String(a).trim()).filter(Boolean)
          : (raw ? String(raw).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [])
        const negadas = lista.length === 1 && /^(no|niega|ninguna|sin)\b/i.test(lista[0])
        if (lista.length && !negadas) {
          return (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--red) 45%, transparent)', background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>ALERGIAS:</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{lista.join(' · ')}</span>
            </div>
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text3)' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5 }}>{negadas ? 'Alergias negadas por el paciente.' : 'Sin alergias registradas — verifícalo antes de prescribir.'}</span>
          </div>
        )
      })()}

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
            <Button variant="secondary" icon={<Activity size={15} />} onClick={() => router.push(`/uci?internamiento=${internamientoId}`)}>Panel UCI</Button>
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
            {(() => {
              // Los traslados guardan «Origen · Cama X → Destino · Cama Y».
              // El destino es lo que hay tras la flecha, antes del « · Cama».
              const movs = inter.movimientos!.filter(m => m.tipo === 'traslado').map(m => ({
                fecha: m.fecha,
                servicioDestino: (m.detalle.split('→')[1] ?? '').split('·')[0].trim(),
              })).filter(m => m.servicioDestino !== '')
              const inicial = (inter.movimientos!.find(m => m.tipo === 'traslado')?.detalle.split('→')[0] ?? '')
                .split('·')[0].trim() || inter.servicio
              const tramos = tramosDeEpisodio(inter.fechaIngreso, movs, inicial)
              const fin = inter.fechaEgreso ?? new Date().toISOString()
              const ind = indicadoresEpisodio(tramos, unidades, fin)
              const rein = reingresosACritica(tramos, unidades)
              const filas = Object.entries(ind.horasPorTipo)
                .sort((a, b) => b[1] - a[1])
              if (filas.length === 0 && ind.horasSinClasificar === 0) return null
              return (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text3)', marginBottom: 6 }}>
                    Estancia por tipo de unidad
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {filas.map(([tipo, horas]) => (
                      <span key={tipo} style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                        {TIPO_UNIDAD_LABEL[tipo as keyof typeof TIPO_UNIDAD_LABEL]}:{' '}
                        <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{enDias(horas)} d</strong>
                      </span>
                    ))}
                  </div>
                  {rein.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 7, lineHeight: 1.55 }}>
                      Reingresó a cuidados críticos {rein.length === 1 ? 'una vez' : `${rein.length} veces`},
                      tras {rein.map(r => `${Math.round(r.horasFuera)} h`).join(' y ')} fuera.
                      Si eso cuenta como reingreso temprano lo define su unidad: el sistema no fija la ventana.
                    </div>
                  )}
                  {ind.horasSinClasificar > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 7, lineHeight: 1.55 }}>
                      {enDias(ind.horasSinClasificar)} d en servicios sin tipo de unidad
                      ({ind.serviciosSinTipo.join(', ')}). No se reparten entre los demás:
                      sería contar tiempo que no se sabe dónde ocurrió.
                    </div>
                  )}
                </div>
              )
            })()}
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
            {esMedico && !egresado && <Button size="sm" icon={<Plus size={14} />} onClick={() => { setIndEditId(null); setIndForm({ tipo: 'medicamento', descripcion: '', dosis: '', via: '', frecuencia: '' }); setMedQuery(''); setModalInd(true) }}>Nueva indicación</Button>}
          </div>
        </div>
        {/* Conciliación: medicamentos del hogar vs indicaciones activas */}
        {(inter.medicamentosCasa?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)', marginBottom: 6 }}>Conciliación · medicamentos en casa</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(inter.medicamentosCasa ?? []).map((m, i) => {
                const continuado = medsActivos.some(a => a.toLowerCase().includes(m.toLowerCase().split(' ')[0]))
                return <span key={i} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 100, background: continuado ? 'rgba(13,148,136,.12)' : 'color-mix(in srgb, var(--amber) 12%, transparent)', color: continuado ? '#0d9488' : '#d97706', border: `1px solid ${continuado ? 'rgba(13,148,136,.35)' : 'color-mix(in srgb, var(--amber) 35%, transparent)'}` }}>{m}{continuado ? ' · continuado' : ' · revisar'}</span>
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
                        : <div style={{ fontSize: 11, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}><AlertTriangle size={12} /> Pendiente de verificación farmacéutica</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {puedeFarmacia && ind.activa && ind.tipo === 'medicamento' && !ind.verificadaFarmacia && <Button size="sm" variant="secondary" icon={<ShieldCheck size={13} />} onClick={async () => { if (!clinicId) return; await verificarIndicacionFarmacia(clinicId, internamientoId, ind.id, config?.nombreMedico ?? ROL_HOSPITAL_LABEL[rol]); toast('Indicación verificada por farmacia', 'success'); cargar() }}>Verificar</Button>}
                    {puedeEnfermeria && ind.activa && ind.tipo === 'medicamento' && <Button size="sm" variant="secondary" icon={<Syringe size={13} />} onClick={() => { setCorrectos({ paciente: false, medicamento: false, dosis: false, via: false, hora: false }); setAdmNota(''); setFolioScan(''); setAdministrando(ind.id) }}>Administrar</Button>}
                    {/* Editar/Borrar SOLO si nunca se administró (borrador). Una vez con MAR, solo suspender. */}
                    {esMedico && ind.administraciones.length === 0 && !egresado && <button title="Editar" onClick={() => { setIndEditId(ind.id); setIndForm({ tipo: ind.tipo, descripcion: ind.descripcion, dosis: '', via: '', frecuencia: ind.frecuencia ?? '' }); setMedQuery(''); setModalInd(true) }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--text3)' }}><Pencil size={13} /></button>}
                    {esMedico && ind.administraciones.length === 0 && !egresado && <button title="Borrar" onClick={async () => { if (!clinicId || !(await confirm('¿Borrar esta indicación?', { peligro: true, confirmar: 'Borrar' }))) return; try { await borrarIndicacion(clinicId, internamientoId, ind.id); toast('Indicación borrada', 'success'); cargar() } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo borrar', 'error') } }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--text3)' }}><Trash2 size={13} /></button>}
                    {esMedico && <button title={ind.activa ? 'Suspender' : 'Reactivar'} onClick={async () => {
                      if (!clinicId) return
                      // Sin este catch, si la escritura fallaba el médico veía la
                      // tarjeta igual y creía haber suspendido el fármaco, mientras
                      // enfermería lo seguía administrando desde el MAR.
                      try {
                        await suspenderIndicacion(clinicId, internamientoId, ind.id, !ind.activa)
                        toast(ind.activa ? 'Indicación suspendida' : 'Indicación reactivada', 'success')
                        cargar()
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'NO se pudo suspender: sigue activa', 'error')
                      }
                    }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--text3)' }}><Ban size={13} /></button>}
                  </div>
                </div>
                {ind.administraciones.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ind.administraciones.slice(-6).map((a, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.estado === 'administrado' ? <Check size={12} style={{ color: '#0d9488' }} /> : <Ban size={12} style={{ color: 'var(--amber)' }} />}
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
          <div style={{ display: 'flex', gap: 8 }}>
            {/*
              IMPORTAR DEL MONITOR — con el clínico en medio, a propósito.
              El adaptador (v891) ya traduce el HL7 del monitor, pero nadie
              quiere un aparato escribiendo solo en el expediente: se enseña lo
              que se reconoció Y lo que se descartó con su motivo, y una persona
              confirma. Lo que entra queda marcado como IMPORTADO, no como
              escrito por el médico.
            */}
            {puedeEnfermeria && !egresado && (
              <Button size="sm" variant="secondary" icon={<Activity size={14} />} onClick={() => { setHl7Texto(''); setHl7Previo(null); setModalHl7(true) }}>
                Importar del monitor
              </Button>
            )}
            {puedeEnfermeria && !egresado && <Button size="sm" icon={<Plus size={14} />} onClick={() => { setCorrigiendoId(null); setConcienciaSinMapeo(false); setSg({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '', conciencia: 'A', oxigeno: false, o2Flujo: '', o2FiO2: '' }); setModalSignos(true) }}>Registrar signos</Button>}
          </div>
        </div>
        {signos.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Sin registros de signos vitales.</div>
        ) : (<>
          {/* NEWS2 — score de deterioro del último registro */}
          {news2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14, padding: '12px 14px', borderRadius: 12, border: `1px solid ${news2.color}55`, background: news2.color + '12' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: news2.color, lineHeight: 1 }}>{news2.total}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: news2.color, textAlign: 'center' }}>{encuadre.etiqueta} · {news2.riesgo}</span>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                {/*
                  EL ENCUADRE VA ANTES QUE LA RECOMENDACIÓN.

                  Si este número no describe el estado de AHORA, saberlo cambia
                  qué hacer con él. El texto sale de `encuadrarNews2`, que nombra
                  las variables que de verdad faltan — antes decía siempre
                  «(parcial: sin conciencia/O₂)», también cuando lo ausente era la
                  FR y la SpO₂, o sea que le afirmaba al médico algo falso.
                */}
                {encuadre.aviso && (
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--amber)', marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <AlertTriangle size={13} className="ds-icon" style={{ flexShrink: 0, marginTop: 1 }} /> {encuadre.aviso}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 4 }}>{news2.recomendacion}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {news2.detalle.filter(d => d.puntos > 0).map((d, i) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'var(--s2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>{d.param} {d.valor} · +{d.puntos}</span>)}
                </div>
              </div>
            </div>
          )}
          {/* Gráficas de tendencia */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
            <GraficaSignos titulo="Frecuencia cardiaca" unidad="lpm" puntos={serie('fc')} normalMin={60} normalMax={100} color="var(--red)" />
            <GraficaSignos titulo="TA sistólica" unidad="mmHg" puntos={serieSistolica} normalMin={90} normalMax={140} color="#3d5afe" />
            <GraficaSignos titulo="Frecuencia respiratoria" unidad="rpm" puntos={serie('fr')} normalMin={12} normalMax={20} color="#7c3aed" />
            <GraficaSignos titulo="Temperatura" unidad="°C" puntos={serie('temp')} normalMin={36} normalMax={38} color="var(--amber)" />
            <GraficaSignos titulo="SpO₂" unidad="%" puntos={serie('spo2')} normalMin={92} normalMax={100} color="#0d9488" />
            <GraficaSignos titulo="Glucosa" unidad="mg/dL" puntos={serie('glucosa')} normalMin={70} normalMax={180} color="#0ea5e9" />
          </div>
          {/* L6 (decisión del Dr): NEWS2 es la fuente de verdad del deterioro (arriba).
              Las bandas de las gráficas son SOLO rango de referencia visual, NO los
              cortes de NEWS2 (p. ej. NEWS2 da 0 pts con FC 51–90; una FC de 95 sale
              del rango gráfico pero suma solo +1). Son conceptos distintos. */}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -6, marginBottom: 14, lineHeight: 1.4 }}>
            Las bandas son <strong>rango de referencia visual</strong>, no los cortes de NEWS2. El deterioro se evalúa con el <strong>score NEWS2</strong> de arriba (Royal College), no con estas bandas.
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--s2)', color: 'var(--text3)', textAlign: 'left' }}>
                  {['Fecha', 'TA', 'FC', 'FR', 'T°', 'SpO₂', 'O₂', 'Gluc.', 'Dolor'].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                  {puedeEnfermeria && !egresado && <th style={{ padding: '8px 10px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {[...proyeccionSignos.registros].reverse().map(({ registro: s, estado, corrigeA }) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)',
                    // Un registro corregido NO se oculta ni se borra: se muestra
                    // atenuado y tachado, porque el expediente debe conservar lo
                    // que se capturó Y lo que se corrigió.
                    ...(estado === 'corregido' ? { opacity: 0.5, textDecoration: 'line-through' } : {}) }}>
                    {/* La hora que importa en una gráfica de signos es la de la
                        MEDICIÓN, no la de captura: una corrección hecha a las
                        08:03 de un signo tomado a las 08:00 pertenece a las 08:00. */}
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{new Date(s.fechaEfectiva ?? s.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '7px 10px', ...colorSigno('sys', sistolicaDe(s.ta)) }}>{s.ta ?? '—'}</td>
                    <td style={{ padding: '7px 10px', ...colorSigno('fc', s.fc) }}>{s.fc ?? '—'}</td>
                    <td style={{ padding: '7px 10px', ...colorSigno('fr', s.fr) }}>{s.fr ?? '—'}</td>
                    <td style={{ padding: '7px 10px', ...colorSigno('temp', s.temp) }}>{s.temp ?? '—'}</td>
                    <td style={{ padding: '7px 10px', ...colorSigno('spo2', s.spo2, { oxigeno: s.oxigeno }) }}>{s.spo2 ?? '—'}</td>
                    {/*
                      EL OXÍGENO, QUE NO SE ENSEÑABA EN NINGUNA PARTE.

                      Una SpO₂ de 94 respirando aire ambiente y una SpO₂ de 94 con
                      5 L/min son dos pacientes muy distintos, y la tabla los
                      pintaba idénticos. El flujo y la FiO₂ además YA se guardaban
                      —el adaptador del monitor los traduce y el export FHIR los
                      emite— sin que ninguna pantalla los mostrara.

                      «—» es «no se registró», que NO es lo mismo que aire ambiente:
                      por eso son etiquetas distintas.
                    */}
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }} title={textoOxigeno(s).ayuda}>{textoOxigeno(s).texto}</td>
                    <td style={{ padding: '7px 10px' }}>{s.glucosa ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>{s.dolor != null ? `${s.dolor}/10` : '—'}</td>
                    {puedeEnfermeria && !egresado && <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {/* El motivo se ENSEÑA, y su ausencia también: un valor
                          corregido sin justificación es justo lo que se pregunta
                          en una revisión del expediente. */}
                      {corrigeA && <span title={s.motivoCorreccion || 'Corrige a un registro anterior. No se declaró el motivo.'} style={{ fontSize: 10.5, color: s.motivoCorreccion ? 'var(--text3)' : 'var(--amber)', marginRight: 8 }}>corrección{s.motivoCorreccion ? `: ${s.motivoCorreccion}` : ' · sin motivo declarado'}</span>}
                      {/* Corregir, NO borrar. El bote de basura que había aquí llamaba a
                          borrarSignos, que `firestore.rules` rechaza con `allow delete: if false`:
                          la enfermera recibía "No se pudo borrar" SIEMPRE. Ahora se anexa un
                          registro con `corrigeA` — se puede corregir sin límite de tiempo
                          (decisión del médico dueño, 29-jul-2026) y nada se sobrescribe. */}
                      {estado !== 'corregido' && <button title="Corregir este registro (se conserva el original)" onClick={() => {
                        setCorrigiendoId(s.id)
                        // La corrección HEREDA la hora de medición del original
                        // (ICU-Q3): si se guardara con la suya, un NEWS2
                        // retrospectivo de las 08:00 no la encontraría.
                        setMedidoOriginal(s.fechaEfectiva ?? s.fecha)
                        setMotivoCorr('')
                        setSg({ ta: s.ta ?? '', fc: s.fc != null ? String(s.fc) : '', fr: s.fr != null ? String(s.fr) : '', temp: s.temp != null ? String(s.temp) : '', spo2: s.spo2 != null ? String(s.spo2) : '', glucosa: s.glucosa != null ? String(s.glucosa) : '', dolor: s.dolor != null ? String(s.dolor) : '', conciencia: acvpu(s.conciencia), oxigeno: !!s.oxigeno, o2Flujo: s.oxigenoFlujoLpm != null ? String(s.oxigenoFlujoLpm) : '', o2FiO2: s.oxigenoFiO2 != null ? String(s.oxigenoFiO2) : '' })
                        setConcienciaSinMapeo(concienciaExigeReSeleccion(s.conciencia))
                        setModalSignos(true)
                      }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><PencilLine size={13} /></button>}
                    </td>}
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
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: l.estado === 'resultado' ? 'rgba(13,148,136,.15)' : l.prioridad === 'urgente' ? 'color-mix(in srgb, var(--red) 12%, transparent)' : 'color-mix(in srgb, var(--amber) 15%, transparent)', color: l.estado === 'resultado' ? '#0d9488' : l.prioridad === 'urgente' ? '#dc2626' : '#d97706' }}>{l.estado === 'resultado' ? 'Resultado listo' : l.prioridad === 'urgente' ? 'Urgente · pendiente' : 'Pendiente'}</span>
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
                {l.historialResultados && l.historialResultados.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11.5, color: 'var(--text3)', cursor: 'pointer' }}>
                      {l.historialResultados.length} carga{l.historialResultados.length !== 1 ? 's' : ''} anterior{l.historialResultados.length !== 1 ? 'es' : ''} (corregidas)
                    </summary>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {l.historialResultados.slice().reverse().map((h, hi) => (
                        <div key={hi} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>
                            {h.procesadaPor} · {new Date(h.fechaResultado).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {h.resultados.map((r, i) => (
                            <div key={i} style={{ fontSize: 11.5, display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text3)', textDecoration: 'line-through' }}>
                              <span>{r.estudio}</span><span>{r.valor} {r.unidad ?? ''}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {((rol === 'laboratorio' || rol === 'medico') && l.estado !== 'resultado') || (esMedico && l.estado === 'solicitada' && !egresado) ? (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(rol === 'laboratorio' || rol === 'medico') && <Button size="sm" variant="secondary" onClick={() => {
                      /*
                        NO SE REINICIALIZA SI YA HAY ALGO TECLEADO PARA ESTA MISMA
                        SOLICITUD. Antes se rellenaba de vacío en CADA apertura, así
                        que cerrar el diálogo (Escape, o un clic fuera al querer
                        quitar un tooltip) y volver a abrir dejaba en blanco los 14
                        valores de una biometría y una química recién capturados.
                      */
                      const mismaSolicitud = resSolicitudRef.current === l.id
                      const hayCapturado = resForm.some(r => r.valor.trim())
                      if (!mismaSolicitud || !hayCapturado) {
                        setResForm(l.estudios.map(e => ({ estudio: e, valor: '', unidad: '', critico: false })))
                      }
                      resSolicitudRef.current = l.id
                      setCargandoRes(l)
                    }}>Cargar resultados</Button>}
                    {/* Cancelar SOLO mientras esté 'solicitada' (aún no la procesa el laboratorio). */}
                    {esMedico && l.estado === 'solicitada' && !egresado && <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} onClick={async () => { if (!clinicId || !(await confirm('¿Cancelar esta orden de laboratorio?', { peligro: true, confirmar: 'Cancelar orden' }))) return; try { await borrarSolicitudLab(clinicId, l.id); toast('Orden cancelada', 'success'); cargar() } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo cancelar', 'error') } }}>Cancelar orden</Button>}
                  </div>
                ) : null}
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
          {esMedico && !egresado && <Button size="sm" icon={<Send size={14} />} onClick={() => { setIcEditId(null); setIcForm({ especialidad: ESPECIALIDADES_IC[0], motivo: '', medicoSolicitadoId: '' }); setModalIC(true) }}>Solicitar interconsulta</Button>}
        </div>
        {interconsultas.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>Sin interconsultas.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {interconsultas.map(ic => (
              <div key={ic.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{ic.especialidad}{ic.medicoSolicitadoNombre ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}> · para {ic.medicoSolicitadoNombre}</span> : null}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: ic.estado === 'respondida' ? 'rgba(13,148,136,.15)' : 'color-mix(in srgb, var(--amber) 15%, transparent)', color: ic.estado === 'respondida' ? '#0d9488' : '#d97706' }}>{ic.estado === 'respondida' ? 'Respondida' : 'Pendiente'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{ic.motivo}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Solicitó: {ic.solicitanteNombre || '—'} · {new Date(ic.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</div>
                {ic.respuesta && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}><strong>Respuesta:</strong> {ic.respuesta}</div>}
                {esMedico && ic.estado === 'solicitada' && !egresado && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <Button size="sm" variant="secondary" onClick={() => setRespondiendo(ic.id)}>Responder (texto)</Button>
                    {ic.especialidad === 'Infectología' && <Button size="sm" variant="secondary" icon={<Activity size={13} />} onClick={() => nuevaNota('valoracion_inmuno')}>Valoración inmuno</Button>}
                    {/* Borrador (aún sin responder): editable y borrable. */}
                    <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => { setIcEditId(ic.id); setIcForm({ especialidad: ic.especialidad, motivo: ic.motivo, medicoSolicitadoId: ic.medicoSolicitadoId ?? '' }); setModalIC(true) }}>Editar</Button>
                    <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} onClick={async () => { if (!clinicId || !(await confirm('¿Borrar esta interconsulta?', { peligro: true, confirmar: 'Borrar' }))) return; try { await borrarInterconsulta(clinicId, internamientoId, ic.id); toast('Interconsulta borrada', 'success'); cargar() } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo borrar', 'error') } }}>Borrar</Button>
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

      {/* Nueva / editar interconsulta */}
      <Modal open={modalIC} onClose={() => { setModalIC(false); setIcEditId(null) }} title={icEditId ? 'Editar interconsulta' : 'Solicitar interconsulta'}
        footer={<><Button variant="secondary" onClick={() => { setModalIC(false); setIcEditId(null) }}>Cancelar</Button><Button loading={busy} disabled={!icForm.motivo.trim()} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          try {
            const medSol = doctores.find(d => d.id === icForm.medicoSolicitadoId)
            if (icEditId) {
              // Editar borrador (aún no respondida): actualiza sin re-enviar alerta.
              await editarInterconsulta(clinicId, internamientoId, icEditId, {
                especialidad: icForm.especialidad, motivo: icForm.motivo.trim(), medicoSolicitadoId: medSol?.id, medicoSolicitadoNombre: medSol?.nombre,
              })
              toast('Interconsulta actualizada', 'success')
            } else {
              await agregarInterconsulta(clinicId, internamientoId, {
                especialidad: icForm.especialidad, motivo: icForm.motivo.trim(), solicitanteNombre: config?.nombreMedico ?? '',
                solicitanteId: auth.currentUser?.uid, medicoSolicitadoId: medSol?.id, medicoSolicitadoNombre: medSol?.nombre,
              })
              if (inter) await dispararAlerta(
                { internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'interconsulta',
                  titulo: medSol ? `Interconsulta para ${medSol.nombre} (${icForm.especialidad})` : `Nueva interconsulta a ${icForm.especialidad}`,
                  detalle: `${icForm.motivo.trim()}${config?.nombreMedico ? `\nSolicita: ${config.nombreMedico}` : ''}` },
                medSol ? { doctorId: medSol.id, destinatarioNombre: medSol.nombre } : undefined,
              )
              toast(medSol ? `Interconsulta enviada a ${medSol.nombre}` : 'Interconsulta solicitada', 'success')
            }
            setModalIC(false); setIcEditId(null); setIcForm({ especialidad: ESPECIALIDADES_IC[0], motivo: '', medicoSolicitadoId: '' }); cargar()
          }
          catch (e) { toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error') }
          finally { setBusy(false) }
        }}>{icEditId ? 'Guardar cambios' : 'Solicitar'}</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Especialidad</label>
            <select className={inputCls} value={icForm.especialidad} onChange={e => setIcForm(f => ({ ...f, especialidad: e.target.value, medicoSolicitadoId: '' }))}>{ESPECIALIDADES_IC.map(e => <option key={e}>{e}</option>)}</select></div>
          {(() => {
            const opciones = doctores.filter(d => d.especialidad === icForm.especialidad)
            return (
              <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Dirigir a un médico (opcional) — le llega un WhatsApp</label>
                <select className={inputCls} value={icForm.medicoSolicitadoId} onChange={e => setIcForm(f => ({ ...f, medicoSolicitadoId: e.target.value }))}>
                  <option value="">Cualquiera de {icForm.especialidad} · teléfono de guardia</option>
                  {opciones.map(d => <option key={d.id} value={d.id}>{d.nombre}{d.telefono ? '' : ' — sin WhatsApp'}</option>)}
                </select>
                {opciones.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>No hay médicos de {icForm.especialidad} en tu equipo; la alerta irá al teléfono de guardia de la clínica.</div>}
              </div>
            )
          })()}
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Motivo de la interconsulta</label>
            <textarea className={inputCls} rows={3} placeholder="Pregunta clínica concreta" value={icForm.motivo} onChange={e => setIcForm(f => ({ ...f, motivo: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Responder interconsulta */}
      <Modal open={!!respondiendo} onClose={() => setRespondiendo(null)} title="Responder interconsulta"
        footer={<><Button variant="secondary" onClick={() => setRespondiendo(null)}>Cancelar</Button><Button loading={busy} disabled={!respTxt.trim()} onClick={async () => {
          if (!clinicId || !respondiendo) return; setBusy(true)
          try {
            await responderInterconsulta(clinicId, internamientoId, respondiendo, { respuesta: respTxt.trim(), respondidaPor: config?.nombreMedico ?? '' })
            const icResp = (inter?.interconsultas ?? []).find(x => x.id === respondiendo)
            if (inter && icResp?.solicitanteId) await dispararAlerta(
              { internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'resultado',
                titulo: `Interconsulta de ${icResp.especialidad} respondida`,
                detalle: `${config?.nombreMedico ?? 'El especialista'}: ${respTxt.trim()}` },
              { destinatarioUid: icResp.solicitanteId, destinatarioNombre: icResp.solicitanteNombre },
            )
            toast('Interconsulta respondida', 'success'); setRespondiendo(null); setRespTxt(''); cargar()
          }
          catch (e) {
            // El texto NO se limpia si falló: se conserva para reintentar, y así
            // tampoco se arrastra a la siguiente interconsulta.
            toast(e instanceof Error ? e.message : 'NO se guardó la respuesta. El texto sigue aquí, reintenta.', 'error')
          }
          finally { setBusy(false) }
        }}>Guardar respuesta</Button></>}>
        <textarea className={inputCls} rows={5} placeholder="Impresión y recomendaciones" value={respTxt} onChange={e => setRespTxt(e.target.value)} />
      </Modal>

      {/* Nueva / editar indicación (medicamento con catálogo buscable = CPOE estructurado) */}
      <Modal open={modalInd} onClose={() => { setModalInd(false); setMedQuery(''); setIndEditId(null) }} title={indEditId ? 'Editar indicación médica' : 'Nueva indicación médica'}
        footer={<><Button variant="secondary" onClick={() => { setModalInd(false); setMedQuery(''); setIndEditId(null) }}>Cancelar</Button><Button loading={busy} disabled={!indForm.descripcion.trim()} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          const desc = indForm.tipo === 'medicamento'
            ? [indForm.descripcion.trim(), indForm.dosis.trim(), indForm.via.trim()].filter(Boolean).join(' ')
            : indForm.descripcion.trim()
          try {
            if (indEditId) {
              await editarIndicacion(clinicId, internamientoId, indEditId, { tipo: indForm.tipo, descripcion: desc, frecuencia: indForm.frecuencia.trim() })
              toast('Indicación actualizada', 'success')
            } else {
              await agregarIndicacion(clinicId, internamientoId, { tipo: indForm.tipo, descripcion: desc, frecuencia: indForm.frecuencia.trim() || undefined, creadaPor: config?.nombreMedico ?? '' })
              toast('Indicación agregada', 'success')
            }
            setModalInd(false); setIndEditId(null); setIndForm({ tipo: 'medicamento', descripcion: '', dosis: '', via: '', frecuencia: '' }); setMedQuery(''); cargar()
          }
          catch (e) { toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error') }
          finally { setBusy(false) }
        }}>{indEditId ? 'Guardar cambios' : 'Agregar'}</Button></>}>
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
          <Modal open={!!administrando} onClose={() => { setAdministrando(null); setFolioScan(''); setAdmNota('') }} title="Administrar medicamento"
            footer={<><Button variant="secondary" onClick={() => { setAdministrando(null); setFolioScan(''); setAdmNota('') }}>Cancelar</Button>
              <Button variant="secondary" loading={busy} onClick={() => registrar('omitido', false, false)}><Ban size={14} /> Omitido</Button>
              {/* NO se deshabilita en silencio: si faltan correctos, avisa cuáles (antes "no pasaba nada"). */}
              <Button loading={busy} onClick={() => { if (!todos) { toast(`Confirma antes de administrar: ${faltan.join(', ')}`, 'error'); return } /**
                    * Se pasa `identidadOk` y los cinco correctos REALES.
                    *
                    * Antes iba `pacienteOk` —que es true con solo tildar la casilla
                    * "Paciente correcto"— en el campo que el expediente documenta
                    * como "se escaneó/confirmó el brazalete". Bastaba una casilla
                    * para que el registro afirmara una verificación de identidad
                    * que nunca ocurrió, justo en el dato que existe para demostrar
                    * que no hubo error de paciente. Y los cinco correctos se
                    * mandaban como literal `true`.
                    */
                   registrar('administrado', todos, identidadOk) }}><Check size={14} /> Administrar</Button></>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {indAct && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{indAct.descripcion}{indAct.frecuencia ? ` · ${indAct.frecuencia}` : ''}</div>}
              {indAct && !indAct.verificadaFarmacia && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', color: 'var(--amber)' }}>
                  <AlertTriangle size={14} /> Esta indicación NO ha sido verificada por farmacia.
                </div>
              )}
              {/* Escaneo del brazalete (BCMA) */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}><ScanLine size={13} /> Escanea el brazalete del paciente (o teclea el folio)</label>
                <input className={inputCls} placeholder={`Folio: …${folioEsperado}`} value={folioScan} onChange={e => setFolioScan(e.target.value)} autoFocus />
                {folioScan && (identidadOk
                  ? <div style={{ fontSize: 11.5, color: '#0d9488', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={12} /> Identidad verificada</div>
                  : <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> El folio no coincide con este paciente</div>)}
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
              <div style={{ fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 8, color: todos ? '#0d9488' : '#d97706', background: todos ? 'rgba(13,148,136,.1)' : 'color-mix(in srgb, var(--amber) 10%, transparent)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
          try { await guardarMedicamentosCasa(clinicId, internamientoId, meds, conciliadoAlVisto); toast('Conciliación guardada', 'success'); setModalConcil(false); cargar() }
          catch (e) { toast(e instanceof Error ? e.message : 'NO se guardó la conciliación de medicamentos. Reintenta.', 'error') }
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
            // Al reasignar por nombre (texto libre) NO conservamos el uid viejo: quedaría
            // apuntando al médico anterior y las alertas irían a la persona equivocada.
            // Se vacía el id → las alertas caen al teléfono general de la clínica (seguro).
            if (trForm.tratante.trim() && trForm.tratante.trim() !== inter.medicoTratanteNombre) await cambiarTratante(clinicId, internamientoId, { medicoTratanteId: '', medicoTratanteNombre: trForm.tratante.trim(), por })
            toast('Movimiento registrado', 'success'); setModalTraslado(false); cargar()
          } catch (e) {
            // Sin catch, el modal quedaba abierto y sin mensaje: parecía que no pasó
            // nada y el dato clínico simplemente no se guardaba.
            toast(e instanceof Error ? e.message : 'NO se registró el traslado ni el cambio de tratante. Reintenta.', 'error')
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
          {/*
            HISTORIA DE CAMAS. Se escribía y no la leía nadie: `historialCamas`
            estaba probado y sin llamador. Quien traslada necesita ver de dónde
            viene el paciente — y si la primera cama falta, se nota aquí.
          */}
          {camas.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 5 }}>Camas de este episodio</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {historialCamas(camas).map(a => (
                  <li key={a.id} style={{ fontSize: 12, color: 'var(--text3)' }}>
                    <strong style={{ color: 'var(--text)' }}>{a.camaId}</strong>{' · '}
                    {new Date(a.desde).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {a.hasta
                      ? ` → ${new Date(a.hasta).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                      : ' → actual'}
                    {' · '}{a.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--text3)' }}>Los cambios quedan registrados en el historial de movimientos del episodio.</p>
        </div>
      </Modal>

      {/*
        IMPORTAR DEL MONITOR (HL7).
        El adaptador ya traduce; aquí se enseña QUÉ se reconoció y QUÉ se
        descartó con su motivo, y una persona confirma. Nadie quiere un aparato
        escribiendo solo en el expediente — y lo que entra queda marcado como
        importado, no como escrito por el médico.
      */}
      <Modal open={modalHl7} onClose={() => setModalHl7(false)} title="Importar signos del monitor"
        footer={<>
          <Button variant="secondary" onClick={() => setModalHl7(false)}>Cancelar</Button>
          <Button
            loading={busy}
            disabled={!hl7Previo || Object.keys(hl7Previo.signos).length === 0}
            onClick={async () => {
              if (!clinicId || !hl7Previo) return
              setBusy(true)
              try {
                await agregarSignos(clinicId, internamientoId, {
                  ...(hl7Previo.signos as Record<string, never>),
                  // La hora del APARATO, no la de ahora: un mensaje que llegó con
                  // retraso escribiría signos «de ahora» que son de hace dos horas.
                  fecha: hl7Previo.medidoEn ?? new Date().toISOString(),
                  por: `Monitor (importado por ${config?.nombreMedico ?? 'el equipo'})`,
                  fuente: 'dispositivo',
                } as never)
                /**
                 * Y LA ALERTA DE DETERIORO, IGUAL QUE SI SE HUBIERAN TECLEADO.
                 *
                 * v893 trajo los signos del monitor pero NO disparaba el NEWS2:
                 * la vía manual sí lo hace. O sea que unos signos importados
                 * podían entrar con un deterioro dentro y no avisarle a nadie —
                 * y son justo los que llegan sin que una persona los mire.
                 * Un canal nuevo que se salta la alerta del canal viejo es peor
                 * que no tener el canal.
                 */
                const sg2 = hl7Previo.signos as Record<string, unknown>
                const n2 = calcularNews2({
                  ta: typeof sg2.ta === 'string' ? sg2.ta : undefined,
                  fc: typeof sg2.fc === 'number' ? sg2.fc : undefined,
                  fr: typeof sg2.fr === 'number' ? sg2.fr : undefined,
                  temp: typeof sg2.temp === 'number' ? sg2.temp : undefined,
                  spo2: typeof sg2.spo2 === 'number' ? sg2.spo2 : undefined,
                  // Conciencia y O2 no vienen del monitor: NEWS2 ya sabe qué
                  // hacer con lo que falta, y no se inventa un «alerta».
                })
                if (n2 && (n2.riesgo === 'alto' || n2.parametroRojo) && inter) {
                  await dispararAlerta({
                    internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'news2',
                    titulo: `Deterioro clínico — NEWS2 ${n2.total} (${n2.riesgo}) · importado del monitor`,
                    detalle: n2.recomendacion,
                  })
                }
                toast('Signos importados del monitor', 'success')
                setModalHl7(false); cargar()
              } catch (e) {
                toast(e instanceof Error ? e.message : 'No se pudieron guardar los signos importados.', 'error')
              } finally { setBusy(false) }
            }}
          >Guardar en el episodio</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Mensaje HL7 del monitor (ORU^R01)</label>
          <textarea
            className={inputCls} rows={6} value={hl7Texto}
            onChange={e => setHl7Texto(e.target.value)}
            placeholder="MSH|^~\\&|MONITOR|..."
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          <Button size="sm" variant="secondary" loading={hl7Cargando} disabled={!hl7Texto.trim()} onClick={async () => {
            if (!clinicId) return
            setHl7Cargando(true)
            try {
              const r = await fetchAutenticado(`/api/hl7/convertir?clinicId=${encodeURIComponent(clinicId)}&tipo=oru`, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: hl7Texto,
              })
              const d = await r.json().catch(() => ({}))
              if (r.ok && d?.ok) setHl7Previo(d.vitales)
              else { setHl7Previo(null); toast(d?.error || 'No se pudo leer el mensaje HL7.', 'error') }
            } catch {
              setHl7Previo(null); toast('No se pudo leer el mensaje HL7.', 'error')
            } finally { setHl7Cargando(false) }
          }}>Leer mensaje</Button>

          {hl7Previo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)' }}>
                <strong>Se reconoció:</strong>{' '}
                {Object.keys(hl7Previo.signos).length === 0
                  ? <span style={{ color: 'var(--amber)' }}>nada que se pueda guardar</span>
                  : Object.entries(hl7Previo.signos).map(([k, v]) => `${k} ${String(v)}`).join(' · ')}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {hl7Previo.medidoEn
                  ? `Medido por el aparato el ${new Date(hl7Previo.medidoEn).toLocaleString('es-MX')}.`
                  : 'El mensaje no trae la hora del aparato: se guardará con la hora actual.'}
              </div>
              {hl7Previo.descartados.length > 0 && (
                <div style={{ background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No se importó (y por qué):</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {hl7Previo.descartados.map((d, i) => <li key={i}>{d.codigo}: {d.motivo}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Solicitar laboratorio */}
      <Modal open={modalLab} onClose={() => setModalLab(false)} title="Solicitar laboratorio"
        footer={<><Button variant="secondary" onClick={() => setModalLab(false)}>Cancelar</Button><Button loading={busy} disabled={labSel.length === 0 && !labExtra.trim()} onClick={async () => {
          if (!clinicId || !inter) return; setBusy(true)
          const estudios = [...labSel, ...labExtra.split(/[,\n]/).map(s => s.trim()).filter(Boolean)]
          try { await crearSolicitudLab(clinicId, { clinicId, internamientoId, pacienteId: inter.pacienteId, pacienteNombre: inter.pacienteNombre, estudios, prioridad: labPrioridad, solicitadaPor: config?.nombreMedico ?? '', fecha: new Date().toISOString() }); toast('Laboratorio solicitado', 'success'); setModalLab(false); cargar() }
          catch (e) { toast(e instanceof Error ? e.message : 'NO se envió la solicitud de laboratorio. Reintenta.', 'error') }
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
      {/*
        Cerrar CONSERVA lo tecleado (ver el botón «Cargar resultados»): el
        diálogo se cierra pero los valores siguen ahí al volver a abrirlo. Sin
        eso, un Escape tiraba una biometría y una química enteras.
      */}
      <Modal open={!!cargandoRes} onClose={() => setCargandoRes(null)} title="Cargar resultados"
        footer={<><Button variant="secondary" onClick={() => setCargandoRes(null)}>Cerrar (se conserva lo escrito)</Button><Button loading={busy} onClick={async () => {
          if (!clinicId || !cargandoRes || !inter) return; setBusy(true)
          // Respaldo determinista: marca crítico por rango aunque no se haya marcado a mano.
          const resultados = resForm.filter(r => r.valor.trim()).map(r => ({ ...r, critico: r.critico || esCriticoLab(r.estudio, r.valor, r.unidad) }))
          try {
            await cargarResultadosLab(clinicId, cargandoRes.id, resultados, ROL_HOSPITAL_LABEL[rol])
            const criticos = resultados.filter(r => r.critico)
            if (criticos.length) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'lab_critico', titulo: 'Valor de laboratorio CRÍTICO', detalle: criticos.map(c => `${c.estudio}: ${c.valor} ${c.unidad ?? ''}`).join('; ') })
            else await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'resultado', titulo: 'Resultado de laboratorio listo', detalle: cargandoRes.estudios.join(', ') })
            toast('Resultados cargados', 'success'); setCargandoRes(null); cargar()
          } catch (e) {
            // Sin catch, el modal quedaba abierto y sin mensaje: parecía que no pasó
            // nada y el dato clínico simplemente no se guardaba.
            toast(e instanceof Error ? e.message : 'NO se guardaron los resultados de laboratorio. Reintenta.', 'error')
          } finally { setBusy(false) }
        }}>Guardar resultados</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resForm.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr auto', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{r.estudio}</span>
              <input className="rounded-md border px-2 py-1 text-xs bg-transparent" placeholder="valor" value={r.valor} onChange={e => setResForm(f => f.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} />
              <input className="rounded-md border px-2 py-1 text-xs bg-transparent" placeholder="unidad" value={r.unidad ?? ''} onChange={e => setResForm(f => f.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x))} />
              <button type="button" title="Marcar crítico" onClick={() => setResForm(f => f.map((x, j) => j === i ? { ...x, critico: !x.critico } : x))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid ' + (r.critico ? '#dc2626' : 'var(--border)'), background: r.critico ? 'color-mix(in srgb, var(--red) 12%, transparent)' : 'transparent', color: r.critico ? '#dc2626' : 'var(--text3)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{r.critico ? '⚠ crítico' : 'crítico'}</button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Importar resultados de laboratorio desde FHIR */}
      <Modal open={modalImport} onClose={() => setModalImport(false)} title="Importar resultados (HL7 FHIR)"
        footer={<><Button variant="secondary" onClick={() => setModalImport(false)}>Cancelar</Button><Button loading={busy} disabled={!importTxt.trim()} onClick={async () => {
          if (!clinicId || !inter) return; setBusy(true)
          try {
            const { parsearLabsFhir, sujetosDelBundle, verificaSujeto } = await import('@/lib/hospital/fhir-import')
            const resultados = parsearLabsFhir(importTxt)
            if (!resultados.length) { toast('No se encontraron Observations en el FHIR', 'error'); return }
            /**
             * ¿DE QUIÉN son estos resultados?
             *
             * Antes no se preguntaba: se archivaban en el paciente del episodio
             * abierto, y el `subject` del Bundle se descartaba. Pegar el Bundle de
             * otro paciente por tener la pestaña equivocada metía sus laboratorios
             * en este expediente, con mensaje de éxito y sin ningún aviso.
             *
             * No coincide → se BLOQUEA, no se advierte. Sobre resultados de
             * laboratorio se transfunde y se ajusta insulina; un aviso que se
             * puede aceptar de un clic no es una salvaguarda.
             */
            const veredicto = verificaSujeto(sujetosDelBundle(importTxt), { id: inter.pacienteId, nombre: inter.pacienteNombre })
            if (veredicto.veredicto === 'no-coincide') {
              toast(`BLOQUEADO: estos resultados son de ${veredicto.detalle}, no de ${inter.pacienteNombre}. Ábrelos en el episodio correcto.`, 'error')
              return
            }
            /**
             * Sin identificar NO es coincidencia: el Bundle simplemente no dice de
             * quién es. Aquí sí decide una persona, pero viendo el nombre a quien
             * se le van a archivar — que es justo lo que faltaba.
             */
            if (veredicto.veredicto === 'sin-identificar' && !(await confirm(
              `Este archivo no identifica al paciente. Los ${resultados.length} resultados se archivarán en el expediente de ${inter.pacienteNombre}. ¿Es correcto?`
            ))) return
            await crearSolicitudLab(clinicId, { clinicId, internamientoId, pacienteId: inter.pacienteId, pacienteNombre: inter.pacienteNombre, estudios: resultados.map(r => r.estudio), prioridad: 'rutina', solicitadaPor: 'Importación FHIR', fecha: new Date().toISOString() })
              .then(async (id) => { await cargarResultadosLab(clinicId, id, resultados, 'FHIR'); const crit = resultados.filter(r => r.critico); if (crit.length) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'lab_critico', titulo: 'Valor de laboratorio CRÍTICO (FHIR)', detalle: crit.map(c => `${c.estudio}: ${c.valor} ${c.unidad ?? ''}`).join('; ') }) })
            toast(`Importados ${resultados.length} resultados`, 'success'); setModalImport(false); cargar()
          } catch { toast('FHIR inválido', 'error') } finally { setBusy(false) }
        }}>Importar</Button></>}>
        <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6 }}>Pega un Bundle FHIR R4 (o Observations) del laboratorio. Un LIS que hable FHIR (o HL7 v2 convertido) puede empujar aquí.</p>
        <textarea className={inputCls} rows={8} style={{ fontFamily: 'monospace', fontSize: 11 }} placeholder='{ "resourceType": "Bundle", "entry": [ ... ] }' value={importTxt} onChange={e => setImportTxt(e.target.value)} />
      </Modal>

      {/* Registrar signos */}
      <Modal open={modalSignos} onClose={() => { setModalSignos(false); setCorrigiendoId(null); setConcienciaSinMapeo(false); setMotivoCorr(''); setMedidoOriginal(null) }} title={corrigiendoId ? "Corregir signos vitales" : "Registrar signos vitales"}
        footer={<><Button variant="secondary" onClick={() => { setModalSignos(false); setCorrigiendoId(null); setConcienciaSinMapeo(false); setMotivoCorr(''); setMedidoOriginal(null) }}>Cancelar</Button><Button loading={busy} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          const num = (x: string) => x.trim() ? Number(x) : undefined
          try {
            const datos = { fecha: new Date().toISOString(), ta: sg.ta.trim() || undefined, fc: num(sg.fc), fr: num(sg.fr), temp: num(sg.temp), spo2: num(sg.spo2), glucosa: num(sg.glucosa), dolor: num(sg.dolor), conciencia: sg.conciencia, oxigeno: sg.oxigeno || undefined, oxigenoFlujoLpm: sg.oxigeno ? num(sg.o2Flujo) : undefined, oxigenoFiO2: sg.oxigeno ? num(sg.o2FiO2) : undefined, por: config?.nombreMedico ?? '' }
            if (corrigiendoId) {
              /**
               * Una corrección lleva DOS cosas que el formulario no escribía:
               * por qué se corrige, y la hora en que se midió el original.
               * `fecha` sigue siendo la de captura de ESTE documento, tal como
               * declara el tipo — lo que se hereda es `fechaEfectiva`.
               */
              await corregirSignos(clinicId, internamientoId, corrigiendoId, {
                ...datos,
                fechaEfectiva: medidoOriginal ?? datos.fecha,
                fechaRegistro: datos.fecha,
                motivoCorreccion: motivoCorr.trim() || undefined,
              })
            } else await agregarSignos(clinicId, internamientoId, datos)
            // Alerta por deterioro: NEWS2 alto O parámetro individual en rojo (criterio Royal College)
            const n2 = calcularNews2({ ta: sg.ta, fc: num(sg.fc), fr: num(sg.fr), temp: num(sg.temp), spo2: num(sg.spo2), conciencia: sg.conciencia, oxigeno: sg.oxigeno })
            if (n2 && (n2.riesgo === 'alto' || n2.parametroRojo) && inter) await dispararAlerta({ internamientoId, pacienteNombre: inter.pacienteNombre, tipo: 'news2', titulo: `Deterioro clínico — NEWS2 ${n2.total} (${n2.riesgo})`, detalle: n2.recomendacion })
            toast(corrigiendoId ? 'Corrección registrada — el original se conserva' : 'Signos registrados', 'success'); setModalSignos(false); setCorrigiendoId(null); setConcienciaSinMapeo(false); setMotivoCorr(''); setMedidoOriginal(null); setSg({ ta: '', fc: '', fr: '', temp: '', spo2: '', glucosa: '', dolor: '', conciencia: 'A', oxigeno: false, o2Flujo: '', o2FiO2: '' }); cargar()
          } catch (e) {
            // Sin catch, el modal quedaba abierto y sin mensaje: parecía que no pasó
            // nada y el dato clínico simplemente no se guardaba.
            toast(e instanceof Error ? e.message : 'NO se guardaron los signos vitales. Reintenta.', 'error')
          } finally { setBusy(false) }
        }}>Guardar</Button></>}>
        {/*
          POR QUÉ SE CORRIGE — sólo al corregir, nunca al capturar.

          El expediente registraba que un signo vital cambió y nunca por qué. No
          se BLOQUEA el guardado si se deja vacío: si el motivo es obligatorio o
          no es política del expediente (E0-09/Q4), y eso lo decide el médico
          dueño, no esta pantalla. Lo que sí se hace es no callarlo: sin motivo,
          la tabla dirá «sin motivo declarado» en vez de nada.
        */}
        {corrigiendoId && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>¿Por qué se corrige?</label>
            <input className={inputCls} value={motivoCorr} onChange={e => setMotivoCorr(e.target.value)}
              placeholder="Ej.: dedazo al capturar la SpO₂" maxLength={200} />
            {medidoOriginal && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Se guardará con la hora de la medición original ({new Date(medidoOriginal).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}), no con la de ahora.
              </div>
            )}
          </div>
        )}
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
            {/* ACVPU completo (REG: antes solo alerta/alterada → se perdía la letra
                clínica). NEWS2: A=0; C/V/P/U=3 (lo deriva news2.ts). Se guarda la letra. */}
            {/* El registro original guardaba 'alterada', que no equivale a un solo
                nivel ACVPU. No se adivina: se pide re-seleccionar. Ver `acvpu()`. */}
            {concienciaSinMapeo && (
              <div style={{ fontSize: 11.5, color: 'var(--amber)', maxWidth: 320, lineHeight: 1.4, marginTop: 2 }}>
                El registro original decía <strong>&laquo;alterada&raquo;</strong> (formato antiguo), que puede ser C, V, P o U. <strong>Vuelve a elegir el nivel</strong> — no se rellena solo para no suponer.
              </div>
            )}
            <div style={{ display: 'flex', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
              {([
                { c: 'A', label: 'A · Alerta', col: '#0d9488' },
                { c: 'C', label: 'C · Confusión', col: '#d97706' },
                { c: 'V', label: 'V · Voz', col: '#d97706' },
                { c: 'P', label: 'P · Dolor', col: '#dc2626' },
                { c: 'U', label: 'U · No responde', col: '#dc2626' },
              ] as const).map(({ c, label, col }) => (
                <button key={c} type="button" onClick={() => setSg(s => ({ ...s, conciencia: c }))}
                  title={label} className="rounded-full border px-2.5 py-1 text-xs"
                  style={sg.conciencia === c
                    ? { borderColor: col, background: col + '18', color: col, fontWeight: 700 }
                    : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{label}</button>
              ))}
            </div>
          </div>
          <label style={{ fontSize: 12.5, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={sg.oxigeno} onChange={e => setSg(s => ({ ...s, oxigeno: e.target.checked }))} /> Recibe O₂ suplementario
          </label>
          {/*
            CON CUÁNTO. El flujo y la FiO₂ ya se guardaban —el adaptador del
            monitor los traduce desde LOINC y el export FHIR los emite— y no
            había forma de teclearlos ni de verlos. Una SpO₂ de 94 con 5 L/min
            no es la misma SpO₂ de 94 respirando aire.
          */}
          {sg.oxigeno && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)' }}>Flujo (L/min)</label>
                <input className={inputCls} inputMode="decimal" value={sg.o2Flujo} onChange={e => setSg(s => ({ ...s, o2Flujo: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)' }}>FiO₂ (%)</label>
                <input className={inputCls} inputMode="decimal" value={sg.o2FiO2} onChange={e => setSg(s => ({ ...s, o2FiO2: e.target.value }))} />
              </div>
            </div>
          )}
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
