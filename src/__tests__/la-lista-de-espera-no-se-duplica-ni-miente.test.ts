/**
 * LA LISTA DE ESPERA — ocho preguntas que nadie le había hecho al camino real.
 *
 * ── POR QUÉ ESTE ARCHIVO ─────────────────────────────────────────────────────
 *
 * La lista de espera tiene módulos puros bien probados (`lista-espera.ts` decide
 * a quién y en qué orden; `rango-horario.ts` decide si el hueco le sirve). Lo que
 * no tenía prueba es el CAMINO: se libera un hueco → se ofrece a varios → uno
 * contesta «SÍ» → se le agenda → los demás se enteran. Ese camino escribe citas,
 * sesiones y entradas de lista, y hasta ahora sólo se había mirado por trozos.
 *
 * Se ejercita el `handleMessage` real y `ofrecerHuecoLiberado` real contra una
 * tienda con la semántica transaccional de Firestore, y se CUENTAN documentos.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · Las reglas de Firestore (van contra el emulador).
 * · El alta de una entrada desde el panel: la escribe el SDK de cliente
 *   (`lib/firestore.ts`), que no es este adminDb. Queda como trabajo con nombre.
 * · La plantilla HSM fuera de la ventana de 24 h: aquí la ventana está abierta.
 * · El emparejamiento por rango horario y por tipo tiene su propia suite; aquí
 *   se usa para montar el escenario, no es el sujeto.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const CLINICA = 'clinica-sintetica-alfa'
const VECINA = 'clinica-sintetica-beta'
const ANA = '5215511110000'
const BETO = '5215522220000'
const TEL_CONSULTORIO = '5215599990000'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))
const enviados = vi.hoisted(() => ({ lista: [] as Array<{ clinicId: string; to: string; texto: string }> }))
const proveedor = vi.hoisted(() => ({ caido: false }))

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))
vi.mock('@/lib/whatsapp-send', () => ({
  sendWhatsApp: async (clinicId: string, to: string, texto: string) => {
    if (proveedor.caido) return { ok: false, error: 'proveedor caido' }
    enviados.lista.push({ clinicId, to, texto })
    return { ok: true }
  },
  sendWhatsAppTemplate: async () => (proveedor.caido ? { ok: false } : { ok: true }),
}))
vi.mock('@/lib/calendario/ocupado-servidor', () => ({
  ocupadoEnGoogle: async () => ({ bloqueos: [], consultado: false, fallo: false }),
}))

const H = { activo: true, inicio: '09:00', fin: '18:00' }

let t: TiendaEnMemoria

/** Mañana en la zona del consultorio: un hueco que no ha pasado ya. */
function manana(): string {
  const d = new Date(Date.now() + 86_400_000)
  return d.toISOString().slice(0, 10)
}
const SLOT = { hora: '11:00', duracion: 30 }

function sembrarConsultorio(clinicId: string) {
  t.poner(`clinics/${clinicId}`, { status: 'active' })
  t.poner(`clinics/${clinicId}/config/main`, {
    nombreClinica: 'Consultorio Sintético', nombreMedico: 'Dra. Sintética',
    telefonoAdmin: TEL_CONSULTORIO, whatsappConsultorio: TEL_CONSULTORIO,
    direccion: 'Calle Sintética 1',
    horario: { lunes: H, martes: H, miercoles: H, jueves: H, viernes: H, sabado: H, domingo: H },
    zonaHoraria: 'America/Mexico_City', duraciones: {}, botConfig: {},
  })
  t.poner(`clinics/${clinicId}/doctors/doc-1`, { nombre: 'Dra. Sintética', activo: true })
}

function enLista(clinicId: string, id: string, telefono: string, nombre: string, prioridad: number) {
  t.poner(`clinics/${clinicId}/waitlist/${id}`, {
    pacienteNombre: nombre, pacienteTelefono: telefono, tipo: 'seguimiento',
    prioridad, estado: 'activo', createdAt: '2026-08-01T10:00:00.000Z',
    fechaDeseada: '', rangoHorario: '',
  })
}

/** La ventana de 24 h abierta: si no, sale plantilla y no texto libre. */
function ventanaAbierta(clinicId: string, telefono: string) {
  t.poner(`clinics/${clinicId}/whatsapp_contacts/${telefono.replace(/\D/g, '').replace(/^521/, '52')}`, {
    telefono, lastInboundAt: new Date().toISOString(),
  })
}

beforeEach(() => {
  t = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(t) }
  enviados.lista = []
  proveedor.caido = false
  sembrarConsultorio(CLINICA)
  sembrarConsultorio(VECINA)
})

async function escribe(texto: string, de: string, clinicId = CLINICA) {
  const { handleMessage } = await import('@/app/api/whatsapp/webhook/route')
  await handleMessage(de, texto, clinicId)
}
async function ofrecer(clinicId = CLINICA, fecha = manana()) {
  const { ofrecerHuecoLiberado } = await import('@/lib/whatsapp/ofrecer-hueco')
  return ofrecerHuecoLiberado(clinicId, { fecha, hora: SLOT.hora, medicoId: 'doc-1', duracion: SLOT.duracion })
}

const citas = (c = CLINICA) => t.listar(`clinics/${c}/appointments`)
const lista = (c = CLINICA) => t.listar(`clinics/${c}/waitlist`)
const sesiones = (c = CLINICA) => t.listar(`clinics/${c}/bot_sessions`)
const para = (tel: string) => enviados.lista.filter(m => m.to === tel).map(m => m.texto).join('\n---\n')

describe('lista de espera · la promoción es determinista', () => {
  it('ofrece primero al de MAYOR prioridad, no al primero que devuelva el índice', async () => {
    ventanaAbierta(CLINICA, ANA); ventanaAbierta(CLINICA, BETO)
    enLista(CLINICA, 'w-beto', BETO, 'Beto Sintético', 3)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    const r = await ofrecer()
    expect(r.ok).toBe(true)
    // A los dos se les ofrece (el tope son 3), pero Ana primero.
    const orden = enviados.lista.filter(m => m.texto.includes('Espacio disponible')).map(m => m.to)
    expect(orden[0]).toBe(ANA)
  })

  it('deja al paciente en estado esperando_lista, con el hueco EXACTO', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    await ofrecer()
    const s = sesiones()
    expect(s).toHaveLength(1)
    expect(s[0].datos.estado).toBe('esperando_lista')
    const d = s[0].datos.datos as Record<string, string>
    expect(d.slotHora).toBe(SLOT.hora)
    expect(d.waitlistId).toBe('w-ana')
    expect(d.medicoId).toBe('doc-1')
  })
})

describe('lista de espera · un «SÍ» y una sola cita', () => {
  async function anaAceptaUnaVez() {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    await ofrecer()
    const sesion = sesiones()[0]
    enviados.lista = []
    await escribe('si', ANA)
    return sesion
  }

  it('el camino feliz agenda una cita y marca la entrada como convertida', async () => {
    await anaAceptaUnaVez()
    expect(citas()).toHaveLength(1)
    expect(lista()[0].datos.estado).toBe('convertido')
    expect(para(ANA)).toContain('¡Cita agendada!')
  })

  /**
   * EL DEFECTO. El mismo «SÍ» vuelve a llegar —Meta reentrega, el borrado de
   * sesión no cuajó, o el proveedor se cayó y la paciente reescribió—. La
   * transacción ve LA CITA QUE ACABA DE CREAR ELLA MISMA, la cuenta como
   * ocupación y le contesta:
   *
   *     «Lo sentimos, ese horario acaba de ocuparse — otra persona de la lista
   *      respondió primero.»
   *
   * Es falso, y además culpa a un tercero que no existe. La paciente TIENE la
   * cita. Peor que en el alta normal: aquí el mensaje la devuelve a la lista de
   * espera creyendo que perdió el hueco que en realidad ganó.
   */
  it('un «SÍ» repetido no le dice que otra persona se le adelantó', async () => {
    const sesion = await anaAceptaUnaVez()
    const folio = citas()[0].id

    t.poner(`clinics/${CLINICA}/bot_sessions/${sesion.id}`, sesion.datos)
    enviados.lista = []
    await escribe('si', ANA)

    expect(para(ANA)).not.toContain('otra persona')
    expect(para(ANA)).not.toContain('acaba de ocuparse')
    expect(citas()).toHaveLength(1)
    expect(citas()[0].id).toBe(folio)
  })

  it('el reintento no fabrica un segundo expediente ni reabre la entrada', async () => {
    const sesion = await anaAceptaUnaVez()
    t.poner(`clinics/${CLINICA}/bot_sessions/${sesion.id}`, sesion.datos)
    await escribe('si', ANA)
    expect(t.listar(`clinics/${CLINICA}/patients`)).toHaveLength(1)
    expect(lista()[0].datos.estado).toBe('convertido')
  })

  it('y no vuelve a avisar al consultorio de la misma cita', async () => {
    const sesion = await anaAceptaUnaVez()
    t.poner(`clinics/${CLINICA}/bot_sessions/${sesion.id}`, sesion.datos)
    enviados.lista = []
    await escribe('si', ANA)
    expect(para(TEL_CONSULTORIO)).not.toContain('lista de espera confirmó')
  })

  it('dos entregas simultáneas del mismo «SÍ» crean UNA cita y no se desmienten', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    await ofrecer()
    enviados.lista = []
    await Promise.all([escribe('si', ANA), escribe('si', ANA)])
    expect(citas()).toHaveLength(1)
    expect(para(ANA)).not.toContain('otra persona')
  })
})

describe('lista de espera · dos pacientes no se intercambian', () => {
  it('el segundo en contestar SÍ recibe la verdad, y no le roba la cita al primero', async () => {
    ventanaAbierta(CLINICA, ANA); ventanaAbierta(CLINICA, BETO)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    enLista(CLINICA, 'w-beto', BETO, 'Beto Sintético', 2)
    await ofrecer()
    enviados.lista = []

    await escribe('si', ANA)
    await escribe('si', BETO)

    expect(citas()).toHaveLength(1)
    expect(String(citas()[0].datos.pacienteTelefono)).toBe(ANA)
    expect(para(BETO)).toContain('otra persona')
    expect(para(BETO)).not.toContain('¡Cita agendada!')
  })

  it('la cita de Ana lleva SU nombre, no el de Beto', async () => {
    ventanaAbierta(CLINICA, ANA); ventanaAbierta(CLINICA, BETO)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    enLista(CLINICA, 'w-beto', BETO, 'Beto Sintético', 2)
    await ofrecer()
    await escribe('si', ANA)
    expect(String(citas()[0].datos.pacienteNombre)).toContain('Ana')
  })
})

describe('lista de espera · cancelar da de baja de verdad', () => {
  it('responder NO deja la entrada en baja y lo dice', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    await ofrecer()
    enviados.lista = []
    await escribe('no', ANA)
    expect(lista()[0].datos.estado).toBe('baja')
    expect(para(ANA)).toContain('le quitamos de la lista de espera')
  })

  it('un NO repetido no rompe nada ni promete una baja que ya ocurrió', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    await ofrecer()
    await escribe('no', ANA)
    await escribe('no', ANA)
    expect(lista()[0].datos.estado).toBe('baja')
    expect(citas()).toHaveLength(0)
  })
})

describe('lista de espera · dos consultorios nunca se mezclan', () => {
  it('el hueco de una clínica sólo se ofrece a SU lista', async () => {
    ventanaAbierta(CLINICA, ANA); ventanaAbierta(VECINA, BETO)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    enLista(VECINA, 'w-beto', BETO, 'Beto Sintético', 1)
    await ofrecer(CLINICA)
    const destinos = enviados.lista.filter(m => m.texto.includes('Espacio disponible')).map(m => m.to)
    expect(destinos).toContain(ANA)
    expect(destinos).not.toContain(BETO)
  })

  it('aceptar en una clínica no toca la lista ni la agenda de la otra', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    enLista(VECINA, 'w-ana-gemela', ANA, 'Ana Sintética', 1)
    await ofrecer(CLINICA)
    await escribe('si', ANA, CLINICA)
    expect(citas(CLINICA)).toHaveLength(1)
    expect(citas(VECINA)).toHaveLength(0)
    expect(lista(VECINA)[0].datos.estado).toBe('activo')
  })
})

describe('lista de espera · el proveedor caído no pierde el estado', () => {
  it('si el aviso no sale, la entrada NO queda marcada como contactada', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    proveedor.caido = true
    const r = await ofrecer()
    expect(r.notified).toBe(0)
    expect(lista()[0].datos.estado).toBe('activo')
  })

  it('y el intento queda encolado para reintentarlo, no perdido', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    proveedor.caido = true
    await ofrecer()
    expect(t.cuantos(`clinics/${CLINICA}/whatsapp_outbox`)).toBeGreaterThan(0)
  })

  it('cuando el proveedor vuelve, la misma paciente sigue siendo candidata', async () => {
    ventanaAbierta(CLINICA, ANA)
    enLista(CLINICA, 'w-ana', ANA, 'Ana Sintética', 1)
    proveedor.caido = true
    await ofrecer()
    proveedor.caido = false
    enviados.lista = []
    const r = await ofrecer()
    expect(r.notified).toBe(1)
    expect(para(ANA)).toContain('Espacio disponible')
  })
})
