/**
 * GOLDEN — la prueba gratis se estrena una vez, no en cada compra.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `api/stripe/checkout` mandaba `trial_period_days: 14` **incondicional**, en
 * cada sesión de compra. Stripe hace lo que se le pide: cada suscripción nueva
 * nacía con catorce días gratis.
 *
 * Cancelar el día 13 y volver a suscribirse renovaba la prueba. Repetido, es **el
 * producto entero gratis para siempre**: dos clics cada dos semanas, sin trampas
 * ni herramientas. Y no salta ninguna alarma, porque desde dentro se ve igual
 * que un cliente que se suscribe.
 *
 * Estaba en la cola desde el 1-ago con archivo y línea
 * (`src/app/api/stripe/checkout/route.ts:84`) y no se había reparado.
 *
 * ── LA PARTE QUE NO ES OBVIA: QUÉ HACER SI STRIPE NO CONTESTA ────────────────
 *
 * Negar la prueba por una caída de red le cobra el primer día a alguien a quien
 * se le prometieron catorce gratis, y eso es una promesa rota. Concederla de más
 * exige, además de la caída, que el webhook nunca escribiera la marca local. Por
 * eso se concede — y por eso la marca existe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decidirPrueba, DIAS_PRUEBA, POR_QUE_UNA_SOLA_PRUEBA } from '@/lib/finanzas/prueba-gratis'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('quien estrena, estrena una vez', () => {
  it('primera suscripción: le tocan sus 14 días', () => {
    const d = decidirPrueba({ suscripcionesPrevias: 0, historialConsultado: true })
    expect(d.dias).toBe(DIAS_PRUEBA)
    expect(d.porQue).toMatch(/primera suscripción/i)
  })

  it('EL CASO QUE SE ROMPÍA: canceló y vuelve → sin prueba', () => {
    // Stripe cuenta las canceladas (`status: 'all'`) justamente por esto.
    const d = decidirPrueba({ suscripcionesPrevias: 1, historialConsultado: true })
    expect(d.dias).toBeUndefined()
    expect(d.porQue).toMatch(/no se reinicia/i)
  })

  it('cambiar de plan tampoco la reinicia', () => {
    const d = decidirPrueba({ suscripcionesPrevias: 3, historialConsultado: true })
    expect(d.dias).toBeUndefined()
  })

  it('la marca local basta por sí sola', () => {
    // Aunque Stripe conteste «ninguna suscripción» por lo que sea.
    const d = decidirPrueba({
      suscripcionesPrevias: 0, historialConsultado: true,
      pruebaEstrenadaEn: '2026-06-01T10:00:00.000Z',
    })
    expect(d.dias).toBeUndefined()
    expect(d.porQue).toContain('2026-06-01')
  })
})

describe('cuando Stripe no contesta', () => {
  it('sin marca local se CONCEDE, y se explica por qué', () => {
    const d = decidirPrueba({ suscripcionesPrevias: 0, historialConsultado: false })
    expect(d.dias).toBe(DIAS_PRUEBA)
    expect(d.porQue).toMatch(/negarla por una caída rompería lo prometido/i)
  })

  it('pero la marca local sigue mandando', () => {
    const d = decidirPrueba({
      suscripcionesPrevias: 0, historialConsultado: false,
      pruebaEstrenadaEn: '2026-06-01T10:00:00.000Z',
    })
    expect(d.dias).toBeUndefined()
  })

  it('y un conteo sin consultar NO se toma por bueno', () => {
    // Si la consulta falló, `suscripcionesPrevias` es 0 por defecto, no porque
    // no las haya. Tratar ese 0 como un dato sería inventarlo.
    const d = decidirPrueba({ suscripcionesPrevias: 9, historialConsultado: false })
    expect(d.dias).toBe(DIAS_PRUEBA)
  })
})

describe('la ruta de compra usa la decisión', () => {
  const s = leer('src', 'app', 'api', 'stripe', 'checkout', 'route.ts')

  it('ya no manda 14 días incondicionales', () => {
    expect(s).not.toContain('trial_period_days: 14,')
  })

  it('pregunta a Stripe por TODAS las suscripciones, no sólo las activas', () => {
    // Las canceladas son las que interesan.
    expect(s).toContain("status: 'all'")
  })

  it('y omite el campo cuando no hay prueba', () => {
    // Mandar `trial_period_days: 0` no es lo mismo que no mandarlo.
    expect(s).toContain("...(prueba.dias !== undefined ? { trial_period_days: prueba.dias } : {})")
  })

  it('una consulta fallida no tumba la compra', () => {
    const i = s.indexOf('stripe.subscriptions.list')
    expect(s.slice(i - 200, i + 400)).toContain('catch')
  })
})

describe('la marca la escribe el webhook, no la compra', () => {
  const s = leer('src', 'app', 'api', 'stripe', 'webhook', 'route.ts')

  it('se marca al completarse el pago', () => {
    /**
     * Al ABRIR la sesión de compra todavía no se sabe si el médico va a
     * terminar; marcarla ahí le quitaría la prueba a quien sólo abandonó el
     * formulario.
     */
    expect(s).toContain('await marcarPruebaEstrenada(clinicId, nuevaSubId)')
  })

  it('sólo si la suscripción nació CON prueba', () => {
    expect(s).toContain('if (!sub.trial_end && !sub.trial_start) return')
  })

  it('y nunca se sobrescribe: la fecha que importa es la de la primera', () => {
    expect(s).toContain("if (snap.get('pruebaEstrenadaEn')) return")
  })

  it('fallar al marcar no rompe la activación del plan', () => {
    const i = s.indexOf('async function marcarPruebaEstrenada')
    expect(s.slice(i, i + 1200)).toContain('catch')
  })
})

describe('está escrito por qué', () => {
  it('la razón se guarda en el código, no sólo en la bitácora', () => {
    expect(POR_QUE_UNA_SOLA_PRUEBA).toMatch(/cortesía de bienvenida/i)
    expect(POR_QUE_UNA_SOLA_PRUEBA).toMatch(/gratis/i)
  })
})
