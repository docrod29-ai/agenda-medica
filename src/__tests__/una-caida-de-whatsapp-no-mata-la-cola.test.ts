/**
 * GOLDEN — una caída del proveedor no puede matar la cola de recordatorios.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El outbox de WhatsApp cuenta **intentos del mensaje** y a los cinco lo manda
 * al dead-letter. Contaba igual dos cosas que no se parecen en nada:
 *
 *  · «este teléfono está mal escrito» — es del mensaje, y a los cinco intentos
 *    rendirse es lo correcto;
 *  · «Meta devuelve 503» — no es del mensaje. El mensaje está perfecto.
 *
 * Con el cron cada hora (`vercel.json`) y cinco intentos, **cinco horas de caída
 * del proveedor mataban toda la cola**. Y lo mataban en silencio: la entrada
 * quedaba en `muerto` con la palabra «agotó reintentos», que manda a mirar el
 * mensaje, que es justo donde no estaba el problema. Avisos de lista de espera
 * que nadie mandó, huecos de agenda que nadie ocupó, y desde fuera el sistema
 * hizo exactamente lo que dice hacer.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Cerrando `WS-04.interruptor-otros` del censo del programa, que sólo pedía
 * «poner WhatsApp y Evidence bajo el mismo interruptor». Al mirar qué haría el
 * interruptor con el outbox apareció que el interruptor, solo, **habría
 * empeorado las cosas**: al fallar rápido, las cinco horas se habrían convertido
 * en cinco minutos. La cola se habría muerto antes.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Una sola cuenta para dos hechos distintos. `intentos` era «veces que se probó
 * este mensaje» y también «veces que pasó algo». Un intento que se estrelló
 * contra un proveedor ausente **no es un intento del mensaje**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Dos cuentas: `intentos` (del mensaje) y `pausas` (del proveedor). Un fallo del
 * proveedor pausa y no gasta. Las pausas también están acotadas —una cola que
 * nunca se rinde es la otra forma de perder un mensaje, sólo que más lenta— y
 * cuando una entrada muere, **dice de qué murió**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba la red.** El proveedor es un doble; lo que se ejercita es la
 *   decisión y la puerta, que es donde vivía el defecto.
 * · **No hay quien lea el dead-letter.** Las entradas muertas quedan en
 *   Firestore con su motivo y **ninguna pantalla las enseña**. Se deja dicho:
 *   esta prueba arregla que mueran mal, no que nadie las mire.
 * · **`fetch` de Node lanza `TypeError` para casi todo fallo de red**, así que
 *   la traducción de excepciones se queda corta a propósito (ver
 *   `fallo-del-proveedor.ts`): da por «no es del proveedor» cosas que sí lo son.
 *   Señala de menos. El 5xx y el tiempo agotado, que son la mayoría de una
 *   caída real, sí se reconocen.
 * · **El interruptor es por instancia**, como el de la IA. Con N instancias
 *   calientes, N primeras llamadas pagan su timeout.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  veredictoDeRespuestaWA, veredictoDeExcepcionWA, claveCircuitoWA,
  POR_QUE_UNA_CAIDA_NO_GASTA_REINTENTOS,
} from '@/lib/whatsapp/fallo-del-proveedor'
import {
  decidirReprogramacion, PAUSAS_MAXIMAS, MAX_INTENTOS,
} from '@/lib/whatsapp/reintentos'
import { olvidarCircuitos } from '@/lib/red/interruptor'
import { TiempoAgotado } from '@/lib/fetch-con-timeout'

const T0 = 1_800_000_000_000

describe('qué dice «el proveedor no está» y qué no', () => {
  it('un 5xx sí', () => {
    for (const s of [500, 502, 503, 504, 529]) {
      expect(veredictoDeRespuestaWA(s), `${s}`).toBe('el_proveedor_no_esta')
    }
  })

  it('el tiempo agotado también', () => {
    expect(veredictoDeExcepcionWA(new TiempoAgotado(10_000, 'graph.facebook.com')))
      .toBe('el_proveedor_no_esta')
  })

  it('una credencial caducada NO — o un consultorio apagaría a los demás', () => {
    /**
     * El mismo aislamiento que en la IA: el token de WhatsApp es del
     * consultorio. Si un 401 abriera el circuito, el consultorio que dejó
     * caducar su token dejaría sin recordatorios a todos los demás.
     */
    for (const s of [401, 403]) expect(veredictoDeRespuestaWA(s)).toBe('no_dice_nada_del_proveedor')
  })

  it('ni un 429, ni un teléfono mal escrito, ni una plantilla no aprobada', () => {
    for (const s of [400, 404, 429, 470]) {
      expect(veredictoDeRespuestaWA(s), `${s}`).toBe('no_dice_nada_del_proveedor')
    }
  })

  it('y el circuito de un consultorio no es el de otro, ni el de la plataforma', () => {
    expect(claveCircuitoWA('meta', true, 'c1')).not.toBe(claveCircuitoWA('meta', true, 'c2'))
    expect(claveCircuitoWA('meta', true, 'c1')).not.toBe(claveCircuitoWA('meta', false, 'c1'))
    /* Y dos proveedores distintos tampoco comparten circuito. */
    expect(claveCircuitoWA('meta', false, 'c1')).not.toBe(claveCircuitoWA('360dialog', false, 'c1'))
  })
})

describe('una caída del proveedor NO gasta el presupuesto del mensaje', () => {
  it('AL REVÉS: así moría la cola antes — cinco caídas y al dead-letter', () => {
    /**
     * Reproducción del defecto. `esDelProveedor = false` es exactamente lo que
     * hacía el código anterior con TODO fallo. A los cinco, muerto.
     */
    let e = { intentos: 0, pausas: 0 }
    for (let i = 0; i < MAX_INTENTOS - 1; i += 1) {
      const d = decidirReprogramacion(e, false, T0)
      expect(d.accion).toBe('reintentar')
      if (d.accion === 'reintentar') e = { intentos: d.intentos, pausas: 0 }
    }
    const ultimo = decidirReprogramacion(e, false, T0)
    expect(ultimo.accion).toBe('dead-letter')
  })

  it('y así NO muere: cincuenta caídas seguidas y el mensaje sigue vivo', () => {
    let e = { intentos: 0, pausas: 0 }
    for (let i = 0; i < 50; i += 1) {
      const d = decidirReprogramacion(e, true, T0)
      expect(d.accion, `pasada ${i}`).toBe('pausar')
      if (d.accion === 'pausar') e = { intentos: e.intentos, pausas: d.pausas }
    }
    expect(e.intentos, 'una caída del proveedor no puede gastar intentos del mensaje').toBe(0)
  })

  it('el reintento del mensaje sigue funcionando igual que antes', () => {
    /* La corrección no puede volver inmortal a un mensaje que sí está mal. */
    const d = decidirReprogramacion({ intentos: 1, pausas: 40 }, false, T0)
    expect(d.accion).toBe('reintentar')
    if (d.accion === 'reintentar') expect(d.intentos).toBe(2)
  })

  it('las pausas están acotadas: una cola que nunca se rinde también pierde', () => {
    const d = decidirReprogramacion({ intentos: 1, pausas: PAUSAS_MAXIMAS - 1 }, true, T0)
    expect(d.accion).toBe('dead-letter')
  })

  it('y al morir dice de QUÉ murió — las dos frases mandan a mirar sitios distintos', () => {
    const porProveedor = decidirReprogramacion({ intentos: 1, pausas: PAUSAS_MAXIMAS - 1 }, true, T0)
    const porElMensaje = decidirReprogramacion({ intentos: MAX_INTENTOS - 1, pausas: 0 }, false, T0)
    expect(porProveedor.accion === 'dead-letter' && porProveedor.porQue).toBe('proveedor_caido')
    expect(porElMensaje.accion === 'dead-letter' && porElMensaje.porQue).toBe('reintentos_agotados')
  })

  it('la pausa reprograma cerca, no dentro de la misma pasada', () => {
    const d = decidirReprogramacion({ intentos: 1, pausas: 0 }, true, T0)
    expect(d.accion).toBe('pausar')
    if (d.accion === 'pausar') {
      const cuando = Date.parse(d.proximoIntentoAt)
      expect(cuando).toBeGreaterThan(T0)
      expect(cuando - T0, 'una pausa larga retrasaría el aviso cuando el proveedor ya volvió')
        .toBeLessThanOrEqual(60 * 60 * 1000)
    }
  })
})

/* ── La puerta, ejercitada de verdad ──────────────────────────────────────── */

const llamadas = vi.hoisted(() => ({ n: 0, responder: () => new Response('x', { status: 503 }) }))

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => { throw new Error('sin Firestore en esta prueba') } },
}))
vi.mock('@/lib/whatsapp/consent', () => ({
  estaDadoDeBaja: async () => false,
  conPieOptout: (t: string) => t,
  normalizarTelefonoWa: (t: string) => t,
}))
vi.mock('@/lib/whatsapp/secreto-canal', () => ({ conSecretoCanal: async () => undefined }))

describe('el interruptor deja de llamar a un proveedor caído', () => {
  const ANTES = { ...process.env }

  beforeEach(() => {
    olvidarCircuitos()
    llamadas.n = 0
    llamadas.responder = () => new Response('x', { status: 503 })
    process.env.WHATSAPP_PROVIDER = 'meta'
    process.env.WHATSAPP_API_TOKEN = 'token-de-prueba'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
    vi.stubGlobal('fetch', async () => { llamadas.n += 1; return llamadas.responder() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    process.env.WHATSAPP_PROVIDER = ANTES.WHATSAPP_PROVIDER
    process.env.WHATSAPP_API_TOKEN = ANTES.WHATSAPP_API_TOKEN
    process.env.WHATSAPP_PHONE_NUMBER_ID = ANTES.WHATSAPP_PHONE_NUMBER_ID
  })

  it('tras tres 503 deja de llamar, y lo DICE en vez de inventarse un error', async () => {
    const { sendWhatsApp } = await import('@/lib/whatsapp-send')
    for (let i = 0; i < 3; i += 1) await sendWhatsApp('c1', '5215500000000', 'hola')
    expect(llamadas.n, 'los tres primeros sí se intentan').toBe(3)

    const cuarto = await sendWhatsApp('c1', '5215500000000', 'hola')
    expect(llamadas.n, 'el cuarto no debe salir a la red').toBe(3)
    expect(cuarto.ok).toBe(false)
    expect(cuarto.veredicto).toBe('el_proveedor_no_esta')
  })

  it('un 401 repetido NO cierra el circuito: es de quien llama', async () => {
    /**
     * Al revés del anterior, y es el caso que protege el aislamiento: con la
     * credencial mal puesta se sigue intentando, porque el proveedor está bien
     * y quien tiene que enterarse es ese consultorio, no los demás.
     */
    llamadas.responder = () => new Response('nope', { status: 401 })
    const { sendWhatsApp } = await import('@/lib/whatsapp-send')
    for (let i = 0; i < 6; i += 1) await sendWhatsApp('c1', '5215500000000', 'hola')
    expect(llamadas.n, 'ninguna llamada debió ahorrarse').toBe(6)
  })

  it('y el veredicto viaja con el resultado, no dentro del texto del error', async () => {
    /**
     * «El dato tiene que LLEGAR»: si el outbox tuviera que sacar esto de
     * «Meta 503: …» con una expresión regular, la supervivencia de un
     * recordatorio dependería del formato de un mensaje de registro.
     */
    const { sendWhatsApp } = await import('@/lib/whatsapp-send')
    const r = await sendWhatsApp('c1', '5215500000000', 'hola')
    expect(r.veredicto).toBe('el_proveedor_no_esta')
  })
})

describe('y el dato llega hasta donde se decide', () => {
  it('`enviarProactivo` devuelve el veredicto del envío', () => {
    const src = readFileSync('src/lib/whatsapp/proactivo.ts', 'utf8')
    expect(src).toMatch(/veredicto: r\.veredicto/)
  })

  it('el cron se lo pasa a `reprogramarEntrada` — que es quien cuenta', () => {
    /**
     * El eslabón que de verdad importa. Sin esta línea todo lo demás está
     * escrito y sin conectar: la traducción existiría, la decisión existiría, y
     * la cola se seguiría muriendo igual.
     */
    const src = readFileSync('src/app/api/cron/reminders/route.ts', 'utf8')
    expect(src).toMatch(/const \{ resultado, veredicto \}/)
    expect(src).toMatch(/reprogramarEntrada\([\s\S]{0,200}veredicto === 'el_proveedor_no_esta'/)
  })

  it('la razón está escrita donde se pueda leer', () => {
    expect(POR_QUE_UNA_CAIDA_NO_GASTA_REINTENTOS).toMatch(/dead-letter/)
    expect(POR_QUE_UNA_CAIDA_NO_GASTA_REINTENTOS).toMatch(/no es un intento del mensaje/)
  })
})
