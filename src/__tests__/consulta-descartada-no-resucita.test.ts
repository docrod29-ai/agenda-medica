/**
 * GOLDEN — una consulta descartada NO puede volver sola.
 *
 * ── DE DÓNDE SALE ESTE GUARDIÁN ──────────────────────────────────────────────
 *
 * Buscando el ORIGEN de REG-155 —cómo llega la pantalla a tener el id de un
 * documento que ya no existe— apareció el camino: `descartar()` borraba el
 * documento y navegaba fuera, pero **no soltaba `notaIdRef`**. El autoguardado se
 * serializa en una cadena, así que puede quedar uno en vuelo, y ese guardado
 * tardío escribía sobre el documento recién borrado.
 *
 * Antes eso volvía como PERMISSION_DENIED — una de las formas en que el Dr. veía
 * «el servidor rechazó el permiso».
 *
 * ── Y EL RIESGO QUE INTRODUJO LA PROPIA REPARACIÓN ───────────────────────────
 *
 * Desde REG-155 la consulta se recupera sola cuando el documento no está. Sobre
 * este camino, ese mismo guardado tardío **volvería a crear la nota que el
 * médico acaba de descartar**, con su confirmación de por medio y el aviso «se
 * eliminará y no podrás recuperarla».
 *
 * Recuperar es correcto cuando el documento se PERDIÓ; es un defecto grave
 * cuando se borró QUERIENDO. Lo único que distingue los dos casos es la marca de
 * descarte, y por eso este golden existe.
 *
 * No es hipotético: el propio código ya avisaba de una versión anterior de esto
 * —«la consulta descartada reaparecía completa […] y se recreaba sola en
 * Firestore al autoguardarse»—.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const consulta = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('LA MARCA DE DESCARTE EXISTE Y ES SÍNCRONA', () => {
  it('es una ref, no un estado', () => {
    /**
     * Un estado vale en el siguiente render. El guardado en vuelo ocurre antes
     * de eso, así que un estado llegaría tarde — exactamente el motivo por el
     * que `firmadaRef` y `notaIdRef` ya son refs en esta pantalla.
     */
    expect(consulta).toContain('const descartadaRef = useRef(false)')
  })

  it('se marca ANTES de borrar el documento', () => {
    // Entre el borrado y la navegación cabe un autoguardado: ése es el que resucita.
    const iMarca = consulta.indexOf('descartadaRef.current = true')
    const iBorra = consulta.indexOf('await deleteNota(clinicId, patientId, idReal)')
    expect(iMarca).toBeGreaterThan(0)
    expect(iMarca).toBeLessThan(iBorra)
  })

  it('y el id se suelta: ya no apunta a nada', () => {
    const i = consulta.indexOf('await deleteNota(clinicId, patientId, idReal)')
    const despues = consulta.slice(i, i + 300)
    expect(despues).toContain('notaIdRef.current = null')
    expect(despues).toContain('setNotaId(null)')
  })
})

describe('NADA ESCRIBE DESPUÉS DE DESCARTAR', () => {
  it('el autoguardado se detiene en la puerta', () => {
    const i = consulta.indexOf('const guardarBorrador = useCallback')
    expect(consulta.slice(i, i + 400)).toContain('if (descartadaRef.current) return Promise.resolve()')
  })

  it('y la recuperación de REG-155 NO recrea lo descartado', () => {
    /**
     * Es la parte que más importa: sin esta línea, la reparación de REG-155
     * convierte un descarte deliberado en una nota que reaparece.
     */
    const i = consulta.indexOf("if ((e as { code?: string })?.code !== 'nota-inexistente') throw e")
    const bloque = consulta.slice(i, i + 300)
    expect(bloque).toContain('if (descartadaRef.current) return')
    // Y la guarda va ANTES de crear, no después.
    expect(bloque.indexOf('if (descartadaRef.current) return'))
      .toBeLessThan(bloque.indexOf('await createNota('))
  })
})

describe('LO QUE SIGUE FUNCIONANDO', () => {
  it('la recuperación sigue viva para el caso legítimo', () => {
    // Documento perdido de verdad: se recrea y no se pierde la consulta.
    expect(consulta).toContain('await createNota(clinicId, patientId, { ...nota, estado: \'borrador\' })')
  })

  it('y descartar sigue limpiando el respaldo local y el audio', () => {
    const i = consulta.indexOf('const descartar = useCallback')
    const cuerpo = consulta.slice(i, consulta.indexOf('// ── Autoguardado cada 30s', i))
    expect(cuerpo).toContain('localStorage.removeItem(respaldoKey)')
    expect(cuerpo).toContain('borradorMem.borrar(respaldoKey)')
    expect(cuerpo).toContain('audio.descartarRecovery(')
  })
})

/** REG-657: ejecutar el callback real con red diferida. No monta el navegador
 * ni demuestra mezcla entre personas: verifica que descartar durante el fetch
 * impide publicar el resumen de ese encuentro. */
describe('una respuesta IA tardía no resucita el encuentro descartado', () => {
  it.each(['descartar', 'firmar'])('no aplica datos tras %s durante la petición', async accion => {
    const ts = await import('typescript')
    const inicio = consulta.indexOf('const procesarIA = useCallback(')
    const fuente = ts.createSourceFile('callback.tsx', consulta.slice(inicio), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const declaracion = fuente.statements[0] as import('typescript').VariableStatement
    const llamada = declaracion.declarationList.declarations[0].initializer as import('typescript').CallExpression
    const funcion = llamada.arguments[0].getText(fuente)
    const js = ts.transpileModule('const callback = ' + funcion, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
    }).outputText
    let resolver!: (value: unknown) => void
    const pendiente = new Promise(resolve => { resolver = resolve })
    const descartadaRef = { current: false }, firmadaRef = { current: false }
    const setResumen = vi.fn(), setTareaProc = vi.fn(), toast = vi.fn()
    const fetchAutenticado = vi.fn(() => pendiente)
    const conocidos: Record<string, unknown> = {
      firmadaRef, descartadaRef,
      voz: { transcripcion: 'Consulta sintética A' }, vivoRef: { current: false },
      tipo: 'seguimiento', baseTranscripcionRef: { current: '' },
      textoParaLaIA: () => 'Consulta sintética A', motorEfectivo: 'maxima',
      patient: {}, ultimasNotasRef: { current: [] }, especialidadEfectiva: '', config: {},
      fetchAutenticado, toast, JSON, Date, Object, Array, String,
      comoSeDegrada: () => ({ mensaje: "Error sintético" }),
      setResumen, setTareaProc, sanitizarProsa: (s: string) => s,
    }
    const scope = new Proxy(conocidos, {
      has: () => true,
      get: (obj, key) => key === Symbol.unscopables ? undefined : obj[String(key)] ?? vi.fn(),
    })
    const ejecutar = new Function('scope', 'with (scope) { ' + js + '; return callback; }')(scope)
    const trabajo = ejecutar()
    if (accion === 'descartar') descartadaRef.current = true
    else firmadaRef.current = true
    resolver({ json: async () => ({ ok: true, resumenEjecutivo: 'MARCADOR_ENCUENTRO_DESCARTADO' }) })
    await trabajo
    expect(fetchAutenticado).toHaveBeenCalledOnce()
    expect(toast).not.toHaveBeenCalled()
    if (accion === 'firmar') expect(setTareaProc).toHaveBeenLastCalledWith({ ejecutando: false })
    expect(setResumen).not.toHaveBeenCalled()
    expect(setTareaProc.mock.calls.some(([v]) => v?.resultado)).toBe(false)
  })
})

/** REG-666: auditoría de la corrección manual de IA. El callback capturaba
 * `firmada` antes de esperar la red y aceptaba respuestas después del cierre.
 * Ejecutamos su cuerpo real con promesas controladas; no acredita aislamiento
 * entre pacientes ni sustituye la prueba de navegador autenticado. */
async function callbackReal(nombre: string, conocidos: Record<string, unknown>) {
  const ts = await import('typescript')
  const fuente = ts.createSourceFile('callback.tsx', consulta.slice(consulta.indexOf(`const ${nombre} =`)), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaracion = fuente.statements[0] as import('typescript').VariableStatement
  const inicializador = declaracion.declarationList.declarations[0].initializer!
  const funcion = ts.isCallExpression(inicializador) ? inicializador.arguments[0] : inicializador
  const js = ts.transpileModule('const callback = ' + funcion.getText(fuente), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  const scope = new Proxy({ JSON, Date, Object, Array, String, Promise, ...conocidos }, {
    has: () => true,
    get: (obj, key) => key === Symbol.unscopables ? undefined : (Reflect.has(obj, key) ? Reflect.get(obj, key) : vi.fn()),
  })
  return new Function('scope', 'with (scope) { ' + js + '; return callback; }')(scope)
}

describe('REG-666: corregir con IA respeta el cierre del encuentro', () => {
  it.each(['abierta', 'firmada', 'descartada'])('respuesta con consulta %s', async estado => {
    let resolver!: (value: unknown) => void
    const pendiente = new Promise(resolve => { resolver = resolve })
    const firmadaRef = { current: false }, descartadaRef = { current: false }
    const setResumen = vi.fn(), setMedicamentos = vi.fn(), setSignos = vi.fn(), setDiagnosticos = vi.fn(), setSecciones = vi.fn()
    const ejecutar = await callbackReal('corregirConIA', {
      instruccionCorr: 'Organizar el texto', corrigiendo: false, firmada: false,
      firmadaRef, descartadaRef, resumen: 'Texto original', secciones: [], medicamentos: [], diagnosticos: [], signos: {}, signosNum: {}, patient: {},
      fetchAutenticado: () => pendiente, sanitizarProsa: (s: string) => s,
      setResumen, setMedicamentos, setSignos, setDiagnosticos, setSecciones,
    })
    const trabajo = ejecutar()
    firmadaRef.current = estado === 'firmada'
    descartadaRef.current = estado === 'descartada'
    resolver({ json: async () => ({ ok: true, resumenEjecutivo: 'Texto corregido', secciones: {}, medicamentos: [], diagnosticos: [], signosVitales: {} }) })
    await trabajo
    for (const setter of [setResumen, setMedicamentos, setSignos, setDiagnosticos, setSecciones]) {
      expect(setter).toHaveBeenCalledTimes(estado === 'abierta' ? 1 : 0)
    }
  })
})

/** REG-667: el guardado ya encolado debe volver a comprobar el descarte
 * cuando le toca escribir. Una creación en vuelo debe terminar antes de
 * decidir qué documento borrar. Se usan documentos y promesas sintéticos. */
describe('REG-667: descartar con autoguardado pendiente', () => {
  it('un guardado en cola no crea la nota después de descartarla', async () => {
    let liberar!: () => void
    const cadenaGuardadoRef = { current: new Promise<void>(resolve => { liberar = resolve }) }
    const descartadaRef = { current: false }, createNota = vi.fn(async () => 'nota-sintetica')
    const guardar = await callbackReal('guardarBorrador', {
      clinicId: 'clinica-sintetica', patientId: 'paciente-sintetico', firmada: false,
      firmadaRef: { current: false }, descartadaRef, errorCargaNota: false, pacienteError: false,
      cadenaGuardadoRef, notaIdRef: { current: null }, vistoEnRef: { current: null }, fallosGuardadoRef: { current: 0 },
      construirNota: () => ({ estado: 'borrador' }), createNota,
    })
    const trabajo = guardar(true)
    descartadaRef.current = true
    liberar()
    await trabajo
    expect(createNota).not.toHaveBeenCalled()
  })

  it('espera una creación en vuelo y borra el id recién obtenido', async () => {
    let liberar!: () => void
    const notaIdRef: { current: string | null } = { current: null }
    const setGuardando = vi.fn()
    const cadenaGuardadoRef = { current: new Promise<void>(resolve => { liberar = () => { notaIdRef.current = 'nota-recien-creada'; setGuardando(false); resolve() } }) }
    let terminarBorrado!: () => void
    const deleteNota = vi.fn(() => new Promise<void>(resolve => { terminarBorrado = resolve })), router = { push: vi.fn() }
    const descartar = await callbackReal('descartar', {
      firmada: false, confirm: async () => true, clinicId: 'clinica-sintetica', patientId: 'paciente-sintetico', notaId: null,
      notaIdRef, cadenaGuardadoRef, descartadaRef: { current: false }, deleteNota, router, setGuardando,
      localStorage: { removeItem: vi.fn() }, borradorMem: { borrar: vi.fn() }, audio: { descartarRecovery: vi.fn() },
    })
    const trabajo = descartar()
    await Promise.resolve()
    expect(router.push).not.toHaveBeenCalled()
    liberar()
    await Promise.resolve()
    expect(deleteNota).toHaveBeenCalledWith('clinica-sintetica', 'paciente-sintetico', 'nota-recien-creada')
    expect(setGuardando).toHaveBeenLastCalledWith(true)
    expect(router.push).not.toHaveBeenCalled()
    terminarBorrado()
    await trabajo
    expect(notaIdRef.current).toBeNull()
    expect(router.push).toHaveBeenCalledOnce()
  })
})
