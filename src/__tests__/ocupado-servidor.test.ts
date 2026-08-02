/**
 * GOLDEN — el calendario del médico llega a los TRES caminos que agendan.
 *
 * El panel, el portal público y el bot de WhatsApp agendan sobre la misma
 * agenda. Este repositorio ya pagó una vez lo que cuesta que cada uno resuelva
 * lo mismo por su cuenta: cinco implementaciones del cálculo de huecos, cuatro
 * desactualizadas, y el bot ofreciendo la hora de la comida.
 *
 * Estas pruebas no llaman a Google —eso es red— sino que vigilan lo que se
 * rompe en silencio: que la consulta siga viviendo en UN solo módulo y que los
 * tres caminos lo usen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('la consulta del calendario vive en un solo sitio', () => {
  it('el portal público la usa', () => {
    const s = leer('src', 'app', 'api', 'public', 'availability', '[clinicId]', 'route.ts')
    expect(s).toContain('ocupadoEnGoogle')
  })

  it('el ALTA pública la revalida — «no ofrecer» y «no aceptar» son distintas', () => {
    // Una pestaña abierta desde antes, o una petición directa, mete la cita
    // igual. Ya pasó con el horario partido.
    const s = leer('src', 'app', 'api', 'public', 'booking', 'route.ts')
    expect(s).toContain('ocupadoEnGoogle')
    expect(s).toContain('Ese horario ya no está disponible')
  })

  it('el bot la carga junto con los bloqueos, que es lo que alimenta sus tres caminos', () => {
    const s = leer('src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts')
    expect(s).toContain('ocupadoEnGoogle')
    expect(s).toMatch(/cargarBloques\(clinicId, fecha, doctor\?\.id/)
    expect(s).toMatch(/cargarBloques\(clinicId, datos\.fecha, doctor\?\.id/)
  })

  it('ninguno de los tres llama a `intervalosOcupados` por su cuenta', () => {
    // Ahí es donde empiezan las cinco implementaciones.
    for (const ruta of [
      ['src', 'app', 'api', 'public', 'availability', '[clinicId]', 'route.ts'],
      ['src', 'app', 'api', 'public', 'booking', 'route.ts'],
      ['src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'],
    ]) {
      expect(leer(...ruta), ruta.join('/')).not.toContain('intervalosOcupados')
    }
  })
})

describe('el módulo declara sus propias reglas', () => {
  const s = leer('src', 'lib', 'calendario', 'ocupado-servidor.ts')

  it('sin médico no se consulta nada: no se adivina de quién es el calendario', () => {
    expect(s).toContain('if (!clinicId || !medicoId')
  })

  it('un fallo de Google NO se convierte en «no hay nada libre»', () => {
    expect(s).toContain('POR_QUE_NO_SE_ESCONDE_EL_DIA')
    expect(s).toMatch(/fallo: true/)
  })
})
