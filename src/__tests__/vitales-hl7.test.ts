/**
 * GOLDEN — el adaptador de dispositivos (fases 6-12 del charter).
 *
 * Los monitores de cabecera hablan HL7 y mandan un `OBX` por parámetro. Traer
 * ese dato a la aplicación es interoperabilidad; traerlo MAL es un signo vital
 * falso en una gráfica que alguien va a leer para decidir.
 *
 * Las cuatro reglas que estas pruebas fijan:
 *  1. la unidad no se adivina — 98.6 °F leído como °C es 37 y NEWS2 puntúa;
 *  2. la hora es la del aparato, no la del servidor;
 *  3. lo que no se entiende se DECLARA, no se cuela;
 *  4. nada se completa ni se promedia: media presión no es una presión.
 */
import { describe, it, expect } from 'vitest'
import {
  traducirVitales, fechaHl7AIso, hayVitales, LOINC_SISTOLICA, LOINC_DIASTOLICA,
} from '@/lib/dispositivos/vitales-hl7'

describe('traducirVitales', () => {
  it('traduce los signos con unidad conocida', () => {
    const r = traducirVitales([
      { codigo: '8867-4', valor: '96', unidad: '/min' },
      { codigo: '9279-1', valor: '22', unidad: '/min' },
      { codigo: '8310-5', valor: '38.4', unidad: 'Cel' },
      { codigo: '2708-6', valor: '91', unidad: '%' },
    ])
    expect(r.signos).toEqual({ fc: 96, fr: 22, temp: 38.4, spo2: 91 })
    expect(r.descartados).toEqual([])
  })

  it('EL CASO CARO: una temperatura en Fahrenheit NO entra', () => {
    // 98.6 °F leído como Celsius sería 98.6 °C, o peor: 37 donde había fiebre.
    const r = traducirVitales([{ codigo: '8310-5', valor: '98.6', unidad: '[degF]' }])
    expect(r.signos.temp).toBeUndefined()
    expect(r.descartados[0].motivo).toMatch(/unidad no reconocida/)
  })

  it('sin unidad tampoco se asume la nuestra', () => {
    const r = traducirVitales([{ codigo: '8867-4', valor: '96' }])
    expect(r.signos.fc).toBeUndefined()
    expect(r.descartados[0].motivo).toMatch(/sin unidad/)
  })

  it('la presión sólo entra COMPLETA', () => {
    const completa = traducirVitales([
      { codigo: LOINC_SISTOLICA, valor: '128', unidad: 'mm[Hg]' },
      { codigo: LOINC_DIASTOLICA, valor: '74', unidad: 'mm[Hg]' },
    ])
    expect(completa.signos.ta).toBe('128/74')

    // Media presión no es una presión.
    const media = traducirVitales([{ codigo: LOINC_SISTOLICA, valor: '128', unidad: 'mm[Hg]' }])
    expect(media.signos.ta).toBeUndefined()
    expect(media.descartados[0].motivo).toMatch(/media presión no es una presión/)
  })

  it('un código que no conocemos se declara, no se cuela', () => {
    const r = traducirVitales([{ codigo: '99999-9', valor: '5', unidad: 'mg' }])
    expect(r.signos).toEqual({})
    expect(r.descartados[0]).toEqual({ codigo: '99999-9', motivo: 'código no reconocido por el adaptador' })
  })

  it('un valor no numérico no se fuerza a cero', () => {
    // Un cero inventado en una frecuencia cardiaca es un paro que no ocurrió.
    const r = traducirVitales([{ codigo: '8867-4', valor: '--', unidad: '/min' }])
    expect(r.signos.fc).toBeUndefined()
    expect(r.descartados[0].motivo).toMatch(/no numérico/)
  })

  it('la hora es la del DISPOSITIVO', () => {
    const r = traducirVitales([
      { codigo: '8867-4', valor: '88', unidad: '/min', medidoEn: '20260802143000-0600' },
    ])
    expect(r.medidoEn).toBe('2026-08-02T20:30:00.000Z')
  })

  it('sin hora del aparato no se inventa la del servidor', () => {
    const r = traducirVitales([{ codigo: '8867-4', valor: '88', unidad: '/min' }])
    expect(r.medidoEn).toBeNull()
  })

  it('nada que traducir no es lo mismo que traducir nada', () => {
    expect(hayVitales(traducirVitales([]))).toBe(false)
    expect(hayVitales(traducirVitales([{ codigo: '8867-4', valor: '70', unidad: '/min' }]))).toBe(true)
  })
})

describe('fechaHl7AIso', () => {
  it('entiende el formato de HL7 con y sin zona', () => {
    expect(fechaHl7AIso('20260802143000-0600')).toBe('2026-08-02T20:30:00.000Z')
    expect(fechaHl7AIso('20260802143000')).toBe('2026-08-02T14:30:00.000Z')
    expect(fechaHl7AIso('20260802')).toBe('2026-08-02T00:00:00.000Z')
  })

  it('lo que no se entiende devuelve null, no una fecha inventada', () => {
    for (const v of ['', 'ayer', '2026-08-02', 'XXXX']) {
      expect(fechaHl7AIso(v), v).toBeNull()
    }
  })
})

describe('el adaptador llega a la ruta', () => {
  it('la ruta de HL7 lo usa y marca la fuente', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'hl7', 'convertir', 'route.ts'), 'utf8')
    expect(s).toContain('traducirVitales')
    // Que nadie pueda confundirlo con algo que tecleó una persona.
    expect(s).toContain("fuente: 'dispositivo'")
  })
})

/**
 * EL VOCABULARIO DE PROCEDENCIA — P-006 del charter.
 *
 * `manual` significa literalmente «lo escribió el médico». Con el adaptador de
 * dispositivos ya entran signos de un monitor: sellarlos como `manual` afirmaría
 * que el médico tecleó una frecuencia cardiaca que midió un aparato conectado a
 * un cable que quizá estaba suelto. Y un NEWS2 calculado no lo «dijo» nadie.
 */
describe('origenDesdeFuente', () => {
  it('lo que llega de un dispositivo es IMPORTADO, no manual', async () => {
    const { origenDesdeFuente, esDeMaquina } = await import('@/lib/expediente/procedencia')
    expect(origenDesdeFuente('dispositivo')).toBe('importado')
    expect(origenDesdeFuente('hl7-monitor')).toBe('importado')
    expect(esDeMaquina('importado')).toBe(true)
  })

  it('lo derivado por un motor es CALCULADO: no lo dijo nadie', async () => {
    const { origenDesdeFuente, esDeMaquina } = await import('@/lib/expediente/procedencia')
    expect(origenDesdeFuente('calculado')).toBe('calculado')
    expect(esDeMaquina('calculado')).toBe(true)
  })

  it('lo que sí tiene autor humano se conserva como estaba', async () => {
    const { origenDesdeFuente, esDeMaquina } = await import('@/lib/expediente/procedencia')
    expect(origenDesdeFuente('teclado')).toBe('manual')
    expect(origenDesdeFuente('panel-uci')).toBe('manual')
    expect(origenDesdeFuente('voz')).toBe('dictado')
    expect(esDeMaquina('manual')).toBe(false)
  })

  it('una fuente desconocida NO se degrada a manual', async () => {
    // Inventar un autor es peor que no tener uno.
    const { origenDesdeFuente } = await import('@/lib/expediente/procedencia')
    expect(origenDesdeFuente('lo-que-sea')).toBeNull()
    expect(origenDesdeFuente('')).toBeNull()
    expect(origenDesdeFuente(undefined)).toBeNull()
  })

  it('la ruta de HL7 marca el origen, no sólo la fuente', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'hl7', 'convertir', 'route.ts'), 'utf8')
    expect(s).toContain("origenProcedencia: origenDesdeFuente('dispositivo')")
  })
})

/**
 * LA PUERTA EN LA FICHA — con el clínico en medio, a propósito.
 *
 * El adaptador traducía y ahí se quedaba: la ruta lo dice («NO almacena nada»).
 * Nadie quiere un aparato escribiendo solo en el expediente, así que la ficha
 * enseña lo que se reconoció Y lo que se descartó con su motivo, y una persona
 * confirma. Lo que entra se guarda con la hora del APARATO y marcado como
 * venido de un dispositivo.
 */
describe('importar del monitor desde la ficha', () => {
  it('la ficha del episodio tiene la puerta', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx'), 'utf8')
    expect(s).toContain('Importar del monitor')
    // Lo descartado se ENSEÑA: si no, el clínico creería que se importó todo.
    expect(s).toContain('No se importó (y por qué)')
    // Y lo que entra no se disfraza de tecleado.
    expect(s).toContain("fuente: 'dispositivo'")
  })

  it('se guarda con la hora del aparato cuando viene', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx'), 'utf8')
    expect(s).toContain('hl7Previo.medidoEn ?? new Date().toISOString()')
  })
})

/**
 * UN CANAL NUEVO NO PUEDE SALTARSE LA ALERTA DEL CANAL VIEJO.
 *
 * v893 trajo los signos del monitor pero no disparaba el NEWS2; la vía manual
 * sí lo hace. Unos signos importados podían entrar con un deterioro dentro y no
 * avisarle a nadie — y son justo los que llegan sin que una persona los mire.
 */
describe('la importación del monitor alerta igual que el registro manual', () => {
  it('calcula NEWS2 y dispara la alerta de deterioro', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx'), 'utf8')
    // Las dos vías tienen que llamar al mismo motor y a la misma alerta.
    expect((s.match(/calcularNews2\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((s.match(/tipo: 'news2'/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(s).toContain('importado del monitor')
  })

  it('no inventa la conciencia que el monitor no manda', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx'), 'utf8')
    expect(s).toContain('no se inventa un «alerta»')
  })
})
