/**
 * GOLDEN — la pestaña de recetas y órdenes tiene jerarquía.
 *
 * ── LO QUE REPORTÓ EL DR. ────────────────────────────────────────────────────
 *
 * «este espacio de órdenes/receta está muy desordenado, que se vea bien, orden».
 *
 * Tenía **nueve tarjetas idénticas**, una debajo de otra, todas con el mismo
 * peso visual: tamaño de papel, papel de las notas, papel de la impresora,
 * estilo, color, membrete, pie, opciones y datos legales.
 *
 * Sin jerarquía, encontrar algo es leerlas todas. Y son cosas de naturalezas
 * distintas: unas describen el **papel físico**, otras **cómo se ve**, otras
 * **qué se imprime**, otras son **datos legales**.
 *
 * El orden ya era el correcto: lo que faltaba era decir en voz alta dónde
 * empieza cada bloque.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const s = readFileSync(
  join(process.cwd(), 'src', 'app', '(dashboard)', 'configuracion', 'secciones-recetas.tsx'), 'utf8')

describe('los cuatro bloques están declarados', () => {
  const BLOQUES = [
    [1, 'El papel'],
    [2, 'Cómo se ve'],
    [3, 'Qué se imprime'],
    [4, 'Datos legales'],
  ] as const

  for (const [n, t] of BLOQUES) {
    it(`${n}. ${t}`, () => {
      expect(s).toContain(`<Grupo n={${n}} t="${t}"`)
    })
  }

  it('cada uno explica para qué sirve, no sólo se nombra', () => {
    // Un título sin explicación obliga a abrir el bloque para saber si es el que
    // se busca — que es justo el trabajo que la jerarquía viene a ahorrar.
    for (const [, t] of BLOQUES) {
      const i = s.indexOf(`t="${t}"`)
      expect(s.slice(i, i + 260), t).toMatch(/d="[^"]{40,}"/)
    }
  })
})

describe('los bloques van en el orden en que se configura', () => {
  it('el papel primero, porque el resto se acomoda a él', () => {
    const pos = (t: string) => s.indexOf(`t="${t}"`)
    expect(pos('El papel')).toBeLessThan(pos('Cómo se ve'))
    expect(pos('Cómo se ve')).toBeLessThan(pos('Qué se imprime'))
    expect(pos('Qué se imprime')).toBeLessThan(pos('Datos legales'))
  })

  it('cada encabezado precede a su primera tarjeta', () => {
    const paresEsperados: [string, string][] = [
      ['El papel', 'Tamaño de papel'],
      ['Cómo se ve', 'Estilo visual'],
      ['Qué se imprime', 'Opciones'],
      ['Datos legales', 'Datos legales adicionales (opcional)'],
    ]
    for (const [grupo, primera] of paresEsperados) {
      const g = s.indexOf(`t="${grupo}"`)
      const c = s.indexOf(`<Section title="${primera}">`)
      expect(g, `${grupo} debe ir antes de «${primera}»`).toBeLessThan(c)
      expect(c - g, `${grupo} debe estar PEGADO a «${primera}»`).toBeLessThan(400)
    }
  })
})

describe('el encabezado se lee como jerarquía, no como otra tarjeta', () => {
  it('es un h3 con su número y su línea', () => {
    expect(s).toContain('<h3 style={{ fontSize: 15, fontWeight: 700')
    expect(s).toContain("height: 1, background: 'var(--border)'")
  })

  it('usa tokens de color, no hexadecimales', () => {
    // El trinquete de color ya lo exigiría; se dice aquí porque este componente
    // es nuevo y es donde se rompería primero.
    const i = s.indexOf('function Grupo(')
    const cuerpo = s.slice(i, i + 900)
    expect(cuerpo).toContain('var(--nexus)')
    expect(cuerpo).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
