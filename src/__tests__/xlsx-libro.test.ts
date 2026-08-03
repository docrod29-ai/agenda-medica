/**
 * GOLDEN — el libro de Excel que no existía, comprobado ABRIÉNDOLO.
 *
 * ── LO QUE FALTABA ───────────────────────────────────────────────────────────
 *
 * No había exportación a Excel. Ninguna. Y `csv-clinico.ts` lo dejó escrito el
 * día que se creó: «una pestaña por dominio es como se piensa esa información, y
 * un CSV por dominio es la versión **sin dependencias nuevas** de esa idea».
 *
 * ── CÓMO SE PRUEBA UN BINARIO SIN CONFIAR EN QUE «NO TRUENA» ─────────────────
 *
 * Un `.xlsx` es un ZIP. Aquí se **descomprime con el `unzip` del sistema** y se
 * leen los XML de dentro: si el ZIP estuviera mal formado —CRC malo, tamaños
 * cruzados, índice central corrido— `unzip` fallaría, que es exactamente lo que
 * haría Excel. Comprobar que la función «devuelve bytes» no probaría nada.
 *
 * Además el escritor es determinista a propósito (fecha del ZIP fija), así que
 * dos exportaciones del mismo dato dan el MISMO archivo byte a byte — y eso
 * también se prueba.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  libroXlsx, escaparXml, columnaAletra, nombreDeHoja, crc32,
  POR_QUE_SIN_LIBRERIA, POR_QUE_NO_HACE_FALTA_EL_APOSTROFO, type Hoja,
} from '@/lib/xlsx'

let dir = ''
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'xlsx-')) })
afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

/** Escribe el libro y saca un archivo de dentro con el `unzip` del sistema. */
function dentroDelZip(libro: Uint8Array, parte: string): string {
  const ruta = join(dir, `l${Math.abs(crc32(libro))}.xlsx`)
  writeFileSync(ruta, libro)
  return execFileSync('unzip', ['-p', ruta, parte], { encoding: 'utf8', maxBuffer: 20e6 })
}

const HOJA: Hoja = {
  nombre: 'consultas',
  cabecera: ['fecha', 'paciente', 'monto'],
  filas: [
    ['2026-08-03', 'Paciente de prueba', 1250],
    ['2026-08-02', 'Otro paciente', 800.5],
  ],
}

describe('el archivo ABRE de verdad', () => {
  const libro = libroXlsx([HOJA])

  it('es un ZIP válido y trae todas las partes', () => {
    const ruta = join(dir, 'estructura.xlsx')
    writeFileSync(ruta, libro)
    const lista = execFileSync('unzip', ['-l', ruta], { encoding: 'utf8' })
    for (const parte of [
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml',
    ]) {
      expect(lista, parte).toContain(parte)
    }
  })

  it('el CRC de cada parte cuadra (si no, Excel diría «archivo dañado»)', () => {
    const ruta = join(dir, 'crc.xlsx')
    writeFileSync(ruta, libro)
    // `unzip -t` comprueba el CRC de TODOS los miembros. Es el mismo control que
    // hace el lector al abrir.
    const salida = execFileSync('unzip', ['-t', ruta], { encoding: 'utf8' })
    expect(salida).toMatch(/No errors detected/i)
  })

  it('empieza por la firma de ZIP, que es como lo reconoce el sistema', () => {
    expect([libro[0], libro[1], libro[2], libro[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})

describe('el contenido llega entero', () => {
  const hoja = dentroDelZip(libroXlsx([HOJA]), 'xl/worksheets/sheet1.xml')

  it('la cabecera va en la fila 1', () => {
    expect(hoja).toContain('<row r="1">')
    for (const c of HOJA.cabecera) expect(hoja).toContain(`<t xml:space="preserve">${c}</t>`)
  })

  it('el texto va como inlineStr', () => {
    expect(hoja).toContain('<t xml:space="preserve">Paciente de prueba</t>')
  })

  it('los números van como NÚMERO, para poder sumarlos', () => {
    /**
     * Si un importe se escribiera como texto, la columna no se suma y la
     * exportación deja de servir para lo único que se le pide: dársela al
     * contador.
     */
    expect(hoja).toContain('<c r="C2"><v>1250</v></c>')
    expect(hoja).toContain('<c r="C3"><v>800.5</v></c>')
  })

  it('la cabecera queda congelada', () => {
    expect(hoja).toContain('state="frozen"')
  })
})

describe('LA INYECCIÓN DE FÓRMULAS MUERE EN EL FORMATO', () => {
  /**
   * En un CSV, `=1+1` lo EVALÚA Excel al abrirlo, y por eso `csv-seguro` le
   * antepone un apóstrofo. Aquí la celda se escribe como `inlineStr`, que Excel
   * no evalúa nunca. La defensa no es un filtro que haya que acordarse de
   * aplicar: es el tipo de celda.
   */
  const peligrosas = ['=1+1', '=HYPERLINK("http://x","clic")', '+A1', '-2+3', '@SUM(A1)',
    '=cmd|\' /C calc\'!A0']
  const hoja = dentroDelZip(libroXlsx([{
    nombre: 'ataque', cabecera: ['valor'], filas: peligrosas.map(p => [p]),
  }]), 'xl/worksheets/sheet1.xml')

  it('cada una viaja como texto, con su `=` intacto', () => {
    for (const p of peligrosas) {
      expect(hoja, p).toContain('t="inlineStr"')
      // El contenido NO se muta: se entrega tal cual, sin apóstrofo postizo.
      expect(hoja, p).toContain(escaparXml(p))
    }
  })

  it('y no aparece ni una celda de fórmula', () => {
    expect(hoja).not.toContain('<f>')
  })

  it('está escrito por qué no hace falta el apóstrofo aquí', () => {
    expect(POR_QUE_NO_HACE_FALTA_EL_APOSTROFO).toMatch(/nunca evalúa/)
  })
})

describe('lo que rompería el archivo se neutraliza', () => {
  it('los caracteres de XML se escapan', () => {
    expect(escaparXml('a & b < c > d "e" \'f\'')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;')
  })

  it('un carácter de control se elimina en vez de corromper el libro', () => {
    /**
     * Un 0x0B colado desde un dato del expediente hace que el lector diga
     * «formato no válido» y no abra NADA — sin señalar la celda. Se pierde ese
     * carácter, que no significaba nada, y se salva el archivo.
     *
     * Los escapes van explícitos (`\u000B`) y no como el byte literal: un byte
     * de control dentro del fuente lo «arregla» en silencio cualquier editor o
     * formateador, y la prueba se quedaría comprobando nada.
     */
    expect(escaparXml('a\u0000b\u001Fc\u000Bd')).toBe('abcd')
    // El tabulador, el salto de línea y el retorno SÍ son válidos en XML: no se tocan.
    expect(escaparXml('a\tb\nc\rd')).toBe('a\tb\nc\rd')
    const hoja = dentroDelZip(libroXlsx([{
      nombre: 'control', cabecera: ['x'], filas: [['a\u0000b\u001Fc']],
    }]), 'xl/worksheets/sheet1.xml')
    expect(hoja).toContain('abc')
  })

  it('un acento sobrevive el viaje (es UTF-8 de verdad)', () => {
    const hoja = dentroDelZip(libroXlsx([{
      nombre: 'acentos', cabecera: ['nombre'], filas: [['Rodríguez Ñandú']],
    }]), 'xl/worksheets/sheet1.xml')
    expect(hoja).toContain('Rodríguez Ñandú')
  })
})

describe('los nombres de pestaña, que si no el archivo NO abre', () => {
  it('se recortan a 31 y se limpian los caracteres prohibidos', () => {
    expect(nombreDeHoja('a/b\\c[d]e:f*g?h')).toBe('a b c d e f g h')
    expect(nombreDeHoja('x'.repeat(50))).toHaveLength(31)
    expect(nombreDeHoja('')).toBe('Hoja')
  })

  it('dos pestañas no pueden llamarse igual', () => {
    const usados = new Set<string>()
    expect(nombreDeHoja('citas', usados)).toBe('citas')
    expect(nombreDeHoja('citas', usados)).toBe('citas 2')
    expect(nombreDeHoja('CITAS', usados)).toBe('CITAS 3')
  })

  it('y el libro las aplica: dos hojas homónimas siguen abriendo', () => {
    const wb = libroXlsx([
      { nombre: 'igual', cabecera: ['a'], filas: [] },
      { nombre: 'igual', cabecera: ['a'], filas: [] },
    ])
    const workbook = dentroDelZip(wb, 'xl/workbook.xml')
    expect(workbook).toContain('name="igual"')
    expect(workbook).toContain('name="igual 2"')
  })
})

describe('varias pestañas', () => {
  const wb = libroXlsx([
    { nombre: 'RESUMEN', cabecera: ['campo', 'valor'], filas: [['filas', 2]] },
    HOJA,
    { nombre: 'vacía', cabecera: ['a', 'b'], filas: [] },
  ])

  it('todas quedan declaradas en el libro', () => {
    const workbook = dentroDelZip(wb, 'xl/workbook.xml')
    expect(workbook).toContain('name="RESUMEN"')
    expect(workbook).toContain('name="consultas"')
    expect(workbook).toContain('name="vacía"')
  })

  it('la pestaña VACÍA se conserva, con su cabecera', () => {
    /**
     * Una pestaña vacía dice «este dominio no tiene nada»; quitarla diría «este
     * dominio no existe». Son cosas distintas, y la segunda hace dudar de la
     * exportación entera.
     */
    const h3 = dentroDelZip(wb, 'xl/worksheets/sheet3.xml')
    expect(h3).toContain('<row r="1">')
    expect(h3).not.toContain('<row r="2">')
  })
})

describe('detalles que se pagan caros', () => {
  it('la columna 27 es AA (una hoja ancha no debe descolocarse)', () => {
    expect(columnaAletra(0)).toBe('A')
    expect(columnaAletra(25)).toBe('Z')
    expect(columnaAletra(26)).toBe('AA')
    expect(columnaAletra(51)).toBe('AZ')
    expect(columnaAletra(52)).toBe('BA')
  })

  it('un NaN no se escribe como número: rompería el archivo', () => {
    const hoja = dentroDelZip(libroXlsx([{
      nombre: 'raros', cabecera: ['n'], filas: [[NaN], [Infinity]],
    }]), 'xl/worksheets/sheet1.xml')
    expect(hoja).not.toContain('<v>NaN</v>')
    expect(hoja).toContain('t="inlineStr"')
  })

  it('una celda vacía se omite en vez de escribirse en blanco', () => {
    const hoja = dentroDelZip(libroXlsx([{
      nombre: 'huecos', cabecera: ['a', 'b'], filas: [[null, 'x']],
    }]), 'xl/worksheets/sheet1.xml')
    expect(hoja).not.toContain('r="A2"')
    expect(hoja).toContain('r="B2"')
  })

  it('el mismo dato da el MISMO archivo, byte a byte', () => {
    // La fecha del ZIP es fija a propósito. Sin esto no se podría comparar nada.
    expect(Array.from(libroXlsx([HOJA]))).toEqual(Array.from(libroXlsx([HOJA])))
  })

  it('un libro sin hojas es un error, no un archivo que no abre', () => {
    expect(() => libroXlsx([])).toThrow(/al menos una hoja/)
  })

  it('está escrito por qué no se trajo una librería', () => {
    expect(POR_QUE_SIN_LIBRERIA).toMatch(/CVEs/)
  })
})
