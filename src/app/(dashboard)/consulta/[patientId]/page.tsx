'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import { getPatients } from '@/lib/firestore'
import { useGrabacionVoz } from '@/hooks/useGrabacionVoz'
import { useGrabacionAudio } from '@/hooks/useGrabacionAudio'
import {
  createNota, updateNota, getNota, deleteNota, getUltimasNotasResumen,
} from '@/lib/expediente/firestore'
import { seccionesVacias, requiereSignosVitales, esPreoperatoria } from '@/lib/expediente/templates'
import { PreopAssessment } from '@/components/PreopAssessment'
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
import { generarHashIntegridad, generarHashFirma } from '@/lib/expediente/integrity'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { TipoNota, NotaMedica, NotaSeccion, Diagnostico, Medicamento, SignosVitales } from '@/types/expediente'
import type { Patient } from '@/types'
import { Cie10Autocomplete } from '@/components/Cie10Autocomplete'
import { CobrarModal } from '@/components/CobrarModal'
import {
  ArrowLeft, Mic, Square, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Trash2, Plus, ShieldCheck, Pill, Stethoscope, FileSignature,
  Lock, Bug, FlaskConical, Lightbulb, FileText, ChevronDown, ChevronUp, Volume2,
} from 'lucide-react'

const TIPOS: TipoNota[] = ['primera_vez', 'seguimiento', 'historia_clinica', 'valoracion_preoperatoria', 'alta_consulta', 'ingreso', 'evolucion', 'egreso']

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
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const { toast } = useToast()
  const voz = useGrabacionVoz()
  const audio = useGrabacionAudio()
  // 'vivo' = Web Speech (Chrome/Edge desktop) — transcribe en tiempo real
  // 'whisper' = MediaRecorder → /api/expediente/transcribir — funciona en TODOS los dispositivos
  const [modoVoz, setModoVoz] = useState<'vivo' | 'whisper'>(voz.soportado ? 'vivo' : 'whisper')

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
  const [tipo, setTipo] = useState<TipoNota>('primera_vez')
  // Especialidad de ESTA nota (la IA la estructura según esto). Default: la del médico.
  const [especialidadNota, setEspecialidadNota] = useState('')
  const especialidadEfectiva = especialidadNota || config?.especialidad || ''
  const [secciones, setSecciones] = useState<NotaSeccion[]>(seccionesVacias('primera_vez'))
  const [signos, setSignos] = useState<SignosVitales>({})
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [resumen, setResumen] = useState('')
  const [procesando, setProcesando] = useState(false)
  // Material de origen (dictado): colapsado por defecto: NO forma parte de la nota
  const [verFuente, setVerFuente] = useState(false)
  // Red de seguridad local: respaldo de la nota en el navegador (anti-pérdida)
  const [respaldoDisponible, setRespaldoDisponible] = useState(false)
  // NOTA EN TIEMPO REAL: la nota se va armando mientras hablas (cada ~30s).
  const [notaEnVivo, setNotaEnVivo] = useState(true)
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
    getPatients(clinicId).then(ps => setPatient(ps.find(p => p.id === patientId) ?? null))
    getUltimasNotasResumen(clinicId, patientId).then(r => { ultimasNotasRef.current = r; setContextoPrevio(r) })
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
    })
  }, [clinicId, patientId, notaIdParam]) // eslint-disable-line

  // ── Cambiar tipo de nota → reset de secciones ──────────────────
  // ── Procesar transcripción con IA ──────────────────────────────
  // El dictado es la FUENTE DE VERDAD: se puede re-proyectar a cualquier
  // modalidad de nota pasando tipoOverride (lo usa cambiarTipo).
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
      ? audio.utterances.map(u => `Hablante ${u.speaker}: ${u.text}`).join('\n')
      : voz.transcripcion
    if (enVivo) { vivoRef.current = true; setEstructurandoVivo(true) } else setProcesando(true)
    try {
      const res = await fetchAutenticado('/api/expediente/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripcion: transcripcionParaIA,
          tipo: tipoActivo,
          contexto: {
            nombre: patient?.nombre ?? '',
            edad: patient?.edad,
            sexo: patient?.sexo,
            alergias: patient?.alergias,
            notasPrevias: ultimasNotasRef.current,
            especialidad: especialidadEfectiva,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!data) { if (!enVivo) toast('La IA no respondió correctamente. Tu nota NO se modificó; intenta de nuevo.', 'error'); return }
      if (!data.ok) {
        if (!enVivo) toast(data.error === 'ANTHROPIC_API_KEY no configurada en el servidor'
          ? 'Falta configurar la API key de Claude en Vercel'
          : `Error de IA: ${data.error}`, 'error')
        return
      }
      // Mapear respuesta a estado.
      // REGLA ANTI-PÉRDIDA: en un "Procesar con IA" normal SOLO se sobreescribe lo
      // que la IA realmente devolvió; NUNCA se borra lo que ya había. Solo al
      // RE-PROYECTAR a otra modalidad (tipoOverride) se parte de plantilla limpia.
      const esPreop = tipoActivo === 'valoracion_preoperatoria'

      if (data.resumenEjecutivo?.trim()) setResumen(data.resumenEjecutivo)
      else if (tipoOverride) setResumen('')

      // La transcripción cruda NUNCA se vuelca dentro de la nota (es material de origen).
      setSecciones(prev => {
        const base = tipoOverride ? seccionesVacias(tipoActivo) : prev
        return base.map(s => {
          const valorIA = data.secciones?.[s.key]
          return (typeof valorIA === 'string' && valorIA.trim()) ? { ...s, value: valorIA } : s
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
      }
    } catch {
      if (!enVivo) toast('Error al conectar con la IA', 'error')
    } finally {
      if (enVivo) { vivoRef.current = false; setEstructurandoVivo(false) }
      else setProcesando(false)
    }
  }, [voz.transcripcion, audio.utterances, tipo, patient, toast, especialidadEfectiva])

  // Auto-procesa UNA vez cuando llega la transcripción final (flujo "Conversación
  // completa"): graba → detén → la nota se estructura sola, sin un toque extra.
  useEffect(() => {
    if (autoProcRef.current && voz.transcripcion.trim() && !procesando && !firmada) {
      autoProcRef.current = false
      procesarIA()
    }
  }, [voz.transcripcion, procesando, firmada, procesarIA])

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
      if (palabras - palabrasEstructuradasRef.current >= 25) {   // ~25 palabras nuevas
        palabrasEstructuradasRef.current = palabras
        procesarIARef.current(undefined, { enVivo: true })
      }
    }, 30000)
    return () => clearInterval(t)
  }, [voz.grabando, audio.estado, notaEnVivo, firmada])

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
  }, [notaId, clinicId, patientId, patient, tipo, config, resumen, secciones, signos, diagnosticos, medicamentos, preop, extraction, safety, aprobados, voz.transcripcion, audio.utterances])

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
      router.push(`/expediente/${patientId}`)
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
  const respaldoKey = `nx.consulta.bkp.${patientId}`
  useEffect(() => {
    if (firmada) return
    const hayContenido = resumen.trim() || secciones.some(s => s.value?.trim()) ||
      diagnosticos.length > 0 || medicamentos.length > 0
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

  // Al abrir: si hay respaldo local y el formulario está vacío, ofrécelo.
  useEffect(() => {
    if (!patientId) return
    try { if (localStorage.getItem(respaldoKey)) setRespaldoDisponible(true) } catch { /* */ }
  }, [patientId, respaldoKey])

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
        metadata: { ...notaParaValidar.metadata, hashIntegridad, fechaModificacion: now },
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
      // Nota firmada → ofrecer el cobro aquí mismo (cómo pagó y cuánto).
      // Al registrar u omitir, el modal cierra y de ahí se va al expediente.
      setCobrar(true)
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

  const validacion = validarNOM004(construirNota('borrador'))
  const mmss = `${String(Math.floor(voz.duracion / 60)).padStart(2, '0')}:${String(voz.duracion % 60).padStart(2, '0')}`

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <button onClick={() => router.push(`/expediente/${patientId}`)} style={S.back}>
        <ArrowLeft size={15} /> Expediente
      </button>

      {/* Alergias banner permanente */}
      {patient?.alergias && (
        <div style={S.alergia}>
          <AlertTriangle size={16} /> <strong>ALERGIA:</strong> {patient.alergias}
        </div>
      )}

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

          {/* Nota en tiempo real (se arma mientras hablas) */}
          <button
            type="button"
            onClick={() => setNotaEnVivo(v => !v)}
            title="La nota se va armando sola mientras grabas (cada ~30s)"
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 100, cursor: 'pointer',
              border: '1px solid ' + (notaEnVivo ? 'var(--nexus)' : 'var(--border)'),
              background: notaEnVivo ? 'rgba(61,90,254,0.12)' : 'var(--s2)',
              color: notaEnVivo ? 'var(--nexus)' : 'var(--text3)',
            }}
          >
            <Sparkles size={13} /> Nota en vivo {notaEnVivo ? 'ON' : 'OFF'}
            {estructurandoVivo && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          </button>
        </div>
      )}

      {/* ── Grabación ── */}
      {!firmada && (
        <div style={S.grabCard}>
          {/* Selector de modo de captura */}
          {(voz.soportado || audio.soportado) && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
              {voz.soportado && (
                <button
                  onClick={() => setModoVoz('vivo')}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 12.5, fontWeight: 600,
                    background: modoVoz === 'vivo' ? 'var(--teal)' : 'transparent',
                    color: modoVoz === 'vivo' ? '#040b12' : 'var(--text3)',
                    border: 'none', borderRadius: 7, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Mic size={13} className="ds-icon" /> Dictado en vivo
                </button>
              )}
              {audio.soportado && (
                <button
                  onClick={() => setModoVoz('whisper')}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 12.5, fontWeight: 600,
                    background: modoVoz === 'whisper' ? 'var(--teal)' : 'transparent',
                    color: modoVoz === 'whisper' ? '#040b12' : 'var(--text3)',
                    border: 'none', borderRadius: 7, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Mic size={13} className="ds-icon" /> Conversación completa
                </button>
              )}
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
                  Capta sobre todo tu voz · para grabar también al paciente usa “Conversación completa” · Ctrl/Cmd+R
                </div>
              </div>
              <button onClick={() => procesarIA()} disabled={procesando || !voz.transcripcion.trim()} style={S.iaBtn(procesando || !voz.transcripcion.trim())}>
                {procesando ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Claude estructurando…</> : <><Sparkles size={16} /> Procesar con IA</>}
              </button>
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
                        {(audio.bytesGrabados / 1024 / 1024).toFixed(1)} / 25 MB · 48kHz/128kbps
                      </span>
                    </div>
                  </div>
                )}
                {audio.estado !== 'grabando' && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                    Capta a los dos · HIFI 48kHz · gpt-4o-transcribe · vocabulario médico ampliado
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
              <button onClick={() => procesarIA()} disabled={procesando || !voz.transcripcion.trim()} style={S.iaBtn(procesando || !voz.transcripcion.trim())}>
                {procesando ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Claude estructurando…</> : <><Sparkles size={16} /> Procesar con IA</>}
              </button>
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
                  <DialogoDiarizado utterances={audio.utterances} />
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

      {/* ── Resumen ejecutivo ── */}
      {resumen && (
        <div style={S.resumen}>
          <Sparkles size={14} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>{resumen}</span>
        </div>
      )}

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
          onClose={() => { setCobrar(false); router.push(`/expediente/${patientId}`) }}
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
function DialogoDiarizado({ utterances }: { utterances: { speaker: string; text: string }[] }) {
  const [roles, setRoles] = useState<Record<string, string>>({})
  const hablantes = Array.from(new Set(utterances.map(u => u.speaker)))
  const ROLES = ['Médico', 'Paciente', 'Acompañante']
  const etiqueta = (s: string) => roles[s] || `Hablante ${s}`

  return (
    <div style={{ marginTop: 4 }}>
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
                  <button key={r} type="button" onClick={() => setRoles(p => ({ ...p, [s]: r }))}
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
