/**
 * GOLDEN — REINTENTAR SIN TORMENTA, Y DEJAR DE LLAMAR A LO QUE NO CONTESTA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Dos huecos encontrados inventariando el camino caliente para #310:
 *
 *  1. La única política de reintentos del repositorio
 *     (`src/lib/whatsapp/reintentos.ts`) **no tiene jitter**. Da igual para un
 *     cron en serie; a diez mil consultorios significa que todos reintentan en
 *     el mismo milisegundo tras una caída de proveedor y lo vuelven a tumbar.
 *  2. `src/lib/ia/gateway.ts` tiene tiempo máximo por llamada
 *     (`fetchConTimeout`) pero **no tiene cortacircuitos**: con el proveedor
 *     caído, cada consulta abierta espera sus 60 s completos antes de enterarse.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `gateway.ts` y `whatsapp/reintentos.ts` a la vez, buscando quién
 * decidía cuándo parar. Nadie lo decidía: cada sitio reintentaba a su manera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un fallo permanente no se reintenta NUNCA (un 401 no mejora repitiéndolo). El
 * presupuesto acota intentos Y tiempo total, y el que se agote primero manda. Y
 * el cortacircuitos vuelve por el estado MEDIO, con una sola llamada de prueba,
 * nunca reabriendo de golpe contra algo que sigue caído.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No prueba que el gateway ni ninguna ruta USEN estas primitivas: hoy no lo
 * hacen, y cablearlas toca archivos de #302/#303 (handoff documentado). Tampoco
 * prueba el comportamiento real de ningún proveedor: aquí no hay red.
 */
import { describe, it, expect } from 'vitest'
import {
  decidirReintento, esperaMs, veredictoDeHttp, POLITICA_POR_DEFECTO,
} from '@/lib/reliability/reintentos'
import {
  circuitoNuevo, permitirLlamada, registrarExito, registrarFallo, claveDeCircuito,
  CIRCUITO_POR_DEFECTO,
} from '@/lib/reliability/cortacircuitos'

/** Fuente de azar determinista: la prueba de un backoff aleatorio no puede ser aleatoria. */
const azarFijo = (v: number) => () => v

describe('presupuesto de reintentos', () => {
  it('un fallo permanente no se reintenta ni una vez', () => {
    const d = decidirReintento({ intentos: 1, gastadoMs: 0 }, 'permanente')
    expect(d).toEqual({ reintentar: false, motivo: 'permanente' })
  })

  it('los intentos se agotan en el número declarado y ni uno más', () => {
    const p = { ...POLITICA_POR_DEFECTO, reintentosMaximos: 2 }
    expect(decidirReintento({ intentos: 2, gastadoMs: 0 }, 'transitorio', p, azarFijo(0.5)).reintentar).toBe(true)
    expect(decidirReintento({ intentos: 3, gastadoMs: 0 }, 'transitorio', p, azarFijo(0.5)))
      .toEqual({ reintentar: false, motivo: 'intentos-agotados' })
  })

  it('el presupuesto de TIEMPO corta aunque queden intentos', () => {
    // El caso que el contador de intentos por sí solo no ve: tres intentos de
    // 60 s son tres minutos de trabajo colgado.
    // Queda intento (1 de 3), pero ya se gastaron 89,8 s de los 90 s: la
    // espera del siguiente reintento cruzaría el presupuesto, así que se para.
    const d = decidirReintento({ intentos: 1, gastadoMs: 89_800 }, 'transitorio', POLITICA_POR_DEFECTO, azarFijo(0.9))
    expect(d).toEqual({ reintentar: false, motivo: 'presupuesto-agotado' })
    // Y con margen suficiente sí reintenta: la prueba distingue las dos cosas.
    expect(decidirReintento({ intentos: 1, gastadoMs: 1_000 }, 'transitorio', POLITICA_POR_DEFECTO, azarFijo(0.9)).reintentar).toBe(true)
  })

  it('el jitter reparte: con azar 0 la espera es 0, con azar casi 1 llega al techo', () => {
    expect(esperaMs(1, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(0))).toBe(0)
    expect(esperaMs(1, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(0.999999))).toBe(500)
    // Sin jitter, estas dos serían el mismo número — que es justo la manada
    // sincronizada que tumba al proveedor que se estaba recuperando.
    expect(esperaMs(1, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(0.1)))
      .not.toBe(esperaMs(1, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(0.9)))
  })

  it('la espera crece exponencialmente y se detiene en el tope', () => {
    const alTecho = (n: number) => esperaMs(n, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(0.999999))
    expect(alTecho(1)).toBe(500)
    expect(alTecho(2)).toBe(1_000)
    expect(alTecho(3)).toBe(2_000)
    expect(alTecho(20)).toBe(POLITICA_POR_DEFECTO.topeMs)   // sin tope, 2^20 se va a días
  })

  it('la saturación (429) espera MÁS que un fallo transitorio cualquiera', () => {
    const t = esperaMs(1, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(0.999999))
    const s = esperaMs(1, POLITICA_POR_DEFECTO, 'saturacion', azarFijo(0.999999))
    expect(s).toBeGreaterThan(t)
  })

  it('una fuente de azar que miente no puede producir una espera mayor que el techo', () => {
    // Un `azar` inyectado que devuelva 5 (bug de prueba, o de quien la use)
    // no debe convertirse en cinco veces el tope.
    expect(esperaMs(1, POLITICA_POR_DEFECTO, 'transitorio', azarFijo(5))).toBeLessThanOrEqual(500)
  })

  it('ante la duda NO se reintenta: un 4xx desconocido es permanente', () => {
    expect(veredictoDeHttp(400)).toBe('permanente')
    expect(veredictoDeHttp(401)).toBe('permanente')
    expect(veredictoDeHttp(418)).toBe('permanente')
    expect(veredictoDeHttp(429)).toBe('saturacion')
    expect(veredictoDeHttp(503)).toBe('transitorio')
    expect(veredictoDeHttp(null)).toBe('transitorio')          // sin respuesta = red
    expect(veredictoDeHttp(401, true)).toBe('transitorio')     // el timeout manda
  })
})

describe('cortacircuitos', () => {
  const cfg = { ...CIRCUITO_POR_DEFECTO, fallosParaAbrir: 3, descansoMs: 1_000, exitosParaCerrar: 2 }

  it('abre tras los fallos declarados y deja de llamar al instante', () => {
    let c = circuitoNuevo(claveDeCircuito('anthropic', 'async:razonamiento'))
    for (let i = 0; i < 3; i += 1) c = registrarFallo(c, 1_000, cfg)
    expect(c.estado).toBe('abierto')
    const r = permitirLlamada(c, 1_000, cfg)
    expect(r.permitido).toBe(false)
    expect(r.motivo).toBe('abierto')
  })

  it('un éxito antes de abrir borra la cuenta: sólo los fallos SEGUIDOS abren', () => {
    // Sin esto, un consultorio con mala red abriría el circuito de todos los
    // demás acumulando fallos sueltos a lo largo de una hora.
    let c = circuitoNuevo('x')
    c = registrarFallo(c, 0, cfg)
    c = registrarFallo(c, 0, cfg)
    c = registrarExito(c, cfg)
    c = registrarFallo(c, 0, cfg)
    expect(c.estado).toBe('cerrado')
  })

  it('pasado el descanso deja pasar UNA prueba, no la manada', () => {
    let c = circuitoNuevo('x')
    for (let i = 0; i < 3; i += 1) c = registrarFallo(c, 1_000, cfg)
    expect(permitirLlamada(c, 1_500, cfg).permitido).toBe(false)      // aún descansando
    const r = permitirLlamada(c, 2_000, cfg)
    expect(r.permitido).toBe(true)
    expect(r.motivo).toBe('prueba')
    expect(r.circuito.estado).toBe('medio')
  })

  it('un fallo en MEDIO reabre inmediatamente, sin volver a contar hasta el umbral', () => {
    // Volver a contar tres fallos significaría mandar tres llamadas más contra
    // algo que acaba de decir que sigue caído.
    let c = circuitoNuevo('x')
    for (let i = 0; i < 3; i += 1) c = registrarFallo(c, 0, cfg)
    c = permitirLlamada(c, 5_000, cfg).circuito
    expect(c.estado).toBe('medio')
    c = registrarFallo(c, 5_100, cfg)
    expect(c.estado).toBe('abierto')
    expect(c.abiertoDesdeMs).toBe(5_100)
  })

  it('dos éxitos en MEDIO lo cierran del todo', () => {
    let c = circuitoNuevo('x')
    for (let i = 0; i < 3; i += 1) c = registrarFallo(c, 0, cfg)
    c = permitirLlamada(c, 5_000, cfg).circuito
    c = registrarExito(c, cfg)
    expect(c.estado).toBe('medio')
    c = registrarExito(c, cfg)
    expect(c.estado).toBe('cerrado')
    expect(c.fallosSeguidos).toBe(0)
  })

  it('la clave es proveedor+clase, nunca inquilino ni paciente', () => {
    const k = claveDeCircuito('anthropic', 'async:razonamiento')
    expect(k).toBe('anthropic::async:razonamiento')
    expect(k).not.toMatch(/clinic|patient|paciente/i)
  })
})
