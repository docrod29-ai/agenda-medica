/**
 * GOLDEN — D-061 · tres paquetes a la venta, y el de en medio es ESCRITO.
 *
 * ── LA DECISIÓN ──────────────────────────────────────────────────────────────
 *
 * El dueño reorganizó la oferta (12-sep-2026): Agenda (399), Expediente (699)
 * y Consulta (1 190). Pro y Hospital dejan de venderse pero siguen existiendo
 * para quien ya los paga. Expediente es el escalón que no existía: agenda y
 * expediente completo —notas a mano con plantillas, recetas y órdenes con la
 * revisión determinista de dosis, farmacia, CRM, finanzas, cumplimiento— SIN
 * IA de voz. Al dueño no le cuesta ningún modelo; al médico que teclea o
 * desconfía de la IA le da todo lo demás.
 *
 * ── POR QUÉ LA IA SE APAGA POR PLAN Y NO POR MÓDULO ──────────────────────────
 *
 * Las diecisiete rutas de IA pasan por `verificarModuloIA(req, 'expediente')`:
 * el mismo módulo que abre las pantallas. Partirlo en dos módulos obligaría a
 * migrar `clinic.modulos` de todos los consultorios activos, y una migración
 * a medias deja sin dictado a quien paga. Un `iaVoz: false` en el catálogo
 * sólo alcanza a quien contrate el plan nuevo. Falla abierto: prueba,
 * cortesía, legados y pase libre siguen igual que hoy.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. El servidor cierra la IA para el plan escrito ANTES de tocar ninguna
 *    llave. Esconder el botón de grabar no cierra una ruta HTTP.
 * 2. Todo catálogo derivado (Stripe, importes, productos, módulos, paywall,
 *    precios, portada, ayuda) conoce la clave nueva. Un mapa que no la
 *    conozca cae a «clinica» en silencio o lanza al comprar.
 * 3. El importe en centavos del deductor de Stripe coincide con el catálogo:
 *    si se separan, una suscripción real se deduce como otro plan.
 * 4. La pantalla de consulta, con plan escrito, no pinta la grabadora y sí
 *    dice por qué; las secciones se escriben a mano igual que siempre.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No toca Stripe: los precios nuevos (399, 699, 1 190) y los ids
 *   `STRIPE_PRICE_EXPEDIENTE*` los crea el dueño en su consola; hasta
 *   entonces el checkout de Expediente responde 409 por precio faltante, que
 *   es lo correcto (no se cobra otra cosa).
 * · No renombra la clave `clinica`: hay suscripciones vivas con ese metadato.
 *   El NOMBRE es «Consulta»; la clave sigue siendo `clinica`.
 * · El médico extra de Expediente se cobra al precio del nivel `pro` (499),
 *   igual que Consulta. Bajarlo a 299 pide un precio de asiento propio en
 *   Stripe; queda como pendiente del dueño.
 * · No recorre la pantalla en un navegador: eso es la regla de diseño y se
 *   hace a mano antes de publicar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PLANES, PLANES_ORDEN, PLANES_EN_VENTA, planIncluyeIA, AVISO_PLAN_ESCRITO, TOPE_ECONOMICO, MOTORES,
} from '@/lib/planes-ia'
import { MODULOS_DE_PLAN, modulosDe, tieneModulo, PAQUETES_SUGERIDOS, PAQUETES_VERSION } from '@/lib/modulos'
import { IMPORTE_MENSUAL, CLAVES_PLAN, esClavePlan } from '@/lib/finanzas/plan-de-suscripcion'
import { PRODUCTOS_DEL_PLAN, planSeVende } from '@/lib/finanzas/estado-producto'
import { STRIPE_PRICES, STRIPE_PRICES_ANUAL, PLAN_NAMES, nivelDePlan, priceMedicoDe } from '@/lib/stripe'
import { ocultaSinIA, RUTAS_CON_IA } from '@/lib/navegacion/rutas-con-ia'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('D-061 · el catálogo: tres a la venta, dos que sólo quedan para quien ya paga', () => {
  it('se venden Agenda, Expediente y Consulta, en ese orden', () => {
    expect([...PLANES_EN_VENTA]).toEqual(['agenda', 'expediente', 'clinica'])
    expect(PLANES_EN_VENTA.map(c => PLANES[c].nombre)).toEqual(['Agenda', 'Expediente', 'Consulta'])
    expect(PLANES_EN_VENTA.map(c => PLANES[c].precioMXN)).toEqual([399, 699, 1190])
  })

  it('Pro y Hospital existen pero no se venden', () => {
    expect(PLANES.premium.enVenta).toBe(false)
    expect(PLANES.hospital.enVenta).toBe(false)
    // Y siguen en el orden general: quien los paga los ve en su configuración.
    expect(PLANES_ORDEN).toContain('premium')
    expect(PLANES_ORDEN).toContain('hospital')
  })

  it('Expediente es escrito: sin créditos, sin IA de voz, precio por encima de Agenda y por debajo de Consulta', () => {
    const e = PLANES.expediente
    expect(e.creditos).toBe(0)
    expect(e.iaVoz).toBe(false)
    expect(PLANES.agenda.iaVoz).toBe(false)
    expect(PLANES.clinica.iaVoz).toBe(true)
    expect(e.precioMXN).toBeGreaterThan(PLANES.agenda.precioMXN)
    expect(e.precioMXN).toBeLessThan(PLANES.clinica.precioMXN)
    expect(e.incluye.join(' ')).toMatch(/sin ia de voz/i)
  })

  it('Consulta trae 150 notas Estándar y un tope económico de 20, no de 120', () => {
    expect(Math.floor(PLANES.clinica.creditos / MOTORES.estandar.creditos)).toBe(150)
    expect(TOPE_ECONOMICO.pro).toBe(20)
    expect(PLANES.clinica.incluye.join(' ')).toContain(String(TOPE_ECONOMICO.pro))
  })

  it('ningún plan a la venta nombra un proveedor ni un modelo en lo que promete', () => {
    const marca = /haiku|sonnet|\bopus\b|gpt|openai|anthropic|assemblyai|whisper/i
    for (const c of PLANES_EN_VENTA) {
      for (const linea of PLANES[c].incluye) expect(linea, `${c}: ${linea}`).not.toMatch(marca)
    }
  })
})

describe('D-061 · la IA se apaga por plan, y falla ABIERTO', () => {
  it('sólo los planes del catálogo con iaVoz:false la apagan', () => {
    expect(planIncluyeIA('expediente')).toBe(false)
    expect(planIncluyeIA('agenda')).toBe(false)
    expect(planIncluyeIA('clinica')).toBe(true)
    expect(planIncluyeIA('premium')).toBe(true)
    expect(planIncluyeIA('hospital')).toBe(true)
  })

  it('AL REVÉS: prueba, cortesía, legados y «sin plan» conservan la IA que tienen hoy', () => {
    for (const p of ['trial', 'cortesia', 'basico', 'pro', '', undefined, null]) {
      expect(planIncluyeIA(p), String(p)).toBe(true)
    }
  })

  it('el aviso habla del plan y de la salida, no de créditos ni de saldo', () => {
    expect(AVISO_PLAN_ESCRITO).toMatch(/Expediente/)
    expect(AVISO_PLAN_ESCRITO).toMatch(/Consulta/)
    expect(AVISO_PLAN_ESCRITO).not.toMatch(/crédito|saldo|tarjeta/i)
  })

  it('el servidor cierra la IA para el plan escrito en la compuerta común, tras el módulo y antes de la llave', () => {
    const src = leer('src/lib/auth-server.ts')
    const codigo = sinComentarios(src)
    expect(src).toContain("import { planIncluyeIA, AVISO_PLAN_ESCRITO } from './planes-ia'")
    expect(codigo).toContain('if (!clinic?.paseLibre && !planIncluyeIA(clinic?.plan)) {')
    expect(codigo).toContain('return err(403, AVISO_PLAN_ESCRITO)')
    // Orden: primero el módulo, luego el plan escrito, luego la paywall.
    const iModulo = codigo.indexOf('if (!tieneModulo(clinic ?? null, modulo))')
    const iPlan = codigo.indexOf('!planIncluyeIA(clinic?.plan)')
    const iPaywall = codigo.indexOf('estadoPaywall(')
    expect(iModulo).toBeGreaterThan(0)
    expect(iPlan).toBeGreaterThan(iModulo)
    expect(iPaywall).toBeGreaterThan(iPlan)
  })

  it('el webhook no le fija nivel de IA a un plan sin IA', () => {
    const src = sinComentarios(leer('src/app/api/stripe/webhook/route.ts'))
    expect(src).toContain('if (planIncluyeIA(plan)) {')
    expect(src).not.toContain("if (plan !== 'agenda') {")
  })
})

describe('D-061 · todo catálogo derivado conoce la clave nueva', () => {
  it('módulos: Expediente abre el consultorio entero (la IA se apaga aparte)', () => {
    expect(MODULOS_DE_PLAN.expediente).toEqual(MODULOS_DE_PLAN.clinica)
    expect(modulosDe({ plan: 'expediente' })).toContain('expediente')
    expect(tieneModulo({ plan: 'expediente' }, 'expediente')).toBe(true)
    expect(tieneModulo({ plan: 'expediente' }, 'hospitalizacion')).toBe(false)
  })

  it('importes en centavos del deductor de Stripe = catálogo × 100, plan por plan', () => {
    for (const c of PLANES_ORDEN) {
      expect(IMPORTE_MENSUAL[c], c).toBe(PLANES[c].precioMXN * 100)
    }
    expect([...CLAVES_PLAN]).toEqual([...PLANES_ORDEN])
    expect(esClavePlan('expediente')).toBe(true)
  })

  it('productos, Stripe y nombres: la clave existe en cada mapa', () => {
    expect(PRODUCTOS_DEL_PLAN.expediente).toEqual(['agenda', 'consulta'])
    expect(planSeVende('expediente')).toBe(true)
    expect('expediente' in STRIPE_PRICES).toBe(true)
    expect('expediente' in STRIPE_PRICES_ANUAL).toBe(true)
    expect(PLAN_NAMES.expediente).toBe('Expediente')
    expect(PLAN_NAMES.clinica).toBe('Consulta')
    expect(nivelDePlan('expediente')).toBe('pro')
    // Sin variable de entorno el precio del asiento es '', nunca el de otro plan.
    expect(priceMedicoDe('expediente')).toBe(process.env.STRIPE_PRICE_EXPEDIENTE_MEDICO ?? '')
  })

  it('los paquetes sugeridos del superadmin van con el catálogo y con versión nueva', () => {
    const ids = PAQUETES_SUGERIDOS.map(p => p.id)
    expect(ids.slice(0, 3)).toEqual(['agenda', 'expediente', 'clinica'])
    const exp = PAQUETES_SUGERIDOS.find(p => p.id === 'expediente')!
    expect(exp.precio).toBe(PLANES.expediente.precioMXN)
    expect(exp.modulos).toEqual(MODULOS_DE_PLAN.expediente)
    expect(PAQUETES_VERSION).toBeGreaterThanOrEqual(8)
  })

  it('paywall, precios y portada enseñan lo que se vende, no una lista tecleada', () => {
    expect(leer('src/app/(dashboard)/layout.tsx')).toContain("const CLAVES_GATE = ['agenda', 'expediente', 'clinica'] as const")
    expect(leer('src/app/precios/page.tsx')).toContain('{PLANES_EN_VENTA.map(k => <Card key={k} plan={planes[k]} />)}')
    expect(leer('src/app/page.tsx')).toContain('const PLANES_PORTADA = PLANES_EN_VENTA.map(k => {')
    expect(leer('src/app/(dashboard)/configuracion/page.tsx')).toContain('{PLANES_EN_VENTA\n              .filter(p => p !== plan)')
  })
})

describe('D-061 · la pantalla de consulta en plan escrito', () => {
  const consulta = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

  it('lee el consultorio y decide «plan escrito» fallando abierto', () => {
    expect(consulta).toContain('const planEscrito = !!clinic && !clinic.paseLibre && !planIncluyeIA(clinic.plan)')
  })

  it('con plan escrito no pinta la grabadora, y dice por qué con la salida a Consulta', () => {
    expect(consulta).toContain('{!firmada && !planEscrito && (')
    expect(consulta).toContain('{!firmada && planEscrito && (')
    expect(consulta).toContain('Tu plan Expediente es escrito: redacta la nota en las secciones de abajo.')
    expect(consulta).toContain('<Link href="/configuracion"')
  })

  it('la grabadora de siempre sigue montada para los demás: no se quita, se condiciona', () => {
    // Lo vigila también `la-maqueta-se-construyo-entera`; aquí se deja dicho el porqué.
    expect(consulta).toContain('<EmpezarAGrabar')
    expect(consulta).toContain('Procesar con IA')
  })

  it('el menú esconde el Consultor a un plan escrito, y sólo a él', () => {
    expect(RUTAS_CON_IA).toContain('/consultor')
    expect(ocultaSinIA({ plan: 'expediente' }, '/consultor')).toBe(true)
    expect(ocultaSinIA({ plan: 'expediente' }, '/pacientes')).toBe(false)
    expect(ocultaSinIA({ plan: 'clinica' }, '/consultor')).toBe(false)
    expect(ocultaSinIA({ plan: 'trial' }, '/consultor')).toBe(false)
    expect(ocultaSinIA({ plan: 'expediente', paseLibre: true }, '/consultor')).toBe(false)
    expect(ocultaSinIA(null, '/consultor')).toBe(false)
    for (const f of ['src/components/Sidebar.tsx', 'src/app/(dashboard)/operaciones/page.tsx']) {
      expect(leer(f), f).toContain('ocultaSinIA(')
    }
  })
})
