/**
 * EL FOSO NO INVENTA COMPETIDORES.
 *
 * ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────
 *
 * `claims-guard.test.ts` vigila el copy público —landing, precios, demo— para
 * que no reaparezcan afirmaciones engañosas. Vigila cuatro archivos de `src/`.
 *
 * **No vigilaba `docs/`.** Y `docs/` es lo que lee un comprador en una
 * diligencia debida.
 *
 * De los dos públicos, el segundo es el que tiene consecuencias: un visitante
 * que lee una exageración en la landing se encoge de hombros; un comprador que
 * verifica una y la encuentra falsa **deja de creerse el resto del paquete**,
 * incluido lo que sí está medido.
 *
 * ── QUÉ ENCONTRÓ AL ENCENDERSE (REG-207) ─────────────────────────────────────
 *
 * Seis afirmaciones sobre terceros sin una sola fuente en
 * `docs/COMPETITIVE_ANALYSIS.md`: «Nadie con esa granularidad», «Pocos en
 * LATAM», «Pocos lo tienen integrado», «Casi nadie en EHR cloud», «nadie lo
 * expone visualmente» — bajo una columna titulada «Por qué somos superiores».
 *
 * ── LO QUE ESTA PRUEBA NO HACE ───────────────────────────────────────────────
 *
 * No prohíbe nombrar competidores en `docs/`: un análisis competitivo interno
 * los nombra por definición, y esconderlos no lo haría más honesto. Lo que
 * prohíbe es **la afirmación categórica sobre lo que un tercero hace o no hace
 * sin fuente ni fecha**. Describir lo nuestro no necesita permiso de nadie;
 * afirmar lo ajeno sí necesita haberlo mirado.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()

/**
 * Los documentos que un comprador leería. La lista es corta a propósito: un
 * guardián que barre `docs/` entero cazaría notas de trabajo y acabaría
 * desactivado, que es la peor forma de morir para un guardián.
 */
const CARA_AL_COMPRADOR = [
  'docs/competitive/EL-FOSO.md',
  'docs/data-room/INDICE.md',
  'docs/evals/PUERTA-DE-LIBERACION.md',
  'docs/quality/FAMILIAS-DE-DEFECTO.md',
  'docs/architecture/DIRECCION-DE-DEPENDENCIAS.md',
]

/**
 * Superlativos sobre terceros. Cada uno afirma algo del mundo que nadie
 * comprobó.
 *
 * OJO con la negación: `no somos los únicos` **declara una ausencia** y es
 * justo lo que queremos poder escribir. Un guardián que la cace empuja a
 * callarse el hueco en vez de declararlo — el error que ya cometió el de la
 * sala de datos (v1083), donde el patrón cazaba «ni hospitales clientes».
 */
const SOBRE_TERCEROS: ReadonlyArray<{ nombre: string; re: RegExp }> = [
  { nombre: '«nadie / casi nadie»', re: /(?<!no\s)(?<!ni\s)\b(?:casi\s+)?nadie\s+(?:lo\s+|los\s+|las\s+|más\s+)?(?:tiene|expone|ofrece|hace|llega|con\b|en\b)/i },
  { nombre: '«pocos (competidores) …»', re: /\bpocos\s+(?:lo\s+|la\s+|en\s+)/i },
  { nombre: '«somos superiores / los únicos / los mejores»', re: /(?<!\bno\s)\bsomos\s+(?:los\s+)?(?:superior\w*|únic\w*|mejor\w*)\b/i },
  { nombre: '«por qué somos superiores»', re: /por\s+qu[eé]\s+somos\s+superior/i },
  { nombre: '«el único que / el único en»', re: /\bel\s+únic[oa]\s+(?:que|en)\b/i },
  /**
   * Sólo `ninguno de ellos`: se refiere a los competidores. `ninguno de los…`
   * se quedó fuera a propósito — «ninguno de los ceros está medido con pacientes
   * reales» habla de NOSOTROS y declara un hueco. Cazarla sería, otra vez,
   * castigar la honestidad.
   */
  { nombre: '«ninguno de ellos»', re: /\bninguno\s+de\s+ellos\b/i },
]

/**
 * Quita lo que NO es una afirmación del documento: bloques de código, citas en
 * bloque, y —lo importante— **lo entrecomillado con «…»**.
 *
 * ── POR QUÉ LO ENTRECOMILLADO NO CUENTA ──────────────────────────────────────
 *
 * Este guardián cazó, a la primera, el documento escrito para DENUNCIAR esas
 * frases: `EL-FOSO.md` las cita textualmente para explicar por qué se
 * retiraron. Es la misma trampa que el guardián de la sala de datos (v1083),
 * donde el patrón cazaba la negación e impedía declarar una ausencia.
 *
 * La regla que resuelve las dos: **afirmar es distinto de citar**. Un guardián
 * que no distingue empuja a callar el problema en vez de escribirlo — y callarlo
 * es exactamente lo que se quiere evitar.
 */
function cuerpo(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/«[^»]*»/g, '')
    .split('\n')
    .filter(l => !l.trimStart().startsWith('>'))
    .join('\n')
}

describe('el foso no inventa competidores', () => {
  it('los documentos cara al comprador existen', () => {
    for (const f of CARA_AL_COMPRADOR) {
      expect(existsSync(join(RAIZ, f)), `falta ${f}`).toBe(true)
    }
  })

  it.each(CARA_AL_COMPRADOR)('%s no afirma nada de un tercero sin fuente', archivo => {
    const texto = cuerpo(readFileSync(join(RAIZ, archivo), 'utf8'))
    const pegas: string[] = []
    for (const { nombre, re } of SOBRE_TERCEROS) {
      const m = texto.match(re)
      if (m) pegas.push(`${nombre} → «${m[0].trim()}»`)
    }
    expect(pegas, `${archivo}:\n  ${pegas.join('\n  ')}`).toEqual([])
  })

  it('se puede DECLARAR una ausencia sin que el guardián lo impida', () => {
    // La lección de v1083: un guardián que caza la negación empuja a callar el
    // hueco en vez de escribirlo. Estas frases tienen que poder existir.
    const legitimas = [
      'No somos los únicos que hacen esto.',
      'Ninguno de los ceros está medido con pacientes reales.',
      'No hay pentest externo: no se afirma lo contrario.',
    ]
    for (const frase of legitimas) {
      const cazada = SOBRE_TERCEROS.find(({ re }) => re.test(frase))
      expect(cazada?.nombre, `el guardián impide declarar: «${frase}»`).toBeUndefined()
    }
  })

  it('el guardián sí caza lo que existía de verdad (si no, no probaría nada)', () => {
    // Frases textuales del documento anterior. Si el patrón deja de cazarlas,
    // el guardián está apagado sin que nadie lo note.
    const reales = [
      '| Nadie con esa granularidad |',
      '| Pocos en LATAM |',
      '| Casi nadie en EHR cloud |',
      'Por qué somos superiores',
    ]
    for (const frase of reales) {
      const cazada = SOBRE_TERCEROS.some(({ re }) => re.test(frase))
      expect(cazada, `dejó de cazar: «${frase}»`).toBe(true)
    }
  })

  it('el análisis competitivo viejo lleva su aviso de alcance', () => {
    /**
     * `docs/COMPETITIVE_ANALYSIS.md` conserva una matriz de competidores escrita
     * sin fuente ni fecha. No se borra —son notas de orientación útiles— pero
     * **no puede circular como si estuviera verificada**.
     *
     * Marcar el alcance es más honesto que borrar: borrar esconde que alguna vez
     * se afirmó, y esconderlo es lo que hace que se vuelva a afirmar.
     */
    const t = readFileSync(join(RAIZ, 'docs/COMPETITIVE_ANALYSIS.md'), 'utf8')
    expect(t).toContain('AVISO DE ALCANCE')
    expect(t).toContain('sin dejar constancia de fuente ni fecha')
    expect(t).toContain('docs/competitive/EL-FOSO.md')
    // La columna que afirmaba superioridad sobre terceros no vuelve.
    expect(t).not.toContain('| Función | Nuestra implementación | Mejor competidor en esto |')
  })

  it('el foso distingue lo verificable de lo afirmado, y dice lo que no puede afirmar', () => {
    const t = readFileSync(join(RAIZ, 'docs/competitive/EL-FOSO.md'), 'utf8')
    expect(t).toContain('Necesita **fuente y fecha**')
    // Lo que impide que el documento se lea como una lista de superioridades.
    expect(t).toContain('Lo que NO es un foso')
    expect(t).toContain('Lo que no se puede afirmar hoy')
  })
})
