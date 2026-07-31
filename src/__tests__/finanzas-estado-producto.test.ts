/**
 * GOLDEN — estados de producto (P1-3 de la auditoría · Master Loop V3 §BJ–BW).
 *
 * Antes NADA distinguía un módulo terminado de uno experimental, así que UCI y
 * Hospital eran vendibles en cuanto alguien cambiara un plan — justo lo que §BH
 * prohíbe.
 *
 * La regla que se protege: **que el fundador pueda USAR un módulo no lo pone a
 * la venta.** Cuando alguien paga por un módulo, la aplicación afirma que está
 * terminado.
 */
import { describe, it, expect } from 'vitest'
import {
  PRODUCTOS, productoDe, sePuedeVender, productosALaVenta, porQueNoSeVende,
  visiblesPara, accesoDeFundador, etiquetaInterna, ESTADOS,
  PRODUCTOS_DEL_PLAN, planSeVende, loQueFrena,
} from '@/lib/finanzas/estado-producto'
import { PLANES } from '@/lib/planes-ia'

describe('Lo que se vende hoy es Agenda y Consulta. Nada más.', () => {
  it('§BI: la fase pública inicial son Free, Agenda y Consulta', () => {
    expect(productosALaVenta().map(p => p.clave).sort()).toEqual(['agenda', 'consulta', 'free'])
  })

  it('UCI y Hospital NO se pueden vender', () => {
    expect(sePuedeVender('uci')).toBe(false)
    expect(sePuedeVender('hospital')).toBe(false)
  })

  it('Complete y Acute tampoco: dependen de los dos anteriores', () => {
    expect(sePuedeVender('complete')).toBe(false)
    expect(sePuedeVender('acute')).toBe(false)
  })

  it('y se sabe POR QUÉ no se venden, con su razón escrita', () => {
    expect(porQueNoSeVende('uci')).toMatch(/ALPHA/)
    expect(porQueNoSeVende('uci')).toMatch(/constru/i)
    expect(porQueNoSeVende('agenda')).toBeNull()
  })
})

describe('Estado y permiso son dos preguntas distintas', () => {
  it('el fundador ve TODO, esté o no lanzado', () => {
    expect(accesoDeFundador().sort()).toEqual(PRODUCTOS.map(p => p.clave).sort())
    expect(visiblesPara([], true)).toHaveLength(PRODUCTOS.length)
  })

  it('pero eso NO pone nada a la venta', () => {
    // La diferencia no es de permisos, es de promesa.
    expect(visiblesPara([], true).some(p => p.clave === 'uci')).toBe(true)
    expect(sePuedeVender('uci')).toBe(false)
  })

  it('al cliente NO se le enseñan candados de lo que no compró', () => {
    // §D: «no llenar la interfaz con Hospital 🔒 UCI 🔒 ECMO 🔒».
    const v = visiblesPara(['agenda', 'consulta'], false)
    expect(v.map(p => p.clave).sort()).toEqual(['agenda', 'consulta'])
    expect(v.some(p => p.clave === 'uci')).toBe(false)
  })

  it('el fundador sí ve en qué estado anda cada cosa', () => {
    expect(etiquetaInterna(productoDe('uci')!)).toBe('ALPHA')
    expect(etiquetaInterna(productoDe('agenda')!)).toBe('')
  })
})

describe('Hacen falta DOS condiciones para vender', () => {
  it('estado maduro Y aprobación explícita de compra', () => {
    /**
     * Un solo campo permitiria poner algo a la venta por descuido al madurar su
     * estado. Poner un producto a la venta es una decision comercial que alguien
     * toma (§CF exige cinco «go» explicitos), no un efecto secundario.
     */
    for (const p of PRODUCTOS) {
      if (sePuedeVender(p.clave)) {
        expect(p.compraPublica, p.clave).toBe(true)
        expect(['PUBLIC', 'EARLY_ACCESS'], p.clave).toContain(p.estado)
      }
    }
  })

  it('un producto INTERNAL nunca se vende, aunque tuviera la casilla', () => {
    const interno = PRODUCTOS.filter(p => p.estado === 'INTERNAL')
    expect(interno.length).toBeGreaterThan(0)
    for (const p of interno) expect(sePuedeVender(p.clave), p.clave).toBe(false)
  })
})

describe('Higiene del catálogo', () => {
  it('cada producto declara su estado y su razón', () => {
    for (const p of PRODUCTOS) {
      expect(ESTADOS, p.clave).toContain(p.estado)
      expect(p.porQue.length, p.clave).toBeGreaterThan(20)
    }
  })

  it('no hay claves repetidas', () => {
    expect(new Set(PRODUCTOS.map(p => p.clave)).size).toBe(PRODUCTOS.length)
  })

  it('un producto que no existe no se vende ni revienta', () => {
    expect(sePuedeVender('inventado')).toBe(false)
    expect(productoDe('inventado')).toBeNull()
  })
})

describe('Del plan comercial al producto: qué se puede cobrar', () => {
  it('los planes de consultorio sí se cobran', () => {
    expect(planSeVende('agenda')).toBe(true)
    expect(planSeVende('clinica')).toBe(true)
    expect(planSeVende('premium')).toBe(true)
  })

  it('«Hospital + UCI» NO se cobra, y se dice qué lo frena', () => {
    expect(planSeVende('hospital')).toBe(false)
    expect(loQueFrena('hospital').sort()).toEqual(['hospital', 'uci'])
    // Los otros dos módulos del paquete sí están listos, y aun así no se vende.
    expect(loQueFrena('hospital')).not.toContain('consulta')
  })

  it('basta UN módulo en obra para frenar el plan entero', () => {
    // Un plan es una promesa única: quien paga «Hospital + UCI» no compra cuatro
    // cosas sueltas, y no se le entregan tres terminadas y una a medias.
    for (const [plan, ps] of Object.entries(PRODUCTOS_DEL_PLAN)) {
      expect(planSeVende(plan), plan).toBe(ps.every(c => sePuedeVender(c)))
    }
  })

  it('un plan desconocido no se cobra', () => {
    // El endpoint de checkout recibe el plan del cuerpo de la petición.
    expect(planSeVende('')).toBe(false)
    expect(planSeVende('enterprise-custom')).toBe(false)
  })

  it('todo plan del catálogo comercial está mapeado a sus módulos', () => {
    // Si mañana se agrega un plan a `planes-ia.ts` y nadie lo mapea aquí,
    // `planSeVende` lo rechazaría en producción sin explicar por qué. Que falle
    // el test es mucho mejor que que falle el cobro.
    for (const clave of Object.keys(PLANES)) {
      expect(PRODUCTOS_DEL_PLAN[clave], `plan ${clave} sin módulos declarados`).toBeDefined()
    }
  })
})
