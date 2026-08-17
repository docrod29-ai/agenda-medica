/**
 * El gate del PR mide EL ARTEFACTO QUE SE ESTÁ REVISANDO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El job `e2e-publico` corría la matriz de seguridad contra **producción**. Su
 * grupo A3 recorre `RUTAS_PRIVADAS`, que es una lista **del árbol de este
 * checkout**: por cada ruta privada comprueba que llegue `X-Frame-Options:
 * DENY` y `frame-ancestors 'none'`.
 *
 * Instrumento y sujeto salían de sitios distintos. En cuanto una rama añadió
 * una pantalla al dashboard —V15 añadió `/operaciones`— el caso empezó a
 * preguntarle a producción por una ruta que sólo existe en el código del PR.
 *
 *     Error: operaciones: falta X-Frame-Options
 *     Expected: "DENY"   Received: undefined
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El CI lo cazó, pero lo cazó MAL: el rojo se leía como «la rama rompió una
 * cabecera de seguridad» cuando decía «producción va por detrás de la rama».
 * Se confirmó mirando los dos lados: el mismo job estaba rojo en el commit
 * anterior, que no tocaba rutas, y `curl -I localhost:3000/operaciones` sobre
 * el build de la rama devuelve `X-Frame-Options: DENY`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un gate de PR que sólo se puede poner en verde **desplegando** no protege al
 * PR: desplegar es decisión del dueño, así que el rojo se vuelve permanente y
 * enseña a ignorarlo. Es como murió el gate de ADRs.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Si la prueba lee el árbol, el servidor bajo prueba tiene que ser el
 *    build de ese árbol.** `PLAYWRIGHT_LOCAL=1` + `PLAYWRIGHT_BASE_URL` a
 *    localhost, con el `npm run build` del PR delante.
 * 2. **La comprobación contra producción NO desaparece: se muda a donde puede
 *    actuar** — `npm run e2e:seguridad:prod`, en el ciclo de despliegue, justo
 *    después de publicar. Si allí falta una cabecera, el despliegue está mal y
 *    se arregla en el momento.
 *
 * Medido antes de cambiar nada: la matriz entera (67 casos, incluidos B1
 * —violaciones de CSP en navegador real—, B2 y C1) pasa contra el build local
 * SIN credenciales de Firebase.
 *
 * Probado al revés: quitando `PLAYWRIGHT_LOCAL` del job falla el caso 1;
 * quitando el `npm run build` previo falla el 2; borrando la invocación contra
 * producción de la regla de despliegue falla el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que alguien CORRA `e2e:seguridad:prod` al desplegar.** Sólo
 *   que el paso siga escrito en la regla y el script siga existiendo. Que la
 *   mano que despliega lo ejecute no lo puede probar un test.
 * · **No vigila producción.** Desde el cambio, nada en CI avisa si producción
 *   pierde una cabecera entre despliegues. Declarado, no olvidado: hoy eso
 *   depende del ciclo de despliegue.
 * · No lee YAML de verdad: busca literales en el fichero. Un reordenamiento
 *   del job que conserve las claves sigue pasando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const CI = leer('.github/workflows/ci.yml')

/**
 * El bloque de UN job, acotado hasta el siguiente job. Sin acotar, `verificar`
 * —que también hace `npm run build`— haría pasar el caso 2 aunque
 * `e2e-publico` hubiera dejado de construir nada.
 */
function bloqueDeJob(nombre: string): string {
  const lineas = CI.split('\n')
  const i = lineas.findIndex(l => l === `  ${nombre}:`)
  if (i === -1) throw new Error(`no existe el job ${nombre} en ci.yml`)
  const j = lineas.findIndex((l, k) => k > i && /^ {2}[a-z][\w-]*:$/.test(l))
  return lineas.slice(i, j === -1 ? lineas.length : j).join('\n')
}

const JOB = bloqueDeJob('e2e-publico')

describe('el gate público mide el build del PR, no producción', () => {
  it('1 · el job apunta a localhost y levanta el servidor del propio checkout', () => {
    expect(JOB).toContain("PLAYWRIGHT_LOCAL: '1'")
    expect(JOB).toContain('PLAYWRIGHT_BASE_URL: http://localhost:3000')
  })

  it('2 · y construye ese build antes de medirlo', () => {
    /**
     * `PLAYWRIGHT_LOCAL=1` arranca `npm run start`, que sirve `.next`. Sin un
     * `npm run build` delante no hay `.next` que servir: el job mediría un
     * servidor que no arranca, o —peor— uno viejo.
     */
    const build = JOB.indexOf('run: npm run build')
    const medir = JOB.indexOf('e2e/seguridad.spec.ts')
    expect(build, 'el job ya no construye el artefacto que mide').toBeGreaterThan(-1)
    expect(build, 'se mide antes de construir').toBeLessThan(medir)
  })

  it('3 · la comprobación contra PRODUCCIÓN sigue viva, en el ciclo de despliegue', () => {
    /**
     * Mover un gate no puede significar perderlo. Si esto se borra, nadie
     * comprueba nunca las cabeceras del sitio vivo y el fichero de reglas
     * seguiría pareciendo completo.
     */
    const regla = leer('.claude/rules/deployment-and-flags.md')
    expect(regla, 'el ciclo de despliegue perdió la comprobación de producción')
      .toContain('npm run e2e:seguridad:prod')

    const scripts = JSON.parse(leer('package.json')).scripts as Record<string, string>
    expect(scripts['e2e:seguridad:prod'], 'el script que la regla nombra no existe').toBeTruthy()
    // Contra producción: es el único de los tres que NO fija baseURL local.
    expect(scripts['e2e:seguridad:prod']).not.toContain('PLAYWRIGHT_LOCAL')
  })

  it('4 · el modo local del config sigue existiendo: es de lo que depende el caso 1', () => {
    const cfg = leer('playwright.config.ts')
    expect(cfg).toContain("process.env.PLAYWRIGHT_LOCAL === '1'")
    expect(cfg).toMatch(/webServer:\s*\{[\s\S]{0,200}command: 'npm run start'/)
  })
})
