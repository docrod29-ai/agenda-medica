import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * El "Soporte" público NO debe ser un enlace mailto: en móvil (apps instaladas)
 * puede cerrar la página al intentar abrir el correo. Debe ir a /contacto, que
 * muestra el correo a la vista. Regresión del bug reportado por el Dr.
 */
describe('soporte-link-guard', () => {
  it('el pie de la landing enlaza Soporte a /contacto, no a mailto:', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8')
    // La línea del enlace "Soporte"
    const match = page.match(/href="([^"]+)"[^>]*>Soporte<\/a>/)
    expect(match, 'no se encontró el enlace Soporte en el pie').not.toBeNull()
    expect(match![1]).toBe('/contacto')
  })

  it('existe la página pública /contacto y muestra el correo a la vista', () => {
    const contacto = readFileSync(resolve(process.cwd(), 'src/app/contacto/page.tsx'), 'utf8')
    expect(contacto).toContain('soporte@nexusmed.mx')
  })
})
