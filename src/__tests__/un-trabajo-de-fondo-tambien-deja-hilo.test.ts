/**
 * GOLDEN — el hilo llegaba del navegador y se paraba en dos sitios.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `WS-13.correlation-id`, con las dos mitades nombradas en el censo: «Faltan los
 * trabajos de fondo —un cron no nace de un navegador y su traza tendría que
 * acuñarse al arrancar— y mandarla al proveedor como cabecera».
 *
 * REG-388 cosió el hilo del navegador al asiento del libro de costos en las 16
 * rutas de IA. Se paraba en los dos extremos:
 *
 *  · **Antes**, los cinco crons no acuñaban ninguna. «El recordatorio de las 8:00
 *    no llegó» se podía seguir hasta la colección donde acabó, y no hasta la
 *    corrida que lo intentó — el latido decía que el cron corrió y los mensajes
 *    decían que fallaron, sin nada que uniera las dos cosas cuando hay dos
 *    corridas en la misma hora.
 *  · **Después**, la petición al proveedor salía sin traza. Cuando el proveedor
 *    dice «esa petición nos llegó rara», no había forma de señalar cuál: nuestro
 *    identificador no existía en su lado y el suyo no existía en el nuestro.
 *
 * ── POR QUÉ UN TRABAJO NO USA `correlacionDe(req)` ──────────────────────────
 *
 * Un cron llega por HTTP, así que reutilizarla parece gratis: no traería cabecera
 * y acuñaría una nueva igual. Pero el endpoint es una URL, y **quien tenga el
 * secreto del cron puede mandarle una cabecera**. Con `correlacionDe`, quien
 * llama elige la traza: dos ejecuciones podrían compartirla, o una podría fijarse
 * a la de otra cosa a propósito.
 *
 * Un trabajo de fondo no nace de un navegador: nace del reloj. Por eso es una
 * función distinta y no un parámetro — un `correlacionDe(req, { confiar: false })`
 * habría dejado la decisión en cada llamador, que es como se pierden.
 *
 * ── POR QUÉ AL PROVEEDOR VA EN CABECERA Y NO EN EL CUERPO ───────────────────
 *
 * El cuerpo lleva PHI minimizada y es lo que el proveedor procesa; una cabecera
 * opaca es inerte. Y va **la misma** que se escribe en el asiento, no una nueva:
 * una traza que cambia al cruzar la frontera no correlaciona nada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el proveedor la registre.** Es una cabecera propia; quien no
 *   la conozca la ignora, que es el comportamiento correcto. Comprobar que
 *   aparece en SU panel exige mirar su panel.
 * · **No la mete en los mensajes de WhatsApp que un cron manda**, sólo en el
 *   latido de la ejecución. Coser la traza hasta cada mensaje del outbox es la
 *   rebanada siguiente y queda nombrada.
 * · **No la escribe en `safeLog`.** El latido es el registro durable; una línea
 *   de log se pierde con el despliegue.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  correlacionDeTrabajo, correlacionDe, esCorrelacionValida, FORMA_CORRELACION,
  CABECERA_CORRELACION, POR_QUE_UN_TRABAJO_NO_ACEPTA_LA_QUE_LE_MANDEN,
} from '@/lib/observabilidad/correlacion'

const CRONS = ['asientos', 'limpiar-audio', 'reminders', 'retencion', 'vigilante']
const fuente = (job: string) => readFileSync(`src/app/api/cron/${job}/route.ts`, 'utf8')
const GATEWAY = readFileSync('src/lib/ia/gateway.ts', 'utf8')
const LATIDO = readFileSync('src/lib/ops/latido.ts', 'utf8')

describe('un trabajo de fondo acuña su traza al arrancar', () => {
  it('y NO acepta la que le manden — ésa es la diferencia', () => {
    /**
     * AL REVÉS de reutilizar `correlacionDe`: con una cabecera puesta a mano,
     * aquélla la devuelve tal cual y quien llama elige la traza. La del trabajo
     * no mira lo que llegó.
     */
    const conCabecera = { headers: { get: () => 'c0123456789abcdef' } }
    expect(correlacionDe(conCabecera)).toBe('c0123456789abcdef')
    expect(correlacionDeTrabajo()).not.toBe('c0123456789abcdef')
  })

  it('cada ejecución tiene la suya', () => {
    /* Dos corridas en la misma hora que compartieran traza no se podrían
       separar, que es justo cuando hace falta separarlas. */
    const trazas = new Set(Array.from({ length: 50 }, () => correlacionDeTrabajo()))
    expect(trazas.size).toBe(50)
  })

  it('con la misma forma que la del navegador', () => {
    /* Dos formas serían dos trazas, y la validación del registro rechazaría una. */
    const t = correlacionDeTrabajo()
    expect(t).toMatch(FORMA_CORRELACION)
    expect(esCorrelacionValida(t)).toBe(true)
  })

  it('los CINCO crons la acuñan, no tres', () => {
    /**
     * El que evita el arreglo a medias — que es la forma en que este árbol pierde
     * las reparaciones (REG-410, REG-411).
     */
    for (const job of CRONS) {
      expect(fuente(job), `${job} no acuña traza`).toMatch(/const correlacion = correlacionDeTrabajo\(\)/)
    }
  })

  it('y la pasan a TODOS sus latidos, también al del error', () => {
    /**
     * El latido del `catch` es el que más importa: es el de la corrida que falló,
     * y es la que alguien va a querer seguir.
     */
    for (const job of CRONS) {
      const src = fuente(job)
      const llamadas = [...src.matchAll(/registrarLatido\([^)]*/g)].map(m => m[0])
      expect(llamadas.length, `${job} sin latidos`).toBeGreaterThanOrEqual(2)
      for (const l of llamadas) {
        expect(l, `${job}: un latido sin traza → ${l.slice(0, 70)}`).toContain('correlacion')
      }
    }
  })

  it('el latido la valida antes de escribirla', () => {
    /* La forma es la defensa: lo que no la tenga no entra a un registro. */
    expect(LATIDO).toMatch(/esCorrelacionValida\(datos\.correlacion\)/)
  })

  it('la razón está escrita donde se va a leer', () => {
    expect(POR_QUE_UN_TRABAJO_NO_ACEPTA_LA_QUE_LE_MANDEN).toMatch(/quien tenga su secreto/)
    expect(POR_QUE_UN_TRABAJO_NO_ACEPTA_LA_QUE_LE_MANDEN).toMatch(/nace del reloj/)
  })
})

describe('la traza cruza al proveedor', () => {
  it('va como CABECERA, no en el cuerpo', () => {
    /**
     * El cuerpo lleva PHI minimizada y es lo que el proveedor procesa; una
     * cabecera opaca es inerte.
     */
    expect(GATEWAY).toMatch(/\[CABECERA_CORRELACION\]: ctx\.correlacion/)
    expect(GATEWAY).not.toMatch(/correlacion.*JSON\.stringify|body:.*correlacion/)
  })

  it('y es LA MISMA que va al asiento, no una nueva', () => {
    /**
     * Una traza que cambia al cruzar la frontera no correlaciona nada: el
     * proveedor tendría un identificador que no existe en nuestro libro.
     */
    const iFetch = GATEWAY.indexOf('fetchConTimeout(URL[o.proveedor]')
    /* De la llamada hasta su cierre: la cabecera va DESPUÉS del `fetchConTimeout(`. */
    const bloque = GATEWAY.slice(iFetch, iFetch + 1600)
    expect(bloque).toMatch(/ctx\.correlacion/)
    expect(bloque).not.toMatch(/nuevaCorrelacion\(\)/)
  })

  it('se valida antes de mandarla', () => {
    /* Lo que no tenga la forma no sale de aquí: una cabecera es un sitio donde
       podría colarse PHI si se copiara sin mirar. */
    expect(GATEWAY).toMatch(/esCorrelacionValida\(ctx\.correlacion\)/)
  })

  it('sin traza NO manda una cabecera vacía', () => {
    /**
     * `x-correlacion: ` vacía es peor que ausente: parece una traza y no lo es, y
     * del otro lado se registra como cadena en blanco.
     */
    expect(GATEWAY).toMatch(/\.\.\.\(esCorrelacionValida\(ctx\.correlacion\) \? \{ \[CABECERA_CORRELACION\]/)
  })

  it('el nombre de la cabecera sale del módulo, no escrito a mano', () => {
    /* Dos nombres serían dos trazas — lo dice el propio módulo. */
    expect(CABECERA_CORRELACION).toBe('x-correlacion')
    expect(GATEWAY).toContain('CABECERA_CORRELACION')
    expect(GATEWAY).not.toMatch(/'x-correlacion'/)
  })
})
