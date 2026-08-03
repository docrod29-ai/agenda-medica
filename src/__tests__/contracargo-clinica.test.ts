/**
 * GOLDEN — un contracargo pertenece a una clínica, y el dueño se entera.
 *
 * ── EL FALLO, DE LA AUDITORÍA DE LANZAMIENTO ─────────────────────────────────
 *
 * Los dos manejadores de contracargo hacían:
 *
 *     (d.charge as { customer?: string })?.customer
 *
 * y `Dispute.charge` es un **string** —el id del cargo—, nunca viene expandido en
 * un webhook. El `customer` era **siempre `undefined`**, así que **ningún
 * contracargo se atribuía a su clínica**:
 *
 *  · el asiento quedaba huérfano, y el dinero retirado no restaba del ingreso de
 *    esa clínica —desde v925 el ingreso se calcula por `clinicId`—;
 *  · `disputaAbierta` no se marcaba nunca, así que el aviso que el propio código
 *    llama imprescindible «el mismo día» **no aparecía jamás**.
 *
 * Un contracargo es dinero ya retirado por el banco más una comisión, con un
 * plazo para responder con pruebas. Enterarse tarde es perder por incomparecencia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const webhook = readFileSync(
  join(process.cwd(), 'src', 'app', 'api', 'stripe', 'webhook', 'route.ts'), 'utf8')

describe('ya no se lee un campo que nunca viene', () => {
  it('desapareció el `d.charge.customer`', () => {
    // Un `as` sobre una forma que el SDK no promete es lo que dejó pasar esto:
    // el compilador no puede avisar de un campo inventado detrás de un cast.
    expect(webhook).not.toContain('(d.charge as unknown as { customer?: string })')
  })

  it('los dos manejadores usan el resolvedor', () => {
    const veces = (webhook.match(/await clinicIdDeDisputa\(d\)/g) ?? []).length
    expect(veces, 'created y closed').toBe(2)
  })
})

describe('cómo se resuelve, en orden', () => {
  it('primero por nuestros propios asientos, que no cuestan una llamada', () => {
    expect(webhook).toContain("where('chargeId', '==', chargeId)")
    expect(webhook).toContain('if (x.clinicId) return x.clinicId')
    expect(webhook).toContain('if (x.stripeCustomerId) return await getClinicIdByCustomer(x.stripeCustomerId)')
  })

  it('y si no está, se le pregunta a Stripe por el cargo', () => {
    expect(webhook).toContain('await stripe.charges.retrieve(chargeId)')
  })

  it('un cargo sin id no dispara ninguna consulta', () => {
    expect(webhook).toContain('if (!chargeId) return null')
  })

  it('si las dos vías fallan, el asiento queda huérfano DECLARADO', () => {
    // `huerfano: true` ya existía: lo que faltaba era que dejara de ser el caso
    // de siempre.
    expect(webhook).toContain('huerfano: !clinicId')
    expect(webhook).toContain('no se pudo resolver la clínica de la disputa')
  })

  it('ni la consulta local ni la de Stripe pueden tumbar el asiento', () => {
    // El movimiento tiene que quedar registrado aunque no se sepa de quién es:
    // perder el asiento es peor que perder la atribución.
    const i = webhook.indexOf('async function clinicIdDeDisputa')
    const cuerpo = webhook.slice(i, webhook.indexOf('async function getClinicIdByCustomer', i))
    expect((cuerpo.match(/catch/g) ?? []).length).toBe(2)
  })
})

describe('y el dueño se entera el mismo día', () => {
  it('la disputa abierta marca la clínica', () => {
    expect(webhook).toContain('disputaAbierta: true')
    expect(webhook).toContain('disputaDesde')
  })

  it('marcar no es suspender', () => {
    // Suspender por una disputa abierta castigaría a quien todavía puede ganarla
    // —y a veces las abre el banco sin que el cliente lo sepa—.
    expect(webhook).toContain('Se MARCA la clínica, no se le suspende')
  })
})
