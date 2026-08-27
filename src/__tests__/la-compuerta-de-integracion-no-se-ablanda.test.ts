import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * «BUILD VERDE LOCAL» NO PUEDE VALER LO MISMO QUE «PREVIEW VERCEL VERDE».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * 27-ago-2026. Cuatro lotes integrados con merges remotos consecutivos; cada
 * push disparó un Preview sobre un estado intermedio que nadie había
 * construido. El de `1d9a55f3` salió rojo con tres símbolos sin importar en
 * `src/lib/firestore.ts` (`idIdempotente`, `claveDeEspera`, `runTransaction`):
 * el merge se quedó con la llamada de una rama y con los imports de la otra.
 * Las líneas no se solapaban, así que git fusionó limpio y calló.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Por el semáforo de GitHub, no por nosotros: «Deployment has failed». Y al ir
 * a leer los logs de Vercel no había credenciales en la máquina, así que la
 * causa hubo que RECONSTRUIRLA reproduciendo el build sobre el commit exacto.
 * Un diagnóstico que depende de una credencial que no tenemos es un diagnóstico
 * que a veces no ocurre.
 *
 * ── LA CAUSA RAÍZ, Y LA DE VERDAD ────────────────────────────────────────────
 *
 * No fue el import perdido: eso es el síntoma del día. Fue que **el estado
 * intermedio se publicó sin construirlo**. Y peor: lo que devolvió el verde a
 * las 06:39 no fue arreglar los tres imports, fue que el merge siguiente
 * revirtió la rama entera. El verde se compró tirando el trabajo, y el semáforo
 * no lo dijo porque sólo mira el último commit.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Hay UN solo build en la compuerta y es el equivalente al Preview
 * (`scripts/preview-equivalente.mjs`, con el entorno fregado). Si además
 * hubiera un `npm run build` a secas, su verde parecería suficiente — y ese
 * desnivel es justo el que se paga en el Preview. Esta prueba vigila que nadie
 * ablande esa compuerta: ni con `ignoreBuildErrors`, ni con `ignoreCommand`, ni
 * con `continue-on-error`, ni silenciando a Vercel.
 *
 * ── QUÉ **NO** CUBRE, DECLARADO ──────────────────────────────────────────────
 *
 *   · No comprueba que el Preview real esté verde: eso exige credenciales de
 *     Vercel que esta suite no tiene y no debe tener.
 *   · No cubre cabeceras, rewrites del edge ni runtime. Sólo compilación,
 *     tipos y el desnivel de entorno — lo que rompió el 27-ago.
 *   · No lee las Preview Environment Variables de Vercel. El manifiesto declara
 *     NOMBRES; que en Vercel existan con valor correcto es del dueño.
 *   · Vigila los ficheros de configuración que hoy existen. Un mecanismo nuevo
 *     de Vercel para saltarse el build no lo conoce hasta que se añada aquí.
 */

const leer = (p: string) => readFileSync(p, 'utf8')

describe('la compuerta de integración no se puede ablandar', () => {
  it('next.config.ts no se salta los errores de tipo ni el lint del build', () => {
    const cfg = leer('next.config.ts')
    // Se busca la BANDERA, no la palabra: un comentario que la nombre es legítimo.
    expect(cfg).not.toMatch(/ignoreBuildErrors\s*:\s*true/)
    expect(cfg).not.toMatch(/ignoreDuringBuilds\s*:\s*true/)
  })

  it('vercel.json no esconde el build ni silencia el semáforo', () => {
    const vercel = JSON.parse(leer('vercel.json'))
    // `ignoreCommand` puede saltarse el build entero: un Preview que no se
    // construye no sale rojo, pero tampoco protege de nada.
    expect(vercel.ignoreCommand).toBeUndefined()
    expect(vercel.build?.ignoreCommand).toBeUndefined()
    // Apagar o silenciar la integración de GitHub deja el árbol sin semáforo.
    expect(vercel.github?.enabled).not.toBe(false)
    expect(vercel.github?.silent).toBe(undefined)
  })

  it('el job `verificar` del CI no se marca amarillo', () => {
    const ci = leer('.github/workflows/ci.yml')
    const verificar = ci.slice(ci.indexOf('\n  verificar:'))
    const siguiente = verificar.slice(1).search(/\n {2}[a-z][a-z-]*:\n/)
    const bloque = siguiente > 0 ? verificar.slice(0, siguiente + 1) : verificar
    expect(bloque).toContain('tsc --noEmit')
    expect(bloque).toContain('npm run build')
    expect(bloque).not.toMatch(/continue-on-error\s*:\s*true/)
  })

  it('la compuerta construye por el equivalente al Preview, no por un build a secas', () => {
    const gate = leer('scripts/compuerta-integracion.mjs')
    expect(gate).toContain('scripts/preview-equivalente.mjs')
    expect(gate).toContain('npx tsc --noEmit')
    expect(gate).toContain('node scripts/lint-trinquete.mjs')
    expect(gate).toContain('npx vitest run')
    expect(gate).toContain('git --no-pager diff --check')
    // El paso F es el ÚNICO build. Un `npm run build` suelto aquí devolvería el
    // desnivel que costó el Preview rojo.
    const invocaBuildSuelto = /correr\(\s*['"]npm run build['"]\s*\)/.test(gate)
    expect(invocaBuildSuelto).toBe(false)
  })

  it('el equivalente al Preview friega el entorno y no inyecta secretos', () => {
    const eq = leer('scripts/preview-equivalente.mjs')
    expect(eq).toContain("startsWith('NEXT_PUBLIC_')")

    const manifiesto = JSON.parse(leer('ops/vercel/preview-env.manifest.json'))
    const publicas = new Set<string>([
      ...manifiesto.publicas_que_el_build_exige.nombres,
      ...manifiesto.publicas_opcionales.nombres,
    ])

    // Todo nombre que el script escribe en el entorno tiene que ser público y
    // estar declarado. Si mañana alguien inyecta un secreto para «arreglar» un
    // build, esta prueba lo caza aquí y no en el Preview.
    const inyectados = [...eq.matchAll(/^ {2}(NEXT_PUBLIC_[A-Z0-9_]+):/gm)].map(m => m[1])
    expect(inyectados.length).toBeGreaterThan(0)
    for (const nombre of inyectados) expect(publicas).toContain(nombre)
  })

  it('el manifiesto guarda NOMBRES, nunca valores', () => {
    const manifiesto = JSON.parse(leer('ops/vercel/preview-env.manifest.json'))
    const nombres = [
      ...manifiesto.publicas_que_el_build_exige.nombres,
      ...manifiesto.publicas_opcionales.nombres,
    ]
    expect(nombres.length).toBeGreaterThan(0)
    for (const n of nombres) {
      // Un nombre de variable y nada más: sin `=`, sin `:`, sin espacios. Una
      // pareja `NOMBRE=valor` no pasa de aquí.
      expect(n).toMatch(/^[A-Z][A-Z0-9_]*$/)
    }
    // El invariante dicho en el propio manifiesto, para que no se pierda al editarlo.
    expect(manifiesto.secretos_que_el_build_NO_puede_necesitar).toBeDefined()
  })

  it('las seis públicas que el build EXIGE están declaradas', () => {
    // Medido, no supuesto: el 27-ago-2026 se construyó `47e2a01d` sin ellas y
    // murió con `auth/invalid-api-key` recolectando `/dr/[clinicId]`. Es el
    // mismo accidente que documenta REG-059.
    const manifiesto = JSON.parse(leer('ops/vercel/preview-env.manifest.json'))
    expect(new Set(manifiesto.publicas_que_el_build_exige.nombres)).toEqual(new Set([
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
    ]))
  })
})
