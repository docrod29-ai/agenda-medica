/**
 * EL ENLACE DE LA VIDEOCONSULTA NO LLEGABA POR DONDE SE ANUNCIA — V9 · REG-291.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La videoconsulta se agenda y se recuerda por WhatsApp. Los tres mensajes que
 * la anuncian —el alta de la cita por el bot, la cita ganada desde la lista de
 * espera, y los dos recordatorios del cron— llamaban a `dondeEsLaCita` **sin
 * token**, porque ninguno lo acuñaba. Y sin token ese módulo no emite enlace: a
 * propósito, porque un enlace sin token contesta 404 «Cita no encontrada»
 * (REG-268).
 *
 * O sea que el paciente recibía, en los tres:
 *
 *     «Recibirás el enlace de la videollamada por este medio antes de tu cita.»
 *
 * Y **este medio era justo ése**. No había ningún otro mensaje detrás: el enlace
 * sólo existía dentro del portal, al que el paciente tenía que acordarse de
 * entrar, a la hora de su consulta y con prisa.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No por casualidad: REG-268 lo dejó **escrito como hueco conocido** en su
 * propio golden («el camino de WhatsApp sigue sin enlace… esto NO cierra ese
 * hueco: lo hace honesto») y anotado en el backlog de V9 como `PATIENT-TELE-002`,
 * P0. Esta prueba es la que lo cierra.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Acuñar el token exige `PORTAL_PACIENTE_SECRET`, que sólo vive en el servidor,
 * y el módulo natural para hacerlo —`lib/whatsapp.ts`— se importa **también
 * desde el navegador**. Nadie quiso meter el secreto en el paquete del cliente,
 * así que el token no se acuñó en ninguna parte. El arreglo es un módulo de
 * servidor (`lib/telesalud/token-de-sala.ts`) que los tres llamadores usan.
 *
 * Familia: **«el dato tiene que LLEGAR»**. El mensaje se componía, se enviaba y
 * se leía. Lo que no llegaba era aquello de lo que hablaba el mensaje.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. El criterio de «esto es una videoconsulta» vive en UN sitio
 *    (`esTeleconsulta`), y lo usan tanto quien redacta como quien acuña. Escrito
 *    dos veces, el día que cambie el nombre del tipo uno de los dos se queda
 *    atrás y el enlace desaparece en silencio — que es exactamente este defecto.
 * 2. Alcance `agenda`, nunca `clinico`: el mensaje de WhatsApp no puede acabar
 *    siendo una credencial que lea documentos clínicos.
 * 3. El token nace con la VERSIÓN vigente del paciente, así que una revocación
 *    lo tumba junto con los demás enlaces.
 * 4. A una cita a más de `MAX_DIAS_DE_ANTELACION` días **no se le manda enlace**:
 *    un token de tres meses viajando en un WhatsApp reenviable es peor que un
 *    paso extra.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No manda un WhatsApp de verdad.** Comprueba que el token se acuña, que
 *   verifica, que lleva alcance y versión, y que los tres llamadores lo pasan.
 *   Que Meta entregue el mensaje es otra frontera.
 * - **No prueba `/api/telesalud/sala` de punta a punta.** Que ese token concreto
 *   abra la sala depende de que `tk.patientId === cita.pacienteId`; aquí se
 *   comprueba que el token lleva el `patientId` que se le pidió, no la ruta.
 * - **No comprueba la ventana horaria** (`ventanaDeSala`): un token vigente no
 *   es una sala abierta.
 * - **La comprobación de los tres llamadores se hace leyendo el código fuente.**
 *   Es el «otro lado» de la frontera y no hay forma de renderizarlo sin montar
 *   Firestore entero. Si alguien reordena esas llamadas, esta prueba avisa.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Dobles ────────────────────────────────────────────────────────────────
const getPaciente = vi.fn()
vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: () => ({ doc: () => ({ get: getPaciente }) }),
      }),
    }),
  },
}))

import {
  tokenDeSalaParaPaciente,
  diasDeVigenciaDelEnlace,
  MAX_DIAS_DE_ANTELACION,
} from '@/lib/telesalud/token-de-sala'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { dondeEsLaCita, esTeleconsulta, SIN_ENLACE, ES_TELECONSULTA } from '@/lib/telesalud/donde-es'

const HOY = '2026-08-09'

beforeEach(() => {
  getPaciente.mockReset()
  getPaciente.mockResolvedValue({ data: () => ({ portalTokenVersion: 0 }) })
})

describe('cuántos días vive el enlace que viaja en un mensaje', () => {
  it('una cita de hoy o de mañana lleva enlace', () => {
    expect(diasDeVigenciaDelEnlace(`${HOY} 18:00`, HOY)).toBeGreaterThan(0)
    expect(diasDeVigenciaDelEnlace('2026-08-10 09:00', HOY)).toBeGreaterThan(0)
  })

  it('el token sobrevive a la cita MÁS TARDÍA posible, y a las 2 h de sala', () => {
    /**
     * Ésta es la que obliga al `+2`. Cita a las 23:59 del día +N, token acuñado
     * a las 00:01 de hoy, y la sala aceptando hasta 2 h después. Con `+1` el
     * token caducaba **antes** de que cerrara la sala: el paciente pulsaba su
     * enlace dentro de la ventana y recibía el 404 que REG-268 cerró.
     */
    for (let d = 0; d <= MAX_DIAS_DE_ANTELACION; d++) {
      const dias = diasDeVigenciaDelEnlace(sumarDias(HOY, d), HOY)
      expect(dias).not.toBeNull()
      const acunadoMs = Date.parse(`${HOY}T00:01:00Z`)
      const caducaMs = acunadoMs + (dias as number) * 86_400_000
      const cierraLaSalaMs = Date.parse(`${sumarDias(HOY, d)}T23:59:00Z`) + 2 * 3_600_000
      expect(caducaMs).toBeGreaterThan(cierraLaSalaMs)
    }
  })

  it('a una cita lejana NO se le manda enlace', () => {
    expect(diasDeVigenciaDelEnlace(sumarDias(HOY, MAX_DIAS_DE_ANTELACION + 1), HOY)).toBeNull()
  })

  it('a una cita pasada tampoco, ni a una fecha que no es fecha', () => {
    expect(diasDeVigenciaDelEnlace('2026-08-08 10:00', HOY)).toBeNull()
    expect(diasDeVigenciaDelEnlace('mañana', HOY)).toBeNull()
    expect(diasDeVigenciaDelEnlace(undefined, HOY)).toBeNull()
  })
})

describe('el token que se acuña para el mensaje', () => {
  it('verifica, y va atado a ESE paciente de ESA clínica', async () => {
    const tok = await tokenDeSalaParaPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', fechaHora: '2026-08-10 09:00', hoyISO: HOY,
    })
    expect(tok).toBeTruthy()
    const v = verificarTokenPaciente(tok)
    expect(v?.clinicId).toBe('clin_1')
    expect(v?.patientId).toBe('pac_1')
  })

  it('alcance `agenda`: un WhatsApp no abre documentos clínicos', async () => {
    /** Probada al revés: acuñando con `clinico`, esta expectativa falla. */
    const tok = await tokenDeSalaParaPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', fechaHora: '2026-08-10 09:00', hoyISO: HOY,
    })
    expect(verificarTokenPaciente(tok)?.alcance).toBe('agenda')
  })

  it('nace con la versión del expediente, para que una revocación lo tumbe', async () => {
    getPaciente.mockResolvedValue({ data: () => ({ portalTokenVersion: 4 }) })
    const tok = await tokenDeSalaParaPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', fechaHora: '2026-08-10 09:00', hoyISO: HOY,
    })
    expect(verificarTokenPaciente(tok)?.version).toBe(4)
  })

  it('sin paciente no acuña nada', async () => {
    expect(await tokenDeSalaParaPaciente({
      clinicId: 'clin_1', patientId: '', fechaHora: '2026-08-10 09:00', hoyISO: HOY,
    })).toBeUndefined()
  })

  it('si falla la lectura del expediente, el mensaje sale igual', async () => {
    /**
     * Un recordatorio NO se cae porque no se pudiera leer una versión. Se emite
     * con la 0, que es lo que tenían todos los enlaces anteriores a la
     * revocación, y una revocación posterior lo corta igual.
     */
    getPaciente.mockRejectedValue(new Error('firestore caído'))
    const tok = await tokenDeSalaParaPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', fechaHora: '2026-08-10 09:00', hoyISO: HOY,
    })
    expect(verificarTokenPaciente(tok)?.version).toBe(0)
  })

  it('y el enlace resultante ES un enlace, no la promesa de uno', async () => {
    const tok = await tokenDeSalaParaPaciente({
      clinicId: 'clin_1', patientId: 'pac_1', fechaHora: '2026-08-10 09:00', hoyISO: HOY,
    })
    const texto = dondeEsLaCita({
      tipo: ES_TELECONSULTA, citaId: 'cita_1', clinicId: 'clin_1',
      baseUrl: 'https://app.example', tokenPaciente: tok,
    }).lineas.join('\n')
    expect(texto).toContain('/teleconsulta/cita_1')
    expect(texto).toContain('t=')
    expect(texto).not.toContain(SIN_ENLACE)
  })
})

describe('el criterio de «es videoconsulta» está escrito UNA vez', () => {
  it('lo dice `esTeleconsulta`, con espacios y mayúsculas', () => {
    expect(esTeleconsulta('  Teleconsulta ')).toBe(true)
    expect(esTeleconsulta('consulta')).toBe(false)
    expect(esTeleconsulta(undefined)).toBe(false)
  })

  it('y `dondeEsLaCita` decide lo mismo que él', () => {
    expect(dondeEsLaCita({ tipo: ' TELECONSULTA ' }).esVideo).toBe(esTeleconsulta(' TELECONSULTA '))
  })
})

describe('LOS TRES LLAMADORES lo pasan — el dato tiene que LLEGAR', () => {
  const fuente = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8')

  it('el cron de recordatorios acuña el token antes de redactar', () => {
    /**
     * Ésta es la que muerde. Antes del arreglo este archivo llamaba a
     * `dondeEsLaCita` sin `tokenPaciente` y el paciente recibía la promesa de un
     * enlace que este mismo cron era el único que podía mandarle.
     */
    const src = fuente('app', 'api', 'cron', 'reminders', 'route.ts')
    expect(src).toContain('tokenDeSalaParaPaciente')
    expect(src).toMatch(/tokenPaciente,?\s*\n?\s*\}\)/)
  })

  it('el bot pasa el token en el alta de la cita y en la lista de espera', () => {
    const src = fuente('app', 'api', 'whatsapp', 'webhook', 'route.ts')
    // Dos llamadas a `dondeEsLaCita`, dos acuñaciones. Contar importa: con una
    // sola, uno de los dos mensajes se queda sin enlace y nadie se entera.
    expect((src.match(/dondeEsLaCita\(\{/g) ?? []).length).toBe(2)
    expect((src.match(/tokenDeSalaParaPaciente\(\{/g) ?? []).length).toBe(2)
  })

  it('y NADIE lo acuña en el módulo que también corre en el navegador', () => {
    /**
     * `lib/whatsapp.ts` se importa desde componentes cliente. Acuñar ahí metería
     * `PORTAL_PACIENTE_SECRET` en el paquete del navegador — que es la razón por
     * la que este defecto duró tanto sin arreglarse.
     */
    expect(fuente('lib', 'whatsapp.ts')).not.toContain('crearTokenPaciente')
  })
})

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
