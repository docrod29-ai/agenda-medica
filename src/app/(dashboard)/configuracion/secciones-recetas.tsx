'use client'
/**
 * Sección de configuración de RECETAS (extraída del monolito configuracion/page.tsx).
 * Incluye RecetasTab + su preview, calibrador visual y sub-controles.
 * Sin cambio de comportamiento respecto al monolito original.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { areaImpracticable } from '@/lib/receta-paginacion'
import { RecetaDocumento, dimensionesImpresion, admiteHojaCarta, colocacionDeLaReceta, useRecetaPaperOrientado, type RecetaData } from '@/components/RecetaDocumento'
import { RecetaPreviewWrapper, escalaDeVistaPrevia } from '@/components/RecetaPreviewWrapper'
import { imprimirElemento } from '@/lib/print-element'
import { GuiaConfigurarReceta } from '@/components/GuiaConfigurarReceta'
import { resizeImageFile, formatBytes, reducirDataUrlSiPesa } from '@/lib/image-utils'
import { PAPER_SIZES, ESTILOS_RECETA, detectarPaperSize, NOTA_PAPER_SIZES, papelPersonalizado, PAPEL_MIN_MM, PAPEL_MAX_MM, type NotaPaperSize as NotaPaperSizeT } from '@/lib/receta-template'
import type { RecetaConfig, PaperSize as PaperSizeT, EstiloReceta as EstiloT, Patient, Doctor as DoctorT, ClinicConfig } from '@/types'
import { DEFAULT_CONFIG } from '@/types'
import { getDoctors, saveConfig } from '@/lib/firestore'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subirImagen as subirImagenServidor } from '@/lib/subir-imagen'
import { fetchAutenticado } from '@/lib/auth-client'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { noSePudo } from '@/lib/texto-es'
import { auth, storage } from '@/lib/firebase'
import { cfgInput, cfgLabel } from './estilos'
import { Upload, X as IconX, Pill, ClipboardList, Printer, Loader2, Ruler, Save, Sparkles, Settings2, ChevronDown, UserRound, AlertTriangle, Check } from 'lucide-react'

/*
  UNA SOLA FUENTE DE VERDAD PARA LOS VALORES POR DEFECTO DE LA RECETA.

  Aquí vivía una segunda copia, campo por campo, de lo que `DEFAULT_CONFIG`
  ya declara en `@/types`. Comparadas hoy coincidían **exactamente** — y ése
  es justo el problema: coincidían por suerte, no por construcción. La
  siguiente vez que alguien cambie el aviso legal, la vigencia o el tamaño de
  papel en un sitio, el otro se queda atrás y la diferencia sale IMPRESA en
  una receta, que es donde nadie la busca.

  Lo que se guarda en Firestore y lo que se imprime tienen que salir del
  mismo sitio. `colorAccento` sigue siendo un hex literal por la razón
  escrita en `@/types` (un `<input type="color">` sólo acepta `#rrggbb` y la
  receta se imprime sin hoja de estilos que resuelva una variable).
*/
const RX_DEFAULTS: RecetaConfig = DEFAULT_CONFIG.recetaConfig!


/**
 * LA FIRMA Y LA HOJA DE NOTAS ENTRAN COMO RANURAS, NO COMO IMPORTACIONES.
 *
 * Las dos secciones viven en `secciones-cuenta.tsx` y las monta
 * `configuracion/page.tsx`, que es quien tiene el formulario en memoria. Antes
 * se pintaban como hermanas de esta pestaña, debajo de todo. La firma es el
 * paso 2 de tres, así que tiene que entrar DENTRO — y la única forma de hacerlo
 * sin duplicar su lógica (subida, migración a `config/firma`, guardado por
 * médico) es que la página la pase ya construida.
 */
export function RecetasTab({ clinicId, firmaSlot, firmaLista, notasSlot }: {
  clinicId: string | null
  /** La sección de firma, ya montada por la página (paso 2). */
  firmaSlot?: React.ReactNode
  /** ¿Hay alguna firma cargada? Sólo para marcar el paso como resuelto. */
  firmaLista?: boolean
  /** La hoja membretada de las notas (va en «Ajustes avanzados»). */
  notasSlot?: React.ReactNode
}) {
  const { config, loading: configLoading } = useConfig()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  /**
   * QUÉ PASÓ AL GUARDAR — en la propia pantalla, no en un aviso que se va.
   *
   * El Dr. reportó «no se guarda el template». El guardado escribe y, si
   * Firestore lo rechaza, `setDoc` lanza y sale un aviso… que dura unos segundos
   * y aparece lejos del botón, en una pantalla larguísima que se usa con scroll.
   * Si se lo perdió, lo que vio fue un botón que dijo «Guardando…» y volvió a su
   * sitio: idéntico a un guardado correcto.
   *
   * Así que ahora el guardado se VERIFICA —se vuelve a leer lo que quedó
   * escrito— y el resultado se queda fijo junto al botón hasta el siguiente
   * intento, diciendo QUÉ campos no llegaron.
   */
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [tipoPreview, setTipoPreview] = useState<'receta' | 'orden'>('receta')

  // ── Plantilla por médico ──────────────────────────────────────
  // '' = plantilla general de la clínica. Un medicoId = override de ese
  // médico (cada quien tiene su propio papel impreso).
  const [doctores, setDoctores] = useState<DoctorT[]>([])
  const [medicoSel, setMedicoSel] = useState<string>('')

  useEffect(() => {
    if (!clinicId) return
    getDoctors(clinicId).then(ds => {
      setDoctores(ds)
      // Cada médico edita LA SUYA (no hay "general"). Default: el médico de la
      // cuenta logueada (por correo); si no se identifica, el primero.
      setMedicoSel(prev => {
        if (prev && ds.some(d => d.id === prev)) return prev
        const mio = ds.find(d => d.email && d.email === auth.currentUser?.email)
        return mio?.id ?? ds[0]?.id ?? ''
      })
    }).catch(() => {})
  }, [clinicId])

  const [rx, setRx] = useState<RecetaConfig>({ ...RX_DEFAULTS })

  /**
   * CAMBIOS SIN GUARDAR — porque el botón de guardar estaba al final de una
   * pantalla larguísima.
   *
   * El Dr. reportó dos veces «no se guarda». Las dos veces se había guardado
   * o no se había pulsado el botón, que vivía tras varias pantallas de scroll.
   * Ahora la barra de guardado sólo aparece cuando hay algo que guardar, se
   * queda pegada abajo y dice qué falta.
   *
   * `actualizar` es el ÚNICO camino por el que la pantalla toca `rx`: si
   * alguien vuelve a llamar a `setRx` desde un control, la barra no aparecerá
   * y el cambio se perderá al recargar. Por eso el nombre corto es el correcto
   * y `setRx` queda para la carga y el guardado.
   */
  const [sucio, setSucio] = useState(false)
  const actualizar = (
    patch: Partial<RecetaConfig> | ((prev: RecetaConfig) => RecetaConfig),
  ) => {
    setSucio(true)
    actualizar(prev => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
  }

  // Lo que la subida del formato dejó resuelto sola, para poder decirlo.
  const [detectandoCampos, setDetectandoCampos] = useState(false)
  const [camposDetectados, setCamposDetectados] = useState<number | null>(null)

  // Los tres pasos. `pruebaOk` no se persiste a propósito: declarar una
  // colección nueva cuesta tres sitios (reglas, matriz, respaldo) y esto es
  // una marca de sesión, no un dato clínico.
  const [pruebaOk, setPruebaOk] = useState(false)
  const [verArreglos, setVerArreglos] = useState(false)
  const [verCalibrador, setVerCalibrador] = useState(false)
  const [verAvanzados, setVerAvanzados] = useState(false)
  const [sinPapelPropio, setSinPapelPropio] = useState(false)

  /**
   * El botón de imprimir vive en el paso 3, pero la impresión la sabe hacer la
   * vista previa —es la que conoce las dimensiones ya orientadas al diseño y el
   * nodo que se manda al papel—. En vez de duplicar ese cálculo, la vista previa
   * deja aquí su función y el paso 3 la llama. Duplicarlo sería exactamente el
   * defecto que la vista previa arregló en su día: dos caminos de impresión, y
   * el que se prueba no es el que recibe el paciente.
   */
  const imprimirPruebaRef = useRef<() => void>(() => {})

  // Carga la plantilla del médico seleccionado. SOLO se recarga cuando CAMBIA el
  // médico (o en la primera carga) — NUNCA en cada update del listener en vivo, que
  // borraba lo que el médico movía sin guardar (QR, firma, márgenes…).
  const rxKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (configLoading) return               // espera a que cargue la config real
    if (rxKeyRef.current === medicoSel) return  // no recargar en updates del listener
    rxKeyRef.current = medicoSel
    const base = { ...RX_DEFAULTS, ...(config?.recetaConfig ?? {}) }
    setRx(medicoSel ? { ...base, ...(config?.recetasPorMedico?.[medicoSel] ?? {}) } : base)
    setSucio(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoSel, configLoading])

  /**
   * LEE DE VUELTA LO QUE SE ACABA DE ESCRIBIR Y LO COMPARA.
   *
   * Un guardado que «no falla» no es lo mismo que un guardado que quedó. Entre
   * el botón y el disco hay reglas de Firestore, un tope de 1 MB por documento y
   * un `merge` que puede no hacer lo que uno cree. Cualquiera de los tres deja el
   * campo fuera sin lanzar un error.
   *
   * Se comparan los campos que el médico TECLEA (no las imágenes, que cambian de
   * data URL a URL de Storage al guardarse, y compararlas daría falsos fallos).
   */
  /**
   * TRES CAMPOS FUERA — Panel de Lujo C-003 y C-004.
   *
   * `registroAntidopaje`, `copiasEnHoja` y `mostrarSignosVitales` estaban en
   * esta lista y **ningún input los edita ni nada los imprime**: sólo existían
   * en el tipo y aquí. Verificar que quedó guardado un campo que nadie escribe
   * ni lee no comprueba nada; lo que hace es dar por vigilado un hueco.
   *
   * Se sacan de la verificación, no del tipo: quitarlos del tipo es tocar
   * `src/types/index.ts`, que es de otra rebanada de esta reparación y va en el
   * handoff. Y si algún consultorio tuviera un valor guardado, sigue ahí.
   */
  const CAMPOS_VERIFICABLES: (keyof RecetaConfig)[] = [
    'rfc', 'registroDGP', 'vigenciaDias', 'avisoLegal',
    'mostrarQR', 'mostrarAlergias', 'mostrarDiagnostico',
    'paperSize', 'estilo',
  ]

  const confirmarQueQuedo = async (esperado: RecetaConfig, medico: string) => {
    if (!clinicId) return
    const dr = doctores.find(d => d.id === medico)
    const quien = medico ? `Plantilla de ${dr?.nombre ?? 'médico'}` : 'Plantilla general'
    try {
      const snap = await getDoc(doc(db, 'clinics', clinicId, 'config', 'main'))
      const c = (snap.data() ?? {}) as ClinicConfig
      const guardado = medico
        ? { ...(c.recetaConfig ?? {}), ...(c.recetasPorMedico?.[medico] ?? {}) }
        : (c.recetaConfig ?? {})
      const faltaron = CAMPOS_VERIFICABLES.filter(k => {
        const q = esperado[k]
        if (q === undefined || q === '') return false      // no se pidió nada
        return JSON.stringify((guardado as RecetaConfig)[k]) !== JSON.stringify(q)
      })
      if (faltaron.length === 0) {
        setResultado({ ok: true, texto: `${quien} guardada y verificada en el servidor.` })
        toast(`${quien} guardada`, 'success')
        return
      }
      // Esto es lo que antes pasaba en silencio.
      setResultado({
        ok: false,
        texto: `${quien}: se guardó, pero estos campos NO quedaron escritos: ${faltaron.join(', ')}. ` +
          `Vuelve a intentarlo; si se repite, mándame esta lista.`,
      })
      toast('Algunos campos no se guardaron — mira el detalle bajo el botón', 'error')
    } catch (e) {
      // No poder VERIFICAR no es lo mismo que no haber guardado: se dice tal cual.
      setResultado({
        ok: false,
        texto: `${quien}: se envió, pero no se pudo comprobar que quedara ` +
          `(${e instanceof Error ? e.message.slice(0, 80) : 'error de lectura'}). Recarga y revisa.`,
      })
    }
  }

  const guardar = async () => {
    if (!clinicId || !config) return
    setResultado(null)
    setSaving(true)
    try {
      // Migra a Storage cualquier imagen base64 (del rx actual, de la firma y de
      // las plantillas por médico) para que la config NO exceda el límite de 1 MB
      // de Firestore. Reemplaza el base64 por una URL corta.
      const rxSano: RecetaConfig = {
        ...rx,
        membreteDataUrl: await aStorageSiEsBase64(rx.membreteDataUrl, 'membrete'),
        pieDataUrl: await aStorageSiEsBase64(rx.pieDataUrl, 'pie'),
        // El DISEÑO COMPLETO es la imagen más grande (página entera) — DEBE migrar a
        // Storage o la config revienta el tope de 1 MB de Firestore.
        disenoCompletoDataUrl: await aStorageSiEsBase64(rx.disenoCompletoDataUrl, 'diseno'),
      }
      const porMedicoSano: Record<string, Partial<RecetaConfig>> = {}
      for (const [id, r] of Object.entries(config.recetasPorMedico ?? {})) {
        porMedicoSano[id] = {
          ...r,
          membreteDataUrl: await aStorageSiEsBase64(r.membreteDataUrl, `m-${id}`),
          pieDataUrl: await aStorageSiEsBase64(r.pieDataUrl, `p-${id}`),
          disenoCompletoDataUrl: await aStorageSiEsBase64(r.disenoCompletoDataUrl, `d-${id}`),
        }
      }
      // También la firma y la hoja membretada (imágenes grandes en el doc raíz).
      const baseConfig = {
        ...config,
        recetasPorMedico: porMedicoSano,
        firmaImagenDataUrl: await aStorageSiEsBase64(config.firmaImagenDataUrl, 'firma'),
        notaMembreteDataUrl: await aStorageSiEsBase64(config.notaMembreteDataUrl, 'nota-membrete'),
      }

      if (!medicoSel) {
        await saveConfig(clinicId, { ...baseConfig, recetaConfig: rxSano })
        setRx(rxSano)
        setSucio(false)
        await confirmarQueQuedo(rxSano, '')
      } else {
        // El override del médico guarda TODO el rx editado — al cargar se
        // mergea sobre la general, por lo que es consistente y simple.
        await saveConfig(clinicId, {
          ...baseConfig,
          recetasPorMedico: { ...porMedicoSano, [medicoSel]: rxSano },
        })
        setRx(rxSano)
        setSucio(false)
        await confirmarQueQuedo(rxSano, medicoSel)
      }
    } catch (e) {
      // Mostrar la causa real — un "Error al guardar" mudo es indepurable
      const msg = e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160)
      toast(noSePudo('guardar la receta de ejemplo', msg), 'error')
      setResultado({ ok: false, texto: `No se guardó: ${msg}` })
      console.error('[recetas/guardar]', e)
    } finally {
      setSaving(false)
    }
  }

  // Sube un data URL base64 a Storage (vía el SERVIDOR, Admin SDK) y devuelve la
  // URL proxeada — así el documento de config queda chico (no revienta el 1 MB de
  // Firestore). Si falla, LANZA con la causa real (ya no cae a base64 en silencio).
  const aStorageSiEsBase64 = (valor: string | undefined, nombre: string) => subirImagenServidor(valor, nombre)

  const subirImagen = async (campo: 'membreteDataUrl' | 'pieDataUrl', file: File) => {
    try {
      const { dataUrl, sizeBytes } = await resizeImageFile(file, {
        maxWidth: campo === 'membreteDataUrl' ? 1400 : 1200,
        maxHeight: campo === 'membreteDataUrl' ? 600 : 250,
        quality: 0.85,
      })
      // Con Storage: sube y guarda la URL (no infla el documento). Sin Storage: base64 con tope.
      if (storage && auth.currentUser?.uid) {
        const url = await aStorageSiEsBase64(dataUrl, campo === 'membreteDataUrl' ? 'membrete' : 'pie')
        actualizar({ [campo]: url })
        toast('Imagen cargada', 'success')
        return
      }
      if (sizeBytes > 800_000) {
        toast(`Imagen muy grande (${formatBytes(sizeBytes)}). Intenta con una más chica o menos detallada.`, 'error')
        return
      }
      actualizar({ [campo]: dataUrl })
      toast(`Imagen cargada (${formatBytes(sizeBytes)})`, 'success')
    } catch (e) {
      toast(`No se pudo procesar: ${(e as Error).message}`, 'error')
    }
  }

  /**
   * Sube el diseño COMPLETO de la receta del médico (su propio papel).
   * Acepta PDF (renderiza primera página) o imagen. Se resizea para que quepa
   * cómodo en Firestore (<800KB).
   */
  const [subiendoDiseno, setSubiendoDiseno] = useState(false)
  const [progresoDiseno, setProgresoDiseno] = useState('')

  /**
   * Sube el diseño completo del médico — PDF o imagen.
   * Estrategia de CALIDAD:
   *  1. PDFs se renderizan a 240 DPI como PNG (texto y líneas perfectas, sin JPEG artifacts).
   *  2. Si pesa más de 900KB (límite Firestore), reintenta a 200 DPI, luego 160 DPI.
   *  3. Si AÚN pesa mucho, cae a JPEG q92 — última opción para no perder demasiado.
   *  4. Las imágenes se redimensionan a max 2200px ancho (más generoso que antes), q95.
   *  5. Detecta dimensiones del PDF en mm → auto-selecciona el paperSize que coincide
   *     → CERO distorsión por aspect ratio mismatch.
   */
  const subirDisenoCompleto = async (file: File) => {
    setSubiendoDiseno(true)
    setProgresoDiseno('Iniciando…')
    try {
      let dataUrl: string
      let widthMm: number | null = null
      let heightMm: number | null = null

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const { pdfFileToImageDataUrl } = await import('@/lib/pdf-to-image')

        // Intento 1: PNG 300 DPI (calidad de impresión). Con Storage el peso no
        // importa → se conserva la máxima nitidez. Las reducciones de abajo SOLO
        // aplican si NO hay Storage (para caber en el documento Firestore).
        let result = await pdfFileToImageDataUrl(file, {
          dpi: 300, quality: 0.95, type: 'image/png',
          onProgress: setProgresoDiseno, timeoutMs: 60_000,
        })
        // Sin Storage y pesa demasiado: PNG 200 DPI
        if (!storage && result.sizeBytes > 900_000) {
          setProgresoDiseno('Reduciendo tamaño (200 DPI)…')
          result = await pdfFileToImageDataUrl(file, {
            dpi: 200, quality: 0.95, type: 'image/png',
            onProgress: setProgresoDiseno, timeoutMs: 60_000,
          })
        }
        // Sin Storage y aún pesa: PNG 160 DPI
        if (!storage && result.sizeBytes > 900_000) {
          setProgresoDiseno('Reduciendo tamaño (160 DPI)…')
          result = await pdfFileToImageDataUrl(file, {
            dpi: 160, quality: 0.95, type: 'image/png',
            onProgress: setProgresoDiseno, timeoutMs: 60_000,
          })
        }
        // Último recurso (sin Storage): JPEG alta calidad
        if (!storage && result.sizeBytes > 900_000) {
          setProgresoDiseno('Optimizando (JPEG alta calidad)…')
          result = await pdfFileToImageDataUrl(file, {
            dpi: 200, quality: 0.92, type: 'image/jpeg',
            onProgress: setProgresoDiseno, timeoutMs: 60_000,
          })
        }
        /**
         * EL TOPE QUE FALTABA: el cuerpo de la petición, no el disco.
         *
         * Las reducciones de arriba sólo corrían `if (!storage)`, con este
         * razonamiento: «con Storage el peso no importa». Sí importa: la imagen
         * no viaja directo a Storage, va en base64 dentro de un JSON por una
         * función con un tope duro de request. Una hoja carta a 300 DPI lo pasa
         * de sobra, así que CON Storage la subida moría antes de llegar.
         */
        const reducido = await reducirDataUrlSiPesa(result.dataUrl, 2_500_000, 'image/png')
        dataUrl = reducido.dataUrl
        widthMm = result.widthMm
        heightMm = result.heightMm
      } else if (file.type.startsWith('image/')) {
        setProgresoDiseno('Optimizando imagen…')
        // Mucho mejor que antes: 2200px de ancho máx, q95
        const result = await resizeImageFile(file, {
          maxWidth: 2600, maxHeight: 3500, quality: 0.95,
          type: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        })
        dataUrl = result.dataUrl
        // Aproximamos el tamaño mm asumiendo 96 DPI (escaneados típicos)
        widthMm = (result.width * 25.4) / 96
        heightMm = (result.height * 25.4) / 96
      } else {
        toast('Sube un PDF o una imagen (PNG/JPG)', 'error')
        return
      }

      // NITIDEZ: subir el diseño en ALTA RESOLUCIÓN a Storage vía el SERVIDOR
      // (Admin SDK) y servirlo por el proxy same-origin. Nunca se queda como base64
      // en el doc de config. Si falla, avisamos con la causa real.
      setProgresoDiseno('Subiendo en alta resolución…')
      let srcFinal: string
      try { srcFinal = (await subirImagenServidor(dataUrl, 'diseno')) ?? dataUrl }
      catch (err) { toast(`No se pudo subir el diseño: ${(err as Error).message}`, 'error'); setProgresoDiseno(''); return }

      // Auto-detectar tamaño de papel para evitar distorsión por aspect ratio
      let nuevoPaperSize = rx.paperSize
      let auto = false
      if (widthMm && heightMm) {
        const detectado = detectarPaperSize(widthMm, heightMm)
        if (detectado && detectado !== rx.paperSize) {
          nuevoPaperSize = detectado
          auto = true
        }
      }

      actualizar({
        disenoCompletoDataUrl: srcFinal,
        paperSize: nuevoPaperSize,
        // Dimensiones EXACTAS del membrete → la hoja las usa para que la imagen la
        // llene sin bordes blancos y los datos calibrados caigan en su sitio.
        ...(widthMm && heightMm ? { disenoWidthMm: Math.round(widthMm), disenoHeightMm: Math.round(heightMm) } : {}),
      })
      if (auto) {
        toast(`Tu formato quedó cargado · papel ajustado a ${PAPER_SIZES[nuevoPaperSize].label}`, 'success')
      } else {
        toast('Tu formato quedó cargado', 'success')
      }

      /*
        Y AHORA LO QUE ANTES ERA UN CLIC QUE NADIE ENCONTRABA.

        Colocar Nombre, Edad, Fecha… era el paso donde el Dr. dijo que sus
        clientes se batallan. La pantalla ya sabía hacerlo sola —el botón
        «Detectar los campos» existía desde hace meses— pero había que verlo,
        entenderlo y pulsarlo, dentro de una tarjeta que sólo aparecía DESPUÉS
        de subir. Se lanza aquí, sin pedir permiso: el resultado es visible y
        cada etiqueta se puede arrastrar, así que no viola «nada cambia en
        silencio» — no hay nada previo que sobrescribir.

        Si falla, no se dice nada: el médico ve las etiquetas sin colocar y el
        botón para reintentar. Un aviso de error en mitad de una subida que sí
        funcionó sólo asusta.
      */
      setDetectandoCampos(true)
      const alto = PAPER_SIZES[nuevoPaperSize]?.heightMm
      const leido = await detectarCamposDelDiseno(srcFinal, heightMm ?? alto)
      setDetectandoCampos(false)
      if (leido) {
        actualizar(prev => ({
          ...prev,
          disenoCampos: { ...(prev.disenoCampos ?? {}), ...leido.campos },
          ...(leido.margenes ? { disenoMargenes: leido.margenes } : {}),
        }))
        setCamposDetectados(Object.keys(leido.campos).length)
      }
    } catch (e) {
      console.error('[disenoCompleto] error:', e)
      toast(`No se pudo procesar: ${(e as Error).message}`, 'error')
    } finally {
      setSubiendoDiseno(false)
      setProgresoDiseno('')
    }
  }

  if (!clinicId) return <div style={{ color: 'var(--text3)' }}>Cargando…</div>

  // Sin dropdown cuando: eres el médico logueado, o solo hay UN médico. El selector
  // solo aparece si hay 2+ médicos y un admin (sin ficha) configura a nombre de otros.
  const soyDoctor = doctores.find(d => d.email && d.email === auth.currentUser?.email)
  const medicoUnico = soyDoctor ?? (doctores.length === 1 ? doctores[0] : undefined)

  // El paso 1 está resuelto con papel propio subido, con un membrete cargado o
  // cuando el médico declara que no tiene papel impreso. No se marca solo por
  // haber entrado: un paso que se da por hecho sin que nadie haga nada no es un
  // paso, es un adorno.
  const paso1Listo = !!rx.disenoCompletoDataUrl || !!rx.membreteDataUrl || sinPapelPropio
  // Un guardado que el servidor aceptó pero que la verificación desmintió deja
  // la barra puesta: si no, el médico se queda con un aviso rojo y sin botón.
  const hayQueGuardar = sucio || (!!resultado && !resultado.ok)

  return (
    <div className="recetas-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 20, alignItems: 'start' }}>
      {/* Los tres pasos. Todo lo demás vive plegado. */}
      <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>

        {/*
          A QUIÉN LE ESTOY CONFIGURANDO LA RECETA — sólo cuando hay más de uno.

          Esto era una tarjeta con marco propio, en la que un médico solo, en su
          consultorio, leía «Tu receta · Dr. Fulano» y debajo «cada médico tiene
          la suya, estos cambios aplican SOLO a este médico». Una respuesta
          completa a una pregunta que nadie con un único médico se hace, ocupando
          el sitio del primer paso.

          Con dos o más médicos la pregunta sí existe —y con ella el riesgo real
          de configurarle la receta a otro—, así que ahí se dice, y en el caso del
          admin sin ficha se ofrece el selector.
        */}
        {doctores.length > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 10,
          }}>
            {medicoUnico ? (
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                Estás configurando <strong>tu</strong> receta · {medicoUnico.nombre}. No afecta a la de los demás médicos.
              </span>
            ) : (<>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Receta de:</span>
              <select
                aria-label="Médico al que aplica esta receta"
                value={medicoSel}
                onChange={(e) => setMedicoSel(e.target.value)}
                style={{ ...cfgInput, width: 'auto', minWidth: 220 }}
              >
                {doctores.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}{config?.recetasPorMedico?.[d.id] ? ' · personalizada' : ''}</option>
                ))}
              </select>
              <span style={{ fontSize: 10.5, color: 'var(--text3)', flexBasis: '100%' }}>
                Cada médico tiene su propia receta: esto aplica SOLO a las recetas y órdenes de quien elijas.
              </span>
            </>)}
          </div>
        )}

        {/*
          PASO 1 — el papel. Esta tarjeta se llamaba «Usa TU propia receta» y
          venía la TERCERA, debajo de una guía de seis pasos y de un aviso de a
          quién aplica. Es lo primero que hay que hacer: ahora es lo primero
          que se ve, y ya no comparte sitio con nada.
        */}
        <Paso
          n={1}
          titulo="Tu papel de receta"
          descripcion="Sube una foto o un PDF de la receta que ya usas. Queda de fondo y nosotros encimamos los datos del paciente, el tratamiento y tu firma."
          listo={paso1Listo}
        >
          {rx.disenoCompletoDataUrl ? (
            <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
              <div style={{ background: '#fff', borderRadius: 6, padding: 6, border: '1px solid var(--border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rx.disenoCompletoDataUrl} alt="Tu formato de receta"
                  style={{ width: '100%', maxHeight: 150, objectFit: 'contain', display: 'block' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                {/*
                  LO QUE LA APP RESOLVIÓ SOLA, DICHO EN VOZ ALTA.

                  Colocar Nombre, Edad, Fecha… era el trabajo que el Dr. señaló
                  como el que más se batalla. Ya no se pide: se hace al subir. Y
                  se cuenta aquí, porque una ayuda que actúa sin decirlo deja al
                  médico sin saber si hacía falta revisar algo.
                */}
                {detectandoCampos ? (
                  <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    Leyendo tu formato para colocar los datos…
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                    Papel de {Math.round(rx.disenoWidthMm ?? PAPER_SIZES[rx.paperSize ?? 'media-carta'].widthMm)} ×{' '}
                    {Math.round(rx.disenoHeightMm ?? PAPER_SIZES[rx.paperSize ?? 'media-carta'].heightMm)} mm.{' '}
                    {camposDetectados !== null
                      ? `Colocamos ${camposDetectados} dato(s) sobre tu formato — compruébalo en la vista previa.`
                      : 'Comprueba en la vista previa que los datos caigan en su sitio.'}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setVerCalibrador(v => !v)}
                    className="btn btn-secondary btn-sm"
                    aria-expanded={verCalibrador}
                  >
                    <UserRound size={13} /> {verCalibrador ? 'Ocultar los datos' : 'Ajustar dónde caen los datos'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCamposDetectados(null)
                      setVerCalibrador(false)
                      actualizar(prev => ({
                        // '' en vez de delete: Firestore con merge:true NO elimina
                        // campos ausentes — el diseño viejo "reaparecía". Vacío SÍ
                        // sobreescribe. (RecetaDocumento trata '' como sin diseño.)
                        ...prev,
                        disenoCompletoDataUrl: '',
                        disenoMargenes: undefined,
                        disenoSoloRx: false,
                        disenoCampos: undefined,
                      }))
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    <IconX size={13} /> Quitar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <label style={{
              display: 'block', textAlign: 'center', padding: '26px 14px',
              border: '2px dashed color-mix(in srgb, var(--nexus) 50%, transparent)', borderRadius: 10,
              background: 'color-mix(in srgb, var(--nexus) 6%, transparent)', cursor: subiendoDiseno ? 'wait' : 'pointer',
              color: 'var(--text2)',
            }}>
              {subiendoDiseno ? (
                <>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{progresoDiseno || 'Procesando…'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                    La primera vez puede tardar unos segundos.
                  </div>
                </>
              ) : (
                <>
                  <Upload size={20} style={{ marginBottom: 6, color: 'var(--nexus)' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Sube tu receta</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>PDF o foto (PNG/JPG) · en blanco, con tu logo y tus datos</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                    Medimos tu hoja y colocamos los datos solos.
                  </div>
                </>
              )}
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                disabled={subiendoDiseno}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDisenoCompleto(f) }}
                style={{ display: 'none' }}
              />
            </label>
          )}

          {/* Sin papel propio no hay nada que subir, y decirlo CIERRA el paso: si
              no, la tarjeta se queda marcada como pendiente para siempre. */}
          {!rx.disenoCompletoDataUrl && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={sinPapelPropio}
                onChange={(e) => {
                  setSinPapelPropio(e.target.checked)
                  // Sin papel propio, lo único que queda por decidir es el
                  // aspecto del que genera la app — así que se abre solo. Un
                  // consejo que dice «ve a otro sitio» cuesta el mismo clic que
                  // no dárselo, y encima hay que encontrarlo.
                  if (e.target.checked) setVerAvanzados(true)
                }}
                style={{ width: 16, height: 16, marginTop: 1, accentColor: 'var(--nexus)' }}
              />
              <span>
                No tengo receta impresa — usen un encabezado con los datos de mi consultorio.
                {sinPapelPropio && ' Abajo, en «Ajustes avanzados», eliges el estilo y el color.'}
              </span>
            </label>
          )}

          {verCalibrador && rx.disenoCompletoDataUrl && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserRound size={14} className="ds-icon" /> Ajustar dónde caen los datos
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                Ya los colocamos al subir tu formato. Si alguno no cayó donde debía, arrástralo:
                Arrastra <strong>Nombre, Edad, F. nacimiento, Sexo, Fecha, Folio, Firma/sello y QR</strong> al lugar
                EXACTO de tu receta, y quita con ✕ los que tu papel no lleve.
              </div>
              <CalibradorReceta
                disenoUrl={rx.disenoCompletoDataUrl}
                campos={rx.disenoCampos}
                onChange={(c) => actualizar({ disenoCampos: c })}
                paperHeightMm={PAPER_SIZES[rx.paperSize ?? 'media-carta'].heightMm}
                onDetectado={(campos, margenes) => actualizar(prev => ({
                  ...prev,
                  disenoCampos: campos,
                  ...(margenes ? { disenoMargenes: margenes } : {}),
                }))}
              />
              {/* La pregunta que va JUSTO aquí: si el papel ya trae las líneas
                  impresas, colocarlas otra vez las duplica sobre el original. */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
                padding: 10, background: 'color-mix(in srgb, var(--nexus) 6%, transparent)', borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--nexus) 25%, transparent)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={rx.disenoSoloRx === true}
                  onChange={(e) => actualizar({ disenoSoloRx: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: 'var(--nexus)' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Mi papel ya trae los datos del paciente
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>
                    Si tu receta ya trae líneas impresas para Nombre, Edad, Fecha…, activa esto:
                    sólo se encima el tratamiento en la zona libre de tu papel.
                  </div>
                </div>
              </label>

              {/* Tamaños de firma/sello y QR (mm) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={cfgLabel}>Tamaño firma / sello: {rx.disenoTamanos?.firma ?? 20} mm</label>
                  <input type="range" min={10} max={50} step={1} value={rx.disenoTamanos?.firma ?? 20}
                    onChange={(e) => actualizar({ disenoTamanos: { ...rx.disenoTamanos, firma: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={cfgLabel}>Tamaño QR: {rx.disenoTamanos?.qr ?? 14} mm</label>
                  <input type="range" min={8} max={40} step={1} value={rx.disenoTamanos?.qr ?? 14}
                    onChange={(e) => actualizar({ disenoTamanos: { ...rx.disenoTamanos, qr: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}
        </Paso>

        {/*
          PASO 2 — la firma. Vivía en una tarjeta suelta al final de la pantalla,
          con su propio encabezado y su propio consejo, detrás de nueve tarjetas
          de ajustes. Es el segundo de los tres pasos que hay: va aquí.
        */}
        <Paso
          n={2}
          titulo="Tu firma y tu sello"
          descripcion="Aparece sobre la línea de firma de tus recetas, órdenes y notas. Se guarda sola al subirla."
          listo={firmaLista}
        >
          {firmaSlot}
        </Paso>

        {/*
          PASO 3 — la prueba. Es el único paso que dice si los dos anteriores
          sirvieron, y hasta hoy era un botón pequeño encima de la vista previa.
        */}
        <Paso
          n={3}
          titulo="Imprime una prueba"
          descripcion="Sale una receta de ejemplo, a tamaño real. Compárala contra tu papel ANTES de usarla con un paciente."
          listo={pruebaOk}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => imprimirPruebaRef.current()} className="btn btn-primary">
              <Printer size={14} /> Imprimir una prueba
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>¿Salió igual que tu papel?</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setPruebaOk(true); setVerArreglos(false) }}
            >
              <Check size={13} /> Sí, ya quedó
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={verArreglos}
              onClick={() => { setPruebaOk(false); setVerArreglos(v => !v) }}
            >
              No cuadró
            </button>
          </div>

          {/* Los arreglos sólo salen cuando algo falló. Tres averías con su
              causa, y debajo los DOS controles que las resuelven. */}
          {verArreglos && (
            <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
              <GuiaConfigurarReceta />

              {/* Dónde se imprime físicamente — resuelve "no se imprime en formato receta".
                  Se oculta cuando la hoja NO cabe en carta (p. ej. la receta continua
                  apaisada de 25 × 15 cm, más ancha que la carta): ahí no hay elección
                  que hacer, se imprime a su tamaño real al 100 %. */}
              {rx.paperSize !== 'carta' && rx.paperSize !== 'oficio' && admiteHojaCarta(rx) && (
                <Section title="¿En qué papel imprime tu impresora?">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      { valor: 'carta' as const, titulo: 'Hoja carta + corte (recomendado)', desc: 'Funciona con CUALQUIER impresora. La receta sale arriba de la hoja carta con línea punteada para recortar.' },
                      { valor: 'papel-real' as const, titulo: 'Papel de receta exacto', desc: `Solo si tu impresora tiene cargado papel ${PAPER_SIZES[rx.paperSize].label.split(' (')[0].toLowerCase()}. Ojo: el diálogo de impresión debe ofrecer ese tamaño.` },
                    ]).map(op => {
                      const activo = (rx.imprimirEn ?? 'carta') === op.valor
                      return (
                        <button
                          key={op.valor}
                          onClick={() => actualizar({ imprimirEn: op.valor })}
                          style={{
                            padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                            background: activo ? 'var(--nexus-soft)' : 'var(--s2)',
                            border: activo ? '1px solid var(--teal)' : '1px solid var(--border)',
                            color: activo ? 'var(--teal)' : 'var(--text2)',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{op.titulo}</div>
                          <div style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.35 }}>{op.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}

              {rx.disenoCompletoDataUrl && (
                <div style={{ padding: 12, background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ruler size={14} className="ds-icon" /> Dónde cae el texto (mm)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                    Lo más fácil: <strong>arrastra el recuadro</strong> de la vista previa y <strong>jala sus bordes</strong>.
                    Estos números son para afinar al milímetro.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <MargenInput label="Arriba" value={rx.disenoMargenes?.top ?? 35} onChange={(v) => actualizar({ disenoMargenes: { ...defaultMargenes(rx), top: v } })} />
                    <MargenInput label="Abajo" value={rx.disenoMargenes?.bottom ?? 30} onChange={(v) => actualizar({ disenoMargenes: { ...defaultMargenes(rx), bottom: v } })} />
                    <MargenInput label="Izquierda" value={rx.disenoMargenes?.left ?? 12} onChange={(v) => actualizar({ disenoMargenes: { ...defaultMargenes(rx), left: v } })} />
                    <MargenInput label="Derecha" value={rx.disenoMargenes?.right ?? 12} onChange={(v) => actualizar({ disenoMargenes: { ...defaultMargenes(rx), right: v } })} />
                  </div>

                  {/*
                    Aviso ANTES de imprimir. Con márgenes que suman más que la hoja, el
                    área de contenido colapsa y —como cada hoja tiene overflow:hidden—
                    los medicamentos desaparecen del papel sin ningún error. El médico
                    se enteraba al entregarle una receta en blanco al paciente.
                  */}
                  {(() => {
                    const m = rx.disenoMargenes ?? defaultMargenes(rx)
                    const w = rx.disenoWidthMm ?? 140
                    const h = rx.disenoHeightMm ?? 190
                    if (!areaImpracticable(w, h, m)) return null
                    return (
                      <div style={{
                        marginTop: 10, background: 'color-mix(in srgb, var(--red) 8%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', borderRadius: 10,
                        padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)',
                      }}>
                        <strong>Estos márgenes no dejan espacio para los medicamentos.</strong>{' '}
                        Suman más que la hoja ({w}×{h} mm), así que la receta saldría sin el
                        tratamiento. Reduce Arriba o Abajo.
                      </div>
                    )
                  })()}
                  <div style={{ marginTop: 10 }}>
                    <label style={cfgLabel}>Tamaño de letra del contenido (px)</label>
                    <input aria-label="Tamaño de letra del contenido (px)"
                      type="range" min={8} max={16} step={0.5}
                      value={rx.disenoFontSize ?? 11}
                      onChange={(e) => actualizar({ disenoFontSize: parseFloat(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{rx.disenoFontSize ?? 11}px</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Paso>

        {/*
          TODO LO DEMÁS, PLEGADO.

          Son los cuatro bloques de siempre —el papel, cómo se ve, qué se imprime
          y los datos legales—, en el mismo orden y con las mismas tarjetas. Lo
          que cambia es que ya no están abiertos: nueve tarjetas de controles no
          son el trabajo del médico el día que configura su receta; son la
          excepción del día que quiere cambiar el color.
        */}
        <Avanzados abierto={verAvanzados} onToggle={() => setVerAvanzados(v => !v)}>
          {/* Tamaño de papel — SOLO recetas y órdenes. Las notas van SIEMPRE en carta
              (PAPEL_NOTA) y no leen nada de aquí: son ajustes independientes. */}
          <Grupo n={1} t="El papel" d="En qué hoja se imprime. Empieza por aquí: el resto de los ajustes se acomodan al tamaño que elijas." />
          <Section title="Tamaño de papel">
            <select
              value={rx.paperSize}
              /**
               * El tamaño elegido MANDA. Si hay un diseño propio subido, sus medidas
               * se re-encajan al tamaño elegido: antes el diseño ganaba en silencio y
               * elegir un tamaño no hacía nada visible (el Dr. elegía 25 × 15 y seguía
               * saliendo A5, sin explicación).
               */
              onChange={(e) => {
                const nuevo = e.target.value as PaperSizeT
                // En 'personalizado' manda lo que el médico ya escribió (si es usable).
                const p = (nuevo === 'personalizado'
                  ? papelPersonalizado(rx.paperCustomWidthMm, rx.paperCustomHeightMm)
                  : null) ?? PAPER_SIZES[nuevo]
                actualizar({
                  paperSize: nuevo,
                  ...(rx.disenoCompletoDataUrl ? { disenoWidthMm: p.widthMm, disenoHeightMm: p.heightMm } : {}),
                })
              }}
              style={cfgInput}
            >
              {(Object.keys(PAPER_SIZES) as PaperSizeT[]).map(k => (
                <option key={k} value={k}>{PAPER_SIZES[k].label}</option>
              ))}
            </select>
            {/* Medidas propias — para cualquier formato que no esté en la lista. */}
            {rx.paperSize === 'personalizado' && (() => {
              const w = rx.paperCustomWidthMm ?? 230
              const h = rx.paperCustomHeightMm ?? 130
              const valido = !!papelPersonalizado(w, h)
              const set = (nw: number, nh: number) => actualizar({
                paperCustomWidthMm: nw,
                paperCustomHeightMm: nh,
                // Si hay diseño propio subido, se re-encaja a la medida escrita:
                // si no, el diseño mandaría y escribir las medidas no haría nada.
                ...(rx.disenoCompletoDataUrl && papelPersonalizado(nw, nh)
                  ? { disenoWidthMm: Math.round(nw), disenoHeightMm: Math.round(nh) }
                  : {}),
              })
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <div style={cfgLabel}>Ancho (mm)</div>
                      <input type="number" min={PAPEL_MIN_MM} max={PAPEL_MAX_MM} value={w}
                        onChange={(e) => set(Number(e.target.value), h)} style={cfgInput} />
                    </div>
                    <div style={{ paddingBottom: 10, color: 'var(--text3)' }}>×</div>
                    <div style={{ flex: 1 }}>
                      <div style={cfgLabel}>Alto (mm)</div>
                      <input type="number" min={PAPEL_MIN_MM} max={PAPEL_MAX_MM} value={h}
                        onChange={(e) => set(w, Number(e.target.value))} style={cfgInput} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, marginTop: 6, color: valido ? 'var(--text3)' : 'var(--red)' }}>
                    {valido
                      ? `Tu receta mide ${(w / 10).toFixed(1)} × ${(h / 10).toFixed(1)} cm. Mídela con regla, de borde a borde.`
                      : `Medidas fuera de rango (${PAPEL_MIN_MM}–${PAPEL_MAX_MM} mm). Se usará 23 × 13 cm mientras tanto.`}
                  </div>
                </div>
              )
            })()}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
              Solo para <strong>recetas y órdenes médicas</strong>.
            </div>
          </Section>

          {/* Papel de las NOTAS — ajuste PROPIO e independiente del de la receta. */}
          <Section title="Tamaño de papel de las notas">
            <select
              value={rx.notaPaperSize ?? 'carta'}
              onChange={(e) => actualizar({ notaPaperSize: e.target.value as NotaPaperSizeT })}
              style={cfgInput}
            >
              {NOTA_PAPER_SIZES.map(k => (
                <option key={k} value={k}>{PAPER_SIZES[k].label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
              Notas de evolución, ingreso y egreso. Cambiarlo <strong>no</strong> afecta a la receta.
            </div>
          </Section>

          {/* Estilo visual */}
          <Grupo n={2} t="Cómo se ve" d="Estilo, color y tu membrete. Es la parte que el paciente reconoce como tuya." />
          <Section title="Estilo visual">
            <div className="nx-stat-grid" style={{ gap: 8 }}>
              {(Object.keys(ESTILOS_RECETA) as EstiloT[]).map(k => {
                const activo = rx.estilo === k
                return (
                  <button
                    key={k}
                    onClick={() => actualizar({ estilo: k })}
                    style={{
                      padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      background: activo ? 'var(--nexus-soft)' : 'var(--s2)',
                      border: activo ? '1px solid var(--teal)' : '1px solid var(--border)',
                      color: activo ? 'var(--teal)' : 'var(--text2)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{ESTILOS_RECETA[k].label}</div>
                    <div style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.3 }}>{ESTILOS_RECETA[k].descripcion}</div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Color de acento */}
          <Section title="Color de acento (líneas, encabezado)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={rx.colorAccento ?? '#14b8a6'}
                onChange={(e) => actualizar({ colorAccento: e.target.value })}
                style={{ width: 50, height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'var(--s2)' }}
              />
              <input
                value={rx.colorAccento ?? '#14b8a6'}
                onChange={(e) => actualizar({ colorAccento: e.target.value })}
                style={{ ...cfgInput, width: 110, fontFamily: 'monospace' }}
              />
            </div>
          </Section>

          {/* Membrete */}
          <Section title="Membrete (encabezado custom)">
            <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>
              Sube una imagen del encabezado de tu papel membretado (logo, nombre, datos del consultorio).
              Si no subes nada, se usa un encabezado generado con los datos de tu clínica.
            </p>
            {rx.membreteDataUrl ? (
              <div style={{ position: 'relative', border: '1px dashed var(--border)', borderRadius: 8, padding: 10, background: 'var(--s2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rx.membreteDataUrl} alt="Membrete" style={{ maxWidth: '100%', maxHeight: 120, display: 'block', margin: '0 auto', background: '#fff' }} />
                <button
                  onClick={() => actualizar({ membreteDataUrl: '' })}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'color-mix(in srgb, var(--red) 15%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                >
                  <IconX size={11} /> Quitar
                </button>
              </div>
            ) : (
              <label style={{
                display: 'block', textAlign: 'center', padding: '20px 12px',
                border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--s2)',
                cursor: 'pointer', color: 'var(--text3)',
              }}>
                <Upload size={20} style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Subir membrete</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>PNG o JPG · Máx 800 KB después de optimizar</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen('membreteDataUrl', f) }}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </Section>

          {/* Pie de página */}
          <Section title="Pie de página (opcional)">
            {rx.pieDataUrl ? (
              <div style={{ position: 'relative', border: '1px dashed var(--border)', borderRadius: 8, padding: 10, background: 'var(--s2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rx.pieDataUrl} alt="Pie" style={{ maxWidth: '100%', maxHeight: 60, display: 'block', margin: '0 auto', background: '#fff' }} />
                <button
                  onClick={() => actualizar({ pieDataUrl: '' })}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'color-mix(in srgb, var(--red) 15%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                >
                  <IconX size={11} /> Quitar
                </button>
              </div>
            ) : (
              <label style={{
                display: 'block', textAlign: 'center', padding: '14px 12px',
                border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--s2)',
                cursor: 'pointer', color: 'var(--text3)',
              }}>
                <Upload size={16} />
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Subir pie de página</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen('pieDataUrl', f) }}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </Section>

          {/* Opciones */}
          {/*
            C-004 — «y cuántas copias salen» prometía un control que no existe:
            `copiasEnHoja` no tiene input, ni impresión, ni lector. La frase se
            retira; el campo se queda en el tipo para no perder valores guardados
            y su retirada va en el handoff.
          */}
          <Grupo n={3} t="Qué se imprime" d="Qué datos del paciente aparecen en la hoja." />
          <Section title="Opciones">
            <div style={{ display: 'grid', gap: 8 }}>
              <Toggle label="Mostrar caja de alergias" checked={rx.mostrarAlergias !== false} onChange={(v) => actualizar({ mostrarAlergias: v })} />
              <Toggle label="Mostrar diagnóstico" checked={rx.mostrarDiagnostico !== false} onChange={(v) => actualizar({ mostrarDiagnostico: v })} />
              {/*
                C-003 — «Mostrar signos vitales (en órdenes)» RETIRADO.

                El interruptor se movía y no cambiaba nada: `mostrarSignosVitales`
                no aparece en `RecetaDocumento`, ni en la pantalla de la orden, ni
                en ningún impreso. Sus hermanos de esta misma caja
                (`mostrarDiagnostico`, `mostrarAlergias`, `mostrarQR`) sí se leen,
                y por eso éste engañaba especialmente bien: estaba en buena
                compañía.

                Se retira el CONTROL, no el dato guardado. Conectarlo a la orden
                exige tocar `src/app/(dashboard)/orden/**`, que es de otra
                rebanada: va en el handoff.
              */}
              <Toggle label="QR de verificación al pie" checked={rx.mostrarQR !== false} onChange={(v) => actualizar({ mostrarQR: v })} />
            </div>
          </Section>

          <Grupo n={4} t="Datos legales" d="RFC, registro para psicotrópicos, vigencia y el aviso al pie. Opcionales: sólo se imprimen si los llenas." />
          <Section title="Datos legales adicionales (opcional)">
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <label style={cfgLabel}>RFC</label>
                <input aria-label="RFC" value={rx.rfc ?? ''} onChange={(e) => actualizar({ rfc: e.target.value })} style={cfgInput} placeholder="RODR890101ABC" />
              </div>
              <div>
                <label style={cfgLabel}>Registro DGP/SSA (psicotrópicos)</label>
                <input aria-label="Registro DGP/SSA (psicotrópicos)" value={rx.registroDGP ?? ''} onChange={(e) => actualizar({ registroDGP: e.target.value })} style={cfgInput} placeholder="Para Rx de medicamentos controlados" />
              </div>
              <div>
                <label style={cfgLabel}>Vigencia default (días)</label>
                <input aria-label="Vigencia default (días)" type="number" value={rx.vigenciaDias ?? 30} onChange={(e) => actualizar({ vigenciaDias: parseInt(e.target.value) || 30 })} style={cfgInput} min={1} max={365} />
              </div>
              <div>
                <label style={cfgLabel}>Aviso legal al pie</label>
                <textarea aria-label="Aviso legal al pie" value={rx.avisoLegal ?? ''} onChange={(e) => actualizar({ avisoLegal: e.target.value.slice(0, 240) })} rows={2} style={{ ...cfgInput, resize: 'vertical' }} />
              </div>
            </div>
          </Section>

          {/* La hoja membretada de las NOTAS: otro papel, otros márgenes. */}
          {notasSlot}
        </Avanzados>

        {resultado && (
          <div className={`alert ${resultado.ok ? 'alert-green' : 'alert-red'}`} role="status"
            style={{ fontSize: 13, marginBottom: 10 }}>
            {resultado.ok ? <Check size={15} className="alert-icon" /> : <AlertTriangle size={15} className="alert-icon" />}
            <div>{resultado.texto}</div>
          </div>
        )}

        {/*
          LA BARRA DE GUARDADO SE QUEDA A LA VISTA MIENTRAS HAYA QUE GUARDAR.

          El botón estaba al final de la pantalla más larga de la aplicación. El
          Dr. reportó dos veces «no se guarda el template»: las dos veces el
          guardado funcionaba y lo que fallaba era llegar al botón. Ahora sale
          sólo cuando hay algo pendiente, y se queda pegado abajo hasta que se
          resuelve — incluido el caso en el que el servidor aceptó la escritura
          pero la verificación encontró campos que no quedaron.
        */}
        {hayQueGuardar && (
          <div style={{
            position: 'sticky', bottom: 12, zIndex: 2,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--border2)', background: 'var(--s2)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, minWidth: 120 }}>
              Tienes cambios sin guardar.
            </span>
            <button onClick={guardar} disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={14} /> Guardar</>}
            </button>
          </div>
        )}
      </div>

      {/* Preview en vivo — contenedor de ancho fijo, escala dinámica */}
      <PreviewReceta
        tipoPreview={tipoPreview}
        setTipoPreview={setTipoPreview}
        rx={rx}
        config={config}
        onMargenes={(mg) => actualizar({ disenoMargenes: mg })}
        registrarImprimir={(fn) => { imprimirPruebaRef.current = fn }}
      />

      {/* CSS responsive — colapsa preview en pantallas pequeñas */}
      <style>{`
        @media (max-width: 1000px) {
          .recetas-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Preview con escala dinámica que SIEMPRE cabe en su contenedor (ancho fijo 360px).
 * Calcula la escala según el tamaño de papel para que la receta se vea proporcional
 * sin desbordar el layout — independientemente de si eliges media-carta u oficio.
 *
 * También dibuja una GUÍA VISUAL (rectángulo translúcido cian) sobre el diseño
 * custom mostrando dónde caen los datos. Así el médico calibra sin adivinar.
 */
function PreviewReceta({
  tipoPreview, setTipoPreview, rx, config, onMargenes, registrarImprimir,
}: {
  tipoPreview: 'receta' | 'orden'
  setTipoPreview: (t: 'receta' | 'orden') => void
  rx: RecetaConfig
  config: ClinicConfig | null
  onMargenes: (m: { top: number; right: number; bottom: number; left: number }) => void
  /** Entrega la impresión de prueba al paso 3, que es donde se pulsa. */
  registrarImprimir?: (fn: () => void) => void
}) {
  const { toast } = useToast()
  const paper = PAPER_SIZES[rx.paperSize ?? 'media-carta']

  /**
   * LA MISMA HOJA QUE SALE DE LA IMPRESORA, Y NI UNA MEDIDA CALCULADA AQUÍ.
   *
   * Esta vista previa tenía su propia copia de TRES cálculos que ya existían:
   * orientar el papel al diseño subido, escalar para que quepa en la columna, y
   * dibujar el marco. Y la copia se desincronizó por el sitio menos visible: el
   * documento se dibuja sobre HOJA CARTA cuando `imprimirEn` es 'carta' —el
   * modo por defecto, el que funciona en cualquier impresora— y el marco se
   * seguía dimensionando a la receta. Resultado: la receta salía recortada por
   * la derecha en cuanto el médico abría la pantalla, antes de tocar nada.
   *
   * Ahora las tres respuestas se piden a quien ya las tenía:
   *   · `useRecetaPaperOrientado` — el mismo hook que usa /receta.
   *   · `dimensionesImpresion`    — la hoja FÍSICA, con host de carta incluido.
   *   · `RecetaPreviewWrapper`    — el marco, con su escala.
   */
  const paperOri = useRecetaPaperOrientado(rx)
  const rxOri = useMemo(
    () => ({ ...rx, disenoWidthMm: paperOri.widthMm, disenoHeightMm: paperOri.heightMm }),
    [rx, paperOri.widthMm, paperOri.heightMm],
  )
  const host = dimensionesImpresion(rxOri)
  const colocacion = colocacionDeLaReceta(rxOri)

  const TARGET_WIDTH = 340
  const TARGET_MAX_HEIGHT = 520
  const scale = escalaDeVistaPrevia({
    paperWidthMm: host.widthMm, paperHeightMm: host.heightMm,
    maxWidth: TARGET_WIDTH, maxHeight: TARGET_MAX_HEIGHT,
  })

  const margenes = rx.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
  const usarGuia = !!rx.disenoCompletoDataUrl

  // Datos ficticios compartidos por la vista previa y la impresión de prueba.
  const demoData: RecetaData = {
    tipo: tipoPreview,
    folio: 'RX-DEMO-01',
    fecha: new Date(),
    paciente: { id: 'demo', nombre: 'Juan Pérez García', edad: 42, fechaNacimiento: '1984-03-15', sexo: 'Masculino', telefono: '614 123 4567', alergias: 'Penicilina', noShowCount: 0, cancelacionCount: 0, createdAt: '', updatedAt: '', creadoPor: '' } as Patient,
    diagnostico: 'Faringitis aguda (J02.9)',
    medicamentos: tipoPreview === 'receta' ? [
      { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'Cada 8 horas', duracion: '7 días', indicacion: 'Tomar con alimentos' },
      { nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'Cada 6 hrs si dolor o fiebre', duracion: '5 días' },
    ] : undefined,
    estudios: tipoPreview === 'orden' ? ['Biometría hemática completa', 'PCR cuantitativa', 'Cultivo faríngeo'] : undefined,
    indicaciones: 'Reposo relativo, hidratación abundante. Acudir a control en 5 días.',
    notaParaPaciente: 'Si presenta fiebre >39°C, acudir a urgencias.',
  }

  // Auditoría papelería 2026-07 (P2): la prueba debe usar EXACTAMENTE el mismo
  // flujo que la impresión que recibe el paciente (imprimirElemento + popup +
  // dimensiones reales), no window.print sobre la pantalla de config. Antes probaba
  // un camino distinto y en otro tamaño, así que "se veía bien en la prueba" no
  // garantizaba nada del impreso real.
  const imprimirPrueba = () => {
    // `host` ya son las dimensiones ORIENTADAS al diseño y con el host de carta
    // resuelto — las mismas con las que se dibuja la vista previa y las mismas
    // que usa /receta. Lo que se prueba es lo que se imprime.
    imprimirElemento(document.getElementById('zona-print-receta-inner'), 'Prueba de receta', {
      anchoMm: host.widthMm, altoMm: host.heightMm, hojaExacta: true, onError: (m) => toast(m, 'error'),
    })
  }

  // Se re-entrega en cada render para que el paso 3 llame SIEMPRE a la versión
  // con las medidas actuales (sin lista de dependencias: cambian con cada ajuste).
  useEffect(() => { registrarImprimir?.(imprimirPrueba) })

  return (
    <div style={{ position: 'sticky', top: 20 }}>
      {/* Qué hoja se está viendo. Con host de carta se DICE, porque si no la
          vista previa parece equivocada: el médico eligió media carta y ve una
          hoja carta con su receta centrada — que es exactamente lo que va a
          salir de la impresora, y por eso hay que nombrarlo. */}
      <div style={{ fontSize: 10.5, color: 'var(--text3)', textAlign: 'center', marginBottom: 8, lineHeight: 1.5 }}>
        Vista previa · {rx.disenoCompletoDataUrl
          ? `tu formato de ${Math.round(paperOri.widthMm)} × ${Math.round(paperOri.heightMm)} mm${paperOri.apaisado ? ', apaisado' : ''}`
          : paper.label}
        {host.esHostCarta && (
          <><br />Sale en hoja carta, con línea de corte ✂</>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setTipoPreview('receta')}
          style={{
            padding: '6px 14px', minHeight: 44, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: tipoPreview === 'receta' ? 'color-mix(in srgb, var(--nexus) 15%, transparent)' : 'var(--s2)',
            border: tipoPreview === 'receta' ? '1px solid var(--teal)' : '1px solid var(--border)',
            color: tipoPreview === 'receta' ? 'var(--teal)' : 'var(--text3)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <Pill size={12} /> Receta
        </button>
        <button
          onClick={() => setTipoPreview('orden')}
          style={{
            padding: '6px 14px', minHeight: 44, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: tipoPreview === 'orden' ? 'rgba(167,139,250,0.15)' : 'var(--s2)',
            border: tipoPreview === 'orden' ? '1px solid #a78bfa' : '1px solid var(--border)',
            color: tipoPreview === 'orden' ? '#a78bfa' : 'var(--text3)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <ClipboardList size={12} /> Orden
        </button>
      </div>

      {/* El marco es el MISMO componente que usan /receta y /orden, dimensionado
          a la hoja física. Ya no hay un contenedor propio de esta pantalla. */}
      <RecetaPreviewWrapper
        paperWidthMm={host.widthMm}
        paperHeightMm={host.heightMm}
        maxWidth={TARGET_WIDTH}
        maxHeight={TARGET_MAX_HEIGHT}
      >
        <RecetaDocumento
          data={demoData}
          config={config ?? null}
          recetaConfig={rx}
        />
        {/* ZONA DE CONTENIDO INTERACTIVA: se ARRASTRA para mover y se JALA de los
            bordes para estirar. Actualiza disenoMargenes (mm) en vivo — mucho más
            fácil que teclear los 4 números. Solo con diseño propio subido.

            Va dentro de una caja colocada donde CAE LA RECETA en la hoja física:
            con host de carta la receta está centrada y agrandada dentro de ella,
            así que un recuadro dibujado sobre la hoja entera caería en otro
            sitio — y los márgenes que el médico arrastrara no serían los que se
            imprimen. La colocación la da `colocacionDeLaReceta`, la misma que
            usa el documento para dibujarse. */}
        {usarGuia && (
          <div style={{
            position: 'absolute',
            left: `${colocacion.offsetXMm}mm`,
            top: `${colocacion.offsetYMm}mm`,
            width: `${colocacion.recetaWidthMm}mm`,
            height: `${colocacion.recetaHeightMm}mm`,
            transform: `scale(${colocacion.escala})`,
            transformOrigin: 'top left',
          }}>
            <ZonaContenidoEditable
              m={margenes}
              paperWmm={colocacion.recetaWidthMm}
              paperHmm={colocacion.recetaHeightMm}
              /* Dos escalas encadenadas: la de la vista previa y la que agranda
                 la receta dentro de la carta. El arrastre convierte píxeles a
                 milímetros de RECETA, que es en lo que se guardan los márgenes. */
              scale={scale * colocacion.escala}
              onChange={onMargenes}
            />
          </div>
        )}
      </RecetaPreviewWrapper>

      {/* Nota informativa sobre la guía */}
      {usarGuia && (
        <div style={{
          fontSize: 10.5, color: 'var(--text3)', marginTop: 8, textAlign: 'center', lineHeight: 1.4,
        }}>
          El recuadro cian muestra dónde caen los datos.<br />
          Ajusta los márgenes hasta que NO se sobreponga al diseño impreso.
        </div>
      )}

      {/* Receta a TAMAÑO FÍSICO REAL — oculta en pantalla, visible SOLO al imprimir
          (el CSS de impresión con body.print-solo-receta muestra únicamente esto). */}
      <div id="zona-print-receta" style={{ display: 'none' }}>
        {/* La caja mide la hoja FÍSICA (la misma que `imprimirPrueba` declara al
            @page), no la receta: si no, con host de carta el nodo que se manda a
            imprimir sería más chico que su contenido. */}
        <div id="zona-print-receta-inner" style={{ width: (host.widthMm * 96) / 25.4, height: (host.heightMm * 96) / 25.4, position: 'relative', background: '#fff' }}>
          <RecetaDocumento data={demoData} config={config ?? null} recetaConfig={rx} />
        </div>
      </div>
    </div>
  )
}

/**
 * UN PASO — una tarjeta numerada, con UNA cosa que hacer dentro.
 *
 * ── QUÉ SUSTITUYE ───────────────────────────────────────────────────────────
 *
 * La pantalla tenía una guía de seis pasos ARRIBA y, debajo, once tarjetas de
 * controles sin relación declarada con esos pasos. El médico leía «sube tu
 * papel membretado» y luego buscaba, entre once tarjetas, en cuál se hacía eso.
 * Los pasos y los controles estaban separados por toda la pantalla.
 *
 * Aquí el paso ES el control: el número, lo que se consigue, y dentro lo único
 * que hay que tocar. Tres pasos, no seis, porque tres son los trabajos reales
 * —el papel, la firma, la prueba— y los otros tres eran instrucciones para
 * manejar la propia pantalla.
 *
 * `listo` no es decoración: sin él, un médico que ya configuró todo vuelve a
 * ver tres tareas pendientes cada vez que entra.
 */
function Paso({ n, titulo, descripcion, listo, children }: {
  n: number
  titulo: string
  descripcion: string
  listo?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={`Paso ${n}: ${titulo}`}
      style={{
        border: listo ? '1px solid color-mix(in srgb, var(--nexus) 35%, transparent)' : '1px solid var(--border)',
        borderRadius: 10, background: 'var(--s1)', padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0, width: 24, height: 24, borderRadius: 'var(--r-circulo)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
            background: listo ? 'var(--nexus-solido)' : 'color-mix(in srgb, var(--nexus) 14%, transparent)',
            color: listo ? '#fff' : 'var(--nexus)',
          }}
        >
          {listo ? <Check size={14} /> : n}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{titulo}</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '3px 0 0', lineHeight: 1.5 }}>{descripcion}</p>
        </div>
        {listo && (
          <span style={{
            flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '3px 10px',
            borderRadius: 'var(--r-pill)', color: 'var(--nexus)',
            background: 'color-mix(in srgb, var(--nexus) 14%, transparent)',
          }}>
            Listo
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * LO QUE CASI NADIE NECESITA, DETRÁS DE UN CLIC.
 *
 * Dentro siguen los cuatro bloques de siempre, en el mismo orden. Plegar no es
 * esconder: es aceptar que el 95 % de las veces que se abre esta pantalla es
 * para subir un papel o una firma, no para cambiar el aviso legal al pie.
 *
 * Se pliega, no se quita: cada uno de esos controles resuelve un caso real y
 * quitarlo dejaría a alguien sin salida. El sitio de un ajuste raro es detrás
 * de un clic, no fuera del producto.
 */
function Avanzados({ abierto, onToggle, children }: {
  abierto: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s1)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
        }}
      >
        <Settings2 size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, display: 'block' }}>Ajustes avanzados</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Tamaño de papel, estilo, qué datos se imprimen y datos legales
          </span>
        </span>
        <ChevronDown
          size={18}
          style={{
            color: 'var(--text3)', flexShrink: 0,
            transition: 'transform var(--mov-rapido) var(--mov-curva)',
            transform: abierto ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>
      {abierto && <div style={{ padding: '0 14px 14px', display: 'grid', gap: 14 }}>{children}</div>}
    </div>
  )
}

/**
 * ENCABEZADO DE GRUPO — la jerarquía que le faltaba a esta pestaña.
 *
 * Había NUEVE tarjetas idénticas, una debajo de otra, todas con el mismo peso
 * visual: tamaño de papel, papel de las notas, papel de la impresora, estilo,
 * color, membrete, pie, opciones y datos legales. Sin jerarquía, encontrar algo
 * es leerlas todas — y son cosas de naturalezas distintas: unas describen el
 * PAPEL FÍSICO, otras cómo se ve, otras qué se imprime, otras datos legales.
 *
 * El orden ya era el correcto; lo que faltaba era decir en voz alta dónde
 * empieza cada bloque.
 */
function Grupo({ n, t, d }: { n: number; t: string; d: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, color: 'var(--nexus)',
          background: 'color-mix(in srgb, var(--nexus) 14%, transparent)',
          borderRadius: 6, padding: '2px 7px', flexShrink: 0,
        }}>{n}</span>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t}</h3>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '4px 0 0 30px', lineHeight: 1.45 }}>{d}</p>
      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0 0' }} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--teal)', cursor: 'pointer' }} />
    </label>
  )
}


function defaultMargenes(rx: RecetaConfig) {
  return rx.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
}

/**
 * Editor DIRECTO de la zona de contenido sobre la vista previa.
 *
 * En vez de teclear Arriba/Abajo/Izquierda/Derecha en mm, el médico ARRASTRA el
 * recuadro para moverlo y JALA de los bordes/esquina para estirarlo. Los mm se
 * calculan del desplazamiento en pantalla (px ÷ (px/mm × escala)) y se guardan en
 * disenoMargenes. Todo con pointer events (funciona con mouse y con dedo).
 */
type Margenes = { top: number; right: number; bottom: number; left: number }
type ModoZona = 'move' | 'top' | 'bottom' | 'left' | 'right' | 'corner'
const PX_POR_MM = 96 / 25.4

function ZonaContenidoEditable({ m, paperWmm, paperHmm, scale, onChange }: {
  m: Margenes; paperWmm: number; paperHmm: number; scale: number; onChange: (m: Margenes) => void
}) {
  const drag = useRef<{ modo: ModoZona; x: number; y: number; m0: Margenes } | null>(null)
  const MIN = 10 // mm: ancho/alto mínimo de la zona de contenido

  /**
   * FALSA ALARMA del analizador, declarada.
   *
   * `react-hooks/refs` marca seis escrituras de este ref, pero todas ocurren
   * dentro de manejadores de eventos —al empezar y al mover el arrastre—, no
   * durante el render. Escribir un ref en un manejador es exactamente para lo
   * que existen los refs; la regla no puede probar que este closure es un
   * manejador y avisa por si acaso.
   *
   * Se silencia AQUÍ y con el motivo escrito, en vez de dejarla contando en el
   * techo: una deuda que no es deuda hace que el número deje de significar algo,
   * y entonces nadie mira el número.
   */
  /* eslint-disable react-hooks/refs -- escrituras dentro de manejadores de puntero, no en render */
  const iniciar = (modo: ModoZona) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    drag.current = { modo, x: e.clientX, y: e.clientY, m0: { ...m } }
    const mover = (ev: PointerEvent) => {
      const d = drag.current; if (!d) return
      const dxMm = (ev.clientX - d.x) / (PX_POR_MM * scale)
      const dyMm = (ev.clientY - d.y) / (PX_POR_MM * scale)
      const { m0 } = d
      const cl = (v: number) => Math.max(0, Math.round(v))
      let n: Margenes = { ...m0 }
      if (d.modo === 'move') {
        // Mueve la caja SIN cambiar su tamaño: top+bottom y left+right se compensan.
        // El desplazamiento se limita para que ningún margen quede negativo.
        const nx = Math.max(-m0.left, Math.min(m0.right, dxMm))
        const ny = Math.max(-m0.top, Math.min(m0.bottom, dyMm))
        n = { top: cl(m0.top + ny), bottom: cl(m0.bottom - ny), left: cl(m0.left + nx), right: cl(m0.right - nx) }
      } else {
        if (d.modo === 'top') n.top = cl(m0.top + dyMm)
        if (d.modo === 'bottom') n.bottom = cl(m0.bottom - dyMm)
        if (d.modo === 'left') n.left = cl(m0.left + dxMm)
        if (d.modo === 'right') n.right = cl(m0.right - dxMm)
        if (d.modo === 'corner') { n.right = cl(m0.right - dxMm); n.bottom = cl(m0.bottom - dyMm) }
      }
      // No dejar que la zona se cierre por completo.
      if (paperWmm - (n.left + n.right) < MIN) { n.left = m0.left; n.right = m0.right }
      if (paperHmm - (n.top + n.bottom) < MIN) { n.top = m0.top; n.bottom = m0.bottom }
      onChange(n)
    }
    const soltar = () => {
      drag.current = null
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const asa = (cursor: string, extra: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', background: 'var(--nexus)', borderRadius: 3, touchAction: 'none',
    cursor, zIndex: 2, ...extra,
  })

  return (
    <div
      onPointerDown={iniciar('move')}
      style={{
        position: 'absolute',
        top: `${m.top}mm`, right: `${m.right}mm`, bottom: `${m.bottom}mm`, left: `${m.left}mm`,
        border: '2px dashed var(--nexus)', background: 'color-mix(in srgb, var(--nexus) 10%, transparent)',
        borderRadius: 2, cursor: 'move', touchAction: 'none',
      }}
    >
      <div style={{ position: 'absolute', top: -22, left: 0, background: 'var(--nexus-solido)', color: '#000', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        ✥ arrastra · jala los bordes
      </div>
      {/* Asas de borde (centro de cada lado) */}
      <div onPointerDown={iniciar('top')}    style={asa('ns-resize', { top: -5, left: '50%', width: 26, height: 10, transform: 'translateX(-50%)' })} />
      <div onPointerDown={iniciar('bottom')} style={asa('ns-resize', { bottom: -5, left: '50%', width: 26, height: 10, transform: 'translateX(-50%)' })} />
      <div onPointerDown={iniciar('left')}   style={asa('ew-resize', { left: -5, top: '50%', width: 10, height: 26, transform: 'translateY(-50%)' })} />
      <div onPointerDown={iniciar('right')}  style={asa('ew-resize', { right: -5, top: '50%', width: 10, height: 26, transform: 'translateY(-50%)' })} />
      {/* Esquina inferior derecha */}
      <div onPointerDown={iniciar('corner')} style={asa('nwse-resize', { right: -6, bottom: -6, width: 14, height: 14, borderRadius: 4 })} />
    </div>
  )
  /* eslint-enable react-hooks/refs */
}

/* ── Seguridad Tab (2FA) ─────────────────────────────────────── */

function MargenInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" min={0} max={100} step={1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: '100%', padding: '4px 6px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--s2)',
            color: 'var(--text)', fontSize: 12,
          }}
        />
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>mm</span>
      </div>
    </div>
  )
}

/**
 * Sección para subir la firma + sello del médico.
 *
 * Se renderiza después automáticamente en:
 *  - Notas firmadas (vista imprimible)
 *  - Recetas (modo template y modo diseño custom)
 *  - Órdenes médicas
 *
 * Recomendado: PNG con FONDO TRANSPARENTE para que se vea bien sobre cualquier papel.
 * Si el médico sube un JPG, le agregamos fondo blanco igualmente.
 */
// ── Calibrador visual de receta: arrastra cada dato a su lugar exacto ──
const CAMPOS_RECETA = [
  { k: 'nombre', label: 'Nombre' }, { k: 'edad', label: 'Edad' },
  // Fecha de nacimiento: las farmacias la piden para dispensar.
  { k: 'nacimiento', label: 'F. nacimiento' },
  { k: 'sexo', label: 'Sexo' }, { k: 'fecha', label: 'Fecha' }, { k: 'folio', label: 'Folio' },
  { k: 'firma', label: 'Firma / sello' }, { k: 'qr', label: 'QR' },
] as const
type CampoRecetaK = typeof CAMPOS_RECETA[number]['k']
type CamposReceta = Partial<Record<CampoRecetaK, { x: number; y: number }>>
type MargenesMm = { top: number; right: number; bottom: number; left: number }

/**
 * LEE EL FORMATO DEL MÉDICO Y DICE DÓNDE CAE CADA DATO.
 *
 * Vivía dentro del botón «Detectar los campos» del calibrador. Se saca aquí
 * porque ahora tiene DOS llamadores: ese botón, y la subida del diseño — que
 * la lanza sola. Colocar ocho etiquetas a mano era el trabajo que el Dr.
 * señaló como el que más se batalla, y era un trabajo que la pantalla ya sabía
 * hacer detrás de un clic que nadie encontraba.
 *
 * Devuelve `null` cuando no se pudo leer: quien llama decide si eso es un
 * aviso (el botón) o un silencio (la subida, que sigue su curso y deja al
 * médico colocarlos a mano).
 */
async function detectarCamposDelDiseno(
  disenoUrl: string,
  paperHeightMm?: number,
): Promise<{ campos: CamposReceta; margenes?: MargenesMm } | null> {
  try {
    const resp = await fetch(disenoUrl)            // proxy same-origin o dataUrl
    const blob = await resp.blob()
    const mediaType = blob.type || 'image/png'
    const base64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '')
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    const res = await fetchAutenticado('/api/receta/detectar-campos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagenBase64: base64, mediaType }),
    })
    const data = await res.json()
    if (!data.ok || !(data.campos || data.cuerpo)) return null
    // El área de medicamentos (cuerpo) se convierte a márgenes (mm) para que la
    // lista NO se encime con el pie/firma del membrete.
    const margenes: MargenesMm | undefined = (data.cuerpo && paperHeightMm)
      ? {
          top: Math.round((data.cuerpo.top / 100) * paperHeightMm),
          bottom: Math.round(((100 - data.cuerpo.bottom) / 100) * paperHeightMm),
          right: 12, left: 12,
        }
      : undefined
    return { campos: (data.campos ?? {}) as CamposReceta, margenes }
  } catch {
    return null
  }
}

function CalibradorReceta({ disenoUrl, campos, onChange, onDetectado, paperHeightMm }: {
  disenoUrl: string
  campos?: CamposReceta
  onChange: (c: CamposReceta) => void
  onDetectado?: (campos: CamposReceta, margenes?: { top: number; right: number; bottom: number; left: number }) => void
  paperHeightMm?: number
}) {
  const { toast } = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const [arrastrando, setArrastrando] = useState<CampoRecetaK | null>(null)
  const [detectando, setDetectando] = useState(false)
  const val: CamposReceta = campos ?? {}

  // Vuelve a leer el formato y recoloca las etiquetas. La subida ya lo hizo
  // sola; esto es para reintentarlo después de mover cosas a mano.
  const detectarDeNuevo = async () => {
    if (detectando) return
    setDetectando(true)
    const r = await detectarCamposDelDiseno(disenoUrl, paperHeightMm)
    setDetectando(false)
    if (!r) {
      toast('No se pudieron leer los campos; colócalos a mano arrastrando', 'error')
      return
    }
    const nuevos: CamposReceta = { ...val, ...r.campos }
    if (onDetectado) onDetectado(nuevos, r.margenes)
    else onChange(nuevos)
    toast(`Colocamos ${Object.keys(r.campos).length} dato(s)${r.margenes ? ' y el área de medicamentos' : ''} — ajusta si hace falta`, 'success')
  }

  const posDe = (e: React.PointerEvent): { x: number; y: number } | null => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || r.width === 0) return null
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!arrastrando) return
    const p = posDe(e); if (!p) return
    onChange({ ...val, [arrastrando]: p })
  }
  const colocar = (k: CampoRecetaK) => onChange({ ...val, [k]: { x: 50, y: 15 } })
  const quitar = (k: CampoRecetaK) => { const n: CamposReceta = { ...val }; delete n[k]; onChange(n) }
  const sinColocar = CAMPOS_RECETA.filter(c => !val[c.k])

  return (
    <div>
      <button
        type="button"
        onClick={detectarDeNuevo}
        disabled={detectando}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12,
          fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 9,
          cursor: detectando ? 'wait' : 'pointer', border: 'none',
          background: 'var(--nexus-solido)', color: '#fff',
        }}
      >
        {/* RTC-13 / §25: el botón dice lo que HACE, no con qué está hecho.
            «Detectar campos con IA» vendía la tecnología; «Detectar los campos»
            promete el resultado, que es lo que el médico quiere. */}
        {detectando
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Detectando campos…</>
          : <><Sparkles size={14} /> Detectar los campos</>}
      </button>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 10 }}>
        Vuelve a leer tu formato y recoloca las etiquetas. Se hizo solo al subirlo; esto es
        para reintentarlo si moviste cosas y prefieres empezar de nuevo.
      </div>
      {sinColocar.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Colocar:</span>
          {sinColocar.map(c => (
            <button key={c.k} type="button" onClick={() => colocar(c.k)}
              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--r-pill)', cursor: 'pointer', border: '1px dashed var(--nexus)', background: 'var(--s2)', color: 'var(--nexus)' }}>
              + {c.label}
            </button>
          ))}
        </div>
      )}
      <div ref={ref} onPointerMove={onMove} onPointerUp={() => setArrastrando(null)} onPointerLeave={() => setArrastrando(null)}
        style={{ position: 'relative', width: '100%', userSelect: 'none', touchAction: 'none', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={disenoUrl} alt="Formato de receta" style={{ width: '100%', display: 'block', pointerEvents: 'none' }} draggable={false} />
        {CAMPOS_RECETA.filter(c => val[c.k]).map(c => {
          const p = val[c.k]!
          return (
            <div key={c.k} onPointerDown={(e) => { e.preventDefault(); setArrastrando(c.k) }}
              style={{
                position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
                background: 'var(--nexus-solido)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px',
                borderRadius: 6, cursor: 'grab', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              {c.label}
              <span onPointerDown={(e) => { e.stopPropagation(); quitar(c.k) }} style={{ opacity: 0.85, cursor: 'pointer' }}>✕</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
        Arrastra cada etiqueta al lugar de tu formato · ✕ para quitar · se guarda al tocar “Guardar configuración”.
      </div>
    </div>
  )
}
