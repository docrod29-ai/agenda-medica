/**
 * LA URGENCIA GANA — y en WhatsApp no ganaba nada, porque no existía.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El bot de WhatsApp no tenía NINGUNA detección de urgencia. Cero. Y su primera
 * decisión sobre lo que escribe el paciente es un detector de preguntas
 * frecuentes que trabaja por **subcadena**:
 *
 *     if (/horario|hora|atiende|atencion|abren|cierran|cuando/.test(t)) return 'horario'
 *
 * «Me duele el pecho desde hace una **hora**» contiene `hora`. El paciente con
 * dolor torácico recibía, literalmente, **el horario de atención del
 * consultorio**. Y «no puedo respirar» no casa con ninguna pregunta frecuente ni
 * con ningún verbo de agenda, así que caía al menú: cuatro opciones y «no
 * entendí».
 *
 * Las dos frases están en la lista del §6 de `.claude/rules/patient-facing-ai.md`
 * —dolor torácico y dificultad respiratoria— donde dice que la urgencia se
 * clasifica **antes** que cualquier otra cosa y con la vía de contacto real.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditando el Bloque 7 contra la regla de IA de cara al paciente. `grep` de
 * `urgencia|emergencia|911` sobre `api/whatsapp/` y `lib/whatsapp/`: **ni una
 * línea**. El portal del paciente (`app/mi/[token]`) sí lo dice desde siempre —
 * «dolor en el pecho, dificultad para respirar, síntomas neurológicos… acude a
 * urgencias o llama al 911»— así que la POLÍTICA ya existía en el producto: lo
 * que faltaba era aplicarla en el canal por el que entra la mayoría.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Precedencia. No es que la detección fallara: es que la primera pregunta que se
 * hacía el bot era «¿de qué tema habla?» en vez de «¿esto es una urgencia?». Un
 * detector de temas por subcadena, preguntado primero, decide antes de que nadie
 * mire si el paciente se está muriendo.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · El vocabulario es VOCABULARIO, no criterio (`clinical-safety.md` §5): que
 *   falte una forma de decirlo significa que ESE caso no se vigila, no que sea
 *   benigno. Lo declara el propio módulo.
 * · No hay triaje: el bot no decide gravedad, no aconseja y no atiende. Escala.
 * · No cubre voz ni el portal web: otros canales, otra unidad.
 * · No cubre la plantilla HSM (el aviso al consultorio sale por texto libre).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const CLINICA = 'clinica-sintetica-alfa'
const VECINA = 'clinica-sintetica-beta'
const PACIENTE = '5215512345678'
const TEL_CONSULTORIO = '5215599990000'
const TEL_VECINA = '5215588880000'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))
const enviados = vi.hoisted(() => ({ lista: [] as Array<{ clinicId: string; to: string; texto: string }> }))

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))

/** Proveedor FALSO y determinista: nada sale a la red, y se puede leer lo enviado. */
vi.mock('@/lib/whatsapp-send', () => ({
  sendWhatsApp: async (clinicId: string, to: string, texto: string) => {
    enviados.lista.push({ clinicId, to, texto })
    return { ok: true }
  },
  sendWhatsAppTemplate: async () => ({ ok: true }),
}))

/** El calendario del médico no es el sujeto de esta prueba. */
vi.mock('@/lib/calendario/ocupado-servidor', () => ({
  ocupadoEnGoogle: async () => [],
}))

const HORARIO_COMPLETO = {
  lunes: { activo: true, inicio: '09:00', fin: '18:00' },
  martes: { activo: true, inicio: '09:00', fin: '18:00' },
  miercoles: { activo: true, inicio: '09:00', fin: '18:00' },
  jueves: { activo: true, inicio: '09:00', fin: '18:00' },
  viernes: { activo: true, inicio: '09:00', fin: '18:00' },
  sabado: { activo: true, inicio: '09:00', fin: '18:00' },
  domingo: { activo: true, inicio: '09:00', fin: '18:00' },
}

function sembrarConsultorio(t: TiendaEnMemoria, clinicId: string, telefono: string) {
  t.poner(`clinics/${clinicId}/config/main`, {
    nombreClinica: 'Consultorio Sintético',
    nombreMedico: 'Dra. Sintética',
    telefonoAdmin: telefono,
    whatsappConsultorio: telefono,
    direccion: 'Calle Sintética 1',
    horario: HORARIO_COMPLETO,
    zonaHoraria: 'America/Mexico_City',
    botConfig: { costoConsulta: '$1000' },
  })
  t.poner(`clinics/${clinicId}/doctors/doc-1`, { nombre: 'Dra. Sintética', activo: true })
}

/** Lo que el bot le contestó AL PACIENTE (no lo que le avisó al consultorio). */
function alPaciente(): string {
  return enviados.lista.filter(m => m.to === PACIENTE).map(m => m.texto).join('\n---\n')
}

async function escribe(texto: string, clinicId = CLINICA, de = PACIENTE) {
  const { handleMessage } = await import('@/app/api/whatsapp/webhook/route')
  await handleMessage(de, texto, clinicId)
}

let t: TiendaEnMemoria

beforeEach(() => {
  t = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(t) }
  enviados.lista = []
  sembrarConsultorio(t, CLINICA, TEL_CONSULTORIO)
  sembrarConsultorio(t, VECINA, TEL_VECINA)
  vi.resetModules()
})

/**
 * Las dos frases del enunciado, más las otras tres categorías del §6. Son
 * sintéticas: ningún paciente real escribió esto.
 */
const FRASES_URGENTES = [
  'me duele el pecho desde hace una hora',
  'no puedo respirar',
  'tengo una opresión en el pecho y me falta el aire',
  'mi hijo se tomó las pastillas de la abuela',
  'no puedo mover el brazo izquierdo y se me tuerce la boca',
]

describe('H-02 · la urgencia gana a la subcadena, a la FAQ y a la agenda', () => {
  it.each(FRASES_URGENTES)('«%s» recibe respuesta de urgencia', async (frase) => {
    await escribe(frase)
    const r = alPaciente().toLowerCase()
    expect(r, 'el bot no contestó nada al paciente').not.toBe('')
    expect(r).toContain('urgencia')
    expect(r).toContain('911')
  })

  it('«me duele el pecho desde hace una hora» NO recibe el horario de atención', async () => {
    // Éste es el defecto exacto: `hora` de «una hora» disparaba la FAQ de horario.
    await escribe('me duele el pecho desde hace una hora')
    const r = alPaciente()
    expect(r).not.toContain('Horario de atención')
    expect(r).not.toContain('09:00')
  })

  it('«no puedo respirar» NO cae al menú ni a «no entendí»', async () => {
    await escribe('no puedo respirar')
    const r = alPaciente().toLowerCase()
    expect(r).not.toContain('no entendi')
    expect(r).not.toContain('no entendí')
    expect(r).not.toContain('agendar cita')
    expect(r).not.toContain('1️⃣')
  })

  it('no abre agenda: ni sesión de agendado ni cita creada', async () => {
    await escribe('quiero agendar pero no puedo respirar')
    expect(t.cuantos(`clinics/${CLINICA}/appointments`)).toBe(0)
    const sesiones = t.listar(`clinics/${CLINICA}/bot_sessions`)
    for (const s of sesiones) {
      expect(String(s.datos.estado ?? '')).not.toMatch(/^agendar/)
    }
  })

  it('gana también EN MEDIO de un agendado a medias', async () => {
    // La urgencia no espera a que el paciente termine de elegir horario.
    await escribe('agendar')
    enviados.lista = []
    await escribe('me duele el pecho')
    const r = alPaciente().toLowerCase()
    expect(r).toContain('urgencia')
    expect(t.cuantos(`clinics/${CLINICA}/appointments`)).toBe(0)
  })

  it('el aviso llega ARRIBA, no sepultado bajo una explicación', async () => {
    // §6: «Un aviso urgente que llega en el tercer párrafo no llegó.»
    await escribe('no puedo respirar')
    const primero = enviados.lista.find(m => m.to === PACIENTE)!.texto
    const parrafos = primero.split('\n').filter(l => l.trim() !== '')
    expect(parrafos.slice(0, 2).join(' ').toLowerCase()).toContain('urgencia')
  })
})

describe('H-02 · lo que el bot NO hace con una urgencia', () => {
  it('no diagnostica, no indica tratamiento y no manda medicamento', async () => {
    for (const frase of FRASES_URGENTES) {
      enviados.lista = []
      await escribe(frase)
      const r = alPaciente().toLowerCase()
      for (const prohibido of ['infarto', 'angina', 'asma', 'tome ', 'tomar ', 'dosis', 'mg', 'aspirina']) {
        expect(r, `«${frase}» produjo la palabra prohibida «${prohibido}»`).not.toContain(prohibido)
      }
    }
  })

  /**
   * La primera versión de este caso prohibía la subcadena «espere respuesta», y
   * la copia SEGURA dice «**No** espere respuesta por este medio». Prohibir la
   * subcadena prohibía la frase correcta junto con la incorrecta. Lo que hay que
   * exigir es la semántica: que le diga que no espere aquí, y que no le prometa
   * atención por este canal.
   */
  it('le dice que NO espere aquí, en vez de prometerle que lo atienden', async () => {
    await escribe('no puedo respirar')
    const r = alPaciente().toLowerCase()
    expect(r).toMatch(/no espere respuesta|no esperes respuesta|no espere aqui/)
    for (const promesa of ['le atendemos', 'lo atendemos', 'te atendemos', 'en breve', 'en un momento', 'enseguida le', 'le contactamos']) {
      expect(r, `promete atención por este canal: «${promesa}»`).not.toContain(promesa)
    }
  })
})

describe('H-02 · aislamiento entre consultorios y PHI', () => {
  it('el aviso de urgencia sale al consultorio de ESA clínica y a ninguna otra', async () => {
    await escribe('no puedo respirar', CLINICA)
    const destinos = enviados.lista.map(m => m.to)
    expect(destinos).toContain(TEL_CONSULTORIO)
    expect(destinos).not.toContain(TEL_VECINA)
    for (const m of enviados.lista) expect(m.clinicId).toBe(CLINICA)
  })

  it('la urgencia de un consultorio no deja rastro en el vecino', async () => {
    await escribe('me duele el pecho', CLINICA)
    expect(t.listar(`clinics/${VECINA}/bot_sessions`)).toHaveLength(0)
    expect(t.cuantos(`clinics/${VECINA}/appointments`)).toBe(0)
  })

  it('no se escribe PHI en la consola', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await escribe('me duele el pecho desde hace una hora')
    const todo = [...warn.mock.calls, ...log.mock.calls, ...err.mock.calls].flat().map(String).join(' ')
    expect(todo).not.toContain('duele')
    expect(todo).not.toContain(PACIENTE)
    warn.mockRestore(); log.mockRestore(); err.mockRestore()
  })
})

describe('H-02 · lo que NO es urgencia sigue funcionando', () => {
  it('«¿cuál es su horario?» sigue recibiendo el horario', async () => {
    await escribe('cual es su horario?')
    expect(alPaciente()).toContain('Horario de atención')
  })

  it('«quiero agendar una consulta» sigue entrando a la agenda', async () => {
    await escribe('quiero agendar una consulta')
    expect(alPaciente().toLowerCase()).not.toContain('911')
  })

  it('«cuánto cuesta la consulta» sigue siendo una pregunta de precio', async () => {
    await escribe('cuanto cuesta la consulta')
    expect(alPaciente().toLowerCase()).not.toContain('911')
  })

  /**
   * FALSOS POSITIVOS QUE SÍ DUELEN.
   *
   * La asimetría de este módulo dice que ante la duda se escala: un falso
   * positivo cuesta un mensaje y un falso negativo cuesta la vida. Pero eso no
   * es permiso para escalar frases administrativas COMUNES. «No puedo hablar
   * ahora» y «no puedo ver los horarios» son cosas que la gente escribe todos
   * los días a un consultorio, y contestarles con el 911 rompe el canal y
   * enseña al paciente a ignorar el aviso el día que sea de verdad.
   *
   * Encontrados releyendo las reglas propias en busca de qué las haría disparar
   * de más — no en producción, que es donde se habrían encontrado solas.
   */
  it.each([
    'no puedo hablar ahora, agendame para mañana',
    'no puedo ver los horarios en la pagina',
    'me duele la garganta desde ayer',
    'el doctor atiende dolor de espalda?',
    'puedo respirar tranquilo antes del estudio?',
  ])('«%s» NO se trata como urgencia', async (frase) => {
    await escribe(frase)
    expect(alPaciente().toLowerCase(), 'falso positivo de urgencia').not.toContain('911')
  })
})
