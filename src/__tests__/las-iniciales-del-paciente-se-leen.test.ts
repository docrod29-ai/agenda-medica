/**
 * REG-673 — las iniciales no desaparecen al elegir el tema claro.
 * Revisión independiente de las capturas del 11-sep: seis colores de texto
 * fijos, pensados para oscuro, daban 1.01–1.56:1 sobre el canvas claro.
 * La R verde de Pacientes tenía 1.01:1. El helper canónico ahora consume pares
 * temáticos existentes; conserva el mismo hash y la identidad del paciente.
 * Se mide el par real, incluida la transparencia, sobre las cinco superficies.
 * No sustituye la inspección del navegador ni acredita aislamiento de datos.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { AVATAR_COLORS } from '@/lib/avatar-color'
import { componer, leerColor, razon } from '../../scripts/design/lib/contraste-wcag.mjs'

const css = postcss.parse(readFileSync('src/app/globals.css', 'utf8'))
function variables(selector: string) {
  const resultado: Record<string, string> = {}
  css.walkRules(selector, regla => {
    // La impresión redefine :root para papel blanco; no es el tema oscuro.
    if (selector === ':root' && regla.parent !== css) return
    regla.walkDecls(/^--/, d => { resultado[d.prop] = d.value })
  })
  return resultado
}
const raiz = variables(':root')
const temas = [
  ['oscuro', raiz],
  ['claro', { ...raiz, ...variables(':root[data-theme="light"]') }],
  ['automático claro', { ...raiz, ...variables(':root:not([data-theme="dark"]):not([data-theme="light"])') }],
] as const

describe.each(temas)('iniciales legibles en %s', (_tema, vars) => {
  function resolver(valor: string): string {
    const token = /^var\((--[\w-]+)\)$/.exec(valor)?.[1]
    if (!token) return valor
    if (!vars[token]) throw new Error(`Token sin definir: ${token}`)
    return resolver(vars[token])
  }
  it.each(AVATAR_COLORS)('texto $fg sobre su fondo $bg', ({ fg, bg }) => {
    const texto = leerColor(resolver(fg))!
    const relleno = leerColor(resolver(bg))!
    expect(texto).not.toBeNull()
    expect(relleno).not.toBeNull()
    for (const superficie of ['--bg', '--s', '--s1', '--s2', '--s3']) {
      const fondo = componer(relleno, leerColor(resolver(vars[superficie])))
      const ratio = razon(componer(texto, fondo), fondo)
      expect(ratio, `${fg} sobre ${bg} en ${superficie}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
