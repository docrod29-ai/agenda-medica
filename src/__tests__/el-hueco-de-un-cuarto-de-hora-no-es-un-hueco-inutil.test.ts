/**
 * GOLDEN — UN HUECO DE UN CUARTO DE HORA NO ES UN HUECO INÚTIL.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `ofrecerHuecoLiberado` comprueba el «rango horario preferido» del paciente
 * contra el hueco COMPLETO —`[hora, hora + duracion)`—, porque una cita de 45
 * min que arranca a las 11:45 termina a las 12:30 y a quien pidió «9-12» le
 * rompe la mañana igual.
 *
 * Tres puertas disparan esa oferta. El bot de WhatsApp y el portal del paciente
 * mandan la duración del hueco; `POST /api/whatsapp/waitlist-notify` —la puerta
 * del CONSULTORIO, por la que pasa la cancelación que hace la asistente— ni la
 * aceptaba ni la mandaba. La función caía a su valor por defecto: 30 minutos.
 *
 * Las dos formas de equivocarse, las dos silenciosas:
 *
 *  · Se libera un retiro de 15 min a las 11:45. El hueco real es 11:45-12:00 y
 *    cabe entero en «9-12», pero se evaluaba como 11:45-12:15 y al paciente se
 *    le SALTABA. Justo el caso del acta: un cuarto de hora libre es exactamente
 *    lo que espera quien viene a que le quiten unos puntos.
 *  · Al revés, una consulta larga de 90 min se evaluaba como 30 y se le ofrecía
 *    a quien no podía quedarse tanto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Siguiendo el dato desde el modal de citas hasta `huecoSirve`, en vez de
 * comprobar que la ruta «dice» lo acordado: la regla «el dato tiene que LLEGAR».
 * El campo existía en la función, existía en dos de los tres llamadores, y en el
 * tercero no había forma de que llegara.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El hueco que se ofrece es el que de verdad se liberó: su hora Y su duración.
 * Sin el dato se conserva el comportamiento anterior (30 min), porque una
 * petición vieja no puede quedarse sin ofrecer el hueco a nadie.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba el envío por WhatsApp (`enviarProactivo` se anula aquí): esta
 *   suite habla de a QUIÉN se le ofrece, no de si el mensaje sale.
 * · No prueba el orden de prioridad de la lista — eso es `lista-espera`.
 * · No prueba que la cita resultante quepa: eso lo vuelve a validar la vía de
 *   alta, y vive en `las-tres-puertas-de-la-agenda-dicen-lo-mismo`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { huecoSirve } from '@/lib/whatsapp/rango-horario'

const ofrecidos = vi.hoisted(() => ({ llamadas: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/whatsapp/ofrecer-hueco', () => ({
  ofrecerHuecoLiberado: async (_clinicId: string, slot: Record<string, unknown>) => {
    ofrecidos.llamadas.push(slot)
    return { ok: true, notified: 1, omitidos: 0 }
  },
}))
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async () => ({ ok: true, uid: 'u-1', email: 'medico@sintetico.test', role: 'medico' }),
}))

async function avisar(cuerpo: Record<string, unknown>) {
  const { POST } = await import('@/app/api/whatsapp/waitlist-notify/route')
  return POST(new Request('http://localhost/api/whatsapp/waitlist-notify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  }) as never)
}

beforeEach(() => { ofrecidos.llamadas = [] })

describe('El rango del paciente se mide contra el hueco de verdad', () => {
  it('AL REVÉS — con 30 min supuestos, el retiro de 11:45 se le saltaba a quien pidió «9-12»', () => {
    // Ésta es la aritmética que producía el defecto, sellada para que se vea.
    expect(huecoSirve('9-12', '11:45', 30)).toBe(false)
    // Y ésta es la realidad: un retiro de 15 min cabe entero antes de las 12.
    expect(huecoSirve('9-12', '11:45', 15)).toBe(true)
  })

  it('una consulta larga NO cabe donde cabía la corta', () => {
    expect(huecoSirve('9-12', '11:00', 90)).toBe(false)
    expect(huecoSirve('9-12', '11:00', 45)).toBe(true)
  })
})

describe('La puerta del consultorio deja pasar la duración', () => {
  it('reenvía la duración del hueco liberado', async () => {
    const res = await avisar({
      clinicId: 'clinica-alfa', fecha: '2026-09-15', hora: '11:45',
      tipo: 'retiro', duracion: 15, medicoId: 'doc-1',
    })
    expect(res.status).toBe(200)
    expect(ofrecidos.llamadas).toHaveLength(1)
    expect(ofrecidos.llamadas[0]).toMatchObject({ hora: '11:45', duracion: 15, medicoId: 'doc-1' })
  })

  it('sin duración NO inventa una: la deja indefinida y manda la función a su valor por defecto', async () => {
    await avisar({ clinicId: 'clinica-alfa', fecha: '2026-09-15', hora: '11:45', tipo: 'retiro' })
    expect(ofrecidos.llamadas[0].duracion).toBeUndefined()
  })

  it('una duración corrupta tampoco se cuela como número', async () => {
    // 0, negativa o texto: ninguna es una duración. Se tratan como «no la sé»,
    // que es honesto, en vez de convertirse en un hueco de cero minutos que le
    // sirve a todo el mundo.
    for (const mala of [0, -30, 'treinta', null]) {
      ofrecidos.llamadas = []
      await avisar({ clinicId: 'clinica-alfa', fecha: '2026-09-15', hora: '11:45', duracion: mala })
      expect(ofrecidos.llamadas[0].duracion).toBeUndefined()
    }
  })
})
