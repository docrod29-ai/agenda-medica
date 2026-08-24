import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fuente = readFileSync(
  join(process.cwd(), 'src/components/lente/VolverALaFuente.tsx'),
  'utf8',
)

function restaurador(): string {
  const inicio = fuente.indexOf('export function RestauradorDeRegreso()')
  if (inicio < 0) throw new Error('No se encontró RestauradorDeRegreso')
  return fuente.slice(inicio)
}

describe('Consultorio — scroll/focus estable en desktop y móvil', () => {
  it('la rueda del mouse cancela una restauración diferida antes de mover scrollTop', () => {
    const bloque = restaurador()
    expect(bloque).toContain("main?.addEventListener('wheel', cancelarPorUsuario")
    expect(bloque).toContain('if (!vivo || canceladoPorUsuario) return')
    expect(bloque.indexOf("addEventListener('wheel'"))
      .toBeLessThan(bloque.indexOf('main.scrollTop ='))
  })

  it('un gesto táctil cancela la restauración: el móvil no rebota a la posición vieja', () => {
    const bloque = restaurador()
    expect(bloque).toContain("main?.addEventListener('touchstart', cancelarPorUsuario")
    expect(bloque).toContain("main?.removeEventListener('touchstart', cancelarPorUsuario)")
  })

  it('las teclas que desplazan la página también expresan intención del médico', () => {
    const bloque = restaurador()
    for (const tecla of ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']) {
      expect(bloque).toContain(`'${tecla}'`)
    }
    expect(bloque).toContain("window.addEventListener('keydown', teclaDesplaza)")
    expect(bloque).toContain("window.removeEventListener('keydown', teclaDesplaza)")
  })

  it('cancelar consume el contrato y evita que otro render vuelva a pelear por scroll/foco', () => {
    const bloque = restaurador()
    const cancelar = bloque.slice(
      bloque.indexOf('const cancelarPorUsuario ='),
      bloque.indexOf('const teclaDesplaza ='),
    )
    expect(cancelar).toContain('canceladoPorUsuario = true')
    expect(cancelar).toContain('vivo = false')
    expect(cancelar).toContain('olvidarContrato(contrato.id)')
  })

  it('un click clínico normal no cancela la restauración por accidente', () => {
    const bloque = restaurador()
    expect(bloque).not.toContain("addEventListener('click', cancelarPorUsuario")
    expect(bloque).not.toContain("addEventListener('pointerdown', cancelarPorUsuario")
  })
})
