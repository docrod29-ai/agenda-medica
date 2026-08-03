/**
 * GOLDEN — el tope de cortesía dejó de cortarle la IA a quien paga.
 *
 * ── EL FALLO, EL MÁS CARO DE LA AUDITORÍA DE NEGOCIO ─────────────────────────
 *
 * `LIMITE_PRUEBA = 30` son los usos gratis al mes con la llave de la plataforma.
 * `pruebaAgotada()` los contaba **sin mirar si el consultorio paga**, y
 * `resolverClaveIA` marca `fuente: 'prueba'` a **cualquiera** que no haya pegado
 * su propia API key — pague o no, porque nada le provisiona una llave al
 * suscribirse.
 *
 * La aritmética: una consulta dictada gasta ~4 usos (`transcribir` + `procesar`
 * + `verificar-nota` + `evidencia`). **30 ÷ 4 ≈ 7 consultas al mes.**
 *
 * Un cliente de Clínica —que pagó por decenas de consultas con IA— recibía en la
 * segunda semana, con un paciente enfrente:
 *
 *   «Se acabó la IA incluida en tu prueba. Activa un plan para seguir usándola»
 *
 * …a alguien que ya activó un plan. Y como el corte va **antes** de mirar
 * créditos e **ignora** `permiteEconomico`, el modo económico que la página de
 * precios promete —«sigue en Rápida sin costo hasta 120 notas más»— nunca se
 * alcanzaba.
 *
 * Todo el sistema de créditos existe y está probado; lo gobernaba un contador de
 * otra época que se disparaba primero. No se había notado porque todavía no hay
 * un cliente de pago que haya corrido un mes completo — se habría notado con el
 * primer reembolso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  aplicaTopeDeCortesia, POR_QUE_NO_APLICA_A_QUIEN_PAGA,
} from '@/lib/finanzas/tope-de-cortesia'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('EL CASO QUE SE ROMPÍA: el cliente que paga', () => {
  it('un consultorio ACTIVO no tiene tope de cortesía', () => {
    expect(aplicaTopeDeCortesia({ status: 'active', plan: 'clinica' })).toBe(false)
  })

  it('ni en periodo de prueba de Stripe, que ya dio su tarjeta', () => {
    expect(aplicaTopeDeCortesia({ status: 'trialing', plan: 'pro' })).toBe(false)
  })

  it('ni con el cobro fallando, mientras el dunning corre', () => {
    /**
     * `past_due` es «el banco rebotó el cargo y Stripe está reintentando». El
     * webhook ya tiene decidido que NO suspende —sólo `unpaid`/`canceled`—, así
     * que cortarle la IA aquí sería castigar dos veces por lo mismo.
     */
    expect(aplicaTopeDeCortesia({ status: 'past_due', plan: 'clinica' })).toBe(false)
  })
})

describe('a quién SÍ le aplica', () => {
  it('a la cuenta que todavía no paga', () => {
    expect(aplicaTopeDeCortesia({ status: 'trial' })).toBe(true)
    expect(aplicaTopeDeCortesia({})).toBe(true)
  })

  it('y a la que dejó de pagar', () => {
    expect(aplicaTopeDeCortesia({ status: 'cancelled', plan: 'pro' })).toBe(true)
    expect(aplicaTopeDeCortesia({ status: 'unpaid', plan: 'pro' })).toBe(true)
  })
})

describe('las dos exenciones que ya existían', () => {
  it('el pase libre del dueño', () => {
    expect(aplicaTopeDeCortesia({ paseLibre: true })).toBe(false)
  })

  it('y la cuenta de cortesía que él regala', () => {
    expect(aplicaTopeDeCortesia({ plan: 'cortesia' })).toBe(false)
  })
})

describe('cuando no se puede leer el consultorio', () => {
  it('se aplica el tope: no se regala la llave del dueño ante un fallo', () => {
    /**
     * De las dos equivocaciones posibles, ésta es la barata: quien tiene plan y
     * se topa por una lectura fallida ve un mensaje y reintenta; quien no lo
     * tiene y se saltara el tope gastaría contra la tarjeta del Dr. sin límite.
     */
    expect(aplicaTopeDeCortesia(null)).toBe(true)
    expect(aplicaTopeDeCortesia(undefined)).toBe(true)
  })
})

describe('el contador lo consulta de verdad', () => {
  const s = leer('src', 'lib', 'ai-keys.ts')

  it('`pruebaAgotada` lee el estado del consultorio antes de contar', () => {
    expect(s).toContain('aplicaTopeDeCortesia(clinica.data() as EstadoConsultorio | undefined)')
  })

  it('y lo lee en paralelo, no encadenado', () => {
    // Es la ruta caliente de todas las llamadas de IA: dos lecturas en serie
    // añadirían latencia a cada nota.
    const i = s.indexOf('export async function pruebaAgotada')
    expect(s.slice(i, i + 900)).toContain('Promise.all([')
  })

  it('sigue fallando ABIERTO si la lectura revienta', () => {
    // Igual que antes: dejar al médico sin la función por un fallo de
    // infraestructura es peor que una llamada de más.
    const i = s.indexOf('export async function pruebaAgotada')
    const bloque = s.slice(i, i + 1800)
    expect(bloque).toContain('catch')
    expect(bloque).toContain('return false')
  })

  it('está escrito POR QUÉ, en el código y no sólo en la bitácora', () => {
    expect(POR_QUE_NO_APLICA_A_QUIEN_PAGA).toMatch(/todavía no paga/i)
    expect(POR_QUE_NO_APLICA_A_QUIEN_PAGA).toMatch(/ya lo activó/i)
  })
})

describe('lo que se conserva del portero', () => {
  const s = leer('src', 'lib', 'ai-keys.ts')

  it('el tope de prueba sigue cortando SIEMPRE a quien está en prueba', () => {
    // Ahí no hay plan que respalde nada, y ésa era la razón original.
    expect(s).toContain('if (prueba) {')
    expect(s).toContain('Se acabó la IA incluida en tu prueba')
  })

  it('y el modo económico sigue disponible para quien paga', () => {
    // Con el tope fuera de su camino, este `return null` por fin se alcanza.
    expect(s).toContain('if (opciones.permiteEconomico) return null')
  })
})
