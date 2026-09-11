/**
 * REG-680 — el acuse estricto conserva fallos y la frontera del consultorio.
 * Los cuatro negativos fallaron en PR491 antes de su reparación. Al integrar
 * REG-676/677 se conserva su contrato: sólo el acuse de salida pide rechazo;
 * el guardado habitual maneja errores. Ejecuta el callback real por AST con
 * Auth/Firestore sintéticos; no acredita recuperación local ni Firebase vivo.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

const pagina = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
function escenario() {
  const identidad = { actual: true }
  const crear = vi.fn(async () => 'nota-nueva')
  const actualizar = vi.fn(async () => undefined)
  const scope = {
    clinicId: 'clinica-x', patientId: 'paciente-a', firmada: false,
    auth: { currentUser: { uid: 'medico-sintetico' } }, uidDelMontaje: 'medico-sintetico',
    descartadaRef: { current: false }, firmadaRef: { current: false },
    errorCargaNota: false, pacienteError: false,
    cadenaGuardadoRef: { current: Promise.resolve() },
    notaIdRef: { current: null as string | null }, vistoEnRef: { current: undefined as string | undefined },
    fallosGuardadoRef: { current: 0 }, setGuardando: vi.fn(), setNotaId: vi.fn(), toast: vi.fn(),
    construirNota: () => ({ metadata: { fechaModificacion: 'marca-sintetica' } }),
    createNota: crear, updateNota: actualizar, claveEncuentro: () => 'encuentro-a',
    sesionVigente: () => identidad.actual,
    console: { error: vi.fn() },
  }
  const fuente = ts.createSourceFile('callback.tsx', pagina.slice(pagina.indexOf('const guardarBorrador =')), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaracion = fuente.statements[0] as ts.VariableStatement
  const llamada = declaracion.declarationList.declarations[0].initializer as ts.CallExpression
  const js = ts.transpileModule(`const guardar = ${llamada.arguments[0].getText(fuente)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  const guardar = new Function(...Object.keys(scope), `${js}; return guardar`)(...Object.values(scope)) as (silencioso?: boolean, confirmarPersistencia?: boolean) => Promise<void>
  return { ...scope, identidad, crear, actualizar, guardar }
}

it.each(['unavailable', 'conflicto-de-version'])('el callback real rechaza %s y mantiene utilizable la cola', async code => {
  const e = escenario()
  const fallo = Object.assign(new Error('Fallo sintético'), { code })
  e.crear.mockRejectedValueOnce(fallo)
  await expect(e.guardar(true, true)).rejects.toBe(fallo)
  await expect(e.cadenaGuardadoRef.current).resolves.toBeUndefined()
  await expect(e.guardar(true, true)).resolves.toBeUndefined()
  expect(e.notaIdRef.current).toBe('nota-nueva')
})

it('revalida la sesión al salir de la cola', async () => {
  const e = escenario()
  let liberar!: () => void
  e.cadenaGuardadoRef.current = new Promise<void>(r => { liberar = r })
  const trabajo = e.guardar(true, true)
  e.identidad.actual = false
  liberar()
  await expect(trabajo).rejects.toMatchObject({ code: 'sesion-cambiada' })
  expect(e.crear).not.toHaveBeenCalled()
  expect(e.actualizar).not.toHaveBeenCalled()
})

it('no recrea la nota bajo otra sesión después de esperar la red', async () => {
  const e = escenario()
  e.notaIdRef.current = 'nota-anterior'
  let rechazar!: (e: unknown) => void
  e.actualizar.mockImplementationOnce(() => new Promise((_, reject) => { rechazar = reject }))
  const trabajo = e.guardar(true, true)
  await Promise.resolve()
  e.identidad.actual = false
  rechazar(Object.assign(new Error('Ausente'), { code: 'nota-inexistente' }))
  await expect(trabajo).rejects.toMatchObject({ code: 'sesion-cambiada' })
  expect(e.crear).not.toHaveBeenCalled()
})

it('una sesión vigente guarda con normalidad', async () => {
  const e = escenario()
  await expect(e.guardar(true, true)).resolves.toBeUndefined()
  expect(e.crear).toHaveBeenCalledTimes(1)
})
