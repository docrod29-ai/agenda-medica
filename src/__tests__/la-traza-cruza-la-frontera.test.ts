/**
 * GOLDEN — no se podía seguir una petición del navegador al proveedor.
 *
 * ── QUÉ FALTABA (WS-13) ─────────────────────────────────────────────────────
 *
 * No existía traza. El tablero lo decía con precisión y era exacto: `requestId`
 * **se fabrica en cada ruta**, no llega del cliente, no viaja al proveedor, y el
 * gateway lo **muta** (`${requestId}-${proveedor}`). Es la clave del libro de
 * costos, no una traza.
 *
 * Lo que eso significa el día que pasa: un médico dice «se me quedó pensando y no
 * salió la nota», y no hay forma de seguir esa petición desde su navegador hasta
 * la llamada al proveedor. Se busca por hora y por consultorio, a mano.
 *
 * ── LA CAUSA RAÍZ: UN CAMPO HACÍA DOS TRABAJOS ──────────────────────────────
 *
 * `requestId` es la clave con la que se **cobra**, y el gateway le añade el
 * proveedor **a propósito** para que dos intentos del mismo trabajo se cobren
 * aparte. Una traza necesita justo lo contrario: el **mismo** identificador de
 * punta a punta.
 *
 * Arreglar uno rompía el otro. Por eso son dos campos y no uno — y por eso este
 * golden comprueba que `requestId` **sigue** mutando: si alguien lo «arreglara»
 * para que no lo hiciera, rompería la contabilidad.
 *
 * ── LA FORMA ES LA DEFENSA CONTRA EL PHI ────────────────────────────────────
 *
 * `c` + dieciséis hexadecimales, y `correlacionDe` **valida**. Quien mande
 * `x-correlacion: juan-perez-diabetes` no consigue meter eso en los registros: se
 * descarta y se acuña otro. La PHI no se evita pidiéndolo por favor; se evita
 * haciendo que el campo **no pueda** contenerla.
 *
 * Nótese el contraste: `requestId` embebe hoy el uid del médico
 * (`np-${uid}-${Date.now()}`). Identifica a una persona, y por eso la traza no se
 * construye encima de él.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide nada.** Es el hilo, no el instrumento: correlaciona registros que ya
 *   existen. La latencia y el error por ruta siguen siendo trabajo aparte (WS-12).
 * · **No cubre los trabajos de fondo.** Los crons no nacen de un navegador; su
 *   traza tendría que acuñarse al arrancar el trabajo, y eso no está hecho.
 * · **No llega al proveedor como cabecera.** Viaja hasta la llamada y queda en el
 *   asiento del libro; mandársela a Anthropic u OpenAI en un header es otra
 *   decisión, y no aportaría a la traza propia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  nuevaCorrelacion, correlacionDe, esCorrelacionValida,
  CABECERA_CORRELACION, FORMA_CORRELACION,
  POR_QUE_NO_SE_REUSA_REQUESTID, POR_QUE_LA_FORMA_ES_LA_DEFENSA,
} from '@/lib/observabilidad/correlacion'

const pedir = (valor: string | null) => ({ headers: { get: (n: string) => (n === CABECERA_CORRELACION ? valor : null) } })

describe('la forma del identificador es lo que impide meter PHI', () => {
  it('lo que acuña encaja en la forma', () => {
    for (let i = 0; i < 50; i += 1) expect(nuevaCorrelacion()).toMatch(FORMA_CORRELACION)
  })

  it('y dos seguidos no son iguales', () => {
    /* Un generador roto que devolviera una constante pasaría todo lo demás. */
    expect(new Set(Array.from({ length: 200 }, nuevaCorrelacion)).size).toBe(200)
  })

  it('AL REVÉS: un intento de meter un nombre se descarta y se acuña otro', () => {
    /**
     * Éste es el caso que justifica que la validación exista. Sin él,
     * `correlacionDe` podría devolver lo que llegue y un cliente —o alguien
     * curioseando— metería el nombre de un paciente en todos los registros.
     */
    const conPHI = correlacionDe(pedir('juan-perez-diabetes'))
    expect(conPHI).not.toContain('juan')
    expect(conPHI).toMatch(FORMA_CORRELACION)
  })

  it('y lo mismo con un correo, un uid o un id casi válido', () => {
    for (const intento of [
      'medico@clinica.mx',
      'c' + 'a'.repeat(16) + 'extra',   // demasiado largo
      'c0123456789abcde',                // un dígito de menos
      'C0123456789abcdef',               // mayúscula
      'c0123456789ABCDEF',               // hex en mayúscula
      '',
    ]) {
      expect(esCorrelacionValida(intento), `debería rechazar «${intento}»`).toBe(false)
      expect(correlacionDe(pedir(intento))).toMatch(FORMA_CORRELACION)
    }
  })

  it('una correlación válida SÍ se respeta — o no correlacionaría nada', () => {
    /* La otra mitad: si se descartara siempre, cada salto tendría un id distinto
       y la traza no existiría. */
    const buena = nuevaCorrelacion()
    expect(correlacionDe(pedir(buena))).toBe(buena)
  })

  it('sin cabecera, acuña en vez de dejarlo vacío', () => {
    expect(correlacionDe(pedir(null))).toMatch(FORMA_CORRELACION)
  })
})

describe('el hilo llega de punta a punta', () => {
  const cliente = readFileSync('src/lib/auth-client.ts', 'utf8')
  const gateway = readFileSync('src/lib/ia/gateway.ts', 'utf8')
  const ledger = readFileSync('src/lib/finanzas/cost-ledger.ts', 'utf8')

  it('el navegador la manda en toda petición autenticada', () => {
    expect(cliente).toMatch(/headers\.set\(CABECERA_CORRELACION/)
  })

  it('y es la MISMA para toda la pestaña', () => {
    /* Una por petición también correlacionaría, pero perdería lo que más sirve:
       agrupar la sesión de trabajo en la que el médico dice que algo falló. */
    expect(cliente).toMatch(/const CORRELACION_DE_LA_PESTANA = nuevaCorrelacion\(\)/)
  })

  it('las rutas de IA la leen de la petición, no se la inventan', () => {
    const rutas = execSync(
      "grep -rl \"requestId: req.headers.get('x-vercel-id')\" src/app/api --include=route.ts",
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    expect(rutas.length, 'el lector de rutas dejó de encontrarlas').toBeGreaterThan(10)
    const sinTraza = rutas.filter(r => !readFileSync(r, 'utf8').includes('correlacionDe(req)'))
    expect(sinTraza, 'rutas de IA que fabrican requestId y no leen la traza').toEqual([])
  })

  it('el gateway la copia SIN tocarla', () => {
    /* Mutarla la convertiría en otra clave y dejaría de correlacionar, que es su
       único trabajo. */
    expect(gateway).toMatch(/ctx\.correlacion \? \{ correlacion: ctx\.correlacion \}/)
  })

  it('y el asiento del libro la escribe — el paso donde se perdería', () => {
    /**
     * Es el último centímetro. Sin esta copia, todo lo anterior funcionaría y el
     * asiento se escribiría sin traza: el defecto de «el dato tiene que LLEGAR»,
     * en el sitio exacto donde este repositorio ya lo ha tenido tres veces.
     */
    expect(ledger).toMatch(/e\.correlacion \? \{ correlacion: e\.correlacion \}/)
    expect(ledger).toMatch(/correlacion\?: string/)
  })
})

describe('`requestId` sigue haciendo SU trabajo, que es otro', () => {
  const gateway = readFileSync('src/lib/ia/gateway.ts', 'utf8')

  it('el gateway le sigue pegando el proveedor', () => {
    /**
     * Parece un defecto y no lo es: cada intento se cobra aparte, así que la
     * clave de costos tiene que distinguirlos. Si alguien lo «arreglara» para que
     * la clave fuera estable, rompería la contabilidad — y por eso está aquí
     * congelado.
     */
    expect(gateway).toMatch(/requestId: fallo \? `\$\{ctx\.requestId\}-\$\{proveedor\}-fallo`/)
  })

  it('y el módulo explica por qué son dos campos y no uno', () => {
    expect(POR_QUE_NO_SE_REUSA_REQUESTID).toMatch(/un campo hacía dos trabajos/)
    expect(POR_QUE_LA_FORMA_ES_LA_DEFENSA).toMatch(/no pueda contenerla/)
  })

  it('la traza NO se construye sobre el uid, y el contraste se ve', () => {
    /* `requestId` embebe el uid del médico. Identifica a una persona; la traza
       no puede. */
    const procesar = readFileSync('src/app/api/expediente/procesar/route.ts', 'utf8')
    expect(procesar).toMatch(/np-\$\{acceso\.uid\}/)
    expect(procesar).toMatch(/correlacion: correlacionDe\(req\)/)
  })
})
