/**
 * GOLDEN — el enlace de la videoconsulta que viaja por WhatsApp (REG-291/292).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-265 cerró el camino del portal, y para no mandar un enlace roto dejó la
 * regla «sin token no se emite enlace». Los tres caminos que salen por WhatsApp
 * —los dos recordatorios del cron y las dos confirmaciones del bot— seguían
 * llamando a `dondeEsLaCita` **sin token**, así que el paciente de una
 * videoconsulta recibía «recibirás el enlace por este medio»… por este medio.
 * Nunca llegaba.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * `PATIENT-TELE-002`, P0 del backlog de V9, levantado por la auditoría
 * `PATIENT-UX-TRUTH-001`. Al cablearlo apareció el segundo defecto, que nadie
 * buscaba: **`/api/telesalud/sala` no miraba `portalTokenVersion`**, así que
 * revocar los enlaces de un paciente cerraba su agenda y sus recetas y dejaba
 * abierta su **sala de video**. Repartir el enlace por WhatsApp sin arreglar eso
 * habría multiplicado un enlace que no se podía retirar.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * 1. REG-291 — acuñar el token exige el secreto de firma, que sólo vive en el
 *    servidor; `lib/whatsapp.ts` se importa también desde el navegador. Nadie
 *    puso el paso intermedio, así que los llamadores de servidor pasaban
 *    `tokenPaciente: undefined` y la rama honesta se quedó de rama única.
 * 2. REG-292 — la revocación se implementó donde se estaba mirando (`/api/portal`)
 *    y la sala nació antes; nadie volvió a pasar por ella.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El TTL lo manda la **ventana de la sala**, no el reloj de quien emite. Un
 * token fijo de un día muere seis horas antes de una cita de las 15:00 avisada
 * el día anterior a las 09:00, y el paciente recibe «Cita no encontrada» — el
 * daño exacto de REG-265. Y cuando la cita queda más lejos que el techo del
 * enlace de portal **no se manda enlace**: la frase honesta, y el recordatorio
 * de 24 h traerá uno vivo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No prueba Daily ni la creación real de la sala: sólo la titularidad.
 * · No prueba el envío por WhatsApp (proveedor externo). Comprueba que el
 *   llamador **le pasa** el token a `dondeEsLaCita` leyendo el código de las dos
 *   rutas, que es lo único observable sin credenciales.
 * · No cubre el camino del portal, que ya cubre el golden de REG-265.
 * · No mide reloj real: `ttlDiasParaLaSala` recibe el instante por parámetro.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ttlDiasParaLaSala, HORAS_DE_HOLGURA } from '@/lib/telesalud/token-de-la-sala'
import { DIAS_MAXIMOS_ENLACE, crearTokenPaciente, verificarTokenPaciente, tokenVigente } from '@/lib/patient-token'
import { HORAS_DESPUES } from '@/lib/telesalud/ventana-sala'
import { dondeEsLaCita } from '@/lib/telesalud/donde-es'

const H = 60 * 60_000
const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

describe('REG-291 · cuánto tiene que durar el token de la sala', () => {
  it('el recordatorio de 24 h emite un token que SIGUE VIVO a la hora de la cita', () => {
    // El caso que rompía la idea de «un día»: aviso a las 09:00 del día
    // anterior para una cita de las 15:00 → 30 h de distancia.
    const ahora = Date.parse('2026-08-10T09:00:00Z')
    const cita = Date.parse('2026-08-11T15:00:00Z')

    const ttl = ttlDiasParaLaSala(cita, ahora)
    expect(ttl).not.toBeNull()

    // Un TTL de 1 día habría muerto ANTES de la cita: eso es lo que se vigila.
    expect(ttl!).toBeGreaterThan(1)

    const venceMs = ahora + ttl! * 86_400_000
    expect(venceMs).toBeGreaterThan(cita)
  })

  it('el token no muere antes que la sala: cubre la ventana + su holgura', () => {
    const ahora = Date.parse('2026-08-10T09:00:00Z')
    const cita = Date.parse('2026-08-10T15:00:00Z')

    const venceMs = ahora + ttlDiasParaLaSala(cita, ahora)! * 86_400_000
    // La sala deja de aceptar a HORAS_DESPUES de la cita; el enlace aguanta eso
    // y una hora más.
    expect(venceMs).toBe(cita + (HORAS_DESPUES + HORAS_DE_HOLGURA) * H)
  })

  it('una cita más lejos que el techo del enlace NO recibe enlace', () => {
    // Agendar por el bot con tres semanas de antelación. Un token no puede durar
    // tanto, así que mandar enlace sería mandar uno caducado el día de la cita.
    const ahora = Date.parse('2026-08-10T09:00:00Z')
    const lejos = ahora + (DIAS_MAXIMOS_ENLACE + 14) * 86_400_000

    expect(ttlDiasParaLaSala(lejos, ahora)).toBeNull()

    // Y el mensaje entonces dice la verdad, sin enlace roto.
    const texto = dondeEsLaCita({
      tipo: 'teleconsulta', citaId: 'c1', clinicId: 'k1',
      baseUrl: 'https://ejemplo.test', tokenPaciente: undefined,
    }).lineas.join('\n')
    expect(texto).not.toContain('/teleconsulta/')
    expect(texto).toMatch(/videoconsulta/i)
  })

  it('una cita cuya sala YA cerró no emite token', () => {
    const cita = Date.parse('2026-08-10T09:00:00Z')
    const despues = cita + (HORAS_DESPUES + HORAS_DE_HOLGURA) * H + 1
    expect(ttlDiasParaLaSala(cita, despues)).toBeNull()
  })

  it('una fecha inservible no revienta: devuelve null', () => {
    expect(ttlDiasParaLaSala(NaN, Date.now())).toBeNull()
    expect(ttlDiasParaLaSala(Date.now(), NaN)).toBeNull()
  })
})

describe('REG-291 · los tres caminos de WhatsApp pasan el token', () => {
  /**
   * Al revés: si alguien vuelve a llamar a `dondeEsLaCita` sin `tokenPaciente`
   * desde una ruta de servidor, el paciente deja de recibir enlace **en
   * silencio** — no falla nada, sólo cambia la frase. Por eso se vigila aquí.
   */
  const RUTAS = [
    'src/app/api/cron/reminders/route.ts',
    'src/app/api/whatsapp/webhook/route.ts',
  ]

  for (const ruta of RUTAS) {
    it(`${ruta} acuña el token en cada llamada a dondeEsLaCita`, () => {
      const src = leer(ruta)
      const llamadas = src.split('dondeEsLaCita({').length - 1
      expect(llamadas).toBeGreaterThan(0)

      const conToken = src.split('tokenPaciente: await tokenParaLaSala({').length - 1
      expect(conToken).toBe(llamadas)
      expect(src).toContain("from '@/lib/telesalud/token-de-la-sala'")
    })
  }

  it('el token NO se acuña en lib/whatsapp.ts, que también corre en el navegador', () => {
    // Firmar ahí filtraría PORTAL_PACIENTE_SECRET al cliente.
    const src = leer('src/lib/whatsapp.ts')
    expect(src).not.toContain('crearTokenPaciente')
    expect(src).not.toContain('token-de-la-sala')
  })
})

describe('REG-292 · revocar tiene que cerrar también la sala de video', () => {
  it('un token emitido ANTES de la revocación deja de valer', () => {
    const viejo = verificarTokenPaciente(crearTokenPaciente('k1', 'p1', 1, 'agenda', 3))!
    expect(viejo).not.toBeNull()
    // El expediente subió su contador a 4: el enlace de antes cae.
    expect(tokenVigente(viejo.version, 4)).toBe(false)
    // Y el emitido después sigue sirviendo.
    const nuevo = verificarTokenPaciente(crearTokenPaciente('k1', 'p1', 1, 'agenda', 4))!
    expect(tokenVigente(nuevo.version, 4)).toBe(true)
  })

  it('la ruta de la sala comprueba la versión, y no sólo la firma', () => {
    /**
     * Al revés: esta comprobación es la que NO existía. Sin ella, la ruta
     * autorizaba por firma + titularidad y nada más, así que un enlace revocado
     * seguía abriendo la consulta por video.
     */
    const src = leer('src/app/api/telesalud/sala/route.ts')
    expect(src).toContain('portalTokenVersion')
    expect(src).toContain('tokenVigente(tk.version')
    // Y la revocación tiene que poder QUITAR la autorización ya concedida.
    expect(src).toContain('autorizadoPorToken = false')
  })
})
