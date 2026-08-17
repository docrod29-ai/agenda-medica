/**
 * RT-08 — el candado de la ventana de clic ciego en la coreografía de
 * continuidad (V15-ORIGINALITY-REDTEAM-001, §41 del master loop V15).
 *
 * QUÉ FALLABA: durante el callback de `document.startViewTransition` el
 * navegador pinta la instantánea VIEJA congelada, pero el hit-testing corre
 * contra el DOM NUEVO (la ruta ya navegó). Con el tope de espera en 1200ms,
 * un médico que venía de una worklist con un «Consulta» por renglón podía
 * hacer clic sobre lo que VEÍA (la fila del paciente A) y aterrizar a ciegas
 * sobre lo que HABÍA debajo — el encuentro del paciente B. Riesgo de
 * PACIENTE EQUIVOCADO: el único hallazgo del equipo rojo con riesgo clínico.
 *
 * CÓMO SE DESCUBRIÓ: el equipo rojo de originalidad (panel B, 4 revisores)
 * leyó `continuidad.ts` buscando motion decorativo y encontró en su lugar
 * esta ventana; el guardián de motion existente sólo verificaba que el
 * overlay `::view-transition` no capture el puntero (§20, interrumpible) —
 * ese overlay NI EXISTE durante el callback, que es donde vive la ventana.
 *
 * CAUSA RAÍZ: el API separa lo que se pinta (instantánea vieja) de lo que
 * recibe eventos (DOM vivo nuevo) mientras corre el callback, y el diseño
 * original sólo pensó en el CUADRO (que no se congele demasiado: tope), no
 * en el PUNTERO (que durante ese tramo apunta a otra pantalla).
 *
 * LA REGLA QUE LO HACE SEGURO: (1) mientras corre el callback, <html> lleva
 * `data-vt-congelada` y globals.css lo traduce a `pointer-events: none`
 * sobre <body> — ningún clic aterriza sobre el DOM que no se ve; (2) el
 * candado se suelta en un `finally`, pase lo que pase (commit, tope o
 * excepción de navegar()); (3) el tope baja de 1200 a 400ms — la ventana en
 * la que la pantalla miente no puede durar más que eso; una ruta más lenta
 * pierde el morph, no la seguridad.
 *
 * PROBADO AL REVÉS ×2 (13-ago-2026, con git stash del arreglo):
 *   - sin el candado (código de antes): fallan los 3 casos del candado;
 *   - con el tope viejo (1200): falla «la ventana no puede durar más de
 *     400ms» — a los 400ms el callback seguiría colgado.
 *
 * QUÉ NO CUBRE: no ejecuta un navegador real — el morph computado y el
 * hit-testing verdadero los mide `scripts/design/medir-continuidad-v15.mjs`;
 * y no vigila la FASE DE ANIMACIÓN (posterior al callback): ahí el overlay
 * ya pinta el estado nuevo y §20 exige que siga interrumpible — ese contrato
 * lo guarda v15-motion-continuidad-de-objeto.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

import {
  navegarConContinuidad,
  rutaComprometida,
  ATRIBUTO_VT,
  ATRIBUTO_VT_CONGELADA,
} from '../lib/ui/continuidad'

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8')

/** Un DOM de mentira con el contrato exacto que continuidad.ts consume. */
function armarNavegador() {
  const atributos = new Set<string>()
  const raiz = {
    setAttribute: (nombre: string) => void atributos.add(nombre),
    removeAttribute: (nombre: string) => void atributos.delete(nombre),
  }
  let resolverFinished!: () => void
  const finished = new Promise<void>(r => {
    resolverFinished = r
  })
  let promesaCallback: Promise<void> | null = null
  vi.stubGlobal('document', {
    documentElement: raiz,
    // Como el API real: ejecuta el callback INMEDIATAMENTE y guarda su promesa.
    startViewTransition: (cb: () => Promise<void>) => {
      promesaCallback = cb()
      // El rechazo del callback ya lo absorbe el finally del módulo; aquí
      // sólo evitamos un unhandled rejection si navegar() explota.
      promesaCallback.catch(() => {})
      return { finished }
    },
  })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  return {
    congelada: () => atributos.has(ATRIBUTO_VT_CONGELADA),
    coreografiando: () => atributos.has(ATRIBUTO_VT),
    esperarCallback: () => promesaCallback!,
    resolverFinished,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('RT-08 — mientras el callback corre, el puntero está congelado', () => {
  it('el candado se pone al arrancar el callback y se suelta al llegar el commit', async () => {
    const dom = armarNavegador()
    navegarConContinuidad(() => {})
    // La ventana está ABIERTA: pantalla vieja pintada, DOM nuevo debajo.
    expect(dom.congelada()).toBe(true)
    // Llega el commit (template.tsx remontado) → el callback resuelve.
    rutaComprometida()
    await dom.esperarCallback()
    expect(dom.congelada()).toBe(false)
    // La coreografía sigue viva (el atributo del DESTINO se limpia con
    // finished, no con el callback): el candado no la mata.
    expect(dom.coreografiando()).toBe(true)
  })

  it('la ventana no puede durar más de 400ms: el tope suelta el candado solo', async () => {
    const dom = armarNavegador()
    navegarConContinuidad(() => {})
    expect(dom.congelada()).toBe(true)
    // Nadie avisa el commit (ruta colgada). Con el tope viejo (1200ms) esta
    // espera de 400ms dejaría el candado puesto — y la prueba en rojo.
    await vi.advanceTimersByTimeAsync(400)
    await dom.esperarCallback()
    expect(dom.congelada()).toBe(false)
  })

  it('si navegar() explota, el finally suelta el candado igual', async () => {
    const dom = armarNavegador()
    navegarConContinuidad(() => {
      throw new Error('router roto')
    })
    await dom.esperarCallback().catch(() => {})
    expect(dom.congelada()).toBe(false)
  })
})

describe('RT-08 — la hoja traduce el candado y el módulo no lo dejó a medias', () => {
  it('globals.css congela el puntero de <body> bajo el atributo', () => {
    expect(leer('src/app/globals.css')).toMatch(
      /html\[data-vt-congelada\] body \{ pointer-events: none; \}/,
    )
  })

  it('el atributo del módulo y el de la hoja son el MISMO', () => {
    expect(ATRIBUTO_VT_CONGELADA).toBe('data-vt-congelada')
  })

  it('el tope declarado en el módulo es 400 — la ventana corta es parte del arreglo', () => {
    expect(leer('src/lib/ui/continuidad.ts')).toMatch(/TOPE_ESPERA_MS = 400\b/)
  })
})
