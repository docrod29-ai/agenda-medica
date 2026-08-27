import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  dictaminarSujeto, vinculoDeSujeto, autorizaGuardar, sujetosLeidos,
  UMBRAL_AMBIGUO, type VinculoSujeto,
} from '@/lib/expediente/laboratorio/sujeto'
import { validarPanel } from '@/lib/expediente/laboratorio/extraccion'
import { LAB_VISION_SYSTEM } from '@/lib/expediente/laboratorio/vision'

/**
 * REG-324 — EL LABORATORIO SE ARCHIVABA EN EL PACIENTE QUE ESTABA ABIERTO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * En Practice, adjuntar un PDF/foto de laboratorio hacía esto:
 *
 *   archivo → visión (prompt que PROHÍBE leer el nombre) → validarPanel (fecha
 *   + valores) → modal «revisa lo que leyó la IA» → guardarPanelLab(clinicId,
 *   patientId, panel)
 *
 * El `patientId` salía de la pantalla abierta. Ni una sola pieza de ese camino
 * miraba de QUIÉN era la hoja — no podía: el prompt ordenaba tirar el nombre
 * antes de que nadie pudiera compararlo. Subir el laboratorio de la señora
 * anterior con la ficha del siguiente paciente abierta lo archivaba bajo el
 * paciente equivocado, con toast verde y sin un solo aviso. Y de ahí salen las
 * gráficas de tendencia y el texto que el médico pega en la nota.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría H-17 (2026-08-26). El módulo hermano de hospital ya tenía la
 * frontera —`verificaSujeto` bloquea un Bundle FHIR de otro paciente desde
 * REG-252— y el camino cotidiano de Practice no tenía nada equivalente.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * Una regla de privacidad aplicada un paso demasiado lejos. «No PERSISTIR
 * identificadores del paciente» se implementó como «no EXTRAERLOS», y eso
 * destruyó la única evidencia con la que se podía verificar el sujeto. La
 * identidad del documento pasó a nacer del CONTEXTO DE PANTALLA en vez de la
 * evidencia — que es exactamente la forma de REG-252 y de REG-160.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `autorizaGuardar` es la frontera: `guardarPanelLab` NO escribe sin un vínculo
 * cuyo `clinicId`/`patientId` sean los del destino real y cuyo veredicto sea
 * `coincide`, o `sin-identificar` confirmado explícitamente por el médico. El
 * nombre leído se usa para comparar y se descarta: nunca se persiste.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No prueba que la IA lea bien el nombre — eso es del proveedor de visión. Lo
 *   que se prueba es qué hace el sistema con lo que lea, incluido no leer nada.
 * · No cubre el camino FHIR de hospital (`verificaSujeto`, REG-252) ni la
 *   fotografía clínica ni la importación de Evidence.
 * · No cubre las reglas de Firestore: aquí se prueba la frontera de código. El
 *   candado de `firestore.rules` es una segunda capa, no la que se mide aquí.
 * · Los nombres de este archivo son SINTÉTICOS (regla de datos: cero pacientes
 *   reales, ni en fixtures).
 */

const CLINICA = 'clinica-sintetica-1'
const OTRA_CLINICA = 'clinica-sintetica-2'
const PACIENTE_A = { clinicId: CLINICA, patientId: 'pac-A', nombre: 'María Fernanda López García' }
const PACIENTE_B = { clinicId: CLINICA, patientId: 'pac-B', nombre: 'Jorge Alberto Ramírez Soto' }

const ahora = '2026-08-26T10:00:00.000Z'

describe('REG-324 · el prompt de visión SÍ pide el sujeto (sin él no hay nada que verificar)', () => {
  it('pide los nombres de paciente y declara que no se guardan', () => {
    expect(LAB_VISION_SYSTEM).toMatch(/pacientes/i)
    // Al revés del defecto: el prompt ya NO puede ordenar ignorar el nombre.
    expect(LAB_VISION_SYSTEM).not.toMatch(/NO transcribas el nombre del paciente/i)
  })
})

describe('REG-324 · dictamen del sujeto', () => {
  it('paciente correcto y verificable → coincide y se puede guardar', () => {
    const d = dictaminarSujeto([{ nombre: 'María Fernanda López García' }], PACIENTE_A)
    expect(d.veredicto).toBe('coincide')
    expect(d.puedeGuardar).toBe(true)
    expect(d.requiereConfirmacion).toBe(false)
  })

  it('el mismo nombre en otro orden y con dedazo sigue siendo el mismo paciente', () => {
    const d = dictaminarSujeto([{ nombre: 'LOPEZ GARCIA MARIA FERNANDA' }], PACIENTE_A)
    expect(d.veredicto).toBe('coincide')
  })

  it('sujeto CONFLICTIVO (otra persona) → no-coincide y NO se puede guardar', () => {
    const d = dictaminarSujeto([{ nombre: 'Jorge Alberto Ramírez Soto' }], PACIENTE_A)
    expect(d.veredicto).toBe('no-coincide')
    expect(d.puedeGuardar).toBe(false)
    expect(d.requiereConfirmacion).toBe(false)
  })

  it('sujeto AMBIGUO (parecido parcial, p. ej. un familiar) → ambiguo y NO se puede guardar', () => {
    const d = dictaminarSujeto([{ nombre: 'José Antonio López García' }], PACIENTE_A)
    expect(d.veredicto).toBe('ambiguo')
    expect(d.puedeGuardar).toBe(false)
    expect(d.requiereConfirmacion).toBe(false)
  })

  it('DOS pacientes en la misma hoja → ambiguo aunque uno sea el abierto', () => {
    const d = dictaminarSujeto(
      [{ nombre: 'María Fernanda López García' }, { nombre: 'Jorge Alberto Ramírez Soto' }],
      PACIENTE_A,
    )
    expect(d.veredicto).toBe('ambiguo')
    expect(d.puedeGuardar).toBe(false)
  })

  it('sin sujeto legible → sin-identificar: NO se guarda solo, se pregunta', () => {
    const d = dictaminarSujeto([], PACIENTE_A)
    expect(d.veredicto).toBe('sin-identificar')
    expect(d.puedeGuardar).toBe(false)
    expect(d.requiereConfirmacion).toBe(true)
  })

  it('el umbral de ambigüedad separa de verdad los dos casos', () => {
    expect(UMBRAL_AMBIGUO).toBeGreaterThan(0)
    expect(UMBRAL_AMBIGUO).toBeLessThan(1)
  })
})

describe('REG-324 · el vínculo sólo nace cuando puede nacer', () => {
  it('no-coincide y ambiguo NO producen vínculo ni con confirmación del médico', () => {
    expect(vinculoDeSujeto(dictaminarSujeto([{ nombre: 'Jorge Alberto Ramírez Soto' }], PACIENTE_A), PACIENTE_A, true, ahora)).toBeNull()
    expect(vinculoDeSujeto(dictaminarSujeto([{ nombre: 'José Antonio López García' }], PACIENTE_A), PACIENTE_A, true, ahora)).toBeNull()
  })

  it('sin-identificar SIN confirmación no produce vínculo; CON confirmación sí', () => {
    const d = dictaminarSujeto([], PACIENTE_A)
    expect(vinculoDeSujeto(d, PACIENTE_A, false, ahora)).toBeNull()
    const v = vinculoDeSujeto(d, PACIENTE_A, true, ahora)
    expect(v).not.toBeNull()
    expect(v!.confirmadoPorMedico).toBe(true)
    expect(v!.patientId).toBe('pac-A')
  })

  it('el vínculo NO lleva el nombre leído: se compara y se tira', () => {
    const v = vinculoDeSujeto(dictaminarSujeto([{ nombre: 'María Fernanda López García' }], PACIENTE_A), PACIENTE_A, false, ahora)!
    expect(JSON.stringify(v)).not.toMatch(/María|Maria|López|Lopez/i)
  })
})

describe('REG-324 · autorizaGuardar es la frontera antes de persistir', () => {
  const vinculoA = vinculoDeSujeto(dictaminarSujeto([{ nombre: 'María Fernanda López García' }], PACIENTE_A), PACIENTE_A, false, ahora)!

  it('deja pasar el guardado del paciente verificado', () => {
    expect(autorizaGuardar(vinculoA, PACIENTE_A).ok).toBe(true)
  })

  it('CROSS-PATIENT: un vínculo de A no autoriza escribir en B', () => {
    const r = autorizaGuardar(vinculoA, PACIENTE_B)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/paciente/i)
  })

  it('CAMBIO DE PACIENTE DURANTE LA REVISIÓN: el vínculo caduca, no se re-apunta', () => {
    // El médico abre A, la IA lee la hoja de A, y antes de dar Guardar cambia a B.
    // El vínculo sigue diciendo A: escribir en B queda prohibido, no redirigido.
    const r = autorizaGuardar(vinculoA, { ...PACIENTE_B })
    expect(r.ok).toBe(false)
    expect(autorizaGuardar(vinculoA, PACIENTE_A).ok).toBe(true)
  })

  it('TENANT: el mismo patientId en otro consultorio no cruza', () => {
    const r = autorizaGuardar(vinculoA, { ...PACIENTE_A, clinicId: OTRA_CLINICA })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/consultorio/i)
  })

  it('SIN vínculo no se escribe nada (el defecto original: bastaba con la pantalla abierta)', () => {
    expect(autorizaGuardar(undefined, PACIENTE_A).ok).toBe(false)
    expect(autorizaGuardar(null as unknown as VinculoSujeto, PACIENTE_A).ok).toBe(false)
  })

  it('un vínculo manipulado con veredicto no autorizado no pasa', () => {
    const falso: VinculoSujeto = { ...vinculoA, veredicto: 'no-coincide' }
    expect(autorizaGuardar(falso, PACIENTE_A).ok).toBe(false)
    const falso2: VinculoSujeto = { ...vinculoA, veredicto: 'sin-identificar', confirmadoPorMedico: false }
    expect(autorizaGuardar(falso2, PACIENTE_A).ok).toBe(false)
  })
})

describe('REG-324 · el sujeto viaja desde la visión hasta el dictamen', () => {
  it('validarPanel conserva los nombres leídos para poder verificarlos', () => {
    const panel = validarPanel({
      fecha: '2026-08-20',
      pacientes: ['  María Fernanda López García  ', ''],
      filas: [{ estudio: 'Glucosa', valor: '92', unidad: 'mg/dL' }],
    })
    expect(panel.sujetos).toEqual([{ nombre: 'María Fernanda López García' }])
    expect(panel.resultados).toHaveLength(1)
  })

  it('sanea lo que devuelva la IA sin romperse (basura, repetidos, exceso)', () => {
    expect(sujetosLeidos(undefined)).toEqual([])
    expect(sujetosLeidos(['Ana Sintética', 'Ana Sintética'])).toEqual([{ nombre: 'Ana Sintética' }])
    expect(sujetosLeidos([1, null, {}, 'x'] as unknown[]).length).toBe(0)
    expect(sujetosLeidos(Array.from({ length: 40 }, (_, i) => `Sintético ${i} Apellido`)).length).toBeLessThanOrEqual(8)
  })

  it('un panel sin nombres legibles llega como sin-identificar, no como aprobado', () => {
    const panel = validarPanel({ fecha: '2026-08-20', filas: [{ estudio: 'Glucosa', valor: '92', unidad: 'mg/dL' }] })
    expect(panel.sujetos).toEqual([])
    expect(dictaminarSujeto(panel.sujetos, PACIENTE_A).veredicto).toBe('sin-identificar')
  })
})

/**
 * ALCANCE REAL — «escrito y sin conectar» es el defecto hermano.
 *
 * Un módulo perfecto que nadie llama no defiende nada. Estas aserciones leen el
 * FUENTE del camino cotidiano (visión → ruta → revisión → escritura) y fijan que
 * cada eslabón siga enganchado. Es lo que un refactor rompe sin darse cuenta.
 */
describe('REG-324 · el arreglo está CONECTADO al camino real', () => {
  const leer = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')
  const PANEL_UI = leer('src/components/laboratorio/PanelLaboratorios.tsx')
  const RUTA = leer('src/app/api/expediente/laboratorio-vision/route.ts')
  const ESCRITOR = leer('src/lib/expediente/laboratorio/firestore.ts')

  it('la ruta de visión pasa los nombres leídos a validarPanel', () => {
    expect(RUTA).toMatch(/pacientes:\s*parsed\.pacientes/)
  })

  it('la pantalla dictamina el sujeto ANTES de abrir la revisión', () => {
    expect(PANEL_UI).toMatch(/dictaminarSujeto\(/)
    expect(PANEL_UI.indexOf('dictaminarSujeto(')).toBeLessThan(PANEL_UI.indexOf('setRevision({ ...panel'))
  })

  it('la pantalla compara contra el nombre del EXPEDIENTE, no contra un parámetro', () => {
    expect(PANEL_UI).toMatch(/getPatient\(clinicId, patientId\)/)
  })

  it('la pantalla acuña un vínculo y se lo pasa al escritor', () => {
    expect(PANEL_UI).toMatch(/vinculoDeSujeto\(/)
    expect(PANEL_UI).toMatch(/guardarPanelLab\([\s\S]*?vinculo, revision\.clave\)/)
  })

  it('la revisión sólo existe mientras el paciente verificado siga abierto', () => {
    // Derivado en el render, no limpiado en un efecto: un efecto deja un
    // instante —aunque sea un frame— en que la pantalla ofrece «Guardar» sobre
    // un expediente que nadie verificó.
    expect(PANEL_UI).toMatch(/revisionCruda\.destino\.clinicId === clinicId/)
    expect(PANEL_UI).toMatch(/revisionCruda\.destino\.patientId === patientId/)
  })

  it('el nombre contra el que se compara viaja atado a su paciente', () => {
    // Un nombre del paciente anterior sobreviviendo un render es una
    // verificación hecha contra la persona equivocada.
    expect(PANEL_UI).toMatch(/pacienteRef\.clinicId === clinicId && pacienteRef\.patientId === patientId/)
  })

  it('el escritor NO tiene camino sin vínculo', () => {
    expect(ESCRITOR).toMatch(/autorizaGuardar\(vinculo/)
    expect(ESCRITOR).toMatch(/throw new ErrorSujetoNoVinculado/)
    // addDoc acuña identidad en la escritura: un reintento duplicaba el estudio.
    expect(ESCRITOR).not.toMatch(/addDoc/)
    expect(ESCRITOR).toMatch(/idIdempotente\(clinicId, 'laboratorio'/)
  })

  it('el panel guardado declara a quién pertenece, no sólo dónde vive', () => {
    expect(ESCRITOR).toMatch(/pacienteId: patientId/)
  })
})
