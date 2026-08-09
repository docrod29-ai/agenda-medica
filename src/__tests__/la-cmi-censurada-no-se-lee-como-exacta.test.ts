/**
 * ── LA CMI CENSURADA NO SE LEE COMO EXACTA (REG-211) ─────────────────────────
 *
 * QUÉ FALLABA
 * -----------
 * `cmiDe()` (util.ts) devolvía `r.cmi` pelado y tiraba `r.cmiCensurada`, así que
 * los fenotipos de Gram positivos leían el «>2» del laboratorio como un 2 exacto.
 * Tres consecuencias, las tres medidas con el motor real el 8-ago-2026:
 *
 *   1. Neumococo, penicilina «>2», foco no meníngeo → la nota imprimía
 *      «CMI 2 ≤2 → tratable con penicilina parenteral a dosis altas». El
 *      laboratorio había dicho que la CMI está POR ENCIMA de 2 (I 4 / R ≥8), y
 *      la frase enseñaba el número que la niega.
 *   2. SARM con vancomicina «>2» → «sospecha de hVISA (límite alto de S)», la
 *      rama más tranquilizadora, en vez de la de eficacia reducida.
 *   3. E. faecium con daptomicina «>4» → ni fenotipo ni alerta ni advertencia:
 *      leído como el 4 exacto, que en esa especie es la banda utilizable a
 *      dosis alta (SDD ≤4).
 *
 * Y en la otra dirección, el «<» sobre-avisaba: un tamiz de gentamicina de alto
 * nivel reportado «<500» declaraba HLAR y hacía abandonar la sinergia
 * β-lactámico + aminoglucósido en endocarditis.
 *
 * CÓMO SE DESCUBRIÓ
 * -----------------
 * Revisando por qué `cmiDe` no propagaba `cmiCensurada` cuando el módulo de al
 * lado (`clsi-breakpoints.interpretarCMI`) sí lo respeta desde la REG-044. Se
 * confirmó con `interpretarAntibiograma` —el motor completo, no la función
 * suelta— antes de tocar una línea.
 *
 * CAUSA RAÍZ
 * ----------
 * Una CMI es un INTERVALO, no un número (decisión E0-15c del médico dueño). El
 * motor de puntos de corte ya lo respetaba; el de fenotipos leía el mismo panel
 * y no. Es la REG-044 por la puerta de al lado: arreglar un camino y dejar el
 * otro es el defecto que este repositorio lleva el año persiguiendo.
 *
 * LA REGLA QUE LO HACE SEGURO
 * ---------------------------
 * `cmiDe` desaparece. En su lugar, tres predicados de intervalo escritos en
 * POSITIVO —`cmiAlcanza`, `cmiSupera`, `cmiNoPasaDe`— que devuelven `false`
 * cuando la respuesta es «no se sabe», y `cmiIndeterminadaEn` para decirlo. No
 * se sube ninguna categoría a R: eso sería inventar en la otra dirección.
 * Ningún punto de corte nuevo — todos los umbrales ya estaban en el módulo.
 *
 * QUÉ NO CUBRE
 * ------------
 * - No inventa la CMI real: cuando el operador deja la duda, el motor lo DICE y
 *   pide dilución. No decide por el médico.
 * - Un «<» por encima de los umbrales (p. ej. vancomicina «<16», que podría ser
 *   un 8 = VISA) deja al módulo callado. Se prefiere el silencio a inventar una
 *   banda: la categoría del laboratorio se sigue mostrando aparte.
 * - Sólo cubre `grampositivos.ts`. Los módulos de Gram negativos leen la CMI por
 *   `interpretarCMI`, que ya respeta el operador desde la REG-044.
 * - No comprueba que el laboratorio ponga bien el operador: eso es de `vision.ts`
 *   y tiene su propia prueba (`antibiograma-cmi-un-solo-parser`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma'
import {
  cmiAlcanza, cmiSupera, cmiNoPasaDe, cmiIndeterminadaEn, textoCmi,
} from '@/lib/expediente/antibiograma/util'

const claves = (out: ReturnType<typeof interpretarAntibiograma>) =>
  (out.fenotipos ?? []).map(f => f.clave)
const todoElTexto = (out: ReturnType<typeof interpretarAntibiograma>) =>
  JSON.stringify([out.didactica, out.advertencias, out.alertas, out.fenotipos])

describe('los predicados de intervalo', () => {
  it('«>2» alcanza 2 pero no se puede afirmar que no pase de 2', () => {
    const c = { valor: 2, censura: '>' as const }
    expect(cmiAlcanza(c, 2)).toBe(true)
    expect(cmiSupera(c, 2)).toBe(true)
    expect(cmiNoPasaDe(c, 2)).toBe(false)
    // El valor real puede estar en (2, +∞): 4 es posible y 3 también.
    expect(cmiAlcanza(c, 4)).toBe(false)
    expect(cmiIndeterminadaEn(c, 4)).toBe(true)
  })

  it('«<0,5» no puede afirmar resistencia por mucho que se baje el umbral', () => {
    const c = { valor: 0.5, censura: '<' as const }
    expect(cmiNoPasaDe(c, 0.5)).toBe(true)
    expect(cmiAlcanza(c, 0.5)).toBe(false)
    expect(cmiAlcanza(c, 0.25)).toBe(false)
    expect(cmiSupera(c, 0.25)).toBe(false)
  })

  it('un valor exacto reparte todo el rango: o no pasa del umbral, o lo supera', () => {
    for (const valor of [0.06, 0.5, 1, 2, 4, 8, 16, 500]) {
      for (const u of [0.06, 2, 4, 8, 16, 500]) {
        expect(cmiNoPasaDe({ valor }, u) || cmiSupera({ valor }, u)).toBe(true)
        expect(cmiIndeterminadaEn({ valor }, u)).toBe(false)
      }
    }
  })

  it('el texto conserva el operador — nunca se imprime el número solo', () => {
    expect(textoCmi({ valor: 2, censura: '>' })).toBe('>2')
    expect(textoCmi({ valor: 0.25, censura: '<' })).toBe('<0.25')
    expect(textoCmi({ valor: 2 })).toBe('2')
    expect(textoCmi(null)).toBe('')
  })
})

describe('neumococo — penicilina', () => {
  const neumo = (cmi: number, censura?: '>' | '<', sitio: 'respiratorio' | 'snc' = 'respiratorio') =>
    interpretarAntibiograma({
      organismo: 'Streptococcus pneumoniae',
      sitio,
      resultados: [{ antibiotico: 'Penicilina', interpretacion: 'S', cmi, ...(censura ? { cmiCensurada: censura } : {}) }],
    })

  it('«>2» no meníngea NO dice «tratable con penicilina» y marca no sensible', () => {
    const out = neumo(2, '>')
    expect(todoElTexto(out)).not.toContain('tratable con penicilina')
    expect(claves(out)).toContain('neumococo-PNS')
  })

  it('el número que se enseña es el que reportó el laboratorio, con su operador', () => {
    const base = (neumo(2, '>').fenotipos ?? []).find(f => f.clave === 'neumococo-PNS')?.base ?? ''
    expect(base).toContain('CMI >2')
    expect(base).not.toMatch(/CMI 2\b/)
  })

  it('un 2 EXACTO no meníngeo sigue siendo tratable con penicilina (no se rompe lo bueno)', () => {
    const out = neumo(2)
    expect(todoElTexto(out)).toContain('tratable con penicilina')
    expect(claves(out)).not.toContain('neumococo-PNS')
  })

  it('«<4» deja la duda: ni tranquiliza ni clasifica, y lo dice', () => {
    const out = neumo(4, '<')
    expect(todoElTexto(out)).not.toContain('tratable con penicilina')
    expect(claves(out)).not.toContain('neumococo-PNS')
    expect((out.advertencias ?? []).join(' ')).toContain('pedir la CMI por dilución')
  })

  it('criterio meníngeo: «<0,06» es sensible; un 0,5 exacto es no sensible', () => {
    expect(todoElTexto(neumo(0.06, '<', 'snc'))).toContain('sensible por criterio meníngeo')
    expect(claves(neumo(0.5, undefined, 'snc'))).toContain('neumococo-PNS')
  })
})

describe('S. aureus — vancomicina', () => {
  const sarm = (cmi: number, censura?: '>' | '<') =>
    interpretarAntibiograma({
      organismo: 'Staphylococcus aureus',
      sitio: 'sangre',
      resultados: [
        { antibiotico: 'Oxacilina', interpretacion: 'R' },
        { antibiotico: 'Vancomicina', interpretacion: 'S', cmi, ...(censura ? { cmiCensurada: censura } : {}) },
      ],
    })

  it('«>2» va a eficacia reducida, no a la sospecha de hVISA', () => {
    const out = sarm(2, '>')
    expect(claves(out)).not.toContain('hVISA')
    expect((out.alertas ?? []).map(a => a.mensaje).join(' ')).toContain('MIC creep')
  })

  it('un 2 EXACTO en SARM sigue levantando la sospecha de hVISA', () => {
    expect(claves(sarm(2))).toContain('hVISA')
  })

  it('«<16» no declara VRSA: un fenotipo notificable no se levanta con un «<»', () => {
    const out = sarm(16, '<')
    expect(claves(out)).not.toContain('VRSA')
    // La notificación de este caso sigue viniendo del SARM, no del glucopéptido.
    expect(JSON.stringify(out.alertas)).not.toContain('VRSA')
  })

  it('un 16 EXACTO sí es VRSA, con su notificación (no se debilita la defensa)', () => {
    const out = sarm(16)
    expect(claves(out)).toContain('VRSA')
    expect(out.notificacionObligatoria).toBe(true)
  })

  it('«>1» no se puede clasificar y se pide la dilución', () => {
    expect((sarm(1, '>').advertencias ?? []).join(' ')).toContain('Pedir CMI por dilución')
  })
})

describe('enterococo — daptomicina y HLAR', () => {
  const faecium = (cmi: number, censura?: '>' | '<') =>
    interpretarAntibiograma({
      organismo: 'Enterococcus faecium',
      sitio: 'sangre',
      resultados: [{ antibiotico: 'Daptomicina', interpretacion: 'SDD', cmi, ...(censura ? { cmiCensurada: censura } : {}) }],
    })

  it('daptomicina «>4» en E. faecium: no se calla, pero tampoco se sube a R', () => {
    const out = faecium(4, '>')
    expect(claves(out)).not.toContain('daptomicina-R')
    expect((out.advertencias ?? []).join(' ')).toContain('pedir CMI por dilución')
  })

  it('daptomicina 8 EXACTA en E. faecium sigue siendo no sensible', () => {
    expect(claves(faecium(8))).toContain('daptomicina-R')
  })

  it('daptomicina «<8» no declara resistencia (el «<» no la puede afirmar)', () => {
    expect(claves(faecium(8, '<'))).not.toContain('daptomicina-R')
  })

  const hlar = (cmi: number, censura?: '>' | '<') =>
    interpretarAntibiograma({
      organismo: 'Enterococcus faecalis',
      sitio: 'sangre',
      resultados: [
        { antibiotico: 'Ampicilina', interpretacion: 'S' },
        { antibiotico: 'Gentamicina alto nivel', interpretacion: 'S', cmi, ...(censura ? { cmiCensurada: censura } : {}) },
      ],
    })

  it('el tamiz «<500» NO declara HLAR: la sinergia en endocarditis no se abandona sin motivo', () => {
    expect(claves(hlar(500, '<'))).not.toContain('HLAR')
  })

  it('el tamiz «>500» sigue declarando HLAR (la defensa de la REG anterior no se toca)', () => {
    expect(claves(hlar(500, '>'))).toContain('HLAR')
  })
})

describe('guardián — no vuelve a existir una forma de pedir «el número»', () => {
  it('util.ts ya no exporta cmiDe, y grampositivos.ts no lo importa', () => {
    const util = readFileSync(join(process.cwd(), 'src/lib/expediente/antibiograma/util.ts'), 'utf8')
    const gram = readFileSync(join(process.cwd(), 'src/lib/expediente/antibiograma/grampositivos.ts'), 'utf8')
    expect(util).not.toMatch(/export function cmiDe\b/)
    expect(gram).not.toMatch(/\bcmiDe\b/)
  })
})
