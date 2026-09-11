/**
 * LA LISTA DE ESPERA AVISA A TODOS LOS COMPATIBLES — D-053.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `ofrecerHuecoLiberado` cortaba en `LIMITE_NOTIFICAR = 3`: al liberarse un
 * hueco sólo se enteraban los tres primeros de la fila. Si ninguno contestaba,
 * el hueco se quedaba vacío con gente más abajo esperando ese mismo horario. El
 * que no recibe un mensaje no se queja de no haberlo recibido, así que nadie lo
 * vio como fallo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del 10-sep-2026 contra las decisiones del dueño del 9-sep: «Espera:
 * avisar a todos los compatibles; el primero que confirme obtiene la reserva
 * atómica». La segunda mitad ya existía (la transacción del webhook y su
 * `CONFLICTO`); la primera estaba recortada a tres.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Se avisa a TODOS los que pasan el emparejamiento (tipo, fecha deseada, rango
 * horario). Sigue acotando `TOPE_LISTA` —cuántas entradas se LEEN— y el tope
 * diario por contacto de `enviarProactivo`, que son de otras decisiones.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con el `break` en su sitio, el caso de cinco compatibles cuenta 3 y no 5.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Que el primero que diga SÍ gane: `la-lista-de-espera-no-se-duplica-ni-miente`
 *   y `reservar-dos-veces-no-son-dos-citas` prueban la transacción.
 * - El coste de mensajería de avisar a muchos: es la decisión del dueño.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const CLINICA = 'clinica-sintetica-espera'
const TEL_CONSULTORIO = '5215599990000'
const PACIENTES = ['5215511110001', '5215511110002', '5215511110003', '5215511110004', '5215511110005']

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

function manana(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
}

function ventanaAbierta(telefono: string) {
  t.poner(`clinics/${CLINICA}/whatsapp_contacts/${telefono.replace(/\D/g, '').replace(/^521/, '52')}`, {
    telefono, lastInboundAt: new Date().toISOString(),
  })
}

function enLista(id: string, telefono: string, prioridad: number, extra: Record<string, unknown> = {}) {
  t.poner(`clinics/${CLINICA}/waitlist/${id}`, {
    pacienteNombre: `Paciente ${id}`, pacienteTelefono: telefono, tipo: 'seguimiento',
    prioridad, estado: 'activo', createdAt: '2026-08-01T10:00:00.000Z',
    fechaDeseada: '', rangoHorario: '', ...extra,
  })
}

beforeEach(() => {
  t = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(t) }
  enviados.lista = []
  t.poner(`clinics/${CLINICA}`, { status: 'active' })
  t.poner(`clinics/${CLINICA}/config/main`, {
    nombreClinica: 'Consultorio Sintético', nombreMedico: 'Dra. Sintética',
    telefonoAdmin: TEL_CONSULTORIO, whatsappConsultorio: TEL_CONSULTORIO,
    horario: { lunes: H, martes: H, miercoles: H, jueves: H, viernes: H, sabado: H, domingo: H },
    zonaHoraria: 'America/Mexico_City', duraciones: {}, botConfig: {},
  })
  t.poner(`clinics/${CLINICA}/doctors/doc-1`, { nombre: 'Dra. Sintética', activo: true })
})

async function ofrecer() {
  const { ofrecerHuecoLiberado } = await import('@/lib/whatsapp/ofrecer-hueco')
  return ofrecerHuecoLiberado(CLINICA, { fecha: manana(), hora: '11:00', medicoId: 'doc-1', duracion: 30, tipo: 'seguimiento' })
}
const avisados = () => enviados.lista.filter(m => m.texto.includes('Espacio disponible')).map(m => m.to)

describe('D-053 · se avisa a todos los compatibles', () => {
  it('EL CASO: cinco compatibles → cinco avisos (antes: tres), en orden de prioridad', async () => {
    PACIENTES.forEach((tel, i) => { ventanaAbierta(tel); enLista(`w-${i + 1}`, tel, 5 - i) })
    const r = await ofrecer()
    expect(r.ok).toBe(true)
    expect(r.notified).toBe(5)
    expect(avisados()).toEqual([...PACIENTES].reverse())
    // Y cada uno queda con su sesión esperando el mismo hueco.
    expect(t.cuantos(`clinics/${CLINICA}/bot_sessions`)).toBe(5)
  })

  it('compatible no es «cualquiera»: el que pidió otro tipo o una fecha posterior no recibe el aviso', async () => {
    PACIENTES.slice(0, 4).forEach(ventanaAbierta)
    enLista('w-1', PACIENTES[0], 1)
    enLista('w-2', PACIENTES[1], 1, { tipo: 'primera-vez' })
    enLista('w-3', PACIENTES[2], 1, { fechaDeseada: '2099-01-01' })
    enLista('w-4', PACIENTES[3], 1)
    const r = await ofrecer()
    expect(r.notified).toBe(2)
    expect(avisados().sort()).toEqual([PACIENTES[0], PACIENTES[3]].sort())
  })

  it('el tope de tres ya no existe en la fuente', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/whatsapp/ofrecer-hueco.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
    expect(src).not.toMatch(/LIMITE_NOTIFICAR/)
    expect(src).not.toMatch(/notified\s*>=\s*\d/)
  })
})
