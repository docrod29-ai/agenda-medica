/**
 * GOLDEN — UN CERO POR NO HABER MIRADO ES EVIDENCIA FABRICADA.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * WS-02 llevaba `NOT_DONE` con una asimetría rara: `validate-consultorio-load-
 * result.mjs` sabía juzgar un JSON de carga y `generate-consultorio-load-fixture
 * .mjs` sabía fabricar el corpus sintético, pero **ningún programa producía el
 * JSON**. Un validador que nunca había validado nada.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO DE VERDAD ──────────────────────────────────
 *
 * Al escribir el arnés. El validador exige que los seis bloqueadores
 * incondicionales —fuga entre consultorios, borrador perdido, pantalla en
 * blanco…— sean **enteros no negativos**. Un arnés que corre donde no puede
 * observar alguno de ellos sólo tiene dos salidas: escribir `0`, o no escribir el
 * campo.
 *
 * Y `0` **no significa «no lo miré»: significa «lo miré y no había ninguno»**.
 * Escribirlo por no haber mirado es tratar la ausencia de dato como dato de
 * ausencia —la regla 4 de seguridad clínica, dicha en lenguaje de operación— con
 * un coste del mismo orden: quien lea ese JSON creerá que se comprobó que un
 * consultorio no ve los expedientes de otro.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un esquema que sólo admite números **obliga a mentir** a quien no midió. El
 * hueco no estaba en el validador ni en el arnés por separado, sino en que nadie
 * había tenido que rellenar ese formulario todavía.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El arnés escribe **`null`** en lo que no midió, con una lista `noMedido` que
 * dice para cada campo qué entorno haría falta. El validador **rechaza** ese
 * informe — y eso es lo correcto: todavía no es evidencia. El arnés no se ablanda
 * para pasar su propia puerta y el validador no se toca para dejarlo pasar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el producto aguante 100 000 pacientes.** La evidencia
 *   guardada es de 100 médicos y 8 000 peticiones contra un emulador local. Dice
 *   lo que dice y lleva su `environment` escrito.
 * · **Un emulador no es producción**: no tiene la latencia de red, ni los índices
 *   desplegados, ni la contención real. Lo que sí es real ahí son
 *   `firestore.rules`, y por eso la sonda de fuga entre consultorios vale.
 * · **No mide lo que declara no medir.** Esa es justamente la mitad del trato.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ARNES = 'scripts/product/run-consultorio-load.mjs'
const VALIDADOR = 'scripts/product/validate-consultorio-load-result.mjs'
const EVIDENCIA = 'docs/audit/ws-02-carga/emulador-100-medicos.json'

const fuente = readFileSync(ARNES, 'utf8')
const informe = JSON.parse(readFileSync(EVIDENCIA, 'utf8'))

/** Los seis que el validador llama bloqueadores incondicionales. */
const BLOQUEADORES = [
  'lostDraftCount',
  'blankScreenCount',
  'crossTenantLeakageCount',
  'unboundedReadCount',
  'idempotencyViolationCount',
  'silentProviderFailureCount',
]

function validar(objeto: unknown): { code: number; salida: string } {
  const dir = mkdtempSync(join(tmpdir(), 'carga-'))
  const ruta = join(dir, 'r.json')
  writeFileSync(ruta, JSON.stringify(objeto))
  try {
    const salida = execFileSync('node', [VALIDADOR, ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, salida }
  } catch (e) {
    const err = e as { status: number; stderr: string }
    return { code: err.status, salida: err.stderr }
  }
}

describe('el arnés escribe null donde no midió, y el validador lo rechaza', () => {
  it('el informe real trae null —no cero— en todo lo que no se midió', () => {
    for (const { campo } of informe.noMedido) {
      const valor = campo.startsWith('queues.')
        ? informe.queues[campo.slice('queues.'.length)]
        : informe[campo]
      expect(valor, `${campo} debería ir en null`).toBeNull()
    }
    expect(informe.complete).toBe(false)
  })

  it('y el validador lo RECHAZA, que es la respuesta correcta', () => {
    const { code, salida } = validar(informe)
    expect(code).toBe(1)
    expect(salida).toContain('INVALID CONSULTORIO LOAD EVIDENCE')
  })

  /**
   * AL REVÉS — el caso que justifica todo lo anterior.
   *
   * Se le mete el defecto: los mismos `null` sustituidos por `0`, que es lo que
   * habría escrito un arnés complaciente. Si el validador lo acepta, queda
   * demostrado que el `null` es lo único que separa un informe honesto de una
   * evidencia fabricada que pasa la puerta.
   */
  it('con ceros en su lugar, la MISMA corrida pasaría como evidencia válida', () => {
    const falsificado = structuredClone(informe)
    for (const { campo } of informe.noMedido) {
      if (campo.startsWith('queues.')) {
        falsificado.queues[campo.slice('queues.'.length)] = { maxDepth: 0, retryCount: 0, duplicateCount: 0 }
      } else {
        falsificado[campo] = 0
      }
    }
    falsificado.complete = true

    const { code, salida } = validar(falsificado)
    expect(code, 'si esto falla, el reverse proof dejó de demostrar nada').toBe(0)
    expect(JSON.parse(salida).validEvidence).toBe(true)
    // Y diría que no hay ningún bloqueador — sin haber mirado ni uno.
    expect(JSON.parse(salida).unconditionalBlockers).toEqual([])
  })

  it('el arnés no rellena ningún bloqueador con un cero por omisión', () => {
    /* `x ?? 0` y `x || 0` son la forma en que este defecto vuelve: silenciosa y
       de una sola línea. Se busca sobre el código, sin comentarios ni textos. */
    const codigo = fuente
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/'[^']*'/g, "''")
    for (const campo of BLOQUEADORES) {
      expect(codigo, `${campo} se rellena por omisión`).not.toMatch(
        new RegExp(`${campo}[^,;\\n]*(\\?\\?|\\|\\|)\\s*0`),
      )
    }
  })
})

describe('lo que el arnés midió de verdad, y contra qué', () => {
  it('las cuentas del propio informe cuadran', () => {
    expect(informe.successCount + informe.errorCount).toBe(informe.requestCount)
    expect(informe.concurrentConsultations).toBeLessThanOrEqual(informe.registeredPhysicians)
    expect(informe.latencyMs.p50).toBeLessThanOrEqual(informe.latencyMs.p95)
    expect(informe.latencyMs.p95).toBeLessThanOrEqual(informe.latencyMs.p99)
  })

  it('la sonda de fuga entre consultorios se ejecutó de verdad', () => {
    /**
     * Un `crossTenantLeakageCount: 0` con CERO sondas sería el mismo defecto que
     * este archivo persigue, disfrazado: la cuenta es honesta sólo si alguien
     * intentó cruzar. Se comprueba que hubo intentos, y que fueron dos por
     * médico —una lectura y una escritura—, porque una regla puede cerrar la
     * lectura y dejar abierta la escritura.
     */
    expect(informe.sondas.fugaEntreConsultorios).toBeGreaterThan(0)
    expect(informe.sondas.fugaEntreConsultorios).toBe(informe.registeredPhysicians * 2)
    expect(informe.crossTenantLeakageCount).toBe(0)
  })

  it('la evidencia dice de qué árbol salió y en qué entorno', () => {
    expect(informe.candidateSha).toMatch(/^[0-9a-f]{40}$/)
    expect(informe.environment).toContain('emulator')
    expect(informe.syntheticNonPhi).toBe(true)
  })

  it('y no lleva ni un campo que huela a paciente real', () => {
    /* El validador ya lo comprueba; aquí se comprueba sobre el artefacto
       GUARDADO, que es el que acaba en un repositorio y en un correo. */
    const prohibido = /(patient.?name|patient.?email|patient.?phone|date.?of.?birth|dob|medical.?record|mrn|address)/i
    const claves: string[] = []
    const recorrer = (v: unknown): void => {
      if (!v || typeof v !== 'object') return
      if (Array.isArray(v)) { v.forEach(recorrer); return }
      for (const [k, hijo] of Object.entries(v)) { claves.push(k); recorrer(hijo) }
    }
    recorrer(informe)
    expect(claves.filter(k => prohibido.test(k))).toEqual([])
  })
})

describe('el arnés no se puede apuntar al proyecto vivo', () => {
  it('--target que no sea el emulador se rechaza, y dice por qué', () => {
    /**
     * Meter carga sintética en producción escribe documentos junto a expedientes
     * reales. Es una de las cosas que el charter reserva al dueño, así que la
     * puerta está en el código y no en la costumbre de quien lo corre.
     */
    let error = ''
    try {
      execFileSync('node', [ARNES, '--target=prod'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      error = (e as { stderr: string }).stderr
    }
    expect(error).toContain('Sólo --target=emulator')
    expect(error).toMatch(/expedientes reales/)
  })

  it('sin las variables del emulador tampoco corre', () => {
    /* Sin ellas los SDK hablarían con el proyecto VIVO por omisión, que es
       exactamente el accidente que esta comprobación evita. */
    let error = ''
    try {
      execFileSync('node', [ARNES], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FIRESTORE_EMULATOR_HOST: '', FIREBASE_AUTH_EMULATOR_HOST: '' },
      })
    } catch (e) {
      error = (e as { stderr: string }).stderr
    }
    expect(error).toContain('FIRESTORE_EMULATOR_HOST')
    expect(error).toMatch(/proyecto VIVO/)
  })
})
