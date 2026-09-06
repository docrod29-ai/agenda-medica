import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GOLDEN — compartir algo del portal era compartir el portal entero, y el
 * paciente no podía cerrar su propio enlace ni saber quién había entrado.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Un solo enlace por paciente, siete días, dos alcances (`agenda`, `clinico`) y
 * el reenvío como uso normal. De ahí, cinco hallazgos del Panel de Lujo:
 *
 *  · **PP-005 (P1)** — el enlace que la madre reenvía a la guardería abre TODO
 *    lo del niño: citas con motivo, plan de cuidado, recetas con diagnóstico,
 *    sus preguntas — y deja cancelar, reagendar y preguntar en su nombre.
 *  · **PO-009** — para justificar una incapacidad, la única opción era mandar
 *    ese mismo enlace al patrón. No había «compartir sólo esto».
 *  · **PC-018** — el paciente no puede cerrar su enlace: sólo el médico, desde
 *    el expediente. Y no se entera de que alguien más entró.
 *  · **PP-008** — dos cuidadores (padre y madre separados) son indistinguibles;
 *    el formulario previo del segundo BORRABA el del primero, en silencio.
 *  · **PI-013 · PG-011 · PO-014 · PC-010** — no existe el cuidador autorizado
 *    que la Ayuda del producto promete.
 *  · **PI-009** — con el enlace de agenda, el vecino podía escribir a nombre del
 *    paciente qué medicamentos toma y a qué es alérgico.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Panel de Lujo (sep-2026): recorridos de los auditores P-pediatría,
 * P-ortopedia, P-cirugía, P-gineco y P-interna, confirmados por el equipo rojo.
 * `patient-token.ts` ya nombraba el riesgo del reenvío y lo mitigaba con TTL —
 * con tiempo, no con alcance.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * El alcance del enlace se pensó como una propiedad de QUIÉN LO EMITE (la
 * asistente o el médico) y nunca como una propiedad de PARA QUÉ SE USA. Con dos
 * únicos valores, «enseñarle una receta a la farmacia» y «darle el expediente a
 * alguien durante una semana» eran la misma operación.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `patient-facing-ai.md` §8: «el paciente ve lo suyo y nada más… Un cuidador
 * autorizado es una autorización explícita y revocable, con bitácora — no un
 * segundo dueño del expediente». Y la decisión PL-P1 del dueño, cuyo primer
 * punto dice literalmente que «Cerrar este enlace» y la bitácora por apertura
 * **no requieren decisión**.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **No hay segundo factor**, y está razonado por escrito
 *   (`POR_QUE_NO_HAY_SEGUNDO_FACTOR`): quien más necesita el portal es quien no
 *   pasaría esa puerta. Lo que se acota es cuánto abre cada enlace.
 * · **No verifica la identidad del cuidador.** Nadie comprueba que «Ana, mi
 *   hija» sea Ana. Garantiza autorización explícita, fechada, revocable y con
 *   rastro — que es lo que §8 pide.
 * · **No decide desde qué edad autoriza el adolescente** en vez de su tutor:
 *   sigue siendo una decisión del dueño (PL-P1, MP-014) y aquí no se asume.
 * · No cubre la pantalla: que los controles existan y se puedan usar es la
 *   suite del portal y la compuerta de accesibilidad.
 */

vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: async () => null,
  limitarEstricto: async () => null,
}))

const getPaciente = vi.fn()
const updatePaciente = vi.fn()
const getNotas = vi.fn()
const getNotaUna = vi.fn()
const getFormulario = vi.fn()
const setFormulario = vi.fn()
const getConfig = vi.fn()
const addAudit = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { increment: (n: number) => ({ __inc: n }) } } },
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'config') return { doc: () => ({ get: getConfig }) }
          if (sub === 'audit_log') return { add: addAudit }
          if (sub === 'appointments') return { where: () => ({ get: async () => ({ docs: [] }) }) }
          if (sub === 'patients') {
            return {
              doc: () => ({
                get: getPaciente,
                update: updatePaciente,
                collection: (s2: string) => {
                  if (s2 === 'notas') return { where: () => ({ get: getNotas }), doc: () => ({ get: getNotaUna }) }
                  if (s2 === 'formularios_previos') return { doc: () => ({ get: getFormulario, set: setFormulario }) }
                  return { get: async () => ({ docs: [] }) }
                },
              }),
            }
          }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))

vi.mock('@/lib/whatsapp/avisar-consultorio', () => ({
  avisarAlConsultorio: async () => undefined,
  telefonoDelConsultorio: () => '',
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente, verificarTokenPaciente } from '@/lib/patient-token'
import { autorizarCuidador, revocarCuidador, alcanceQuePuedeDar, vigentes } from '@/lib/paciente/cuidador-autorizado'

const SECRETO_DEV = 'dev-portal-secret-no-usar-en-produccion-0123456789'
const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-005'
const NOTA_A = 'nota-sintetica-a'
const NOTA_B = 'nota-sintetica-b'

function req(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': '203.0.113.55', origin: 'https://ejemplo.test' }),
    nextUrl: { origin: 'https://ejemplo.test' },
  } as unknown as Parameters<typeof POST>[0]
}

function notaFirmada(id: string, dx: string) {
  return {
    id,
    estado: 'firmada',
    fechaConsulta: '2026-09-01',
    firma: { nombreMedico: 'Dra. Ficticia', cedulaProfesional: '00000000' },
    diagnosticos: [{ descripcion: dx, tipo: 'definitivo', tipoOrigen: 'medico' }],
    medicamentos: [{ nombre: 'Medicamento ficticio', dosis: '1 tableta', procedenciaClinica: 'se_prescribe_hoy' }],
  }
}

beforeEach(() => {
  vi.stubEnv('PORTAL_PACIENTE_SECRET', SECRETO_DEV)
  getPaciente.mockReset(); updatePaciente.mockReset(); getNotas.mockReset(); getNotaUna.mockReset()
  getFormulario.mockReset(); setFormulario.mockReset(); getConfig.mockReset(); addAudit.mockReset()
  getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 0, nombre: 'Paciente Sintético' }) })
  updatePaciente.mockResolvedValue(undefined)
  getConfig.mockResolvedValue({ exists: false, data: () => undefined })
  getNotas.mockResolvedValue({
    docs: [
      { id: NOTA_A, data: () => notaFirmada(NOTA_A, 'Diagnóstico sintético A') },
      { id: NOTA_B, data: () => notaFirmada(NOTA_B, 'Diagnóstico sintético B') },
    ],
  })
  getNotaUna.mockResolvedValue({ exists: true, data: () => ({ estado: 'firmada' }) })
  getFormulario.mockResolvedValue({ exists: false, data: () => undefined })
  setFormulario.mockResolvedValue(undefined)
  addAudit.mockResolvedValue(undefined)
})

const clinico = () => crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
const agenda = () => crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')

describe('PP-005 · PO-009 — compartir UNA receta no es compartir el expediente', () => {
  it('el paciente pide un enlace para un solo documento y le sale uno acotado a esa nota', async () => {
    const res = await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: NOTA_A }))
    expect(res.status).toBe(200)
    const { url } = await res.json()
    const t = verificarTokenPaciente(String(url).split('/mi/')[1])
    expect(t?.alcance).toBe('documento')
    expect(t?.documentoId).toBe(NOTA_A)
  })

  it('y ese enlace devuelve SÓLO esa nota, no el recetario', async () => {
    const res = await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: NOTA_A }))
    const { url } = await res.json()
    const compartido = String(url).split('/mi/')[1]
    const docs = await (await POST(req({ action: 'documentos', token: compartido }))).json()
    expect(docs.documentos).toHaveLength(1)
    expect(docs.documentos[0].id).toBe(NOTA_A)
  })

  it('AL REVÉS: con el enlace clínico normal salen las DOS notas — si no, esto no probaría nada', async () => {
    const docs = await (await POST(req({ action: 'documentos', token: clinico() }))).json()
    expect(docs.documentos).toHaveLength(2)
  })

  /**
   * EL DATO TIENE QUE LLEGAR — y la pantalla ya no llama a `documentos`.
   *
   * Desde PC-006 el portal abre con UNA sola petición (`inicio`). Un enlace de
   * documento que sólo funcionara en la acción `documentos` sería un enlace que
   * pasa las pruebas y le enseña a la guardería una pestaña vacía: el documento
   * existe, el token lo nombra, y no llega. Por eso este caso va por la acción
   * que de verdad usa la pantalla.
   */
  it('y llega por `inicio`, que es la petición que hace la pantalla', async () => {
    const res = await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: NOTA_A }))
    const compartido = String((await res.json()).url).split('/mi/')[1]
    const d = await (await POST(req({ action: 'inicio', token: compartido }))).json()
    expect(d.alcance).toBe('documento')
    expect(d.documentos, 'el documento compartido no llegó a la pantalla').toHaveLength(1)
    expect(d.documentos[0].id).toBe(NOTA_A)
    // Y nada más: el plan y las preguntas no viajan con un enlace acotado.
    expect(d.paquetes).toEqual([])
    expect(d.preguntas).toEqual([])
    expect(d.citas).toEqual([])
  })

  it('control: con el enlace clínico, `inicio` trae las dos notas y el resto', async () => {
    const d = await (await POST(req({ action: 'inicio', token: clinico() }))).json()
    expect(d.documentos).toHaveLength(2)
    expect(d.alcance).toBe('clinico')
  })

  it('un enlace de documento NO abre el plan de cuidado, ni las preguntas, ni las citas', async () => {
    const res = await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: NOTA_A }))
    const compartido = String((await res.json()).url).split('/mi/')[1]
    for (const action of ['paquetes', 'preguntas', 'preguntar', 'formulario']) {
      const r = await POST(req({ action, token: compartido, texto: 'hola', respuestas: { motivo: 'x' } }))
      expect(r.status, `${action} tenía que quedar fuera de un enlace de documento`).toBe(403)
    }
  })

  it('y no puede emitir otro enlace ni autorizar a nadie: un enlace acotado no engendra accesos', async () => {
    const res = await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: NOTA_A }))
    const compartido = String((await res.json()).url).split('/mi/')[1]
    expect((await POST(req({ action: 'compartir-documento', token: compartido, documentoId: NOTA_B }))).status).toBe(403)
    expect((await POST(req({
      action: 'autorizar-cuidador', token: compartido,
      cuidador: { nombre: 'Alguien', parentesco: 'mi vecino' },
    }))).status).toBe(403)
  })

  it('no se puede compartir un borrador ni un id inventado', async () => {
    getNotaUna.mockResolvedValue({ exists: true, data: () => ({ estado: 'borrador' }) })
    expect((await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: NOTA_A }))).status).toBe(404)
    getNotaUna.mockResolvedValue({ exists: false })
    expect((await POST(req({ action: 'compartir-documento', token: clinico(), documentoId: 'inventada' }))).status).toBe(404)
  })
})

describe('PC-018 — el paciente puede cerrar su propio enlace', () => {
  it('cerrarlo sube la versión del expediente, que es lo que tumba TODOS los enlaces', async () => {
    const res = await POST(req({ action: 'cerrar-enlace', token: clinico() }))
    expect(res.status).toBe(200)
    expect(updatePaciente).toHaveBeenCalledTimes(1)
    expect(Object.keys(updatePaciente.mock.calls[0][0])).toEqual(['portalTokenVersion'])
  })

  it('y después de cerrarlo, el enlace de antes ya no abre nada', async () => {
    // La versión del expediente sube; el token viejo se emitió con la anterior.
    getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 1, nombre: 'Paciente Sintético' }) })
    const res = await POST(req({ action: 'documentos', token: clinico() }))
    expect(res.status).toBe(401)
  })
})

describe('§8 — el cuidador autorizado: explícito, revocable y con bitácora', () => {
  it('el paciente autoriza a alguien y recibe un enlace atado a ESA persona', async () => {
    const res = await POST(req({
      action: 'autorizar-cuidador', token: clinico(),
      cuidador: { nombre: 'Ana Sintética', parentesco: 'mi hija', alcance: 'clinico' },
    }))
    expect(res.status).toBe(200)
    const { cuidador, url } = await res.json()
    expect(cuidador.parentesco).toBe('mi hija')
    expect(cuidador.autorizadoEn, 'una autorización sin fecha no se puede auditar').toBeTruthy()
    expect(verificarTokenPaciente(String(url).split('/mi/')[1])?.cuidadorId).toBe(cuidador.id)
  })

  it('el enlace de un cuidador REVOCADO deja de abrir — si no, revocar sería un botón decorativo', async () => {
    const alta = await (await POST(req({
      action: 'autorizar-cuidador', token: clinico(),
      cuidador: { nombre: 'Ana Sintética', parentesco: 'mi hija', alcance: 'clinico' },
    }))).json()
    const suEnlace = String(alta.url).split('/mi/')[1]

    // Con la autorización vigente, entra.
    getPaciente.mockResolvedValue({
      exists: true,
      data: () => ({ portalTokenVersion: 0, nombre: 'P', cuidadoresAutorizados: [alta.cuidador] }),
    })
    expect((await POST(req({ action: 'documentos', token: suEnlace }))).status).toBe(200)

    // Revocada, no.
    const revocada = revocarCuidador([alta.cuidador], alta.cuidador.id, '2026-09-06T10:00:00.000Z')!
    getPaciente.mockResolvedValue({
      exists: true,
      data: () => ({ portalTokenVersion: 0, nombre: 'P', cuidadoresAutorizados: revocada }),
    })
    expect((await POST(req({ action: 'documentos', token: suEnlace }))).status).toBe(401)
  })

  it('un cuidador cuyo id no está en la lista tampoco entra (falla-cerrado)', async () => {
    const inventado = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico', 0, { cuidadorId: 'cui_inventado' })
    expect((await POST(req({ action: 'documentos', token: inventado }))).status).toBe(401)
  })

  it('nadie puede dar más de lo que tiene: un enlace de agenda no engendra uno clínico', () => {
    expect(alcanceQuePuedeDar('agenda', 'clinico')).toBeNull()
    expect(alcanceQuePuedeDar('agenda', 'agenda')).toBe('agenda')
    expect(alcanceQuePuedeDar('clinico', 'clinico')).toBe('clinico')
    expect(alcanceQuePuedeDar('documento', 'agenda'), 'un enlace acotado no autoriza a nadie').toBeNull()
  })

  it('revocar NO borra: la bitácora se conserva con su fecha', () => {
    const alta = autorizarCuidador([], { nombre: 'Ana', parentesco: 'mi hija', alcance: 'agenda' }, 'clinico', '2026-09-01T00:00:00.000Z', 'cui_1')
    expect(alta.ok).toBe(true)
    if (!alta.ok) return
    const tras = revocarCuidador([alta.cuidador], 'cui_1', '2026-09-06T00:00:00.000Z')!
    expect(tras).toHaveLength(1)
    expect(tras[0].revocadoEn).toBe('2026-09-06T00:00:00.000Z')
    expect(vigentes(tras), 'revocado no entra').toHaveLength(0)
  })
})

describe('PI-009 — con el enlace de agenda, nadie escribe en tu nombre', () => {
  it('el formulario previo exige alcance clínico', async () => {
    const r = await POST(req({ action: 'formulario', token: agenda(), respuestas: { alergias: 'ninguna' } }))
    expect(r.status).toBe(403)
    expect(setFormulario).not.toHaveBeenCalled()
  })

  it('PP-008 · lo que manda el segundo cuidador no borra lo del primero', async () => {
    getFormulario.mockResolvedValue({
      exists: true,
      data: () => ({ respuestas: { medicamentos: 'warfarina sintética' }, enviadoEn: '2026-09-01T10:00:00.000Z' }),
    })
    await POST(req({ action: 'formulario', token: clinico(), respuestas: { motivo: 'dolor sintético' } }))
    const [datos, opciones] = setFormulario.mock.calls[0]
    expect(opciones, 'un `merge:false` reescribe el documento entero').toEqual({ merge: true })
    expect((datos as { versiones: unknown[] }).versiones, 'lo anterior se conserva con su fecha').toHaveLength(1)
    expect(JSON.stringify((datos as { versiones: unknown[] }).versiones)).toContain('warfarina sintética')
  })
})

describe('PI-010 — las lecturas del portal se asientan, como promete el aviso', () => {
  it('leer los documentos deja un asiento con el hecho, no con el contenido', async () => {
    await POST(req({ action: 'documentos', token: clinico() }))
    const asiento = addAudit.mock.calls.map(c => c[0]).find(a => a.evento === 'portal_documentos_leidos')
    expect(asiento, 'el aviso de privacidad promete registro de accesos').toBeTruthy()
    expect(asiento.meta.cuantos).toBe(2)
    // Ni diagnósticos ni medicamentos: PHI nunca en una bitácora.
    expect(JSON.stringify(asiento)).not.toContain('Diagnóstico sintético')
  })

  it('y si la bitácora falla, el paciente sigue recibiendo sus recetas', async () => {
    addAudit.mockImplementation(() => { throw new Error('bitácora caída') })
    const res = await POST(req({ action: 'documentos', token: clinico() }))
    expect(res.status, 'la trazabilidad acompaña al derecho, no lo condiciona').toBe(200)
  })
})
