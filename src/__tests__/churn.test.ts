/**
 * GOLDEN — la tasa de bajas.
 *
 * El MRR dice cuánto entra este mes; esto dice si se sostiene. Un producto con
 * MRR creciente y 15 % de bajas mensuales reemplaza clientes tan rápido como
 * los pierde, y eso no se ve en ninguna suma.
 *
 * Lo que se protege aquí es el DENOMINADOR: se mide contra quienes podían irse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { churnDelMes, tasaLegible, POR_QUE_LAS_PRUEBAS_VAN_APARTE, POR_QUE_NO_SE_SUPONE_LA_DURACION } from '@/lib/finanzas/churn'

const activo = (mrr = 1000) => ({ status: 'active', mrr })
const bajaEn = (fecha: string, mrr = 1000) => ({ status: 'cancelled', canceladaEn: fecha, mrr })

describe('churnDelMes', () => {
  it('mide contra los que PODÍAN irse, no contra los que quedan', () => {
    // 8 activos hoy + 2 que se fueron en el mes = 10 podían irse → 20 %.
    // Dividir entre los 8 que quedan daría 25 %: inflado justo cuando peor va.
    const r = churnDelMes([
      ...Array.from({ length: 8 }, () => activo()),
      bajaEn('2026-07-10'), bajaEn('2026-07-28'),
    ], '2026-07')
    expect(r.bajasDelMes).toBe(2)
    expect(r.base).toBe(10)
    expect(r.tasa).toBeCloseTo(0.2)
  })

  it('las bajas de OTRO mes no cuentan como de éste', () => {
    const r = churnDelMes([activo(), bajaEn('2026-06-15')], '2026-07')
    expect(r.bajasDelMes).toBe(0)
    expect(r.tasa).toBe(0)
  })

  it('suma el MRR que se fue con ellos', () => {
    const r = churnDelMes([activo(2000), bajaEn('2026-07-01', 899), bajaEn('2026-07-20', 1499)], '2026-07')
    expect(r.mrrPerdido).toBe(2398)
  })

  it('sin base NO dice 0 %: dice que no se sabe', () => {
    // Dividir entre cero no es cero. Un tablero nuevo con cero clientes que
    // muestra «0 % de bajas» está afirmando algo que no midió.
    const r = churnDelMes([], '2026-07')
    expect(r.tasa).toBeNull()
    expect(tasaLegible(r.tasa)).toBe('sin base')
  })

  it('las bajas SIN fecha se declaran aparte, no se reparten', () => {
    // Son las anteriores a que se empezara a registrar `canceladaEn`. Meterlas
    // en un mes cualquiera convertiría un acumulado en una tasa falsa.
    const r = churnDelMes([
      activo(),
      { status: 'cancelled', mrr: 500 },        // sin fecha
      bajaEn('2026-07-05'),
    ], '2026-07')
    expect(r.bajasDelMes).toBe(1)
    expect(r.bajasSinFecha).toBe(1)
    expect(r.mrrPerdido).toBe(1000)             // el de la baja sin fecha NO entra
  })

  it('la tasa se lee con un decimal', () => {
    expect(tasaLegible(0.1234)).toBe('12.3 %')
  })
})

/**
 * ── N8 · LA PRUEBA ABANDONADA NO LA CONTABA NADIE ───────────────────────────
 *
 * Una prueba que no cuaja se queda en `status: 'trial'` **para siempre**: nadie
 * la cancela, porque nadie llegó a pagar. Así que no aparecía ni como baja ni
 * como conversión. En un producto que vive de convertir pruebas, ése era el
 * número que faltaba.
 */
describe('LAS PRUEBAS QUE VENCIERON SIN CONVERTIR', () => {
  const prueba = (fin: string | null) => ({ status: 'trial', trialEndsAt: fin })

  it('una prueba que venció en el mes se cuenta', () => {
    const r = churnDelMes([activo(), prueba('2026-07-20T00:00:00.000Z')], '2026-07')
    expect(r.pruebasVencidas).toBe(1)
  })

  it('y NO entra en la tasa de bajas', () => {
    /**
     * Mezclar «un cliente que pagaba se fue» con «una prueba no cuajó» vuelve
     * las dos cifras inútiles: una mide retención y la otra, conversión.
     */
    const r = churnDelMes([activo(), prueba('2026-07-20T00:00:00.000Z')], '2026-07')
    expect(r.bajasDelMes).toBe(0)
    expect(r.tasa).toBe(0)
    expect(r.mrrPerdido).toBe(0)
  })

  it('una prueba que vence después NO está vencida: está en curso', () => {
    const r = churnDelMes([prueba('2026-09-01T00:00:00.000Z')], '2026-07')
    expect(r.pruebasVencidas).toBe(0)
    expect(r.pruebasEnCurso).toBe(1)
  })

  it('una prueba de un mes anterior no se cuenta en éste', () => {
    // Si no, cada mes volvería a contar las mismas pruebas viejas y la cifra
    // sólo podría subir.
    const r = churnDelMes([prueba('2026-05-10T00:00:00.000Z')], '2026-07')
    expect(r.pruebasVencidas).toBe(0)
    expect(r.pruebasEnCurso).toBe(0)
  })

  it('una prueba SIN fecha de fin no se cuenta en ninguna de las dos', () => {
    // No se puede saber si venció, y suponer «catorce días desde el alta» daría
    // por vencida una prueba extendida a mano.
    const r = churnDelMes([prueba(null)], '2026-07')
    expect(r.pruebasVencidas).toBe(0)
    expect(r.pruebasEnCurso).toBe(0)
  })

  it('las que ya convirtieron no son pruebas', () => {
    // Su status ya es `active`: contarlas sería contar dos veces al mismo.
    const r = churnDelMes([{ status: 'active', trialEndsAt: '2026-07-02T00:00:00.000Z', mrr: 1000 }], '2026-07')
    expect(r.pruebasVencidas).toBe(0)
  })

  it('sin pruebas, las dos cifras son 0 y no rompen nada', () => {
    const r = churnDelMes([activo()], '2026-07')
    expect(r.pruebasVencidas).toBe(0)
    expect(r.pruebasEnCurso).toBe(0)
  })

  it('están escritas las dos razones', () => {
    expect(POR_QUE_LAS_PRUEBAS_VAN_APARTE).toMatch(/retención y la segunda, conversión/)
    expect(POR_QUE_NO_SE_SUPONE_LA_DURACION).toMatch(/extendió a mano/)
  })
})

describe('Y EL TABLERO LO ENSEÑA', () => {
  const page = readFileSync(join(process.cwd(), 'src', 'app', 'superadmin', 'contabilidad', 'page.tsx'), 'utf8')

  it('hay un indicador propio, separado del de bajas', () => {
    expect(page).toContain("lab: 'Pruebas vencidas'")
    expect(page).toContain('pruebasEnCurso')
  })

  it('y la ruta manda la fecha de fin de prueba', () => {
    const ruta = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'superadmin', 'contabilidad', 'route.ts'), 'utf8')
    expect(ruta).toContain('trialEndsAt: c.trialEndsAt ? String(c.trialEndsAt) : null')
  })

  it('el MRR perdido de una baja usa su ciclo y sus asientos, no el precio de lista', () => {
    // Con el precio de lista, una baja anual multi-médico se contaba mal en las
    // dos direcciones a la vez.
    const ruta = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'superadmin', 'contabilidad', 'route.ts'), 'utf8')
    expect(ruta).toContain("mrr: mrrDe({ plan: String(c.plan ?? 'trial'), ciclo: c.ciclo as string | undefined, medicosContratados: Number(c.medicosContratados ?? 1) }).mensual")
  })
})
