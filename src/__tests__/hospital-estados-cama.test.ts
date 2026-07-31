import { describe, it, expect } from 'vitest'
import {
  disponibilidad,
  puedeRecibir,
  contarCamas,
  transicionar,
  bloqueoDePolitica,
  confirmarLimpieza,
  siguientes,
  coherenteConElTipo,
  TRANSICIONES,
  FLUJO_ROTACION,
  POLITICA_CAMAS_SEGURA,
  type PoliticaCamas,
} from '@/lib/hospital/estados-cama'
import { ESTADO_CAMA_LABEL, type EstadoCama } from '@/types/hospital'

/**
 * Charter §2 + decisión del Dr. (2026-07-30) sobre rotación de cama.
 *
 * Dos cosas se protegen aquí:
 *
 * 1. El DEFAULT SEGURO: tras alta o traslado la cama NO pasa directo a libre.
 *    Un default permisivo se vuelve la práctica real del 90 % de las unidades,
 *    porque nadie cambia lo que ya funciona.
 * 2. El conteo de capacidad: `ESTADOS_CAMA_NO_DISPONIBLE` existía en los tipos
 *    y no lo usaba nadie, así que el tablero sumaba a «camas libres» las camas
 *    en limpieza, mantenimiento o bloqueadas.
 *
 * Datos 100 % sintéticos.
 */

const TODOS = Object.keys(TRANSICIONES) as EstadoCama[]
const T = '2026-07-30T12:00:00Z'
const PERMISIVA: PoliticaCamas = {
  requiereLimpiezaTerminalAlEgreso: false,
  requiereConfirmacionLimpieza: false,
  permiteOverrideEmergencia: true,
  exigeMotivoOverride: true,
}

describe('§2 · disponibilidad real, no un sí/no', () => {
  it('libre es libre', () => {
    expect(disponibilidad('libre').disponibilidad).toBe('disponible')
    expect(puedeRecibir('libre')).toBe(true)
  })

  it('limpieza, mantenimiento y bloqueada NO son camas libres ← el defecto', () => {
    for (const e of ['limpieza', 'limpieza_aislamiento', 'mantenimiento', 'bloqueada'] as EstadoCama[]) {
      expect(disponibilidad(e).disponibilidad).toBe('no_disponible')
      expect(puedeRecibir(e)).toBe(false)
    }
  })

  it('reservada tiene bucket PROPIO: contarla como libre anula la reserva', () => {
    const d = disponibilidad('reservada')
    expect(d.disponibilidad).toBe('reservada')
    expect(d.motivo).toMatch(/no se le puede asignar otro paciente/)
    expect(puedeRecibir('reservada')).toBe(false)
  })

  it('aislamiento es CONDICIONADA, y dice que la condición la juzga el médico', () => {
    const d = disponibilidad('aislamiento')
    expect(d.disponibilidad).toBe('condicionada')
    expect(d.motivo).toMatch(/criterio médico/)
  })

  it('«limpia y lista» SÍ puede recibir: no contarla sería subestimar la capacidad', () => {
    // El error inverso al que se corrigió, y en una UCI llena es igual de grave.
    const d = disponibilidad('lista')
    expect(d.disponibilidad).toBe('disponible')
    expect(d.motivo).toMatch(/Limpieza terminal confirmada/)
  })

  it('el OCUPANTE manda sobre la etiqueta guardada', () => {
    expect(disponibilidad('libre', true).disponibilidad).toBe('ocupada')
    expect(disponibilidad('limpieza', true).disponibilidad).toBe('ocupada')
  })

  it('todos los estados dan un motivo: un número de capacidad sin explicación no se audita', () => {
    for (const e of TODOS) expect(disponibilidad(e).motivo.trim()).not.toBe('')
  })

  it('los nueve estados, con etiqueta', () => {
    expect(TODOS).toHaveLength(9)
    for (const e of TODOS) expect(ESTADO_CAMA_LABEL[e]).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · el conteo que el tablero necesita', () => {
  const camas = [
    { estado: 'libre' as EstadoCama },
    { estado: 'libre' as EstadoCama },
    { estado: 'limpieza' as EstadoCama },
    { estado: 'mantenimiento' as EstadoCama },
    { estado: 'reservada' as EstadoCama },
    { estado: 'aislamiento' as EstadoCama },
    { estado: 'libre' as EstadoCama, hayOcupante: true },
  ]

  it('«disponibles» son SÓLO las asignables a cualquiera', () => {
    expect(contarCamas(camas).disponibles).toBe(2)      // NO 5
  })

  it('cada bucket se cuenta aparte y suman el total', () => {
    const c = contarCamas(camas)
    expect(c).toEqual({
      total: 7, ocupadas: 1, disponibles: 2,
      reservadas: 1, condicionadas: 1, noDisponibles: 2,
    })
    expect(c.ocupadas + c.disponibles + c.reservadas + c.condicionadas + c.noDisponibles)
      .toBe(c.total)
  })

  it('una cama recién confirmada limpia cuenta como disponible', () => {
    expect(contarCamas([{ estado: 'lista' }]).disponibles).toBe(1)
  })

  it('sin camas no se divide entre cero', () => {
    expect(contarCamas([]).total).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('decisión del Dr. · el DEFAULT es limpieza terminal requerida', () => {
  it('la política por defecto lo tiene todo en true', () => {
    expect(POLITICA_CAMAS_SEGURA).toEqual({
      requiereLimpiezaTerminalAlEgreso: true,
      requiereConfirmacionLimpieza: true,
      permiteOverrideEmergencia: true,
      exigeMotivoOverride: true,
    })
  })

  it('ocupada → libre NO pasa por omisión ← la decisión', () => {
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA)
    expect(r.permitida).toBe(false)
    expect(r.motivo).toMatch(/ocupada → limpieza → lista → libre/)
  })

  it('el flujo completo sí pasa, paso a paso', () => {
    expect(transicionar('ocupada', 'limpieza', POLITICA_CAMAS_SEGURA).permitida).toBe(true)
    expect(transicionar('limpieza', 'lista', POLITICA_CAMAS_SEGURA).permitida).toBe(true)
    expect(transicionar('lista', 'libre', POLITICA_CAMAS_SEGURA).permitida).toBe(true)
  })

  it('el flujo estándar queda declarado y en orden', () => {
    expect([...FLUJO_ROTACION]).toEqual(['ocupada', 'limpieza', 'lista', 'libre'])
  })

  it('limpieza → libre sin confirmar tampoco pasa', () => {
    const r = transicionar('limpieza', 'libre', POLITICA_CAMAS_SEGURA)
    expect(r.permitida).toBe(false)
    expect(r.motivo).toMatch(/personal autorizado/)
  })

  it('un hospital PUEDE configurarlo distinto', () => {
    expect(transicionar('ocupada', 'libre', PERMISIVA).permitida).toBe(true)
    expect(transicionar('limpieza', 'libre', PERMISIVA).permitida).toBe(true)
  })

  it('las precauciones de aislamiento tienen su propia limpieza', () => {
    expect(transicionar('ocupada', 'limpieza_aislamiento', POLITICA_CAMAS_SEGURA).permitida).toBe(true)
    expect(disponibilidad('limpieza_aislamiento').motivo).toMatch(/control de infecciones del hospital/)
  })

  it('el módulo NO codifica productos, tiempos ni protocolos', async () => {
    // Eso es configuración de control de infecciones del hospital, no una
    // constante universal.
    const mod = await import('@/lib/hospital/estados-cama')
    expect(Object.keys(mod).filter(k =>
      /minutos|producto|desinfectante|hipoclorito|protocolo|contacto/i.test(k))).toEqual([])
  })

  it('el bloqueo se puede consultar sin repetir la lógica en la pantalla', () => {
    expect(bloqueoDePolitica('ocupada', 'libre', POLITICA_CAMAS_SEGURA)).toMatch(/limpieza terminal/)
    expect(bloqueoDePolitica('libre', 'ocupada', POLITICA_CAMAS_SEGURA)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('decisión del Dr. · el override existe, pero DEJA HUELLA', () => {
  const ok = { overrideEmergencia: true, autorizado: true, por: 'usr-ficticio', motivo: 'UCI llena, ingreso crítico', enIso: T }

  it('con usuario autorizado, motivo y fecha: pasa', () => {
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA, ok)
    expect(r.permitida).toBe(true)
  })

  it('y devuelve el registro que HAY QUE GUARDAR', () => {
    // Un override silencioso es peor que no tenerlo: convierte la política en decorado.
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA, ok)
    expect(r.auditoria).toBeDefined()
    expect(r.auditoria!.por).toBe('usr-ficticio')
    expect(r.auditoria!.motivo).toBe('UCI llena, ingreso crítico')
    expect(r.auditoria!.politicaOmitida).toMatch(/limpieza terminal/)
  })

  it('sin autorización, NO', () => {
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA, { ...ok, autorizado: false })
    expect(r.permitida).toBe(false)
    expect(r.motivo).toMatch(/usuario autorizado/)
  })

  it('sin motivo, NO', () => {
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA, { ...ok, motivo: '  ' })
    expect(r.permitida).toBe(false)
    expect(r.motivo).toMatch(/motivo escrito/)
  })

  it('sin saber QUIÉN, NO: no habría pista de auditoría', () => {
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA, { ...ok, por: '' })
    expect(r.permitida).toBe(false)
    expect(r.motivo).toMatch(/pista de auditoría/)
  })

  it('sin fecha válida, NO', () => {
    const r = transicionar('ocupada', 'libre', POLITICA_CAMAS_SEGURA, { ...ok, enIso: 'ayer' })
    expect(r.permitida).toBe(false)
  })

  it('si la unidad no permite override, no hay override', () => {
    const sinOverride = { ...POLITICA_CAMAS_SEGURA, permiteOverrideEmergencia: false }
    expect(transicionar('ocupada', 'libre', sinOverride, ok).permitida).toBe(false)
  })

  it('una transición normal NO genera registro de override', () => {
    expect(transicionar('libre', 'ocupada', POLITICA_CAMAS_SEGURA).auditoria).toBeUndefined()
  })

  it('el override NO inventa pasos que no existen', () => {
    // Sigue sin haber paso de mantenimiento a ocupada, con override o sin él.
    expect(transicionar('mantenimiento', 'ocupada', POLITICA_CAMAS_SEGURA, ok).permitida).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('decisión del Dr. · la limpieza la CONFIRMA alguien', () => {
  it('confirmarLimpieza es la única forma de llegar a «lista»', () => {
    const r = confirmarLimpieza('limpieza', 'Enf. Ficticia', T)
    expect(r.estado).toBe('lista')
    expect(r.confirmadaPor).toBe('Enf. Ficticia')
    expect(r.confirmadaEn).toBe(T)
  })

  it('también desde la limpieza de aislamiento', () => {
    expect(confirmarLimpieza('limpieza_aislamiento', 'Enf. Ficticia', T).estado).toBe('lista')
  })

  it('exige personal identificado', () => {
    expect(() => confirmarLimpieza('limpieza', '  ', T)).toThrowError(/personal identificado/)
  })

  it('exige fecha válida', () => {
    expect(() => confirmarLimpieza('limpieza', 'Enf.', 'ayer')).toThrowError(/fecha inválida/)
  })

  it('no se puede confirmar la limpieza de una cama que no está en limpieza', () => {
    expect(() => confirmarLimpieza('ocupada', 'Enf.', T)).toThrowError(/no está en limpieza/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · lo que la pantalla ofrece', () => {
  it('desde ocupada, sólo los pasos de limpieza', () => {
    expect(siguientes('ocupada', POLITICA_CAMAS_SEGURA).sort())
      .toEqual(['limpieza', 'limpieza_aislamiento'])
  })

  it('con política permisiva aparece también «libre»', () => {
    expect(siguientes('ocupada', PERMISIVA)).toContain('libre')
  })

  it('quedarse igual siempre vale', () => {
    for (const e of TODOS) expect(transicionar(e, e, POLITICA_CAMAS_SEGURA).permitida).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · el tipo y la capacidad no pueden divergir', () => {
  it('ESTADOS_CAMA_NO_DISPONIBLE concuerda con lo que este módulo calcula', () => {
    expect(coherenteConElTipo()).toBe(true)
  })

  it('todo estado tiene fila de transiciones', () => {
    for (const e of TODOS) expect(Array.isArray(TRANSICIONES[e])).toBe(true)
  })

  it('ninguna transición apunta a un estado inexistente', () => {
    for (const e of TODOS) for (const h of TRANSICIONES[e]) expect(TODOS).toContain(h)
  })

  it('cada paso del flujo estándar existe en la tabla', () => {
    for (let i = 0; i < FLUJO_ROTACION.length - 1; i++) {
      expect(TRANSICIONES[FLUJO_ROTACION[i]]).toContain(FLUJO_ROTACION[i + 1])
    }
  })
})
