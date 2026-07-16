'use client'
/**
 * Sección de configuración de RECETAS (extraída del monolito configuracion/page.tsx).
 * Incluye RecetasTab + su preview, calibrador visual y sub-controles.
 * Sin cambio de comportamiento respecto al monolito original.
 */
import { useState, useEffect, useRef } from 'react'
import { RecetaDocumento, type RecetaData } from '@/components/RecetaDocumento'
import { resizeImageFile, formatBytes } from '@/lib/image-utils'
import { PAPER_SIZES, ESTILOS_RECETA, detectarPaperSize } from '@/lib/receta-template'
import type { RecetaConfig, PaperSize as PaperSizeT, EstiloReceta as EstiloT, Patient, Doctor as DoctorT, ClinicConfig } from '@/types'
import { getDoctors, saveConfig } from '@/lib/firestore'
import { subirImagen as subirImagenServidor } from '@/lib/subir-imagen'
import { fetchAutenticado } from '@/lib/auth-client'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth, storage } from '@/lib/firebase'
import { cfgInput, cfgLabel } from './estilos'
import { Upload, X as IconX, Pill, ClipboardList, Printer, FileText, Loader2, Ruler, Save, Sparkles, Star, UserRound } from 'lucide-react'

const RX_DEFAULTS: RecetaConfig = {
  paperSize: 'media-carta',
  estilo: 'minimalista',
  colorAccento: '#14b8a6',
  mostrarQR: true,
  copiasEnHoja: 1,
  vigenciaDias: 30,
  mostrarAlergias: true,
  mostrarDiagnostico: true,
  mostrarSignosVitales: false,
  avisoLegal: 'Esta receta es personal e intransferible. Conserve este documento como respaldo médico.',
}

export function RecetasTab({ clinicId }: { clinicId: string | null }) {
  const { config, loading: configLoading } = useConfig()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoSel, configLoading])

  const guardar = async () => {
    if (!clinicId || !config) return
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
        toast('Plantilla general guardada', 'success')
      } else {
        // El override del médico guarda TODO el rx editado — al cargar se
        // mergea sobre la general, por lo que es consistente y simple.
        await saveConfig(clinicId, {
          ...baseConfig,
          recetasPorMedico: { ...porMedicoSano, [medicoSel]: rxSano },
        })
        setRx(rxSano)
        const dr = doctores.find(d => d.id === medicoSel)
        toast(`Plantilla de ${dr?.nombre ?? 'médico'} guardada`, 'success')
      }
    } catch (e) {
      // Mostrar la causa real — un "Error al guardar" mudo es indepurable
      const msg = e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)
      toast(`Error al guardar: ${msg}`, 'error')
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
        setRx({ ...rx, [campo]: url })
        toast('Imagen cargada', 'success')
        return
      }
      if (sizeBytes > 800_000) {
        toast(`Imagen muy grande (${formatBytes(sizeBytes)}). Intenta con una más chica o menos detallada.`, 'error')
        return
      }
      setRx({ ...rx, [campo]: dataUrl })
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
      let sizeBytes: number
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
        dataUrl = result.dataUrl
        sizeBytes = result.sizeBytes
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
        sizeBytes = result.sizeBytes
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

      setRx({
        ...rx,
        disenoCompletoDataUrl: srcFinal,
        paperSize: nuevoPaperSize,
        // Dimensiones EXACTAS del membrete → la hoja las usa para que la imagen la
        // llene sin bordes blancos y los datos calibrados caigan en su sitio.
        ...(widthMm && heightMm ? { disenoWidthMm: Math.round(widthMm), disenoHeightMm: Math.round(heightMm) } : {}),
      })
      const nitido = ' · alta resolución'
      if (auto) {
        toast(`Diseño cargado (${formatBytes(sizeBytes)})${nitido} · papel ajustado a ${PAPER_SIZES[nuevoPaperSize].label}`, 'success')
      } else {
        toast(`Diseño cargado (${formatBytes(sizeBytes)})${nitido}`, 'success')
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

  return (
    <div className="recetas-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 20, alignItems: 'start' }}>
      {/* Editor */}
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>

        {/* Cada médico su propia receta. Si entras con TU cuenta, editas la tuya
            (sin dropdown de otros). Solo un admin sin ficha de médico ve el selector. */}
        {doctores.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 10,
          }}>
            {medicoUnico ? (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>Tu receta · {medicoUnico.nombre}</span>
            ) : (<>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>Receta de:</span>
            <select
              value={medicoSel}
              onChange={(e) => setMedicoSel(e.target.value)}
              style={{ ...cfgInput, width: 'auto', minWidth: 220 }}
            >
              {doctores.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}{config?.recetasPorMedico?.[d.id] ? ' · personalizada' : ''}</option>
              ))}
            </select>
            </>)}
            <span style={{ fontSize: 11, color: 'var(--text3)', flexBasis: '100%' }}>
              Cada médico tiene su propia receta. Estos cambios aplican SOLO a las recetas y órdenes de este médico.
            </span>
          </div>
        )}

        {/* MODO TU PROPIO DISEÑO — primera sección, destacada */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(61,90,254,0.12), rgba(124,58,237,0.10))',
          border: '1px solid rgba(20,184,166,0.4)', borderRadius: 12, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={15} className="ds-icon" /> Usa TU propia receta
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                Sube tu diseño actual (PDF o imagen). Lo usamos como fondo y solo
                sobreponemos los datos del paciente, Rx, indicaciones y firma.
              </div>
            </div>
            {rx.disenoCompletoDataUrl && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: '4px 10px',
                background: 'var(--teal)', color: '#000', borderRadius: 100,
              }}>
                ACTIVO
              </span>
            )}
          </div>

          {rx.disenoCompletoDataUrl ? (
            <div style={{ position: 'relative', background: '#fff', borderRadius: 8, padding: 8, border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rx.disenoCompletoDataUrl}
                alt="Diseño de receta"
                style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }}
              />
              <button
                onClick={() => setRx(prev => ({
                  // '' en vez de delete: Firestore con merge:true NO elimina
                  // campos ausentes — el diseño viejo "reaparecía". Vacío SÍ
                  // sobreescribe. (RecetaDocumento trata '' como sin diseño.)
                  ...prev,
                  disenoCompletoDataUrl: '',
                  disenoMargenes: undefined,
                  disenoSoloRx: false,
                  disenoCampos: undefined,
                }))}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <IconX size={11} /> Quitar diseño
              </button>
            </div>
          ) : (
            <label style={{
              display: 'block', textAlign: 'center', padding: '26px 14px',
              border: '2px dashed rgba(20,184,166,0.5)', borderRadius: 10,
              background: 'rgba(20,184,166,0.06)', cursor: subiendoDiseno ? 'wait' : 'pointer',
              color: 'var(--text2)',
            }}>
              {subiendoDiseno ? (
                <>
                  <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{progresoDiseno || 'Procesando…'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                    La primera vez puede tardar 5-15 seg (descarga la librería PDF).
                    Si pasa de 1 minuto, intenta subir tu PDF como imagen PNG.
                  </div>
                </>
              ) : (
                <>
                  <Upload size={22} style={{ marginBottom: 6, color: 'var(--teal)' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Sube tu receta</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>PDF o imagen PNG/JPG · Recomendado: tu receta en blanco con logo y datos</div>
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

          {/* Calibrador VISUAL: arrastra cada dato a su lugar exacto en TU formato */}
          {rx.disenoCompletoDataUrl && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserRound size={14} className="ds-icon" /> Coloca cada dato en tu formato
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                Arrastra <strong>Nombre, Edad, Sexo, Fecha, Folio, Firma/sello y QR</strong> al lugar EXACTO de tu receta.
                Si tu formato ya los trae impresos, déjalos sin colocar. (El cuerpo de Rx usa los márgenes de abajo.)
              </div>
              <CalibradorReceta
                disenoUrl={rx.disenoCompletoDataUrl}
                campos={rx.disenoCampos}
                onChange={(c) => setRx({ ...rx, disenoCampos: c })}
                paperHeightMm={PAPER_SIZES[rx.paperSize ?? 'media-carta'].heightMm}
                onDetectado={(campos, margenes) => setRx(prev => ({
                  ...prev,
                  disenoCampos: campos,
                  ...(margenes ? { disenoMargenes: margenes } : {}),
                }))}
              />
              {/* Tamaños de firma/sello y QR (mm) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={cfgLabel}>Tamaño firma / sello: {rx.disenoTamanos?.firma ?? 20} mm</label>
                  <input type="range" min={10} max={50} step={1} value={rx.disenoTamanos?.firma ?? 20}
                    onChange={(e) => setRx({ ...rx, disenoTamanos: { ...rx.disenoTamanos, firma: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={cfgLabel}>Tamaño QR: {rx.disenoTamanos?.qr ?? 14} mm</label>
                  <input type="range" min={8} max={40} step={1} value={rx.disenoTamanos?.qr ?? 14}
                    onChange={(e) => setRx({ ...rx, disenoTamanos: { ...rx.disenoTamanos, qr: Number(e.target.value) } })}
                    style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Calibración de márgenes — solo cuando hay diseño */}
          {rx.disenoCompletoDataUrl && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Ruler size={14} className="ds-icon" /> Calibrar área de contenido (mm)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                Define dónde caen los datos del paciente y la receta. Mira la vista previa →
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <MargenInput label="Arriba" value={rx.disenoMargenes?.top ?? 35} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), top: v } })} />
                <MargenInput label="Abajo" value={rx.disenoMargenes?.bottom ?? 30} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), bottom: v } })} />
                <MargenInput label="Izquierda" value={rx.disenoMargenes?.left ?? 12} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), left: v } })} />
                <MargenInput label="Derecha" value={rx.disenoMargenes?.right ?? 12} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), right: v } })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={cfgLabel}>Tamaño de letra del contenido (px)</label>
                <input
                  type="range" min={8} max={16} step={0.5}
                  value={rx.disenoFontSize ?? 11}
                  onChange={(e) => setRx({ ...rx, disenoFontSize: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{rx.disenoFontSize ?? 11}px</div>
              </div>

              {/* Toggle "Solo Rx" — para diseños que ya tienen campos pre-impresos */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
                padding: 10, background: 'rgba(20,184,166,0.06)', borderRadius: 6,
                border: '1px solid rgba(20,184,166,0.25)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={rx.disenoSoloRx === true}
                  onChange={(e) => setRx({ ...rx, disenoSoloRx: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: 'var(--teal)' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Mi diseño ya tiene campos del paciente impresos
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>
                    Si tu receta tiene líneas pre-impresas para Nombre, Edad, Fecha, etc.,
                    activa esto. Solo se sobreponen los medicamentos / estudios en la zona libre.
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Tamaño de papel */}
        <Section title="Tamaño de papel">
          <select
            value={rx.paperSize}
            onChange={(e) => setRx({ ...rx, paperSize: e.target.value as PaperSizeT })}
            style={cfgInput}
          >
            {(Object.keys(PAPER_SIZES) as PaperSizeT[]).map(k => (
              <option key={k} value={k}>{PAPER_SIZES[k].label}</option>
            ))}
          </select>
        </Section>

        {/* Dónde se imprime físicamente — resuelve "no se imprime en formato receta" */}
        {rx.paperSize !== 'carta' && rx.paperSize !== 'oficio' && (
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
                    onClick={() => setRx({ ...rx, imprimirEn: op.valor })}
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

        {/* Estilo visual */}
        <Section title="Estilo visual">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(Object.keys(ESTILOS_RECETA) as EstiloT[]).map(k => {
              const activo = rx.estilo === k
              return (
                <button
                  key={k}
                  onClick={() => setRx({ ...rx, estilo: k })}
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
              onChange={(e) => setRx({ ...rx, colorAccento: e.target.value })}
              style={{ width: 50, height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'var(--s2)' }}
            />
            <input
              value={rx.colorAccento ?? '#14b8a6'}
              onChange={(e) => setRx({ ...rx, colorAccento: e.target.value })}
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
                onClick={() => setRx({ ...rx, membreteDataUrl: '' })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
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
                onClick={() => setRx({ ...rx, pieDataUrl: '' })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
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
        <Section title="Opciones">
          <div style={{ display: 'grid', gap: 8 }}>
            <Toggle label="Mostrar caja de alergias" checked={rx.mostrarAlergias !== false} onChange={(v) => setRx({ ...rx, mostrarAlergias: v })} />
            <Toggle label="Mostrar diagnóstico" checked={rx.mostrarDiagnostico !== false} onChange={(v) => setRx({ ...rx, mostrarDiagnostico: v })} />
            <Toggle label="Mostrar signos vitales (en órdenes)" checked={rx.mostrarSignosVitales === true} onChange={(v) => setRx({ ...rx, mostrarSignosVitales: v })} />
            <Toggle label="QR de verificación al pie" checked={rx.mostrarQR !== false} onChange={(v) => setRx({ ...rx, mostrarQR: v })} />
          </div>
        </Section>

        <Section title="Datos legales adicionales (opcional)">
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label style={cfgLabel}>RFC</label>
              <input value={rx.rfc ?? ''} onChange={(e) => setRx({ ...rx, rfc: e.target.value })} style={cfgInput} placeholder="RODR890101ABC" />
            </div>
            <div>
              <label style={cfgLabel}>Registro DGP/SSA (psicotrópicos)</label>
              <input value={rx.registroDGP ?? ''} onChange={(e) => setRx({ ...rx, registroDGP: e.target.value })} style={cfgInput} placeholder="Para Rx de medicamentos controlados" />
            </div>
            <div>
              <label style={cfgLabel}>Vigencia default (días)</label>
              <input type="number" value={rx.vigenciaDias ?? 30} onChange={(e) => setRx({ ...rx, vigenciaDias: parseInt(e.target.value) || 30 })} style={cfgInput} min={1} max={365} />
            </div>
            <div>
              <label style={cfgLabel}>Aviso legal al pie</label>
              <textarea value={rx.avisoLegal ?? ''} onChange={(e) => setRx({ ...rx, avisoLegal: e.target.value.slice(0, 240) })} rows={2} style={{ ...cfgInput, resize: 'vertical' }} />
            </div>
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={guardar} disabled={saving} className="btn btn-primary">
            {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={14} /> Guardar template</>}
          </button>
        </div>
      </div>

      {/* Preview en vivo — contenedor de ancho fijo, escala dinámica */}
      <PreviewReceta tipoPreview={tipoPreview} setTipoPreview={setTipoPreview} rx={rx} config={config} />

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
  tipoPreview, setTipoPreview, rx, config,
}: {
  tipoPreview: 'receta' | 'orden'
  setTipoPreview: (t: 'receta' | 'orden') => void
  rx: RecetaConfig
  config: ClinicConfig | null
}) {
  const paper = PAPER_SIZES[rx.paperSize ?? 'media-carta']
  // 96 DPI estándar web: 1mm ≈ 3.78 px
  const paperWidthPx = (paper.widthMm * 96) / 25.4
  const paperHeightPx = (paper.heightMm * 96) / 25.4
  // Ancho objetivo del contenedor sticky en el lado derecho
  const TARGET_WIDTH = 340
  const TARGET_MAX_HEIGHT = 520
  const scaleByWidth = TARGET_WIDTH / paperWidthPx
  const scaleByHeight = TARGET_MAX_HEIGHT / paperHeightPx
  const scale = Math.min(scaleByWidth, scaleByHeight, 1)
  const containerWidth = paperWidthPx * scale
  const containerHeight = paperHeightPx * scale

  const margenes = rx.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
  const usarGuia = !!rx.disenoCompletoDataUrl

  // Datos ficticios compartidos por la vista previa y la impresión de prueba.
  const demoData: RecetaData = {
    tipo: tipoPreview,
    folio: 'RX-DEMO-01',
    fecha: new Date(),
    paciente: { id: 'demo', nombre: 'Juan Pérez García', edad: 42, sexo: 'Masculino', telefono: '614 123 4567', alergias: 'Penicilina', noShowCount: 0, cancelacionCount: 0, createdAt: '', updatedAt: '', creadoPor: '' } as Patient,
    diagnostico: 'Faringitis aguda (J02.9)',
    medicamentos: tipoPreview === 'receta' ? [
      { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'Cada 8 horas', duracion: '7 días', indicacion: 'Tomar con alimentos' },
      { nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'Cada 6 hrs si dolor o fiebre', duracion: '5 días' },
    ] : undefined,
    estudios: tipoPreview === 'orden' ? ['Biometría hemática completa', 'PCR cuantitativa', 'Cultivo faríngeo'] : undefined,
    indicaciones: 'Reposo relativo, hidratación abundante. Acudir a control en 5 días.',
    notaParaPaciente: 'Si presenta fiebre >39°C, acudir a urgencias.',
  }

  // Imprime SOLO la receta (a tamaño físico real), no toda la pantalla de config.
  // Marca el <body> para que el CSS de impresión oculte todo menos #zona-print-receta.
  const imprimirPrueba = () => {
    const body = document.body
    body.classList.add('print-solo-receta')
    const limpiar = () => {
      body.classList.remove('print-solo-receta')
      window.removeEventListener('afterprint', limpiar)
    }
    window.addEventListener('afterprint', limpiar)
    window.print()
    setTimeout(limpiar, 1500) // respaldo por si el navegador no dispara afterprint
  }

  return (
    <div style={{ position: 'sticky', top: 20 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
        Vista previa · {paper.label.split(' ')[0]}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setTipoPreview('receta')}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: tipoPreview === 'receta' ? 'rgba(20,184,166,0.15)' : 'var(--s2)',
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
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: tipoPreview === 'orden' ? 'rgba(167,139,250,0.15)' : 'var(--s2)',
            border: tipoPreview === 'orden' ? '1px solid #a78bfa' : '1px solid var(--border)',
            color: tipoPreview === 'orden' ? '#a78bfa' : 'var(--text3)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <ClipboardList size={12} /> Orden
        </button>
      </div>

      {/* Imprimir prueba — imprime SOLO la receta a tamaño real, no toda la config */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <button
          onClick={imprimirPrueba}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Imprime solo la receta de ejemplo para probar tu impresora y formato"
        >
          <Printer size={13} /> Imprimir prueba
        </button>
      </div>

      {/* Contenedor que limita el tamaño visible y reserva espacio scaled */}
      <div style={{
        width: containerWidth,
        height: containerHeight,
        margin: '0 auto',
        overflow: 'hidden',
        position: 'relative',
        background: '#1a2333',
        borderRadius: 6,
      }}>
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: paperWidthPx,
          height: paperHeightPx,
          position: 'relative',
        }}>
          <RecetaDocumento
            data={demoData}
            config={config ?? null}
            recetaConfig={rx}
          />
          {/* GUÍA VISUAL: rectángulo cian translúcido sobre la zona de contenido
              cuando se usa diseño custom. Le muestra al médico DÓNDE caen los datos. */}
          {usarGuia && (
            <div style={{
              position: 'absolute',
              top: `${margenes.top}mm`,
              right: `${margenes.right}mm`,
              bottom: `${margenes.bottom}mm`,
              left: `${margenes.left}mm`,
              border: '2px dashed #14b8a6',
              background: 'rgba(20,184,166,0.08)',
              pointerEvents: 'none',
              borderRadius: 2,
            }}>
              <div style={{
                position: 'absolute', top: -22, left: 0,
                background: '#14b8a6', color: '#000',
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              }}>
                ↓ Zona de contenido
              </div>
            </div>
          )}
        </div>
      </div>

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
        <div style={{ width: paperWidthPx, height: paperHeightPx, position: 'relative', background: '#fff' }}>
          <RecetaDocumento data={demoData} config={config ?? null} recetaConfig={rx} />
        </div>
      </div>
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
  { k: 'sexo', label: 'Sexo' }, { k: 'fecha', label: 'Fecha' }, { k: 'folio', label: 'Folio' },
  { k: 'firma', label: 'Firma / sello' }, { k: 'qr', label: 'QR' },
] as const
type CampoRecetaK = typeof CAMPOS_RECETA[number]['k']
type CamposReceta = Partial<Record<CampoRecetaK, { x: number; y: number }>>

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

  // IA de visión: detecta sola dónde va cada campo en TU formato → pre-llena el
  // calibrador. "La app se adapta a ti, no tú a ella." El médico ajusta si hace falta.
  const detectarConIA = async () => {
    if (detectando) return
    setDetectando(true)
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
      if (data.ok && (data.campos || data.cuerpo)) {
        const nuevos: CamposReceta = { ...val, ...(data.campos ?? {}) }
        // El área de medicamentos (cuerpo) se convierte a márgenes (mm) para que la
        // lista NO se encime con el pie/firma del membrete.
        let margenes: { top: number; right: number; bottom: number; left: number } | undefined
        if (data.cuerpo && paperHeightMm) {
          margenes = {
            top: Math.round((data.cuerpo.top / 100) * paperHeightMm),
            bottom: Math.round(((100 - data.cuerpo.bottom) / 100) * paperHeightMm),
            right: 12, left: 12,
          }
        }
        if (onDetectado) onDetectado(nuevos, margenes)
        else onChange(nuevos)
        toast(`IA colocó ${Object.keys(data.campos ?? {}).length} campo(s)${margenes ? ' + área de medicamentos' : ''} — ajusta si hace falta`, 'success')
      } else {
        toast(data.error ?? 'La IA no pudo detectar; colócalos a mano arrastrando', 'error')
      }
    } catch {
      toast('No se pudo detectar con IA; colócalos a mano arrastrando', 'error')
    } finally {
      setDetectando(false)
    }
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
        onClick={detectarConIA}
        disabled={detectando}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12,
          fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 9,
          cursor: detectando ? 'wait' : 'pointer', border: 'none',
          background: 'var(--nexus)', color: '#fff',
        }}
      >
        {detectando
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Detectando campos…</>
          : <><Sparkles size={14} /> Detectar campos con IA</>}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        La IA lee tu formato y coloca Nombre/Edad/Fecha… solos. Luego los puedes arrastrar para ajustar.
      </div>
      {sinColocar.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Colocar:</span>
          {sinColocar.map(c => (
            <button key={c.k} type="button" onClick={() => colocar(c.k)}
              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, cursor: 'pointer', border: '1px dashed var(--nexus)', background: 'var(--s2)', color: 'var(--nexus)' }}>
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
                background: 'var(--nexus)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px',
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
