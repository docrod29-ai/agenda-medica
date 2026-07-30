import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TOPE_TOMAS,
  tomasComoObservaciones,
  tomaVigenteEn,
  serieTomas,
  type TomaUci,
} from '@/lib/uci/observaciones'

/**
 * ICU-003 · persistencia de las observaciones de UCI.
 *
 * Cierra el hallazgo P0 de ICU-001: las lecturas del Panel UCI vivían SÓLO en
 * `localStorage`, con tope de 24, y el cierre de sesión las purgaba. Sin copia
 * en el servidor no hay expediente longitudinal, ni la ve otra guardia, ni es
 * auditable.
 *
 * La unidad de verdad es la TOMA (`observationSetId` de la decisión ICU-Q4.1):
 * el panel captura todas las medidas juntas, así que cada guardado es UN
 * documento y no N sueltos que después habría que reagrupar por hora.
 *
 * Datos 100 % sintéticos.
 */

const T = (hhmm: string) => `2026-07-30T${hhmm}:00Z`

const toma = (
  id: string, medidoEn: string, medidas: Record<string, unknown>,
  extra: Partial<TomaUci> = {},
): TomaUci => ({
  id, medidoEn, registradoEn: medidoEn, estado: 'CONFIRMED',
  por: 'med-ficticio', fuente: 'teclado', medidas, ...extra,
})

describe('ICU-003 · la toma es la unidad, no la medida suelta', () => {
  it('una toma conserva TODAS sus medidas juntas', () => {
    // Si se guardara medida por medida, habría que reagruparlas por hora
    // después — reconstruyendo a mano algo que ya sabíamos al capturar.
    const t = toma('a', T('08:00'), { peep: 8, fio2: 40, pplat: 22 })
    const [o] = tomasComoObservaciones([t])
    expect(o.valor.medidas).toEqual({ peep: 8, fio2: 40, pplat: 22 })
  })

  it('el adaptador separa hora de MEDICIÓN de hora de REGISTRO', () => {
    const t = toma('a', T('08:00'), { peep: 8 }, { registradoEn: T('08:07') })
    const [o] = tomasComoObservaciones([t])
    expect(o.fechaEfectiva).toBe(T('08:00'))   // cuándo se midió
    expect(o.fechaRegistro).toBe(T('08:07'))   // cuándo se guardó
  })
})

describe('ICU-003 · corrección — hereda la hora del hecho (decisión ICU-Q3)', () => {
  const original = toma('o1', T('08:00'), { spo2: 82 }, { estado: 'ENTERED_IN_ERROR' })
  const correccion = toma('c1', T('08:00'), { spo2: 92 }, {
    registradoEn: T('08:05'), corrigeA: 'o1', motivoCorreccion: 'error de captura',
  })
  const serie = [original, correccion]

  it('la vigente a la hora del HECHO es la corregida', () => {
    expect(tomaVigenteEn(serie, T('08:00'), null)?.medidas).toEqual({ spo2: 92 })
  })

  it('la toma errónea NO desaparece de la serie cargada', () => {
    expect(serie.find(t => t.id === 'o1')).toBeDefined()
  })

  it('la gráfica muestra UN punto, no dos', () => {
    const s = serieTomas(serie)
    expect(s).toHaveLength(1)
    expect(s[0].medidas).toEqual({ spo2: 92 })
    expect(s[0].medidoEn).toBe(T('08:00'))
  })

  it('dos tomas VÁLIDAS sí son dos puntos', () => {
    const dos = [toma('a', T('08:00'), { spo2: 82 }), toma('b', T('08:30'), { spo2: 92 })]
    expect(serieTomas(dos)).toHaveLength(2)
    expect(tomaVigenteEn(dos, T('08:15'), null)?.medidas).toEqual({ spo2: 82 })
  })
})

describe('ICU-003 · cota de lectura', () => {
  it('el tope es 200, la MISMA razón que en getSignos', () => {
    // Un paciente de UCI con tomas horarias 20 días son ~480 documentos. Bajar
    // la subcolección completa fue la causa real de la lentitud de la agenda.
    expect(TOPE_TOMAS).toBe(200)
  })

  it('la consulta ordena por hora de MEDICIÓN, no por la de registro', () => {
    // Ordenar por registro pondría una corrección tardía al final de la gráfica,
    // lejos del punto que corrige.
    const fuente = readFileSync(resolve(process.cwd(), 'src/lib/uci/observaciones.ts'), 'utf8')
    expect(fuente).toContain("orderBy('medidoEn', 'desc')")
    expect(fuente).toContain(`limit(tope)`)
  })
})

describe('ICU-003 · las REGLAS hacen cumplir el append-only', () => {
  const crudo = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
  const reglas = crudo.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  const bloqueDe = (nombre: string): string => {
    const i = reglas.indexOf(`match /${nombre}/`)
    if (i === -1) return ''
    const apertura = reglas.lastIndexOf('{', reglas.indexOf('\n', i))
    let nivel = 0
    for (let j = apertura; j < reglas.length; j++) {
      if (reglas[j] === '{') nivel++
      else if (reglas[j] === '}') { nivel--; if (nivel === 0) return reglas.slice(i, j + 1) }
    }
    return ''
  }

  const bloque = bloqueDe('icu_observations')

  it('la regla existe', () => {
    expect(bloque, 'falta match /icu_observations/').not.toBe('')
  })

  it('el CLIENTE puede capturar (create), como en signos', () => {
    expect(bloque).toMatch(/allow read, create: if isClinicoHospital\(clinicId\)/)
  })

  it('el UPDATE sólo puede tocar `estado` ← el append-only en la REGLA', () => {
    // Sin este `hasOnly`, un update podría reescribir las MEDIDAS haciéndolas
    // pasar por una corrección. La corrección de verdad es un documento nuevo.
    expect(bloque).toContain("affectedKeys().hasOnly(['estado'])")
  })

  it('BORRAR está cerrado: una toma histórica no desaparece', () => {
    expect(bloque).toContain('delete: if false')
  })

  it('está DECLARADA en la matriz de acceso (si no, el emulador no la prueba)', () => {
    const matriz = readFileSync(resolve(process.cwd(), 'src/lib/authz/matriz-acceso.ts'), 'utf8')
    expect(matriz).toContain('internamientos/{intId}/icu_observations/{obsId}')
  })
})

describe('ICU-003 · transición SIN pérdida', () => {
  it('el módulo declara que NO reemplaza al localStorage', () => {
    // Si las reglas fallan, si no hay internet o si el paciente no está
    // internado, el comportamiento de hoy tiene que seguir intacto.
    const fuente = readFileSync(resolve(process.cwd(), 'src/lib/uci/observaciones.ts'), 'utf8')
    expect(fuente).toMatch(/NO reemplaza al `localStorage`/)
  })

  it('corregir EXIGE motivo (audit trail de la decisión ICU-Q3)', async () => {
    const mod = await import('@/lib/uci/observaciones')
    await expect(
      mod.corregirToma('c', 'i', toma('a', T('08:00'), {}), { medidas: {}, por: 'x', motivo: '  ', fuente: 'y' }, T('09:00'), true),
    ).rejects.toThrow(/exige motivo/)
  })
})

describe('ICU-003 · el CABLEADO del panel — escritura doble sin pérdida', () => {
  /**
   * El único paso de esta unidad que cambia comportamiento en producción, así que
   * lo que se congela aquí es que NO puede romper lo que ya funcionaba.
   */
  const panel = readFileSync(
    resolve(process.cwd(), 'src/app/(dashboard)/uci/page.tsx'), 'utf8',
  )

  it('sigue guardando en localStorage — el respaldo NO se quitó', () => {
    // Quitarlo hoy cambiaría una pérdida conocida por una dependencia de red en
    // el peor momento posible: el pase de visita.
    expect(panel).toContain('localStorage.setItem(claveLecturas')
  })

  it('lo LOCAL se guarda ANTES que la red', () => {
    const i = panel.indexOf('const guardarLectura')
    const cuerpo = panel.slice(i, i + 1600)
    const iLocal = cuerpo.indexOf('localStorage.setItem')
    const iRed = cuerpo.indexOf('guardarToma(')
    expect(iLocal, 'no se encontró el guardado local').toBeGreaterThan(-1)
    expect(iRed, 'no se encontró el guardado en servidor').toBeGreaterThan(-1)
    expect(iLocal).toBeLessThan(iRed)
  })

  it('un fallo de red NO interrumpe: se avisa, no se lanza', () => {
    const i = panel.indexOf('guardarToma(')
    const cuerpo = panel.slice(i, i + 900)
    expect(cuerpo).toContain('.catch(')
    expect(cuerpo).toMatch(/toast\(/)
    // Y el mensaje dice la verdad: el dato NO se perdió.
    expect(cuerpo).toMatch(/se guardó en este dispositivo/)
  })

  it('el modo CALCULADORA (sin paciente) no intenta persistir', () => {
    // Sin internamiento no hay expediente donde escribir; el panel debe seguir
    // sirviendo como calculadora, que es un valor real que ya tenía.
    const i = panel.indexOf('const guardarLectura')
    expect(panel.slice(i, i + 1200)).toMatch(/if \(!clinicId \|\| !internamientoId\) return/)
  })

  it('al cargar, el SERVIDOR gana sobre lo local si respondió', () => {
    // Es lo que hace que otra guardia vea las mismas lecturas.
    const i = panel.indexOf('getTomas(clinicId, internamientoId)')
    expect(i, 'el panel no lee del servidor').toBeGreaterThan(-1)
    expect(panel.slice(i, i + 700)).toContain('setLecturas(')
  })

  it('si el servidor falla, se queda lo local (no se vacía la gráfica)', () => {
    const i = panel.indexOf('getTomas(clinicId, internamientoId)')
    const cuerpo = panel.slice(i, i + 900)
    expect(cuerpo).toContain('.catch(')
    // El catch NO debe tocar `setLecturas`: vaciar la serie por un fallo de red
    // le borraría al médico lo que sí tenía.
    const iCatch = cuerpo.indexOf('.catch(')
    expect(cuerpo.slice(iCatch)).not.toContain('setLecturas(')
  })

  it('la carga usa `serieTomas`, que resuelve las correcciones', () => {
    // Sin esto, una toma corregida saldría como punto EXTRA en la gráfica.
    const i = panel.indexOf('getTomas(clinicId, internamientoId)')
    expect(panel.slice(i, i + 700)).toContain('serieTomas(tomas)')
  })
})
