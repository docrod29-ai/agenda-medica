/**
 * GOLDEN — el respaldo se leía bien y nadie había comprobado que LLEGARA.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `npm run simulacro:respaldo` ensaya el ida y vuelta del NDJSON **en memoria**:
 * lo lee, lo reenraiza, cuenta y cronometra. Está bien y se puede correr en
 * cualquier parte. Pero el `FINAL-READINESS` decía exactamente qué se quedaba
 * fuera: «reglas, índices, latencia y el tope de 500 escrituras por transacción
 * no los da ninguna tienda en memoria».
 *
 * Y ésa es la mitad donde un respaldo falla de verdad. **REG-160 fue justo eso**:
 * el importador validaba la colección declarada y **escribía en la ruta**, que
 * era otro campo. Las pruebas en memoria pasaban todas.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * «El dato tiene que LLEGAR», aplicada al respaldo:
 * `scripts/simulacro-restauracion-firestore.mjs` escribe contra un Firestore de
 * verdad —el emulador— con el `leerLinea` y el `reenraizar` **del producto**, y
 * después **vuelve a leer cada documento del otro lado** y compara.
 *
 * ── LO QUE SE INTENTÓ MEDIR Y NO SE PUDO ────────────────────────────────────
 *
 * El tope del lote. Se probó de verdad: en modo `--lote-roto` el ensayo escribe
 * lotes de **600** y **el emulador los acepta**. O sea que el emulador tampoco
 * valida esa dimensión, y el `FINAL-READINESS` la contaba entre lo que se
 * ganaría saliendo de la memoria. No se gana. Queda declarado —en el acta, con
 * `topeDelLoteComprobado: false`— en vez de dado por bueno.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No es el RTO.** Esto restaura un NDJSON en una base ya viva. Resucitar una
 *   base perdida es `gcloud firestore databases restore` + PITR, configuración de
 *   la consola y del dueño.
 * · **No prueba las reglas.** El importador usa el SDK admin, que las ignora por
 *   diseño; quien prueba el aislamiento es el arnés de carga (REG-378), con
 *   sesiones de cliente.
 * · **El emulador no es producción**: sin latencia de red y sin contención real,
 *   los doc/s de aquí son un techo, no una promesa.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const GUION = 'scripts/simulacro-restauracion-firestore.mjs'
const ACTA = 'docs/audit/ws-02-carga/restauracion-emulador.json'

const fuente = readFileSync(GUION, 'utf8')
const acta = JSON.parse(readFileSync(ACTA, 'utf8'))

describe('el respaldo llega a Firestore, y se comprueba releyéndolo', () => {
  it('cada documento del archivo se releyó en su ruta reenraizada', () => {
    expect(acta.escritos).toBe(acta.documentosEnElArchivo)
    expect(acta.releidos).toBe(acta.escritos)
    expect(acta.faltantes).toEqual([])
    expect(acta.errorDeLote).toBeNull()
  })

  it('el ensayo no fue vacío, que es como este ensayo puede mentir', () => {
    /**
     * La primera versión del guion construía las líneas con `ruta`/`datos` en vez
     * de `_ruta`/`_coleccion`, que es el formato real. `leerLinea` las rechazó
     * TODAS y el ensayo salió en verde: `releidos === aEscribir.length` con las
     * dos en cero. Un cero contra un cero no demuestra nada.
     *
     * Ahora el guion sale con error si no hay nada que escribir, y este caso
     * comprueba que el acta guardada tampoco es la de un consultorio vacío.
     */
    expect(acta.documentosEnElArchivo).toBeGreaterThan(1000)
    expect(acta.lineasRechazadas).toBe(0)
    expect(acta.archivoCompleto, 'el archivo traía pie').toBe(true)
    expect(fuente).toMatch(/aEscribir\.length === 0/)
  })

  it('el lote del ensayo es el MISMO que el del importador', () => {
    /**
     * Si los dos números se separan, este ensayo mide algo que el producto no
     * hace. Se compara contra la constante de la ruta, no contra una copia. */
    const ruta = readFileSync('src/app/api/clinic/importar/route.ts', 'utf8')
    const delImportador = ruta.match(/^const LOTE = (\d+)$/m)?.[1]
    const delEnsayo = fuente.match(/^const LOTE = (\d+)$/m)?.[1]
    expect(delImportador, 'el importador dejó de declarar LOTE').toBeDefined()
    expect(delEnsayo).toBe(delImportador)
    expect(Number(delEnsayo)).toBeLessThanOrEqual(500)
  })

  it('el acta declara que el tope del lote NO quedó comprobado', () => {
    /**
     * Éste es el caso que guarda la honestidad de todo el archivo. El emulador
     * acepta lotes de 600, así que un verde de este ensayo no dice nada sobre el
     * tope — y el acta tiene que decirlo, no callarlo.
     */
    expect(acta.topeDelLoteComprobado).toBe(false)
    expect(acta.loQueEsteNumeroNoEs).toMatch(/el emulador acepta 600/)
  })

  it('y no se deja leer como si fuera el RTO', () => {
    expect(acta.loQueEsteNumeroNoEs).toMatch(/No es el RTO/)
    expect(acta.loQueEsteNumeroNoEs).toMatch(/PITR/)
    expect(acta.entorno).toContain('emulator')
  })

  it('sin las variables del emulador el guion no arranca', () => {
    /* Sin ellas el SDK admin hablaría con el proyecto VIVO y escribiría un
       consultorio sintético al lado de expedientes reales. */
    let error = ''
    try {
      /* Con `node` pelado y no con `tsx`: la comprobación del entorno ocurre
         ANTES de importar nada de TypeScript, así que este caso no depende de
         que `tsx` esté instalado — no está declarado como dependencia. */
      execFileSync('node', [GUION], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FIRESTORE_EMULATOR_HOST: '' },
      })
    } catch (e) {
      error = (e as { stderr: string }).stderr
    }
    expect(error).toContain('FIRESTORE_EMULATOR_HOST')
    expect(error).toMatch(/proyecto VIVO/)
  })

  it('el acta no lleva ni un campo que huela a paciente real', () => {
    const prohibido = /(patient.?name|patient.?email|patient.?phone|date.?of.?birth|dob|medical.?record|mrn|address)/i
    expect(Object.keys(acta).filter(k => prohibido.test(k))).toEqual([])
    expect(acta.syntheticNonPhi).toBe(true)
  })
})
