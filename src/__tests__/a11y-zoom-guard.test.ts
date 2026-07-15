import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guardián de accesibilidad (§10.1): la app NUNCA debe bloquear el zoom.
 * Bloquearlo (`user-scalable=no` o `maximum-scale=1`) impide que quien necesita
 * agrandar el texto lo haga — una regresión de accesibilidad común y grave en
 * apps médicas. Este test lee la config de viewport y falla si se bloquea.
 */
const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

describe('a11y-zoom-guard', () => {
  it('el viewport NO bloquea el zoom (sin user-scalable=no ni maximum-scale=1)', () => {
    expect(layout).not.toMatch(/user-scalable\s*[:=]\s*['"]?no/i)
    expect(layout).not.toMatch(/userScalable\s*:\s*false/i)
    // maximumScale debe permitir agrandar (≥ 5); 1 bloquearía el zoom
    const m = layout.match(/maximumScale\s*:\s*(\d+)/)
    expect(m, 'no se encontró maximumScale en el viewport').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(5)
  })
})
