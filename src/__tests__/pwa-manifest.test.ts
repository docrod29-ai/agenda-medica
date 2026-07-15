import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import manifest from '@/app/manifest'

describe('PWA manifest', () => {
  const m = manifest()

  it('es instalable: standalone, start_url, nombre e íconos', () => {
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/dashboard')
    expect(m.name).toBeTruthy()
    expect((m.icons ?? []).length).toBeGreaterThan(0)
  })

  it('tiene shortcuts hacia rutas autenticadas (§11.5)', () => {
    const s = m.shortcuts ?? []
    expect(s.length).toBeGreaterThanOrEqual(3)
    const urls = s.map(x => x.url)
    expect(urls).toContain('/calendario')
    expect(urls).toContain('/asistente')
    expect(urls).toContain('/pacientes')
    // todos los shortcuts apuntan a rutas internas (no externas)
    for (const x of s) expect(x.url.startsWith('/')).toBe(true)
  })
})

describe('Service Worker (§11.2)', () => {
  const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

  it('no cachea el HTML de rutas clínicas (defensa en profundidad)', () => {
    expect(sw).toMatch(/esRutaClinica/)
    expect(sw).toMatch(/expediente\|consulta\|nota\|receta/)
    // la condición de cacheo de navegación excluye rutas clínicas
    expect(sw).toMatch(/&&\s*!esRutaClinica/)
  })

  it('no intercepta APIs ni Firestore ni el handler de auth', () => {
    expect(sw).toMatch(/startsWith\('\/api\/'\)\)\s*return/)
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/)
    expect(sw).toMatch(/startsWith\('\/__\/'\)\)\s*return/)
  })
})
