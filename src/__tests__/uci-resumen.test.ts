import { describe, it, expect } from 'vitest'
import {
  numero,
  claveBrief,
  CLAVE_PANEL_A_BRIEF,
  cambiosDeTomas,
  eventosDeTomas,
  clavesSinMetrica,
} from '@/lib/uci/resumen'
import { METRICAS_BRIEF, construirBrief } from '@/lib/uci/morning-brief'
import type { TomaUci } from '@/lib/uci/observaciones'

/**
 * El PUENTE entre las tomas persistidas y los motores del pase.
 *
 * Lo que estos casos protegen es un fallo que NO se ve: si el mapa de nombres se
 * desalinea, el Morning Brief no revienta — sale vacío para siempre y nadie sabe
 * por qué.
 *
 * Datos 100 % sintéticos.
 */

const AHORA = '2026-07-30T12:00:00Z'

const toma = (medidoEn: string, medidas: Record<string, unknown>): TomaUci => ({
  id: medidoEn, medidoEn, registradoEn: medidoEn,
  estado: 'CONFIRMED', por: 'med-ficticio', fuente: 'panel-uci', medidas,
})

describe('el puente no puede desalinearse en silencio', () => {
  it('todo destino del mapa EXISTE como métrica del brief', () => {
    // Si alguien renombra una métrica del charter y no toca este mapa, el brief
    // se queda mudo sin dar un solo error.
    const claves = new Set(METRICAS_BRIEF.map(m => m.clave))
    for (const destino of Object.values(CLAVE_PANEL_A_BRIEF)) {
      expect(claves).toContain(destino)
    }
  })

  it('traduce los dos nombres que el panel guarda distinto', () => {
    expect(claveBrief('norepi')).toBe('ne')
    expect(claveBrief('creat')).toBe('creatinina')
  })

  it('lo que no cambia de nombre pasa igual', () => {
    for (const k of ['fio2', 'peep', 'lactato']) expect(claveBrief(k)).toBe(k)
  })

  it('lista las medidas del panel que HOY no llegan a ninguna métrica', () => {
    // No es un error: es lo que falta por mapear, y se puede ver.
    const t = [toma(AHORA, { peep: 8, pplat: 24, glasgow: 11 })]
    expect(clavesSinMetrica(t)).toEqual(['glasgow', 'pplat'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('VACÍO NO ES CERO ← el bug que la auditoría encontró en 12 motores', () => {
  it('blanco, espacios y basura son null, NO cero', () => {
    // Un 0 inventado en una FiO₂ o en un lactato no es un dato faltante: es un
    // dato FALSO.
    for (const v of ['', '   ', 'sin dato', null, undefined, {}]) {
      expect(numero(v)).toBeNull()
    }
  })

  it('la coma decimal mexicana se entiende, no se pierde', () => {
    expect(numero('12,5')).toBe(12.5)
    expect(numero('12.5')).toBe(12.5)
  })

  it('el CERO de verdad sí es cero', () => {
    expect(numero('0')).toBe(0)
    expect(numero(0)).toBe(0)
  })

  it('un número no finito no pasa', () => {
    expect(numero(NaN)).toBeNull()
    expect(numero(Infinity)).toBeNull()
  })

  it('un espacio guardado NO produce un cambio a cero', () => {
    // Éste es el caso completo del bug: con el `num()` viejo, la segunda toma
    // habría dicho «FiO₂ 60 → 0».
    const t = [toma('2026-07-30T06:00:00Z', { fio2: '60' }), toma('2026-07-30T10:00:00Z', { fio2: '  ' })]
    const { cambios, conUnSoloPunto } = cambiosDeTomas(t, 12, AHORA)
    expect(cambios).toEqual([])
    expect(conUnSoloPunto).toEqual(['fio2'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('cambios para el Morning Brief', () => {
  const tomas = [
    toma('2026-07-30T02:00:00Z', { norepi: '0.18', fio2: '60', peep: '12' }),
    toma('2026-07-30T07:00:00Z', { norepi: '0.10', fio2: '50', peep: '10' }),
    toma('2026-07-30T11:00:00Z', { norepi: '0.06', fio2: '40', peep: '8' }),
  ]

  it('toma el primero de la ventana y el último', () => {
    const { cambios } = cambiosDeTomas(tomas, 12, AHORA)
    expect(cambios).toContainEqual({ clave: 'ne', de: 0.18, a: 0.06 })
  })

  it('y el brief los convierte en la frase del charter', () => {
    // El puente de verdad: de lo guardado a la frase, sin retoques a mano.
    const { cambios } = cambiosDeTomas(tomas, 12, AHORA)
    const b = construirBrief(cambios, 12)
    expect(b.cambios.find(c => c.clave === 'ne')?.texto)
      .toBe('Norepinefrina 0.18 → 0.06 µg/kg/min')
  })

  it('la ventana recorta de verdad', () => {
    // Con 6 h, la toma de las 02:00 queda fuera y el «de» pasa a ser la de 07:00.
    const { cambios } = cambiosDeTomas(tomas, 6, AHORA)
    expect(cambios.find(c => c.clave === 'ne')).toEqual({ clave: 'ne', de: 0.1, a: 0.06 })
  })

  it('con UN SOLO punto no se inventa un delta', () => {
    // Fabricarlo contra sí mismo diría «sin cambio» donde lo que hay es falta de
    // comparación.
    const { cambios, conUnSoloPunto } = cambiosDeTomas([tomas[2]], 12, AHORA)
    expect(cambios).toEqual([])
    expect(conUnSoloPunto.sort()).toEqual(['fio2', 'ne', 'peep'])
  })

  it('las tomas desordenadas se ordenan por cuándo se MIDIÓ', () => {
    const { cambios } = cambiosDeTomas([tomas[2], tomas[0], tomas[1]], 12, AHORA)
    expect(cambios.find(c => c.clave === 'ne')).toEqual({ clave: 'ne', de: 0.18, a: 0.06 })
  })

  it('una toma con fecha inválida se descarta sin romper', () => {
    const { cambios } = cambiosDeTomas([toma('ayer', { norepi: '9' }), ...tomas], 12, AHORA)
    expect(cambios.find(c => c.clave === 'ne')?.de).toBe(0.18)
  })

  it('lo del futuro no entra en la ventana', () => {
    const { cambios } = cambiosDeTomas([...tomas, toma('2026-07-30T23:00:00Z', { norepi: '5' })], 12, AHORA)
    expect(cambios.find(c => c.clave === 'ne')?.a).toBe(0.06)
  })

  it('ventana o instante inválidos LANZAN', () => {
    expect(() => cambiosDeTomas(tomas, 0, AHORA)).toThrowError(/positiva/)
    expect(() => cambiosDeTomas(tomas, 12, 'ahora')).toThrowError(/instante inválido/)
  })

  it('sin tomas: nada, y sin inventar', () => {
    expect(cambiosDeTomas([], 12, AHORA)).toEqual({ cambios: [], conUnSoloPunto: [] })
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('eventos de la línea de tiempo', () => {
  const tomas = [
    toma('2026-07-30T02:00:00Z', { peep: '12' }),
    toma('2026-07-30T07:00:00Z', { peep: '10' }),
    toma('2026-07-30T11:00:00Z', { peep: '10' }),   // repetido
    toma('2026-07-30T11:30:00Z', { peep: '8' }),
  ]
  const ev = eventosDeTomas(tomas)

  it('un valor REPETIDO no es un evento', () => {
    // Llenaría la línea de ruido y escondería lo que sí se movió.
    expect(ev).toHaveLength(2)
    expect(ev.map(e => e.valor)).toEqual([10, 8])
  })

  it('la PRIMERA lectura tampoco: no hay contra qué compararla', () => {
    expect(ev.some(e => e.valor === 12)).toBe(false)
  })

  it('la dirección es un hecho, sin juicio clínico', () => {
    expect(ev.every(e => e.direccion === 'baja')).toBe(true)
  })

  it('el evento lleva la hora en que se MIDIÓ', () => {
    expect(ev[0].en).toBe('2026-07-30T07:00:00Z')
  })

  it('usa la etiqueta del charter cuando la métrica es conocida', () => {
    expect(ev[0].etiqueta).toBe('PEEP')
  })

  it('una métrica sin etiqueta sale con su clave, no se descarta', () => {
    const e = eventosDeTomas([toma('2026-07-30T01:00:00Z', { pplat: '20' }), toma('2026-07-30T02:00:00Z', { pplat: '24' })])
    expect(e[0].etiqueta).toBe('pplat')
  })

  it('sin tomas: línea vacía', () => {
    expect(eventosDeTomas([])).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('el botón «Ingresar paciente a UCI» no puede ser un callejón', () => {
  it('el prefijo de la URL encuentra el servicio real', async () => {
    // La URL dice «UCI» y el servicio del catálogo es «UCI / Terapia Intensiva».
    // Comparar con === habría dejado el botón muerto EN SILENCIO — el mismo
    // callejón que la auditoría encontró en el prellenado calendario→asistente.
    const { SERVICIOS_HOSPITAL } = await import('@/types/hospital')
    const encontrado = SERVICIOS_HOSPITAL.find(sv => sv.toLowerCase().startsWith('uci'))
    expect(encontrado).toBe('UCI / Terapia Intensiva')
    expect(SERVICIOS_HOSPITAL.find(sv => sv === 'UCI')).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('la coerción numérica es la FUENTE ÚNICA, no una copia', () => {
  it('«1,200» son mil doscientos, no 1.2 ← el bug que yo reintroduje', () => {
    // Escribí una coerción propia en este módulo y tenía exactamente el fallo
    // que `num()` existe para evitar. En una glucosa, 1.2 convierte una
    // hiperglucemia en alerta de hipoglucemia. Es un hallazgo P1 de la propia
    // auditoría, reintroducido al escribir la copia número trece.
    expect(numero('1,200')).toBe(1200)
  })

  it('es LA MISMA función, no una equivalente', async () => {
    // Si esto se rompe es porque alguien volvió a escribir una copia local.
    const central = await import('@/lib/uci/num')
    expect(numero).toBe(central.num)
  })

  it('con punto presente, la coma es separador de miles', () => {
    expect(numero('1,234.5')).toBe(1234.5)
  })

  it('y «12,5» sigue siendo doce coma cinco', () => {
    expect(numero('12,5')).toBe(12.5)
  })
})
