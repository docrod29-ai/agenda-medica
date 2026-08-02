/**
 * GOLDEN — la cortesía en el corte de caja.
 *
 * `exentarCobro` guarda con todo cuidado QUIÉN autorizó la cortesía, CUÁNDO y
 * POR QUÉ: «una decisión deliberada y AUDITADA, no un cobro de $0 que ensucie el
 * corte de caja», dice su propio comentario. Y esos tres campos no los leía
 * **ninguna pantalla**.
 *
 * Dos consecuencias, las dos sobre dinero:
 *
 *  · el corte de caja ni mencionaba las cortesías. Diez atendidos, ocho
 *    cobrados, dos de cortesía, y la caja mostraba ocho sin rastro de los otros
 *    dos: quien cuadra el dinero no podía distinguir «dos que autorizó el
 *    doctor» de «dos que a alguien se le olvidó cobrar»;
 *  · y la TASA DE COBRO las contaba como cobranza fallida. `cuentasPorCobrar` ya
 *    las excluía —«no son deuda»—, pero el porcentaje bajaba igual que con un
 *    descuido, castigando una decisión deliberada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { embudoCobro, cuentasPorCobrar, cortesiasDelDia, POR_QUE_LA_CORTESIA_SE_ENSEÑA } from '@/lib/corte-caja'
import type { Appointment } from '@/types'
import type { Cobro } from '@/lib/cobros'

const cita = (id: string, extra: Partial<Appointment> = {}): Appointment => ({
  id, fechaHora: '2026-08-02T10:00:00', duracion: 30, tipo: 'consulta', estado: 'atendida',
  origen: 'consultorio', medicoNombre: 'Dra. Ruiz', pacienteId: `p-${id}`, pacienteNombre: `Paciente ${id}`,
  confirmadoPaciente: true, recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
  consentimientoMensajes: true, ...extra,
} as Appointment)

const cobro = (citaId: string): Cobro => ({
  id: `c-${citaId}`, citaId, monto: 800, cancelado: false, concepto: 'consulta',
} as Cobro)

describe('la cortesía NO es una cobranza fallida', () => {
  // Tres atendidas: una cobrada, una de cortesía, una sin cobrar de verdad.
  const citas = [
    cita('a', { cobroId: 'c-a' }),
    cita('b', { cobroExento: true } as Partial<Appointment>),
    cita('c'),
  ]
  const cobros = [cobro('a')]

  it('sale del denominador de la tasa de cobro', () => {
    // 1 cobrada de 2 cobrables = 50 %. Antes era 1 de 3 = 33 %, castigando la
    // decisión del médico igual que el descuido.
    const e = embudoCobro(citas, cobros)
    expect(e.atendidas).toBe(3)
    expect(e.cortesias).toBe(1)
    expect(e.cobradas).toBe(1)
    expect(Math.round(e.tasaCobro * 100)).toBe(50)
  })

  it('pero se CUENTA aparte: no se esconde', () => {
    expect(embudoCobro(citas, cobros).cortesias).toBe(1)
    expect(POR_QUE_LA_CORTESIA_SE_ENSEÑA).toMatch(/se ven igual en la caja/)
  })

  it('sigue sin ser deuda', () => {
    const pc = cuentasPorCobrar(citas, cobros)
    expect(pc.map(x => x.citaId)).toEqual(['c'])
  })

  it('si TODO fue cortesía, la tasa no divide entre cero', () => {
    const e = embudoCobro([cita('b', { cobroExento: true } as Partial<Appointment>)], [])
    expect(e.tasaCobro).toBe(0)
    expect(e.cortesias).toBe(1)
  })
})

describe('cortesiasDelDia enseña quién la autorizó y por qué', () => {
  const citas = [
    cita('b', {
      cobroExento: true, exentoMotivo: 'Hija de una colega',
      exentoPorNombre: 'Dr. Rodríguez', exentoEn: '2026-08-02T11:00:00.000Z',
    } as Partial<Appointment>),
  ]

  it('trae el rastro completo que ya se guardaba', () => {
    const [c] = cortesiasDelDia(citas)
    expect(c.paciente).toBe('Paciente b')
    expect(c.motivo).toBe('Hija de una colega')
    expect(c.autorizadaPor).toBe('Dr. Rodríguez')
    expect(c.autorizadaEn).toBe('2026-08-02T11:00:00.000Z')
  })

  it('un registro viejo sin motivo lo DICE, no lo inventa', () => {
    // `exentarCobro` exige motivo, así que un vacío aquí es un registro anterior.
    const [c] = cortesiasDelDia([cita('b', { cobroExento: true } as Partial<Appointment>)])
    expect(c.motivo).toBe('Sin motivo registrado')
    expect(c.autorizadaPor).toBe('')
  })

  it('sólo las atendidas: una cancelada no es una cortesía', () => {
    expect(cortesiasDelDia([cita('z', { estado: 'cancelada', cobroExento: true } as Partial<Appointment>)])).toEqual([])
  })
})

describe('el corte de caja lo enseña', () => {
  const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'corte-caja', 'page.tsx'), 'utf8')

  it('hay panel de cortesías con motivo y autor', () => {
    expect(s).toContain('cortesiasDelDia(citas)')
    expect(s).toContain('Cortesías (')
    expect(s).toContain('autorizó ${c.autorizadaPor}')
    expect(s).toContain('sin autor registrado')
  })

  it('y el embudo avisa de que están fuera de la tasa', () => {
    expect(s).toContain('de cortesía (fuera de la tasa)')
  })
})
