import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Guardián: los diálogos NATIVOS (window.confirm / alert / window.alert) se
 * ignoran en silencio en apps instaladas / algunos WebViews → dejan al usuario
 * sin feedback y no ejecutan la acción. Deben usarse el confirm()/toast in-app.
 * Este test recorre el código del dashboard y de componentes y falla si reaparecen.
 */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

const raiz = process.cwd()
const dirs = ['src/app/(dashboard)', 'src/components'].map(d => resolve(raiz, d))
const archivos = dirs.flatMap(walk)

describe('native-dialogs-guard', () => {
  it('no hay window.confirm() en el dashboard ni en componentes', () => {
    const ofensores = archivos.filter(f => /window\.confirm\s*\(/.test(readFileSync(f, 'utf8')))
    expect(ofensores, `usa confirm() de ToastContext en: ${ofensores.join(', ')}`).toEqual([])
  })

  it('no hay alert() nativo en el dashboard ni en componentes', () => {
    // Excluye AlertTriangle, role="alert", nombres que contienen "alert" y .alert()
    const re = /(?<![.\w])(?:window\.)?alert\s*\(/
    const ofensores = archivos.filter(f => {
      const src = readFileSync(f, 'utf8')
      return src.split('\n').some(l => re.test(l))
    })
    expect(ofensores, `usa toast() en: ${ofensores.join(', ')}`).toEqual([])
  })
})
