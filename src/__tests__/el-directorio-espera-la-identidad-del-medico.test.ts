/**
 * REG-691 — un directorio vacío por el orden de la sesión.
 * Al investigar un fallo Safari del CI de inferencia propia se reprodujo una
 * carrera preexistente: role llegaba antes que user. load leía la lista y la
 * filtraba con uid ausente; al responder tarde borraba la carga válida.
 * Se ejecuta el load REAL extraído por AST y la política de alcance real.
 * Los dobles sólo representan contexto, transporte y setters, con datos inventados.
 * La carga espera identidad completa. No se debilita el filtro para mostrar filas.
 * No atribuye el trace de Safari a esta carrera ni valida el ciclo completo de React,
 * la red real o cambios de consultorio durante una carga ya autenticada.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { puedeVerExpediente } from '@/lib/authz/alcance-del-paciente'

const pagina = readFileSync('src/app/(dashboard)/pacientes/page.tsx', 'utf8')
const fuente = ts.createSourceFile('pacientes.tsx', pagina, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let expresion: ts.ArrowFunction | undefined
function visitar(nodo: ts.Node) {
  if (ts.isVariableDeclaration(nodo) && nodo.name.getText(fuente) === 'load'
    && nodo.initializer && ts.isArrowFunction(nodo.initializer)) expresion = nodo.initializer
  ts.forEachChild(nodo, visitar)
}
visitar(fuente)
if (!expresion) throw new Error('No se encontró el load canónico del directorio')
const codigo = ts.transpileModule('const cargar = ' + expresion.getText(fuente), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText

type Ficha = { id: string; medicoTitularUid?: string; compartidoCon?: string[] }
const propio: Ficha = { id: 'paciente-sintetico-propio', medicoTitularUid: 'medico-sintetico' }
const compartido: Ficha = { id: 'paciente-sintetico-compartido', medicoTitularUid: 'otro-sintetico', compartidoCon: ['medico-sintetico'] }
const ajeno: Ficha = { id: 'paciente-sintetico-ajeno', medicoTitularUid: 'otro-sintetico' }
const lista = { pacientes: [propio, compartido, ajeno], truncada: false }

function preparar(cambios: Record<string, unknown> = {}) {
  const scope = {
    clinicId: 'clinica-sintetica', role: 'medico', user: { uid: 'medico-sintetico' },
    listarPacientesCompat: vi.fn(async () => lista), puedeVerExpediente,
    setPatients: vi.fn(), setListaTruncada: vi.fn(), setInternados: vi.fn(),
    setLoading: vi.fn(), setErrorCarga: vi.fn(), getCenso: vi.fn(async () => []),
    console: { error: vi.fn() }, ...cambios,
  }
  const load = new Function(...Object.keys(scope), codigo + '; return cargar;')(...Object.values(scope)) as () => Promise<void>
  return { load, scope }
}

describe('el directorio espera al médico antes de leer su alcance', () => {
  it('sin uid, rol o consultorio no lee ni anuncia una lista vacía', async () => {
    for (const contexto of [{ user: null }, { role: null }, { clinicId: null }]) {
      const { load, scope } = preparar(contexto)
      await load()
      expect(scope.listarPacientesCompat).not.toHaveBeenCalled()
      expect(scope.setPatients).not.toHaveBeenCalled()
      expect(scope.setLoading).not.toHaveBeenCalled()
    }
  })
  it('una carga iniciada sin sesión no sobrescribe la lista válida al resolverse tarde', async () => {
    let resolver!: (valor: typeof lista) => void
    const respuestaTardia = new Promise<typeof lista>(r => { resolver = r })
    const setPatients = vi.fn()
    const antigua = preparar({ user: null, setPatients, listarPacientesCompat: vi.fn(() => respuestaTardia) })
    const pendiente = antigua.load()
    await preparar({ setPatients }).load()
    expect(setPatients).toHaveBeenLastCalledWith([propio, compartido])
    resolver(lista)
    await pendiente
    expect(setPatients).toHaveBeenCalledOnce()
    expect(setPatients).toHaveBeenLastCalledWith([propio, compartido])
  })
  it('con identidad resuelta el médico conserva sólo titularidad y acceso compartido', async () => {
    const { load, scope } = preparar()
    await load()
    expect(scope.listarPacientesCompat).toHaveBeenCalledWith('clinica-sintetica')
    expect(scope.setPatients).toHaveBeenCalledWith([propio, compartido])
    expect(scope.setLoading).toHaveBeenLastCalledWith(false)
  })
  it('el directorio administrativo conserva sus filas con una identidad válida', async () => {
    for (const role of ['admin', 'secretaria']) {
      const { load, scope } = preparar({ role })
      await load()
      expect(scope.setPatients).toHaveBeenCalledWith(lista.pacientes)
    }
  })
})
