/**
 * REINTENTAR «SÍ» — la cita existe y al paciente se le dice que no.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El bot confirma la cita y, si el mismo «SÍ» vuelve a llegar, **revalida el
 * hueco antes de escribir**. Esa revalidación ve la cita que ACABA DE CREAR el
 * propio paciente, la cuenta como ocupación y contesta:
 *
 *     «Ese horario ya no está disponible. Por favor elija otro
 *      escribiendo *agendar* de nuevo. 🙏»
 *
 * Y si el reintento llega a la transacción, el detector de solapes hace lo mismo
 * con otras palabras: «Lo sentimos, ese horario acaba de ocuparse».
 *
 * O sea: el paciente TIENE cita, y el bot le dice que no la tiene y le pide que
 * agende otra. Es la peor forma de este defecto, porque el paciente obedece: se
 * agenda a otra hora y el consultorio se queda con **dos** citas suyas, una de
 * las cuales nadie va a ocupar. El duplicado no lo fabrica el reintento: lo
 * fabrica el mensaje equivocado.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Recorriendo las fronteras de escritura del Bloque 7 con la pregunta de GP9:
 * «¿qué pasa si esto llega dos veces?». `POST /api/appointments` ya lo había
 * aprendido (REG de GP9: misma solicitud activa → mismo id). El bot es la otra
 * vía que crea citas, y esa lección nunca llegó hasta aquí.
 *
 * ── POR QUÉ SE REPITE UN «SÍ» ────────────────────────────────────────────────
 *
 * · Meta reentrega el webhook cuando la respuesta tarda, y el dedup es
 *   FAIL-OPEN a propósito (mejor procesar dos veces que perder un mensaje).
 * · `clearSession` termina en `.catch(() => {})`: si el borrado no cuaja, la
 *   sesión sigue en `agendar_confirm`.
 * · La confirmación se manda con `send`, que devuelve `false` sin lanzar cuando
 *   el proveedor está caído: el paciente no ve nada y vuelve a escribir «sí».
 *
 * Ninguno es un error del usuario. Son la red y la impaciencia, que existen
 * siempre.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No cubre las reglas de Firestore (van contra el emulador).
 * · No cubre la vía de lista de espera, que tiene su propia transacción: queda
 *   como trabajo con nombre, no dado por bueno.
 * · No cubre el dedup por `wamid` (tiene su propia suite): aquí se prueba el
 *   caso en que el dedup NO salvó, que es para el que existe la idempotencia.
 * · La tienda en memoria no es Firestore: sin reglas, sin índices, y sus
 *   consultas sólo entienden lo que esta ruta usa.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

const citas = (clinicId = CLINICA) => t.listar(`clinics/${clinicId}/appointments`)
const sesiones = (clinicId = CLINICA) => t.listar(`clinics/${clinicId}/bot_sessions`)
const alPaciente = () => enviados.lista.filter(m => m.to === PACIENTE).map(m => m.texto).join('\n---\n')

/** Recorre el camino real hasta dejar la sesión en `agendar_confirm`. */
async function hastaConfirmar() {
  for (const m of ['agendar', 'si', 'Paciente Sintetico Uno', '1', '1', '1']) await escribe(m)
  const s = sesiones()
  expect(s).toHaveLength(1)
  expect(s[0].datos.estado).toBe('agendar_confirm')
  return s[0]
}

describe('GP-bot · el reintento del «SÍ» converge a la MISMA cita', () => {
  it('el camino feliz sigue creando una cita y una sola', async () => {
    await hastaConfirmar()
    await escribe('si')
    expect(citas()).toHaveLength(1)
    expect(alPaciente()).toContain('¡Su cita ha sido registrada!')
  })

  it('la cita queda ligada a un expediente, no huérfana', async () => {
    await hastaConfirmar()
    await escribe('si')
    const pacientes = t.listar(`clinics/${CLINICA}/patients`)
    expect(pacientes).toHaveLength(1)
    expect(String(citas()[0].datos.pacienteId)).toBe(pacientes[0].id)
  })

  /**
   * EL DEFECTO. La sesión vuelve a `agendar_confirm` porque el borrado no cuajó
   * (`clearSession` se traga su error) o porque Meta reentregó el evento antes.
   * Al paciente le llega otra vez el mismo «SÍ».
   */
  it('un «SÍ» repetido NO le dice al paciente que su horario ya no existe', async () => {
    const antes = await hastaConfirmar()
    await escribe('si')
    const folio = citas()[0].id

    // El borrado de sesión no cuajó: sigue esperando la confirmación.
    t.poner(`clinics/${CLINICA}/bot_sessions/${antes.id}`, antes.datos)
    enviados.lista = []
    await escribe('si')

    const r = alPaciente()
    expect(r).not.toContain('ya no está disponible')
    expect(r).not.toContain('acaba de ocuparse')
    expect(r).toContain('¡Su cita ha sido registrada!')
    expect(citas()).toHaveLength(1)
    expect(citas()[0].id).toBe(folio)
  })

  it('y no fabrica un segundo expediente para el mismo teléfono', async () => {
    const antes = await hastaConfirmar()
    await escribe('si')
    t.poner(`clinics/${CLINICA}/bot_sessions/${antes.id}`, antes.datos)
    await escribe('si')
    expect(t.listar(`clinics/${CLINICA}/patients`)).toHaveLength(1)
  })

  /**
   * EL DAÑO REAL. Obedeciendo al mensaje equivocado, el paciente agenda otra
   * vez — y el consultorio se queda con DOS citas suyas el mismo día, una de
   * las cuales nadie va a ocupar. El duplicado no lo fabrica el reintento: lo
   * fabrica el mensaje.
   */
  it('el paciente no acaba con dos citas por haber hecho caso al bot', async () => {
    const antes = await hastaConfirmar()
    await escribe('si')
    t.poner(`clinics/${CLINICA}/bot_sessions/${antes.id}`, antes.datos)
    await escribe('si')
    // Si el bot le dijo que eligiera otro horario, el paciente obedece.
    if (alPaciente().includes('agendar* de nuevo')) {
      for (const m of ['agendar', 'si', 'Paciente Sintetico Uno', '1', '1', '2', 'si']) await escribe(m)
    }
    expect(citas().length, 'el paciente terminó con más de una cita').toBe(1)
  })
})

describe('GP-bot · dos entregas a la vez del mismo «SÍ»', () => {
  it('crean UNA cita y ninguna de las dos respuestas desmiente la otra', async () => {
    await hastaConfirmar()
    enviados.lista = []
    await Promise.all([escribe('si'), escribe('si')])

    expect(citas()).toHaveLength(1)
    const r = alPaciente()
    expect(r).not.toContain('acaba de ocuparse')
    expect(r).not.toContain('ya no está disponible')
    expect(r).toContain('¡Su cita ha sido registrada!')
  })
})

describe('GP-bot · lo que el reintento NO puede hacer', () => {
  it('un hueco REALMENTE ocupado por otro paciente sigue dando conflicto', async () => {
    const antes = await hastaConfirmar()
    const fecha = String(antes.datos.datos && (antes.datos.datos as Record<string, string>).fecha)
    const hora = String(antes.datos.datos && (antes.datos.datos as Record<string, string>).hora)
    // Otro paciente ocupa ese hueco antes de que éste confirme.
    t.poner(`clinics/${CLINICA}/appointments/ajena`, {
      pacienteTelefono: '5215500000000', pacienteNombre: 'Otra Persona',
      fechaHora: `${fecha} ${hora}`, duracion: 30, tipo: 'primera-vez',
      estado: 'confirmada', origen: 'WhatsApp', medicoId: 'doc-1', creadoPor: 'bot',
    })
    enviados.lista = []
    await escribe('si')
    expect(alPaciente()).toMatch(/ya no está disponible|acaba de ocuparse/)
    expect(citas()).toHaveLength(1)   // sólo la ajena
  })

  it('una cita CANCELADA no se resucita como si fuera el mismo intento', async () => {
    const antes = await hastaConfirmar()
    await escribe('si')
    const folio = citas()[0].id
    t.poner(`clinics/${CLINICA}/appointments/${folio}`, { estado: 'cancelada' })

    t.poner(`clinics/${CLINICA}/bot_sessions/${antes.id}`, antes.datos)
    enviados.lista = []
    await escribe('si')

    // El hueco quedó libre: se agenda de nuevo, con OTRA identidad.
    expect(citas()).toHaveLength(2)
    const vivas = citas().filter(c => c.datos.estado !== 'cancelada')
    expect(vivas).toHaveLength(1)
    expect(vivas[0].id).not.toBe(folio)
  })
})

describe('GP-bot · aislamiento entre consultorios', () => {
  it('la cita del reintento no aparece en el consultorio vecino', async () => {
    const antes = await hastaConfirmar()
    await escribe('si')
    t.poner(`clinics/${CLINICA}/bot_sessions/${antes.id}`, antes.datos)
    await escribe('si')
    expect(citas(VECINA)).toHaveLength(0)
    expect(t.listar(`clinics/${VECINA}/patients`)).toHaveLength(0)
  })

  it('una cita idéntica en el vecino no se confunde con este reintento', async () => {
    const antes = await hastaConfirmar()
    await escribe('si')
    const suya = citas()[0]
    // El vecino tiene una cita con los MISMOS datos. Son dos consultorios.
    t.poner(`clinics/${VECINA}/appointments/gemela`, { ...suya.datos })
    t.poner(`clinics/${CLINICA}/bot_sessions/${antes.id}`, antes.datos)
    await escribe('si')
    expect(citas()).toHaveLength(1)
    expect(citas(VECINA)).toHaveLength(1)
  })
})
