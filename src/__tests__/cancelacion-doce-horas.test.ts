/**
 * REG-656 — el portal usaba 24 h y WhatsApp 0 h por defecto. Además,
 * confirmar una cancelación no revalidaba el plazo: una sesión vieja o un NO
 * al recordatorio lo eludían. Detectado al contrastar la política del dueño
 * (12 h) con ambas rutas. Ejecuta handleMessage real con datos sintéticos.
 * No prueba entrega de Meta ni reglas/índices de Firestore.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const CLINICA = 'clinica-sintetica-alfa'
const VECINA = 'clinica-sintetica-beta'
const PACIENTE = '5215512345678'
const TEL_CONSULTORIO = '5215599990000'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))
const enviados = vi.hoisted(() => ({ lista: [] as Array<{ clinicId: string; to: string; texto: string }> }))

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))
vi.mock('@/lib/whatsapp-send', () => ({
  sendWhatsApp: async (clinicId: string, to: string, texto: string) => {
    enviados.lista.push({ clinicId, to, texto })
    return { ok: true }
  },
  sendWhatsAppTemplate: async () => ({ ok: true }),
}))
vi.mock('@/lib/calendario/ocupado-servidor', () => ({
  ocupadoEnGoogle: async () => ({ bloqueos: [], consultado: false, fallo: false }),
}))

const H = { activo: true, inicio: '09:00', fin: '18:00' }

let t: TiendaEnMemoria

function sembrar(clinicId: string) {
  t.poner(`clinics/${clinicId}/config/main`, {
    nombreClinica: 'Consultorio Sintético',
    nombreMedico: 'Dra. Sintética',
    telefonoAdmin: TEL_CONSULTORIO,
    whatsappConsultorio: TEL_CONSULTORIO,
    direccion: 'Calle Sintética 1',
    horario: { lunes: H, martes: H, miercoles: H, jueves: H, viernes: H, sabado: H, domingo: H },
    zonaHoraria: 'America/Mexico_City',
    duraciones: {}, botConfig: {},
  })
  t.poner(`clinics/${clinicId}/doctors/doc-1`, { nombre: 'Dra. Sintética', activo: true })
}

beforeEach(() => {
  t = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(t) }
  enviados.lista = []
  sembrar(CLINICA)
  sembrar(VECINA)
})

async function escribe(texto: string, clinicId = CLINICA, de = PACIENTE) {
  const { handleMessage } = await import('@/app/api/whatsapp/webhook/route')
  await handleMessage(de, texto, clinicId)
}


afterEach(() => vi.useRealTimers())

function preparar(horas: number, estado = 'confirmando_cancelacion') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-10T12:00:00-06:00'))
  const fecha = horas < 12 ? '2026-09-10 23:59' : '2026-09-11 00:00'
  t.poner(`clinics/${CLINICA}/appointments/cita`, {
    estado: 'confirmada', fechaHora: fecha, pacienteTelefono: PACIENTE,
  })
  t.poner(`clinics/${CLINICA}/bot_sessions/525512345678`, {
    telefono: PACIENTE, estado, datos: { citaId: 'cita' },
    lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  })
}

const estadoCita = () => t.obtener(`clinics/${CLINICA}/appointments/cita`)?.estado
const mensajes = () => enviados.lista.filter(m => m.to === PACIENTE).map(m => m.texto).join(' ')

describe('el plazo se comprueba cuando se confirma la acción', () => {
  it('no cancela con 11 h 59 min aunque la sesión ya ofrezca cancelar', async () => {
    preparar(11)
    await escribe('si')
    expect(estadoCita()).toBe('confirmada')
    expect(mensajes()).toContain('12')
  })
  it('NO al recordatorio tampoco elude el plazo', async () => {
    preparar(11, 'confirmando_cita')
    await escribe('no')
    expect(estadoCita()).toBe('confirmada')
    expect(mensajes()).toContain('12')
  })
  it('exactamente 12 horas permite cancelar', async () => {
    preparar(12)
    await escribe('si')
    expect(estadoCita()).toBe('cancelada')
  })
  it('confirmar asistencia sigue permitido dentro del plazo', async () => {
    preparar(11, 'confirmando_cita')
    await escribe('si')
    expect(estadoCita()).toBe('confirmada')
    expect(mensajes()).toContain('confirmada')
  })
  it('rechazar la cancelación conserva la cita', async () => {
    preparar(11)
    await escribe('no')
    expect(estadoCita()).toBe('confirmada')
    expect(mensajes()).toContain('sigue en pie')
  })
})
