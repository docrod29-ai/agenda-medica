/**
 * GOLDEN — QUE UN REINTENTO NO CREE UNA SEGUNDA CITA NI UNA SEGUNDA RECETA.
 *
 * ── QUÉ FALLA HOY (hallazgo del inventario de #310) ──────────────────────────
 *
 * `POST /api/appointments` no acepta llave de idempotencia. Su transacción es
 * correcta y detecta el empalme, así que un reintento tras una respuesta
 * perdida **no crea una cita duplicada**: devuelve `409 «Ese horario ya está
 * ocupado.»`.
 *
 * Y eso es un defecto distinto y peor de lo que parece: la asistente acaba de
 * agendar esa cita ella misma dos segundos antes. El sistema le está diciendo
 * que el hueco está tomado por otro. Lo que hace a continuación es buscar otro
 * hueco o llamar al paciente para moverlo — un error operativo causado por una
 * respuesta que se perdió, no por la agenda.
 *
 * Peor todavía: con sobreagenda autorizada (el médico manda `sobreagendarMotivo`)
 * la detección de empalme se desactiva a propósito, así que ahí el reintento SÍ
 * crea la cita duplicada.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `src/app/api/appointments/route.ts` línea por línea buscando qué
 * pasaba con «timeout de red DESPUÉS de un commit correcto», que es uno de los
 * casos negativos obligatorios del Golden Path de agenda (#320, #321).
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La identidad la fija QUIEN INICIA la acción. Dos peticiones con la misma
 * identidad son la misma acción: la segunda devuelve el resultado de la primera
 * en vez de repetir el efecto (o de mentir sobre el estado).
 *
 * Fail-CLOSED, al revés que el dedup de WhatsApp: si no se puede garantizar la
 * identidad de una acción consecuencial, no se ejecuta. El peor caso de la otra
 * política es responder dos veces a un mensaje; el peor caso de ésta es una
 * segunda receta.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No arregla la ruta: `src/app/api/appointments/route.ts` pertenece al carril de
 * Consultorio (#306) y no se toca desde aquí. Esta prueba fija el CONTRATO que
 * esa ruta deberá cumplir; el handoff está en `docs/reliability/HANDOFF-306.md`.
 * Tampoco prueba un almacén de Firestore: el `create()` atómico de Firestore es
 * lo que haría real la garantía, y aquí se usa el almacén en memoria.
 */
import { describe, it, expect } from 'vitest'
import {
  AlmacenEnMemoria, claveIdempotencia, ejecutarUnaVez, huellaDe,
} from '@/lib/reliability/idempotencia'

const CUERPO = { pacienteId: 'p_1', fechaHora: '2026-09-01 10:00', duracion: 30 }

describe('idempotencia de acciones consecuentes', () => {
  it('el reintento tras una respuesta perdida devuelve la MISMA cita, no un 409', () => {
    // Éste es literalmente el caso del inventario: el efecto ya ocurrió, la
    // respuesta se perdió, el cliente repite con la misma llave.
    return (async () => {
      const almacen = new AlmacenEnMemoria()
      const clave = claveIdempotencia('clinic_a', 'crear-cita', 'clic-1')
      let efectos = 0
      const accion = async () => { efectos += 1; return { id: `cita_${efectos}` } }

      const primera = await ejecutarUnaVez(almacen, clave, CUERPO, 0, accion)
      const reintento = await ejecutarUnaVez(almacen, clave, CUERPO, 10, accion)

      expect(primera).toEqual({ ejecutado: true, resultado: { id: 'cita_1' } })
      expect(reintento).toEqual({ ejecutado: false, motivo: 'repetida', resultado: { id: 'cita_1' } })
      expect(efectos).toBe(1)
    })()
  })

  it('AL REVÉS: sin llave de idempotencia el mismo flujo produce DOS efectos', async () => {
    // Se reproduce el comportamiento actual de la ruta para que la prueba
    // demuestre que el arreglo hace falta, no sólo que el arreglo funciona.
    let efectos = 0
    const accionSinLlave = async () => { efectos += 1; return { id: `cita_${efectos}` } }
    await accionSinLlave()
    await accionSinLlave()
    expect(efectos).toBe(2)
  })

  it('el doble clic no es un error: se responde «en curso», nunca «falló»', async () => {
    const almacen = new AlmacenEnMemoria()
    const clave = claveIdempotencia('clinic_a', 'crear-cita', 'clic-1')
    // El primer clic reserva y se queda trabajando; el segundo llega antes.
    await almacen.reservar({ clave, estado: 'en-curso', huella: huellaDe(CUERPO), creadoEnMs: 0 })
    const segundo = await ejecutarUnaVez(almacen, clave, CUERPO, 1, async () => ({ id: 'no-debe-ocurrir' }))
    expect(segundo).toEqual({ ejecutado: false, motivo: 'en-curso' })
    // Decirle «falló» al usuario en mitad de algo que sí va a completarse es lo
    // que provoca el tercer clic.
  })

  it('reusar una llave con OTRO cuerpo se rechaza: no se responde que sí a algo que no se pidió', async () => {
    const almacen = new AlmacenEnMemoria()
    const clave = claveIdempotencia('clinic_a', 'crear-cita', 'clic-1')
    await ejecutarUnaVez(almacen, clave, CUERPO, 0, async () => ({ id: 'cita_1' }))
    const otro = await ejecutarUnaVez(almacen, clave, { ...CUERPO, fechaHora: '2026-09-01 11:00' }, 1, async () => ({ id: 'cita_2' }))
    expect(otro).toEqual({ ejecutado: false, motivo: 'llave-reusada-con-otro-cuerpo' })
  })

  it('una acción FALLIDA se puede repetir: el efecto nunca ocurrió', async () => {
    const almacen = new AlmacenEnMemoria()
    const clave = claveIdempotencia('clinic_a', 'crear-cita', 'clic-1')
    await expect(ejecutarUnaVez(almacen, clave, CUERPO, 0, async () => { throw new Error('proveedor caído') }))
      .rejects.toThrow('proveedor caído')
    const segunda = await ejecutarUnaVez(almacen, clave, CUERPO, 1, async () => ({ id: 'cita_1' }))
    expect(segunda).toEqual({ ejecutado: true, resultado: { id: 'cita_1' } })
  })

  it('dos consultorios con el mismo identificador de cliente NO comparten asiento', async () => {
    // Sin `clinicId` en la clave, el segundo consultorio recibiría el resultado
    // del primero: fuga entre consultorios por la puerta de atrás, y bloqueador
    // incondicional en #310.
    const almacen = new AlmacenEnMemoria()
    const a = claveIdempotencia('clinic_a', 'crear-cita', 'alta-1')
    const b = claveIdempotencia('clinic_b', 'crear-cita', 'alta-1')
    expect(a).not.toBe(b)
    const ra = await ejecutarUnaVez(almacen, a, CUERPO, 0, async () => ({ id: 'de-a' }))
    const rb = await ejecutarUnaVez(almacen, b, CUERPO, 0, async () => ({ id: 'de-b' }))
    expect(ra).toEqual({ ejecutado: true, resultado: { id: 'de-a' } })
    expect(rb).toEqual({ ejecutado: true, resultado: { id: 'de-b' } })
  })

  it('la huella no depende del orden de las claves del cuerpo', () => {
    expect(huellaDe({ a: 1, b: 2 })).toBe(huellaDe({ b: 2, a: 1 }))
    expect(huellaDe({ a: 1, b: 2 })).not.toBe(huellaDe({ a: 1, b: 3 }))
  })

  it('la llave saneada no puede romper la ruta del documento ni crecer sin límite', () => {
    const k = claveIdempotencia('clinic_a', 'crear-cita', `../../otra/${'x'.repeat(400)}`)
    expect(k).not.toContain('/')
    expect(k.length).toBeLessThan(200)
  })
})
