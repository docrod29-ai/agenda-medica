/**
 * ESCRITOR DE LIBROS .xlsx — sin una sola dependencia nueva.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `csv-clinico.ts` lo dejó escrito hace tres versiones: «una pestaña por dominio
 * es como se piensa esa información, y **un CSV por dominio es la versión sin
 * dependencias nuevas de esa idea**». Esto es la idea entera: el consultorio
 * baja UN archivo y lo abre con las seis pestañas puestas, en vez de seis
 * descargas que hay que juntar a mano.
 *
 * ── POR QUÉ ESCRITO A MANO Y NO CON UNA LIBRERÍA ─────────────────────────────
 *
 * Un `.xlsx` es un ZIP con media docena de XML dentro. Para una tabla —cabecera,
 * filas, números y texto— eso son doscientas líneas deterministas y probables.
 * Las librerías del ramo pesan megas, arrastran árboles enteros de dependencias
 * y han tenido su cuota de CVEs; ninguna de esas dos cosas se paga con gusto en
 * un producto que maneja expedientes.
 *
 * ── LA VENTAJA DE SEGURIDAD QUE NO ES ACCIDENTAL ─────────────────────────────
 *
 * En CSV, una celda que empieza por `=`, `+`, `-` o `@` la evalúa Excel al
 * abrirla: es la inyección de fórmulas que `lib/csv-seguro.ts` neutraliza con un
 * apóstrofo. Aquí **no hace falta**, y no por descuido: cada celda de texto se
 * escribe como `inlineStr`, un tipo que Excel **nunca** evalúa. `=1+1` en un
 * `inlineStr` es el texto «=1+1», punto. La defensa no es un filtro que hay que
 * recordar aplicar: es el formato.
 *
 * Lo que sí hay que hacer es escapar el XML, que es lo que rompería el archivo.
 *
 * ── COMPRESIÓN ───────────────────────────────────────────────────────────────
 *
 * El ZIP se escribe con método STORE (sin comprimir). Es válido, lo abre
 * cualquier lector, y ahorra traer un deflate. Un libro de decenas de miles de
 * filas pesa más de lo que pesaría comprimido; a cambio, cero dependencias y
 * cero superficie nueva.
 *
 * Módulo PURO: entra data, sale un `Uint8Array`. Sin red, sin disco, sin reloj
 * (la fecha del ZIP es fija a propósito — dos exportaciones del mismo dato dan
 * el MISMO archivo, y eso hace que se pueda probar por bytes).
 */

/** Lo que cabe en una celda. `null`/`undefined` = celda vacía. */
export type Celda = string | number | boolean | null | undefined

export interface Hoja {
  /** Nombre de la pestaña. Se sanea a las reglas de Excel (ver `nombreDeHoja`). */
  nombre: string
  /** Fila de cabecera. Va en negrita y congelada. */
  cabecera: string[]
  filas: Celda[][]
  /**
   * Anchos de columna en caracteres. Si no se dan, se calculan del contenido
   * (una columna de 3 caracteres de ancho con un texto de 80 dentro obliga a
   * ensanchar a mano cada vez que se abre el archivo).
   */
  anchos?: number[]
}

/* ═══════════════════════ XML ═══════════════════════ */

/**
 * Escapa lo que rompería el XML.
 *
 * También quita los caracteres de control que el estándar prohíbe: un `0x0B`
 * colado desde un dato del expediente **corrompe el archivo entero** y el lector
 * dice «formato no válido», sin señalar la celda. Se pierde ese carácter, que no
 * significaba nada, y se salva el libro.
 */
export function escaparXml(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Índice de columna → letra: 0→A, 25→Z, 26→AA. */
export function columnaAletra(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  }
  return s
}

/**
 * Nombre de pestaña válido para Excel: ≤31 caracteres, sin `[]:*?/\`, no vacío.
 *
 * Un nombre inválido no da un aviso: da un archivo que **no abre**. Y dos
 * pestañas con el mismo nombre, tampoco — por eso la unicidad se resuelve aquí
 * y no se confía en quien llame.
 */
export function nombreDeHoja(bruto: string, usados: Set<string> = new Set()): string {
  let n = (bruto || 'Hoja').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Hoja'
  if (usados.has(n.toLowerCase())) {
    for (let i = 2; ; i++) {
      const cand = `${n.slice(0, 31 - String(i).length - 1)} ${i}`
      if (!usados.has(cand.toLowerCase())) { n = cand; break }
    }
  }
  usados.add(n.toLowerCase())
  return n
}

/**
 * Una celda.
 *
 * Los números van como número (para poder sumarlos) y TODO lo demás como
 * `inlineStr`. Un `NaN`/`Infinity` NO se escribe como número: Excel lo rechaza y
 * rompe el archivo; se escribe como su texto, que es información igual.
 */
function celdaXml(ref: string, v: Celda): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return `<c r="${ref}" t="inlineStr"><is><t>${escaparXml(String(v))}</t></is></c>`
    return `<c r="${ref}"><v>${v}</v></c>`
  }
  const texto = typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`
}

function hojaXml(h: Hoja): string {
  const anchos = h.anchos ?? anchosAutomaticos(h)
  const cols = anchos.length
    ? `<cols>${anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${a}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const filaCabecera = `<row r="1">${h.cabecera
    .map((c, i) => `<c r="${columnaAletra(i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${escaparXml(c)}</t></is></c>`)
    .join('')}</row>`
  const filas = h.filas.map((f, fi) => {
    const r = fi + 2
    const celdas = f.map((v, ci) => celdaXml(`${columnaAletra(ci)}${r}`, v)).join('')
    return `<row r="${r}">${celdas}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<sheetViews><sheetView workbookViewId="0">`
    // Cabecera congelada: sin esto, a la fila 40 de un expediente ya nadie sabe
    // qué columna está mirando.
    + `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
    + `</sheetView></sheetViews>${cols}<sheetData>${filaCabecera}${filas}</sheetData></worksheet>`
}

/** Ancho por contenido, con tope: una celda larguísima no debe hacer una columna ilegible. */
function anchosAutomaticos(h: Hoja): number[] {
  return h.cabecera.map((c, i) => {
    let max = c.length
    for (const f of h.filas) {
      const v = f[i]
      if (v === null || v === undefined) continue
      const l = String(v).length
      if (l > max) max = l
    }
    return Math.min(Math.max(max + 2, 8), 60)
  })
}

/* ═══════════════════════ ZIP (STORE) ═══════════════════════ */

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(b: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

const utf8 = (s: string) => new TextEncoder().encode(s)

/**
 * ZIP con método STORE.
 *
 * La fecha/hora es FIJA (1980-01-01, el cero del formato). No es pereza: hace
 * que exportar dos veces el mismo dato dé el mismo archivo byte a byte, y eso es
 * lo que permite probarlo de verdad en vez de comprobar que «no truena».
 */
function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const locales: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const f of archivos) {
    const nombre = utf8(f.nombre)
    const crc = crc32(f.datos)
    const cab = new Uint8Array(30 + nombre.length)
    const v = new DataView(cab.buffer)
    v.setUint32(0, 0x04034b50, true)   // firma
    v.setUint16(4, 20, true)           // versión mínima
    v.setUint16(6, 0x0800, true)       // banderas: nombre en UTF-8
    v.setUint16(8, 0, true)            // método: STORE
    v.setUint16(10, 0, true); v.setUint16(12, 33, true) // hora/fecha fijas
    v.setUint32(14, crc, true)
    v.setUint32(18, f.datos.length, true)
    v.setUint32(22, f.datos.length, true)
    v.setUint16(26, nombre.length, true)
    v.setUint16(28, 0, true)
    cab.set(nombre, 30)
    locales.push(cab, f.datos)

    const cen = new Uint8Array(46 + nombre.length)
    const w = new DataView(cen.buffer)
    w.setUint32(0, 0x02014b50, true)
    w.setUint16(4, 20, true); w.setUint16(6, 20, true)
    w.setUint16(8, 0x0800, true)
    w.setUint16(10, 0, true)
    w.setUint16(12, 0, true); w.setUint16(14, 33, true)
    w.setUint32(16, crc, true)
    w.setUint32(20, f.datos.length, true)
    w.setUint32(24, f.datos.length, true)
    w.setUint16(28, nombre.length, true)
    w.setUint32(42, offset, true)
    cen.set(nombre, 46)
    central.push(cen)

    offset += cab.length + f.datos.length
  }

  const tamCentral = central.reduce((a, b) => a + b.length, 0)
  const fin = new Uint8Array(22)
  const z = new DataView(fin.buffer)
  z.setUint32(0, 0x06054b50, true)
  z.setUint16(8, archivos.length, true)
  z.setUint16(10, archivos.length, true)
  z.setUint32(12, tamCentral, true)
  z.setUint32(16, offset, true)

  const partes = [...locales, ...central, fin]
  const total = partes.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const parte of partes) { out.set(parte, p); p += parte.length }
  return out
}

/* ═══════════════════════ LIBRO ═══════════════════════ */

/**
 * Arma el libro completo.
 *
 * Una hoja SIN filas se conserva a propósito, con su cabecera: la pestaña vacía
 * dice «este dominio no tiene nada», y quitarla diría «este dominio no existe».
 * Son cosas distintas y la segunda hace dudar de la exportación entera.
 */
export function libroXlsx(hojas: Hoja[]): Uint8Array {
  if (!hojas.length) throw new Error('Un libro necesita al menos una hoja.')
  const usados = new Set<string>()
  const conNombre = hojas.map(h => ({ ...h, nombre: nombreDeHoja(h.nombre, usados) }))

  const archivos: { nombre: string; datos: Uint8Array }[] = [
    {
      nombre: '[Content_Types].xml',
      datos: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
        + `<Default Extension="xml" ContentType="application/xml"/>`
        + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
        + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
        + conNombre.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        + `</Types>`),
    },
    {
      nombre: '_rels/.rels',
      datos: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
        + `</Relationships>`),
    },
    {
      nombre: 'xl/workbook.xml',
      datos: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
        + `<sheets>${conNombre.map((h, i) => `<sheet name="${escaparXml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
        + `</workbook>`),
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      datos: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + conNombre.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${conNombre.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + `</Relationships>`),
    },
    {
      // Dos estilos: el 0 por omisión y el 1 en negrita, que es el de la cabecera.
      nombre: 'xl/styles.xml',
      datos: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
        + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
        + `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>`
        + `<borders count="1"><border/></borders>`
        + `<cellStyleXfs count="1"><xf/></cellStyleXfs>`
        + `<cellXfs count="2"><xf xfId="0"/><xf fontId="1" applyFont="1" xfId="0"/></cellXfs>`
        + `</styleSheet>`),
    },
    ...conNombre.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: utf8(hojaXml(h)) })),
  ]

  return zip(archivos)
}

export const TIPO_MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const POR_QUE_SIN_LIBRERIA =
  'Un .xlsx es un ZIP con media docena de XML dentro; para una tabla eso son ' +
  'doscientas líneas deterministas y probables. Las librerías del ramo pesan ' +
  'megas, arrastran árboles enteros de dependencias y han tenido su cuota de ' +
  'CVEs — ninguna de esas dos cosas se paga con gusto en un producto que maneja ' +
  'expedientes.'

export const POR_QUE_NO_HACE_FALTA_EL_APOSTROFO =
  'En CSV, una celda que empieza por = la EVALÚA Excel al abrirla, y por eso ' +
  '`csv-seguro` le antepone un apóstrofo. Aquí cada celda de texto se escribe ' +
  'como `inlineStr`, un tipo que Excel nunca evalúa: «=1+1» es el texto «=1+1». ' +
  'La defensa no es un filtro que haya que acordarse de aplicar, es el formato.'
