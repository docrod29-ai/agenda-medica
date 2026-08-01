/**
 * EL ESLABÓN QUE NINGÚN TEST PODÍA VER.
 *
 * Stripe sólo envía los eventos a los que el endpoint está SUSCRITO. El webhook
 * puede saber atender `charge.refunded` a la perfección y, si nadie marcó la
 * casilla en el panel, **no llega nunca**: se devuelve el dinero, la suscripción
 * sigue viva, y el resultado es idéntico a no haberlo programado.
 *
 * Ese eslabón vive fuera del repositorio. Lo único que se puede probar aquí es la
 * DECISIÓN: dada la lista que Stripe reporta, ¿qué se le dice al dueño? Lo demás
 * lo cubre preguntárselo a Stripe y pintarlo en su consola.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluarWebhook, modoDeLaLlave, avisoDeModo,
  EVENTOS_QUE_ATENDEMOS, EVENTOS_CRITICOS,
} from '@/lib/finanzas/webhook-stripe-salud'

describe('evaluarWebhook', () => {
  it('todo suscrito → ni una palabra', () => {
    // Un aviso que aparece cuando no pasa nada enseña a ignorar los avisos.
    const r = evaluarWebhook([...EVENTOS_QUE_ATENDEMOS])
    expect(r.aviso).toBe('')
    expect(r.faltantes).toEqual([])
  })

  it('el comodín `*` significa TODOS, no un evento llamado asterisco', () => {
    /**
     * En el panel de Stripe se puede suscribir «todos los eventos» y la API lo
     * reporta como `*`. Tratarlo como un nombre literal habría marcado los nueve
     * como faltantes en una cuenta perfectamente configurada — un falso positivo
     * que quema la credibilidad del aviso.
     */
    const r = evaluarWebhook(['*'])
    expect(r.aviso).toBe('')
    expect(r.faltanCriticos).toEqual([])
  })

  it('sin endpoint: lo dice entero, no en detalle', () => {
    const r = evaluarWebhook(null)
    expect(r.configurado).toBe(false)
    expect(r.aviso).toMatch(/No se encontró/)
    expect(r.faltanCriticos.length).toBe(EVENTOS_CRITICOS.length)
  })

  it('faltan las devoluciones → el aviso nombra el daño, no sólo el hecho', () => {
    // «Falta un evento» no mueve a nadie. «Se devuelve el dinero y la suscripción
    // sigue activa» sí.
    const sinDevoluciones = EVENTOS_QUE_ATENDEMOS.filter(e => !EVENTOS_CRITICOS.includes(e as never))
    const r = evaluarWebhook([...sinDevoluciones])
    expect(r.faltanCriticos.sort()).toEqual([...EVENTOS_CRITICOS].sort())
    expect(r.aviso).toMatch(/reembolso|contracargo/i)
    expect(r.aviso).toMatch(/Add events/)
  })

  it('falta algo NO crítico → avisa, pero sin alarma', () => {
    const r = evaluarWebhook(EVENTOS_QUE_ATENDEMOS.filter(e => e !== 'invoice.payment_failed'))
    expect(r.faltanCriticos).toEqual([])
    expect(r.faltantes).toEqual(['invoice.payment_failed'])
    expect(r.aviso).not.toMatch(/reembolso/i)
  })

  it('los eventos críticos son los tres de devolución', () => {
    // Si mañana alguien mueve uno de aquí, que sea a propósito: son los únicos
    // cuya ausencia abre un agujero en la caja en vez de degradar el servicio.
    expect([...EVENTOS_CRITICOS]).toEqual(['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'])
  })

  it('la lista que pedimos es la que el webhook atiende de verdad', () => {
    // El contrato: si el código deja de manejar un evento, deja de pedirse.
    for (const e of EVENTOS_CRITICOS) expect([...EVENTOS_QUE_ATENDEMOS]).toContain(e)
  })
})

describe('prueba o producción', () => {
  it('lo decide el PREFIJO, y nunca devuelve la llave', () => {
    expect(modoDeLaLlave('sk_live_abc123')).toBe('produccion')
    expect(modoDeLaLlave('sk_test_abc123')).toBe('prueba')
    expect(modoDeLaLlave('')).toBe('sin_llave')
    expect(modoDeLaLlave(undefined)).toBe('sin_llave')
  })

  it('lo desconocido cae a PRUEBA, no a producción', () => {
    /**
     * Fallar hacia «prueba» es el lado seguro: en el peor caso se avisa de más.
     * Al revés —dar por producción una llave que no se reconoce— haría creer que
     * la app cobra de verdad cuando quizá no.
     */
    expect(modoDeLaLlave('algo_raro')).toBe('prueba')
  })

  it('en producción no hay nada que decir', () => {
    expect(avisoDeModo('produccion')).toBe('')
  })

  it('en prueba avisa de LAS DOS cosas: no entra dinero y los eventos son aparte', () => {
    // La segunda es la que muerde al pasar a producción: marcar los eventos en
    // prueba no los marca en la cuenta real.
    const a = avisoDeModo('prueba')
    expect(a).toMatch(/NO entra dinero/i)
    expect(a).toMatch(/por separado en cada modo/i)
  })

  it('el modo viaja en el resultado del webhook', () => {
    const r = evaluarWebhook([...EVENTOS_QUE_ATENDEMOS], 'prueba')
    expect(r.modo).toBe('prueba')
    expect(r.aviso).toBe('')          // los eventos están completos…
    expect(r.avisoModo).not.toBe('')  // …pero el modo sigue mereciendo una nota
  })
})
