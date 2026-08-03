/**
 * GOLDEN — devolver dinero no puede subir el ingreso.
 *
 * ── EL FALLO, DE LA AUDITORÍA DE LANZAMIENTO ─────────────────────────────────
 *
 * `platform_payments` guarda cobros, reembolsos y contracargos en la **misma
 * colección**, todos con `monto` positivo: el signo lo decide el `tipo`.
 *
 * La ruta que alimenta la consola del dueño sumaba `Number(p.monto)` en crudo, así
 * que un reembolso **aumentaba** el ingreso total, el del mes, y lo «pagado» por
 * esa clínica — que es el número con el que se decide si alguien está al
 * corriente. Devolverle dinero a un cliente lo hacía parecer mejor pagador.
 *
 * Y no era que faltara la herramienta: **las dos rutas hermanas ya lo habían
 * cerrado** (`superadmin/contabilidad` y `facturacion/pagos`) usando
 * `tipoDeAsiento`/`efectivoDe`. Ésta se quedó atrás — y es la que se ve primero
 * al abrir la consola.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { efectivoDe, tipoDeAsiento, POR_QUE_LA_DISPUTA_ABIERTA_YA_RESTA } from '@/lib/finanzas/movimientos'

describe('el signo lo decide el TIPO, no el monto', () => {
  it('un cobro suma', () => {
    expect(efectivoDe({ tipo: 'cobro', monto: 1500 })).toBe(1500)
  })

  it('un reembolso RESTA, aunque su monto sea positivo', () => {
    expect(efectivoDe({ tipo: 'reembolso', monto: 1500 })).toBe(-1500)
  })

  it('una disputa abierta ya resta', () => {
    // Stripe retiene el importe en cuanto se abre y sólo lo devuelve si se gana:
    // contarla al perderla mostraría un saldo que el banco no tiene.
    expect(efectivoDe({ tipo: 'contracargo', monto: 900, estadoDisputa: 'abierta' })).toBe(-900)
    expect(efectivoDe({ tipo: 'contracargo', monto: 900, estadoDisputa: 'ganada' })).toBe(0)
    expect(POR_QUE_LA_DISPUTA_ABIERTA_YA_RESTA).toMatch(/dinero que no está/)
  })

  it('un asiento viejo sin `tipo` se lee como cobro', () => {
    // Antes de este campo todos eran cobros; tratarlos como desconocidos
    // mostraría una caída de ingresos que nunca ocurrió.
    expect(tipoDeAsiento({})).toBe('cobro')
    expect(tipoDeAsiento({ tipo: 'reembolso' })).toBe('reembolso')
  })
})

describe('la consola del dueño usa ese criterio', () => {
  const ruta = readFileSync(
    join(process.cwd(), 'src', 'app', 'api', 'superadmin', 'clientes', 'route.ts'), 'utf8')

  it('ya no suma el monto en crudo', () => {
    expect(ruta).not.toContain('ingresoTotal += monto')
    expect(ruta).not.toContain('const monto = Number(p.monto ?? 0)')
  })

  it('los tres números salen del efectivo', () => {
    // El total, el del mes y lo pagado por clínica: los tres se leían mal.
    expect(ruta).toContain('ingresoTotal += efectivo')
    expect(ruta).toContain('ingresoMes += efectivo')
    expect(ruta).toContain('pagadoPorClinica.set(cid, (pagadoPorClinica.get(cid) ?? 0) + efectivo)')
  })

  it('y la disputa se pasa, no se ignora', () => {
    expect(ruta).toContain('estadoDisputa: p.estadoDisputa as EstadoDisputa | undefined')
  })
})

describe('las tres rutas de dinero del dueño coinciden', () => {
  const leer = (...p: string[]) =>
    readFileSync(join(process.cwd(), 'src', 'app', 'api', ...p), 'utf8')

  it('las tres leen el `tipo` con el mismo criterio', () => {
    /**
     * Las dos que SUMAN usan `efectivoDe` para el signo. La de facturación no
     * necesita signo —un reembolso no se factura, se excluye— pero sí el mismo
     * `tipoDeAsiento`: tres formas de leer el `tipo` es cómo se llega a tres
     * respuestas distintas sobre el mismo dinero.
     */
    for (const r of [
      ['superadmin', 'clientes', 'route.ts'],
      ['superadmin', 'contabilidad', 'route.ts'],
      ['facturacion', 'pagos', 'route.ts'],
    ]) {
      expect(leer(...r), r.join('/')).toContain('@/lib/finanzas/movimientos')
    }
  })

  it('la de facturación EXCLUYE el reembolso en vez de restarlo', () => {
    // Facturar es otra pregunta que sumar: un reembolso no es un ingreso
    // negativo que se factura, es algo que no se factura.
    const s = leer('facturacion', 'pagos', 'route.ts')
    expect(s).toContain("if (tipo === 'reembolso' || tipo === 'contracargo') return false")
  })
})
