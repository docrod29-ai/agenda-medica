/**
 * GOLDEN — reenviar la misma reserva no crea una segunda cita, y no miente.
 *
 * ── QUÉ FALLABA, MEDIDO CONTRA EL EMULADOR ──────────────────────────────────
 *
 * Enviando tres veces la misma reserva a `POST /api/public/booking` con un
 * consultorio sembrado en el emulador de Firestore:
 *
 *     1ª → 200 {"ok":true,"citaId":"B3x1…"}
 *     2ª → 409 {"error":"Ese horario acaba de ocuparse. Elige otro."}
 *     3ª → 409 {"error":"Ese horario acaba de ocuparse. Elige otro."}
 *
 * Al paciente se le está diciendo que **otra persona** le quitó el hueco cuando
 * quien lo tomó fue él. Lo razonable entonces es elegir otra hora, y acabar con
 * dos citas para la misma persona.
 *
 * El doble clic es el caso amable. El que duele es el **resultado desconocido**:
 * el servidor creó la cita y la respuesta se perdió por el camino. El paciente
 * no tiene forma de saber que ya la tiene. Y el consultorio recibía dos avisos
 * de «🔔 Nueva cita» de la misma persona, porque los efectos posteriores a la
 * transacción no distinguían un alta de un reenvío.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo el alta del paciente en un navegador real contra los emuladores y
 * probando a propósito el envío duplicado, que es lo que hace un dedo nervioso
 * en un móvil con mala señal.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El chequeo de solape no distinguía «alguien ocupa este hueco» de «TÚ ocupas
 * este hueco». Una reserva repetida solapa consigo misma por definición, así que
 * caía en la rama del conflicto. Familia «el mensaje mentía sobre la causa».
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - Esto prueba la DECISIÓN pura. Que la ruta la use, y que los avisos no se
 *   repitan, lo comprueban los casos de conexión de abajo y el acta de la
 *   corrida contra el emulador
 *   (`docs/audit/carril-excelencia/acta-recorrido-reserva.md`).
 * - No cubre el alta desde el panel (`/api/appointments`): ahí hay sesión y una
 *   asistente que ve la agenda, así que el reenvío ciego no es el mismo
 *   problema. Queda declarado, no resuelto.
 * - No hay ventana de tiempo: un reenvío a los tres días también devuelve la
 *   cita existente. Es lo correcto — sigue siendo la misma cita — pero
 *   significa que esto NO es un «anti-doble-clic», es idempotencia.
 */
import { describe, it, expect } from 'vitest'
import { esLaMismaReserva, telefonoNormalizado } from '@/lib/agenda/reserva-repetida'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const RUTA = leer('src', 'app', 'api', 'public', 'booking', 'route.ts')
const sinImports = (s: string) => s.replace(/^\s*import[^\n]*$/gm, '')

const laDeAntes = {
  estado: 'solicitada',
  pacienteTelefono: '614-123-4567',
  fechaHora: '2026-09-10 11:00',
  tipo: 'primera-vez',
}
const laDeAhora = { telefono: '6141234567', fechaHora: '2026-09-10 11:00', tipo: 'primera-vez' }

describe('el mismo paciente reenviando la misma reserva', () => {
  it('se reconoce aunque el teléfono venga escrito distinto', () => {
    // La misma persona teclea el número de tres formas en tres momentos.
    expect(esLaMismaReserva(laDeAntes, laDeAhora)).toBe(true)
    expect(esLaMismaReserva(laDeAntes, { ...laDeAhora, telefono: '+52 614 123 4567' })).toBe(true)
    expect(esLaMismaReserva(laDeAntes, { ...laDeAhora, telefono: '(614) 123 45 67' })).toBe(true)
  })

  it('no le importa el nombre ni el motivo — sólo el acto de reservar', () => {
    // Quien reenvía puede haber corregido una letra. Exigir igualdad de texto
    // libre haría que un espacio de más creara la cita duplicada que esto evita.
    expect(esLaMismaReserva({ ...laDeAntes, pacienteTelefono: '6141234567' }, laDeAhora)).toBe(true)
  })
})

describe('lo que NO es un reenvío — y aquí equivocarse es peor', () => {
  it('otro teléfono es otra persona', () => {
    expect(esLaMismaReserva(laDeAntes, { ...laDeAhora, telefono: '6149999999' })).toBe(false)
  })

  it('otra hora es otra cita', () => {
    expect(esLaMismaReserva(laDeAntes, { ...laDeAhora, fechaHora: '2026-09-10 11:30' })).toBe(false)
  })

  it('otro tipo de consulta es otra cita', () => {
    expect(esLaMismaReserva(laDeAntes, { ...laDeAhora, tipo: 'seguimiento' })).toBe(false)
  })

  it('una cita cancelada, reagendada o no asistida ya no ocupa su lugar', () => {
    for (const estado of ['cancelada', 'reagendada', 'no-asistio']) {
      expect(esLaMismaReserva({ ...laDeAntes, estado }, laDeAhora), estado).toBe(false)
    }
  })

  it('sin teléfono NO se fusiona nada — ante la duda, dos citas', () => {
    /**
     * Es la decisión que evita el daño irreversible. Dos reservas sin teléfono
     * no son «la misma»: confundirlas juntaría las citas de dos personas
     * distintas, y eso es mucho peor que crear una cita de más, que se cancela.
     */
    expect(esLaMismaReserva({ ...laDeAntes, pacienteTelefono: '' }, laDeAhora)).toBe(false)
    expect(esLaMismaReserva(laDeAntes, { ...laDeAhora, telefono: '' })).toBe(false)
    expect(esLaMismaReserva({ ...laDeAntes, pacienteTelefono: undefined }, laDeAhora)).toBe(false)
    expect(esLaMismaReserva({ ...laDeAntes, pacienteTelefono: 'sin número' }, laDeAhora)).toBe(false)
  })

  it('la normalización se queda en diez dígitos, que es lo que identifica en México', () => {
    expect(telefonoNormalizado('+52 614 123 4567')).toBe('6141234567')
    expect(telefonoNormalizado('614-123-4567')).toBe('6141234567')
    expect(telefonoNormalizado(null)).toBe('')
  })
})

describe('la ruta de reserva lo USA, y no repite los avisos', () => {
  it('el endpoint público llama a la decisión, no la reimplementa', () => {
    expect(RUTA).toContain('@/lib/agenda/reserva-repetida')
    expect(sinImports(RUTA), 'importada pero sin llamar').toContain('esLaMismaReserva(')
  })

  it('el reenvío gana al conflicto — si no, seguiría contestando 409', () => {
    // La cita que «estorba» es la suya: el orden importa.
    expect(RUTA).toMatch(/if \(citaExistente\) \{ citaId = citaExistente; return \}\s*\n\s*if \(conflicto\) throw CONFLICTO/)
  })

  it('devuelve la cita que YA existía, marcada, en vez de un error', () => {
    expect(RUTA).toContain('yaExistia: true')
  })

  it('los avisos de WhatsApp NO se mandan otra vez', () => {
    /**
     * Sin esta salida temprana el consultorio recibiría tres «🔔 Nueva cita» de
     * la misma persona y llamaría tres veces. La cita ya existía: no hay nada
     * nuevo que anunciar.
     */
    const i = RUTA.indexOf('if (citaExistente) {')
    const jAviso = RUTA.indexOf('Nueva cita por el portal')
    const jPaciente = RUTA.indexOf('Recibimos tu solicitud de cita')
    expect(i, 'no hay salida temprana para el reenvío').toBeGreaterThan(-1)
    expect(i, 'el aviso al consultorio queda ANTES de la salida').toBeLessThan(jAviso)
    expect(i, 'el aviso al paciente queda ANTES de la salida').toBeLessThan(jPaciente)
  })
})
