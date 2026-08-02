/**
 * GOLDEN — el menú ofrecía cancelar y el bot no cancelaba nada.
 *
 * «3️⃣ Cancelar cita» contestaba «comuníquese al consultorio… también puede
 * escribir su nombre completo y le ayudamos», y el estado siguiente IGNORABA lo
 * que el paciente escribiera: repetía el teléfono y volvía al menú. El paciente
 * tecleaba su nombre completo —dato personal, a un canal externo— para nada, y
 * su cita seguía viva: el día de la consulta contaba como no-show.
 */
import { describe, it, expect } from 'vitest'
import { clasificarCitas, mensajeBloqueada } from '@/lib/whatsapp/citas-cancelables'
import { instanteMX } from '@/lib/timezone'

const TZ = 'America/Mexico_City'
const aInstante = (fh: string) => instanteMX(fh.slice(0, 10), fh.slice(11, 16), TZ).getTime()
const AHORA = instanteMX('2026-08-10', '08:00', TZ).getTime()
const H = 3_600_000

const cita = (id: string, fechaHora: string, estado = 'confirmada') => ({ id, fechaHora, estado })

describe('clasificarCitas', () => {
  it('una cita futura y tocable se puede cancelar', () => {
    const r = clasificarCitas([cita('a', '2026-08-12 10:00')], AHORA, aInstante, 24)
    expect(r.cancelables.map(c => c.id)).toEqual(['a'])
    expect(r.bloqueadas).toEqual([])
  })

  it('la política del consultorio se respeta: el bot NO es la puerta trasera', () => {
    // Con 24 h de política, una cita de dentro de 3 h no se cancela por aquí.
    const r = clasificarCitas([cita('a', '2026-08-10 11:00')], AHORA, aInstante, 24)
    expect(r.cancelables).toEqual([])
    expect(r.bloqueadas.map(c => c.id)).toEqual(['a'])
  })

  it('sin política declarada no se inventa una', () => {
    const r = clasificarCitas([cita('a', '2026-08-10 11:00')], AHORA, aInstante, 0)
    expect(r.cancelables.map(c => c.id)).toEqual(['a'])
  })

  it('lo que ya pasó no se cancela', () => {
    expect(clasificarCitas([cita('a', '2026-08-10 07:00')], AHORA, aInstante, 0).cancelables).toEqual([])
  })

  it('lo terminado y lo que ya movió dinero lo resuelve el consultorio', () => {
    const citas = ['atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada', 'pagada', 'pendiente-pago']
      .map((e, i) => cita(`c${i}`, '2026-08-12 10:00', e))
    const r = clasificarCitas(citas, AHORA, aInstante, 0)
    expect(r.cancelables).toEqual([])
    expect(r.bloqueadas).toEqual([])
  })

  it('con varias, primero la más próxima', () => {
    const r = clasificarCitas([
      cita('lejos', '2026-08-20 10:00'),
      cita('cerca', '2026-08-12 10:00'),
    ], AHORA, aInstante, 0)
    expect(r.cancelables.map(c => c.id)).toEqual(['cerca', 'lejos'])
  })

  it('las horas que faltan salen en el resultado, no se recalculan fuera', () => {
    const r = clasificarCitas([cita('a', '2026-08-10 18:00')], AHORA, aInstante, 0)
    expect(r.cancelables[0].horasFaltan).toBeCloseTo(10, 5)
    expect(AHORA + r.cancelables[0].horasFaltan * H).toBeCloseTo(aInstante('2026-08-10 18:00'), -3)
  })

  it('el aviso de la cita bloqueada dice a dónde llamar', () => {
    // «No encontré citas» dejaría al paciente tranquilo y sin presentarse.
    expect(mensajeBloqueada(24, '555-1234')).toContain('555-1234')
    expect(mensajeBloqueada(24, '555-1234')).toContain('24')
  })
})
