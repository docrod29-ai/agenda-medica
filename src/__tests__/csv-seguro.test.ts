import { describe, it, expect } from 'vitest'
import { celdaSegura } from '@/lib/csv-seguro'

describe('blindaje de inyección de fórmulas CSV', () => {
  it('neutraliza celdas que arrancan con carácter de fórmula', () => {
    expect(celdaSegura('=1+1')).toBe("'=1+1")
    expect(celdaSegura('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"')
    expect(celdaSegura('+cmd')).toBe("'+cmd")
    expect(celdaSegura('-2')).toBe("'-2")
    expect(celdaSegura('@x')).toBe("'@x")
  })
  it('no toca texto normal', () => {
    expect(celdaSegura('Consultorio Roma')).toBe('Consultorio Roma')
    expect(celdaSegura('Juan Pérez')).toBe('Juan Pérez')
    expect(celdaSegura(1799)).toBe('1799')
    expect(celdaSegura(null)).toBe('')
  })
  it('sigue escapando comas y comillas normales', () => {
    expect(celdaSegura('Pérez, Juan')).toBe('"Pérez, Juan"')
    expect(celdaSegura('él dijo "hola"')).toBe('"él dijo ""hola"""')
  })
})
