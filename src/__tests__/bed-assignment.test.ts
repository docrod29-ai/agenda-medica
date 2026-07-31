import { describe, it, expect } from 'vitest'
import {
  estaVigente, cubre, seSolapan, conflictos,
  camaVigenteDe, historialCamas, trasladar, ocupantesDe, reservaVigenteDe,
} from '@/lib/hospital/bed-assignment'
import type { BedAssignment } from '@/types/hospital'

/**
 * ICU-002c · asignación de camas append-only.
 *
 * Los cinco FLUJOS del charter (§1 A–E) son el criterio de aceptación: si uno se
 * pone rojo, el modelo dejó de cubrir un camino real del hospital.
 *
 * Regla que congelan estos casos:
 *   «La cama NO identifica al paciente. La estancia identifica al episodio
 *    clínico. La cama es una localización temporal.»
 *
 * Datos 100 % sintéticos.
 */

const T = (d: number, hhmm: string) => `2026-07-${String(d).padStart(2, '0')}T${hhmm}:00Z`

const asig = (
  id: string, camaId: string, desde: string, extra: Partial<BedAssignment> = {},
): BedAssignment => ({
  id, camaId, desde, motivo: 'ingreso', por: 'med-ficticio', ...extra,
})

// ═══════════════════════════════════════════════════════════════════════
describe('§1 · los cinco flujos del charter', () => {
  it('FLUJO A — paciente → ingreso hospitalario → ingreso UCI → cama', () => {
    const a = [asig('a1', 'uci-01', T(1, '08:00'), { icuStayId: 'stay-1' })]
    const r = camaVigenteDe(a, T(1, '10:00'))
    expect(r).toEqual({ camaId: 'uci-01', fuente: 'asignacion' })
  })

  it('FLUJO B — cama RESERVADA antes de que llegue el paciente', () => {
    // Es lo que el string suelto no permitía: no había dónde poner una reserva.
    const a = [asig('r1', 'uci-02', T(1, '07:00'), { motivo: 'reserva' })]
    expect(reservaVigenteDe(a, 'uci-02', T(1, '07:30'))?.id).toBe('r1')
    // Una reserva NO ocupa: la cama sigue sin ocupante real.
    expect(ocupantesDe(a, 'uci-02', T(1, '07:30'))).toEqual([])
    expect(camaVigenteDe(a, T(1, '07:30'))).toBeNull()
  })

  it('FLUJO C — urgencias → UCI → cama temporal → cama definitiva', () => {
    const temporal = asig('c1', 'uci-temp', T(1, '09:00'), { icuStayId: 's1' })
    const { cierre, apertura } = trasladar(temporal, { id: 'c2', camaId: 'uci-05', por: 'med' }, T(1, '11:00'))
    const a = [cierre, apertura]

    expect(camaVigenteDe(a, T(1, '10:00'))?.camaId).toBe('uci-temp')   // antes
    expect(camaVigenteDe(a, T(1, '12:00'))?.camaId).toBe('uci-05')     // después
    expect(conflictos(a)).toEqual([])                                   // sin solape
  })

  it('FLUJO D — piso → UCI → traslado de cama', () => {
    const piso = asig('d1', 'piso-301', T(1, '08:00'))                  // sin icuStayId
    const { cierre, apertura } = trasladar(
      piso, { id: 'd2', camaId: 'uci-03', por: 'med' }, T(1, '14:00'),
    )
    expect(cierre.hasta).toBe(T(1, '14:00'))
    expect(apertura.camaId).toBe('uci-03')
    // La de piso no llevaba estancia UCI, así que la nueva tampoco la hereda.
    expect(apertura.icuStayId).toBeUndefined()
  })

  it('FLUJO E — UCI → piso → UCI OTRA VEZ, y las dos estancias se conservan', () => {
    // El flujo que el modelo viejo destruía: la segunda entrada pisaba a la primera.
    const a = [
      asig('e1', 'uci-01', T(1, '08:00'), { hasta: T(3, '10:00'), icuStayId: 'stay-1' }),
      asig('e2', 'piso-210', T(3, '10:00'), { hasta: T(5, '09:00'), motivo: 'traslado' }),
      asig('e3', 'uci-04', T(5, '09:00'), { motivo: 'traslado', icuStayId: 'stay-2' }),
    ]
    expect(camaVigenteDe(a, T(2, '00:00'))?.camaId).toBe('uci-01')
    expect(camaVigenteDe(a, T(4, '00:00'))?.camaId).toBe('piso-210')
    expect(camaVigenteDe(a, T(6, '00:00'))?.camaId).toBe('uci-04')

    // Las DOS estancias siguen ahí: ninguna se sobrescribió.
    const estancias = a.map(x => x.icuStayId).filter(Boolean)
    expect(estancias).toEqual(['stay-1', 'stay-2'])
    expect(historialCamas(a)).toHaveLength(3)
    expect(conflictos(a)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('compatibilidad — el string viejo NO se borra', () => {
  it('sin asignaciones, cae al `Internamiento.cama` de siempre', () => {
    // Condición para poder revertir: un episodio anterior a esta unidad sigue
    // mostrando su cama.
    expect(camaVigenteDe([], T(1, '10:00'), '302-A'))
      .toEqual({ camaId: '302-A', fuente: 'legado' })
  })

  it('con asignación, la asignación GANA sobre el string', () => {
    const a = [asig('a1', 'uci-01', T(1, '08:00'))]
    expect(camaVigenteDe(a, T(1, '10:00'), '302-A')?.fuente).toBe('asignacion')
  })

  it('la fuente se DECLARA, para poder auditarla', () => {
    // Quien lee sabe si el dato viene del modelo nuevo o del respaldo.
    expect(camaVigenteDe([], T(1, '10:00'), 'X')?.fuente).toBe('legado')
  })

  it('string vacío no cuenta como cama', () => {
    expect(camaVigenteDe([], T(1, '10:00'), '   ')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('dos pacientes en la misma cama = conflicto VISIBLE', () => {
  it('dos asignaciones vigentes sobre la misma cama se denuncian', () => {
    const a = [asig('x', 'uci-01', T(1, '08:00')), asig('y', 'uci-01', T(1, '09:00'))]
    const c = conflictos(a)
    expect(c).toHaveLength(1)
    expect(c[0].motivo).toBe('dos_vigentes')
    expect(c[0].camaId).toBe('uci-01')
  })

  it('un solape parcial también se denuncia', () => {
    const a = [
      asig('x', 'uci-01', T(1, '08:00'), { hasta: T(1, '12:00') }),
      asig('y', 'uci-01', T(1, '10:00'), { hasta: T(1, '14:00') }),
    ]
    expect(conflictos(a)[0].motivo).toBe('solape')
  })

  it('asignaciones que se TOCAN no solapan (intervalo semiabierto)', () => {
    // El traslado deja hasta === desde a propósito: ni solape ni hueco.
    const a = [
      asig('x', 'uci-01', T(1, '08:00'), { hasta: T(1, '12:00') }),
      asig('y', 'uci-01', T(1, '12:00')),
    ]
    expect(conflictos(a)).toEqual([])
    expect(ocupantesDe(a, 'uci-01', T(1, '12:00'))).toHaveLength(1)
  })

  it('camas distintas nunca entran en conflicto', () => {
    const a = [asig('x', 'uci-01', T(1, '08:00')), asig('y', 'uci-02', T(1, '08:00'))]
    expect(conflictos(a)).toEqual([])
  })

  it('una reserva NO produce conflicto con la estancia en curso', () => {
    const a = [
      asig('ocupa', 'uci-01', T(1, '08:00')),
      asig('res', 'uci-01', T(1, '09:00'), { motivo: 'reserva' }),
    ]
    expect(conflictos(a)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('traslado — cierra una y abre otra, sin mutar', () => {
  const vigente = asig('v', 'uci-01', T(1, '08:00'), { icuStayId: 'stay-1' })

  it('el cierre lleva la hora del traslado', () => {
    const { cierre } = trasladar(vigente, { id: 'n', camaId: 'uci-09', por: 'p' }, T(1, '15:00'))
    expect(cierre.hasta).toBe(T(1, '15:00'))
    expect(estaVigente(cierre)).toBe(false)
  })

  it('la apertura HEREDA la estancia UCI', () => {
    const { apertura } = trasladar(vigente, { id: 'n', camaId: 'uci-09', por: 'p' }, T(1, '15:00'))
    expect(apertura.icuStayId).toBe('stay-1')
    expect(estaVigente(apertura)).toBe(true)
  })

  it('NO muta la asignación original', () => {
    const antes = JSON.stringify(vigente)
    trasladar(vigente, { id: 'n', camaId: 'uci-09', por: 'p' }, T(1, '15:00'))
    expect(JSON.stringify(vigente)).toBe(antes)
  })

  it('trasladar una asignación YA CERRADA lanza', () => {
    const cerrada = asig('c', 'uci-01', T(1, '08:00'), { hasta: T(1, '10:00') })
    expect(() => trasladar(cerrada, { id: 'n', camaId: 'x', por: 'p' }, T(1, '11:00')))
      .toThrowError(/ya está cerrada/)
  })

  it('un traslado ANTERIOR al inicio lanza (no se inventa una historia imposible)', () => {
    expect(() => trasladar(vigente, { id: 'n', camaId: 'x', por: 'p' }, T(1, '07:00')))
      .toThrowError(/anterior al inicio/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('robustez', () => {
  it('una fecha inválida no cuelga ni cuenta como cobertura', () => {
    const a = [asig('m', 'uci-01', 'no-es-fecha')]
    expect(cubre(a[0], T(1, '10:00'))).toBe(false)
    expect(conflictos(a)).toEqual([])
  })

  it('un instante anterior al inicio no está cubierto', () => {
    expect(cubre(asig('a', 'c', T(2, '08:00')), T(1, '08:00'))).toBe(false)
  })

  it('el historial sale en orden cronológico aunque entre desordenado', () => {
    const a = [asig('b', 'c2', T(3, '08:00')), asig('a', 'c1', T(1, '08:00'))]
    expect(historialCamas(a).map(x => x.id)).toEqual(['a', 'b'])
  })

  it('`seSolapan` es simétrico', () => {
    const x = asig('x', 'c', T(1, '08:00'), { hasta: T(1, '12:00') })
    const y = asig('y', 'c', T(1, '10:00'))
    expect(seSolapan(x, y)).toBe(seSolapan(y, x))
  })

  it('sin asignaciones ni legado: null, no una cama inventada', () => {
    expect(camaVigenteDe([], T(1, '10:00'))).toBeNull()
  })
})
