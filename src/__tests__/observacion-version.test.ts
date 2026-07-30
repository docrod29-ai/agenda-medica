import { describe, it, expect } from 'vitest'
import {
  ESTADOS_OBSERVACION,
  ESTADOS_CALCULABLES,
  ESTADOS_NO_CALCULABLES,
  esClinicamenteValida,
  vigenteEn,
  construirCorreccion,
  marcarCorregido,
  serieVigente,
  FALTA_VENTANA_TEMPORAL,
  type ObservacionVersionada,
} from '@/lib/clinical/observacion-version'

/**
 * Decisión ICU-Q3 del médico dueño (29-jul-2026), que cerró E0-09/Q1.
 *
 * Los dos primeros bloques SON el criterio de aceptación: son los ejemplos que
 * él escribió, transcritos literalmente. Si alguno se pone rojo, el motor dejó
 * de cumplir la decisión.
 *
 * Datos 100 % sintéticos. Sin PHI.
 */

type SpO2 = { spo2: number }

const obs = (
  id: string,
  spo2: number,
  fechaEfectiva: string,
  extra: Partial<ObservacionVersionada<SpO2>> = {},
): ObservacionVersionada<SpO2> => ({
  id,
  fechaEfectiva,
  fechaRegistro: fechaEfectiva,
  estado: 'CONFIRMED',
  por: 'enf-ficticia',
  valor: { spo2 },
  ...extra,
})

const T = (hhmm: string) => `2026-07-29T${hhmm}:00Z`
const SIN_VENTANA = null

// ═══════════════════════════════════════════════════════════════════════
describe('ICU-Q3 · EJEMPLO A — corrección (un solo hecho, mal capturado)', () => {
  /**
   * 08:00  SpO₂ 82 %
   * 08:03  «me equivoqué, era 92»
   * → el NEWS2 retrospectivo de las 08:00 debe usar 92
   */
  const original = obs('a', 82, T('08:00'))
  const correccion = construirCorreccion(original, {
    id: 'a-corr', valor: { spo2: 92 }, por: 'enf-ficticia',
    motivo: 'error de captura', fechaRegistro: T('08:03'),
  })
  const originalMarcado = { ...original, estado: marcarCorregido(true) }
  const serie = [originalMarcado, correccion]

  it('la corrección HEREDA la hora efectiva del original (08:00, no 08:03)', () => {
    // Es la línea de la que depende todo el ejemplo.
    expect(correccion.fechaEfectiva).toBe(T('08:00'))
    expect(correccion.fechaRegistro).toBe(T('08:03'))
  })

  it('EL NEWS2 RETROSPECTIVO DE LAS 08:00 USA 92 ← criterio de aceptación', () => {
    const { vigente } = vigenteEn(serie, T('08:00'), SIN_VENTANA)
    expect(vigente?.valor.spo2).toBe(92)
  })

  it('el 82 % NO se borra: sigue en la serie, marcado', () => {
    expect(serie.find(o => o.id === 'a')).toBeDefined()
    expect(originalMarcado.estado).toBe('ENTERED_IN_ERROR')
  })

  it('el 82 % NO alimenta ningún cálculo, y se dice POR QUÉ', () => {
    const { descartadas } = vigenteEn(serie, T('08:00'), SIN_VENTANA)
    const d = descartadas.find(x => x.observacion.id === 'a')
    expect(d?.motivo).toBe('estado_no_calculable')
  })

  it('la corrección conserva su audit trail', () => {
    expect(correccion.corrigeA).toBe('a')
    expect(correccion.motivoCorreccion).toBe('error de captura')
    expect(correccion.por).toBe('enf-ficticia')
  })

  it('en la gráfica la corrección NO añade un punto extra: reemplaza al original', () => {
    const s = serieVigente(serie)
    expect(s).toHaveLength(1)
    expect(s[0].valor.spo2).toBe(92)
    expect(s[0].fechaEfectiva).toBe(T('08:00'))   // en el lugar del original
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('ICU-Q3 · EJEMPLO B — observación nueva (dos hechos válidos)', () => {
  /**
   * 08:00  SpO₂ 82 %
   * 08:10  SpO₂ 92 % DESPUÉS DE INTERVENCIÓN
   * → NO es corrección. El NEWS2 en cada momento usa el valor de ese momento.
   */
  const serie = [obs('b1', 82, T('08:00')), obs('b2', 92, T('08:10'))]

  it('las dos son válidas: ninguna corrige a la otra', () => {
    expect(serie.every(o => o.corrigeA === undefined)).toBe(true)
    expect(serie.every(o => esClinicamenteValida(o.estado))).toBe(true)
  })

  it('a las 08:00 → 82', () => {
    expect(vigenteEn(serie, T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(82)
  })

  it('a las 08:10 → 92', () => {
    expect(vigenteEn(serie, T('08:10'), SIN_VENTANA).vigente?.valor.spo2).toBe(92)
  })

  it('a las 08:05 → 82 (el valor DISPONIBLE en ese momento) ← criterio', () => {
    // La diferencia exacta con el Ejemplo A: aquí el 92 aún no existía.
    expect(vigenteEn(serie, T('08:05'), SIN_VENTANA).vigente?.valor.spo2).toBe(82)
  })

  it('la gráfica muestra DOS puntos, no uno', () => {
    const s = serieVigente(serie)
    expect(s.map(o => o.valor.spo2)).toEqual([82, 92])
  })

  it('CONTRASTE — el mismo par, pero como corrección, da UN punto y 92 a las 08:00', () => {
    // Prueba que la distinción corrección↔observación-nueva es real y no cosmética.
    const comoCorreccion = [
      { ...obs('b1', 82, T('08:00')), estado: marcarCorregido(true) },
      construirCorreccion(obs('b1', 82, T('08:00')), {
        id: 'b1-corr', valor: { spo2: 92 }, por: 'x', motivo: 'error', fechaRegistro: T('08:10'),
      }),
    ]
    expect(serieVigente(comoCorreccion)).toHaveLength(1)
    expect(vigenteEn(comoCorreccion, T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(92)
    // …mientras el mismo instante con observaciones nuevas da 82.
    expect(vigenteEn(serie, T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(82)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('«latest clinically valid», nunca «latest database row»', () => {
  it('una fila más reciente en estado no calculable NO gana', () => {
    const serie = [
      obs('v', 90, T('08:00')),
      obs('w', 60, T('08:30'), { estado: 'ENTERED_IN_ERROR' }),   // la más reciente
    ]
    expect(vigenteEn(serie, T('09:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(90)
  })

  it.each(ESTADOS_NO_CALCULABLES)('estado %s nunca calcula', (estado) => {
    const serie = [obs('x', 70, T('08:00'), { estado })]
    expect(vigenteEn(serie, T('08:00'), SIN_VENTANA).vigente).toBeNull()
  })

  it.each(ESTADOS_CALCULABLES)('estado %s sí calcula', (estado) => {
    const serie = [obs('x', 70, T('08:00'), { estado })]
    expect(vigenteEn(serie, T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(70)
  })

  it('TODO estado está clasificado en un lado (nada queda sin decidir)', () => {
    // Fail-closed: un estado nuevo sin clasificar rompe este caso en vez de
    // colarse silenciosamente como válido.
    const clasificados = new Set([...ESTADOS_CALCULABLES, ...ESTADOS_NO_CALCULABLES])
    expect([...ESTADOS_OBSERVACION].filter(e => !clasificados.has(e))).toEqual([])
    expect(clasificados.size).toBe(ESTADOS_OBSERVACION.length)
  })

  it('los dos lados son disjuntos', () => {
    const solapan = ESTADOS_CALCULABLES.filter(e => ESTADOS_NO_CALCULABLES.includes(e))
    expect(solapan).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('ventana temporal — la decisión prohíbe asumir una', () => {
  const serie = [obs('a', 88, T('06:00'))]

  it('sin ventana declarada LANZA, en vez de mezclar horas distintas', () => {
    // «No mezclar variables tomadas en horas diferentes sin política explícita.»
    // @ts-expect-error — omitir el parámetro es justo lo que se prohíbe
    expect(() => vigenteEn(serie, T('09:00'))).toThrowError(FALTA_VENTANA_TEMPORAL)
  })

  it('con `null` explícito (sin límite) sí calcula', () => {
    expect(vigenteEn(serie, T('09:00'), null).vigente?.valor.spo2).toBe(88)
  })

  it('un valor más viejo que la ventana se descarta, con su motivo', () => {
    const r = vigenteEn(serie, T('09:00'), 60 * 60 * 1000)   // 1 h
    expect(r.vigente).toBeNull()
    expect(r.descartadas[0].motivo).toBe('fuera_de_ventana')
  })

  it('dentro de la ventana entra', () => {
    expect(vigenteEn(serie, T('06:30'), 60 * 60 * 1000).vigente?.valor.spo2).toBe(88)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('robustez — un dato malformado no debe colgar ni inventar', () => {
  it('una observación del FUTURO no alimenta el cálculo de ahora', () => {
    const serie = [obs('f', 99, T('10:00'))]
    const r = vigenteEn(serie, T('08:00'), SIN_VENTANA)
    expect(r.vigente).toBeNull()
    expect(r.descartadas[0].motivo).toBe('posterior_al_instante')
  })

  it('serie vacía → null, sin lanzar', () => {
    expect(vigenteEn([], T('08:00'), SIN_VENTANA).vigente).toBeNull()
  })

  it('instante inválido LANZA con mensaje claro', () => {
    expect(() => vigenteEn([], 'ayer por la tarde', SIN_VENTANA)).toThrowError(/instante inválido/)
  })

  it('fecha efectiva inválida se descarta, no envenena el resultado', () => {
    const serie = [obs('malo', 50, 'no-es-fecha'), obs('bueno', 95, T('08:00'))]
    expect(vigenteEn(serie, T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(95)
  })

  it('cadena de 3 versiones: sólo la última calcula y la gráfica da 1 punto', () => {
    const o1 = obs('c1', 70, T('08:00'), { estado: 'CORRECTED' })
    const o2 = { ...obs('c2', 80, T('08:00'), { estado: 'CORRECTED' }), corrigeA: 'c1', fechaRegistro: T('08:05') }
    const o3 = { ...obs('c3', 90, T('08:00')), corrigeA: 'c2', fechaRegistro: T('08:10') }
    expect(vigenteEn([o1, o2, o3], T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(90)
    expect(serieVigente([o1, o2, o3])).toHaveLength(1)
  })

  it('ciclo malformado A↔B no cuelga', () => {
    const a = { ...obs('a', 1, T('08:00')), corrigeA: 'b' }
    const b = { ...obs('b', 2, T('08:00')), corrigeA: 'a' }
    expect(() => serieVigente([a, b])).not.toThrow()
  })

  it('corrección huérfana (original fuera de la ventana cargada) no se descarta', () => {
    const huerfana = { ...obs('h', 93, T('08:00')), corrigeA: 'no-cargado' }
    expect(serieVigente([huerfana])).toHaveLength(1)
    expect(vigenteEn([huerfana], T('08:00'), SIN_VENTANA).vigente?.valor.spo2).toBe(93)
  })

  it('construirCorreccion EXIGE motivo (audit trail de la decisión)', () => {
    expect(() => construirCorreccion(obs('a', 80, T('08:00')), {
      id: 'x', valor: { spo2: 90 }, por: 'y', motivo: '   ', fechaRegistro: T('08:01'),
    })).toThrowError(/exige motivo/)
  })

  it('construirCorreccion NO muta el original', () => {
    const original = obs('a', 82, T('08:00'))
    const antes = JSON.stringify(original)
    construirCorreccion(original, { id: 'x', valor: { spo2: 92 }, por: 'y', motivo: 'z', fechaRegistro: T('08:03') })
    expect(JSON.stringify(original)).toBe(antes)
  })

  it('marcarCorregido distingue error de captura de rectificación', () => {
    expect(marcarCorregido(true)).toBe('ENTERED_IN_ERROR')
    expect(marcarCorregido(false)).toBe('CORRECTED')
  })
})
