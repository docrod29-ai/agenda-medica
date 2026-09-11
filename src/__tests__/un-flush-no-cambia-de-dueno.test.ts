/**
 * REG-675 — el respaldo tardío no adopta la cuenta siguiente.
 *
 * Descubierto al revisar PR #487: el callback real guardaba el estado de A
 * usando auth.currentUser de B. El pestillo se puede reabrir al entrar B.
 * Estos casos ejecutan los callbacks de la pantalla extraídos por AST, con
 * usuarios y contenido sintéticos; no copian una implementación reparada.
 *
 * El UID queda vinculado al montaje y se revalida justo antes de escribir.
 * Antes del logout se respalda síncronamente: bloquear el flush tardío sin
 * esto perdería la última tecla si el servidor falla antes del debounce.
 *
 * No prueba transiciones Firebase en navegador, clínica, memoria compartida,
 * recuperación legada ni cifrado fuerte. No borra ni migra respaldos reales.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { guardarRespaldoLocal, hayAlgoQuePerder, AVISO_SIN_ESPACIO } from '@/lib/expediente/el-borrador-no-se-pierde'
import { ofuscar, desofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'

const source = ts.createSourceFile('consulta.tsx', readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declaraciones = new Map<string, ts.Expression>()
const retardos: ts.Expression[] = []
function recoger(n: ts.Node) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) declaraciones.set(n.name.text, n.initializer)
  if (ts.isCallExpression(n) && n.expression.getText(source) === 'setTimeout' && n.arguments[0]?.getText(source).includes('guardarRespaldoLocal(')) retardos.push(n.arguments[0])
  ts.forEachChild(n, recoger)
}
recoger(source)

function callback(nombre: 'flushRespaldo' | 'alGuardarTodo' | 'retardo', scope: Record<string, unknown>): (...args: unknown[]) => void {
  let expresion: ts.Expression | undefined
  if (nombre === 'retardo') {
    expect(retardos).toHaveLength(1)
    expresion = retardos[0]
  } else {
    const inicial = declaraciones.get(nombre)
    expresion = inicial && ts.isCallExpression(inicial) ? inicial.arguments[0] : inicial
  }
  if (!expresion) throw new Error(`No se encontró ${nombre}`)
  const js = ts.transpileModule('const real = ' + expresion.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText
  return new Function(...Object.keys(scope), js + '; return real;')(...Object.values(scope))
}

function escenario() {
  const uid = 'medico-sintetico-A'
  const clave = 'nx.consulta.bkp.paciente-sintetico'
  const auth: { currentUser: { uid: string } | null } = { currentUser: { uid } }
  const vivo = { resumen: 'MARCADOR_SINTETICO_A', tipo: 'consulta', firmada: false }
  const datos = new Map<string, string>()
  const setItem = vi.fn((k: string, v: string) => { datos.set(k, v) })
  const bloqueo = { activo: false }
  const scope: Record<string, unknown> = {
    auth, uidDelMontaje: uid, vivo, respaldoKey: clave,
    estadoVivoRef: { current: vivo }, notaIdRef: { current: null },
    guardarRespaldoLocal, hayContenido: hayAlgoQuePerder, ofuscar, secretoLocal,
    borradoresBloqueados: () => bloqueo.activo, localStorage: { setItem },
    avisoRespaldoRef: { current: false }, toast: vi.fn(), AVISO_SIN_ESPACIO,
  }
  return { uid, clave, auth, datos, setItem, bloqueo, scope, vivo }
}

describe('REG-675 — identidad y conservación del respaldo', () => {
  it('el flush de A no sobrescribe un respaldo ya escrito por B', () => {
    const e = escenario(), ejecutar = callback('flushRespaldo', e.scope)
    const deB = ofuscar(JSON.stringify({ resumen: 'MARCADOR_SINTETICO_B' }), 'medico-sintetico-B')
    e.datos.set(e.clave, deB)
    e.auth.currentUser = { uid: 'medico-sintetico-B' }
    ejecutar()
    expect(e.setItem).not.toHaveBeenCalled()
    expect(e.datos.get(e.clave)).toBe(deB)
  })

  it('el debounce revalida la cuenta al ejecutarse, después de programarse', () => {
    const e = escenario(), ejecutar = callback('retardo', e.scope)
    e.auth.currentUser = { uid: 'medico-sintetico-B' }
    ejecutar()
    expect(e.setItem).not.toHaveBeenCalled()
  })

  it('el flush no usa una identidad recordada cuando ya no hay sesión', () => {
    const e = escenario(), ejecutar = callback('flushRespaldo', e.scope)
    e.auth.currentUser = null
    ejecutar()
    expect(e.setItem).not.toHaveBeenCalled()
  })

  it('el debounce tampoco escribe después del logout', () => {
    const e = escenario(), ejecutar = callback('retardo', e.scope)
    e.auth.currentUser = null
    ejecutar()
    expect(e.setItem).not.toHaveBeenCalled()
  })

  it('el dueño conserva el texto con el flush inmediato', () => {
    const e = escenario()
    callback('flushRespaldo', e.scope)()
    expect(JSON.parse(desofuscar(e.datos.get(e.clave)!, e.uid)!)).toMatchObject({ resumen: e.vivo.resumen, notaId: null })
  })

  it('el dueño conserva el texto con el debounce', () => {
    const e = escenario()
    callback('retardo', e.scope)()
    expect(JSON.parse(desofuscar(e.datos.get(e.clave)!, e.uid)!)).toMatchObject({ resumen: e.vivo.resumen, notaId: null })
  })

  it('una purga confirmada sigue impidiendo ambas escrituras tardías', () => {
    const e = escenario()
    e.bloqueo.activo = true
    callback('flushRespaldo', e.scope)()
    callback('retardo', e.scope)()
    expect(e.setItem).not.toHaveBeenCalled()
  })

  it('al cerrar se conserva la última tecla antes de un fallo rápido del servidor', async () => {
    const e = escenario()
    const flush = callback('flushRespaldo', e.scope)
    const guardarBorrador = vi.fn(() => Promise.reject(new Error('red sintética caída')))
    const esperar = vi.fn((p: Promise<unknown>) => { void p.catch(() => {}) })
    const cerrar = callback('alGuardarTodo', {
      ...e.scope, flushRespaldo: flush, guardarBorrador,
      hayAudioQueNoSePuedePurgar: () => false, audioEstadoRef: { current: 'inactivo' },
      hayAudioGuardadoRef: { current: false }, audioDescartadoRef: { current: false },
    })
    cerrar({ detail: { esperar } })
    // El respaldo debe existir ANTES de resolver red o perder la identidad.
    expect(JSON.parse(desofuscar(e.datos.get(e.clave)!, e.uid)!)).toMatchObject({ resumen: e.vivo.resumen })
    expect(guardarBorrador).toHaveBeenCalledOnce()
    await expect(esperar.mock.calls[0][0]).rejects.toThrow('red sintética caída')
    e.auth.currentUser = null
    flush()
    expect(e.setItem).toHaveBeenCalledOnce()
  })
})
