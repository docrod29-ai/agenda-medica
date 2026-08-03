/**
 * GOLDEN — el cobro por médico dependía de que alguien pulsara un botón.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * En todo el repositorio hay **un solo sitio que escribe `medicosContratados`**:
 * el POST del botón «sincronizar» de una pantalla de configuración. Ni el alta
 * de un miembro, ni un cron, ni el webhook.
 *
 * Mientras tanto el CUPO de IA escala con los médicos PRESENTES y se aplica al
 * instante. Un consultorio da de alta cinco médicos, los cinco reciben su cuota
 * esa misma tarde, y la suscripción sigue cobrando uno — indefinidamente.
 *
 * Es una fuga que **crece con el éxito**: cuanto mejor le va al cliente, más
 * regala la plataforma.
 *
 * ── POR QUÉ NO SE ARREGLÓ BAJANDO EL CUPO ────────────────────────────────────
 *
 * Sería el error de v944 otra vez: un consultorio con cuatro médicos de alta y
 * el contador en uno vería su presupuesto de IA dividido entre cuatro de un día
 * para otro, sin haber hecho nada mal. El cupo sigue a los presentes; lo que se
 * arregla es que el cobro deje de depender de un clic.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  queHacer, itemsParaStripe, POR_QUE_EL_CUPO_NO_BAJA, POR_QUE_UNA_SOLA_IMPLEMENTACION,
} from '@/lib/finanzas/asientos'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

const BASE = { conAsientos: true, medicos: 3, contratados: 1, stripeSubscriptionId: 'sub_1', seatPrice: 'price_1' }

describe('la decisión, separada del efecto', () => {
  it('tres médicos con uno contratado → hay que ajustar', () => {
    const r = queHacer(BASE)
    expect(r.estado).toBe('ajustado')
    expect(r.estado === 'ajustado' && r.extras).toBe(2)
  })

  it('si ya coinciden, no se toca Stripe', () => {
    // Llamar a Stripe para no cambiar nada es una petición y un prorrateo de más.
    expect(queHacer({ ...BASE, medicos: 1, contratados: 1 }).estado).toBe('al_dia')
  })

  it('AJUSTA A LA BAJA, que es lo que lo hace justo', () => {
    /**
     * Un cobro automático que sólo sube no es una conciliación: es una trampa, y
     * la primera vez que un cliente lo note se lleva por delante la confianza en
     * todo lo demás.
     */
    const r = queHacer({ ...BASE, medicos: 1, contratados: 4 })
    expect(r.estado).toBe('ajustado')
    expect(r.estado === 'ajustado' && r.extras).toBe(0)
  })

  it('un plan sin asientos no se toca', () => {
    expect(queHacer({ ...BASE, conAsientos: false }).estado).toBe('sin_asientos')
  })
})

describe('LA REGLA QUE NO SE CRUZA: sin poder cobrar, no se marca como contratado', () => {
  it('sin suscripción en Stripe', () => {
    const r = queHacer({ ...BASE, stripeSubscriptionId: '' })
    expect(r.estado).toBe('no_ajustable')
    expect(r.estado === 'no_ajustable' && r.porQue).toMatch(/suscripción activa/)
  })

  it('sin precio de asiento configurado', () => {
    const r = queHacer({ ...BASE, seatPrice: '' })
    expect(r.estado).toBe('no_ajustable')
    expect(r.estado === 'no_ajustable' && r.porQue).toMatch(/precio de médico adicional/)
  })

  it('y eso vale también cuando el ajuste sería A LA BAJA', () => {
    // Sin suscripción no se puede ni bajar: marcar 1 «contratado» tras una baja
    // sin tocar Stripe dejaría el cobro anterior corriendo y el número mintiendo.
    expect(queHacer({ ...BASE, medicos: 1, contratados: 4, stripeSubscriptionId: '' }).estado).toBe('no_ajustable')
  })
})

describe('los ítems que se le mandan a Stripe', () => {
  it('crea el asiento si no existía', () => {
    expect(itemsParaStripe(2, 'price_1', null)).toEqual([{ price: 'price_1', quantity: 2 }])
  })

  it('actualiza la cantidad si ya existía', () => {
    expect(itemsParaStripe(3, 'price_1', 'si_9')).toEqual([{ id: 'si_9', quantity: 3 }])
  })

  it('BORRA el ítem en vez de ponerlo a cero', () => {
    /**
     * Una cantidad de cero deja la línea viva en la suscripción y algunos
     * informes la siguen contando. Borrarla es lo que de verdad deja de cobrar.
     */
    expect(itemsParaStripe(0, 'price_1', 'si_9')).toEqual([{ id: 'si_9', deleted: true }])
  })

  it('y sin extras ni ítem previo no manda nada', () => {
    // El estado en Stripe ya es el correcto: no hay nada que cobrar ni que quitar.
    expect(itemsParaStripe(0, 'price_1', null)).toEqual([])
  })
})

describe('GUARDIÁN — una sola implementación de la regla', () => {
  const boton = sinComentarios(leer('src', 'app', 'api', 'stripe', 'asientos', 'route.ts'))
  const cron = sinComentarios(leer('src', 'app', 'api', 'cron', 'asientos', 'route.ts'))

  it('el botón la usa', () => {
    expect(boton).toContain('queHacer(')
    expect(boton).toContain('itemsParaStripe(')
  })

  it('y el cron usa la MISMA, no una copia', () => {
    expect(cron).toContain('queHacer(')
    expect(cron).toContain('itemsParaStripe(')
  })

  it('ninguno de los dos rehace la decisión por su cuenta', () => {
    /**
     * Si un día vuelven a decidirlo cada uno, el que difiera dejará médicos
     * habilitados sin cobrar y nadie lo notará hasta el cierre de mes.
     */
    for (const [nombre, src] of [['botón', boton], ['cron', cron]] as const) {
      expect(src, nombre).not.toMatch(/if \(!st\.stripeSubscriptionId\)[\s\S]{0,200}medicosContratados/)
    }
  })

  it('está escrito por qué el cupo NO baja', () => {
    expect(POR_QUE_EL_CUPO_NO_BAJA).toMatch(/v944/)
    expect(POR_QUE_UNA_SOLA_IMPLEMENTACION).toMatch(/cierre de mes/)
  })
})

describe('el cron', () => {
  const cron = leer('src', 'app', 'api', 'cron', 'asientos', 'route.ts')

  it('es fail-closed: un endpoint que MUEVE DINERO no queda abierto', () => {
    expect(cron).toContain('CRON_SECRET no configurado (fail-closed)')
  })

  it('un consultorio que falla no detiene a los demás', () => {
    expect(cron).toContain('fallos++')
  })

  it('y los que no se pudieron conciliar salen NOMBRADOS', () => {
    /**
     * Un consultorio que no se puede conciliar y del que nadie se entera es
     * exactamente la fuga de antes, con un cron delante.
     */
    expect(cron).toContain('pendientes.push(')
    expect(cron).toContain('pendientes })')
  })

  it('late en sus dos salidas y tiene periodo declarado', async () => {
    expect((cron.match(/registrarLatido\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    const { PERIODO_MIN } = await import('@/lib/ops/latido')
    expect(PERIODO_MIN).toHaveProperty('asientos')
  })

  it('está dado de alta en vercel.json (si no, no lo dispara nadie)', () => {
    const v = JSON.parse(leer('vercel.json')) as { crons: { path: string }[] }
    expect(v.crons.map(c => c.path)).toContain('/api/cron/asientos')
  })

  it('y declara el tope, en vez de recortar en silencio', () => {
    expect(cron).toContain('const TOPE = 500')
    expect(cron).toContain('recortado = true')
  })
})
