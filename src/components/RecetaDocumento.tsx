'use client'
/**
 * Componente puro que renderiza una receta médica imprimible — v2 MULTI-HOJA.
 *
 * Mejoras sobre v1 (inspiradas en Doctoralia Pro / Medesk / Saludtools):
 *
 *  1. PAGINACIÓN AUTOMÁTICA — si los medicamentos/estudios no caben en una
 *     hoja, se generan N hojas. El diseño del médico se repite como fondo en
 *     cada una. Indicador "Hoja 1 de 2". La firma SOLO va en la última hoja
 *     (la firma valida todo lo anterior — estándar clínico).
 *     Antes: overflow:hidden cortaba el contenido EN SILENCIO.
 *
 *  2. ORDEN EN CHECKLIST DE 2 COLUMNAS — cuando hay > 6 estudios, se imprimen
 *     en dos columnas con casilla ☐ (formato estándar de orden de laboratorio).
 *     Duplica la capacidad por hoja.
 *
 *  3. MODO "IMPRIMIR EN CARTA" — si la impresora tiene papel carta, la receta
 *     media-carta se posiciona arriba-centro con línea punteada de corte ✂.
 *     Antes: @page con tamaño custom → el navegador escalaba/centraba
 *     impredeciblemente ("no se imprime en formato receta").
 *
 * Cada hoja lleva className="receta-sheet" — el padre aplica
 * page-break-after en su CSS de impresión.
 */
import { useState, useEffect, useMemo } from 'react'
import type { ClinicConfig, Patient, RecetaConfig } from '@/types'
import { PAPER_SIZES, papelPersonalizado } from '@/lib/receta-template'
import { paginarParaDocumento, etiquetaVia, type PaginaReceta } from '@/lib/receta-paginacion'
import type { Medicamento } from '@/types/expediente'
import { alergiasParaImpreso } from '@/lib/seguridad/alergias'

/**
 * EN EL PAPEL NO SE USAN VARIABLES DE COLOR — Y ES DELIBERADO.
 *
 * El resto de la aplicación migró sus colores crudos a `var(--red)` y
 * `var(--amber)`, que están medidos AA en los dos temas. Aquí NO:
 *
 *  · la receta se rasteriza con html2canvas sobre un CLON del nodo, y una
 *    variable que no resuelva en ese clon deja el texto sin color — justo el
 *    «[FALTA CÉDULA PROFESIONAL]», que existe para verse;
 *  · y el papel fuerza tema claro: `--red` en tema oscuro es el rosa #E66464,
 *    que impreso queda desvaído.
 *
 * El hexadecimal literal es lo correcto en las superficies que se imprimen.
 */

export interface RecetaData {
  /** Tipo de impreso: 'receta' (Rx) o 'orden' (orden médica) */
  tipo: 'receta' | 'orden'
  /** Folio único de la receta */
  folio: string
  /** Fecha de emisión */
  fecha: Date
  /** Paciente */
  paciente: Patient | null
  /** Diagnóstico principal (opcional) */
  diagnostico?: string
  /** Medicamentos (para receta) */
  medicamentos?: Medicamento[]
  /** Estudios solicitados (para orden) */
  estudios?: string[]
  /** Indicaciones generales */
  indicaciones?: string
  /** Aviso al paciente */
  notaParaPaciente?: string
  /**
   * URL de verificación (destino del QR). La arma el servidor con
   * linkVerificacionReceta() (token HMAC, sin datos del paciente). Si no se
   * provee, el QR codifica solo el folio (comportamiento previo).
   */
  verificacionUrl?: string
}

export interface RecetaDocumentoProps {
  data: RecetaData
  config: ClinicConfig | null
  recetaConfig: RecetaConfig
  /** ID DOM del contenedor para que html2pdf lo capture */
  containerId?: string
}

/** Carta física: 216 × 279 mm */
const CARTA = { widthMm: 216, heightMm: 279 }

/**
 * QR generado LOCALMENTE (data URI) — sin depender de api.qrserver.com.
 * Ventajas vs. el servicio externo: no filtra el folio/URL a un tercero, funciona
 * offline y el data URI ya está embebido cuando html2pdf captura (no hay carrera
 * de carga de imagen remota). Codifica `contenido` (URL de verificación o folio).
 */
function QrLocal({ contenido, tamMm }: { contenido: string; tamMm: number }) {
  const [dataUrl, setDataUrl] = useState<string>('')
  useEffect(() => {
    let vivo = true
    import('qrcode')
      // margin 2 = zona de silencio (quiet zone) suficiente para que el escáner lo
      // aísle; width 640 = fuente de alta resolución para que aguante el reescalado
      // de html2canvas/impresión sin difuminar los módulos.
      .then((QR) => QR.toDataURL(contenido, { margin: 2, width: 640, errorCorrectionLevel: 'M' }))
      .then((url) => { if (vivo) setDataUrl(url) })
      .catch(() => { /* si falla, no rompe la impresión: simplemente no hay QR */ })
    return () => { vivo = false }
  }, [contenido])
  if (!dataUrl) return null
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      alt="QR de verificación"
      // Fondo BLANCO SÓLIDO (antes 0.9: la marca de agua del membrete se colaba y el
      // escáner NO lo detectaba por falta de contraste). imageRendering:pixelated
      // conserva los bordes de los módulos al reescalar (crítico para que se lea).
      style={{ width: `${tamMm}mm`, height: `${tamMm}mm`, background: '#fff', padding: 3, borderRadius: 2, imageRendering: 'pixelated' }}
    />
  )
}

/** Formatea la fecha de nacimiento (YYYY-MM-DD) como "15/ene/1985". */
function fmtFechaNac(fecha: string): string {
  if (!fecha) return ''
  // Ancla a mediodía para no correr el día por zona horaria
  const d = new Date(fecha.length === 10 ? fecha + 'T12:00:00' : fecha)
  if (isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Dimensiones FÍSICAS de la hoja que sale de la impresora.
 * En modo 'carta' el host es papel carta aunque la receta sea media carta.
 * Las páginas (receta/orden) usan esto para @page y para el preview wrapper.
 */
/**
 * Dimensiones EFECTIVAS de la hoja. Para un membrete custom usa sus dimensiones
 * REALES (disenoWidthMm/HeightMm) → la imagen llena la hoja sin bordes blancos y
 * las coordenadas calibradas (nombre/edad/fecha) caen justo en su lugar, en vez de
 * "flotar" arriba por el letterbox de objectFit:contain. Si no hay dimensiones,
 * cae al tamaño de papel estándar.
 */
export function paperEfectivo(recetaConfig: RecetaConfig): { widthMm: number; heightMm: number; cssPage: string } {
  if (recetaConfig.disenoCompletoDataUrl && recetaConfig.disenoWidthMm && recetaConfig.disenoHeightMm) {
    const w = recetaConfig.disenoWidthMm, h = recetaConfig.disenoHeightMm
    return { widthMm: w, heightMm: h, cssPage: `${w}mm ${h}mm` }
  }
  // Papel PERSONALIZADO: manda lo que el médico escribió. Si las medidas no son
  // utilizables se cae al placeholder del catálogo — nunca a una hoja inválida,
  // que saldría en blanco sin avisar.
  if (recetaConfig.paperSize === 'personalizado') {
    const c = papelPersonalizado(recetaConfig.paperCustomWidthMm, recetaConfig.paperCustomHeightMm)
    if (c) return { widthMm: c.widthMm, heightMm: c.heightMm, cssPage: c.cssPage }
  }
  const p = PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta']
  return { widthMm: p.widthMm, heightMm: p.heightMm, cssPage: p.cssPage }
}

/**
 * ¿Esta hoja se puede "hospedar" dentro de una carta vertical (216 × 279)?
 *
 * Solo si CABE con la carta en su orientación natural. Una hoja APAISADA como la
 * receta continua de 250 × 150 mm NO cabe (250 > 216): meterla en carta es
 * justo el defecto que se veía en la vista previa de macOS — una hoja vertical
 * grande con la receta chiquita adentro. Esa se imprime a su tamaño real, al
 * 100 %, y no se escala jamás.
 */
function puedeHospedarseEnCarta(paper: { widthMm: number; heightMm: number }): boolean {
  const cabe = paper.widthMm <= CARTA.widthMm && paper.heightMm <= CARTA.heightMm
  const esMenor = paper.widthMm < CARTA.widthMm || paper.heightMm < CARTA.heightMm
  return cabe && esMenor
}

export function dimensionesImpresion(recetaConfig: RecetaConfig): { widthMm: number; heightMm: number; cssPage: string; esHostCarta: boolean } {
  const paper = paperEfectivo(recetaConfig)
  // DEFAULT = 'carta': el diálogo de impresión del navegador solo ofrece los
  // tamaños que el driver de la impresora reporta — "media carta" casi nunca
  // existe ahí. Imprimir sobre carta (tamaño universal) con línea de corte ✂
  // funciona en CUALQUIER impresora sin configurar nada.
  // Solo quien tiene papel del tamaño exacto cargado elige 'papel-real'.
  const quiereCarta = (recetaConfig.imprimirEn ?? 'carta') === 'carta'
  if (quiereCarta && puedeHospedarseEnCarta(paper)) {
    return { ...CARTA, cssPage: 'letter', esHostCarta: true }
  }
  return { widthMm: paper.widthMm, heightMm: paper.heightMm, cssPage: paper.cssPage, esHostCarta: false }
}

/**
 * Para la UI de configuración: si la hoja no cabe en carta, ofrecer "imprimir en
 * hoja carta con línea de corte" es mentira — no hay nada que elegir.
 */
export function admiteHojaCarta(recetaConfig: RecetaConfig): boolean {
  return puedeHospedarseEnCarta(paperEfectivo(recetaConfig))
}

/**
 * DÓNDE CAE LA RECETA DENTRO DE LA HOJA QUE SALE DE LA IMPRESORA.
 *
 * La receta va CENTRADA en la hoja carta y agrandada para llenar bien la hoja,
 * dejando márgenes parejos. Carta es tamaño ESTÁNDAR → el navegador y cualquier
 * impresora lo respetan (a diferencia de "media carta", que Safari redondea a A5
 * y desacomoda). La escala ajusta la receta dentro de (carta − margen) sin
 * deformarla.
 *
 * ── POR QUÉ ESTO ES UNA FUNCIÓN Y NO SEIS LÍNEAS DENTRO DE `HostCarta` ──────
 *
 * Porque hay un segundo interesado: el recuadro que el médico ARRASTRA en la
 * vista previa de configuración para decir dónde cae el tratamiento. Ese
 * recuadro se dibuja ENCIMA del documento, así que tiene que saber en qué punto
 * de la hoja física empieza la receta y cuánto se agrandó. Mientras el cálculo
 * vivió sólo aquí, quien dibujaba encima tenía que adivinarlo — y adivinó mal.
 */
export function colocacionEnCarta(paper: { widthMm: number; heightMm: number }): {
  escala: number; offsetXMm: number; offsetYMm: number
} {
  const MARGEN_MM = 14
  const escala = Math.min(
    (CARTA.widthMm - 2 * MARGEN_MM) / paper.widthMm,
    (CARTA.heightMm - 2 * MARGEN_MM) / paper.heightMm,
  )
  return {
    escala,
    offsetXMm: (CARTA.widthMm - paper.widthMm * escala) / 2,
    offsetYMm: (CARTA.heightMm - paper.heightMm * escala) / 2,
  }
}

/**
 * Lo mismo, resuelto para una configuración completa: la hoja física, la receta
 * dentro de ella, y la transformación que lleva de una a la otra. Sin host de
 * carta la respuesta es la identidad — la receta ES la hoja.
 */
export function colocacionDeLaReceta(recetaConfig: RecetaConfig): {
  hostWidthMm: number; hostHeightMm: number
  recetaWidthMm: number; recetaHeightMm: number
  offsetXMm: number; offsetYMm: number
  escala: number; esHostCarta: boolean
} {
  const paper = paperEfectivo(recetaConfig)
  const host = dimensionesImpresion(recetaConfig)
  if (!host.esHostCarta) {
    return {
      hostWidthMm: host.widthMm, hostHeightMm: host.heightMm,
      recetaWidthMm: paper.widthMm, recetaHeightMm: paper.heightMm,
      offsetXMm: 0, offsetYMm: 0, escala: 1, esHostCarta: false,
    }
  }
  const { escala, offsetXMm, offsetYMm } = colocacionEnCarta(paper)
  return {
    hostWidthMm: host.widthMm, hostHeightMm: host.heightMm,
    recetaWidthMm: paper.widthMm, recetaHeightMm: paper.heightMm,
    offsetXMm, offsetYMm, escala, esHostCarta: true,
  }
}

/**
 * Dimensiones del papel ORIENTADAS al diseño subido, IGUAL que HojaCustom.
 *
 * BUG que el Dr cazó en vivo: la hoja se orienta al diseño (si la imagen es
 * apaisada, el papel se voltea a horizontal), pero los contenedores de vista
 * previa y el @page de impresión usaban las medidas SIN orientar → hoja
 * horizontal en marco vertical = recortada. Este hook carga el aspecto real de la
 * imagen y devuelve las medidas ya orientadas, para que preview/print coincidan
 * con la hoja renderizada. Sin diseño (o mientras carga), devuelve las de base.
 */
export function useRecetaPaperOrientado(recetaConfig: RecetaConfig): { widthMm: number; heightMm: number; apaisado: boolean } {
  const url = recetaConfig.disenoCompletoDataUrl
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  useEffect(() => {
    if (!url) { setImgAspect(null); return }
    const im = new window.Image()
    im.onload = () => { if (im.naturalWidth && im.naturalHeight) setImgAspect(im.naturalWidth / im.naturalHeight) }
    im.onerror = () => setImgAspect(null)
    im.src = url
  }, [url])
  const base = paperEfectivo(recetaConfig)
  if (!url || imgAspect == null) return { widthMm: base.widthMm, heightMm: base.heightMm, apaisado: base.widthMm > base.heightMm }
  const corto = Math.min(base.widthMm, base.heightMm)
  const largo = Math.max(base.widthMm, base.heightMm)
  const apaisado = imgAspect > 1
  return { widthMm: apaisado ? largo : corto, heightMm: apaisado ? corto : largo, apaisado }
}

/** Cuenta las hojas que generará el documento — para el preview wrapper del padre. */
export function contarPaginas(data: RecetaData, config: ClinicConfig | null, recetaConfig: RecetaConfig): number {
  return calcularPaginas(data, config, recetaConfig).length
}

function calcularPaginas(data: RecetaData, config: ClinicConfig | null, recetaConfig: RecetaConfig): PaginaReceta[] {
  const paper = paperEfectivo(recetaConfig)
  const custom = !!recetaConfig.disenoCompletoDataUrl
  const margenes = custom
    ? (recetaConfig.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 })
    : { top: 10, right: 12, bottom: 10, left: 12 }
  const fontSize = custom ? (recetaConfig.disenoFontSize ?? 11) : 11
  /**
   * Reserva de la hoja 1 en plantilla auto-generada.
   *
   * Eran 52 mm fijos, pero con membrete SUBIDO la imagen sola llega a 40 mm y
   * encima van la banda de tipo (~6), el bloque de paciente (~10), la caja de
   * alergias (~7) y el diagnóstico (~6): unos 69 mm reales contra 52 reservados.
   * Ese déficit de ~17 mm es el que empuja el contenido —y con él la firma— fuera
   * de la hoja.
   */
  const headerPrimeraMm = custom ? undefined : (recetaConfig.membreteDataUrl ? 70 : 52)

  return paginarParaDocumento({
    // En formato propio cada hoja se firma y se entrega: la reserva de la firma
    // aplica a todas, no solo a la última.
    firmaEnTodasLasHojas: custom,
    medicamentos: data.tipo === 'receta' ? data.medicamentos : [],
    estudios: data.tipo === 'orden' ? data.estudios : [],
    indicaciones: data.indicaciones,
    notaParaPaciente: data.notaParaPaciente,
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    margenes,
    fontSizePx: fontSize,
    soloRx: custom ? recetaConfig.disenoSoloRx : false,
    tieneFirmaImagen: !!config?.firmaImagenDataUrl,
    headerPrimeraMm,
  })
}

export function RecetaDocumento({ data, config, recetaConfig, containerId = 'receta-doc' }: RecetaDocumentoProps) {
  const custom = !!recetaConfig.disenoCompletoDataUrl

  // Aspecto REAL de la imagen del membrete (ancho/alto), leído al vuelo. Con esto
  // la hoja toma la forma EXACTA de tu formato → la imagen la llena sin bordes y
  // los datos caen en su lugar, SIN re-subir. Funciona con cualquier membrete.
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  useEffect(() => {
    const url = recetaConfig.disenoCompletoDataUrl
    if (!custom || !url) { setImgAspect(null); return }
    const img = new window.Image()
    img.onload = () => { if (img.naturalWidth && img.naturalHeight) setImgAspect(img.naturalWidth / img.naturalHeight) }
    img.src = url
  }, [custom, recetaConfig.disenoCompletoDataUrl])

  // Receta con membrete: ancho tamaño "receta" (140 mm) y alto SEGÚN EL ASPECTO
  // REAL de la imagen → nada de "flotar" ni hoja oficio. Si no hay medicamentos que
  // caben, la paginación reparte en varias hojas (cada una repite el membrete).
  const cfg: RecetaConfig = useMemo(() => {
    if (!custom) return recetaConfig
    /**
     * TAMAÑO DE HOJA = el del papel configurado, ORIENTADO según el membrete.
     *
     * Antes se fijaba el ancho en 140 mm y el alto salía del aspecto de la imagen. Un
     * membrete APAISADO (media carta horizontal, 215×140) tiene aspecto ~1.54, así que
     * el alto salía 140/1.54 ≈ 90 mm: la hoja quedaba achatada, el área de medicamentos
     * mínima, y por eso se partía en 4 hojas / se encimaba el QR. Ahora la hoja toma las
     * medidas reales del papel (media carta 140×215) puestas a lo largo o a lo alto según
     * si el membrete es apaisado o vertical; la imagen la llena con object-fit:contain.
     */
    /**
     * BUG (el Dr: "sale descuadrada"): esto leía `PAPER_SIZES[paperSize]` y NO
     * `paperEfectivo`, así que ignoraba las medidas reales del diseño subido. La
     * hoja blanca se dibujaba con las medidas del catálogo mientras el contenedor
     * de la vista previa y el `@page` de impresión usaban las del diseño: dos
     * tamaños distintos para la misma receta → contenido corrido fuera de la hoja.
     * Ahora los tres salen de la MISMA fuente.
     */
    const pp = paperEfectivo(recetaConfig)
    const corto = Math.min(pp.widthMm, pp.heightMm)
    const largo = Math.max(pp.widthMm, pp.heightMm)
    /**
     * Mientras la imagen del membrete carga (`imgAspect == null`) se asumía
     * VERTICAL. Con un papel ya apaisado (25 × 15) eso dibujaba la hoja de pie y
     * luego saltaba al cargar la imagen. El default correcto es la orientación
     * del PROPIO papel.
     */
    const apaisado = imgAspect != null ? imgAspect > 1 : pp.widthMm > pp.heightMm
    const w = apaisado ? largo : corto
    const h = apaisado ? corto : largo
    // Área de MEDICAMENTOS automática: debajo del campo más bajo (nombre/edad/fecha)
    // y con un margen inferior sano para no tapar el pie. Así el médico SOLO coloca
    // los campos y los medicamentos se acomodan solos — nada de calibrar mm.
    /**
     * LO QUE EL MÉDICO CALIBRÓ MANDA.
     *
     * `margenes` arrancaba en `disenoMargenes` y se sobrescribía ENTERO en cuanto
     * hubiera un campo colocado, forzando además left/right a 12. Resultado: el
     * médico movía "Arriba/Abajo" en el calibrador, veía moverse el recuadro cian
     * —que se dibuja con `disenoMargenes`— guardaba, y el impreso no cambiaba.
     * Es la receta perfecta para dejar de confiar en la app.
     *
     * El autocálculo desde los campos sigue existiendo, porque es lo que permite
     * "solo coloca los campos y los medicamentos se acomodan solos". Pero es un
     * VALOR POR DEFECTO: si el médico calibró los márgenes a mano, ganan los suyos.
     */
    // Se respetan los márgenes calibrados A MANO SOLO si de verdad caben en la hoja
    // (dejan ≥ 40 mm de contenido). Una calibración vieja hecha cuando la hoja se
    // detectaba con otro alto puede tener un margen superior enorme (que achataba todo);
    // en ese caso se descarta y se recalcula desde los campos.
    const hm = recetaConfig.disenoMargenes
    const calibradoAMano = !!hm && (hm.top + hm.bottom) < h - 40
    let margenes = calibradoAMano ? hm : undefined
    const c = recetaConfig.disenoCampos
    if (c && !calibradoAMano) {
      const ys = (['nombre', 'edad', 'nacimiento', 'sexo', 'fecha', 'folio'] as const)
        .map(k => c[k]?.y).filter((v): v is number => typeof v === 'number')
      if (ys.length) {
        /**
         * EL MARGEN NO PUEDE COMERSE LA HOJA.
         *
         * `top` se deriva del campo colocado más BAJO. En las recetas mexicanas es
         * muy común poner el folio o la fecha al pie del formato: arrastrarlos ahí
         * hacía que `top` superara el alto de la hoja, el área de contenido
         * colapsaba, y como cada hoja tiene `overflow: hidden` LOS MEDICAMENTOS
         * DESAPARECÍAN sin ningún aviso. El médico calibraba su formato y su receta
         * salía en blanco.
         *
         * Se deja siempre al menos `MIN_CONTENIDO_MM` de área útil.
         */
        const MIN_CONTENIDO_MM = 25
        const bottom = Math.round(0.14 * h)
        const topDeseado = Math.round(((Math.max(...ys) + 6) / 100) * h)
        margenes = {
          top: Math.min(topDeseado, Math.max(0, h - bottom - MIN_CONTENIDO_MM)),
          bottom,
          right: 12, left: 12,
        }
      }
    }
    /**
     * CLAMP FINAL — el área de contenido NUNCA puede colapsar.
     *
     * El cuerpo se dibuja en un recuadro absoluto `top:Xmm … bottom:Ymm` dentro de
     * una hoja con `overflow:hidden`. Si los márgenes (calibrados A MANO, o el default
     * 35/30) suman MÁS que la altura real `h` —muy común con un membrete APAISADO,
     * donde `h = w / aspecto` sale baja— el recuadro se invierte y los MEDICAMENTOS
     * desaparecen sin aviso. La protección MIN_CONTENIDO de arriba solo cubría el
     * caso auto; aquí se aplica a TODOS (incluido el calibrado a mano y el default),
     * y a los mismos márgenes que usa la paginación → render y conteo coinciden.
     */
    const MIN_CONTENIDO_MM = 22
    const baseM = margenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
    const bottomC = Math.min(baseM.bottom, Math.max(0, h - MIN_CONTENIDO_MM))
    const topC = Math.min(baseM.top, Math.max(0, h - bottomC - MIN_CONTENIDO_MM))
    const margenesSeguros = { ...baseM, top: topC, bottom: bottomC }
    return { ...recetaConfig, disenoWidthMm: w, disenoHeightMm: h, disenoMargenes: margenesSeguros }
  }, [custom, recetaConfig, imgAspect])

  const paper = paperEfectivo(cfg)
  const paginas = calcularPaginas(data, config, cfg)
  const host = dimensionesImpresion(cfg)

  return (
    <div id={containerId}>
      {paginas.map((pagina) => {
        const hoja = custom
          ? <HojaCustom pagina={pagina} data={data} config={config} recetaConfig={cfg} paper={paper} />
          : <HojaGenerada pagina={pagina} data={data} config={config} recetaConfig={cfg} paper={paper} />
        return (
          // page-break INLINE (no en @media print): html2pdf captura estilos de
          // pantalla, así el PDF también respeta los cortes de hoja.
          <div
            key={pagina.numero}
            className="receta-sheet-wrap"
            style={{ pageBreakAfter: pagina.esUltima ? 'auto' : 'always', breakAfter: pagina.esUltima ? 'auto' : 'page' }}
          >
            {host.esHostCarta ? <HostCarta paper={paper}>{hoja}</HostCarta> : hoja}
          </div>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
 * Host carta: hoja carta blanca con la receta arriba-centro
 * + línea punteada de corte ✂ donde termina el papel de la receta
 * ════════════════════════════════════════════════════════════════ */
function HostCarta({ paper, children }: { paper: { widthMm: number; heightMm: number }; children: React.ReactNode }) {
  const { escala } = colocacionEnCarta(paper)
  return (
    <div
      className="receta-sheet"
      style={{
        width: `${CARTA.widthMm}mm`,
        height: `${CARTA.heightMm}mm`,
        background: '#fff',
        margin: '0 auto',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ transform: `scale(${escala})`, transformOrigin: 'center' }}>
        {children}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
 * Cuerpos compartidos (Rx / estudios / indicaciones / nota)
 * ════════════════════════════════════════════════════════════════ */

function CuerpoRx({ medicamentos, fontSize, startIndex, variant = 'plano', accent = '#2845EA' }: {
  medicamentos: Medicamento[]; fontSize: number; startIndex: number
  /** 'limpio' = chips numerados con acento (plantilla generada); 'plano' = lista simple (sobre diseño propio) */
  variant?: 'limpio' | 'plano'
  accent?: string
}) {

  if (medicamentos.length === 0) return null

  if (variant === 'plano') {
    return (
      <ol start={startIndex} style={{ margin: 0, paddingLeft: 18, fontSize, lineHeight: 1.5 }}>
        {medicamentos.map((m, i) => (
          <li key={i} style={{ marginBottom: 4, breakInside: 'avoid' }}>
            <strong>{m.nombre}{m.dosis ? ` ${m.dosis}` : ''}</strong>
            {m.via && <span> · {etiquetaVia(m.via)}</span>}
            <br />
            <span style={{ fontSize: fontSize - 0.5 }}>
              {[m.frecuencia, m.duracion && `por ${m.duracion}`, m.indicacion].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    )
  }

  // Variante LIMPIA — cada fármaco como fila con número en chip de acento,
  // nombre+dosis prominente y posología en gris. Calidad "de revista".
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {medicamentos.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, breakInside: 'avoid', alignItems: 'flex-start' }}>
          <div style={{
            flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
            background: accent, color: '#fff', fontSize: 10.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
          }}>{startIndex + i}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: fontSize + 0.5, fontWeight: 700, color: '#111', lineHeight: 1.25 }}>
              {m.nombre}{m.dosis ? ` ${m.dosis}` : ''}
              {m.via && <span style={{ fontWeight: 500, color: '#666', fontSize: fontSize - 1 }}> · {etiquetaVia(m.via)}</span>}
            </div>
            <div style={{ fontSize: fontSize - 0.5, color: '#444', lineHeight: 1.4, marginTop: 1 }}>
              {[m.frecuencia, m.duracion && `por ${m.duracion}`, m.indicacion].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CuerpoEstudios({ estudios, fontSize, dosColumnas, conTitulo }: { estudios: string[]; fontSize: number; dosColumnas: boolean; conTitulo: boolean }) {
  if (estudios.length === 0) return null
  return (
    <div>
      {conTitulo && <div style={{ fontSize, fontWeight: 700, marginBottom: 4 }}>Estudios solicitados:</div>}
      {dosColumnas ? (
        // Checklist 2 columnas — formato estándar de orden de laboratorio.
        // Duplica la capacidad por hoja y el laboratorio palomea cada casilla.
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: '5mm',
          rowGap: 2,
          fontSize: fontSize - 0.5,
          lineHeight: 1.4,
        }}>
          {estudios.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, breakInside: 'avoid' }}>
              <span style={{ flexShrink: 0 }}>☐</span>
              <span>{e}</span>
            </div>
          ))}
        </div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize, lineHeight: 1.5 }}>
          {estudios.map((e, i) => <li key={i} style={{ breakInside: 'avoid' }}>{e}</li>)}
        </ol>
      )}
    </div>
  )
}

function CuerpoIndicaciones({ indicaciones, notaParaPaciente, fontSize, accent }: { indicaciones?: string; notaParaPaciente?: string; fontSize: number; accent: string }) {
  return (
    <>
      {indicaciones && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: fontSize - 0.5, fontWeight: 700, marginBottom: 2 }}>Indicaciones generales:</div>
          <div style={{ fontSize: fontSize - 0.5, whiteSpace: 'pre-wrap' }}>{indicaciones}</div>
        </div>
      )}
      {notaParaPaciente && (
        <div style={{
          marginTop: 6, padding: '3px 8px', borderRadius: 3,
          background: 'rgba(255,200,0,0.12)', borderLeft: `2px solid ${accent}`,
          fontSize: fontSize - 1,
        }}>
          {notaParaPaciente}
        </div>
      )}
    </>
  )
}

/** Indicador "Hoja X de Y" — solo cuando hay más de una. */
function IndicadorHoja({ pagina }: { pagina: PaginaReceta }) {
  if (pagina.total <= 1) return null
  return (
    <div style={{
      position: 'absolute', bottom: '2mm', right: '4mm',
      fontSize: 8, color: '#6b7280', fontVariantNumeric: 'tabular-nums',
    }}>
      Hoja {pagina.numero} de {pagina.total}
    </div>
  )
}

/** Línea de continuación en hojas 2+ (mantiene trazabilidad NOM-004). */
function LineaContinuacion({ data, fontSize }: { data: RecetaData; fontSize: number }) {
  return (
    <div style={{
      fontSize: fontSize - 2, color: '#666',
      borderBottom: '1px solid rgba(0,0,0,0.15)',
      paddingBottom: 2, marginBottom: 5,
      display: 'flex', justifyContent: 'space-between',
    }}>
      <span>Continuación — {data.paciente?.nombre ?? ''}</span>
      <span style={{ fontFamily: 'monospace' }}>Folio: {data.folio}</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
 * HOJA con diseño custom del médico (su propio papel como fondo)
 * ════════════════════════════════════════════════════════════════ */
function HojaCustom({
  pagina, data, config, recetaConfig, paper,
}: {
  pagina: PaginaReceta
  data: RecetaData
  config: ClinicConfig | null
  recetaConfig: RecetaConfig
  paper: { widthMm: number; heightMm: number }
}) {
  const margenes = recetaConfig.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
  const fontSize = recetaConfig.disenoFontSize ?? 11
  // Tamaños (mm) configurables de firma/sello y QR sobre el diseño.
  const tamFirma = recetaConfig.disenoTamanos?.firma ?? 20
  const tamQr = recetaConfig.disenoTamanos?.qr ?? 14
  // Calibrador: si el médico colocó campos a mano, se ponen en su coordenada exacta.
  const campos = recetaConfig.disenoCampos
  const hayCampos = !!(campos && Object.keys(campos).length > 0)
  const valorCampo = (k: string): string =>
    k === 'nombre' ? (data.paciente?.nombre ?? '')
    : k === 'edad' ? (data.paciente?.edad ? String(data.paciente.edad) : '')
    /**
     * Fecha de nacimiento: la exigen las farmacias para dispensar.
     *
     * Va CON su etiqueta («Fecha de nacimiento: 15/03/1984»), a diferencia del
     * nombre o la edad. La razón: el membrete impreso del médico ya trae escrito
     * «Nombre:» y «Edad:», pero NO trae esta etiqueta —es un requisito nuevo—, así
     * que una fecha suelta sobre el papel no se distinguiría de la fecha de
     * expedición. Mismo formateador que el encabezado por defecto: dos formatos de
     * fecha en la misma receta se leen como un error.
     */
    : k === 'nacimiento' ? (data.paciente?.fechaNacimiento ? `Fecha de nacimiento: ${fmtFechaNac(data.paciente.fechaNacimiento)}` : '')
    : k === 'sexo' ? (data.paciente?.sexo ?? '')
    : k === 'fecha' ? data.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : k === 'folio' ? data.folio : ''
  // Numeración Rx continua entre hojas
  const startIndex = data.medicamentos
    ? (data.medicamentos.findIndex(m => m === pagina.medicamentos[0]) + 1) || 1
    : 1
  const dosColumnas = (data.estudios?.length ?? 0) > 6

  return (
    <div
      className="receta-sheet"
      style={{
        width: `${paper.widthMm}mm`,
        height: `${paper.heightMm}mm`,
        position: 'relative',
        background: '#fff',
        margin: '0 auto',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
        color: '#1a1a1a',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Diseño del médico como fondo — se repite en CADA hoja */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={recetaConfig.disenoCompletoDataUrl}
        alt="Diseño de receta"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable={false}
      />
      {/* Campos CALIBRADOS — cada dato en la coordenada exacta sobre el diseño */}
      {/* Datos del paciente (nombre/edad/fecha…) en TODAS las hojas — cada hoja es
          una receta completa que se entrega por separado. */}
      {hayCampos && campos && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {(Object.keys(campos) as (keyof typeof campos)[]).map(k => {
            const pos = campos[k]; const valor = valorCampo(k as string)
            if (!pos || !valor) return null
            return (
              <div key={k} style={{
                position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translateY(-50%)', fontSize: `${fontSize}px`,
                color: '#1a1a1a', whiteSpace: 'nowrap',
              }}>{valor}</div>
            )
          })}
        </div>
      )}
      {/* Área de contenido */}
      <div
        style={{
          position: 'absolute',
          top: `${margenes.top}mm`,
          right: `${margenes.right}mm`,
          bottom: `${margenes.bottom}mm`,
          left: `${margenes.left}mm`,
          fontSize: `${fontSize}px`,
          lineHeight: 1.35,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Hoja 1 (salvo modo "solo Rx"). En un membrete CUSTOM la app NUNCA pone
            su propio "Nombre/Fecha/Folio": tu hoja ya los trae impresos y se
            encimaría (era el "mugrero" de arriba). Los VALORES del paciente se
            colocan en su lugar con el calibrador / "Detectar con IA". */}
        {pagina.esPrimera && !recetaConfig.disenoSoloRx && (
          <>
            {recetaConfig.mostrarDiagnostico !== false && data.diagnostico && (
              <div style={{ marginBottom: 4 }}>
                <strong>Dx:</strong> {data.diagnostico}
              </div>
            )}
            {/*
              LA RECETA LEÍA UNA FUENTE DISTINTA DE LA PANTALLA.

              La verificación en pantalla usa `alergiasDe`, que prefiere
              `alergiasEstructuradas` sobre el texto libre; aquí se imprimía
              `paciente.alergias` en crudo. El propio módulo describe el
              desenlace: «un paciente con la alergia únicamente en el campo
              estructurado veía una alerta roja en pantalla y un papel que decía
              Negadas» — y de todos los papeles, éste es el que va a la farmacia.

              Hoy ninguna ruta llena el campo estructurado, así que la
              divergencia todavía no está activa; la activa el mismo día que
              entre una importación de otro sistema. La pantalla y el papel tienen
              que leer de la misma fuente ANTES de eso, no después.

              Se conserva el comportamiento de no pintar el recuadro cuando no hay
              dato: un impreso no debe afirmar «Negadas» a partir de un campo que
              nadie llenó.
            */}
            {recetaConfig.mostrarAlergias !== false && alergiasParaImpreso(data.paciente) && (
              <div style={{
                border: '1px solid #b91c1c', color: '#b91c1c',
                padding: '2px 6px', borderRadius: 3,
                fontSize: fontSize - 1, fontWeight: 700, marginBottom: 6,
              }}>
                ALERGIAS: {alergiasParaImpreso(data.paciente)}
              </div>
            )}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.15)', margin: '4px 0 6px 0' }} />
          </>
        )}

        {/* Hojas 2+: línea de continuación */}
        {!pagina.esPrimera && <LineaContinuacion data={data} fontSize={fontSize} />}

        {/* Cuerpo de ESTA hoja */}
        {data.tipo === 'receta' && (
          <CuerpoRx medicamentos={pagina.medicamentos} fontSize={fontSize} startIndex={startIndex} />
        )}
        {data.tipo === 'orden' && (
          <CuerpoEstudios estudios={pagina.estudios} fontSize={fontSize} dosColumnas={dosColumnas} conTitulo={pagina.esPrimera} />
        )}

        {/* Cola: solo en la última hoja */}
        {pagina.esUltima && (
          <CuerpoIndicaciones
            indicaciones={pagina.indicaciones}
            notaParaPaciente={pagina.notaParaPaciente}
            fontSize={fontSize}
            accent="#f59e0b"
          />
        )}
      </div>

      {/* Firma en TODAS las hojas: sobre un formato propio, cada hoja es una
          receta que se firma y se entrega. (El comentario anterior decía "solo en
          la última" y contradecía tanto a este código como a la reserva de la
          paginación; se eliminó para no confundir al siguiente que lo lea.) */}
      {config?.firmaImagenDataUrl && (
        <div style={campos?.firma
          ? {
              position: 'absolute',
              left: `${campos.firma.x}%`,
              top: `${campos.firma.y}%`,
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }
          : {
              position: 'absolute',
              bottom: `${Math.max(4, margenes.bottom - 22)}mm`,
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
            }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.firmaImagenDataUrl}
            alt="Firma"
            style={{ height: `${tamFirma}mm`, maxWidth: `${tamFirma * 3.2}mm`, width: 'auto', display: 'block' }}
          />
        </div>
      )}

      {/* QR — SOLO en la última hoja. Posición calibrable (campos.qr) y tamaño configurable. */}
      {pagina.esUltima && recetaConfig.mostrarQR && (
        <div style={campos?.qr
          ? { position: 'absolute', left: `${campos.qr.x}%`, top: `${campos.qr.y}%`, transform: 'translate(-50%, -50%)', textAlign: 'center' }
          : { position: 'absolute', bottom: `${Math.max(2, margenes.bottom - 16)}mm`, right: `${margenes.right}mm`, textAlign: 'center' }}>
          <QrLocal contenido={data.verificacionUrl || `Folio:${data.folio}`} tamMm={tamQr} />
        </div>
      )}

      <IndicadorHoja pagina={pagina} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
 * HOJA con plantilla auto-generada (sin diseño subido)
 * ════════════════════════════════════════════════════════════════ */
function HojaGenerada({
  pagina, data, config, recetaConfig, paper,
}: {
  pagina: PaginaReceta
  data: RecetaData
  config: ClinicConfig | null
  recetaConfig: RecetaConfig
  paper: { widthMm: number; heightMm: number }
}) {
  const accent = recetaConfig.colorAccento ?? '#14b8a6'
  const estilo = recetaConfig.estilo ?? 'minimalista'
  const medico = config?.nombreMedico ?? '—'
  const cedula = config?.cedulaProfesional ?? '—'
  const especialidad = config?.especialidad ?? ''
  const clinica = config?.nombreClinica ?? ''
  const direccion = config?.direccion ?? ''
  const telefono = config?.telefonoAdmin || config?.whatsappConsultorio || ''
  const startIndex = data.medicamentos
    ? (data.medicamentos.findIndex(m => m === pagina.medicamentos[0]) + 1) || 1
    : 1
  const dosColumnas = (data.estudios?.length ?? 0) > 6

  const fontFamily = estilo === 'clasico'
    ? '"Times New Roman", Georgia, serif'
    : estilo === 'moderno'
    ? '"Helvetica Neue", Arial, sans-serif'
    : '"Inter", system-ui, -apple-system, sans-serif'

  return (
    <div
      className="receta-sheet"
      style={{
        width: `${paper.widthMm}mm`,
        height: `${paper.heightMm}mm`,
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily,
        fontSize: 11,
        lineHeight: 1.35,
        padding: '10mm 12mm',
        boxSizing: 'border-box',
        position: 'relative',
        margin: '0 auto',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {pagina.esPrimera ? (
        <>
          {/* Encabezado: membrete subido o auto-generado */}
          {recetaConfig.membreteDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recetaConfig.membreteDataUrl}
              alt="Membrete"
              style={{ width: '100%', maxHeight: '40mm', objectFit: 'contain', display: 'block', marginBottom: 6 }}
            />
          ) : (
            <EncabezadoAuto estilo={estilo} accent={accent} medico={medico} cedula={cedula} especialidad={especialidad} clinica={clinica} direccion={direccion} telefono={telefono} />
          )}

          {/* Banda de tipo de documento */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0',
            borderTop: estilo === 'clasico' ? '1.5px solid #1a1a1a' : `1.5px solid ${accent}`,
            borderBottom: estilo === 'clasico' ? '1.5px solid #1a1a1a' : `1.5px solid ${accent}`,
            margin: '6px 0',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            <div style={{ color: accent }}>{data.tipo === 'receta' ? 'Receta Médica' : 'Orden Médica'}</div>
            <div style={{ fontSize: 9.5, color: '#666', fontWeight: 500 }}>
              Folio: {data.folio} · {data.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Datos del paciente — bloque con fondo sutil y etiquetas */}
          <div style={{
            background: '#f7f8fa', borderRadius: 6, padding: '7px 11px', marginBottom: 7,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 11.5 }}>
              <span style={{ fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Paciente</span>
              <span style={{ fontWeight: 700, color: '#111' }}>{data.paciente?.nombre ?? '—'}</span>
            </div>
            <div style={{ fontSize: 10, color: '#555', textAlign: 'right' }}>
              {data.paciente?.edad ? <>{data.paciente.edad} años{data.paciente?.sexo ? ' · ' : ''}</> : ''}
              {data.paciente?.sexo || ''}
              {data.paciente?.fechaNacimiento && <div style={{ fontSize: 9.5, color: '#555' }}>F. nac.: {fmtFechaNac(data.paciente.fechaNacimiento)}</div>}
              {data.paciente?.telefono && <div style={{ fontSize: 9.5, color: '#555' }}>Tel. {data.paciente.telefono}</div>}
            </div>
          </div>

          {/* Alergias destacadas */}
          {recetaConfig.mostrarAlergias !== false && (
            <div style={{
              border: '1.2px solid #b91c1c',
              color: '#b91c1c',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 6,
            }}>
              ALERGIAS: {data.paciente?.alergias || 'Negadas / no referidas'}
            </div>
          )}

          {/* Diagnóstico */}
          {recetaConfig.mostrarDiagnostico !== false && data.diagnostico && (
            <div style={{ marginBottom: 6, fontSize: 10.5 }}>
              <strong>Dx:</strong> {data.diagnostico}
            </div>
          )}
        </>
      ) : (
        <LineaContinuacion data={data} fontSize={11} />
      )}

      {/* Cuerpo de ESTA hoja */}
      {data.tipo === 'receta' && pagina.medicamentos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {pagina.esPrimera && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: accent, fontFamily: 'Georgia, serif', lineHeight: 1 }}>℞</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>Prescripción</span>
            </div>
          )}
          <CuerpoRx medicamentos={pagina.medicamentos} fontSize={11} startIndex={startIndex} variant="limpio" accent={accent} />
        </div>
      )}

      {data.tipo === 'orden' && pagina.estudios.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <CuerpoEstudios estudios={pagina.estudios} fontSize={11} dosColumnas={dosColumnas} conTitulo={pagina.esPrimera} />
        </div>
      )}

      {/* Cola + firma + pie — SOLO última hoja */}
      {pagina.esUltima && (
        <>
          <CuerpoIndicaciones indicaciones={pagina.indicaciones} notaParaPaciente={pagina.notaParaPaciente} fontSize={11} accent={accent} />

          <div style={{ marginTop: 'auto', paddingTop: 14, textAlign: 'center' }}>
            {config?.firmaImagenDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.firmaImagenDataUrl}
                alt="Firma del médico"
                style={{
                  maxHeight: '18mm',
                  maxWidth: '60mm',
                  margin: '0 auto -4mm auto',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            )}
            <div style={{
              borderTop: '1px solid #1a1a1a',
              width: 200,
              margin: '0 auto',
              paddingTop: 3,
              fontSize: 10,
            }}>
              <strong>{medico}</strong><br />
              {especialidad && <>{especialidad}<br /></>}
              {/* Sin cédula NO se calla: la cédula es requisito del impreso
                  (NOM-004). Antes imprimía "Cédula Prof. —", que parece un guion
                  de maquetación y no la ausencia de un dato obligatorio. */}
              {cedula !== '—'
                ? <>Cédula Prof. {cedula}</>
                : <span style={{ color: '#b91c1c' }}>[FALTA CÉDULA PROFESIONAL]</span>}
              {recetaConfig.registroDGP && <><br />Reg. DGP/SSA {recetaConfig.registroDGP}</>}
            </div>
          </div>

          {recetaConfig.pieDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recetaConfig.pieDataUrl}
              alt="Pie de página"
              style={{ width: '100%', maxHeight: '15mm', objectFit: 'contain', marginTop: 8 }}
            />
          ) : (
            recetaConfig.avisoLegal && (
              <div style={{
                marginTop: 10,
                fontSize: 8.5,
                color: '#666',
                textAlign: 'center',
                paddingTop: 4,
                borderTop: '1px dashed #ccc',
              }}>
                {recetaConfig.avisoLegal}
                {recetaConfig.vigenciaDias && (
                  <> · Vigencia: {recetaConfig.vigenciaDias} días desde la emisión</>
                )}
              </div>
            )
          )}

          {recetaConfig.mostrarQR && (
            <div style={{ position: 'absolute', bottom: '8mm', right: '10mm', textAlign: 'center' }}>
              <QrLocal contenido={data.verificacionUrl || `Folio:${data.folio}`} tamMm={14} />
              <div style={{ fontSize: 7, color: '#666', marginTop: 1 }}>Verificación</div>
            </div>
          )}
        </>
      )}

      <IndicadorHoja pagina={pagina} />
    </div>
  )
}

/**
 * Encabezado auto-generado cuando el médico no subió membrete.
 * Se adapta al estilo (minimalista / clásico / moderno).
 */
function EncabezadoAuto({
  estilo, accent, medico, cedula, especialidad, clinica, direccion, telefono,
}: {
  estilo: 'minimalista' | 'clasico' | 'moderno'
  accent: string
  medico: string
  cedula: string
  especialidad: string
  clinica: string
  direccion: string
  telefono: string
}) {
  if (estilo === 'moderno') {
    return (
      <div style={{
        background: accent,
        color: '#fff',
        padding: '6mm 8mm',
        margin: '-10mm -12mm 6mm -12mm',
        borderRadius: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>{medico}</div>
        <div style={{ fontSize: 10.5, opacity: 0.95 }}>
          {especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula ${cedula}` : ''}
        </div>
        {clinica && <div style={{ fontSize: 10, opacity: 0.9, marginTop: 1 }}>{clinica}</div>}
        {(direccion || telefono) && (
          <div style={{ fontSize: 9.5, opacity: 0.85 }}>
            {direccion}{direccion && telefono ? ' · ' : ''}{telefono}
          </div>
        )}
      </div>
    )
  }

  // Clásico: centrado serif, doble filete (estilo receta tradicional)
  if (estilo === 'clasico') {
    return (
      <div style={{ textAlign: 'center', paddingBottom: 7, borderBottom: '3px double #1a1a1a', marginBottom: 7 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>{medico}</div>
        <div style={{ fontSize: 10, marginTop: 2, color: '#333' }}>
          {especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula Prof. ${cedula}` : ''}
        </div>
        {clinica && <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{clinica}</div>}
        {(direccion || telefono) && <div style={{ fontSize: 9, color: '#666', marginTop: 1 }}>{direccion}{direccion && telefono ? ' · Tel. ' : telefono ? 'Tel. ' : ''}{telefono}</div>}
      </div>
    )
  }

  // Minimalista: nombre a la izquierda con barra de acento, datos a la derecha
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
      paddingBottom: 7, borderBottom: `2px solid ${accent}`, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ width: 3, background: accent, borderRadius: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: -0.2, lineHeight: 1.1 }}>{medico}</div>
          {especialidad && <div style={{ fontSize: 10.5, color: accent, fontWeight: 600, marginTop: 1 }}>{especialidad}</div>}
          {cedula !== '—' && <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>Cédula Prof. {cedula}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, color: '#666', lineHeight: 1.5, paddingTop: 2 }}>
        {clinica && <div style={{ fontWeight: 600, color: '#444', fontSize: 9.5 }}>{clinica}</div>}
        {direccion && <div>{direccion}</div>}
        {telefono && <div>Tel. {telefono}</div>}
      </div>
    </div>
  )
}
