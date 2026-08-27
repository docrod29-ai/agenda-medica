import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * REG-324 — LA ESCRITURA, CONTADA. Hermano de `laboratorio-sujeto-vinculado`.
 *
 * ── POR QUÉ HACEN FALTA LOS DOS ──────────────────────────────────────────────
 *
 * El hermano prueba el DICTAMEN: qué veredicto sale de cada evidencia. Lo que no
 * puede decir es qué acabó escrito. Éste ejecuta `guardarPanelLab` contra una
 * tienda en memoria con la semántica del SDK de cliente y CUENTA documentos, que
 * es la única forma de comprobar que el dato llegó donde debía y sólo una vez
 * («el dato tiene que LLEGAR»: una prueba de contrato no prueba la escritura).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `guardarPanelLab(clinicId, patientId, panel)` obedecía el `patientId` que le
 * dieran —el de la pantalla abierta— y hacía `addDoc`. Dos cosas malas a la vez:
 * archivaba bajo cualquier paciente sin preguntar de quién era la hoja, y cada
 * reintento fabricaba un panel nuevo (`addDoc` acuña identidad en la ESCRITURA,
 * no en la INTENCIÓN — la causa raíz que ya cerró `idempotencia.ts`).
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Sin vínculo válido para ESE paciente y ESE consultorio, no se escribe: se
 * lanza. Y la misma intención, repetida, aterriza en el MISMO documento.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No prueba `firestore.rules` (eso va contra el emulador). La regla que exige
 *   `pacienteId == {patientId}` es una SEGUNDA capa; la que se mide aquí es la
 *   del escritor.
 * · No cubre concurrencia real: dos pestañas escribiendo a la vez el mismo id
 *   las resuelve Firestore, no este harness.
 * · Datos SINTÉTICOS: cero pacientes reales.
 */

const almacen = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>() }))

/** Mock mínimo del SDK de cliente: sólo la semántica que usa este módulo. */
vi.mock('firebase/firestore', () => {
  const ruta = (partes: unknown[]) => partes.filter(p => typeof p === 'string').join('/')
  return {
    collection: (_db: unknown, ...partes: string[]) => ({ __ruta: ruta(partes) }),
    doc: (padre: { __ruta: string }, id: string) => ({ __ruta: `${padre.__ruta}/${id}`, id }),
    getDoc: async (ref: { __ruta: string }) => ({
      exists: () => almacen.docs.has(ref.__ruta),
      data: () => almacen.docs.get(ref.__ruta),
    }),
    setDoc: async (ref: { __ruta: string }, data: Record<string, unknown>) => { almacen.docs.set(ref.__ruta, data) },
    getDocs: async () => ({ docs: [] }),
    deleteDoc: async () => {},
    query: (c: unknown) => c,
    orderBy: () => ({}),
  }
})

vi.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'medico-sintetico' } } }))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))

const { guardarPanelLab, ErrorSujetoNoVinculado } = await import('@/lib/expediente/laboratorio/firestore')
const { dictaminarSujeto, vinculoDeSujeto } = await import('@/lib/expediente/laboratorio/sujeto')

const CLINICA = 'clinica-sintetica-1'
const OTRA_CLINICA = 'clinica-sintetica-2'
const A = { clinicId: CLINICA, patientId: 'pac-A', nombre: 'María Fernanda López García' }
const B = { clinicId: CLINICA, patientId: 'pac-B', nombre: 'Jorge Alberto Ramírez Soto' }
const AHORA = '2026-08-26T10:00:00.000Z'

const PANEL = {
  fecha: '2026-08-20',
  resultados: [{ clave: 'glucosa', etiqueta: 'Glucosa', valor: 92, unidad: 'mg/dL', critico: false, graficable: true }],
  fuente: 'pdf' as const,
}

const vinculoDe = (destino: typeof A, nombreEnLaHoja?: string, confirmado = false) =>
  vinculoDeSujeto(
    dictaminarSujeto(nombreEnLaHoja ? [{ nombre: nombreEnLaHoja }] : [], destino),
    destino, confirmado, AHORA,
  )

const rutasDe = (clinicId: string, patientId: string) =>
  [...almacen.docs.keys()].filter(k => k.startsWith(`clinics/${clinicId}/patients/${patientId}/laboratorios/`))

beforeEach(() => { almacen.docs.clear() })

describe('REG-324 · sin vínculo no se escribe', () => {
  it('el defecto original: bastaba con pasar un patientId', async () => {
    await expect(guardarPanelLab(CLINICA, 'pac-A', PANEL, null, 'k1')).rejects.toBeInstanceOf(ErrorSujetoNoVinculado)
    expect(almacen.docs.size).toBe(0)
  })

  it('sin-identificar SIN confirmar tampoco escribe', async () => {
    const v = vinculoDe(A, undefined, false)
    await expect(guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'k1')).rejects.toBeInstanceOf(ErrorSujetoNoVinculado)
    expect(almacen.docs.size).toBe(0)
  })
})

describe('REG-324 · el paciente verificado sí se guarda', () => {
  it('escribe UN panel bajo el paciente correcto, con el vínculo dentro', async () => {
    const v = vinculoDe(A, 'LOPEZ GARCIA MARIA FERNANDA')
    const id = await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'k1')
    const rutas = rutasDe(CLINICA, 'pac-A')
    expect(rutas).toHaveLength(1)
    expect(rutas[0].endsWith(id)).toBe(true)
    const guardado = almacen.docs.get(rutas[0])!
    expect(guardado.pacienteId).toBe('pac-A')
    expect(guardado.clinicId).toBe(CLINICA)
    expect((guardado.sujeto as { veredicto: string }).veredicto).toBe('coincide')
  })

  it('sin-identificar CONFIRMADO se guarda y deja constancia de que lo confirmó una persona', async () => {
    const v = vinculoDe(A, undefined, true)
    await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'k1')
    const guardado = almacen.docs.get(rutasDe(CLINICA, 'pac-A')[0])!
    expect(guardado.sujeto).toMatchObject({ veredicto: 'sin-identificar', confirmadoPorMedico: true })
  })

  it('el nombre leído de la hoja NO acaba en el expediente', async () => {
    const v = vinculoDe(A, 'LOPEZ GARCIA MARIA FERNANDA')
    await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'k1')
    expect(JSON.stringify([...almacen.docs.values()])).not.toMatch(/LOPEZ|López|Maria|María/)
  })
})

describe('REG-324 · CROSS-PATIENT: la evidencia de A no entra en B', () => {
  it('un vínculo de A no escribe en el expediente de B', async () => {
    const v = vinculoDe(A, 'María Fernanda López García')
    await expect(guardarPanelLab(CLINICA, 'pac-B', PANEL, v, 'k1')).rejects.toBeInstanceOf(ErrorSujetoNoVinculado)
    expect(rutasDe(CLINICA, 'pac-B')).toEqual([])
  })

  it('la hoja de B abierta en el expediente de A no llega a producir vínculo', async () => {
    // Éste es el caso del auditor: paciente A abierto, hoja de otra persona.
    expect(vinculoDe(A, B.nombre)).toBeNull()
  })

  it('CAMBIO DE PACIENTE durante la revisión: no se archiva en el nuevo', async () => {
    const v = vinculoDe(A, 'María Fernanda López García')
    // El médico cambia de expediente con el modal abierto y da Guardar.
    await expect(guardarPanelLab(CLINICA, 'pac-B', PANEL, v, 'k1')).rejects.toBeInstanceOf(ErrorSujetoNoVinculado)
    // Y el vínculo tampoco se «gasta»: sigue valiendo para A, que es de quien es.
    await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'k1')
    expect(rutasDe(CLINICA, 'pac-A')).toHaveLength(1)
    expect(rutasDe(CLINICA, 'pac-B')).toEqual([])
  })
})

describe('REG-324 · TENANT: no se cruza entre consultorios', () => {
  it('un vínculo del consultorio 1 no escribe en el consultorio 2', async () => {
    const v = vinculoDe(A, 'María Fernanda López García')
    await expect(guardarPanelLab(OTRA_CLINICA, 'pac-A', PANEL, v, 'k1')).rejects.toBeInstanceOf(ErrorSujetoNoVinculado)
    expect(rutasDe(OTRA_CLINICA, 'pac-A')).toEqual([])
  })

  it('la misma clave de intención en dos consultorios da DOS ids distintos', async () => {
    await guardarPanelLab(CLINICA, 'pac-A', PANEL, vinculoDe(A, A.nombre), 'k1')
    const enOtra = { ...A, clinicId: OTRA_CLINICA }
    await guardarPanelLab(OTRA_CLINICA, 'pac-A', PANEL, vinculoDe(enOtra, A.nombre), 'k1')
    const id1 = rutasDe(CLINICA, 'pac-A')[0].split('/').pop()
    const id2 = rutasDe(OTRA_CLINICA, 'pac-A')[0].split('/').pop()
    expect(id1).not.toBe(id2)
  })
})

describe('REG-324 · REINTENTO: la misma intención no duplica el estudio', () => {
  it('tres envíos de la misma revisión dejan UN panel', async () => {
    const v = vinculoDe(A, 'María Fernanda López García')
    const ids = [
      await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'intento-1'),
      await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'intento-1'),
      await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'intento-1'),
    ]
    expect(new Set(ids).size).toBe(1)
    expect(rutasDe(CLINICA, 'pac-A')).toHaveLength(1)
  })

  it('dos estudios distintos (dos intenciones) sí son dos paneles', async () => {
    const v = vinculoDe(A, 'María Fernanda López García')
    await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'intento-1')
    await guardarPanelLab(CLINICA, 'pac-A', { ...PANEL, fecha: '2026-08-25' }, v, 'intento-2')
    expect(rutasDe(CLINICA, 'pac-A')).toHaveLength(2)
  })

  it('un reintento NO reescribe lo ya guardado (las reglas prohíben update)', async () => {
    const v = vinculoDe(A, 'María Fernanda López García')
    await guardarPanelLab(CLINICA, 'pac-A', PANEL, v, 'intento-1')
    const antes = JSON.stringify(almacen.docs.get(rutasDe(CLINICA, 'pac-A')[0]))
    await guardarPanelLab(CLINICA, 'pac-A', { ...PANEL, fecha: '1999-01-01' }, v, 'intento-1')
    expect(JSON.stringify(almacen.docs.get(rutasDe(CLINICA, 'pac-A')[0]))).toBe(antes)
  })
})
