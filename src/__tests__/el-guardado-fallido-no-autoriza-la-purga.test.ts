/**
 * REG-676/677 — un acuse de salida confirma persistencia, no sólo fin del callback.
 *
 * La revisión de PR #487 reprodujo un rechazo real de createNota: el catch de
 * guardarBorrador lo absorbía y salirSeguro purgaba la única copia local. El
 * golden de REG-675 sustituía ese guardado por un mock que sí rechazaba.
 * Además, una escritura en cola podía construir/recrear la nota bajo otro uid.
 *
 * Aquí se ejecutan los tres callbacks REALES de la pantalla por AST y la salida
 * canónica importada. Se doblan Firestore, Auth, almacenamiento y navegación;
 * la construcción clínica de la nota y la evaluación del audio quedan fuera
 * de este recorrido y también usan dobles. Todo contenido es sintético.
 * El modo habitual sigue manejando sus errores; sólo el acuse exige éxito.
 *
 * No acredita Firebase real, permisos, cambios de clínica con el mismo uid,
 * memoria compartida, recuperación legada ni peticiones ya enviadas al SDK.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { guardarRespaldoLocal, hayAlgoQuePerder, AVISO_SIN_ESPACIO } from '@/lib/expediente/el-borrador-no-se-pierde'
import { ofuscar, desofuscar } from '@/lib/seguridad/ofuscar-local'
import { EVENTO_GUARDAR_TODO, salirSeguro } from '@/lib/salir-seguro'

const borde = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'medico-sintetico-A' } as { uid: string } | null, signOut: vi.fn() },
  limpiarBorradoresLocales: vi.fn(), limpiarAudioLocal: vi.fn(), limpiarCacheFirestore: vi.fn(),
}))
vi.mock('@/lib/firebase', () => ({ auth: borde.auth, limpiarCacheFirestore: borde.limpiarCacheFirestore }))
vi.mock('@/lib/mobile/local-drafts', () => ({ limpiarBorradoresLocales: borde.limpiarBorradoresLocales, limpiarAudioLocal: borde.limpiarAudioLocal }))
vi.mock('@/lib/timezone', () => ({ limpiarZonaConsultorio: vi.fn() }))
vi.mock('@/lib/expediente/audit-log', () => ({ drenarCola: vi.fn() }))
vi.mock('@/lib/tareas-clinicas/abrir', () => ({ drenarPendientesPerdidos: vi.fn() }))

const fuente = ts.createSourceFile('consulta.tsx', readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declaraciones = new Map<string, ts.Expression>()
function recoger(n: ts.Node) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) declaraciones.set(n.name.text, n.initializer)
  ts.forEachChild(n, recoger)
}
recoger(fuente)
function callback(nombre: string, scope: Record<string, unknown>) {
  const inicial = declaraciones.get(nombre)
  const expresion = inicial && ts.isCallExpression(inicial) ? inicial.arguments[0] : inicial
  if (!expresion) throw new Error(`Falta callback real ${nombre}`)
  const js = ts.transpileModule('const real = ' + expresion.getText(fuente), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText
  return new Function(...Object.keys(scope), js + '; return real;')(...Object.values(scope))
}

const fallo = (code: string) => Object.assign(new Error('Fallo sintético de persistencia'), { code })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { href: '' } }))
  borde.auth.currentUser = { uid: 'medico-sintetico-A' }
  borde.auth.signOut.mockImplementation(async () => { borde.auth.currentUser = null })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function escenario(overrides: Record<string, unknown> = {}) {
  const uid = 'medico-sintetico-A', clave = 'nx.consulta.bkp.paciente-sintetico'
  const vivo = { resumen: 'ULTIMA_TECLA_SINTETICA_A', tipo: 'consulta', firmada: false }
  const datos = new Map<string, string>()
  const createNota = vi.fn(async () => 'nota-sintetica')
  const updateNota = vi.fn(async () => {})
  const scope: Record<string, unknown> = {
    auth: borde.auth, sesionVigente: () => true, uidDelMontaje: uid, clinicId: 'clinica-sintetica', patientId: 'paciente-sintetico',
    firmada: false, firmadaRef: { current: false }, descartadaRef: { current: false },
    errorCargaNota: null, pacienteError: null, cadenaGuardadoRef: { current: Promise.resolve() },
    notaIdRef: { current: null }, vistoEnRef: { current: null }, fallosGuardadoRef: { current: 0 },
    construirNota: () => ({ resumenEjecutivo: vivo.resumen, metadata: { fechaModificacion: '2026-09-11T00:00:00Z' } }),
    createNota, updateNota, claveEncuentro: () => 'encuentro-sintetico', setNotaId: vi.fn(), setGuardando: vi.fn(),
    toast: vi.fn(), console: { error: vi.fn() },
    estadoVivoRef: { current: vivo }, respaldoKey: clave, guardarRespaldoLocal,
    hayContenido: hayAlgoQuePerder, ofuscar, borradoresBloqueados: () => false,
    localStorage: { setItem: (k: string, v: string) => datos.set(k, v), getItem: (k: string) => datos.get(k) ?? null },
    avisoRespaldoRef: { current: false }, AVISO_SIN_ESPACIO,
    hayAudioQueNoSePuedePurgar: () => false, audioEstadoRef: { current: 'inactivo' },
    hayAudioGuardadoRef: { current: false }, audioDescartadoRef: { current: false }, ...overrides,
  }
  const guardar = callback('guardarBorrador', scope) as (silencioso?: boolean, confirmarPersistencia?: boolean) => Promise<void>
  const flush = callback('flushRespaldo', scope)
  const escuchar = callback('alGuardarTodo', { ...scope, guardarBorrador: guardar, flushRespaldo: flush }) as EventListener
  borde.limpiarBorradoresLocales.mockImplementation((confirmados: { clave: string; bytes: string }[] = []) => {
    for (const { clave, bytes } of confirmados) if (datos.get(clave) === bytes) datos.delete(clave)
  })
  const salir = async () => {
    window.addEventListener(EVENTO_GUARDAR_TODO, escuchar)
    try { await salirSeguro() } finally { window.removeEventListener(EVENTO_GUARDAR_TODO, escuchar) }
  }
  return { uid, clave, vivo, datos, createNota, updateNota, guardar, salir, scope }
}

describe('REG-676 — la salida recibe el resultado real del guardado', () => {
  it.each(['creacion-sin-red', 'actualizacion-sin-permiso', 'conflicto-de-version'])('conserva la última tecla si falla %s', async caso => {
    const e = escenario(caso === 'creacion-sin-red' ? {} : { notaIdRef: { current: 'nota-sintetica' } })
    if (caso === 'creacion-sin-red') e.createNota.mockRejectedValue(fallo('unavailable'))
    else e.updateNota.mockRejectedValue(fallo(caso === 'conflicto-de-version' ? caso : 'permission-denied'))
    await e.salir()
    expect(borde.auth.signOut).toHaveBeenCalledOnce()
    expect(borde.limpiarBorradoresLocales).not.toHaveBeenCalled()
    expect(borde.limpiarCacheFirestore).not.toHaveBeenCalled()
    expect(JSON.parse(desofuscar(e.datos.get(e.clave)!, e.uid)!)).toMatchObject({ resumen: e.vivo.resumen })
    expect(window.location.href).toBe('/login?pendiente=guardado_fallido')
  })

  it.each(['clinicId', 'errorCargaNota', 'pacienteError'])('tampoco autoriza purgar cuando %s impide guardar', async campo => {
    const e = escenario({ [campo]: campo === 'clinicId' ? null : true })
    await e.salir()
    expect(e.createNota).not.toHaveBeenCalled()
    expect(borde.limpiarBorradoresLocales).not.toHaveBeenCalled()
    expect(e.datos.has(e.clave)).toBe(true)
    expect(window.location.href).toBe('/login?pendiente=guardado_fallido')
  })

  it('cuando el servidor confirma, la salida sí purga y termina sin aviso de fallo', async () => {
    const e = escenario()
    await e.salir()
    expect(e.createNota).toHaveBeenCalledOnce()
    expect(borde.limpiarBorradoresLocales).toHaveBeenCalledOnce()
    expect(borde.limpiarBorradoresLocales).toHaveBeenCalledWith([{ clave: e.clave, bytes: expect.any(String) }])
    expect(borde.limpiarCacheFirestore).toHaveBeenCalledOnce()
    expect(e.datos.size).toBe(0)
    expect(window.location.href).toBe('/login')
  })

  it('un SecurityError de localStorage no impide guardar ni inventa confirmación local', async () => {
    const e = escenario({ localStorage: { setItem: () => {}, getItem: () => { throw new DOMException('Sintético', 'SecurityError') } } })
    await e.salir()
    expect(e.createNota).toHaveBeenCalledOnce()
    expect(borde.limpiarBorradoresLocales).toHaveBeenCalledWith([])
  })

  it.each(['unavailable', 'conflicto-de-version'])('el guardado habitual sigue manejando %s sin rechazo no atendido', async codigo => {
    const e = escenario({ notaIdRef: { current: 'nota-sintetica' } })
    e.updateNota.mockRejectedValue(fallo(codigo))
    await expect(e.guardar(true)).resolves.toBeUndefined()
    expect(e.updateNota).toHaveBeenCalledOnce()
  })

  it('un fallo estricto no envenena la cola del siguiente intento', async () => {
    const e = escenario()
    e.createNota.mockRejectedValueOnce(fallo('unavailable'))
    await expect(e.guardar(true, true)).rejects.toMatchObject({ code: 'unavailable' })
    await expect(e.guardar(true, true)).resolves.toBeUndefined()
    expect(e.createNota).toHaveBeenCalledTimes(2)
  })

  it.each(['firmada', 'descartada'])('conserva la salida intencional de una consulta %s', async estado => {
    const e = escenario(estado === 'firmada' ? { firmada: true } : { descartadaRef: { current: true } })
    await expect(e.guardar(true, true)).resolves.toBeUndefined()
    expect(e.createNota).not.toHaveBeenCalled()
  })
})

describe('REG-677 — un guardado no adopta la sesión siguiente', () => {
  for (const nueva of [{ uid: 'medico-sintetico-B' }, null]) {
    const nombre = nueva ? 'B' : 'sin sesión'
    it(`no inicia una escritura de A estando ${nombre}`, async () => {
      const e = escenario()
      borde.auth.currentUser = nueva
      await expect(e.guardar(true, true)).rejects.toThrow(/sesión/)
      expect(e.createNota).not.toHaveBeenCalled()
    })

    it(`no escribe al liberar la cola de A estando ${nombre}`, async () => {
      let liberar!: () => void
      const e = escenario({ cadenaGuardadoRef: { current: new Promise<void>(resolve => { liberar = resolve }) } })
      const p = e.guardar(true, true)
      const resultado = expect(p).rejects.toThrow(/sesión/)
      borde.auth.currentUser = nueva
      liberar()
      await resultado
      expect(e.createNota).not.toHaveBeenCalled()
    })

    it(`no recrea una nota desaparecida después de pasar a ${nombre}`, async () => {
      const e = escenario({ notaIdRef: { current: 'nota-sintetica' } })
      e.updateNota.mockImplementation(async () => { borde.auth.currentUser = nueva; throw fallo('nota-inexistente') })
      await expect(e.guardar(true, true)).rejects.toThrow(/sesión/)
      expect(e.updateNota).toHaveBeenCalledOnce()
      expect(e.createNota).not.toHaveBeenCalled()
    })
  }

  it('renovar el objeto de Auth sin cambiar de uid permite guardar', async () => {
    const e = escenario()
    borde.auth.currentUser = { uid: e.uid }
    await expect(e.guardar(true, true)).resolves.toBeUndefined()
    expect(e.createNota).toHaveBeenCalledOnce()
  })
})
