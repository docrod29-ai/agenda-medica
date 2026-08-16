#!/usr/bin/env node
/**
 * AUSCULTA-AUTONOMOUS-CONTROL-PLANE-001 — ACP-001
 * Executable state contract and validator.
 *
 * This module is the ONLY execution authority for the control plane. It is
 * deliberately dependency-free and fail-closed:
 *
 *   - `control-plane/MASTER_BOARD.schema.json` is the structural authority.
 *     The validator below implements exactly the JSON Schema keyword subset
 *     that schema uses, and THROWS on any keyword it does not implement, so a
 *     future schema constraint can never be silently ignored.
 *   - `control-plane/MASTER_BOARD.json` is the state. Nothing else is.
 *     `agent-state/MASTER_STATE.json` is stale legacy authority (BASELINE.md §5)
 *     and is rejected as an execution source.
 *   - Every guard rejects by default. An unknown status, an unknown keyword, a
 *     missing policy key, an ambiguous next item — all halt the program instead
 *     of guessing.
 *
 * ACP-001 does NOT invoke Claude, Codex, Perplexity, git, CI, deployment, or
 * any network. It only decides what the control plane is allowed to do next.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONTROL_PLANE_DIR = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(CONTROL_PLANE_DIR, '..')
export const BOARD_PATH = join(CONTROL_PLANE_DIR, 'MASTER_BOARD.json')
export const SCHEMA_PATH = join(CONTROL_PLANE_DIR, 'MASTER_BOARD.schema.json')

/** Bumped whenever the machine-readable output contract changes. */
export const OUTPUT_CONTRACT_VERSION = 'control-plane/kernel/1'

/** The one path allowed to act as execution authority. */
export const CANONICAL_BOARD_RELATIVE_PATH = 'control-plane/MASTER_BOARD.json'

// ---------------------------------------------------------------------------
// 1. JSON Schema subset validator (fail-closed)
// ---------------------------------------------------------------------------

/** Keywords that carry no constraint. Safe to ignore. */
const ANNOTATION_KEYWORDS = new Set(['$schema', '$id', 'title', 'description', '$comment', 'examples'])

/** Keywords this validator actually enforces. Anything else throws. */
const SUPPORTED_KEYWORDS = new Set([
  'type',
  'const',
  'enum',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'pattern',
  'minLength',
  'minItems',
  'uniqueItems',
])

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function matchesType(value, type) {
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  return typeOf(value) === type
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b)
}

function schemaError(pointer, keyword, message) {
  return { path: pointer === '' ? '/' : pointer, keyword, message }
}

/**
 * Throws `UNSUPPORTED_SCHEMA_KEYWORD:<kw>` rather than ignoring an unknown
 * constraint. Ignoring one would let an unvalidated board look valid.
 */
function walkSchema(schema, value, pointer, errors) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`UNSUPPORTED_SCHEMA_NODE at ${pointer === '' ? '/' : pointer}`)
  }

  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword) && !ANNOTATION_KEYWORDS.has(keyword)) {
      throw new Error(`UNSUPPORTED_SCHEMA_KEYWORD:${keyword} at ${pointer === '' ? '/' : pointer}`)
    }
  }

  if ('type' in schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(schemaError(pointer, 'type', `expected ${types.join('|')}, got ${typeOf(value)}`))
      return // every remaining keyword would be meaningless on the wrong type
    }
  }

  if ('const' in schema && !deepEqual(value, schema.const)) {
    errors.push(
      schemaError(pointer, 'const', `expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`),
    )
  }

  if ('enum' in schema && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(schemaError(pointer, 'enum', `${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`))
  }

  if (typeof value === 'string') {
    if ('minLength' in schema && value.length < schema.minLength) {
      errors.push(schemaError(pointer, 'minLength', `shorter than ${schema.minLength}`))
    }
    if ('pattern' in schema && !new RegExp(schema.pattern).test(value)) {
      errors.push(schemaError(pointer, 'pattern', `${JSON.stringify(value)} does not match ${schema.pattern}`))
    }
  }

  if (Array.isArray(value)) {
    if ('minItems' in schema && value.length < schema.minItems) {
      errors.push(schemaError(pointer, 'minItems', `fewer than ${schema.minItems} items`))
    }
    if (schema.uniqueItems === true) {
      const seen = new Set()
      for (const element of value) {
        const key = stableStringify(element)
        if (seen.has(key)) errors.push(schemaError(pointer, 'uniqueItems', `duplicate item ${key}`))
        seen.add(key)
      }
    }
    if ('items' in schema) {
      value.forEach((element, index) => walkSchema(schema.items, element, `${pointer}/${index}`, errors))
    }
  }

  if (typeOf(value) === 'object') {
    for (const required of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        errors.push(schemaError(`${pointer}/${required}`, 'required', 'missing required property'))
      }
    }
    const properties = schema.properties ?? {}
    for (const [key, child] of Object.entries(value)) {
      const childPointer = `${pointer}/${key}`
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        walkSchema(properties[key], child, childPointer, errors)
      } else if (schema.additionalProperties === false) {
        errors.push(schemaError(childPointer, 'additionalProperties', 'property is not allowed'))
      } else if (schema.additionalProperties !== undefined && typeOf(schema.additionalProperties) === 'object') {
        walkSchema(schema.additionalProperties, child, childPointer, errors)
      }
    }
  }
}

/** @returns {{ok: boolean, errors: Array<{path: string, keyword: string, message: string}>}} */
export function validateAgainstSchema(schema, value) {
  const errors = []
  walkSchema(schema, value, '', errors)
  return { ok: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// 2. Status model and explicit transition table
// ---------------------------------------------------------------------------

/**
 * The ONLY legal transitions. Anything absent here is rejected. A target that
 * is reachable but not adjacent is reported as SKIPPED_STATE, not merely
 * illegal, because skipping CI or the judge is the failure mode that matters.
 */
export const TRANSITIONS = Object.freeze({
  QUEUED: Object.freeze(['READY', 'BLOCKED']),
  READY: Object.freeze(['RUNNING_WRITER', 'BLOCKED', 'OWNER_APPROVAL_REQUIRED']),
  RUNNING_WRITER: Object.freeze(['WRITER_DONE', 'BLOCKED', 'OWNER_APPROVAL_REQUIRED']),
  WRITER_DONE: Object.freeze(['CI_PENDING', 'BLOCKED']),
  CI_PENDING: Object.freeze(['SHA_FROZEN', 'CI_FAILED', 'BLOCKED']),
  CI_FAILED: Object.freeze(['REPAIR_READY', 'BLOCKED']),
  SHA_FROZEN: Object.freeze(['RUNNING_JUDGE', 'BLOCKED']),
  RUNNING_JUDGE: Object.freeze(['JUDGE_PASS', 'JUDGE_FAIL', 'BLOCKED']),
  JUDGE_PASS: Object.freeze(['CLOSED', 'OWNER_APPROVAL_REQUIRED', 'BLOCKED']),
  JUDGE_FAIL: Object.freeze(['REPAIR_READY', 'BLOCKED']),
  REPAIR_READY: Object.freeze(['RUNNING_WRITER', 'BLOCKED']),
  BLOCKED: Object.freeze(['OWNER_APPROVAL_REQUIRED']),
  OWNER_APPROVAL_REQUIRED: Object.freeze(['READY', 'CLOSED', 'BLOCKED']),
  CLOSED: Object.freeze([]),
})

export const KNOWN_STATUSES = Object.freeze(Object.keys(TRANSITIONS))

/** A writer is actually holding the machine only while it runs. */
export const WRITER_ACTIVE_STATUSES = Object.freeze(['RUNNING_WRITER'])

/** The program is sequential: at most one item may occupy this band. */
export const IN_FLIGHT_STATUSES = Object.freeze([
  'RUNNING_WRITER',
  'WRITER_DONE',
  'CI_PENDING',
  'CI_FAILED',
  'SHA_FROZEN',
  'RUNNING_JUDGE',
  'JUDGE_PASS',
  'JUDGE_FAIL',
  'REPAIR_READY',
])

/** Leaving these requires a human. The kernel never does it on its own. */
export const OWNER_GATED_ORIGINS = Object.freeze(['BLOCKED', 'OWNER_APPROVAL_REQUIRED'])

export const JUDGE_VERDICTS = Object.freeze(['PASS', 'FAIL', 'UNVERIFIABLE'])

/** Only these severities may automatically open a repair loop. */
export const REPAIR_ELIGIBLE_SEVERITIES = Object.freeze(['P0', 'P1'])

function violation(code, path, message) {
  return { code, path, message, severity: 'FATAL' }
}

function reachableWithin(from, to) {
  const distance = new Map([[from, 0]])
  const queue = [from]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const next of TRANSITIONS[current] ?? []) {
      if (distance.has(next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance.has(to) ? distance.get(to) : null
}

// --- transition guards. Order matters; the first violation wins. ------------

function guardKnownStatus(from, to) {
  if (!KNOWN_STATUSES.includes(from)) return violation('UNKNOWN_STATUS', 'transition.from', `unknown status ${from}`)
  if (!KNOWN_STATUSES.includes(to)) return violation('UNKNOWN_STATUS', 'transition.to', `unknown status ${to}`)
  return null
}

function guardNoOp(from, to) {
  if (from === to) return violation('NO_OP_TRANSITION', 'transition', `${from} -> ${to} is not a state change`)
  return null
}

function guardTableAndSkips(from, to) {
  if (TRANSITIONS[from].includes(to)) return null
  const distance = reachableWithin(from, to)
  if (distance !== null && distance >= 2) {
    return violation('SKIPPED_STATE', 'transition', `${from} -> ${to} skips ${distance - 1} required state(s)`)
  }
  return violation('ILLEGAL_TRANSITION', 'transition', `${from} -> ${to} is not in the transition table`)
}

function guardOwnerGate(from, to, context) {
  if (!OWNER_GATED_ORIGINS.includes(from)) return null
  if (to === 'BLOCKED' || to === 'OWNER_APPROVAL_REQUIRED') return null
  if (context.owner_approval === true) return null
  return violation('OWNER_APPROVAL_REQUIRED', 'transition', `leaving ${from} requires explicit owner approval`)
}

function guardUnverifiableNeverPasses(from, to, context) {
  const verdict = context.judge_verdict
  if (verdict === undefined) return null
  if (!JUDGE_VERDICTS.includes(verdict)) {
    return violation('UNKNOWN_JUDGE_VERDICT', 'context.judge_verdict', `unknown verdict ${verdict}`)
  }
  if (verdict !== 'UNVERIFIABLE') return null
  if (to === 'BLOCKED') return null
  return violation(
    'UNVERIFIABLE_MANDATORY_GATE',
    'transition',
    `an UNVERIFIABLE verdict may only lead to BLOCKED, never to ${to}`,
  )
}

function guardNoAutoRepairForP2P3(from, to, context) {
  if (to !== 'REPAIR_READY') return null
  const findings = context.findings
  if (!Array.isArray(findings) || findings.length === 0) {
    return violation('REPAIR_WITHOUT_FINDINGS', 'context.findings', 'a repair loop requires at least one finding')
  }
  const blocking = findings.filter((finding) => REPAIR_ELIGIBLE_SEVERITIES.includes(finding.severity))
  if (blocking.length > 0) return null
  return violation(
    'P2_P3_AUTO_REPAIR_FORBIDDEN',
    'context.findings',
    'only P0/P1 findings may open a repair loop automatically',
  )
}

function guardClosureRequiresIndependentJudge(from, to, context) {
  if (to !== 'CLOSED') return null
  if (from === 'OWNER_APPROVAL_REQUIRED') return null // already covered by guardOwnerGate
  if (context.judge_verdict !== 'PASS') {
    return violation('CLOSURE_WITHOUT_JUDGE_PASS', 'context.judge_verdict', 'closure requires a PASS verdict')
  }
  if (context.judge_independent !== true) {
    return violation('CLOSURE_WITHOUT_INDEPENDENT_JUDGE', 'context.judge_independent', 'the judge must be independent')
  }
  if (context.judge_read_only !== true) {
    return violation('CLOSURE_WITHOUT_READ_ONLY_JUDGE', 'context.judge_read_only', 'the judge must be read-only')
  }
  return null
}

function guardWriterStartRequiresLock(from, to, context) {
  if (to !== 'RUNNING_WRITER') return null
  const lock = context.writer_lock
  if (!lock || lock.active !== true) {
    return violation('WRITER_LOCK_NOT_HELD', 'context.writer_lock', 'a writer may not start without holding the lock')
  }
  if (context.item_id !== undefined && lock.item_id !== context.item_id) {
    return violation('WRITER_LOCK_ITEM_MISMATCH', 'context.writer_lock', `lock is held for ${lock.item_id}`)
  }
  return null
}

const TRANSITION_GUARDS = [
  guardKnownStatus,
  guardNoOp,
  guardTableAndSkips,
  guardOwnerGate,
  guardUnverifiableNeverPasses,
  guardNoAutoRepairForP2P3,
  guardClosureRequiresIndependentJudge,
  guardWriterStartRequiresLock,
]

/**
 * @returns {{ok: boolean, from: string, to: string, violation: object|null}}
 */
export function evaluateTransition(from, to, context = {}) {
  for (const guard of TRANSITION_GUARDS) {
    const found = guard(from, to, context)
    if (found) return { ok: false, from, to, violation: found }
  }
  return { ok: true, from, to, violation: null }
}

/**
 * Maps a judge verdict to the single status it is allowed to produce.
 * UNVERIFIABLE never yields JUDGE_PASS — it halts the program.
 */
export function statusForJudgeVerdict(verdict) {
  if (verdict === 'PASS') return { ok: true, status: 'JUDGE_PASS', stop_condition: null }
  if (verdict === 'FAIL') return { ok: true, status: 'JUDGE_FAIL', stop_condition: null }
  if (verdict === 'UNVERIFIABLE') {
    return { ok: true, status: 'BLOCKED', stop_condition: 'UNVERIFIABLE_MANDATORY_GATE' }
  }
  return { ok: false, status: 'BLOCKED', stop_condition: 'UNKNOWN_JUDGE_VERDICT' }
}

// ---------------------------------------------------------------------------
// 3. Writer lock semantics
// ---------------------------------------------------------------------------

export const NO_LOCK = Object.freeze({ active: false, item_id: null, holder: null, run_id: null })

/**
 * Two distinct runs can never both hold the lock. A repeat claim from the same
 * run_id for the same item is idempotent (a retried GitHub Actions step), which
 * is not a second writer.
 */
export function acquireWriterLock(currentLock, request) {
  for (const field of ['item_id', 'holder', 'run_id']) {
    if (typeof request?.[field] !== 'string' || request[field].length === 0) {
      return {
        ok: false,
        violation: violation('LOCK_REQUEST_INCOMPLETE', `request.${field}`, `${field} is required to claim the lock`),
        lock: currentLock ?? NO_LOCK,
      }
    }
  }
  if (currentLock && currentLock.active === true) {
    if (currentLock.run_id === request.run_id && currentLock.item_id === request.item_id) {
      return { ok: true, lock: currentLock, reused: true, violation: null }
    }
    return {
      ok: false,
      violation: violation(
        'WRITER_LOCK_HELD',
        'writer_lock',
        `lock is held by run ${currentLock.run_id} for ${currentLock.item_id}; ` +
          `run ${request.run_id} may not claim ${request.item_id}`,
      ),
      lock: currentLock,
    }
  }
  return {
    ok: true,
    reused: false,
    violation: null,
    lock: {
      active: true,
      item_id: request.item_id,
      holder: request.holder,
      run_id: request.run_id,
    },
  }
}

export function releaseWriterLock(currentLock, request) {
  if (!currentLock || currentLock.active !== true) {
    return { ok: false, violation: violation('WRITER_LOCK_NOT_HELD', 'writer_lock', 'no lock to release'), lock: NO_LOCK }
  }
  if (currentLock.run_id !== request?.run_id) {
    return {
      ok: false,
      violation: violation('WRITER_LOCK_OWNED_BY_ANOTHER_RUN', 'writer_lock', 'only the holding run may release'),
      lock: currentLock,
    }
  }
  return { ok: true, violation: null, lock: NO_LOCK }
}

// ---------------------------------------------------------------------------
// 4. Policy invariants (independent of the schema — defence in depth)
// ---------------------------------------------------------------------------

export const POLICY_MUST_BE_FALSE = Object.freeze([
  'production_deploy_authorized',
  'main_merge_authorized',
  'phi_allowed',
  'destructive_changes_authorized',
  'production_secret_rotation_authorized',
  'unverifiable_is_pass',
  'p2_p3_auto_repair',
])

export const POLICY_MUST_BE_TRUE = Object.freeze(['freeze_sha_before_judge', 'judge_must_be_read_only'])

export const POLICY_MUST_EQUAL = Object.freeze({ max_active_programs: 1, max_active_writers: 1 })

/** False unless an explicit OWNER_APPROVAL_REQUIRED state exists on the board. */
export const POLICY_OWNER_GATED = Object.freeze(['clinical_policy_changes_authorized'])

export function checkPolicyInvariants(board) {
  const violations = []
  const policy = board?.execution_policy
  if (typeOf(policy) !== 'object') {
    return [violation('POLICY_MISSING', '/execution_policy', 'execution_policy is required')]
  }

  for (const key of POLICY_MUST_BE_FALSE) {
    if (!(key in policy)) {
      violations.push(violation('POLICY_KEY_MISSING', `/execution_policy/${key}`, 'required policy flag is absent'))
    } else if (policy[key] !== false) {
      violations.push(
        violation('POLICY_AUTHORIZATION_DRIFT', `/execution_policy/${key}`, `must be false, found ${JSON.stringify(policy[key])}`),
      )
    }
  }

  for (const key of POLICY_MUST_BE_TRUE) {
    if (!(key in policy)) {
      violations.push(violation('POLICY_KEY_MISSING', `/execution_policy/${key}`, 'required policy flag is absent'))
    } else if (policy[key] !== true) {
      violations.push(
        violation('POLICY_AUTHORIZATION_DRIFT', `/execution_policy/${key}`, `must be true, found ${JSON.stringify(policy[key])}`),
      )
    }
  }

  for (const [key, expected] of Object.entries(POLICY_MUST_EQUAL)) {
    if (policy[key] !== expected) {
      violations.push(
        violation('POLICY_AUTHORIZATION_DRIFT', `/execution_policy/${key}`, `must be ${expected}, found ${JSON.stringify(policy[key])}`),
      )
    }
  }

  const items = Array.isArray(board.items) ? board.items : []
  const ownerGateExists =
    items.some((item) => item?.status === 'OWNER_APPROVAL_REQUIRED') &&
    Array.isArray(board.stop_conditions) &&
    board.stop_conditions.includes('OWNER_APPROVAL_REQUIRED')

  for (const key of POLICY_OWNER_GATED) {
    if (!(key in policy)) {
      violations.push(violation('POLICY_KEY_MISSING', `/execution_policy/${key}`, 'required policy flag is absent'))
    } else if (policy[key] !== false && !ownerGateExists) {
      violations.push(
        violation(
          'POLICY_OWNER_GATE_MISSING',
          `/execution_policy/${key}`,
          'may only be true while an item is parked in OWNER_APPROVAL_REQUIRED',
        ),
      )
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// 5. Execution authority (stale legacy state must never execute)
// ---------------------------------------------------------------------------

export const LEGACY_CLASSIFICATIONS_FORBIDDING_EXECUTION = Object.freeze([
  'LEGACY_NON_CANONICAL_DO_NOT_EXECUTE',
  'LEGACY_INPUT_ONLY_NOT_EXECUTION_ORDER',
])

function normalisePath(candidate) {
  return String(candidate).replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * Rejects any attempt to drive the control plane from a source other than the
 * canonical board — in particular `agent-state/MASTER_STATE.json`, which still
 * carries historical production-deploy and merge-to-main authorizations.
 */
export function assertExecutionAuthority(board, sourcePath) {
  const path = normalisePath(sourcePath)
  const legacy = board?.legacy_state_policy ?? {}
  for (const [legacyPath, classification] of Object.entries(legacy)) {
    if (!legacyPath.includes('/')) continue // `reason` and friends are prose, not paths
    const normalisedLegacy = normalisePath(legacyPath)
    if (path === normalisedLegacy || path.endsWith(`/${normalisedLegacy}`)) {
      if (LEGACY_CLASSIFICATIONS_FORBIDDING_EXECUTION.includes(classification)) {
        return {
          ok: false,
          violation: violation('STALE_LEGACY_AUTHORITY', path, `${normalisedLegacy} is classified ${classification}`),
        }
      }
    }
  }
  if (path !== CANONICAL_BOARD_RELATIVE_PATH && !path.endsWith(`/${CANONICAL_BOARD_RELATIVE_PATH}`)) {
    return {
      ok: false,
      violation: violation('NON_CANONICAL_EXECUTION_AUTHORITY', path, `only ${CANONICAL_BOARD_RELATIVE_PATH} may execute`),
    }
  }
  if (board?.canonical !== true) {
    return { ok: false, violation: violation('BOARD_NOT_CANONICAL', '/canonical', 'canonical must be true') }
  }
  return { ok: true, violation: null }
}

/** Exactly one canonical, non-closed program may exist. */
export function checkActivePrograms(boards) {
  const canonical = boards.filter((entry) => entry.board?.canonical === true)
  if (canonical.length === 0) {
    return [violation('NO_CANONICAL_BOARD', 'control-plane', 'no canonical board found')]
  }
  if (canonical.length > 1) {
    return [
      violation(
        'MULTIPLE_CANONICAL_BOARDS',
        'control-plane',
        `found ${canonical.length}: ${canonical.map((entry) => entry.path).join(', ')}`,
      ),
    ]
  }
  const active = canonical.filter((entry) => entry.board.status !== 'CLOSED')
  if (active.length > 1) {
    return [violation('MULTIPLE_ACTIVE_PROGRAMS', 'control-plane', `${active.length} active programs`)]
  }
  return []
}

// ---------------------------------------------------------------------------
// 6. Board-level structural invariants
// ---------------------------------------------------------------------------

function sortById(items) {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function checkItemInvariants(board) {
  const violations = []
  const items = Array.isArray(board.items) ? board.items : []
  const statusModel = Array.isArray(board.status_model) ? board.status_model : []
  const byId = new Map()

  for (const item of items) {
    if (byId.has(item.id)) {
      violations.push(violation('DUPLICATE_ITEM_ID', `/items/${item.id}`, 'item id appears more than once'))
    }
    byId.set(item.id, item)
  }

  for (const item of items) {
    if (!KNOWN_STATUSES.includes(item.status)) {
      violations.push(violation('UNKNOWN_STATUS', `/items/${item.id}/status`, `${item.status} has no transition rules`))
    } else if (!statusModel.includes(item.status)) {
      violations.push(
        violation('STATUS_OUT_OF_MODEL', `/items/${item.id}/status`, `${item.status} is not in the board status_model`),
      )
    }
    if (item.status === 'CLOSED' && !item.closed_by) {
      violations.push(violation('CLOSED_WITHOUT_CLOSER', `/items/${item.id}/closed_by`, 'a closed item needs a closer'))
    }
    if (item.status !== 'CLOSED' && item.closed_by) {
      violations.push(violation('CLOSER_ON_OPEN_ITEM', `/items/${item.id}/closed_by`, 'only a closed item may have a closer'))
    }
    for (const dependency of item.dependencies ?? []) {
      if (dependency === item.id) {
        violations.push(violation('SELF_DEPENDENCY', `/items/${item.id}/dependencies`, 'an item cannot depend on itself'))
      } else if (!byId.has(dependency)) {
        violations.push(violation('UNKNOWN_DEPENDENCY', `/items/${item.id}/dependencies`, `${dependency} does not exist`))
      }
    }
    for (const blocker of item.blocked_by ?? []) {
      if (!byId.has(blocker)) {
        violations.push(violation('UNKNOWN_DEPENDENCY', `/items/${item.id}/blocked_by`, `${blocker} does not exist`))
      }
    }
  }

  // Cycle detection over dependencies.
  const state = new Map()
  const visit = (id) => {
    const current = state.get(id)
    if (current === 'DONE') return false
    if (current === 'VISITING') return true
    state.set(id, 'VISITING')
    for (const dependency of byId.get(id)?.dependencies ?? []) {
      if (byId.has(dependency) && visit(dependency)) return true
    }
    state.set(id, 'DONE')
    return false
  }
  for (const item of items) {
    if (visit(item.id)) {
      violations.push(violation('DEPENDENCY_CYCLE', `/items/${item.id}/dependencies`, 'dependency cycle detected'))
      break
    }
  }

  return violations
}

const STATUSES_REQUIRING_MET_DEPENDENCIES = Object.freeze(['READY', ...IN_FLIGHT_STATUSES, 'CLOSED'])

export function checkDependencies(board) {
  const violations = []
  const items = Array.isArray(board.items) ? board.items : []
  const byId = new Map(items.map((item) => [item.id, item]))

  for (const item of items) {
    const unmet = (item.dependencies ?? []).filter((id) => byId.get(id)?.status !== 'CLOSED')

    if (STATUSES_REQUIRING_MET_DEPENDENCIES.includes(item.status) && unmet.length > 0) {
      violations.push(
        violation('DEPENDENCY_VIOLATION', `/items/${item.id}`, `status ${item.status} with unmet dependencies: ${unmet.join(', ')}`),
      )
    }

    // `blocked_by` must tell the truth about what is actually holding the item.
    const declared = new Set(item.blocked_by ?? [])
    for (const id of unmet) {
      if (!declared.has(id)) {
        violations.push(
          violation('BLOCKED_BY_OUT_OF_SYNC', `/items/${item.id}/blocked_by`, `${id} is unmet but not declared as a blocker`),
        )
      }
    }
    for (const id of declared) {
      if (byId.get(id)?.status === 'CLOSED') {
        violations.push(
          violation('BLOCKED_BY_OUT_OF_SYNC', `/items/${item.id}/blocked_by`, `${id} is closed and must be removed`),
        )
      }
    }
  }

  return violations
}

export function checkConcurrency(board) {
  const violations = []
  const items = Array.isArray(board.items) ? board.items : []
  const writers = items.filter((item) => WRITER_ACTIVE_STATUSES.includes(item.status))
  const maxWriters = board.execution_policy?.max_active_writers ?? 1

  if (writers.length > maxWriters) {
    violations.push(
      violation(
        'MULTIPLE_ACTIVE_WRITERS',
        '/items',
        `${writers.length} items are RUNNING_WRITER (max ${maxWriters}): ${writers.map((i) => i.id).join(', ')}`,
      ),
    )
  }

  const inFlight = items.filter((item) => IN_FLIGHT_STATUSES.includes(item.status))
  if (inFlight.length > 1) {
    violations.push(
      violation('MULTIPLE_IN_FLIGHT_ITEMS', '/items', `${inFlight.map((i) => i.id).join(', ')} are simultaneously in flight`),
    )
  }

  return violations
}

// ---------------------------------------------------------------------------
// 7. Deterministic next-item selection
// ---------------------------------------------------------------------------

export const NEXT_ACTIONS = Object.freeze({
  RUN_WRITER: 'RUN_WRITER',
  ADVANCE_IN_FLIGHT: 'ADVANCE_IN_FLIGHT',
  BLOCKED: 'BLOCKED',
  OWNER_APPROVAL_REQUIRED: 'OWNER_APPROVAL_REQUIRED',
  NO_ELIGIBLE_ITEM: 'NO_ELIGIBLE_ITEM',
  PROGRAM_CLOSED: 'PROGRAM_CLOSED',
  HALT: 'HALT',
})

/**
 * Deterministic: candidates are ordered by item id and the result never depends
 * on array order, clock, or environment. Ambiguity (two simultaneously eligible
 * items) is a board defect and halts the program rather than picking one.
 *
 * @returns {{ok: boolean, next_item: object|null, next_action: string, in_flight: string[], candidates: string[], violations: object[], reason: string}}
 */
export function selectNextItem(board) {
  const items = Array.isArray(board.items) ? board.items : []
  const byId = new Map(items.map((item) => [item.id, item]))
  const base = { next_item: null, in_flight: [], candidates: [], violations: [], allowed_next_statuses: [] }

  if (board.status === 'CLOSED') {
    return { ...base, ok: true, next_action: NEXT_ACTIONS.PROGRAM_CLOSED, reason: 'the program is closed' }
  }

  const blocked = sortById(items.filter((item) => item.status === 'BLOCKED'))
  if (blocked.length > 0) {
    return {
      ...base,
      ok: false,
      next_action: NEXT_ACTIONS.BLOCKED,
      candidates: blocked.map((item) => item.id),
      reason: `blocked item(s): ${blocked.map((item) => item.id).join(', ')}`,
      violations: [violation('PROGRAM_BLOCKED', '/items', `${blocked.map((item) => item.id).join(', ')} is BLOCKED`)],
    }
  }

  const ownerGated = sortById(items.filter((item) => item.status === 'OWNER_APPROVAL_REQUIRED'))
  if (ownerGated.length > 0) {
    return {
      ...base,
      ok: true,
      next_action: NEXT_ACTIONS.OWNER_APPROVAL_REQUIRED,
      candidates: ownerGated.map((item) => item.id),
      reason: `owner approval required for: ${ownerGated.map((item) => item.id).join(', ')}`,
    }
  }

  const inFlight = sortById(items.filter((item) => IN_FLIGHT_STATUSES.includes(item.status)))
  if (inFlight.length > 1) {
    return {
      ...base,
      ok: false,
      next_action: NEXT_ACTIONS.HALT,
      in_flight: inFlight.map((item) => item.id),
      reason: 'more than one item is in flight',
      violations: [violation('MULTIPLE_IN_FLIGHT_ITEMS', '/items', inFlight.map((item) => item.id).join(', '))],
    }
  }

  if (inFlight.length === 1) {
    const item = inFlight[0]
    if (item.status === 'REPAIR_READY') {
      return {
        ...base,
        ok: true,
        next_item: item,
        next_action: NEXT_ACTIONS.RUN_WRITER,
        in_flight: [item.id],
        candidates: [item.id],
        reason: `${item.id} is queued for an authorized repair pass`,
      }
    }
    return {
      ...base,
      ok: true,
      // The item to act on next is the in-flight one; `next_action` says the
      // action is to advance its status, NOT to start another writer.
      next_item: item,
      next_action: NEXT_ACTIONS.ADVANCE_IN_FLIGHT,
      allowed_next_statuses: [...TRANSITIONS[item.status]],
      in_flight: [item.id],
      candidates: [item.id],
      reason: `${item.id} is ${item.status}; allowed next states: ${TRANSITIONS[item.status].join(', ')}`,
    }
  }

  const eligible = sortById(
    items.filter((item) => {
      if (item.status !== 'READY') return false
      const depsMet = (item.dependencies ?? []).every((id) => byId.get(id)?.status === 'CLOSED')
      const blockersClear = (item.blocked_by ?? []).every((id) => byId.get(id)?.status === 'CLOSED')
      return depsMet && blockersClear
    }),
  )

  if (eligible.length === 0) {
    return { ...base, ok: true, next_action: NEXT_ACTIONS.NO_ELIGIBLE_ITEM, reason: 'no item is READY with met dependencies' }
  }

  if (eligible.length > 1) {
    return {
      ...base,
      ok: false,
      next_action: NEXT_ACTIONS.HALT,
      candidates: eligible.map((item) => item.id),
      reason: 'exactly one item must be eligible',
      violations: [
        violation('AMBIGUOUS_NEXT_ITEM', '/items', `${eligible.map((item) => item.id).join(', ')} are simultaneously eligible`),
      ],
    }
  }

  return {
    ...base,
    ok: true,
    next_item: eligible[0],
    next_action: NEXT_ACTIONS.RUN_WRITER,
    candidates: [eligible[0].id],
    reason: `${eligible[0].id} is the single eligible item`,
  }
}

// ---------------------------------------------------------------------------
// 8. Whole-board evaluation and machine-readable output
// ---------------------------------------------------------------------------

/**
 * @returns machine-readable result. Deterministic: no timestamps, no randomness,
 * stable ordering — the same board always produces byte-identical JSON.
 */
export function evaluateBoard({ board, schema, boardPath = CANONICAL_BOARD_RELATIVE_PATH, siblingBoards = null }) {
  const violations = []

  let schemaOk = false
  try {
    const result = validateAgainstSchema(schema, board)
    schemaOk = result.ok
    for (const error of result.errors) {
      violations.push(violation('SCHEMA_VALIDATION_FAILED', error.path, `${error.keyword}: ${error.message}`))
    }
  } catch (error) {
    violations.push(violation('SCHEMA_UNSUPPORTED', boardPath, String(error.message ?? error)))
  }

  // Authority and policy are checked even when the schema fails. They are the
  // two guards that must not depend on the schema file being trustworthy: a
  // weakened schema is exactly the scenario in which a drifted
  // production/main authorization would otherwise slip through unreported.
  const authority = assertExecutionAuthority(board, boardPath)
  if (!authority.ok) violations.push(authority.violation)
  violations.push(...checkPolicyInvariants(board))

  if (schemaOk) {
    violations.push(...checkActivePrograms(siblingBoards ?? [{ path: boardPath, board }]))
    violations.push(...checkItemInvariants(board))
    violations.push(...checkDependencies(board))
    violations.push(...checkConcurrency(board))
  }

  const selection = schemaOk
    ? selectNextItem(board)
    : { ok: false, next_item: null, next_action: NEXT_ACTIONS.HALT, in_flight: [], candidates: [], violations: [], reason: 'board did not validate' }

  violations.push(...selection.violations)

  const ok = violations.length === 0 && selection.ok
  const nextItem = ok ? selection.next_item : null

  return {
    contract: OUTPUT_CONTRACT_VERSION,
    ok,
    board_path: boardPath,
    program_id: board?.program_id ?? null,
    board_status: board?.status ?? null,
    accepted_v15_sha: board?.accepted_v15_sha ?? null,
    source_branch: board?.source_branch ?? null,
    schema_valid: schemaOk,
    next_action: ok ? selection.next_action : NEXT_ACTIONS.HALT,
    next_item: nextItem
      ? { id: nextItem.id, title: nextItem.title, owner: nextItem.owner, status: nextItem.status, next_action: nextItem.next_action }
      : null,
    allowed_next_statuses: ok ? selection.allowed_next_statuses ?? [] : [],
    selection_reason: selection.reason,
    in_flight: selection.in_flight,
    candidates: selection.candidates,
    authorizations: {
      production_deploy: false,
      main_merge: false,
      phi: false,
      destructive: false,
      clinical_policy: false,
      production_secret_rotation: false,
    },
    violation_count: violations.length,
    violations,
    github_outputs: {
      ok: String(ok),
      next_action: ok ? selection.next_action : NEXT_ACTIONS.HALT,
      next_item_id: nextItem ? nextItem.id : '',
      next_item_owner: nextItem ? nextItem.owner : '',
      violation_count: String(violations.length),
    },
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Finds every board-shaped JSON file in control-plane/, so a second board is caught. */
export function discoverBoards(directory = CONTROL_PLANE_DIR) {
  const entries = []
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith('.json')) continue
    let parsed
    try {
      parsed = readJson(join(directory, name))
    } catch {
      continue
    }
    if (typeOf(parsed) === 'object' && typeof parsed.program_id === 'string' && 'canonical' in parsed) {
      entries.push({ path: `control-plane/${name}`, board: parsed })
    }
  }
  return entries
}

export function runCheck({ boardPath = BOARD_PATH, schemaPath = SCHEMA_PATH } = {}) {
  const relativeBoardPath = normalisePath(boardPath.startsWith(REPO_ROOT) ? boardPath.slice(REPO_ROOT.length + 1) : boardPath)

  let schema
  try {
    schema = readJson(schemaPath)
  } catch (error) {
    return failure(relativeBoardPath, violation('SCHEMA_PARSE_ERROR', schemaPath, String(error.message ?? error)))
  }

  let board
  try {
    board = readJson(boardPath)
  } catch (error) {
    return failure(relativeBoardPath, violation('BOARD_PARSE_ERROR', relativeBoardPath, String(error.message ?? error)))
  }

  return evaluateBoard({ board, schema, boardPath: relativeBoardPath, siblingBoards: discoverBoards(dirname(boardPath)) })
}

function failure(boardPath, found) {
  return {
    contract: OUTPUT_CONTRACT_VERSION,
    ok: false,
    board_path: boardPath,
    program_id: null,
    board_status: null,
    accepted_v15_sha: null,
    source_branch: null,
    schema_valid: false,
    next_action: NEXT_ACTIONS.HALT,
    next_item: null,
    allowed_next_statuses: [],
    selection_reason: found.message,
    in_flight: [],
    candidates: [],
    authorizations: {
      production_deploy: false,
      main_merge: false,
      phi: false,
      destructive: false,
      clinical_policy: false,
      production_secret_rotation: false,
    },
    violation_count: 1,
    violations: [found],
    github_outputs: { ok: 'false', next_action: NEXT_ACTIONS.HALT, next_item_id: '', next_item_owner: '', violation_count: '1' },
  }
}

// ---------------------------------------------------------------------------
// 9. CLI
// ---------------------------------------------------------------------------

const USAGE = {
  contract: OUTPUT_CONTRACT_VERSION,
  ok: false,
  error: 'UNKNOWN_COMMAND',
  commands: ['check', 'next'],
}

export function main(argv) {
  const command = argv[0] ?? 'check'
  if (command === 'check') {
    const result = runCheck()
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result.ok ? 0 : 1
  }
  if (command === 'next') {
    const result = runCheck()
    process.stdout.write(
      `${JSON.stringify(
        {
          contract: result.contract,
          ok: result.ok,
          next_action: result.next_action,
          next_item: result.next_item,
          allowed_next_statuses: result.allowed_next_statuses,
          selection_reason: result.selection_reason,
        },
        null,
        2,
      )}\n`,
    )
    return result.ok ? 0 : 1
  }
  process.stdout.write(`${JSON.stringify(USAGE, null, 2)}\n`)
  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
