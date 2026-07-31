/**
 * GOLDEN — normalización de cifras y unidades (etapa 4 del pipeline de dictado).
 *
 * Aquí se comprueba lo que el módulo TIENE que hacer y, sobre todo, lo que
 * **no** puede hacer: convertir un artículo en un número, sumar dos cifras que
 * alguien estaba deletreando, o abreviar una unidad que no era una medida.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizar, normalizarCifras, normalizarUnidades, UNIDADES_HABLADAS,
} from '@/lib/asr/normalizacion'

const n = (t: string) => normalizar(t).texto

describe('Los diez casos críticos del paquete del Dr.', () => {
  it('norepinefrina cero punto quince microgramos por kilo por minuto', () => {
    expect(n('norepinefrina cero punto quince microgramos por kilo por minuto'))
      .toBe('norepinefrina 0.15 mcg/kg/min')
  })

  it('PEEP doce, PIP treinta — y la coma sobrevive', () => {
    expect(n('PEEP doce, PIP treinta')).toBe('PEEP 12, PIP 30')
  })

  it('potasio cinco punto ocho milimoles por litro', () => {
    expect(n('potasio cinco punto ocho milimoles por litro')).toBe('potasio 5.8 mmol/L')
  })

  it('linezolid seiscientos miligramos cada doce horas', () => {
    expect(n('linezolid seiscientos miligramos cada doce horas'))
      .toBe('linezolid 600 mg cada 12 horas')
  })

  it('PaO2 sesenta y PaCO2 cincuenta — la «y» no une dos números distintos', () => {
    expect(n('PaO2 sesenta y PaCO2 cincuenta')).toBe('PaO2 60 y PaCO2 50')
  })

  it('los casos sin cifras no se tocan', () => {
    for (const t of ['ECMO veno venoso', 'CKRT en CVVHDF', 'niega dolor torácico',
      'edema de miembro inferior derecho', 'alergia a penicilina con urticaria']) {
      expect(n(t), t).toBe(t)
    }
  })
})

describe('Regla 1 — «un» y «una» son artículos hasta que se demuestre lo contrario', () => {
  it('no convierte el artículo', () => {
    expect(n('un paciente masculino')).toBe('un paciente masculino')
    expect(n('una vez al día')).toBe('una vez al día')
    expect(n('en una hora lo revaloramos')).toBe('en una hora lo revaloramos')
  })

  it('sí convierte cuando le sigue una unidad', () => {
    expect(n('un gramo de vancomicina')).toBe('1 g de vancomicina')
    expect(n('un miligramo')).toBe('1 mg')
  })

  it('sí convierte cuando forma parte de una cifra mayor', () => {
    expect(n('veintiun mil')).toContain('21000')
  })
})

describe('Regla 2 — dos cifras del mismo rango no se suman', () => {
  it('quien deletrea 120/80 obtiene 1 2 0 y 8 0, no 3 y 8', () => {
    expect(n('presión uno dos cero sobre ocho cero')).toBe('presión 1 2 0 sobre 8 0')
  })

  it('pero las combinaciones legítimas del español sí se acumulan', () => {
    expect(n('ciento cincuenta')).toBe('150')
    expect(n('cuarenta y ocho mil')).toBe('48000')
    expect(n('tres mil doscientas')).toBe('3200')
    expect(n('doscientos veintitrés')).toBe('223')
  })
})

describe('Regla 3 — una unidad hablada sólo se abrevia detrás de una cifra', () => {
  it('deja la prosa en paz', () => {
    expect(n('pesa muchos kilos')).toBe('pesa muchos kilos')
    expect(n('subieron los miligramos sin control')).toBe('subieron los miligramos sin control')
  })

  it('abrevia cuando hay cifra delante', () => {
    expect(n('ochenta kilos')).toBe('80 kg')
    expect(n('dos gramos')).toBe('2 g')
  })

  it('no casa dentro de otra palabra', () => {
    expect(normalizarUnidades('50 gramoso').texto).toBe('50 gramoso')
  })

  it('la unidad que empieza por barra se pega a su cifra', () => {
    expect(n('plaquetas cuarenta y ocho mil por microlitro')).toBe('plaquetas 48000/uL')
  })
})

describe('Lo que el módulo NUNCA hace', () => {
  it('no inventa una cifra donde no la había', () => {
    const t = 'Meropenem gramos cada ocho horas'
    // La cantidad perdida NO se completa: sólo se normaliza el «ocho» que sí está.
    expect(n(t)).toBe('Meropenem gramos cada 8 horas')
  })

  it('no toca lo que ya viene en dígitos', () => {
    expect(n('Meropenem 2 g cada 8 h')).toBe('Meropenem 2 g cada 8 h')
    expect(n('0.15 mcg/kg/min')).toBe('0.15 mcg/kg/min')
  })

  it('conserva acentos, mayúsculas y puntuación del resto del texto', () => {
    const t = 'Está afebril; niega náusea. Diuresis de cien mililitros por hora.'
    expect(n(t)).toBe('Está afebril; niega náusea. Diuresis de 100 mL/h.')
  })

  it('cada cambio queda declarado', () => {
    const r = normalizar('dos gramos')
    expect(r.cambios).toEqual([
      { antes: 'dos', despues: '2', tipo: 'cifra' },
      { antes: 'gramos', despues: 'g', tipo: 'unidad' },
    ])
  })

  it('sin cifras ni unidades no declara ningún cambio', () => {
    expect(normalizar('paciente estable sin datos de sangrado').cambios).toEqual([])
  })
})

describe('Tabla de unidades', () => {
  it('ninguna forma hablada aparece en dos símbolos distintos', () => {
    const vistas = new Map<string, string>()
    for (const [simbolo, formas] of Object.entries(UNIDADES_HABLADAS)) {
      for (const f of formas) {
        const previo = vistas.get(f)
        expect(previo, `«${f}» está en ${previo} y en ${simbolo}`).toBeUndefined()
        vistas.set(f, simbolo)
      }
    }
  })

  it('las formas largas ganan a las cortas', () => {
    // Si «mililitros por kilo» se aplicara antes que «mililitros por kilo por
    // hora», la unidad saldría partida.
    expect(n('seis mililitros por kilo por hora')).toBe('6 mL/kg/h')
    expect(n('seis mililitros por kilo')).toBe('6 mL/kg')
  })

  it('normalizarCifras no toca las unidades y viceversa', () => {
    expect(normalizarCifras('dos gramos').texto).toBe('2 gramos')
    expect(normalizarUnidades('dos gramos').texto).toBe('dos gramos')
  })
})
