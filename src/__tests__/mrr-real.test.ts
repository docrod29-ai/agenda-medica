/**
 * GOLDEN — el MRR contaba el precio de lista, no lo que entra cada mes.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 *     const mrr = activa ? precioPlan(plan) : 0
 *
 * Dos errores, y **en direcciones opuestas** — que es peor que un sesgo, porque
 * se compensan y el total parece razonable mientras cada línea está mal:
 *
 * 1. **El anual se sobrestimaba.** El catálogo del propio repositorio dice
 *    `MESES_ANUAL = 10`: doce meses al precio de diez. Un cliente anual paga
 *    diez mensualidades al año, así que contar el precio de lista infla su
 *    ingreso mensual un 20 %. El webhook guarda `ciclo` desde que se venden
 *    anualidades; nadie lo leía.
 *
 * 2. **El multi-médico se subestimaba.** Los asientos adicionales se cobran
 *    aparte y `medicosContratados` dice cuántos cobra la suscripción. No se
 *    sumaban: un consultorio Pro con tres médicos factura el plan más dos
 *    asientos, y la consola decía sólo el plan.
 *
 * ── NINGUNA CIFRA SE INVENTA ─────────────────────────────────────────────────
 *
 * Todos los precios salen de `planes-ia.ts`. Estas pruebas se escriben **contra
 * el catálogo**, no contra números copiados: si mañana sube un precio, siguen
 * valiendo.
 */
import { describe, it, expect } from 'vitest'
import {
  mrrDe, POR_QUE_EL_ANUAL_NO_VALE_EL_PRECIO_DE_LISTA, POR_QUE_CONTRATADOS_Y_NO_PRESENTES,
} from '@/lib/finanzas/mrr'
import { PLANES, MEDICO_EXTRA, MESES_ANUAL } from '@/lib/planes-ia'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ruta = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'superadmin', 'contabilidad', 'route.ts'), 'utf8')

describe('EL CASO SIMPLE NO CAMBIA', () => {
  it('un consultorio mensual de un médico vale el precio del plan', () => {
    // Es la garantía de que esto no mueve las cifras que ya estaban bien.
    for (const clave of ['agenda', 'clinica', 'premium', 'hospital'] as const) {
      expect(mrrDe({ plan: clave }).mensual, clave).toBe(PLANES[clave].precioMXN)
    }
  })

  it('un plan que no está en el catálogo vale 0', () => {
    // Suponer un precio para una clave desconocida sería inventar ingreso.
    expect(mrrDe({ plan: 'plan-que-no-existe' }).mensual).toBe(0)
    expect(mrrDe({ plan: 'trial' }).mensual).toBe(0)
  })
})

describe('EL ANUAL SE PRORRATEA', () => {
  it('doce meses al precio de diez: el ingreso mensual es ×10/12', () => {
    const p = PLANES.premium
    const r = mrrDe({ plan: 'premium', ciclo: 'anual' })
    expect(r.mensual).toBe(Math.round(p.precioMXN * (MESES_ANUAL / 12)))
    expect(r.ciclo).toBe('anual')
  })

  it('y sale MENOS que el precio de lista, no más', () => {
    expect(mrrDe({ plan: 'premium', ciclo: 'anual' }).mensual)
      .toBeLessThan(mrrDe({ plan: 'premium' }).mensual)
  })

  it('la diferencia se devuelve como descuento, no se pierde', () => {
    /**
     * Para que el tablero pueda enseñar que la diferencia con el precio de
     * lista es un descuento y no un error de cuentas.
     */
    const r = mrrDe({ plan: 'premium', ciclo: 'anual' })
    expect(r.descuentoAnual).toBe(PLANES.premium.precioMXN - r.mensual)
    expect(mrrDe({ plan: 'premium' }).descuentoAnual).toBe(0)
  })

  it('cualquier otro valor de ciclo es mensual', () => {
    // Un documento viejo sin el campo no puede convertirse en descuento.
    for (const c of [undefined, null, '', 'Mensual', 'anualidad']) {
      expect(mrrDe({ plan: 'premium', ciclo: c as string | undefined }).ciclo, String(c)).toBe('mensual')
    }
  })
})

describe('LOS ASIENTOS SE SUMAN', () => {
  it('el primer médico va incluido: uno contratado no añade nada', () => {
    expect(mrrDe({ plan: 'premium', medicosContratados: 1 }).extras).toBe(0)
    expect(mrrDe({ plan: 'premium', medicosContratados: 1 }).asientos).toBe(0)
  })

  it('tres médicos en Pro son el plan más DOS asientos', () => {
    const r = mrrDe({ plan: 'premium', medicosContratados: 3 })
    const porAsiento = MEDICO_EXTRA[PLANES.premium.nivelIA].precioMXN
    expect(r.extras).toBe(2)
    expect(r.mensual).toBe(PLANES.premium.precioMXN + 2 * porAsiento)
  })

  it('el precio del asiento depende del nivel del plan, no es uno fijo', () => {
    const proA = mrrDe({ plan: 'clinica', medicosContratados: 2 }).asientos
    const proB = mrrDe({ plan: 'premium', medicosContratados: 2 }).asientos
    expect(proA).toBe(MEDICO_EXTRA[PLANES.clinica.nivelIA].precioMXN)
    expect(proB).toBe(MEDICO_EXTRA[PLANES.premium.nivelIA].precioMXN)
  })

  it('un dato ausente o basura vale un médico, nunca cero ni negativo', () => {
    // Un documento antiguo sin el campo no puede restar ingreso.
    for (const n of [undefined, null, 0, -3, NaN]) {
      const r = mrrDe({ plan: 'premium', medicosContratados: n as number | undefined })
      expect(r.extras, String(n)).toBe(0)
      expect(r.mensual, String(n)).toBe(PLANES.premium.precioMXN)
    }
  })
})

describe('LOS DOS EFECTOS JUNTOS', () => {
  it('un Pro anual con tres médicos: asientos sumados y todo prorrateado', () => {
    const porAsiento = MEDICO_EXTRA[PLANES.premium.nivelIA].precioMXN
    const lista = PLANES.premium.precioMXN + 2 * porAsiento
    const r = mrrDe({ plan: 'premium', ciclo: 'anual', medicosContratados: 3 })
    expect(r.mensual).toBe(Math.round(lista * (MESES_ANUAL / 12)))
    // Y sigue siendo MÁS que el viejo cálculo: los asientos pesan más que el
    // descuento. Por eso los dos errores se compensaban y el total «cuadraba».
    expect(r.mensual).toBeGreaterThan(PLANES.premium.precioMXN)
  })

  it('base y asientos suman el total', () => {
    const r = mrrDe({ plan: 'premium', ciclo: 'anual', medicosContratados: 4 })
    expect(r.base + r.asientos).toBe(r.mensual)
  })
})

describe('Y EL TABLERO LO ENSEÑA — si no, sería otro módulo sin conectar', () => {
  const page = readFileSync(join(process.cwd(), 'src', 'app', 'superadmin', 'contabilidad', 'page.tsx'), 'utf8')

  it('la fila dice cuándo el MRR viene de un anual o de asientos', () => {
    expect(page).toContain("c.mrrCiclo === 'anual' || (c.mrrExtras ?? 0) > 0")
    expect(page).toMatch(/anual −\$\{mxn\(c\.mrrDescuentoAnual \?\? 0\)\}|anual −\$/)
  })

  it('y el CSV lleva las columnas nuevas, con su encabezado al día', () => {
    /**
     * Un encabezado desfasado convierte una exportación en datos mal
     * etiquetados, que es peor que no exportar.
     */
    expect(page).toContain('MRR,Ciclo,Médicos extra,MRR asientos')
    expect(page).toContain("c.mrrCiclo ?? 'mensual', c.mrrExtras ?? 0, c.mrrAsientos ?? 0")
  })
})

describe('LA CONSOLA LO USA', () => {
  it('ya no calcula el MRR con el precio de lista', () => {
    expect(ruta).toContain('const desglose = mrrDe({ plan, ciclo: c.ciclo as string | undefined, medicosContratados: Number(c.medicosContratados ?? 1) })')
    expect(ruta).toContain('const mrr = activa ? desglose.mensual : 0')
  })

  it('y devuelve el desglose para poder explicar la cifra', () => {
    for (const k of ['mrrCiclo', 'mrrAsientos', 'mrrExtras', 'mrrDescuentoAnual']) {
      expect(ruta, k).toContain(k)
    }
  })

  it('una clínica inactiva no aporta desglose', () => {
    // Si no está activa no entra ingreso: enseñar sus asientos sería contar
    // dinero que no llega.
    expect(ruta).toContain('mrrAsientos: activa ? desglose.asientos : 0')
  })

  it('están escritas las dos razones', () => {
    expect(POR_QUE_EL_ANUAL_NO_VALE_EL_PRECIO_DE_LISTA).toMatch(/20 %/)
    expect(POR_QUE_CONTRATADOS_Y_NO_PRESENTES).toMatch(/inventar ingreso/)
  })
})
