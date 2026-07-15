import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Guardián (§9.5): no registrar material de secretos en logs — ni siquiera un
 * recorte (`apiKey.slice(0, 8)`). Un fragmento de token/llave en los logs del
 * servidor sigue siendo exposición. Falla si un console.* loguea un .slice de
 * una variable con nombre de secreto.
 */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

const archivos = walk(resolve(process.cwd(), 'src'))
// console.<nivel>( … <secreto>.slice( … )  en la misma línea
const re = /console\.\w+\([^)\n]*\b(apiKey|api_key|token|secret|password|authorization|bearer)\b[^)\n]*\.slice\s*\(/i

describe('log-secrets-guard', () => {
  it('ningún console.* registra un recorte de secreto', () => {
    const ofensores = archivos.filter(f =>
      readFileSync(f, 'utf8').split('\n').some(l => re.test(l) && !l.trim().startsWith('//')),
    )
    expect(ofensores, `no loguees material de secretos en: ${ofensores.join(', ')}`).toEqual([])
  })
})
