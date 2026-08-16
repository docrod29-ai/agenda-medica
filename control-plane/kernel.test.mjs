/**
 * ACP-001 — focused tests for the executable state contract.
 *
 * Two layers, on purpose:
 *
 *   1. Direct tests. Each central guard is fed the exact defect it exists to
 *      stop, and the expected rejection code is asserted.
 *   2. Reverse / mutation proof. For every central guard, the guard is removed
 *      or inverted in a copy of `kernel.mjs`, the mutant is imported, and the
 *      same input is asserted to be ACCEPTED by the mutant. That is what makes
 *      layer 1 non-tautological: if the guard were deleted, the direct test
 *      would fail, and the mutation test proves the rejection comes from that
 *      guard and not from some other coincidental check.
 *
 * Run: node --test control-plane/*.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  BOARD_PATH,
  SCHEMA_PATH,
  CANONICAL_BOARD_RELATIVE_PATH,
  TRANSITIONS,
  NEXT_ACTIONS,
  NO_LOCK,
  acquireWriterLock,
  releaseWriterLock,
  assertExecutionAuthority,
  checkActivePrograms,
  checkConcurrency,
  checkDependencies,
  checkPolicyInvariants,
  evaluateBoard,
  evaluateTransition,
  runCheck,
  selectNextItem,
  statusForJudgeVerdict,
  validateAgainstSchema,
} from './kernel.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const KERNEL_PATH = join(HERE, 'kernel.mjs')
const KERNEL_SOURCE = readFileSync(KERNEL_PATH, 'utf8')
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
const CANONICAL_BOARD = JSON.parse(readFileSync(BOARD_PATH, 'utf8'))

// --- helpers ---------------------------------------------------------------

/** A board whose only eligible item is ACP-001 in READY. */
function readyBoard() {
  const board = structuredClone(CANONICAL_BOARD)
  const item = board.items.find((entry) => entry.id === 'ACP-001')
  item.status = 'READY'
  item.closed_by = null
  return board
}

function itemOf(board, id) {
  return board.items.find((entry) => entry.id === id)
}

function codes(result) {
  return (result.violations ?? result).map((entry) => entry.code)
}

let mutantCounter = 0

/**
 * Textually mutate the kernel and import the result. Each anchor must appear
 * exactly once, so renaming a guard breaks this loudly instead of silently
 * turning the mutation into a no-op (which would make the proof vacuous).
 */
async function loadMutant(replacements) {
  let source = KERNEL_SOURCE
  for (const [find, replace] of replacements) {
    const occurrences = source.split(find).length - 1
    assert.equal(occurrences, 1, `mutation anchor must appear exactly once: ${JSON.stringify(find)}`)
    source = source.replace(find, replace)
  }
  assert.notEqual(source, KERNEL_SOURCE, 'mutation must actually change the source')
  const file = join(tmpdir(), `acp001-mutant-${process.pid}-${mutantCounter++}.mjs`)
  writeFileSync(file, source, 'utf8')
  return import(pathToFileURL(file).href)
}

const LOCK = { active: true, item_id: 'ACP-001', holder: 'CLAUDE_OPUS', run_id: 'run-1' }
const CLOSURE_CONTEXT = { judge_verdict: 'PASS', judge_independent: true, judge_read_only: true }

// ---------------------------------------------------------------------------
// Canonical board
// ---------------------------------------------------------------------------

test('canonical board validates against the committed schema', () => {
  const result = validateAgainstSchema(SCHEMA, CANONICAL_BOARD)
  assert.deepEqual(result.errors, [])
  assert.equal(result.ok, true)
})

test('`check` on the canonical board succeeds and emits machine-readable output', () => {
  const result = runCheck()
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2))
  assert.equal(result.violation_count, 0)
  assert.equal(result.board_path, CANONICAL_BOARD_RELATIVE_PATH)
  assert.equal(result.program_id, 'AUSCULTA-AUTONOMOUS-CONTROL-PLANE-001')
  assert.equal(result.schema_valid, true)
  // Fail-closed authorizations are asserted in the output, not merely implied.
  assert.deepEqual(result.authorizations, {
    production_deploy: false,
    main_merge: false,
    phi: false,
    destructive: false,
    clinical_policy: false,
    production_secret_rotation: false,
  })
  assert.ok(Object.keys(result.github_outputs).length > 0)
  for (const value of Object.values(result.github_outputs)) {
    assert.equal(typeof value, 'string', 'GitHub Actions outputs must be flat strings')
  }
})

test('output is deterministic: the same board yields byte-identical JSON', () => {
  const first = JSON.stringify(evaluateBoard({ board: readyBoard(), schema: SCHEMA }))
  const second = JSON.stringify(evaluateBoard({ board: readyBoard(), schema: SCHEMA }))
  assert.equal(first, second)
})

test('CLI `check` exits 0 and prints parseable JSON', () => {
  const stdout = execFileSync(process.execPath, [KERNEL_PATH, 'check'], { cwd: REPO, encoding: 'utf8' })
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.contract, 'control-plane/kernel/1')
  assert.ok('next_item' in parsed)
  assert.ok('next_action' in parsed)
})

// ---------------------------------------------------------------------------
// 1. Happy path
// ---------------------------------------------------------------------------

test('happy path: exactly one eligible item is selected deterministically', () => {
  const result = evaluateBoard({ board: readyBoard(), schema: SCHEMA })
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2))
  assert.equal(result.next_action, NEXT_ACTIONS.RUN_WRITER)
  assert.equal(result.next_item.id, 'ACP-001')
  assert.equal(result.next_item.owner, 'CLAUDE_OPUS')
  assert.equal(result.github_outputs.next_item_id, 'ACP-001')
})

test('happy path: the full writer -> CI -> freeze -> judge -> close lifecycle is legal', () => {
  const legs = [
    ['READY', 'RUNNING_WRITER', { writer_lock: LOCK, item_id: 'ACP-001' }],
    ['RUNNING_WRITER', 'WRITER_DONE', {}],
    ['WRITER_DONE', 'CI_PENDING', {}],
    ['CI_PENDING', 'SHA_FROZEN', {}],
    ['SHA_FROZEN', 'RUNNING_JUDGE', {}],
    ['RUNNING_JUDGE', 'JUDGE_PASS', { judge_verdict: 'PASS' }],
    ['JUDGE_PASS', 'CLOSED', CLOSURE_CONTEXT],
  ]
  for (const [from, to, context] of legs) {
    const result = evaluateTransition(from, to, context)
    assert.equal(result.ok, true, `${from} -> ${to}: ${JSON.stringify(result.violation)}`)
  }
})

test('happy path: an in-flight item is advanced, never replaced by a second writer', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-001').status = 'WRITER_DONE'
  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2))
  assert.equal(result.next_action, NEXT_ACTIONS.ADVANCE_IN_FLIGHT)
  assert.equal(result.next_item.id, 'ACP-001')
  assert.deepEqual(result.in_flight, ['ACP-001'])
  assert.deepEqual(result.allowed_next_statuses, ['CI_PENDING', 'BLOCKED'])
  assert.ok(!result.allowed_next_statuses.includes('CLOSED'), 'a writer may never close its own item')
})

test('happy path: an authorized P0 repair loop is allowed', () => {
  const result = evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', { findings: [{ id: 'F1', severity: 'P0' }] })
  assert.equal(result.ok, true, JSON.stringify(result.violation))
})

// ---------------------------------------------------------------------------
// 2. Illegal transitions and skipped states
// ---------------------------------------------------------------------------

test('illegal transition: CLOSED is terminal', () => {
  const result = evaluateTransition('CLOSED', 'READY', {})
  assert.equal(result.ok, false)
  assert.equal(result.violation.code, 'ILLEGAL_TRANSITION')
})

test('illegal transition: a skip is reported as SKIPPED_STATE, not merely illegal', () => {
  const skipCi = evaluateTransition('WRITER_DONE', 'SHA_FROZEN', {})
  assert.equal(skipCi.ok, false)
  assert.equal(skipCi.violation.code, 'SKIPPED_STATE')

  const skipEverything = evaluateTransition('READY', 'CLOSED', CLOSURE_CONTEXT)
  assert.equal(skipEverything.ok, false)
  assert.equal(skipEverything.violation.code, 'SKIPPED_STATE')
})

test('illegal transition: an unknown status is rejected instead of assumed benign', () => {
  const result = evaluateTransition('READY', 'DEPLOYED_TO_PRODUCTION', {})
  assert.equal(result.ok, false)
  assert.equal(result.violation.code, 'UNKNOWN_STATUS')
})

test('illegal transition: leaving BLOCKED or OWNER_APPROVAL_REQUIRED needs owner approval', () => {
  const withoutOwner = evaluateTransition('OWNER_APPROVAL_REQUIRED', 'READY', {})
  assert.equal(withoutOwner.ok, false)
  assert.equal(withoutOwner.violation.code, 'OWNER_APPROVAL_REQUIRED')

  const withOwner = evaluateTransition('OWNER_APPROVAL_REQUIRED', 'READY', { owner_approval: true })
  assert.equal(withOwner.ok, true, JSON.stringify(withOwner.violation))
})

test('illegal transition: closure without an independent read-only PASS is rejected', () => {
  assert.equal(evaluateTransition('JUDGE_PASS', 'CLOSED', {}).violation.code, 'CLOSURE_WITHOUT_JUDGE_PASS')
  assert.equal(
    evaluateTransition('JUDGE_PASS', 'CLOSED', { judge_verdict: 'PASS' }).violation.code,
    'CLOSURE_WITHOUT_INDEPENDENT_JUDGE',
  )
  assert.equal(
    evaluateTransition('JUDGE_PASS', 'CLOSED', { judge_verdict: 'PASS', judge_independent: true }).violation.code,
    'CLOSURE_WITHOUT_READ_ONLY_JUDGE',
  )
})

test('reverse proof: without the transition table guard, READY -> CLOSED would be accepted', async () => {
  const mutant = await loadMutant([['  guardTableAndSkips,\n', '']])
  const real = evaluateTransition('READY', 'CLOSED', CLOSURE_CONTEXT)
  const mutated = mutant.evaluateTransition('READY', 'CLOSED', CLOSURE_CONTEXT)
  assert.equal(real.ok, false)
  assert.equal(mutated.ok, true, 'the mutation must actually disable the guard under test')
})

// ---------------------------------------------------------------------------
// 3. Two writers
// ---------------------------------------------------------------------------

test('two writers: a second run cannot claim a held lock', () => {
  const first = acquireWriterLock(NO_LOCK, { item_id: 'ACP-001', holder: 'CLAUDE_OPUS', run_id: 'run-1' })
  assert.equal(first.ok, true)
  assert.equal(first.lock.active, true)

  const second = acquireWriterLock(first.lock, { item_id: 'ACP-002', holder: 'CLAUDE_OPUS', run_id: 'run-2' })
  assert.equal(second.ok, false)
  assert.equal(second.violation.code, 'WRITER_LOCK_HELD')
  assert.equal(second.lock.run_id, 'run-1', 'a rejected claim must not steal the lock')
})

test('two writers: the same run re-claiming the same item is idempotent, not a second writer', () => {
  const first = acquireWriterLock(NO_LOCK, { item_id: 'ACP-001', holder: 'CLAUDE_OPUS', run_id: 'run-1' })
  const retry = acquireWriterLock(first.lock, { item_id: 'ACP-001', holder: 'CLAUDE_OPUS', run_id: 'run-1' })
  assert.equal(retry.ok, true)
  assert.equal(retry.reused, true)
})

test('two writers: only the holding run may release, and a writer cannot start without the lock', () => {
  const held = acquireWriterLock(NO_LOCK, { item_id: 'ACP-001', holder: 'CLAUDE_OPUS', run_id: 'run-1' }).lock
  assert.equal(releaseWriterLock(held, { run_id: 'run-2' }).violation.code, 'WRITER_LOCK_OWNED_BY_ANOTHER_RUN')
  assert.equal(releaseWriterLock(held, { run_id: 'run-1' }).ok, true)

  const unlocked = evaluateTransition('READY', 'RUNNING_WRITER', {})
  assert.equal(unlocked.ok, false)
  assert.equal(unlocked.violation.code, 'WRITER_LOCK_NOT_HELD')

  const wrongItem = evaluateTransition('READY', 'RUNNING_WRITER', { writer_lock: held, item_id: 'ACP-002' })
  assert.equal(wrongItem.violation.code, 'WRITER_LOCK_ITEM_MISMATCH')
})

test('two writers: a board with two RUNNING_WRITER items is rejected', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-001').status = 'RUNNING_WRITER'
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  assert.ok(codes(checkConcurrency(board)).includes('MULTIPLE_ACTIVE_WRITERS'))

  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, false)
  assert.equal(result.next_action, NEXT_ACTIONS.HALT)
  assert.ok(codes(result).includes('MULTIPLE_ACTIVE_WRITERS'))
})

test('two programs: a second canonical board is rejected', () => {
  const boards = [
    { path: 'control-plane/MASTER_BOARD.json', board: CANONICAL_BOARD },
    { path: 'control-plane/OTHER_BOARD.json', board: structuredClone(CANONICAL_BOARD) },
  ]
  assert.ok(codes(checkActivePrograms(boards)).includes('MULTIPLE_CANONICAL_BOARDS'))
  assert.deepEqual(checkActivePrograms([boards[0]]), [])
})

test('reverse proof: without the lock-held check, two runs would both hold the lock', async () => {
  const mutant = await loadMutant([['if (currentLock && currentLock.active === true) {', 'if (false) {']])
  const held = acquireWriterLock(NO_LOCK, { item_id: 'ACP-001', holder: 'CLAUDE_OPUS', run_id: 'run-1' }).lock
  assert.equal(acquireWriterLock(held, { item_id: 'ACP-002', holder: 'CLAUDE_OPUS', run_id: 'run-2' }).ok, false)
  assert.equal(mutant.acquireWriterLock(held, { item_id: 'ACP-002', holder: 'CLAUDE_OPUS', run_id: 'run-2' }).ok, true)
})

test('reverse proof: without the writer-count check, two RUNNING_WRITER items would pass', async () => {
  const mutant = await loadMutant([['if (writers.length > maxWriters) {', 'if (false) {']])
  const board = readyBoard()
  itemOf(board, 'ACP-001').status = 'RUNNING_WRITER'
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  assert.ok(codes(checkConcurrency(board)).includes('MULTIPLE_ACTIVE_WRITERS'))
  assert.ok(!codes(mutant.checkConcurrency(board)).includes('MULTIPLE_ACTIVE_WRITERS'))
})

// ---------------------------------------------------------------------------
// 4. Dependency violations and ambiguity
// ---------------------------------------------------------------------------

test('dependency violation: an item cannot be READY while a dependency is open', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-002').status = 'READY' // depends on ACP-001, which is READY, not CLOSED
  const violations = checkDependencies(board)
  assert.ok(codes(violations).includes('DEPENDENCY_VIOLATION'))

  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, false)
  assert.equal(result.next_item, null, 'a failed board must never hand out a next item')
})

test('dependency violation: an unknown dependency halts instead of being ignored', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-001').dependencies = ['ACP-999']
  itemOf(board, 'ACP-001').blocked_by = ['ACP-999']
  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes('UNKNOWN_DEPENDENCY'))
})

test('dependency violation: blocked_by must tell the truth about open dependencies', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-002').blocked_by = [] // ACP-001 is open but no longer declared
  assert.ok(codes(checkDependencies(board)).includes('BLOCKED_BY_OUT_OF_SYNC'))
})

test('two simultaneously eligible items halt instead of being silently ordered', () => {
  const board = readyBoard()
  const acp002 = itemOf(board, 'ACP-002')
  acp002.status = 'READY'
  acp002.dependencies = []
  acp002.blocked_by = []
  const selection = selectNextItem(board)
  assert.equal(selection.ok, false)
  assert.equal(selection.next_item, null)
  assert.deepEqual(selection.candidates, ['ACP-001', 'ACP-002'], 'candidate order must be deterministic')
  assert.ok(codes(selection).includes('AMBIGUOUS_NEXT_ITEM'))
})

test('a BLOCKED item halts the program and yields no next item', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-001').status = 'BLOCKED'
  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, false)
  assert.equal(result.next_item, null)
  assert.ok(codes(result).includes('PROGRAM_BLOCKED'))
})

test('reverse proof: without the dependency guard, a READY item with an open dependency would pass', async () => {
  const mutant = await loadMutant([
    ['STATUSES_REQUIRING_MET_DEPENDENCIES.includes(item.status) && unmet.length > 0', 'false'],
  ])
  const board = readyBoard()
  itemOf(board, 'ACP-002').status = 'READY'
  assert.ok(codes(checkDependencies(board)).includes('DEPENDENCY_VIOLATION'))
  assert.ok(!codes(mutant.checkDependencies(board)).includes('DEPENDENCY_VIOLATION'))
})

test('reverse proof: without the ambiguity guard, a next item would be handed out anyway', async () => {
  const mutant = await loadMutant([['if (eligible.length > 1) {', 'if (false) {']])
  const board = readyBoard()
  const acp002 = itemOf(board, 'ACP-002')
  acp002.status = 'READY'
  acp002.dependencies = []
  acp002.blocked_by = []
  assert.equal(selectNextItem(board).next_item, null)
  assert.equal(mutant.selectNextItem(board).next_item?.id, 'ACP-001')
})

// ---------------------------------------------------------------------------
// 5. Stale legacy authority
// ---------------------------------------------------------------------------

test('stale legacy authority: agent-state/MASTER_STATE.json may never drive execution', () => {
  const result = assertExecutionAuthority(CANONICAL_BOARD, 'agent-state/MASTER_STATE.json')
  assert.equal(result.ok, false)
  assert.equal(result.violation.code, 'STALE_LEGACY_AUTHORITY')

  const backlog = assertExecutionAuthority(CANONICAL_BOARD, 'agent-state/BACKLOG.json')
  assert.equal(backlog.ok, false)
  assert.equal(backlog.violation.code, 'STALE_LEGACY_AUTHORITY')

  assert.equal(assertExecutionAuthority(CANONICAL_BOARD, CANONICAL_BOARD_RELATIVE_PATH).ok, true)
})

test('stale legacy authority: an absolute path to legacy state is caught too', () => {
  const result = assertExecutionAuthority(CANONICAL_BOARD, join(REPO, 'agent-state', 'MASTER_STATE.json'))
  assert.equal(result.ok, false)
  assert.equal(result.violation.code, 'STALE_LEGACY_AUTHORITY')
})

test('stale legacy authority: evaluating a board from a legacy path fails closed', () => {
  const result = evaluateBoard({ board: readyBoard(), schema: SCHEMA, boardPath: 'agent-state/MASTER_STATE.json' })
  assert.equal(result.ok, false)
  assert.equal(result.next_item, null)
  assert.ok(codes(result).includes('STALE_LEGACY_AUTHORITY'))
})

test('a non-canonical board is rejected as an execution authority', () => {
  const board = structuredClone(CANONICAL_BOARD)
  board.canonical = false
  const result = assertExecutionAuthority(board, CANONICAL_BOARD_RELATIVE_PATH)
  assert.equal(result.ok, false)
  assert.equal(result.violation.code, 'BOARD_NOT_CANONICAL')
})

test('reverse proof: without the legacy classification check, legacy state would be accepted', async () => {
  const mutant = await loadMutant([
    ['if (LEGACY_CLASSIFICATIONS_FORBIDDING_EXECUTION.includes(classification)) {', 'if (false) {'],
  ])
  assert.equal(assertExecutionAuthority(CANONICAL_BOARD, 'agent-state/MASTER_STATE.json').violation.code, 'STALE_LEGACY_AUTHORITY')
  const mutated = mutant.assertExecutionAuthority(CANONICAL_BOARD, 'agent-state/MASTER_STATE.json')
  assert.notEqual(mutated.violation?.code, 'STALE_LEGACY_AUTHORITY')
})

// ---------------------------------------------------------------------------
// 6. Production / main authorization drift
// ---------------------------------------------------------------------------

test('authorization drift: production deploy or main merge turning true fails closed', () => {
  for (const key of ['production_deploy_authorized', 'main_merge_authorized', 'phi_allowed', 'destructive_changes_authorized']) {
    const board = readyBoard()
    board.execution_policy[key] = true
    const result = evaluateBoard({ board, schema: SCHEMA })
    assert.equal(result.ok, false, `${key} = true must fail`)
    assert.equal(result.next_item, null)
    // Two independent guards must both catch it: the committed schema const,
    // and the policy invariant check that does not trust the schema.
    assert.ok(codes(result).includes('SCHEMA_VALIDATION_FAILED'), `${key}: schema guard`)
    assert.ok(codes(result).includes('POLICY_AUTHORIZATION_DRIFT'), `${key}: policy guard`)
  }
})

test('authorization drift: the policy check stands on its own if the schema is weakened', () => {
  const board = readyBoard()
  board.execution_policy.production_deploy_authorized = true
  board.execution_policy.main_merge_authorized = true
  const found = checkPolicyInvariants(board)
  const paths = found.map((entry) => entry.path)
  assert.ok(paths.includes('/execution_policy/production_deploy_authorized'))
  assert.ok(paths.includes('/execution_policy/main_merge_authorized'))
})

test('authorization drift: a missing policy flag is a violation, not a default', () => {
  const board = readyBoard()
  delete board.execution_policy.main_merge_authorized
  assert.ok(codes(checkPolicyInvariants(board)).includes('POLICY_KEY_MISSING'))
})

test('clinical-policy changes are false unless an OWNER_APPROVAL_REQUIRED state exists', () => {
  const withoutGate = readyBoard()
  withoutGate.execution_policy.clinical_policy_changes_authorized = true
  assert.ok(codes(checkPolicyInvariants(withoutGate)).includes('POLICY_OWNER_GATE_MISSING'))

  const withGate = readyBoard()
  withGate.execution_policy.clinical_policy_changes_authorized = true
  itemOf(withGate, 'ACP-002').status = 'OWNER_APPROVAL_REQUIRED'
  assert.ok(!codes(checkPolicyInvariants(withGate)).includes('POLICY_OWNER_GATE_MISSING'))
})

test('freeze-before-judge and read-only-judge must stay true', () => {
  for (const key of ['freeze_sha_before_judge', 'judge_must_be_read_only']) {
    const board = readyBoard()
    board.execution_policy[key] = false
    assert.ok(codes(checkPolicyInvariants(board)).includes('POLICY_AUTHORIZATION_DRIFT'), key)
  }
})

test('reverse proof: dropping a key from POLICY_MUST_BE_FALSE would let drift through', async () => {
  const mutant = await loadMutant([["  'production_deploy_authorized',\n  'main_merge_authorized',\n", '']])
  const board = readyBoard()
  board.execution_policy.production_deploy_authorized = true
  board.execution_policy.main_merge_authorized = true
  assert.ok(codes(checkPolicyInvariants(board)).includes('POLICY_AUTHORIZATION_DRIFT'))
  assert.ok(!codes(mutant.checkPolicyInvariants(board)).includes('POLICY_AUTHORIZATION_DRIFT'))
})

// ---------------------------------------------------------------------------
// 7. UNVERIFIABLE and P2/P3
// ---------------------------------------------------------------------------

test('UNVERIFIABLE promotion attempt: it can never become a PASS', () => {
  const promotion = evaluateTransition('RUNNING_JUDGE', 'JUDGE_PASS', { judge_verdict: 'UNVERIFIABLE' })
  assert.equal(promotion.ok, false)
  assert.equal(promotion.violation.code, 'UNVERIFIABLE_MANDATORY_GATE')

  const closure = evaluateTransition('JUDGE_PASS', 'CLOSED', {
    judge_verdict: 'UNVERIFIABLE',
    judge_independent: true,
    judge_read_only: true,
  })
  assert.equal(closure.ok, false)
  assert.equal(closure.violation.code, 'UNVERIFIABLE_MANDATORY_GATE')

  // BLOCKED is the only door out of UNVERIFIABLE.
  assert.equal(evaluateTransition('RUNNING_JUDGE', 'BLOCKED', { judge_verdict: 'UNVERIFIABLE' }).ok, true)
})

test('UNVERIFIABLE maps to BLOCKED with an explicit stop condition', () => {
  assert.deepEqual(statusForJudgeVerdict('UNVERIFIABLE'), {
    ok: true,
    status: 'BLOCKED',
    stop_condition: 'UNVERIFIABLE_MANDATORY_GATE',
  })
  assert.equal(statusForJudgeVerdict('PASS').status, 'JUDGE_PASS')
  assert.equal(statusForJudgeVerdict('FAIL').status, 'JUDGE_FAIL')
  assert.equal(statusForJudgeVerdict('PROBABLY_FINE').ok, false)
})

test('an unknown judge verdict is rejected rather than treated as a pass', () => {
  const result = evaluateTransition('RUNNING_JUDGE', 'JUDGE_PASS', { judge_verdict: 'LOOKS_OK' })
  assert.equal(result.ok, false)
  assert.equal(result.violation.code, 'UNKNOWN_JUDGE_VERDICT')
})

test('P2/P3 findings never open an automatic repair loop', () => {
  const lowSeverity = evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', {
    findings: [{ id: 'F1', severity: 'P2' }, { id: 'F2', severity: 'P3' }],
  })
  assert.equal(lowSeverity.ok, false)
  assert.equal(lowSeverity.violation.code, 'P2_P3_AUTO_REPAIR_FORBIDDEN')

  const noFindings = evaluateTransition('CI_FAILED', 'REPAIR_READY', {})
  assert.equal(noFindings.ok, false)
  assert.equal(noFindings.violation.code, 'REPAIR_WITHOUT_FINDINGS')

  const mixed = evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', {
    findings: [{ id: 'F1', severity: 'P3' }, { id: 'F2', severity: 'P1' }],
  })
  assert.equal(mixed.ok, true, 'a P1 alongside a P3 still justifies the loop')
})

test('reverse proof: without the UNVERIFIABLE guard, it would be promoted to PASS', async () => {
  const mutant = await loadMutant([['  guardUnverifiableNeverPasses,\n', '']])
  const context = { judge_verdict: 'UNVERIFIABLE' }
  assert.equal(evaluateTransition('RUNNING_JUDGE', 'JUDGE_PASS', context).ok, false)
  assert.equal(mutant.evaluateTransition('RUNNING_JUDGE', 'JUDGE_PASS', context).ok, true)
})

test('reverse proof: without the severity guard, P2/P3 would open a repair loop', async () => {
  const mutant = await loadMutant([['  guardNoAutoRepairForP2P3,\n', '']])
  const context = { findings: [{ id: 'F1', severity: 'P3' }] }
  assert.equal(evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', context).ok, false)
  assert.equal(mutant.evaluateTransition('JUDGE_FAIL', 'REPAIR_READY', context).ok, true)
})

// ---------------------------------------------------------------------------
// 8. Schema authority is fail-closed
// ---------------------------------------------------------------------------

test('the schema is the authority: unknown top-level properties are rejected', () => {
  const board = readyBoard()
  board.autonomous_deploy_authorized = true
  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes('SCHEMA_VALIDATION_FAILED'))
})

test('an item status outside the board status_model is rejected', () => {
  const board = readyBoard()
  itemOf(board, 'ACP-002').status = 'IN_PROGRESS' // allowed by the schema enum, absent from status_model
  const result = evaluateBoard({ board, schema: SCHEMA })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes('UNKNOWN_STATUS') || codes(result).includes('STATUS_OUT_OF_MODEL'))
})

test('a schema keyword this validator does not implement throws instead of passing', () => {
  const schema = { type: 'object', properties: { a: { type: 'number', maximum: 3 } } }
  assert.throws(() => validateAgainstSchema(schema, { a: 99 }), /UNSUPPORTED_SCHEMA_KEYWORD:maximum/)

  // Same defect reached through a property the canonical board actually has.
  const boardSchema = { type: 'object', properties: { program_id: { type: 'string', maxLength: 3 } } }
  const result = evaluateBoard({ board: readyBoard(), schema: boardSchema })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes('SCHEMA_UNSUPPORTED'))
})

test('reverse proof: without the unknown-keyword check, an unenforced constraint would pass silently', async () => {
  const mutant = await loadMutant([
    ['if (!SUPPORTED_KEYWORDS.has(keyword) && !ANNOTATION_KEYWORDS.has(keyword)) {', 'if (false) {'],
  ])
  const schema = { type: 'object', properties: { a: { type: 'number', maximum: 3 } } }
  assert.throws(() => validateAgainstSchema(schema, { a: 99 }))
  assert.equal(mutant.validateAgainstSchema(schema, { a: 99 }).ok, true)
})

// ---------------------------------------------------------------------------
// 9. Transition table shape
// ---------------------------------------------------------------------------

test('every transition target is itself a known status and CLOSED is terminal', () => {
  const known = new Set(Object.keys(TRANSITIONS))
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    for (const to of targets) {
      assert.ok(known.has(to), `${from} -> ${to} targets an unknown status`)
    }
  }
  assert.deepEqual(TRANSITIONS.CLOSED, [])
})

test('no transition table entry allows reaching CLOSED without passing through the judge', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    if (!targets.includes('CLOSED')) continue
    assert.ok(
      from === 'JUDGE_PASS' || from === 'OWNER_APPROVAL_REQUIRED',
      `${from} must not lead directly to CLOSED`,
    )
  }
})
