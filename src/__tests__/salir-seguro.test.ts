/**
 * GUARDIÁN: al cerrar sesión no se borra lo que no se pudo guardar.
 *
 * El fallo que esto cierra: se pedía guardar, se esperaban 1200 ms FIJOS sin
 * mirar el resultado, y después se purgaba el borrador local, el audio y la
 * caché de Firestore —donde vive la escritura pendiente cuando la red va lenta—.
 * Con wifi malo, la nota desaparecía de los tres sitios a la vez, mientras el
 * aviso prometía «Guardaremos tu nota en el servidor antes de cerrar».
 *
 * Aquí se prueba el handshake puro: que se ESPERE de verdad y que se distinga
 * «guardado» de «no se pudo confirmar». La purga condicional vive en
 * `salirSeguro`, que toca `window.location` y no se puede probar en jsdom sin
 * montar media app; lo que sí se prueba es la señal de la que depende.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'

/**
 * `window` mínimo con el EventTarget nativo de Node.
 *
 * El proyecto corre los tests en entorno `node` y no tiene jsdom instalado.
 * Añadir una dependencia entera para despachar un evento sería desproporcionado:
 * lo único que este módulo necesita de `window` es `dispatchEvent` y
 * `addEventListener`, que Node trae de serie desde la 15.
 */
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    ;(globalThis as unknown as { window: EventTarget }).window = new EventTarget()
  }
})

const { guardarTodoYEsperar, EVENTO_GUARDAR_TODO } = await import('@/lib/salir-seguro')
type DetalleGuardarTodo = import('@/lib/salir-seguro').DetalleGuardarTodo

/** Simula una pantalla que escucha y entrega su promesa de guardado. */
function pantallaQueGuarda(promesa: Promise<unknown>): () => void {
  const listener = (ev: Event) => {
    const d = (ev as CustomEvent<DetalleGuardarTodo>).detail
    d?.esperar?.(promesa)
  }
  window.addEventListener(EVENTO_GUARDAR_TODO, listener)
  return () => window.removeEventListener(EVENTO_GUARDAR_TODO, listener)
}

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('guardarTodoYEsperar', () => {
  it('espera a que el guardado TERMINE, no un tiempo fijo', async () => {
    let terminado = false
    const lento = dormir(300).then(() => { terminado = true })
    const quitar = pantallaQueGuarda(lento)

    const r = await guardarTodoYEsperar()
    quitar()

    // Lo que fallaba antes: se seguía adelante con el guardado en vuelo.
    expect(terminado).toBe(true)
    expect(r.todoGuardado).toBe(true)
    expect(r.huboAcuse).toBe(true)
  })

  it('un guardado que FALLA no se reporta como guardado', async () => {
    const quitar = pantallaQueGuarda(Promise.reject(new Error('sin red')))
    const r = await guardarTodoYEsperar()
    quitar()

    // De esta señal depende que NO se purgue el borrador local: cuando el
    // servidor no lo recibió, el disco es la única copia que queda.
    expect(r.todoGuardado).toBe(false)
    expect(r.huboAcuse).toBe(true)
  })

  it('si NADIE escucha, no se afirma que se guardó', async () => {
    const r = await guardarTodoYEsperar()
    expect(r.huboAcuse).toBe(false)
    // «No se pudo confirmar» se trata con la misma prudencia que un fallo.
    expect(r.todoGuardado).toBe(false)
  })

  it('un guardado que no vuelve NUNCA no deja al médico encerrado', async () => {
    vi.useFakeTimers()
    const quitar = pantallaQueGuarda(new Promise(() => { /* jamás resuelve */ }))
    const p = guardarTodoYEsperar(2000)
    await vi.advanceTimersByTimeAsync(2100)
    const r = await p
    quitar()
    vi.useRealTimers()

    expect(r.seAgotoElTiempo).toBe(true)
    expect(r.todoGuardado).toBe(false)   // → tampoco se purga
  })

  it('espera a TODAS las pantallas, no sólo a la primera', async () => {
    let segundaLista = false
    const quitar1 = pantallaQueGuarda(dormir(50))
    const quitar2 = pantallaQueGuarda(dormir(250).then(() => { segundaLista = true }))

    const r = await guardarTodoYEsperar()
    quitar1(); quitar2()

    expect(segundaLista).toBe(true)
    expect(r.todoGuardado).toBe(true)
  })

  it('si UNA falla, el conjunto no se da por guardado', async () => {
    const quitar1 = pantallaQueGuarda(dormir(20))
    const quitar2 = pantallaQueGuarda(Promise.reject(new Error('nel')))

    const r = await guardarTodoYEsperar()
    quitar1(); quitar2()

    expect(r.todoGuardado).toBe(false)
  })
})
