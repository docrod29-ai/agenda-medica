'use client'
import { useState, useEffect, useCallback, useMemo, useRef, type ComponentProps } from 'react'
import { labsDesdeEstudios } from '@/lib/expediente/labs-desde-texto'
import { formatDateMX } from '@/lib/availability'
import { conViaAsumida, avisoDeViaAsumida } from '@/lib/expediente/via-asumida'
import { revisarUnidadDosis } from '@/lib/seguridad/dosis'
import { DOSIS_DESCONOCIDA, esDosisDeclaradaDesconocida } from '@/lib/seguridad/dosis-desconocida'
import { filtrarHerramientas } from '@/lib/herramientas-por-especialidad'
import { especialidadesDelMedico } from '@/lib/asr/especialidad-del-medico'
import { paresDeUnaNota, loAprendido, partesDelNombre, fusionar, type Aprendido } from '@/lib/asr/aprendizaje'
import { leerAprendido, acumular } from '@/lib/asr/aprendizaje-firestore'
import { HistorialVersiones } from '@/components/HistorialVersiones'
import { sugerenciasPendientes, resolverSugerencias, lineasSugeridas } from '@/lib/expediente/sugerencias-ia'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { VolverALaFuente } from '@/components/lente/VolverALaFuente'
import { useBorrador } from '@/context/BorradorContext'
import { useTarea } from '@/context/TareasContext'
import { useConfig } from '@/hooks/useConfig'
import { usePatientAppointments } from '@/hooks/useAppointments'
import { hoyISO } from '@/lib/timezone'
import type { Appointment, AlergiaEstructurada } from '@/types'
import { useToast } from '@/context/ToastContext'
import { leerNdjson } from '@/lib/ndjson'
import { parsearAlergiasTexto } from '@/lib/seguridad/alergias'
import { corregirViaParenteral } from '@/lib/expediente/via-parenteral'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, type DocumentSnapshot } from 'firebase/firestore'
import { getPatient, getPatients, updatePatient, updateAppointment, saveConfigPartial } from '@/lib/firestore'
import { useGrabacionVoz } from '@/hooks/useGrabacionVoz'
import { useGrabacionAudio, type Utterance } from '@/hooks/useGrabacionAudio'
import { useComandoVoz } from '@/hooks/useComandoVoz'
import { ofuscar, desofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'
import { borradoresBloqueados } from '@/lib/mobile/local-drafts'
import { EVENTO_GUARDAR_TODO } from '@/lib/salir-seguro'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useAvisoAlSalirGrabando } from '@/hooks/useAvisoAlSalirGrabando'
import { usePorcupineComando, type PicovoiceConfig } from '@/hooks/usePorcupineComando'
import {
  createNota, updateNota, getNota, getNotas, deleteNota, getUltimasNotasResumen,
} from '@/lib/expediente/firestore'
import { seccionesDelTipo, seccionesVacias, requiereSignosVitales, esPreoperatoria, esInmuno } from '@/lib/expediente/templates'
import { sanitizarProsa } from '@/lib/expediente/sanitizar-prosa'
import { limpiarMarkdown } from '@/lib/markdown'
import { MOTORES, type ClaveMotor } from '@/lib/planes-ia'
import { AntesDeFirmar } from '@/components/AntesDeFirmar'
import { construirAvisos } from '@/lib/expediente/avisos-consulta'
import { frasesDeFamiliar } from '@/lib/expediente/experienciador'
import { frasesInciertas } from '@/lib/expediente/certeza'
import { afirmacionesSinRespaldo } from '@/lib/expediente/trazabilidad'
import { textoDeLaNota } from '@/lib/expediente/texto-de-la-nota'
import { SelloProcedencia } from '@/components/SelloProcedencia'
import { DeDondeSalioEsto } from '@/components/DeDondeSalioEsto'
import { HojaParaElPaciente } from '@/components/HojaParaElPaciente'
import { PlanPorProblema } from '@/components/PlanPorProblema'
import { ComoCerrarLaConsulta } from '@/components/ComoCerrarLaConsulta'
import { CierreAlPulgar, cierreAlPulgarVisible } from '@/components/CierreAlPulgar'
import { queFaltaParaCerrar, aDondeIrDirecto } from '@/lib/expediente/que-falta-para-cerrar'
import { leerHechosDeCierre, marcarHechoDeCierre, guardarSeguimientoDeCierre, leerSeguimientoDeCierre } from '@/lib/expediente/cierre-hechos'
import { queCambioEnLasCifras, loQueSeLlevoPorDelante } from '@/lib/seguridad/la-reescritura-no-pierde-cifras'
import { construirManifiesto, camposSinEvidencia, notaParaElSello } from '@/lib/expediente/procedencia'

/**
 * Alergias del paciente (texto libre) → lista para el sello de procedencia.
 *
 * Usa el MISMO partidor que el cruce de seguridad. Había dos: éste cortaba por
 * `[,;\n]` y `parsearAlergiasTexto` por `[,;/]`, así que «Penicilina / Sulfas»
 * era una alergia para el sello y dos para la alerta. El mismo campo no puede
 * significar dos cosas según quién lo lea.
 */
/*
 * `textoDeLaNota` VIVÍA AQUÍ y se mudó a `lib/expediente/texto-de-la-nota.ts`.
 *
 * No por limpieza: `/expediente` necesita el MISMO texto para contrastar una
 * nota archivada contra su dictado (§21). Dos copias serían dos definiciones de
 * qué es «la nota» para el mismo motor de trazabilidad, y la que se quedara
 * atrás mentiría en silencio. El porqué del formato —y el defecto de
 * `[object Object]` que lo originó— está escrito en su casa nueva.
 */

/**
 * ── EL SELLO DE PROCEDENCIA CONTABA CERO ALERGIAS — REG-278 ──────────────────
 *
 * Recibía `alergias?: string` y llamaba a `parsearAlergiasTexto`, que mira
 * **sólo el texto libre**. Un paciente cuya alergia vive en
 * `alergiasEstructuradas` —que es donde la deja el registro estructurado—
 * sellaba una lista vacía.
 *
 * La compuerta que bloquea la firma ya se había reparado (usa `alergiasDe`).
 * Esto es el **sello de procedencia**, que dice de dónde salió cada dato de la
 * nota: contando cero, dejaba la alergia fuera de `camposSinEvidencia`. El
 * registro medicolegal quedaba diciendo que ahí no había nada que respaldar.
 *
 * Es el mismo defecto de siempre —**dos lecturas del mismo campo**— sobrevivido
 * en un envoltorio de una línea, que es justo donde un guardián que busca
 * `.split(` no mira.
 */
function alergiasArray(p?: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] }): string[] {
  return alergiasDe(p ?? {}).map(a => a.alergeno)
}
import type { NegacionCorregida, AvisoTemporal } from '@/components/NerPanel'
import { CambiosCifrasPanel } from '@/components/CambiosCifrasPanel'
import { CorreccionesPanel } from '@/components/CorreccionesPanel'
import { AlertasDictado } from '@/components/AlertasDictado'
import { Alert, Modal, Button } from '@/components/ui'
import { fetchAutenticado } from '@/lib/auth-client'
import { alergenosDe, alergiasDe } from '@/lib/seguridad/alergias'

import { calculadorasSugeridas } from '@/lib/expediente/calculadoras'

import { vacunasSegunEdad } from '@/lib/expediente/pediatria'




import { Copiloto } from '@/components/Copiloto'
import { cargarPreferencias, registrarAceptacion, type Preferencias } from '@/lib/learning'
import { Herramientas } from '@/components/Herramientas'
import { QueNotaEs } from '@/components/QueNotaEs'
import { MientrasHablas } from '@/components/MientrasHablas'

import type { EntidadesExtraidas } from '@/lib/expediente/medical-ner'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'
import { SelloMotor } from '@/components/SelloMotor'
import { construirPlanPROA } from '@/lib/expediente/proa'
import { logAudit } from '@/lib/expediente/audit-log'
import { validarNOM004 } from '@/lib/expediente/nom004'
import { generarHashIntegridad, generarHashFirma, normalizarParaSello, HASH_VERSION } from '@/lib/expediente/integrity'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import { tiposVisibles } from '@/lib/expediente/tipos-visibles'
import type { TipoNota, NotaMedica, NotaSeccion, Diagnostico, Medicamento, SignosVitales } from '@/types/expediente'
import type { Patient } from '@/types'
import { Cie10Autocomplete } from '@/components/Cie10Autocomplete'
import { precioSugerido } from '@/lib/finanzas/precio-consulta'
import { PanelRazonamiento } from '@/components/PanelRazonamiento'
import { tareasDeNota, tareasDeReconciliacion } from '@/lib/tareas-clinicas/derivar'
import { comoSeDice, discrepanciasDeMedicacion } from '@/lib/tareas-clinicas/reconciliacion'
import { comoSeDice as comoSeDiceVencido, yaDebioTerminar } from '@/lib/expediente/duracion-cumplida'
import { crearTareas } from '@/lib/tareas-clinicas/firestore'
import { DialogoDiarizado, Section, S } from './consulta-ui'
import { medicamentosVigentes, type OrdenVigente } from '@/lib/expediente/ordenes-medicamento'
import { problemasActivos, haceCuanto, type ProblemaVigente } from '@/lib/expediente/problemas-activos'
import { medicacionDelCuadro, problemasDelCuadro } from '@/lib/expediente/cuadro-completo'
import { fusionarDiagnosticos } from '@/lib/expediente/fusionar-diagnosticos'
import { fusionarMedicamentos } from '@/lib/expediente/que-va-en-la-receta'
import { esMonologo, esDictado } from '@/lib/asr/un-solo-hablante'
import { EmpezarAGrabar } from '@/components/EmpezarAGrabar'
import { huellaRevisable, estadoDeRevision, COMO_SE_DICE, type ContenidoRevisable } from '@/lib/expediente/lo-que-se-reviso'
import { mientrasReceta, alFirmar, comoSeDicenAlFirmar } from '@/lib/expediente/cuando-avisar'
import { sinHuecoDeProsa } from '@/lib/expediente/hueco-textual'
import { diagnosticosSanos, medicamentosSanos, seccionesSanas } from '@/lib/expediente/nota-restaurada'
import { quitarDeLaNota, sePuedeQuitar } from '@/lib/expediente/quitar-de-la-nota'
import { motivosParaNoFirmar, porQueNoSePuedeFirmar } from '@/lib/expediente/por-que-no-se-firma'
import { dosisPeligrosasDeLaLista } from '@/lib/seguridad/dosis-de-la-lista'
import { CAMPOS_PREVIOS, AVISO_NO_ES_EXPEDIENTE, resumenPrevio, type FormularioPrevio } from '@/lib/portal/formulario-previo'
import { useDoctors } from '@/hooks/useDoctors'
import { bloqueHospitalDe } from '@/lib/hospital/bloque-nota'
import { getInternamiento } from '@/lib/hospital/firestore'
import { MOTIVO_SIN_DIARIZACION } from '@/lib/expediente/motivo-sin-diarizacion'
import { palabrasDudosas, marcarTurno, paraElMedico, anexoDeDudas, INSTRUCCION_MARCAS } from '@/lib/expediente/confianza-audio'
import { medicamentosSoloPropuestos, estudiosSoloPropuestos } from '@/lib/asr/intencion-de-orden'
import { textosDeMotivos } from '@/lib/expediente/motivos-confirmacion-texto'
import { condicionesNegadas, contradicciones, avisoDeContradiccion } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales, avisoDeDesajuste } from '@/lib/expediente/temporalidad'
import { useFirmaProtegida } from '@/hooks/useFirmaProtegida'
import { comportamientoScroll } from '@/lib/ui/movimiento'
import {
  ArrowLeft, Mic, Square, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Trash2, Plus, ShieldCheck, Pill, Stethoscope, FileSignature, Headphones,
  Lock, Bug, FlaskConical, Lightbulb, FileText, ChevronDown, ChevronUp, Volume2, BedDouble,
  Scissors, Baby, Calculator, Camera, HeartPulse, Brain, MessageSquare,
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
/**
 * Antibiograma dentro de la consulta.
 *
 * Era una pantalla aparte, así que su conclusión —fenotipo, mecanismo, terapia
 * dirigida, aislamiento— había que reescribirla a mano en la nota. Para un
 * infectólogo es la herramienta cuyo resultado más veces tiene que quedar en el
 * expediente. Va con `dynamic` porque arrastra el motor completo y no se necesita
 * en la mayoría de las consultas.
 */
const AntibiogramaTool = dynamic(() => import('@/app/(dashboard)/antibiograma/page').then(m => m.AntibiogramaTool), { ssr: false })
const CalculadorasClinicas = dynamic(() => import('@/components/CalculadorasClinicas').then(m => m.CalculadorasClinicas), { ssr: false })
const FotosClinicas = dynamic(() => import('@/components/FotosClinicas').then(m => m.FotosClinicas), { ssr: false })
/**
 * ── V15-PERF-001, 3ª rebanada: el resto de los paneles CONDICIONALES ─────────
 *
 * El baseline midió /consulta en 734 KB de JS transferido contra ~490 KB de sus
 * hermanas de la cadena clínica, con las long tasks móviles más altas (591–766
 * ms). La atribución en navegador (atribuir-js-consulta-v15.mjs — el bundle
 * analyzer de webpack no corre bajo Turbopack) mostró que el excedente son los
 * chunks exclusivos de la ruta: código compilado de paneles que en una consulta
 * típica NUNCA se montan.
 *
 * Sólo se difieren los que tienen una condición real de montaje — un tipo de
 * nota concreto, un modal abierto, una herramienta desplegada o un resultado de
 * IA que aún no existe al cargar. Los paneles que se montan en toda consulta
 * (Copiloto, AntesDeFirmar, HojaParaElPaciente, HistorialVersiones) se quedan
 * estáticos a propósito: diferirlos no ahorra transferencia — la mueve unos
 * milisegundos después y añade una petición en cascada.
 */
const PreopAssessment = dynamic(() => import('@/components/PreopAssessment').then(m => m.PreopAssessment), { ssr: false })
const ValoracionInmuno = dynamic(() => import('@/components/pacientes/ValoracionInmuno'), { ssr: false })
const CobrarModal = dynamic(() => import('@/components/CobrarModal').then(m => m.CobrarModal), { ssr: false })
const PanelLaboratorios = dynamic(() => import('@/components/laboratorio/PanelLaboratorios').then(m => m.PanelLaboratorios), { ssr: false })
const RevisionPanel = dynamic(() => import('@/components/RevisionPanel').then(m => m.RevisionPanel), { ssr: false })
const NerPanel = dynamic(() => import('@/components/NerPanel').then(m => m.NerPanel), { ssr: false })

const TIPOS: TipoNota[] = ['primera_vez', 'seguimiento', 'historia_clinica', 'valoracion_preoperatoria', 'valoracion_inmuno', 'alta_consulta', 'ingreso', 'evolucion', 'evolucion_uci', 'egreso', 'nota_postoperatoria', 'nota_anestesia', 'consentimiento']

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

/** ¿Hay algún signo vital capturado? Objeto de signos con algún valor no vacío. */
function signosConValor(sv: SignosVitales | undefined | null): boolean {
  return !!sv && Object.values(sv as Record<string, unknown>).some(v => v != null && String(v).trim() !== '')
}

/**
 * Qué decirle al médico según POR QUÉ no hubo separación de voces.
 *
 * Cuatro causas distintas exigen cuatro acciones distintas: una es del
 * proveedor, otra es de configuración, y la del tiempo agotado se resuelve
 * volviendo a intentar. Un mensaje genérico las convierte en «algo falló», que
 * no le dice a nadie qué hacer.
 */
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
  /**
   * ATRÁS DE VERDAD — REG-301.
   *
   * Este botón hacía `router.push(volverA)`: un destino FIJO, y además apilando
   * una entrada nueva en el historial. El médico que entra desde la agenda del
   * día —que es el camino normal, `citas` abre la consulta directamente— salía a
   * `/expediente`, no a su agenda. Y desde el expediente, cuyo atrás sí es
   * inteligente, volvía a la consulta. Quedaba oscilando entre dos pantallas
   * **sin poder regresar a la lista del día**, salvo por la barra lateral, que
   * monta `/citas` de cero y pierde fecha, filtro y búsqueda.
   *
   * `useSmartBack` ya existía y lo usaban diez pantallas. La consulta —la que
   * más falta hacía— era de las pocas que no.
   *
   * El destino fijo se conserva como respaldo: quien llega por enlace directo,
   * recarga o notificación no tiene historial al que volver.
   */
  const volverAtras = useSmartBack(volverA)
  // Llave del respaldo local por paciente Y por episodio (declarada arriba para
  // que `descartar()` pueda listarla en sus deps sin caer en TDZ).
  const respaldoKey = `nx.consulta.bkp.${patientId}${internamientoActivo ? '.h.' + internamientoActivo : ''}`
  const { clinicId } = useClinic()
  const borradorMem = useBorrador()  // almacén EN MEMORIA (sobrevive navegación, sin parpadeo)
  // Tarea de "procesar nota con IA" en el almacén reactivo (sobrevive navegación):
  // si te vas mientras procesa, la petición sigue y su resultado se aplica al
  // volver (o en cuanto llega, si ya volviste). Clave por paciente+episodio.
  const procKey = `procesar.${patientId}${internamientoParam ? '.h.' + internamientoParam : ''}`
  const [tareaProc, setTareaProc] = useTarea<{ ejecutando: boolean; resultado?: { data: Record<string, unknown>; tipoActivo: TipoNota; tipoOverride: boolean; ts: number; notaId: string | null } }>(procKey)
  const resultadoAplicadoRef = useRef(0)
  const { config } = useConfig()
  const { activeDoctors } = useDoctors()
  /**
   * EL EPISODIO, PARA QUE LA NOTA DE HOSPITAL DIGA DÓNDE ESTABA EL PACIENTE.
   *
   * `NotaMedica.hospital` estaba declarado en el modelo Y sellado en el hash de
   * integridad desde que existe el módulo de hospitalización, pero **nadie lo
   * escribía**: se sellaba un hueco. La nota firmada no decía en qué servicio ni
   * en qué cama estaba el paciente, ni qué día de internamiento era — datos que
   * la propia aplicación ya tiene, a un identificador de distancia.
   */
  const [episodioLeido, setEpisodioLeido] = useState<
    { id: string; servicio?: string; cama?: string; fechaIngreso?: string; fechaEgreso?: string } | null>(null)
  useEffect(() => {
    if (!clinicId || !internamientoActivo) return
    let vivo = true
    getInternamiento(clinicId, internamientoActivo)
      .then(i => { if (vivo && i) setEpisodioLeido({ id: internamientoActivo, servicio: i.servicio, cama: i.cama, fechaIngreso: i.fechaIngreso, fechaEgreso: i.fechaEgreso }) })
      // Si no se puede leer, la nota se guarda SIN el bloque. Bloquear el
      // guardado de una nota clínica por un dato administrativo sería peor.
      .catch(() => { /* queda ausente, que es la representación honesta */ })
    return () => { vivo = false }
  }, [clinicId, internamientoActivo])
  /**
   * Se COMPARA el episodio en vez de limpiarlo al salir: así, al cambiar de
   * episodio, el bloque no queda un instante con los datos del anterior — y no
   * hace falta un `setState` dentro del efecto, que dispara renders en cascada.
   */
  const episodio = episodioLeido && episodioLeido.id === internamientoActivo ? episodioLeido : null
  /** REG-014: la firma gráfica vive en un subdocumento, no en `config/main`. */
  const { firma: firmaProtegida } = useFirmaProtegida(clinicId, config ?? undefined)

  /**
   * QUIÉN FIRMA ESTA NOTA — la persona, no el consultorio.
   *
   * `config.nombreMedico`, `config.cedulaProfesional` y `config.especialidad` son
   * campos de NIVEL CLÍNICA: un valor por consultorio. Se estampaban en
   * `nota.firma`, que es el SNAPSHOT INMUTABLE — así que en un consultorio con
   * dos médicos, cada nota que firmaba la Dra. quedaba congelada para siempre
   * con el nombre y la cédula del dueño.
   *
   * Peor que la adenda (v933): aquí no se puede corregir después, porque la nota
   * firmada es inmutable por diseño y por reglas.
   *
   * `firestore.rules` ya lo decía: «FIRMAR ES UN ACTO PERSONAL — nadie firma con
   * la cédula de otro». Faltaba `Doctor.cedulaProfesional` (v933) y usarlo aquí.
   */
  const medicoEnSesion = useMemo(() => {
    const uid = auth.currentUser?.uid
    const correo = (auth.currentUser?.email ?? '').trim().toLowerCase()
    const porUid = uid ? activeDoctors.filter(d => d.uid === uid) : []
    if (porUid.length === 1) return porUid[0]
    const porCorreo = correo ? activeDoctors.filter(d => (d.email ?? '').trim().toLowerCase() === correo) : []
    return porCorreo.length === 1 ? porCorreo[0] : undefined
  }, [activeDoctors])

  /**
   * La identidad con la que se va a firmar, y de dónde salió cada dato.
   *
   * Con UN solo médico la del consultorio ES la suya y se usa tal cual. Con dos o
   * más, si no se puede resolver quién es, NO se cae a la del consultorio: se
   * bloquea la firma. Estampar la cédula de otro en un documento inmutable es
   * peor que no poder firmar.
   */
  const identidadFirma = useMemo(() => {
    const unico = activeDoctors.length <= 1
    if (medicoEnSesion) {
      return {
        nombre: medicoEnSesion.nombre || config?.nombreMedico || '',
        cedula: medicoEnSesion.cedulaProfesional || (unico ? (config?.cedulaProfesional ?? '') : ''),
        especialidad: medicoEnSesion.especialidad || config?.especialidad || '',
        resuelta: true,
      }
    }
    return {
      nombre: config?.nombreMedico ?? '',
      cedula: unico ? (config?.cedulaProfesional ?? '') : '',
      especialidad: config?.especialidad ?? '',
      resuelta: unico,
    }
  }, [medicoEnSesion, activeDoctors.length, config?.nombreMedico, config?.cedulaProfesional, config?.especialidad])
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
   * LO QUE LA IA PUSO EN LA PASADA ANTERIOR.
   *
   * Es lo único que permite distinguir sus diagnósticos de los que escribió el
   * médico — y por tanto lo único que hace seguro SUSTITUIR en vez de acumular.
   *
   * Sin esto, el pase en vivo (cada 15 s, ~40 por consulta) sumaba una tanda
   * entera cada vez, con la IA redactando distinto en cada pasada. Así se
   * llegaba a 19 diagnósticos con tres redacciones del mismo R59.1.
   */
  const dxDeLaIaRef = useRef<Diagnostico[]>([])

  /**
   * Y lo mismo para los MEDICAMENTOS, que es la lista que se imprime.
   *
   * Los diagnósticos recibieron este arreglo y los medicamentos no. El pase en
   * vivo corre cada 15 s, y lo que se dictó al recabar antecedentes en el
   * minuto dos («toma metformina y losartán») se quedaba en la lista para
   * siempre — y de esa lista sale la receta.
   */
  const medDeLaIaRef = useRef<Medicamento[]>([])

  /**
   * Y lo mismo para las SECCIONES: qué texto dejó la IA en cada apartado.
   *
   * Es lo único que distingue «esto lo escribió un pase anterior mío, puedo
   * mejorarlo» de «esto lo escribió el médico, no se toca». Sin esta anotación,
   * la primera versión —la peor, del modelo rápido, con la consulta empezando—
   * congelaba el apartado para el resto de la consulta.
   */
  const seccionesDeLaIaRef = useRef<Record<string, string>>({})

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
  /**
   * NOTA PRELIMINAR MIENTRAS SE SEPARAN LAS VOCES.
   *
   * Al detener el dictado el médico se quedaba mirando una pantalla vacía durante
   * toda la cadena: subir el audio completo → transcribirlo OTRA VEZ con
   * separación de voces (que en una consulta larga no es rápido) → recién
   * entonces estructurar la nota con la IA. Dos esperas en serie, y la primera
   * ni siquiera hacía falta para empezar: el texto del streaming en vivo YA
   * estaba en pantalla.
   *
   * Ahora se arranca a estructurar en cuanto se detiene, con lo que hay. La nota
   * aparece mientras la diarización sigue su curso, y cuando llega el texto bueno
   * —con Médico/Paciente separados, que es mejor material— se re-proyecta.
   *
   * `edicionManualRef` es la salvaguarda: si el médico ya empezó a escribir sobre
   * la nota preliminar, la re-proyección NO lo pisa en silencio, pregunta. Antes
   * este riesgo no existía porque no había nada que editar todavía; al adelantar
   * la nota, lo creamos, y hay que cerrarlo en el mismo cambio.
   */
  const preliminarRef = useRef(false)
  const [ofreceReproyectar, setOfreceReproyectar] = useState(false)
  const edicionManualRef = useRef(false)

  const baseTranscripcionRef = useRef('')
  /**
   * ¿Esta consulta se grabó en más de una tanda?
   *
   * Se refleja en un estado —y no sólo en la referencia— porque **hay que
   * decírselo al médico**. Hasta la v991 el multi-tramo apagaba en silencio los
   * turnos Médico/Paciente: `sinDiarizacion` seguía en `null` porque la
   * diarización SÍ ocurrió, sólo que no se usaba. La pantalla se veía idéntica a
   * la del camino bueno.
   */
  const [multiTramoVisible, setMultiTramoVisible] = useState(false)
  const grabandoPrevioRef = useRef(false)
  useEffect(() => {
    const grabando = audio.estado === 'grabando'
    if (grabando && !grabandoPrevioRef.current) {
      // Flanco de subida: arranca una grabación. Se congela lo que ya había.
      baseTranscripcionRef.current = voz.transcripcion.trim()
      setMultiTramoVisible(voz.transcripcion.trim().length > 0)
      // Y se rearma el adelanto de la nota: en una consulta puede grabarse más de
      // una vez, y sin esto solo la primera se estructuraría por adelantado.
      preliminarRef.current = false
      setOfreceReproyectar(false)
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
      /**
       * Llegó el texto con las voces separadas. Es MEJOR material que el del
       * streaming, así que vale re-proyectar la nota — pero solo si el médico no
       * ha escrito encima. Si ya escribió, se le ofrece y decide él: pisarle
       * texto propio sin avisar es justo lo que no se puede hacer.
       */
      if (preliminarRef.current && edicionManualRef.current) {
        setOfreceReproyectar(true)
      } else {
        autoProcRef.current = true
      }
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
  /**
   * El panel de gineco es de gestación, control prenatal, preeclampsia y Bishop.
   *
   * Antes bastaba con que la paciente fuera mujer —o con que el sexo estuviera
   * VACÍO— así que a una paciente de 78 años el internista le veía "Gestación ·
   * control prenatal · Bishop". Se acota a edad fértil y se exige que el sexo esté
   * capturado: sin dato no se asume.
   */
  const esGineco = /^f/i.test(patient?.sexo ?? '') && (patient?.edad ?? 0) >= 10 && (patient?.edad ?? 0) <= 60

  /** Pega un texto en su sección de la nota (crea la sección si no existía). */
  /**
   * Ref de `firmada` porque este callback se crea ANTES de que exista el estado, y
   * lo consumen el Copiloto y todos los paneles de Herramientas.
   */
  /**
   * LO QUE EL MOTOR OYÓ, RESCATADO DE LA NOTA GUARDADA.
   *
   * ── EL BUCLE DE CORRECCIÓN NUNCA HABÍA APRENDIDO NADA (5-ago-2026) ────────
   *
   * LEARN compara `transcripcionMotor` (lo que oyó el reconocedor) con
   * `transcripcionCruda` (lo que el médico dejó): la diferencia ES la
   * corrección. Y lee **sólo notas firmadas**.
   *
   * Comprobado en el consultorio del Dr.: de sus 10 notas firmadas, las 10
   * tienen `transcripcionCruda` y **ninguna** tiene `transcripcionMotor`. Sin
   * esa mitad no hay par, así que el bucle —escrito, probado y con su propio
   * módulo— no había producido jamás una sola palabra aprendida.
   *
   * El campo sí se guarda mientras se dicta (un borrador de ayer lo tiene). Lo
   * que no había era forma de RECUPERARLO: al cargar una nota se restauraba la
   * transcripción editable y ésta no, así que en cuanto el médico volvía en otra
   * sesión —que es cuando se firma— el estado del grabador estaba vacío y la
   * nota se reescribía sin ella.
   *
   * Este ref conserva lo que la nota ya traía, para que sobreviva a la recarga,
   * a la firma y a cualquier reescritura posterior. Es una ref y no un estado
   * porque `construirNota` corre en cada render y necesita el valor YA.
   */
  const transcripcionMotorGuardadaRef = useRef('')

  const firmadaRef = useRef(false)
  /**
   * ESTA CONSULTA SE DESCARTÓ A PROPÓSITO. NADA PUEDE RESUCITARLA.
   *
   * `descartar()` borra el documento y navega fuera, pero el autoguardado se
   * serializa en una cadena y puede quedar uno en vuelo. Ese guardado tardío
   * escribía sobre el documento recién borrado y volvía como PERMISSION_DENIED
   * —una de las formas en que aparecía REG-155—.
   *
   * Y desde que la consulta se recupera sola de un documento ausente, ese mismo
   * guardado tardío **volvería a crear la nota que el médico acaba de
   * descartar**. La recuperación es correcta cuando el documento se perdió; sería
   * un defecto grave cuando se borró queriendo. Sólo esta marca distingue los dos
   * casos, y por eso es una ref y no un estado: tiene que valer YA, sin esperar
   * al siguiente render.
   */
  const descartadaRef = useRef(false)
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
      return false
    }
    const t = texto.trim()
    if (!t) return false
    let duplicado = false
    setSecciones(prev => {
      const i = prev.findIndex(s => s.key === key)
      // DEDUP: si la sección ya contiene EXACTAMENTE este texto, no lo anexa otra
      // vez. Antes cada clic concatenaba, así que reaplicar una escala o recalcular
      // dejaba líneas idénticas repetidas en la nota (ruido medicolegal).
      if (i >= 0 && prev[i].value.includes(t)) { duplicado = true; return prev }
      const valor = i >= 0 ? `${prev[i].value}\n${t}` : t
      return [...prev.filter(s => s.key !== key), { key, label, value: valor }]
    })
    toast(duplicado ? 'Eso ya estaba en la nota' : 'Agregado a la nota ✓', duplicado ? 'info' : 'success')
    return true
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
   * LA CITA DE HOY DE ESTE PACIENTE.
   *
   * La consulta no sabía a qué cita pertenecía, así que el modal de cobro no
   * recibía `citaId` — y sin él nunca se marcaba `cobroId`. Consecuencia: el
   * botón "Cobrar" seguía visible en la agenda (su guarda es justamente
   * `!cobroId`), con riesgo de cobrar dos veces al mismo paciente, y la cita
   * aparecía en "cuentas por cobrar" del corte estando ya cobrada.
   */
  const { appointments: citasDelPaciente } = usePatientAppointments(patientId)
  const citaDeHoy = useMemo(() => {
    const hoy = hoyISO()
    return citasDelPaciente
      .filter((c: Appointment) => c.fechaHora.slice(0, 10) === hoy && !['cancelada', 'reagendada'].includes(c.estado))
      .sort((a: Appointment, b: Appointment) => a.fechaHora.localeCompare(b.fechaHora))[0] ?? null
  }, [citasDelPaciente])

  /**
   * La regla salió de aquí a `lib/finanzas/precio-consulta`. Vivía dentro de esta
   * pantalla, así que al cobrar desde CITAS —por donde cobra la asistente, o sea
   * la mayoría de las veces— el importe abría vacío… y sin precio tampoco se
   * podía restar lo ya abonado.
   */
  const montoSugerido = useMemo(
    () => precioSugerido(config?.preciosPublicos, citaDeHoy?.tipo),
    [config?.preciosPublicos, citaDeHoy?.tipo],
  )

  /**
   * Se declara aquí, antes del memo del copiloto, porque el copiloto consume los
   * estudios que salen de esta extracción para calcular TFG, FIB-4 y PREVENT.
   */
  const [extraction, setExtraction] = useState<Record<string, unknown> | undefined>(undefined)

  /**
   * LEARNING ENGINE — frecuencias por categoría de sugerencia de ESTE médico.
   * Se cargan una vez y sirven para reordenar (no críticas) lo que suele usar.
   * Fail-safe: si no hay datos o falla, queda {} y el orden es el de siempre.
   */
  const [prefsIA, setPrefsIA] = useState<Preferencias>({})
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!clinicId || !uid) return
    cargarPreferencias(clinicId, uid).then(setPrefsIA).catch(() => {})
  }, [clinicId])

  /**
   * Se memoriza aquí y no dentro del componente: al pasarlo como objeto literal
   * en el JSX se creaba uno nuevo en CADA render, el useMemo del Copiloto nunca
   * acertaba y el motor se recalculaba en cada tecla del dictado.
   */
  /**
   * Suben aquí desde más abajo para que el cuadro completo (REG-188) pueda
   * usarlas: son `useState` puros, y moverlos no cambia nada salvo el orden de
   * declaración. Se rellenan en el efecto que lee las notas firmadas.
   */
  const [vigentes, setVigentes] = useState<OrdenVigente[]>([])
  const [problemas, setProblemas] = useState<ProblemaVigente[]>([])

  /**
   * ── EL CUADRO COMPLETO, FUERA DEL useMemo (REG-188) ─────────────────────────
   *
   * Se calculan aquí, en el cuerpo, y no dentro del `useMemo` de abajo: llamar
   * a una función importada dentro de una memoización manual impide al React
   * Compiler preservarla, y el trinquete de lint lo caza (5 errores nuevos).
   * En el cuerpo el compilador las memoiza solo, que es lo idiomático.
   */
  const medsDelCuadro = medicacionDelCuadro(medicamentos, vigentes)
  const dxDelCuadro = problemasDelCuadro(diagnosticos, problemas)

  const entradaCopiloto = useMemo(() => ({
    edad: patient?.edad,
    sexo: patient?.sexo,
    alergias: patient?.alergias,
    /**
     * Las capturadas en campo, para que el cruce las vea igual que el sesgo de
     * voz y los impresos (REG-208). Hoy ninguna ruta de escritura las llena,
     * pero cualquier importación desde otro sistema las activa el mismo día, y
     * entonces el paciente MEJOR documentado sería el único sin cruce.
     */
    alergiasEstructuradas: patient?.alergiasEstructuradas,
    /**
     * ── EL PACIENTE COMPLETO, NO SÓLO LO DE HOY (6-ago-2026, REG-188) ──────
     *
     * Aquí iban únicamente los renglones de esta consulta. En un seguimiento
     * —la mayoría— eso es la punta del iceberg: dos líneas nuevas sobre alguien
     * que toma cinco cosas desde hace años.
     *
     * `medicamentosVigentes` y `problemasActivos` ya estaban calculados y
     * pintados en pantalla; simplemente no llegaban al motor. Warfarina de
     * marzo + ketorolaco de hoy: la regla de sangrado existe, está probada, y
     * no disparaba.
     */
    diagnosticos: dxDelCuadro,
    medicamentos: medsDelCuadro,
    // signosNum, no signos: el copiloto compara contra umbrales y calcula IMC.
    // Con el valor en crudo, un "70.5" en texto rompería ambas cosas.
    signos: {
      ta: signosNum.ta, fc: signosNum.fc, fr: signosNum.fr,
      temperatura: signosNum.temperatura, spo2: signosNum.spo2,
      peso: signosNum.peso, talla: signosNum.talla,
    },
    /**
     * LABORATORIOS — esto es lo que enciende el motor.
     *
     * El copiloto ya sabía calcular TFG por CKD-EPI 2021, FIB-4, ajuste renal de
     * fármacos, PREVENT y metas lipídicas, todo escrito y con pruebas. Pero esta
     * pantalla NUNCA le pasaba `labs`, así que todo eso estaba muerto: el único
     * cálculo automático vivo era el IMC. El médico no veía la TFG de su paciente
     * y encima acababa tecleando a mano escalas que el sistema ya sabía calcular.
     *
     * Los estudios salen del dictado a través del NER, que ya los extrae con su
     * valor y unidad. El mapeo es conservador a propósito: ante la duda no mapea,
     * porque estos números alimentan fórmulas que producen conducta.
     */
    labs: labsDesdeEstudios(
      (extraction as { tests?: { texto: string; valor?: string; unidad?: string }[] } | undefined)?.tests,
    ),
  }), [patient?.edad, patient?.sexo, patient?.alergias, patient?.alergiasEstructuradas, diagnosticos, medicamentos, signosNum, extraction])
  const [resumen, setResumen] = useState('')
  /**
   * QUÉ ES ESTA NOTA PARA EL SELLO — una vez, para las dos lecturas.
   *
   * Había dos listas: la del guardado (que incluía la prosa y por eso el sello
   * ARCHIVADO la contaba) y la de la tira en pantalla (que no). Sobre la misma
   * nota, el registro decía «3 del dictado · 4 a mano» y la pantalla «4 a
   * mano»: los tres campos que faltaban eran justo la prosa, donde vivieron los
   * fallos reales. Con un solo objeto no pueden volver a divergir.
   */
  const notaDelSello = useMemo(
    () => notaParaElSello({
      diagnosticos, medicamentos,
      alergias: alergiasArray(patient ?? {}),
      signosVitales: signosNum as unknown as Record<string, unknown>,
      secciones, resumen,
    }),
    [diagnosticos, medicamentos, patient, signosNum, secciones, resumen],
  )
  const [procesando, setProcesando] = useState(false)
  // Rol auto-asignado a cada voz diarizada (Hablante A/B → Médico/Paciente/Acompañante).
  // Lo llena Claude al terminar la diarización; editable en el diálogo.
  const [rolesHablante, setRolesHablante] = useState<Record<string, string>>({})
  // Segunda opinión: un 2º modelo top (GPT-5) revisa la nota de Opus 4.8.
  type Hallazgo = { severidad: string; tema: string; problema: string; sugerencia: string }
  /**
   * La segunda opinión, CON la huella de lo que revisó.
   *
   * Sin la huella, el resultado seguía diciendo «sin observaciones» después de
   * que el médico editara la nota — un sello de una versión que ya no existe.
   * Ver `lib/expediente/lo-que-se-reviso.ts`.
   */
  const [verificacion, setVerificacion] = useState<{ modelo: string; hallazgos: Hallazgo[]; huella: string } | null>(null)
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

  /**
   * Las palabras a verificar se calculan UNA vez por dictado, no en cada render:
   * un dictado largo trae miles de palabras y esto se recorre entero.
   */
  const palabrasAVerificar = useMemo(() => paraElMedico(audio.utterances), [audio.utterances])

  /**
   * EL TEXTO QUE VE LA IA — UNO SOLO, PARA EL QUE REDACTA Y PARA EL QUE REVISA.
   *
   * Estaba escrito dentro de `procesarIA`, así que la segunda opinión a demanda
   * mandaba `voz.transcripcion`: texto plano, sin turnos y **sin las marcas de
   * palabra dudosa**. El revisor no veía ni una `⟦palabra?⟧` y revisaba la nota
   * contra una versión del dictado donde todo parecía igual de seguro.
   *
   * Un revisor que lee otro texto que el redactor no es una segunda opinión: es
   * una opinión sobre otra cosa.
   */
  const textoParaLaIA = useCallback((multiTramo = false) => {
    const dudosas = palabrasDudosas(audio.utterances)
    const dialogo = audio.utterances
      .map(u => `${rolesHablante[u.speaker] || `Hablante ${u.speaker}`}: ${marcarTurno(u)}`)
      .join('\n')
    /**
     * UN MONÓLOGO NO SE ARMA COMO DIÁLOGO.
     *
     * El médico contestó que en UCI y en hospital **dicta solo**. Y el
     * diarizador parte a una sola persona en dos hablantes cuando cambia el
     * tono o hay una pausa larga — con lo que su propio dictado salía así:
     *
     *     Médico adscrito: el paciente lleva tres días con fiebre
     *     Paciente: y la creatinina en uno punto ocho
     *
     * A partir de ahí el motor de negaciones y el de procedencia razonan sobre
     * una atribución falsa: la diferencia entre «el paciente lo afirmó» y «el
     * médico lo dictó» es la que sostiene esas dos defensas.
     *
     * Con un solo hablante no hay nada que atribuir: va texto plano. Las marcas
     * de duda no se pierden — se anexan abajo, como en multi-tramo.
     */
    if (audio.utterances.length > 0 && !multiTramo && !esMonologo(audio.utterances)) {
      return dudosas.length > 0 ? `${INSTRUCCION_MARCAS}\n\n${dialogo}` : dialogo
    }
    /**
     * TEXTO PLANO — PERO LA DUDA NO SE TIRA.
     *
     * En multi-tramo el diálogo no se puede mandar (cubriría sólo el último
     * tramo y la nota perdería la primera parte clínica), así que se manda el
     * texto completo. Correcto. Lo que NO tenía por qué irse eran las marcas de
     * duda del tramo que sí conocemos: se anexan al final con su instrucción.
     *
     * Sin diarización no hay confianza por palabra y el anexo sale vacío: ahí no
     * hay nada que anexar, y decirlo es lo único honesto.
     */
    const anexo = anexoDeDudas(audio.utterances)
    return anexo ? `${voz.transcripcion}\n\n${anexo}` : voz.transcripcion
  }, [audio.utterances, rolesHablante, voz.transcripcion])

  /**
   * AVISOS QUE EL MÉDICO YA REVISÓ.
   *
   * Un aviso que no se puede quitar deja de ser un aviso: se convierte en parte
   * del decorado y se deja de leer — y con él, el siguiente, que puede ser el
   * que importa. Es la misma fatiga de alerta que costó dos reparaciones el
   * 4-ago (la compuerta de dosis y la franja de incidencias).
   *
   * Quitar un aviso **no cambia la nota ni resuelve nada**: sólo dice «ya lo
   * miré». Por eso se guarda POR NOTA en este dispositivo y no en el expediente:
   * el criterio clínico ya quedó en lo que el médico escribió.
   *
   * Y vuelve a salir si el contenido cambia, porque entonces es otro aviso.
   */
  const [avisosRevisados, setAvisosRevisados] = useState<string[]>([])
  const claveAviso = (tipo: string, id: string) => `${tipo}:${id}`
  const marcarRevisado = useCallback((tipo: string, id: string) => {
    setAvisosRevisados(prev => prev.includes(claveAviso(tipo, id)) ? prev : [...prev, claveAviso(tipo, id)])
  }, [])

  /**
   * LO QUE EL PACIENTE NEGÓ FRENTE A LO QUE LA NOTA AFIRMA.
   *
   * Caso real del Dr. (3-ago-2026): «¿Enfermedades crónicas como diabetes o
   * presión alta? No.» → la nota salió con «Paciente con Hipertensión arterial,
   * Diabetes mellitus tipo 2». Un antecedente crónico inventado cambia el riesgo
   * quirúrgico, cambia los fármacos y se arrastra a todas las notas siguientes.
   *
   * Se contrasta contra TODO lo que la nota afirma —resumen, diagnósticos y las
   * secciones—, no sólo contra el resumen: la contradicción da igual en qué
   * campo aparezca, porque el expediente se lee entero.
   */
  const contradiccionesNota = useMemo(() => {
    const dictado = voz.transcripcion
    if (!dictado.trim()) return []
    const negadas = condicionesNegadas(dictado)
    if (!negadas.length) return []
    const textoNota = textoDeLaNota(resumen, diagnosticos, secciones)
    return contradicciones(negadas, textoNota)
      .filter(c => !avisosRevisados.includes(`negacion:${c.condicion}`))
  }, [voz.transcripcion, resumen, diagnosticos, secciones, avisosRevisados])
  /**
   * ¿DE QUIÉN ES LA ENFERMEDAD? (§B8 del charter, REG-210)
   *
   * El tercer eje, junto a la negación (¿sí o no?) y la temporalidad (¿cuándo?).
   * «Mi mamá tuvo cáncer de mama» metido como antecedente PERSONAL deja una
   * historia clínica impecable afirmando un cáncer que el paciente nunca tuvo,
   * firmada con cédula. No se ve raro: por eso hace falta señalarlo.
   *
   * Sólo se avisa cuando la nota YA dice algo — si el dictado aún está vacío no
   * hay nada que atribuir mal.
   */
  const antecedentesDeFamiliar = useMemo(() => {
    const dictado = voz.transcripcion
    if (!dictado.trim()) return []
    return frasesDeFamiliar(dictado)
      .filter(f => !avisosRevisados.includes(`familiar:${f.frase.slice(0, 40)}`))
  }, [voz.transcripcion, avisosRevisados])
  /**
   * ¿DE DÓNDE SALIÓ ESTO? (§B10 del charter · SUP-001)
   *
   * La pregunta que hoy sólo se puede contestar reescuchando la consulta
   * entera. Cada afirmación de la nota se busca en el dictado; las que ningún
   * fragmento sostiene se señalan con las palabras que nadie dijo.
   *
   * No acusa: puede venir del expediente previo o de la exploración física. Por
   * eso el aviso dice «si viene de ahí, déjalo».
   */
  const sinRespaldo = useMemo(() => {
    const dictado = voz.transcripcion
    if (!dictado.trim()) return []
    const textoNota = textoDeLaNota(resumen, diagnosticos, secciones)
    if (!textoNota.trim()) return []
    return afirmacionesSinRespaldo(textoNota, dictado)
      .filter(r => !avisosRevisados.includes(`respaldo:${r.afirmacion.slice(0, 40)}`))
      .map(r => ({ afirmacion: r.afirmacion, huerfanas: r.huerfanas }))
  }, [voz.transcripcion, resumen, diagnosticos, secciones, avisosRevisados])
  /**
   * ¿CON CUÁNTA SEGURIDAD LO DIJO? (§B6 del charter, REG-211)
   *
   * El cuarto eje. «Creo que me dijeron que tenía anemia» aplanado a «Anemia»
   * convierte una duda del paciente en un diagnóstico del expediente — y a
   * partir de la segunda consulta ya nadie sabe que era una duda.
   */
  const datosInciertos = useMemo(() => {
    const dictado = voz.transcripcion
    if (!dictado.trim()) return []
    return frasesInciertas(dictado)
      .filter(f => !avisosRevisados.includes(`incierto:${f.frase.slice(0, 40)}`))
  }, [voz.transcripcion, avisosRevisados])
  /**
   * EL PASADO NO ES EL PRESENTE.
   *
   * El hermano del anterior, y el hueco que la propia auditoría de voz declaraba
   * sin motor: «tuvo neumonía hace tres años» acabando escrito como padecimiento
   * actual. Se arrastra igual —queda en el expediente y se copia a la nota
   * siguiente— y se resuelve igual: se enseñan las dos frases y decide el médico.
   */
  const desajustesNota = useMemo(() => {
    const dictado = voz.transcripcion
    if (!dictado.trim()) return []
    const pasadas = mencionesEnPasado(dictado)
    if (!pasadas.length) return []
    const textoNota = textoDeLaNota(resumen, diagnosticos, secciones)
    return desajustesTemporales(pasadas, textoNota)
      .filter(d => !avisosRevisados.includes(`temporal:${d.condicion}`))
  }, [voz.transcripcion, resumen, diagnosticos, secciones, avisosRevisados])
  /**
   * LA VÍA QUE NADIE DICTÓ.
   *
   * Decisión del médico dueño (4-ago-2026): «déjalo oral pero que avise si no se
   * dictó la vía». El prompt de extracción trae `"via": "oral"` en su plantilla,
   * así que el modelo la rellena SIEMPRE — y la receta acaba afirmando una vía de
   * administración que nadie dijo, con la misma tinta que las que sí se dictaron.
   *
   * Se decide mirando la CITA de la que salió cada fármaco, no preguntándole al
   * modelo: «esto no se dijo» es justo la señal que un generativo peor distingue,
   * porque rellenar huecos es lo que sabe hacer.
   */
  const viasAsumidas = useMemo(() => {
    const delExtractor = (extraction as { medicamentos?: { nombre?: string; via?: string; source_quote?: string }[] } | undefined)?.medicamentos
    if (!delExtractor?.length) return []
    return conViaAsumida(delExtractor, voz.transcripcion)
      .map(m => String(m.nombre ?? '').trim())
      .filter(Boolean)
      .filter(n => !avisosRevisados.includes(`via:${n}`))
  }, [extraction, voz.transcripcion, avisosRevisados])

  /**
   * LA DOSIS QUE FALTA — ANTES DE FIRMAR, NO AL IMPRIMIR.
   *
   * ── EL HUECO DE FLUJO (5-ago-2026) ────────────────────────────────────────
   *
   * `revisarUnidadDosis` existe y funciona: con la dosis vacía devuelve
   * severidad ALTA y dice por qué —«la receta no lleva cantidad; quien la surta
   * no puede saber cuánto dispensar»—. Con la cifra sin unidad, avisa de que
   * «100» se leerá como 100 mg.
   *
   * Pero sólo se ejecutaba en la pantalla de la RECETA y en hospitalización. En
   * la consulta, no. Y la consulta es donde se firma.
   *
   * Auditando las notas firmadas del Dr. aparecieron **4 medicamentos sin dosis
   * de 28**. El aviso llegaba después de firmar, cuando la nota ya es inmutable
   * y sólo se puede corregir con una adenda.
   *
   * Aquí se enseña antes. No bloquea: qué es exigible en una receta es una
   * decisión del médico dueño, y está en su cola.
   */
  const dosisIncompletas = useMemo(() => {
    return medicamentos
      .filter(m => m.nombre?.trim())
      // Ver `esDosisDeclaradaDesconocida`: una respuesta no es un aviso pendiente.
      .filter(m => !esDosisDeclaradaDesconocida(m.dosis))
      /** La procedencia viaja con el aviso para que el texto pueda decir de cuál se trata (REG-183). */
      .map(m => ({ med: m.nombre, aviso: revisarUnidadDosis(m.nombre, m.dosis), procedencia: m.procedenciaClinica }))
      .filter((x): x is { med: string; aviso: NonNullable<ReturnType<typeof revisarUnidadDosis>>; procedencia: 'ya_lo_toma' | 'se_prescribe_hoy' | undefined } => !!x.aviso)
    /**
     * Sin filtro de «ya lo revisé»: desde que los dos casos bloquean la firma,
     * no hay nada que descartar — hay algo que escribir. Dejar el filtro sería
     * código que no puede ejecutarse nunca.
     */
  }, [medicamentos])

  const vivoRef = useRef(false)
  const palabrasEstructuradasRef = useRef(0)
  const transcripcionRef = useRef('')
  // ─── Medical NER (extracción de entidades) ─────────────────────
  const [entidades, setEntidades] = useState<EntidadesExtraidas | null>(null)
  /** Condiciones que el extractor dio por confirmadas y el paciente había negado. */
  const [negacionesCorregidas, setNegacionesCorregidas] = useState<NegacionCorregida[]>([])
  /** Condiciones activas que el dictado situó en pasado. No se tocan: se enseñan. */
  const [avisosTemporales, setAvisosTemporales] = useState<AvisoTemporal[]>([])
  const [nerCargando, setNerCargando] = useState(false)
  const [nerError, setNerError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [firmada, setFirmada] = useState(false)
  const [errorCargaNota, setErrorCargaNota] = useState('')
  /**
   * La lectura del PACIENTE falló — auditoría 2026-07 (P0). Sin este flag, si
   * getPatient fallaba (red intermitente), `patient` quedaba null y el autoguardado
   * escribía pacienteNombre='' y alergias='' → BORRABA el nombre y las alergias de
   * la nota y apagaba el cross-check alergia↔fármaco. Bloquea el guardado, como ya
   * se hace con la nota que no se pudo leer.
   */
  const [pacienteError, setPacienteError] = useState(false)
  /** Id estable mientras la nota aún no existe en Firestore. Ver construirNota. */
  const uuidRespaldoRef = useRef<string>('')
  if (!uuidRespaldoRef.current) uuidRespaldoRef.current = crypto.randomUUID()
  useEffect(() => { firmadaRef.current = firmada }, [firmada])
  const [notaId, setNotaId] = useState<string | null>(notaIdParam)
  // Ref síncrona del notaId + cadena de guardados serializada: evita que dos
  // autoguardados creen notas DUPLICADAS (setNotaId es asíncrono).
  const notaIdRef = useRef<string | null>(notaIdParam)
  /**
   * La marca de modificación que ESTA pestaña vio por última vez. Es el testigo
   * de la guardia de concurrencia de `updateNota`: si en Firestore hay otra, es
   * que alguien más escribió mientras tanto.
   */
  const vistoEnRef = useRef<string | undefined>(undefined)
  useEffect(() => { notaIdRef.current = notaId }, [notaId])
  /**
   * V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20) — lo que ya se hizo del
   * checklist de cierre (`ComoCerrarLaConsulta`), para la nota con la que
   * arrancó esta pantalla (`notaIdParam`, de `?nota=` en la URL). Es
   * exactamente el caso que importa: volver de `/receta` o `/orden` con
   * `useSmartBack` trae de vuelta esa misma URL, y esta lectura perezosa la
   * recupera aunque Next remonte la pantalla.
   *
   * NO se resincroniza en un `useEffect` cuando `notaId` cambia DESPUÉS del
   * montaje (p. ej. al firmar una nota nueva, que pasa de `null` a un id
   * recién creado): ese id nunca tuvo entrada en `sessionStorage`, así que
   * `leerHechosDeCierre` daría `[]` de todos modos — igual al estado inicial.
   * Añadir ese efecto sólo repetiría, en el otro sentido, el mismo defecto
   * que ya tiene `uuidRespaldoRef` un poco más arriba (`react-hooks/refs`):
   * estado derivado que se puede leer una vez, no sincronizar en cada render.
   * Ver `cierre-hechos.ts` para el porqué de `sessionStorage` en vez de
   * Firestore.
   */
  const [hechosCierre, setHechosCierre] = useState<string[]>(() => leerHechosDeCierre(notaIdParam))
  const fallosGuardadoRef = useRef(0)
  const cadenaGuardadoRef = useRef<Promise<unknown>>(Promise.resolve())
  const [preop, setPreop] = useState<{ inputs: Record<string, unknown>; resultados: Record<string, unknown> } | undefined>(undefined)
  // Estudios a solicitar (valoración inmuno → pre-pobla la Orden médica)
  const [estudiosOrden, setEstudiosOrden] = useState<string[]>([])
  /**
   * Las palabras que este médico ya corrigió a mano, más de una vez.
   *
   * Salen de sus propias notas firmadas y sólo sirven para **sesgar al
   * reconocedor** en la siguiente grabación. No reescriben nada: el corrector y
   * su guardián siguen decidiendo con las reglas de siempre.
   */
  const [aprendido, setAprendido] = useState<Aprendido[]>([])
  /**
   * Lo derivado de las notas de ESTE paciente, antes de fusionar.
   *
   * Se guarda aparte porque es lo único que se puede acumular al consultorio: lo
   * que ya venía del consultorio ya está contado, y volver a sumarlo inflaría el
   * contador con cada consulta hasta que cualquier palabra pareciera una
   * costumbre.
   */
  const [deEstePaciente, setDeEstePaciente] = useState<Aprendido[]>([])

  /**
   * EL SÉPTIMO MOTIVO: LO QUE SE CONSIDERÓ NO ES LO QUE SE INDICÓ.
   *
   * El pipeline no puede emitirlo porque trabaja sobre TEXTO y no ve la lista de
   * medicamentos extraídos; aquí están las dos cosas. Es el mismo patrón que el
   * sexto motivo, que necesitaba las confianzas por palabra y por eso se emite
   * desde el hook.
   *
   * El fármaco NO se quita: se pregunta. «Si tiene dolor, paracetamol» es una
   * indicación PRN válida, y borrar por condicional perdería medicación real.
   */
  const soloPropuestos = useMemo(
    () => medicamentosSoloPropuestos(voz.transcripcion, medicamentos),
    [voz.transcripcion, medicamentos],
  )
  /**
   * Y LOS ESTUDIOS, que alimentan la ORDEN IMPRESA.
   *
   * Va aparte del de fármacos porque el documento y la corrección son
   * distintos: uno se arregla en la receta y el otro en la orden que el
   * paciente se lleva al laboratorio.
   */
  const estudiosPropuestos = useMemo(
    () => estudiosSoloPropuestos(voz.transcripcion, estudiosOrden),
    [voz.transcripcion, estudiosOrden],
  )
  /** El gate de ambigüedad del pipeline, que hasta la v990 no salía del hook. */
  const motivosDictado = useMemo(
    () => textosDeMotivos([
      ...audio.motivosConfirmacion,
      ...(soloPropuestos.length ? ['farmaco_solo_propuesto'] : []),
      ...(estudiosPropuestos.length ? ['estudio_solo_propuesto'] : []),
    ]),
    [audio.motivosConfirmacion, soloPropuestos, estudiosPropuestos],
  )
  /**
   * PRÓXIMA CONSULTA. Opcional: si el médico no pone fecha, no se inventa una.
   * Alimenta tres cosas que YA existían y esperaban este dato: la tarea de
   * «agendar el seguimiento» del worklist, el contador de seguimientos vencidos
   * del CRM y la propia nota firmada.
   */
  /**
   * PRÓXIMA CONSULTA — y por qué NO va dentro de la nota firmada.
   *
   * Es un dato de AGENDA, no una afirmación clínica: dice a quién hay que
   * llamar, no qué se encontró. Meterlo en la nota obligaría a subir la versión
   * del sello de integridad —y a re-verificar todo lo firmado— por una fecha
   * que ya vive donde se actúa sobre ella. Lo que el médico decidió ese día ya
   * queda escrito en el plan, con sus palabras.
   *
   * Alimenta dos cosas que YA existían esperando este dato: la tarea «agendar
   * el seguimiento» del worklist y el contador de seguimientos vencidos del CRM.
   */
  /**
   * Inicialización perezosa desde `sessionStorage` (quinta rebanada, Fase 8):
   * la nota no guarda este campo, así que al remontar con `?nota=` (volver
   * de /citas, F5) el valor que el médico puso se recupera de donde lo dejó
   * `firmar()` — mismo patrón que `hechosCierre` arriba. Sin entrada guardada
   * devuelve `''`, idéntico al estado inicial de siempre.
   */
  const [proximoSeguimiento, setProximoSeguimiento] = useState(() => leerSeguimientoDeCierre(notaIdParam))
  // Fase B: bloque auditable de la IA + aprobaciones por campo
  const [safety, setSafety] = useState<Record<string, unknown> | undefined>(undefined)
  const [aprobados, setAprobados] = useState<Set<string>>(new Set())
  // Fase C: consentimiento del paciente antes de iniciar grabación
  const [consentimiento, setConsentimiento] = useState(false)
  const [modalConsentimiento, setModalConsentimiento] = useState(false)
  const ultimasNotasRef = useRef('')
  const [contextoPrevio, setContextoPrevio] = useState('')
  /**
   * QUÉ ESTÁ TOMANDO EL PACIENTE HOY (V6 · P-005 y P-008).
   *
   * Es la primera pregunta de cualquier consulta y el encabezado no la
   * respondía: los medicamentos viven dentro de cada nota, así que «lo que
   * toma» era «lo que escribí la última vez que lo vi» — y una suspensión
   * anotada en la consulta anterior no aparecía en ningún sitio salvo leyendo
   * esa nota entera.
   */
  /** Qué TIENE el paciente y cuándo vino la última vez (ver `problemas-activos`). */
  /**
   * El formulario que el paciente llenó desde su portal, si lo llenó. Se lee
   * aparte y NO se mezcla con el expediente: ver `lib/portal/formulario-previo`.
   */
  const [previo, setPrevio] = useState<FormularioPrevio | null>(null)
  useEffect(() => {
    if (!clinicId || !patientId) return
    let vivo = true
    getDoc(doc(db, 'clinics', clinicId, 'patients', patientId, 'formularios_previos', 'actual'))
      .then((sn: DocumentSnapshot) => { if (vivo && sn.exists()) setPrevio(sn.data() as FormularioPrevio) })
      // Si no se puede leer, no se enseña: mejor sin tarjeta que con una a medias.
      .catch(() => {})
    return () => { vivo = false }
  }, [clinicId, patientId])
  const [ultimaVisita, setUltimaVisita] = useState<string | undefined>(undefined)
  /**
   * El fármaco que el médico está marcando como «ya no lo toma».
   *
   * Suspender es un ACTO, no un olvido: se escribe en la nota de HOY —el pasado
   * no se edita— y la regla de la última palabra lo recoge desde ahí.
   */
  const [medPorCambiar, setMedPorCambiar] = useState<
    { nombre: string; dosis?: string; estado: 'suspendida' | 'terminada'; motivo: string } | null
  >(null)

  // Constraints para capturar TODA la conversación (médico + paciente) en el modo
  // Whisper: sin supresión de ruido ni cancelación de eco (borran al paciente),
  // con control de ganancia para levantar su voz.
  /**
   * El vocabulario de ESTE paciente viaja con el audio.
   *
   * El prompt es lo único que cambia lo que el reconocedor OYE, y su presupuesto
   * son ~224 tokens: los fármacos y diagnósticos del paciente entran PRIMERO y
   * lo genérico llena lo que sobre. Un fármaco que ya toma es la pista más
   * específica que existe — «metformina» dictada sobre un diabético deja de
   * competir con las palabras parecidas del diccionario general.
   *
   * Hasta hoy se mandaba un prompt fijo para todos: el módulo que elige el
   * vocabulario existía, estaba probado, y no lo llamaba nadie.
   */
  const opcionesWhisper = useMemo(() => ({
    recoveryKey: `consulta-${patientId}`,
    noiseSuppression: false,
    echoCancellation: false,
    autoGainControl: true,
    /**
     * EL MÓDULO REAL, NO SIEMPRE «consulta».
     *
     * Estaba fijo, así que una nota de ingreso o de evolución nunca activaba el
     * léxico hospitalario (`CONTEXTOS_POR_MODULO.hospitalizacion`), que estaba
     * escrito y probado y no lo disparaba nadie. La pantalla ya sabe si está en
     * un internamiento.
     */
    contexto: (internamientoActivo ? 'hospitalizacion' : 'consulta') as 'consulta' | 'hospitalizacion',
    /**
     * ¿HABLAN DOS, O DICTA UNO SOLO? — lo decide el TIPO de nota.
     *
     * El médico contestó que la evolución de hospital la **dicta solo**, y que
     * la consulta la **conversa con el paciente**. Sale del tipo y no de una
     * opción más en pantalla: menos que decidir es menos maneras de
     * equivocarse, que es justo lo que pidió.
     *
     * Ante la duda, `conversacion`. Ver `lib/asr/un-solo-hablante.ts`.
     */
    modoDeHabla: (esDictado(tipo) ? 'dictado' : 'conversacion') as 'dictado' | 'conversacion',
    medicamentos: (medicamentos ?? []).map(m => m?.nombre).filter(Boolean) as string[],
    problemas: (diagnosticos ?? []).map(d => d?.descripcion).filter(Boolean) as string[],
    /**
     * LA ESPECIALIDAD DEL MÉDICO, QUE NUNCA LLEGABA.
     *
     * `ContextoDictado.especialidades` existe desde que se escribió el léxico y
     * viaja por cuatro capas — y ninguna pantalla lo llenaba. El vocabulario
     * salía sólo del módulo: un infectólogo en su consultorio no cargaba
     * «Antimicrobianos» ni «Microbiología y PROA», justo los términos que más se
     * le escriben mal.
     */
    especialidades: especialidadesDelMedico(especialidadEfectiva),
    /**
     * LO APRENDIDO VA CON LOS FÁRMACOS DEL PACIENTE, no al final.
     *
     * El presupuesto del sesgo son 224 tokens y el orden ES la política: si algo
     * se queda fuera, que sea el catálogo general y no la palabra que este
     * médico corrige todas las semanas.
     */
    aprendidas: aprendido.map(a => a.palabra),
    /**
     * Las alergias del expediente sesgan el motor hacia lo que no se puede oír
     * mal: el cruce alergia↔fármaco compara contra lo que se OYÓ, así que un
     * alérgeno mal transcrito es un cruce que nunca salta.
     *
     * Con `alergenosDe` y no con un `split` propio: éste partía sólo por coma,
     * punto y coma y salto de línea, así que «Penicilina / Sulfas» y «Penicilina
     * y sulfas» viajaban como UN término —y el alérgeno de en medio dejaba de
     * sesgar nada—, «niega alergias» viajaba como si fuera un alérgeno, y las
     * `alergiasEstructuradas` no se miraban: el paciente mejor documentado
     * mandaba CERO.
     */
    alergias: alergenosDe(patient ?? {}),
  }), [patientId, medicamentos, diagnosticos, patient?.alergias, internamientoActivo, especialidadEfectiva, aprendido, tipo])

  // Arranca el grabador que corresponde al modo seleccionado (no siempre el de voz).
  const arrancarSegunModo = () => {
    if (modoVoz === 'whisper') audio.iniciar(opcionesWhisper)
    else voz.iniciar()
  }

  /**
   * ¿ESTE PACIENTE YA CONSINTIÓ, EN ESTA U OTRA CONSULTA?
   *
   * El médico eligió «una vez por paciente, y ya». Antes el consentimiento
   * vivía en un `useState` que moría con la pantalla, así que el modal salía en
   * CADA consulta del mismo paciente — un paso repetido cien veces al mes.
   *
   * `consentimiento` (el estado) sigue existiendo para la consulta en curso; lo
   * que se añade es mirar TAMBIÉN el expediente. Ausente = nunca se pidió: no
   * se da por otorgado por omisión jamás.
   */
  const yaConsintio = consentimiento || !!patient?.consentimientoGrabacion?.fecha

  /**
   * ¿ESTAMOS AL PRINCIPIO — sin nada grabado todavía?
   *
   * Es lo que decide si se enseña sólo el botón grande o la fila entera de
   * controles. Al principio, pausar, cancelar y «Procesar con IA» no significan
   * nada: no hay nada que pausar ni que procesar.
   *
   * Se mira el estado del grabador Y la transcripción: si el médico vuelve a
   * una consulta con algo ya dictado, tiene que ver los controles aunque el
   * grabador esté parado.
   */
  const esElPrincipio = audio.estado === 'inactivo'
    && !voz.grabando
    && !voz.transcripcion.trim()

  const iniciarGrabacion = () => {
    // arrancarSegunModo, NO voz.iniciar directo: `modoVoz` está en 'whisper', así
    // que el grabador real es `audio`. Llamar voz.iniciar() arrancaba un SEGUNDO
    // grabador (Web Speech) en paralelo al de Whisper — dos motores escribiendo la
    // misma transcripción. El atajo de teclado disparaba justo este camino.
    if (yaConsintio) { arrancarSegunModo(); return }
    setModalConsentimiento(true)
  }
  /** Lo que decían las alergias al abrir, para poder asentar QUÉ cambió. */
  const alergiasAlAbrir = useRef('')

  const confirmarConsentimiento = () => {
    setConsentimiento(true)
    setModalConsentimiento(false)
    /**
     * DEJAR CONSTANCIA DE QUE SE CONSINTIÓ.
     *
     * El evento `consentimiento_grabacion` existía en el catálogo, en la lista
     * blanca del servidor y en las etiquetas del panel de cumplimiento — y no lo
     * emitía NADIE. El consentimiento vivía en un `useState`: se grababa la voz
     * del paciente, se enviaba a un tercero para transcribir, y ante una queja no
     * había absolutamente nada que exhibir.
     *
     * La marca la pone el servidor (uid y hora del token), como el resto de la
     * bitácora.
     */
    void logAudit({ evento: 'consentimiento_grabacion', clinicId: clinicId ?? '', patientId })
    /**
     * Y QUEDA EN EL EXPEDIENTE, no sólo en la bitácora.
     *
     * La bitácora sirve para auditar; el expediente es donde un consentimiento
     * tiene sentido y donde se puede consultar sin pedirle nada a nadie. Es
     * además lo que permite no volver a preguntarlo.
     *
     * Con su propio `catch`: si Firestore falla, la grabación NO se cae — se
     * volverá a pedir la próxima vez, que es el lado seguro del error.
     */
    if (clinicId) {
      void updatePatient(clinicId, patientId, {
        consentimientoGrabacion: { fecha: new Date().toISOString(), medicoId: auth.currentUser?.uid },
      }).catch(() => { /* se volverá a pedir: es el lado seguro */ })
    }
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
    /**
     * `getPatient`, no `getPatients`. Se bajaba la colección COMPLETA de pacientes
     * para quedarse con uno — y el comentario de `getPatient` nombra literalmente
     * a la consulta entre las pantallas que deben usarla. El expediente ya lo
     * hacía bien; esta pantalla se había quedado atrás.
     */
    getPatient(clinicId, patientId)
      .then(p => { setPatient(p); setPacienteError(!p); alergiasAlAbrir.current = p?.alergias ?? '' })
      .catch((e: unknown) => { console.error('cargar paciente:', e); setPacienteError(true) })
    getUltimasNotasResumen(clinicId, patientId)
      .then(r => { ultimasNotasRef.current = r; setContextoPrevio(r) })
      .catch(e => console.error('contexto de visitas previas:', e))  // degrada sin romper la nota
    // La medicación vigente sale de TODAS las notas, no sólo de la última: manda
    // lo que se dijo por última vez de CADA fármaco (ver `ordenes-medicamento`).
    getNotas(clinicId, patientId)
      .then(ns => {
        const firmadas = ns.filter(n => n.estado === 'firmada')
          .map(n => ({
            fecha: n.fechaConsulta ?? n.metadata?.fechaCreacion ?? '',
            medicamentos: n.medicamentos,
            diagnosticos: n.diagnosticos,
          }))
        setVigentes(medicamentosVigentes(firmadas))
        // La lista de problemas sigue la MISMA regla que la medicación: manda lo
        // último que se dijo de CADA problema. Una consulta por gripa que no
        // habla de la diabetes no resuelve la diabetes.
        setProblemas(problemasActivos(firmadas))
        const ultima = firmadas.map(n => n.fecha).filter(Boolean).sort().pop()
        setUltimaVisita(ultima)
        /**
         * LEARN — lo que el médico corrigió a mano deja de perderse.
         *
         * La nota guarda las DOS versiones desde la v996: lo que el reconocedor
         * oyó y el texto de trabajo que el médico pudo editar. La diferencia
         * ENTRE AMBAS es la corrección: no hay que pedirle que enseñe nada, ya
         * lo hizo al escribir.
         *
         * Se leen sólo notas FIRMADAS: un borrador a medio escribir tiene el
         * texto en cualquier estado, y aprender de él sería aprender de un
         * trabajo sin terminar.
         */
        const nombre = partesDelNombre(patient?.nombre)
        const pares = ns
          .filter(n => n.estado === 'firmada')
          .flatMap(n => paresDeUnaNota(n.transcripcionMotor ?? '', n.transcripcionCruda ?? '', nombre))
        const deEstePaciente = loAprendido(pares, undefined, nombre)
        setDeEstePaciente(deEstePaciente)
        /**
         * Y LO DEL CONSULTORIO — que es donde de verdad sirve.
         *
         * Lo aprendido con don Luis tiene que servir con la siguiente paciente.
         * Las dos listas se fusionan por palabra: el vocabulario del reconocedor
         * no distingue de dónde salió cada término, sólo cuántos caben.
         */
        leerAprendido(clinicId)
          .then(delConsultorio => setAprendido(fusionar(deEstePaciente, delConsultorio)))
          .catch(() => setAprendido(deEstePaciente))
      })
      .catch(e => console.error('medicación vigente:', e))   // degrada sin romper la nota
  }, [clinicId, patientId])

  // ── Cargar nota existente (borrador) si viene ?nota= ───────────
  useEffect(() => {
    if (!clinicId || !patientId || !notaIdParam) return
    getNota(clinicId, patientId, notaIdParam).then(n => {
      /**
       * SI NO SE PUDO LEER LA NOTA, NO SE ESCRIBE ENCIMA DE ELLA.
       *
       * `notaIdRef` ya apunta a `notaIdParam` antes de esta lectura, así que el
       * guardado sabe a qué documento escribir aunque nunca lo haya leído. Abrir
       * un borrador de 5 secciones con la red intermitente dejaba la pantalla con
       * la plantilla VACÍA y sin ningún error visible; el médico tecleaba una
       * línea y a los 30 s el autoguardado reducía la nota a esa línea.
       */
      if (!n) {
        setErrorCargaNota('Esa nota ya no existe o no se pudo leer. No se guardará nada encima hasta recargar.')
        notaIdRef.current = null   // que un guardado accidental no pise el documento
        return
      }
      setErrorCargaNota('')
      // El testigo de concurrencia arranca en lo que había AL ABRIR. Todo lo que
      // aparezca distinto en Firestore a partir de aquí es de otra sesión.
      vistoEnRef.current = n.metadata?.fechaModificacion
      setTipo(n.tipo)
      /**
       * ── LO QUE SE RESTAURA PUEDE VENIR DE OTRA ÉPOCA (REG-218) ────────────
       *
       * `signosVitales` llevaba guarda y estos tres NO. Una nota vieja, o
       * escrita por otro módulo, que no traiga el campo dejaba el estado en
       * `undefined` y el siguiente render reventaba en `.map` / `.filter`.
       * El médico veía «Algo se atoró en esta pantalla», con el paciente
       * delante.
       */
      setSecciones(seccionesSanas(n.secciones))
      setSignos(n.signosVitales ?? {})
      setDiagnosticos(diagnosticosSanos(n.diagnosticos))
      setMedicamentos(medicamentosSanos(n.medicamentos))
      setResumen(n.resumenEjecutivo ?? '')
      setFirmada(n.estado === 'firmada')
      /**
       * V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, segunda rebanada) — ESTUDIOS
       * TAMBIÉN SE RESTAURAN.
       *
       * A diferencia de `secciones`/`diagnosticos`/`medicamentos`, este campo
       * nunca se leía de vuelta desde Firestore. Con la URL ahora llevando
       * `?nota=<id>` tras firmar (ver `router.replace` en `firmar()`), volver
       * de `/orden` o reabrir una nota firmada remonta esta pantalla y corre
       * este efecto — y sin esta línea el paso "Imprimir la orden de
       * estudios" desaparecía de `ComoCerrarLaConsulta` (no se pintaba
       * apagado: no existía), porque `estudiosOrden` volvía a `[]`.
       */
      if (Array.isArray(n.estudiosOrden)) setEstudiosOrden(n.estudiosOrden)
      if (n.preop) setPreop(n.preop)
      if (n.iaAuditoria) {
        if (n.iaAuditoria.extraction) setExtraction(n.iaAuditoria.extraction)
        if (n.iaAuditoria.safety) setSafety(n.iaAuditoria.safety)
        if (Array.isArray(n.iaAuditoria.aprobadosPorMedico)) setAprobados(new Set(n.iaAuditoria.aprobadosPorMedico))
        if (n.iaAuditoria.provenance) setProvenanceIA(n.iaAuditoria.provenance)  // conservar al re-guardar
      }
      if (n.transcripcionCruda) voz.setTranscripcion(n.transcripcionCruda)
      // La otra mitad del par de aprendizaje. Ver `transcripcionMotorGuardadaRef`.
      if (n.transcripcionMotor) transcripcionMotorGuardadaRef.current = n.transcripcionMotor
      if (n.internamientoId) setNotaInternamientoId(n.internamientoId)  // adopta el episodio
    }).catch(e => {
      console.error('[consulta] no se pudo cargar la nota:', e)
      setErrorCargaNota('No pudimos cargar esta nota. Revisa tu conexión y recarga — no se guardará nada encima mientras tanto.')
      notaIdRef.current = null
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
      // La huella es de lo que SE MANDÓ a revisar, no de lo que hay en pantalla
      // ahora: entre que salió la petición y volvió, el médico pudo teclear.
      const huella = huellaRevisable(nota as ContenidoRevisable)
      if (data?.ok) setVerificacion({ modelo: data.modelo ?? 'IA', hallazgos: data.hallazgos ?? [], huella })
      // Auditoría 2026-07 (P1): NO mostrar «sin observaciones» si la revisión falló.
      // La segunda opinión queda nula (no verde) y se avisa que no se verificó.
      else if (data?.incompleto) {
        toast(data.error ?? 'La segunda opinión no se pudo completar; la nota NO fue verificada.', 'error')
        /**
         * PERO LOS HALLAZGOS DE LO QUE SÍ SE REVISÓ NO SE TIRAN.
         *
         * Con la revisión por tramos, «incompleto» ya no significa «no se
         * revisó nada»: puede ser que se revisaran dos de tres tramos y que en
         * ellos hubiera una dosis peligrosa. Esconderla porque el tercer tramo
         * no cupo sería tirar justo lo que se pagó por encontrar.
         *
         * El aviso de arriba dice qué parte quedó fuera, así que la lista NO se
         * lee como una revisión completa.
         */
        const parciales = Array.isArray(data.hallazgos) ? data.hallazgos : []
        if (parciales.length > 0) setVerificacion({ modelo: `${data.modelo ?? 'IA'} · revisión parcial`, hallazgos: parciales, huella })
      }
    } catch { /* silencioso: la segunda opinión es un extra, no bloquea */ }
    finally { setVerificando(false) }
  }, [patient?.edad, patient?.sexo, patient?.alergias, toast])

  // Segunda opinión A DEMANDA (plan Pro): construye la nota desde el estado actual
  // y la manda a verificar. En Premium ya corre sola tras generar.
  const pedirSegundaOpinion = useCallback(() => {
    void verificarNota(
      {
        resumen,
        secciones: secciones.map(s => ({ titulo: s.label, contenido: s.value })),
        diagnosticos, medicamentos, signos: signosNum,
      },
      /**
       * EL REVISOR LEE LO MISMO QUE LEYÓ EL REDACTOR.
       *
       * Aquí iba `voz.transcripcion` —texto plano, sin turnos y **sin las marcas
       * de palabra dudosa**—, mientras la segunda opinión automática sí recibía
       * el diálogo marcado. O sea que el revisor a demanda no veía ni una sola
       * `⟦palabra?⟧`: revisaba una nota contra una versión del dictado en la que
       * todas las palabras parecían igual de seguras.
       *
       * Un revisor que lee otro texto que el redactor no es una segunda opinión:
       * es una opinión sobre otra cosa.
       */
      textoParaLaIA(),
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
          /** El cuadro completo, igual que el copiloto (REG-188). */
          diagnosticos: dxDelCuadro,
          medicamentos: medsDelCuadro,
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
      // Sin el NOMBRE del paciente: no aporta nada clínico y evita transferir PII a un
      // tercero en el extranjero (minimización, igual que buildUserPrompt del prompt maestro).
      const contextoPaciente = `${patient?.edad ?? '?'} años, ${patient?.sexo ?? '?'}. Alergias: ${patient?.alergias || 'no referidas'}.`
      const res = await fetchAutenticado('/api/consultor-evidencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta, contextoPaciente }),
      })
      // La ruta responde NDJSON, no JSON. Esto hacía `res.json()`, que revienta en
      // la segunda línea: el servidor ya había llamado al modelo y descontado los
      // créditos, y el médico veía «No se pudo generar el análisis». El botón no
      // había funcionado nunca.
      const d = await leerNdjson(res)
      if (!d.texto.trim()) { toast(d.error || 'No se pudo generar el análisis', 'error'); return }
      let texto = limpiarMarkdown(d.texto)
      const articulos = (d.meta?.articulos ?? []) as { titulo: string; revista: string; anio: string; pmid: string }[]
      if (articulos.length > 0) {
        texto += '\n\nReferencias:\n' + articulos.map((a, i) =>
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

  const procesarIA = useCallback(async (tipoOverride?: TipoNota, opts?: { enVivo?: boolean; preliminar?: boolean }) => {
    // Una nota firmada es inmutable. El atajo de teclado no comprobaba esto y
    // reescribía en pantalla el contenido de una nota ya firmada: lo que se veía
    // dejaba de coincidir con lo almacenado y con lo que se entregó al paciente.
    if (firmadaRef.current) return
    // enVivo = estructuración EN TIEMPO REAL mientras se graba (silenciosa, sin
    // toasts ni reset de aprobaciones; la nota se va armando sola).
    const enVivo = opts?.enVivo === true
    /**
     * `preliminar` = esta nota se armó con el texto del streaming mientras la
     * diarización sigue corriendo, y va a re-proyectarse en cuanto llegue el
     * texto bueno. No se pide segunda opinión sobre ella: se pagaría dos veces
     * por revisar una nota que está por reemplazarse, y peor aún, el médico
     * vería hallazgos de una versión que ya no existe.
     */
    const preliminar = opts?.preliminar === true
    if (!voz.transcripcion.trim()) { if (!enVivo) toast('No hay transcripción que procesar', 'info'); return }
    if (enVivo && vivoRef.current) return  // ya hay una estructuración en vivo en curso
    const tipoActivo = tipoOverride ?? tipo
    // Si hubo diarización, mandamos el diálogo etiquetado por hablante para que la
    // IA atribuya bien quién dijo qué (médico/paciente). Si no, el texto plano.
    //
    // PERO la diarización es POR blob y solo cubre el ÚLTIMO tramo grabado. Cuando
    // la grabación fue multi-tramo (baseTranscripcionRef trae lo previo), usar las
    // utterances mandaría a la IA SOLO el último tramo y la nota final perdería la
    // primera parte clínica. En ese caso se usa la transcripción completa (texto
    // plano rec1+rec2): se sacrifican las etiquetas de voz, nunca el contenido.
    const multiTramo = baseTranscripcionRef.current.trim().length > 0
    /**
     * LAS PALABRAS DUDOSAS VAN MARCADAS, Y CON SU REGLA.
     *
     * El motor devuelve una confianza por palabra y hasta la v974 se tiraba: el
     * modelo recibía «la de la docencia» con el mismo aplomo que «dolor
     * abdominal», y en una consulta real eso acabó escrito como «vesícula».
     *
     * La instrucción viaja pegada al texto y no en el prompt del servidor a
     * propósito: si algún día llega un dictado SIN marcas, no se le cuelan
     * reglas sobre marcas que no existen — y una regla que habla de algo que no
     * está es ruido que el modelo tiene que descartar solo.
     */
    const transcripcionParaIA = textoParaLaIA(multiTramo)
    if (enVivo) { vivoRef.current = true; setEstructurandoVivo(true) } else { setProcesando(true); setVerificacion(null); setTareaProc({ ejecutando: true }) }
    try {
      const res = await fetchAutenticado('/api/expediente/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripcion: transcripcionParaIA,
          tipo: tipoActivo,
          // La preliminar TAMBIÉN va en modelo rápido (Haiku): es un borrador que
          // se re-proyecta en cuanto llega la diarización. Antes corría el motor
          // completo (Opus + razonamiento, ~40s) y el médico igual esperaba
          // mirando la pantalla — el propósito de la nota "instantánea" se perdía.
          rapido: enVivo || preliminar,
          motor: (enVivo || preliminar) ? undefined : motorEfectivo,  // menú de IA: ⚡/⭐/💎 (o default del plan)
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

      /**
       * EL PASE EN VIVO NO PISA LO QUE EL MÉDICO ESCRIBIÓ A MANO.
       *
       * Mientras se graba, cada ~18 palabras nuevas se re-estructura la nota. Con
       * el mapeo de antes eso REEMPLAZABA: la sección que el médico estaba
       * tecleando se sustituía, y `setDiagnosticos(nuevosDx)` borraba el arreglo
       * completo — incluido el diagnóstico que acababa de agregar a mano con su
       * CIE-10. Sin ningún aviso, porque en vivo los toasts están suprimidos.
       *
       * En vivo la IA solo RELLENA huecos. En el "Procesar" normal (que el médico
       * pidió a propósito) sigue mandando la IA, como hasta ahora.
       */
      /**
       * ── LO QUE LA IA ESCRIBIÓ, ANTES DE TOCAR LA PANTALLA ────────────────────
       *
       * Se calcula aquí y no dentro del `setSecciones` porque React puede
       * ejecutar un actualizador de estado dos veces; anotar la procedencia
       * desde dentro dejaría el registro dependiendo de cuántas veces corrió.
       */
      const loQueEscribeLaIa: Record<string, string> = {}
      for (const [clave, valor] of Object.entries(data.secciones ?? {})) {
        if (typeof valor !== 'string' || !valor.trim()) continue
        const limpio = sinHuecoDeProsa(valor)
        if (limpio) loQueEscribeLaIa[clave] = sanitizarProsa(limpio)
      }

      // La transcripción cruda NUNCA se vuelca dentro de la nota (es material de origen).
      setSecciones(prev => {
        /**
       * ── LAS SECCIONES SON SIEMPRE LAS DEL TIPO ACTIVO (REG-196) ──────────────
       *
       * Antes, sin `tipoOverride`, la base era `prev`: las secciones que ya había en
       * memoria. Si venían de otro tipo —porque la nota se creó como seguimiento y
       * luego se marcó como primera vez— esas claves NO salían nunca, y la nota
       * quedaba titulada «Primera Vez» con encabezados SUBJETIVO/OBJETIVO/PLAN.
       *
       * `seccionesDelTipo` devuelve exactamente las del tipo conservando lo escrito
       * en las que coinciden; lo que no pertenece se queda fuera de la nota (y se
       * devuelve aparte, no se borra).
       */
      const base = seccionesDelTipo(tipoActivo, tipoOverride ? [] : prev).secciones
        return base.map(s => {
          const valorIA = data.secciones?.[s.key]
          if (typeof valorIA !== 'string' || !valorIA.trim()) return s
          /**
           * ── UN HUECO ESCRITO NO ES UNA SECCIÓN ESCRITA (REG-217) ──────────
           *
           * «No referido.» se descarta ANTES de la guarda de abajo. Si no, la
           * primera pasada en vivo —que ocurre cuando apenas se dictó la ficha
           * de identificación— escribía el hueco, y `s.value?.trim()` lo daba
           * por contenido: NINGUNA pasada posterior podía corregirlo. El médico
           * dictaba la consulta entera y la nota se quedaba hueca.
           *
           * Distingue el hueco del negativo pertinente: «no refiere fiebre ni
           * disnea» es un dato clínico y se conserva.
           */
          const limpio = sinHuecoDeProsa(valorIA)
          if (!limpio) return s
          /**
           * ── LA PRIMERA VERSIÓN YA NO CONGELA EL APARTADO ────────────────────
           *
           * Antes decía: «si en vivo la sección ya tiene texto, no la toques».
           * La intención era buena —no pisar lo que el médico teclea mientras la
           * IA corre—, pero «ya tiene texto» **incluía lo que había escrito un
           * pase anterior DE LA PROPIA IA**.
           *
           * Y el pase en vivo corre cada 15 segundos, con el modelo rápido, y el
           * primero ocurre con la consulta apenas empezada. Resultado: la
           * versión más pobre de cada apartado se quedaba fija para siempre.
           *
           * Le pega justo a este médico, que dicta SALTANDO: cuando regresa a
           * antecedentes en el minuto diez, ningún pase posterior podía ya
           * corregir lo que se escribió en el minuto uno. Es su queja literal —
           * «no llenas los apartados como es».
           *
           * La distinción correcta no es «vacío o lleno»: es **quién lo
           * escribió**. Si lo que hay coincide con lo que la IA puso en su pase
           * anterior, es suyo y puede mejorarlo. Si NO coincide, lo cambió el
           * médico y no se toca — que era lo que la guarda quería proteger.
           *
           * Mismo criterio que ya usan los diagnósticos y los medicamentos.
           */
          const loPusoLaIa = seccionesDeLaIaRef.current[s.key]
          const loCambioElMedico = !!s.value?.trim()
            && s.value.trim() !== (loPusoLaIa ?? '').trim()
          if (enVivo && loCambioElMedico) return s
          return { ...s, value: sanitizarProsa(limpio) }
        })
      })
      // Queda anotado qué dejó la IA, para que el próximo pase sepa qué es suyo.
      seccionesDeLaIaRef.current = { ...seccionesDeLaIaRef.current, ...loQueEscribeLaIa }

      const nuevosDx = Array.isArray(data.diagnosticos) ? data.diagnosticos.filter((d: Diagnostico) => d.descripcion) : []
      if (tipoOverride) {
        // RE-PROYECCIÓN a otra modalidad de nota: se parte de plantilla limpia a propósito.
        setDiagnosticos(nuevosDx)
        dxDeLaIaRef.current = nuevosDx
      } else if (nuevosDx.length > 0) {
        /**
         * FUSIÓN CON PROCEDENCIA — no acumula, y sigue sin borrar lo del médico.
         *
         * La versión anterior concatenaba y sólo descartaba el repetido si el
         * texto era IDÉNTICO letra por letra. Con el pase en vivo disparando
         * cada 15 s y la IA redactando distinto cada vez, una consulta acababa
         * con 19 diagnósticos y tres redacciones del mismo código.
         *
         * Ahora se sustituye SÓLO lo que la IA puso en su pasada anterior, se
         * conserva siempre lo que escribió el médico, y se deduplica por CIE-10
         * cuando lo hay — que es para lo que existe el código.
         */
        setDiagnosticos(prev => fusionarDiagnosticos({
          previos: prev, nuevos: nuevosDx, deLaIaAnterior: dxDeLaIaRef.current,
        }))
        dxDeLaIaRef.current = nuevosDx
      }

      const nuevosMed = Array.isArray(data.medicamentos) ? data.medicamentos.filter((m: Medicamento) => m.nombre) : []
      if (tipoOverride) {
        setMedicamentos(nuevosMed)
        medDeLaIaRef.current = nuevosMed
      } else if (nuevosMed.length > 0) {
        /**
         * FUSIÓN CON PROCEDENCIA — la lista deja de acumular.
         *
         * Antes hacía `[...previos, ...nuevos]` y sólo descartaba el repetido si
         * el nombre coincidía letra por letra. Con el pase en vivo corriendo
         * cada 15 s, lo que se dictó al recabar ANTECEDENTES en el minuto dos
         * («toma metformina y losartán») se quedaba en la lista para siempre —
         * y esa lista es la que se imprime en la receta.
         *
         * Es el mismo arreglo que ya tenían los diagnósticos, y que a los
         * medicamentos nunca se les aplicó: se sustituye SÓLO lo que la IA puso
         * en su pasada anterior y se conserva siempre lo que escribió el médico.
         */
        setMedicamentos(prev => fusionarMedicamentos({
          previos: prev, nuevos: nuevosMed, deLaIaAnterior: medDeLaIaRef.current,
        }))
        medDeLaIaRef.current = nuevosMed
      }

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
        // La nota la produjo el parser local: que la procedencia lo diga en vez
        // de arrastrar el modelo del procesamiento anterior.
        if (!enVivo) setProvenanceIA({ modelo: 'parser-local', promptVersion: 'n/a', apiVersion: 'n/a', generadoEn: new Date().toISOString() })
        if (!enVivo) toast(data._aviso || 'La IA no estructuró la nota — se llenó lo básico, revisa todo', 'error')
      } else if (!enVivo) {
        toast('Nota estructurada por IA — revisa campo por campo', 'success')
        setPlanActual(data._plan === 'premium' ? 'premium' : 'pro')
        if (data._uso) setUsoIA(data._uso)
        // Segunda opinión (GPT-5): AUTOMÁTICA en plan Premium; en plan Pro es un
        // botón a demanda (controla el costo). En ambos revisa seguridad clínica.
        if (data._plan === 'premium' && !preliminar) {
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
        setTareaProc({ ejecutando: false, resultado: { data: data as Record<string, unknown>, tipoActivo, tipoOverride: !!tipoOverride, ts, notaId: notaIdRef.current } })
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

    /**
     * EL RESULTADO SOLO SE APLICA A LA NOTA QUE LO PIDIÓ.
     *
     * `tareaProc` vive en el provider del layout y nunca se limpiaba, mientras que
     * `resultadoAplicadoRef` vuelve a 0 en cada montaje. Así que cualquier montaje
     * posterior de la consulta de ese paciente volvía a aplicar un resultado ya
     * aplicado:
     *
     *   molesto → volver de la Agenda mostraba otra vez "Tu nota terminó de
     *     procesarse mientras navegabas ✓", siendo mentira, una y otra vez.
     *   GRAVE  → firmar la nota y abrir una SEGUNDA consulta del mismo paciente
     *     en la misma sesión volcaba el resumen, las secciones, los diagnósticos y
     *     los medicamentos de la consulta ANTERIOR dentro de la nota nueva y
     *     vacía. Sin más aviso que un toast que sonaba a buena noticia.
     */
    if (firmadaRef.current) return
    if ((r.notaId ?? null) !== (notaIdRef.current ?? null)) {
      setTareaProc({ ejecutando: false })   // era de otra nota: se descarta
      return
    }
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
      /** Igual que arriba: nunca sobreviven claves de otro tipo (REG-196). */
      const base = seccionesDelTipo(tipoActivo, tipoOverride ? [] : prev).secciones
      return base.map(s => {
        // El mismo saneo que arriba: dos sitios con la misma regla, no dos reglas.
        const v = sinHuecoDeProsa(data.secciones?.[s.key])
        return v ? { ...s, value: sanitizarProsa(v) } : s
      })
    })
    const nuevosDx = Array.isArray(data.diagnosticos) ? data.diagnosticos.filter(d => d.descripcion) : []
    if (tipoOverride) setDiagnosticos(nuevosDx)   // re-proyección: plantilla limpia
    else if (nuevosDx.length > 0) {
      // El mismo motor que arriba: dos sitios con la misma regla, no dos reglas.
      setDiagnosticos(prev => fusionarDiagnosticos({
        previos: prev, nuevos: nuevosDx, deLaIaAnterior: dxDeLaIaRef.current,
      }))
      dxDeLaIaRef.current = nuevosDx
    }
    const nuevosMed = Array.isArray(data.medicamentos) ? data.medicamentos.filter(m => m.nombre) : []
    if (tipoOverride) { setMedicamentos(nuevosMed); medDeLaIaRef.current = nuevosMed }
    else if (nuevosMed.length > 0) {
      // Mismo criterio que el camino de primer plano: se sustituye lo de la IA,
      // se conserva lo del médico. Ver `fusionarMedicamentos`.
      setMedicamentos(prev => fusionarMedicamentos({
        previos: prev, nuevos: nuevosMed, deLaIaAnterior: medDeLaIaRef.current,
      }))
      medDeLaIaRef.current = nuevosMed
    }
    if (data.signosVitales) {
      const sv = data.signosVitales
      setSignos(prev => ({ fc: sv.fc || prev.fc, fr: sv.fr || prev.fr, ta: sv.ta || prev.ta, temperatura: sv.temperatura || prev.temperatura, spo2: sv.spo2 || prev.spo2, peso: sv.peso || prev.peso, talla: sv.talla || prev.talla }))
    }
    if (data.extraction) setExtraction(data.extraction as typeof extraction)
    if (data.safety) setSafety(data.safety as typeof safety)
    setProcesando(false)
    // Consumido: se limpia para que no se re-aplique en el siguiente montaje.
    setTareaProc({ ejecutando: false })
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
          /**
           * EL MÓDULO VIAJA: los roles de un pase de hospital no son los de un
           * consultorio. Sin esto, enfermería se etiquetaba como «Paciente»
           * porque el catálogo no tenía otra casilla.
           */
          body: JSON.stringify({
            utterances: utts.map(u => ({ speaker: u.speaker, text: u.text })),
            contexto: internamientoActivo ? 'hospitalizacion' : 'consulta',
          }),
        })
        const data = await res.json().catch(() => null)
        /**
         * LA SEPARACIÓN DE VOCES PUDO NO SEPARAR NADA, Y ESO HAY QUE DECIRLO.
         *
         * Cuando el proveedor devuelve una sola voz con dos personas dentro, el
         * servidor ya no reparte roles — antes contestaba «Médico» y **todo lo
         * que dijo el paciente quedaba como dicho por el médico**.
         *
         * Callarlo dejaría al médico firmando una nota cuya procedencia es
         * falsa sin ninguna señal. Se avisa UNA vez (el efecto tiene guarda por
         * firma de turnos) y no se bloquea nada: es información para revisar
         * antes de firmar, no una compuerta.
         */
        if (data?.separacionFallida && data?.aviso) {
          toast(String(data.aviso), 'info')
          return
        }
        if (data?.ok && data.roles && Object.keys(data.roles).length > 0) setRolesHablante(data.roles)
      } catch { /* silencioso: el médico puede etiquetar a mano */ }
    })()
  }, [audio.utterances, voz.grabando, internamientoActivo, toast])

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

  /**
   * En cuanto se DETIENE (estado 'subiendo'), se estructura ya con el texto del
   * streaming en vez de esperar a la diarización. Ver `preliminarRef`.
   *
   * Se exige un mínimo de palabras: con cuatro frases sueltas la IA no produce
   * una nota útil y solo se gastaría una llamada.
   */
  useEffect(() => {
    if (audio.estado !== 'subiendo' || firmada || procesando) return
    if (preliminarRef.current) return
    const palabras = voz.transcripcion.trim().split(/\s+/).filter(Boolean).length
    if (palabras < 40) return
    preliminarRef.current = true
    edicionManualRef.current = false
    procesarIARef.current(undefined, { preliminar: true })
  }, [audio.estado, firmada, procesando, voz.transcripcion])


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
    setNerCargando(true); setNerError(''); setEntidades(null); setNegacionesCorregidas([])
    try {
      // Auditoría 2026-07 (P1): mandamos las alergias REGISTRADAS del expediente
      // para que el cross-check alergia↔medicamento las considere, no solo las
      // que se dictaron en esta consulta.
      // El MISMO parser que el sesgo y que la receta: un cuarto criterio para el
      // mismo campo es un cruce alergia↔fármaco que se pierde en una pantalla y
      // salta en otra.
      const alergiasRegistradas = alergenosDe(patient ?? {})
      const res = await fetchAutenticado('/api/expediente/extraer-entidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoFuente, alergiasRegistradas }),
      })
      const data = await res.json().catch(() => null)
      if (!data || !data.ok) {
        setNerError(data?.error ?? 'No se pudieron extraer entidades')
        toast(`NER: ${data?.error ?? 'error'}`, 'error')
        return
      }
      setEntidades(data as EntidadesExtraidas)
      setNegacionesCorregidas(((data as { negacionesCorregidas?: NegacionCorregida[] }).negacionesCorregidas) ?? [])
      setAvisosTemporales(((data as { avisosTemporales?: AvisoTemporal[] }).avisosTemporales) ?? [])
      const bloquea = (data.cross_check?.alergia_vs_medicamento ?? []).filter((c: { RIESGO_MAXIMO: boolean }) => c.RIESGO_MAXIMO).length
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
  }, [voz.transcripcion, secciones, toast, patient?.alergias])

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
        /**
         * El UUID de respaldo se genera UNA vez, no en cada render.
         *
         * `construirNota` corre en cada render (la validación NOM-004 de abajo la
         * llama), así que `crypto.randomUUID()` devolvía un id distinto cada vez.
         * Si se firmaba antes de que existiera `notaId`, el hash de la firma se
         * calculaba sobre un identificador aleatorio que ni era el id del
         * documento en Firestore ni coincidía con el de milisegundos antes: el
         * sello de integridad dejaba de poder verificarse.
         */
        id: notaId ?? notaIdRef.current ?? uuidRespaldoRef.current,
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
      /**
       * LA VÍA SE CORRIGE AQUÍ, NO EN EL PAPEL.
       *
       * `corregirViaParenteral` sólo se aplicaba al abrir la receta, y esa
       * pantalla no escribe de vuelta. Si la extracción dejaba una insulina como
       * «oral», la NOTA se firmaba así —y una nota firmada es inmutable—
       * mientras el papel decía «subcutánea»: el documento legal y lo que se
       * dispensa contándose cosas distintas. Y la vía equivocada se propaga a
       * las consultas siguientes por `medicamentosVigentes`.
       *
       * Corregir aquí es antes de firmar, donde el médico todavía lo ve y lo
       * puede cambiar.
       */
      medicamentos: medicamentos.map(m => ({ ...m, via: corregirViaParenteral(m.nombre, m.via) as Medicamento['via'] })),
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
      /**
       * ── LA ALERGIA ESTRUCTURADA NO LLEGABA A LA COMPUERTA (7-ago-2026) ──────
       *
       * `parsearAlergiasTexto(patient?.alergias)` sólo mira el TEXTO LIBRE. Un
       * paciente cuya alergia vive en `alergiasEstructuradas` —que es donde la
       * deja el registro estructurado— sellaba `alergias: []` en la nota.
       *
       * Y de `nota.alergias` cuelga la COMPUERTA que bloquea la firma
       * (`nom004.ts`): el cruce por subcadena y el de reactividad cruzada por
       * familias. Reproducido con el motor real:
       *
       *     paciente con «Penicilina» sólo en el campo estructurado
       *     + prescripción de cefalexina
       *     → la pantalla pinta la alergia en rojo (lee `alergiasDe`)
       *     → la compuerta devuelve CERO errores
       *     → el betalactámico se firma sobre un alérgico, con el aviso a la vista
       *
       * `alergiasDe` lee LAS DOS fuentes y devuelve el mismo tipo que la
       * compuerta espera. Es el mismo defecto de siempre: **dos lecturas del
       * mismo campo** (ADR-001, REG-034/035/171). La pantalla y lo que se sella
       * tienen que leer de la misma fuente.
       *
       * Sigue quitando lo que el campo NIEGA: «niega alergia a penicilina» no es
       * una alergia, y hacía saltar la alerta que bloquea la firma.
       */
      alergias: alergiasDe(patient ?? {}),
      estudiosOrden: estudiosOrden.length ? estudiosOrden : undefined,
      internamientoId: internamientoActivo,
      // El bloque hospitalario, que hasta v941 se sellaba vacío. Lo que el
      // episodio no diga queda AUSENTE, no en blanco: un `servicio: ''` en un
      // documento firmado afirma «no tiene servicio», y lo cierto es «no se sabe».
      hospital: bloqueHospitalDe(episodio, now),
      preop,
      iaAuditoria: extraction || safety ? {
        extraction, safety,
        aprobadosPorMedico: Array.from(aprobados),
        // Sello de procedencia: cuántos datos vinieron del dictado / IA / a mano.
        // Aditivo y derivado (no inventa); queda en el registro medicolegal.
        /**
         * LA PROSA ENTRA AL SELLO, y entra por el MISMO objeto que la tira
         * de pantalla (`notaDelSello`). Antes esta lista se escribía aquí
         * a mano y la de la pantalla aparte: el registro contaba la prosa y lo
         * que el médico leía no, sobre la misma nota.
         *
         * Los tres fallos que el Dr. encontró en producción vivieron en la
         * prosa —«la de la docencia» convertido en «vesícula»; un «no» a la
         * pregunta por diabetes redactado como «paciente con DM2 e HTA»—, así
         * que el sello legible contaba con precisión la parte que no falló.
         */
        procedencia: construirManifiesto(
          notaDelSello,
          extraction as never,
          // Los vistos buenos del panel de revisión. Ya se guardaban como un
          // número suelto (`camposAprobados`), que dice cuántos aceptó el médico
          // pero no CUÁLES: ante una revisión, «aprobó tres cosas» no dice nada
          // de la que se discute. Ahora el sello lo lleva campo por campo.
          aprobados,
          // La transcripción, para poder COMPROBAR que la cita textual existe.
          // Sin esto bastaba una cadena no vacía para sellar un campo como
          // «dictado» y mostrar la frase entrecomillada como si fuera literal.
          {
            transcripcion: voz.transcripcion,
            /**
             * LOS TURNOS, PARA PODER JUZGAR DE QUIÉN ES LA CITA.
             *
             * Sin ellos, una cita del médico preguntando «¿diabetes o presión
             * alta?» sella el diagnóstico como «lo dijo el paciente»: la cita es
             * verdadera y la conclusión, falsa.
             */
            turnos: audio.utterances.map(u => ({
              rol: rolesHablante[u.speaker] || `Hablante ${u.speaker}`,
              texto: u.text,
            })),
          },
        ).resumen,
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
      /**
       * EL MATERIAL DE ORIGEN, POR FIN GUARDADO.
       *
       * `transcripcionCruda` es el texto de TRABAJO —corregido y editable—, así
       * que el «original» que quedaba archivado no era lo que el motor oyó. El
       * pipeline producía el crudo y se descartaba en la misma línea.
       */
      /**
       * El del grabador si hay dictado nuevo; si no, el que la nota ya traía.
       * Sin este respaldo, firmar en una sesión posterior borraba la mitad del
       * par y el bucle de corrección se quedaba sin nada que aprender.
       */
      transcripcionMotor: audio.transcripcionMotor || transcripcionMotorGuardadaRef.current || undefined,
      /**
       * LOS TURNOS, SIN LAS PALABRAS.
       *
       * Se estaba guardando el objeto completo, con la confianza de cada palabra:
       * miles de objetos dentro del documento de la nota, que ya tiene historial
       * de reventar el tope de 1 MB de Firestore y bloquear TODO guardado
       * posterior. El tipo declarado siempre fue `{speaker, text}`.
       */
      dialogoDiarizado: audio.utterances.length > 0
        ? audio.utterances.map(u => ({
            speaker: u.speaker,
            text: u.text,
            // Y QUIÉN HABLÓ, no sólo qué etiqueta le puso el motor.
            //
            // `speaker` es «A»/«B». El rol —revisado o corregido por el médico
            // en pantalla— se usaba para la procedencia al firmar y luego se
            // tiraba, así que el diálogo archivado no decía quién dijo qué.
            ...(rolesHablante[u.speaker] ? { rol: rolesHablante[u.speaker] } : {}),
          }))
        : undefined,
      // Y lo que un revisor sí necesita: qué dudó el audio y en qué minuto.
      palabrasAVerificar: palabrasAVerificar.palabras.length > 0
        ? palabrasAVerificar.palabras
        : undefined,
      estado,
      fechaConsulta: now,
      createdAt: now,
      updatedAt: now,
      creadoPor: auth.currentUser?.uid ?? '',
    }
  }, [notaId, clinicId, patientId, patient, tipo, config, resumen, secciones, signos, diagnosticos, medicamentos, estudiosOrden, internamientoActivo, episodio, preop, extraction, safety, aprobados, voz.transcripcion, audio.utterances, notaDelSello])

  // ── Guardar borrador ───────────────────────────────────────────
  // silencioso=true para el autoguardado (no muestra toast)
  const guardarBorrador = useCallback((silencioso = false): Promise<void> => {
    if (!clinicId || firmada) return Promise.resolve()
    // Descartada a propósito: ni se guarda ni se recrea. Ver `descartadaRef`.
    if (descartadaRef.current) return Promise.resolve()
    // Nota que no se pudo leer: escribir sería sustituirla por lo que haya en
    // pantalla, que es la plantilla vacía. Se bloquea hasta recargar. En el
    // guardado MANUAL (no silencioso) se avisa; antes fallaba mudo.
    if (errorCargaNota) { if (!silencioso) toast('No se pudo abrir la nota; recárgala antes de guardar.', 'error'); return Promise.resolve() }
    // Paciente que no se pudo leer: guardar escribiría nombre y alergias vacíos
    // encima de la nota. Se bloquea hasta que la lectura del paciente tenga éxito.
    if (pacienteError) { if (!silencioso) toast('No se pudieron leer los datos del paciente; recarga antes de guardar.', 'error'); return Promise.resolve() }
    // Serializa: cada guardado espera al anterior. Así dos autoguardados no
    // crean la nota dos veces (usa notaIdRef, que es síncrona).
    const tarea = cadenaGuardadoRef.current.then(async () => {
      setGuardando(true)
      try {
        const nota = construirNota('borrador')
        const idActual = notaIdRef.current
        if (idActual) {
          /**
           * El versionado lo hace `updateNota`, y solo él.
           *
           * Aquí había una segunda llamada a `guardarVersion`. Entre las dos se
           * escribían DOS copias completas de la nota (con transcripción incluida)
           * en cada autoguardado de 30 s — una consulta de 20 min dejaba ~80
           * documentos. Y eran incompatibles: esta guardaba el estado NUEVO bajo el
           * campo `timestamp` (pese a que el comentario decía "snapshot ANTES de
           * sobrescribir", que era justo lo que NO hacía), y `updateNota` guarda el
           * documento PREVIO bajo `versionadoEn`. Como cada lector ordenaba por el
           * campo que el otro no tenía, Firestore excluía la mitad del historial.
           *
           * Se queda la de `updateNota`, que es la correcta: preserva lo que se va
           * a pisar, que es el sentido de una versión histórica.
           */
          /**
           * `vistoEnRef` es la marca de modificación que ESTA pestaña vio la
           * última vez. Si en Firestore hay otra distinta, alguien más escribió
           * y `updateNota` se niega en vez de pisarlo.
           *
           * Sin esto, dos pestañas sobre la misma nota autoguardaban cada 30 s
           * el estado completo de cada una y se pisaban alternándose: ganaba el
           * último tick, normalmente el de la pestaña olvidada desde la mañana.
           */
          try {
            await updateNota(clinicId, patientId, idActual, nota, vistoEnRef.current)
          } catch (e) {
            /**
             * EL DOCUMENTO YA NO ESTÁ: SE VUELVE A CREAR, NO SE PIERDE.
             *
             * Pasa cuando la pantalla trae un `notaId` de un respaldo local
             * restaurado o de una nota que se descartó. Antes, `updateDoc` sobre
             * un documento ausente volvía como PERMISSION_DENIED —la regla no
             * puede leer `resource.data` de lo que no existe— y el médico leía
             * «el servidor rechazó el permiso» mientras dictaba una consulta.
             *
             * Aquí se reabre como BORRADOR (REG-017: ninguna nota nace firmada)
             * con lo que hay en pantalla. El id cambia; el contenido no.
             */
            if ((e as { code?: string })?.code !== 'nota-inexistente') throw e
            // Si se descartó queriendo, no se recrea. Ver `descartadaRef`.
            if (descartadaRef.current) return
            const nuevo = await createNota(clinicId, patientId, { ...nota, estado: 'borrador' })
            notaIdRef.current = nuevo
            setNotaId(nuevo)
          }
          vistoEnRef.current = nota.metadata?.fechaModificacion ?? vistoEnRef.current
        } else {
          const id = await createNota(clinicId, patientId, nota)
          notaIdRef.current = id   // marca síncrona ANTES de re-render
          setNotaId(id)
          vistoEnRef.current = nota.metadata?.fechaModificacion
        }
        fallosGuardadoRef.current = 0
        if (!silencioso) toast('Borrador guardado', 'success')
      } catch (e) {
        console.error('[consulta] error guardando borrador:', e)
        /**
         * CONFLICTO DE VERSIÓN: no es un fallo de red, es otra sesión trabajando
         * sobre la misma nota. Se dice con esas palabras, porque «revisa tu
         * conexión» mandaría al médico a mirar el wifi mientras su compañero le
         * está sobrescribiendo la nota.
         */
        if ((e as { code?: string })?.code === 'conflicto-de-version') {
          toast('Otra sesión modificó esta nota. NO se guardó, para no pisar su trabajo. Copia lo tuyo y vuelve a abrirla.', 'error')
          return
        }
        /**
         * EL AVISO TIENE QUE DECIR LA CAUSA, NO SUPONERLA.
         *
         * Decía "revisa tu conexión" pasara lo que pasara. Si el fallo es de
         * permisos, de tamaño del documento o de token vencido, ese texto manda al
         * médico a mirar su wifi mientras el problema está en otro lado — y
         * mientras tanto sigue dictando creyendo que se guarda.
         */
        const codigo = (e as { code?: string })?.code ?? ''
        const detalle =
          codigo === 'nota-inexistente' ? String((e as Error).message)
          : codigo === 'permission-denied' ? 'el servidor rechazó el permiso (reglas o sesión vencida). Si acabas de restaurar un respaldo, puede que la nota original ya no exista'
          : codigo === 'unauthenticated' ? 'tu sesión expiró: vuelve a iniciar sesión'
          : /too large|invalid-argument|exceeds/i.test(String((e as Error)?.message ?? '')) ? 'la nota superó el tamaño máximo de un documento'
          : codigo === 'nota-demasiado-grande' ? String((e as Error).message)
          : codigo === 'unavailable' || codigo === 'deadline-exceeded' ? 'no hay conexión con el servidor'
          : codigo || String((e as Error)?.message ?? 'error desconocido').slice(0, 80)
        // El autoguardado siempre iba en silencio. Si fallaba una y otra vez, el
        // médico dictaba una consulta entera creyendo que se estaba guardando y
        // solo quedaba el respaldo local. A partir del tercer fallo seguido se
        // avisa, aunque sea el guardado automático.
        fallosGuardadoRef.current += 1
        if (!silencioso || fallosGuardadoRef.current >= 3) {
          toast(
            fallosGuardadoRef.current >= 3
              ? `La nota NO se está guardando en el servidor (${detalle}). Hay un respaldo local en este dispositivo: no cierres la pestaña.`
              : `Error al guardar el borrador: ${detalle}`,
            'error',
          )
        }
      } finally {
        setGuardando(false)
      }
    })
    cadenaGuardadoRef.current = tarea.catch(() => {})
    return tarea
  }, [errorCargaNota, pacienteError, clinicId, patientId, firmada, construirNota, toast])

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
      /**
       * Se marca ANTES de borrar, no después: entre el borrado y la navegación
       * cabe un autoguardado de la cadena, y ése es justo el que resucitaría la
       * consulta.
       */
      descartadaRef.current = true
      if (clinicId && idReal) {
        await deleteNota(clinicId, patientId, idReal)
      }
      // Y se suelta el id: ya no apunta a nada.
      notaIdRef.current = null
      setNotaId(null)
      try { localStorage.removeItem(respaldoKey) } catch { /* */ }
      // El espejo EN MEMORIA también: sin esto, la consulta descartada reaparecía
      // completa al abrir "Nueva consulta" del mismo paciente y se recreaba sola
      // en Firestore al autoguardarse.
      borradorMem.borrar(respaldoKey)
      // Y el audio de recuperación en IndexedDB: sin esto quedaba PHI guardada y al
      // reabrir la consulta salía el banner "hay audio de una sesión anterior"
      // ofreciendo resucitar el audio de la consulta YA descartada.
      try { await audio.descartarRecovery(`consulta-${patientId}`) } catch { /* */ }
      toast('Consulta descartada', 'info')
      router.push(volverA)
    } catch (e) {
      console.error('[consulta] error al descartar:', e)
      toast('Error al descartar', 'error')
      setGuardando(false)
    }
    // Auditoría 2026-07 (P1): respaldoKey/borradorMem/audio/volverA en deps.
    // respaldoKey depende del episodio (internamientoActivo); si se omitía, al
    // cambiar de episodio el callback conservaba la llave VIEJA y borraba el
    // respaldo del episodio equivocado (dejando el actual vivo, y viceversa).
  }, [firmada, clinicId, notaId, patientId, router, toast, confirm, respaldoKey, borradorMem, audio, volverA])

  // ── Autoguardado cada 30s ──────────────────────────────────────
  // La función real se guarda en un ref que se refresca en CADA render con los
  // valores más nuevos. El intervalo se arma UNA sola vez y lee el ref. Antes las
  // deps (resumen, transcripción, Dx, medicamentos…) cambiaban en cada palabra del
  // dictado, así que el setInterval(30s) se limpiaba y recreaba antes de cumplirse:
  // dictando sin pausas, el guardado al servidor NUNCA disparaba.
  const autoguardarRef = useRef<() => void>(() => {})
  useEffect(() => {
    autoguardarRef.current = () => {
      if (firmada) return
      const hayContenido =
        !!(resumen.trim() || secciones.some(s => s.value?.trim()) ||
           diagnosticos.length || medicamentos.length || voz.transcripcion.trim() ||
           signosConValor(signos) || estudiosOrden.length || preop || proximoSeguimiento.trim())
      if (hayContenido) guardarBorrador(true)
    }
  })
  useEffect(() => {
    const t = setInterval(() => autoguardarRef.current(), 30000)
    return () => clearInterval(t)
  }, [])

  // ── Red de seguridad LOCAL (anti-pérdida): respalda la nota en el navegador
  //    mientras escribes (instantáneo, sobrevive a crashes y a estar sin red). ──
  // (respaldoKey se declara arriba, junto a internamientoActivo, para evitar TDZ
  //  en las deps de descartar(); es por paciente Y por episodio.)
  useEffect(() => {
    if (firmada) return
    const hayContenido = resumen.trim() || secciones.some(s => s.value?.trim()) ||
      diagnosticos.length > 0 || medicamentos.length > 0 || voz.transcripcion.trim() ||
      signosConValor(signos) || estudiosOrden.length > 0 || !!preop || proximoSeguimiento.trim()
    if (!hayContenido) return
    const id = setTimeout(() => {
      if (borradoresBloqueados()) return   // sesión cerrada: no resucitar PHI
      try {
        localStorage.setItem(respaldoKey, ofuscar(JSON.stringify({
          tipo, resumen, secciones, signos, diagnosticos, medicamentos, estudiosOrden, preop,
          /**
           * ── LA FECHA DE PRÓXIMA CONSULTA SE PERDÍA (6-ago-2026, REG-193) ──
           *
           * No estaba en el respaldo, ni en sus deps, ni en la condición que
           * decide si hay algo que guardar. Sólo se persistía **al firmar**:
           * teclearla y recargar la borraba, y si era lo único escrito ni
           * siquiera disparaba el autoguardado.
           *
           * Alimenta la tarea «agendar el seguimiento» del worklist y el
           * contador de seguimientos vencidos del CRM — dos cosas que existían
           * esperando este dato.
           */
          proximoSeguimiento,
          // notaId: sin él, restaurar el respaldo dejaba notaIdRef en null y el
          // siguiente autoguardado CREABA una segunda nota con el mismo contenido.
          notaId: notaIdRef.current,
          transcripcion: voz.transcripcion, ts: Date.now(),
        }), secretoLocal(auth.currentUser?.uid)))
      } catch { /* almacenamiento lleno: no es crítico */ }
    }, 1500)
    return () => clearTimeout(id)
    // `estudiosOrden` y `preop` FALTABAN en las deps: añadir ocho estudios a la
    // orden o llenar el bloque preoperatorio, sin tocar nada más, no re-armaba
    // el debounce y el respaldo local se quedaba en la versión anterior. Con un
    // cierre forzado del navegador (sin desmonte, sin `pagehide`) eso se pierde.
  }, [firmada, tipo, resumen, secciones, signos, diagnosticos, medicamentos, estudiosOrden, preop, proximoSeguimiento, voz.transcripcion, respaldoKey])

  // Al abrir: si hay respaldo local, RESTÁURALO SOLO (sin que tengas que ver un
  // banner) — salvo que estés abriendo otra nota (?nota=) o que el formulario ya
  // tenga contenido. Así volver de la agenda nunca "pierde" lo que hacías.
  // SEMILLA DESDE EL PANEL DE UCI: cuando se llega con ?fuente=uci, el Panel UCI
  // dejó en sessionStorage las 10 secciones deterministas ya redactadas (por
  // aparatos y sistemas). Se siembran una sola vez, en una nota NUEVA. Nunca pisa
  // una nota existente ni un borrador con contenido.
  const uciSeedRef = useRef(false)
  useEffect(() => {
    if (uciSeedRef.current || notaIdParam) return
    if (searchParams.get('fuente') !== 'uci' || !internamientoParam) return
    let raw: string | null = null
    try { raw = sessionStorage.getItem(`nx.uci.seed.${internamientoParam}`) } catch { /* */ }
    if (!raw) return
    try {
      /**
       * LA SEMILLA AHORA TRAE EL DICTADO, NO SÓLO LAS SECCIONES.
       *
       * Se acepta también la forma vieja (un array suelto de secciones) porque
       * puede quedar una semilla escrita por la pestaña anterior: romperla
       * perdería el pase que el médico acaba de dictar, que es exactamente lo
       * que este cambio viene a evitar.
       */
      const parsed = JSON.parse(raw) as NotaSeccion[] | { secciones: NotaSeccion[]; dictado?: string; utterances?: Utterance[]; crudo?: string }
      const secs = Array.isArray(parsed) ? parsed : parsed?.secciones
      const dictado = Array.isArray(parsed) ? '' : String(parsed?.dictado ?? '')
      /**
       * LOS TURNOS Y EL CRUDO VIAJABAN Y NO LOS LEÍA NADIE.
       *
       * `utterances` estaba en el tipo de la semilla desde que se escribió, y
       * ni una línea lo consumía: llegaba a la consulta y se tiraba. Con eso, un
       * pase de UCI —el camino que más nota firmada produce en cuidados
       * intensivos— se archivaba sin separación de voces, sin lista de palabras
       * a verificar, sin poder juzgar de quién es cada cita y, desde la v996,
       * sin material de origen.
       */
      const turnos = Array.isArray(parsed) ? [] : (parsed?.utterances ?? [])
      const crudo = Array.isArray(parsed) ? '' : String(parsed?.crudo ?? '')
      if (Array.isArray(secs) && secs.length) {
        uciSeedRef.current = true
        setTipo('evolucion_uci')
        setSecciones(secs)
        /**
         * Con esto la nota de UCI recupera, sin tocar nada más:
         * `fuenteGeneracion: 'ia_voz'`, la transcripción cruda, el diálogo
         * diarizado, el motor de negaciones, las palabras a verificar, la
         * compuerta de evidencia y la segunda opinión — que exigen todas que
         * exista `voz.transcripcion`.
         */
        if (dictado) voz.setTranscripcion(dictado)
        if (turnos.length || crudo) audio.sembrarDictado({ crudo: crudo || undefined, utterances: turnos })
        toast(
          dictado
            ? 'Pase de UCI cargado en la nota, con su dictado — revísalo y firma'
            : 'Valores del Panel UCI cargados en la nota — revísalos y firma',
          'success',
        )
      }
    } catch { /* */ }
    try { sessionStorage.removeItem(`nx.uci.seed.${internamientoParam}`) } catch { /* */ }
    // `voz.setTranscripcion` es estable (viene de useState); se declara igual
    // para que el linter no tenga que adivinarlo.
  }, [searchParams, internamientoParam, notaIdParam, toast, voz, audio])

  const autoRestRef = useRef(false)
  useEffect(() => {
    if (uciSeedRef.current) return   // la semilla de UCI manda sobre el respaldo vacío
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
    /**
     * Recuperar la nota a la que pertenecía el respaldo: sin esto se creaba una
     * gemela en el expediente y, al firmar una, la otra quedaba huérfana.
     *
     * ── PERO NO SI ESA NOTA YA SE FIRMÓ (4-ago-2026) ────────────────────────
     *
     * Una nota firmada es INMUTABLE —lo exige la NOM-024 y lo cierran las
     * reglas—. Si el respaldo apunta a una que ya se firmó, reponer el `notaId`
     * deja la pantalla editando un documento que el servidor va a rechazar **en
     * cada autoguardado, para siempre**: el médico dicta una consulta entera
     * creyendo que se guarda y sólo queda el respaldo local.
     *
     * Le pasó al Dr. el 4-ago y costó una hora encontrarlo, porque el aviso dice
     * «reglas o sesión vencida» y las dos cosas estaban bien.
     *
     * Se comprueba contra el servidor ANTES de adoptar el id. Si está firmada,
     * el contenido restaurado se queda —no se pierde nada— pero pasa a ser una
     * nota NUEVA, y se le dice por qué.
     */
    void (async () => {
      const id = typeof b.notaId === 'string' ? b.notaId : ''
      if (!id || !clinicId) return
      const previa = await getNota(clinicId, patientId, id).catch(() => null)
      if (previa?.estado === 'firmada') {
        toast('La nota anterior ya está firmada y no se puede modificar. Lo recuperado se guardará como una nota NUEVA.', 'info')
        return
      }
      notaIdRef.current = id
      setNotaId(id)
    })()
    if (typeof b.tipo === 'string') setTipo(b.tipo as TipoNota)
    /**
     * `Array.isArray` valida el CONTENEDOR, no los elementos: un `null` dentro,
     * o un elemento de un esquema anterior, pasaba entero y tronaba igual.
     */
    if (Array.isArray(b.secciones)) setSecciones(seccionesSanas(b.secciones))
    if (typeof b.resumen === 'string') setResumen(b.resumen)
    if (b.signos) setSignos(b.signos as SignosVitales)
    if (Array.isArray(b.diagnosticos)) setDiagnosticos(diagnosticosSanos(b.diagnosticos))
    if (Array.isArray(b.medicamentos)) setMedicamentos(medicamentosSanos(b.medicamentos))
    if (Array.isArray(b.estudiosOrden)) setEstudiosOrden(b.estudiosOrden as string[])
    if (b.preop) setPreop(b.preop as typeof preop)
    if (typeof b.proximoSeguimiento === 'string') setProximoSeguimiento(b.proximoSeguimiento)
    if (typeof b.transcripcion === 'string') voz.setTranscripcion(b.transcripcion)
    setRespaldoDisponible(false)
    if (!mem) toast('Recuperé tu nota sin guardar de este paciente ✓', 'success')  // solo si vino de localStorage
  }, [patientId, respaldoKey, notaIdParam, resumen, secciones, diagnosticos, medicamentos, voz, toast, borradorMem])

  // GUARDADO INMEDIATO al salir (anti-pérdida). El respaldo con debounce se
  // cancelaba si salías rápido a la agenda (el desmonte mataba el timeout antes
  // de guardar). Aquí guardamos SIN esperar: al desmontar (navegación dentro de
  // la app), al ocultar la pestaña y al cerrar. Usa un ref con el estado vivo.
  /**
   * ¿HAY ALGO QUE VALGA LA PENA GUARDAR? — una sola definición, REG-300.
   *
   * Esta regla estaba escrita TRES veces, palabra por palabra, en el espejo en
   * memoria, en el volcado a `localStorage` y en el oyente de `nx:guardar-todo`.
   * Tres copias de la misma decisión es la familia `depende_de_recordar`: basta
   * que alguien añada un campo en dos de los tres para que el tercero empiece a
   * decir que la nota está vacía cuando no lo está.
   *
   * Y eso es exactamente lo que pasó con `proximoSeguimiento` (REG-300).
   */
  const hayContenido = (e: { resumen?: string; secciones?: { value?: string }[]; diagnosticos?: unknown[]; medicamentos?: unknown[]; transcripcion?: string; signos?: Parameters<typeof signosConValor>[0]; estudiosOrden?: unknown[]; preop?: unknown; proximoSeguimiento?: string }) =>
    !!(e.resumen?.trim() || e.secciones?.some(s => s.value?.trim()) || e.diagnosticos?.length ||
       e.medicamentos?.length || e.transcripcion?.trim() || signosConValor(e.signos) ||
       (e.estudiosOrden?.length ?? 0) > 0 || !!e.preop || e.proximoSeguimiento?.trim())

  const estadoVivoRef = useRef({ tipo, resumen, secciones, signos, diagnosticos, medicamentos, estudiosOrden, preop, proximoSeguimiento, transcripcion: voz.transcripcion, firmada })
  /**
   * Espejo del estado del dictado, por el mismo motivo que el de arriba: el
   * oyente de `nx:guardar-todo` se registra con `[guardarBorrador]` en las
   * dependencias, así que leer `audio.estado` dentro de él capturaría el valor
   * que hubiera al registrarse — «inactivo», casi siempre. Un ref se lee
   * siempre vivo (REG-297).
   */
  const audioEstadoRef = useRef(audio.estado)
  // Se actualiza en un efecto, no durante el render: tocar un ref mientras se
  // renderiza es error del compilador de React y sube el trinquete de lint.
  useEffect(() => { audioEstadoRef.current = audio.estado }, [audio.estado])

  // Avisar antes de que una navegación dentro de la app corte el dictado (REG-303).
  useAvisoAlSalirGrabando(audio.estado === 'grabando', confirm)
  useEffect(() => {
    estadoVivoRef.current = { tipo, resumen, secciones, signos, diagnosticos, medicamentos, estudiosOrden, preop, proximoSeguimiento, transcripcion: voz.transcripcion, firmada }
    // Espejo EN MEMORIA en cada cambio (barato, sin debounce): así al navegar y
    // volver la nota está exactamente como la dejaste, al instante.
    const e = estadoVivoRef.current
    const hay = hayContenido(e)
    /**
     * NUNCA se borra el respaldo por verse VACÍO — esa era la fuente del
     * "a veces se borra y tengo que empezar otra vez".
     *
     * Este efecto corre en CADA render. Al volver a la nota desde otra pantalla,
     * el formulario arranca vacío un instante ANTES de que la restauración
     * escriba el contenido; en ese instante, la condición `!hay` borraba el
     * respaldo en memoria. Si la restauración no ganaba la carrera, la nota se
     * perdía. Un formulario vacío al montar es el estado por defecto, no una
     * orden de tirar el trabajo guardado.
     *
     * Ahora el respaldo SOLO se borra al FIRMAR (nota inmutable, ya está en el
     * servidor) o al descartar explícito (`descartar()` lo limpia aparte). Si hay
     * contenido se escribe; si está vacío y sin firmar, se deja como está.
     */
    if (e.firmada) borradorMem.borrar(respaldoKey)
    else if (hay) borradorMem.escribir(respaldoKey, { tipo: e.tipo, resumen: e.resumen, secciones: e.secciones, signos: e.signos, diagnosticos: e.diagnosticos, medicamentos: e.medicamentos, estudiosOrden: e.estudiosOrden, preop: e.preop, proximoSeguimiento: e.proximoSeguimiento, transcripcion: e.transcripcion, notaId: notaIdRef.current })
  })
  /**
   * RESTAURAR LA POSICIÓN al volver a la nota.
   *
   * Al salir a otra pantalla y regresar, Next.js REMONTA la consulta y el scroll
   * saltaba hasta arriba: había que buscar de nuevo dónde ibas. Se guarda la
   * posición por paciente en sessionStorage (sobrevive la navegación, se limpia
   * al cerrar la pestaña) y se restaura tras montar, cuando el contenido ya se
   * repuso desde el respaldo en memoria.
   */
  const scrollKey = `nx.consulta.scroll.${patientId}${internamientoActivo ? '.h.' + internamientoActivo : ''}`
  useEffect(() => {
    /**
     * El scroll del dashboard vive en <main> desde que el shell tiene tope
     * (`nx-app-shell`, V15-MOBILE-001 §23); antes vivía en el documento
     * porque `min-height` dejaba crecer la columna. Se lee y escribe en LOS
     * DOS lados: mover el contenedor que no desplaza es un no-op inofensivo,
     * y así esta restauración no depende de cuál de los dos esté activo (la
     * clase podría no aplicar en un embed o en una prueba sin el layout).
     */
    const scroller = () => document.querySelector('main')
    // Restaurar: dos frames para que el contenido restaurado ya esté pintado.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const y = Number(sessionStorage.getItem(scrollKey) || 0)
        if (y > 0) {
          const m = scroller()
          if (m) m.scrollTop = y
          window.scrollTo(0, y)
        }
      })
    })
    const guardarScroll = () => {
      try { sessionStorage.setItem(scrollKey, String(scroller()?.scrollTop || window.scrollY)) } catch { /* */ }
    }
    const m = scroller()
    m?.addEventListener('scroll', guardarScroll, { passive: true })
    window.addEventListener('scroll', guardarScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf1); cancelAnimationFrame(raf2)
      m?.removeEventListener('scroll', guardarScroll)
      window.removeEventListener('scroll', guardarScroll)
      guardarScroll()  // al desmontar (irte): recuerda dónde ibas
    }
  }, [scrollKey])

  const flushRespaldo = useCallback(() => {
    const e = estadoVivoRef.current
    if (e.firmada) return
    // Tras cerrar sesión, el desmonte dispara este flush. Escribir aquí resucitaba
    // el borrador que se acababa de purgar, y encima con la clave equivocada.
    if (borradoresBloqueados()) return
    const hay = hayContenido(e)
    if (!hay) return
    try {
      localStorage.setItem(respaldoKey, ofuscar(JSON.stringify({
        tipo: e.tipo, resumen: e.resumen, secciones: e.secciones, signos: e.signos,
        diagnosticos: e.diagnosticos, medicamentos: e.medicamentos, estudiosOrden: e.estudiosOrden, preop: e.preop,
        proximoSeguimiento: e.proximoSeguimiento, notaId: notaIdRef.current,
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
    const alGuardarTodo = (ev: Event) => {
      const detalleAudio = (ev as CustomEvent<{ marcarAudioSinTranscribir?: () => void }>).detail
      /**
       * SE DECLARA EL AUDIO **ANTES** DE MIRAR SI HAY TEXTO — REG-297.
       *
       * La declaración va la primera a propósito. Debajo hay un `return`
       * temprano cuando la nota está vacía, y una grabación recién empezada es
       * exactamente eso: sin resumen, sin diagnósticos y con la transcripción
       * todavía en blanco. Colocarla después del `return` la haría inútil justo
       * en el minuto en que más audio irrecuperable hay por delante.
       *
       * Tampoco se intenta transcribir aquí. Estamos cerrando la sesión: pedirle
       * a la red una transcripción larga en ese momento es apostar el audio a
       * que la petición llegue. Se conserva el archivo, que es lo que sí
       * depende de nosotros, y el médico lo recupera al volver a entrar.
       */
      const enVuelo = audioEstadoRef.current
      if (enVuelo === 'grabando' || enVuelo === 'pausado' || enVuelo === 'subiendo') {
        detalleAudio?.marcarAudioSinTranscribir?.()
      }

      const e = estadoVivoRef.current
      if (e.firmada) return
      const hay = hayContenido(e)
      if (!hay) return
      /**
       * SE ENTREGA LA PROMESA, NO SÓLO SE DISPARA EL GUARDADO.
       *
       * Antes esto llamaba a `guardarBorrador(true)` y nadie esperaba el
       * resultado: quien cerraba la sesión dormía 1200 ms fijos y después
       * purgaba los borradores locales Y la caché de Firestore —donde vive la
       * escritura pendiente cuando la red va lenta—. La nota desaparecía de los
       * tres sitios a la vez.
       *
       * Ahora quien cierra sabe si esto terminó, y si no terminó NO purga.
       */
      const p = guardarBorrador(true)
      const detalle = (ev as CustomEvent<{ esperar?: (q: Promise<unknown>) => void }>).detail
      if (p && typeof detalle?.esperar === 'function') detalle.esperar(Promise.resolve(p))
    }
    window.addEventListener(EVENTO_GUARDAR_TODO, alGuardarTodo)
    return () => window.removeEventListener(EVENTO_GUARDAR_TODO, alGuardarTodo)
  }, [guardarBorrador])

  const restaurarRespaldo = async () => {
    try {
      const raw = localStorage.getItem(respaldoKey)
      if (!raw) { setRespaldoDisponible(false); return }
      const b = JSON.parse(desofuscar(raw, secretoLocal(auth.currentUser?.uid)) ?? raw)
      if (b.tipo) setTipo(b.tipo)
      // Mismo saneo que arriba: tres sitios con la misma regla, no tres reglas.
      if (Array.isArray(b.secciones)) setSecciones(seccionesSanas(b.secciones))
      if (typeof b.resumen === 'string') setResumen(b.resumen)
      if (b.signos) setSignos(b.signos)
      if (Array.isArray(b.estudiosOrden)) setEstudiosOrden(b.estudiosOrden)
      if (b.preop) setPreop(b.preop)
      if (Array.isArray(b.diagnosticos)) setDiagnosticos(diagnosticosSanos(b.diagnosticos))
      if (Array.isArray(b.medicamentos)) setMedicamentos(medicamentosSanos(b.medicamentos))
      if (b.transcripcion) voz.setTranscripcion(b.transcripcion)
      /**
       * REPONER EL `notaId`, que faltaba SÓLO en esta ruta.
       *
       * La restauración automática ya lo hacía, con su comentario explicando por
       * qué: «sin esto se creaba una gemela en el expediente y, al firmar una, la
       * otra quedaba huérfana». El botón del banner —la ruta manual— se quedó sin
       * el arreglo. Mismo bug, misma consecuencia.
       */
      /**
       * Y con la MISMA comprobación que la automática: si la nota a la que
       * pertenecía el respaldo ya se firmó, no se adopta su id. Arreglar una de
       * las dos rutas y dejar la otra es el error que ya se cometió aquí una vez.
       */
      const idPrevio = typeof b.notaId === 'string' ? b.notaId : ''
      if (idPrevio && clinicId) {
        const previa = await getNota(clinicId, patientId, idPrevio).catch(() => null)
        if (previa?.estado === 'firmada') {
          toast('La nota anterior ya está firmada y no se puede modificar. Lo recuperado se guardará como una nota NUEVA.', 'info')
        } else {
          notaIdRef.current = idPrevio
          setNotaId(idPrevio)
        }
      }
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

  /**
   * ¿La segunda opinión sigue valiendo para lo que hay en pantalla?
   *
   * Se recalcula con la nota, así que en cuanto el médico teclea, el sello deja
   * de decir que está al día. Ver `lib/expediente/lo-que-se-reviso.ts`.
   */
  const revisionCaducada = useMemo(() => estadoDeRevision({
    huellaRevisada: verificacion?.huella,
    ahora: {
      resumen,
      secciones: secciones.map(x => ({ titulo: x.label, contenido: x.value })),
      diagnosticos, medicamentos,
    },
  }) === 'caducada', [verificacion?.huella, resumen, secciones, diagnosticos, medicamentos])

  /**
   * `validacion` vive AQUÍ, antes de `firmar`, y no seiscientas líneas después.
   *
   * Funcionaba —es una clausura— pero el compilador de React lo marca como
   * acceso antes de la declaración, y tiene razón: un arreglo de dependencias
   * SÍ se evalúa durante el render. Subirla no cambia lo que hace; la pone
   * donde se lee.
   */
  const validacion = useMemo(() => validarNOM004(construirNota('borrador')), [construirNota])

  /**
   * Los avisos de REVISIÓN DEL TEXTO, para el momento de firmar.
   *
   * La barra de arriba ya no los lleva —estorbaban desde el minuto uno—, así
   * que aparecen aquí, que es cuando sirven. Ver `lib/expediente/cuando-avisar.ts`.
   */
  const avisosParaFirmar = useMemo(() => alFirmar(construirAvisos({
    dosisIncompletas: dosisIncompletas.map(d => ({ med: d.med, mensaje: d.aviso.mensaje, procedencia: d.procedencia })),
    contradicciones: contradiccionesNota.map(c => ({ condicion: c.condicion, mensaje: avisoDeContradiccion(c) })),
    desajustes: desajustesNota.map(d => ({ condicion: d.condicion, mensaje: avisoDeDesajuste(d) })),
    antecedentesDeFamiliar,
    datosInciertos,
    sinRespaldo,
    conflictos: (safety as { conflicts_detected?: string[] } | undefined)?.conflicts_detected ?? [],
    faltantesCriticos: (safety as { missing_critical_fields?: string[] } | undefined)?.missing_critical_fields ?? [],
    yaLoBloqueaNOM004: validacion?.errores ?? [],
  })), [dosisIncompletas, contradiccionesNota, desajustesNota, antecedentesDeFamiliar, datosInciertos, sinRespaldo, safety, validacion])

  // ── Firmar nota (NOM-004 + NOM-024) ────────────────────────────
  const firmar = useCallback(async () => {
    if (!clinicId) return

    /**
     * COMPUERTA DE LECTURA (auditoría PHI/seguridad): si la nota o el paciente no
     * se pudieron leer, la nota en pantalla es la plantilla vacía. Firmar la
     * volvería INMUTABLE con pacienteNombre='' y alergias=[] → el cross-check de
     * alergias queda apagado sobre una firma medicolegal. guardarBorrador ya se
     * bloquea en ese estado; firmar DEBE bloquear también, y avisar (no en
     * silencio) para que el médico recargue.
     */
    if (errorCargaNota) { toast('No se pudo abrir la nota. Recarga la página antes de firmar.', 'error'); return }
    if (pacienteError) { toast('No se pudieron leer los datos del paciente (nombre, alergias). Recarga antes de firmar.', 'error'); return }

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
    /**
     * COMPUERTA DE EVIDENCIA (v987).
     *
     * La compuerta de arriba cubre la PROSA que la IA añadió. Los campos
     * estructurados —diagnósticos, alergias, fármacos— no tenían ninguna: uno
     * que la extracción propuso **sin cita comprobable** entraba a la nota
     * firmada como cualquier otro. Y son los que más pesan: un diagnóstico se
     * arrastra a todas las notas siguientes, y una alergia gobierna el cruce que
     * bloquea recetas.
     *
     * No acusa: dice cuáles no se pudieron comprobar y deja aceptarlos de una
     * vez. «ia» aquí significa «no verificado», no «inventado».
     */
    /**
     * ── Y AQUÍ SÍ: LO QUE HABÍA QUE REVISAR DEL TEXTO (I-7) ────────────────
     *
     * Estos avisos estaban en la barra de arriba desde el minuto uno, tapando
     * la nota. No cambian lo que se le da al paciente —para eso están los de
     * prescripción, que siguen apareciendo mientras receta—: cambian lo que hay
     * que leer antes de firmar. Éste es ese momento.
     */
    if (avisosParaFirmar.length > 0) {
      const seguir = await confirm(
        `${comoSeDicenAlFirmar(avisosParaFirmar)}\n\n` +
        'Ninguno impide firmar por sí solo; son para que los mires una vez.',
        { confirmar: 'Los revisé, firmar', cancelar: 'Volver a la nota' },
      )
      if (!seguir) return
    }

    /**
     * ── LO QUE SE REVISÓ NO ERA LO QUE SE FIRMA (I-8) ─────────────────────
     *
     * El médico eligió «que un segundo modelo la revise» como lo que le haría
     * confiar en la nota sin releerla entera. Y la revisión ya existía —corre
     * sola al terminar el pase de IA—.
     *
     * Pero después de eso él edita: corrige un apartado, cambia una dosis,
     * acepta las líneas propuestas, quita un diagnóstico. Y el panel seguía
     * diciendo «sin observaciones de seguridad» de **una versión del texto que
     * ya no existe**.
     *
     * Un sello de revisión sobre un texto que cambió no es una garantía: es una
     * garantía caducada que se lee igual que una vigente. Peor que no tenerla,
     * porque invita a no releer.
     *
     * NO bloquea. Bloquear por una revisión caducada convertiría cada coma
     * corregida en un trámite, y él aprendería a esquivarlo. Lo que faltaba no
     * era una compuerta más: era poder decir la verdad.
     */
    const revision = estadoDeRevision({
      huellaRevisada: verificacion?.huella,
      ahora: {
        resumen,
        secciones: secciones.map(x => ({ titulo: x.label, contenido: x.value })),
        diagnosticos, medicamentos,
      },
    })
    if (revision === 'caducada') {
      const seguir = await confirm(
        `${COMO_SE_DICE.caducada}\n\n` +
        'Los hallazgos que ves son de antes de tus cambios. Puedes volver a pedirla, ' +
        'o firmar sabiéndolo.',
        { confirmar: 'Firmar así', cancelar: 'Volver y pedirla de nuevo' },
      )
      if (!seguir) return
    }

    const sinEvidencia = camposSinEvidencia(construirManifiesto(
      { diagnosticos, medicamentos, alergias: alergiasArray(patient ?? {}) },
      extraction as never,
      aprobados,
      {
        transcripcion: voz.transcripcion,
        turnos: audio.utterances.map(u => ({
          rol: rolesHablante[u.speaker] || `Hablante ${u.speaker}`,
          texto: u.text,
        })),
      },
    ))
    if (sinEvidencia.length > 0) {
      const lista = sinEvidencia.slice(0, 6).map(c => `· ${c.etiqueta}: ${c.valor}`).join('\n')
      const mas = sinEvidencia.length > 6 ? `\n…y ${sinEvidencia.length - 6} más.` : ''
      const seguir = await confirm(
        `${sinEvidencia.length} ${sinEvidencia.length === 1 ? 'dato no se pudo comprobar' : 'datos no se pudieron comprobar'} contra el dictado:\n\n${lista}${mas}\n\n` +
        'Puede ser que el corrector reescribiera la frase, o que la grabación no separara las voces — no significa que estén mal. ' +
        'Si firmas, quedan con tu cédula como datos verificados por ti.',
        { confirmar: 'Los reviso y los asumo', cancelar: 'Volver a la nota' },
      )
      if (!seguir) return
    }

    const pendientes = sugerenciasPendientes(secciones)
    if (pendientes > 0) {
      /**
       * ── ESTE DIÁLOGO LE BORRÓ EL PLAN AL DR. (6-ago-2026, REG-195) ────────
       *
       * Fallaba en las tres mitades a la vez:
       *
       * 1. **No decía QUÉ se iba a quitar.** «3 líneas que no dictaste» no deja
       *    ver que una de ellas ES EL PLAN DE ABORDAJE ENTERO — porque el plan
       *    es justamente lo que la IA propone cuando el médico no lo dicta
       *    palabra por palabra.
       * 2. **No se podía deshacer.** El `snapshotUndo` existía desde hacía
       *    versiones y este camino no lo usaba: una vez quitado, quitado.
       * 3. **«Quitarlas y firmar» NO FIRMA** — hace `return`. El médico pulsa
       *    creyendo que cierra la nota, se le borra el plan, y la nota sigue
       *    abierta. Si vuelve a pulsar firmar, la firma **sin el plan**.
       *
       * Las tres juntas son cómo se pierde una nota entera sin un solo error en
       * pantalla.
       */
      const muestra = lineasSugeridas(secciones).slice(0, 5).map((l: string) => `· ${l}`).join('\n')
      const mas = pendientes > 5 ? `\n…y ${pendientes - 5} más.` : ''
      const quitar = await confirm(
        `La IA añadió ${pendientes} ${pendientes === 1 ? 'línea que no dictaste' : 'líneas que no dictaste'}:\n\n${muestra}${mas}\n\n` +
        'Si firmas, saldrían con tu cédula como indicación tuya. ' +
        'Si las quitas, PUEDES DESHACERLO con el botón «Deshacer» de arriba.',
        { peligro: true, confirmar: 'Quitarlas', cancelar: 'Volver a la nota' },
      )
      if (!quitar) return
      /** Se puede deshacer: el plan del médico no se pierde por un clic. */
      setSnapshotUndo({ resumen, secciones, diagnosticos, medicamentos, signos })
      setSecciones(prev => resolverSugerencias(prev, 'quitar'))
      toast(
        `Se quitaron ${pendientes} ${pendientes === 1 ? 'sugerencia' : 'sugerencias'}. ` +
        'Revisa la nota y vuelve a firmar — si te faltó algo, usa «Deshacer».',
        'info',
      )
      return   // se re-renderiza sin ellas; el médico confirma la nota final
    }

    const notaParaValidar = construirNota('firmada')
    const val = validarNOM004(notaParaValidar)
    if (!val.valida) {
      toast(`No se puede firmar: ${val.errores[0]}`, 'error')
      return
    }

    /**
     * ── SIN DOSIS NO SE FIRMA — DECISIÓN DEL MÉDICO DUEÑO (5-ago-2026) ───────
     *
     * Textual: «que bloquee la firma si falta la dosis».
     *
     * La tomó él, y con el dato delante: en sus notas ya firmadas había **4
     * medicamentos sin dosis de 28**. Hasta v1057 sólo se avisaba, y el aviso ni
     * siquiera llegaba a tiempo — vivía en la pantalla de la receta, o sea
     * después de firmar, cuando la nota ya es inmutable.
     *
     * Un medicamento sin cantidad no se puede surtir: quien lo despacha no sabe
     * cuánto dar. Y una vez firmada, la nota sólo se corrige con adenda.
     *
     * ── QUÉ BLOQUEA, EXACTAMENTE ────────────────────────────────────────────
     *
     * Los dos casos, por decisión suya en dos pasos:
     *
     *  · **Falta la cantidad** (`dosis_sin_cifra`) — 5-ago, primera decisión.
     *    Quien surta la receta no sabe cuánto dispensar.
     *  · **Cantidad sin unidad** (`dosis_sin_unidad`) — 5-ago, ampliación:
     *    «bloquea también si falta la unidad». «Levotiroxina 100» son 100 mcg en
     *    la vida real y 100 mg en el papel: **mil veces la dosis**, y en el papel
     *    no queda rastro de cuál se quiso decir.
     *
     * El segundo es, si acaso, más peligroso que el primero: una receta sin
     * cantidad no se despacha —alguien pregunta—, pero una con la cifra sin
     * unidad **sí se despacha**, con la unidad que suponga quien la lea.
     *
     * Un renglón a medio escribir no cuenta: sin nombre no hay medicamento.
     */
    const dosisMal = medicamentos
      .filter(m => m.nombre?.trim())
      /**
       * Lo DECLARADO desconocido no bloquea: es una respuesta, no un hueco.
       * Y sólo cuenta la frase canónica que pone el botón — «No especificada»,
       * que es lo que escribe la IA cuando no captó nada, sigue bloqueando.
       */
      .filter(m => !esDosisDeclaradaDesconocida(m.dosis))
      .map(m => ({ nombre: m.nombre.trim(), aviso: revisarUnidadDosis(m.nombre, m.dosis) }))
      .filter(x => x.aviso?.codigo === 'dosis_sin_cifra' || x.aviso?.codigo === 'dosis_sin_unidad')
    if (dosisMal.length) {
      /**
       * Se enseña el mensaje del motor, que ya explica el riesgo concreto de
       * cada caso — no uno genérico que valga para los dos y no diga ninguno.
       */
      toast(
        dosisMal.length === 1
          ? `No se puede firmar. ${dosisMal[0].aviso!.mensaje}`
          : `No se puede firmar: ${dosisMal.length} medicamentos con la dosis incompleta (${dosisMal.slice(0, 3).map(x => x.nombre).join(', ')}${dosisMal.length > 3 ? '…' : ''}). Cada uno necesita cantidad Y unidad.`,
        'error',
      )
      return
    }
    /**
     * LA COMPUERTA MIRA LA CÉDULA EFECTIVA, NO LA DEL CONSULTORIO.
     *
     * Antes exigía `config.cedulaProfesional`: en un consultorio con dos médicos
     * eso dejaba firmar a la Dra. **con la cédula del dueño**, y bloqueaba a un
     * médico que sí tuviera la suya si la clínica no la había llenado. Miraba el
     * campo equivocado en los dos sentidos.
     */
    if (!identidadFirma.resuelta) {
      toast('No se pudo identificar con qué médico estás firmando. Revisa que tu correo o tu cuenta estén ligados a tu ficha en Configuración → Médicos.', 'error')
      return
    }
    if (!identidadFirma.cedula.trim()) {
      toast(medicoEnSesion
        ? 'Agrega TU cédula profesional en Configuración → Médicos (la de la clínica no se usa cuando hay varios médicos).'
        : 'Agrega tu cédula profesional en Configuración → General', 'error')
      return
    }
    setGuardando(true)
    try {
      const now = new Date().toISOString()
      /**
       * REG-060 — se sella y se escribe EL MISMO objeto.
       *
       * `normalizarParaSello` convierte en `null` explícito los opcionales que el
       * sello v3 cubre. Sin eso, un campo que el médico VACÍA (p. ej. borrar el
       * cuadro del dictado tras un autoguardado) se sella como `null` pero
       * `stripUndefined` lo quita del payload y `updateDoc` hace merge: el valor
       * viejo sobrevive en Firestore y la nota sale "ALTERADA" al reabrirla.
       * Reproducido con el código real antes de arreglarlo.
       */
      const notaSellable = normalizarParaSello(notaParaValidar)
      const hashIntegridad = await generarHashIntegridad(notaSellable)
      const medicoId = auth.currentUser?.uid ?? ''
      const hashFirma = await generarHashFirma(notaSellable.metadata.id, medicoId, now)

      const notaFirmada: NotaMedica = {
        ...notaSellable,
        metadata: { ...notaParaValidar.metadata, hashIntegridad, hashVersion: HASH_VERSION, fechaModificacion: now },
        firma: {
          // La persona que firma, no el consultorio. Este objeto es INMUTABLE:
          // lo que se estampe aquí no se puede corregir después.
          nombreMedico: identidadFirma.nombre,
          cedulaProfesional: identidadFirma.cedula,
          especialidad: identidadFirma.especialidad,
          institucion: config.nombreClinica,
          timestamp: now,
          hashFirma,
          // SNAPSHOT de la imagen de firma+sello en este preciso momento.
          // NOM-024: la nota firmada es inmutable, así que congelamos la firma actual.
          // Si más adelante el médico cambia su firma, las notas viejas siguen mostrando la suya.
          /**
           * DEL SUBDOCUMENTO PROTEGIDO, NO DE `config/main`.
           *
           * REG-014 movió la firma gráfica a `config/firma` y la BORRA del
           * documento general. Esta pantalla seguía leyendo `config.firmaImagenDataUrl`
           * —que desde entonces es `undefined`—, así que el «snapshot inmutable»
           * nacía VACÍO en todas las notas firmadas: al imprimir se caía a la
           * firma viva, y cambiarla reimprimía las notas viejas con la nueva.
           * Justo lo contrario de lo que el snapshot existe para garantizar.
           */
          imagenDataUrl: (medicoEnSesion && firmaProtegida.firmaPorMedico?.[medicoEnSesion.id])
            || (activeDoctors.length <= 1 ? firmaProtegida.firmaImagenDataUrl : undefined)
            || undefined,
        },
      }

      // Espera cualquier autoguardado en vuelo y usa la ref síncrona, para NO
      // crear una nota duplicada al firmar justo después de un autoguardado.
      await cadenaGuardadoRef.current.catch(() => {})
      /**
       * TODA NOTA NACE EN BORRADOR (REG-017, decisión del médico dueño).
       *
       * Antes, si la consulta se firmaba sin que hubiera llegado a guardarse un
       * borrador (flujo rápido), esta rama CREABA la nota ya `firmada`: se
       * saltaba el flujo borrador→firmada y nacía un documento inmutable sin
       * historia previa. La firma debe ser una ACCIÓN explícita sobre algo que
       * ya existe, no el estado inicial de un documento.
       *
       * Se crea primero el borrador y se firma inmediatamente después. Son dos
       * escrituras en vez de una, y a cambio la trazabilidad NOM-024 queda
       * intacta: existe el borrador, existe la transición y existe el sello.
       */
      let id = notaIdRef.current
      if (!id) {
        id = await createNota(clinicId, patientId, { ...notaParaValidar, estado: 'borrador' })
        notaIdRef.current = id
        setNotaId(id)
      }
      try {
        await updateNota(clinicId, patientId, id, notaFirmada)
      } catch (e) {
        /**
         * Si el documento ya no está, la firma NO puede quedarse a medias: se
         * recrea el borrador y se firma sobre él. Sin esto, «Error al firmar»
         * dejaba al médico sin poder cerrar la consulta, que es el único paso
         * que no admite esperar.
         */
        if ((e as { code?: string })?.code !== 'nota-inexistente') throw e
        const nuevo = await createNota(clinicId, patientId, { ...notaParaValidar, estado: 'borrador' })
        notaIdRef.current = nuevo
        setNotaId(nuevo)
        await updateNota(clinicId, patientId, nuevo, notaFirmada)
      }
      setFirmada(true)
      /**
       * V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, segunda rebanada) — LA URL TIENE
       * QUE LLEVAR EL notaId DESDE AQUÍ.
       *
       * `firmar()` nunca escribía `?nota=<id>` en la barra de direcciones: el
       * id vivía sólo en `notaIdRef`/`notaId` (estado de React). Cuando abajo
       * se hace `router.push(destino)` hacia `/receta` u `/orden`, la entrada
       * de historial que queda ATRÁS es la URL que estaba en pantalla en ese
       * instante — `/consulta/[patientId]` SIN `?nota=`. `useSmartBack` (que
       * usan `/receta` y `/orden` para volver) hace `router.back()` sobre esa
       * misma entrada: el médico "regresaba" a una consulta que, al remontar,
       * no sabía qué nota traía — `firmada` volvía a `false` y el checklist de
       * cierre (`ComoCerrarLaConsulta`) desaparecía entero, con o sin lo que
       * ya se marcó en `sessionStorage` (ver `cierre-hechos.ts`).
       *
       * `router.replace` (nunca `push`): esto no es una navegación nueva, es
       * la MISMA pantalla diciendo la verdad sobre qué nota tiene abierta. Un
       * `push` aquí ensuciaría el historial con una entrada extra y `atrás`
       * tendría que pulsarse dos veces para salir de la consulta.
       */
      router.replace(`/consulta/${patientId}?nota=${id}`)
      /**
       * La fecha de control sobrevive al remonte (quinta rebanada, Fase 8):
       * la nota NO guarda `proximoSeguimiento` (esquema congelado — va al
       * paciente y a la tarea del worklist), así que volver de `/citas` a
       * esta URL dejaba el paso «Agendar el seguimiento» INEXISTENTE en el
       * checklist, ni marcado ni pendiente. Lo encontró el arnés de la
       * propia rebanada. Mismo criterio de `sessionStorage` que las marcas.
       */
      guardarSeguimientoDeCierre(id, proximoSeguimiento)
      try { localStorage.removeItem(respaldoKey) } catch { /* */ }  // ya firmada: respaldo local ya no hace falta
      toast('Nota firmada y sellada (NOM-024)', 'success')
      /**
       * LEARN — AQUÍ, y no antes.
       *
       * Al firmar el texto ya es definitivo: lo que el médico iba a corregir,
       * lo corrigió. Acumular sobre un borrador enseñaría de un trabajo a medio
       * escribir, y encima varias veces, porque el borrador se guarda solo cada
       * pocos segundos.
       *
       * Se acumula SÓLO lo derivado de este paciente: lo que venía del
       * consultorio ya está contado, y volver a sumarlo inflaría el contador
       * con cada consulta hasta que cualquier palabra pareciera una costumbre.
       *
       * `void`: el aprendizaje es un extra y no puede retrasar ni romper la
       * firma. Si falla, la nota queda firmada igual.
       */
      if (deEstePaciente.length > 0) {
        void acumular(clinicId, deEstePaciente, new Date().toISOString())
      }
      // Auditoría (Fase F)
      if (clinicId) logAudit({
        evento: 'nota_firmada', clinicId, patientId, notaId: id,
        medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined,
        meta: { tipo, aprobadosIA: aprobados.size, diagnosticos: diagnosticos.length, medicamentos: medicamentos.length },
      })

      /**
       * LOS CABOS SUELTOS SALEN DE LA NOTA Y SE VUELVEN PENDIENTES CON DUEÑO.
       *
       * Hasta aquí, «solicito biometría» vivía dentro de una nota firmada — un
       * documento que por definición ya no se toca y que nadie relee salvo que
       * sospeche algo. El estudio se hacía, el resultado llegaba, y ahí moría.
       *
       * Firmar es el único instante en que se sabe, a la vez, QUÉ quedó pedido y
       * QUIÉN lo pidió. Por eso las tareas nacen aquí y no antes: en un borrador
       * la lista de estudios todavía cambia, y derivar de un borrador llenaría el
       * worklist de pendientes de cosas que el médico acabó quitando.
       *
       * No bloquea ni revierte nada: la nota ya está firmada y sellada. Si esto
       * falla, se pierde el worklist de esa consulta, no la consulta.
       */
      if (clinicId) {
        void crearTareas(clinicId, tareasDeNota({
          id, clinicId, pacienteId: patientId,
          pacienteNombre: patient?.nombre,
          estudiosOrden,
          medicamentos: medicamentos.map(m => ({ nombre: m.nombre })),
          // El motor sabía derivar «agendar el seguimiento» desde siempre y este
          // dato nunca le llegaba: la rama estaba escrita y desconectada.
          proximoSeguimiento: proximoSeguimiento || undefined,
          medicoUid: auth.currentUser?.uid,
          medicoNombre: config.nombreMedico,
        }, Date.now())).catch(() => { /* ver arriba: no puede tumbar la firma */ })

        /**
         * §F3 — RECONCILIACIÓN DE MEDICAMENTOS.
         *
         * El paciente dijo «el losartán ya lo dejé» y su lista lo tiene
         * vigente. Sin esto, la lista sigue diciendo lo de antes PARA SIEMPRE —
         * y de ella cuelgan el cruce de interacciones, el de alergias, el motor
         * de dosis y la receta.
         *
         * Se compara contra la medicación VIGENTE del paciente, no contra la de
         * hoy, y se descuenta lo que el médico receta en esta consulta: si lo
         * tiene delante y lo prescribe, ya lo reconcilió con su criterio.
         *
         * No cambia la lista: abre una tarea. §C3, no elegir la verdad solo.
         */
        const disc = discrepanciasDeMedicacion({
          dictado: voz.transcripcion,
          /**
           * Sólo los que YA tomaba, no los de hoy: `medsDelCuadro` marca el
           * origen con `deHoy`, y una discrepancia contra algo que se acaba de
           * escribir en esta consulta no es una discrepancia.
           */
          vigentes: medsDelCuadro
            .filter(m => !m.deHoy)
            .map(m => ({ nombre: m.nombre, dosis: m.dosis })),
          recetadosHoy: medicamentos.map(m => ({ nombre: m.nombre })),
        })
        /**
         * §D1 — LA DURACIÓN QUE YA VENCIÓ.
         *
         * Un antibiótico de «7 días» prescrito hace un mes seguía apareciendo
         * como vigente. Para siempre, porque nadie comparaba la duración con el
         * calendario. Y de esa lista cuelgan el cruce de interacciones, el de
         * alergias y el motor de dosis.
         *
         * NO se marca terminado: el sistema sabe que el calendario venció, no
         * que el paciente lo terminara. Pudo suspenderlo por un efecto adverso o
         * alargarlo por indicación de otro médico. Se abre tarea (§D1: «no lo
         * marques completado en silencio»).
         */
        const vencidos = vigentes
          .filter(v => !medicamentos.some(m => m.nombre?.trim().toLowerCase() === v.medicamento.nombre?.trim().toLowerCase()))
          .map(v => ({ v, r: yaDebioTerminar({ duracion: v.medicamento.duracion, prescritoEn: v.dichoEn, ahoraMs: Date.now() }) }))
          .filter(x => x.r.yaDebioTerminar)
          .map(x => ({ farmaco: x.v.medicamento.nombre, frase: comoSeDiceVencido({ farmaco: x.v.medicamento.nombre, v: x.r }) }))
        if (vencidos.length) {
          void crearTareas(clinicId, tareasDeReconciliacion({
            clinicId, pacienteId: patientId, pacienteNombre: patient?.nombre, notaId: id,
            discrepancias: vencidos,
            texto: d => d.frase,
            medicoUid: auth.currentUser?.uid,
            medicoNombre: config.nombreMedico,
          }, Date.now())).catch(() => { /* igual que arriba */ })
        }

        if (disc.length) {
          void crearTareas(clinicId, tareasDeReconciliacion({
            clinicId, pacienteId: patientId, pacienteNombre: patient?.nombre, notaId: id,
            discrepancias: disc,
            texto: d => comoSeDice(disc.find(x => x.farmaco === d.farmaco) ?? disc[0]),
            medicoUid: auth.currentUser?.uid,
            medicoNombre: config.nombreMedico,
          }, Date.now())).catch(() => { /* igual que arriba */ })
        }
      }
      /**
       * LA FECHA DE SEGUIMIENTO TAMBIÉN VA AL EXPEDIENTE DEL PACIENTE.
       *
       * La pantalla de CRM cuenta los «seguimientos vencidos» sobre
       * `patient.proximoSeguimiento`, un campo que no escribía NADIE: el
       * contador era cero permanente y parecía que no había ninguno.
       *
       * Va aparte de la nota porque responde a otra pregunta: la nota dice qué
       * se decidió ese día, y el expediente dice a quién hay que llamar.
       */
      if (clinicId && proximoSeguimiento) {
        void updatePatient(clinicId, patientId, { proximoSeguimiento })
          .catch(() => { /* la nota ya está firmada; esto no puede tumbarla */ })
      }
      /**
       * FIRMAR MARCA LA CITA COMO ATENDIDA.
       *
       * El cobro NO es trabajo del médico —lo registra la asistente cuando el
       * paciente sale y paga— pero para eso la asistente necesita saber a QUIÉN
       * cobrar. Hasta ahora firmar no marcaba nada: la cita se quedaba en el
       * estado en que estuviera, así que la asistente veía la lista entera del día
       * con botón "Cobrar" en todas, incluidas las que aún no habían pasado, y
       * quien terminaba marcando "atendida" a mano era el propio médico, en otra
       * pantalla y con un menú sin traducir.
       *
       * Firmar la nota es la señal inequívoca y ya existente de que el paciente
       * fue atendido. Marcar aquí le cuesta CERO clics al médico y es lo que
       * alimenta la cola de cobro de la asistente.
       *
       * Se hace después de guardar la nota y aparte del try principal: si esto
       * fallara, la nota YA está firmada y sellada, y perder el estado de la cita
       * no puede invalidar eso. Se avisa en vez de callar, porque el efecto
       * visible es que la asistente no verá al paciente en su cola.
       */
      if (citaDeHoy && !['atendida', 'finalizada', 'pagada'].includes(citaDeHoy.estado)) {
        try {
          await updateAppointment(clinicId, citaDeHoy.id, { estado: 'atendida' })
        } catch {
          toast('La nota quedó firmada, pero la cita no se marcó como atendida: no le aparecerá a tu asistente para cobrar.', 'error')
        }
      }

      // Cobro OPCIONAL. Por defecto el MÉDICO NO cobra al firmar: el cobro lo
      // registra la ASISTENTE desde Citas cuando el paciente se va (y cae en las
      // Finanzas del médico). Solo si la clínica lo enciende (pedirCobroAlCerrar
      // === true) se le pide el cobro al médico aquí.
      if (config?.pedirCobroAlCerrar === true) {
        setCobrar(true)
      } else {
        /**
         * ── LA ORDEN SE QUEDABA EN EL TINTERO (REG-244) ──────────────────
         *
         * Esto elegía UN destino. Con medicamentos **y** estudios —media
         * consulta de medicina interna— iba a la receta y la orden no se
         * imprimía nunca: el paciente salía sin su solicitud, y todo se veía
         * correcto (nota firmada, cita atendida).
         *
         * El problema no era a cuál de los dos ir: era que son dos. Cualquier
         * regla que elija uno deja el otro sin hacer.
         *
         * Con un solo destino se sigue yendo DIRECTO —ese caso nunca estuvo
         * roto—; con dos o más se enseña qué falta y se hace en cualquier
         * orden.
         */
        const destino = aDondeIrDirecto({
          patientId,
          notaId: notaIdRef.current,
          hayMedicamentos: medicamentos.length > 0,
          hayEstudios: estudiosOrden.length > 0,
          internamientoActivo,
        })
        if (destino) router.push(destino)
      }
    } catch (e) {
      toast('Error al firmar', 'error')
    } finally {
      setGuardando(false)
    }
    /**
     * `proximoSeguimiento` en las dependencias — REG-310. Faltaba, y como
     * TAMPOCO está en las de `construirNota`, teclear la fecha como ÚLTIMO
     * gesto antes de firmar (el orden natural: se decide el control al
     * cerrar) dejaba este callback memorizado con la fecha VIEJA — `''`.
     * Resultado, medido contra el emulador con el arnés de la Fase 8: cuatro
     * notas firmadas con fecha y CERO tareas «Agendar el seguimiento»
     * derivadas, y `patient.proximoSeguimiento` sin actualizar. El tercer
     * arreglo del mismo dato (REG-193, REG-300, éste): cada uno cubrió un
     * camino distinto por el que se perdía.
     */
  }, [clinicId, patientId, notaId, config, construirNota, router, toast, citaDeHoy, errorCargaNota, pacienteError, deEstePaciente, proximoSeguimiento])

  // ── Atajos de teclado ──────────────────────────────────────────
  //
  // Historia de este bloque:
  //  1. Antes secuestraba Cmd/Ctrl+R (recargar) para grabar. Se cambió a
  //     Cmd/Ctrl+SHIFT+R "para no chocar"... pero ESO ES EL HARD-REFRESH del
  //     navegador: al actualizar forzado, la app arrancaba a grabar en vez de
  //     recargar (con preventDefault, ni siquiera recargaba). El Dr. lo reportó.
  //     Ahora GRABAR es Cmd/Ctrl+Shift+G (Grabar), que no colisiona con recargar,
  //     imprimir, nueva pestaña, etc.
  //  2. No miraba dónde estaba el foco: escribir en un campo y pulsar el atajo
  //     arrancaba a grabar. Ahora se ignora si el foco está en un campo de texto.
  //  3. Firmar es IRREVERSIBLE (NOM-024): nunca por un atajo suelto → confirma.
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

      // GRABAR: Cmd/Ctrl+Shift+G. NO se usa R: Cmd/Ctrl+Shift+R es el hard-refresh
      // del navegador y la app terminaba grabando al actualizar forzado.
      if (e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault()
        // Detener el grabador ACTIVO (audio en modo whisper); si no graba, iniciar.
        // Antes miraba voz.grabando, que en el flujo real es SIEMPRE false → el
        // atajo ni detenía ni evitaba arrancar un grabador paralelo.
        if (audio.estado === 'grabando' || audio.estado === 'pausado') audio.detener()
        else if (voz.grabando) voz.detener()
        else iniciarGrabacion()
        return
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
    /**
     * ── UNA REESCRITURA NO PIERDE UNA CIFRA (REG-240) ─────────────────────
     *
     * Se guarda el texto ANTES para poder compararlo con el después. No hay
     * otra forma: cuando el modelo devuelve, lo que había ya se perdió.
     */
    const cifrasAntes = [resumen, ...secciones.map(x => x.value),
      ...medicamentos.map(m => `${m.nombre} ${m.dosis} ${m.frecuencia} ${m.duracion ?? ''}`)].join(' ')
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
      if (data.signosVitales && typeof data.signosVitales === 'object') {
        // MERGE por campo, no reemplazo: si la IA devuelve el bloque de signos
        // parcial (o vacío) al corregir algo ajeno a signos, un reemplazo total
        // borraba los signos capturados a mano. Solo se pisan los campos que la IA
        // devuelve con valor.
        const soloPresentes = Object.fromEntries(
          Object.entries(data.signosVitales as Record<string, unknown>)
            .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''),
        )
        setSignos(prev => ({ ...prev, ...soloPresentes }))
      }
      /**
       * ── LO QUE SE LLEVÓ POR DELANTE (REG-240) ──────────────────────────
       *
       * Un modelo al que se le pide «más conciso» acorta, y acortar sobre un
       * plan puede llevarse «cada 8 horas» o dejar «400 mg» en «400». El texto
       * sigue leyéndose bien — ésa es la trampa.
       *
       * La instrucción es la llave: una cifra que el médico nombró está
       * autorizada a entrar o salir. Lo demás, no.
       *
       * No se repara: se DICE. Volver a meter la cifra caída sería reescribir
       * una nota clínica por cuenta propia.
       */
      const cifrasDespues = [
        typeof data.resumenEjecutivo === 'string' ? data.resumenEjecutivo : resumen,
        ...(data.secciones && typeof data.secciones === 'object'
          ? Object.values(data.secciones as Record<string, unknown>).map(String) : []),
        ...(Array.isArray(data.medicamentos)
          ? (data.medicamentos as Medicamento[]).map(m => `${m.nombre} ${m.dosis} ${m.frecuencia} ${m.duracion ?? ''}`)
          : []),
      ].join(' ')
      const aviso = loQueSeLlevoPorDelante(queCambioEnLasCifras(cifrasAntes, cifrasDespues, instr))

      setChatCorr(c => [...c, { rol: 'ia', texto: '✓ Listo, apliqué el cambio. Revisa la nota (puedes deshacer).' }])
      if (aviso) setChatCorr(c => [...c, { rol: 'ia', texto: `⚠ ${aviso}` }])
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

  // useMemo: construirNota no es barato y esto corría en CADA render.



  /**
   * ── UNA SOLA RESPUESTA A «¿POR QUÉ NO PUEDO FIRMAR?» (REG-189) ─────────────
   *
   * Antes vivía repartida: el botón se apagaba con NOM-004 y la compuerta de
   * dosis estaba dentro de `firmar()`, así que con una dosis incompleta el
   * botón se veía ENCENDIDO y fallaba al pulsarlo. La barra, al revés, no
   * miraba NOM-004 y decía «nada te impide firmar» junto a un botón apagado.
   *
   * NO cambia la política: lo que impedía firmar ayer impide firmar hoy.
   */
  const bloqueosDeFirma = motivosParaNoFirmar({
    erroresNOM004: validacion?.errores,
    dosisIncompletas: dosisIncompletas.map(d => ({ nombre: d.med, mensaje: d.aviso.mensaje })),
  })
  const motivoNoFirma = porQueNoSePuedeFirmar({
    erroresNOM004: validacion?.errores,
    dosisIncompletas: dosisIncompletas.map(d => ({ nombre: d.med, mensaje: d.aviso.mensaje })),
  })

  /**
   * ¿Hay ya algo de nota que cerrar? (V15-MOBILE-001, §22 — `CierreAlPulgar`.)
   * Cualquier señal real de contenido cuenta: una sección escrita, un
   * diagnóstico o medicamento capturado, o un dictado en curso
   * (`!esElPrincipio`). Sin ninguna, la acción primaria del encuentro sigue
   * siendo EmpezarAGrabar y la barra de cierre no tiene derecho a existir.
   */
  const hayContenidoDeNota = !esElPrincipio
    || secciones.some(s => s.value.trim() !== '')
    || diagnosticos.length > 0
    || medicamentos.length > 0


  /**
   * ¿El bloqueo de la firma es SÓLO la cédula que falta?
   *
   * Se mira la config, no el texto del error: comparar cadenas se rompe en
   * silencio en cuanto alguien reescriba el mensaje en `nom004.ts`, y el fallo
   * sería que el médico nuevo vuelve a quedarse con el botón muerto — el mismo
   * defecto, resucitado por un cambio de redacción.
   */
  const faltaCedula = !config?.cedulaProfesional?.trim() && !firmada
  const [cedulaRapida, setCedulaRapida] = useState('')
  const [guardandoCedula, setGuardandoCedula] = useState(false)

  const guardarCedulaRapida = useCallback(async () => {
    const ced = cedulaRapida.trim()
    if (!ced || !clinicId) return
    setGuardandoCedula(true)
    try {
      await saveConfigPartial(clinicId, { cedulaProfesional: ced })
      // No se toca el estado local: `useConfig` escucha con onSnapshot, así que
      // la config llega sola y la validación se recalcula. Escribirlo también
      // aquí crearía una segunda copia de la verdad que puede discrepar.
      toast('Cédula guardada. Ya puedes firmar.', 'success')
    } catch (e) {
      // Que se vea el motivo: un fallo mudo aquí deja al médico picando un botón
      // que no responde, que es exactamente de lo que veníamos.
      toast(`No se pudo guardar la cédula: ${(e as Error)?.message ?? 'error desconocido'}`, 'error')
    } finally {
      setGuardandoCedula(false)
    }
  }, [cedulaRapida, clinicId])

  const mmss = `${String(Math.floor(voz.duracion / 60)).padStart(2, '0')}:${String(voz.duracion % 60).padStart(2, '0')}`

  return (
    <div className="nx-canvas">
      <button onClick={volverAtras} style={S.back}>
        <ArrowLeft size={15} /> {esNotaHospital ? 'Volver al episodio' : 'Expediente'}
      </button>

      {/*
        EL HILO DE VUELTA (§21) — sólo cuando el médico llegó aquí desde una
        inspección, y sólo si el contrato cuadra con ESTA consulta.

        `destino` se arma con lo que esta pantalla sabe de sí misma: el
        consultorio de la sesión, el paciente de su propia ruta y la nota que
        el parámetro pidió abrir. Se compara contra el contrato, y si no
        coinciden los tres NO se ofrece volver — un testigo de otro paciente o
        de otra nota se declina en voz alta en vez de devolver al médico a una
        lista afirmando que venía de un encuentro en el que nunca estuvo.

        `notaIdParam` y no el `notaId` de estado: el estado cambia si esta
        pantalla crea una nota nueva, y entonces la comparación dejaría de
        hablar del encuentro por el que se entró.
      */}
      <VolverALaFuente destino={{
        clinicId: clinicId ?? '',
        patientId: String(patientId ?? ''),
        notaId: notaIdParam ?? '',
      }} />

      {/* RTC-31/§5 — LA IDENTIDAD ENCABEZA, TAMBIÉN AQUÍ.
          Medido el 14-ago con un paciente CON historia: el nombre caía a 287px
          en escritorio y 404px en móvil, porque las cajas de contexto —
          alergias, problemas, visitas anteriores— iban por delante. Con el
          expediente vacío estaba a ~172px: el defecto sólo existía cuando el
          paciente tiene historia, que es siempre menos el primer día. De quién
          es la consulta no puede leerse a media pantalla.
          El orden es el que el expediente ya había elegido en su ancla:
          identidad → alergias → el resto del contexto. */}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          {/* `.nx-vt-paciente` (§20, continuidad.ts): en una navegación
              coreografiada, el nombre del paciente que venía en la fila de Hoy
              o en el ancla del expediente ATERRIZA aquí — el mismo objeto
              ganando detalle, no una pantalla que reemplaza a otra. */}
          <h1 className="nx-vt-paciente" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{patient?.nombre ?? 'Consulta'}</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''} · {TIPO_NOTA_LABEL[tipo]}
          </div>
          {/*
            ALERGIAS SIEMPRE A LA VISTA durante la consulta.
            Antes solo aparecían al desplegar los datos del paciente, pero es
            justo mientras se dicta y se prescribe cuando hay que tenerlas
            enfrente. Rojo si el paciente tiene alergias; discreto si no.
          */}
          {/**
            * RTC-14 — AQUÍ HABÍA UNA SEGUNDA PÍLDORA DE ALERGIAS.
            *
            * Medido el 14-ago en navegador, con un paciente que POR FIN tenía
            * alergia registrada: la alergia se pintaba **dos veces en el primer
            * pliegue** de la consulta (49px entre las dos) — la franja
            * editable de arriba y esta píldora de sólo lectura, a 200px de
            * distancia. Dos avisos del mismo dato compiten entre sí: el
            * segundo se aprende a ignorar, y el día que digan cosas distintas
            * —ya pasó, REG-311— el médico no sabe cuál creer.
            *
            * Lo que esta píldora aportaba de más era la LECTURA semántica
            * (`alergenosDe`), y eso no se pierde: subió a la franja, junto al
            * texto del que sale. Una presentación, los dos hechos.
            */}
        </div>
        {firmada && <span style={S.firmadaBadge}><CheckCircle2 size={14} /> Nota firmada</span>}
      </div>

      {/* Alergias — SIEMPRE visible y EDITABLE (el Dr. reportó que no había dónde
          ponerlas). Se guarda en el expediente del paciente y alimenta las alertas
          de fármaco. Rojo cuando hay alergias; neutro cuando no.
          El rojo lo decide `alergenosDe` (semántica sellada de REG-279), no la
          mera presencia de texto: «Niega alergias» pintaba esta franja ROJA y
          la píldora de más abajo NEUTRA — dos alarmas contradictorias para el
          mismo dato en el mismo viewport (REG-311). */}
      {(() => { const alergenosDelPaciente = alergenosDe(patient ?? {}); const hayAlergias = alergenosDelPaciente.length > 0; return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        background: hayAlergias ? 'color-mix(in srgb, var(--red) 10%, transparent)' : 'var(--s2)',
        border: `1px solid ${hayAlergias ? 'color-mix(in srgb, var(--red) 35%, transparent)' : 'var(--border)'}`,
        borderRadius: 10, padding: '9px 13px',
      }}>
        {/*
          `#f87171` era el rosa PARA FONDO OSCURO, quemado aquí. En tema claro,
          sobre el fondo rojizo de esta misma línea, quedaba en 2.42:1 — la mitad
          del mínimo legible, y en el dato más letal de la aplicación. Va por
          token, que está medido en los dos temas. Y es el MISMO rojo que el chip
          de resumen de 56 líneas más abajo, que usaba otro: mismo concepto
          clínico, misma pantalla, dos rojos que el médico no puede aprender.
        */}
        <AlertTriangle size={16} color={hayAlergias ? 'var(--red)' : 'var(--text3)'} style={{ flexShrink: 0 }} />
        <strong style={{ flexShrink: 0, fontSize: 13, color: hayAlergias ? 'var(--red)' : 'var(--text2)' }}>Alergias:</strong>
        <input
          value={patient?.alergias ?? ''}
          onChange={e => setPatient(prev => prev ? { ...prev, alergias: e.target.value } : prev)}
          onBlur={() => {
            if (!clinicId || !patient) return
            const antes = alergiasAlAbrir.current
            const despues = patient.alergias ?? ''
            if (antes === despues) return
            updatePatient(clinicId, patientId, { alergias: despues }).catch(() => toast('No se guardaron las alergias. Revisa tu conexión.', 'error'))
            /**
             * QUEDA CONSTANCIA DE QUIÉN LAS CAMBIÓ.
             *
             * Sin esto había una salida silenciosa para la compuerta de alergias:
             * el médico ve el error que le impide firmar, vacía el campo, y la
             * firma se habilita sin que en el expediente quede rastro de que
             * alguna vez hubo una alergia registrada.
             */
            void logAudit({ evento: 'paciente_modificado', clinicId, patientId, meta: { campo: 'alergias', antes, despues, vaciado: !despues.trim() && !!antes.trim() } })
            alergiasAlAbrir.current = despues
          }}
          // «No registradas», nunca «Sin alergias conocidas»: el campo vacío
          // significa que NADIE preguntó todavía, no que el paciente niegue.
          // «Sin alergias conocidas» es además una frase de NEGACIÓN del
          // vocabulario clínico (alergias-negacion.test.ts): sólo puede
          // escribirla el médico como dato, no el placeholder como adorno.
          // Regla 4 de clinical-safety: ausencia de dato no es dato de ausencia.
          // Guardián: alergias-placeholder-no-afirma.test.ts
          placeholder="No registradas — escribe aquí si hay (penicilina, AINEs, sulfas…)"
          disabled={firmada}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14 }}
        />
        {/**
          * RTC-14 — LA LECTURA DEL SISTEMA, AQUÍ Y NO EN OTRA CAJA.
          *
          * Esto es lo ÚNICO que aportaba la píldora de bajo el nombre que esta
          * rebanada retira: el campo de arriba enseña lo que hay ESCRITO, y
          * esto enseña lo que el sistema ENTIENDE que son alérgenos. Los dos
          * hechos son distintos y los dos hacen falta — «Niega penicilina.
          * Alérgico a sulfas» se lee entero en el campo, y aquí se ve que de
          * ahí sale «sulfas» (REG-279/REG-311: una copia local del criterio
          * llegó a pintar eso como neutro).
          *
          * Sólo aparece cuando la lectura AÑADE algo: si el texto escrito es
          * exactamente el alérgeno, repetirlo al lado sería el mismo defecto
          * que esta rebanada viene a quitar.
          */}
        {hayAlergias && alergenosDelPaciente.join(' · ') !== (patient?.alergias ?? '').trim() && (
          <span
            className="nx-critico"
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700 }}
            title="Lo que el sistema entiende como alérgeno a partir de lo escrito"
          >
            se lee: {alergenosDelPaciente.join(' · ')}
          </span>
        )}
      </div>
      ) })()}

      {/*
        LOS PROBLEMAS DEL PACIENTE Y CUÁNDO VINO LA ÚLTIMA VEZ.
        Las dos cosas que el médico reconstruía abriendo notas hacia atrás en
        mitad de la consulta. Van arriba de la medicación porque contestan «qué
        tiene» antes de «qué toma».
      */}
      {/*
        LO QUE EL PACIENTE ESCRIBIÓ ANTES DE ENTRAR (P-019).
        Va ARRIBA del resumen clínico y separado de él a propósito: es su
        declaración, no expediente. Nada de esto ha tocado sus alergias ni su
        medicación — si algo debe quedar registrado, lo pasa el médico.
      */}
      {previo && resumenPrevio(previo) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12,
          background: 'var(--s2)', border: '1px dashed var(--border2, var(--border)',
          borderRadius: 10, padding: '9px 13px',
        }}>
          <MessageSquare size={16} color="var(--text3)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, minWidth: 0 }}>
            <strong style={{ color: 'var(--text)' }}>El paciente escribió antes de la consulta:</strong>
            {CAMPOS_PREVIOS.map(c => {
              const v = previo.respuestas[c.clave]
              return v ? (
                <div key={c.clave} style={{ marginTop: 3 }}>
                  <span style={{ color: 'var(--text3)' }}>{c.etiqueta}</span>{' '}{v}
                </div>
              ) : null
            })}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{AVISO_NO_ES_EXPEDIENTE}</div>
          </div>
        </div>
      )}

      {(problemas.length > 0 || ultimaVisita) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12,
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '9px 13px',
        }}>
          <Stethoscope size={16} color="var(--text3)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            {problemas.length > 0 && (
              <>
                <strong style={{ color: 'var(--text)' }}>Problemas:</strong>{' '}
                {problemas.map(p => p.diagnostico.descripcion + (p.diagnostico.estado === 'cronico' ? ' (crónico)' : '')).join(' · ')}
              </>
            )}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {ultimaVisita
                ? `Última consulta ${haceCuanto(ultimaVisita, new Date().toISOString())}.`
                : 'Primera consulta registrada.'}
              {problemas.length > 0 && ' De lo último que se dijo de cada problema en sus notas firmadas.'}
            </div>
          </div>
        </div>
      )}

      {/*
        MEDICACIÓN VIGENTE. Va justo bajo las alergias porque son las dos cosas
        que hay que saber ANTES de prescribir, y estaban a distinta distancia:
        las alergias arriba del todo y la medicación enterrada en la nota
        anterior.
      */}
      {vigentes.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12,
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '9px 13px',
        }}>
          <Pill size={16} color="var(--text3)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, flex: 1, minWidth: 0 }}>
            <strong style={{ color: 'var(--text)' }}>Está tomando:</strong>{' '}
            {/*
              SUSPENDER ES UN ACTO, NO UN OLVIDO.
              El ciclo de vida de la orden existía en el modelo y NADIE lo
              escribía: sin una forma de decir «esto ya no lo toma», la lista era
              en realidad «todo lo que alguna vez apareció en una nota», y una
              amoxicilina de hace dos años seguía figurando como vigente.
              El cambio se escribe en la nota de HOY —no se edita el pasado— y de
              ahí lo recoge la regla de la última palabra.
            */}
            {vigentes.map((v, i) => (
              <span key={`${v.medicamento.nombre}-${i}`} style={{ whiteSpace: 'nowrap' }}>
                {i > 0 && ' · '}
                {[v.medicamento.nombre, v.medicamento.dosis].filter(Boolean).join(' ')}
                {!firmada && (
                  <button
                    type="button"
                    onClick={() => setMedPorCambiar({ nombre: v.medicamento.nombre, dosis: v.medicamento.dosis, estado: 'suspendida', motivo: '' })}
                    title={`Marcar que ${v.medicamento.nombre} ya no lo toma`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11.5, padding: '0 2px 0 5px', textDecoration: 'underline' }}
                  >ya no</button>
                )}
              </span>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              De lo último que se dijo de cada fármaco en sus notas firmadas. No mencionarlo en una consulta no lo suspende.
            </div>
          </div>
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

      {/* Aviso de contexto: esta nota pertenece a un episodio de HOSPITAL, no a consulta */}
      {esNotaHospital && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 13px', borderRadius: 10, background: 'rgba(61,90,254,0.08)', border: '1px solid rgba(61,90,254,0.3)', fontSize: 12.5, color: 'var(--text2)' }}>
          <BedDouble size={15} style={{ color: 'var(--nexus)', flexShrink: 0 }} />
          Nota de <strong>Hospitalización</strong> — al guardar/firmar regresas al episodio, no a Consulta.
        </div>
      )}


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

      {/*
        ── QUÉ NOTA ES: UNA LÍNEA EN VEZ DE DOCE CONTROLES (7-ago-2026) ────────
        Aquí había diez botones de tipo de nota en dos filas y un desplegable de
        especialidad con su etiqueta y su explicación. El médico lo dijo con
        estas palabras: «demasiadas cosas en pantalla antes de poder hablar».
        Los diez tipos siguen estando —los usa todos— pero detrás del lápiz.
      */}
      {!firmada && (
        <QueNotaEs
          tipo={tipo}
          etiquetaDe={t => TIPO_NOTA_LABEL[t]}
          tiposDisponibles={tiposVisibles(esNotaHospital, tipo)}
          alCambiarTipo={cambiarTipo}
          especialidad={especialidadEfectiva}
          especialidadesPorGrupo={ESPECIALIDADES_POR_GRUPO}
          alCambiarEspecialidad={setEspecialidadNota}
          estructurandoEnVivo={estructurandoVivo}
        />
      )}

      {/*
        ── LA BARRA QUE NO SE VA (7-ago-2026) ─────────────────────────────────
        El médico lo pidió con estas palabras: «el micrófono es en el celular, EN
        LA COMPUTADORA» y «así como cuando te dictan a ti, que se vaya
        escribiendo».

        Grabar una consulta dura veinte minutos y en ese rato uno se desplaza por
        la nota: el micrófono quedaba arriba del todo y para pausar había que
        buscarlo. Y sobre todo, NO HABÍA FORMA DE SABER SI ESTABA OYENDO — un
        micrófono encendido sin señal es indistinguible de uno apagado hasta que
        terminas y no hay nada.

        Sólo aparece MIENTRAS se graba: no es un segundo botón de iniciar, es el
        control a la mano y la prueba en vivo de que capta.
      */}
      {!firmada && (audio.estado === 'grabando' || audio.estado === 'pausado' || audio.estado === 'subiendo') && (
        <MientrasHablas
          estado={audio.estado === 'subiendo' ? 'procesando' : audio.estado === 'pausado' ? 'pausado' : 'grabando'}
          duracion={audio.duracion}
          nivelAudio={audio.nivelAudio}
          ultimasPalabras={audio.transcripcionParcial || voz.transcripcion}
          escribiendo={estructurandoVivo}
          alGrabar={() => { if (consentimiento) audio.iniciar(opcionesWhisper) }}
          alPausar={() => audio.pausar()}
          alReanudar={() => audio.reanudar()}
          alDetener={() => { void audio.detener() }}
        />
      )}

      {/* ── Grabación ── */}
      {!firmada && (
        /* RTC-31: la caja sólo se pinta cuando tiene VARIOS controles que
           agrupar. Antes de pulsar sólo está `EmpezarAGrabar`, que ya es una
           superficie con su borde — y una tarjeta dentro de otra tarjeta es lo
           que §29 penaliza aquí. Ver `grabCardSola` en consulta-ui. */
        <div style={esElPrincipio ? S.grabCardSola : S.grabCard}>
          {/*
            EL BOTÓN, Y NADA MÁS, HASTA QUE HAY ALGO GRABADO.
            El rótulo de modo que vivía aquí —«Conversación completa (médico +
            paciente) — se graba y separa ambas voces»— decía lo mismo que el
            título y que la descripción de abajo. Ahora lo dice el propio botón,
            una vez.
          */}
          {esElPrincipio && (
            <EmpezarAGrabar
              estado={audio.estado === 'subiendo' ? 'procesando' : 'listo'}
              noSoportado={!audio.soportado && !voz.soportado}
              alPulsar={iniciarGrabacion}
            />
          )}

          {/* Mensaje útil cuando NO hay opción de voz */}
          {!voz.soportado && !audio.soportado && (
            <div style={{ fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    : 'Dicta la consulta. Al detener, la nota se estructura sola. · Ctrl/Cmd+Shift+G'}
                </div>
              </div>
              {/* Respaldo manual: normalmente NO hace falta (se procesa solo al detener). */}
              {procesando
                ? <span style={{ ...S.iaBtn(true), pointerEvents: 'none' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Estructurando la nota…</span>
                : (!voz.grabando && voz.transcripcion.trim()
                    ? <button onClick={() => procesarIA()} style={S.iaBtn(false)}><Sparkles size={16} /> Procesar de nuevo</button>
                    : null)}
            </div>
          )}

          {/* Modo WHISPER (MediaRecorder + servidor) */}
          {modoVoz === 'whisper' && audio.soportado && (
            /*
              ── AL PRINCIPIO, SÓLO EL BOTÓN ───────────────────────────────
              Antes de dictar había SEIS cosas antes de poder hablar —el rótulo
              de modo, «Manos libres», el micrófono, un título, una descripción
              y un «Procesar con IA» apagado— y tres de ellas decían lo mismo
              con distintas palabras.
              Nada se quita: esta fila entera vuelve en cuanto hay algo grabado,
              que es cuando pausar, cancelar y procesar significan algo.
            */
            !esElPrincipio && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {ofreceRecovery && audio.estado === 'inactivo' && (
                <div style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1px solid var(--amber)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mic size={14} className="ds-icon" /> Hay audio guardado de una sesión anterior. ¿Recuperar y transcribir?</span>
                  <button className="btn btn-sm" style={{ background: 'var(--amber)', color: '#000', border: 'none', fontWeight: 600 }}
                    onClick={async () => { await audio.recuperarAudio(`consulta-${patientId}`, opcionesWhisper); setOfreceRecovery(false) }}>
                    Recuperar
                  </button>
                  <button className="btn btn-sm btn-ghost" title="Guarda el audio como archivo en tu dispositivo (nunca lo pierdes)"
                    onClick={async () => { const ok = await audio.descargarAudioGuardado(`consulta-${patientId}`); if (!ok) toast('No se encontró audio guardado.', 'info') }}>
                    Descargar audio
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={async () => { await audio.descartarRecovery(`consulta-${patientId}`); audio.reset(); setOfreceRecovery(false); toast('Audio guardado descartado', 'info') }}>
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
              {(audio.estado === 'grabando' || audio.estado === 'pausado') && (
                <button
                  onClick={async () => {
                    // PARAR Y BORRAR AL INSTANTE (grabación por error). Corta el
                    // micrófono, NO transcribe y borra el audio guardado; con una
                    // confirmación ligera para no tirar una grabación real de un
                    // roce accidental.
                    if (!(await confirm('¿Cancelar y borrar esta grabación? No se transcribirá ni se guardará.', { peligro: true, confirmar: 'Cancelar y borrar' }))) return
                    audio.reset()
                    await audio.descartarRecovery(`consulta-${patientId}`)
                    setOfreceRecovery(false)
                    toast('Grabación cancelada y borrada', 'info')
                  }}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Cancelar y borrar esta grabación (no se transcribe)"
                >
                  <Trash2 size={18} />
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
                {/*
                  NO HUBO SEPARACIÓN DE VOCES — y ahora se dice.
                  Era invisible: la app caía a Whisper y la nota salía idéntica
                  a una hecha con el motor bueno. Sin turnos Médico/Paciente el
                  modelo razona sobre un bloque plano, y ahí es donde una
                  palabra mal oída acaba convertida en un diagnóstico.
                */}
                {audio.sinDiarizacion && audio.estado === 'listo' && (
                  <div style={{
                    marginTop: 8, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
                    color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  }}>
                    <b>Sin separación de voces en esta grabación.</b>{' '}
                    {MOTIVO_SIN_DIARIZACION[audio.sinDiarizacion]}{' '}
                    La transcripción se hizo con el motor alterno: revisa nombres de fármacos,
                    dosis y microorganismos antes de firmar.{' '}
                    <b>Y sin separación de voces tampoco hay confianza por palabra</b>, así que en esta
                    grabación no hay lista de «palabras a verificar»: no es que no haya dudas, es que
                    no se pueden medir.
                  </div>
                )}
                {/*
                  UN TROZO EN VIVO QUE SE PERDIÓ DEJA DE SER INVISIBLE.
                  El texto en vivo alimenta la nota preliminar; truncado se lee
                  igual que completo.
                */}
                {/*
                  SATURACIÓN: el nivel no la ve.
                  Una señal recortada tiene RMS normal y armónicos falsos en todo
                  el espectro; la barra podía decir «captando bien» sobre audio
                  que ya no se puede transcribir bien.
                */}
                {audio.recorte && audio.estado === 'grabando' && (
                  <div style={{
                    marginTop: 8, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
                    color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  }}>
                    <b>El micrófono está saturando.</b>{' '}
                    Bájale el volumen de entrada al sistema o sepáralo un palmo: el audio recortado
                    se transcribe peor aunque se oiga más fuerte.
                  </div>
                )}

                {audio.chunksFallidos > 0 && (
                  <div style={{
                    marginTop: 8, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
                    color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  }}>
                    <b>Faltan {audio.chunksFallidos} tramo(s) en el texto en vivo.</b>{' '}
                    La transcripción final se hace con la grabación completa, así que esto no afecta a la
                    nota definitiva — pero lo que ves ahora mismo está incompleto.
                  </div>
                )}

                {multiTramoVisible && audio.utterances.length > 0 && audio.estado === 'listo' && (
                  <div style={{
                    marginTop: 8, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
                    color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  }}>
                    <b>Esta consulta se grabó en varias tandas.</b>{' '}
                    La separación de voces sólo cubre la última, así que la nota se arma con el texto
                    completo pero <b>sin los turnos Médico/Paciente</b> — se conserva todo el contenido,
                    se pierden las etiquetas. Las palabras dudosas del último tramo sí van marcadas.
                  </div>
                )}

                {/*
                  EL GATE DE AMBIGÜEDAD, que hasta la v990 se calculaba en cada
                  dictado y no lo leía ninguna pantalla. No bloquea la firma: eso
                  es una decisión del Dr. sobre su flujo, no del código.
                */}
                {motivosDictado.length > 0 && (
                  <div style={{
                    marginTop: 8, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
                    color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  }}>
                    <b>Conviene confirmar antes de firmar:</b>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {motivosDictado.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                    {/*
                      CUÁLES. Un aviso que dice «un fármaco se mencionó como algo
                      a valorar» sin decir cuál obliga a releer la consulta
                      entera, y un aviso que cuesta trabajo se cierra sin leer.
                    */}
                    {soloPropuestos.length > 0 && (
                      <div style={{ marginTop: 5, fontSize: 12 }}>
                        Fármacos mencionados así: <b>{soloPropuestos.join(', ')}</b>.
                      </div>
                    )}
                    {estudiosPropuestos.length > 0 && (
                      <div style={{ marginTop: 3, fontSize: 12 }}>
                        Estudios mencionados así: <b>{estudiosPropuestos.join(', ')}</b>.
                      </div>
                    )}
                  </div>
                )}

                {/*
                  PALABRAS QUE EL AUDIO NO OYÓ BIEN.
                  Va aquí, junto al dictado y ANTES de firmar, porque es donde el
                  médico todavía se acuerda de lo que dijo el paciente. En la nota
                  ya terminada llegaría tarde: para entonces la palabra dudosa ya
                  se lee como un hecho.
                */}
                {audio.estado === 'listo' && palabrasAVerificar.palabras.length > 0 && (
                  <div style={{
                    marginTop: 8, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
                    color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  }}>
                    <b>Palabras que el audio no oyó con seguridad.</b>{' '}
                    No se corrigieron ni se adivinaron: se marcaron para que la IA no las dé por hechas.
                    Vuelve al audio en el minuto indicado si alguna cambia el sentido.
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {palabrasAVerificar.palabras.map((w, i) => (
                        <span key={`${w.texto}-${w.momento}-${i}`} style={{
                          padding: '2px 8px', borderRadius: 'var(--r-pill)', fontSize: 12,
                          background: 'color-mix(in srgb, var(--amber) 18%, transparent)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          «{w.texto}» · {w.momento} · {w.seguridad}%
                        </span>
                      ))}
                    </div>
                    {palabrasAVerificar.ocultas > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: .9 }}>
                        Y {palabrasAVerificar.ocultas} más, menos dudosas que éstas. Se enseñan las más dudosas,
                        no las primeras.
                      </div>
                    )}
                  </div>
                )}
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
                        // INSTRUMENTO, no interfaz (V15-MOTION-001): el medidor
                        // sigue el nivel del micrófono en vivo. `linear` a 60ms está
                        // afinado al ritmo de la señal (y el color de banda a 200ms);
                        // un easing o un token más lento lo haría MENTIR sobre lo que
                        // capta. No migrar a var(--mov-*).
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
                        {/*
                          EL DATO REAL, NO EL QUE SE PEDÍA.
                          `sampleRate` en getUserMedia se ignora en silencio si el
                          navegador no la soporta, así que «16kHz» era una
                          afirmación sin comprobar. Y el tope que de verdad cambia
                          el comportamiento son 3.6 MB (a partir de ahí el audio se
                          trocea o sube a Storage), no 25: quien vigilara «25 MB»
                          no veía venir el cambio de camino.
                        */}
                        {(audio.bytesGrabados / 1024 / 1024).toFixed(1)} MB
                        {audio.captura?.sampleRate ? ` · ${Math.round(audio.captura.sampleRate / 1000)} kHz` : ''}
                        {audio.captura?.supresionRuido ? ' · con supresión de ruido' : ''}
                      </span>
                    </div>
                  </div>
                )}
                {audio.estado !== 'grabando' && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                    Capta a los dos · separación de voces con AssemblyAI · vocabulario médico ampliado
                  </div>
                )}
                {audio.error && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={12} className="ds-icon" /> {audio.error}
                    </span>
                    <button className="btn btn-sm" style={{ background: 'var(--amber)', color: '#000', border: 'none', fontWeight: 600 }}
                      title="Guarda el audio como archivo en tu dispositivo (nunca lo pierdes)"
                      onClick={async () => { const ok = await audio.descargarAudioGuardado(`consulta-${patientId}`); if (!ok) toast('No se encontró audio guardado.', 'info') }}>
                      Descargar audio
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={async () => { await audio.descartarRecovery(`consulta-${patientId}`); audio.reset(); setOfreceRecovery(false); toast('Audio guardado descartado', 'info') }}>
                      Descartar audio guardado
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => procesarIA()} disabled={procesando || tareaProc?.ejecutando || !voz.transcripcion.trim()} style={S.iaBtn(procesando || tareaProc?.ejecutando || !voz.transcripcion.trim())}>
                {(procesando || tareaProc?.ejecutando) ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Estructurando la nota…</> : <><Sparkles size={16} /> Procesar con IA</>}
              </button>
            </div>
            )
          )}

          {/* ── MENÚ DE IA: motor por nota + medidor de créditos ──
              §8.5 «nonessential admin disappears»: `!voz.grabando` sólo
              cubría la ruta de Web Speech. Con el grabador de audio
              (diarización/Whisper), `voz.transcripcion` se llena en vivo
              desde `audio.transcripcionParcial` (línea ~531) mientras
              `voz.grabando` sigue en false, así que este menú SÍ aparecía
              con el mismo peso durante la grabación real. `grabandoAhora()`
              (ya definido más arriba, mismo criterio que usa el resto de la
              página para "activo" — incluye pausado) cubre las dos rutas. */}
          {voz.transcripcion.trim() && !grabandoAhora() && (
            <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Motor de IA para esta nota</span>
                {usoIA && (
                  <span style={{ fontSize: 11.5, color: usoIA.alerta === 'excedido' ? 'var(--amber)' : 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
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

          {/* Lo que el GUARDIÁN descartó: correcciones que tocaban una cifra,
              una unidad, una sigla crítica, una negación o el lado del paciente,
              y dosis que se quedaron sin cantidad. Va arriba de las correcciones
              aceptadas porque esto sí hay que mirarlo antes de firmar. */}
          {audio.estado === 'listo' && <AlertasDictado alertas={audio.alertasDictado} />}

          {/* Panel de correcciones léxicas — transparencia + deshacer.
              En un documento legal nada debe cambiar en silencio: el médico
              ve qué corrigió el sistema y revierte con un clic si se equivocó. */}
          {/* Y las CIFRAS, UNIDADES y SIGLAS que reescribió el pipeline.
              Se calculaban en cada dictado y no las devolvía nadie: el médico
              veía las correcciones de fármacos y no las de dosis. */}
          {audio.estado === 'listo' && audio.cambiosCifras.length > 0 && (
            <CambiosCifrasPanel
              cambios={audio.cambiosCifras}
              onRevertir={(c) => {
                const re = new RegExp(c.despues.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                voz.setTranscripcion(voz.transcripcion.replace(re, c.antes))
              }}
            />
          )}

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
            negacionesCorregidas={negacionesCorregidas}
            avisosTemporales={avisosTemporales}
            cargando={nerCargando}
            error={nerError}
            onCerrar={() => { setEntidades(null); setNerError(''); setNegacionesCorregidas([]) }}
          />
        </div>
      )}

      {/* ── Créditos AGOTADOS (tope duro): la IA se pausó este mes ──
          §8.5: admin no clínico — se calla mientras graba/pausa (mismo
          criterio `grabandoAhora()` que el menú de motor de IA), reaparece
          en cuanto se detiene. */}
      {sinCreditos && !grabandoAhora() && (
        <div style={{
          marginBottom: 14, padding: '13px 16px', borderRadius: 12,
          border: '1px solid var(--red)', background: 'color-mix(in srgb, var(--red) 7%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
            <AlertTriangle size={17} /> Se acabaron tus consultas con IA del mes ({sinCreditos.usadas}/{sinCreditos.limite})
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
            La IA se pausó para no generarte cargos extra. Puedes seguir escribiendo la nota a mano.
            Para reactivarla, compra más consultas o sube de plan.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={comprarRecarga} disabled={comprandoRecarga} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', border: 'none', cursor: comprandoRecarga ? 'wait' : 'pointer', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700 }}>
              {comprandoRecarga ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Abriendo…</> : 'Comprar más créditos'}
            </button>
            <a href="/precios" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--nexus)', textDecoration: 'none', border: '1px solid var(--nexus)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>
              Ver planes
            </a>
          </div>
        </div>
      )}

      {modoEco && !sinCreditos && !grabandoAhora() && (
        <div style={{
          marginBottom: 14, padding: '13px 16px', borderRadius: 12,
          border: '1px solid var(--amber)', background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--amber)' }}>
            <Sparkles size={16} /> Nota generada en modo económico
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
            Se agotaron tus consultas con IA máxima del mes. Esta nota corrió con IA económica
            (Sonnet 5 — muy buena) y sin separación de voces. <b>Nunca te quedas sin IA.</b> Para
            recuperar la IA máxima (Opus 4.8 + GPT-5 + separación médico-paciente) compra más créditos.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={comprarRecarga} disabled={comprandoRecarga} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', border: 'none', cursor: comprandoRecarga ? 'wait' : 'pointer', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700 }}>
              {comprandoRecarga ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Abriendo…</> : 'Comprar más créditos'}
            </button>
            <a href="/precios" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--nexus)', textDecoration: 'none', border: '1px solid var(--nexus)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>
              Ver planes
            </a>
          </div>
        </div>
      )}

      {/* ── Candado de gasto (soft): aviso de límite de consultas del plan ──
          §8.5: mismo apagado que los dos anteriores. */}
      {usoIA && usoIA.alerta !== 'ok' && !grabandoAhora() && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '9px 13px', borderRadius: 10, fontSize: 12.5,
          border: '1px solid ' + (usoIA.alerta === 'excedido' ? 'var(--amber)' : 'var(--border)'),
          background: usoIA.alerta === 'excedido' ? 'color-mix(in srgb, var(--amber) 8%, transparent)' : 'var(--s2)',
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, background: 'rgba(59,90,254,0.10)', color: 'var(--nexus)', border: '1px solid rgba(59,90,254,0.35)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Sparkles size={14} /> Pedir segunda opinión (otra IA revisa la nota)
        </button>
      )}

      {/* ── Segunda opinión (verificación cruzada por un 2º modelo top) ── */}
      {verificando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5, color: 'var(--text3)' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Segunda opinión en curso — otro modelo de IA revisa la nota…
        </div>
      )}
      {/*
        ── EL SELLO CADUCA CUANDO LA NOTA CAMBIA (I-8) ─────────────────────────
        «Sin observaciones» se quedaba en verde después de que el médico editara
        la nota: un sello de una versión que ya no existe. Aquí se dice, y el
        verde deja de ser verde en cuanto deja de ser cierto.
      */}
      {verificacion && !verificando && revisionCaducada && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 12.5, color: 'var(--amber)' }}>
          <AlertTriangle size={14} /> {COMO_SE_DICE.caducada}{' '}
          {planActual === 'pro' && (
            <button onClick={pedirSegundaOpinion}
              style={{ background: 'none', border: 'none', color: 'var(--nexus)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: 0, textDecoration: 'underline' }}>
              Pedirla otra vez
            </button>
          )}
        </div>
      )}
      {verificacion && !verificando && (
        verificacion.hallazgos.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 12.5, color: revisionCaducada ? 'var(--text3)' : 'var(--teal)' }}>
            <CheckCircle2 size={14} /> Segunda opinión ({verificacion.modelo}): sin observaciones de seguridad
            {revisionCaducada ? ' — sobre la versión anterior.' : '.'}
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

      {/* Preguntar a la evidencia sobre ESTE paciente (abre el Consultor con contexto).
          Se abre en OTRA PESTAÑA a propósito: así la consulta NO se desmonta y la nota
          en progreso queda intacta; el médico va y viene entre la consulta y el
          consultor sin perder nada ni tener que empezar de nuevo. */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || resumen) && (
        <button
          onClick={() => window.open(`/consultor?paciente=${patientId}`, '_blank', 'noopener')}
          title="Se abre en otra pestaña para que no pierdas tu nota en progreso"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, marginRight: 8, background: 'rgba(61,90,254,0.08)', color: 'var(--nexus)', border: '1px solid rgba(61,90,254,0.30)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FlaskConical size={14} /> Preguntar a la evidencia (chat) ↗
        </button>
      )}


      {/* ── Análisis basado en evidencia (PubMed) ── */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || resumen) && !evidencia && (
        <button onClick={analizarEvidencia} disabled={analizandoEv}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, background: 'color-mix(in srgb, var(--nexus) 10%, transparent)', color: 'var(--teal)', border: '1px solid color-mix(in srgb, var(--nexus) 35%, transparent)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: analizandoEv ? 'default' : 'pointer' }}>
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
          <div style={{ marginBottom: 12, border: '1px solid color-mix(in srgb, var(--nexus) 35%, transparent)', borderRadius: 12, padding: 14, background: 'color-mix(in srgb, var(--nexus) 5%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>
              <FlaskConical size={15} /> Análisis basado en evidencia
              <button onClick={agregarAnalisisANota} disabled={generandoAnalisis} style={{ marginLeft: 'auto', background: generandoAnalisis ? 'var(--s3)' : 'var(--nexus-solido)', color: generandoAnalisis ? 'var(--text3)' : '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: generandoAnalisis ? 'default' : 'pointer' }}>
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

      {/*
        CONTRADICCIÓN DICTADO ↔ NOTA.
        Va con las alertas clínicas y no como una nota al pie: un antecedente
        crónico que el paciente negó y la nota afirma es un error de expediente,
        no de redacción.
      */}
      {/*
        DOSIS INCOMPLETA — antes de firmar, no al imprimir.
        En rojo porque `revisarUnidadDosis` la marca de severidad ALTA: una
        receta sin cantidad no se puede surtir, y «100» sin unidad se lee como
        100 mg — mil veces la dosis en lo que va en microgramos.

        Desde el 5-ago-2026, por decisión del médico dueño, la FALTA DE DOSIS
        además BLOQUEA la firma (la compuerta vive en `firmar()`). La falta de
        unidad sigue avisando sin bloquear: él pidió bloquear cuando falta la
        dosis, y ampliarlo por mi cuenta sería decidir por él.
      */}
      {/*
        ── UNA BARRA, TRES RENGLONES (5-ago-2026, REG-181) ────────────────────

        Aquí vivían SIETE bloques de aviso, uno debajo de otro. El Dr. mandó la
        captura: ocho recuadros sobre su nota, ~40 elementos, y sólo uno le
        impedía firmar. Tres eran rojos y dos de los tres no bloqueaban nada.

        Ninguno desapareció: se clasifican en `avisos-consulta.ts` —módulo puro,
        con la tabla de niveles a la vista— y se pintan en un solo sitio, por
        gravedad real. Lo que bloquea queda MÁS visible que antes; lo que puede
        matar hoy (alergia ↔ medicamento) no se pliega nunca.
      */}
      {(() => {
        const alergiasPaciente = alergiasDe(patient ?? {})
        const avisos = construirAvisos({
          dosisIncompletas: dosisIncompletas.map(d => ({ med: d.med, mensaje: d.aviso.mensaje, procedencia: d.procedencia })),
          alergiaMedicamento: validarAlergiasVsMedicamentos(alergiasPaciente, medicamentos)
            .map(a => ({ mensaje: `[${a.severidad.toUpperCase()}] ${a.mensaje}`, severidad: a.severidad })),
          contradicciones: contradiccionesNota.map(c => ({ condicion: c.condicion, mensaje: avisoDeContradiccion(c) })),
          desajustes: desajustesNota.map(d => ({ condicion: d.condicion, mensaje: avisoDeDesajuste(d) })),
          viasAsumidas,
          avisoDeVia: avisoDeViaAsumida(viasAsumidas),
          interacciones: detectarInteracciones(medicamentos),
          controlados: detectarControlados(medicamentos),
          /**
           * ── LA SOBREDOSIS SE VE ANTES DE FIRMAR (REG-190) ─────────────────
           * El motor `revisarDosis` —sobredosis, techos por vía y edad, error
           * de decimal— tenía UN solo llamador: la pantalla de la receta, que
           * se abre desde una nota YA FIRMADA. Cazaba «500 donde iban 50»
           * cuando el paciente ya se había ido con la receta en la mano.
           */
          dosisPeligrosas: dosisPeligrosasDeLaLista(medicamentos, {
            edadAnios: patient?.edad ?? undefined,
            pesoKg: signosNum.peso ?? undefined,
          }).map(d => ({
            med: d.med,
            mensaje: d.alertas.map(a => a.mensaje).join(' · '),
            critica: d.severidad === 'critica',
          })),
          /**
           * «14 editas» y «24 tras», de una nota YA FIRMADA suya (REG-238).
           * Va aquí y NO en `avisosParaFirmar`: es de prescripción, se ve
           * mientras receta.
           */
          pautas: medicamentos,
          antecedentesDeFamiliar,
          datosInciertos,
          sinRespaldo,
          conflictos: (safety as { conflicts_detected?: string[] } | undefined)?.conflicts_detected ?? [],
          faltantesCriticos: (safety as { missing_critical_fields?: string[] } | undefined)?.missing_critical_fields ?? [],
          /** Lo que NOM-004 ya bloquea no necesita un tercer sitio donde decirse. */
          yaLoBloqueaNOM004: validacion?.errores ?? [],
        })
        const extraidos = firmada ? 0 : aprobados.size
        /**
         * ── LA BARRA SÓLO LLEVA LO QUE CAMBIA LA RECETA (I-7) ───────────────
         *
         * Su queja, repetida: «los avisos rojos me tapan la nota desde el
         * principio». Y es literal: la barra se pinta por ENCIMA de los signos
         * vitales, las secciones, los diagnósticos y los medicamentos. Lo
         * primero que ve al abrir es la lista de lo que está mal en una nota
         * que todavía no ha dictado.
         *
         * Pero no se mueve entera al final. Los cinco de PRESCRIPCIÓN —alergia
         * ↔ fármaco, sobredosis, dosis incompleta, interacción, vía— tienen que
         * llegar mientras receta: después de firmar, la receta ya se imprimió.
         * Llevarlos al final es REG-173 y REG-190 otra vez.
         *
         * Los de REVISIÓN DEL TEXTO —contradicción, dato incierto, antecedente
         * del familiar, requisito NOM— no cambian lo que se le da al paciente:
         * cambian lo que se lee antes de firmar. Y ése es su momento.
         *
         * Se sigue montando UN solo panel, con menos dentro.
         */
        return (
          <AntesDeFirmar
            avisos={mientrasReceta(avisos)}
            extraidos={extraidos}
            soloLectura={firmada}
            onIr={() => {
              /* El ancla es el NOMBRE, nunca el índice: la lista se reordena. */
              document.getElementById('seccion-medicamentos')?.scrollIntoView({ behavior: comportamientoScroll(), block: 'center' })
            }}
            onRevisado={id => {
              const [tipo, ...resto] = id.split(':')
              const clave = resto.join(':')
              if (tipo === 'via') clave.split('|').forEach(n => marcarRevisado('via', n))
              else marcarRevisado(tipo, clave)
            }}
          >
            {(extraction || safety) && !firmada && (
              <RevisionPanel
                sinMarco
                extraction={extraction as ComponentProps<typeof RevisionPanel>['extraction']}
                safety={safety as ComponentProps<typeof RevisionPanel>['safety']}
                aprobados={aprobados}
                onAprobar={id => setAprobados(prev => new Set(prev).add(id))}
                /**
                 * ── «QUITAR» AHORA QUITA DE VERDAD (6-ago-2026, REG-198) ──────
                 *
                 * Antes esto sólo sacaba el id de `aprobados`, que se guarda
                 * como metadato de auditoría y nada más: ni una línea de la nota
                 * cambiaba. El médico veía un diagnóstico mal extraído, pulsaba
                 * «Quitar de la nota», el renglón se tachaba en pantalla… y el
                 * diagnóstico seguía en la nota que firmaba.
                 *
                 * Se guarda un punto de deshacer, como en REG-195: quitar un
                 * dato clínico no puede ser irreversible por un clic.
                 */
                onRechazar={id => {
                  setAprobados(prev => { const n = new Set(prev); n.delete(id); return n })
                  if (!sePuedeQuitar(id)) return
                  setSnapshotUndo({ resumen, secciones, diagnosticos, medicamentos, signos })
                  const nuevo = quitarDeLaNota({ resumen, secciones, diagnosticos, medicamentos, signos }, id)
                  setResumen(nuevo.resumen); setSecciones(nuevo.secciones)
                  setDiagnosticos(nuevo.diagnosticos); setMedicamentos(nuevo.medicamentos)
                  setSignos(nuevo.signos)
                  toast('Quitado de la nota. Puedes deshacerlo con «Deshacer».', 'info')
                }}
              />
            )}
          </AntesDeFirmar>
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

      {/* El panel de revisión ya no va suelto: vive plegado dentro de la barra. */}

      {/* Sello de procedencia: de dónde salió CADA dato de la nota (dictado con
          cita / inferencia de IA / a mano). Medicolegal, solo lectura. Se muestra
          también en la nota firmada — es parte del registro. */}
      {/*
        LA CONDICIÓN MIRA LO QUE EL SELLO VA A CONTAR, no dos familias de seis.

        Estaba atada a diagnósticos y medicamentos, así que una nota que sólo
        trae texto redactado —la de evolución que no cambia el plan— no
        enseñaba sello ninguno, aunque el que se archiva al firmar sí contara
        sus párrafos. El propio componente ya se calla cuando no hay nada que
        contar (`resumen.total === 0`); aquí basta con no adelantarse a él.
      */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || secciones.some(s => s.value?.trim()) || resumen.trim()) && (
        <SelloProcedencia
          final={notaDelSello}
          extraction={extraction}
          aprobados={aprobados}
          transcripcion={voz.transcripcion}
        />
      )}

      {/*
        CÓMO CERRAR LA CONSULTA (REG-244) — sólo si quedó más de una cosa por
        hacer. Con un solo destino se navegó directo y esto no aparece.

        V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20): `alIr` ya no hace
        SIEMPRE `router.push`. Un paso con `ruta` que empieza con `#` vive
        en esta misma pantalla (hoy, sólo «hoja_del_paciente») y se resuelve
        desplazándose hasta él — sin eso el botón navegaba a una URL con un
        `#` pegado, que Next.js no sabe interpretar como ancla dentro de la
        misma ruta cliente. Los pasos que SÍ navegan (receta/orden) se
        marcan `hecho` ANTES de salir: al volver — con `router.back()` de
        `useSmartBack`, que reusa la entrada de historial — el checklist ya
        no repite lo que el médico acaba de hacer.
      */}
      {firmada && (
        <ComoCerrarLaConsulta
          pasos={queFaltaParaCerrar({
            patientId,
            /**
             * `notaId` de ESTADO, no el ref: leer un ref durante el render es
             * lo que marca el compilador de React, y aquí no hace falta —
             * `setNotaId` acompaña a cada asignación del ref, así que el estado
             * ya tiene el mismo valor cuando la nota está firmada.
             */
            notaId,
            hayMedicamentos: medicamentos.length > 0,
            hayEstudios: estudiosOrden.length > 0,
            pideCobro: config?.pedirCobroAlCerrar === true,
            internamientoActivo,
            /**
             * NOTE → FOLLOW-UP (V15, Fase 8): la fecha que el médico puso en
             * «Próxima consulta». Sólo vive en estado de React — la nota no
             * guarda este campo (va al paciente y a la tarea del worklist),
             * así que al REABRIR una nota firmada el paso no reaparece; ahí
             * quien lo recuerda es la tarea derivada al firmar.
             */
            proximoSeguimiento,
          })}
          hechos={hechosCierre}
          alIr={r => {
            if (r.startsWith('#')) {
              document.getElementById(r.slice(1))?.scrollIntoView({ behavior: comportamientoScroll(), block: 'start' })
              return
            }
            if (r.startsWith('/receta')) setHechosCierre(marcarHechoDeCierre(notaId, 'receta'))
            else if (r.startsWith('/orden')) setHechosCierre(marcarHechoDeCierre(notaId, 'orden'))
            else if (r.startsWith('/citas')) setHechosCierre(marcarHechoDeCierre(notaId, 'seguimiento'))
            router.push(r)
          }}
        />
      )}

      {/*
        QUÉ ES DE QUÉ (REG-243) — el plan atado al problema que lo motivó, y
        atado SÓLO donde él lo dijo. Lo que no consta se ve sin asignar: un
        hueco visible es información, un vínculo inventado es un error que se
        lee como un acierto.
      */}
      <PlanPorProblema
        diagnosticos={diagnosticos.map(d => d.descripcion)}
        medicamentos={medicamentos}
        dictado={voz.transcripcion}
      />

      {/*
        LO QUE SE LLEVA EL PACIENTE (REG-242) — Suki y Nabla lo tienen y aquí no
        existía. Se COMPONE de lo que él ya revisó; no lo redacta un modelo, que
        es donde se colaría un consejo que nadie firmó.
      */}
      {/*
        NO en un paciente INTERNADO: no se lleva nada a casa hoy, y una hoja de
        «cómo tomarlo» sobre fármacos intravenosos de UCI confunde en vez de
        ayudar. La nota de hospital y la de UCI se escriben en esta misma
        pantalla (`/consulta/[id]?internamiento=…`), así que sin este guardia
        aparecería ahí también.
      */}
      {!esNotaHospital && (
        <HojaParaElPaciente
          medicamentos={medicamentos}
          estudios={estudiosOrden}
          /**
           * El motor (`comoSeLoExplico`) tiene el bloque «Su próxima cita»
           * desde REG-242 y esta pantalla siempre le pasó `undefined` — el
           * dato existía dos pantallas más arriba, en «Próxima consulta»
           * (`proximoSeguimiento`), y nunca llegaba («escrito y sin
           * conectar»). En la hoja va en palabras, no en ISO: el paciente lee
           * «lunes, 8 de septiembre», no «2026-09-08».
           */
          proximaCita={proximoSeguimiento.trim() ? formatDateMX(proximoSeguimiento) : undefined}
          onInteraccion={() => setHechosCierre(marcarHechoDeCierre(notaId, 'hoja_del_paciente'))}
        />
      )}

      {/*
        ¿DE DÓNDE SALIÓ ESTO? — cada frase de la nota junto al trozo de dictado
        que la sostiene. El motor (`rastrearNota`) existía con corpus oro y la
        pantalla sólo usaba su mitad negativa. Es el mecanismo que en el mercado
        sólo tiene Abridge, y que Nabla no puede tener porque borra el audio.
      */}
      <DeDondeSalioEsto
        nota={textoDeLaNota(resumen, diagnosticos, secciones)}
        dictado={voz.transcripcion}
        /*
          ESCUCHAR EL MOMENTO (REG-250). Los turnos traen el `inicioMs` de cada
          palabra; la ruta del audio la devuelve el grabador desde REG-249.

          La URL se resuelve AL PULSAR, no aquí: es cuando las reglas de Storage
          se evalúan otra vez con quien esté mirando. Y se importa `firebase/
          storage` de forma perezosa para no cargarlo en las consultas que
          nunca pulsan.
        */
        utterances={audio.utterances}
        audioPath={audio.audioPath}
        resolverUrlDeAudio={async (path: string) => {
          const { getStorage, ref, getDownloadURL } = await import('firebase/storage')
          return getDownloadURL(ref(getStorage(), path))
        }}
      />

      {/* Historial de versiones: la vía de rescate si dos pestañas se pisaron. */}
      {!firmada && clinicId && (
        <HistorialVersiones
          clinicId={clinicId}
          patientId={patientId}
          notaId={notaIdRef.current ?? notaId}
          onRestaurar={v => {
            if (v.tipo) setTipo(v.tipo)
            if (Array.isArray(v.secciones)) setSecciones(v.secciones)
            if (typeof v.resumenEjecutivo === 'string') setResumen(v.resumenEjecutivo)
            if (v.signosVitales) setSignos(v.signosVitales)
            if (Array.isArray(v.diagnosticos)) setDiagnosticos(v.diagnosticos)
            if (Array.isArray(v.medicamentos)) setMedicamentos(v.medicamentos)
            if (typeof v.transcripcionCruda === 'string') voz.setTranscripcion(v.transcripcionCruda)
          }}
        />
      )}

      {errorCargaNota && (
        <div className="no-print" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
          borderRadius: 12, padding: '13px 15px', marginBottom: 14,
        }}>
          <AlertTriangle size={17} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
            <strong>No se pudo abrir esta nota.</strong> {errorCargaNota}
          </div>
        </div>
      )}

      {/* ── Ya está el texto con las voces separadas, pero el médico ya escribió ── */}
      {ofreceReproyectar && !firmada && (
        <div className="no-print" style={{
          display: 'flex', alignItems: 'flex-start', gap: 11, flexWrap: 'wrap',
          background: 'rgba(61,90,254,0.07)', border: '1px solid rgba(61,90,254,0.3)',
          borderRadius: 12, padding: '13px 15px', marginBottom: 14,
        }}>
          <Sparkles size={17} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: '1 1 300px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
            <strong>Ya quedó la transcripción con las voces separadas.</strong> Es mejor material que
            el del dictado en vivo con el que se armó esta nota. Puedes re-estructurarla desde ahí,
            pero <strong>se reemplaza lo que escribiste</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => { setOfreceReproyectar(false); edicionManualRef.current = false; procesarIA() }}
            >
              Re-estructurar
            </button>
            <button className="btn btn-sm" onClick={() => setOfreceReproyectar(false)}>
              Dejar mi versión
            </button>
          </div>
        </div>
      )}

      {/* ── Sugerencias de la IA pendientes de que el médico las avale ── */}
      {!firmada && sugerenciasPendientes(secciones) > 0 && (() => {
        const n = sugerenciasPendientes(secciones)
        return (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, flexWrap: 'wrap',
            background: 'color-mix(in srgb, var(--amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
            borderRadius: 12, padding: '13px 15px', marginBottom: 14,
          }}>
            <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
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
                style={{ background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(90px, 100%), 1fr))', gap: 10 }}>
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
          onSinDatos={() => toast('Captura al menos una escala antes de aplicar (no se tocó la nota).', 'info')}
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
          {/* El título del Section es visual, no está asociado: sin aria-label el
              lector de pantalla dice «edición de texto» a secas (axe: label, critical). */}
          <textarea
            aria-label={s.label}
            value={s.value}
            onChange={e => {
              // Se anota que el médico ESCRIBIÓ. Lo usa la re-proyección con voces
              // separadas para no pisar su texto sin preguntar (ver `edicionManualRef`).
              edicionManualRef.current = true
              setSecciones(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))
            }}
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
            {!firmada && (
              <button
                onClick={() => setDiagnosticos(prev => prev.filter((_, j) => j !== i))}
                style={S.del}
                aria-label={`Quitar diagnóstico${d.descripcion ? `: ${d.descripcion}` : ''}`}
              ><Trash2 size={14} /></button>
            )}
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
      <Section id="seccion-medicamentos" title="Medicamentos / Plan farmacológico" icon={<Pill size={15} />}>
        {medicamentos.map((m, i) => (
          <div key={i} style={{ ...S.row, flexWrap: 'wrap' }}>
            <input value={m.nombre} disabled={firmada} placeholder="Medicamento"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
              style={{ ...S.input, flex: 2, minWidth: 120 }} />
            <input value={m.dosis} disabled={firmada} placeholder="Dosis"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, dosis: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 70 }} />
            {/*
              «NO LA SABE» — la salida honesta cuando el paciente no conoce la dosis.
              Decisión del médico dueño (5-ago-2026) tras medir que la compuerta de
              firma bloqueaba la MITAD de sus notas: y lo que bloqueaba no eran
              descuidos, sino medicación previa que el paciente refiere sin saber
              cuánto toma. Sin esta salida habría que inventarse una dosis.
              Sólo aparece si el renglón tiene nombre y le falta la dosis: no
              estorba en el caso normal, que es teclear la cantidad.
            */}
            {!firmada && m.nombre?.trim() && !m.dosis?.trim() && (
              <button
                type="button"
                onClick={() => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, dosis: DOSIS_DESCONOCIDA } : x))}
                title="El paciente lo toma pero no sabe la dosis. Se registra así, y se imprime."
                style={{ ...S.input, flex: '0 0 auto', cursor: 'pointer', fontSize: 12, padding: '0 10px', whiteSpace: 'nowrap' }}
              >No la sabe</button>
            )}
            {/*
              VÍA: no existía control para cambiarla y se creaba fija en 'oral'.
              La receta SÍ la imprime, así que una ceftriaxona IV salía impresa
              como "oral". La plantilla de la nota pide explícitamente
              "fármaco · dosis · VÍA · intervalo · duración": el sistema sabía que
              importa, pero no dejaba capturarla.
            */}
            <select value={m.via ?? 'oral'} disabled={firmada} aria-label={`Vía de administración${m.nombre ? ` de ${m.nombre}` : ''}`}
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, via: e.target.value as Medicamento['via'] } : x))}
              style={{ ...S.input, flex: 1, minWidth: 92 }}>
              <option value="oral">Oral</option>
              <option value="iv">IV</option>
              <option value="im">IM</option>
              <option value="sc">SC</option>
              <option value="sublingual">Sublingual</option>
              <option value="inhalatoria">Inhalada</option>
              <option value="topica">Tópica</option>
              <option value="rectal">Rectal</option>
              <option value="otra">Otra</option>
            </select>
            <input value={m.frecuencia} disabled={firmada} placeholder="Frecuencia"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, frecuencia: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 90 }} />
            <input value={m.duracion} disabled={firmada} placeholder="Duración"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, duracion: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 80 }} />
            {!firmada && (
              <button
                onClick={() => setMedicamentos(prev => prev.filter((_, j) => j !== i))}
                style={S.del}
                aria-label={`Quitar medicamento${m.nombre ? `: ${m.nombre}` : ''}`}
              ><Trash2 size={14} /></button>
            )}
          </div>
        ))}
        {!firmada && (
          <button onClick={() => setMedicamentos(prev => [...prev, { nombre: '', dosis: '', via: 'oral', frecuencia: '', duracion: '' }])} style={S.addBtn}>
            <Plus size={13} /> Agregar medicamento
          </button>
        )}
      </Section>

      {/*
        ── COPILOTO, JUNTO A LO QUE YA SE CAPTURÓ (§8.8, 11-ago-2026) ─────────
        Vivía arriba, antes de Secciones narrativas/Diagnósticos/Medicamentos:
        el médico leía «para este paciente…» y las alertas de dosis/alergia/
        renal ANTES de que los diagnósticos y medicamentos que las disparan
        existieran siquiera en la pantalla — la inteligencia contextual del
        §8.8 quedaba desconectada de los hechos que interpretaba, no "al lado".
        `entradaCopiloto` (el useMemo de arriba) no cambió: sigue leyendo el
        MISMO diagnosticos/medicamentos/signos que ya lee Diagnósticos/
        Medicamentos abajo — sólo se movió DÓNDE se pinta, no lo que calcula.
        Aquí, justo después de que el médico terminó de capturar Secciones
        narrativas + Diagnósticos + Medicamentos y justo antes de firmar, el
        Copiloto reacciona a lo que quedó fijado — no a un adelanto de lo que
        todavía no se ha escrito.
      */}
      <Copiloto
        entrada={entradaCopiloto}
        onAgregarANota={agregarASeccion('copiloto', 'Valoración asistida')}
        prefs={prefsIA}
        onAceptar={(cat) => {
          const uid = auth.currentUser?.uid
          if (clinicId && uid) registrarAceptacion(clinicId, uid, cat)
          // eco optimista: reordena en caliente sin re-leer Firestore
          setPrefsIA(p => ({ ...p, [cat]: (p[cat] ?? 0) + 1 }))
        }}
      />

      {/* Clinical Reasoning Engine VISIBLE: cómo llegó el copiloto a sus sugerencias
          — los 12 pasos, cada uno con su ORIGEN (regla/IA/PubMed) y su CONFIANZA.
          Es el diferenciador: el razonamiento deja de ser una caja negra. */}
      {(diagnosticos.length > 0 || medicamentos.length > 0 || resumen || Object.keys(signosNum).length > 0) && (
        <details style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1, rgba(127,127,127,0.04))' }}>
          <summary style={{ cursor: 'pointer', padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
            <Brain size={15} style={{ color: 'var(--nexus)' }} /> Cómo razoné este caso · 12 pasos con fuente y confianza
          </summary>
          <div style={{ padding: '0 14px 14px' }}>
            <PanelRazonamiento entrada={entradaCopiloto} embebido />
          </div>
        </details>
      )}

      {/*
        ── HERRAMIENTAS CLÍNICAS, DESPUÉS DE LA NOTA (V15-ITERATION16, 15-ago) ──

        Vivían aquí arriba, en el hueco que hay entre el grabador y la nota. La
        medición corregida de §29 —la que entra por el encuentro SIN FIRMAR, que
        es donde el grabador existe— las encontró en `y=635` de escritorio y
        `y=740` de móvil: el SEGUNDO bloque del encuentro, por delante de los
        signos, de las secciones narrativas, de los diagnósticos y de los
        medicamentos. Un catálogo de cinco módulos con su propio buscador,
        ocupando el sitio inmediatamente posterior al instrumento principal.

        Eso es exactamente lo que §29 llama inventario de módulos: la pantalla
        ofrecía OTRAS capacidades antes de ofrecer ESTE encuentro.

        No se quita ninguna herramienta ni se esconde detrás de un botón mágico:
        se mueve DÓNDE se pinta, igual que el Copiloto en §8.8 y por el mismo
        motivo. Aquí abajo el médico ya capturó, ya vio lo que el copiloto
        razonó sobre lo capturado, y sólo entonces se le ofrece abrir un
        instrumento — que es cuando sabe si le hace falta.

        El buscador de `Herramientas` sigue siendo el que alcanza a las ocultas
        por especialidad: no se toca su contrato.
      */}
      <Herramientas {...(() => {
        const TODAS = [
        ...(esCasoQuirurgico ? [{
          id: 'cirugia', nombre: 'Cirugía', color: 'var(--blue)', icono: <Scissors size={14} />,
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
          id: 'pediatria', nombre: 'Pediatría', color: 'var(--purple)', icono: <Baby size={14} />,
          para: 'Dosis por peso con tope de adulto · vacunación',
          aviso: vacunasAtrasadas > 0
            ? { texto: `${vacunasAtrasadas} vacuna${vacunasAtrasadas > 1 ? 's' : ''} atrasada${vacunasAtrasadas > 1 ? 's' : ''}`, urgente: true }
            : undefined,
          abrirPorDefecto: vacunasAtrasadas > 0,
          contenido: <PanelPediatria embebido edadAnios={patient?.edad} sexo={patient?.sexo}
            fechaNacimiento={patient?.fechaNacimiento} pesoInicial={signosNum.peso}
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
          id: 'cardiometabolico', nombre: 'Cardiometabólico', color: 'var(--green)', icono: <HeartPulse size={14} />,
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
          id: 'antibiograma', nombre: 'Antibiograma', color: 'var(--amber)', icono: <FlaskConical size={14} />,
          para: 'Interpretar un cultivo: fenotipo, mecanismo de resistencia y terapia dirigida',
          contenido: <AntibiogramaTool embebido onAgregarANota={agregarASeccion('antibiograma', 'Antibiograma e interpretación')} />,
        },
        {
          id: 'fotos', nombre: 'Fotografía clínica', color: 'var(--teal)', icono: <Camera size={14} />,
          para: 'Tomar foto de esta consulta (la serie está en el expediente)',
          contenido: clinicId
            ? <FotosClinicas embebido modo="captura" clinicId={clinicId} patientId={patientId} notaId={notaId ?? undefined} />
            : <p style={{ fontSize: 12, color: 'var(--text3)' }}>Cargando…</p>,
        },
        {
          id: 'laboratorios', nombre: 'Laboratorios', color: 'var(--teal)', icono: <FlaskConical size={14} />,
          para: 'Adjunta un PDF o foto → la IA lo interpreta → gráficas de tendencia',
          contenido: clinicId
            ? <PanelLaboratorios clinicId={clinicId} patientId={patientId}
                onAgregarANota={agregarASeccion('laboratorios', 'Laboratorios')} />
            : <p style={{ fontSize: 12, color: 'var(--text3)' }}>Cargando…</p>,
        },
        ]

        /**
         * FILTRADO POR ESPECIALIDAD.
         *
         * Un internista no atiende partos ni calcula dosis por peso pediátrico,
         * pero tenía esas herramientas ocupando espacio en cada consulta: hay que
         * leerlas para descartarlas, en cada paciente. Ahora se muestran las de su
         * especialidad y el resto queda en el buscador — no desaparece ninguna.
         *
         * Solo `esCasoQuirurgico` se fuerza, y a propósito: es una señal CLÍNICA
         * —el diagnóstico dictado es una hernia, o el tipo de nota es
         * preoperatoria— así que el panel de cirugía aparece aunque el médico sea
         * internista. El contexto del paciente pesa más que la configuración.
         *
         * `esGineco` NO se fuerza: solo comprueba que la paciente sea mujer, que
         * es un filtro de pertinencia, no una señal de que haga falta la
         * herramienta. Si se forzara, un internista volvería a ver el panel de
         * gineco en cada paciente mujer — justo lo que se quiere evitar. Sigue
         * disponible en el buscador.
         */
        const forzadas = esCasoQuirurgico ? ['cirugia'] : []
        const visibles = filtrarHerramientas(TODAS, especialidadEfectiva, forzadas)
        const idsVisibles = new Set(visibles.map(h => h.id))
        return { items: visibles, ocultas: TODAS.filter(h => !idsVisibles.has(h.id)) }
      })()} />

      {/* ── Validación + Acciones ── */}
      {!firmada && (
        <>
          {/* ── Chat de corrección por IA ── */}
          {!firmada && (
            <div style={{ marginTop: 18, border: '1px solid rgba(61,90,254,0.35)', borderRadius: 12, background: 'rgba(61,90,254,0.05)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                <Sparkles size={15} style={{ color: 'var(--nexus)' }} /> Corregir por chat
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, marginBottom: 10 }}>
                Escribe qué está mal y lo corrijo al instante, sin tocar lo demás. Ej: “la dosis de amoxicilina es 500 mg”, “quita la diabetes”, “el Dx correcto es apendicitis”.
              </div>
              {chatCorr.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                  {chatCorr.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', fontSize: 12.5, padding: '7px 11px', borderRadius: 10, background: m.rol === 'user' ? 'var(--nexus-solido)' : 'var(--s2)', color: m.rol === 'user' ? '#fff' : 'var(--text)' }}>
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
                <button onClick={corregirConIA} disabled={corrigiendo || !instruccionCorr.trim()} style={{ background: (corrigiendo || !instruccionCorr.trim()) ? 'var(--s3)' : 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: (corrigiendo || !instruccionCorr.trim()) ? 'default' : 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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

          {/*
            EL ÚNICO ERROR QUE SE ARREGLA AQUÍ MISMO.
            ────────────────────────────────────────────────────────────────────
            La cédula profesional nace vacía (`DEFAULT_CONFIG`) y el alta no la
            pide, así que TODO médico nuevo llegaba a su primera nota con el
            botón de Firmar apagado y un renglón rojo que no dice a dónde ir. Con
            un paciente enfrente, eso es abandonar la app.

            Es además el único error de la lista que no es clínico: los demás
            —falta un diagnóstico, falta una sección— se arreglan escribiendo la
            nota, que es lo que el médico está haciendo. Éste se arregla con un
            dato administrativo que sólo hay que teclear una vez en la vida.

            Se resuelve donde aparece. Nada de mandarlo a Configuración a buscar.
          */}
          {faltaCedula && (
            <div style={{ ...S.valBox('error'), display: 'block' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Tu cédula profesional, una sola vez</div>
              <div style={{ marginBottom: 10, lineHeight: 1.5 }}>
                La nota la exige la NOM-004. Escríbela aquí y queda guardada para siempre — no te la vuelvo a pedir.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={cedulaRapida}
                  onChange={e => setCedulaRapida(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void guardarCedulaRapida() }}
                  placeholder="Ej. 1234567"
                  inputMode="numeric"
                  aria-label="Cédula profesional"
                  style={{ flex: '1 1 180px', minWidth: 140, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--text)' }}
                />
                <button
                  onClick={() => void guardarCedulaRapida()}
                  disabled={!cedulaRapida.trim() || guardandoCedula}
                  style={{ background: (!cedulaRapida.trim() || guardandoCedula) ? 'var(--s3)' : 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: (!cedulaRapida.trim() || guardandoCedula) ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {guardandoCedula ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : 'Guardar y seguir'}
                </button>
              </div>
            </div>
          )}
          {validacion.advertencias.length > 0 && (
            <div style={S.valBox('warn')}>
              {validacion.advertencias.map((a, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} className="ds-icon" /> {a}</div>)}
            </div>
          )}
          {/*
            PRÓXIMA CONSULTA — el dato que dos pantallas llevaban esperando.
            El motor de tareas sabía derivar «agendar el seguimiento» desde que
            se escribió, y el CRM cuenta los «seguimientos vencidos»… sobre un
            campo que no llenaba NADIE: la tarea no nacía nunca y el contador era
            cero permanente.
            Opcional a propósito: si no pones fecha, no se inventa ninguna.
          */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <label htmlFor="proximo-seguimiento" style={{ fontSize: 13, color: 'var(--text2)' }}>
              Próxima consulta <span style={{ color: 'var(--text3)' }}>(opcional)</span>
            </label>
            <input
              id="proximo-seguimiento"
              type="date"
              className="input"
              value={proximoSeguimiento}
              disabled={firmada}
              onChange={e => setProximoSeguimiento(e.target.value)}
              style={{ width: 170 }}
            />
            {proximoSeguimiento && (
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                Al firmar queda una tarea para agendarla y el paciente entra en los seguimientos del CRM.
              </span>
            )}
          </div>

          {/*
            UNA ACCIÓN DOMINA AL CERRAR (V15-ENCOUNTER-MODE-001, §8.6).
            ────────────────────────────────────────────────────────────────
            Antes las cuatro acciones vivían en una sola fila del mismo alto;
            sólo el color las distinguía. Ahora Firmar tiene su propia fila,
            más grande y con sombra — y Guardar/Leer resumen/Descartar bajan a
            una segunda fila de acciones de apoyo, sin caja ni borde (regla de
            jerarquía: posición → tipografía → espacio → agrupación → énfasis,
            antes que cajas). Ningún onClick, disabled ni motivo cambió: es
            reordenar el peso visual de lo que ya existía, no lógica nueva.
          */}
          <div
            /**
             * `id` + `tabIndex={-1}`: el ancla a la que viaja `CierreAlPulgar`
             * (V15-MOBILE-001, §22). El tabIndex negativo permite mover el
             * FOCO aquí al aterrizar — teclado y lector de pantalla llegan a
             * donde llegó la vista — sin meter el contenedor al orden de
             * tabulación normal.
             */
            id="cierre-de-la-consulta"
            tabIndex={-1}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, outline: 'none' }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/*
                ── EL BOTÓN DICE POR QUÉ ESTÁ APAGADO (6-ago-2026, REG-189) ──
                Se apagaba sólo con NOM-004, así que con una dosis incompleta
                se veía ENCENDIDO: el médico lo pulsaba, salía un toast y no
                pasaba nada. Ahora la fuente es una sola —la misma que cuenta
                la barra— y el motivo viaja en el `title` y en el renglón de
                al lado. NO cambia la política: lo que impedía firmar ayer
                impide hoy.
              */}
              <button
                onClick={firmar}
                disabled={bloqueosDeFirma.length > 0 || guardando}
                title={motivoNoFirma || 'Firmar y cerrar la nota'}
                style={S.firmar(bloqueosDeFirma.length > 0 || guardando)}
              >
                <FileSignature size={17} /> Firmar y cerrar nota
              </button>
              {/*
                El motivo, DONDE ESTÁ EL DEDO. El mensaje ya existía y era
                inalcanzable: el del toast sólo salía al pulsar, y el de
                NOM-004 vive en un recuadro que queda fuera de pantalla cuando
                el médico está abajo, junto a los botones.
              */}
              {bloqueosDeFirma.length > 0 && !guardando && (
                <span role="status" style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.45, flexBasis: '100%' }}>
                  {motivoNoFirma}
                  {bloqueosDeFirma.length > 1 && (
                    <span style={{ opacity: 0.85 }}> · y {bloqueosDeFirma.length - 1} más arriba</span>
                  )}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => guardarBorrador()} disabled={guardando} style={S.guardar}>
                {guardando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Guardar borrador'}
              </button>
              <span aria-hidden="true" style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
              <button onClick={leerResumen} disabled={guardando} style={S.guardar} title="La IA te lee Dx, tratamiento y plan para confirmar antes de firmar">
                <Volume2 size={14} /> Leer resumen
              </button>
              <span aria-hidden="true" style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
              <button onClick={descartar} disabled={guardando} style={S.descartar}>
                <Trash2 size={14} /> Descartar
              </button>
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>Completitud: {validacion.puntajeCompletitud}%</span>
            </div>
          </div>
        </>
      )}

      {/*
        V15-MOBILE-001 (Fase 9, §22): el cierre, al alcance del pulgar. La
        radiografía móvil midió «Firmar» a ~2,900px de scroll a 390×844 — el
        trabajo «sign/close» existía pero el pulgar no llegaba. Esta barra NO
        firma (§19, acto consecuente con revisión explícita): sólo enseña el
        estado del cierre con las MISMAS fuentes que el botón real
        (`bloqueosDeFirma`/`motivoNoFirma`) y acerca el viaje. Va como última
        pieza en flujo a propósito: `position: sticky; bottom: 0` la pega al
        borde inferior de <main> durante todo el scroll del cuerpo de la nota.
      */}
      <CierreAlPulgar
        visible={cierreAlPulgarVisible({
          firmada,
          grabando: audio.estado === 'grabando' || audio.estado === 'pausado' || audio.estado === 'subiendo',
          hayContenido: hayContenidoDeNota,
        })}
        bloqueos={bloqueosDeFirma.length}
        motivo={motivoNoFirma}
        completitud={validacion.puntajeCompletitud}
        idDestino="cierre-de-la-consulta"
      />

      {/*
        DEJAR DE TOMAR ALGO TAMBIÉN SE ESCRIBE.
        El ciclo de vida de la orden existía en el modelo y no lo escribía nadie:
        sin esto, «Está tomando» era en realidad «todo lo que alguna vez apareció
        en una nota». El médico decide si se suspende o si terminó; el software
        sólo lo registra, con su motivo, en la nota que está firmando hoy.
      */}
      <Modal
        open={!!medPorCambiar}
        onClose={() => setMedPorCambiar(null)}
        title={medPorCambiar ? `${medPorCambiar.nombre} — ya no lo toma` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setMedPorCambiar(null)}>Cancelar</Button>
            <Button
              disabled={!medPorCambiar?.motivo.trim()}
              onClick={() => {
                if (!medPorCambiar?.motivo.trim()) return
                const { nombre, dosis, estado, motivo } = medPorCambiar
                setMedicamentos(prev => {
                  const clave = (x: string) => x.trim().toLowerCase()
                  const sinEse = prev.filter(m => clave(m.nombre ?? '') !== clave(nombre))
                  return [...sinEse, {
                    // Sin vía ni frecuencia: no se está prescribiendo nada, se
                    // está declarando que deja de tomarse. Inventar una vía aquí
                    // sería escribir en el expediente algo que nadie dijo.
                    nombre, dosis: dosis ?? '', via: 'otra', frecuencia: '', duracion: '',
                    estado, motivoEstado: motivo.trim(),
                  } as Medicamento]
                })
                toast(`${nombre}: quedará registrado como ${estado === 'suspendida' ? 'suspendido' : 'terminado'} al firmar`, 'success')
                setMedPorCambiar(null)
              }}
            >Registrar en la nota de hoy</Button>
          </>
        )}
      >
        <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 14px' }}>
          Esto <strong>no borra nada del pasado</strong>: se anota en la nota que está escribiendo ahora,
          y a partir de ella el fármaco deja de aparecer como vigente. Si vuelve a indicarlo más adelante,
          vuelve a contar.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([
            { v: 'suspendida' as const, etiqueta: 'Se suspende', ayuda: 'Deja de tomarlo, pero podría volver.' },
            { v: 'terminada' as const, etiqueta: 'Ya terminó', ayuda: 'Cumplió el tratamiento indicado.' },
          ]).map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMedPorCambiar(m => m ? { ...m, estado: o.v } : m)}
              style={{
                flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: medPorCambiar?.estado === o.v ? 'var(--s2)' : 'transparent',
                border: `1px solid ${medPorCambiar?.estado === o.v ? 'var(--teal)' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.etiqueta}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{o.ayuda}</div>
            </button>
          ))}
        </div>
        <label className="label" style={{ fontSize: 12.5 }}>Motivo</label>
        <input
          className="input"
          value={medPorCambiar?.motivo ?? ''}
          onChange={e => setMedPorCambiar(m => m ? { ...m, motivo: e.target.value } : m)}
          placeholder="Ej. cumplió los 7 días, reacción adversa, ya no lo necesita"
        />
        <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
          El motivo es obligatorio: sin él, dentro de seis meses nadie —usted incluido— sabrá por qué se quitó.
        </p>
      </Modal>

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
          estructurar la nota clínica con asistencia de IA. El audio se envía a un servicio de
          transcripción para generar el texto y se conserva temporalmente en este dispositivo por si la
          transcripción falla; el expediente guarda únicamente la transcripción de texto.
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
            citaId: citaDeHoy?.id,
            estadoActual: citaDeHoy?.estado,
            /**
             * MONTO SUGERIDO. El campo arrancaba vacío y había que teclearlo en
             * cada consulta, aunque el sistema conoce el precio: se lo dice al
             * paciente por WhatsApp y lo publica en internet. Se sugiere el
             * servicio que coincida con el tipo de cita, o el primero de la lista.
             */
            monto: montoSugerido,
          }}
          onClose={() => {
            setCobrar(false)
            /**
             * La MISMA cadena de ifs estaba duplicada aquí (REG-244). El
             * defecto también: con medicamentos y estudios, tras cobrar se iba
             * a la receta y la orden no se imprimía nunca.
             *
             * Ya no se pasa `pideCobro`: el cobro acaba de hacerse. Si queda
             * más de una cosa, no se navega y el panel de cierre —que sigue
             * montado en la consulta— enseña qué falta.
             */
            const destino = aDondeIrDirecto({
              patientId,
              notaId: notaId || notaIdRef.current,
              hayMedicamentos: medicamentos.length > 0,
              hayEstudios: estudiosOrden.length > 0,
              internamientoActivo,
            })
            if (destino) router.push(destino)
          }}
        />
      )}

      {/* Control flotante de grabación — visible desde cualquier parte (manos libres / celular) */}
      {(voz.grabando || audio.estado === 'grabando') && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 'calc(84px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 24px)',
          background: 'var(--s1)', border: '1px solid var(--border2, var(--border)',
          borderRadius: 'var(--r-pill)', padding: '8px 8px 8px 16px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
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
            style={{ borderRadius: 'var(--r-pill)', flexShrink: 0 }}
          >
            <Square size={13} fill="currentColor" /> Detener y generar nota
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--red) 50%, transparent); } 50% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--red) 0%, transparent); } }
        @media print { button, textarea:disabled { display: none; } }
      `}</style>
    </div>
  )
}

