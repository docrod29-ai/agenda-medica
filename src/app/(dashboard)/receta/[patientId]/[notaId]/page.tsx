'use client'
/**
 * Generador de recetas médicas.
 *
 * Flujo: el médico firma una nota → aparece botón "Generar receta" → llega aquí
 * con la nota pre-cargada. Los medicamentos vienen pre-llenados. Puede editarlos,
 * agregar/quitar, escribir indicaciones generales, y descargar el PDF con su template.
 *
 * El médico configura el template (membrete, tamaño, estilo) en Configuración → Recetas.
 */
import { useState, useEffect, useMemo } from 'react'
import { huellaImpreso } from '@/lib/expediente/huella-impreso'
import { folioDeNota } from '@/lib/receta-folio'
import { fetchAutenticado } from '@/lib/auth-client'
import { useDoctors } from '@/hooks/useDoctors'
import { logAudit } from '@/lib/expediente/audit-log'
import { useToast } from '@/context/ToastContext'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { useFirmaProtegida } from '@/hooks/useFirmaProtegida'
import { entradaPorMedico, resolverIdMedico, overrideRecetaValido, firmaValida } from '@/lib/impreso-medico'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { corregirViaParenteral } from '@/lib/expediente/via-parenteral'
import { medicamentosDeLaReceta } from '@/lib/expediente/que-va-en-la-receta'
import { etiquetaVia } from '@/lib/receta-paginacion'
import { getPatient } from '@/lib/firestore'
import type { NotaMedica, Medicamento } from '@/types/expediente'
import type { Patient } from '@/types'
import { RecetaDocumento, dimensionesImpresion, contarPaginas, useRecetaPaperOrientado } from '@/components/RecetaDocumento'
import { RecetaPreviewWrapper } from '@/components/RecetaPreviewWrapper'
import { PAPER_SIZES } from '@/lib/receta-template'
import { descargarPaginasComoPDF } from '@/lib/pdf-download'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'
import { alergiasDe } from '@/lib/seguridad/alergias'
import { revisarDosis, revisarUnidadDosis, extraerMg, extraerTomasDia, esDosisPorKg, type AlertaDosis } from '@/lib/seguridad/dosis'
import { evaluarFuncionRenal, ajusteRenalFarmacos } from '@/lib/expediente/funcion-renal'
import { edadParaDosificar, AVISO_SIN_EDAD_PARA_DOSIFICAR } from '@/lib/seguridad/edad-para-dosificar'
// E0-05: `kg` se importa con alias porque en este archivo `mg` ya es una variable
// local del bucle de dosis; el alias evita cualquier sombra accidental.
import { mgPorDl, kg as kgMasa, cantidad, valorEn } from '@/types/clinical-quantity'
import { descargarRecetaWord } from '@/lib/receta-word'
import { auth } from '@/lib/firebase'
import { registrarRecetados, cargarRecetasFrecuentes, type MedRecetado } from '@/lib/learning'
import {
  ArrowLeft, Download, Loader2, Plus, Trash2, Printer, Settings, AlertCircle, FileText,
  AlertTriangle, Lock, Droplet, Ban, Scale, Lightbulb, Scissors,
} from 'lucide-react'
import { Spinner } from '@/components/ui'
import { AvisoConfigNoCargada } from '@/components/AvisoConfigNoCargada'
import { TituloDeDocumentoClinico } from '@/components/TituloDeDocumentoClinico'

const VIAS: Medicamento['via'][] = ['oral', 'iv', 'im', 'sc', 'topica', 'inhalatoria', 'sublingual', 'rectal', 'otra']

export default function GeneradorRecetaPage() {
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
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [indicaciones, setIndicaciones] = useState('')
  const [notaParaPaciente, setNotaParaPaciente] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [descargando, setDescargando] = useState(false)
  // Learning Engine: "tus más recetados" del propio médico (fail-safe).
  const [frecuentes, setFrecuentes] = useState<MedRecetado[]>([])

  // Folio único (timestamp corto)
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
   *
   * E0-01: el cálculo se movió a `folioDeNota` para que el SERVIDOR use
   * exactamente la misma función al acuñar el QR. Si cada lado calculara lo suyo,
   * el papel y el certificado podrían llevar folios distintos.
   */
  /**
   * El respaldo del folio se congela AL ABRIR, no se lee del reloj al pintar.
   *
   * `useMemo` puede recalcularse cuando React quiera, así que un `Date.now()`
   * dentro daba un folio capaz de cambiar entre dos pintados de la MISMA receta.
   * Es justo lo que el comentario de arriba dice que no puede pasar: el papel y
   * el certificado llevarían folios distintos, y el QR dejaría de verificar la
   * hoja que el paciente tiene en la mano.
   *
   * El inicializador perezoso de `useState` corre una sola vez.
   */
  const [semillaFolio] = useState(() => Date.now().toString(36).toUpperCase().slice(-7))
  const folio = useMemo(
    () => folioDeNota(notaId) || `RX-${semillaFolio}`,
    [notaId, semillaFolio],
  )

  // URL de verificación firmada (destino del QR): /verificar/<token HMAC>. Se pide
  // más abajo (después de calcular recetaConfig) para respetar el orden de hooks.
  const [verificacionUrl, setVerificacionUrl] = useState<string | undefined>(undefined)

  // SEGURIDAD CLÍNICA: cruce alergia↔medicamento EN LA RECETA — el artefacto
  // que se dispensa. Reactivo a cada cambio de medicamento. Antes solo se
  // chequeaba en la consulta; aquí se podía agregar un fármaco peligroso sin alerta.
  const alertasAlergia = useMemo(() => {
    if (!patient) return []
    const alergiasArr = alergiasDe(patient).map(a => ({ alergeno: a.alergeno }))
    if (!alergiasArr.length) return []
    return validarAlergiasVsMedicamentos(
      alergiasArr,
      medicamentos.filter(m => m.nombre?.trim()).map(m => ({ nombre: m.nombre })),
    )
  }, [patient, medicamentos])

  // Interacciones fármaco-fármaco + controlados COFEPRIS (apoyo decisional)
  const meds = useMemo(() => medicamentos.filter(m => m.nombre?.trim()).map(m => ({ nombre: m.nombre })), [medicamentos])
  const interacciones = useMemo(() => detectarInteracciones(meds), [meds])
  const controlados = useMemo(() => detectarControlados(meds), [meds])

  // SEGURIDAD CLÍNICA: verificación DETERMINISTA de dosis (error de decimal 50→500,
  // sobre-máximo, sobre-mg/kg pediátrico). Ausencia de alerta ≠ dosis segura.
  // Declarados AQUÍ y no más abajo a propósito: el peso que teclea el médico se
  // usa en la verificación de dosis, que se calcula justo debajo.
  const [creatinina, setCreatinina] = useState('')
  const [pesoKg, setPesoKg] = useState('')

  // Se saca del memo para que la dependencia inferida sea la EDAD y no el objeto
  // paciente entero: si no, el compilador de React no puede conservar el memo.
  /**
   * LA EDAD SE CALCULA DE LA FECHA DE NACIMIENTO, Y SI NO HAY, SE DICE — REG-517.
   *
   * `patient.edad` es un número congelado: un paciente dado de alta desde la
   * reserva pública nace sin él, y con `undefined` esta pantalla lo trataba
   * como ADULTO en silencio — topes de adulto sobre un niño, sin mg/kg y sin
   * aviso. Ahora manda la fecha de nacimiento (no envejece), después la edad
   * congelada, y si no hay ninguna `origenEdad === 'desconocida'` y se pinta.
   */
  const edadCongelada = patient?.edad
  const fechaNacimiento = patient?.fechaNacimiento
  const { edad: edadPaciente, origen: origenEdad } = useMemo(
    () => edadParaDosificar({ edad: edadCongelada, fechaNacimiento }),
    [edadCongelada, fechaNacimiento],
  )
  const pesoDeLaNota = nota?.signosVitales?.peso

  const alertasDosis = useMemo(() => {
    const out: { med: string; alertas: AlertaDosis[] }[] = []
    // PESO para la verificación mg/kg PEDIÁTRICA (antes NO se pasaba → la red de
    // seguridad más importante en niños estaba muerta: solo corrían topes de adulto).
    // Se toma el peso de la nota (signos) y, si no, el que el médico teclee para el
    // cálculo renal. Solo se aplica a pacientes < 18 años.
    const esPediatrico = edadPaciente != null && edadPaciente < 18
    const pesoNota = Number(pesoDeLaNota ?? 0)
    // El comentario de arriba prometía «y si no, el que el médico teclee», y el
    // código no lo cumplía: sólo miraba la nota. En un niño sin peso en signos
    // vitales, la comprobación mg/kg —la red de seguridad más importante que hay
    // en pediatría— corría con topes de adulto aunque el peso estuviera escrito
    // dos centímetros más abajo, en el bloque renal.
    const pesoTecleado = parseFloat(pesoKg)
    const pesoParaDosis = !esPediatrico ? undefined
      : pesoNota > 0 ? pesoNota
      : (pesoTecleado > 0 ? pesoTecleado : undefined)
    for (const m of medicamentos) {
      if (!m.nombre?.trim()) continue     // renglón en blanco que se está escribiendo
      /**
       * LA UNIDAD QUE FALTA — antes de cualquier otra comprobación.
       *
       * Iba dentro del `continue`: sin dosis se saltaba el renglón entero, y sin
       * unidad `extraerMg` asumía MILIGRAMOS en silencio. «Levotiroxina 100» son
       * 100 mcg en la vida real y 100 mg en el papel — mil veces — y lo que se
       * imprime, firmado, es el texto tal cual.
       *
       * Se comprueba primero porque es lo único que se puede saber SIEMPRE: no
       * depende de que el fármaco esté en el catálogo ni de que la cifra sea
       * interpretable. Es un hecho del texto.
       */
      const faltaUnidad = revisarUnidadDosis(m.nombre, m.dosis)
      if (faltaUnidad) out.push({ med: m.nombre, alertas: [faltaUnidad] })
      if (!m.dosis?.trim()) continue
      const mg = extraerMg(m.dosis)
      if (mg == null) continue
      const tomas = extraerTomasDia(m.frecuencia || '') ?? undefined
      // "50 mg/kg" NO son 50 mg absolutos: si no se marca, revisarDosis lo dividía
      // otra vez entre el peso y la alerta pediátrica nunca disparaba.
      // E0-05: `esDosisPorKg` no desaparece — deja de ser un flag y pasa a ser la
      // FÁBRICA que elige la dimensión de la cantidad aquí, en la frontera del texto.
      const dosisPrescrita = esDosisPorKg(m.dosis)
        ? cantidad(mg, 'mg/kg/dosis', 'dosis_por_peso')
        : cantidad(mg, 'mg', 'masa')
      const al = revisarDosis({ farmaco: m.nombre, dosis: dosisPrescrita, tomasDia: tomas, peso: pesoParaDosis != null ? kgMasa(pesoParaDosis) : undefined, via: m.via, edadAnios: edadPaciente ?? undefined })
        .filter(a => a.codigo !== 'sin_referencia') // no saturar la receta con avisos informativos
      if (al.length) out.push({ med: m.nombre, alertas: al })
    }
    return out
  }, [medicamentos, edadPaciente, pesoDeLaNota, pesoKg])

  // Función renal — opcional: el médico teclea creatinina (y peso opcional)
  // y se calcula TFG + ajuste de antimicrobianos por depuración (PROA).
  const renal = useMemo(() => {
    const cr = parseFloat(creatinina)
    if (!cr || cr <= 0 || edadPaciente == null || !patient) return null
    const peso = parseFloat(pesoKg)
    // E0-05 — FRONTERA: aquí es donde el número tecleado adquiere su unidad. La
    // etiqueta del campo dice «Creatinina (mg/dL)» y «Peso (kg)»: es el único
    // sitio del flujo donde el dato aún no tiene unidad, y a partir de aquí ya
    // no puede perderla. El parseo (parseFloat) NO cambia, para no alterar qué
    // teclas acepta el campo.
    return evaluarFuncionRenal(
      mgPorDl(cr), edadPaciente, patient.sexo,
      peso > 0 ? kgMasa(peso) : undefined,
    )
  }, [creatinina, pesoKg, edadPaciente, patient])
  const alertasRenales = useMemo(() => {
    // En <18 años (adulto no aplica) o creatinina implausible (probable error de
    // unidad): no se ajusta por ese valor — daría alertas renales falsas.
    if (!renal || renal.noAplicablePorEdad || renal.datoImplausible) return []
    if (!renal.depuracionParaDosis) return []
    return ajusteRenalFarmacos(meds, renal.depuracionParaDosis)
  }, [renal, meds])

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatient(clinicId, patientId),
    ]).then(([n, ps]) => {
      setNota(n)
      setPatient(ps)
      if (n) {
        // Corrige la vía de fármacos parenterales puros (insulina, HBPM, GLP-1
        // inyectables) que la extracción pudo dejar en 'oral' por defecto — así no
        // se imprime "insulina · oral". Conservador: solo toca vía oral/vacía y
        // fármacos sin forma oral; el médico lo ve y puede editarlo antes de imprimir.
        /**
         * LO SUSPENDIDO NO SE RECETA.
         *
         * La nota puede contener órdenes que dicen «esto ya no lo toma» —así se
         * registra una suspensión, en la nota de hoy—. Copiarlas tal cual a la
         * receta imprimiría en el papel justo el fármaco que se acaba de retirar.
         */
        /**
         * LO QUE YA TOMABA NO SE RECETA.
         *
         * Petición del médico dueño, con sus palabras: «no me gusta que hagas
         * la receta con lo que te digo de antecedentes, la receta es cuando ya
         * te estén diciendo el plan».
         *
         * La NOTA conserva los dos —la medicación habitual forma parte del
         * expediente y de ella cuelgan los cruces de alergia e interacciones—;
         * lo que cambia es que al PAPEL sólo baja lo de hoy.
         *
         * Sin etiqueta se imprime: quitar de la receta un antibiótico que sí se
         * prescribió es peor que dejar un renglón que se borra de un toque.
         */
        /**
         * UNA SOLA PUERTA, Y VIVE FUERA DE ESTA PANTALLA — H-01.
         *
         * Esto componía a mano `loQueSeReceta` + `estaVigente`. La composición
         * era correcta, pero al vivir dentro de este `useEffect` sólo protegía a
         * ESTA pantalla: el portal del paciente arma su propia receta y nunca
         * pasó por aquí. La regla se mudó a `medicamentosDeLaReceta`, que es
         * ahora la única puerta y la que aplica también el servidor.
         */
        setMedicamentos(medicamentosDeLaReceta(n.medicamentos ?? [])
          .map(m => ({ ...m, via: corregirViaParenteral(m.nombre, m.via) as Medicamento['via'] })))
        // Diagnóstico principal: primero activo de tipo definitivo, o el primero
        const dxs = n.diagnosticos ?? []
        const principal = dxs.find(d => d.tipo === 'definitivo') ?? dxs[0]
        if (principal) setDiagnostico(principal.descripcion + (principal.codigoCIE10 ? ` (${principal.codigoCIE10})` : ''))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clinicId, patientId, notaId])

  // Learning Engine: carga "tus más recetados" del propio médico (fail-safe).
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!clinicId || !uid) return
    cargarRecetasFrecuentes(clinicId, uid, 8).then(setFrecuentes).catch(() => {})
  }, [clinicId])

  // Plantilla efectiva: la del MÉDICO de la nota (si tiene una propia)
  // sobre la general de la clínica. Cada médico ya tiene su papel impreso.
  const recetaConfig = useMemo(() => {
    const base = config?.recetaConfig ?? {
      paperSize: 'media-carta' as const,
      estilo: 'minimalista' as const,
      colorAccento: '#14b8a6',
      mostrarQR: true,
      vigenciaDias: 30,
      mostrarAlergias: true,
      mostrarDiagnostico: true,
      avisoLegal: 'Esta receta es personal e intransferible.',
    }
    const medicoId = nota?.metadata?.medicoId
    // El id que trae la nota puede ser el uid de la sesión; se traduce al id de
    // `doctors`, que es como se guardan la plantilla y la firma.
    const idDoc = resolverIdMedico(medicoId, activeDoctors) ?? medicoId
    const porMedico = entradaPorMedico(config?.recetasPorMedico, idDoc, overrideRecetaValido, unicoMedico)
    const merged = porMedico ? { ...base, ...porMedico } : base
    // Impresión SIEMPRE en hoja carta (tamaño estándar que Safari y la impresora
    // respetan): la receta se centra y agranda con márgenes. El modo "papel-real"
    // (media carta exacta) NO funciona en la práctica porque Safari lo redondea a
    // A5 y recorta el diseño.
    return { ...merged, imprimirEn: 'carta' as const }
    // `unicoMedico` y `overrideRecetaValido` SÍ entran en el cálculo (entradaPorMedico):
    // `unicoMedico` llega tarde desde useDoctors, así que sin él en deps la plantilla
    // podía quedarse con el valor inicial y desalinearse de la firma (que sí lo escucha).
  }, [config, nota?.metadata?.medicoId, unicoMedico, overrideRecetaValido])

  // Dimensiones ORIENTADAS al diseño (apaisado/vertical), para que el contenedor
  // de la vista previa y el @page de impresión coincidan con la hoja renderizada
  // (si no, un diseño apaisado sale recortado — "mocho"). El cfg orientado lleva
  // las dims para que dimensionesImpresion las respete.
  const paperOri = useRecetaPaperOrientado(recetaConfig)
  const recetaConfigOri = useMemo(
    () => ({ ...recetaConfig, disenoWidthMm: paperOri.widthMm, disenoHeightMm: paperOri.heightMm }),
    [recetaConfig, paperOri.widthMm, paperOri.heightMm],
  )

  // Pide al servidor la URL de verificación firmada (secreto HMAC no accesible en
  // cliente). Sin datos del paciente. Si falla, el QR cae al folio.
  // Huella del contenido prescrito para ligarla al QR (se re-firma si editas los
  // medicamentos antes de imprimir). Mismo hash que ya se registra en bitácora.
  const contenidoHash = useMemo(
    () => huellaImpreso(medicamentos, { folio, indicaciones, diagnostico }).hash,
    [medicamentos, folio, indicaciones, diagnostico],
  )

  useEffect(() => {
    if (!clinicId || !patientId || !notaId || !folio || !recetaConfig.mostrarQR) return
    let vivo = true
    /**
     * EL QR VIEJO NO PUEDE SEGUIR EN PANTALLA MIENTRAS SE MINTA EL NUEVO.
     *
     * `contenidoHash` cambia al instante con cada edición, pero la URL firmada
     * llega por red. En esa ventana, imprimir justo después de corregir una
     * dosis estampaba el certificado de la versión ANTERIOR — un QR válido que
     * certifica un contenido que ya no es el del papel.
     *
     * Se borra primero: mejor una receta sin QR que una con el QR equivocado.
     */
    setVerificacionUrl(undefined)
    // fetchAutenticado, no fetch: la ruta exige `verificarMiembro`, que lee la
    // cabecera Authorization. Con `fetch` plano respondía 401 SIEMPRE, y los dos
    // catches se lo tragaban: el QR impreso codificaba el folio en texto plano en
    // vez de la URL firmada. La verificación de recetas llevaba muerta desde el
    // primer día y nadie podía notarlo.
    fetchAutenticado('/api/receta/verificacion-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // E0-01: solo LOCALIZADORES. El folio, el nombre y la cédula del
      // certificado los deriva el servidor de la nota firmada — antes se los
      // mandábamos desde `config`, que es de la CLÍNICA: con dos médicos, quien
      // imprimía estampaba SU cédula en la receta firmada por el otro.
      body: JSON.stringify({ clinicId, patientId, notaId, contenidoHash }),
    })
      .then(async r => {
        if (!r.ok) { console.warn('[receta] verificacion-url respondió', r.status); return null }
        return r.json()
      })
      .then(j => { if (vivo && j?.url) setVerificacionUrl(j.url) })
      .catch(e => { console.warn('[receta] no se pudo firmar el QR:', e) })
    return () => { vivo = false }
    // `config.nombreMedico`/`cedulaProfesional` salieron de las dependencias: ya
    // no viajan en la petición, así que editarlos en Configuración no debe
    // re-disparar el minteo del certificado.
  }, [clinicId, patientId, notaId, folio, recetaConfig.mostrarQR, contenidoHash])

  /** REG-014 — la firma vive en un subdocumento que solo leen los médicos. */
  const { firma: firmaProtegida } = useFirmaProtegida(clinicId, config ?? undefined)

  // Config con la firma del MÉDICO de esta nota (per-médico), si tiene la suya.
  const configFirma = useMemo(() => {
    if (!config) return config
    const medicoId = nota?.metadata?.medicoId
    // REG-014: la firma viene del subdocumento protegido, no de `config/main`.
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
  /**
   * ¿El médico imprime sobre SU PROPIO diseño de receta (imagen completa subida)?
   * Con diseño propio la app NO dibuja el pie: no puede "marcar en rojo" la cédula
   * ni garantizar el domicilio; esos datos deben venir en el arte del médico.
   */
  const usaDisenoPropio = !!recetaConfig.disenoCompletoDataUrl
  /** Domicilio del consultorio: requisito COFEPRIS del recetario (plantilla generada). */
  const sinDireccion = !!config && !config.direccion?.trim() && !usaDisenoPropio

  // Descarga un Word (.doc) editable — para el médico que prefiere ajustar
  // a su propio formato/membrete en lugar de la plantilla generada.
  const descargarWord = () => {
    void descargarRecetaWord(
      {
        tipo: 'receta',
        folio,
        fecha: new Date(),
        pacienteNombre: patient?.nombre ?? '',
        pacienteEdad: patient?.edad,
        pacienteSexo: patient?.sexo,
        pacienteFechaNac: patient?.fechaNacimiento,
        alergias: patient?.alergias,
        diagnostico: diagnostico || undefined,
        medicamentos: medicamentos.filter(m => m.nombre?.trim()),
        indicaciones,
        notaParaPaciente,
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
      // El PDF usa el tamaño FÍSICO de la hoja que sale de la impresora
      // (carta si imprimirEn === 'carta', el papel de la receta si no)
      const host = dimensionesImpresion(recetaConfigOri)
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date().toISOString().slice(0, 10)
      // PDF LIMPIO hoja-por-hoja. Antes: con diseño se enrutaba por el diálogo de
      // impresión y el navegador estampaba "about:blank" + la fecha DENTRO del PDF
      // (queja del Dr) y a veces una 2ª hoja. Ahora se rasteriza cada hoja física y
      // se arma el PDF a sangre: hoja exacta, fiel al diseño, sin encabezados.
      const paginas = Array.from(el.querySelectorAll<HTMLElement>('.receta-sheet-wrap'))
      const objetivo = paginas.length ? paginas : [el]
      await descargarPaginasComoPDF(objetivo, {
        filename: `Receta_${nombre}_${fechaCorta}`,
        anchoMm: host.widthMm,
        altoMm: host.heightMm,
        onAvisoPapeleria: (m) => toast(m, 'error'),
      })
    } catch (e) {
      console.error('PDF error:', e)
      toast('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  // Tope de 6 medicamentos por receta (petición del Dr): más de eso no cabe bien y la
  // norma recomienda no saturar una receta. Si necesita más, se hace una segunda.
  const MAX_MEDS = 6
  const agregarMed = () => {
    if (medicamentos.length >= MAX_MEDS) {
      toast(`Máximo ${MAX_MEDS} medicamentos por receta. Genera otra receta si necesitas más.`, 'error')
      return
    }
    setMedicamentos([...medicamentos, {
      nombre: '', dosis: '', via: 'oral', frecuencia: '', duracion: '',
    }])
  }

  // Learning Engine: rellena una fila COMPLETA desde "tus más recetados" (1 toque).
  // Evita duplicar un fármaco que ya está en la receta. Siempre editable después.
  const agregarMedDesde = (r: MedRecetado) => {
    if (medicamentos.length >= MAX_MEDS) {
      toast(`Máximo ${MAX_MEDS} medicamentos por receta.`, 'error')
      return
    }
    const yaEsta = medicamentos.some(m => (m.nombre ?? '').trim().toLowerCase() === r.nombre.trim().toLowerCase())
    if (yaEsta) { toast(`${r.nombre} ya está en la receta.`, 'info'); return }
    setMedicamentos([...medicamentos, {
      nombre: r.nombre, dosis: r.dosis, via: (r.via as Medicamento['via']) || 'oral',
      frecuencia: r.frecuencia, duracion: r.duracion,
    }])
  }

  // Learning Engine: registra lo recetado al CONFIRMAR (imprimir/descargar). Fail-safe.
  const aprenderDeReceta = () => {
    const uid = auth.currentUser?.uid
    if (!clinicId || !uid) return
    registrarRecetados(clinicId, uid, medicamentos.filter(m => m.nombre?.trim())).catch(() => {})
  }

  const actualizarMed = (i: number, campo: keyof Medicamento, valor: string) => {
    const nuevos = [...medicamentos]
    nuevos[i] = { ...nuevos[i], [campo]: valor }
    setMedicamentos(nuevos)
  }

  const eliminarMed = (i: number) => {
    setMedicamentos(medicamentos.filter((_, idx) => idx !== i))
  }

  if (loading) {
    return <Spinner center label="Cargando receta…" />
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

  // Sin ningún medicamento con nombre NI indicaciones, la receta saldría en
  // blanco: un documento membretado y firmado sin contenido clínico. Se bloquea
  // Imprimir / Word / PDF hasta que haya algo real.
  const recetaVacia = !medicamentos.some(m => m.nombre?.trim()) && !indicaciones.trim()

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
            {/* Auditoría papelería 2026-07 (P2): con diseño propio la app no dibuja
                el pie, así que NO puede "marcar en rojo" la cédula — el aviso sería
                falso. Se ajusta el texto según el modo. */}
            {usaDisenoPropio ? (
              <><strong>Falta tu cédula profesional.</strong> Como imprimes sobre tu propio diseño,
              verifica que tu formato ya la incluya: la app no puede marcarla sobre tu arte. La cédula
              es requisito del impreso (NOM-004). Agrégala en Configuración → General.</>
            ) : (
              <><strong>Falta tu cédula profesional.</strong> El documento saldrá marcándolo en rojo,
              porque la cédula es requisito del impreso (NOM-004). Agrégala en Configuración → General.</>
            )}
          </div>
        </div>
      )}

      {sinDireccion && (
        <div className="no-print" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'var(--badge-amber-b)', border: '1px solid var(--badge-amber-t)',
          borderRadius: 12, padding: '13px 15px', marginBottom: 14,
        }}>
          <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
            <strong>Falta el domicilio del consultorio.</strong> El recetario debe incluir el domicilio
            del prescriptor (requisito COFEPRIS). Agrégalo en Configuración → General.
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
          Atrás fantasma. Mismo idioma que la toolbar de /nota. */}
      <div className="no-print receta-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={volver} className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Atrás
        </button>
        {/* V15-FINAL-COHERENCE-001: el encabezado dominante nombra AL PACIENTE,
            no a la herramienta. Medido: era «Generador de Receta» a 20/700
            mientras el nombre de quien se receta vivía a 14px en la franja del
            shell — la superficie que imprime una dosis con cédula profesional
            era la única de su familia cuya voz más fuerte no era el paciente.
            El documento impreso NO cambia: esto vive en la barra `no-print`. */}
        <TituloDeDocumentoClinico nombreDelPaciente={patient?.nombre} clase="receta" />
        <div className="actions-row" style={{ display: 'flex', gap: 8 }}>
          {/* La primaria va PRIMERO, como en /nota: las dos pantallas de la
              familia documental hablan el mismo orden. onClick/disabled intactos. */}
          <button onClick={() => { if (configError || descargando || recetaVacia) return; logAudit({ evento: 'receta_descargada', clinicId: clinicId ?? '', patientId, notaId, meta: huellaImpreso(medicamentos, { folio, indicaciones, diagnostico }) }).catch(() => {}); aprenderDeReceta(); descargarPDF() }} disabled={descargando || !!configError || recetaVacia} className="btn btn-primary">
            {descargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={14} /> Descargar PDF</>}
          </button>
          <button disabled={recetaVacia} onClick={() => { if (configError || descargando || recetaVacia) return; logAudit({ evento: 'receta_generada', clinicId: clinicId ?? '', patientId, notaId, meta: huellaImpreso(medicamentos, { folio, indicaciones, diagnostico }) }).catch(() => {}); aprenderDeReceta(); const h = dimensionesImpresion(recetaConfigOri); imprimirElemento(document.getElementById('receta-doc'), 'Receta', { anchoMm: h.widthMm, altoMm: h.heightMm, hojaExacta: true, onError: (m) => toast(m, 'error') }) }} className="btn btn-secondary">
            <Printer size={14} /> Imprimir
          </button>
          <button disabled={recetaVacia} onClick={() => { if (configError || descargando || recetaVacia) return; descargarWord() }} className="btn btn-secondary" title="Documento editable para tu membrete">
            <FileText size={14} /> Word
          </button>
          <button onClick={() => router.push('/configuracion?tab=recetas')} className="btn btn-secondary" title="Configurar template">
            <Settings size={14} /> Template
          </button>
        </div>
      </div>

      <div className="receta-gen-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
        {/* Editor (no se imprime) */}
        <div className="no-print" style={{ display: 'grid', gap: 16 }}>
          {/* Diagnóstico. Las etiquetas del editor se ASOCIAN (htmlFor/id): un
              campo sin etiqueta asociada es falla de compuerta de la regla de
              diseño — y éste es el editor de un documento medicolegal. */}
          <div>
            <label htmlFor="rx-diagnostico" style={labelStyle}>Diagnóstico (opcional)</label>
            <input
              id="rx-diagnostico"
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Ej: Faringitis aguda (J02.9)"
              style={inputStyle}
            />
          </div>

          {/* ⚠️ Alerta de alergia ↔ medicamento — bloquea visualmente antes de imprimir */}
          {alertasAlergia.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              // Tokens de badge rojo por tema: el título #b91c1c fijo era ilegible
              // sobre el canvas oscuro (rojo oscuro sobre fondo oscuro).
              background: 'var(--badge-red-b, rgba(220,38,38,0.10))', border: '2px solid var(--badge-red-t)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--badge-red-t)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} className="ds-icon" /> Alerta de alergia — revisa antes de imprimir
              </div>
              {alertasAlergia.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>• {a.mensaje}</div>
              ))}
              {/* var(--text2), no el text3 del rol: sobre el tinte rojo del badge
                  el text3 computa 4.22:1 en claro (axe lo midió) — text2 da 5.8. */}
              <div className="nx-meta" style={{ marginTop: 4, color: 'var(--text2)' }}>
                Paciente alérgico a: <strong>{patient?.alergias}</strong>. Si decides continuar, es bajo tu criterio clínico.
              </div>
            </div>
          )}

          {/* ⚠️ Verificación determinista de DOSIS (error de decimal, sobre-máximo, pediátrico) */}
          {/* REG-517 — sin edad no hay red pediátrica, y eso se DICE, no se supone adulto. */}
          {origenEdad === 'desconocida' && (
            <div role="status" style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--badge-amber-b)', border: '1.5px solid var(--amber)',
              fontSize: 12, color: 'var(--text)', lineHeight: 1.45,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertTriangle size={15} className="ds-icon" style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
              <span>{AVISO_SIN_EDAD_PARA_DOSIFICAR}</span>
            </div>
          )}

          {alertasDosis.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              // La MISMA lección del bloque de alergia de arriba: el #b91c1c fijo
              // era ilegible sobre el canvas oscuro — y ésta es la alerta de
              // seguridad más importante de la pantalla.
              background: 'var(--badge-red-b, rgba(220,38,38,0.10))', border: '2px solid var(--badge-red-t)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--badge-red-t)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} className="ds-icon" /> Revisa la dosis antes de imprimir
              </div>
              {alertasDosis.map((d, i) => (
                <div key={i} style={{ marginBottom: 3 }}>
                  {d.alertas.map((a, j) => (
                    <div key={j} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>• {a.mensaje}</div>
                  ))}
                </div>
              ))}
              <div className="nx-meta" style={{ marginTop: 4, color: 'var(--text2)' }}>
                Verificación automática de apoyo. <strong>No sustituye tu criterio</strong>; la ausencia de alerta no garantiza que la dosis sea correcta.
              </div>
            </div>
          )}

          {/* ⚠️ Interacciones fármaco-fármaco */}
          {interacciones.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              // Título en el token de TEXTO del badge, no en var(--amber): el ámbar
              // COMO TEXTO falla contraste en tema claro (lección del TrialBanner).
              background: 'var(--badge-amber-b)', border: '1.5px solid var(--amber)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--badge-amber-t)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} className="ds-icon" /> Posibles interacciones farmacológicas
              </div>
              {interacciones.map((it, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45, marginBottom: 3 }}>
                  <strong>{it.titulo}</strong>{it.severidad === 'mayor' ? ' (mayor)' : ''} — {it.detalle}
                </div>
              ))}
              <div className="nx-meta" style={{ marginTop: 2, color: 'var(--text2)' }}>Apoyo decisional; no sustituye tu criterio.</div>
            </div>
          )}

          {/* 🔒 Controlados COFEPRIS */}
          {controlados.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--badge-blue-b)', border: '1.5px solid var(--nexus)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--badge-blue-t)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={15} className="ds-icon" /> Medicamento(s) controlado(s) — requisitos COFEPRIS
              </div>
              {controlados.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45, marginBottom: 3 }}>
                  <strong>{c.farmaco}</strong> — {c.requisito}
                </div>
              ))}
            </div>
          )}

          {/* 🩺 Función renal — ajuste de dosis PROA (opcional) */}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Droplet size={14} className="ds-icon" /> Función renal (opcional) — ajuste de antimicrobianos
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label htmlFor="rx-creatinina" style={{ ...labelStyle, fontSize: 10.5 }}>Creatinina (mg/dL)</label>
                <input id="rx-creatinina" value={creatinina} onChange={e => setCreatinina(e.target.value)} placeholder="1.0"
                  inputMode="decimal" style={{ ...inputStyle, width: 90 }} />
              </div>
              <div>
                <label htmlFor="rx-peso" style={{ ...labelStyle, fontSize: 10.5 }}>Peso (kg, opc.)</label>
                <input id="rx-peso" value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="70"
                  inputMode="decimal" style={{ ...inputStyle, width: 90 }} />
              </div>
              {renal && (
                <div style={{ fontSize: 11.5, color: renal.datoImplausible ? 'var(--amber)' : 'var(--text2)', lineHeight: 1.4 }}>
                  {/* E0-05: `egfrCkdEpi` pasó de NaN a null cuando no se calcula.
                      El texto en pantalla es EL MISMO; sólo cambia cómo se pregunta
                      «¿hay valor?» (antes Number.isFinite sobre un NaN). */}
                  {renal.egfrCkdEpi
                    ? <div><strong>TFG (CKD-EPI):</strong> {Math.round(valorEn(renal.egfrCkdEpi, 'mL/min/1.73m²'))} mL/min/1.73m² · <strong>{renal.estadio}</strong> ({renal.estadioDesc})</div>
                    : <div>{renal.estadioDesc}</div>}
                  {/* El Math.round es de AQUÍ desde que cockcroftGault devuelve precisión
                      completa (8-ago-2026): redondear dentro del motor hacía que un CrCl de
                      29.63 se comparara como 30 y se perdieran las alertas de <30. Lo que se
                      ve en pantalla es el mismo número entero que antes. */}
                  {renal.crClCockcroft != null && <div><strong>CrCl (Cockcroft):</strong> {Math.round(valorEn(renal.crClCockcroft, 'mL/min'))} mL/min</div>}
                </div>
              )}
            </div>
            {origenEdad === 'desconocida' && (
              <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 6 }}>
                Falta la edad del paciente en su expediente para calcular la TFG.
              </div>
            )}
            {alertasRenales.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {alertasRenales.map((a, i) => (
                  <div key={i} style={{
                    fontSize: 12, lineHeight: 1.45, padding: '6px 10px', borderRadius: 6,
                    background: a.severidad === 'evitar' ? 'var(--badge-red-b)' : 'var(--badge-amber-b)',
                    borderLeft: `3px solid ${a.severidad === 'evitar' ? 'var(--badge-red-t)' : 'var(--amber)'}`,
                    color: 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {a.severidad === 'evitar' ? <Ban size={13} className="ds-icon" /> : <Scale size={13} className="ds-icon" />}{a.mensaje}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medicamentos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              {/* span, no <label>: no etiqueta un control — encabeza el grupo. */}
              <span style={{ ...labelStyle, margin: 0 }}>Medicamentos {medicamentos.length >= MAX_MEDS && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>· máx. {MAX_MEDS}</span>}</span>
              <button onClick={agregarMed} className="btn btn-secondary btn-sm" disabled={medicamentos.length >= MAX_MEDS}
                title={medicamentos.length >= MAX_MEDS ? `Máximo ${MAX_MEDS} medicamentos por receta` : undefined}>
                <Plus size={12} /> Agregar
              </button>
            </div>

            {/* Learning Engine: "tus más recetados" — 1 toque llena la fila completa
                con la posología que ESE médico suele usar. Aparece cuando ya hay
                historial y todavía cabe otro fármaco. Todo editable después. */}
            {frecuentes.length > 0 && medicamentos.length < MAX_MEDS && (
              <div style={{ marginBottom: 10 }}>
                <div className="nx-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Lightbulb size={12} style={{ color: 'var(--nexus)' }} /> Tus más recetados
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {frecuentes.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => agregarMedDesde(r)}
                      title={`${r.nombre}${r.dosis ? ' · ' + r.dosis : ''}${r.frecuencia ? ' · ' + r.frecuencia : ''}${r.duracion ? ' · ' + r.duracion : ''}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 'var(--r-pill)', padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Plus size={11} style={{ color: 'var(--nexus)' }} />
                      {r.nombre}{r.dosis ? <span style={{ color: 'var(--text3)', fontWeight: 500 }}> · {r.dosis}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {medicamentos.length === 0 && (
              <div style={{ padding: 14, background: 'var(--s2)', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
                Sin medicamentos. Agrega uno o usa &laquo;Solo indicaciones&raquo;.
              </div>
            )}
            {medicamentos.map((m, i) => (
              <MedRow
                key={i}
                med={m}
                onChange={(campo, valor) => actualizarMed(i, campo, valor)}
                onEliminar={() => eliminarMed(i)}
              />
            ))}
          </div>

          {/* Indicaciones */}
          <div>
            <label htmlFor="rx-indicaciones" style={labelStyle}>Indicaciones generales</label>
            <textarea
              id="rx-indicaciones"
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Ej: Reposo relativo, abundantes líquidos, dieta blanda…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Nota destacada al paciente */}
          <div>
            <label htmlFor="rx-nota-paciente" style={labelStyle}>Nota al paciente (caja destacada)</label>
            <textarea
              id="rx-nota-paciente"
              value={notaParaPaciente}
              onChange={(e) => setNotaParaPaciente(e.target.value)}
              placeholder="Ej: Si presenta fiebre mayor a 39°C, acudir a urgencias."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div className="nx-meta" style={{ padding: 10, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Lightbulb size={14} className="ds-icon" style={{ marginTop: 1, flexShrink: 0 }} />
            <span>¿Quieres cambiar el tamaño del papel, subir tu papel membretado o cambiar el estilo?
            Ve a <strong>Configuración → Recetas y órdenes</strong>.</span>
          </div>
        </div>

        {/* Preview en vivo — escalado para nunca desbordar; multi-hoja apilada */}
        <div style={{ position: 'sticky', top: 20 }}>
          {(() => {
            const dataPreview = {
              tipo: 'receta' as const,
              folio,
              fecha: new Date(),
              paciente: patient,
              diagnostico: diagnostico || undefined,
              // Sin nombre no se imprime: el botón "Agregar" crea la fila vacía y,
              // si el médico no la llena, salía una viñeta numerada EN BLANCO en un
              // documento legal — que además consumía altura y podía empujar otro
              // fármaco fuera de la hoja. Las alertas de alergia y dosis ya
              // filtraban por nombre; el impreso no.
              medicamentos: medicamentos.filter(m => m.nombre?.trim()),
              indicaciones,
              notaParaPaciente,
              verificacionUrl,
            }
            const host = dimensionesImpresion(recetaConfigOri)
            // configFirma, no config: el conteo debe usar la MISMA config que el
            // documento, o el contador dice "1 hoja" y el PDF sale con 2.
            const numPages = contarPaginas(dataPreview, configFirma, recetaConfig)
            return (
              <>
                <div className="nx-meta" style={{ textAlign: 'center', marginBottom: 8 }}>
                  Vista previa · {recetaConfig.disenoCompletoDataUrl && recetaConfig.disenoWidthMm && recetaConfig.disenoHeightMm
                    ? `tu formato (${Math.round(host.widthMm)}×${Math.round(host.heightMm)} mm)`
                    : PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].label.split(' ')[0]}
                  {numPages > 1 && <strong> · {numPages} hojas</strong>}
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

      {/* CSS de impresión: solo el documento, en tamaño de papel correcto.
          Cada .receta-sheet-wrap lleva su page-break inline → multi-hoja limpia. */}
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
          .receta-gen-grid {
            /* minmax(0, 1fr) Y NO 1fr a secas, que es lo que decía antes.
               Un track 1fr lleva min-width:auto implícito: no baja del ancho
               MÍNIMO de su contenido. La columna del editor pide 380 px de
               mínimo —la fila de un medicamento, con sus campos de dosis— así
               que a 390 px el track se quedaba en 380 dentro de un contenedor de
               358 y RECORTABA 6 px por la derecha a los 24 bloques de la
               columna: los dos avisos de COFEPRIS, el de «saldrá sin firma», el
               de la dosis que falta, y todos los campos. Sin barra de
               desplazamiento, porque el documento no desborda: lo que sobra se
               corta y ya.
               La regla de ESCRITORIO ya se protege con minmax(0, 1fr) 420px;
               este override la perdió al reescribir la rejilla en una sola
               columna. Ver REG-441.
               (Sin acentos graves en este comentario: vive dentro de una
               plantilla de cadena y cerrarían el literal.) */
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
        }
        @media (max-width: 480px) {
          .receta-toolbar { flex-wrap: wrap; gap: 10px; }
          .receta-toolbar > button { min-height: 44px; }
          .receta-toolbar .actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
          .receta-toolbar .actions-row > button { width: 100%; min-height: 44px; justify-content: center; }
          /* El primario (Descargar PDF) ocupa la fila completa; si la última acción
             queda impar, también — sin celdas huérfanas. Mismas reglas que /nota. */
          .receta-toolbar .actions-row > button:first-child { grid-column: 1 / -1; }
          .receta-toolbar .actions-row > button:last-child:nth-child(even) { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}

function MedRow({
  med, onChange, onEliminar,
}: {
  med: Medicamento
  onChange: (campo: keyof Medicamento, valor: string) => void
  onEliminar: () => void
}) {
  return (
    <div style={{ padding: 12, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
        {/* aria-label en cada campo de la fila: el placeholder desaparece al
            escribir y la fila se repite N veces — sin nombre accesible, el
            lector de pantalla anuncia seis campos mudos en un editor de recetas. */}
        <input
          value={med.nombre}
          onChange={(e) => onChange('nombre', e.target.value)}
          placeholder="Medicamento (DCI)"
          aria-label="Medicamento (DCI)"
          style={inputStyle}
        />
        <input
          value={med.dosis}
          onChange={(e) => onChange('dosis', e.target.value)}
          placeholder="500 mg"
          aria-label="Dosis"
          style={inputStyle}
        />
        {/* 30×44 medido a 390 px, y es el ÚNICO control DESTRUCTIVO de la fila:
            quita un medicamento de una receta. Catorce píxeles de ancho de menos
            en un botón que borra, pegado a los campos de dosis que se teclean con
            el dedo. Sube a 44×44 — es el mínimo, no una preferencia. */}
        <button onClick={onEliminar} title="Quitar" aria-label="Quitar medicamento" style={{
          background: 'transparent', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          color: 'var(--red)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
          minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Trash2 size={12} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 6, marginTop: 6 }}>
        <select
          value={med.via}
          onChange={(e) => onChange('via', e.target.value)}
          aria-label="Vía de administración"
          style={inputStyle}
        >
          {VIAS.map(v => <option key={v} value={v}>{etiquetaVia(v)}</option>)}
        </select>
        <input
          value={med.frecuencia}
          onChange={(e) => onChange('frecuencia', e.target.value)}
          placeholder="Cada 8 hrs"
          aria-label="Frecuencia"
          style={inputStyle}
        />
      </div>
      {/* Duración + indicación: ahora editables (antes solo salían en el Word/PDF) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 6, marginTop: 6 }}>
        <input
          value={med.duracion ?? ''}
          onChange={(e) => onChange('duracion', e.target.value)}
          placeholder="Por 7 días"
          aria-label="Duración"
          style={inputStyle}
        />
        <input
          value={med.indicacion ?? ''}
          onChange={(e) => onChange('indicacion', e.target.value)}
          placeholder="Indicación (ej. con alimentos)"
          aria-label="Indicación"
          style={inputStyle}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4,
}
/**
 * `minHeight: 44` — medido a 390 px: estos campos salían a **42**, dos por
 * debajo del mínimo táctil que `design-system.md` pone entre los que tumban la
 * compuerta. Entre ellos los DOS DE LA DOSIS.
 *
 * Dos píxeles no se ven y sí se notan: esto se teclea de pie, con el paciente
 * delante, en la pantalla donde una cifra equivocada sale impresa con cédula
 * profesional. Sube el alto, no el `fontSize`: la escala tipográfica está
 * medida y la vigila el trinquete de diseño. Ver REG-441.
 */
const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 44, padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
