/**
 * GOLDEN — N5: la contabilidad valoraba la IA con una cifra inventada teniendo
 * el costo real medido al lado.
 *
 * ── LO QUE HABÍA ─────────────────────────────────────────────────────────────
 *
 *     const COSTO_CREDITO_MXN = Number(process.env.COSTO_CREDITO_MXN ?? '1.5')
 *     const costoIA = creditos * COSTO_CREDITO_MXN
 *
 * Un crédito valía **1.5 pesos porque sí**. El comentario del propio código lo
 * confesaba: «Haiku/Sonnet/Opus rondan ~$1.5 MXN por crédito» — de memoria, sin
 * fuente y sin fecha.
 *
 * Y el libro de costos (`platform_cost_ledger`) lleva desde el 30-jul-2026
 * anotando llamada por llamada los tokens y el costo real en dólares. Nadie lo
 * leía desde la contabilidad. La utilidad, el margen y las decisiones de precio
 * salían de un supuesto **teniendo el dato medido**.
 *
 * ── POR QUÉ NO BASTABA «PONER EL NÚMERO BUENO» ───────────────────────────────
 *
 * Porque no hay un número bueno: un crédito no cuesta lo mismo según el modelo.
 * Una nota con razonamiento extendido y una corrección rápida consumen créditos
 * parecidos y cuestan órdenes de magnitud distintas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  costoIADelMes, costoPorClinica, esDeCliente,
  POR_QUE_NO_HAY_UN_PRECIO_POR_CREDITO, POR_QUE_EL_TIPO_DE_CAMBIO_NO_SE_ESCRIBE_AQUI,
  type AsientoCosto,
} from '@/lib/finanzas/costo-ia-contable'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const ASIENTOS: AsientoCosto[] = [
  { clinicId: 'c1', costoUsd: 0.50, clase: 'customer' },
  { clinicId: 'c1', costoUsd: 0.25, clase: 'customer' },
  { clinicId: 'c2', costoUsd: 1.00, clase: 'customer' },
  { clinicId: 'cF', costoUsd: 9.00, clase: 'rnd' },        // el fundador probando
  { clinicId: 'c3', costoUsd: null, clase: 'customer' },   // modelo sin tarifa
]

describe('CON TIPO DE CAMBIO: se mide', () => {
  const r = costoIADelMes(ASIENTOS, 1000, 1.5, 20)

  it('el costo sale del libro, no de los créditos', () => {
    // 0.50 + 0.25 + 1.00 = 1.75 USD de clientes × 20 = 35 MXN.
    expect(r.fuente).toBe('libro_de_costos')
    expect(r.usdMedido).toBeCloseTo(1.75)
    expect(r.mxn).toBeCloseTo(35)
  })

  it('y el supuesto viejo habría dicho 1 500 MXN', () => {
    // 1000 créditos × 1.5. Cuarenta veces más. Ésa era la cifra sobre la que se
    // miraba el margen.
    expect(1000 * 1.5).toBe(1500)
    expect(r.mxn).toBeLessThan(1500)
  })

  it('el gasto del FUNDADOR no se carga al margen de los clientes', () => {
    /**
     * Lo que el Dr. gasta probando módulos es I+D, no costo de servir. Cargarlo
     * al margen haría que el margen dejara de ser real — y con 9 USD de 10.75
     * siendo suyos, el error no sería pequeño.
     */
    expect(r.usdMedido).not.toBeCloseTo(10.75)
    expect(esDeCliente({ clase: 'rnd' })).toBe(false)
    expect(esDeCliente({ clase: 'llave_propia' })).toBe(false)
    expect(esDeCliente({ clase: 'customer' })).toBe(true)
  })

  it('las llamadas SIN tarifa no se suman como cero, y se dicen', () => {
    /**
     * Sumarlas como cero daría un costo menor del real y, en contabilidad, un
     * **margen mejor del que hay**. Es exactamente la cifra sobre la que se
     * decide un precio.
     */
    expect(r.sinTarifa).toBe(1)
    expect(r.conCosto).toBe(3)
    expect(r.aviso).toMatch(/no tienen tarifa cargada/)
    expect(r.aviso).toMatch(/el margen menor/)
  })

  it('sin huecos, el aviso lo dice sin alarmar', () => {
    const limpio = costoIADelMes(
      [{ clinicId: 'c1', costoUsd: 2, clase: 'customer' }], 100, 1.5, 20,
    )
    expect(limpio.sinTarifa).toBe(0)
    expect(limpio.aviso).toMatch(/Medido en el libro de costos/)
  })
})

describe('SIN TIPO DE CAMBIO: se supone, y se DICE que se supone', () => {
  const r = costoIADelMes(ASIENTOS, 1000, 1.5, null)

  it('cae al supuesto viejo', () => {
    expect(r.fuente).toBe('supuesto')
    expect(r.mxn).toBe(1500)
  })

  it('y el aviso explica por qué esa cifra no es el costo', () => {
    expect(r.aviso).toMatch(/SUPUESTA/)
    expect(r.aviso).toMatch(/gastan créditos parecidos y cuestan/)
    expect(r.aviso).toMatch(/TIPO_CAMBIO_USD_MXN/)
  })

  it('un tipo de cambio absurdo NO se acepta', () => {
    // Un 0 o un negativo colado por variable de entorno daría costo cero y
    // margen perfecto — el error más caro posible en esta pantalla.
    for (const tc of [0, -20, Number.NaN]) {
      expect(costoIADelMes(ASIENTOS, 1000, 1.5, tc).fuente, String(tc)).toBe('supuesto')
    }
  })
})

describe('POR CONSULTORIO', () => {
  it('cada uno paga lo suyo', () => {
    const m = costoPorClinica(ASIENTOS, 20)
    expect(m.get('c1')).toBeCloseTo(15)   // (0.50 + 0.25) × 20
    expect(m.get('c2')).toBeCloseTo(20)
  })

  it('el fundador no aparece como cliente que cuesta', () => {
    expect(costoPorClinica(ASIENTOS, 20).has('cF')).toBe(false)
  })

  it('sin tipo de cambio no se reparte nada inventado', () => {
    expect(costoPorClinica(ASIENTOS, null).size).toBe(0)
  })
})

describe('LAS RAZONES ESTÁN ESCRITAS', () => {
  it('por qué no existe un precio por crédito', () => {
    expect(POR_QUE_NO_HAY_UN_PRECIO_POR_CREDITO).toMatch(/Cualquier constante es falsa/)
  })

  it('por qué el tipo de cambio no se escribe en el código', () => {
    expect(POR_QUE_EL_TIPO_DE_CAMBIO_NO_SE_ESCRIBE_AQUI).toMatch(/DOF/)
    expect(POR_QUE_EL_TIPO_DE_CAMBIO_NO_SE_ESCRIBE_AQUI).toMatch(/igual de exacta que la buena/)
  })
})

describe('ESTÁ CONECTADO — la contabilidad ya lee el libro', () => {
  const ruta = leer('src', 'app', 'api', 'superadmin', 'contabilidad', 'route.ts')

  it('la ruta consulta `platform_cost_ledger`', () => {
    expect(ruta).toContain('platform_cost_ledger')
    expect(ruta).toContain('costoIADelMes')
    expect(ruta).toContain('costoPorClinica')
  })

  it('el tipo de cambio NO trae valor por omisión', () => {
    /**
     * Un 17 o un 20 escritos de memoria darían una conversión que en pantalla se
     * ve igual de exacta que la buena. Si alguien le pone un default, esto se
     * pone rojo.
     */
    expect(ruta).toMatch(/TIPO_CAMBIO = Number\(process\.env\.TIPO_CAMBIO_USD_MXN \?\? ''\) \|\| null/)
  })

  it('si el libro no se puede leer, la contabilidad NO se cae', () => {
    // Perder un renglón de costo es un problema; dejar al dueño sin su pantalla
    // de contabilidad el día que declara es otro tamaño de problema.
    expect(ruta).toMatch(/\.catch\(\(\) => \[\]\)/)
  })

  it('y la respuesta declara de dónde salió la cifra', () => {
    expect(ruta).toContain('costoIAFuente')
  })

  it('la pantalla distingue lo MEDIDO de lo SUPUESTO', () => {
    const page = leer('src', 'app', 'superadmin', 'contabilidad', 'page.tsx')
    expect(page).toContain('Costo de IA MEDIDO')
    expect(page).toContain('Costo de IA SUPUESTO, no medido')
    expect(page).toContain('TIPO_CAMBIO_USD_MXN')
  })
})
