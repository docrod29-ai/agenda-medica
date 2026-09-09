/**
 * GOLDEN — LAS TRES PUERTAS DE LA AGENDA DICEN LO MISMO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Tres puertas escriben sobre la misma agenda: el panel del consultorio
 * (`POST /api/appointments`), el portal público (`POST /api/public/booking`) y
 * el bot de WhatsApp, que usa el mismo motor que el panel. Y dos LEEN
 * disponibilidad: `lib/availability.getAvailableSlots` y
 * `GET /api/public/availability/[clinicId]`, que tenía su propia copia del
 * bucle de la rejilla.
 *
 * Dos defectos concretos, medidos:
 *
 *  1. **El horario partido sólo lo respetaba una de las tres puertas.** Con un
 *     médico de 10-13 y 15-19 —declarado con un descanso de 13:00 a 15:00— una
 *     cita de 12:45 a 13:15 cruza la comida entera. El portal público la
 *     rechazaba; el panel la ACEPTABA. No hacía falta mala fe: el modal
 *     sustituye el desplegable de horas por un campo libre justo cuando no
 *     quedan huecos.
 *
 *  2. **La copia del bucle en el portal se quedó atrás.** Al aprender el motor
 *     que un hueco nace cuando termina la consulta anterior, la copia del
 *     portal seguía en la rejilla fija: el paciente veía menos horas de las que
 *     el consultorio tenía libres, y «no hay lugar» se lee igual que «lleno».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditando el caso E del dueño («horario 10-13 y 15-19; 12:45-13:15 debe
 * rechazarse») contra cada puerta por separado, en vez de contra el motor.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * UNA sola autoridad de disponibilidad. Lo que una puerta no OFRECE, ninguna
 * puerta lo ACEPTA — y al revés: lo que el motor da por libre, el portal lo
 * enseña. Es la lección que este repositorio ya tiene escrita dos veces para
 * los bloqueos, aplicada por fin a los descansos y a la rejilla.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Las reglas de Firestore (van contra el emulador).
 * · El Google Calendar del médico: se anula aquí a propósito, tiene su propia
 *   suite (`un-google-que-no-contesta-no-cuelga-la-agenda-publica`).
 * · WhatsApp: se anula. Esta suite habla de intervalos, no de mensajería.
 * · No prueba la concurrencia — eso es `gp9-alta-de-cita-no-duplica` y
 *   `reservar-dos-veces-no-son-dos-citas`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'
import { getAvailableSlots } from '@/lib/availability'
import type { ClinicConfig, Appointment } from '@/types'

const CLINICA = 'clinica-alfa'
// 2026-09-15 es MARTES.
const MARTES = '2026-09-15'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async (_req: unknown, clinicId: string) => ({
    ok: true, uid: `u-${clinicId}-medico`, email: 'medico@sintetico.test', role: 'medico',
  }),
}))
// El calendario externo y la mensajería no son el sujeto de esta suite.
vi.mock('@/lib/calendario/ocupado-servidor', () => ({
  ocupadoEnGoogle: async () => ({ bloqueos: [], consultado: false, fallo: false }),
}))
vi.mock('@/lib/whatsapp-send', () => ({ sendWhatsApp: async () => ({ ok: true }) }))
vi.mock('@/lib/whatsapp/avisar-consultorio', () => ({
  avisarAlConsultorio: async () => undefined,
  telefonoDelConsultorio: () => '',
}))
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: async () => null, limitarEstricto: async () => null }))

let store: TiendaEnMemoria

/** Horario PARTIDO del caso E: 10-13 y 15-19, expresado con su descanso. */
const DIA_PARTIDO = {
  activo: true,
  inicio: '10:00',
  fin: '19:00',
  descansos: [{ inicio: '13:00', fin: '15:00' }],
}
const DIA_CERRADO = { activo: false, inicio: '10:00', fin: '19:00' }

const CONFIG = {
  nombreClinica: 'Consultorio Sintetico',
  zonaHoraria: 'America/Mexico_City',
  intervaloMinutos: 15,
  diasFestivos: [],
  publicBookingEnabled: true,
  duraciones: { 'primera-vez': 45, seguimiento: 30, retiro: 15 },
  horario: {
    lunes: DIA_PARTIDO, martes: DIA_PARTIDO, miercoles: DIA_PARTIDO,
    jueves: DIA_PARTIDO, viernes: DIA_PARTIDO,
    sabado: DIA_CERRADO, domingo: DIA_CERRADO,
  },
}

const configComoClinicConfig = () => CONFIG as unknown as ClinicConfig

async function altaPanel(cuerpo: Record<string, unknown>) {
  const { POST } = await import('@/app/api/appointments/route')
  return POST(new Request('http://localhost/api/appointments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  }) as never)
}

async function huecosDelPortal(fecha: string, tipo: string) {
  const { GET } = await import('@/app/api/public/availability/[clinicId]/route')
  const req = new Request(`http://localhost/api/public/availability/${CLINICA}?fecha=${fecha}&tipo=${tipo}`)
  const res = await GET(req as never, { params: Promise.resolve({ clinicId: CLINICA }) } as never)
  return res.json() as Promise<{ ok: boolean; slots?: string[] }>
}

async function reservaPortal(fecha: string, hora: string, tipo: string, telefono = '5550001111') {
  const { POST } = await import('@/app/api/public/booking/route')
  return POST(new Request('http://localhost/api/public/booking', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clinicId: CLINICA, tipo, fecha, hora,
      paciente: { nombre: 'Paciente Sintetico', telefono },
      consentimientos: { avisoPrivacidad: true, informado: true },
    }),
  }) as never)
}

const citaDelPanel = (hora: string, duracion: number, over: Record<string, unknown> = {}) => ({
  pacienteId: 'pac-1',
  pacienteNombre: 'Paciente Sintetico',
  pacienteTelefono: '5550000000',
  fechaHora: `${MARTES} ${hora}`,
  duracion,
  tipo: 'seguimiento',
  estado: 'confirmada',
  origen: 'consultorio',
  medicoNombre: 'Dr. Sintetico',
  ...over,
})

const citasVivas = (): Appointment[] =>
  store.listar(`clinics/${CLINICA}/appointments`)
    .map(d => ({ id: d.id, ...(d.datos as object) })) as unknown as Appointment[]

beforeEach(() => {
  vi.useFakeTimers()
  // Antes del martes que se agenda: nada de esto cae en el pasado.
  vi.setSystemTime(new Date('2026-09-10T15:00:00Z'))
  store = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(store) }
  store.poner(`clinics/${CLINICA}`, { status: 'active' })
  store.poner(`clinics/${CLINICA}/config/main`, CONFIG)
})

describe('CASO E — el descanso del mediodía lo respetan las TRES puertas', () => {
  it('el motor no ofrece las 12:45 para un seguimiento de 30 min', () => {
    expect(getAvailableSlots(MARTES, 30, [], configComoClinicConfig())).not.toContain('12:45')
  })

  it('el PANEL la rechaza — es lo que faltaba', async () => {
    const res = await altaPanel({ clinicId: CLINICA, appointment: citaDelPanel('12:45', 30) })
    expect(res.status).toBe(409)
    expect(store.cuantos(`clinics/${CLINICA}/appointments`)).toBe(0)
  })

  it('el PORTAL PÚBLICO la rechaza', async () => {
    const res = await reservaPortal(MARTES, '12:45', 'seguimiento')
    expect(res.status).toBe(409)
    expect(store.cuantos(`clinics/${CLINICA}/appointments`)).toBe(0)
  })

  it('y las 12:30, que termina justo al empezar el descanso, se acepta', async () => {
    const res = await altaPanel({ clinicId: CLINICA, appointment: citaDelPanel('12:30', 30) })
    expect(res.status).toBe(200)
    expect(store.cuantos(`clinics/${CLINICA}/appointments`)).toBe(1)
  })
})

describe('CASO D — la jornada termina cuando termina', () => {
  it('18:15-19:00 se acepta y 18:30-19:15 no', async () => {
    const cabe = await altaPanel({
      clinicId: CLINICA,
      appointment: citaDelPanel('18:15', 45, { tipo: 'primera-vez' }),
    })
    expect(cabe.status).toBe(200)

    const noCabe = await altaPanel({
      clinicId: CLINICA,
      appointment: citaDelPanel('18:30', 45, { pacienteId: 'pac-2', tipo: 'primera-vez' }),
    })
    expect(noCabe.status).toBe(409)
    expect(await noCabe.json()).toMatchObject({ error: expect.stringContaining('horario') })
  })

  it('el PORTAL ofrece las 18:15 para una primera consulta de 45 min', async () => {
    // La rejilla de 15 desde las 15:00 llega a 18:15 sola; lo que este caso
    // sella es que el cierre a las 19:00 no recorta el último arranque válido.
    const { slots } = await huecosDelPortal(MARTES, 'primera-vez')
    expect(slots).toContain('18:15')
    expect(slots).not.toContain('18:30')
  })
})

describe('CASOS H e I — lo que una puerta escribe, la otra lo ve enseguida', () => {
  it('CASO I — una cita del panel desaparece de la disponibilidad del PACIENTE', async () => {
    const antes = await huecosDelPortal(MARTES, 'seguimiento')
    expect(antes.slots).toContain('16:00')

    await altaPanel({ clinicId: CLINICA, appointment: citaDelPanel('16:00', 30) })

    const despues = await huecosDelPortal(MARTES, 'seguimiento')
    expect(despues.slots).not.toContain('16:00')
    // Y tampoco las que se solapan con ella.
    expect(despues.slots).not.toContain('15:45')
    // La que empieza justo cuando termina, SÍ.
    expect(despues.slots).toContain('16:30')
  })

  it('CASO H — una cita del portal aparece en la agenda del consultorio', async () => {
    const res = await reservaPortal(MARTES, '16:00', 'seguimiento')
    expect(res.status).toBe(200)
    // Misma colección, mismo modelo: la agenda del panel la lee sin traducción.
    const enLaAgenda = citasVivas()
    expect(enLaAgenda).toHaveLength(1)
    expect(enLaAgenda[0].fechaHora).toBe(`${MARTES} 16:00`)
    // Y el motor del panel ya la descuenta.
    expect(getAvailableSlots(MARTES, 30, enLaAgenda, configComoClinicConfig())).not.toContain('16:00')
  })

  it('CASO J — cancelar devuelve EXACTAMENTE su intervalo a la disponibilidad', async () => {
    const { id } = await (await altaPanel({ clinicId: CLINICA, appointment: citaDelPanel('16:00', 30) })).json()
    const cerrado = await huecosDelPortal(MARTES, 'seguimiento')
    expect(cerrado.slots).not.toContain('16:00')
    // Las 15:30 terminan EXACTAMENTE cuando empieza la cita: adyacencia no es
    // solape, así que siguen ofreciéndose con la cita puesta.
    expect(cerrado.slots).toContain('15:30')

    store.poner(`clinics/${CLINICA}/appointments/${id}`, { estado: 'cancelada' })

    const abierto = await huecosDelPortal(MARTES, 'seguimiento')
    expect(abierto.slots).toContain('16:00')
    // Y las 16:30, que la cita tapaba por solape, vuelven con ella.
    expect(abierto.slots).toContain('16:30')
    // Y el motor del panel dice lo mismo: una cancelada no ocupa.
    expect(getAvailableSlots(MARTES, 30, citasVivas(), configComoClinicConfig())).toContain('16:00')
  })
})

describe('El portal ve el hueco que nace al terminar una consulta', () => {
  it('tras una primera consulta de 15:00 a 15:45, el portal ofrece las 15:45 para un retiro de 15 min', async () => {
    await altaPanel({ clinicId: CLINICA, appointment: citaDelPanel('15:00', 45, { tipo: 'primera-vez' }) })
    const { slots } = await huecosDelPortal(MARTES, 'retiro')
    // La rejilla de 15 acierta con las 15:45 por casualidad; lo que se sella es
    // que el motor y la copia del portal coinciden hueco por hueco.
    expect(slots).toContain('15:45')
    expect(slots).toEqual(getAvailableSlots(MARTES, 15, citasVivas(), configComoClinicConfig()))
  })

  it('con una rejilla de 30 el hueco de 15:45 sigue existiendo — la arista no es la rejilla', async () => {
    store.poner(`clinics/${CLINICA}/config/main`, { ...CONFIG, intervaloMinutos: 30 })
    await altaPanel({ clinicId: CLINICA, appointment: citaDelPanel('15:00', 45, { tipo: 'primera-vez' }) })
    const { slots } = await huecosDelPortal(MARTES, 'retiro')
    // Con la rejilla vieja (múltiplos de 30 desde las 15:00) las 15:45 no
    // existían: el paciente veía 16:00 y el cuarto de hora se perdía.
    expect(slots).toContain('15:45')
  })
})
