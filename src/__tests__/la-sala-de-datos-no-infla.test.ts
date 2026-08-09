/**
 * LA SALA DE DATOS NO PUEDE INFLAR NADA — §N3 y §N5 del charter V7.
 *
 * ── POR QUÉ ESTE GUARDIÁN ────────────────────────────────────────────────────
 *
 * El §N5 del charter es explícito: **nada de tracción falsa**. Ni testimonios,
 * ni usuarios, ni hospitales clientes, ni resultados clínicos que no se puedan
 * sostener.
 *
 * Y hay una razón práctica además de la ética: **un dato inflado en una sala de
 * datos no es marketing, es lo que hunde una operación** cuando el comprador lo
 * verifica. Una cifra optimista descubierta en diligencia debida contamina todo
 * lo demás del documento, incluido lo que era verdad.
 *
 * Esta prueba vigila tres cosas que sí se pueden comprobar mecánicamente:
 *
 * 1. que las cifras citadas coincidan con las reales del repositorio;
 * 2. que lo que no existe esté declarado como que no existe;
 * 3. que no aparezcan afirmaciones que el charter prohíbe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const doc = readFileSync(join(process.cwd(), 'docs/data-room/INDICE.md'), 'utf8')
const sello = JSON.parse(
  readFileSync(join(process.cwd(), 'src/lib/clinical/invariantes-clinicos.json'), 'utf8'),
)
const ledger = readFileSync(join(process.cwd(), 'docs/audit/regression-ledger.md'), 'utf8')

describe('las cifras citadas son las reales', () => {
  /**
   * ── SI ESTO FALLA, NO ES UN BUG: ES EL DOCUMENTO DESFASADO ────────────────
   *
   * Pasa cada vez que el repositorio crece, que es justo el punto: un documento
   * con cifras tecleadas miente al día siguiente. El arreglo es un comando, no
   * un cambio de código, y el mensaje lo dice para no volver a diagnosticarlo.
   */
  const COMO_SE_ARREGLA = '\n\n  → node scripts/data-room/actualizar-cifras.mjs\n'

  it('el número de archivos sellados coincide', () => {
    expect(doc, `la sala de datos está desfasada${COMO_SE_ARREGLA}`)
      .toContain(`${sello.archivos.length} archivos`)
  })

  it('el número de casos sellados coincide', () => {
    expect(doc, `la sala de datos está desfasada${COMO_SE_ARREGLA}`)
      .toContain(`${sello.totalCasos} casos`)
  })

  it('el número de REG documentados coincide', () => {
    /**
     * Se cuentan los REG, NO los encabezados.
     *
     * `## REG-179 / REG-180` es una línea con DOS reparaciones. Contando
     * encabezados salían 113 donde hay 114 — y esta prueba daba verde porque
     * usaba la misma expresión equivocada que el script: dos instrumentos que
     * comparten el error se confirman el uno al otro.
     */
    const regs = new Set(
      (ledger.match(/^## REG-.*$/gm) || [])
        .flatMap(l => [...l.matchAll(/REG-(\d+)/g)].map(m => Number(m[1]))),
    ).size
    expect(doc).toContain(`${regs} REG`)
  })

  it('las métricas de voz citadas son las medidas y publicadas', () => {
    const wer = readFileSync(join(process.cwd(), 'docs/voice/WER-MEDIDO.md'), 'utf8')
    for (const cifra of ['25,55', '22,81']) {
      expect(wer.replace(/\./g, ','), `${cifra} no está en WER-MEDIDO`).toContain(cifra)
      expect(doc, `${cifra} citada en la sala de datos sin respaldo`).toContain(cifra)
    }
  })
})

describe('lo que no existe está declarado como que no existe', () => {
  it('el pentest externo se declara NO realizado', () => {
    /**
     * El charter lo prohíbe explícitamente en el día 5: «no afirmar pentest
     * externo completado». Es la afirmación falsa más tentadora de una sala de
     * datos de software médico.
     */
    expect(doc).toContain('Pentest externo: NO REALIZADO')
  })

  it('las métricas de negocio se declaran inexistentes', () => {
    expect(doc).toMatch(/M[ée]tricas de negocio[\s\S]{0,120}NO EXISTEN/)
  })

  it('se declara que no hay validación clínica formal', () => {
    expect(doc).toContain('no hay')
    expect(doc).toMatch(/estudio de validaci[óo]n cl[íi]nica/)
  })

  it('se declara que ninguna aprobación de riesgo está firmada', () => {
    expect(doc).toContain('aprobación del registro de peligros está firmada')
  })

  it('y hay un resumen honesto con la parte débil', () => {
    // Un índice que sólo enumera fortalezas se lee como folleto.
    expect(doc).toContain('**Débil**')
  })
})

describe('no aparece nada de lo que el charter prohíbe', () => {
  const PROHIBIDO: [string, RegExp][] = [
    ['testimonios inventados', /testimonio de|dijo el Dr\.|«nos cambió la vida»/i],
    /**
     * El patrón busca la AFIRMACIÓN, no la mención. Este documento tiene que
     * poder escribir «ni hospitales clientes» en la lista de lo que NO se
     * afirma — y el primer intento de este guardián cazaba justamente esa
     * negación. Un guardián que impide declarar una ausencia es peor que no
     * tenerlo: empuja a callar el hueco.
     */
    ['hospitales clientes afirmados', /(?<!ni |sin |no hay )hospitales? cliente(?!s? que no)/i],
    ['resultados clínicos no respaldados', /reduc(e|ción) de mortalidad|mejora los desenlaces/i],
    ['número de usuarios afirmado', /\d+\s*(médicos|usuarios) activos\b/i],
  ]

  for (const [que, patron] of PROHIBIDO) {
    it(`sin ${que}`, () => {
      expect(doc, `la sala de datos contiene ${que} — lo prohíbe §N5`).not.toMatch(patron)
    })
  }

  it('el propio documento recuerda la regla', () => {
    expect(doc).toContain('nada de tracción falsa')
  })
})

describe('lo verificable trae su comando', () => {
  it('el script de licencias existe y se cita', () => {
    /**
     * En una diligencia debida la pregunta no es «¿qué licencias usan?» sino
     * «¿puedo comprobarlo yo?». Un documento que afirma sin el comando que lo
     * demuestra vale lo mismo que no decir nada.
     */
    expect(doc).toContain('scripts/data-room/licencias.mjs')
    expect(existsSync(join(process.cwd(), 'scripts/data-room/licencias.mjs'))).toBe(true)
  })

  it('el registro de peligros que cita existe', () => {
    expect(existsSync(join(process.cwd(), 'docs/clinical-safety/REGISTRO-DE-PELIGROS.md'))).toBe(true)
  })

  it('distingue lo verificado de lo pendiente y de lo que toca al dueño', () => {
    for (const marca of ['✅ **VERIFICADO**', '🟡 **PARCIAL**', '⬜ **NO EXISTE**', '👤 **DEL DUEÑO**']) {
      expect(doc, `falta la marca ${marca}`).toContain(marca)
    }
  })
})
