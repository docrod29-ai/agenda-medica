/**
 * GOLDEN — decisiones 1 y 6 del Dr. (3-ago-2026): el motor deja de afirmar más
 * de lo que el estándar sostiene.
 *
 * Fuente: `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`.
 *
 * ── LAS DOS SON LA MISMA IDEA ────────────────────────────────────────────────
 *
 * Ninguna quita una alerta. Las dos quitan una PALABRA que el estándar no
 * respalda, y conservan la señal:
 *
 *   · Un enterococo con tres resistencias adquiridas seguía saliendo «MDR».
 *     M100-Ed35 usa las siglas MDRO en las tablas de estafilococo y enterococo,
 *     pero **no fija una regla universal** de «no-S en tres clases». Un conteo
 *     genérico no puede convertirse en una categoría formal.
 *
 *   · Un *S. aureus* con oxacilina R y cefoxitina S salía «MRSA [confirmado]».
 *     CLSI sí manda reportarlo como resistente a meticilina — eso no cambia—,
 *     pero las dos pruebas se contradicen y las definitivas son mecA, mecC o
 *     PBP2a, que no se hicieron. «Confirmado» era una certeza prestada.
 *
 * ── LO QUE NO SE TOCA ────────────────────────────────────────────────────────
 *
 * La conducta de seguridad se mantiene: el fenotipo se emite, el aislamiento y
 * la notificación siguen saliendo. El Dr. pidió que esas consecuencias pasen a
 * ser política institucional configurable, y eso es un cambio aparte — hacerlo
 * de paso dejaría a alguien sin su aviso de aislamiento sin haberlo decidido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import type { EntradaAntibiograma, SIR } from '@/lib/expediente/antibiograma/tipos'

const correr = (organismo: string, filas: [string, SIR][]): ReturnType<typeof interpretarAntibiograma> =>
  interpretarAntibiograma({
    organismo, sitio: 'sangre',
    resultados: filas.map(([antibiotico, interpretacion]) => ({ antibiotico, interpretacion })),
  } as EntradaAntibiograma)

/* ══════════════ DECISIÓN 1 ══════════════ */

describe('DECISIÓN 1 — no se declara MDR en Gram positivos', () => {
  /** Tres resistencias ADQUIRIDAS + las tres naturales del enterococo. */
  const VRE_EXTENSO: [string, SIR][] = [
    ['Vancomicina', 'R'], ['Ciprofloxacino', 'R'], ['Gentamicina', 'R'],
    ['Ceftriaxona', 'R'], ['Trimetoprim-sulfametoxazol', 'R'], ['Colistina', 'R'],
  ]

  it('un enterococo con tres R adquiridas ya NO sale como MDR', () => {
    expect(correr('Enterococcus faecalis', VRE_EXTENSO).fenotipos.map(f => f.clave))
      .not.toContain('MDR')
  })

  it('pero la SEÑAL se conserva, con otro nombre', () => {
    /**
     * Quitar la etiqueta sin más habría perdido información real: el
     * aislamiento sigue teniendo tres resistencias adquiridas y eso hay que
     * decirlo.
     */
    const f = correr('Enterococcus faecalis', VRE_EXTENSO).fenotipos
      .find(x => x.clave === 'resistencia-adquirida-extensa')
    expect(f, 'la señal no puede desaparecer con la etiqueta').toBeDefined()
    expect(f!.nombre).toMatch(/3 clases evaluables/)
  })

  it('y DICE de sí misma que no es una definición CLSI', () => {
    // Sin esa frase, el nombre nuevo se leería como un MDR con otro nombre.
    const f = correr('Enterococcus faecalis', VRE_EXTENSO).fenotipos
      .find(x => x.clave === 'resistencia-adquirida-extensa')!
    expect(f.base).toMatch(/NO corresponde a una definición CLSI de MDR/)
    expect(f.base).toMatch(/no fija una regla\s+universal/)
  })

  it('sigue sin contar las resistencias NATURALES de la especie', () => {
    // Lo que se reparó en v956 no se pierde con este cambio.
    const f = correr('Enterococcus faecalis', VRE_EXTENSO).fenotipos
      .find(x => x.clave === 'resistencia-adquirida-extensa')!
    expect(f.base).toMatch(/resistencias NATURALES de la especie/)
  })

  it('el estafilococo recibe el mismo trato', () => {
    const claves = correr('Staphylococcus aureus', [
      ['Oxacilina', 'R'], ['Ciprofloxacino', 'R'], ['Eritromicina', 'R'],
      ['Trimetoprim-sulfametoxazol', 'R'],
    ]).fenotipos.map(f => f.clave)
    expect(claves).not.toContain('MDR')
    expect(claves).toContain('resistencia-adquirida-extensa')
  })
})

describe('DECISIÓN 1 — EL CONTROL: en Gram negativos NO cambia nada', () => {
  it('una E. coli con cuatro clases sigue saliendo MDR', () => {
    /**
     * Sin esto, la reparación podría haber apagado el MDR para todo el mundo y
     * las pruebas de arriba pasarían igual. Magiorakos SÍ define las categorías
     * para Enterobacterales.
     */
    const claves = correr('Escherichia coli', [
      ['Meropenem', 'R'], ['Ciprofloxacino', 'R'], ['Gentamicina', 'R'], ['Ceftriaxona', 'R'],
    ]).fenotipos.map(f => f.clave)
    expect(claves).toContain('MDR')
    expect(claves).not.toContain('resistencia-adquirida-extensa')
  })
})

/* ══════════════ DECISIÓN 6 ══════════════ */

describe('DECISIÓN 6 — discordancia no es «confirmado»', () => {
  const DISCORDANTE: [string, SIR][] = [['Oxacilina', 'R'], ['Cefoxitina', 'S'], ['Vancomicina', 'S']]
  const r = correr('Staphylococcus aureus', DISCORDANTE)
  const mrsa = r.fenotipos.find(f => f.clave === 'MRSA')!

  it('SÍ se reporta la resistencia a meticilina — eso no cambia', () => {
    /**
     * CLSI es directo: resistente por cefoxitina O por oxacilina se reporta
     * como resistente a meticilina. Quitar el fenotipo habría sido ir MÁS allá
     * de lo que el Dr. pidió, y en la dirección peligrosa.
     */
    expect(mrsa, 'el fenotipo no se retira').toBeDefined()
  })

  it('pero la confianza baja de «confirmado» a «probable»', () => {
    expect(mrsa.confianza).toBe('probable')
  })

  it('el nombre dice que es por OXACILINA y que hay discordancia', () => {
    expect(mrsa.nombre).toMatch(/por OXACILINA/)
    expect(mrsa.nombre).toMatch(/DISCORDANTE con cefoxitina/)
  })

  it('y se pide la confirmación que sí es definitiva', () => {
    // mecA, mecC o PBP2a. Ninguna se hizo, y por eso no se dice «confirmado».
    expect(mrsa.base).toMatch(/mecA, mecC o PBP2a/)
    expect(mrsa.base).toMatch(/NO se declara «confirmado»/)
  })

  it('sale una alerta crítica con el texto que el Dr. pidió', () => {
    const a = r.alertas.find(x => x.mensaje.includes('discordante con cefoxitina'))
    expect(a, 'la discordancia tiene que verse').toBeDefined()
    expect(a!.nivel).toBe('critica')
    expect(a!.mensaje).toMatch(/mecA \/ mecC \/ PBP2a/)
    expect(a!.mensaje).toMatch(/medida temporal de seguridad/)
  })

  it('el mecanismo tampoco se afirma como confirmado', () => {
    // Decir «PBP2a [confirmado]» con las pruebas contradiciéndose es la misma
    // certeza prestada, un renglón más abajo.
    expect(r.mecanismos.find(m => m.nombre.includes('PBP2a'))!.confianza).toBe('probable')
  })

  it('LO QUE NO CAMBIA: la conducta de seguridad se mantiene', () => {
    /**
     * El Dr. pidió que aislamiento y notificación pasen a ser política
     * institucional. Es un cambio APARTE: hacerlo de paso dejaría a alguien sin
     * su aviso de aislamiento sin haberlo decidido.
     */
    expect(r.aislamiento).toMatch(/MRSA/)
    expect(r.notificacionObligatoria).toBe(true)
  })
})

describe('DECISIÓN 6 — EL CONTROL: sin discordancia, todo igual que antes', () => {
  const r = correr('Staphylococcus aureus', [['Oxacilina', 'R'], ['Cefoxitina', 'R'], ['Vancomicina', 'S']])

  it('las dos R concordantes siguen dando «confirmado»', () => {
    const mrsa = r.fenotipos.find(f => f.clave === 'MRSA')!
    expect(mrsa.confianza).toBe('confirmado')
    expect(mrsa.nombre).not.toMatch(/DISCORDANTE/)
  })

  it('y no se inventa una alerta de discordancia', () => {
    expect(r.alertas.some(a => a.mensaje.includes('discordante con cefoxitina'))).toBe(false)
  })

  it('sólo oxacilina R, sin cefoxitina en el panel, tampoco es discordancia', () => {
    // Que falte la prueba no es que las dos se contradigan.
    const s = correr('Staphylococcus aureus', [['Oxacilina', 'R'], ['Vancomicina', 'S']])
    expect(s.fenotipos.find(f => f.clave === 'MRSA')!.confianza).toBe('confirmado')
  })
})

describe('las decisiones están escritas y el código las cita', () => {
  it('el documento existe y trae las seis', () => {
    const doc = readFileSync(join(process.cwd(), 'docs', 'maintenance', 'DECISIONES-CLINICAS-2026-08-03.md'), 'utf8')
    for (const n of ['## 1 ·', '## 2 ·', '## 3 ·', '## 4 ·', '## 5 ·', '## 6 ·']) {
      expect(doc, n).toContain(n)
    }
    expect(doc).toMatch(/reglas institucionales separadas/)
  })

  it('el código señala al documento, no repite el razonamiento', () => {
    /**
     * Una regla clínica copiada dentro de un archivo de código es una regla que
     * nadie vuelve a revisar. El motor cita la fuente.
     */
    for (const ruta of [
      ['src', 'lib', 'expediente', 'antibiograma', 'motor.ts'],
      ['src', 'lib', 'expediente', 'antibiograma', 'grampositivos.ts'],
    ]) {
      expect(readFileSync(join(process.cwd(), ...ruta), 'utf8'), ruta.join('/'))
        .toContain('DECISIONES-CLINICAS-2026-08-03.md')
    }
  })
})
