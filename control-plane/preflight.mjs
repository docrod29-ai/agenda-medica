#!/usr/bin/env node
/**
 * AUSCULTA-AUTONOMOUS-CONTROL-PLANE-001 — ACP-002
 * Fail-closed preflight for the cloud writer runner.
 *
 * `BASELINE.md` lists fourteen conditions that must hold "before any AI agent is
 * invoked automatically". Until now they lived as prose in a markdown file and,
 * partially, as bash inside one ACP-001-specific workflow. Prose cannot be
 * reverse-proved and bash pasted into a YAML step cannot be unit tested, so this
 * module implements all fourteen as deterministic code with one job: decide
 * whether a writer may start, and if not, say exactly which condition stopped it.
 *
 * Two design rules, both learned the expensive way:
 *
 *   1. ASK THE KERNEL, DO NOT TRUST THE DOCUMENT. Conditions 10-14 are
 *      properties of the state contract ("UNVERIFIABLE can never become PASS").
 *      A preflight that merely re-asserts them in a second place would go green
 *      while the kernel underneath it was weakened. So this module proves them
 *      by calling the kernel at run time, with the exact defect, and requiring
 *      the exact rejection. If someone deletes a guard, the writer will not start.
 *
 *   2. THE SECRET VALUE NEVER ARRIVES. The runner reports whether a credential
 *      is present, never what it is. A request carrying a value is itself a
 *      failure (`SECRET_VALUE_LEAKED`), because the only way a value can be
 *      printed is if something handed it to a component that prints things.
 *
 * Deterministic: no clock, no randomness, no network, no filesystem writes. The
 * same request always produces byte-identical output.
 */

import {
  IN_FLIGHT_STATUSES,
  NEXT_ACTIONS,
  NO_LOCK,
  acquireWriterLock,
  checkPolicyInvariants,
  evaluateBoard,
  evaluateTransition,
  statusForJudgeVerdict,
} from './kernel.mjs'

/** Bumped whenever the machine-readable output contract changes. */
export const PREFLIGHT_CONTRACT_VERSION = 'control-plane/preflight/1'

/** Branches a writer may never target, whatever the request says. */
export const PROTECTED_BRANCHES = Object.freeze(['main', 'master'])

/**
 * Token scopes a writer job may hold. `contents: write` is unavoidable — the
 * writer's product is a pushed checkpoint — and is fenced by the protected-branch
 * rule instead. Everything absent from this map is refused, so a scope added to
 * the workflow later cannot slip past by being unanticipated.
 */
export const ALLOWED_WRITER_PERMISSIONS = Object.freeze({
  contents: Object.freeze(['read', 'write']),
  'pull-requests': Object.freeze(['none', 'read']),
  issues: Object.freeze(['none', 'read']),
  actions: Object.freeze(['none', 'read']),
  metadata: Object.freeze(['none', 'read']),
})

/**
 * Scopes that would give the writer production reach. Named explicitly rather
 * than left to the allowlist so the refusal message says *why*, and so a reader
 * of this file can see what the control plane is actually afraid of.
 */
export const PRODUCTION_REACHING_PERMISSIONS = Object.freeze([
  'deployments',
  'environments',
  'id-token',
  'packages',
  'administration',
  'secrets',
  'actions-variables',
])

/** Upper bounds. A budget is only a budget if something rejects an absent one. */
export const BUDGET_CEILINGS = Object.freeze({
  max_turns: 120,
  timeout_minutes: 90,
  max_retries: 2,
})

/** Credential names the baseline expects. A writer may only ask for its own. */
export const WRITER_SECRET_NAMES = Object.freeze(['ANTHROPIC_API_KEY'])

export const STOP_CONDITIONS = Object.freeze({
  BOARD_INVALID: 'BOARD_INVALID',
  AMBIGUOUS_NEXT_ITEM: 'AMBIGUOUS_NEXT_ITEM',
  ITEM_NOT_AUTHORIZED: 'ITEM_NOT_AUTHORIZED',
  WRITER_LOCK_HELD: 'WRITER_LOCK_HELD',
  BRANCH_OR_SHA_NOT_EXPLICIT: 'BRANCH_OR_SHA_NOT_EXPLICIT',
  FORBIDDEN_TARGET_BRANCH: 'FORBIDDEN_TARGET_BRANCH',
  UNCLEAN_WORKTREE_AT_FREEZE: 'UNCLEAN_WORKTREE_AT_FREEZE',
  POLICY_AUTHORIZATION_DRIFT: 'POLICY_AUTHORIZATION_DRIFT',
  MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL: 'MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL',
  SECRET_VALUE_LEAKED: 'SECRET_VALUE_LEAKED',
  BUDGET_NOT_BOUNDED: 'BUDGET_NOT_BOUNDED',
  WRITER_PERMISSIONS_TOO_BROAD: 'WRITER_PERMISSIONS_TOO_BROAD',
  JUDGE_WOULD_RUN_BEFORE_FREEZE: 'JUDGE_WOULD_RUN_BEFORE_FREEZE',
  JUDGE_NOT_READ_ONLY: 'JUDGE_NOT_READ_ONLY',
  UNVERIFIABLE_MANDATORY_GATE: 'UNVERIFIABLE_MANDATORY_GATE',
  P2_P3_AUTO_REPAIR_FORBIDDEN: 'P2_P3_AUTO_REPAIR_FORBIDDEN',
  OWNER_APPROVAL_REQUIRED: 'OWNER_APPROVAL_REQUIRED',
  MALFORMED_PREFLIGHT_REQUEST: 'MALFORMED_PREFLIGHT_REQUEST',
})

const SHA_PATTERN = /^[0-9a-f]{40}$/

function check(id, name, ok, stop_condition, detail) {
  return { id, name, ok, stop_condition: ok ? null : stop_condition, detail }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function isBoundedInteger(value, ceiling) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= ceiling
}

/**
 * The lock is not stored in a field of its own; it is a fact about the board.
 * Deriving it here means the lock cannot drift away from the state it protects,
 * which is exactly how a "lock" quietly becomes decoration.
 *
 * `run_id` is deliberately null: the board records that a writer is running, not
 * WHICH run is running it. So the holder is unknowable from state alone, and a
 * request claiming to be that same run cannot be believed. Fail closed — an
 * item already at RUNNING_WRITER stops a new writer start and asks for a human.
 */
export function writerLockFromBoard(board) {
  const items = Array.isArray(board?.items) ? board.items : []
  const running = items.filter((item) => item?.status === 'RUNNING_WRITER')
  if (running.length === 0) return NO_LOCK
  return {
    active: true,
    item_id: running[0].id,
    holder: running[0].owner ?? null,
    run_id: null,
  }
}

/**
 * Reads a workflow job's `permissions:` block out of the workflow source.
 *
 * The runner could simply be told what permissions it holds, but then the list
 * being checked and the list actually granted are two hand-maintained copies,
 * and the one that drifts is always the one being checked. So the granted
 * permissions are parsed from the YAML the runner is running under, and this
 * function is the single implementation of that parse — shared by the workflow
 * and by the test that proves the workflow's real block still passes.
 *
 * Deliberately a small line-oriented parser rather than a YAML dependency: the
 * control plane stays dependency-free, and an unexpected shape must fail rather
 * than be interpreted generously. Throws instead of returning something empty,
 * because an empty permission list reads as "harmless" and is the one answer
 * that must never be produced by accident.
 */
export function writerPermissionsFromWorkflow(source, jobName = 'writer') {
  const lines = String(source).split('\n')
  const jobLine = lines.findIndex((line) => line === `  ${jobName}:`)
  if (jobLine === -1) throw new Error(`MALFORMED_WRITER_WORKFLOW: job \`${jobName}\` not found`)
  const permissionsLine = lines.findIndex((line, index) => index > jobLine && line === '    permissions:')
  if (permissionsLine === -1) throw new Error(`MALFORMED_WRITER_WORKFLOW: job \`${jobName}\` declares no permissions block`)
  const permissions = {}
  for (let index = permissionsLine + 1; index < lines.length; index += 1) {
    const match = /^ {6}([a-z-]+): ([a-z]+)$/.exec(lines[index])
    if (!match) break
    permissions[match[1]] = match[2]
  }
  if (Object.keys(permissions).length === 0) throw new Error('MALFORMED_WRITER_WORKFLOW: empty permissions block')
  return permissions
}

// --- the fourteen conditions ------------------------------------------------

function conditionBoardValidates(context) {
  const { evaluation } = context
  const ok = evaluation.schema_valid === true && evaluation.violation_count === 0
  return check(
    1,
    'canonical board parses and validates against schema',
    ok,
    STOP_CONDITIONS.BOARD_INVALID,
    ok ? 'board is valid with zero violations' : `violations: ${JSON.stringify(evaluation.violations)}`,
  )
}

function conditionExactlyOneEligibleTask(context) {
  const { evaluation, request } = context
  if (evaluation.next_action !== NEXT_ACTIONS.RUN_WRITER) {
    return check(
      2,
      'exactly one task is eligible',
      false,
      evaluation.next_action === NEXT_ACTIONS.HALT ? STOP_CONDITIONS.AMBIGUOUS_NEXT_ITEM : STOP_CONDITIONS.ITEM_NOT_AUTHORIZED,
      `deterministic selection says ${evaluation.next_action}, not RUN_WRITER: ${evaluation.selection_reason}`,
    )
  }
  const selected = evaluation.next_item?.id ?? null
  const ok = selected === request.item_id
  return check(
    2,
    'exactly one task is eligible',
    ok,
    STOP_CONDITIONS.ITEM_NOT_AUTHORIZED,
    ok ? `${selected} is the single eligible item` : `runner asked for ${request.item_id}; the board selected ${selected}`,
  )
}

function conditionNoOtherWriterLock(context) {
  const { board, request } = context
  const current = writerLockFromBoard(board)
  if (current.active) {
    // `acquireWriterLock` has an idempotent-retry branch keyed on run_id, which
    // is the right semantic for a workflow re-running its own step — but the
    // board does not store a run_id, so nothing here can prove sameness. The
    // first version filled the gap with a sentinel run_id, and its own test
    // found the hole immediately: a request that simply SAYS it is the sentinel
    // is then treated as the holder. A guessable secret is not a lock. So an
    // active lock is refused outright and a human decides.
    return check(
      3,
      'no other writer lock is active',
      false,
      STOP_CONDITIONS.WRITER_LOCK_HELD,
      `${current.item_id} is already RUNNING_WRITER (holder ${current.holder}); the board cannot prove which run holds it, so no new writer may start`,
    )
  }
  const result = acquireWriterLock(NO_LOCK, {
    item_id: request.item_id,
    holder: request.holder,
    run_id: request.run_id,
  })
  return check(
    3,
    'no other writer lock is active',
    result.ok,
    result.ok ? null : STOP_CONDITIONS.WRITER_LOCK_HELD,
    result.ok ? `lock granted to run ${request.run_id} for ${request.item_id}` : result.violation.message,
  )
}

function conditionBranchAndShaExplicit(context) {
  const { board, request } = context
  if (!isNonEmptyString(request.branch) || !SHA_PATTERN.test(request.expected_sha ?? '') || !SHA_PATTERN.test(request.head_sha ?? '')) {
    return check(
      4,
      'branch and expected SHA are explicit',
      false,
      STOP_CONDITIONS.BRANCH_OR_SHA_NOT_EXPLICIT,
      'branch must be a non-empty string and both SHAs must be full 40-character hex',
    )
  }
  if (request.head_sha !== request.expected_sha) {
    return check(
      4,
      'branch and expected SHA are explicit',
      false,
      STOP_CONDITIONS.BRANCH_OR_SHA_NOT_EXPLICIT,
      `checkout is ${request.head_sha} but the run was authorized for ${request.expected_sha}`,
    )
  }
  if (PROTECTED_BRANCHES.includes(request.branch)) {
    return check(4, 'branch and expected SHA are explicit', false, STOP_CONDITIONS.FORBIDDEN_TARGET_BRANCH, `${request.branch} is protected`)
  }
  if (request.branch !== board.source_branch) {
    return check(
      4,
      'branch and expected SHA are explicit',
      false,
      STOP_CONDITIONS.FORBIDDEN_TARGET_BRANCH,
      `the board declares source_branch ${board.source_branch}; the runner targeted ${request.branch}`,
    )
  }
  return check(4, 'branch and expected SHA are explicit', true, null, `${request.branch} @ ${request.expected_sha}`)
}

function conditionWorktreeClean(context) {
  const ok = context.request.worktree_clean === true
  return check(5, 'worktree is clean', ok, STOP_CONDITIONS.UNCLEAN_WORKTREE_AT_FREEZE, ok ? 'no uncommitted changes' : 'the checkout carries uncommitted changes')
}

function conditionPolicyFlagsFalse(context) {
  const violations = checkPolicyInvariants(context.board)
  const ok = violations.length === 0
  return check(
    6,
    'production/main/PHI/destructive flags are false',
    ok,
    STOP_CONDITIONS.POLICY_AUTHORIZATION_DRIFT,
    ok ? 'every fail-closed policy flag holds' : JSON.stringify(violations),
  )
}

function conditionSecretPresent(context) {
  const { request } = context
  // Checked first: a leaked value is worse than a missing one.
  for (const key of Object.keys(request)) {
    if (/(_value|_token|_key|secret_value)$/i.test(key) && request[key] !== null && request[key] !== undefined && request[key] !== '') {
      return check(7, 'required provider secret is present', false, STOP_CONDITIONS.SECRET_VALUE_LEAKED, `request carries ${key}; the preflight must only ever be told presence`)
    }
  }
  if (!WRITER_SECRET_NAMES.includes(request.secret_name)) {
    return check(
      7,
      'required provider secret is present',
      false,
      STOP_CONDITIONS.MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL,
      `${JSON.stringify(request.secret_name)} is not a writer credential; expected one of ${WRITER_SECRET_NAMES.join(', ')}`,
    )
  }
  const ok = request.secret_present === true
  return check(
    7,
    'required provider secret is present',
    ok,
    STOP_CONDITIONS.MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL,
    ok ? `${request.secret_name} is present (value never read)` : `${request.secret_name} is absent`,
  )
}

function conditionBudgetBounded(context) {
  const budget = context.request.budget
  if (budget === null || typeof budget !== 'object' || Array.isArray(budget)) {
    return check(8, 'task has bounded max turns / runtime / retry budget', false, STOP_CONDITIONS.BUDGET_NOT_BOUNDED, 'no budget supplied')
  }
  const failures = []
  if (!isBoundedInteger(budget.max_turns, BUDGET_CEILINGS.max_turns)) failures.push(`max_turns must be 1..${BUDGET_CEILINGS.max_turns}`)
  if (!isBoundedInteger(budget.timeout_minutes, BUDGET_CEILINGS.timeout_minutes)) failures.push(`timeout_minutes must be 1..${BUDGET_CEILINGS.timeout_minutes}`)
  // Zero retries is a legitimate budget; unbounded retries are not.
  const retries = budget.max_retries
  if (!(typeof retries === 'number' && Number.isInteger(retries) && retries >= 0 && retries <= BUDGET_CEILINGS.max_retries)) {
    failures.push(`max_retries must be 0..${BUDGET_CEILINGS.max_retries}`)
  }
  const ok = failures.length === 0
  return check(8, 'task has bounded max turns / runtime / retry budget', ok, STOP_CONDITIONS.BUDGET_NOT_BOUNDED, ok ? JSON.stringify(budget) : failures.join('; '))
}

function conditionWriterPermissions(context) {
  const permissions = context.request.permissions
  if (permissions === null || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return check(9, 'writer permissions exclude production deployment and main merge', false, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD, 'permissions must be declared explicitly')
  }
  const failures = []
  for (const [scope, level] of Object.entries(permissions)) {
    if (PRODUCTION_REACHING_PERMISSIONS.includes(scope)) {
      // Explicitly disclaiming a production scope is good practice, not a fault.
      if (level !== 'none') failures.push(`${scope}:${level} reaches production`)
      continue
    }
    const allowed = ALLOWED_WRITER_PERMISSIONS[scope]
    if (allowed === undefined) {
      failures.push(`${scope} is not an anticipated writer scope`)
    } else if (!allowed.includes(level)) {
      failures.push(`${scope}:${level} exceeds ${allowed.join('|')}`)
    }
  }
  const ok = failures.length === 0
  return check(9, 'writer permissions exclude production deployment and main merge', ok, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD, ok ? JSON.stringify(permissions) : failures.join('; '))
}

function conditionJudgeRunsOnlyAfterFreeze(context) {
  const { board } = context
  if (board.execution_policy?.freeze_sha_before_judge !== true) {
    return check(10, 'judge runs only after the writer SHA is frozen', false, STOP_CONDITIONS.JUDGE_WOULD_RUN_BEFORE_FREEZE, 'freeze_sha_before_judge is not true')
  }
  // Proved against the kernel, not against this file's opinion of the kernel.
  const legal = evaluateTransition('SHA_FROZEN', 'RUNNING_JUDGE', {})
  const premature = evaluateTransition('CI_PENDING', 'RUNNING_JUDGE', {})
  const ok = legal.ok === true && premature.ok === false
  return check(
    10,
    'judge runs only after the writer SHA is frozen',
    ok,
    STOP_CONDITIONS.JUDGE_WOULD_RUN_BEFORE_FREEZE,
    ok ? 'SHA_FROZEN -> RUNNING_JUDGE legal; CI_PENDING -> RUNNING_JUDGE rejected' : 'the transition table no longer forces a freeze before the judge',
  )
}

function conditionJudgeReadOnly(context) {
  const ok = context.board.execution_policy?.judge_must_be_read_only === true
  return check(11, 'judge receives read-only repository permissions', ok, STOP_CONDITIONS.JUDGE_NOT_READ_ONLY, ok ? 'judge_must_be_read_only is true' : 'judge_must_be_read_only is not true')
}

function conditionUnverifiableNeverPasses(context) {
  if (context.board.execution_policy?.unverifiable_is_pass !== false) {
    return check(12, 'UNVERIFIABLE can never become PASS', false, STOP_CONDITIONS.UNVERIFIABLE_MANDATORY_GATE, 'unverifiable_is_pass is not false')
  }
  const promoted = evaluateTransition('RUNNING_JUDGE', 'JUDGE_PASS', { judge_verdict: 'UNVERIFIABLE' })
  const mapped = statusForJudgeVerdict('UNVERIFIABLE')
  const ok = promoted.ok === false && mapped.status === 'BLOCKED' && mapped.stop_condition === 'UNVERIFIABLE_MANDATORY_GATE'
  return check(
    12,
    'UNVERIFIABLE can never become PASS',
    ok,
    STOP_CONDITIONS.UNVERIFIABLE_MANDATORY_GATE,
    ok ? 'the kernel rejects the promotion and maps UNVERIFIABLE to BLOCKED' : 'the kernel would let an UNVERIFIABLE verdict advance',
  )
}

function conditionNoAutoRepairForP2P3(context) {
  if (context.board.execution_policy?.p2_p3_auto_repair !== false) {
    return check(13, 'P2/P3 cannot auto-create a repair loop', false, STOP_CONDITIONS.P2_P3_AUTO_REPAIR_FORBIDDEN, 'p2_p3_auto_repair is not false')
  }
  const nonBlocking = evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', { findings: [{ severity: 'P2' }, { severity: 'P3' }] })
  const blocking = evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', { findings: [{ severity: 'P1' }] })
  const ok = nonBlocking.ok === false && blocking.ok === true
  return check(
    13,
    'P2/P3 cannot auto-create a repair loop',
    ok,
    STOP_CONDITIONS.P2_P3_AUTO_REPAIR_FORBIDDEN,
    ok ? 'P2/P3 refused, P1 allowed' : 'the kernel would open a repair loop for a non-blocking finding',
  )
}

function conditionOwnerGatesHalt(context) {
  const { board } = context
  const parked = (Array.isArray(board.items) ? board.items : []).filter((item) => item?.status === 'OWNER_APPROVAL_REQUIRED')
  if (parked.length > 0) {
    return check(
      14,
      'owner-gated actions stop in OWNER_APPROVAL_REQUIRED',
      false,
      STOP_CONDITIONS.OWNER_APPROVAL_REQUIRED,
      `${parked.map((item) => item.id).join(', ')} await the owner; no writer may start`,
    )
  }
  const escaped = evaluateTransition('OWNER_APPROVAL_REQUIRED', 'READY', {})
  const approved = evaluateTransition('OWNER_APPROVAL_REQUIRED', 'READY', { owner_approval: true })
  const ok = escaped.ok === false && approved.ok === true
  return check(
    14,
    'owner-gated actions stop in OWNER_APPROVAL_REQUIRED',
    ok,
    STOP_CONDITIONS.OWNER_APPROVAL_REQUIRED,
    ok ? 'an owner gate cannot be left without explicit approval' : 'the owner gate can be walked out of unattended',
  )
}

/**
 * Order matters only for which stop condition is reported first; every condition
 * is evaluated regardless, so one run tells the operator everything that is
 * wrong instead of one thing at a time.
 */
const CONDITIONS = Object.freeze([
  conditionBoardValidates,
  conditionExactlyOneEligibleTask,
  conditionNoOtherWriterLock,
  conditionBranchAndShaExplicit,
  conditionWorktreeClean,
  conditionPolicyFlagsFalse,
  conditionSecretPresent,
  conditionBudgetBounded,
  conditionWriterPermissions,
  conditionJudgeRunsOnlyAfterFreeze,
  conditionJudgeReadOnly,
  conditionUnverifiableNeverPasses,
  conditionNoAutoRepairForP2P3,
  conditionOwnerGatesHalt,
])

function malformed(detail) {
  return {
    contract: PREFLIGHT_CONTRACT_VERSION,
    ok: false,
    stop_condition: STOP_CONDITIONS.MALFORMED_PREFLIGHT_REQUEST,
    next_board_status: 'BLOCKED',
    authorized: null,
    failed_conditions: [],
    checks: [],
    detail,
    github_outputs: {
      ok: 'false',
      stop_condition: STOP_CONDITIONS.MALFORMED_PREFLIGHT_REQUEST,
      authorized_item: '',
      failed_condition_count: '1',
    },
  }
}

/**
 * @returns {{contract: string, ok: boolean, stop_condition: string|null, next_board_status: string|null,
 *   authorized: {item_id: string, branch: string, sha: string}|null, checks: object[], github_outputs: object}}
 */
export function runPreflight({ board, schema, request }) {
  if (board === null || typeof board !== 'object') return malformed('board is required')
  if (schema === null || typeof schema !== 'object') return malformed('schema is required')
  if (request === null || typeof request !== 'object' || Array.isArray(request)) return malformed('request is required')
  for (const field of ['item_id', 'holder', 'run_id']) {
    if (!isNonEmptyString(request[field])) return malformed(`request.${field} is required`)
  }

  const evaluation = evaluateBoard({ board, schema })
  const context = { board, schema, request, evaluation }
  const checks = CONDITIONS.map((condition) => condition(context))
  const failed = checks.filter((entry) => !entry.ok)
  const ok = failed.length === 0

  return {
    contract: PREFLIGHT_CONTRACT_VERSION,
    ok,
    // BASELINE.md: "If any preflight condition fails, the program transitions to
    // BLOCKED; it does not guess, weaken policy, or continue."
    stop_condition: ok ? null : failed[0].stop_condition,
    next_board_status: ok ? null : 'BLOCKED',
    authorized: ok ? { item_id: request.item_id, branch: request.branch, sha: request.expected_sha } : null,
    failed_conditions: failed.map((entry) => entry.id),
    checks,
    in_flight: (Array.isArray(board.items) ? board.items : []).filter((item) => IN_FLIGHT_STATUSES.includes(item?.status)).map((item) => item.id),
    github_outputs: {
      ok: String(ok),
      stop_condition: ok ? '' : failed[0].stop_condition,
      authorized_item: ok ? request.item_id : '',
      failed_condition_count: String(failed.length),
    },
  }
}

// ---------------------------------------------------------------------------
// CLI — `node control-plane/preflight.mjs --request <path>`
// ---------------------------------------------------------------------------

export function main(argv, { readFileSync, boardPath, schemaPath }) {
  const flagIndex = argv.indexOf('--request')
  if (flagIndex === -1 || !argv[flagIndex + 1]) {
    process.stdout.write(`${JSON.stringify({ contract: PREFLIGHT_CONTRACT_VERSION, ok: false, error: 'MISSING_REQUEST', usage: 'preflight.mjs --request <path.json>' }, null, 2)}\n`)
    return 2
  }
  let request
  let board
  let schema
  try {
    request = JSON.parse(readFileSync(argv[flagIndex + 1], 'utf8'))
    board = JSON.parse(readFileSync(boardPath, 'utf8'))
    schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  } catch (error) {
    const result = malformed(String(error.message ?? error))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return 1
  }
  const result = runPreflight({ board, schema, request })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result.ok ? 0 : 1
}

if (process.argv[1]) {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { BOARD_PATH, SCHEMA_PATH } = await import('./kernel.mjs')
    process.exitCode = main(process.argv.slice(2), { readFileSync, boardPath: BOARD_PATH, schemaPath: SCHEMA_PATH })
  }
}
