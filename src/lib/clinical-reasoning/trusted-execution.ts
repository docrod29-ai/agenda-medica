import {
  executeRegisteredEngine,
  safetyFindingFromRegisteredEngine,
  type RegisteredEngineExecution,
  type SafetyFinding,
  type SafetySeverity,
} from '@/lib/clinical-reasoning'
import { reconciliar } from '@/lib/uci/reconciliacion'

/**
 * Production-only deterministic execution boundary.
 *
 * The low-level reasoning core can mint a trusted execution receipt, but it must
 * never receive a function reference from a browser/model/caller and trust its
 * name. Production callers come through this module, where the executable is a
 * hard-wired repository import. That binds provenance to the function that is
 * actually shipped in this codebase.
 */
export function executeTrustedReconciliation(input: {
  sourceFactIds: string[]
  args: Parameters<typeof reconciliar>
}) {
  return executeRegisteredEngine({
    engineId: 'uci-reconciliacion',
    entryPoint: 'reconciliar',
    sourceFactIds: input.sourceFactIds,
    execute: reconciliar,
    args: input.args,
  })
}

/**
 * A safety finding may claim deterministic engine provenance only when it is
 * attached to a trusted execution receipt minted by the production boundary.
 */
export function safetyFindingFromTrustedExecution(input: {
  id: string
  execution: RegisteredEngineExecution
  severity: SafetySeverity
  trigger: string
  sourceFactIds: string[]
  requiresClinicianReview: boolean
}): SafetyFinding {
  for (const factId of input.sourceFactIds) {
    if (!input.execution.sourceFactIds.includes(factId)) {
      throw new Error(`Safety finding ${input.id} uses a fact not present in its trusted engine execution: ${factId}`)
    }
  }
  return safetyFindingFromRegisteredEngine({
    id: input.id,
    engineId: input.execution.engineId,
    severity: input.severity,
    trigger: input.trigger,
    sourceFactIds: input.sourceFactIds,
    requiresClinicianReview: input.requiresClinicianReview,
  })
}
