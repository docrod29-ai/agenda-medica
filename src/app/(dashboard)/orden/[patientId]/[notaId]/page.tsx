'use client'
/**
 * Generador de órdenes médicas (laboratorios, imagen, procedimientos).
 *
 * Comparte el template visual con recetas pero pre-pobla con estudios sugeridos
 * según el contenido de la nota (signos vitales anormales, diagnósticos, etc.).
 */
import { useState, useEffect, useMemo } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { useDoctors } from '@/hooks/useDoctors'
import { alergiasParaImpreso } from '@/lib/seguridad/alergias'
import { logAudit } from '@/lib/expediente/audit-log'
import { auth } from '@/lib/firebase'
import { abrirPendientes } from '@/lib/tareas-clinicas/abrir'
import { tareasDeNota } from '@/lib/tareas-clinicas/derivar'
import { useToast } from '@/context/ToastContext'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { useFirmaProtegida } from '@/hooks/useFirmaProtegida'
import { entradaPorMedico, resolverIdMedico, overrideRecetaValido, firmaValida } from '@/lib/impreso-medico'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { getPatient } from '@/lib/firestore'
import type { NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { RecetaDocumento, dimensionesImpresion, contarPaginas, useRecetaPaperOrientado } from '@/components/RecetaDocumento'
import { RecetaPreviewWrapper } from '@/components/RecetaPreviewWrapper'
import { PAPER_SIZES } from '@/lib/receta-template'
import { descargarPaginasComoPDF } from '@/lib/pdf-download'
import { descargarRecetaWord } from '@/lib/receta-word'
import {
  ArrowLeft, Download, Loader2, Plus, Trash2, Printer, Settings, AlertCircle, ChevronDown, FileText, Check, Scissors,
  AlertTriangle,
} from 'lucide-react'
import { diagnosticoQueSeImprime } from '@/lib/expediente/problemas-activos'
import { Spinner } from '@/components/ui'
import { AvisoConfigNoCargada } from '@/components/AvisoConfigNoCargada'
import { TituloDeDocumentoClinico } from '@/components/TituloDeDocumentoClinico'

/** Sugerencias de estudios agrupadas por categoría (catálogo amplio por especialidad) */
const SUGERENCIAS: Record<string, string[]> = {
  'Laboratorio general': [
    'Biometría hemática completa',
    'Química sanguínea de 6 elementos',
    'Química sanguínea de 27 elementos',
    'Glucosa en ayuno',
    'Curva de tolerancia a la glucosa (CTOG)',
    'Hemoglobina glucosilada (HbA1c)',
    'Electrolitos séricos (Na, K, Cl)',
    'Electrolitos ampliados (Ca, Mg, P)',
    'Perfil de lípidos (colesterol, HDL, LDL, triglicéridos)',
    'Pruebas de función hepática',
    'Ácido úrico',
    'Proteína C reactiva (PCR)',
    'Velocidad de sedimentación globular (VSG)',
    'Procalcitonina',
    'Deshidrogenasa láctica (DHL)',
    'Examen general de orina (EGO)',
    'Proteínas totales y albúmina',
  ],
  'Hematología': [
    'Biometría hemática completa',
    'Frotis de sangre periférica',
    'Reticulocitos',
    'Grupo sanguíneo y Rh',
    'Coombs directo e indirecto',
    'Hierro sérico, ferritina, transferrina, % saturación',
    'Vitamina B12 y ácido fólico',
    'Haptoglobina',
    'Electroforesis de hemoglobina',
    'Electroforesis de proteínas séricas',
    'Inmunofijación en suero y orina',
    'Cadenas ligeras libres (kappa/lambda)',
    'Beta-2 microglobulina',
  ],
  'Coagulación': [
    'Tiempo de protrombina (TP) e INR',
    'Tiempo de tromboplastina parcial (TTPa)',
    'Fibrinógeno',
    'Dímero D',
    'Tiempo de trombina',
    'Anticoagulante lúpico',
    'Antitrombina III, proteína C, proteína S',
    'Agregometría plaquetaria',
  ],
  'Cardiología': [
    'Troponina I/T de alta sensibilidad',
    'CK-MB',
    'Péptido natriurético (BNP / NT-proBNP)',
    'Perfil de lípidos',
    'Electrocardiograma de 12 derivaciones',
    'Ecocardiograma transtorácico',
    'Ecocardiograma transesofágico',
    'Prueba de esfuerzo (ergometría)',
    'Holter de 24-48 horas',
    'MAPA (monitoreo ambulatorio de presión arterial)',
    'Angiotomografía coronaria',
    'Gammagrama de perfusión miocárdica',
    'Cateterismo cardiaco / coronariografía',
  ],
  'Endocrinología': [
    'TSH, T4 libre y T3',
    'Anticuerpos antitiroideos (anti-TPO, anti-tiroglobulina)',
    'Cortisol basal (AM/PM)',
    'ACTH',
    'Prueba de supresión con dexametasona',
    'Insulina en ayuno / HOMA-IR',
    'Péptido C',
    'Hemoglobina glucosilada (HbA1c)',
    'Prolactina',
    'Hormona de crecimiento / IGF-1',
    'Perfil hormonal (FSH, LH, estradiol, testosterona)',
    'PTH (paratohormona)',
    'Vitamina D (25-OH)',
    'Calcio, fósforo y fosfatasa alcalina',
    'Metanefrinas plasmáticas/urinarias',
    'Aldosterona y renina',
  ],
  'Nefrología': [
    'Creatinina sérica + TFG estimada',
    'Urea / BUN',
    'Cistatina C',
    'Examen general de orina',
    'Relación albúmina/creatinina en orina',
    'Relación proteína/creatinina en orina',
    'Proteinuria de 24 horas',
    'Depuración de creatinina (orina 24 h)',
    'Electrolitos séricos y urinarios',
    'Gasometría venosa/arterial',
    'Complemento C3 y C4',
    'Anticuerpos anti-MBG y ANCA',
    'Ultrasonido renal y de vías urinarias',
  ],
  'Reumatología / Inmunología': [
    'Factor reumatoide',
    'Anticuerpos anti-CCP (péptido citrulinado)',
    'Anticuerpos antinucleares (ANA)',
    'Anti-DNA de doble cadena',
    'Perfil ENA (Sm, RNP, Ro/SSA, La/SSB, Scl-70, Jo-1)',
    'Complemento C3, C4 y CH50',
    'ANCA (anti-PR3 / anti-MPO)',
    'Anticuerpos antifosfolípidos (anticardiolipina, anti-β2GP1)',
    'HLA-B27',
    'Inmunoglobulinas séricas (IgG, IgA, IgM, IgE)',
    'Subclases de IgG',
    'Crioglobulinas',
    'Enzima convertidora de angiotensina (ECA)',
    'Ácido úrico',
  ],
  'Gastroenterología / Hepatología': [
    'Pruebas de función hepática completas',
    'Bilirrubinas (total, directa, indirecta)',
    'Amilasa y lipasa',
    'Anticuerpos antimitocondriales / antimúsculo liso / anti-LKM',
    'Alfa-fetoproteína (AFP)',
    'Panel de hepatitis (HBsAg, anti-HBc, anti-HBs, anti-VHC)',
    'Anticuerpos anti-transglutaminasa (celiaquía)',
    'Calprotectina fecal',
    'Sangre oculta en heces',
    'Coproparasitoscópico en serie',
    'Antígeno de H. pylori en heces',
  ],
  'Microbiología / Infectología': [
    'Hemocultivos (2-3 tomas)',
    'Urocultivo',
    'Coprocultivo',
    'Cultivo de expectoración / esputo',
    'Cultivo de secreción de herida',
    'Cultivo de líquido (LCR, pleural, articular, ascítico)',
    'Cultivo de punta de catéter',
    'Tinción de Gram',
    'Baciloscopía (BAAR) seriada',
    'GeneXpert MTB/RIF / cultivo para micobacterias',
    'Antígeno urinario de neumococo y Legionella',
    'Panel respiratorio viral por PCR',
    'PCR SARS-CoV-2',
    'Toxina / PCR de Clostridioides difficile',
    'Serología VIH (Ag/Ab 4ª generación)',
    'Reacciones febriles (Widal)',
    'VDRL / RPR',
    'Antígeno y anticuerpos de dengue',
    'Gota gruesa / prueba rápida de malaria',
    'Galactomanano y (1,3)-β-D-glucano',
    'Antígeno criptocócico (CrAg)',
    'Cultivos de vigilancia MDR (hisopado nasal/rectal)',
  ],
  'Ginecología / Obstetricia': [
    'Citología cervical (Papanicolaou)',
    'Prueba de VPH (PCR / captura híbrida)',
    'Cultivo cervicovaginal / exudado vaginal',
    'Fracción beta de hCG cuantitativa',
    'Perfil hormonal (FSH, LH, estradiol, progesterona, prolactina)',
    'Ultrasonido pélvico / transvaginal',
    'Ultrasonido obstétrico',
    'Ultrasonido mamario',
    'Mastografía',
    'Tamiz prenatal (dúo / triple / cuádruple marcador)',
    'Curva de tolerancia a la glucosa (tamiz gestacional)',
    'Marcadores tumorales (CA-125, HE4)',
    'Colposcopía',
  ],
  'Urología': [
    'Antígeno prostático específico (APE total y libre)',
    'Examen general de orina',
    'Urocultivo',
    'Citología urinaria',
    'Ultrasonido renal y vesical (con residuo posmiccional)',
    'Ultrasonido prostático transrectal',
    'Uroflujometría',
    'Urotomografía',
    'Cistoscopía',
    'Espermatobioscopía (espermograma)',
    'Testosterona total y libre',
  ],
  'Neumología': [
    'Gasometría arterial',
    'Espirometría con broncodilatador',
    'Pletismografía / difusión de CO (DLCO)',
    'Radiografía de tórax',
    'TC de tórax de alta resolución',
    'Caminata de 6 minutos',
    'Óxido nítrico exhalado (FeNO)',
    'Polisomnografía',
    'IgE específica / panel de alérgenos',
  ],
  'Neurología': [
    'Punción lumbar y análisis de LCR',
    'Electroencefalograma',
    'Electromiografía y neuroconducción',
    'TC de cráneo',
    'RM de cráneo',
    'Bandas oligoclonales en LCR',
    'Anticuerpos anti-receptor de acetilcolina',
  ],
  'Marcadores tumorales': [
    'Alfa-fetoproteína (AFP)',
    'Antígeno carcinoembrionario (CEA)',
    'CA 19-9',
    'CA 125',
    'CA 15-3',
    'Antígeno prostático (APE)',
    'Beta-hCG',
    'Enolasa neuronal específica (NSE)',
    'Cromogranina A',
    'Tiroglobulina',
  ],
  'Cirugía / Preoperatorio': [
    'Biometría hemática completa',
    'Química sanguínea',
    'Tiempos de coagulación (TP, TTPa, INR)',
    'Grupo sanguíneo y Rh',
    'Pruebas cruzadas',
    'Electrolitos séricos',
    'Examen general de orina',
    'Electrocardiograma',
    'Radiografía de tórax',
    'Prueba de embarazo (mujeres en edad fértil)',
    'Valoración preanestésica',
    'Serologías (VIH, VHB, VHC)',
  ],
  'Imagen — Radiografía': [
    'Radiografía de tórax (PA y lateral)',
    'Radiografía de abdomen (simple y de pie)',
    'Radiografía de columna (cervical / dorsal / lumbar)',
    'Radiografía de cráneo',
    'Radiografía de pelvis',
    'Radiografía de extremidades',
    'Serie ósea metastásica',
  ],
  'Imagen — Ultrasonido': [
    'Ultrasonido abdominal completo',
    'Ultrasonido hepático y de vías biliares',
    'Ultrasonido renal y de vías urinarias',
    'Ultrasonido pélvico / transvaginal',
    'Ultrasonido prostático',
    'Ultrasonido de tiroides',
    'Ultrasonido mamario',
    'Ultrasonido Doppler venoso/arterial de miembros',
    'Ultrasonido Doppler carotídeo',
    'Ultrasonido de partes blandas / articular',
  ],
  'Imagen — Tomografía (TC)': [
    'TC de cráneo simple',
    'TC de cráneo contrastada',
    'TC de tórax (simple / contrastada)',
    'Angiotomografía pulmonar',
    'TC de abdomen y pelvis contrastada',
    'Urotomografía',
    'Angiotomografía coronaria',
    'TC de senos paranasales',
    'TC de columna',
  ],
  'Imagen — Resonancia (RM)': [
    'RM de cráneo',
    'RM de columna (cervical / dorsal / lumbar)',
    'RM de abdomen / colangiorresonancia',
    'RM de pelvis',
    'RM articular (rodilla / hombro / cadera)',
    'Angiorresonancia',
    'RM cardiaca',
  ],
  'Imagen — Nuclear / Otros': [
    'Mastografía',
    'Densitometría ósea (DEXA)',
    'Gammagrama óseo',
    'Gammagrama tiroideo',
    'Gammagrama de perfusión miocárdica',
    'PET-CT',
    'Endoscopia digestiva alta',
    'Colonoscopia',
    'Broncoscopía',
    'Espirometría',
    'Audiometría',
  ],
}

export default function GeneradorOrdenPage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config, error: configError } = useConfig()

  /**
   * ¿Este consultorio tiene un solo médico?
   *
   * De esto depende que se pueda usar "la única firma configurada" cuando el
   * identificador de la nota no coincide con el de la configuración — que es lo
   * habitual por un desajuste histórico de ids. Con varios médicos, adivinar
   * significa estampar la firma de otro.
   */
  const { activeDoctors } = useDoctors()
  const unicoMedico = activeDoctors.length <= 1

  const { toast } = useToast()

  const [nota, setNota] = useState<NotaMedica | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [estudios, setEstudios] = useState<string[]>([])

  /**
   * EMITIR LA ORDEN CREA LOS PENDIENTES — que es lo que /pendientes prometía.
   *
   * El motor de tareas deriva los estudios de `nota.estudiosOrden`, y ese campo
   * sólo lo llena la Valoración del inmunocomprometido: en una consulta normal
   * el médico elige los estudios AQUÍ, imprime, y la nota se queda vacía. Así
   * que la pantalla de Pendientes decía «los estudios pedidos salen solos al
   * firmar» y no salía ninguno.
   *
   * Se cuelga de EMITIR (imprimir, Word o PDF) y no de elegir: marcar una
   * casilla es una idea, entregar la orden es un hecho. Y volver a imprimir no
   * duplica nada — `crearTareas` da id derivado a lo que trae `notaId`.
   */
  const crearPendientesDeLaOrden = () => {
    if (!clinicId || !estudios.length) return
    const ahora = Date.now()
    /**
     * REG-411 — la orden ya está emitida y esto no puede tumbarla, que es lo que
     * decía el `catch` vacío que había aquí. Lo que le faltaba era la otra mitad:
     * no tumbarla NO es lo mismo que perder el pendiente sin decirlo.
     */
    abrirPendientes(clinicId, tareasDeNota({
      id: notaId, clinicId, pacienteId: patientId,
      pacienteNombre: patient?.nombre,
      estudiosOrden: estudios,
      medicoUid: auth.currentUser?.uid ?? undefined,
      medicoNombre: config?.nombreMedico,
    }, ahora), 'orden', { avisar: m => toast(`La orden quedó emitida, pero ${m}`, 'error') })
  }
  const [indicaciones, setIndicaciones] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>('Laboratorio general')
  // Estudio personalizado con input inline (antes prompt() nativo).
  const [customEstudio, setCustomEstudio] = useState('')
  const [mostrarCustom, setMostrarCustom] = useState(false)

  /**
   * FOLIO ESTABLE, derivado de la nota.
   *
   * Era `Date.now()` en un `useMemo(..., [])`, así que se reinventaba en cada
   * carga de la página: reimprimir la misma receta producía OTRO folio, y dos
   * papeles del mismo acto médico circulaban con identificadores distintos. El QR
   * firma ese folio, de modo que tampoco había forma de verificar cuál era el
   * bueno.
   *
   * Ahora sale del `notaId`, que es único y no cambia. Sin nota (caso raro) se cae
   * al reloj, que es mejor que nada.
   */
  /**
   * Igual que en la receta: el respaldo se congela al abrir.
   *
   * Un `Date.now()` dentro de `useMemo` da un folio que puede cambiar entre dos
   * pintados de la misma orden, y el folio es lo que la liga con el papel.
   */
  const [semillaFolio] = useState(() => Date.now().toString(36).toUpperCase().slice(-7))
  const folio = useMemo(() => {
    const base = (notaId ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    return `OM-${base ? base.slice(-7) : semillaFolio}`
  }, [notaId, semillaFolio])

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatient(clinicId, patientId),
    ]).then(([n, ps]) => {
      setNota(n)
      setPatient(ps)
      if (n) {
        /* REG-524 — una sola puerta. El respaldo sin filtro que había aquí
           `tipo`, así que un «embarazo descartado» salía impreso como el
           motivo. Si nada califica no se rellena: el campo es editable. */
        const principal = diagnosticoQueSeImprime(n.diagnosticos)
        if (principal) setDiagnostico(principal.descripcion + (principal.codigoCIE10 ? ` (${principal.codigoCIE10})` : ''))
        // Estudios pre-poblados por la nota (p. ej. valoración del inmunocomprometido)
        if (Array.isArray(n.estudiosOrden) && n.estudiosOrden.length) setEstudios(n.estudiosOrden)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clinicId, patientId, notaId])

  // Plantilla efectiva: la del MÉDICO de la nota sobre la general de la clínica
  const recetaConfig = useMemo(() => {
    const base = config?.recetaConfig ?? {
      paperSize: 'media-carta' as const,
      estilo: 'minimalista' as const,
      colorAccento: '#14b8a6',
      mostrarQR: true,
      mostrarAlergias: false,
      mostrarDiagnostico: true,
    }
    const medicoId = nota?.metadata?.medicoId
    const idDoc = resolverIdMedico(medicoId, activeDoctors) ?? medicoId
    const porMedico = entradaPorMedico(config?.recetasPorMedico, idDoc, overrideRecetaValido, unicoMedico)
    const merged = porMedico ? { ...base, ...porMedico } : base
    // Impresión SIEMPRE en hoja carta centrada (ver receta): 'papel-real' se
    // recorta en A5 por una limitación de Safari.
    return { ...merged, imprimirEn: 'carta' as const }
  }, [config, nota?.metadata?.medicoId])

  // Dimensiones ORIENTADAS al diseño (apaisado/vertical) para que preview/print
  // coincidan con la hoja renderizada (evita el "mocho" del diseño apaisado).
  const paperOri = useRecetaPaperOrientado(recetaConfig)
  const recetaConfigOri = useMemo(
    () => ({ ...recetaConfig, disenoWidthMm: paperOri.widthMm, disenoHeightMm: paperOri.heightMm }),
    [recetaConfig, paperOri.widthMm, paperOri.heightMm],
  )

  // Config con la firma del MÉDICO de esta nota (per-médico), si tiene la suya.
  /** REG-014 — la firma vive aparte y solo la leen los médicos. */
  const { firma: firmaProtegida } = useFirmaProtegida(clinicId, config ?? undefined)

  const configFirma = useMemo(() => {
    if (!config) return config
    const medicoId = nota?.metadata?.medicoId
    // REG-014: firma desde el subdocumento protegido.
    const firma = entradaPorMedico(firmaProtegida.firmaPorMedico, resolverIdMedico(medicoId, activeDoctors) ?? medicoId, firmaValida, unicoMedico)
      // Con VARIOS médicos tampoco se cae a la firma global (típicamente la del
      // dueño): sería la firma de otro. Mejor sin firma, que sí se nota.
      || (unicoMedico ? firmaProtegida.firmaImagenDataUrl : undefined)
    return { ...config, firmaImagenDataUrl: firma }
  }, [config, nota?.metadata?.medicoId, unicoMedico, firmaProtegida])

  /**
   * Sin firma resoluble no se imprime en silencio.
   *
   * Antes, si no había coincidencia por médico se estampaba "la única que
   * hubiera" o la firma global de la clínica — la de otro médico. Ahora, con
   * varios médicos, se prefiere no estampar ninguna; pero eso solo es más seguro
   * si el médico se entera ANTES de entregarle el papel al paciente.
   */
  const sinFirmaResoluble = !!config && !configFirma?.firmaImagenDataUrl
  /** La cédula es requisito del impreso; sin ella el documento no es válido. */
  const sinCedula = !!config && !config.cedulaProfesional?.trim()

  const descargarWord = () => {
    descargarRecetaWord(
      {
        tipo: 'orden',
        folio,
        fecha: new Date(),
        pacienteNombre: patient?.nombre ?? '',
        pacienteEdad: patient?.edad,
        pacienteSexo: patient?.sexo,
        pacienteFechaNac: patient?.fechaNacimiento,
        // FALTABA: sin esto el .doc de la orden afirmaba "Negadas / no referidas"
        // para un paciente alérgico, mientras su PDF imprimía la alergia real.
        alergias: alergiasParaImpreso(patient),
        diagnostico: diagnostico || undefined,
        estudios,
        indicaciones,
      },
      config,
      recetaConfig,
    )
  }

  const descargarPDF = async () => {
    const el = document.getElementById('receta-doc')
    if (!el) return
    setDescargando(true)
    try {
      const host = dimensionesImpresion(recetaConfigOri)
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date().toISOString().slice(0, 10)
      // PDF LIMPIO hoja-por-hoja (misma corrección que receta): sin "about:blank" ni
      // fecha del navegador, hoja física exacta, fiel al diseño.
      const paginas = Array.from(el.querySelectorAll<HTMLElement>('.receta-sheet-wrap'))
      const objetivo = paginas.length ? paginas : [el]
      await descargarPaginasComoPDF(objetivo, {
        filename: `Orden_${nombre}_${fechaCorta}`,
        anchoMm: host.widthMm,
        altoMm: host.heightMm,
      })
    } catch (e) {
      console.error('PDF error:', e)
      toast('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  const toggleEstudio = (estudio: string) => {
    setEstudios(estudios.includes(estudio)
      ? estudios.filter(e => e !== estudio)
      : [...estudios, estudio]
    )
  }

  const agregarCustom = () => {
    const t = customEstudio.trim()
    if (!t) return
    if (!estudios.includes(t)) setEstudios([...estudios, t])
    setCustomEstudio(''); setMostrarCustom(false)
  }

  if (loading) {
    return <Spinner center label="Cargando…" />
  }

  if (!nota) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={28} style={{ color: 'var(--amber)', marginBottom: 12 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Nota no encontrada</h2>
        <button onClick={() => router.push('/pacientes')} className="btn btn-primary" style={{ marginTop: 16 }}>
          Volver a expedientes
        </button>
      </div>
    )
  }

  // Sin estudios, la orden saldría en blanco (membrete + firma, sin contenido).
  // Se bloquea Imprimir / Word / PDF hasta que haya al menos un estudio.
  const ordenVacia = estudios.filter(e => e.trim()).length === 0

  return (
    <div className="nx-canvas">
      <AvisoConfigNoCargada error={configError} />

      {/* Avisos del impreso: tokens de badge POR TEMA — los rgba crudos de antes
          no cambiaban con el tema y este archivo es PAPEL para el trinquete de
          color, así que ningún guardián los veía (el de esta rebanada sí). */}
      {sinCedula && (
        <div className="no-print" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'var(--badge-red-b)', border: '1px solid var(--badge-red-t)',
          borderRadius: 12, padding: '13px 15px', marginBottom: 14,
        }}>
          <AlertTriangle size={17} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
            <strong>Falta tu cédula profesional.</strong> El documento saldrá marcándolo en rojo,
            porque la cédula es requisito del impreso (NOM-004). Agrégala en Configuración → General.
          </div>
        </div>
      )}

      {sinFirmaResoluble && (
        <div className="no-print" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'var(--badge-amber-b)', border: '1px solid var(--badge-amber-t)',
          borderRadius: 12, padding: '13px 15px', marginBottom: 14,
        }}>
          <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
            <strong>Este documento saldrá sin firma ni sello.</strong> No encontramos la firma
            registrada para el médico de esta nota. Como el consultorio tiene varios médicos, no se
            estampa ninguna otra: sería la firma de alguien más. Súbela en Configuración → Recetas
            o fírmalo a mano.
          </div>
        </div>
      )}
      {/* Barra superior — habla el sistema de botones (§16): UNA primaria
          (Descargar PDF, el trabajo dominante), secundarias del sistema y
          Atrás fantasma. Mismo idioma y mismo orden que /nota y /receta. */}
      <div className="no-print orden-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={volver} className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Atrás
        </button>
        {/* V15-FINAL-COHERENCE-001 — misma reparación y mismo porqué que en
            /receta: el `<h1>` nombra al paciente y «Orden médica» baja a
            rótulo subordinado. El impreso no cambia (barra `no-print`). */}
        <TituloDeDocumentoClinico nombreDelPaciente={patient?.nombre} clase="orden" />
        <div className="actions-row" style={{ display: 'flex', gap: 8 }}>
          {/* La primaria va PRIMERO, como en /nota y /receta: la familia
              documental habla el mismo orden. onClick/disabled intactos. */}
          <button onClick={() => { if (configError || ordenVacia) return; logAudit({ evento: 'orden_generada', clinicId: clinicId ?? '', patientId, notaId, meta: { folio, estudios: estudios.slice(0, 40), total: estudios.length, formato: 'pdf' } }).catch(() => {}); crearPendientesDeLaOrden(); descargarPDF() }} disabled={descargando || !!configError || ordenVacia} className="btn btn-primary">
            {descargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={14} /> Descargar PDF</>}
          </button>
          <button disabled={ordenVacia} onClick={() => { if (configError || descargando || ordenVacia) return; logAudit({ evento: 'orden_generada', clinicId: clinicId ?? '', patientId, notaId, meta: { folio, estudios: estudios.slice(0, 40), total: estudios.length } }).catch(() => {}); crearPendientesDeLaOrden(); const h = dimensionesImpresion(recetaConfigOri); imprimirElemento(document.getElementById('receta-doc'), 'Orden', { anchoMm: h.widthMm, altoMm: h.heightMm, hojaExacta: true, onError: (m) => toast(m, 'error') }) }} className="btn btn-secondary">
            <Printer size={14} /> Imprimir
          </button>
          <button disabled={ordenVacia} onClick={() => { if (configError || descargando || ordenVacia) return; logAudit({ evento: 'orden_generada', clinicId: clinicId ?? '', patientId, notaId, meta: { folio, estudios: estudios.slice(0, 40), total: estudios.length, formato: 'word' } }).catch(() => {}); crearPendientesDeLaOrden(); descargarWord() }} className="btn btn-secondary" title="Documento editable para tu membrete">
            <FileText size={14} /> Word
          </button>
          <button onClick={() => router.push('/configuracion?tab=recetas')} className="btn btn-secondary" title="Configurar template">
            <Settings size={14} /> Template
          </button>
        </div>
      </div>

      <div className="orden-gen-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
        <div className="no-print" style={{ display: 'grid', gap: 16 }}>
          {/* Diagnóstico. Las etiquetas del editor se ASOCIAN (htmlFor/id): un
              campo sin etiqueta asociada es falla de compuerta de la regla de
              diseño — y éste es el editor de un documento medicolegal. */}
          <div>
            <label htmlFor="om-diagnostico" style={labelStyle}>Diagnóstico de sospecha</label>
            <input
              id="om-diagnostico"
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Ej: Síndrome doloroso abdominal a estudiar"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              {/* span, no <label>: no etiqueta un control — encabeza el grupo. */}
              <span style={{ ...labelStyle, margin: 0 }}>Estudios solicitados ({estudios.length})</span>
              <button onClick={() => setMostrarCustom(v => !v)} className="btn btn-secondary btn-sm">
                <Plus size={12} /> Personalizado
              </button>
            </div>

            {/* Input inline para estudio personalizado (reemplaza prompt() nativo) */}
            {mostrarCustom && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  autoFocus
                  value={customEstudio}
                  onChange={(e) => setCustomEstudio(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCustom() } else if (e.key === 'Escape') { setCustomEstudio(''); setMostrarCustom(false) } }}
                  placeholder="Nombre del estudio personalizado…"
                  aria-label="Nombre del estudio personalizado"
                  style={{ ...inputStyle, flex: 1 }}
                />
                {/* Secundaria, no primaria: la única voz primaria de la pantalla
                    es Descargar PDF (§16 — una primaria por capa). */}
                <button onClick={agregarCustom} disabled={!customEstudio.trim()} className="btn btn-secondary btn-sm" style={{ opacity: customEstudio.trim() ? 1 : 0.5 }}>
                  Agregar
                </button>
              </div>
            )}

            {/* Estudios seleccionados (chips). El teal COMO TEXTO falla
                contraste sobre su propio tinte (lección del TrialBanner y del
                chip del directorio): el texto va en var(--text) y el estado lo
                lleva el tinte/borde del chip (no-textual, 3:1). */}
            {estudios.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {estudios.map((e, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'color-mix(in srgb, var(--teal) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--teal) 40%, transparent)',
                    color: 'var(--text)',
                    padding: '6px 10px', borderRadius: 'var(--r-pill)', fontSize: 12.5, fontWeight: 600,
                  }}>
                    {e}
                    {/* aria-label: icono solo no basta — y la fila se repite N veces. */}
                    <button onClick={() => setEstudios(estudios.filter((_, idx) => idx !== i))} aria-label={`Quitar ${e}`} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Catálogo agrupado */}
            {Object.entries(SUGERENCIAS).map(([cat, items]) => {
              const abierta = categoriaAbierta === cat
              return (
                <div key={cat} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                  <button
                    onClick={() => setCategoriaAbierta(abierta ? null : cat)}
                    aria-expanded={abierta}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {cat}
                    <ChevronDown size={14} style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--mov-rapido) var(--mov-curva)' }} />
                  </button>
                  {abierta && (
                    <div style={{ padding: '0 14px 12px', display: 'grid', gap: 4 }}>
                      {items.map(item => {
                        const seleccionado = estudios.includes(item)
                        return (
                          <button
                            key={item}
                            onClick={() => toggleEstudio(item)}
                            aria-pressed={seleccionado}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 8px', borderRadius: 6,
                              background: seleccionado ? 'color-mix(in srgb, var(--teal) 10%, transparent)' : 'transparent',
                              border: seleccionado ? '1px solid color-mix(in srgb, var(--teal) 40%, transparent)' : '1px solid transparent',
                              // El teal COMO TEXTO falla contraste en claro: lo
                              // seleccionado habla var(--text) + peso, y el estado
                              // lo lleva la casilla (no-textual).
                              color: seleccionado ? 'var(--text)' : 'var(--text2)',
                              fontWeight: seleccionado ? 600 : 400,
                              fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            {/* Casilla marcada: --nexus-solido + blanco, el par ya
                                medido (5.16:1) — el #000 sobre var(--teal) daba
                                2.99:1 en claro (mismo defecto que el chip del
                                directorio de /pacientes). */}
                            <span style={{
                              width: 14, height: 14, borderRadius: 3,
                              border: `1.5px solid ${seleccionado ? 'var(--nexus-solido)' : 'var(--border)'}`,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: seleccionado ? 'var(--nexus-solido)' : 'transparent', flexShrink: 0,
                            }}>
                              {seleccionado && <Check size={11} color="#fff" strokeWidth={3} />}
                            </span>
                            {item}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div>
            <label htmlFor="om-indicaciones" style={labelStyle}>Indicaciones para el estudio</label>
            <textarea
              id="om-indicaciones"
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Ej: Ayuno de 8 hrs para glucosa. Sin medio de contraste por antecedente de alergia."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ position: 'sticky', top: 20 }}>
          {(() => {
            const dataPreview = {
              tipo: 'orden' as const,
              folio,
              fecha: new Date(),
              paciente: patient,
              diagnostico: diagnostico || undefined,
              estudios,
              indicaciones,
            }
            const host = dimensionesImpresion(recetaConfigOri)
            const numPages = contarPaginas(dataPreview, configFirma, recetaConfig)   // misma config que el documento
            return (
              <>
                <div className="nx-meta" style={{ textAlign: 'center', marginBottom: 8 }}>
                  Vista previa · {PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].label.split(' ')[0]}
                  {numPages > 1 && <strong> · {numPages} hojas</strong>}
                  {estudios.length > 6 && ' · checklist 2 columnas'}
                  {host.esHostCarta && <> · impresa en carta <Scissors size={11} className="ds-icon" style={{ display: 'inline' }} /></>}
                </div>
                <RecetaPreviewWrapper
                  paperWidthMm={host.widthMm}
                  paperHeightMm={host.heightMm}
                  numPages={numPages}
                  maxWidth={380}
                  maxHeight={600}
                >
                  <RecetaDocumento
                    data={dataPreview}
                    config={configFirma}
                    recetaConfig={recetaConfig}
                  />
                </RecetaPreviewWrapper>
              </>
            )
          })()}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receta-doc, #receta-doc * { visibility: visible !important; }
          #receta-doc {
            position: absolute; top: 0; left: 0;
            margin: 0 !important;
          }
          #receta-doc .receta-sheet { box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
          @page { size: ${dimensionesImpresion(recetaConfigOri).cssPage}; margin: 0; }
        }
        @media (max-width: 1000px) {
          .orden-gen-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .orden-toolbar { flex-wrap: wrap; gap: 10px; }
          .orden-toolbar > button { min-height: 44px; }
          .orden-toolbar .actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
          .orden-toolbar .actions-row > button { width: 100%; min-height: 44px; justify-content: center; }
          /* El primario (Descargar PDF) ocupa la fila completa; si la última acción
             queda impar, también — sin celdas huérfanas. Mismas reglas que /nota. */
          .orden-toolbar .actions-row > button:first-child { grid-column: 1 / -1; }
          .orden-toolbar .actions-row > button:last-child:nth-child(even) { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
