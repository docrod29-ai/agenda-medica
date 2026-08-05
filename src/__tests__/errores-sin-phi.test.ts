/**
 * GOLDEN — el identificador del paciente viajaba a una colección RAÍZ.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `/api/errores` guarda la ruta en la que ocurrió el fallo, y hace bien: sin
 * saber DÓNDE se rompió, un reporte no sirve.
 *
 * Pero las rutas de esta aplicación llevan el identificador del paciente dentro
 * —`/consulta/<patientId>`, `/expediente/<patientId>`— y esos reportes van a
 * `errores`, una colección **raíz**: fuera del ámbito del consultorio y legible
 * desde la consola del dueño de la plataforma.
 *
 * Es PHI saliendo de su consultorio por un canal de diagnóstico técnico, sin que
 * nadie lo pidiera ni lo viera.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Se conserva la FORMA de la ruta —`/consulta/:id`—, que es lo que hace útil el
 * reporte, y se borra el valor. Quien lo lea sigue sabiendo qué pantalla falló y
 * deja de saber de quién era la consulta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { redactarRuta } from '@/lib/security/sanitize'

describe('LA RUTA CONSERVA LA PANTALLA Y PIERDE AL PACIENTE', () => {
  it('la consulta', () => {
    expect(redactarRuta('/consulta/AbC123XyZ456')).toBe('/consulta/:id')
  })

  it('el expediente, sin perder lo que venía después', () => {
    // `/labs` dice en qué parte de la pantalla falló: eso sí sirve y se queda.
    expect(redactarRuta('/expediente/8x2Kd9Lm0Qw1/labs')).toBe('/expediente/:id/labs')
  })

  it('y el perfil público del médico', () => {
    expect(redactarRuta('/dr/perfil-publico-9')).toBe('/dr/:id')
  })

  it('la cadena de consulta se tira entera', () => {
    /**
     * Nunca debió llevar datos y no hace falta para saber dónde falló. Tirarla
     * es más barato que confiar en que nadie ponga nada ahí.
     */
    expect(redactarRuta('/agenda?dia=2026-08-04&paciente=Juan')).toBe('/agenda?…')
  })

  it('una ruta sin identificadores no se toca', () => {
    // Un redactor que estropea lo inocuo hace ilegible el informe.
    expect(redactarRuta('/precios')).toBe('/precios')
    expect(redactarRuta('/dashboard')).toBe('/dashboard')
  })

  it('y un identificador suelto también se borra', () => {
    // Aunque el segmento anterior no esté en la lista conocida.
    expect(redactarRuta('/algo/nuevo/K3m9Xp2Qr7Ls')).toBe('/algo/nuevo/:id')
  })
})

describe('ESTÁ CONECTADO EN LA RUTA QUE ESCRIBE', () => {
  const ruta = readFileSync(join(process.cwd(), 'src/app/api/errores/route.ts'), 'utf8')

  it('la ruta se redacta antes de guardarse', () => {
    expect(ruta).toContain('ruta: redactarRuta(')
  })

  it('y el mensaje y la traza pasan por el redactor de PII', () => {
    /**
     * Un error de la consulta puede llevar dentro el nombre o el dato que lo
     * provocó, y esta colección se lee desde fuera del consultorio.
     */
    expect(ruta).toContain('mensaje: redactarString(')
    expect(ruta).toContain('stack: redactarString(')
  })

  it('ya no se guarda nada crudo del cuerpo', () => {
    expect(ruta).not.toContain("ruta: String(body.ruta")
    expect(ruta).not.toContain("stack: String(body.stack")
  })
})
