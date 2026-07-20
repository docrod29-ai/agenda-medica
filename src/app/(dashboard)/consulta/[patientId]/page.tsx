'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { sugerenciasPendientes, resolverSugerencias } from '@/lib/expediente/sugerencias-ia'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useBorrador } from '@/context/BorradorContext'
import { useTarea } from '@/context/TareasContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import { getPatients, updatePatient } from '@/lib/firestore'
import { useGrabacionVoz } from '@/hooks/useGrabacionVoz'
import { useGrabacionAudio } from '@/hooks/useGrabacionAudio'
import { useComandoVoz } from '@/hooks/useComandoVoz'
import { ofuscar, desofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'
import { borradoresBloqueados } from '@/lib/mobile/local-drafts'
import { EVENTO_GUARDAR_TODO } from '@/components/AutoLogout'
import { usePorcupineComando, type PicovoiceConfig } from '@/hooks/usePorcupineComando'
import {
  createNota, updateNota, getNota, deleteNota, getUltimasNotasResumen,
} from '@/lib/expediente/firestore'
import { seccionesVacias, requiereSignosVitales, esPreoperatoria, esInmuno } from '@/lib/expediente/templates'
import { sanitizarProsa } from '@/lib/expediente/sanitizar-prosa'
import { limpiarMarkdown } from '@/lib/markdown'
import { MOTORES, type ClaveMotor } from '@/lib/planes-ia'
import { PreopAssessment } from '@/components/PreopAssessment'
import ValoracionInmuno from '@/components/pacientes/ValoracionInmuno'
import { RevisionPanel } from '@/components/RevisionPanel'
import { NerPanel } from '@/components/NerPanel'
import { CorreccionesPanel } from '@/components/CorreccionesPanel'
import { Alert, Modal, Button } from '@/components/ui'
import { fetchAutenticado } from '@/lib/auth-client'

import { calculadorasSugeridas } from '@/lib/expediente/calculadoras'

import { vacunasSegunEdad } from '@/lib/expediente/pediatria'




import { Copiloto } from '@/components/Copiloto'
import { Herramientas } from '@/components/Herramientas'

import type { EntidadesExtraidas } from '@/lib/expediente/medical-ner'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'
import { construirPlanPROA } from '@/lib/expediente/proa'
import { logAudit } from '@/lib/expediente/audit-log'
import { validarNOM004 } from '@/lib/expediente/nom004'
import { generarHashIntegridad, generarHashFirma, HASH_VERSION } from '@/lib/expediente/integrity'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { TipoNota, NotaMedica, NotaSeccion, Diagnostico, Medicamento, SignosVitales } from '@/types/expediente'
import type { Patient } from '@/types'
import { Cie10Autocomplete } from '@/components/Cie10Autocomplete'
import { CobrarModal } from '@/components/CobrarModal'
import { DialogoDiarizado, Section, S } from './consulta-ui'
import {

  ArrowLeft, Mic, Square, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Trash2, Plus, ShieldCheck, Pill, Stethoscope, FileSignature, Headphones,
  Lock, Bug, FlaskConical, Lightbulb, FileText, ChevronDown, ChevronUp, Volume2, BedDouble,
  Scissors, Baby, Calculator, Camera, HeartPulse,
} from 'lucide-react'

/**
 * Los paneles clínicos se cargan SOLO cuando el médico los abre.
 *
 * Estaban importados de forma estática, así que su peso entero (catálogos de
 * fármacos, tablas de la OMS, coeficientes de PREVENT, escalas quirúrgicas)
 * viajaba en el bundle inicial de la consulta aunque la mayoría de las consultas
 * no abra ninguno. Viven detrás de un acordeón: no hay razón para pagarlos por
 * adelantado.
 */
const PanelPediatria = dynamic(() => import('@/components/PanelPediatria').then(m => m.PanelPediatria), { ssr: false })
const PanelGineco = dynamic(() => import('@/components/PanelGineco').then(m => m.PanelGineco), { ssr: false })
const PanelCirugia = dynamic(() => import('@/components/PanelCirugia').then(m => m.PanelCirugia), { ssr: false })
const PanelCardiometabolico = dynamic(() => import('@/components/PanelCardiometabolico').then(m => m.PanelCardiometabolico), { ssr: false })
const PanelPreventivo = dynamic(() => import('@/components/PanelPreventivo').then(m => m.PanelPreventivo), { ssr: false })
const CalculadorasClinicas = dynamic(() => import('@/components/CalculadorasClinicas').then(m => m.CalculadorasClinicas), { ssr: false })
const FotosClinicas = dynamic(() => import('@/components/FotosClinicas').then(m => m.FotosClinicas), { ssr: false })

const TIPOS: TipoNota[] = ['primera_vez', 'seguimiento', 'historia_clinica', 'valoracion_preoperatoria', 'valoracion_inmuno', 'alta_consulta', 'ingreso', 'evolucion', 'egreso', 'nota_postoperatoria', 'nota_anestesia', 'consentimiento']

// Menú de IA: motores que el médico elige por nota (⚡ barato → 💎 máximo).
const MOTORES_UI: { clave: ClaveMotor; emoji: string; nombre: string; creditos: number; desc: string }[] = [
  { clave: 'rapida',   emoji: '⚡', nombre: 'Rápida',   creditos: MOTORES.rapida.creditos,   desc: 'Haiku · seguimiento simple' },
  { clave: 'estandar', emoji: '⭐', nombre: 'Estándar', creditos: MOTORES.estandar.creditos, desc: 'Sonnet + voces · el día a día' },
  { clave: 'maxima',   emoji: '💎', nombre: 'Máxima',   creditos: MOTORES.maxima.creditos,   desc: 'Opus + GPT-5 · caso complejo' },
]

// Especialidades con plantilla de enfoque (deben contener la clave que detecta
// guiaEspecialidad en prompts.ts: cardiolog, pediatr, ginec, interna, urgenc…).
// Agrupadas por tipo de práctica y en orden alfabético dentro de cada grupo:
// en una lista plana hay que recorrerla entera para encontrar la especialidad.
const ESPECIALIDADES_POR_GRUPO: { grupo: string; items: string[] }[] = [
  { grupo: 'Primer contacto', items: ['Medicina Interna', 'Pediatría', 'Urgencias'] },
  { grupo: 'Especialidades médicas', items: [
    'Cardiología', 'Dermatología', 'Endocrinología', 'Gastroenterología', 'Infectología',
    'Nefrología', 'Neumología', 'Neurología', 'Oncología', 'Psiquiatría',
  ] },
  { grupo: 'Especialidades quirúrgicas', items: [
    'Cirugía General', 'Ginecología y Obstetricia', 'Ortopedia y Traumatología',
  ] },
]

export default function ConsultaActivaPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const notaIdParam = searchParams.get('nota')
  const tipoParam = searchParams.get('tipo')          // tipo de nota preseleccionado (p. ej. desde hospitalización)
  const internamientoParam = searchParams.get('internamiento') || undefined  // vínculo con el episodio
  // A dónde REGRESAR: si es nota de hospital, al episodio (Hospitalización); si es
  // de consultorio, al expediente. Así nunca te rebota a la sección equivocada.
  // Si la nota abierta pertenece a un internamiento (aunque el URL no lo traiga),
  // se adopta para que back/contexto sean del EPISODIO, no del expediente.
  const [notaInternamientoId, setNotaInternamientoId] = useState<string | undefined>(undefined)
  const internamientoActivo = internamientoParam || notaInternamientoId
  const esNotaHospital = !!internamientoActivo
  const volverA = esNotaHospital ? `/hospitalizacion/${internamientoActivo}` : `/expediente/${patientId}`
  const { clinicId } = useClinic()
  const borradorMem = useBorrador()  // almacén EN MEMORIA (sobrevive navegación, sin parpadeo)
  // Tarea de "procesar nota con IA" en el almacén reactivo (sobrevive navegación):
  // si te vas mientras procesa, la petición sigue y su resultado se aplica al
  // volver (o en cuanto llega, si ya volviste). Clave por paciente+episodio.
  const procKey = `procesar.${patientId}${internamientoParam ? '.h.' + internamientoParam : ''}`
  const [tareaProc, setTareaProc] = useTarea<{ ejecutando: boolean; resultado?: { data: Record<string, unknown>; tipoActivo: TipoNota; tipoOverride: boolean; ts: number } }>(procKey)
  const resultadoAplicadoRef = useRef(0)
  const { config } = useConfig()
  const { toast, confirm } = useToast()
  const voz = useGrabacionVoz()
  const audio = useGrabacionAudio()
  // 'vivo' = Web Speech (Chrome/Edge desktop) — transcribe en tiempo real
  // 'whisper' = MediaRecorder → /api/expediente/transcribir — funciona en TODOS los dispositivos.
  // FORZADO a conversación completa (médico + paciente): es la única opción por
  // decisión del Dr. No hay toggle a dictado en vivo. (Sin setter → sin var muerta.)
  const [modoVoz] = useState<'vivo' | 'whisper'>('whisper')

  // Cuando termina Whisper, copia el texto a voz.setTranscripcion para reutilizar el flujo de IA
  // y marca para AUTO-PROCESAR (un toque menos: grabar → detener → nota lista).
  const autoProcRef = useRef(false)

  /**
   * LO YA DICTADO NO SE PIERDE AL VOLVER A GRABAR.
   *
   * Los dos efectos de abajo hacían `setTranscripcion(...)` a secas, que
   * REEMPLAZA. `detener()` deja en `audio.transcripcion` solo el ÚLTIMO tramo, así
   * que la segunda grabación borraba la primera:
   *
   *   grabar 5 min → Detener → el paciente añade algo → grabar 30 s → Detener
   *   ⇒ la transcripción pasaba a ser solo esos 30 s, se re-procesaba la nota con
   *     la mitad de la información, y el autoguardado escribía en Firestore una
   *     `transcripcionCruda` sin la primera parte de la consulta.
   *
   * Se pierde el material de origen, que es justo lo que da respaldo legal a la
   * nota. Aquí se guarda lo que había ANTES de empezar a grabar y se antepone.
   */
  const baseTranscripcionRef = useRef('')
  const grabandoPrevioRef = useRef(false)
  useEffect(() => {
    const grabando = audio.estado === 'grabando'
    if (grabando && !grabandoPrevioRef.current) {
      // Flanco de subida: arranca una grabación. Se congela lo que ya había.
      baseTranscripcionRef.current = voz.transcripcion.trim()
    }
    grabandoPrevioRef.current = grabando
  }, [audio.estado, voz.transcripcion])

  /** Antepone lo previo, salvo que el tramo nuevo ya lo contenga. */
  const conBase = useCallback((nuevo: string) => {
    const base = baseTranscripcionRef.current
    if (!base || nuevo.startsWith(base)) return nuevo
    return `${base}\n${nuevo}`
  }, [])

  useEffect(() => {
    if (audio.estado === 'listo' && audio.transcripcion) {
      voz.setTranscripcion(conBase(audio.transcripcion))
      autoProcRef.current = true
    }
  }, [audio.estado, audio.transcripcion, conBase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Texto en vivo del streaming (mientras graba) también va al editor — el médico
  // ve la transcripción aparecer sin esperar al final.
  useEffect(() => {
    if (audio.estado === 'grabando' && audio.transcripcionParcial) {
      voz.setTranscripcion(conBase(audio.transcripcionParcial))
    }
  }, [audio.estado, audio.transcripcionParcial, conBase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detección de audio huérfano de sesión previa (crash recovery)
  const [ofreceRecovery, setOfreceRecovery] = useState(false)
  useEffect(() => {
    if (!patientId) return
    audio.hayRecovery(`consulta-${patientId}`).then(setOfreceRecovery).catch(() => {})
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [patient, setPatient] = useState<Patient | null>(null)
  // Cobro al cerrar la consulta: se ofrece tras firmar; al registrar u omitir → expediente
  const [cobrar, setCobrar] = useState(false)
  const tipoInicial: TipoNota = (tipoParam && TIPOS.includes(tipoParam as TipoNota)) ? (tipoParam as TipoNota) : 'primera_vez'
  const [tipo, setTipo] = useState<TipoNota>(tipoInicial)
  // Especialidad de ESTA nota (la IA la estructura según esto). Default: la del médico.
  const [especialidadNota, setEspecialidadNota] = useState('')
  const especialidadEfectiva = especialidadNota || config?.especialidad || ''
  const [secciones, setSecciones] = useState<NotaSeccion[]>(seccionesVacias(tipoInicial))
  const [signos, setSignos] = useState<SignosVitales>({})

  /**
   * Los campos numéricos se editan como TEXTO para poder teclear el punto decimal
   * (ver el onChange de signos vitales). Aquí se normalizan a número antes de que
   * salgan de la pantalla: a la nota, a Firestore y al copiloto. Un "70.5" que
   * llegara como cadena rompería el IMC y las alertas por umbral.
   */
  const signosNum = useMemo<SignosVitales>(() => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(signos)) {
      if (k === 'ta') { out[k] = v; continue }
      if (v === '' || v === undefined || v === null) continue
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      out[k] = Number.isFinite(n) ? n : undefined
    }
    return out as SignosVitales
  }, [signos])
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])

  // El panel perioperatorio solo estorba en una consulta que no es quirúrgica:
  // se muestra si la nota es de una especialidad quirúrgica, si el tipo de nota
  // lo es (postoperatoria, preanestésica), o si el diagnóstico habla de cirugía.
  // Una herramienta que no aplica al paciente no debe ni aparecer en la barra.
  const esPediatrico = patient?.edad != null && patient.edad < 18
  const esGineco = !patient?.sexo || /^f/i.test(patient.sexo)

  /** Pega un texto en su sección de la nota (crea la sección si no existía). */
  /**
   * Ref de `firmada` porque este callback se crea ANTES de que exista el estado, y
   * lo consumen el Copiloto y todos los paneles de Herramientas.
   */
  const firmadaRef = useRef(false)
  const agregarASeccion = useCallback((key: string, label: string) => (texto: string) => {
    /**
     * UNA NOTA FIRMADA NO SE ENMIENDA POR AQUÍ.
     *
     * El Copiloto y Herramientas se renderizan también con la nota firmada, así
     * que "Agregar a la nota" modificaba `secciones` en pantalla y mostraba
     * "Agregado a la nota ✓" — pero `guardarBorrador` sale temprano si está
     * firmada, así que NADA se guardaba y no se creaba adenda. El médico se
     * quedaba creyendo que había enmendado una nota firmada. Es un engaño
     * medicolegal, no un bug cosmético: la vía legal para corregir una nota
     * firmada es la adenda (NOM-004), y sigue disponible en la pantalla de la nota.
     */
    if (firmadaRef.current) {
      toast('Esta nota ya está firmada. Para corregirla, usa una adenda desde la nota.', 'info')
      return
    }
    setSecciones(prev => {
      const i = prev.findIndex(s => s.key === key)
      const valor = i >= 0 ? `${prev[i].value}\n${texto}` : texto
      return [...prev.filter(s => s.key !== key), { key, label, value: valor }]
    })
    toast('Agregado a la nota ✓', 'success')
  }, [toast])

  const esCasoQuirurgico = useMemo(() => {
    const esp = /cirug|ortopedia|ginecolog|urolog|neurocirug|otorrino|oftalmolog|anestesi/i.test(especialidadEfectiva)
    const tip = /postop|preop|quirurg|anestes|consentimiento/i.test(tipo)
    const dx = diagnosticos.some(d => /cirug|quir[úu]rgic|postoperator|preoperator|hernia|apendic|colecistect|fractura/i.test(d.descripcion))
    return esp || tip || dx
  }, [especialidadEfectiva, tipo, diagnosticos])

  // Contexto y escalas sugeridas: se calculan aquí para poder mostrar en la barra
  // cuántas hay SIN abrir la herramienta.
  const contextoCalc = useMemo(() => [
    ...diagnosticos.map(d => d.descripcion),
    secciones.find(s => /motivo/i.test(s.label) || /motivo/i.test(s.key))?.value ?? '',
  ].filter(Boolean).join(' · '), [diagnosticos, secciones])
  const calcSugeridas = useMemo(() => calculadorasSugeridas(contextoCalc), [contextoCalc])


  // Vacunas atrasadas para la edad: se calcula aquí para que la barra lo avise
  // SIN tener que abrir la herramienta (es lo que no se debe pasar por alto).
  const vacunasAtrasadas = useMemo(() => {
    if (!esPediatrico || patient?.edad == null) return 0
    return vacunasSegunEdad(Math.round(patient.edad * 12)).filter(v => v.estado === 'atrasada').length
  }, [esPediatrico, patient?.edad])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])

  /**
   * Se memoriza aquí y no dentro del componente: al pasarlo como objeto literal
   * en el JSX se creaba uno nuevo en CADA render, el useMemo del Copiloto nunca
   * acertaba y el motor se recalculaba en cada tecla del dictado.
   */
  const entradaCopiloto = useMemo(() => ({
    edad: patient?.edad,
    sexo: patient?.sexo,
    alergias: patient?.alergias,
    diagnosticos: diagnosticos.map(d => ({ descripcion: d.descripcion })),
    medicamentos: medicamentos.map(m => ({ nombre: m.nombre, dosis: m.dosis })),
    // signosNum, no signos: el copiloto compara contra umbrales y calcula IMC.
    // Con el valor en crudo, un "70.5" en texto rompería ambas cosas.
    signos: {
      ta: signosNum.ta, fc: signosNum.fc, fr: signosNum.fr,
      temperatura: signosNum.temperatura, spo2: signosNum.spo2,
      peso: signosNum.peso, talla: signosNum.talla,
    },
  }), [patient?.edad, patient?.sexo, patient?.alergias, diagnosticos, medicamentos, signosNum])
  const [resumen, setResumen] = useState('')
  const [procesando, setProcesando] = useState(false)
  // Rol auto-asignado a cada voz diarizada (Hablante A/B → Médico/Paciente/Acompañante).
  // Lo llena Claude al terminar la diarización; editable en el diálogo.
  const [rolesHablante, setRolesHablante] = useState<Record<string, string>>({})
  // Segunda opinión: un 2º modelo top (GPT-5) revisa la nota de Opus 4.8.
  type Hallazgo = { severidad: string; tema: string; problema: string; sugerencia: string }
  const [verificacion, setVerificacion] = useState<{ modelo: string; hallazgos: Hallazgo[] } | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [planActual, setPlanActual] = useState<'pro' | 'premium' | null>(null)
  // Menú de IA: motor elegido por el médico para esta nota. null = default del plan
  // (Pro → 💎 Máxima, Clínica → ⭐ Estándar). El motor que usó la última nota.
  const [motorSel, setMotorSel] = useState<ClaveMotor | null>(null)
  const [motorUsado, setMotorUsado] = useState<ClaveMotor | null>(null)
  // Provenance de IA para trazabilidad medicolegal (se persiste en la nota).
  const [provenanceIA, setProvenanceIA] = useState<{ modelo?: string; promptVersion?: string; apiVersion?: string; generadoEn?: string } | null>(null)
  const motorEfectivo: ClaveMotor = motorSel ?? (planActual === 'premium' ? 'maxima' : 'estandar')
  // Créditos agotados (tope duro): muestra aviso con comprar más / subir de plan.
  const [sinCreditos, setSinCreditos] = useState<{ usadas: number; limite: number } | null>(null)
  // Modo económico: se agotaron las consultas máximas del mes → esta nota corrió en
  // IA económica (Sonnet 5, sin separación de voces ni 2ª opinión). No bloquea.
  const [modoEco, setModoEco] = useState(false)
  // Análisis basado en evidencia (PubMed: NEJM/JAMA/Cochrane…) + citas reales.
  type ArtEv = { pmid: string; titulo: string; revista: string; anio: string; url: string }
  type PuntoEv = { punto?: string; opcion?: string; dx?: string; sustento?: string; porque?: string; razon?: string; citas?: number[] }
  const [evidencia, setEvidencia] = useState<{ articulos: ArtEv[]; evaluacion: PuntoEv[]; alternativas: PuntoEv[]; diferencial: PuntoEv[]; aviso?: string } | null>(null)
  const [analizandoEv, setAnalizandoEv] = useState(false)
  // Candado de gasto (soft): uso de consultas del mes vs el límite del plan.
  const [usoIA, setUsoIA] = useState<{ usadas: number; limite: number; restantes: number; porcentaje: number; alerta: 'ok' | 'cerca' | 'excedido' } | null>(null)
  const [generandoAnalisis, setGenerandoAnalisis] = useState(false)
  // ── Chat de corrección por IA ──
  const [chatCorr, setChatCorr] = useState<{ rol: 'user' | 'ia'; texto: string }[]>([])
  const [instruccionCorr, setInstruccionCorr] = useState('')
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [snapshotUndo, setSnapshotUndo] = useState<null | { resumen: string; secciones: NotaSeccion[]; diagnosticos: Diagnostico[]; medicamentos: Medicamento[]; signos: SignosVitales }>(null)
  // Material de origen (dictado): colapsado por defecto: NO forma parte de la nota
  const [verFuente, setVerFuente] = useState(false)
  // Red de seguridad local: respaldo de la nota en el navegador (anti-pérdida)
  const [respaldoDisponible, setRespaldoDisponible] = useState(false)
  // NOTA EN TIEMPO REAL: la nota se va armando mientras hablas (cada ~30s).
  const [notaEnVivo] = useState(true)  // SIEMPRE activa (la nota se arma sola al hablar)
  const [estructurandoVivo, setEstructurandoVivo] = useState(false)
  const vivoRef = useRef(false)
  const palabrasEstructuradasRef = useRef(0)
  const transcripcionRef = useRef('')
  // ─── Medical NER (extracción de entidades) ─────────────────────
  const [entidades, setEntidades] = useState<EntidadesExtraidas | null>(null)
  const [nerCargando, setNerCargando] = useState(false)
  const [nerError, setNerError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [firmada, setFirmada] = useState(false)
  useEffect(() => { firmadaRef.current = firmada }, [firmada])
  const [notaId, setNotaId] = useState<string | null>(notaIdParam)
  // Ref síncrona del notaId + cadena de guardados serializada: evita que dos
  // autoguardados creen notas DUPLICADAS (setNotaId es asíncrono).
  const notaIdRef = useRef<string | null>(notaIdParam)
  useEffect(() => { notaIdRef.current = notaId }, [notaId])
  const fallosGuardadoRef = useRef(0)
  const cadenaGuardadoRef = useRef<Promise<unknown>>(Promise.resolve())
  const [preop, setPreop] = useState<{ inputs: Record<string, unknown>; resultados: Record<string, unknown> } | undefined>(undefined)
  // Estudios a solicitar (valoración inmuno → pre-pobla la Orden médica)
  const [estudiosOrden, setEstudiosOrden] = useState<string[]>([])
  // Fase B: bloque auditable de la IA + aprobaciones por campo
  const [extraction, setExtraction] = useState<Record<string, unknown> | undefined>(undefined)
  const [safety, setSafety] = useState<Record<string, unknown> | undefined>(undefined)
  const [aprobados, setAprobados] = useState<Set<string>>(new Set())
  // Fase C: consentimiento del paciente antes de iniciar grabación
  const [consentimiento, setConsentimiento] = useState(false)
  const [modalConsentimiento, setModalConsentimiento] = useState(false)
  const ultimasNotasRef = useRef('')
  const [contextoPrevio, setContextoPrevio] = useState('')

  // Constraints para capturar TODA la conversación (médico + paciente) en el modo
  // Whisper: sin supresión de ruido ni cancelación de eco (borran al paciente),
  // con control de ganancia para levantar su voz.
  const opcionesWhisper = {
    recoveryKey: `consulta-${patientId}`,
    noiseSuppression: false,
    echoCancellation: false,
    autoGainControl: true,
  } as const

  // Arranca el grabador que corresponde al modo seleccionado (no siempre el de voz).
  const arrancarSegunModo = () => {
    if (modoVoz === 'whisper') audio.iniciar(opcionesWhisper)
    else voz.iniciar()
  }

  const iniciarGrabacion = () => {
    if (consentimiento) { voz.iniciar(); return }
    setModalConsentimiento(true)
  }
  const confirmarConsentimiento = () => {
    setConsentimiento(true)
    setModalConsentimiento(false)
    arrancarSegunModo()
  }

  // ── Modo manos libres: "iniciar consulta" / "cerrar consulta" ──────────
  // Pensado para usar el consultorio con las manos ocupadas (o unos lentes con
  // micrófono Bluetooth). Opt-in, con aviso visible mientras escucha.
  const [manosLibres, setManosLibres] = useState(false)
  const grabandoAhora = () => audio.estado === 'grabando' || audio.estado === 'pausado' || voz.grabando
  const iniciarPorVoz = () => {
    if (grabandoAhora()) return               // ya grabando: ignorar
    if (consentimiento) arrancarSegunModo()   // consentimiento ya dado → arranca solo
    else setModalConsentimiento(true)         // 1ª vez de la sesión: un toque de consentimiento (obligatorio)
  }
  const cerrarPorVoz = () => {
    if (audio.estado === 'grabando' || audio.estado === 'pausado') audio.detener()
    else if (voz.grabando) voz.detener()
    // La nota se llena sola cuando la transcripción queda lista (efecto auto-procesar).
  }

  // Config del motor 100% en el dispositivo (Picovoice), si el consultorio lo tiene.
  const [picoConfig, setPicoConfig] = useState<PicovoiceConfig | null>(null)
  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    fetchAutenticado(`/api/voz/comandos-config?clinicId=${clinicId}`)
      .then(async r => { if (!r.ok) return; const j = await r.json(); const p = j.picovoice
        if (vivo && p?.accessKey && p?.keywordIniciarUrl && p?.keywordCerrarUrl) setPicoConfig(p) })
      .catch(() => { /* sin config → modo estándar */ })
    return () => { vivo = false }
  }, [clinicId])

  // On-device tiene prioridad cuando está configurado; si no, Web Speech (nube).
  const onDevice = usePorcupineComando({ activo: manosLibres && !!picoConfig, config: picoConfig, onIniciar: iniciarPorVoz, onCerrar: cerrarPorVoz })
  const cmdVoz = useComandoVoz({ activo: manosLibres && !picoConfig, onIniciar: iniciarPorVoz, onCerrar: cerrarPorVoz })
  const escuchaActiva = picoConfig ? onDevice.escuchando : cmdVoz.escuchando
  const comandoError = picoConfig ? onDevice.error : cmdVoz.error
  const soportaComandos = picoConfig ? onDevice.disponible : cmdVoz.soportado

  // ── Cargar paciente + contexto IA ──────────────────────────────
  useEffect(() => {
    if (!clinicId || !patientId) return
    getPatients(clinicId).then(ps => setPatient(ps.find(p => p.id === patientId) ?? null)).catch(e => console.error('cargar paciente:', e))
    getUltimasNotasResumen(clinicId, patientId)
      .then(r => { ultimasNotasRef.current = r; setContextoPrevio(r) })
      .catch(e => console.error('contexto de visitas previas:', e))  // degrada sin romper la nota
  }, [clinicId, patientId])

  // ── Cargar nota existente (borrador) si viene ?nota= ───────────
  useEffect(() => {
    if (!clinicId || !patientId || !notaIdParam) return
    getNota(clinicId, patientId, notaIdParam).then(n => {
      if (!n) return
      setTipo(n.tipo)
      setSecciones(n.secciones)
      setSignos(n.signosVitales ?? {})
      setDiagnosticos(n.diagnosticos)
      setMedicamentos(n.medicamentos)
      setResumen(n.resumenEjecutivo ?? '')
      setFirmada(n.estado === 'firmada')
      if (n.preop) setPreop(n.preop)
      if (n.iaAuditoria) {
        if (n.iaAuditoria.extraction) setExtraction(n.iaAuditoria.extraction)
        if (n.iaAuditoria.safety) setSafety(n.iaAuditoria.safety)
        if (Array.isArray(n.iaAuditoria.aprobadosPorMedico)) setAprobados(new Set(n.iaAuditoria.aprobadosPorMedico))
        if (n.iaAuditoria.provenance) setProvenanceIA(n.iaAuditoria.provenance)  // conservar al re-guardar
      }
      if (n.transcripcionCruda) voz.setTranscripcion(n.transcripcionCruda)
      if (n.internamientoId) setNotaInternamientoId(n.internamientoId)  // adopta el episodio
    })
  }, [clinicId, patientId, notaIdParam]) // eslint-disable-line

  // ── Cambiar tipo de nota → reset de secciones ──────────────────
  // ── Procesar transcripción con IA ──────────────────────────────
  // El dictado es la FUENTE DE VERDAD: se puede re-proyectar a cualquier
  // modalidad de nota pasando tipoOverride (lo usa cambiarTipo).
  // Segunda opinión (verificación cruzada): manda la nota ya generada a un 2º
  // modelo top (GPT-5) que la revisa por seguridad clínica. No bloquea; si falla,
  // no pasa nada. Los hallazgos se muestran en un panel para que el médico decida.
  const verificarNota = useCallback(async (
    nota: { resumen?: string; secciones?: { titulo: string; contenido: string }[]; diagnosticos?: unknown[]; medicamentos?: unknown[]; signos?: unknown },
    transcripcion: string,
  ) => {
    setVerificando(true)
    try {
      const res = await fetchAutenticado('/api/expediente/verificar-nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nota,
          transcripcion,
          contexto: { edad: patient?.edad, sexo: patient?.sexo, alergias: patient?.alergias },
        }),
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) setVerificacion({ modelo: data.modelo ?? 'IA', hallazgos: data.hallazgos ?? [] })
    } catch { /* silencioso: la segunda opinión es un extra, no bloquea */ }
    finally { setVerificando(false) }
  }, [patient?.edad, patient?.sexo, patient?.alergias])

  // Segunda opinión A DEMANDA (plan Pro): construye la nota desde el estado actual
  // y la manda a verificar. En Premium ya corre sola tras generar.
  const pedirSegundaOpinion = useCallback(() => {
    void verificarNota(
      {
        resumen,
        secciones: secciones.map(s => ({ titulo: s.label, contenido: s.value })),
        diagnosticos, medicamentos, signos: signosNum,
      },
      voz.transcripcion,
    )
  }, [verificarNota, resumen, secciones, diagnosticos, medicamentos, signos, voz.transcripcion])

  // Análisis basado en evidencia: cruza dx + tratamiento contra PubMed y razona
  // con citas reales (NEJM/JAMA/Cochrane…). A demanda (botón).
  const analizarEvidencia = useCallback(async () => {
    // Razona con lo que haya: dx/meds estructurados O el resumen de la nota.
    const resumenTexto = (resumen || secciones.map(s => s.value).filter(Boolean).join('. ')).trim()
    // MOTIVO DE CONSULTA = el problema activo que se atiende HOY → prioriza la búsqueda/análisis.
    const motivo = (secciones.find(s => /motivo/i.test(s.label) || /motivo/i.test(s.key))?.value || '').trim()
    if (diagnosticos.length === 0 && medicamentos.length === 0 && resumenTexto.length < 8 && motivo.length < 4) {
      toast('Primero dicta/estructura la nota (diagnóstico, tratamiento o resumen)', 'info'); return
    }
    setAnalizandoEv(true); setEvidencia(null)
    try {
      const res = await fetchAutenticado('/api/expediente/evidencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosticos: diagnosticos.map(d => ({ descripcion: d.descripcion })),
          medicamentos: medicamentos.map(m => ({ nombre: m.nombre })),
          motivo: motivo.slice(0, 400),
          motor: motorEfectivo,   // Rápida→Haiku, Estándar→Sonnet, Máxima→Opus (el análisis respeta tu elección)
          resumen: resumenTexto.slice(0, 2000),
          contexto: { edad: patient?.edad, sexo: patient?.sexo, alergias: patient?.alergias },
        }),
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) setEvidencia({ articulos: data.articulos ?? [], evaluacion: data.evaluacion ?? [], alternativas: data.alternativas ?? [], diferencial: data.diferencial ?? [], aviso: data._aviso })
      else {
        // Muestra el MOTIVO real (no un toast mudo) y lo deja en consola para diagnóstico.
        console.error('[evidencia] fallo', res.status, data)
        toast(data?.error || `No se pudo analizar (HTTP ${res.status})`, 'error')
      }
    } catch (e) { console.error('[evidencia] excepción', e); toast(`Error de red al analizar (${String(e).slice(0, 60)})`, 'error') }
    finally { setAnalizandoEv(false) }
  }, [diagnosticos, medicamentos, resumen, secciones, motorEfectivo, patient?.edad, patient?.sexo, patient?.alergias, toast])

  // Genera un ANÁLISIS clínico basado en evidencia de ESTE paciente (razonando
  // con PubMed vía el Consultor) y lo AGREGA a la nota como una sección de texto
  // limpio (sin markdown), con sus referencias. Reemplaza el análisis previo.
  const agregarAnalisisANota = useCallback(async () => {
    const resumenTexto = (resumen || secciones.map(s => s.value).filter(Boolean).join('. ')).trim()
    if (diagnosticos.length === 0 && medicamentos.length === 0 && resumenTexto.length < 8) { toast('Primero dicta/estructura la nota', 'info'); return }
    setGenerandoAnalisis(true)
    try {
      const dx = diagnosticos.map(d => d.descripcion).filter(Boolean).join('; ')
      const meds = medicamentos.map(m => m.nombre).filter(Boolean).join('; ')
      const pregunta = `Análisis clínico y plan basado en la MEJOR evidencia, a nivel subespecialista, conciso y sin relleno. Diagnóstico(s): ${dx || '—'}. Tratamiento actual: ${meds || '—'}.${resumenTexto ? ` Resumen del caso: ${resumenTexto.slice(0, 1200)}.` : ''} Evalúa si el tratamiento es el adecuado según la evidencia, señala alternativas si aplica, dosis y puntos de seguridad (interacciones/contraindicaciones). No repitas la historia clínica.`
      const contextoPaciente = `${patient?.nombre ?? ''}, ${patient?.edad ?? '?'} años, ${patient?.sexo ?? '?'}. Alergias: ${patient?.alergias || 'no referidas'}.`
      const res = await fetchAutenticado('/api/consultor-evidencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta, contextoPaciente }),
      })
      const d = await res.json().catch(() => null)
      if (!d?.ok || !d.respuesta) { toast(d?.error || 'No se pudo generar el análisis', 'error'); return }
      let texto = limpiarMarkdown(d.respuesta)
      if (Array.isArray(d.articulos) && d.articulos.length > 0) {
        texto += '\n\nReferencias:\n' + d.articulos.map((a: { titulo: string; revista: string; anio: string; pmid: string }, i: number) =>
          `[${i + 1}] ${a.titulo}. ${a.revista} ${a.anio}. PMID ${a.pmid}`).join('\n')
      }
      setSecciones(prev => {
        const sin = prev.filter(s => s.key !== 'analisis_evidencia')
        return [...sin, { key: 'analisis_evidencia', label: 'Análisis basado en evidencia', value: texto }]
      })
      toast('Análisis de evidencia agregado a la nota ✓', 'success')
    } catch { toast('Sin conexión', 'error') }
    finally { setGenerandoAnalisis(false) }
  }, [diagnosticos, medicamentos, patient?.nombre, patient?.edad, patient?.sexo, patient?.alergias, toast])

  const procesarIA = useCallback(async (tipoOverride?: TipoNota, opts?: { enVivo?: boolean }) => {
    // Una nota firmada es inmutable. El atajo de teclado no comprobaba esto y
    // reescribía en pantalla el contenido de una nota ya firmada: lo que se veía
    // dejaba de coincidir con lo almacenado y con lo que se entregó al paciente.
    if (firmadaRef.current) return
    // enVivo = estructuración EN TIEMPO REAL mientras se graba (silenciosa, sin
    // toasts ni reset de aprobaciones; la nota se va armando sola).
    const enVivo = opts?.enVivo === true
    if (!voz.transcripcion.trim()) { if (!enVivo) toast('No hay transcripción que procesar', 'info'); return }
    if (enVivo && vivoRef.current) return  // ya hay una estructuración en vivo en curso
    const tipoActivo = tipoOverride ?? tipo
    // Si hubo diarización, mandamos el diálogo etiquetado por hablante para que la
    // IA atribuya bien quién dijo qué (médico/paciente). Si no, el texto plano.
    const transcripcionParaIA = audio.utterances.length > 0
      ? audio.utterances.map(u => `${rolesHablante[u.speaker] || `Hablante ${u.speaker}`}: ${u.text}`).join('\n')
      : voz.transcripcion
    if (enVivo) { vivoRef.current = true; setEstructurandoVivo(true) } else { setProcesando(true); setVerificacion(null); setTareaProc({ ejecutando: true }) }
    try {
      const res = await fetchAutenticado('/api/expediente/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripcion: transcripcionParaIA,
          tipo: tipoActivo,
          rapido: enVivo,  // en vivo = modelo rápido/barato; nota final = motor elegido
          motor: enVivo ? undefined : motorEfectivo,  // menú de IA: ⚡/⭐/💎 (o default del plan)
          contexto: {
            // Sin nombre: no aporta nada a estructurar la nota e identifica al
            // titular ante un tercero en el extranjero. Ver buildUserPrompt.
            edad: patient?.edad,
            sexo: patient?.sexo,
            alergias: patient?.alergias,
            notasPrevias: ultimasNotasRef.current,
            especialidad: especialidadEfectiva,
            instruccionesIA: config?.instruccionesIA,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!data) { if (!enVivo) { toast('La IA no respondió correctamente. Tu nota NO se modificó; intenta de nuevo.', 'error'); setTareaProc({ ejecutando: false }) } return }
      if (!data.ok) {
        if (!enVivo) {
          if (data.sinCreditos) {
            setSinCreditos({ usadas: data.usadas ?? 0, limite: data.limite ?? 0 })
            toast('Se acabaron tus consultas con IA del mes', 'error')
          } else {
            toast(data.error === 'ANTHROPIC_API_KEY no configurada en el servidor'
              ? 'Falta configurar la API key de Claude en Vercel'
              : `Error de IA: ${data.error}`, 'error')
          }
          setTareaProc({ ejecutando: false })
        }
        return
      }
      if (!enVivo) {
        setSinCreditos(null); setModoEco(!!data._modoEconomico); if (data._motor) setMotorUsado(data._motor as ClaveMotor)
        if (data._modelo) setProvenanceIA({ modelo: data._modelo as string, promptVersion: data._promptVersion as string, apiVersion: data._apiVersion as string, generadoEn: new Date().toISOString() })
      }  // éxito → limpia aviso; marca modo económico + motor usado + provenance
      const ts = Date.now()  // marca de este resultado (para la recuperación tras navegar)
      // Mapear respuesta a estado.
      // REGLA ANTI-PÉRDIDA: en un "Procesar con IA" normal SOLO se sobreescribe lo
      // que la IA realmente devolvió; NUNCA se borra lo que ya había. Solo al
      // RE-PROYECTAR a otra modalidad (tipoOverride) se parte de plantilla limpia.
      const esPreop = tipoActivo === 'valoracion_preoperatoria'

      if (data.resumenEjecutivo?.trim()) setResumen(sanitizarProsa(data.resumenEjecutivo))
      else if (tipoOverride) setResumen('')

      // La transcripción cruda NUNCA se vuelca dentro de la nota (es material de origen).
      setSecciones(prev => {
        const base = tipoOverride ? seccionesVacias(tipoActivo) : prev
        return base.map(s => {
          const valorIA = data.secciones?.[s.key]
          return (typeof valorIA === 'string' && valorIA.trim()) ? { ...s, value: sanitizarProsa(valorIA) } : s
        })
      })

      const nuevosDx = Array.isArray(data.diagnosticos) ? data.diagnosticos.filter((d: Diagnostico) => d.descripcion) : []
      if (nuevosDx.length > 0 || tipoOverride) setDiagnosticos(nuevosDx)
      const nuevosMed = Array.isArray(data.medicamentos) ? data.medicamentos.filter((m: Medicamento) => m.nombre) : []
      if (nuevosMed.length > 0 || tipoOverride) setMedicamentos(nuevosMed)

      if (data.signosVitales) {
        const sv = data.signosVitales
        // Merge: solo pisa los signos que la IA trae; conserva los demás.
        setSignos(prev => ({
          fc: sv.fc || prev.fc, fr: sv.fr || prev.fr, ta: sv.ta || prev.ta,
          temperatura: sv.temperatura || prev.temperatura, spo2: sv.spo2 || prev.spo2,
          peso: sv.peso || prev.peso, talla: sv.talla || prev.talla,
        }))
      }

      // Bloque auditable (Fase B): guardamos extraction + safety para el panel de revisión
      if (data.extraction) setExtraction(data.extraction)
      if (data.safety) setSafety(data.safety)

      // Si la IA detectó factores de riesgo preoperatorios, los pre-llenamos en el
      // calculador de escalas (RCRI, Caprini, ARISCAT, etc.). El médico solo afina.
      if (data.preopInputs && typeof data.preopInputs === 'object') {
        setPreop(prev => ({
          inputs: { ...(prev?.inputs ?? {}), ...data.preopInputs },
          resultados: prev?.resultados ?? {},
        }))
        if (!enVivo) toast('Factores de riesgo pre-llenados desde el dictado', 'info')
      }
      // Diagnóstico visible: si es preop y las 3 secciones críticas vinieron vacías,
      // alertamos al médico (probable confusión de tipo de nota o respuesta corta de la IA).
      if (!enVivo && esPreop && !data.secciones?.cirugiaPropuesta?.trim() &&
          !data.secciones?.resumenClinico?.trim() &&
          !data.secciones?.laboratorios?.trim()) {
        toast('La IA no pudo estructurar el dictado para preoperatoria. Revisa el material de origen y reintenta.', 'error')
        console.warn('[procesar] Secciones preop vacías. Tipo enviado:', tipoActivo, 'Respuesta:', data)
      }
      if (!enVivo) {
        setAprobados(new Set()) // reset de aprobaciones al nuevo procesamiento
        setVerFuente(false)     // colapsa el material de origen: la nota ya está estructurada
      }

      // Auditoría (Fase F) — no en vivo (sería cada 30s)
      if (!enVivo && clinicId) logAudit({
        evento: 'ia_procesamiento', clinicId, patientId, notaId: notaId ?? undefined,
        medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined,
        meta: { tipo: tipoActivo, transcripcionLen: voz.transcripcion.length },
      })

      // Si la IA externa NO estructuró la nota, el route devuelve fallbackLocal + la
      // causa real (_aviso). Mostramos esa causa en vez de un falso "éxito" verde —
      // así se sabe POR QUÉ falló (HTTP 401, sobrecarga, respuesta vacía, etc.).
      if (data.fallbackLocal || data._aviso) {
        console.warn('[procesar] Fallback local. Causa:', data._causaFallback, '·', data._detalleDebug)
        if (!enVivo) toast(data._aviso || 'La IA no estructuró la nota — se llenó lo básico, revisa todo', 'error')
      } else if (!enVivo) {
        toast('Nota estructurada por IA — revisa campo por campo', 'success')
        setPlanActual(data._plan === 'premium' ? 'premium' : 'pro')
        if (data._uso) setUsoIA(data._uso)
        // Segunda opinión (GPT-5): AUTOMÁTICA en plan Premium; en plan Pro es un
        // botón a demanda (controla el costo). En ambos revisa seguridad clínica.
        if (data._plan === 'premium') {
          const seccionesArr = data.secciones && typeof data.secciones === 'object'
            ? Object.entries(data.secciones).map(([k, v]) => ({ titulo: k, contenido: String(v ?? '') }))
            : []
          void verificarNota(
            { resumen: data.resumenEjecutivo, secciones: seccionesArr, diagnosticos: nuevosDx, medicamentos: nuevosMed, signos: data.signosVitales },
            transcripcionParaIA,
          )
        }
      }
      // Guarda el resultado en la TAREA (sobrevive navegación): el mapeo de arriba
      // ya lo aplicó si seguías aquí (marcamos ts como aplicado para no repetir);
      // si te fuiste, el efecto de recuperación lo aplicará al volver.
      if (!enVivo) {
        resultadoAplicadoRef.current = ts
        setTareaProc({ ejecutando: false, resultado: { data: data as Record<string, unknown>, tipoActivo, tipoOverride: !!tipoOverride, ts } })
      }
    } catch {
      if (!enVivo) { toast('Error al conectar con la IA', 'error'); setTareaProc({ ejecutando: false }) }
    } finally {
      if (enVivo) { vivoRef.current = false; setEstructurandoVivo(false) }
      else setProcesando(false)
    }
  }, [voz.transcripcion, audio.utterances, rolesHablante, tipo, patient, toast, especialidadEfectiva, verificarNota, setTareaProc, motorEfectivo])

  // Comprar recarga de créditos (Stripe pago único). Al pagar, el webhook suma los
  // créditos al mes en curso (agregarCreditosExtra) y vuelve la IA máxima.
  const [comprandoRecarga, setComprandoRecarga] = useState(false)
  const comprarRecarga = useCallback(async () => {
    if (!clinicId) { toast('Falta identificar el consultorio', 'error'); return }
    setComprandoRecarga(true)
    try {
      const res = await fetchAutenticado('/api/stripe/recarga', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, email: auth.currentUser?.email ?? '' }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
      toast(data.error || 'No se pudo abrir la recarga', 'error')
    } catch {
      toast('Error al abrir la recarga', 'error')
    } finally {
      setComprandoRecarga(false)
    }
  }, [clinicId, toast])

  // RECUPERACIÓN tras navegar: si el "Procesar" terminó mientras estabas en otra
  // pantalla (o termina justo al volver), aplica su resultado a la nota. No
  // duplica: si el mapeo en línea ya lo aplicó (mismo ts), se salta.
  useEffect(() => {
    const r = tareaProc?.resultado
    if (!r || r.ts <= resultadoAplicadoRef.current) return
    resultadoAplicadoRef.current = r.ts
    const data = r.data as Record<string, unknown> & {
      resumenEjecutivo?: string; secciones?: Record<string, string>
      diagnosticos?: Diagnostico[]; medicamentos?: Medicamento[]
      signosVitales?: Partial<SignosVitales>; extraction?: unknown; safety?: unknown
    }
    const { tipoActivo, tipoOverride } = r
    if (data.resumenEjecutivo?.trim()) setResumen(sanitizarProsa(data.resumenEjecutivo))
    else if (tipoOverride) setResumen('')
    setSecciones(prev => {
      const base = tipoOverride ? seccionesVacias(tipoActivo) : prev
      return base.map(s => {
        const v = data.secciones?.[s.key]
        return (typeof v === 'string' && v.trim()) ? { ...s, value: sanitizarProsa(v) } : s
      })
    })
    const nuevosDx = Array.isArray(data.diagnosticos) ? data.diagnosticos.filter(d => d.descripcion) : []
    if (nuevosDx.length > 0 || tipoOverride) setDiagnosticos(nuevosDx)
    const nuevosMed = Array.isArray(data.medicamentos) ? data.medicamentos.filter(m => m.nombre) : []
    if (nuevosMed.length > 0 || tipoOverride) setMedicamentos(nuevosMed)
    if (data.signosVitales) {
      const sv = data.signosVitales
      setSignos(prev => ({ fc: sv.fc || prev.fc, fr: sv.fr || prev.fr, ta: sv.ta || prev.ta, temperatura: sv.temperatura || prev.temperatura, spo2: sv.spo2 || prev.spo2, peso: sv.peso || prev.peso, talla: sv.talla || prev.talla }))
    }
    if (data.extraction) setExtraction(data.extraction as typeof extraction)
    if (data.safety) setSafety(data.safety as typeof safety)
    setProcesando(false)
    toast('Tu nota terminó de procesarse mientras navegabas ✓', 'success')
  }, [tareaProc, toast])

  // Auto-procesa UNA vez cuando llega la transcripción final (flujo "Conversación
  // completa"): graba → detén → la nota se estructura sola, sin un toque extra.
  useEffect(() => {
    if (autoProcRef.current && voz.transcripcion.trim() && !procesando && !firmada) {
      autoProcRef.current = false
      procesarIA()
    }
  }, [voz.transcripcion, procesando, firmada, procesarIA])

  // Auto-atribución de roles: al terminar la diarización, Claude decide quién es
  // Médico/Paciente/Acompañante desde el contexto clínico → el diálogo sale
  // etiquetado solo (editable). Si falla, queda el etiquetado manual.
  const rolesPedidosRef = useRef('')
  useEffect(() => {
    const utts = audio.utterances
    if (utts.length === 0 || voz.grabando) return
    const firma = utts.map(u => u.speaker).join('') + ':' + utts.length
    if (rolesPedidosRef.current === firma) return  // ya se pidió para estos turnos
    rolesPedidosRef.current = firma
    ;(async () => {
      try {
        const res = await fetchAutenticado('/api/expediente/atribuir-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ utterances: utts.map(u => ({ speaker: u.speaker, text: u.text })) }),
        })
        const data = await res.json().catch(() => null)
        if (data?.ok && data.roles && Object.keys(data.roles).length > 0) setRolesHablante(data.roles)
      } catch { /* silencioso: el médico puede etiquetar a mano */ }
    })()
  }, [audio.utterances, voz.grabando])

  // ── NOTA EN TIEMPO REAL ────────────────────────────────────────
  // Mientras grabas, cada ~30s re-estructura la nota con lo dicho hasta ese
  // momento (silenciosamente). La nota se va armando sola; al detener se hace
  // la versión final completa. Refs para que el intervalo sea estable.
  const procesarIARef = useRef(procesarIA)
  useEffect(() => { procesarIARef.current = procesarIA }, [procesarIA])
  useEffect(() => { transcripcionRef.current = voz.transcripcion }, [voz.transcripcion])
  useEffect(() => {
    const grabando = voz.grabando || audio.estado === 'grabando'
    if (!grabando || !notaEnVivo || firmada) return
    // Baseline al arrancar: solo dispara con palabras NUEVAS a partir de aquí.
    palabrasEstructuradasRef.current = transcripcionRef.current.trim().split(/\s+/).filter(Boolean).length
    const t = setInterval(() => {
      if (vivoRef.current) return
      const palabras = transcripcionRef.current.trim().split(/\s+/).filter(Boolean).length
      if (palabras - palabrasEstructuradasRef.current >= 18) {   // ~18 palabras nuevas
        palabrasEstructuradasRef.current = palabras
        procesarIARef.current(undefined, { enVivo: true })
      }
    }, 15000)   // revisa cada 15s (antes 30s) → la nota se llena más seguido, sensación "streaming"
    return () => clearInterval(t)
  }, [voz.grabando, audio.estado, notaEnVivo, firmada])

  // Al DETENER el dictado en vivo, estructura la versión FINAL sola — sin que el
  // médico tenga que pulsar "Procesar con IA" (el flujo Whisper ya lo hacía).
  const eraGrabandoVozRef = useRef(false)
  useEffect(() => {
    const acabaDeParar = eraGrabandoVozRef.current && !voz.grabando
    eraGrabandoVozRef.current = voz.grabando
    if (acabaDeParar && modoVoz === 'vivo' && !firmada && voz.transcripcion.trim() && !procesando) {
      procesarIARef.current()
    }
  }, [voz.grabando, modoVoz, firmada, procesando, voz.transcripcion])

  // ── Cambiar la modalidad de nota ───────────────────────────────
  // Si hay dictado, la nota se RE-PROYECTA desde esa fuente hacia la nueva
  // modalidad (primera vez → historia clínica → preop, etc.). El dictado es la
  // fuente de verdad; cada modalidad es una vista estructurada distinta de ella.
  const cambiarTipo = async (t: TipoNota) => {
    if (firmada || t === tipo) return
    const hayDictado = voz.transcripcion.trim().length > 0
    const hayContenido = secciones.some(s => s.value?.trim()) ||
      diagnosticos.length > 0 || medicamentos.length > 0 || resumen.trim().length > 0
    // SIEMPRE confirma si hay algo escrito — cambiar de modalidad vacía las secciones.
    if (hayContenido && !(await confirm(
      hayDictado
        ? `Se reestructurará la nota como "${TIPO_NOTA_LABEL[t]}" desde el dictado. El contenido actual se reemplazará. ¿Continuar?`
        : `Cambiar a "${TIPO_NOTA_LABEL[t]}" vaciará las secciones actuales. ¿Continuar?`
    ))) return
    setTipo(t)
    setSecciones(seccionesVacias(t))
    if (hayDictado) {
      toast(`Re-estructurando como ${TIPO_NOTA_LABEL[t]}…`, 'info')
      procesarIA(t)
    }
  }

  // ── Extraer entidades clínicas (NER) ────────────────────────────
  // Equivalente local a AWS Comprehend Medical. Toma el texto disponible
  // (transcripción + secciones ya redactadas) y extrae condiciones+CIE10,
  // medicamentos+posología, alergias, estudios, procedimientos + cross-check.
  const extraerEntidades = useCallback(async () => {
    // Combina transcripción + lo que ya está redactado en secciones
    const textoFuente = [
      voz.transcripcion,
      ...secciones.map(s => s.value).filter(Boolean),
    ].join('\n\n').trim()
    if (!textoFuente) { toast('No hay texto que analizar todavía', 'info'); return }
    setNerCargando(true); setNerError(''); setEntidades(null)
    try {
      const res = await fetchAutenticado('/api/expediente/extraer-entidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoFuente }),
      })
      const data = await res.json().catch(() => null)
      if (!data || !data.ok) {
        setNerError(data?.error ?? 'No se pudieron extraer entidades')
        toast(`NER: ${data?.error ?? 'error'}`, 'error')
        return
      }
      setEntidades(data as EntidadesExtraidas)
      const bloquea = (data.cross_check?.alergia_vs_medicamento ?? []).filter((c: { BLOQUEA_RECETA: boolean }) => c.BLOQUEA_RECETA).length
      const intGraves = (data.cross_check?.interacciones_farmacologicas ?? []).filter((i: { severidad: string }) => i.severidad === 'mayor' || i.severidad === 'contraindicada').length
      if (bloquea > 0) toast(`${bloquea} alergia(s) cruzada(s) — revisa el panel`, 'error')
      else if (intGraves > 0) toast(`${intGraves} interacción(es) farmacológica(s) detectadas`, 'info')
      else toast('Entidades extraídas — sin conflictos detectados', 'success')
    } catch {
      setNerError('Error de red al llamar al NER')
      toast('Error de red al extraer entidades', 'error')
    } finally {
      setNerCargando(false)
    }
  }, [voz.transcripcion, secciones, toast])

  // ── Construir objeto NotaMedica ────────────────────────────────
  const construirNota = useCallback((estado: 'borrador' | 'firmada'): NotaMedica => {
    const now = new Date().toISOString()
    return {
      id: notaId ?? '',
      clinicId: clinicId!,
      pacienteId: patientId,
      pacienteNombre: patient?.nombre ?? '',
      tipo,
      metadata: {
        id: notaId ?? crypto.randomUUID(),
        tipoNota: tipo,
        clinicId: clinicId!,
        pacienteId: patientId,
        medicoId: auth.currentUser?.uid ?? '',
        cedulaProfesional: config?.cedulaProfesional ?? '',
        especialidad: config?.especialidad ?? '',
        establecimiento: config?.nombreClinica ?? '',
        fechaCreacion: now,
        fechaModificacion: now,
        hashIntegridad: '',
        version: 1,
        estado,
        fuenteGeneracion: voz.transcripcion ? 'ia_voz' : 'manual',
      },
      resumenEjecutivo: resumen,
      secciones,
      signosVitales: signosNum,
      diagnosticos,
      medicamentos,
      /**
       * NO SE INVENTA LO QUE NADIE DIJO.
       *
       * Esto rellenaba `severidad:'moderada'` y `confirmada:true` a partir de un
       * campo de texto libre del expediente. Nadie dijo "moderada" y nadie
       * confirmó nada: una anafilaxia dictada quedaba registrada como moderada, y
       * la nota firmada afirmaba una confirmación que nunca ocurrió. `tipo` se
       * forzaba a 'medicamento', así que "alergia a mariscos" salía tipada como
       * fármaco, y `reaccion` llevaba el texto de plantilla "Ver expediente"
       * dentro de un campo clínico.
       *
       * Se registra el alérgeno tal como está escrito y nada más. Los campos que
       * no se saben quedan ausentes, que es la única representación honesta.
       */
      alergias: patient?.alergias?.trim()
        ? [{ alergeno: patient.alergias.trim() }]
        : [],
      estudiosOrden: estudiosOrden.length ? estudiosOrden : undefined,
      internamientoId: internamientoActivo,
      preop,
      iaAuditoria: extraction || safety ? {
        extraction, safety,
        aprobadosPorMedico: Array.from(aprobados),
        procesadoEn: now,
        aprobadoPor: estado === 'firmada' ? (auth.currentUser?.email ?? '') : undefined,
        // Provenance inmutable: con qué modelo/prompt se generó + revisión humana
        provenance: provenanceIA ? {
          modelo: provenanceIA.modelo,
          motor: motorUsado ?? undefined,
          promptVersion: provenanceIA.promptVersion,
          apiVersion: provenanceIA.apiVersion,
          generadoEn: provenanceIA.generadoEn,
          // La verdad, no una tautología: firmar ya NO cuenta como revisar.
          // No se bloquea firmar sin revisar — a veces la nota está bien y no hay
          // nada que aceptar — pero el expediente registra lo que de verdad pasó.
          revisadoPorHumano: aprobados.size > 0,
          camposAprobados: aprobados.size,
        } : undefined,
      } : undefined,
      transcripcionCruda: voz.transcripcion || undefined,
      dialogoDiarizado: audio.utterances.length > 0 ? audio.utterances : undefined,
      estado,
      fechaConsulta: now,
      createdAt: now,
      updatedAt: now,
      creadoPor: auth.currentUser?.uid ?? '',
    }
  }, [notaId, clinicId, patientId, patient, tipo, config, resumen, secciones, signos, diagnosticos, medicamentos, estudiosOrden, internamientoActivo, preop, extraction, safety, aprobados, voz.transcripcion, audio.utterances])

  // ── Guardar borrador ───────────────────────────────────────────
  // silencioso=true para el autoguardado (no muestra toast)
  const guardarBorrador = useCallback((silencioso = false): Promise<void> => {
    if (!clinicId || firmada) return Promise.resolve()
    // Serializa: cada guardado espera al anterior. Así dos autoguardados no
    // crean la nota dos veces (usa notaIdRef, que es síncrona).
    const tarea = cadenaGuardadoRef.current.then(async () => {
      setGuardando(true)
      try {
        const nota = construirNota('borrador')
        const idActual = notaIdRef.current
        if (idActual) {
          // NOM-024 Art. 6.4: snapshot ANTES de sobrescribir para preservar el historial
          const { guardarVersion } = await import('@/lib/expediente/versioning')
          const { id: _ignore, ...sinId } = nota
          void _ignore
          guardarVersion(clinicId, patientId, idActual, sinId, auth.currentUser?.uid ?? '', auth.currentUser?.email ?? undefined).catch(() => {})
          await updateNota(clinicId, patientId, idActual, nota)
        } else {
          const id = await createNota(clinicId, patientId, nota)
          notaIdRef.current = id   // marca síncrona ANTES de re-render
          setNotaId(id)
        }
        fallosGuardadoRef.current = 0
        if (!silencioso) toast('Borrador guardado', 'success')
      } catch (e) {
        console.error('[consulta] error guardando borrador:', e)
        // El autoguardado siempre iba en silencio. Si fallaba una y otra vez, el
        // médico dictaba una consulta entera creyendo que se estaba guardando y
        // solo quedaba el respaldo local. A partir del tercer fallo seguido se
        // avisa, aunque sea el guardado automático.
        fallosGuardadoRef.current += 1
        if (!silencioso || fallosGuardadoRef.current >= 3) {
          toast(
            fallosGuardadoRef.current >= 3
              ? 'La nota NO se está guardando en el servidor. Hay un respaldo local en este dispositivo: no cierres la pestaña y revisa tu conexión.'
              : 'Error al guardar el borrador',
            'error',
          )
        }
      } finally {
        setGuardando(false)
      }
    })
    cadenaGuardadoRef.current = tarea.catch(() => {})
    return tarea
  }, [clinicId, patientId, firmada, construirNota, toast])

  // ── Descartar borrador ─────────────────────────────────────────
  const descartar = useCallback(async () => {
    if (firmada) return
    const confirmar = await confirm('¿Descartar esta consulta? Se eliminará y no podrás recuperarla.', { peligro: true, confirmar: 'Descartar' })
    if (!confirmar) return
    setGuardando(true)
    try {
      // notaIdRef y NO el estado: si un autoguardado acaba de crear la nota, el
      // estado todavía no se re-renderizó y se saltaba el borrado, dejando una
      // nota huérfana en el expediente. firmar() ya usaba la ref por esto mismo.
      const idReal = notaIdRef.current ?? notaId
      if (clinicId && idReal) {
        await deleteNota(clinicId, patientId, idReal)
      }
      try { localStorage.removeItem(respaldoKey) } catch { /* */ }
      // El espejo EN MEMORIA también: sin esto, la consulta descartada reaparecía
      // completa al abrir "Nueva consulta" del mismo paciente y se recreaba sola
      // en Firestore al autoguardarse.
      borradorMem.borrar(respaldoKey)
      toast('Consulta descartada', 'info')
      router.push(volverA)
    } catch (e) {
      console.error('[consulta] error al descartar:', e)
      toast('Error al descartar', 'error')
      setGuardando(false)
    }
  }, [firmada, clinicId, notaId, patientId, router, toast, confirm])

  // ── Autoguardado cada 30s ──────────────────────────────────────
  useEffect(() => {
    if (firmada) return
    // La condición miraba SOLO `resumen` y las secciones. Mientras el médico
    // DICTA —que es el flujo normal— nada de eso tiene contenido todavía: la
    // consulta vive en la transcripción, los diagnósticos y los medicamentos.
    // Resultado: el autoguardado al servidor NUNCA disparaba durante el dictado y
    // la consulta existía únicamente en el respaldo del navegador. Se usa el mismo
    // criterio de "hay contenido" que el respaldo local, que sí los miraba.
    const hayContenido = () =>
      !!(resumen.trim() || secciones.some(s => s.value?.trim()) ||
         diagnosticos.length || medicamentos.length || voz.transcripcion.trim())
    const t = setInterval(() => { if (hayContenido()) guardarBorrador(true) }, 30000)
    return () => clearInterval(t)
  }, [firmada, resumen, secciones, diagnosticos, medicamentos, voz.transcripcion, guardarBorrador])

  // ── Red de seguridad LOCAL (anti-pérdida): respalda la nota en el navegador
  //    mientras escribes (instantáneo, sobrevive a crashes y a estar sin red). ──
  // Llave por paciente Y por episodio: así el borrador de una nota de
  // HOSPITALIZACIÓN (mismo paciente) no pisa el de la consulta externa.
  const respaldoKey = `nx.consulta.bkp.${patientId}${internamientoActivo ? '.h.' + internamientoActivo : ''}`
  useEffect(() => {
    if (firmada) return
    const hayContenido = resumen.trim() || secciones.some(s => s.value?.trim()) ||
      diagnosticos.length > 0 || medicamentos.length > 0 || voz.transcripcion.trim()
    if (!hayContenido) return
    const id = setTimeout(() => {
      if (borradoresBloqueados()) return   // sesión cerrada: no resucitar PHI
      try {
        localStorage.setItem(respaldoKey, ofuscar(JSON.stringify({
          tipo, resumen, secciones, signos, diagnosticos, medicamentos,
          // notaId: sin él, restaurar el respaldo dejaba notaIdRef en null y el
          // siguiente autoguardado CREABA una segunda nota con el mismo contenido.
          notaId: notaIdRef.current,
          transcripcion: voz.transcripcion, ts: Date.now(),
        }), secretoLocal(auth.currentUser?.uid)))
      } catch { /* almacenamiento lleno: no es crítico */ }
    }, 1500)
    return () => clearTimeout(id)
  }, [firmada, tipo, resumen, secciones, signos, diagnosticos, medicamentos, voz.transcripcion, respaldoKey])

  // Al abrir: si hay respaldo local, RESTÁURALO SOLO (sin que tengas que ver un
  // banner) — salvo que estés abriendo otra nota (?nota=) o que el formulario ya
  // tenga contenido. Así volver de la agenda nunca "pierde" lo que hacías.
  const autoRestRef = useRef(false)
  useEffect(() => {
    if (!patientId || autoRestRef.current) return
    // 1º MEMORIA (instantáneo, sin parpadeo ni aviso): si vienes de otra pantalla,
    //   la nota estaba viva en memoria y se pone tal cual la dejaste.
    // 2º localStorage: respaldo tras recarga/crash (con aviso).
    const mem = borradorMem.leer(respaldoKey) as Record<string, unknown> | null
    let b = mem
    if (!b) {
      try { const raw = localStorage.getItem(respaldoKey); if (raw) { b = JSON.parse(desofuscar(raw, secretoLocal(auth.currentUser?.uid)) ?? raw); setRespaldoDisponible(true) } } catch { /* */ }
    }
    if (!b) return
    const vacio = !resumen.trim() && !secciones.some(s => s.value?.trim()) &&
      diagnosticos.length === 0 && medicamentos.length === 0 && !voz.transcripcion.trim()
    if (notaIdParam || !vacio) return   // abriendo otra nota o ya hay contenido → no pisar
    autoRestRef.current = true
    // Recuperar la nota a la que pertenecía el respaldo: sin esto se creaba una
    // gemela en el expediente y, al firmar una, la otra quedaba huérfana.
    if (typeof b.notaId === 'string' && b.notaId) { notaIdRef.current = b.notaId; setNotaId(b.notaId) }
    if (typeof b.tipo === 'string') setTipo(b.tipo as TipoNota)
    if (Array.isArray(b.secciones)) setSecciones(b.secciones as NotaSeccion[])
    if (typeof b.resumen === 'string') setResumen(b.resumen)
    if (b.signos) setSignos(b.signos as SignosVitales)
    if (Array.isArray(b.diagnosticos)) setDiagnosticos(b.diagnosticos as Diagnostico[])
    if (Array.isArray(b.medicamentos)) setMedicamentos(b.medicamentos as Medicamento[])
    if (typeof b.transcripcion === 'string') voz.setTranscripcion(b.transcripcion)
    setRespaldoDisponible(false)
    if (!mem) toast('Recuperé tu nota sin guardar de este paciente ✓', 'success')  // solo si vino de localStorage
  }, [patientId, respaldoKey, notaIdParam, resumen, secciones, diagnosticos, medicamentos, voz, toast, borradorMem])

  // GUARDADO INMEDIATO al salir (anti-pérdida). El respaldo con debounce se
  // cancelaba si salías rápido a la agenda (el desmonte mataba el timeout antes
  // de guardar). Aquí guardamos SIN esperar: al desmontar (navegación dentro de
  // la app), al ocultar la pestaña y al cerrar. Usa un ref con el estado vivo.
  const estadoVivoRef = useRef({ tipo, resumen, secciones, signos, diagnosticos, medicamentos, transcripcion: voz.transcripcion, firmada })
  useEffect(() => {
    estadoVivoRef.current = { tipo, resumen, secciones, signos, diagnosticos, medicamentos, transcripcion: voz.transcripcion, firmada }
    // Espejo EN MEMORIA en cada cambio (barato, sin debounce): así al navegar y
    // volver la nota está exactamente como la dejaste, al instante.
    const e = estadoVivoRef.current
    const hay = e.resumen?.trim() || e.secciones?.some(s => s.value?.trim()) || e.diagnosticos?.length || e.medicamentos?.length || e.transcripcion?.trim()
    if (e.firmada || !hay) borradorMem.borrar(respaldoKey)
    else borradorMem.escribir(respaldoKey, { tipo: e.tipo, resumen: e.resumen, secciones: e.secciones, signos: e.signos, diagnosticos: e.diagnosticos, medicamentos: e.medicamentos, transcripcion: e.transcripcion, notaId: notaIdRef.current })
  })
  const flushRespaldo = useCallback(() => {
    const e = estadoVivoRef.current
    if (e.firmada) return
    // Tras cerrar sesión, el desmonte dispara este flush. Escribir aquí resucitaba
    // el borrador que se acababa de purgar, y encima con la clave equivocada.
    if (borradoresBloqueados()) return
    const hay = e.resumen?.trim() || e.secciones?.some(s => s.value?.trim()) || e.diagnosticos?.length || e.medicamentos?.length || e.transcripcion?.trim()
    if (!hay) return
    try {
      localStorage.setItem(respaldoKey, ofuscar(JSON.stringify({
        tipo: e.tipo, resumen: e.resumen, secciones: e.secciones, signos: e.signos,
        diagnosticos: e.diagnosticos, medicamentos: e.medicamentos, notaId: notaIdRef.current,
        transcripcion: e.transcripcion, ts: Date.now(),
      }), secretoLocal(auth.currentUser?.uid)))
    } catch { /* almacenamiento lleno */ }
  }, [respaldoKey])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushRespaldo() }
    window.addEventListener('pagehide', flushRespaldo)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flushRespaldo)
      document.removeEventListener('visibilitychange', onHide)
      flushRespaldo()  // ← al desmontar (irte a la agenda u otra pantalla): guarda YA
    }
  }, [flushRespaldo])

  // Cerrar sesión (por inactividad o a mano) avisa antes de purgar lo local.
  // Aquí se aprovecha para dejar la nota en el servidor, que es lo único que
  // sobrevive al cierre. Sin esto, una consulta dictada y no guardada se perdía.
  useEffect(() => {
    const alGuardarTodo = () => {
      const e = estadoVivoRef.current
      if (e.firmada) return
      const hay = e.resumen?.trim() || e.secciones?.some(s => s.value?.trim()) ||
        e.diagnosticos?.length || e.medicamentos?.length || e.transcripcion?.trim()
      if (hay) guardarBorrador(true)
    }
    window.addEventListener(EVENTO_GUARDAR_TODO, alGuardarTodo)
    return () => window.removeEventListener(EVENTO_GUARDAR_TODO, alGuardarTodo)
  }, [guardarBorrador])

  const restaurarRespaldo = () => {
    try {
      const raw = localStorage.getItem(respaldoKey)
      if (!raw) { setRespaldoDisponible(false); return }
      const b = JSON.parse(desofuscar(raw, secretoLocal(auth.currentUser?.uid)) ?? raw)
      if (b.tipo) setTipo(b.tipo)
      if (Array.isArray(b.secciones)) setSecciones(b.secciones)
      if (typeof b.resumen === 'string') setResumen(b.resumen)
      if (b.signos) setSignos(b.signos)
      if (Array.isArray(b.diagnosticos)) setDiagnosticos(b.diagnosticos)
      if (Array.isArray(b.medicamentos)) setMedicamentos(b.medicamentos)
      if (b.transcripcion) voz.setTranscripcion(b.transcripcion)
      setRespaldoDisponible(false)
      toast('Respaldo local restaurado', 'success')
    } catch { toast('No se pudo restaurar el respaldo', 'error') }
  }

  // ── Resumen hablado de cierre ──────────────────────────────────
  // La IA (voz del navegador, sin dependencias) lee Dx / Tratamiento / plan para
  // que el médico CONFIRME de un vistazo antes de firmar. No modifica la nota.
  const leerResumen = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast('Tu navegador no soporta lectura por voz', 'error'); return
    }
    const dx = diagnosticos.map(d => d.descripcion).filter(Boolean).join(', ')
    const rx = medicamentos
      .map(m => [m.nombre, m.dosis, m.frecuencia].filter(Boolean).join(' '))
      .filter(Boolean).join('. ')
    const partes = [
      dx && `Diagnóstico: ${dx}.`,
      rx && `Tratamiento: ${rx}.`,
      resumen.trim() && `Resumen: ${resumen.trim()}.`,
    ].filter(Boolean) as string[]
    if (!partes.length) { toast('Aún no hay contenido para leer', 'info'); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(partes.join(' '))
    u.lang = 'es-MX'
    window.speechSynthesis.speak(u)
  }, [diagnosticos, medicamentos, resumen, toast])

  // ── Firmar nota (NOM-004 + NOM-024) ────────────────────────────
  const firmar = useCallback(async () => {
    if (!clinicId) return

    /**
     * COMPUERTA DE SUGERENCIAS. Nada que la IA haya añadido por su cuenta entra a
     * una nota firmada sin que el médico lo haya visto.
     *
     * El modelo sigue completando el plan (ahorra dictado y suele acertar), pero
     * marca lo que no salió de la voz del médico. Aquí, antes de firmar, hay que
     * resolverlo: o las acepta como suyas desde el aviso de la nota, o se van.
     * Firmar con la marca puesta significaría firmar conducta clínica que él no
     * indicó, con su cédula.
     */
    const pendientes = sugerenciasPendientes(secciones)
    if (pendientes > 0) {
      const quitar = await confirm(
        `La IA añadió ${pendientes} ${pendientes === 1 ? 'línea que no dictaste' : 'líneas que no dictaste'} (dosis, duraciones, signos de alarma…). ` +
        'Si firmas, saldrían con tu cédula como indicación tuya.\n\n' +
        '“Quitarlas y firmar” las elimina de la nota. “Revisar” te devuelve para leerlas y aceptarlas.',
        { peligro: true, confirmar: 'Quitarlas y firmar', cancelar: 'Revisar' },
      )
      if (!quitar) return
      setSecciones(prev => resolverSugerencias(prev, 'quitar'))
      toast(`Se quitaron ${pendientes} ${pendientes === 1 ? 'sugerencia' : 'sugerencias'}. Revisa y vuelve a firmar.`, 'info')
      return   // se re-renderiza sin ellas; el médico confirma la nota final
    }

    const notaParaValidar = construirNota('firmada')
    const val = validarNOM004(notaParaValidar)
    if (!val.valida) {
      toast(`No se puede firmar: ${val.errores[0]}`, 'error')
      return
    }
    if (!config?.cedulaProfesional) {
      toast('Agrega tu cédula profesional en Configuración → General', 'error')
      return
    }
    setGuardando(true)
    try {
      const now = new Date().toISOString()
      const hashIntegridad = await generarHashIntegridad(notaParaValidar)
      const medicoId = auth.currentUser?.uid ?? ''
      const hashFirma = await generarHashFirma(notaParaValidar.metadata.id, medicoId, now)

      const notaFirmada: NotaMedica = {
        ...notaParaValidar,
        metadata: { ...notaParaValidar.metadata, hashIntegridad, hashVersion: HASH_VERSION, fechaModificacion: now },
        firma: {
          nombreMedico: config.nombreMedico,
          cedulaProfesional: config.cedulaProfesional,
          especialidad: config.especialidad ?? '',
          institucion: config.nombreClinica,
          timestamp: now,
          hashFirma,
          // SNAPSHOT de la imagen de firma+sello en este preciso momento.
          // NOM-024: la nota firmada es inmutable, así que congelamos la firma actual.
          // Si más adelante el médico cambia su firma, las notas viejas siguen mostrando la suya.
          imagenDataUrl: config.firmaImagenDataUrl,
        },
      }

      // Espera cualquier autoguardado en vuelo y usa la ref síncrona, para NO
      // crear una nota duplicada al firmar justo después de un autoguardado.
      await cadenaGuardadoRef.current.catch(() => {})
      let id = notaIdRef.current
      if (id) {
        await updateNota(clinicId, patientId, id, notaFirmada)
      } else {
        id = await createNota(clinicId, patientId, notaFirmada)
        notaIdRef.current = id
        setNotaId(id)
      }
      setFirmada(true)
      try { localStorage.removeItem(respaldoKey) } catch { /* */ }  // ya firmada: respaldo local ya no hace falta
      toast('Nota firmada y sellada (NOM-024)', 'success')
      // Auditoría (Fase F)
      if (clinicId) logAudit({
        evento: 'nota_firmada', clinicId, patientId, notaId: id,
        medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined,
        meta: { tipo, aprobadosIA: aprobados.size, diagnosticos: diagnosticos.length, medicamentos: medicamentos.length },
      })
      // Cobro OPCIONAL. Por defecto el MÉDICO NO cobra al firmar: el cobro lo
      // registra la secretaria desde Citas cuando el paciente se va (y cae en las
      // Finanzas del médico). Solo si la clínica lo enciende (pedirCobroAlCerrar
      // === true) se le pide el cobro al médico aquí.
      if (config?.pedirCobroAlCerrar === true) {
        setCobrar(true)
      } else {
        const nid = notaIdRef.current
        router.push(internamientoActivo ? `/hospitalizacion/${internamientoActivo}` : medicamentos.length > 0 && nid ? `/receta/${patientId}/${nid}` : `/expediente/${patientId}`)
      }
    } catch (e) {
      toast('Error al firmar', 'error')
    } finally {
      setGuardando(false)
    }
  }, [clinicId, patientId, notaId, config, construirNota, router, toast])

  // ── Atajos de teclado ──────────────────────────────────────────
  //
  // Tres problemas que tenía este bloque:
  //  1. Secuestraba Cmd/Ctrl+R y Cmd/Ctrl+P en TODA la pantalla: recargar e
  //     imprimir quedaban inutilizados. Ahora usan Shift, que no choca con nada.
  //  2. No miraba dónde estaba el foco: escribir en un campo y pulsar Cmd+R
  //     arrancaba a grabar, y Cmd+Enter FIRMABA la nota. La firma es
  //     irreversible (NOM-024), así que ese era el peor de los tres.
  //  3. Cmd+Enter firmaba de golpe. Ahora pide confirmación explícita.
  useEffect(() => {
    const enCampoDeTexto = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    const handler = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (enCampoDeTexto(e.target)) return

      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault(); voz.grabando ? voz.detener() : iniciarGrabacion(); return
      }
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault(); procesarIA(); return
      }
      // Firmar es IRREVERSIBLE: nunca por un atajo suelto.
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        if (await confirm('¿Firmar y cerrar la nota? Una vez firmada ya no se puede editar.', { confirmar: 'Firmar' })) firmar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [voz, procesarIA, firmar, iniciarGrabacion, confirm])

  // Corrige la nota por chat: manda la nota actual + la instrucción; aplica SOLO
  // el cambio pedido. Guarda un snapshot para poder deshacer.
  const corregirConIA = async () => {
    const instr = instruccionCorr.trim()
    if (!instr || corrigiendo || firmada) return
    setChatCorr(c => [...c, { rol: 'user', texto: instr }])
    setInstruccionCorr('')
    setCorrigiendo(true)
    setSnapshotUndo({ resumen, secciones, diagnosticos, medicamentos, signos })
    try {
      const nota = {
        resumenEjecutivo: resumen,
        secciones: Object.fromEntries(secciones.map(s => [s.key, s.value])),
        diagnosticos, medicamentos, alergias: [], signosVitales: signosNum,
      }
      const res = await fetchAutenticado('/api/expediente/corregir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Sin nombre en el contexto: minimización de PHI ante el tercero.
        body: JSON.stringify({ nota, instruccion: instr, contexto: { edad: patient?.edad, sexo: patient?.sexo } }),
      })
      const data = await res.json().catch(() => null)
      if (!data?.ok) { setChatCorr(c => [...c, { rol: 'ia', texto: data?.error || 'No pude aplicar el cambio. Reformúlalo.' }]); setSnapshotUndo(null); return }
      // Aplicar la nota corregida.
      if (typeof data.resumenEjecutivo === 'string') setResumen(sanitizarProsa(data.resumenEjecutivo))
      if (data.secciones && typeof data.secciones === 'object') {
        setSecciones(prev => prev.map(s => (typeof data.secciones[s.key] === 'string' ? { ...s, value: sanitizarProsa(data.secciones[s.key]) } : s)))
      }
      if (Array.isArray(data.diagnosticos)) setDiagnosticos(data.diagnosticos.filter((d: Diagnostico) => d.descripcion))
      if (Array.isArray(data.medicamentos)) setMedicamentos(data.medicamentos.filter((m: Medicamento) => m.nombre))
      if (data.signosVitales && typeof data.signosVitales === 'object') setSignos(data.signosVitales)
      setChatCorr(c => [...c, { rol: 'ia', texto: '✓ Listo, apliqué el cambio. Revisa la nota (puedes deshacer).' }])
    } catch {
      setChatCorr(c => [...c, { rol: 'ia', texto: 'Sin conexión. Intenta de nuevo.' }]); setSnapshotUndo(null)
    } finally { setCorrigiendo(false) }
  }
  const deshacerCorreccion = () => {
    if (!snapshotUndo) return
    setResumen(snapshotUndo.resumen); setSecciones(snapshotUndo.secciones)
    setDiagnosticos(snapshotUndo.diagnosticos); setMedicamentos(snapshotUndo.medicamentos); setSignos(snapshotUndo.signos)
    setSnapshotUndo(null)
    setChatCorr(c => [...c, { rol: 'ia', texto: '↩ Deshecho, volví la nota a como estaba.' }])
  }

  const validacion = validarNOM004(construirNota('borrador'))
  const mmss = `${String(Math.floor(voz.duracion / 60)).padStart(2, '0')}:${String(voz.duracion % 60).padStart(2, '0')}`

  return (
    <div className="page-pad" style={{ maxWidth: 980, margin: '0 auto' }}>
      <button onClick={() => router.push(volverA)} style={S.back}>
        <ArrowLeft size={15} /> {esNotaHospital ? 'Volver al episodio' : 'Expediente'}
      </button>

      {/* Alergias — SIEMPRE visible y EDITABLE (el Dr. reportó que no había dónde
          ponerlas). Se guarda en el expediente del paciente y alimenta las alertas
          de fármaco. Rojo cuando hay alergias; neutro cuando no. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        background: patient?.alergias ? 'rgba(239,68,68,0.1)' : 'var(--s2)',
        border: `1px solid ${patient?.alergias ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
        borderRadius: 10, padding: '9px 13px',
      }}>
        <AlertTriangle size={16} color={patient?.alergias ? '#f87171' : 'var(--text3)'} style={{ flexShrink: 0 }} />
        <strong style={{ flexShrink: 0, fontSize: 13, color: patient?.alergias ? '#f87171' : 'var(--text2)' }}>Alergias:</strong>
        <input
          value={patient?.alergias ?? ''}
          onChange={e => setPatient(prev => prev ? { ...prev, alergias: e.target.value } : prev)}
          onBlur={() => { if (clinicId && patient) updatePatient(clinicId, patientId, { alergias: patient.alergias ?? '' }).catch(() => toast('No se guardaron las alergias. Revisa tu conexión.', 'error')) }}
          placeholder="Sin alergias conocidas — escribe aquí si hay (penicilina, AINEs, sulfas…)"
          disabled={firmada}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14 }}
        />
      </div>

      {/* Continuidad: contexto de las últimas visitas (solo lectura) */}
      {contextoPrevio && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--text2)',
        }}>
          <FileText size={14} className="ds-icon" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ color: 'var(--text)' }}>Visitas anteriores:</strong> {contextoPrevio}
          </div>
        </div>
      )}

      {/* Aviso de contexto: esta nota pertenece a un episodio de HOSPITAL, no a consulta */}
      {esNotaHospital && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 13px', borderRadius: 10, background: 'rgba(61,90,254,0.08)', border: '1px solid rgba(61,90,254,0.3)', fontSize: 12.5, color: 'var(--text2)' }}>
          <BedDouble size={15} style={{ color: '#3d5afe', flexShrink: 0 }} />
          Nota de <strong>Hospitalización</strong> — al guardar/firmar regresas al episodio, no a Consulta.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{patient?.nombre ?? 'Consulta'}</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''} · {TIPO_NOTA_LABEL[tipo]}
          </div>
        </div>
        {firmada && <span style={S.firmadaBadge}><CheckCircle2 size={14} /> Nota firmada</span>}
      </div>

      {/* Red de seguridad: ofrecer restaurar respaldo local si el formulario está vacío */}
      {respaldoDisponible && !firmada && !resumen.trim() && !secciones.some(s => s.value?.trim()) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16,
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(61,90,254,0.08)', border: '1px solid rgba(61,90,254,0.3)',
        }}>
          <ShieldCheck size={16} style={{ color: 'var(--nexus)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1, minWidth: 160 }}>
            Hay un <strong>respaldo local</strong> de una nota sin terminar en este dispositivo.
          </span>
          <button onClick={restaurarRespaldo} className="btn btn-sm btn-primary">Restaurar</button>
          <button
            onClick={() => { try { localStorage.removeItem(respaldoKey) } catch { /* */ } setRespaldoDisponible(false) }}
            className="btn btn-sm btn-ghost"
          >
            Descartar
          </button>
        </div>
      )}

      {/* Selector tipo de nota */}
      {!firmada && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TIPOS.map(t => (
            <button key={t} onClick={() => cambiarTipo(t)} style={S.chip(tipo === t)}>{TIPO_NOTA_LABEL[t]}</button>
          ))}
        </div>
      )}

      {/* Selector de ESPECIALIDAD — la IA estructura la nota a esa especialidad */}
      {!firmada && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <Stethoscope size={14} style={{ color: 'var(--text3)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Especialidad de la nota:</span>
          <select
            value={especialidadEfectiva}
            onChange={e => setEspecialidadNota(e.target.value)}
            style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
          >
            <option value="">General / Otra</option>
            {ESPECIALIDADES_POR_GRUPO.map(g => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.items.map(e => <option key={e} value={e}>{e}</option>)}
              </optgroup>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>· la IA la redacta como esa especialidad</span>

          {/* Nota en tiempo real: SIEMPRE activa (se arma sola mientras hablas). */}
          <span
            title="La nota se va armando sola mientras grabas y se finaliza al detener"
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 100,
              border: '1px solid var(--nexus)', background: 'rgba(61,90,254,0.12)', color: 'var(--nexus)',
            }}
          >
            <Sparkles size={13} /> Nota en vivo
            {estructurandoVivo && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          </span>
        </div>
      )}

      {/* ── Grabación ── */}
      {!firmada && (
        <div style={S.grabCard}>
          {/* Única opción: Conversación completa (médico + paciente). Sin toggle. */}
          {audio.soportado && audio.estado !== 'grabando' && (
            <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text3)' }}>
              Modo: <b style={{ color: 'var(--text2)' }}>Conversación completa</b> (médico + paciente) — se graba y separa ambas voces
            </div>
          )}

          {/* Mensaje útil cuando NO hay opción de voz */}
          {!voz.soportado && !audio.soportado && (
            <div style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> Tu navegador no soporta dictado por voz. Escribe la nota manualmente abajo.
            </div>
          )}

          {/* Modo VIVO (Web Speech) */}
          {modoVoz === 'vivo' && voz.soportado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => voz.grabando ? voz.detener() : iniciarGrabacion()}
                style={{
                  width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: voz.grabando ? '#ef4444' : 'var(--teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: voz.grabando ? 'pulse 1.5s infinite' : 'none',
                }}
              >
                {voz.grabando ? <Square size={24} color="#fff" fill="#fff" /> : <Mic size={26} color="#000" />}
              </button>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {voz.grabando ? `Grabando · ${mmss}` : 'Grabar consulta (en vivo)'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                  {voz.grabando
                    ? 'La nota se arma sola; al detener se finaliza automáticamente.'
                    : 'Dicta la consulta. Al detener, la nota se estructura sola. · Ctrl/Cmd+R'}
                </div>
              </div>
              {/* Respaldo manual: normalmente NO hace falta (se procesa solo al detener). */}
              {procesando
                ? <span style={{ ...S.iaBtn(true), pointerEvents: 'none' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Claude estructurando…</span>
                : (!voz.grabando && voz.transcripcion.trim()
                    ? <button onClick={() => procesarIA()} style={S.iaBtn(false)}><Sparkles size={16} /> Procesar de nuevo</button>
                    : null)}
            </div>
          )}

          {/* Modo WHISPER (MediaRecorder + servidor) */}
          {modoVoz === 'whisper' && audio.soportado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {ofreceRecovery && audio.estado === 'inactivo' && (
                <div style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1px solid var(--amber)', background: 'rgba(217, 119, 6, 0.08)',
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mic size={14} className="ds-icon" /> Hay audio guardado de una sesión anterior. ¿Recuperar y transcribir?</span>
                  <button className="btn btn-sm" style={{ background: 'var(--amber)', color: '#000', border: 'none', fontWeight: 600 }}
                    onClick={async () => { await audio.recuperarAudio(`consulta-${patientId}`); setOfreceRecovery(false) }}>
                    Recuperar
                  </button>
                  <button className="btn btn-sm btn-ghost" title="Guarda el audio como archivo en tu dispositivo (nunca lo pierdes)"
                    onClick={async () => { const ok = await audio.descargarAudioGuardado(`consulta-${patientId}`); if (!ok) toast('No se encontró audio guardado.', 'info') }}>
                    Descargar audio
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { audio.reset(); setOfreceRecovery(false) }}>
                    Descartar
                  </button>
                </div>
              )}
              {/* Modo manos libres: activar/desactivar la escucha de comandos de voz */}
              {soportaComandos && (
                <button
                  onClick={() => setManosLibres(m => !m)}
                  title={manosLibres ? 'Desactivar comandos de voz' : 'Activar manos libres: di "iniciar consulta" para grabar'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                    border: `1px solid ${manosLibres ? 'var(--teal)' : 'var(--border2)'}`, cursor: 'pointer', flexShrink: 0,
                    background: manosLibres ? 'color-mix(in srgb, var(--teal) 14%, transparent)' : 'var(--s2)',
                    color: manosLibres ? 'var(--teal)' : 'var(--text2)', fontSize: 13, fontWeight: 600,
                  }}
                >
                  <Headphones size={16} /> Manos libres {manosLibres ? 'ON' : 'OFF'}
                </button>
              )}
              <button
                onClick={async () => {
                  if (audio.estado === 'grabando') await audio.detener()
                  else if (audio.estado === 'pausado') await audio.detener()
                  else if (consentimiento) audio.iniciar(opcionesWhisper)
                  else setModalConsentimiento(true)
                }}
                disabled={audio.estado === 'subiendo'}
                style={{
                  width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: audio.estado === 'subiendo' ? 'default' : 'pointer', flexShrink: 0,
                  background: (audio.estado === 'grabando' || audio.estado === 'pausado') ? '#ef4444' : 'var(--teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: audio.estado === 'grabando' ? 'pulse 1.5s infinite' : 'none',
                }}
                title={audio.estado === 'grabando' || audio.estado === 'pausado' ? 'Detener y transcribir' : 'Iniciar grabación'}
              >
                {audio.estado === 'subiendo'
                  ? <Loader2 size={24} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                  : (audio.estado === 'grabando' || audio.estado === 'pausado')
                    ? <Square size={24} color="#fff" fill="#fff" />
                    : <Mic size={26} color="#000" />}
              </button>
              {(audio.estado === 'grabando' || audio.estado === 'pausado') && (
                <button
                  onClick={() => audio.estado === 'grabando' ? audio.pausar() : audio.reanudar()}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--border2)',
                    background: 'var(--s2)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}
                  title={audio.estado === 'grabando' ? 'Pausar (mantiene la grabación)' : 'Reanudar'}
                >
                  {audio.estado === 'grabando' ? '⏸' : '▶'}
                </button>
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {audio.estado === 'grabando' ? `Grabando · ${String(Math.floor(audio.duracion / 60)).padStart(2,'0')}:${String(audio.duracion % 60).padStart(2,'0')}${audio.chunksTranscritos > 0 ? ` · ${audio.chunksTranscritos} chunks transcritos` : ''}`
                    : audio.estado === 'pausado' ? `⏸ Pausado · ${String(Math.floor(audio.duracion / 60)).padStart(2,'0')}:${String(audio.duracion % 60).padStart(2,'0')}`
                    : audio.estado === 'subiendo' ? 'Transcribiendo audio…'
                    : audio.estado === 'listo' ? 'Transcripción lista'
                    : 'Grabar la conversación completa (médico + paciente)'}
                </div>
                {/* Manos libres: aviso de escucha activa + comandos */}
                {manosLibres && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: comandoError ? '#ef4444' : 'var(--teal)' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: comandoError ? '#ef4444' : 'var(--teal)',
                      animation: escuchaActiva && !comandoError ? 'pulse 1.5s infinite' : 'none',
                    }} />
                    {comandoError
                      ? comandoError
                      : <>Escuchando comandos — di <strong>“iniciar consulta”</strong> o <strong>“cerrar consulta”</strong>
                        {picoConfig
                          ? <span style={{ marginLeft: 6, fontSize: 11, opacity: .8 }}>· 🔒 en el dispositivo</span>
                          : <span style={{ marginLeft: 6, fontSize: 11, opacity: .8 }}>· en la nube</span>}
                      </>}
                  </div>
                )}
                {/* Medidor de nivel de audio EN VIVO — confirma visualmente que captura voz */}
                {audio.estado === 'grabando' && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{
                      position: 'relative', height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        width: `${Math.round(audio.nivelAudio * 100)}%`,
                        background: audio.nivelAudio < 0.05 ? '#9CA3AF'
                          : audio.nivelAudio < 0.4 ? '#22C55E'
                          : audio.nivelAudio < 0.75 ? '#EAB308' : '#EF4444',
                        transition: 'width 60ms linear, background 200ms',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, fontSize: 10.5, color: 'var(--text3)' }}>
                      <span>
                        {audio.silencioProlongado
                          ? 'Sin señal por +15s — verifica el micrófono'
                          : audio.nivelAudio < 0.05 ? 'Esperando voz…' : 'Captando bien'}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {(audio.bytesGrabados / 1024 / 1024).toFixed(1)} / 25 MB · 16kHz/64kbps
                      </span>
                    </div>
                  </div>
                )}
                {audio.estado !== 'grabando' && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                    Capta a los dos · voz 16kHz · gpt-4o-transcribe · vocabulario médico ampliado
                  </div>
                )}
                {audio.error && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={12} className="ds-icon" /> {audio.error}
                    </span>
                    <button className="btn btn-sm" style={{ background: 'var(--amber)', color: '#000', border: 'none', fontWeight: 600 }}
                      title="Guarda el audio como archivo en tu dispositivo (nunca lo pierdes)"
                      onClick={async () => { const ok = await audio.descargarAudioGuardado(`consulta-${patientId}`); if (!ok) toast('No se encontró audio guardado.', 'info') }}>
                      Descargar audio
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => { audio.reset(); setOfreceRecovery(false) }}>
                      Descartar audio guardado
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => procesarIA()} disabled={procesando || tareaProc?.ejecutando || !voz.transcripcion.trim()} style={S.iaBtn(procesando || tareaProc?.ejecutando || !voz.transcripcion.trim())}>
                {(procesando || tareaProc?.ejecutando) ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Claude estructurando…</> : <><Sparkles size={16} /> Procesar con IA</>}
              </button>
            </div>
          )}

          {/* ── MENÚ DE IA: motor por nota + medidor de créditos ── */}
          {voz.transcripcion.trim() && !voz.grabando && (
            <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Motor de IA para esta nota</span>
                {usoIA && (
                  <span style={{ fontSize: 11.5, color: usoIA.alerta === 'excedido' ? 'var(--amber, #d97706)' : 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.max(0, usoIA.limite - usoIA.usadas)} de {usoIA.limite} créditos restantes
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {MOTORES_UI.map(m => {
                  const on = motorEfectivo === m.clave
                  return (
                    <button key={m.clave} onClick={() => setMotorSel(m.clave)}
                      style={{
                        flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', borderRadius: 10, padding: '9px 11px',
                        border: '1px solid ' + (on ? 'var(--teal)' : 'var(--border)'),
                        background: on ? 'rgba(13,148,136,0.08)' : 'var(--s1)', color: 'var(--text)',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.emoji} {m.nombre} <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11 }}>· {m.creditos} cr</span></div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>{m.desc}</div>
                    </button>
                  )
                })}
              </div>
              {motorUsado && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  Última nota generada con {MOTORES_UI.find(m => m.clave === motorUsado)?.emoji} <b>{MOTORES_UI.find(m => m.clave === motorUsado)?.nombre}</b>
                </div>
              )}
            </div>
          )}

          {/* Material de origen (dictado) — FUENTE, no forma parte de la nota.
              Mientras graba se ve en vivo; ya estructurada queda colapsada. */}
          {(voz.transcripcion || voz.grabando) && (
            <div style={{ marginTop: 14 }}>
              {!voz.grabando && (
                <button
                  type="button"
                  onClick={() => setVerFuente(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '8px 12px', cursor: 'pointer', color: 'var(--text3)', fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  <FileText size={13} className="ds-icon" />
                  <span style={{ flex: 1 }}>Material de origen (dictado) · no forma parte de la nota ni se imprime</span>
                  {verFuente ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
              {(voz.grabando || verFuente) && (
                audio.utterances.length > 0 && !voz.grabando ? (
                  <DialogoDiarizado utterances={audio.utterances} rolesIniciales={rolesHablante} onRolesChange={setRolesHablante} />
                ) : (
                  <textarea
                    value={voz.transcripcion + (voz.interim ? ` ${voz.interim}` : '')}
                    onChange={e => voz.setTranscripcion(e.target.value)}
                    placeholder="La transcripción aparecerá aquí…"
                    style={S.transcripcion}
                  />
                )
              )}
            </div>
          )}

          {/* Panel de correcciones léxicas — transparencia + deshacer.
              En un documento legal nada debe cambiar en silencio: el médico
              ve qué corrigió el sistema y revierte con un clic si se equivocó. */}
          {audio.estado === 'listo' && audio.correcciones.length > 0 && (
            <CorreccionesPanel
              correcciones={audio.correcciones}
              onRevertir={(c) => {
                // Revierte una sustitución concreta en el texto del editor
                const re = new RegExp(`\\b${c.corregido.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
                voz.setTranscripcion(voz.transcripcion.replace(re, c.original))
              }}
            />
          )}
        </div>
      )}

      {/* ── Extraer entidades clínicas (NER — equivalente Comprehend Medical) ── */}
      {(voz.transcripcion.trim() || secciones.some(s => s.value)) && !firmada && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            onClick={extraerEntidades}
            disabled={nerCargando}
            className="btn btn-secondary btn-sm"
            title="Extrae condiciones (CIE-10), medicamentos (dosis/vía/intervalo), alergias, estudios e interacciones farmacológicas"
          >
            {nerCargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Extrayendo entidades…</>
              : <><FlaskConical size={14} /> Extraer entidades clínicas {entidades ? '· re-analizar' : ''}</>}
          </button>
          {entidades && (
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              {(entidades.conditions?.length ?? 0)} dx · {(entidades.medications?.length ?? 0)} fármacos · {(entidades.allergies?.length ?? 0)} alergias · {(entidades.tests?.length ?? 0)} estudios
            </span>
          )}
        </div>
      )}

      {/* Panel NER en vivo */}
      {(entidades || nerCargando || nerError) && (
        <div style={{ marginBottom: 18 }}>
          <NerPanel
            entidades={entidades}
            cargando={nerCargando}
            error={nerError}
            onCerrar={() => { setEntidades(null); setNerError('') }}
          />
        </div>
      )}

      {/* ── Créditos AGOTADOS (tope duro): la IA se pausó este mes ── */}
      {sinCreditos && (
        <div style={{
          marginBottom: 14, padding: '13px 16px', borderRadius: 12,
          border: '1px solid var(--red)', background: 'rgba(239,68,68,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
            <AlertTriangle size={17} /> Se acabaron tus consultas con IA del mes ({sinCreditos.usadas}/{sinCreditos.limite})
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
            La IA se pausó para no generarte cargos extra. Puedes seguir escribiendo la nota a mano.
            Para reactivarla, compra más consultas o sube de plan.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={comprarRecarga} disabled={comprandoRecarga} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#000', border: 'none', cursor: comprandoRecarga ? 'wait' : 'pointer', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700 }}>
              {comprandoRecarga ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Abriendo…</> : 'Comprar más créditos'}
            </button>
            <a href="/precios" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--nexus, #3d5afe)', textDecoration: 'none', border: '1px solid var(--nexus, #3d5afe)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>
              Ver planes
            </a>
          </div>
        </div>
      )}

      {modoEco && !sinCreditos && (
        <div style={{
          marginBottom: 14, padding: '13px 16px', borderRadius: 12,
          border: '1px solid var(--amber, #d97706)', background: 'rgba(217,119,6,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--amber, #b45309)' }}>
            <Sparkles size={16} /> Nota generada en modo económico
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
            Se agotaron tus consultas con IA máxima del mes. Esta nota corrió con IA económica
            (Sonnet 5 — muy buena) y sin separación de voces. <b>Nunca te quedas sin IA.</b> Para
            recuperar la IA máxima (Opus 4.8 + GPT-5 + separación médico-paciente) compra más créditos.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={comprarRecarga} disabled={comprandoRecarga} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#000', border: 'none', cursor: comprandoRecarga ? 'wait' : 'pointer', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700 }}>
              {comprandoRecarga ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Abriendo…</> : 'Comprar más créditos'}
            </button>
            <a href="/precios" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--nexus, #3d5afe)', textDecoration: 'none', border: '1px solid var(--nexus, #3d5afe)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>
              Ver planes
            </a>
          </div>
        </div>
      )}

      {/* ── Candado de gasto (soft): aviso de límite de consultas del plan ── */}
      {usoIA && usoIA.alerta !== 'ok' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '9px 13px', borderRadius: 10, fontSize: 12.5,
          border: '1px solid ' + (usoIA.alerta === 'excedido' ? 'var(--amber)' : 'var(--border)'),
          background: usoIA.alerta === 'excedido' ? 'rgba(217,119,6,0.08)' : 'var(--s2)',
          color: 'var(--text2)',
        }}>
          <AlertTriangle size={15} style={{ color: usoIA.alerta === 'excedido' ? 'var(--amber)' : 'var(--text3)', flexShrink: 0 }} />
          {usoIA.alerta === 'excedido'
            ? <span>Llegaste al límite de <strong>{usoIA.limite}</strong> consultas de tu plan este mes ({usoIA.usadas}). La nota se generó igual — considera subir de plan.</span>
            : <span>Vas en <strong>{usoIA.usadas}/{usoIA.limite}</strong> consultas de tu plan este mes ({usoIA.porcentaje}%). Te quedan {usoIA.restantes}.</span>}
        </div>
      )}

      {/* ── Resumen ejecutivo ── */}
      {resumen && (
        <div style={S.resumen}>
          <Sparkles size={14} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>{resumen}</span>
        </div>
      )}

      {/* Botón de 2ª opinión a demanda (plan Pro): en Premium corre sola. */}
      {planActual === 'pro' && !verificacion && !verificando && (resumen || diagnosticos.length > 0 || medicamentos.length > 0) && (
        <button onClick={pedirSegundaOpinion}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, background: 'rgba(59,90,254,0.10)', color: 'var(--nexus, #3d5afe)', border: '1px solid rgba(59,90,254,0.35)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Sparkles size={14} /> Pedir segunda opinión (otra IA revisa la nota)
        </button>
      )}

      {/* ── Segunda opinión (verificación cruzada por un 2º modelo top) ── */}
      {verificando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5, color: 'var(--text3)' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Segunda opinión en curso — otro modelo de IA revisa la nota…
        </div>
      )}
      {verificacion && !verificando && (
        verificacion.hallazgos.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 12.5, color: 'var(--teal)' }}>
            <CheckCircle2 size={14} /> Segunda opinión ({verificacion.modelo}): sin observaciones de seguridad.
          </div>
        ) : (
          <Alert tone="warning" icon={<AlertTriangle size={18} />} title={`Segunda opinión (${verificacion.modelo}) — ${verificacion.hallazgos.length} observación(es) a revisar`}>
            {verificacion.hallazgos.map((h, i) => {
              const col = h.severidad === 'alta' ? 'var(--red)' : h.severidad === 'media' ? 'var(--amber)' : 'var(--text3)'
              return (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: i ? 8 : 0 }}>
                  <strong style={{ color: col }}>[{h.severidad.toUpperCase()}]</strong> {h.tema && <strong>{h.tema}: </strong>}{h.problema}
                  {h.sugerencia && <div style={{ color: 'var(--text3)', marginTop: 2 }}>↳ {h.sugerencia}</div>}
                </div>
              )
            })}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, fontStyle: 'italic' }}>
              Son sugerencias de una IA revisora — tú decides. No modifican la nota automáticamente.
            </div>
          </Alert>
        )
      )}

      {/* Preguntar a la evidencia sobre ESTE paciente (abre el Consultor con contexto) */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || resumen) && (
        <button onClick={() => router.push(`/consultor?paciente=${patientId}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, marginRight: 8, background: 'rgba(61,90,254,0.08)', color: 'var(--nexus, #3d5afe)', border: '1px solid rgba(61,90,254,0.30)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FlaskConical size={14} /> Preguntar a la evidencia (chat)
        </button>
      )}

      {/* ── Copiloto: lo que aplica a ESTE paciente, calculado con lo ya capturado.
             Si no hay nada que decir, no se pinta. ── */}
      <Copiloto
        entrada={entradaCopiloto}
        onAgregarANota={agregarASeccion('copiloto', 'Valoración asistida')}
      />

      {/* ── Herramientas clínicas: un solo bloque plegado. Antes eran cinco cajas
             siempre abiertas apiladas aquí; la mayoría de las consultas no usa
             ninguna, así que ahora se abren solo cuando se necesitan. ── */}
      <Herramientas items={[
        ...(esCasoQuirurgico ? [{
          id: 'cirugia', nombre: 'Cirugía', color: '#60a5fa', icono: <Scissors size={14} />,
          para: 'ASA · RCRI · Caprini · Apfel · profilaxis con re-dosis · checklist OMS',
          contenido: <PanelCirugia embebido onAgregarANota={agregarASeccion('perioperatorio', 'Valoración perioperatoria')} />,
        }] : []),
        ...(esGineco ? [{
          id: 'gineco', nombre: 'Gineco-obstetricia', color: '#f472b6', icono: <Stethoscope size={14} />,
          para: 'Gestación · control prenatal · preeclampsia · Bishop · citología',
          contenido: <PanelGineco embebido sexo={patient?.sexo} edadAnios={patient?.edad}
            onAgregarANota={agregarASeccion('gineco', 'Gineco-obstetricia')} />,
        }] : []),
        ...(esPediatrico ? [{
          id: 'pediatria', nombre: 'Pediatría', color: '#a78bfa', icono: <Baby size={14} />,
          para: 'Dosis por peso con tope de adulto · vacunación',
          aviso: vacunasAtrasadas > 0
            ? { texto: `${vacunasAtrasadas} vacuna${vacunasAtrasadas > 1 ? 's' : ''} atrasada${vacunasAtrasadas > 1 ? 's' : ''}`, urgente: true }
            : undefined,
          abrirPorDefecto: vacunasAtrasadas > 0,
          contenido: <PanelPediatria embebido edadAnios={patient?.edad} sexo={patient?.sexo}
            onAgregarANota={agregarASeccion('pediatria', 'Pediatría')} />,
        }] : []),
        ...(calcSugeridas.length > 0 ? [{
          id: 'calculadoras', nombre: 'Calculadoras', color: 'var(--teal)', icono: <Calculator size={14} />,
          para: 'Escalas sugeridas por el diagnóstico',
          aviso: { texto: `${calcSugeridas.length} sugerida${calcSugeridas.length > 1 ? 's' : ''}` },
          contenido: <CalculadorasClinicas embebido contexto={contextoCalc}
            onAgregarANota={agregarASeccion('escalas_clinicas', 'Escalas y calculadoras clínicas')} />,
        }] : []),
        {
          id: 'cardiometabolico', nombre: 'Cardiometabólico', color: '#22c55e', icono: <HeartPulse size={14} />,
          para: 'Lípidos · obesidad · hígado graso · hoja para el paciente',
          contenido: <PanelCardiometabolico embebido nombre={patient?.nombre} edad={patient?.edad} sexo={patient?.sexo}
            onAgregarANota={agregarASeccion('cardiometabolico', 'Valoración cardiometabólica')} />,
        },
        {
          id: 'preventivo', nombre: 'Preventivo y tendencias', color: '#38bdf8', icono: <ShieldCheck size={14} />,
          para: 'Tamizajes por edad y sexo · tendencia de laboratorios',
          contenido: <PanelPreventivo embebido edad={patient?.edad} sexo={patient?.sexo}
            onAgregarANota={agregarASeccion('preventivo', 'Medicina preventiva')} />,
        },
        {
          id: 'fotos', nombre: 'Fotografía clínica', color: 'var(--teal)', icono: <Camera size={14} />,
          para: 'Tomar foto de esta consulta (la serie está en el expediente)',
          contenido: clinicId
            ? <FotosClinicas embebido modo="captura" clinicId={clinicId} patientId={patientId} notaId={notaId ?? undefined} />
            : <p style={{ fontSize: 12, color: 'var(--text3)' }}>Cargando…</p>,
        },
      ]} />

      {/* ── Análisis basado en evidencia (PubMed) ── */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || resumen) && !evidencia && (
        <button onClick={analizarEvidencia} disabled={analizandoEv}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, background: 'rgba(20,184,166,0.10)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.35)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: analizandoEv ? 'default' : 'pointer' }}>
          {analizandoEv
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cruzando con la literatura médica…</>
            : <><FlaskConical size={14} /> Análisis basado en evidencia (NEJM · JAMA · Cochrane · PubMed)</>}
        </button>
      )}
      {evidencia && (() => {
        const arts = evidencia.articulos
        const citas = (nums?: number[]) => (nums ?? []).filter(n => arts[n - 1]).map((n, k) => (
          <a key={k} href={arts[n - 1].url} target="_blank" rel="noopener noreferrer"
            title={`${arts[n - 1].titulo} — ${arts[n - 1].revista} ${arts[n - 1].anio}`}
            style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', textDecoration: 'none', verticalAlign: 'super', marginLeft: 2 }}>[{n}]</a>
        ))
        const bloque = (titulo: string, items: PuntoEv[], campoTitulo: keyof PuntoEv, campoTexto: keyof PuntoEv) => items.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{titulo}</div>
            {items.map((it, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: 4 }}>
                • <strong>{String(it[campoTitulo] ?? '')}</strong>{it[campoTexto] ? ` — ${String(it[campoTexto])}` : ''} {citas(it.citas)}
              </div>
            ))}
          </div>
        )
        return (
          <div style={{ marginBottom: 12, border: '1px solid rgba(20,184,166,0.35)', borderRadius: 12, padding: 14, background: 'rgba(20,184,166,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>
              <FlaskConical size={15} /> Análisis basado en evidencia
              <button onClick={agregarAnalisisANota} disabled={generandoAnalisis} style={{ marginLeft: 'auto', background: generandoAnalisis ? 'var(--s3)' : 'var(--teal)', color: generandoAnalisis ? 'var(--text3)' : '#000', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: generandoAnalisis ? 'default' : 'pointer' }}>
                {generandoAnalisis ? 'Agregando…' : '→ Agregar a la nota'}
              </button>
              <button onClick={analizarEvidencia} disabled={analizandoEv} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>↻ actualizar</button>
            </div>
            {evidencia.aviso && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 6 }}>{evidencia.aviso}</div>}
            {bloque('Evaluación del tratamiento', evidencia.evaluacion, 'punto', 'sustento')}
            {bloque('Alternativas a considerar', evidencia.alternativas, 'opcion', 'porque')}
            {bloque('Diagnóstico diferencial', evidencia.diferencial, 'dx', 'razon')}
            {arts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)' }}>Fuentes ({arts.length})</div>
                {arts.map((a, i) => (
                  <div key={a.pmid} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                    [{i + 1}] <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>{a.titulo}</a> · {a.revista} {a.anio}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 10, fontStyle: 'italic' }}>
              Evidencia real de PubMed. Apoyo a la decisión — el juicio clínico es tuyo.
            </div>
          </div>
        )
      })()}

      {/* ── Alertas clínicas cruzadas (punto de atención) ── */}
      {(() => {
        const alergiasPaciente = patient?.alergias
          ? [{ alergeno: patient.alergias, reaccion: '' }]
          : []
        const alertas = validarAlergiasVsMedicamentos(alergiasPaciente, medicamentos)
        const interacciones = detectarInteracciones(medicamentos)
        const controlados = detectarControlados(medicamentos)
        if (alertas.length === 0 && interacciones.length === 0 && controlados.length === 0) return null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {alertas.length > 0 && (
              <Alert tone="danger" icon={<AlertTriangle size={18} />} title="Alergia ↔ medicamento">
                {alertas.map((a, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: i ? 4 : 0 }}>
                    <strong style={{ color: a.severidad === 'critica' ? 'var(--red)' : 'var(--amber)' }}>[{a.severidad.toUpperCase()}]</strong> {a.mensaje}
                  </div>
                ))}
              </Alert>
            )}
            {interacciones.length > 0 && (
              <Alert tone="warning" title="Posibles interacciones farmacológicas">
                {interacciones.map((it, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: i ? 4 : 0 }}>
                    <strong>{it.titulo}</strong>{it.severidad === 'mayor' ? ' (mayor)' : ''} — {it.detalle}
                  </div>
                ))}
              </Alert>
            )}
            {controlados.length > 0 && (
              <Alert tone="cobalt" icon={<Lock size={16} />} title="Controlado(s) — requisito COFEPRIS">
                {controlados.map((c, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: i ? 4 : 0 }}>
                    <strong>{c.farmaco}</strong> — {c.requisito}
                  </div>
                ))}
              </Alert>
            )}
          </div>
        )
      })()}

      {/* ── PROA / Stewardship — cuando hay antimicrobianos ── */}
      {(() => {
        const plan = construirPlanPROA(medicamentos)
        if (!plan.hayAntimicrobianos) return null
        return (
          <div style={{ background: 'rgba(15,110,86,0.07)', border: '1px solid rgba(15,110,86,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#0F6E56' }}><Bug size={15} className="ds-icon" /> PROA — reevaluar antimicrobiano</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                Reevaluación sugerida: <strong>{plan.ventana}</strong> (48-72h)
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6 }}>
              Detectado(s): {plan.antimicrobianos.join(', ')}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>
              {plan.recordatorios.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
            </ul>
          </div>
        )
      })()}

      {/* ── Panel de revisión IA (Fase B) ── */}
      {(extraction || safety) && !firmada && (
        <RevisionPanel
          extraction={extraction as Parameters<typeof RevisionPanel>[0]['extraction']}
          safety={safety as Parameters<typeof RevisionPanel>[0]['safety']}
          aprobados={aprobados}
          onAprobar={id => setAprobados(prev => new Set(prev).add(id))}
          onRechazar={id => setAprobados(prev => { const n = new Set(prev); n.delete(id); return n })}
        />
      )}

      {/* ── Sugerencias de la IA pendientes de que el médico las avale ── */}
      {!firmada && sugerenciasPendientes(secciones) > 0 && (() => {
        const n = sugerenciasPendientes(secciones)
        return (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, flexWrap: 'wrap',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 12, padding: '13px 15px', marginBottom: 14,
          }}>
            <AlertTriangle size={17} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
              <strong>{n} {n === 1 ? 'línea la propuso la IA' : 'líneas las propuso la IA'}, no tú.</strong>{' '}
              Están marcadas con <code style={{ fontSize: 12 }}>[IA — no dictado]</code> dentro de la nota —
              suelen ser dosis, duraciones o signos de alarma. Léelas: si las avalas pasan a ser tuyas;
              si no, quítalas. No se puede firmar con la marca puesta.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setSecciones(prev => resolverSugerencias(prev, 'aceptar')); toast(`Aceptaste ${n} ${n === 1 ? 'sugerencia' : 'sugerencias'} como tuyas`, 'success') }}
                className="lift"
                style={{ background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Las acepto
              </button>
              <button
                onClick={() => { setSecciones(prev => resolverSugerencias(prev, 'quitar')); toast('Sugerencias quitadas de la nota', 'info') }}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Quitarlas
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Signos vitales ── */}
      {requiereSignosVitales(tipo) && (
        <Section title="Signos vitales" icon={<Stethoscope size={15} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10 }}>
            {([['ta', 'TA', '120/80'], ['fc', 'FC', 'lpm'], ['fr', 'FR', 'rpm'], ['temperatura', 'T°', '°C'], ['spo2', 'SpO₂', '%'], ['peso', 'Peso', 'kg'], ['talla', 'Talla', 'cm']] as const).map(([k, label, ph]) => (
              <div key={k}>
                <label style={S.miniLabel}>{label}</label>
                <input
                  value={(signos[k] as string | number | undefined) ?? ''}
                  /**
                   * DECIMALES. Esto hacía `Number(e.target.value)` en cada tecla:
                   * al escribir "70." el valor pasaba a 70, el input controlado se
                   * repintaba como "70" y EL PUNTO SE PERDÍA. Era imposible teclear
                   * 70.5 de peso o 36.7 de temperatura — quedaba 705 y 367. Con
                   * coma ("36,5") daba NaN y el campo mostraba literalmente "NaN".
                   *
                   * Ahora se conserva el texto tal cual mientras sea un número en
                   * construcción (se acepta la coma y se normaliza a punto), y la
                   * conversión a número ocurre al construir la nota.
                   */
                  onChange={e => setSignos(s => {
                    if (k === 'ta') return { ...s, [k]: e.target.value }
                    const v = e.target.value.replace(',', '.')
                    if (v === '') return { ...s, [k]: undefined }
                    if (!/^\d*\.?\d*$/.test(v)) return s      // ignora la tecla inválida
                    return { ...s, [k]: v }
                  })}
                // Teclado numérico en el teléfono: sin esto salía el QWERTY completo
                // para capturar FC, peso o talla. La TA lleva 'numeric' y no 'decimal'
                // porque necesita la diagonal de "120/80".
                inputMode={k === 'ta' ? 'numeric' : ['temperatura', 'peso', 'talla'].includes(k) ? 'decimal' : 'numeric'}
                  placeholder={ph} disabled={firmada} style={S.miniInput}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Calculadoras de valoración preoperatoria ── */}
      {esPreoperatoria(tipo) && (
        <PreopAssessment
          edadPaciente={patient?.edad}
          disabled={firmada}
          initialInputs={preop?.inputs}
          onAplicar={(conclusion, recomendaciones, preopData) => {
            setPreop(preopData)
            setSecciones(prev => prev.map(s => {
              if (s.key === 'conclusionRiesgo') return { ...s, value: conclusion }
              if (s.key === 'recomendaciones') return { ...s, value: recomendaciones }
              return s
            }))
            toast('Escalas aplicadas a la nota', 'success')
          }}
        />
      )}

      {/* ── Valoración del paciente inmunocomprometido (Infectología) ── */}
      {esInmuno(tipo) && patient && !firmada && (
        <Section title="Valoración infectológica — inmunocomprometido" icon={<ShieldCheck size={15} />}>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 10px' }}>
            Completa el motivo, huésped y los chips (o dicta por voz y usa &quot;Procesar con IA&quot;). Luego pulsa
            <strong> &quot;Aplicar a la nota clínica&quot;</strong>: se llenan las secciones, los medicamentos de profilaxis y los estudios de la orden.
          </p>
          <ValoracionInmuno
            patient={patient}
            onAplicarNota={(n) => {
              setSecciones(prev => prev.map(s => {
                const val = (n.secciones as Record<string, string>)[s.key]
                return typeof val === 'string' && val.trim() ? { ...s, value: val } : s
              }))
              setMedicamentos(prev => {
                const names = new Set(prev.map(m => m.nombre.trim().toLowerCase()))
                const nuevos = n.medicamentos.filter(m => m.nombre && !names.has(m.nombre.trim().toLowerCase()))
                return [...prev, ...nuevos]
              })
              setEstudiosOrden(n.estudios)
              toast('Valoración aplicada — revisa secciones, medicamentos y estudios', 'success')
            }}
          />
        </Section>
      )}

      {/* ── Secciones narrativas ── */}
      {secciones.map((s, i) => (
        <Section key={s.key} title={s.label} obligatorio={s.obligatorio}>
          <textarea
            value={s.value}
            onChange={e => setSecciones(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            placeholder={s.placeholder ?? ''}
            disabled={firmada}
            style={S.textarea}
          />
        </Section>
      ))}

      {/* ── Diagnósticos (con autocomplete CIE-10 — NOM-035) ── */}
      <Section title="Diagnósticos" icon={<ShieldCheck size={15} />}>
        {diagnosticos.map((d, i) => (
          <div key={i} style={{ ...S.row, alignItems: 'flex-start' }}>
            <div style={{ flex: 3 }}>
              {firmada ? (
                <input value={d.descripcion} disabled placeholder="Diagnóstico" style={S.input} />
              ) : (
                <Cie10Autocomplete
                  value={d.descripcion}
                  onChange={(descripcion, codigoCIE10) => {
                    setDiagnosticos(prev => prev.map((x, j) =>
                      j === i ? { ...x, descripcion, ...(codigoCIE10 ? { codigoCIE10 } : {}) } : x
                    ))
                  }}
                  placeholder="Faringitis, J02, hipertensión…"
                />
              )}
            </div>
            <input
              value={d.codigoCIE10 ?? ''}
              disabled={firmada}
              placeholder="CIE-10"
              onChange={e => setDiagnosticos(prev => prev.map((x, j) => j === i ? { ...x, codigoCIE10: e.target.value.toUpperCase() } : x))}
              style={{ ...S.input, flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}
            />
            {!firmada && <button onClick={() => setDiagnosticos(prev => prev.filter((_, j) => j !== i))} style={S.del}><Trash2 size={14} /></button>}
          </div>
        ))}
        {!firmada && (
          <button onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', tipo: 'presuntivo', estado: 'activo' }])} style={S.addBtn}>
            <Plus size={13} /> Agregar diagnóstico
          </button>
        )}
        {!firmada && diagnosticos.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Lightbulb size={12} className="ds-icon" /> Escribe el padecimiento y te sugerimos el código CIE-10 del catálogo NOM-035
          </div>
        )}
      </Section>

      {/* ── Medicamentos ── */}
      <Section title="Medicamentos / Plan farmacológico" icon={<Pill size={15} />}>
        {medicamentos.map((m, i) => (
          <div key={i} style={{ ...S.row, flexWrap: 'wrap' }}>
            <input value={m.nombre} disabled={firmada} placeholder="Medicamento"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
              style={{ ...S.input, flex: 2, minWidth: 120 }} />
            <input value={m.dosis} disabled={firmada} placeholder="Dosis"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, dosis: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 70 }} />
            <input value={m.frecuencia} disabled={firmada} placeholder="Frecuencia"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, frecuencia: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 90 }} />
            <input value={m.duracion} disabled={firmada} placeholder="Duración"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, duracion: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 80 }} />
            {!firmada && <button onClick={() => setMedicamentos(prev => prev.filter((_, j) => j !== i))} style={S.del}><Trash2 size={14} /></button>}
          </div>
        ))}
        {!firmada && (
          <button onClick={() => setMedicamentos(prev => [...prev, { nombre: '', dosis: '', via: 'oral', frecuencia: '', duracion: '' }])} style={S.addBtn}>
            <Plus size={13} /> Agregar medicamento
          </button>
        )}
      </Section>

      {/* ── Validación + Acciones ── */}
      {!firmada && (
        <>
          {/* ── Chat de corrección por IA ── */}
          {!firmada && (
            <div style={{ marginTop: 18, border: '1px solid rgba(61,90,254,0.35)', borderRadius: 12, background: 'rgba(61,90,254,0.05)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                <Sparkles size={15} style={{ color: 'var(--nexus, #3d5afe)' }} /> Corregir por chat
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, marginBottom: 10 }}>
                Escribe qué está mal y lo corrijo al instante, sin tocar lo demás. Ej: “la dosis de amoxicilina es 500 mg”, “quita la diabetes”, “el Dx correcto es apendicitis”.
              </div>
              {chatCorr.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                  {chatCorr.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', fontSize: 12.5, padding: '7px 11px', borderRadius: 10, background: m.rol === 'user' ? 'var(--nexus, #3d5afe)' : 'var(--s2)', color: m.rol === 'user' ? '#fff' : 'var(--text)' }}>
                      {m.texto}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={instruccionCorr}
                  onChange={e => setInstruccionCorr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); corregirConIA() } }}
                  placeholder="Escribe la corrección…"
                  disabled={corrigiendo}
                  style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, color: 'var(--text)', outline: 'none' }}
                />
                {snapshotUndo && (
                  <button onClick={deshacerCorreccion} title="Deshacer el último cambio" style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    ↩ Deshacer
                  </button>
                )}
                <button onClick={corregirConIA} disabled={corrigiendo || !instruccionCorr.trim()} style={{ background: (corrigiendo || !instruccionCorr.trim()) ? 'var(--s3)' : 'var(--nexus, #3d5afe)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: (corrigiendo || !instruccionCorr.trim()) ? 'default' : 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {corrigiendo ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Corrigiendo…</> : 'Corregir'}
                </button>
              </div>
            </div>
          )}

          {validacion.errores.length > 0 && (
            <div style={S.valBox('error')}>
              {validacion.errores.map((e, i) => <div key={i} style={{ display: 'flex', gap: 6 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {e}</div>)}
            </div>
          )}
          {validacion.advertencias.length > 0 && (
            <div style={S.valBox('warn')}>
              {validacion.advertencias.map((a, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} className="ds-icon" /> {a}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={firmar} disabled={!validacion.valida || guardando} style={S.firmar(!validacion.valida || guardando)}>
              <FileSignature size={17} /> Firmar y cerrar nota
            </button>
            <button onClick={() => guardarBorrador()} disabled={guardando} style={S.guardar}>
              {guardando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Guardar borrador'}
            </button>
            <button onClick={leerResumen} disabled={guardando} style={S.guardar} title="La IA te lee Dx, tratamiento y plan para confirmar antes de firmar">
              <Volume2 size={14} /> Leer resumen
            </button>
            <button onClick={descartar} disabled={guardando} style={S.descartar}>
              <Trash2 size={14} /> Descartar
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Completitud: {validacion.puntajeCompletitud}%</span>
          </div>
        </>
      )}

      {/* ── Modal de consentimiento (Fase C) ── */}
      <Modal
        open={modalConsentimiento}
        onClose={() => setModalConsentimiento(false)}
        title="Consentimiento para grabar la consulta"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalConsentimiento(false)}>Cancelar</Button>
            <Button onClick={confirmarConsentimiento}>Confirmo el consentimiento e iniciar</Button>
          </>
        )}
      >
        <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 14px' }}>
          Confirme que el paciente fue informado de que la conversación será grabada y transcrita para
          estructurar la nota clínica con asistencia de IA. El audio no se guarda; solo se conserva la
          transcripción de texto vinculada a su expediente.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.7 }}>
          <li>El paciente puede pedir detener la grabación en cualquier momento.</li>
          <li>La nota final debe ser revisada y firmada por usted.</li>
          <li>La IA NO guarda datos clínicos sin su aprobación.</li>
        </ul>
      </Modal>

      {/* ── Cobro al cerrar la consulta (cómo pagó y cuánto) ── */}
      {cobrar && clinicId && (
        <CobrarModal
          clinicId={clinicId}
          creadoPor={auth.currentUser?.uid ?? ''}
          prefill={{
            patientId,
            patientNombre: patient?.nombre,
            medicoId: auth.currentUser?.uid,
            medicoNombre: config?.nombreMedico,
            concepto: 'consulta',
          }}
          onClose={() => {
            setCobrar(false)
            // Fluidez: si la consulta dejó medicamentos, encadena directo a la
            // RECETA (acabas de prescribir → imprímela); si no, al expediente.
            const nid = notaId || notaIdRef.current
            router.push(internamientoActivo ? `/hospitalizacion/${internamientoActivo}` : medicamentos.length > 0 && nid ? `/receta/${patientId}/${nid}` : `/expediente/${patientId}`)
          }}
        />
      )}

      {/* Control flotante de grabación — visible desde cualquier parte (manos libres / celular) */}
      {(voz.grabando || audio.estado === 'grabando') && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 'calc(84px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 24px)',
          background: 'var(--s1)', border: '1px solid var(--border2, var(--border))',
          borderRadius: 999, padding: '8px 8px 8px 16px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            Grabando · {modoVoz === 'vivo'
              ? mmss
              : `${String(Math.floor(audio.duracion / 60)).padStart(2, '0')}:${String(audio.duracion % 60).padStart(2, '0')}`}
          </span>
          <button
            onClick={async () => { if (modoVoz === 'vivo') voz.detener(); else await audio.detener() }}
            className="btn btn-primary btn-sm"
            style={{ borderRadius: 999, flexShrink: 0 }}
          >
            <Square size={13} fill="currentColor" /> Detener y generar nota
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } }
        @media print { button, textarea:disabled { display: none; } }
      `}</style>
    </div>
  )
}

