/**
 * GOLDEN — conectar WhatsApp no deja la función colgada del proveedor.
 *
 * ── CÓMO SE LLEGÓ AQUÍ ──────────────────────────────────────────────────────
 *
 * Comprobando una afirmación del propio repositorio. La cabecera de
 * `lib/fetch-con-timeout.ts` dice que nació porque «los envíos de WhatsApp,
 * igual: cinco `fetch` sin timeout dentro de un cron que recorre todos los
 * consultorios en serie».
 *
 * Verificado: `lib/whatsapp-send.ts` usa el helper en **5 de 5**. La afirmación
 * era cierta y el arreglo llegó.
 *
 * Pero el mismo barrido encontró **siete `fetch` crudos** a la API de Meta en
 * los caminos de CONEXIÓN: seis en `meta-connect` y uno en `manual-connect`.
 * Se había protegido el ENVÍO y no la CONEXIÓN.
 *
 * ── POR QUÉ NO ES SÓLO UNA FACTURA ──────────────────────────────────────────
 *
 * La cabecera de aquel módulo argumenta con el coste: «un socket colgado del
 * proveedor inmoviliza el lambda los 300 segundos completos, facturados por
 * GB-segundo». Cierto, y no es lo peor.
 *
 * El médico que conecta su WhatsApp pulsa el botón y **lo ve girar minutos**,
 * porque su petición espera a esta ruta, que espera a Meta. Es la misma familia
 * que el «Guardando…» eterno de la unidad 37: ni error, ni éxito, ni nada que
 * hacer. `setConnecting(false)` está escrito en `configuracion`, y bien, y no
 * llega a correr hasta que el servidor conteste.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Toda llamada a un proveedor externo lleva tiempo máximo, y «se tardó» se
 * contesta distinto de «falló»: con `TiempoAgotado` y un 504, quien lo lee sabe
 * que puede reintentar y que **no se cambió nada** — que es la diferencia entre
 * volver a intentarlo y ponerse a revisar credenciales que están bien.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo un `fetch(` crudo a cualquiera de las dos rutas, cae. Quitando la
 * rama de `TiempoAgotado`, cae el caso del 504.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Escáner de fuente: no llama a Meta ni simula un socket colgado. Que el
 *   helper aborte de verdad lo cubre `ops-timeout-y-punto-ciego`, que en este
 *   entorno falla por red (necesita una IP que trague paquetes) e igual en
 *   `main`.
 * · No barre el resto de integraciones del servidor (Google Calendar, Stripe).
 *   Este carril ha mirado el camino de WhatsApp y **no declara buenos los
 *   otros**.
 * · No juzga el valor del tiempo máximo, que lo pone el helper por omisión.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const RUTAS = [
  'src/app/api/whatsapp/meta-connect/route.ts',
  'src/app/api/whatsapp/manual-connect/route.ts',
]

const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('el barrido encuentra código de verdad', () => {
  it('las rutas existen y llaman a la API de Meta', () => {
    for (const r of RUTAS) {
      const s = readFileSync(r, 'utf8')
      expect(s.length, r).toBeGreaterThan(500)
      expect(s, r).toContain('graph.facebook.com')
    }
  })
})

describe('conectar WhatsApp no cuelga la función', () => {
  it('ninguna llamada al proveedor se hace con fetch crudo', () => {
    for (const r of RUTAS) {
      const cuerpo = sinComentarios(readFileSync(r, 'utf8'))
      const crudos = [...cuerpo.matchAll(/(?<![A-Za-z])fetch\(/g)]
      expect(crudos.length, `${r} tiene ${crudos.length} fetch sin tiempo máximo`).toBe(0)
      expect(cuerpo, r).toContain('fetchConTimeout(')
    }
  })

  it('«se tardó» se contesta distinto de «falló»', () => {
    for (const r of RUTAS) {
      const cuerpo = sinComentarios(readFileSync(r, 'utf8'))
      expect(cuerpo, r).toContain('instanceof TiempoAgotado')
      expect(cuerpo, r).toContain('504')
      // Y dice que no se cambió nada: es lo que decide si se reintenta.
      expect(cuerpo, r).toMatch(/No se cambió nada/)
    }
  })

  it('el ENVÍO, que ya estaba protegido, lo sigue estando', () => {
    // Lo que motivó el módulo. Si esto se rompiera al arreglar la conexión,
    // habríamos cambiado un agujero por otro.
    const envio = sinComentarios(readFileSync('src/lib/whatsapp-send.ts', 'utf8'))
    expect([...envio.matchAll(/(?<![A-Za-z])fetch\(/g)].length).toBe(0)
    expect([...envio.matchAll(/fetchConTimeout\(/g)].length).toBeGreaterThanOrEqual(5)
  })
})
