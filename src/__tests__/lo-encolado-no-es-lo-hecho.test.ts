/**
 * GOLDEN — contrapresión donde hace falta, y ninguna cola donde haría daño.
 *
 * ── QUÉ FALTABA, Y QUÉ NO ───────────────────────────────────────────────────
 *
 * El censo del programa decía «ninguna cola, contrapresión ni dead-letter». Al
 * medirlo resultó **inexacto en dos tercios**, y conviene decirlo antes que nada
 * porque un hueco exagerado manda a rehacer lo hecho:
 *
 *  · `whatsapp/outbox.ts` — reintento con retroceso y **dead-letter**, drenado
 *    por el cron de recordatorios.
 *  · `expediente/audit-log.ts` — cola durable, **acotada** a 50, con tope de
 *    reintentos, **por uid**, drenada antes de cerrar sesión y **contada en
 *    pantalla**.
 *
 * Lo que de verdad faltaba era **contrapresión**, que es otro problema: el
 * interruptor de circuito (REG-353) cubre un proveedor **caído** —falla rápido en
 * vez de que la llamada 60 espere lo mismo que las 59 anteriores—, y no cubre uno
 * **lento**. Ahí cada llamada acaba contestando, el circuito nunca se abre, y se
 * acumulan peticiones en vuelo ocupando cada una su función. El precedente está
 * en este repositorio: un socket colgado inmovilizó una lambda de 300 s, y la
 * ruta de la nota corre en **800**.
 *
 * ── LA DECISIÓN QUE ESTE GOLDEN PROTEGE ─────────────────────────────────────
 *
 * **Bajo saturación se RECHAZA, no se encola.**
 *
 * Una nota que el médico está esperando, metida detrás de otras cincuenta, es una
 * espera sin fondo con el paciente enfrente: la pantalla diría «procesando» y no
 * habría nada procesándose. La regla del programa lo dice en una línea —*una
 * operación clínica nunca puede aparecer como completada si sólo quedó
 * encolada*— y de ahí sale toda la clasificación de
 * `ops/lo-sincrono-y-lo-encolado.ts`.
 *
 * ── EL DEFECTO CLÁSICO DE UN CONTADOR ASÍ ───────────────────────────────────
 *
 * Soltar el sitio sólo en el camino de éxito. El contador sube para siempre y, al
 * cabo de un rato, la instancia rechaza **todo** sin que haya nada en vuelo: la
 * defensa se convierte en la caída total. Tiene su propio caso, y el `finally`
 * del gateway tiene el suyo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El tope es por instancia**, no global. Con N instancias calientes el tope
 *   efectivo es N×TOPE. Hacerlo global costaría una lectura compartida en el
 *   camino de una nota. Declarado, no disimulado.
 * · **No prueba el outbox de WhatsApp ni la bitácora**: los prueban los suyos.
 *   Aquí se comprueba que la CLASIFICACIÓN los reconoce y no los reinventa.
 * · **No mide latencia real bajo carga.** Que ocho en vuelo sea el número
 *   correcto para un consultorio es una hipótesis de operación, no un hallazgo.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  pedirSitio, soltarSitio, reiniciarContrapresion, enVueloAhora,
  claveDeContrapresion, EN_VUELO_MAXIMO, POR_QUE_NO_SE_ENCOLA, POR_QUE_POR_INSTANCIA,
} from '@/lib/ia/contrapresion'
import {
  OPERACIONES, sincronas, REGLA, POR_QUE_NO_SE_ENCOLA_LA_NOTA,
} from '@/lib/ops/lo-sincrono-y-lo-encolado'

const CLAVE = claveDeContrapresion('anthropic')

beforeEach(() => reiniciarContrapresion())

describe('la contrapresión admite hasta el tope y luego dice que no', () => {
  it('las primeras pasan', () => {
    for (let i = 1; i <= EN_VUELO_MAXIMO; i += 1) {
      const a = pedirSitio(CLAVE)
      expect(a.pasa, `la petición ${i} debería pasar`).toBe(true)
      expect(a.enVuelo).toBe(i)
    }
  })

  it('y la siguiente NO — con el conteo, para poder decirlo', () => {
    for (let i = 0; i < EN_VUELO_MAXIMO; i += 1) pedirSitio(CLAVE)
    const a = pedirSitio(CLAVE)
    expect(a.pasa).toBe(false)
    expect(a.enVuelo).toBe(EN_VUELO_MAXIMO)
  })

  it('rechazar NO ocupa sitio: la saturación no se agrava sola', () => {
    /* Un contador que sumara también al rechazar convertiría un pico en una
       caída permanente. */
    for (let i = 0; i < EN_VUELO_MAXIMO; i += 1) pedirSitio(CLAVE)
    for (let i = 0; i < 20; i += 1) pedirSitio(CLAVE)
    expect(enVueloAhora(CLAVE)).toBe(EN_VUELO_MAXIMO)
  })

  it('al soltar, vuelve a haber sitio', () => {
    for (let i = 0; i < EN_VUELO_MAXIMO; i += 1) pedirSitio(CLAVE)
    expect(pedirSitio(CLAVE).pasa).toBe(false)
    soltarSitio(CLAVE)
    expect(pedirSitio(CLAVE).pasa).toBe(true)
  })

  it('AL REVÉS: si no se soltara, la instancia se cerraría para siempre', () => {
    /**
     * El defecto clásico de todo contador así, reproducido: se piden ocho y no se
     * suelta ninguna. A partir de ahí rechaza TODO aunque no haya nada en vuelo
     * — la defensa convertida en la caída total. Es la razón de que el gateway
     * suelte en `finally` y de que exista el caso siguiente.
     */
    for (let i = 0; i < EN_VUELO_MAXIMO; i += 1) pedirSitio(CLAVE)
    for (let i = 0; i < 100; i += 1) expect(pedirSitio(CLAVE).pasa).toBe(false)
    expect(enVueloAhora(CLAVE)).toBe(EN_VUELO_MAXIMO)
  })

  it('soltar de más no deja el contador en negativo', () => {
    /* Un contador negativo daría sitio de más justo cuando peor viene. */
    soltarSitio(CLAVE); soltarSitio(CLAVE)
    expect(enVueloAhora(CLAVE)).toBe(0)
    for (let i = 0; i < EN_VUELO_MAXIMO; i += 1) expect(pedirSitio(CLAVE).pasa).toBe(true)
    expect(pedirSitio(CLAVE).pasa).toBe(false)
  })

  it('un proveedor lento no cierra al otro', () => {
    /* Si la clave fuera global, que Anthropic vaya lento apagaría OpenAI y una
       defensa se habría convertido en una caída más grande. */
    const otra = claveDeContrapresion('openai')
    for (let i = 0; i < EN_VUELO_MAXIMO; i += 1) pedirSitio(CLAVE)
    expect(pedirSitio(CLAVE).pasa).toBe(false)
    expect(pedirSitio(otra).pasa).toBe(true)
  })
})

describe('el gateway suelta el sitio SIEMPRE, también al fallar', () => {
  const gateway = readFileSync('src/lib/ia/gateway.ts', 'utf8')

  it('la admisión va después de reservar y devuelve los créditos al rechazar', () => {
    /* Cobrarle una nota que ni se intentó le hace perder dos veces: el crédito y
       la confianza en el contador. Mismo razonamiento que el interruptor. */
    const i = gateway.indexOf('const sitio = pedirSitio(claveCp)')
    expect(i).toBeGreaterThan(gateway.indexOf('reservarParaClinica'))
    const bloque = gateway.slice(i, i + 700)
    expect(bloque).toMatch(/devolverCreditos\(reserva\)/)
  })

  it('y el `finally` la suelta', () => {
    expect(gateway).toMatch(/finally \{[\s\S]{0,700}soltarSitio\(claveCp\)/)
  })

  it('el mensaje dice qué pasa y qué hacer, sin culpar al médico', () => {
    /* «Error» a secas manda a alguien a revisar su internet o su tarjeta. */
    expect(gateway).toMatch(/peticiones en curso y no puedo atender otra/)
    expect(gateway).toMatch(/Vuelve a intentarlo en unos segundos/)
  })
})

describe('qué se desacopla y qué no — la política, comprobable', () => {
  it('la nota, la firma, la receta y la orden son SÍNCRONAS', () => {
    const nombres = sincronas().map(o => o.nombre.toLowerCase()).join(' | ')
    for (const imprescindible of ['nota', 'firmar', 'receta', 'orden']) {
      expect(nombres, `«${imprescindible}» debería estar entre las síncronas`).toContain(imprescindible)
    }
  })

  it('la llamada de IA NO se encola, y su razón lo dice', () => {
    /**
     * Éste es el caso que impide el atajo. Si alguien reclasificara la llamada de
     * IA como `encolada_durable` «para cumplir el requisito de colas», estaría
     * construyendo justo la espera sin fondo que la regla prohíbe.
     */
    const ia = OPERACIONES.find(o => o.nombre.startsWith('Llamada de IA'))
    expect(ia?.modo).toBe('mejor_esfuerzo_declarado')
    expect(ia?.porQue).toMatch(/NO se encola/)
  })

  it('lo que sí se encola es lo que nadie mira, y ya existía', () => {
    const durables = OPERACIONES.filter(o => o.modo === 'encolada_durable')
    expect(durables.length).toBeGreaterThanOrEqual(2)
    for (const d of durables) {
      expect(d.donde, `${d.nombre} no dice dónde vive`).toBeTruthy()
      expect(() => readFileSync(d.donde!, 'utf8'), `${d.donde} no existe`).not.toThrow()
    }
  })

  it('las dos colas que ya existían siguen teniendo lo que las hace colas', () => {
    /**
     * No se reinventan aquí, pero si alguien les quitara el dead-letter o el tope
     * dejarían de proteger y esta clasificación estaría mintiendo.
     */
    const outbox = readFileSync('src/lib/whatsapp/outbox.ts', 'utf8')
    expect(outbox).toMatch(/muerto/)          // dead-letter
    expect(outbox).toMatch(/proximoIntentoISO/)  // retroceso
    const auditoria = readFileSync('src/lib/expediente/audit-log.ts', 'utf8')
    expect(auditoria).toMatch(/TOPE_COLA/)       // acotada
    expect(auditoria).toMatch(/p\.intentos < 5/) // tope de reintentos
  })

  it('cada operación explica POR QUÉ está donde está', () => {
    for (const o of OPERACIONES) {
      expect(o.porQue.length, `${o.nombre} no explica su modo`).toBeGreaterThan(60)
    }
  })

  it('la regla está escrita, y es la que gobierna todo lo demás', () => {
    expect(REGLA).toMatch(/nunca puede aparecer como completada si sólo quedó\s+encolada/)
    expect(POR_QUE_NO_SE_ENCOLA_LA_NOTA).toMatch(/paciente enfrente/)
    expect(POR_QUE_NO_SE_ENCOLA).toMatch(/espera sin fondo/)
    expect(POR_QUE_POR_INSTANCIA).toMatch(/N×TOPE/)
  })
})
