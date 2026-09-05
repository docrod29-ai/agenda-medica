import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * LA CSP DEL ARTEFACTO SE COMPRUEBA DESPUÉS DEL BUILD — REG-524.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `csp-manifest.test.ts` es la prueba que mira `.next/routes-manifest.json`,
 * el archivo que Vercel consume de verdad, y comprueba que la CSP y las dos
 * capas anti-clickjacking sobrevivieron al build. Está bien escrita: sin
 * artefacto se declara SALTADA, no verde.
 *
 * El problema era el orden del CI: en el job `verificar`, «Pruebas (vitest)»
 * corre ANTES de «Build de producción». Así que el artefacto nunca existía
 * cuando la prueba lo buscaba, y sus cuatro casos llevaban saltados desde el
 * día en que se escribieron — en cada corrida, sin ponerse rojos nunca. Una
 * prueba que siempre se salta es una prueba que no existe, con la ventaja de
 * parecer que sí.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría test-the-test del 5-sep-2026: «4 casos que nunca corren en CI
 * porque vitest va antes del build». Verificado leyendo `ci.yml` y, con el
 * build local hecho, ejecutando la prueba: los cuatro pasan sobre el
 * artefacto real. O sea que la prueba sirve; sólo nadie la dejaba mirar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * En el mismo job, después de `npm run build`, un paso vuelve a correr sólo
 * `csp-manifest.test.ts`. Ahí sí hay artefacto y la prueba deja de saltarse.
 * Es la hermana de `el-gate-mide-el-artefacto-que-revisa` (REG-3xx del ledger):
 * si la prueba lee un artefacto, el artefacto tiene que existir cuando corre.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Quitando el paso de `ci.yml`, el caso 1 cae; moviéndolo por delante del
 * build, el caso 2.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No ejecuta el CI: comprueba el orden de los pasos por fuente. Que el build
 *   del CI produzca un manifest con la CSP correcta lo dice la propia
 *   `csp-manifest.test.ts` cuando corre allí.
 * - No convierte `csp-manifest` en sellada: sigue pudiendo saltarse
 *   legítimamente en local sin build, y por eso no cuenta en el sello.
 */

const CI = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8')

/** El job `verificar`, desde su cabecera hasta el siguiente job de primer nivel. */
function job(nombre: string): string {
  const i = CI.indexOf(`\n  ${nombre}:\n`)
  expect(i, `no existe el job ${nombre}`).toBeGreaterThan(-1)
  const resto = CI.slice(i + 1)
  const siguiente = resto.slice(1).search(/\n  [a-z-]+:\n/)
  return siguiente === -1 ? resto : resto.slice(0, siguiente + 1)
}

describe('REG-524 · csp-manifest corre donde hay artefacto', () => {
  const VERIFICAR = job('verificar')

  it('1 · EL CASO: el job que construye vuelve a correr csp-manifest.test.ts después', () => {
    expect(VERIFICAR).toContain('npx vitest run src/__tests__/csp-manifest.test.ts')
  })

  it('2 · y lo hace DESPUÉS de `npm run build`, no antes', () => {
    const build = VERIFICAR.indexOf('run: npm run build')
    const manifest = VERIFICAR.indexOf('npx vitest run src/__tests__/csp-manifest.test.ts')
    expect(build).toBeGreaterThan(-1)
    expect(manifest, 'se mide antes de construir: el artefacto no existe todavía').toBeGreaterThan(build)
  })

  it('3 · la prueba sigue declarándose SALTADA sin artefacto, no verde', () => {
    // Si alguien la hiciera «pasar» sin manifest, el paso nuevo dejaría de medir nada.
    const src = readFileSync(join(process.cwd(), 'src/__tests__/csp-manifest.test.ts'), 'utf8')
    expect(src).toMatch(/it\.skip\(`SIN EVIDENCIA/)
    expect(src).toContain("'.next/routes-manifest.json'")
  })
})
