/**
 * GOLDEN — EL ACTA DEL DESPLIEGUE DIJO «SUCCESS» CON LAS REGLAS DE STORAGE EN ROJO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Ejecución #35 del botón de producción (11-sep-2026, v1196). El paso nuevo
 * «Storage · desplegar REGLAS» (D-058) salió en rojo: Cloud Storage for
 * Firebase contestó **403 · Permission 'firebasestorage.defaultBucket.get'
 * denied**. El job terminó `failure`… y el acta final imprimió
 * `PRODUCTION_RELEASE=SUCCESS`, porque el resultado se calculaba con seis
 * variables y ninguna era la de Storage.
 *
 * Quien lea sólo el acta —que es para lo que existe— cree que el paciente ya
 * puede subir estudios desde el portal. No puede: el bucket cierra todo lo no
 * declarado y `storage.rules` sigue sin regir.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Verificando la ejecución paso por paso, no por su resumen. El job decía
 * `failure` y el acta decía `SUCCESS`; la contradicción es el hallazgo.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El mismo patrón de REG-433 al revés. Allí un paso conjunto hacía que un
 * fallo de índices acusara a las reglas; aquí un paso nuevo se añadió al
 * despliegue **sin añadirlo al acta**: el acta enumera lo que publica a mano,
 * y una publicación nueva no entra sola. Y el paso tampoco guardaba su salida,
 * así que —a diferencia de los índices— no podía decir qué permiso faltaba.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. Cada paso que publica algo tiene su variable en el acta, su línea impresa
 *    y su sitio en el cálculo de `PRODUCTION_RELEASE`. Storage ya lo tiene.
 * 2. Todo paso de Firebase que pueda salir 403 guarda su salida y va seguido
 *    de un paso «si fue permiso, decir cuál falta» que nombra el rol exacto y
 *    dice que se arregla en IAM, no en el repositorio.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No despliega nada.** Comprueba el texto del workflow; que el rol
 *   `roles/firebasestorage.admin` sea el que falta lo confirma la siguiente
 *   ejecución del botón, no esta prueba.
 * · **No cubre `hosting` ni ningún publicable futuro.** El día que se añada
 *   otro `--only`, hay que añadirlo al acta a mano — y a esta lista. Lo
 *   genérico («todo lo que el despliegue dice publicar está declarado») vive en
 *   `lo-que-el-despliegue-dice-publicar-esta-declarado.test.ts`.
 * · **No sabe si el bucket existe.** El 403 de Firebase lleva un «or it may
 *   not exist» que esta prueba sólo obliga a mencionar en el aviso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const RUTA = '.github/workflows/deploy-production.yml'
const YAML_CRUDO = readFileSync(join(process.cwd(), RUTA), 'utf8')

type Paso = Record<string, unknown>
const pasosDe = (yaml: string): Paso[] => {
  const w = parse(yaml) as { jobs: Record<string, { steps: Paso[] }> }
  return Object.values(w.jobs)[0].steps
}
const PASOS = pasosDe(YAML_CRUDO)
const paso = (id: string) => PASOS.find(p => p.id === id)
const porNombre = (nombre: string) => PASOS.find(p => String(p.name ?? '').startsWith(nombre))

/** El cálculo de PRODUCTION_RELEASE, tal como está escrito en el acta. */
const condicionDelResultado = (yaml: string) =>
  yaml.match(/if \[ "\$R_VERSION" = success \]([\s\S]*?); then/)?.[1] ?? null

describe('REG-668 · el acta cuenta las reglas de Storage', () => {
  it('EL CASO: el paso de Storage entra en el cálculo de PRODUCTION_RELEASE', () => {
    const cond = condicionDelResultado(YAML_CRUDO)
    expect(cond, 'desapareció el cálculo del resultado').toBeTruthy()
    expect(cond!, 'el acta volvió a decir SUCCESS con Storage en rojo').toContain('[ "$R_STORAGE" = success ]')
  })

  it('con su propia variable, atada al paso que publica el bucket', () => {
    expect(paso('storage_rules'), 'desapareció el paso de Storage').toBeTruthy()
    expect(String(paso('storage_rules')!.run)).toContain('--only storage ')
    expect(YAML_CRUDO).toContain('R_STORAGE: ${{ steps.storage_rules.outcome }}')
  })

  it('y con su línea en el acta impresa, separada de las de Firestore', () => {
    // REG-433 partió reglas e índices para que un fallo no acusara al otro.
    // Storage es un tercer acto y una tercera línea; no se cuela en ninguna.
    expect(YAML_CRUDO).toContain('echo "STORAGE_RULES=$R_STORAGE"')
    expect(YAML_CRUDO).toContain('echo "FIRESTORE_RULES=$R_RULES"')
    expect(YAML_CRUDO).toContain('echo "FIRESTORE_INDICES=$R_INDICES"')
  })

  it('el cedazo sabe fallar: sin la variable, el caso de arriba se pone rojo', () => {
    /**
     * Probado al revés sobre el YAML de la ejecución #35, reconstruido quitando
     * la condición de Storage. Es exactamente el texto que dijo SUCCESS.
     */
    const de35 = YAML_CRUDO.replace(' && [ "$R_STORAGE" = success ]', '')
    expect(de35).not.toBe(YAML_CRUDO)
    expect(condicionDelResultado(de35)!).not.toContain('$R_STORAGE')
  })
})

describe('REG-668 · si fue permiso, el acta dice cuál', () => {
  it('el paso guarda su salida, porque sin ella no hay nada que leer', () => {
    // Los índices lo hacen desde REG-433; Storage no lo hacía, y por eso el
    // 403 sólo se vio abriendo el log crudo del runner.
    expect(String(paso('storage_rules')!.run)).toContain('tee "$RUNNER_TEMP/storage.log"')
  })

  it('hay un paso de aviso que corre SÓLO cuando Storage falla', () => {
    const aviso = porNombre('Storage · si fue permiso')
    expect(aviso, 'desapareció el aviso de permiso de Storage').toBeTruthy()
    const cond = String(aviso!.if ?? '')
    expect(cond).toContain('always()')
    expect(cond).toContain("steps.storage_rules.outcome == 'failure'")
    expect(String(aviso!.run)).toContain("grep -q 'HTTP Error: 403'")
    expect(String(aviso!.run)).toContain('$RUNNER_TEMP/storage.log')
  })

  it('nombra el permiso denegado, el rol exacto, y dice que no es cosa del repositorio', () => {
    const run = String(porNombre('Storage · si fue permiso')!.run)
    expect(run).toContain('firebasestorage.defaultBucket.get')
    expect(run).toContain('roles/firebasestorage.admin')
    expect(run).toMatch(/no en este repositorio/)
    // El 403 de Firebase dice «or it may not exist»: el aviso ofrece las dos
    // lecturas, porque con la primera sola se puede dar un rol que ya estaba.
    expect(run).toContain('or it may not')
  })

  it('y deja claro que las reglas de Firestore NO fueron el problema', () => {
    // Es lo primero que uno sospecha al ver el job en rojo, y es falso: en la
    // #35 las reglas y los índices de Firestore salieron perfectos.
    const run = String(porNombre('Storage · si fue permiso')!.run)
    expect(run).toContain('FIRESTORE_RULES')
    expect(run).toMatch(/NO son el problema/)
  })
})
