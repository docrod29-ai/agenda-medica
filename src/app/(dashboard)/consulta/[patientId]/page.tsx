'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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
import {
  ArrowLeft, Mic, Square, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Trash2, Plus, ShieldCheck, Pill, Stethoscope, FileSignature,
  Lock, Bug, FlaskConical, Lightbulb, FileText, ChevronDown, ChevronUp, Volume2, BedDouble,
} from 'lucide-react'

const TIPOS: TipoNota[] = ['primera_vez', 'seguimiento', 'historia_clinica', 'valoracion_preoperatoria', 'valoracion_inmuno', 'alta_consulta', 'ingreso', 'evolucion', 'egreso', 'nota_postoperatoria', 'nota_anestesia', 'consentimiento']

// Menú de IA: motores que el médico elige por nota (⚡ barato → 💎 máximo).
const MOTORES_UI: { clave: ClaveMotor; emoji: string; nombre: string; creditos: number; desc: string }[] = [
  { clave: 'rapida',   emoji: '⚡', nombre: 'Rápida',   creditos: MOTORES.rapida.creditos,   desc: 'Haiku · seguimiento simple' },
  { clave: 'estandar', emoji: '⭐', nombre: 'Estándar', creditos: MOTORES.estandar.creditos, desc: 'Sonnet + voces · el día a día' },
  { clave: 'maxima',   emoji: '💎', nombre: 'Máxima',   creditos: MOTORES.maxima.creditos,   desc: 'Opus + GPT-5 · caso complejo' },
]

// Especialidades con plantilla de enfoque (deben contener la clave que detecta
// guiaEspecialidad en prompts.ts: cardiolog, pediatr, ginec, interna, urgenc…).
const ESPECIALIDADES = [
  'Cardiología', 'Pediatría', 'Ginecología y Obstetricia', 'Medicina Interna',
  'Urgencias', 'Infectología', 'Cirugía General', 'Psiquiatría', 'Dermatología',
  'Ortopedia y Traumatología', 'Endocrinología', 'Neurología', 'Neumología',
  'Gastroenterología', 'Nefrología', 'Oncología',
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
  const { toast } = useToast()
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
  useEffect(() => {
    if (audio.estado === 'listo' && audio.transcripcion) {
      voz.setTranscripcion(audio.transcripcion)
      autoProcRef.current = true
    }
  }, [audio.estado, audio.transcripcion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Texto en vivo del streaming (mientras graba) también va al editor — el médico
  // ve la transcripción aparecer sin esperar al final.
  useEffect(() => {
    if (audio.estado === 'grabando' && audio.transcripcionParcial) {
      voz.setTranscripcion(audio.transcripcionParcial)
    }
  }, [audio.estado, audio.transcripcionParcial]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
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
  const [notaId, setNotaId] = useState<string | null>(notaIdParam)
  // Ref síncrona del notaId + cadena de guardados serializada: evita que dos
  // autoguardados creen notas DUPLICADAS (setNotaId es asíncrono).
  const notaIdRef = useRef<string | null>(notaIdParam)
  useEffect(() => { notaIdRef.current = notaId }, [notaId])
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
        diagnosticos, medicamentos, signos,
      },
      voz.transcripcion,
    )
  }, [verificarNota, resumen, secciones, diagnosticos, medicamentos, signos, voz.transcripcion])

  // Análisis basado en evidencia: cruza dx + tratamiento contra PubMed y razona
  // con citas reales (NEJM/JAMA/Cochrane…). A demanda (botón).
  const analizarEvidencia = useCallback(async () => {
    if (diagnosticos.length === 0 && medicamentos.length === 0) { toast('Agrega al menos un diagnóstico o medicamento primero', 'info'); return }
    setAnalizandoEv(true); setEvidencia(null)
    try {
      const res = await fetchAutenticado('/api/expediente/evidencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosticos: diagnosticos.map(d => ({ descripcion: d.descripcion })),
          medicamentos: medicamentos.map(m => ({ nombre: m.nombre })),
          contexto: { edad: patient?.edad, sexo: patient?.sexo, alergias: patient?.alergias },
        }),
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) setEvidencia({ articulos: data.articulos ?? [], evaluacion: data.evaluacion ?? [], alternativas: data.alternativas ?? [], diferencial: data.diferencial ?? [], aviso: data._aviso })
      else toast(data?.error || 'No se pudo analizar la evidencia', 'error')
    } catch { toast('Sin conexión con el motor de evidencia', 'error') }
    finally { setAnalizandoEv(false) }
  }, [diagnosticos, medicamentos, patient?.edad, patient?.sexo, patient?.alergias, toast])

  // Genera un ANÁLISIS clínico basado en evidencia de ESTE paciente (razonando
  // con PubMed vía el Consultor) y lo AGREGA a la nota como una sección de texto
  // limpio (sin markdown), con sus referencias. Reemplaza el análisis previo.
  const agregarAnalisisANota = useCallback(async () => {
    if (diagnosticos.length === 0 && medicamentos.length === 0) { toast('Agrega diagnóstico o tratamiento primero', 'info'); return }
    setGenerandoAnalisis(true)
    try {
      const dx = diagnosticos.map(d => d.descripcion).filter(Boolean).join('; ')
      const meds = medicamentos.map(m => m.nombre).filter(Boolean).join('; ')
      const pregunta = `Análisis clínico y plan basado en la MEJOR evidencia, conciso y sin relleno. Diagnóstico(s): ${dx || '—'}. Tratamiento actual: ${meds || '—'}. Evalúa si el tratamiento es el adecuado según la evidencia, señala alternativas si aplica, dosis y puntos de seguridad (interacciones/contraindicaciones). No repitas la historia clínica.`
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
            nombre: patient?.nombre ?? '',
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
      if (!enVivo) { setSinCreditos(null); setModoEco(!!data._modoEconomico); if (data._motor) setMotorUsado(data._motor as ClaveMotor) }  // éxito → limpia aviso; marca modo económico + motor usado
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
  const cambiarTipo = (t: TipoNota) => {
    if (firmada || t === tipo) return
    const hayDictado = voz.transcripcion.trim().length > 0
    const hayContenido = secciones.some(s => s.value?.trim()) ||
      diagnosticos.length > 0 || medicamentos.length > 0 || resumen.trim().length > 0
    // SIEMPRE confirma si hay algo escrito — cambiar de modalidad vacía las secciones.
    if (hayContenido && !window.confirm(
      hayDictado
        ? `Se reestructurará la nota como "${TIPO_NOTA_LABEL[t]}" desde el dictado. El contenido actual se reemplazará. ¿Continuar?`
        : `Cambiar a "${TIPO_NOTA_LABEL[t]}" vaciará las secciones actuales. ¿Continuar?`
    )) return
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
      signosVitales: signos,
      diagnosticos,
      medicamentos,
      alergias: patient?.alergias
        ? [{ alergeno: patient.alergias, tipo: 'medicamento', reaccion: 'Ver expediente', severidad: 'moderada', confirmada: true }]
        : [],
      estudiosOrden: estudiosOrden.length ? estudiosOrden : undefined,
      internamientoId: internamientoActivo,
      preop,
      iaAuditoria: extraction || safety ? {
        extraction, safety,
        aprobadosPorMedico: Array.from(aprobados),
        procesadoEn: now,
        aprobadoPor: estado === 'firmada' ? (auth.currentUser?.email ?? '') : undefined,
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
        if (!silencioso) toast('Borrador guardado', 'success')
      } catch (e) {
        console.error('[consulta] error guardando borrador:', e)
        if (!silencioso) toast('Error al guardar el borrador', 'error')
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
    const confirmar = window.confirm('¿Descartar esta consulta? Se eliminará y no podrás recuperarla.')
    if (!confirmar) return
    setGuardando(true)
    try {
      if (clinicId && notaId) {
        await deleteNota(clinicId, patientId, notaId)
      }
      try { localStorage.removeItem(respaldoKey) } catch { /* */ }
      toast('Consulta descartada', 'info')
      router.push(volverA)
    } catch (e) {
      console.error('[consulta] error al descartar:', e)
      toast('Error al descartar', 'error')
      setGuardando(false)
    }
  }, [firmada, clinicId, notaId, patientId, router, toast])

  // ── Autoguardado cada 30s ──────────────────────────────────────
  useEffect(() => {
    if (firmada) return
    const t = setInterval(() => { if (resumen || secciones.some(s => s.value)) guardarBorrador(true) }, 30000)
    return () => clearInterval(t)
  }, [firmada, resumen, secciones, guardarBorrador])

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
      try {
        localStorage.setItem(respaldoKey, JSON.stringify({
          tipo, resumen, secciones, signos, diagnosticos, medicamentos,
          transcripcion: voz.transcripcion, ts: Date.now(),
        }))
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
      try { const raw = localStorage.getItem(respaldoKey); if (raw) { b = JSON.parse(raw); setRespaldoDisponible(true) } } catch { /* */ }
    }
    if (!b) return
    const vacio = !resumen.trim() && !secciones.some(s => s.value?.trim()) &&
      diagnosticos.length === 0 && medicamentos.length === 0 && !voz.transcripcion.trim()
    if (notaIdParam || !vacio) return   // abriendo otra nota o ya hay contenido → no pisar
    autoRestRef.current = true
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
    else borradorMem.escribir(respaldoKey, { tipo: e.tipo, resumen: e.resumen, secciones: e.secciones, signos: e.signos, diagnosticos: e.diagnosticos, medicamentos: e.medicamentos, transcripcion: e.transcripcion })
  })
  const flushRespaldo = useCallback(() => {
    const e = estadoVivoRef.current
    if (e.firmada) return
    const hay = e.resumen?.trim() || e.secciones?.some(s => s.value?.trim()) || e.diagnosticos?.length || e.medicamentos?.length || e.transcripcion?.trim()
    if (!hay) return
    try {
      localStorage.setItem(respaldoKey, JSON.stringify({
        tipo: e.tipo, resumen: e.resumen, secciones: e.secciones, signos: e.signos,
        diagnosticos: e.diagnosticos, medicamentos: e.medicamentos, transcripcion: e.transcripcion, ts: Date.now(),
      }))
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

  const restaurarRespaldo = () => {
    try {
      const raw = localStorage.getItem(respaldoKey)
      if (!raw) { setRespaldoDisponible(false); return }
      const b = JSON.parse(raw)
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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'r') { e.preventDefault(); voz.grabando ? voz.detener() : iniciarGrabacion() }
      if (e.key === 'p') { e.preventDefault(); procesarIA() }
      if (e.key === 'Enter') { e.preventDefault(); firmar() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [voz, procesarIA, firmar])

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
        diagnosticos, medicamentos, alergias: [], signosVitales: signos,
      }
      const res = await fetchAutenticado('/api/expediente/corregir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, instruccion: instr, contexto: { nombre: patient?.nombre, edad: patient?.edad, sexo: patient?.sexo } }),
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
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
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
            {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
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
                  <button className="btn btn-sm btn-ghost" onClick={() => { audio.reset(); setOfreceRecovery(false) }}>
                    Descartar
                  </button>
                </div>
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
                  <DialogoDiarizado utterances={audio.utterances} rolesIniciales={rolesHablante} />
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

      {/* Análisis de evidencia → SE AGREGA A LA NOTA (botón principal) */}
      {(diagnosticos.length > 0 || medicamentos.length > 0) && (
        <button onClick={agregarAnalisisANota} disabled={generandoAnalisis}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, marginRight: 8, background: generandoAnalisis ? 'var(--s3)' : 'var(--teal)', color: generandoAnalisis ? 'var(--text3)' : '#000', border: 'none', borderRadius: 10, padding: '9px 15px', fontSize: 13, fontWeight: 700, cursor: generandoAnalisis ? 'default' : 'pointer' }}>
          {generandoAnalisis
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Razonando con la evidencia…</>
            : <><FlaskConical size={14} /> Análisis de evidencia → agregar a la nota</>}
        </button>
      )}

      {/* Preguntar a la evidencia sobre ESTE paciente (abre el Consultor con contexto) */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || resumen) && (
        <button onClick={() => router.push(`/consultor?paciente=${patientId}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, marginRight: 8, background: 'rgba(61,90,254,0.08)', color: 'var(--nexus, #3d5afe)', border: '1px solid rgba(61,90,254,0.30)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FlaskConical size={14} /> Preguntar a la evidencia (chat)
        </button>
      )}

      {/* ── Análisis basado en evidencia (PubMed) ── */}
      {(diagnosticos.length > 0 || medicamentos.length > 0) && !evidencia && (
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
              <button onClick={analizarEvidencia} disabled={analizandoEv} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>↻ actualizar</button>
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

      {/* ── Signos vitales ── */}
      {requiereSignosVitales(tipo) && (
        <Section title="Signos vitales" icon={<Stethoscope size={15} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10 }}>
            {([['ta', 'TA', '120/80'], ['fc', 'FC', 'lpm'], ['fr', 'FR', 'rpm'], ['temperatura', 'T°', '°C'], ['spo2', 'SpO₂', '%'], ['peso', 'Peso', 'kg'], ['talla', 'Talla', 'cm']] as const).map(([k, label, ph]) => (
              <div key={k}>
                <label style={S.miniLabel}>{label}</label>
                <input
                  value={(signos[k] as string | number | undefined) ?? ''}
                  onChange={e => setSignos(s => ({ ...s, [k]: k === 'ta' ? e.target.value : (e.target.value ? Number(e.target.value) : undefined) }))}
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
          position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 200,
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

// ── Subcomponentes ─────────────────────────────────────────────
// Paleta estable por hablante (A, B, C…) para diferenciar voces visualmente.
const COLOR_HABLANTE = ['#3D5AFE', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4']
function colorHablante(speaker: string): string {
  const idx = speaker.charCodeAt(0) - 65 // 'A' → 0
  return COLOR_HABLANTE[((idx % COLOR_HABLANTE.length) + COLOR_HABLANTE.length) % COLOR_HABLANTE.length]
}

/** Diálogo separado por voz (diarización). El médico puede etiquetar cada voz
 *  (Médico/Paciente/Acompañante) de un toque; es material de origen. */
function DialogoDiarizado({ utterances, rolesIniciales }: { utterances: { speaker: string; text: string }[]; rolesIniciales?: Record<string, string> }) {
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [tocado, setTocado] = useState(false)  // el médico ya corrigió a mano → no pisar
  // Siembra los roles que asignó la IA en cuanto llegan (sin pisar correcciones manuales).
  useEffect(() => {
    if (tocado || !rolesIniciales || Object.keys(rolesIniciales).length === 0) return
    setRoles(rolesIniciales)
  }, [rolesIniciales, tocado])
  const hablantes = Array.from(new Set(utterances.map(u => u.speaker)))
  const ROLES = ['Médico', 'Paciente', 'Acompañante']
  const etiqueta = (s: string) => roles[s] || `Hablante ${s}`
  const autoAsignado = !tocado && rolesIniciales && Object.keys(rolesIniciales).length > 0

  return (
    <div style={{ marginTop: 4 }}>
      {autoAsignado && (
        <div style={{ fontSize: 10.5, color: 'var(--teal)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={11} /> Médico y paciente asignados automáticamente · toca para corregir si hace falta
        </div>
      )}
      {/* Asignar quién es cada voz */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {hablantes.map(s => {
          const c = colorHablante(s)
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `${c}1f`, borderRadius: 6, padding: '2px 8px' }}>
                Hablante {s}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>es:</span>
              {ROLES.map(r => {
                const activo = roles[s] === r
                return (
                  <button key={r} type="button" onClick={() => { setTocado(true); setRoles(p => ({ ...p, [s]: r })) }}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 100, cursor: 'pointer',
                      border: '1px solid ' + (activo ? c : 'var(--border)'),
                      background: activo ? `${c}22` : 'var(--s2)',
                      color: activo ? c : 'var(--text3)',
                    }}>
                    {r}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Diálogo con el rol asignado */}
      <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 8 }}>
        {utterances.map((u, i) => {
          const c = colorHablante(u.speaker)
          return (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <span style={{
                flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: c,
                background: `${c}1f`, borderRadius: 6, padding: '2px 7px', height: 'fit-content',
              }}>
                {etiqueta(u.speaker)}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{u.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Section({ title, icon, obligatorio, children }: { title: string; icon?: React.ReactNode; obligatorio?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--teal)' }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {obligatorio && <span style={{ color: '#f87171', fontSize: 13 }}>*</span>}
      </div>
      {children}
    </div>
  )
}

const S = {
  back: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 14, padding: 0 } as React.CSSProperties,
  alergia: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 } as React.CSSProperties,
  firmadaBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(61,90,254,0.12)', color: 'var(--teal)', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 100 } as React.CSSProperties,
  grabCard: { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 } as React.CSSProperties,
  transcripcion: { width: '100%', marginTop: 14, minHeight: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties,
  resumen: { display: 'flex', gap: 8, background: 'rgba(61,90,254,0.06)', border: '1px solid rgba(61,90,254,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 18 } as React.CSSProperties,
  textarea: { width: '100%', minHeight: 70, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties,
  input: { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
  miniLabel: { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 } as React.CSSProperties,
  miniInput: { width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
  row: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' } as React.CSSProperties,
  del: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 6, flexShrink: 0 } as React.CSSProperties,
  addBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px dashed var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' } as React.CSSProperties,
  chip: (a: boolean): React.CSSProperties => ({ background: a ? 'var(--teal)' : 'var(--s2)', color: a ? '#000' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }),
  iaBtn: (d: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 7, background: d ? 'var(--s3)' : 'var(--nexus)', color: d ? 'var(--text3)' : '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: d ? 'default' : 'pointer', letterSpacing: '-0.005em' }),
  valBox: (t: 'error' | 'warn'): React.CSSProperties => ({ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, background: t === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${t === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, color: t === 'error' ? '#f87171' : '#f59e0b', borderRadius: 8, padding: '12px 14px', fontSize: 12.5 }),
  firmar: (d: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, background: d ? 'var(--s3)' : 'var(--teal)', color: d ? 'var(--text3)' : '#000', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 15, fontWeight: 700, cursor: d ? 'default' : 'pointer' }),
  guardar: { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '13px 18px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
  descartar: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 10, padding: '13px 16px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
}
