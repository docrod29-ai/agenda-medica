/**
 * GOLDEN — ningún impreso afirma «Negadas» a partir de un campo vacío.
 *
 * Reproducción REP-010 del Panel de Lujo (hallazgo MI-002, auditor
 * M-internista, P1), movida aquí con el arreglo y ampliada con el
 * comportamiento del helper que lo cierra.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/components/RecetaDocumento.tsx:977` — la hoja de FÁBRICA (`HojaGenerada`,
 * la que sale cuando el médico no subió diseño propio) pintaba
 *
 *     ALERGIAS: {data.paciente?.alergias || 'Negadas / no referidas'}
 *
 * Dos defectos en una línea:
 *   1. con el campo vacío, el papel que va a la farmacia AFIRMABA una negación
 *      que nadie hizo;
 *   2. leía el texto libre en crudo, así que una alergia capturada sólo en
 *      `alergiasEstructuradas` desaparecía del impreso mientras la pantalla
 *      enseñaba la alerta roja.
 * La carta de referencia (`referencia/[patientId]/page.tsx:245`) y la nota
 * repetían el mismo relleno, cada una con su propia frase.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditoría Panel de Lujo, sep-2026: auditor M-internista, hallazgo MI-002;
 * equipo rojo CONFIRMADO en P1. El rojo evaluó la expresión con
 * `{alergias:'', alergiasEstructuradas:[{alergeno:'Penicilina'}]}` → «Negadas /
 * no referidas», y demostró que el guardián que ya existía
 * (`alergias-impreso-fuente.test.ts`) NO cazaba la línea 977 porque el `|| '…'`
 * esquiva su regex.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * «Se arregla uno y se deja el de al lado» (REG-180, REG-184): HojaCustom y
 * `receta-word.ts` ya se habían corregido; el renderizador por omisión y la
 * carta de referencia no. Cada impreso redactaba su propia frase para el hueco,
 * así que arreglar uno no arreglaba a los demás. El arreglo es UNA frase
 * compartida: `alergiasParaElPapel` (src/lib/impreso-medico.ts).
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §4 — ausencia de dato no es dato de ausencia. «Negadas» es una
 * afirmación clínica (se preguntó y el paciente negó); vacío significa que nadie
 * preguntó. Un impreso con cédula profesional no puede confundirlas.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Dos capas:
 *   (a) COMPORTAMIENTO sobre `alergiasParaElPapel`, que es puro y es donde vive
 *       la decisión. Se prueba al revés: si alguien devolviera la negación de
 *       relleno, estos casos se ponen rojos.
 *   (b) CONTRATO TEXTUAL declarado sobre los JSX. RecetaDocumento no se
 *       renderiza en node: su paginación no termina sin medición de navegador
 *       (lo comprobó el equipo rojo). La regex caza exactamente la forma
 *       `alergias || '<negación>'`.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No renderiza el DOM: no comprueba que la alergia sólo estructurada aparezca
 * pintada en la hoja (eso exige navegador). No cubre el portal del paciente,
 * que arma su propio impreso. No decide si el recuadro debe pintarse sobre el
 * DISEÑO PROPIO del médico cuando no hay dato: ahí se conserva la conducta
 * anterior (no se pinta), porque ese papel lo calibró él y un recuadro nuevo le
 * movería el diseño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  alergiasParaElPapel,
  SIN_REGISTRO_DE_ALERGIAS,
  ALERGIAS_NO_DISPONIBLES,
} from '@/lib/impreso-medico'

const raiz = process.cwd()
const leer = (...p: string[]) => readFileSync(path.join(raiz, ...p), 'utf8')

/** Toda expresión JSX «ALERGIAS: {… || '<texto>'}» cuyo relleno afirme negación. */
const RELLENO_QUE_NIEGA = /ALERGIAS:\s*\{[^}]*\|\|\s*['"`][^'"`]*(negad|niega|sin alergias|no refer)[^'"`]*['"`]\s*\}/i
/** Lectura del texto libre a secas, con o sin `||` detrás (el punto ciego del guardián anterior). */
const LEE_TEXTO_LIBRE = /\{\s*(data\.)?pa(ciente|tient)\??\.alergias\s*(\|\||\})/

describe('MI-002 · la frase del impreso, en el único sitio que la decide', () => {
  it('con el expediente vacío dice que no hay registro — nunca que se negaron', () => {
    expect(alergiasParaElPapel({})).toBe(SIN_REGISTRO_DE_ALERGIAS)
    expect(alergiasParaElPapel({ alergias: '   ' })).toBe(SIN_REGISTRO_DE_ALERGIAS)
    expect(alergiasParaElPapel({})).not.toMatch(/negad|no referid/i)
  })

  it('una alergia que sólo está en el campo estructurado SÍ sale al papel', () => {
    // El caso exacto del hallazgo: texto libre vacío, alérgeno estructurado.
    expect(alergiasParaElPapel({ alergias: '', alergiasEstructuradas: [{ alergeno: 'Penicilina' }] }))
      .toBe('Penicilina')
  })

  it('si el MÉDICO escribió la negación, esa sí se imprime: la dijo él', () => {
    expect(alergiasParaElPapel({ alergias: 'Negadas' })).toBe('Negadas')
  })

  it('sin paciente leído no se afirma nada de sus alergias', () => {
    expect(alergiasParaElPapel(null)).toBe(ALERGIAS_NO_DISPONIBLES)
    expect(alergiasParaElPapel(undefined)).toBe(ALERGIAS_NO_DISPONIBLES)
  })
})

describe('MI-002 · ningún impreso rellena el hueco con una negación', () => {
  const IMPRESOS: [string, string[]][] = [
    ['receta (va a la farmacia)', ['src', 'components', 'RecetaDocumento.tsx']],
    ['carta de referencia (viaja a otro médico)', ['src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx']],
    ['nota médica', ['src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx']],
    ['orden médica', ['src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx']],
  ]

  for (const [nombre, ruta] of IMPRESOS) {
    it(`${nombre}: sin relleno que afirme negación`, () => {
      const m = leer(...ruta).match(RELLENO_QUE_NIEGA)
      expect(m, `relleno que afirma negación: ${m?.[0]}`).toBeNull()
    })
  }

  it('la receta no lee `paciente.alergias` a secas en ningún renderizador (ni con `||` detrás)', () => {
    const m = leer('src', 'components', 'RecetaDocumento.tsx').match(LEE_TEXTO_LIBRE)
    expect(m, `lee el texto libre por su cuenta: ${m?.[0]}`).toBeNull()
  })

  it('control: el hermano ya arreglado (HojaCustom) y el .doc siguen en pie', () => {
    // Si estos dos fallaran, la regex estaría mal, no el código.
    expect(leer('src', 'components', 'RecetaDocumento.tsx')).toContain('alergiasParaImpreso(data.paciente) && (')
    const word = leer('src', 'lib', 'receta-word.ts')
    expect(word.match(RELLENO_QUE_NIEGA)).toBeNull()
    expect(word).toContain('SIN_REGISTRO_DE_ALERGIAS')
  })
})
