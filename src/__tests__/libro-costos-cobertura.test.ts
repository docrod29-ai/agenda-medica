/**
 * NINGUNA LLAMADA DE IA PUEDE GASTAR SIN DEJAR ASIENTO.
 *
 * ── LO QUE ESCONDÍA EL HUECO ─────────────────────────────────────────────────
 *
 * `/api/expediente/transcribir-chunk` —el texto que aparece en vivo mientras el
 * médico habla— se dispara CADA ~20 SEGUNDOS de cada consulta, en paralelo. Es
 * la llamada de IA más frecuente de toda la aplicación, y era la única que no
 * escribía nada en el libro de costos.
 *
 * El efecto no era «falta un renglón». Era que el gasto de voz salía
 * SISTEMÁTICAMENTE POR DEBAJO del real, y justo por el concepto que más se
 * repite: el tablero contaba la transcripción final y se saltaba las decenas de
 * transcripciones en vivo que la preceden. De ese número sale la decisión de a
 * cuánto vender el crédito.
 *
 * ── POR QUÉ ESTA PRUEBA Y NO UNA REVISIÓN ────────────────────────────────────
 *
 * Cablear el libro ruta por ruta significa acordarse, y acordarse falla. El
 * hueco no lo abrió nadie a propósito: la ruta nació después que el libro. Esta
 * prueba recorre el disco, encuentra sola las rutas que gastan dinero, y falla
 * si alguna no deja constancia — incluidas las que todavía no existen.
 *
 * Se aceptan las DOS formas de dejarla:
 *   · pasar por el gateway (`llamarIA`), que asienta solo; o
 *   · llamar al proveedor a mano y anotar con `anotarLlamada`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const RAIZ = resolve(process.cwd(), 'src/app/api')

function rutas(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...rutas(p))
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

/** Sin comentarios: un proveedor NOMBRADO en una explicación no gasta nada. */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')

/** ¿Esta ruta le pide dinero a un proveedor de IA? */
const gasta = (codigo: string) =>
  /api\.openai\.com|api\.anthropic\.com|resolverClaveIA/.test(codigo)

/** ¿Deja constancia, por cualquiera de las dos vías? */
const asienta = (codigo: string) => /anotarLlamada|llamarIA/.test(codigo)

/**
 * Rutas que TOCAN a un proveedor pero no le compran nada, con su razón.
 *
 * La señal de arriba es «menciona el host de un proveedor», y es deliberadamente
 * ancha: estrecharla a `/v1/messages` dejaría pasar en silencio cualquier
 * endpoint de pago que se use mañana. El precio de esa anchura es que hay que
 * declarar las excepciones a mano — que es exactamente lo que se quiere, porque
 * una excepción declarada se revisa y una condición astuta no.
 */
const NO_COMPRAN: Record<string, string> = {
  'src/app/api/health/route.ts':
    'Sonda de salud: pide `GET /v1/models`, que es un listado gratuito. Un endpoint de salud que cuesta dinero cada minuto se acaba apagando, y entonces no hay salud que valga.',
}

const RUTAS_QUE_GASTAN = rutas(RAIZ)
  .map(p => ({ p, codigo: sinComentarios(readFileSync(p, 'utf8')) }))
  .filter(x => gasta(x.codigo))
  .filter(x => !(x.p.slice(x.p.indexOf('src/app/api/')) in NO_COMPRAN))

describe('cobertura del libro de costos', () => {
  it('cada excepción declarada dice POR QUÉ no compra nada', () => {
    for (const [r, razon] of Object.entries(NO_COMPRAN)) {
      expect(razon.length, r).toBeGreaterThan(40)
    }
  })

  it('hay rutas de IA que auditar (si esto falla, la búsqueda se rompió)', () => {
    // Sin esta comprobación, un cambio de rutas dejaría la suite en verde
    // simplemente porque dejó de encontrar nada que revisar.
    expect(RUTAS_QUE_GASTAN.length).toBeGreaterThanOrEqual(15)
  })

  for (const { p, codigo } of RUTAS_QUE_GASTAN) {
    const nombre = p.slice(p.indexOf('src/app/api/'))
    it(`${nombre} deja asiento`, () => {
      expect(
        asienta(codigo),
        `${nombre} llama a un proveedor de IA y no escribe en el libro de costos. ` +
        'Pásala por `llamarIA` (gateway) o anótala con `anotarLlamada`.',
      ).toBe(true)
    })
  }
})

describe('la transcripción se cobra por minuto, no por tokens', () => {
  /**
   * Un asiento de audio SIN `minutosAudio` es un asiento de cero pesos: los
   * tokens de una transcripción son 0 por definición. Registraría la llamada y
   * perdería exactamente lo que costó.
   */
  const DE_AUDIO = [
    'src/app/api/expediente/transcribir/route.ts',
    'src/app/api/expediente/transcribir-chunk/route.ts',
  ]

  for (const archivo of DE_AUDIO) {
    it(`${archivo.slice(12)} manda los minutos`, () => {
      const src = readFileSync(resolve(process.cwd(), archivo), 'utf8')
      expect(src).toMatch(/minutosAudio/)
    })
  }

  it('el trozo en vivo recibe la duración del cliente', () => {
    // El servidor recibe un blob de webm: no puede deducir cuánto dura.
    const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useGrabacionAudio.ts'), 'utf8')
    expect(hook).toMatch(/fd\.append\('duracionSeg'/)
  })

  it('LA PAUSA NO SE FACTURA', () => {
    /**
     * Los segundos del trozo se restan de `duracionRef`, que ya descuenta las
     * pausas. Con el reloj de pared, una pausa de tres minutos se cobraría como
     * audio que nunca se grabó ni se mandó a transcribir.
     */
    const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useGrabacionAudio.ts'), 'utf8')
    expect(hook).toMatch(/duracionRef\.current - duracionUltimoTrozoRef\.current/)
  })
})
