/**
 * UN MARGEN CALCULADO SOBRE LA MITAD DE LOS COSTOS NO ES UN MARGEN.
 *
 * En pantalla se ve exactamente igual que uno completo, y de él sale la decisión
 * de a cuánto vender. Por eso este simulador nace incompleto a propósito: lo que
 * no se puede medir es un parámetro vacío, y mientras falte, el resultado lo
 * DECLARA en vez de rellenarlo.
 *
 * Es la misma regla que la tabla de tarifas, y por el mismo motivo: una cifra
 * recordada de memoria produce un número que parece exacto y miente.
 */
import { describe, it, expect } from 'vitest'
import {
  simular, pierdeDinero, PERFILES, OTROS_COSTOS_VACIOS,
  type CostoMedidoPorNota, type OtrosCostosMensuales,
} from '@/lib/finanzas/simulador'

const NORMAL = PERFILES.find(p => p.clave === 'normal')!
const BAJO = PERFILES.find(p => p.clave === 'bajo')!

/** Costos MEDIDOS de ejemplo, en USD por nota. Sintéticos, para la prueba. */
const MEDIDO: CostoMedidoPorNota = {
  rapida: 0.08, estandar: 0.30, maxima: 0.90,
  muestras: { rapida: 120, estandar: 300, maxima: 40 },
}
const OTROS_COMPLETOS: OtrosCostosMensuales = {
  comisionPagoPct: 4, infraPorUsuario: 10, soportePorUsuario: 25, mensajeriaPorUsuario: 5,
}

describe('lo que NO se sabe, se dice', () => {
  it('sin costos medidos no hay margen, y se nombra lo que falta', () => {
    const s = simular({
      precioMXN: 899, usuarios: 100, perfil: NORMAL, usdMxn: 18,
      costoNota: { rapida: null, estandar: null, maxima: null, muestras: { rapida: 0, estandar: 0, maxima: 0 } },
    })
    expect(s.margenMXN).toBeNull()
    expect(s.faltan.join(' ')).toMatch(/costo medido/)
  })

  it('SIN TIPO DE CAMBIO no se puede comparar el costo con el precio', () => {
    // La IA se paga en dólares y el plan se cobra en pesos: sin el cambio, la
    // resta no significa nada.
    const s = simular({ precioMXN: 899, usuarios: 10, perfil: NORMAL, costoNota: MEDIDO, usdMxn: null, otros: OTROS_COMPLETOS })
    expect(s.costoIaMXN).toBeNull()
    expect(s.faltan.join(' ')).toMatch(/tipo de cambio/)
  })

  it('los costos que este sistema no puede medir nacen VACÍOS', () => {
    const s = simular({ precioMXN: 899, usuarios: 10, perfil: NORMAL, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COSTOS_VACIOS })
    expect(s.otrosCostosMXN).toBeNull()
    expect(s.margenMXN).toBeNull()
    for (const t of ['comisión', 'infraestructura', 'soporte', 'mensajería']) {
      expect(s.faltan.join(' ')).toMatch(new RegExp(t, 'i'))
    }
  })

  it('el ingreso SÍ se sabe siempre: no depende de ningún costo', () => {
    const s = simular({ precioMXN: 899, usuarios: 100, perfil: NORMAL, costoNota: MEDIDO, usdMxn: null })
    expect(s.ingresoMXN).toBe(89900)
  })

  it('un motor que el perfil NO usa no hace falta medirlo', () => {
    // El perfil bajo no usa Máxima: exigir su costo bloquearía una simulación
    // que sí se puede hacer entera.
    const sinMaxima: CostoMedidoPorNota = { ...MEDIDO, maxima: null }
    const s = simular({ precioMXN: 349, usuarios: 10, perfil: BAJO, costoNota: sinMaxima, usdMxn: 18, otros: OTROS_COMPLETOS })
    expect(s.margenMXN).not.toBeNull()
  })
})

describe('con todo cargado, la cuenta cierra', () => {
  const completa = simular({
    precioMXN: 899, usuarios: 100, perfil: NORMAL, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COMPLETOS,
  })

  it('no falta nada', () => {
    expect(completa.faltan).toEqual([])
  })

  it('el costo de IA es la mezcla del perfil, por notas, por usuarios, en pesos', () => {
    // 0.3·0.08 + 0.6·0.30 + 0.1·0.90 = 0.294 USD/nota → ×60 notas ×100 usuarios ×18
    expect(completa.costoIaMXN).toBeCloseTo(0.294 * 60 * 100 * 18, 0)
  })

  it('el margen se expresa también en porcentaje', () => {
    expect(completa.margenPct).not.toBeNull()
    expect(completa.margenPct).toBeCloseTo((completa.margenMXN! / completa.ingresoMXN) * 100, 1)
  })
})

describe('EL NÚMERO QUE DE VERDAD SE BUSCA', () => {
  it('dice a partir de cuántas notas ese cliente cuesta más de lo que paga', () => {
    // 0.294 USD × 18 = 5.29 MXN por nota; 899 / 5.29 ≈ 169 notas.
    const s = simular({ precioMXN: 899, usuarios: 1, perfil: NORMAL, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COMPLETOS })
    expect(s.puntoDePerdidaNotas).toBeGreaterThan(150)
    expect(s.puntoDePerdidaNotas).toBeLessThan(200)
  })

  it('se calcula AUNQUE falten los otros costos: aproximado vale más que nada', () => {
    /**
     * Es un techo optimista —el punto real llega antes, con la comisión y la
     * infraestructura— y por eso el margen sigue saliendo nulo. Lo que no se
     * hace es meterlo en el margen como si fuera completo.
     */
    const s = simular({ precioMXN: 899, usuarios: 1, perfil: NORMAL, costoNota: MEDIDO, usdMxn: 18 })
    expect(s.puntoDePerdidaNotas).not.toBeNull()
    expect(s.margenMXN).toBeNull()
  })

  it('el perfil EXTREMO es el que hay que mirar', () => {
    const extremo = PERFILES.find(p => p.clave === 'extremo')!
    const s = simular({ precioMXN: 899, usuarios: 1, perfil: extremo, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COMPLETOS })
    expect(pierdeDinero(s)).toBe(true)
  })

  it('y el bajo no', () => {
    const s = simular({ precioMXN: 899, usuarios: 1, perfil: BAJO, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COMPLETOS })
    expect(pierdeDinero(s)).toBe(false)
  })

  it('sin margen no se AFIRMA que pierda: se dice que no se sabe', () => {
    // Un `false` por defecto sería «este plan gana dinero» sin haberlo calculado.
    const s = simular({ precioMXN: 899, usuarios: 1, perfil: NORMAL, costoNota: MEDIDO, usdMxn: 18 })
    expect(pierdeDinero(s)).toBeNull()
  })
})

describe('los perfiles son escenarios, no mediciones', () => {
  it('cada mezcla de motores suma 1', () => {
    for (const p of PERFILES) {
      const suma = p.mezcla.rapida + p.mezcla.estandar + p.mezcla.maxima
      expect(suma, p.clave).toBeCloseTo(1, 5)
    }
  })

  it('van de menos a más uso, que es lo que hace comparable la tabla', () => {
    for (let i = 1; i < PERFILES.length; i++) {
      expect(PERFILES[i].notasMes).toBeGreaterThan(PERFILES[i - 1].notasMes)
    }
  })
})

describe('entradas raras', () => {
  it('cero usuarios da cero ingreso, no una división por cero', () => {
    const s = simular({ precioMXN: 899, usuarios: 0, perfil: NORMAL, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COMPLETOS })
    expect(s.ingresoMXN).toBe(0)
    expect(s.margenPct).toBeNull()
  })

  it('usuarios fraccionarios se truncan: no existe medio consultorio', () => {
    const s = simular({ precioMXN: 100, usuarios: 2.9, perfil: BAJO, costoNota: MEDIDO, usdMxn: 18, otros: OTROS_COMPLETOS })
    expect(s.ingresoMXN).toBe(200)
  })
})
