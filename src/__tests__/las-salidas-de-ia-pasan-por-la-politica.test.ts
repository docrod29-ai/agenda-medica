/**
 * GOLDEN — modo privado, orden del dueño del 12-sep-2026.
 * Causa: un gateway protegido no controla las llamadas directas preexistentes.
 * Escanea AST (no comentarios) para exigir el transporte en llamadas conocidas.
 * Complementa pruebas conductuales; no equivale a un firewall ni detecta por sí
 * solo cualquier proveedor nuevo cuyo dominio no esté aquí.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.name === '__tests__' ? []
    : e.isDirectory() ? archivos(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [])
}

describe('inventario de inferencia y recuperación externas', () => {
  it('los destinos conocidos no usan fetch global ni un SDK paralelo', () => {
    const fallos: string[] = []
    let revisados = 0
    for (const path of archivos(join(process.cwd(), 'src'))) {
      const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
      const alias = new Set<string>()
      let proveedor = false
      const llamadas: string[] = []
      function visitar(n: ts.Node) {
        if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
          if (['openai', '@anthropic-ai/sdk', 'assemblyai'].includes(n.moduleSpecifier.text)) fallos.push(`${path}: SDK sin política`)
          if (n.moduleSpecifier.text === '@/lib/ia/salida-privada') {
            const bindings = n.importClause?.namedBindings
            if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach(e => alias.add(e.name.text))
          }
        }
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
          && /^https?:\/\/(api\.(anthropic\.com|openai\.com|assemblyai\.com|fda\.gov)|eutils\.ncbi\.nlm\.nih\.gov)(\/|$)/.test(n.text)) proveedor = true
        if (ts.isCallExpression(n)) {
          if (ts.isIdentifier(n.expression) && ['fetch', 'fetchConTimeout'].includes(n.expression.text)) llamadas.push(n.expression.text)
          if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'fetch') llamadas.push('global.fetch')
        }
        ts.forEachChild(n, visitar)
      }
      visitar(ast)
      if (proveedor && llamadas.length) {
        revisados++
        llamadas.forEach(nombre => { if (!alias.has(nombre)) fallos.push(`${path}: ${nombre}`) })
      }
    }
    expect(revisados).toBeGreaterThanOrEqual(15)
    expect(fallos).toEqual([])
  })
})
