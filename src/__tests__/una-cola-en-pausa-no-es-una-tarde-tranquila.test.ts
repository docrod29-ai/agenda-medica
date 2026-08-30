/**
 * GOLDEN — un aviso que no salió tiene que verse desde fuera.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-391 arregló algo y **abrió un hueco nuevo al arreglarlo**, que es la clase
 * de consecuencia que conviene escribir antes de que la encuentre otro:
 *
 * Antes, una caída del proveedor de WhatsApp gastaba los reintentos de cada
 * mensaje y a las cinco horas mataba la cola entera. Mal, pero **ruidoso**: los
 * mensajes acababan en dead-letter. Después de REG-391 la caída **pausa** las
 * entradas sin gastarles nada — que es lo correcto— y entonces la cola pausada
 * se ve desde fuera **exactamente igual que una tarde tranquila**:
 *
 *     cron reminders → ok, enviados: 0, fallidos: 0
 *
 * Nada parece roto. Y el dead-letter, que existe desde hace mucho, **no lo
 * enseña ninguna pantalla**: una entrada rendida queda en Firestore con su
 * motivo y ahí se acaba la historia.
 *
 * Las dos cosas son lo mismo para el paciente: un aviso de lista de espera que
 * nadie mandó es un hueco de agenda que nadie ocupó, y nadie se entera.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * **Una defensa que hace que un problema deje de verse necesita traer consigo la
 * forma de verlo.** Pausar en vez de morir sólo es mejor si alguien puede saber
 * que hay una pausa.
 *
 * ── POR QUÉ SE LEE DEL LATIDO Y NO SE RECORRE OTRA VEZ ──────────────────────
 *
 * El cron de recordatorios ya visita cada consultorio y ya cuenta. Recorrerlos
 * de nuevo desde el vigilante sería un segundo trabajo que vigilar, con su
 * propio coste de lecturas y su propia forma de quedarse atrás.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No es la pantalla que falta.** Un aviso dice «hay N rendidas»; no deja
 *   verlas, ni reintentarlas, ni saber de qué paciente eran. `TR-WHATSAPP.entrega`
 *   sigue PARTIAL por eso.
 * · **La cuenta de rendidas tiene tope** (50 por consultorio): por encima dice
 *   «al menos», no un número inventado.
 * · **No prueba el webhook**, que sigue sin destino configurado.
 * · **No cubre el mensaje reactivo del bot**, que no pasa por el outbox: si el
 *   proveedor está caído cuando el paciente escribe, esa respuesta se pierde y
 *   no queda en ninguna cola. Queda dicho, no arreglado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TOPE_CUENTA_MUERTAS } from '@/lib/whatsapp/outbox'

const CRON = readFileSync('src/app/api/cron/reminders/route.ts', 'utf8')
const VIGILANTE = readFileSync('src/app/api/cron/vigilante/route.ts', 'utf8')
const OUTBOX = readFileSync('src/lib/whatsapp/outbox.ts', 'utf8')

describe('el cron cuenta lo que NO salió, no sólo lo que salió', () => {
  it('cuenta las pausadas por caída del proveedor', () => {
    /**
     * AL REVÉS: sin esta cuenta, `sent: 0, failed: 0` es indistinguible de una
     * tarde sin citas — que es justo el estado en que quedó el sistema al
     * arreglar REG-391.
     */
    expect(CRON).toMatch(/if \(delProveedor\) totals\.pausadas\+\+/)
  })

  it('y cuenta las que ya se rindieron', () => {
    expect(CRON).toMatch(/totals\.muertas \+= \(await contarMuertas\(clinicId\)\)\.cuantas/)
  })

  it('las dos viajan en el latido, que es de donde las lee el vigilante', () => {
    /* «El dato tiene que LLEGAR»: contarlas y no ponerlas en el latido las
       dejaría muriendo dentro de la función que las cuenta. */
    const i = CRON.indexOf("registrarLatido('reminders'")
    expect(i).toBeGreaterThan(0)
    const bloque = CRON.slice(i, i + 500)
    expect(bloque).toContain('pausadas: totals.pausadas')
    expect(bloque).toContain('muertas: totals.muertas')
  })

  it('la cuenta de rendidas tiene tope y lo declara', () => {
    /* Un `get()` sin tope sobre una cola rota sería la lectura sin cota que el
       resto del programa persigue. Por encima del tope se dice «al menos». */
    expect(TOPE_CUENTA_MUERTAS).toBeGreaterThan(0)
    expect(TOPE_CUENTA_MUERTAS).toBeLessThanOrEqual(200)
    expect(OUTBOX).toMatch(/limit\(TOPE_CUENTA_MUERTAS \+ 1\)/)
    expect(OUTBOX).toMatch(/alMenos/)
  })

  it('y no poder contarlas NO se toma por «no hay»', () => {
    expect(OUTBOX).toMatch(/No poder contar NO es «no hay»/)
  })
})

describe('el vigilante avisa, y distingue las dos cosas', () => {
  it('avisa cuando hay pausadas o rendidas', () => {
    expect(VIGILANTE).toMatch(/if \(pausadas > 0 \|\| muertas > 0\)/)
    const i = VIGILANTE.indexOf('if (pausadas > 0 || muertas > 0)')
    expect(VIGILANTE.slice(i, i + 900)).toMatch(/enviarAlertaOps\(/)
  })

  it('una rendida es GRAVE y una pausa no', () => {
    /**
     * No es afinación: una pausa se arregla sola cuando el proveedor vuelve, y
     * una rendida **ya no se reintenta nunca**. Darles la misma gravedad
     * enseñaría a ignorar las dos.
     */
    expect(VIGILANTE).toMatch(/gravedad: muertas > 0 \? 'grave' : 'aviso'/)
  })

  it('el texto dice qué pasa con cada una, no sólo cuántas hay', () => {
    /* «3 avisos fallidos» no dice si hay que hacer algo. Uno se resuelve solo;
       el otro no se resuelve nunca sin que alguien mire. */
    expect(VIGILANTE).toMatch(/No han gastado reintentos y se vuelven a intentar solas/)
    expect(VIGILANTE).toMatch(/ya NO se reintentan: hay que mirarlas/)
  })

  it('lo lee del latido del cron, no recorriendo los consultorios otra vez', () => {
    expect(VIGILANTE).toMatch(/porJob\.get\('reminders'\)\?\.detalle/)
  })

  it('y sale en la respuesta del vigilante, para poder verlo sin webhook', () => {
    /* Mientras OPS_ALERTA_WEBHOOK siga sin configurar, la respuesta del cron es
       el único sitio donde esto se puede leer. */
    expect(VIGILANTE).toMatch(/cola: \{ pausadas, muertas \}/)
  })
})
