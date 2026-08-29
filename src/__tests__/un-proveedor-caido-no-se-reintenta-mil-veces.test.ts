/**
 * GOLDEN — NO HABÍA INTERRUPTOR DE CIRCUITO EN NINGUNA PARTE (P1-15).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-346 puso tiempo máximo a las llamadas de proveedor, así que **una** ya no
 * podía inmovilizar la función. Lo que no había era nada que impidiera que las
 * **mil siguientes** volvieran a pagar el timeout entero contra un proveedor
 * que llevaba minutos caído.
 *
 * Con Anthropic devolviendo 529, cada consulta que empieza espera 60 segundos
 * para acabar diciendo «no se pudo». Diez médicos a la vez son diez funciones
 * ocupadas un minuto cada una —facturadas por GB-segundo— y diez médicos con el
 * paciente enfrente mirando una barra que ya se sabe cómo termina.
 *
 * Y la avalancha de reintentos es justo lo que impide que un proveedor
 * sobrecargado se recupere.
 *
 * Además, la cascada de modelos no tenía **presupuesto total**: tres modelos con
 * un proveedor lento son tres timeouts seguidos —tres minutos— dentro de una
 * ruta que puede durar 300 s, así que nada los cortaba.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de resiliencia del tablero de Ausculta (WS-04, P1-15). El propio
 * tablero lo decía con todas las letras: «no hay circuit breaker ni presupuesto
 * de reintentos en ninguna parte».
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El acotado se pensó **por llamada** y el fallo de un proveedor es **por
 * temporada**. Un timeout protege a quien llama de una petición; no protege al
 * sistema de un proveedor que ya no está, ni al proveedor de nosotros.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Tras tres fallos seguidos DEL PROVEEDOR se deja de llamar y se falla rápido.
 * Pasado el enfriamiento se deja pasar **una sola** llamada de prueba: si
 * contesta se cierra el circuito; si no, se reabre con el doble de espera, hasta
 * un tope.
 *
 * ── EL AISLAMIENTO ES LA PARTE QUE HAY QUE VIGILAR ──────────────────────────
 *
 * Sólo abren el circuito los fallos que dicen «el proveedor no está» (5xx y
 * tiempo agotado). **Una llave revocada NO lo abre**, y no es afinación: si lo
 * abriera, un consultorio con su llave mal escrita **dejaría sin IA a todos los
 * demás**. Un interruptor mal condicionado no mueve datos de un consultorio a
 * otro: mueve la CAÍDA. Por el mismo motivo la llave forma parte de la clave del
 * circuito.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No es un interruptor global.** El estado vive en memoria del proceso, así
 *   que en un despliegue sin servidor cada instancia caliente tiene el suyo: la
 *   primera llamada de cada instancia paga su timeout. Hacerlo global exigiría
 *   una lectura compartida en el camino de una nota clínica. Se declara en el
 *   módulo en vez de dejar creer que protege más de lo que protege.
 * · **No prueba la red.** Aquí no hay `fetch` real: se ejercita la máquina de
 *   estados y la clave del circuito, que es donde vive la decisión.
 * · **No cubre WhatsApp ni Evidence.** Sus llamadas tienen timeout (REG-346) y
 *   `reintentos.ts` con backoff para el outbox, pero **no pasan por esta
 *   puerta** y siguen sin interruptor. Queda abierto y con nombre.
 * · **No mide el ahorro.** Que se llame menos está probado; cuánto se ahorra en
 *   GB-segundo, no.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  decidir, siguienteEstado, esFalloDelProveedor, claveCircuito,
  permiteLlamar, anotarResultado, estadoDe, olvidarCircuitos, circuitosAbiertos,
  CERRADO, FALLOS_PARA_ABRIR, ENFRIAMIENTO_BASE_MS, ENFRIAMIENTO_MAX_MS,
  type EstadoCircuito,
} from '@/lib/ia/interruptor'

const T0 = 1_800_000_000_000

beforeEach(() => olvidarCircuitos())

describe('QUÉ ABRE EL CIRCUITO — y qué NO, que es lo que importa', () => {
  it('el 5xx del proveedor y el tiempo agotado sí', () => {
    expect(esFalloDelProveedor('proveedor')).toBe(true)
    expect(esFalloDelProveedor('red')).toBe(true)
  })

  it('EL CASO QUE PROTEGE A LOS DEMÁS: una llave revocada NO abre el circuito', () => {
    // Si lo abriera, un consultorio con su llave mal escrita dejaría sin IA a
    // todos los demás. No mueve datos de un consultorio a otro: mueve la caída.
    expect(esFalloDelProveedor('llave')).toBe(false)
    let e: EstadoCircuito = CERRADO
    for (let i = 0; i < FALLOS_PARA_ABRIR * 3; i++) e = siguienteEstado(e, 'llave', T0)
    expect(e.fase, 'una llave mala repetida no puede apagar el proveedor').toBe('cerrado')
  })

  it('ni el saldo, ni el límite de tasa, ni un modelo inexistente', () => {
    for (const clase of ['saldo', 'limite', 'modelo', 'respuesta'] as const) {
      expect(esFalloDelProveedor(clase)).toBe(false)
      let e: EstadoCircuito = CERRADO
      for (let i = 0; i < FALLOS_PARA_ABRIR * 2; i++) e = siguienteEstado(e, clase, T0)
      expect(e.fase, `${clase} no debería abrir el circuito`).toBe('cerrado')
    }
  })
})

describe('LA MÁQUINA DE ESTADOS', () => {
  it('aguanta hasta el umbral y entonces abre', () => {
    let e: EstadoCircuito = CERRADO
    for (let i = 1; i < FALLOS_PARA_ABRIR; i++) {
      e = siguienteEstado(e, 'proveedor', T0)
      expect(e.fase, `con ${i} fallos todavía no se cierra la puerta`).toBe('cerrado')
    }
    e = siguienteEstado(e, 'proveedor', T0)
    expect(e.fase).toBe('abierto')
  })

  it('un éxito en medio BORRA la cuenta: no se suman fallos de horas distintas', () => {
    let e: EstadoCircuito = CERRADO
    e = siguienteEstado(e, 'proveedor', T0)
    e = siguienteEstado(e, 'proveedor', T0)
    e = siguienteEstado(e, null, T0)          // contestó
    e = siguienteEstado(e, 'proveedor', T0)
    expect(e.fase, 'dos fallos de ayer más uno de hoy no son una caída').toBe('cerrado')
  })

  it('abierto: no pasa nadie hasta que vence el enfriamiento', () => {
    const abierto: EstadoCircuito = { fase: 'abierto', hasta: T0 + ENFRIAMIENTO_BASE_MS, enfriamientoMs: ENFRIAMIENTO_BASE_MS }
    expect(decidir(abierto, T0).pasa).toBe(false)
    expect(decidir(abierto, T0 + ENFRIAMIENTO_BASE_MS - 1).pasa).toBe(false)
  })

  it('vencido el enfriamiento pasa UNA prueba, y sólo una', () => {
    const abierto: EstadoCircuito = { fase: 'abierto', hasta: T0, enfriamientoMs: ENFRIAMIENTO_BASE_MS }
    const primera = decidir(abierto, T0)
    expect(primera.pasa).toBe(true)
    expect(primera.esPrueba).toBe(true)
    // La segunda, con el estado que dejó la primera, NO pasa: varias pruebas a
    // la vez son la avalancha que esto existe para evitar.
    expect(decidir(primera.estado, T0).pasa).toBe(false)
  })

  it('si la prueba contesta, el circuito se cierra', () => {
    const probando: EstadoCircuito = { fase: 'probando', enfriamientoMs: ENFRIAMIENTO_BASE_MS }
    expect(siguienteEstado(probando, null, T0)).toEqual(CERRADO)
  })

  it('si la prueba falla, se reabre con el DOBLE de espera', () => {
    const probando: EstadoCircuito = { fase: 'probando', enfriamientoMs: ENFRIAMIENTO_BASE_MS }
    const e = siguienteEstado(probando, 'proveedor', T0)
    expect(e.fase).toBe('abierto')
    if (e.fase !== 'abierto') return
    expect(e.enfriamientoMs).toBe(ENFRIAMIENTO_BASE_MS * 2)
    expect(e.hasta).toBe(T0 + ENFRIAMIENTO_BASE_MS * 2)
  })

  it('el enfriamiento tiene tope: un proveedor caído no se abandona para siempre', () => {
    let e: EstadoCircuito = { fase: 'probando', enfriamientoMs: ENFRIAMIENTO_MAX_MS }
    e = siguienteEstado(e, 'proveedor', T0)
    expect(e.fase).toBe('abierto')
    if (e.fase !== 'abierto') return
    expect(e.enfriamientoMs).toBe(ENFRIAMIENTO_MAX_MS)
  })

  it('una prueba que se topa con un 401 NO cierra el circuito', () => {
    /**
     * No se ha aprendido nada sobre si el proveedor volvió: la llave es otro
     * problema. Cerrar aquí soltaría la avalancha por un error que no desmiente
     * la caída.
     */
    const probando: EstadoCircuito = { fase: 'probando', enfriamientoMs: ENFRIAMIENTO_BASE_MS }
    const e = siguienteEstado(probando, 'llave', T0)
    expect(e.fase).toBe('abierto')
  })
})

describe('LA CLAVE DEL CIRCUITO SEPARA CONSULTORIOS', () => {
  it('la llave de la plataforma es UN circuito', () => {
    expect(claveCircuito('anthropic', 'plataforma', 'clinica-a'))
      .toBe(claveCircuito('anthropic', 'plataforma', 'clinica-b'))
  })

  it('la llave del consultorio es UNO POR CONSULTORIO', () => {
    expect(claveCircuito('anthropic', 'clinica', 'clinica-a'))
      .not.toBe(claveCircuito('anthropic', 'clinica', 'clinica-b'))
  })

  it('y los proveedores no se contagian entre sí', () => {
    expect(claveCircuito('anthropic', 'plataforma', null))
      .not.toBe(claveCircuito('openai', 'plataforma', null))
  })

  it('EL CASO: el consultorio A caído no apaga al consultorio B', () => {
    const a = claveCircuito('anthropic', 'clinica', 'clinica-a')
    const b = claveCircuito('anthropic', 'clinica', 'clinica-b')
    for (let i = 0; i < FALLOS_PARA_ABRIR; i++) anotarResultado(a, 'proveedor', T0)
    expect(permiteLlamar(a, T0).pasa).toBe(false)
    expect(permiteLlamar(b, T0).pasa, 'el problema de un consultorio no puede apagar a otro').toBe(true)
  })
})

describe('EL REGISTRO CON ESTADO SE COMPORTA COMO LA MÁQUINA', () => {
  const CLAVE = 'anthropic:plataforma'

  it('deja pasar mientras no haya caída', () => {
    expect(permiteLlamar(CLAVE, T0).pasa).toBe(true)
  })

  it('EL CASO COMPLETO: cae, se abre, se enfría, prueba, y vuelve', () => {
    for (let i = 0; i < FALLOS_PARA_ABRIR; i++) {
      expect(permiteLlamar(CLAVE, T0).pasa).toBe(true)
      anotarResultado(CLAVE, 'proveedor', T0)
    }
    // Ahora se falla RÁPIDO: nadie más espera el timeout.
    expect(permiteLlamar(CLAVE, T0).pasa).toBe(false)
    expect(circuitosAbiertos(T0)).toContain(CLAVE)

    // Pasado el enfriamiento, una prueba.
    const luego = T0 + ENFRIAMIENTO_BASE_MS
    const prueba = permiteLlamar(CLAVE, luego)
    expect(prueba.pasa).toBe(true)
    expect(prueba.esPrueba).toBe(true)

    // Contesta: se cierra y todo vuelve a la normalidad.
    anotarResultado(CLAVE, null, luego)
    expect(estadoDe(CLAVE)).toEqual(CERRADO)
    expect(permiteLlamar(CLAVE, luego).pasa).toBe(true)
    expect(circuitosAbiertos(luego)).toEqual([])
  })

  it('mientras está abierto, CIEN llamadas no llegan a ninguna parte', () => {
    for (let i = 0; i < FALLOS_PARA_ABRIR; i++) anotarResultado(CLAVE, 'proveedor', T0)
    let pasaron = 0
    for (let i = 0; i < 100; i++) if (permiteLlamar(CLAVE, T0).pasa) pasaron++
    expect(
      pasaron,
      'cada una que pasa es un médico esperando sesenta segundos por la misma respuesta',
    ).toBe(0)
  })
})

describe('EL GATEWAY LO USA, Y EN EL ORDEN CORRECTO', () => {
  const src = readFileSync('src/lib/ia/gateway.ts', 'utf8')

  it('pregunta al interruptor ANTES de llamar al proveedor', () => {
    expect(src).toContain('permiteLlamar(circuito)')
    expect(src.indexOf('permiteLlamar(circuito)')).toBeLessThan(src.indexOf('fetchConTimeout('))
  })

  it('y devuelve los créditos si no llegó a intentarlo', () => {
    const bloque = src.slice(src.indexOf('const puerta = permiteLlamar'), src.indexOf('const lista = o.modelos'))
    expect(bloque, 'cobrar una nota que ni se intentó pierde el crédito y la confianza').toContain('devolverCreditos(reserva)')
  })

  it('la cascada de modelos tiene presupuesto total, no sólo por intento', () => {
    expect(src).toContain('const presupuestoMs')
    expect(src).toContain('Date.now() - t0 > presupuestoMs')
  })

  it('y una respuesta buena cierra el circuito', () => {
    expect(src).toContain('anotarResultado(circuito, null)')
  })
})
