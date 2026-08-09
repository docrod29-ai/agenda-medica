/**
 * GOLDEN — PATIENT-TELE-002 · la videoconsulta se anunciaba por WhatsApp SIN enlace.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-265 cerró el camino del portal (el botón «Entrar a la videoconsulta» ya
 * lleva `&t=`), y de paso puso la regla correcta en `dondeEsLaCita`: **sin token
 * no se emite enlace**, porque `/api/telesalud/sala` responde 404 «Cita no
 * encontrada» a quien no trae titularidad, y un paciente que lee eso media hora
 * antes de su consulta cree que se quedó sin cita.
 *
 * Pero los tres llamadores de servidor no acuñaban token: el cron de
 * recordatorios y los dos mensajes de «cita agendada» del bot. Resultado: al
 * paciente de una videoconsulta le llegaba, por WhatsApp, el texto «recibirás el
 * enlace de la videollamada **por este medio** antes de tu cita» — en el mensaje
 * que era ese medio. Honesto y sin enlace, las dos cosas a la vez.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría `PATIENT-UX-TRUTH-001` (V9, 8-ago-2026): al cerrar REG-265 se anotó
 * que quedaban tres llamadores sin token, y se dejó escrito en el backlog en vez
 * de darlo por cerrado.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Acuñar exige `PORTAL_PACIENTE_SECRET`, que sólo vive en el servidor, y el
 * módulo que compone los mensajes (`lib/whatsapp.ts`) se importa también desde
 * el navegador. Nadie puso la pieza intermedia. Es
 * `lib/telesalud/token-de-sala.ts`.
 *
 * ── LA TRAMPA DEL NÚMERO REDONDO ─────────────────────────────────────────────
 *
 * El plan escrito decía «token de 1 día». El recordatorio de 24 h sale entre 23
 * y 26 horas antes de la cita: un token de 24 h **caduca antes de la consulta
 * que anuncia**. El enlace llegaría, y fallaría solo, justo el día de la cita.
 * Por eso la vida del token se deriva de la hora de la cita
 * (`diasDeVidaDelEnlace`) y hay un caso aquí que sólo pasa si se deriva.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No abre un navegador: que la sala de Daily funcione no se comprueba aquí.
 * - No comprueba que WhatsApp ENTREGUE el mensaje (eso vive en el outbox).
 * - No cubre el alcance del token: hoy es `agenda`, el mismo que el enlace del
 *   portal que ya viaja por WhatsApp. Un alcance `sala`, más estrecho, es
 *   `TELE-ALCANCE-001` en el backlog — no está resuelto y este archivo no
 *   pretende que lo esté.
 * - `/api/telesalud/sala` **no comprueba la revocación** (`tokenVigente`): el
 *   token se emite con la versión del expediente, pero quien la mira es
 *   `/api/portal`. Anotado, no cerrado.
 *
 * Datos 100 % ficticios. Sin red, sin emulador.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Doble del Admin SDK: sólo la lectura del contador de revocación ──────────
const getPaciente = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'patients') return { doc: () => ({ get: getPaciente }) }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))

import { diasDeVidaDelEnlace, MAX_DIAS_ENLACE_SALA, HORAS_DESPUES } from '@/lib/telesalud/ventana-sala'
import { tokenDeSalaParaElPaciente } from '@/lib/telesalud/token-de-sala'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { dondeEsLaCita } from '@/lib/telesalud/donde-es'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'
const DIA = 86_400_000

/** Hora de pared («YYYY-MM-DD HH:mm») que cae a `msDesdeAhora` del instante dado. */
function citaEn(ahoraMs: number, msDesdeAhora: number): string {
  const d = new Date(ahoraMs + msDesdeAhora)
  // Se compone en la zona del consultorio, que es como se guarda.
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_DEFAULT, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const p = (t: string) => partes.find(x => x.type === t)!.value
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}`
}

beforeEach(() => {
  vi.clearAllMocks()
  getPaciente.mockResolvedValue({ data: () => ({ portalTokenVersion: 0 }) })
})

describe('cuánto vive el enlace de la sala', () => {
  const AHORA = Date.UTC(2026, 7, 10, 16, 0, 0) // 10-ago-2026 10:00 en CDMX

  it('EL CASO QUE ROMPÍA EL NÚMERO REDONDO: el token del recordatorio de 24 h sigue vivo EN la cita', () => {
    // El recordatorio sale entre 23 y 26 h antes. Con «1 día» fijo, el token
    // caducaba antes de la hora de la consulta. Se prueba el peor de los tres:
    // 26 h de antelación.
    for (const horasAntes of [23, 24, 26]) {
      const fechaHora = citaEn(AHORA, horasAntes * 3_600_000)
      const dias = diasDeVidaDelEnlace(fechaHora, AHORA)
      expect(dias, `${horasAntes} h antes`).not.toBeNull()
      const vidaMs = dias! * DIA
      expect(vidaMs, `${horasAntes} h antes`).toBeGreaterThan(horasAntes * 3_600_000)
    }
  })

  it('el enlace sobrevive al CIERRE de la sala, para que el mensaje sea el bueno', () => {
    // Si caducara en el mismo instante que la sala, el que llega tarde leería
    // «Cita no encontrada» en vez de «la sala de esta consulta ya se cerró».
    const fechaHora = citaEn(AHORA, 2 * 3_600_000)
    const muere = AHORA + diasDeVidaDelEnlace(fechaHora, AHORA)! * DIA
    const cierraLaSala = instanteMX(fechaHora.slice(0, 10), fechaHora.slice(11, 16), TZ_DEFAULT).getTime()
      + HORAS_DESPUES * 3_600_000
    expect(muere).toBeGreaterThan(cierraLaSala)
  })

  it('una cita que ya pasó y cuya sala cerró no emite enlace', () => {
    expect(diasDeVidaDelEnlace(citaEn(AHORA, -3 * DIA), AHORA)).toBeNull()
  })

  it('una cita demasiado lejana NO emite enlace: lo llevará el recordatorio', () => {
    // Un token vivo semanas en un mensaje que se reenvía es lo que se recortó al
    // bajar el portal de 30 días a 7.
    expect(diasDeVidaDelEnlace(citaEn(AHORA, (MAX_DIAS_ENLACE_SALA + 5) * DIA), AHORA)).toBeNull()
  })

  it('sin fecha no se inventa una ventana', () => {
    expect(diasDeVidaDelEnlace(undefined, AHORA)).toBeNull()
    expect(diasDeVidaDelEnlace('', AHORA)).toBeNull()
  })
})

describe('acuñar el token del enlace', () => {
  it('una teleconsulta recibe un token que el servidor de la sala aceptaría', async () => {
    const ahoraMs = Date.now()
    const token = await tokenDeSalaParaElPaciente({
      tipo: 'teleconsulta', clinicId: CLINICA, pacienteId: PACIENTE,
      fechaHora: citaEn(ahoraMs, 24 * 3_600_000), ahoraMs,
    })
    expect(token).toBeTruthy()

    // El MISMO predicado que aplica `/api/telesalud/sala` para autorizar.
    const tk = verificarTokenPaciente(token)
    expect(tk).not.toBeNull()
    expect(tk!.clinicId === CLINICA && !!tk!.patientId && tk!.patientId === PACIENTE).toBe(true)
  })

  it('una cita PRESENCIAL no acuña nada, y no toca el expediente', async () => {
    const ahoraMs = Date.now()
    const token = await tokenDeSalaParaElPaciente({
      tipo: 'seguimiento', clinicId: CLINICA, pacienteId: PACIENTE,
      fechaHora: citaEn(ahoraMs, 24 * 3_600_000), ahoraMs,
    })
    expect(token).toBeUndefined()
    // Una lectura por cada cita presencial del día multiplicaría el cron.
    expect(getPaciente).not.toHaveBeenCalled()
  })

  it('sin pacienteId FALLA CERRADO: prefiere no dar enlace a dar uno roto', async () => {
    const ahoraMs = Date.now()
    expect(await tokenDeSalaParaElPaciente({
      tipo: 'teleconsulta', clinicId: CLINICA, pacienteId: '',
      fechaHora: citaEn(ahoraMs, 3_600_000), ahoraMs,
    })).toBeUndefined()
    expect(await tokenDeSalaParaElPaciente({
      tipo: 'teleconsulta', clinicId: '', pacienteId: PACIENTE,
      fechaHora: citaEn(ahoraMs, 3_600_000), ahoraMs,
    })).toBeUndefined()
  })

  it('un expediente ILEGIBLE no tumba el recordatorio: emite con versión 0', async () => {
    getPaciente.mockRejectedValue(new Error('firestore caída'))
    const ahoraMs = Date.now()
    const token = await tokenDeSalaParaElPaciente({
      tipo: 'teleconsulta', clinicId: CLINICA, pacienteId: PACIENTE,
      fechaHora: citaEn(ahoraMs, 3_600_000), ahoraMs,
    })
    expect(verificarTokenPaciente(token)?.version).toBe(0)
  })

  it('el token nace con la VERSIÓN vigente, para que la revocación lo alcance', async () => {
    getPaciente.mockResolvedValue({ data: () => ({ portalTokenVersion: 4 }) })
    const ahoraMs = Date.now()
    const token = await tokenDeSalaParaElPaciente({
      tipo: 'teleconsulta', clinicId: CLINICA, pacienteId: PACIENTE,
      fechaHora: citaEn(ahoraMs, 3_600_000), ahoraMs,
    })
    expect(verificarTokenPaciente(token)?.version).toBe(4)
  })

  it('el token sigue siendo válido A LA HORA de la cita, no sólo al emitirlo', async () => {
    // Prueba AL REVÉS del defecto: con `ttlDias = 1` fijo este caso falla.
    vi.useFakeTimers()
    try {
      const ahoraMs = Date.UTC(2026, 7, 10, 16, 0, 0)
      vi.setSystemTime(ahoraMs)
      const fechaHora = citaEn(ahoraMs, 26 * 3_600_000)
      const token = await tokenDeSalaParaElPaciente({
        tipo: 'teleconsulta', clinicId: CLINICA, pacienteId: PACIENTE, fechaHora, ahoraMs,
      })
      expect(verificarTokenPaciente(token)).not.toBeNull()
      // Se viaja a la hora exacta de la consulta.
      vi.setSystemTime(instanteMX(fechaHora.slice(0, 10), fechaHora.slice(11, 16), TZ_DEFAULT).getTime())
      expect(verificarTokenPaciente(token)).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('y el enlace compuesto con ese token SÍ lleva `&t=`', async () => {
    const ahoraMs = Date.now()
    const tokenPaciente = await tokenDeSalaParaElPaciente({
      tipo: 'teleconsulta', clinicId: CLINICA, pacienteId: PACIENTE,
      fechaHora: citaEn(ahoraMs, 3_600_000), ahoraMs,
    })
    const texto = dondeEsLaCita({
      tipo: 'teleconsulta', citaId: 'cita-ficticia', clinicId: CLINICA,
      baseUrl: 'https://ejemplo.invalid', tokenPaciente,
    }).lineas.join('\n')
    expect(texto).toContain('/teleconsulta/cita-ficticia?c=' + CLINICA)
    expect(texto).toContain('&t=')
    expect(texto).not.toContain('dr=1')
  })
})

/**
 * EL DATO TIENE QUE LLEGAR — los tres llamadores, en su fuente.
 *
 * Las pruebas de arriba comprueban que la pieza funciona. Éstas comprueban que
 * los tres sitios que mandan el mensaje la usan: es exactamente el paso que
 * faltó en REG-265, cuando la función quedó bien y sus llamadores no.
 */
describe('los tres llamadores de servidor acuñan el token', () => {
  const cron = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'cron', 'reminders', 'route.ts'), 'utf8')
  const bot = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'), 'utf8')

  it('el cron de recordatorios lo acuña y lo pasa', () => {
    expect(cron).toContain('tokenDeSalaParaElPaciente')
    expect(cron).toContain('tokenPaciente,')
  })

  it('los DOS mensajes del bot lo acuñan y lo pasan', () => {
    expect(bot.match(/tokenDeSalaParaElPaciente\(/g) ?? []).toHaveLength(2)
    expect(bot.match(/dondeEsLaCita\(/g) ?? []).toHaveLength(2)
    expect(bot).toContain('tokenPaciente: tokenSalaBot')
    expect(bot).toContain('tokenPaciente: tokenSalaLE')
  })

  it('NINGÚN llamador de navegador acuña: el secreto de firma no baja al cliente', () => {
    const whatsapp = readFileSync(join(process.cwd(), 'src', 'lib', 'whatsapp.ts'), 'utf8')
    expect(whatsapp).not.toContain('crearTokenPaciente')
    expect(whatsapp).not.toContain('token-de-sala')
  })
})
