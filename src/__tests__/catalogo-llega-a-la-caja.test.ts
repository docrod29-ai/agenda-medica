/**
 * GOLDEN — el catálogo editable llegaba al escaparate y no a la caja.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El catálogo de planes se puede editar desde la consola del dueño, está
 * probado, y lo leen `/api/planes` y la página `/precios`. Pero los TRES sitios
 * donde el número se convierte en dinero o en producto seguían leyendo la
 * constante del código:
 *
 *   · `entitlementsDe` → el CUPO DE CRÉDITOS que se le entrega al consultorio.
 *   · `stripe/asientos` → el precio BASE del cobro mensual por médico.
 *   · `consultor-evidencia` → el tope que corta la IA a media consulta.
 *
 * O sea: el Dr. sube el plan Clínica de $899 a $949, la página pública lo
 * anuncia, y la cuenta del cobro se sigue haciendo con $899. Sube el cupo de
 * créditos y el médico que paga sigue recibiendo el de fábrica.
 *
 * Un ajuste que no llega al cobro ni a la entrega no es un ajuste: es un letrero.
 * Y se rompe de la peor forma — nadie ve un error, simplemente el recibo y la
 * página de precios dicen cosas distintas, y el que lo nota es el cliente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANES } from '@/lib/planes-ia'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

/** El documento que devuelve Firestore, o el fallo que devuelve. */
let respuesta: { exists: boolean; data: () => unknown } | Error = { exists: false, data: () => ({}) }

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: async () => { if (respuesta instanceof Error) throw respuesta; return respuesta },
      }),
    }),
  },
}))
vi.mock('@/lib/security/sanitize', () => ({ safeLog: { warn: () => {}, error: () => {} } }))

const CATALOGO_EDITADO = {
  version: 7,
  ajustes: { clinica: { precioMXN: 949, creditos: 500 }, premium: { precioMXN: 2490 } },
}

beforeEach(async () => {
  const { olvidarCatalogo } = await import('@/lib/finanzas/catalogo-servidor')
  olvidarCatalogo()
  respuesta = { exists: false, data: () => ({}) }
})

describe('EL CASO QUE SE ROMPÍA: el precio editado no llegaba', () => {
  it('con el catálogo guardado, la caja usa el precio NUEVO', async () => {
    respuesta = { exists: true, data: () => CATALOGO_EDITADO }
    const { planVigentePorClave } = await import('@/lib/finanzas/catalogo-servidor')
    const plan = await planVigentePorClave('clinica')
    expect(plan.precioMXN).toBe(949)
    expect(plan.precioMXN).not.toBe(PLANES.clinica.precioMXN)
  })

  it('y el CUPO nuevo, que es lo que el cliente recibe', async () => {
    respuesta = { exists: true, data: () => CATALOGO_EDITADO }
    const { planVigentePorClave } = await import('@/lib/finanzas/catalogo-servidor')
    expect((await planVigentePorClave('clinica')).creditos).toBe(500)
  })

  it('el nivel de IA lleva a la MISMA correspondencia que el código', async () => {
    /**
     * Si aquí se decidiera otra cosa, el cupo entregado y el anunciado volverían
     * a divergir por un camino nuevo — justo lo que se está cerrando.
     */
    respuesta = { exists: true, data: () => CATALOGO_EDITADO }
    const { planVigentePorNivel } = await import('@/lib/finanzas/catalogo-servidor')
    expect((await planVigentePorNivel('premium')).precioMXN).toBe(2490)
    expect((await planVigentePorNivel('pro')).precioMXN).toBe(949)
  })
})

describe('EL CONTROL: sin catálogo guardado no cambia nada', () => {
  it('se usan los valores de fábrica, tal cual', async () => {
    const { planVigentePorClave } = await import('@/lib/finanzas/catalogo-servidor')
    const plan = await planVigentePorClave('clinica')
    expect(plan.precioMXN).toBe(PLANES.clinica.precioMXN)
    expect(plan.creditos).toBe(PLANES.clinica.creditos)
  })
})

describe('si Firestore no responde, NO se corta el servicio', () => {
  it('cae a fábrica en vez de lanzar', async () => {
    /**
     * Cortarle la IA a un intensivista a las tres de la mañana porque no se pudo
     * leer un PRECIO sería una respuesta mucho peor que cobrar con la tarifa del
     * mes pasado. Falla abierto, igual que la cartera de créditos.
     */
    respuesta = new Error('firestore caído')
    const { catalogoVigente } = await import('@/lib/finanzas/catalogo-servidor')
    const r = await catalogoVigente()
    expect(r.deFabrica).toBe(true)
    expect(r.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
  })

  it('y el fallo NO se cachea: al volver Firestore entra el precio bueno', async () => {
    /**
     * Cachear el error alargaría un problema de un instante a un minuto entero
     * de cobros con la tarifa equivocada.
     */
    respuesta = new Error('caído')
    const { catalogoVigente } = await import('@/lib/finanzas/catalogo-servidor')
    expect((await catalogoVigente()).deFabrica).toBe(true)
    respuesta = { exists: true, data: () => CATALOGO_EDITADO }
    expect((await catalogoVigente()).planes.clinica.precioMXN).toBe(949)
  })
})

describe('la caché', () => {
  it('dura lo MISMO que la de la página pública', async () => {
    /**
     * Dos retrasos distintos harían que durante un rato la página de precios y
     * el cobro discreparan — que es exactamente el defecto que esto cierra.
     */
    const { TTL_MS } = await import('@/lib/finanzas/catalogo-servidor')
    const ruta = sinComentarios(leer('src', 'app', 'api', 'planes', 'route.ts'))
    const revalidate = Number(ruta.match(/export const revalidate\s*=\s*(\d+)/)?.[1])
    expect(TTL_MS / 1000).toBe(revalidate)
  })

  it('caduca, y entonces vuelve a leer', async () => {
    respuesta = { exists: true, data: () => CATALOGO_EDITADO }
    const { catalogoVigente } = await import('@/lib/finanzas/catalogo-servidor')
    const t0 = 1_000_000
    expect((await catalogoVigente(t0)).planes.clinica.precioMXN).toBe(949)

    // Cambia el catálogo. Dentro del minuto, sigue el cacheado.
    respuesta = { exists: true, data: () => ({ version: 8, ajustes: { clinica: { precioMXN: 1099 } } }) }
    expect((await catalogoVigente(t0 + 30_000)).planes.clinica.precioMXN).toBe(949)
    // Pasado el minuto, entra el nuevo.
    expect((await catalogoVigente(t0 + 61_000)).planes.clinica.precioMXN).toBe(1099)
  })

  it('y se puede olvidar a mano, para no esperar el minuto tras guardar', async () => {
    respuesta = { exists: true, data: () => CATALOGO_EDITADO }
    const { catalogoVigente, olvidarCatalogo } = await import('@/lib/finanzas/catalogo-servidor')
    await catalogoVigente(1000)
    respuesta = { exists: true, data: () => ({ version: 9, ajustes: { clinica: { precioMXN: 777 } } }) }
    olvidarCatalogo()
    expect((await catalogoVigente(1001)).planes.clinica.precioMXN).toBe(777)
  })
})

describe('GUARDIÁN — los tres sitios leen el catálogo, no la constante', () => {
  const SITIOS: [string, string[]][] = [
    ['el cupo que se entrega', ['src', 'lib', 'ai-keys.ts']],
    ['el precio base del cobro por asiento', ['src', 'app', 'api', 'stripe', 'asientos', 'route.ts']],
    ['el tope que corta la IA', ['src', 'app', 'api', 'consultor-evidencia', 'route.ts']],
  ]

  for (const [que, ruta] of SITIOS) {
    it(`${que}`, () => {
      const codigo = sinComentarios(leer(...ruta))
      expect(codigo, 'debe leer el catálogo vigente').toContain('planVigentePorNivel')
      /**
       * Y NO puede quedar la llamada vieja: dejar las dos es lo que produce que
       * un camino cobre bien y el otro mal, que es peor que estar mal en los dos
       * —porque parece que funciona—.
       */
      expect(codigo, 'no debe quedar la constante de fábrica').not.toMatch(/planPorNivel\(/)
    })
  }

  it('está escrito por qué importa', async () => {
    const { POR_QUE_LA_CAJA_LEE_EL_MISMO_CATALOGO } = await import('@/lib/finanzas/catalogo-servidor')
    expect(POR_QUE_LA_CAJA_LEE_EL_MISMO_CATALOGO).toMatch(/el que lo nota es el cliente/)
  })
})
