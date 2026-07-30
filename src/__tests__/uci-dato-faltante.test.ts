import { describe, it, expect } from 'vitest'
import {
  DERIVACIONES,
  huecoDe,
  huecos,
  soloFaltantes,
  datosQueDesbloquean,
} from '@/lib/uci/dato-faltante'

/**
 * Charter §31 — motor de dato faltante.
 *
 * El caso estrella es el ejemplo literal del Dr.: paciente ventilado con VT, RR,
 * FiO₂ y PEEP documentados pero SIN talla ⇒
 *
 *     «No se puede calcular VT/PBW: falta talla/PBW.»  **No inventar.**
 *
 * Datos 100 % sintéticos.
 */

const vtpbw = DERIVACIONES.find(d => d.campo === 'VT/PBW')!
const driving = DERIVACIONES.find(d => d.campo === 'driving pressure')!

describe('§31 · el ejemplo del Dr — falta la talla para VT/PBW', () => {
  const capturado = { vt: 420, rr: 20, fio2: 40, peep: 8 }   // sin talla ni sexo
  const h = huecoDe(vtpbw, capturado)

  it('detecta que NO se puede calcular', () => {
    expect(h.estado).toBe('faltan_datos')
  })

  it('el mensaje dice QUÉ no se puede calcular y QUÉ falta', () => {
    expect(h.mensaje).toMatch(/^No se puede calcular VT\/PBW: falta /)
    expect(h.mensaje).toMatch(/talla/)
  })

  it('NO inventa un valor ← lo que el charter prohíbe', () => {
    // Estimar una talla «típica» daría un número plausible sobre un dato
    // inventado: el peor error posible, porque es invisible.
    expect(Object.keys(h)).not.toContain('valor')
    expect(Object.keys(h)).not.toContain('estimado')
  })

  it('nombra los datos como los dice el médico, no como se llaman en el código', () => {
    expect(h.mensaje).not.toMatch(/tallaCm/)
    expect(h.faltan).toEqual(['tallaCm', 'sexo'])   // las claves internas sí
  })

  it('con la talla y el sexo ya es calculable, y no hay mensaje', () => {
    const completo = { ...capturado, tallaCm: 170, sexo: 'M' }
    const ok = huecoDe(vtpbw, completo)
    expect(ok.estado).toBe('calculable')
    expect(ok.mensaje).toBeNull()
  })
})

describe('§31 · un cálculo que no aplica ≠ un dato que falta', () => {
  it('con esfuerzo espontáneo, el driving pressure NO APLICA y lo explica', () => {
    // La Pplateau no es interpretable: pedir la Pplat no arreglaría nada.
    const h = huecoDe(driving, { pplat: 22, peep: 8 }, true)
    expect(h.estado).toBe('no_aplica')
    expect(h.faltan).toEqual([])
    expect(h.mensaje).toMatch(/esfuerzo espontáneo/)
  })

  it('«no aplica» no se DEDUCE aquí: lo decide quien llama', () => {
    // Esa evaluación es del motor clínico, no de un buscador de huecos.
    const h = huecoDe(driving, { pplat: 22, peep: 8 })
    expect(h.estado).toBe('calculable')
  })

  it('los tres estados son distinguibles', () => {
    expect(huecoDe(driving, { pplat: 22, peep: 8 }).estado).toBe('calculable')
    expect(huecoDe(driving, { pplat: 22 }).estado).toBe('faltan_datos')
    expect(huecoDe(driving, { pplat: 22, peep: 8 }, true).estado).toBe('no_aplica')
  })
})

describe('§31 · CERO es un dato presente', () => {
  it('un PEEP de 0 NO cuenta como faltante', () => {
    // El clásico `if (!valor)` lo trataría como ausente y pediría un dato que ya
    // está. Un PEEP de 0 existe.
    const h = huecoDe(driving, { pplat: 15, peep: 0 })
    expect(h.estado).toBe('calculable')
  })

  it('NaN e Infinity SÍ cuentan como faltantes', () => {
    expect(huecoDe(driving, { pplat: NaN, peep: 8 }).faltan).toContain('pplat')
    expect(huecoDe(driving, { pplat: Infinity, peep: 8 }).faltan).toContain('pplat')
  })

  it('cadena vacía o de espacios cuenta como faltante', () => {
    const pam = DERIVACIONES.find(d => d.campo === 'presión arterial media')!
    expect(huecoDe(pam, { ta: '   ' }).estado).toBe('faltan_datos')
    expect(huecoDe(pam, { ta: '120/70' }).estado).toBe('calculable')
  })
})

describe('§31 · un solo dato desbloquea varios cálculos', () => {
  const hs = huecos({ vt: 420, peep: 8 })   // falta pplat, talla, sexo, ta, pao2, fio2

  it('la Pplat desbloquea driving pressure Y compliance', () => {
    const d = datosQueDesbloquean(hs).find(x => x.dato === 'pplat')
    expect(d?.desbloquea.sort()).toEqual(['compliance estática', 'driving pressure'])
  })

  it('los datos se piden UNA vez, no una por cálculo', () => {
    // Pedirlos por separado haría teclear lo mismo tres veces.
    const datos = datosQueDesbloquean(hs).map(d => d.dato)
    expect(new Set(datos).size).toBe(datos.length)
  })

  it('se ordenan por cuántos cálculos desbloquean', () => {
    const l = datosQueDesbloquean(hs)
    for (let i = 1; i < l.length; i++) {
      expect(l[i - 1].desbloquea.length).toBeGreaterThanOrEqual(l[i].desbloquea.length)
    }
  })
})

describe('§31 · sólo se avisa de lo que aplica al paciente', () => {
  it('un paciente SIN ventilador no recibe avisos de VT/PBW', () => {
    // Sería ruido, no información.
    const hs = huecos({ ta: '120/70' }, { aplicables: ['presión arterial media'] })
    expect(hs).toHaveLength(1)
    expect(hs[0].campo).toBe('presión arterial media')
  })

  it('`soloFaltantes` deja fuera lo calculable y lo que no aplica', () => {
    const hs = huecos({ ta: '120/70', vt: 420 })
    expect(soloFaltantes(hs).every(h => h.estado === 'faltan_datos')).toBe(true)
    expect(soloFaltantes(hs).some(h => h.campo === 'presión arterial media')).toBe(false)
  })
})

describe('§31 · el catálogo no promete cálculos que no existen', () => {
  it('cada derivación cita su motor REAL, con archivo y función', () => {
    for (const d of DERIVACIONES) {
      expect(d.motor).toMatch(/^src\/lib\/uci\/\w+\.ts · /)
      expect(d.formula).not.toBe('')
      expect(d.requiere.length).toBeGreaterThan(0)
    }
  })

  it('cada entrada requerida tiene un nombre legible para el médico', () => {
    // Si falta, el mensaje mostraría la clave interna y el médico no sabría qué
    // le están pidiendo.
    for (const d of DERIVACIONES) {
      for (const k of d.requiere) {
        expect(d.comoSePide[k], `${d.campo} no sabe cómo pedir «${k}»`).toBeTruthy()
      }
    }
  })

  it('la fórmula de PBW citada es la que ya existe en el repo (ARDSNet/Devine)', () => {
    // No se inventó: `pesoPredichoPBW` ya la implementaba.
    expect(vtpbw.formula).toContain('45.5')
    expect(vtpbw.formula).toContain('0.91')
    expect(vtpbw.motor).toContain('pesoPredichoPBW()')
  })
})
