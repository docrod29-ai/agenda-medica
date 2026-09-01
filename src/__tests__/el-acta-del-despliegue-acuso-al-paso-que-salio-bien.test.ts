/**
 * GOLDEN — el acta del despliegue dijo `FIRESTORE_RULES=failure` y las reglas
 * habían salido perfectas. REG-433.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El dueño pulsó el botón de producción (ejecución **#14**, 1-sep 22:41 UTC,
 * sobre `fc3a515`) y salió en rojo. Leyendo el log del job, no el resumen:
 *
 *     ✔  cloud.firestore: rules file firestore.rules compiled successfully
 *     i  firestore: latest version of firestore.rules already up to date,
 *        skipping upload...
 *     i  firestore: deploying indexes...
 *     Error: Request to …/collectionGroups/appointments/indexes had
 *            HTTP Error: 403, The caller does not have permission
 *
 * Y el acta que se le enseñó al dueño:
 *
 *     FIRESTORE_RULES=failure
 *     FIRESTORE_RULES_SHA256=no-emitido
 *     SECURITY_E2E=skipped
 *     SMOKE=skipped
 *     SMOKE_PORTAL=skipped
 *     PRODUCTION_RELEASE=FAILED
 *
 * Las reglas eran **lo único que había salido bien**, y el acta las señaló a
 * ellas. Quien lo leyera saldría a buscar el fallo a `firestore.rules`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un paso, dos actos: `--only firestore:rules,firestore:indexes`, y **una sola
 * variable** (`R_RULES`) para contar el resultado de los dos. Publicar reglas y
 * crear índices son operaciones distintas, con **permisos distintos** —
 * `datastore.indexes.create` no viene con el permiso de publicar reglas—, y por
 * tanto pueden acabar distinto. Contarlas juntas obliga al acta a mentir sobre
 * una de las dos.
 *
 * ── LAS DOS CONSECUENCIAS, QUE SON PEORES QUE EL RÓTULO ─────────────────────
 *
 * **1. Las reglas quedaron publicadas y sin sellar.** El sello cuelga de
 * `steps.rules.outcome == 'success'`, así que también se saltó. Las reglas
 * rigen en producción y el repositorio no tiene con qué saberlo — que es,
 * palabra por palabra, **REG-416**.
 *
 * **2. Nadie comprobó producción.** `Seguridad · producción`, `Smoke · público`
 * y `Smoke · portal` salieron **`skipped`**. Son las tres únicas que miran el
 * sitio vivo, que acababa de recibir una versión nueva. Un problema de permisos
 * en Google Cloud dejó sin medir si el producto funcionaba.
 *
 * ── LA TRAMPA QUE ESTE ARREGLO CASI REPITE ──────────────────────────────────
 *
 * La primera versión del arreglo puso `if: steps.cred.outcome == 'success'`. En
 * GitHub Actions, **un `if:` sin función de estado se envuelve implícitamente en
 * `success()`**, así que ese paso habría seguido saltándose en cuanto algo
 * anterior fallara — y el comentario de al lado prometía justo lo contrario. Se
 * cazó releyendo el grafo de pasos resuelto, no el diff. De ahí los
 * `!cancelled() &&` explícitos, que aquí se vigilan uno por uno.
 *
 * ── ESTO NO ABLANDA LA COMPUERTA ────────────────────────────────────────────
 *
 * El acta sigue exigiendo `success` en las **seis** para dar `SUCCESS`, y ahora
 * son seis y no cinco porque los índices se cuentan aparte. Lo único que cambia
 * es que las comprobaciones se ejecutan y se sabe su resultado, en vez de
 * quedarse sin medir.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el `--only firestore:rules,firestore:indexes` a un solo paso, cae
 * el primer bloque. Quitando los `!cancelled()`, cae el tercero.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No arregla el 403.** Falta un rol en IAM del proyecto —
 *   `roles/datastore.indexAdmin`— y eso se concede en la consola de Google
 *   Cloud, no aquí. Sigue siendo `BLOCKED_EXTERNAL`, igual que lo declaró
 *   REG-431 antes de que ocurriera.
 * · **No ejecuta el workflow.** Es un guardián de texto sobre el YAML: no
 *   comprueba que GitHub lo interprete como se espera. Lo que de verdad pasa se
 *   ve en la ejecución siguiente del botón.
 * · **No comprueba que los índices se construyan.** `firebase deploy` contesta
 *   al ENVIAR; la construcción va por su cuenta y puede fallar después.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const RUTA = '.github/workflows/deploy-production.yml'
const YAML_CRUDO = readFileSync(join(process.cwd(), RUTA), 'utf8')
const PASOS: Array<Record<string, unknown>> = (() => {
  const w = parse(YAML_CRUDO) as { jobs: Record<string, { steps: Array<Record<string, unknown>> }> }
  return Object.values(w.jobs)[0].steps
})()
const paso = (id: string) => PASOS.find(p => p.id === id)

/**
 * Sin los comentarios del YAML. Aquí se documenta lo RETIRADO —el `--only`
 * conjunto— y documentarlo vale: el primer intento de este golden se puso rojo
 * contra su propio comentario explicativo, igual que le pasó al del portal.
 */
const SIN_COMENTARIOS = YAML_CRUDO.replace(/^\s*#.*$/gm, '')

describe('reglas e índices se despliegan y se cuentan por separado', () => {
  it('ya no hay un paso que haga los dos a la vez', () => {
    expect(
      SIN_COMENTARIOS,
      'volvió el paso único: un fallo de índices vuelve a acusar a las reglas',
    ).not.toContain('--only firestore:rules,firestore:indexes')
  })

  it('cada acto tiene su paso, con su propio `--only`', () => {
    expect(paso('rules'), 'desapareció el paso de reglas').toBeTruthy()
    expect(paso('indices'), 'desapareció el paso de índices').toBeTruthy()
    expect(String(paso('rules')!.run)).toContain('--only firestore:rules ')
    expect(String(paso('indices')!.run)).toContain('--only firestore:indexes ')
  })

  it('y el acta los nombra los dos, con su propia variable', () => {
    expect(YAML_CRUDO).toContain('R_INDICES: ${{ steps.indices.outcome }}')
    expect(YAML_CRUDO).toContain('echo "FIRESTORE_INDICES=$R_INDICES"')
    expect(YAML_CRUDO).toContain('echo "FIRESTORE_RULES=$R_RULES"')
  })

  it('el resultado final sigue exigiéndolos TODOS — esto no relaja nada', () => {
    // `[\s\S]` y no el flag `/s`: el target de este proyecto es anterior a
    // es2018 y `tsc` lo rechaza (TS1501). Lo cazó el typecheck, no vitest.
    const m = YAML_CRUDO.match(/if \[ "\$R_VERSION" = success \]([\s\S]*?); then/)
    expect(m, 'desapareció el cálculo del resultado').toBeTruthy()
    for (const v of ['$R_RULES', '$R_INDICES', '$R_SECURITY', '$R_SMOKE', '$R_PORTAL']) {
      expect(m![1], `el acta dejó de exigir ${v}`).toContain(`[ "${v}" = success ]`)
    }
  })
})

describe('lo que mira el sitio vivo se ejecuta aunque Firestore falle', () => {
  it('las tres comprobaciones de producción dejaron de colgar del paso anterior', () => {
    // Salieron `skipped` las tres en la ejecución #14, por un 403 que no tiene
    // nada que ver con ellas. Son las únicas que miran si producción está sana.
    for (const id of ['security', 'smoke', 'portal']) {
      const p = paso(id)
      expect(p, `desapareció el paso ${id}`).toBeTruthy()
      expect(String(p!.if ?? ''), `${id} volvió a depender de que todo lo anterior fuera bien`)
        .toContain('!cancelled()')
    }
  })

  it('y el sello de las reglas depende de las REGLAS, no de todo lo demás', () => {
    // Con el success() implícito, un 403 en los índices —que corren antes—
    // dejaba las reglas publicadas y sin sellar. REG-416 otra vez.
    const s = String(paso('sello')!.if ?? '')
    expect(s).toContain("steps.rules.outcome == 'success'")
    expect(s, 'el sello volvió a colgar del éxito de todo el job').toContain('!cancelled()')
  })
})

describe('la trampa del `if` implícito no vuelve', () => {
  it('todo `if` que dependa de un paso concreto lleva su función de estado', () => {
    /**
     * En Actions, un `if:` SIN función de estado se evalúa como
     * `success() && <expresión>`. Un paso que diga «corre si X salió bien»
     * pero no lo declare, en realidad dice «corre si TODO salió bien» — y eso
     * es indistinguible leyendo el diff. Aquí se exige que lo declare.
     */
    const culpables = PASOS
      .filter(p => typeof p.if === 'string' && /steps\.\w+\.outcome/.test(p.if as string))
      .filter(p => !/always\(\)|!\s*cancelled\(\)|failure\(\)|success\(\)/.test(p.if as string))
      .map(p => `${p.id ?? p.name}: ${p.if}`)
    expect(
      culpables,
      `pasos que creen depender de otro y dependen de todo:\n${culpables.join('\n')}`,
    ).toEqual([])
  })
})

describe('cuando el fallo sea de permisos, el acta dice dónde se arregla', () => {
  it('nombra el rol exacto, y dice que no es cosa del repositorio', () => {
    // El dueño no usa terminal. «403» a secas lo manda a buscar a ciegas.
    expect(YAML_CRUDO).toContain('roles/datastore.indexAdmin')
    expect(YAML_CRUDO).toContain('HTTP Error: 403')
    expect(YAML_CRUDO).toMatch(/no en este repositorio/)
  })
})
