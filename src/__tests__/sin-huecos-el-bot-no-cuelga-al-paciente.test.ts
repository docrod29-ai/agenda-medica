/**
 * GOLDEN — SIN HUECOS, EL BOT NO CUELGA AL PACIENTE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Cuando ningún día de los siguientes catorce tenía hueco, el bot contestaba
 * «En este momento no hay horarios disponibles. Le invitamos a llamar al …» y
 * **borraba la sesión**.
 *
 * Dos pérdidas, las dos silenciosas:
 *
 *  · El paciente se quedaba fuera con el trabajo ya hecho —había dado su nombre
 *    y su tipo de consulta— y sin más salida que llamar por teléfono, que es lo
 *    que quería evitar escribiendo.
 *  · El consultorio no se enteraba de nada. La demanda que NO cabe es
 *    justamente la que hay que ver: sin registro, una agenda saturada se lee
 *    igual que una agenda tranquila.
 *
 * Y la lista de espera ya existía entera: la pantalla del consultorio, el
 * emparejamiento por tipo y rango horario, y el aviso automático en cuanto
 * alguien cancela. Lo único que faltaba era la puerta por la que entra quien
 * llega cuando no queda sitio.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo el flujo del bot preguntando por cada rama «¿dónde acaba el
 * paciente?». Ésta acababa en `clearSession` sin dejar rastro.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un «no hay» siempre ofrece una salida, y la salida deja constancia. El alta
 * usa el MISMO id derivado que el panel (`idIdempotente` + `claveDeEspera`), así
 * que el reintento de WhatsApp —o la asistente anotándolo a la vez— convergen a
 * un documento y no a dos: al liberarse un hueco sólo se avisa a tres personas,
 * y un paciente repetido ocupa dos de esos tres sitios.
 *
 * Y no se le dice «listo» si no se pudo: quedarse esperando un aviso que nadie
 * va a mandar es peor que no haberle ofrecido nada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · A quién se le ofrece un hueco después, y en qué orden: eso es
 *   `la-lista-de-espera-no-se-duplica-ni-miente` y `lista-espera.ts`.
 * · Las reglas de Firestore (van contra el emulador).
 * · La plantilla HSM fuera de la ventana de 24 h.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const CLINICA = 'clinica-sintetica-alfa'
const ANA = '5215511110000'
const TEL_CONSULTORIO = '5215599990000'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))
const enviados = vi.hoisted(() => ({ lista: [] as Array<{ to: string; texto: string }> }))

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))
vi.mock('@/lib/whatsapp-send', () => ({
  sendWhatsApp: async (_clinicId: string, to: string, texto: string) => {
    enviados.lista.push({ to, texto })
    return { ok: true }
  },
  sendWhatsAppTemplate: async () => ({ ok: true }),
}))
vi.mock('@/lib/calendario/ocupado-servidor', () => ({
  ocupadoEnGoogle: async () => ({ bloqueos: [], consultado: false, fallo: false }),
}))

/** CERRADO TODOS LOS DÍAS: la forma más limpia de no tener ni un hueco. */
const CERRADO = { activo: false, inicio: '09:00', fin: '18:00' }
const ABIERTO = { activo: true, inicio: '09:00', fin: '18:00' }

let t: TiendaEnMemoria

function sembrar(horario: typeof CERRADO) {
  t.poner(`clinics/${CLINICA}`, { status: 'active' })
  t.poner(`clinics/${CLINICA}/config/main`, {
    nombreClinica: 'Consultorio Sintético', nombreMedico: 'Dra. Sintética',
    telefonoAdmin: TEL_CONSULTORIO, whatsappConsultorio: TEL_CONSULTORIO,
    direccion: 'Calle Sintética 1',
    horario: {
      lunes: horario, martes: horario, miercoles: horario, jueves: horario,
      viernes: horario, sabado: horario, domingo: horario,
    },
    zonaHoraria: 'America/Mexico_City', duraciones: {}, botConfig: {},
  })
  t.poner(`clinics/${CLINICA}/doctors/doc-1`, { nombre: 'Dra. Sintética', activo: true })
}

async function escribe(texto: string, de = ANA) {
  const { handleMessage } = await import('@/app/api/whatsapp/webhook/route')
  await handleMessage(de, texto, CLINICA)
}

const lista = () => t.listar(`clinics/${CLINICA}/waitlist`)
const sesiones = () => t.listar(`clinics/${CLINICA}/bot_sessions`)
const todoLoDicho = () => enviados.lista.map(m => m.texto).join('\n---\n')

/**
 * Llega hasta el punto en que el bot descubre que no hay ni un día libre.
 *
 * El recorrido es el real, sin atajos: menú → «1» (agendar) → aviso de
 * privacidad → nombre → tipo de consulta. Si alguno de esos pasos cambiara,
 * esta suite lo notaría antes que un paciente.
 */
async function hastaElCallejon() {
  await escribe('hola')       // menú
  await escribe('1')          // agendar cita
  await escribe('si')         // aviso de privacidad
  await escribe('Ana Sintética')
  await escribe('1')          // tipo de consulta
}

beforeEach(() => {
  t = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(t) }
  enviados.lista = []
})

describe('Cuando no hay ni un hueco en catorce días', () => {
  beforeEach(() => sembrar(CERRADO))

  it('ofrece la lista de espera en vez de despedirse', async () => {
    await hastaElCallejon()
    expect(todoLoDicho()).toContain('lista de espera')
    // Y el teléfono del consultorio sigue ahí: la lista es una opción, no un
    // sustituto de poder hablar con alguien.
    expect(todoLoDicho()).toContain(TEL_CONSULTORIO)
  })

  it('la sesión NO se borra: queda esperando la respuesta', async () => {
    await hastaElCallejon()
    const s = sesiones()
    expect(s).toHaveLength(1)
    expect(s[0].datos.estado).toBe('ofrecer_lista')
  })

  it('un SÍ lo anota, con su nombre y su tipo', async () => {
    await hastaElCallejon()
    await escribe('si')
    const entradas = lista()
    expect(entradas).toHaveLength(1)
    expect(entradas[0].datos).toMatchObject({
      pacienteNombre: 'Ana Sintética',
      estado: 'activo',
      creadoPor: 'bot-whatsapp',
    })
    // El teléfono en diez dígitos, como el panel: es la clave con la que
    // después se le encuentra.
    expect(String(entradas[0].datos.pacienteTelefono)).toHaveLength(10)
    expect(todoLoDicho()).toContain('lista de espera')
  })

  it('un NO no anota a nadie, y no deja la sesión colgada', async () => {
    await hastaElCallejon()
    await escribe('no')
    expect(lista()).toHaveLength(0)
    expect(sesiones()).toHaveLength(0)
  })

  it('anotarse dos veces deja UNA entrada — el id es el mismo que escribe el panel', async () => {
    await hastaElCallejon()
    await escribe('si')
    await hastaElCallejon()
    await escribe('si')
    expect(lista()).toHaveLength(1)

    // Y es exactamente el id que `createWaitlistEntry` —la vía del panel—
    // derivaría de esta misma entrada: mismo teléfono en diez dígitos, mismo
    // tipo. Si las dos vías divergieran, la asistente anotando al paciente que
    // ya se anotó solo crearía un duplicado.
    const { idIdempotente } = await import('@/lib/idempotencia')
    const { claveDeEspera } = await import('@/lib/whatsapp/lista-espera')
    const guardada = lista()[0]
    const esperado = idIdempotente(CLINICA, 'lista-espera', claveDeEspera(
      guardada.datos as { pacienteTelefono?: string; tipo?: string },
    ))
    expect(guardada.id).toBe(esperado)
  })

  it('queda en la bitácora, y SIN datos del paciente', async () => {
    await hastaElCallejon()
    await escribe('si')
    const asientos = t.listar(`clinics/${CLINICA}/audit_log`)
      .filter(a => a.datos.evento === 'lista_espera_alta_bot')
    expect(asientos).toHaveLength(1)
    const meta = JSON.stringify(asientos[0].datos.meta ?? {})
    expect(meta).not.toContain('Ana')
    expect(meta).not.toContain(ANA.slice(-10))
  })
})

describe('AL REVÉS — con huecos, el bot sigue agendando como siempre', () => {
  it('no ofrece lista de espera cuando hay días libres', async () => {
    sembrar(ABIERTO)
    await hastaElCallejon()
    // Lo que sale es el menú de días, no la lista de espera. Si esto se
    // rompiera, la reparación habría convertido una agenda sana en una lista.
    expect(todoLoDicho()).toContain('¿Qué día prefiere?')
    expect(todoLoDicho()).not.toContain('lista de espera')
    expect(sesiones()[0].datos.estado).toBe('agendar_fecha')
  })
})
