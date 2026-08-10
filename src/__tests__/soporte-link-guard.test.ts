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
    /**
     * Se comprueba el BUZÓN, no el literal.
     *
     * Esta prueba afirmaba `soporte@nexusmed.mx` a mano, y por eso no dijo
     * nada el día que se descubrió que ese dominio es de un competidor. Un
     * guardián que fija el valor equivocado no protege: lo defiende.
     */
    expect(contacto).toContain('CORREO_SOPORTE')
    expect(contacto).not.toContain('@nexusmed.mx')
  })
})
