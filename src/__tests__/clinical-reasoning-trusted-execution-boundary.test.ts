import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  executeTrustedReconciliation,
  safetyFindingFromTrustedExecution,
} from '@/lib/clinical-reasoning/trusted-execution'

function sourceFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry)
    const stat = statSync(absolute)
    if (stat.isDirectory()) out.push(...sourceFiles(absolute))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(absolute)
  }
  return out
}

describe('trusted deterministic clinical-engine boundary', () => {
  it('executes the repository-owned reconciliation function and binds its receipt', () => {
    const execution = executeTrustedReconciliation({
      sourceFactIds: ['fact-1'],
      args: ['driving pressure', 20, 14, 'cmH2O'],
    })

    expect(execution.engineId).toBe('uci-reconciliacion')
    expect(execution.entryPoint).toBe('reconciliar')
    expect(execution.sourceFactIds).toEqual(['fact-1'])
    expect(execution.outputDigest).toMatch(/^[a-f0-9]+$/i)
  })

  it('only lets a safety finding cite facts that were present in the trusted execution', () => {
    const execution = executeTrustedReconciliation({
      sourceFactIds: ['fact-1'],
      args: ['driving pressure', 20, 14, 'cmH2O'],
    })

    const finding = safetyFindingFromTrustedExecution({
      id: 'safe-1',
      execution,
      severity: 'P1',
      trigger: 'synthetic deterministic discrepancy',
      sourceFactIds: ['fact-1'],
      requiresClinicianReview: true,
    })
    expect(finding.engineId).toBe('uci-reconciliacion')

    expect(() => safetyFindingFromTrustedExecution({
      id: 'forged-fact',
      execution,
      severity: 'P1',
      trigger: 'synthetic forged source fact',
      sourceFactIds: ['fact-not-executed'],
      requiresClinicianReview: true,
    })).toThrow(/not present in its trusted engine execution/)
  })

  it('prevents production code from calling low-level provenance minting helpers directly', () => {
    const srcRoot = join(process.cwd(), 'src')
    const allowed = new Set([
      'src/lib/clinical-reasoning/index.ts',
      'src/lib/clinical-reasoning/trusted-execution.ts',
    ])
    const privilegedNames = ['executeRegisteredEngine', 'safetyFindingFromRegisteredEngine']

    const offenders = sourceFiles(srcRoot)
      .map((file) => relative(process.cwd(), file).replaceAll('\\', '/'))
      .filter((file) => !file.startsWith('src/__tests__/'))
      .filter((file) => !allowed.has(file))
      .filter((file) => {
        const source = readFileSync(join(process.cwd(), file), 'utf8')
        return privilegedNames.some((name) => source.includes(name))
      })

    expect(offenders).toEqual([])
  })
})
