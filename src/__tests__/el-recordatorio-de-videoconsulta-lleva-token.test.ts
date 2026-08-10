/**
 * LA VIDEOCONSULTA QUE SE ANUNCIA POR WHATSAPP Y NO TRAE POR DÓNDE ENTRAR
 * — V9 · REG-306 · cierra `PATIENT-TELE-002` (P0).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-268 cerró el camino del portal: `/mi/<token>` ya pasa el token al botón
 * de la sala. Lo que dejó abierto, y lo dejó dicho, es el camino por el que la
 * videoconsulta **se anuncia de verdad**: WhatsApp.
 *
 * Los tres emisores de servidor —el recordatorio de 24 h, el de mismo día, y
 * los dos mensajes de cita agendada del bot— llamaban a `dondeEsLaCita` **sin
 * `tokenPaciente`**, porque ninguno lo acuñaba. Así que todos caían en la rama
 * honesta:
 *
 *     «Recibirás el enlace de la videollamada por este medio antes de tu cita.»
 *
 * Honesto y falso a la vez: **no había ningún otro medio**. Ningún emisor lo
 * mandaba nunca. El paciente que hacía caso al mensaje esperaba un enlace que
 * no existía; el que no lo hacía, entraba al portal — que también le llega por
 * WhatsApp, así que el camino existía, pero con un paso de más justo a la hora
 * de su consulta.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No se descubrió: **quedó escrito** en el «qué NO cubre» de
 * `enlace-de-videoconsulta-lleva-token.test.ts` y anotado como `PATIENT-TELE-002`
 * en el backlog de V9, con su plan. Es la forma barata de encontrar un defecto:
 * que el arreglo anterior declare el trozo que no arregló.
 *
 * ── LA TRAMPA QUE TENÍA EL PLAN, Y POR QUÉ NO SE SIGUIÓ AL PIE DE LA LETRA ──
 *
 * El plan del backlog decía `crearTokenPaciente(..., 1, 'agenda', version)`.
 * Un día de vigencia **rompe el caso principal**: el recordatorio de 24 horas
 * sale un día antes, así que el token caducaría justo a la hora de la consulta
 * — y la sala sigue abierta dos horas más (`HORAS_DESPUES`). El paciente
 * puntual leería «Cita no encontrada»: el mismo 404 de REG-268, reintroducido
 * por la vía de la caducidad en vez de la del parámetro que falta.
 *
 * Por eso la vigencia **se deriva del cierre real de la sala**, con un día de
 * margen, y no se fija. Ésta es la prueba que muerde: el token tiene que
 * sobrevivir a la sala.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Se acuña en un solo sitio.** `token-de-sala-servidor.ts`. Escribir la
 *    regla tres veces es la causa raíz de REG-300.
 * 2. **Alcance `agenda`, nunca `clinico`.** `/api/telesalud/sala` sólo mira que
 *    el token esté atado al paciente de la cita; el alcance clínico metería
 *    documentos médicos en un enlace de WhatsApp sin ninguna necesidad.
 * 3. **Hay techo.** Una cita a dos meses no lleva una credencial de dos meses
 *    en un mensaje que se reenvía. Más allá del techo no se acuña nada y el
 *    mensaje vuelve a decir «recibirás el enlace» — que ahora sí se cumple,
 *    porque el recordatorio de 24 h entra en ventana.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba el 404 contra la ruta de verdad.** Que `/api/telesalud/sala`
 *   acepte este token concreto se sigue probando aparte y con mock
 *   (`telesalud-sala-or.test.ts`). Lo que aquí se comprueba es que el token
 *   existe, está atado a quien debe y no caduca antes que la sala.
 * - **No prueba la revocación.** `sala/route.ts` **no** compara
 *   `portalTokenVersion` hoy; el token se emite con la versión correcta para
 *   que el día que la compare siga sirviendo, pero eso no está verificado del
 *   otro lado.
 * - **No se ha visto en un teléfono.** Ningún WhatsApp real se envió.
 * - No cubre la ventana horaria de la sala: eso es `ventana-sala.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  diasDeVigenciaDelEnlace,
  tokenDeSalaParaElPaciente,
  MAX_DIAS_DEL_ENLACE,
} from '@/lib/telesalud/enlace-de-sala'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { HORAS_DESPUES } from '@/lib/telesalud/ventana-sala'

const HORA_MS = 3_600_000
const DIA_MS = 86_400_000
const CIERRE_MS = HORAS_DESPUES * HORA_MS

/** Caducidad declarada en el propio token, en milisegundos. */
function caducidadDelToken(token: string): number {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
  ) as { e: number }
  return payload.e * 1000
}

describe('la vigencia del enlace se deriva de la sala, no se fija', () => {
  const AHORA = Date.parse('2026-08-10T09:00:00.000Z')

  it('el recordatorio de 24 h emite un token que SOBREVIVE al cierre de la sala', () => {
    /**
     * LA QUE MUERDE. Con la vigencia fija de un día que proponía el plan, este
     * token caducaba a las 24 h y la sala cierra a las 26: el paciente puntual
     * recibía «Cita no encontrada» a la hora exacta de su consulta.
     *
     * Probada al revés: con `ttlDias = 1` fijo, `caducidad` cae por debajo de
     * `cierreDeLaSala` y esta expectativa falla.
     */
    const inicioCita = AHORA + 24 * HORA_MS
    const token = tokenDeSalaParaElPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', inicioCitaMs: inicioCita, ahoraMs: AHORA,
    })
    expect(token).toBeTruthy()
    expect(caducidadDelToken(token!)).toBeGreaterThan(inicioCita + CIERRE_MS)
  })

  it('el recordatorio de mismo día también, con la cita a una hora vista', () => {
    const inicioCita = AHORA + 1 * HORA_MS
    const token = tokenDeSalaParaElPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', inicioCitaMs: inicioCita, ahoraMs: AHORA,
    })
    expect(caducidadDelToken(token!)).toBeGreaterThan(inicioCita + CIERRE_MS)
  })

  it('una cita que empieza dentro de un minuto sigue teniendo al menos un día', () => {
    /** El caso del paciente que agenda para dentro de un rato: la vigencia
     *  nunca puede redondear a cero. */
    expect(diasDeVigenciaDelEnlace(AHORA + 60_000, AHORA)).toBeGreaterThanOrEqual(1)
  })

  it('la sala YA CERRADA no acuña nada', () => {
    /** Un token para una sala cerrada no abre nada y sí es una credencial
     *  suelta más en un teléfono. */
    expect(diasDeVigenciaDelEnlace(AHORA - CIERRE_MS - 60_000, AHORA)).toBeNull()
    expect(tokenDeSalaParaElPaciente({
      clinicId: 'clin_1', patientId: 'pac_1',
      inicioCitaMs: AHORA - CIERRE_MS - 60_000, ahoraMs: AHORA,
    })).toBeUndefined()
  })

  it('una cita más allá del techo no acuña: el enlace llega con el recordatorio', () => {
    const lejos = AHORA + 30 * DIA_MS
    expect(diasDeVigenciaDelEnlace(lejos, AHORA)).toBeNull()
    expect(tokenDeSalaParaElPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', inicioCitaMs: lejos, ahoraMs: AHORA,
    })).toBeUndefined()
  })

  it('nunca supera el techo de días, esté donde esté la cita', () => {
    for (let h = 1; h <= 24 * 40; h += 7) {
      const dias = diasDeVigenciaDelEnlace(AHORA + h * HORA_MS, AHORA)
      if (dias !== null) expect(dias).toBeLessThanOrEqual(MAX_DIAS_DEL_ENLACE)
    }
  })

  it('una fecha inutilizable devuelve null en vez de un token con NaN dentro', () => {
    expect(diasDeVigenciaDelEnlace(NaN, AHORA)).toBeNull()
  })
})

describe('el token acuñado es el mínimo que funciona', () => {
  const AHORA = Date.parse('2026-08-10T09:00:00.000Z')
  const base = { clinicId: 'clin_1', patientId: 'pac_1', inicioCitaMs: AHORA + 3 * HORA_MS, ahoraMs: AHORA }

  it('queda atado a ESE paciente de ESA clínica', () => {
    const tk = verificarTokenPaciente(tokenDeSalaParaElPaciente(base))
    expect(tk?.clinicId).toBe('clin_1')
    expect(tk?.patientId).toBe('pac_1')
  })

  it('alcance `agenda`, no `clinico`', () => {
    /**
     * Probada al revés: emitiéndolo `clinico`, falla. Este enlace viaja por
     * WhatsApp y `clinico` abre la acción `documentos` de `/api/portal`, que
     * devuelve diagnósticos y medicamentos de notas firmadas. La sala no lo
     * necesita: sólo mira que el token sea del paciente de la cita.
     */
    expect(verificarTokenPaciente(tokenDeSalaParaElPaciente(base))?.alcance).toBe('agenda')
  })

  it('conserva la versión del expediente, para que la revocación pueda cortarlo', () => {
    expect(verificarTokenPaciente(tokenDeSalaParaElPaciente({ ...base, version: 4 }))?.version).toBe(4)
  })

  it('sin paciente vinculado no se inventa un token', () => {
    /** Una cita huérfana no tiene a quién atar la credencial. Antes de v884 el
     *  bot dejaba `pacienteId: ''`; todavía puede llegar así. */
    expect(tokenDeSalaParaElPaciente({ ...base, patientId: '' })).toBeUndefined()
    expect(tokenDeSalaParaElPaciente({ ...base, clinicId: '' })).toBeUndefined()
  })
})

describe('EL DATO TIENE QUE LLEGAR — los emisores lo pasan de verdad', () => {
  /**
   * Que la función acuñe el token no sirve de nada si quien compone el mensaje
   * no se lo da: eso es exactamente lo que llevaba meses pasando. Se lee el
   * código fuente a propósito — es la comprobación del **otro lado**, y montar
   * el cron o el webhook enteros para verla costaría más de lo que enseña.
   *
   * La comprobación es sobre TODAS las llamadas, no sobre las tres de hoy: un
   * emisor nuevo que se olvide del token vuelve a poner el rojo aquí.
   */
  const EMISORES = [
    join('src', 'app', 'api', 'cron', 'reminders', 'route.ts'),
    join('src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'),
  ]

  for (const rel of EMISORES) {
    it(`${rel}: toda llamada a dondeEsLaCita lleva tokenPaciente`, () => {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      const llamadas = src.split('dondeEsLaCita(').slice(1)
      expect(llamadas.length).toBeGreaterThan(0)
      for (const trozo of llamadas) {
        // El objeto literal de la llamada: hasta el `})` que la cierra.
        const argumentos = trozo.slice(0, trozo.indexOf('})'))
        expect(argumentos).toContain('tokenPaciente')
      }
    })

    it(`${rel}: lo acuña por el ayudante único, no a mano`, () => {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src).toContain('tokenDeSalaDesdeElServidor')
      // Firmar a mano aquí sería la cuarta copia de la regla. REG-300.
      expect(src).not.toContain('crearTokenPaciente')
    })
  }
})
